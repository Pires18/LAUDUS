import { getDb } from './_firebase';
import { isProduction } from './_auth';
import { mapAddonKey, ADDON_NAMES, resolveAddon, periodEndFrom } from './_pricing';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any): Promise<string> {
  // In Vite dev mode the proxy pre-reads the body and stores it here.
  if (typeof req._rawBody === 'string') return req._rawBody;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', (err: any) => reject(err));
  });
}

/**
 * Verifica a autenticidade do webhook. O AbacatePay suporta dois esquemas:
 *  1. Segredo na query string: ?webhookSecret=XYZ  (comparação direta)
 *  2. Assinatura HMAC-SHA256 no header X-Webhook-Signature (base64 ou hex)
 * Retorna true se qualquer um validar; em produção exige que o secret esteja configurado.
 */
function verifyWebhook(req: any, rawBody: string, secret: string): { ok: boolean; reason?: string } {
  if (!secret) {
    if (isProduction()) {
      return { ok: false, reason: 'Webhook secret não configurado em produção.' };
    }
    console.warn('[WEBHOOK] Secret ausente (dev) — aceitando sem verificação.');
    return { ok: true };
  }

  // Esquema 1: secret na query string.
  const querySecret = req.query?.webhookSecret || req.query?.secret;
  if (querySecret && String(querySecret) === secret) {
    return { ok: true };
  }

  // Esquema 2: assinatura HMAC no header.
  const signature = req.headers['x-webhook-signature'] || req.headers['X-Webhook-Signature'];
  if (signature) {
    const digestHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const digestB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const sig = String(signature);
    if (sig === digestHex || sig === digestB64) {
      return { ok: true };
    }
    return { ok: false, reason: 'Assinatura inválida.' };
  }

  return { ok: false, reason: 'Assinatura/segredo ausente.' };
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

  // Resolve preço e bundleSize a partir do catálogo único + Firestore.
  const dbKey = mapAddonKey(addon);
  const addonsConfigSnap = await db.collection('global_config').doc('addons_config').get();
  const addonMeta = addonsConfigSnap.exists ? addonsConfigSnap.data()?.[dbKey] : null;
  let { priceBrl: addonPrice, bundleSize } = resolveAddon(addon, addonMeta);
  
  if (!addonMeta) {
    // Default fallbacks if no config exists
    if (addon === 'calculators') addonPrice = 49;
    else if (addon === 'appointments') addonPrice = 39;
    else if (addon === 'clinics') addonPrice = 49;
    else if (addon === 'token_lite') { addonPrice = 9.90; bundleSize = 50; }
    else if (addon === 'token_pro') { addonPrice = 24.90; bundleSize = 20; }
    else if (addon === 'extra_reports') addonPrice = 1.50;
    else if (addon === 'extra_clinic') addonPrice = 29;
  }

  // Aplica as adições conforme o tipo de add-on.
  if (addon === 'calculators' || addon === 'pacs' || addon === 'appointments' || addon === 'clinics') {
    if (!currentAddons.includes(addon)) currentAddons.push(addon);
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
    // Laudo extra: amplia a quota de laudos E credita 1 token Lite (conforme a oferta).
    const newReports = currentReportsQuota + bundleSize;
    const newTokenLite = currentTokenLite + bundleSize;
    await subRef.set({ reportsQuota: newReports, tokenQuotaLite: newTokenLite, updatedAt: now }, { merge: true });
    await userRef.set({ reportsQuota: newReports, tokenQuotaLite: newTokenLite, updatedAt: now }, { merge: true });
  } else if (addon === 'extra_clinic') {
    const newQuota = currentClinicsQuota + bundleSize;
    await subRef.set({ clinicsQuota: newQuota, updatedAt: now }, { merge: true });
    await userRef.set({ clinicsQuota: newQuota, updatedAt: now }, { merge: true });
  }

  await db.collection('transactions').add({
    id: transactionId,
    userId,
    userEmail: email,
    type: 'addon',
    description: ADDON_NAMES[addon] || `Add-on ${addon}`,
    amount: addonPrice,
    status: 'paid',
    paymentMethod,
    timestamp: now,
  });
}

