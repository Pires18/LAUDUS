import { getDb } from './_firebase.js';
import { safeEqual } from './_secure.js';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * CRON — Faturamento Automático Mensal (modo invoice).
 *
 * Roda diariamente (03:45 UTC via vercel.json). Para cada assinatura mensal
 * ativa com billingMode: 'invoice' cujo currentPeriodEnd está a ≤ 3 dias,
 * cria uma nova fatura (checkout avulso) na AbacatePay e envia o link ao
 * usuário via e-mail (o AbacatePay dispara o e-mail automaticamente ao criar
 * o checkout).
 *
 * Idempotência: grava em pending_invoices/{userId}-{yyyymm} antes de criar o
 * checkout; re-runs do CRON no mesmo mês ignoram usuários já faturados.
 *
 * Protegido por CRON_SECRET (Vercel envia Authorization: Bearer <secret>).
 */
export default async function handler(req: any, res: any) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : String(req.query?.secret || '');
  if (!secret || !safeEqual(provided, secret)) {
    return res.status(401).json({ error: 'Cron não autorizado.' });
  }

  const db   = await getDb();
  const now  = Date.now();

  // Resolve API key (Firestore > env)
  let apiKey = (process.env.ABACATEPAY_API_KEY || '').trim();
  try {
    const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
    if (configSnap.exists && configSnap.data()?.apiKey) {
      apiKey = configSnap.data()!.apiKey.trim();
    }
  } catch { /* usa env */ }

  if (!apiKey) {
    console.warn('[CRON billing] API key ausente — nenhuma fatura criada.');
    return res.status(200).json({ ok: true, skipped: 'no_api_key' });
  }

  const apiBase     = 'https://api.abacatepay.com/v2';
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  const publicBase  = (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '') || 'https://laudus.vercel.app';

  // Busca assinaturas mensais no modo invoice que vencem em ≤ 3 dias
  let subsSnap: any;
  try {
    subsSnap = await db.collection('subscriptions')
      .where('status',      '==', 'active')
      .where('interval',    '==', 'month')
      .where('billingMode', '==', 'invoice')
      .get();
  } catch (e: any) {
    console.error('[CRON billing] Falha ao buscar assinaturas:', e.message);
    return res.status(500).json({ error: e.message });
  }

  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  const errors: string[] = [];

  // Chave de idempotência: userId + ano-mês (ex: "abc123-2026-07")
  const nowDate   = new Date(now);
  const yearMonth = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, '0')}`;

  for (const docSnap of subsSnap.docs) {
    const sub = docSnap.data() || {};
    const { userId, userEmail, planId, lastInvoiceAmount, currentPeriodEnd } = sub;

    if (!userId || !userEmail) continue;

    // Só fatura quem está a ≤ 3 dias do vencimento
    if (!currentPeriodEnd || (currentPeriodEnd - now) > THREE_DAYS_MS) continue;

    // Idempotência: verifica se já foi faturado neste mês
    const invoiceDocId = `${userId}-${yearMonth}`;
    try {
      const existing = await db.collection('pending_invoices').doc(invoiceDocId).get();
      if (existing.exists) {
        invoicesSkipped++;
        continue;
      }
    } catch { /* continua — tenta criar mesmo assim */ }

    // Resolve produto/preço
    let amount = Math.round((lastInvoiceAmount || 149) * 100); // centavos
    let productName = 'LAUD.US — Assinatura Mensal';
    let abacatePayProductId = '';

    try {
      if (planId) {
        const planSnap = await db.collection('saas_plans').doc(planId).get();
        if (planSnap.exists) {
          const pd = planSnap.data();
          if (pd) {
            productName = `Plano ${pd.name} (Mensal)`;
            const monthPrice = pd.prices?.month ?? pd.price ?? 149;
            amount = Math.round(monthPrice * 100);
            if (pd.abacatePayProductId) abacatePayProductId = pd.abacatePayProductId;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[CRON billing] Falha ao buscar plano de ${userId}:`, e.message);
    }

    // Garante produto na AbacatePay (mesmo mecanismo do checkout)
    const externalId = (abacatePayProductId
      || `laudus-${planId || 'plano-base'}-month-${amount}-sub`
    ).toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const getProductId = async (): Promise<string> => {
      try {
        const r = await fetch(`${apiBase}/products/get?externalId=${encodeURIComponent(externalId)}`, { headers: authHeaders });
        const j = await r.json();
        return j?.data?.id || '';
      } catch { return ''; }
    };

    let productId = await getProductId();
    if (!productId) {
      try {
        const createRes = await fetch(`${apiBase}/products/create`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ externalId, name: productName, price: amount, currency: 'BRL', frequency: 'MONTHLY' }),
        });
        const cj = await createRes.json();
        productId = cj?.data?.id || '';
        if (!productId) productId = await getProductId();
      } catch (e: any) {
        errors.push(`${userId}: falha ao criar produto — ${e.message}`);
        continue;
      }
    }
    if (!productId) {
      errors.push(`${userId}: produto não obtido`);
      continue;
    }

    // Cria a fatura (checkout avulso — AbacatePay envia e-mail automaticamente)
    const metadata = {
      userId,
      email: userEmail,
      type: 'subscription',
      addon: '',
      planId: planId || '',
      interval: 'month',
      billingMode: 'invoice',
      cronRenewal: true,
    };

    const invoiceUniqueId = `${externalId}-${yearMonth}`;
    const invoicePayload: Record<string, any> = {
      items: [{ id: productId, quantity: 1 }],
      methods: ['PIX', 'CARD'],
      card: { maxInstallments: 1 },
      returnUrl:     `${publicBase}/#settings?tab=assinatura`,
      completionUrl: `${publicBase}/#settings?tab=assinatura`,
      externalId:    invoiceUniqueId,
      metadata,
    };

    try {
      const invResp = await fetch(`${apiBase}/checkouts/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(invoicePayload),
      });
      const invJson = await invResp.json();
      const invUrl  = invJson?.data?.url;
      const invErr  = invJson?.error && (invJson.error.message || invJson.error);

      if (!invResp.ok || invErr || !invUrl) {
        errors.push(`${userId}: ${invErr || `HTTP ${invResp.status}`}`);
        continue;
      }

      const checkoutId = invJson.data?.id || invJson.data?.billId || '';

      // Grava idempotência + pending_checkout
      const batch = db.batch();
      batch.set(db.collection('pending_invoices').doc(invoiceDocId), {
        userId, userEmail, planId, amount: amount / 100, checkoutId,
        invoiceUrl: invUrl, yearMonth, createdAt: now,
      });
      if (checkoutId) {
        batch.set(db.collection('pending_checkouts').doc(String(checkoutId)), {
          ...metadata, checkoutId: String(checkoutId),
          amount: amount / 100, createdAt: now, billingMode: 'invoice',
        });
      }
      await batch.commit();

      invoicesCreated++;
      console.log(`[CRON billing] Fatura criada para ${userEmail} (${yearMonth}): ${invUrl}`);

    } catch (e: any) {
      errors.push(`${userId}: ${e.message}`);
    }
  }

  return res.status(200).json({
    ok: true,
    invoicesCreated,
    invoicesSkipped,
    errors: errors.length ? errors : undefined,
  });
}
