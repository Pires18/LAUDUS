import { getDb } from './_firebase.js';
import { verifyAuth, isProduction } from './_auth.js';
import { mapAddonKey, ADDON_NAMES, resolveAddon, intervalMultiplier, planPriceBrl, addonPriceBrl } from './_pricing.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, email, type, addon, planId, interval: reqInterval } = req.body || {};
    if (!userId || !email) {
      return res.status(400).json({ error: 'userId e email são obrigatórios.' });
    }

    // ── Autenticação: o checkout só pode ser iniciado pelo próprio usuário ──
    const authed = await verifyAuth(req);
    if (!authed) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (authed.uid !== userId) {
      return res.status(403).json({ error: 'Você só pode iniciar um checkout para a própria conta.' });
    }

    const db = await getDb();

    // Resolve API key: Firestore > env
    let apiKey = (process.env.ABACATEPAY_API_KEY || '').trim();
    try {
      const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
      if (configSnap.exists && configSnap.data()?.apiKey) {
        apiKey = configSnap.data()!.apiKey.trim();
      }
    } catch (dbErr) {
      console.warn('[ABACATEPAY] Falha ao carregar apiKey do Firestore, usando env:', dbErr);
    }

    // Sem API key configurada
    if (!apiKey) {
      // Em produção NUNCA caímos no mock — seria liberação grátis silenciosa.
      if (isProduction()) {
        console.error('[ABACATEPAY] API key ausente em produção — checkout bloqueado.');
        return res.status(503).json({ error: 'Gateway de pagamento não configurado. Contate o suporte.' });
      }
      // Em dev/preview: fluxo mock para testes locais.
      // Prioridade: origin do browser (correto para redirect do usuário), depois VITE_PUBLIC_URL.
      const publicBase = (req.headers.origin as string | undefined)
        || (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
        || 'http://localhost:5173';
      console.log(`[ABACATEPAY] Mock (dev) para ${email} via ${publicBase}`);
      const mockUrl = `${publicBase}/api/abacatepay-webhook?mock=true&userId=${userId}&type=${type || 'subscription'}&addon=${addon || ''}&planId=${planId || ''}`;
      return res.status(200).json({ url: mockUrl, mock: true });
    }

    // ── Fluxo real AbacatePay v2 ──
    let productName = 'LAUD.US Plano Base';
    let amount = 14900;
    let selectedPlanId = planId || '';
    let planInterval = 'month';
    let abacatePayProductId = '';

    // Pacotes consumíveis (compra única) — NÃO viram assinatura.
    const ONE_TIME_ADDONS = new Set(['token_lite', 'token_pro', 'extra_reports']);
    const addonIsOneTime = type === 'addon' && ONE_TIME_ADDONS.has(addon);

    if (type === 'addon' && addon) {
      const dbKey = mapAddonKey(addon);
      const addonsSnap = await db.collection('global_config').doc('addons_config').get();
      const addonMeta = addonsSnap.exists ? addonsSnap.data()?.[dbKey] : null;
      const { priceCents } = resolveAddon(addon, addonMeta);
      if (addonIsOneTime) {
        // Consumível: preço fixo, sem intervalo.
        productName = ADDON_NAMES[addon] || `Add-on ${addon}`;
        amount = priceCents;
      } else {
        // Add-on de módulo: assinatura recorrente nos 3 intervalos. Se o admin
        // configurou preços explícitos por intervalo (addonMeta.prices), usa-os;
        // senão projeta do preço mensal (mês ×1, semestre ×6, ano ×12).
        planInterval = ['month', 'semester', 'year'].includes(reqInterval) ? reqInterval : 'month';
        const intLabel = planInterval === 'year' ? 'Anual' : planInterval === 'semester' ? 'Semestral' : 'Mensal';
        productName = `${ADDON_NAMES[addon] || `Add-on ${addon}`} (${intLabel})`;
        amount = addonMeta?.prices
          ? Math.round(addonPriceBrl(addonMeta, planInterval) * 100)
          : priceCents * intervalMultiplier(planInterval);
      }
      if (addonMeta?.abacatePayProductId) abacatePayProductId = addonMeta.abacatePayProductId;
    } else {
      // Intervalo escolhido pelo usuário (mensal/semestral/anual) — o plano tem
      // os 3 preços embutidos, então selecionamos o certo por `prices[interval]`.
      planInterval = ['month', 'semester', 'year'].includes(reqInterval) ? reqInterval : 'month';
      const intLabel = planInterval === 'year' ? 'Anual' : planInterval === 'semester' ? 'Semestral' : 'Mensal';
      if (selectedPlanId) {
        const planSnap = await db.collection('saas_plans').doc(selectedPlanId).get();
        if (planSnap.exists) {
          const planData = planSnap.data();
          if (planData) {
            productName = `Plano ${planData.name} (${intLabel})`;
            amount = Math.round(planPriceBrl(planData, planInterval) * 100) || 14900;
            if (planData.abacatePayProductId) abacatePayProductId = planData.abacatePayProductId;
          }
        }
      } else {
        const plansQuery = await db.collection('saas_plans').where('active', '==', true).get();
        const basePlan = plansQuery.docs.find((d: any) => d.data().name?.toLowerCase().includes('base'));
        if (basePlan) {
          selectedPlanId = basePlan.id;
          productName = `Plano ${basePlan.data().name} (${intLabel})`;
          amount = Math.round(planPriceBrl(basePlan.data(), planInterval) * 100) || 14900;
          if (basePlan.data().abacatePayProductId) abacatePayProductId = basePlan.data().abacatePayProductId;
        }
      }
    }

    // returnUrl é onde o BROWSER do usuário vai após o pagamento.
    // req.headers.origin é o origin correto (localhost:5173 em dev, domínio real em prod).
    // VITE_PUBLIC_URL fica como fallback — é a URL do servidor/webhook, não do browser.
    const returnBase = (req.headers.origin as string | undefined)
      || (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
      || 'http://localhost:5173';

    // externalId DETERMINÍSTICO por (plano|add-on) × intervalo × preço. Inclui o
    // preço para que uma mudança de valor gere um novo produto automaticamente.
    const externalId = (abacatePayProductId
      || `laudus-${type === 'addon' ? addon : (selectedPlanId || 'plano-base')}-${planInterval}-${amount}`
    ).toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Ciclo de assinatura (produtos recorrentes). Consumível = avulso (sem cycle).
    const cycle = addonIsOneTime ? null
      : planInterval === 'year' ? 'ANNUALLY'
      : planInterval === 'semester' ? 'SEMIANNUALLY'
      : 'MONTHLY';

    const apiBase = 'https://api.abacatepay.com/v2';
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

    // ── Garante o produto na loja da AbacatePay (auto-cadastro) ──
    // O checkout v2 referencia produtos EXISTENTES por id. Busca pelo externalId
    // (products/get); se não existir, cria. Se a criação colidir ("already
    // exists"), busca de novo. Assim o admin não cadastra nada manualmente.
    const getProductId = async (): Promise<string> => {
      try {
        const r = await fetch(`${apiBase}/products/get?externalId=${encodeURIComponent(externalId)}`, { headers: authHeaders });
        const j = await r.json();
        return j?.data?.id || '';
      } catch { return ''; }
    };

    let productId = await getProductId();
    if (!productId) {
      const createRes = await fetch(`${apiBase}/products/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ externalId, name: productName, price: amount, currency: 'BRL', ...(cycle ? { cycle } : {}) }),
      });
      const createJson = await createRes.json();
      productId = createJson?.data?.id || '';
      // Produto já existia (corrida ou busca que não retornou) → tenta obter.
      if (!productId) productId = await getProductId();
      if (!productId) {
        const perr = createJson?.error && (createJson.error.message || createJson.error);
        console.error('[ABACATEPAY] Erro ao criar/obter produto:', JSON.stringify(createJson));
        return res.status(500).json({ error: perr || 'Falha ao registrar o produto na AbacatePay.' });
      }
    }

    const metadata = {
      userId,
      email,
      type: type || 'subscription',
      addon: addon || '',
      planId: selectedPlanId,
      interval: planInterval,
    };

    // Checkout v2: referencia o produto pelo id público; total vem do produto.
    const payload = {
      items: [{ id: productId, quantity: 1 }],
      methods: ['PIX', 'CARD'],
      returnUrl: `${returnBase}/#settings?tab=assinatura`,
      completionUrl: `${returnBase}/#settings?tab=assinatura`,
      externalId,
      metadata,
    };

    const response = await fetch(`${apiBase}/checkouts/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    // { data: Billing, error, success }. Sucesso = success true e url presente.
    const billingUrl = result?.data?.url;
    const billingErr = result?.error && (result.error.message || result.error);
    if (!response.ok || billingErr || !billingUrl) {
      console.error('[ABACATEPAY] Erro checkout:', JSON.stringify(result));
      return res.status(500).json({ error: billingErr || 'Erro ao criar checkout.' });
    }

    // Fallback de metadata: persistimos a intenção por checkoutId para que o
    // webhook consiga resolver o usuário mesmo se o AbacatePay não ecoar o metadata.
    const checkoutId = result.data?.id || result.data?.billId || result.id;
    if (checkoutId) {
      try {
        await db.collection('pending_checkouts').doc(String(checkoutId)).set({
          ...metadata,
          checkoutId: String(checkoutId),
          amount,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('[ABACATEPAY] Falha ao gravar pending_checkout:', err);
      }
    }

    return res.status(200).json({ url: billingUrl, mock: false });

  } catch (error: any) {
    console.error('[ABACATEPAY] Erro interno:', error);
    return res.status(500).json({ error: error.message });
  }
}
