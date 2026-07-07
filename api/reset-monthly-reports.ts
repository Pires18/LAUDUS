import { getDb, getAdminAuth } from './_firebase.js';
import { safeEqual } from './_secure.js';
import { isRecurringInterval } from './_pricing.js';
import { destroyPacsInstance } from './_pacsLifecycle.js';

const SEVEN_DAYS  =  7 * 24 * 60 * 60 * 1000;
const PACS_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Soma `months` meses a `baseMs` preservando o DIA do mês (ex.: dia 15 → dia
 * 15 do próximo mês), com clamp para meses mais curtos (dia 31 + 1 mês em
 * fevereiro → dia 28/29). Usa UTC para não depender do fuso do runtime.
 */
function addMonthsClamped(baseMs: number, months: number): number {
  const d = new Date(baseMs);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const daysInTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target.getTime();
}

/**
 * Próximo reset mensal de um usuário: mês calendário ancorado no DIA da
 * assinatura (`currentPeriodStart` — a data real da última renovação do
 * plano, atualizada pelo webhook a cada pagamento), não um contador fixo de
 * 30 dias corridos. Isso evita o reset "andar" pelo mês ao longo do tempo
 * (30 dias ≠ 1 mês civil) e mantém a contagem alinhada à renovação real —
 * inclusive para planos semestral/anual, cujo `currentPeriodStart` só muda a
 * cada renovação de verdade (o CRON cobre o "recarrega mensal" no meio do
 * período longo, sempre no mesmo dia do mês em que o plano começou).
 */
function nextMonthlyReset(lastResetAt: number, anchorMs: number): number {
  // Quantos meses já se passaram do anchor até o último reset registrado —
  // garante que a próxima ocorrência do dia-âncora seja estritamente após
  // lastResetAt, mesmo que lastResetAt não caia exatamente nesse dia.
  const anchorDate = new Date(anchorMs);
  let next = addMonthsClamped(anchorMs, 0);
  if (next <= lastResetAt) {
    const monthsBetween = Math.max(
      1,
      (new Date(lastResetAt).getUTCFullYear() - anchorDate.getUTCFullYear()) * 12
        + (new Date(lastResetAt).getUTCMonth() - anchorDate.getUTCMonth())
    );
    next = addMonthsClamped(anchorMs, monthsBetween);
    while (next <= lastResetAt) next = addMonthsClamped(next, 1);
  }
  return next;
}

/**
 * Modo CRON (GET): protegido por CRON_SECRET (Vercel envia `Authorization: Bearer <CRON_SECRET>`).
 * Itera todas as assinaturas e:
 *  - reseta `reportsUsedThisMonth` cujo período de 30 dias venceu;
 *  - marca `past_due` quando `currentPeriodEnd` passou e o status era `active`.
 */
