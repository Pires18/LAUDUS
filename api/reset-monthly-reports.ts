import { getDb, getAdminAuth } from './_firebase.js';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS  =  7 * 24 * 60 * 60 * 1000;

/**
 * Modo CRON (GET): protegido por CRON_SECRET (Vercel envia `Authorization: Bearer <CRON_SECRET>`).
 * Itera todas as assinaturas e:
 *  - reseta `reportsUsedThisMonth` cujo período de 30 dias venceu;
 *  - marca `past_due` quando `currentPeriodEnd` passou e o status era `active`.
 */
async function runCronBatch(req: any, res: any) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.query?.secret || '');
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: 'Cron não autorizado.' });
  }

  const db = await getDb();
  const now = Date.now();
  const snap = await db.collection('subscriptions').get();

  let resetCount = 0;
  let pastDueCount = 0;
  const batch = db.batch();

  snap.docs.forEach((docSnap: any) => {
    const sub = docSnap.data() || {};
    const updates: Record<string, any> = {};

    // Reset de quota mensal vencida.
    const lastResetAt = sub.lastResetAt || 0;
    if (lastResetAt && now > lastResetAt + THIRTY_DAYS) {
      let nextResetAt = lastResetAt + THIRTY_DAYS;
      if (now > nextResetAt + THIRTY_DAYS) nextResetAt = now;
      updates.reportsUsedThisMonth = 0;
      updates.lastResetAt = nextResetAt;
      resetCount++;
    }

    // Expiração de período → past_due (a renovação real virá pelo webhook).
    if (sub.status === 'active' && sub.currentPeriodEnd && now > sub.currentPeriodEnd) {
      updates.status = 'past_due';
      pastDueCount++;
      if (sub.userId) {
        batch.set(db.collection('users').doc(sub.userId), { subscriptionStatus: 'past_due', updatedAt: now }, { merge: true });
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now;
      batch.set(docSnap.ref, updates, { merge: true });
    }
  });

  await batch.commit();

  // Limpa pending_checkouts com mais de 7 dias (evita acúmulo indefinido).
  let cleanedCheckouts = 0;
  try {
    const staleSnap = await db.collection('pending_checkouts')
      .where('createdAt', '<', now - SEVEN_DAYS)
      .get();
    if (!staleSnap.empty) {
      const cleanBatch = db.batch();
      staleSnap.docs.forEach((d: any) => cleanBatch.delete(d.ref));
      await cleanBatch.commit();
      cleanedCheckouts = staleSnap.size;
    }
  } catch (cleanErr) {
    console.warn('[CRON RESET] Falha ao limpar pending_checkouts:', cleanErr);
  }

  console.log(`[CRON RESET] reset=${resetCount} pastDue=${pastDueCount} cleanedCheckouts=${cleanedCheckouts} de ${snap.size} assinaturas.`);
  return res.status(200).json({ success: true, reset: resetCount, pastDue: pastDueCount, cleanedCheckouts, total: snap.size });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Modo cron (Vercel Cron usa GET).
  if (req.method === 'GET') return runCronBatch(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ── Modo per-user (autenticado) ──
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const auth = await getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    const { userId, subscriptionId } = req.body || {};
    if (!userId || !subscriptionId) {
      return res.status(400).json({ error: 'userId e subscriptionId são obrigatórios.' });
    }

    const db = await getDb();
    if (decoded.uid !== userId) {
      const callerSnap = await db.collection('users').doc(decoded.uid).get();
      const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
      if (callerRole !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão para resetar quota de outro usuário.' });
      }
    }

    const userRef = db.collection('users').doc(userId);
    const subRef  = db.collection('subscriptions').doc(subscriptionId);

    const result = await db.runTransaction(async (transaction: any) => {
      const subSnap = await transaction.get(subRef);
      if (!subSnap.exists) throw new Error('Assinatura não encontrada.');

      const subData = subSnap.data() || {};
      const lastResetAt = subData.lastResetAt || 0;
      const now = Date.now();

      if (now <= lastResetAt + THIRTY_DAYS) {
        return { reset: false, reason: 'Período de 30 dias ainda não se esgotou.' };
      }

      let nextResetAt = lastResetAt + THIRTY_DAYS;
      if (now > nextResetAt + THIRTY_DAYS) nextResetAt = now;

      transaction.update(subRef,  { reportsUsedThisMonth: 0, lastResetAt: nextResetAt, updatedAt: now });
      transaction.update(userRef, { reportsUsedThisMonth: 0, updatedAt: now });

      return { reset: true, nextResetAt };
    });

    if (!result.reset) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    console.log(`[RESET QUOTA] Resetada para usuário ${userId} (nova base: ${new Date(result.nextResetAt).toISOString()})`);
    return res.status(200).json({ success: true, nextResetAt: result.nextResetAt });

  } catch (error: any) {
    console.error('[RESET QUOTA] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
