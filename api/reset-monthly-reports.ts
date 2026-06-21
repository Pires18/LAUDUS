import { getDb } from './_firebase';

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, subscriptionId } = req.body || {};

    if (!userId || !subscriptionId) {
      return res.status(400).json({ error: 'userId e subscriptionId são obrigatórios.' });
    }

    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const subRef = db.collection('subscriptions').doc(subscriptionId);

    // Executa em uma transação Firestore para evitar condições de corrida
    const result = await db.runTransaction(async (transaction) => {
      const subSnap = await transaction.get(subRef);
      if (!subSnap.exists) {
        throw new Error('Assinatura não encontrada.');
      }

      const subData = subSnap.data() || {};
      const lastResetAt = subData.lastResetAt || 0;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // Validação de segurança: o período precisa ter passado
      if (now <= lastResetAt + thirtyDays) {
        return { reset: false, reason: 'Período de 30 dias ainda não se esgotou.' };
      }

      // Calcula o novo lastResetAt com base na data original para manter consistência,
      // ou cai para a data atual se for uma discrepância muito grande.
      let nextResetAt = lastResetAt + thirtyDays;
      if (now > nextResetAt + thirtyDays) {
        nextResetAt = now;
      }

      // Reset no documento da assinatura
      transaction.update(subRef, {
        reportsUsedThisMonth: 0,
        lastResetAt: nextResetAt,
        updatedAt: now,
      });

      // Reset no documento do usuário
      transaction.update(userRef, {
        reportsUsedThisMonth: 0,
        updatedAt: now,
      });

      return { reset: true, nextResetAt };
    });

    if (!result.reset) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    console.log(`[RESET QUOTA] Quota mensal resetada com sucesso para usuário ${userId} (nova data base: ${new Date(result.nextResetAt).toISOString()})`);
    return res.status(200).json({ success: true, nextResetAt: result.nextResetAt });

  } catch (error: any) {
    console.error('[RESET QUOTA] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
