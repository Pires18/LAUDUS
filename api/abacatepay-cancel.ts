import { getDb } from './_firebase.js';
import { verifyAuth, isAdmin } from './_auth.js';

/**
 * Cancela a assinatura recorrente. Diferente do cancelamento local anterior,
 * este endpoint também solicita o cancelamento no AbacatePay para interromper
 * a cobrança recorrente. Se o gateway falhar, marca `gatewayCancelPending`
 * para acompanhamento manual pelo admin — mas o acesso local é sempre revogado
 * ao fim do período.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    const { userId, subscriptionId } = req.body || {};
    if (!userId || !subscriptionId) {
      return res.status(400).json({ error: 'userId e subscriptionId são obrigatórios.' });
    }

    const db = await getDb();
    if (authed.uid !== userId && !(await isAdmin(db, authed.uid))) {
      return res.status(403).json({ error: 'Sem permissão para cancelar esta assinatura.' });
    }

    const subRef = db.collection('subscriptions').doc(subscriptionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) return res.status(404).json({ error: 'Assinatura não encontrada.' });
    const subData = subSnap.data() || {};
    const gatewaySubId = subData.abacatePaySubscriptionId;

    // Resolve API key (Firestore > env).
    let apiKey = (process.env.ABACATEPAY_API_KEY || '').trim();
    try {
      const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
      if (configSnap.exists && configSnap.data()?.apiKey) apiKey = configSnap.data()!.apiKey.trim();
    } catch { /* usa env */ }

    // Apenas planos mensais (subscription recorrente) têm abacatePaySubscriptionId.
    // Planos semestrais/anuais são checkouts avulsos — gatewaySubId será vazio
    // e o bloco abaixo é naturalmente ignorado, sem necessidade de tratar separado.
    let gatewayCancelPending = false;
    if (gatewaySubId && apiKey) {
      try {
        const resp = await fetch('https://api.abacatepay.com/v2/subscriptions/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ id: gatewaySubId }),
        });
        const result = await resp.json().catch(() => null);
        if (!resp.ok || result?.success === false) {
          gatewayCancelPending = true;
          console.error('[CANCEL] Gateway recusou cancelamento:', result);
        }
      } catch (err: any) {
        gatewayCancelPending = true;
        console.error('[CANCEL] Falha de rede ao cancelar no gateway:', err.message);
      }
    }

    const now = Date.now();
    // Zera `addons` no cancelamento — sem isso, uma reativação manual
    // (admin) reaproveitaria add-ons antigos sem decisão explícita. O
    // bloqueio de acesso em si já é feito via status/subscriptionStatus
    // (useSubscription.ts só considera add-ons com assinatura ativa).
    await subRef.set({ status: 'canceled', canceledAt: now, gatewayCancelPending, addons: [], updatedAt: now }, { merge: true });
    await db.collection('users').doc(userId).set({ subscriptionStatus: 'canceled', updatedAt: now }, { merge: true });

    return res.status(200).json({ success: true, gatewayCancelPending });

  } catch (error: any) {
    console.error('[CANCEL] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
