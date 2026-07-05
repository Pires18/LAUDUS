import { getDb } from './_firebase.js';
import { verifyAuth, isProduction } from './_auth.js';
import { mapAddonKey, ADDON_NAMES, resolveAddon, intervalMultiplier } from './_pricing.js';

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
        // Add-on de módulo: assinatura recorrente nos 3 intervalos (mensal ×1).
        planInterval = ['month', 'semester', 'year'].includes(reqInterval) ? reqInterval : 'month';
        const intLabel = planInterval === 'year' ? 'Anual' : planInterval === 'semester' ? 'Semestral' : 'Mensal';
        productName = `${ADDON_NAMES[addon] || `Add-on ${addon}`} (${intLabel})`;
        amount = priceCents * intervalMultiplier(planInterval);
      }
      if (addonMeta?.abacatePayProductId) abacatePayProductId = addonMeta.abacatePayProductId;
    } else {
      if (selectedPlanId) {
        const planSnap = await db.collection('saas_plans').doc(selectedPlanId).get();
        if (planSnap.exists) {
          const planData = planSnap.data();
          if (planData) {
            productName = `Plano ${planData.name}`;
            amount = Math.round((planData.price || 149) * 100);
            planInterval = planData.interval || 'month';
            if (planData.abacatePayProductId) abacatePayProductId = planData.abacatePayProductId;
          }
        }
      } else {
        const plansQuery = await db.collection('saas_plans').where('active', '==', true).get();
        const basePlan = plansQuery.docs.find((d: any) => d.data().name?.toLowerCase().includes('base'));
        if (basePlan) {
          selectedPlanId = basePlan.id;
          productName = `Plano ${basePlan.data().name}`;
          amount = Math.round((basePlan.data().price || 149) * 100);
          planInterval = basePlan.data().interval || 'month';
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

    // ID de produto DETERMINÍSTICO por (plano|add-on) × intervalo. Se o admin
    // configurou um abacatePayProductId, respeita; senão gera um estável — assim
    // a AbacatePay reconhece cada assinatura recorrente sem cadastro manual.
    const autoProductId = (abacatePayProductId
      || `laudus-${type === 'addon' ? addon : (selectedPlanId || 'plano-base')}-${planInterval}`
    ).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const metadata = {
      userId,
      email,
      type: type || 'subscription',
      addon: addon || '',
      planId: selectedPlanId,
      interval: planInterval,
    };
    const payload = {
      // Planos e add-ons de módulo = assinatura recorrente; pacotes consumíveis
      // (tokens/laudos extras) = pagamento único.
      frequency: addonIsOneTime ? 'ONE_TIME' : 'SUBSCRIPTION',
      methods: ['PIX', 'CARD'],
      items: [{
        id: autoProductId,
        name: productName,
        quantity: 1,
        price: amount,
        externalId: autoProductId,
      }],
      returnUrl: `${returnBase}/#settings?tab=assinatura`,
      completionUrl: `${returnBase}/#settings?tab=assinatura`,
      metadata,
    };

    const response = await fetch('https://api.abacatepay.com/v2/checkouts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      console.error('[ABACATEPAY] Erro checkout:', result);
      return res.status(500).json({ error: result.error || 'Erro ao criar checkout.' });
    }

    // Fallback de metadata: persistimos a intenção por checkoutId para que o
    // webhook consiga resolver o usuário mesmo se o AbacatePay não ecoar o metadata.
    const checkoutId = result.data?.id || result.data?.checkoutId;
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

    return res.status(200).json({ url: result.data.url, mock: false });

  } catch (error: any) {
    console.error('[ABACATEPAY] Erro interno:', error);
    return res.status(500).json({ error: error.message });
  }
}
