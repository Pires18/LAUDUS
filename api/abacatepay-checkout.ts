import { getDb } from './_firebase.js';
import { verifyAuth, isProduction, isAdmin } from './_auth.js';
import { mapAddonKey, ADDON_NAMES, resolveAddon, intervalMultiplier, planPriceBrl, addonPriceBrl, getMaxInstallments, ADDON_DEFAULTS } from './_pricing.js';

/**
 * Testa uma API key da AbacatePay (admin only). Consolidado aqui (em vez de
 * api/abacatepay-test.ts próprio) para manter baixo o número de funções
 * serverless da Vercel — mesma auth/dependências do checkout.
 */
async function handleTestKey(req: any, res: any) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ ok: false, error: 'Não autenticado.' });
  const db = await getDb();
  if (!(await isAdmin(db, authed.uid))) {
    return res.status(403).json({ ok: false, error: 'Apenas administradores.' });
  }

  const apiKey = (req.body?.apiKey || '').trim();
  if (!apiKey) {
    return res.status(200).json({ ok: false, error: 'API Key não fornecida.' });
  }

  try {
    const response = await fetch('https://api.abacatepay.com/v2/checkouts/list', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    let body: any = null;
    try { body = await response.json(); } catch { /* ignore */ }
    if (body?.success === true) {
      return res.status(200).json({ ok: true, message: 'Conexão com AbacatePay v2 estabelecida com sucesso.' });
    }
    if (response.status === 401 || response.status === 403) {
      return res.status(200).json({ ok: false, error: 'Chave inválida ou inativa. Verifique no painel AbacatePay.' });
    }
    if (body?.error) {
      return res.status(200).json({ ok: false, error: `AbacatePay: ${body.error}` });
    }
    return res.status(200).json({ ok: false, error: `AbacatePay respondeu HTTP ${response.status}.` });
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: `Falha de rede: ${err.message}` });
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (req.body?.action === 'test-key') return handleTestKey(req, res);

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

    // Resolve API key e Sandbox Mode do Firestore
    let apiKey = (process.env.ABACATEPAY_API_KEY || '').trim();
    let sandboxMode = false;
    try {
      const configSnap = await db.collection('global_config').doc('abacatepay_config').get();
      if (configSnap.exists) {
        const d = configSnap.data();
        if (d?.apiKey) apiKey = d.apiKey.trim();
        if (d?.sandboxMode) sandboxMode = !!d.sandboxMode;
      }
    } catch (dbErr) {
      console.warn('[ABACATEPAY] Falha ao carregar configuração do Firestore:', dbErr);
    }

    // Define se o checkout será no mock/sandbox local
    const useMock = !apiKey || sandboxMode;

    if (useMock) {
      // Se não há API key E está em produção, bloqueia (evita brechas de bypass acidental)
      if (!apiKey && isProduction()) {
        console.error('[ABACATEPAY] API key ausente em produção — checkout bloqueado.');
        return res.status(503).json({ error: 'Gateway de pagamento não configurado. Contate o suporte.' });
      }
      // Em dev/preview: mock enriquecido para testar todos os fluxos de pagamento
      // (subscription mensal, checkout semestral 6x, checkout anual 12x, invoice fallback).
      // O mock URL aponta para a nova página de simulação de gateway de testes.
      const publicBase = (req.headers.origin as string | undefined)
        || (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
        || 'http://localhost:5173';

      const mockInterval   = (reqInterval || 'month');
      const mockIsSub      = !((req.body?.type === 'addon') && ['token_lite','token_pro','extra_reports'].includes(req.body?.addon)) && mockInterval === 'month';
      const mockInstalls   = mockInterval === 'year' ? 12 : mockInterval === 'semester' ? 6 : 1;
      const mockBillingMode= mockIsSub ? 'subscription' : 'one_time';

      // Calcula o preço simulado para o mock-gateway
      let mockAmountCents = 14900;
      if (type === 'addon' && addon) {
        const def = ADDON_DEFAULTS[addon] || { price: 0 };
        const basePrice = def.price;
        const mult = mockInterval === 'year' ? 12 : mockInterval === 'semester' ? 6 : 1;
        mockAmountCents = Math.round(basePrice * mult * 100);
      } else {
        let planPrice = 149;
        const selectedPlanId = planId || '';
        if (selectedPlanId) {
          try {
            const planSnap = await db.collection('saas_plans').doc(String(selectedPlanId)).get();
            if (planSnap.exists) {
              const planData = planSnap.data();
              if (planData) {
                planPrice = planPriceBrl(planData, mockInterval);
              }
            }
          } catch (planErr) {
            console.warn('[ABACATEPAY-MOCK] Erro ao buscar plano:', planErr);
          }
        } else {
          try {
            const plansQuery = await db.collection('saas_plans').where('active', '==', true).get();
            const basePlan = plansQuery.docs.find((d: any) => d.data().name?.toLowerCase().includes('base'));
            if (basePlan) {
              planPrice = planPriceBrl(basePlan.data(), mockInterval);
            }
          } catch {}
        }
        mockAmountCents = Math.round(planPrice * 100);
      }

      const mockCheckoutId = `mock_${Date.now()}`;
      const params = new URLSearchParams({
        userId:       userId,
        email:        email,
        type:         type || 'subscription',
        addon:        addon || '',
        planId:       planId || '',
        interval:     mockInterval,
        billingMode:  mockBillingMode,
        installments: String(mockInstalls),
        amount:       String(mockAmountCents),
        checkoutId:   mockCheckoutId,
      });

      // Grava pending_checkout de testes para que o webhook mock resolva corretamente
      try {
        const db2 = await getDb();
        await db2.collection('pending_checkouts').doc(mockCheckoutId).set({
          userId, email, type: type || 'subscription', addon: addon || '',
          planId: planId || '', interval: mockInterval, billingMode: mockBillingMode,
          checkoutId: mockCheckoutId, amount: mockAmountCents / 100, createdAt: Date.now(), isMock: true,
        });
      } catch { /* ignora — mock não bloqueia */ }

      const mockUrl = `${publicBase}/api/abacatepay-mock-gateway?${params.toString()}`;
      console.log(`[ABACATEPAY] 🧪 Mock Sandbox Gateway — ${email} | R$ ${(mockAmountCents / 100).toFixed(2)} | parcelas: ${mockInstalls}x`);
      return res.status(200).json({ url: mockUrl, mock: true, billingMode: mockBillingMode, installments: mockInstalls });
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

    // Mensal = subscription recorrente (PIX Automático + Cartão recorrente).
    // Semestral = checkout avulso, Cartão 6x | Anual = checkout avulso, Cartão 12x.
    // Add-ons ONE_TIME e add-ons de módulo não mensais nunca viram subscription.
    const isSubscription = !addonIsOneTime && planInterval === 'month';
    const maxInstallments = getMaxInstallments(planInterval);

    // returnUrl é onde o BROWSER do usuário vai após o pagamento.
    // req.headers.origin é o origin correto (localhost:5173 em dev, domínio real em prod).
    // VITE_PUBLIC_URL fica como fallback — é a URL do servidor/webhook, não do browser.
    const returnBase = (req.headers.origin as string | undefined)
      || (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '')
      || 'http://localhost:5173';

    // Produtos AVULSOS (pagamento único) — o `cycle` (assinatura recorrente)
    // exige "PIX Automático" habilitado na loja, o que nem toda conta tem. Assim
    // funciona com PIX/CARD comum em qualquer loja; a renovação é por período
    // (o webhook concede o acesso a cada pagamento; o reset mensal cuida do fim).
    // O sufixo "-ot" força um produto novo, distinto dos recorrentes antigos.
    // externalId determinístico por (plano|add-on) × intervalo × preço: mudar o
    // valor gera um produto novo automaticamente.
    // externalId diferenciado: subscription ('-sub') vs avulso ('-ot').
    // Garante que produtos de subscription e avulsos são distintos na AbacatePay
    // (o AbacatePay exige frequency diferente para cada tipo).
    const productSuffix = isSubscription ? 'sub' : 'ot';
    // Se NÃO for subscription recorrente (semestral/anual), forçamos o externalId dinâmico com sufixo -ot para ser ONE_TIME e liberar parcelamento.
    const externalId = ((isSubscription ? abacatePayProductId : null)
      || `laudus-${type === 'addon' ? addon : (selectedPlanId || 'plano-base')}-${planInterval}-${amount}-${productSuffix}`
    ).toLowerCase().replace(/[^a-z0-9-]/g, '-');

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
      // Produtos de subscription precisam de `frequency` para a AbacatePay criar
      // o item como recorrente. Avulsos não levam esse campo.
      const productCreateBody: Record<string, any> = {
        externalId, name: productName, price: amount, currency: 'BRL',
      };
      if (isSubscription) productCreateBody.frequency = 'MONTHLY';

      const createRes = await fetch(`${apiBase}/products/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(productCreateBody),
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

    if (isSubscription) {
      // ── Tentativa 1: Assinatura recorrente gerenciada pela AbacatePay ──
      // Suporta PIX Automático (se habilitado na conta) + Cartão recorrente.
      // O produto já foi criado com frequency: 'MONTHLY'; a subscription herda o ciclo.
      const subPayload = {
        items: [{ id: productId, quantity: 1 }],
        methods: ['PIX', 'CARD'],
        customer: { email },
        returnUrl: `${returnBase}/#settings?tab=assinatura`,
        metadata,
      };

      let usedInvoiceMode = false;
      let finalUrl = '';

      try {
        const subResponse = await fetch(`${apiBase}/subscriptions/create`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(subPayload),
        });

        const subResult = await subResponse.json();
        const subUrl = subResult?.data?.url;

        if (subResponse.ok && subUrl) {
          // ✅ Subscription criada — PIX Automático ou Cartão recorrente via AbacatePay.
          const subId = subResult.data?.id || '';
          if (subId) {
            try {
              await db.collection('pending_checkouts').doc(String(subId)).set({
                ...metadata, checkoutId: String(subId), amount, createdAt: Date.now(),
                billingMode: 'subscription',
              });
            } catch (err) {
              console.warn('[ABACATEPAY] Falha ao gravar pending_checkout (subscription):', err);
            }
          }
          finalUrl = subUrl;
        } else {
          // ⚠️ Subscription falhou (ex: PIX Automático não habilitado) → modo invoice.
          console.warn('[ABACATEPAY] subscriptions/create falhou — usando modo invoice:', JSON.stringify(subResult));
          usedInvoiceMode = true;
        }
      } catch (subNetErr: any) {
        console.warn('[ABACATEPAY] Falha de rede em subscriptions/create — usando modo invoice:', subNetErr.message);
        usedInvoiceMode = true;
      }

      if (usedInvoiceMode) {
        // ── Fallback: Modo Invoice (Fatura Automática Mensal) ──
        // Cria um checkout avulso para o 1º pagamento. O CRON cron-monthly-billing
        // detecta subscriptions com billingMode: 'invoice' e cria novas faturas
        // automaticamente antes de cada vencimento (sem depender de PIX Automático).
        const invoiceExternalId = `${externalId.replace(/-sub$/, '')}-inv-${Date.now()}`;
        const invoicePayload: Record<string, any> = {
          items: [{ id: productId, quantity: 1 }],
          methods: ['PIX', 'CARD'],
          card: { maxInstallments: 1 },
          returnUrl: `${returnBase}/#settings?tab=assinatura`,
          completionUrl: `${returnBase}/#settings?tab=assinatura`,
          externalId: invoiceExternalId,
          metadata: { ...metadata, billingMode: 'invoice' },
        };

        const invResponse = await fetch(`${apiBase}/checkouts/create`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(invoicePayload),
        });

        const invResult = await invResponse.json();
        const invUrl = invResult?.data?.url;
        const invErr = invResult?.error && (invResult.error.message || invResult.error);
        if (!invResponse.ok || invErr || !invUrl) {
          console.error('[ABACATEPAY] Erro ao criar invoice (fallback):', JSON.stringify(invResult));
          return res.status(500).json({ error: invErr || 'Erro ao criar fatura mensal.' });
        }

        const invId = invResult.data?.id || invResult.data?.billId || '';
        if (invId) {
          try {
            await db.collection('pending_checkouts').doc(String(invId)).set({
              ...metadata, checkoutId: String(invId), amount, createdAt: Date.now(),
              billingMode: 'invoice',
            });
          } catch (err) {
            console.warn('[ABACATEPAY] Falha ao gravar pending_checkout (invoice):', err);
          }
        }
        finalUrl = invUrl;
      }

      return res.status(200).json({ url: finalUrl, mock: false, billingMode: usedInvoiceMode ? 'invoice' : 'subscription' });

    } else {
      // ── Checkout avulso: PIX à vista | Cartão parcelado (6x semestral / 12x anual) ──
      // O AbacatePay exibe o seletor de parcelas na página de pagamento;
      // as taxas são repassadas ao cliente (3,5% + R$ 0,60 por parcela).
      const payload: Record<string, any> = {
        items: [{ id: productId, quantity: 1 }],
        methods: ['PIX', 'CARD'],
        card: { maxInstallments },
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
      const billingUrl = result?.data?.url;
      const billingErr = result?.error && (result.error.message || result.error);
      if (!response.ok || billingErr || !billingUrl) {
        console.error('[ABACATEPAY] Erro checkout:', JSON.stringify(result));
        return res.status(500).json({ error: billingErr || 'Erro ao criar checkout.' });
      }

      // Fallback de metadata: persiste a intenção pelo checkoutId.
      const checkoutId = result.data?.id || result.data?.billId || result.id;
      if (checkoutId) {
        try {
          await db.collection('pending_checkouts').doc(String(checkoutId)).set({
            ...metadata, checkoutId: String(checkoutId), amount, createdAt: Date.now(),
          });
        } catch (err) {
          console.warn('[ABACATEPAY] Falha ao gravar pending_checkout:', err);
        }
      }

      return res.status(200).json({ url: billingUrl, mock: false });
    }

  } catch (error: any) {
    console.error('[ABACATEPAY] Erro interno:', error);
    return res.status(500).json({ error: error.message });
  }
}