async function runCronBatch(req: any, res: any) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(req.query?.secret || '');
  if (!secret || !safeEqual(provided, secret)) {
    return res.status(401).json({ error: 'Cron não autorizado.' });
  }

  const db = await getDb();
  const now = Date.now();
  const snap = await db.collection('subscriptions').get();

  let resetCount = 0;
  let pastDueCount = 0;
  let expiredCount = 0;
  const batch = db.batch();
  // Guarda o status FINAL (pós-atualização deste run) de cada assinatura —
  // usado na 2ª fase (lifecycle de PACS) sem precisar reler do banco.
  const finalStatusByDocId = new Map<string, string>();

  snap.docs.forEach((docSnap: any) => {
    const sub = docSnap.data() || {};
    const updates: Record<string, any> = {};
    finalStatusByDocId.set(docSnap.id, sub.status);

    // Reset de quota mensal vencida — mês calendário ancorado no dia real da
    // assinatura (currentPeriodStart), não em "30 dias corridos" desde o
    // último reset (que desalinha do dia de renovação ao longo do tempo).
    const lastResetAt = sub.lastResetAt || 0;
    const anchorMs = sub.currentPeriodStart || lastResetAt;
    if (lastResetAt && anchorMs) {
      const nextResetAt = nextMonthlyReset(lastResetAt, anchorMs);
      if (now > nextResetAt) {
        updates.reportsUsedThisMonth = 0;
        updates.lastResetAt = nextResetAt;
        resetCount++;
        // Espelha no doc do usuário — é de lá que o app lê o contador (e o
        // Math.max com o valor da assinatura, em useSubscription.ts, ignoraria
        // silenciosamente este reset se o campo do usuário não zerasse junto).
        if (sub.userId) {
          batch.set(db.collection('users').doc(sub.userId), { reportsUsedThisMonth: 0, updatedAt: now }, { merge: true });
        }
      }
    }

    // Expiração de período: só o mensal é recorrente de verdade (AbacatePay cobra
    // de novo sozinho) — vence e vira past_due, aguardando renovação via webhook
    // ou fatura criada pelo CRON billing. Semestral e anual são compra avulsa sem
    // cobrança automática — vencem e viram expired direto (confirmado como
    // comportamento intencional em 07/07/2026: período de graça não faz sentido
    // pra um plano que não vai renovar sozinho).
    // `interval` ausente (docs antigos) é tratado como recorrente por padrão — mais
    // seguro manter acesso do que cortar assinante pagador por campo ausente.
    if ((sub.status === 'active' || sub.status === 'past_due') && sub.currentPeriodEnd && now > sub.currentPeriodEnd) {
      const recurring = sub.interval ? isRecurringInterval(sub.interval) : true;
      // Planos recorrentes (mensal) viram past_due; planos avulsos (semestral/anual) expiram.
      const nextStatus = recurring ? 'past_due' : 'expired';
      if (sub.status !== nextStatus) {
        updates.status = nextStatus;
        finalStatusByDocId.set(docSnap.id, nextStatus);
        if (recurring) pastDueCount++; else expiredCount++;
        if (sub.userId) {
          batch.set(db.collection('users').doc(sub.userId), { subscriptionStatus: nextStatus, updatedAt: now }, { merge: true });
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now;
      batch.set(docSnap.ref, updates, { merge: true });
    }
  });

  await batch.commit();

  // ── Lifecycle de PACS (VM/tenant) por cancelamento/expiração ──
  // Fase 2, após o commit acima para já usar o status FINAL da assinatura:
  //  - status virou canceled/expired + PACS 'ready'  → marca 'suspended' com
  //    prazo de graça (não destrói ainda — dá tempo do usuário reativar).
  //  - 'suspended' com prazo vencido + AINDA canceled/expired → destrói de
  //    vez (GCP/tenant compartilhado) e zera o estado local.
  //  - 'suspended' mas a assinatura foi reativada antes do prazo → desfaz a
  //    suspensão (nunca chega a destruir).
  let pacsSuspendedCount = 0, pacsDestroyedCount = 0, pacsReactivatedCount = 0;
  const pacsBatch = db.batch();
  for (const docSnap of snap.docs) {
    const sub = docSnap.data() || {};
    const userId = sub.userId;
    if (!userId) continue;
    const finalStatus = finalStatusByDocId.get(docSnap.id);
    const isCanceledOrExpired = finalStatus === 'canceled' || finalStatus === 'expired';

    try {
      const settingsRef = db.collection('users').doc(userId).collection('settings').doc('app');
      const settingsSnap = await settingsRef.get();
      if (!settingsSnap.exists) continue;
      const inst = (settingsSnap.data() || {}).pacsInstance;
      if (!inst) continue;

      if (isCanceledOrExpired && inst.status === 'ready') {
        pacsBatch.set(settingsRef, {
          pacsInstance: { ...inst, status: 'suspended', scheduledDeletionAt: now + PACS_GRACE_PERIOD_MS, updatedAt: now },
        }, { merge: true });
        pacsSuspendedCount++;
      } else if (isCanceledOrExpired && inst.status === 'suspended' && inst.scheduledDeletionAt && now > inst.scheduledDeletionAt) {
        const result = await destroyPacsInstance({ provider: inst.provider, instanceName: inst.instanceName, tenantId: inst.tenantId });
        if (result.success) {
          pacsBatch.set(settingsRef, { pacsInstance: { status: 'none', updatedAt: now } }, { merge: true });
          pacsDestroyedCount++;
        } else {
          console.error(`[CRON PACS] Falha ao destruir PACS de ${userId}:`, result.error);
        }
      } else if (!isCanceledOrExpired && inst.status === 'suspended') {
        pacsBatch.set(settingsRef, {
          pacsInstance: { ...inst, status: 'ready', updatedAt: now },
        }, { merge: true });
        pacsReactivatedCount++;
      }
    } catch (pacsErr) {
      console.error(`[CRON PACS] Falha ao processar lifecycle de ${userId}:`, pacsErr);
    }
  }
  await pacsBatch.commit();

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

  console.log(`[CRON RESET] reset=${resetCount} pastDue=${pastDueCount} expired=${expiredCount} cleanedCheckouts=${cleanedCheckouts} pacsSuspended=${pacsSuspendedCount} pacsDestroyed=${pacsDestroyedCount} pacsReactivated=${pacsReactivatedCount} de ${snap.size} assinaturas.`);
  return res.status(200).json({
    success: true, reset: resetCount, pastDue: pastDueCount, expired: expiredCount, cleanedCheckouts, total: snap.size,
    pacsSuspended: pacsSuspendedCount, pacsDestroyed: pacsDestroyedCount, pacsReactivated: pacsReactivatedCount,
  });
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
      const anchorMs = subData.currentPeriodStart || lastResetAt;
      const now = Date.now();

      const nextResetAt = nextMonthlyReset(lastResetAt, anchorMs);
      if (now <= nextResetAt) {
        return { reset: false, reason: 'O ciclo mensal desta assinatura ainda não se esgotou.' };
      }

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
