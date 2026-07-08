/**
 * Catálogo único de preços/quotas de add-ons — fonte de verdade compartilhada
 * entre o checkout e o webhook. Os valores aqui são apenas fallbacks; quando
 * `global_config/addons_config` existe no Firestore, ele tem prioridade.
 */

/**
 * Deriva a lista de add-ons de um plano a partir das flags `includesX`.
 * Fonte única usada pelo webhook (concessão) e testável isoladamente.
 */
export function planToAddons(plan: {
  includesCalculators?: boolean;
  includesPacs?: boolean;
  includesAppointments?: boolean;
  includesClinics?: boolean;
} | null | undefined): string[] {
  const addons: string[] = [];
  if (!plan) return addons;
  if (plan.includesCalculators) addons.push('calculators');
  if (plan.includesPacs) addons.push('pacs');
  if (plan.includesAppointments) addons.push('appointments');
  if (plan.includesClinics) addons.push('clinics');
  return addons;
}

/**
 * Chave do contador de método de pagamento no agregado `finance_stats`.
 * Usada pelo webhook (incremento) e pelo recálculo do admin.
 */
export function financeMethodKey(paymentMethod: string | undefined): 'pixCount' | 'ccCount' | 'manualCount' | 'otherCount' {
  return paymentMethod === 'pix' ? 'pixCount'
    : paymentMethod === 'credit_card' ? 'ccCount'
      : paymentMethod === 'manual' ? 'manualCount'
        : 'otherCount';
}

/** Config de taxas de gateway (`global_config/abacatepay_config`) usada para
 * estimar receita líquida — ver `estimateNetRevenue`. */
export interface GatewayFeeConfig {
  cardFeePercent?: number;
  cardFeeFixedBrl?: number;
  pixFeePercent?: number;
}

/**
 * Estima a receita líquida de taxas de gateway a partir da receita bruta
 * quebrada por método de pagamento (`revenueByMethod`/`countByMethod`,
 * agregados diários) e da config de taxas do admin. É uma ESTIMATIVA — usa a
 * taxa que o admin configurou manualmente, não a taxa real cobrada pela
 * AbacatePay em cada transação (essa não é exposta hoje). `manual`/outros
 * métodos não têm taxa de gateway (não passam pela adquirente).
 */
export function estimateNetRevenue(
  revenueByMethod: Record<string, number> | undefined,
  countByMethod: Record<string, number> | undefined,
  fees: GatewayFeeConfig,
): number {
  if (!revenueByMethod) return 0;
  let net = 0;
  for (const [method, gross] of Object.entries(revenueByMethod)) {
    const count = countByMethod?.[method] || 0;
    if (method === 'credit_card') {
      const pct = fees.cardFeePercent ?? 0;
      const fixed = fees.cardFeeFixedBrl ?? 0;
      net += gross - (gross * pct / 100) - (count * fixed);
    } else if (method === 'pix') {
      const pct = fees.pixFeePercent ?? 0;
      net += gross - (gross * pct / 100);
    } else {
      // manual/outros: sem taxa de adquirente conhecida.
      net += gross;
    }
  }
  return Math.round(net * 100) / 100;
}

/** Mapeia a chave de add-on da API (snake_case) para a chave do Firestore (camelCase). */
export function mapAddonKey(addon: string): string {
  const mapping: Record<string, string> = {
    calculators: 'calculators',
    pacs: 'pacs',
    appointments: 'appointments',
    clinics: 'clinics',
    token_lite: 'tokenLite',
    token_pro: 'tokenPro',
    extra_reports: 'extraReport',
    extra_clinic: 'extraClinic',
  };
  return mapping[addon] || addon;
}

export const ADDON_NAMES: Record<string, string> = {
  calculators: 'Add-on Calculadoras Clínicas',
  pacs: 'Add-on PACS / DICOM Sync',
  appointments: 'Add-on Módulo de Agendamentos',
  clinics: 'Add-on Módulo de Clínicas',
  token_lite: 'Pacote de Laudos LAUD.IA',
  token_pro: 'Pacote de Laudos LAUD.IA',
  extra_reports: 'Laudos Extras',
  extra_clinic: 'Clínica Extra',
};