/** Ativa/renova uma assinatura a partir dos dados do plano (saas_plans). */
async function activateSubscription(
  db: any,
  userId: string,
  email: string,
  planId: string,
  opts: { isRenewal: boolean; periodStart: number; interval?: string; paymentMethod: string; gatewaySubId?: string; gatewayPrice?: number },
) {
  const now = Date.now();
  const userRef = db.collection('users').doc(userId);
  const subRef = db.collection('subscriptions').doc(`sub_${userId}`);

  let planName = 'base';
  let planPrice = 149;
  let reportsQuota = 100;
  let clinicsQuota = 5;
  let tokenQuotaLite = 0;
  let tokenQuotaPro = 0;
  let motorProDefault = false;
  let interval = opts.interval || 'month';
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
        interval = planData.interval || interval;
        if (planData.includesCalculators) addons.push('calculators');
        if (planData.includesPacs) addons.push('pacs');
        if (planData.includesAppointments) addons.push('appointments');
        if (planData.includesClinics) addons.push('clinics');
      }
    }
  }

  const periodEnd = periodEndFrom(opts.periodStart, interval);

  const subData: Record<string, any> = {
    id: `sub_${userId}`,
    userId,
    userEmail: email,
    plan: planName,
    planId: planId || '',
    status: 'active',
    paymentMethod: opts.paymentMethod,
    abacatePaySubscriptionId: opts.gatewaySubId || '',
    currentPeriodStart: opts.periodStart,
    currentPeriodEnd: periodEnd,
    reportsQuota,
    clinicsQuota,
    tokenQuotaLite,
    tokenQuotaPro,
    reportsUsedThisMonth: 0,
    lastResetAt: opts.periodStart,
    updatedAt: now,
  };
  if (!opts.isRenewal) {
    subData.addons = addons;
    subData.createdAt = now;
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

  await db.collection('transactions').add({
    id: opts.gatewaySubId || `tx_${Date.now()}`,
    userId,
    userEmail: email,
    type: 'subscription',
    description: `Plano ${planName}`,
    amount: opts.gatewayPrice ?? planPrice,
    status: 'paid',
    paymentMethod: opts.paymentMethod,
    timestamp: now,
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-signature');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = await getDb();
  const publicBase = process.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
  const refererBase = req.headers.referer ? new URL(req.headers.referer as string).origin : null;
  const hostBase = req.headers.host ? `https://${req.headers.host}` : null;
  const origin = publicBase || refererBase || hostBase || 'http://localhost:5173';

  // ── MOCK FLOW (GET, somente fora de produção) ──
  if (req.method === 'GET' && req.query.mock === 'true') {
    if (isProduction()) {
      return res.status(403).send('Mock desabilitado em produção.');
    }
    const { userId, type, addon, planId } = req.query;
    if (!userId) return res.status(400).send('userId is required for mock checkout.');

    try {
      const userRef = db.collection('users').doc(userId as string);
      const userSnap = await userRef.get();
      const userEmail = userSnap.exists ? (userSnap.data()?.email || 'medico@laud.us') : 'medico@laud.us';

      if (type === 'addon' && addon) {
        await activateAddonInDb(db, userId as string, userEmail, addon as string, `tx_mock_${Date.now()}`, 'pix');
        console.log(`[MOCK WEBHOOK] Addon ${addon} ativado para ${userId}`);
      } else {
        await activateSubscription(db, userId as string, userEmail, (planId as string) || '', {
          isRenewal: false, periodStart: Date.now(), paymentMethod: 'pix',
        });
        console.log(`[MOCK WEBHOOK] Assinatura ativada para ${userId}`);
      }
      res.writeHead(302, { Location: `${origin}/#settings?tab=assinatura` });
      return res.end();
    } catch (err: any) {
      console.error('[MOCK WEBHOOK] Erro:', err);
      return res.status(500).send(`Erro no mock webhook: ${err.message}`);
    }
  }

  // ── REAL FLOW (POST) ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const rawBody = await getRawBody(req);

    let webhookSecret = (process.env.ABACATEPAY_WEBHOOK_SECRET || '').trim();
    try {
      const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
      if (configSnap.exists && configSnap.data()?.webhookSecret) {
        webhookSecret = configSnap.data().webhookSecret.trim();
      }
    } catch (dbErr) {
      console.warn('[WEBHOOK] Falha ao carregar webhookSecret do Firestore:', dbErr);
    }

    const verification = verifyWebhook(req, rawBody, webhookSecret);
    if (!verification.ok) {
      console.warn('[WEBHOOK] Rejeitado:', verification.reason);
      return res.status(401).json({ error: verification.reason || 'Não autorizado.' });
    }

    const payload = JSON.parse(rawBody);
    let eventType = (payload.event || payload.type || '').trim();
    const data = payload.data || {};
    const eventId = payload.id || data.id || '';

    if (!eventType || !data) {
      return res.status(400).json({ error: 'Payload malformado.' });
    }

    // ── Idempotência: cada evento é processado uma única vez ──
    if (eventId) {
      const evtRef = db.collection('webhook_events').doc(String(eventId));
      try {
        await db.runTransaction(async (tx: any) => {
          const snap = await tx.get(evtRef);
          if (snap.exists) throw new Error('DUPLICATE');
          tx.set(evtRef, { event: eventType, receivedAt: Date.now(), payloadId: eventId });
        });
      } catch (e: any) {
        if (e.message === 'DUPLICATE') {
          console.log(`[WEBHOOK] Evento duplicado ignorado: ${eventId}`);
          return res.status(200).json({ status: 'duplicate' });
        }
        throw e;
      }
    }

    // ── Resolução de metadata (com fallback via pending_checkouts) ──
    let metadata = data.metadata || payload.metadata || {};
    const checkoutId = data.id || data.checkoutId || data.checkout?.id;
    if (!metadata.userId && checkoutId) {
      try {
        const pendingSnap = await db.collection('pending_checkouts').doc(String(checkoutId)).get();
        if (pendingSnap.exists) metadata = { ...pendingSnap.data(), ...metadata };
      } catch (err) {
        console.warn('[WEBHOOK] Falha ao buscar pending_checkout:', err);
      }
    }

    const { userId, email, type, addon, planId, interval } = metadata;
    if (!userId) {
      console.warn('[WEBHOOK] Sem userId resolvível para o evento:', eventType, checkoutId);
      return res.status(200).json({ status: 'ignored', reason: 'No userId' });
    }

    // Normaliza checkout.completed → evento concreto pelo tipo da intenção.
    if (eventType === 'checkout.completed' || eventType === 'transparent.completed') {
      eventType = type === 'addon' ? 'addon.activated' : 'subscription.completed';
    }

    const now = Date.now();
    const userEmail = email || 'medico@laud.us';
    const paymentMethod = data.paymentMethod || 'pix';
    console.log(`[WEBHOOK] Processando ${eventType} p/ ${userId} (${userEmail})`);

    switch (eventType) {
      case 'subscription.completed':
      case 'subscription.activated':
      case 'subscription.renewed': {
        const periodStart = data.currentPeriodStart ? new Date(data.currentPeriodStart).getTime() : now;
        const gatewayPrice = data.products?.[0]?.value
          ? data.products[0].value / 100
          : (data.items?.[0]?.price ? data.items[0].price / 100 : undefined);
        await activateSubscription(db, userId, userEmail, planId || '', {
          isRenewal: eventType === 'subscription.renewed',
          periodStart,
          interval,
          paymentMethod,
          gatewaySubId: data.id || '',
          gatewayPrice,
        });
        break;
      }

      case 'subscription.payment_failed': {
        await db.collection('subscriptions').doc(`sub_${userId}`).set({ status: 'past_due', updatedAt: now }, { merge: true });
        await db.collection('users').doc(userId).set({ subscriptionStatus: 'past_due', updatedAt: now }, { merge: true });
        await db.collection('transactions').add({
          id: data.id || `tx_fail_${Date.now()}`,
          userId, userEmail, type: 'subscription',
          description: 'Falha no pagamento da Assinatura',
          amount: 0, status: 'failed', paymentMethod, timestamp: now,
        });
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.canceled': {
        await db.collection('subscriptions').doc(`sub_${userId}`).set({ status: 'canceled', canceledAt: now, updatedAt: now }, { merge: true });
        await db.collection('users').doc(userId).set({ subscriptionStatus: 'canceled', updatedAt: now }, { merge: true });
        break;
      }

      case 'addon.activated': {
        if (addon) {
          await activateAddonInDb(db, userId, userEmail, addon, data.id || `tx_addon_${Date.now()}`, paymentMethod);
        }
        break;
      }

      case 'checkout.refunded':
      case 'transparent.refunded':
      case 'checkout.disputed': {
        await db.collection('transactions').add({
          id: data.id || `tx_refund_${Date.now()}`,
          userId, userEmail, type: type === 'addon' ? 'addon' : 'subscription',
          description: eventType.includes('disputed') ? 'Pagamento contestado' : 'Pagamento reembolsado',
          amount: 0, status: 'refunded', paymentMethod, timestamp: now,
        });
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
