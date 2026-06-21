import { getDb } from './_firebase';

function mapAddonKey(addon: string): string {
  const mapping: Record<string, string> = {
    calculators: 'calculators',
    pacs: 'pacs',
    token_lite: 'tokenLite',
    token_pro: 'tokenPro',
    extra_reports: 'extraReport',
    extra_clinic: 'extraClinic',
  };
  return mapping[addon] || addon;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-uid');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, email, type, addon, planId } = req.body || {};
    if (!userId || !email) {
      return res.status(400).json({ error: 'userId e email são obrigatórios.' });
    }

    const db = getDb();

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

    // Sem API key → fluxo mock
    if (!apiKey) {
      const publicBase = (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
        || (req.headers.origin as string | undefined)
        || 'http://localhost:5173';
      console.log(`[ABACATEPAY] Mock para ${email} via ${publicBase}`);
      const mockUrl = `${publicBase}/api/abacatepay-webhook?mock=true&userId=${userId}&type=${type || 'subscription'}&addon=${addon || ''}&planId=${planId || ''}`;
      return res.status(200).json({ url: mockUrl, mock: true });
    }

    // Fluxo real AbacatePay v2
    let productName = 'LAUD.US Plano Base';
    let amount = 14900;
    let selectedPlanId = planId || '';
    let abacatePayProductId = '';

    if (type === 'addon' && addon) {
      const dbKey = mapAddonKey(addon);
      const addonsSnap = await db.collection('global_config').doc('addons_config').get();
      const addonMeta = addonsSnap.exists ? addonsSnap.data()?.[dbKey] : null;
      const addonNames: Record<string, string> = {
        calculators: 'Add-on Calculadoras Clínicas',
        pacs: 'Add-on PACS / DICOM Sync',
        token_lite: 'Pacote Laudos Lite',
        token_pro: 'Pacote Laudos Pro',
        extra_reports: 'Laudos Extras',
        extra_clinic: 'Clínica Extra',
      };
      productName = addonNames[addon] || `Add-on ${addon}`;
      if (addonMeta) {
        if (typeof addonMeta.price === 'number') amount = Math.round(addonMeta.price * 100);
        if (addonMeta.abacatePayProductId) abacatePayProductId = addonMeta.abacatePayProductId;
      } else {
        if (addon === 'calculators') amount = 4900;
        else if (addon === 'token_lite') amount = 990;
        else if (addon === 'token_pro') amount = 2490;
        else if (addon === 'extra_reports') amount = 150;
        else if (addon === 'extra_clinic') amount = 2900;
      }
    } else {
      if (selectedPlanId) {
        const planSnap = await db.collection('saas_plans').doc(selectedPlanId).get();
        if (planSnap.exists) {
          const planData = planSnap.data();
          if (planData) {
            productName = `Plano ${planData.name}`;
            amount = Math.round((planData.price || 149) * 100);
            if (planData.abacatePayProductId) abacatePayProductId = planData.abacatePayProductId;
          }
        }
      } else {
        const plansQuery = await db.collection('saas_plans').where('active', '==', true).get();
        const basePlan = plansQuery.docs.find(d => d.data().name?.toLowerCase().includes('base'));
        if (basePlan) {
          selectedPlanId = basePlan.id;
          productName = `Plano ${basePlan.data().name}`;
          amount = Math.round((basePlan.data().price || 149) * 100);
          if (basePlan.data().abacatePayProductId) abacatePayProductId = basePlan.data().abacatePayProductId;
        }
      }
    }

    const returnBase = (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
      || (req.headers.origin as string | undefined)
      || 'http://localhost:5173';

    const itemId = abacatePayProductId || `${type === 'addon' ? addon : (selectedPlanId || 'plano-base')}-${Date.now()}`;
    const payload = {
      frequency: type === 'addon' ? 'ONE_TIME' : 'SUBSCRIPTION',
      methods: ['PIX', 'CARD'],
      items: [{
        id: itemId,
        name: productName,
        quantity: 1,
        price: amount,
        ...(abacatePayProductId ? { externalId: abacatePayProductId } : {}),
      }],
      returnUrl: `${returnBase}/#settings?tab=assinatura`,
      completionUrl: `${returnBase}/#settings?tab=assinatura`,
      metadata: { userId, email, type: type || 'subscription', addon: addon || '', planId: selectedPlanId },
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

    return res.status(200).json({ url: result.data.url, mock: false });

  } catch (error: any) {
    console.error('[ABACATEPAY] Erro interno:', error);
    return res.status(500).json({ error: error.message });
  }
}