/** Fallbacks de preço (R$) e tamanho de pacote por add-on. */
export const ADDON_DEFAULTS: Record<string, { price: number; bundleSize: number }> = {
  calculators:   { price: 49,    bundleSize: 1  },
  pacs:          { price: 0,     bundleSize: 1  },
  appointments:  { price: 39,    bundleSize: 1  },
  clinics:       { price: 49,    bundleSize: 1  },
  token_lite:    { price: 9.90,  bundleSize: 50 },
  token_pro:     { price: 24.90, bundleSize: 20 },
  extra_reports: { price: 1.50,  bundleSize: 1  },
  extra_clinic:  { price: 29,    bundleSize: 1  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanInterval = 'month' | 'semester' | 'year';

/** Calcula o fim do período de cobrança respeitando o intervalo do plano. */
export function periodEndFrom(start: number, interval?: string): number {
  const days = interval === 'year' ? 365 : interval === 'semester' ? 182 : 30;
  return start + days * DAY_MS;
}

/**
 * O intervalo MENSAL é assinatura recorrente (subscription na AbacatePay).
 * Semestral e anual são checkouts avulsos pagos de uma vez (com parcelamento no cartão).
 * Fonte única usada por checkout, webhook e UI.
 */
export function isRecurringInterval(interval?: string): boolean {
  return interval === 'month';
}

/** Rótulo curto do intervalo para a UI. */
export function intervalLabel(interval?: string): string {
  return interval === 'year' ? 'ano' : interval === 'semester' ? 'semestre' : 'mês';
}

/**
 * Número máximo de parcelas no cartão por intervalo.
 * Mensal é recorrente (subscription) — sem parcelamento de parcela única.
 * Semestral = 6x | Anual = 12x.
 */
export function getMaxInstallments(interval?: string): number {
  if (interval === 'year')     return 12;
  if (interval === 'semester') return 6;
  return 1; // month: subscription recorrente, não se aplica parcelamento
}

/**
 * Ciclo da AbacatePay para produtos de subscription recorrente.
 * Usado ao criar produtos com frequency configurada.
 */
export function getAbacatePayCycle(interval?: string): string {
  if (interval === 'semester') return 'SEMIANNUALLY';
  if (interval === 'year')     return 'ANNUALLY';
  return 'MONTHLY';
}

/**
 * Multiplicador do preço-base (mensal) por intervalo — usado para precificar
 * add-ons nos 3 intervalos sem config extra (mês ×1, semestre ×6, ano ×12).
 * Planos definem cada preço explicitamente; add-ons derivam do preço mensal.
 */
export function intervalMultiplier(interval?: string): number {
  return interval === 'year' ? 12 : interval === 'semester' ? 6 : 1;
}

/**
 * Churn dos últimos 30 dias: quantos assinantes cancelaram/expiraram e quanto
 * de MRR isso representa. `canceled` usa `canceledAt` (setado no cancelamento
 * explícito); `expired` (avulso que não renovou) não tem timestamp dedicado —
 * usa `updatedAt`, que o CRON de expiração grava no momento exato da transição
 * de status (aproximação razoável: assinaturas expiradas não recebem mais
 * updates depois disso). Assinaturas sem timestamp utilizável são ignoradas
 * (contam como "não sabemos quando", não como churn de hoje).
 */
export function computeChurn30d(
  subscriptions: Array<{ status?: string; canceledAt?: number; updatedAt?: number; price?: number; interval?: string }>,
  now: number,
): { churnedCount: number; lostMrr: number } {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  let churnedCount = 0;
  let lostMrr = 0;
  for (const d of subscriptions) {
    let churnedAt: number | undefined;
    if (d.status === 'canceled' && d.canceledAt) churnedAt = d.canceledAt;
    else if (d.status === 'expired' && d.updatedAt) churnedAt = d.updatedAt;
    if (churnedAt === undefined) continue;
    if (now - churnedAt < 0 || now - churnedAt > THIRTY_DAYS) continue;
    churnedCount += 1;
    lostMrr += (Number(d.price) || 0) / intervalMultiplier(d.interval || 'month');
  }
  return { churnedCount, lostMrr: Math.round(lostMrr * 100) / 100 };
}

/**
 * Normaliza os 3 preços (mensal/semestral/anual) de um plano.
 *
 * Modelo novo: o plano guarda `prices: { month, semester, year }` — um único
 * documento cobre os 3 intervalos, sem precisar duplicar planos.
 *
 * Compat: planos legados guardavam um único `price` + `interval`; nesse caso
 * derivamos o equivalente mensal e projetamos os 3 intervalos.
 * Fonte única usada por checkout, vitrine e admin.
 */
export function planPrices(plan: any): { month: number; semester: number; year: number } {
  const p = plan?.prices;
  if (p && typeof p === 'object') {
    return {
      month:    Number(p.month)    || 0,
      semester: Number(p.semester) || 0,
      year:     Number(p.year)     || 0,
    };
  }
  const base = Number(plan?.price) || 0;
  const iv = plan?.interval || 'month';
  const monthly = iv === 'year' ? base / 12 : iv === 'semester' ? base / 6 : base;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { month: round(monthly), semester: round(monthly * 6), year: round(monthly * 12) };
}

/** Preço (R$) de um plano para um intervalo específico. */
export function planPriceBrl(plan: any, interval?: string): number {
  const iv: PlanInterval = interval === 'year' ? 'year' : interval === 'semester' ? 'semester' : 'month';
  return planPrices(plan)[iv];
}

/**
 * Preços por intervalo de um ADD-ON de módulo recorrente.
 * Modelo novo: `meta.prices = { month, semester, year }`.
 * Compat: só `meta.price` (mensal) → projeta mês ×1, semestre ×6, ano ×12.
 */
export function addonPrices(meta: any): { month: number; semester: number; year: number } {
  const p = meta?.prices;
  if (p && typeof p === 'object' && (Number(p.month) || Number(p.semester) || Number(p.year))) {
    return { month: Number(p.month) || 0, semester: Number(p.semester) || 0, year: Number(p.year) || 0 };
  }
  const base = Number(meta?.price) || 0;
  return { month: base, semester: base * 6, year: base * 12 };
}

/** Preço (R$) de um add-on de módulo para um intervalo específico. */
export function addonPriceBrl(meta: any, interval?: string): number {
  const iv: PlanInterval = interval === 'year' ? 'year' : interval === 'semester' ? 'semester' : 'month';
  return addonPrices(meta)[iv];
}

/**
 * Resolve preço (em centavos) e bundleSize de um add-on, priorizando o
 * metadata do Firestore e caindo para os defaults acima.
 */
export function resolveAddon(
  addon: string,
  firestoreMeta: any | null,
): { priceCents: number; priceBrl: number; bundleSize: number } {
  const def = ADDON_DEFAULTS[addon] || { price: 0, bundleSize: 1 };
  let priceBrl = def.price;
  let bundleSize = def.bundleSize;
  if (firestoreMeta) {
    if (typeof firestoreMeta.price === 'number') priceBrl = firestoreMeta.price;
    if (typeof firestoreMeta.bundleSize === 'number') bundleSize = firestoreMeta.bundleSize;
  }
  return { priceCents: Math.round(priceBrl * 100), priceBrl, bundleSize };
}
