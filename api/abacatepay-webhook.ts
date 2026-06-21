import { getDb } from './_firebase';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

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

async function activateAddonInDb(db: any, userId: string, email: string, addon: string, transactionId: string, paymentMethod: string) {
  const now = Date.now();
  const userRef = db.collection('users').doc(userId);
  const subRef = db.collection('subscriptions').doc(`sub_${userId}`);

  const subSnap = await subRef.get();
  const userSnap = await userRef.get();
  
  let currentTokenLite = 0;
  let currentTokenPro = 0;
  let currentReportsQuota = 100;
  let currentClinicsQuota = 5;
  let currentAddons: string[] = [];

  if (subSnap.exists) {
    const subData = subSnap.data();
    currentTokenLite = subData?.tokenQuotaLite || 0;
    currentTokenPro = subData?.tokenQuotaPro || 0;
    currentReportsQuota = subData?.reportsQuota || 100;
    currentClinicsQuota = subData?.clinicsQuota || 5;
    currentAddons = subData?.addons || [];
  } else if (userSnap.exists) {
    const userData = userSnap.data();
    currentTokenLite = userData?.tokenQuotaLite || 0;
    currentTokenPro = userData?.tokenQuotaPro || 0;
    currentReportsQuota = userData?.reportsQuota || 100;
    currentClinicsQuota = userData?.clinicsQuota || 5;
  }

  // Fetch addon metadata to resolve bundle size and price
  const dbKey = mapAddonKey(addon);
  let bundleSize = 1;
  let addonPrice = 0;
  
  const addonsConfigSnap = await db.collection('global_config').doc('addons_config').get();
  if (addonsConfigSnap.exists) {
    const addonMeta = addonsConfigSnap.data()?.[dbKey];
    if (addonMeta) {
      if (typeof addonMeta.price === 'number') {
        addonPrice = addonMeta.price;
      }
      if (typeof addonMeta.bundleSize === 'number') {
        bundleSize = addonMeta.bundleSize;
      } else {
        if (addon === 'token_lite') bundleSize = 50;
        else if (addon === 'token_pro') bundleSize = 20;
      }
    }
  } else {
    // Default fallbacks if no config exists
    if (addon === 'calculators') addonPrice = 49;
    else if (addon === 'token_lite') { addonPrice = 9.90; bundleSize = 50; }
    else if (addon === 'token_pro') { addonPrice = 24.90; bundleSize = 20; }
    else if (addon === 'extra_reports') addonPrice = 1.50;
    else if (addon === 'extra_clinic') addonPrice = 29;
  }

  // Apply additions based on addon type
  if (addon === 'calculators' || addon === 'pacs') {
    if (!currentAddons.includes(addon)) {
      currentAddons.push(addon);
    }
    await subRef.set({ addons: currentAddons, updatedAt: now }, { merge: true });
  } else if (addon === 'token_lite') {
    const newQuota = currentTokenLite + bundleSize;
    await subRef.set({ tokenQuotaLite: newQuota, updatedAt: now }, { merge: true });
    await userRef.set({ tokenQuotaLite: newQuota, updatedAt: now }, { merge: true });
  } else if (addon === 'token_pro') {
    const newQuota = currentTokenPro + bundleSize;
    await subRef.set({ tokenQuotaPro: newQuota, updatedAt: now }, { merge: true });
    await userRef.set({ tokenQuotaPro: newQuota, updatedAt: now }, { merge: true });
  } else if (addon === 'extra_reports') {
    const newQuota = currentReportsQuota + bundleSize;
    await subRef.set({ reportsQuota: newQuota, updatedAt: now }, { merge: true });
    await userRef.set({ reportsQuota: newQuota, updatedAt: now }, { merge: true });
  } else if (addon === 'extra_clinic') {
    const newQuota = currentClinicsQuota + bundleSize;
    await subRef.set({ clinicsQuota: newQuota, updatedAt: now }, { merge: true });
    await userRef.set({ clinicsQuota: newQuota, updatedAt: now }, { merge: true });
  }

  // Log transaction
  const addonNames: Record<string, string> = {
    calculators: 'Add-on Calculadoras Clínicas',
    pacs: 'Add-on PACS / DICOM Sync',
    token_lite: 'Pacote Laudos Lite',
    token_pro: 'Pacote Laudos Pro',
    extra_reports: 'Laudos Extras',
    extra_clinic: 'Clínica Extra',
  };

  await db.collection('transactions').add({
    id: transactionId,
    userId,
    userEmail: email,
    type: 'addon',
    description: addonNames[addon] || `Add-on ${addon}`,
    amount: addonPrice,
    status: 'paid',
    paymentMethod,
    timestamp: now,
  });
}


