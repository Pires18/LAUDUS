import { getDb } from './_firebase.js';
import { isProduction } from './_auth.js';

/**
 * Gateway de Pagamento Simulado (Sandbox AbacatePay) — Exclusivo para Dev/Preview.
 *
 * Renderiza uma página HTML interativa de alta fidelidade visual, imitando o
 * checkout oficial da AbacatePay. Permite ao desenvolvedor/testador escolher
 * entre PIX e Cartão de Crédito (com seletor dinâmico de parcelas baseado no plano!)
 * e testar a liberação de acesso de ponta a ponta.
 */
export default async function handler(req: any, res: any) {
  const db = await getDb();
  let configSnap: any = null;
  let sandboxMode = false;
  let passCardFees = true;
  let cardFeePercent = 3.5;
  let cardFeeFixedBrl = 0.60;
  let passPixFees = false;
  let pixFeePercent = 0.99;

  try {
    configSnap = await db.collection('global_config').doc('abacatepay_config').get();
    if (configSnap.exists) {
      const d = configSnap.data();
      sandboxMode = !!d?.sandboxMode;
      if (d?.passCardFees !== undefined) passCardFees = !!d.passCardFees;
      if (d?.cardFeePercent !== undefined) cardFeePercent = parseFloat(d.cardFeePercent) || 0;
      if (d?.cardFeeFixedBrl !== undefined) cardFeeFixedBrl = parseFloat(d.cardFeeFixedBrl) || 0;
      if (d?.passPixFees !== undefined) passPixFees = !!d.passPixFees;
      if (d?.pixFeePercent !== undefined) pixFeePercent = parseFloat(d.pixFeePercent) || 0;
    }
  } catch (err) {
    console.warn('[MOCK-GATEWAY] Erro ao carregar global_config/abacatepay_config:', err);
  }

  if (isProduction() && !sandboxMode) {
    return res.status(403).send('Sandbox desabilitado em produção.');
  }

  const {
    userId, email, type, addon, planId, interval, billingMode,
    installments: maxInstallsQuery, amount: rawAmount, checkoutId,
  } = req.query || {};

  if (!userId) {
    return res.status(400).send('userId é obrigatório para carregar o checkout de testes.');
  }

  const limitInstalls = Math.min(12, Math.max(1, parseInt(maxInstallsQuery as string) || 1));
  const amountCents   = parseInt(rawAmount as string) || 14900;
  const amountBrl     = amountCents / 100;

  // Resolve nome do produto de forma amigável
  let displayProduct = 'LAUD.US — Plano Base';
  if (type === 'addon' && addon) {
    displayProduct = `Add-on ${String(addon).replace('_', ' ')}`;
  } else if (planId) {
    try {
      const planSnap = await db.collection('saas_plans').doc(String(planId)).get();
      if (planSnap.exists && planSnap.data()?.name) {
        displayProduct = `LAUD.US — Plano ${planSnap.data().name}`;
      }
    } catch { /* fallback */ }
  }

  const intervalText = interval === 'year' ? 'Anual' : interval === 'semester' ? 'Semestral' : 'Mensal';

  // Se for semestral ou anual, a aba Cartão (com parcelamento) é exibida por padrão
  const isCardDefault = interval === 'semester' || interval === 'year';
  const tabPixClass = isCardDefault ? 'tab' : 'tab active';
  const tabCardClass = isCardDefault ? 'tab active' : 'tab';
  const panelPixClass = isCardDefault ? 'panel' : 'panel active';
  const panelCardClass = isCardDefault ? 'panel active' : 'panel';

  // Se taxas do Pix são repassadas
  let finalPixValue = amountBrl;
  if (passPixFees) {
    finalPixValue = amountBrl + (amountBrl * (pixFeePercent / 100));
  }
  const formattedVal = finalPixValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Opções de parcelas geradas dinamicamente
  let installmentOptionsHtml = '';
  for (let i = 1; i <= limitInstalls; i++) {
    let finalInstallmentVal = amountBrl / i;
    let detailsText = 'Sem juros';

    if (i > 1 && passCardFees) {
      // Repasse de tarifas do cartão: adiciona taxa de intermediação (ex: 3.5% + R$ 0.60) e juros simples de parcelamento (1.5% por parcela adicional)
      const baseFee = amountBrl * (cardFeePercent / 100) + cardFeeFixedBrl;
      const installmentInterest = amountBrl * 0.015 * (i - 1);
      finalInstallmentVal = (amountBrl + baseFee + installmentInterest) / i;
      detailsText = 'Com juros/taxas';
    } else if (i === 1 && passCardFees) {
      // 1x no cartão com a taxa base do cartão
      const baseFee = amountBrl * (cardFeePercent / 100) + cardFeeFixedBrl;
      finalInstallmentVal = amountBrl + baseFee;
      detailsText = 'Com taxa base';
    }

    const installmentValueFormatted = finalInstallmentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isSelected = i === 1 ? 'selected' : '';
    installmentOptionsHtml += `<option value="${i}" ${isSelected}>${i}x de R$ ${installmentValueFormatted} (${detailsText})</option>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AbacatePay Sandbox 🥑</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --brand-color: #16a34a;
      --brand-hover: #15803d;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --brand-light: #f0fdf4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
    body { background-color: var(--bg-color); color: var(--text-main); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .container { width: 100%; max-width: 480px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); overflow: hidden; }
    .header { background: var(--brand-light); padding: 24px; border-b: 1px solid var(--border-color); text-align: center; }
    .header .logo { font-size: 24px; font-weight: 900; color: var(--brand-color); display: flex; align-items: center; justify-content: center; gap: 6px; }
    .header .badge { display: inline-block; font-size: 9px; font-weight: 800; text-transform: uppercase; background: var(--brand-color); color: white; padding: 2px 8px; border-radius: 99px; margin-top: 6px; letter-spacing: 0.5px; }
    
    .product-details { padding: 24px; border-bottom: 1px dashed var(--border-color); }
    .product-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
    .product-meta { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 2px; }
    .price-tag { font-size: 32px; font-weight: 900; color: var(--text-main); margin-top: 12px; display: flex; align-items: baseline; gap: 2px; }
    .price-tag span { font-size: 14px; font-weight: 600; color: var(--text-muted); }

    .tabs { display: flex; border-bottom: 1px solid var(--border-color); }
    .tab { flex: 1; padding: 14px; text-align: center; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; border-bottom: 3px solid transparent; color: var(--text-muted); transition: all 0.2s; }
    .tab.active { color: var(--brand-color); border-bottom-color: var(--brand-color); background: rgba(22, 163, 74, 0.02); }

    .tab-content { padding: 24px; }
    .panel { display: none; }
    .panel.active { display: block; }

    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
    .input, select { width: 100%; height: 44px; padding: 0 14px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 13px; font-weight: 600; color: var(--text-main); outline: none; transition: border-color 0.2s; background-color: var(--bg-color); }
    .input:focus, select:focus { border-color: var(--brand-color); }

    .qr-container { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 12px 0; }
    .qr-code { width: 140px; height: 140px; border: 1px solid var(--border-color); border-radius: 16px; padding: 8px; background: white; }
    .qr-text { font-size: 12px; font-weight: 600; color: var(--text-muted); max-width: 280px; }

    .btn { display: flex; align-items: center; justify-content: center; width: 100%; height: 48px; border: none; border-radius: 14px; background: var(--brand-color); color: white; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; transition: background 0.2s; text-decoration: none; margin-top: 8px; }
    .btn:hover { background: var(--brand-hover); }

    .footer { padding: 16px 24px; text-align: center; font-size: 10px; font-weight: 600; color: var(--text-muted); border-t: 1px solid var(--border-color); background: var(--bg-color); }
  </style>
</head>
<body>

  <div class="container">
    <div class="header">
      <div class="logo">🥑 abacatepay</div>
      <div class="badge">Ambiente de Testes / Sandbox</div>
    </div>

    <div class="product-details">
      <div class="product-name">${displayProduct}</div>
      <div class="product-meta">Intervalo: ${intervalText} · Cobrança: ${billingMode === 'invoice' ? 'Fatura Avulsa' : 'Assinatura'}</div>
      <div class="price-tag"><span>R$</span>${formattedVal}</div>
    </div>

    <div class="tabs">
      <div class="${tabPixClass}" onclick="switchTab('pix')">Pix</div>
      <div class="${tabCardClass}" onclick="switchTab('card')">Cartão de Crédito</div>
    </div>

    <div class="tab-content">
      <!-- Painel Pix -->
      <div id="panel-pix" class="panel ${panelPixClass}">
        <div class="qr-container">
          <svg class="qr-code" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="white"/>
            <!-- Simulação de QR Code -->
            <path d="M10 10h30v30h-30zm40 0h30v10H50zm10 20h20v20H60zM10 60h30v30h-30z" fill="#0f172a"/>
            <path d="M20 20h10v10H20zm0 50h10v10H20zm50-40h10v10H70z" fill="#16a34a"/>
            <path d="M50 70h20v10H50zm10 10h30v10H60zm20-30h10v10H80z" fill="#0f172a"/>
          </svg>
          <div class="qr-text">Copie a chave aleatória ou escaneie o código no aplicativo do seu banco para simular o Pix de testes.</div>
        </div>
        <form action="/api/abacatepay-webhook" method="GET">
          <input type="hidden" name="mock" value="true">
          <input type="hidden" name="userId" value="${userId}">
          <input type="hidden" name="type" value="${type}">
          <input type="hidden" name="addon" value="${addon}">
          <input type="hidden" name="planId" value="${planId}">
          <input type="hidden" name="interval" value="${interval}">
          <input type="hidden" name="billingMode" value="${billingMode}">
          <input type="hidden" name="checkoutId" value="${checkoutId}">
          <input type="hidden" name="paymentMethod" value="pix">
          <input type="hidden" name="installments" value="1">
          <button type="submit" class="btn">Confirmar Pagamento Pix (Mock)</button>
        </form>
      </div>

      <!-- Painel Cartão -->
      <div id="panel-card" class="panel ${panelCardClass}">
        <form action="/api/abacatepay-webhook" method="GET">
          <input type="hidden" name="mock" value="true">
          <input type="hidden" name="userId" value="${userId}">
          <input type="hidden" name="type" value="${type}">
          <input type="hidden" name="addon" value="${addon}">
          <input type="hidden" name="planId" value="${planId}">
          <input type="hidden" name="interval" value="${interval}">
          <input type="hidden" name="billingMode" value="${billingMode}">
          <input type="hidden" name="checkoutId" value="${checkoutId}">
          <input type="hidden" name="paymentMethod" value="credit_card">

          <div class="form-group">
            <label>Número do Cartão (Simulado)</label>
            <input type="text" class="input" placeholder="4551 2234 1122 9900" required>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 1;">
              <label>Validade</label>
              <input type="text" class="input" placeholder="12/32" required>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>CVV</label>
              <input type="text" class="input" placeholder="123" required>
            </div>
          </div>

          <div class="form-group">
            <label>Opções de Parcelamento</label>
            <select name="installments">
              ${installmentOptionsHtml}
            </select>
          </div>

          <button type="submit" class="btn">Confirmar Pagamento Cartão (Mock)</button>
        </form>
      </div>
    </div>

    <div class="footer">
      Esta é uma simulação de testes (sandbox). Nenhuma cobrança real será gerada.
    </div>
  </div>

  <script>
    function switchTab(type) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      
      if (type === 'pix') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('panel-pix').classList.add('active');
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('panel-card').classList.add('active');
      }
    }
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