export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = getDb();
  // Prioridade: VITE_PUBLIC_URL (ngrok) > Referer > Host > fallback
  const publicBase = process.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
  const refererBase = req.headers.referer ? new URL(req.headers.referer as string).origin : null;
  const hostBase = req.headers.host ? `https://${req.headers.host}` : null;
  const origin = publicBase || refererBase || hostBase || 'http://localhost:5173';

  // --- MOCK FLOW (GET method) ---
  if (req.method === 'GET' && req.query.mock === 'true') {
    const { userId, type, addon, planId } = req.query;

    if (!userId) {
      return res.status(400).send('userId is required for mock checkout.');
    }

    try {
      const now = Date.now();
      const userRef = db.collection('users').doc(userId as string);
      const subRef = db.collection('subscriptions').doc(`sub_${userId}`);

      if (type === 'addon' && addon) {
        const userSnap = await userRef.get();
        const userEmail = userSnap.exists ? userSnap.data()?.email : 'medico@laud.us';
        await activateAddonInDb(db, userId as string, userEmail, addon as string, `tx_mock_${Date.now()}`, 'pix');
        console.log(`[MOCK WEBHOOK] Addon ${addon} ativado com sucesso para usuário ${userId}`);
      } else {
        // Mock Subscription activation
        let planName = 'base';
        let planPrice = 149;
        let reportsQuota = 100;
        let clinicsQuota = 5;
        let tokenQuotaLite = 0;
        let tokenQuotaPro = 0;
        let motorProDefault = false;
        const addons: string[] = [];

        if (planId) {
          const planSnap = await db.collection('saas_plans').doc(planId as string).get();
          if (planSnap.exists) {
            const planData = planSnap.data();
            if (planData) {
              planName = planData.name || 'base';
              planPrice = planData.price || 149;
              reportsQuota = planData.reportsQuota ?? 100;
              clinicsQuota = planData.clinicsQuota ?? 5;
              tokenQuotaLite = planData.tokenQuotaLite ?? 0;
              tokenQuotaPro = planData.tokenQuotaPro ?? 0;
              motorProDefault = planData.motorProDefault || false;

              if (planData.includesCalculators) addons.push('calculators');
              if (planData.includesPacs) addons.push('pacs');
            }
          }
        }

        const subscriptionPayload = {
          id: `sub_${userId}`,
          userId,
          userEmail: 'medico@laud.us',
          plan: planName,
          planId: planId || '',
          addons,
          status: 'active',
          paymentMethod: 'pix',
          currentPeriodStart: now,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          reportsUsedThisMonth: 0,
          reportsQuota,
          clinicsQuota,
          tokenQuotaLite,
          tokenQuotaPro,
          lastResetAt: now,
          createdAt: now,
          updatedAt: now,
        };

        await subRef.set(subscriptionPayload, { merge: true });

        await userRef.set({
          subscriptionId: `sub_${userId}`,
          subscriptionStatus: 'active',
          reportsUsedThisMonth: 0,
          reportsQuota,
          clinicsQuota,
          tokenQuotaLite,
          tokenQuotaPro,
          motorProEnabled: motorProDefault,
          updatedAt: now,
        }, { merge: true });

        // Log transaction
        await db.collection('transactions').add({
          id: `tx_mock_${Date.now()}`,
          userId,
          userEmail: 'medico@laud.us',
          type: 'subscription',
          description: `Plano ${planName}`,
          amount: planPrice,
          status: 'paid',
          paymentMethod: 'pix',
          timestamp: now,
        });

        console.log(`[MOCK WEBHOOK] Assinatura ativada com sucesso para usuário ${userId}`);
      }

      // Redirect back to settings
      res.writeHead(302, { Location: `${origin}/#settings?tab=assinatura` });
      return res.end();
    } catch (err: any) {
      console.error('[MOCK WEBHOOK] Erro:', err);
      return res.status(500).send(`Erro no mock webhook: ${err.message}`);
    }
  }

  // --- REAL FLOW (POST method) ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-webhook-signature'];
    
    let webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    try {
      const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
      if (configSnap.exists && configSnap.data()?.webhookSecret) {
        webhookSecret = configSnap.data().webhookSecret.trim();
      }
    } catch (dbErr) {
      console.warn('[WEBHOOK] Falha ao carregar webhookSecret do Firestore, usando env:', dbErr);
    }

    // Signature verification
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const digest = hmac.digest('hex');
      if (digest !== signature) {
        console.warn('[WEBHOOK] Assinatura inválida recebida.');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = JSON.parse(rawBody);
    let eventType = (payload.event || payload.type || '').trim();
    const { data } = payload || {};

    if (!eventType || !data) {
      return res.status(400).json({ error: 'Payload malformado.' });
    }

    const metadata = data.metadata || {};
    const { userId, email, type, addon, planId } = metadata;

    if (!userId) {
      console.warn('[WEBHOOK] Recebido webhook sem userId no metadata:', payload);
      return res.status(200).json({ status: 'ignored', reason: 'No userId in metadata' });
    }

    // Mapeamento do checkout.completed para ativações correspondentes de assinatura ou addon
    if (eventType === 'checkout.completed') {
      if (type === 'subscription') {
        eventType = 'subscription.activated';
      } else if (type === 'addon') {
        eventType = 'addon.activated';
      }
    }

    const now = Date.now();
    const userRef = db.collection('users').doc(userId);
    const subRef = db.collection('subscriptions').doc(`sub_${userId}`);

    console.log(`[WEBHOOK] Processando evento: ${eventType} para usuário ${userId} (${email})`);

    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.renewed': {
        const periodStart = data.currentPeriodStart ? new Date(data.currentPeriodStart).getTime() : now;
        const periodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).getTime() : now + 30 * 24 * 60 * 60 * 1000;

        // Quotas dinâmicas com base no saas_plans
        let planName = 'base';
        let planPrice = 149;
        let reportsQuota = 100;
        let clinicsQuota = 5;
        let tokenQuotaLite = 0;
        let tokenQuotaPro = 0;
        let motorProDefault = false;
        const addons: string[] = [];

        if (planId) {
          const planSnap = await db.collection('saas_plans').doc(planId).get();
          if (planSnap.exists) {
            const planData = planSnap.data();
            if (planData) {
              planName = planData.name || 'base';
              planPrice = planData.price || 149;
              reportsQuota = planData.reportsQuota ?? 100;
              clinicsQuota = planData.clinicsQuota ?? 5;
              tokenQuotaLite = planData.tokenQuotaLite ?? 0;
              tokenQuotaPro = planData.tokenQuotaPro ?? 0;
              motorProDefault = planData.motorProDefault || false;

              if (planData.includesCalculators) addons.push('calculators');
              if (planData.includesPacs) addons.push('pacs');
            }
          }
        }

        const subData: Record<string, any> = {
          id: `sub_${userId}`,
          userId,
          userEmail: email || 'medico@laud.us',
          plan: planName,
          planId: planId || '',
          status: 'active',
          paymentMethod: data.paymentMethod || 'pix',
          abacatePaySubscriptionId: data.id || '',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          reportsQuota,
          clinicsQuota,
          tokenQuotaLite,
          tokenQuotaPro,
          updatedAt: now,
        };

        if (eventType === 'subscription.activated') {
          subData.addons = addons;
          subData.reportsUsedThisMonth = 0;
          subData.lastResetAt = now;
          subData.createdAt = now;
        } else {
          // Em caso de renovação, resetamos o contador de laudos usados do mês
          subData.reportsUsedThisMonth = 0;
          subData.lastResetAt = now;
        }

        await subRef.set(subData, { merge: true });

        await userRef.set({
          subscriptionId: `sub_${userId}`,
          subscriptionStatus: 'active',
          reportsUsedThisMonth: 0,
          reportsQuota,
          clinicsQuota,
          tokenQuotaLite,
          tokenQuotaPro,
          motorProEnabled: motorProDefault,
          updatedAt: now,
        }, { merge: true });

        // Log de transação
        const priceBrl = data.products?.[0]?.value 
          ? data.products[0].value / 100 
          : (data.items?.[0]?.price ? data.items[0].price / 100 : planPrice);
        await db.collection('transactions').add({
          id: data.id || `tx_${Date.now()}`,
          userId,
          userEmail: email || 'medico@laud.us',
          type: 'subscription',
          description: `Plano ${planName}`,
          amount: priceBrl,
          status: 'paid',
          paymentMethod: data.paymentMethod || 'pix',
          timestamp: now,
        });

        break;
      }

      case 'subscription.payment_failed': {
        await subRef.set({
          status: 'past_due',
          updatedAt: now,
        }, { merge: true });

        await userRef.set({
          subscriptionStatus: 'past_due',
          updatedAt: now,
        }, { merge: true });

        // Log transaction failed
        await db.collection('transactions').add({
          id: data.id || `tx_fail_${Date.now()}`,
          userId,
          userEmail: email || 'medico@laud.us',
          type: 'subscription',
          description: `Falha no pagamento da Assinatura`,
          amount: 0,
          status: 'failed',
          paymentMethod: data.paymentMethod || 'pix',
          timestamp: now,
        });

        break;
      }

      case 'subscription.canceled': {
        await subRef.set({
          status: 'canceled',
          canceledAt: now,
          updatedAt: now,
        }, { merge: true });

        await userRef.set({
          subscriptionStatus: 'canceled',
          updatedAt: now,
        }, { merge: true });
        break;
      }

      case 'addon.activated': {
        if (addon) {
          await activateAddonInDb(db, userId, email || 'medico@laud.us', addon, data.id || `tx_addon_${Date.now()}`, data.paymentMethod || 'pix');
        }
        break;
      }

      default:
        console.log(`[WEBHOOK] Evento não tratado: ${eventType}`);
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
