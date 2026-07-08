import { describe, it, expect } from 'vitest';
import { mapAddonKey, resolveAddon, periodEndFrom, planToAddons, financeMethodKey, isRecurringInterval, intervalLabel, intervalMultiplier, planPrices, planPriceBrl, addonPrices, addonPriceBrl, ADDON_DEFAULTS, estimateNetRevenue, computeChurn30d } from '../../api/_pricing';

/** Catálogo de preços compartilhado entre checkout e webhook — dinheiro, então testado. */
describe('mapAddonKey', () => {
  it('mapeia chaves snake_case da API para camelCase do Firestore', () => {
    expect(mapAddonKey('token_lite')).toBe('tokenLite');
    expect(mapAddonKey('token_pro')).toBe('tokenPro');
    expect(mapAddonKey('extra_reports')).toBe('extraReport');
    expect(mapAddonKey('extra_clinic')).toBe('extraClinic');
  });

  it('mantém chaves já iguais e faz passthrough de desconhecidas', () => {
    expect(mapAddonKey('pacs')).toBe('pacs');
    expect(mapAddonKey('calculators')).toBe('calculators');
    expect(mapAddonKey('chave_inexistente')).toBe('chave_inexistente');
  });
});

describe('resolveAddon', () => {
  it('usa os defaults quando não há metadata do Firestore', () => {
    const r = resolveAddon('token_lite', null);
    expect(r.priceBrl).toBe(ADDON_DEFAULTS.token_lite.price); // 9.90
    expect(r.priceCents).toBe(990);
    expect(r.bundleSize).toBe(50);
  });

  it('converte preço para centavos com arredondamento correto', () => {
    expect(resolveAddon('extra_reports', null).priceCents).toBe(150); // 1.50 → 150
    expect(resolveAddon('token_pro', null).priceCents).toBe(2490);   // 24.90 → 2490
  });

  it('prioriza o metadata do Firestore sobre os defaults', () => {
    const r = resolveAddon('token_lite', { price: 12.5, bundleSize: 100 });
    expect(r.priceBrl).toBe(12.5);
    expect(r.priceCents).toBe(1250);
    expect(r.bundleSize).toBe(100);
  });

  it('ignora campos de metadata com tipo inválido', () => {
    const r = resolveAddon('token_lite', { price: 'grátis', bundleSize: null });
    expect(r.priceBrl).toBe(9.90); // cai no default
    expect(r.bundleSize).toBe(50);
  });

  it('add-on desconhecido → preço 0, bundle 1', () => {
    const r = resolveAddon('desconhecido', null);
    expect(r.priceCents).toBe(0);
    expect(r.bundleSize).toBe(1);
  });
});

describe('planToAddons', () => {
  it('deriva os add-ons das flags includesX do plano', () => {
    expect(planToAddons({ includesCalculators: true, includesPacs: true })).toEqual(['calculators', 'pacs']);
    expect(planToAddons({ includesAppointments: true, includesClinics: true })).toEqual(['appointments', 'clinics']);
  });

  it('plano completo → todos os add-ons na ordem canônica', () => {
    expect(planToAddons({ includesCalculators: true, includesPacs: true, includesAppointments: true, includesClinics: true }))
      .toEqual(['calculators', 'pacs', 'appointments', 'clinics']);
  });

  it('plano sem flags → lista vazia; null/undefined → vazio', () => {
    expect(planToAddons({})).toEqual([]);
    expect(planToAddons(null)).toEqual([]);
    expect(planToAddons(undefined)).toEqual([]);
  });

  it('ignora flags falsas', () => {
    expect(planToAddons({ includesCalculators: false, includesPacs: true })).toEqual(['pacs']);
  });
});

describe('financeMethodKey', () => {
  it('mapeia o método para a chave do contador em finance_stats', () => {
    expect(financeMethodKey('pix')).toBe('pixCount');
    expect(financeMethodKey('credit_card')).toBe('ccCount');
    expect(financeMethodKey('manual')).toBe('manualCount');
  });
  it('método desconhecido/ausente → otherCount', () => {
    expect(financeMethodKey('boleto')).toBe('otherCount');
    expect(financeMethodKey(undefined)).toBe('otherCount');
  });
});

describe('planPrices', () => {
  it('usa o objeto prices quando presente (modelo novo)', () => {
    expect(planPrices({ prices: { month: 149, semester: 799, year: 1490 } }))
      .toEqual({ month: 149, semester: 799, year: 1490 });
  });

  it('deriva os 3 preços de um plano legado mensal (price + interval)', () => {
    expect(planPrices({ price: 100, interval: 'month' }))
      .toEqual({ month: 100, semester: 600, year: 1200 });
  });

  it('deriva o equivalente mensal de um plano legado anual', () => {
    expect(planPrices({ price: 1200, interval: 'year' }))
      .toEqual({ month: 100, semester: 600, year: 1200 });
  });

  it('plano sem preços → tudo zero', () => {
    expect(planPrices({})).toEqual({ month: 0, semester: 0, year: 0 });
    expect(planPrices(null)).toEqual({ month: 0, semester: 0, year: 0 });
  });

  it('ignora campos não-numéricos em prices', () => {
    expect(planPrices({ prices: { month: 'x', semester: null, year: 90 } as any }))
      .toEqual({ month: 0, semester: 0, year: 90 });
  });
});

describe('planPriceBrl', () => {
  const plan = { prices: { month: 149, semester: 799, year: 1490 } };
  it('retorna o preço do intervalo pedido', () => {
    expect(planPriceBrl(plan, 'month')).toBe(149);
    expect(planPriceBrl(plan, 'semester')).toBe(799);
    expect(planPriceBrl(plan, 'year')).toBe(1490);
  });
  it('intervalo ausente/inválido → mensal', () => {
    expect(planPriceBrl(plan)).toBe(149);
    expect(planPriceBrl(plan, 'weekly')).toBe(149);
  });
});

describe('addonPrices / addonPriceBrl', () => {
  it('usa prices explícitos do add-on quando presentes', () => {
    const meta = { price: 49, prices: { month: 49, semester: 249, year: 449 } };
    expect(addonPrices(meta)).toEqual({ month: 49, semester: 249, year: 449 });
    expect(addonPriceBrl(meta, 'semester')).toBe(249);
    expect(addonPriceBrl(meta, 'year')).toBe(449);
  });

  it('sem prices → projeta do mensal (×1/×6/×12)', () => {
    expect(addonPrices({ price: 39 })).toEqual({ month: 39, semester: 234, year: 468 });
    expect(addonPriceBrl({ price: 39 }, 'year')).toBe(468);
    expect(addonPriceBrl({ price: 39 })).toBe(39);
  });

  it('meta vazio → tudo zero', () => {
    expect(addonPrices(null)).toEqual({ month: 0, semester: 0, year: 0 });
  });
});

describe('periodEndFrom', () => {
  const start = 1_700_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('mensal (default/undefined) → +30 dias', () => {
    expect(periodEndFrom(start)).toBe(start + 30 * DAY);
    expect(periodEndFrom(start, 'month')).toBe(start + 30 * DAY);
  });

  it('semestral → +182 dias', () => {
    expect(periodEndFrom(start, 'semester')).toBe(start + 182 * DAY);
  });

  it('anual → +365 dias', () => {
    expect(periodEndFrom(start, 'year')).toBe(start + 365 * DAY);
  });
});

describe('isRecurringInterval', () => {
  it('só o mensal é recorrente', () => {
    expect(isRecurringInterval('month')).toBe(true);
    expect(isRecurringInterval('year')).toBe(false);
    expect(isRecurringInterval('semester')).toBe(false);
    expect(isRecurringInterval(undefined)).toBe(false);
  });
});

describe('intervalLabel', () => {
  it('rótulo por intervalo', () => {
    expect(intervalLabel('month')).toBe('mês');
    expect(intervalLabel('semester')).toBe('semestre');
    expect(intervalLabel('year')).toBe('ano');
    expect(intervalLabel(undefined)).toBe('mês');
  });
});

describe('intervalMultiplier', () => {
  it('mês ×1, semestre ×6, ano ×12', () => {
    expect(intervalMultiplier('month')).toBe(1);
    expect(intervalMultiplier('semester')).toBe(6);
    expect(intervalMultiplier('year')).toBe(12);
    expect(intervalMultiplier(undefined)).toBe(1);
  });
});

describe('estimateNetRevenue', () => {
  const fees = { cardFeePercent: 3.5, cardFeeFixedBrl: 0.60, pixFeePercent: 0.99 };

  it('desconta percentual + taxa fixa por transação no cartão', () => {
    // 2 transações de cartão somando R$300 → 3,5% + R$0,60 por transação
    const net = estimateNetRevenue({ credit_card: 300 }, { credit_card: 2 }, fees);
    expect(net).toBe(288.3); // 300 - (300*0.035) - (2*0.60) = 300 - 10.5 - 1.2
  });

  it('desconta só percentual no PIX (sem taxa fixa)', () => {
    const net = estimateNetRevenue({ pix: 100 }, { pix: 1 }, fees);
    expect(net).toBe(99.01); // 100 - 0.99
  });

  it('método manual/desconhecido não tem taxa de adquirente', () => {
    const net = estimateNetRevenue({ manual: 100 }, { manual: 1 }, fees);
    expect(net).toBe(100);
  });

  it('soma corretamente uma mistura de métodos', () => {
    const net = estimateNetRevenue(
      { pix: 100, credit_card: 300, manual: 50 },
      { pix: 1, credit_card: 2, manual: 1 },
      fees,
    );
    expect(net).toBe(99.01 + 288.3 + 50);
  });

  it('sem revenueByMethod retorna 0, não lança', () => {
    expect(estimateNetRevenue(undefined, undefined, fees)).toBe(0);
  });

  it('sem taxas configuradas (fees vazio), receita líquida = receita bruta', () => {
    const net = estimateNetRevenue({ credit_card: 300, pix: 100 }, { credit_card: 2, pix: 1 }, {});
    expect(net).toBe(400);
  });

  it('countByMethod ausente para um método → taxa fixa não aplicada (mas percentual sim)', () => {
    const net = estimateNetRevenue({ credit_card: 300 }, {}, fees);
    expect(net).toBe(289.5); // 300 - (300*0.035) - (0*0.60)
  });
});

describe('computeChurn30d', () => {
  const NOW = 1_800_000_000_000;
  const DAY = 86400000;

  it('cancelamento explícito dentro de 30 dias conta (usa canceledAt)', () => {
    const r = computeChurn30d([{ status: 'canceled', canceledAt: NOW - 10 * DAY, price: 149, interval: 'month' }], NOW);
    expect(r.churnedCount).toBe(1);
    expect(r.lostMrr).toBe(149);
  });

  it('expiração automática dentro de 30 dias conta (usa updatedAt)', () => {
    const r = computeChurn30d([{ status: 'expired', updatedAt: NOW - 5 * DAY, price: 894, interval: 'semester' }], NOW);
    expect(r.churnedCount).toBe(1);
    expect(r.lostMrr).toBe(149); // 894/6
  });

  it('cancelamento fora da janela de 30 dias NÃO conta', () => {
    const r = computeChurn30d([{ status: 'canceled', canceledAt: NOW - 45 * DAY, price: 149, interval: 'month' }], NOW);
    expect(r.churnedCount).toBe(0);
    expect(r.lostMrr).toBe(0);
  });

  it('assinatura ativa/trialing não conta (não é churn)', () => {
    const r = computeChurn30d([{ status: 'active', price: 149, interval: 'month' }], NOW);
    expect(r.churnedCount).toBe(0);
  });

  it('canceled sem canceledAt (dado antigo/incompleto) é ignorado, não conta como churn de hoje', () => {
    const r = computeChurn30d([{ status: 'canceled', price: 149, interval: 'month' }], NOW);
    expect(r.churnedCount).toBe(0);
  });

  it('soma corretamente múltiplos cancelamentos de intervalos diferentes', () => {
    const r = computeChurn30d([
      { status: 'canceled', canceledAt: NOW - 1 * DAY, price: 149, interval: 'month' },
      { status: 'expired', updatedAt: NOW - 2 * DAY, price: 1788, interval: 'year' }, // 149/mês
    ], NOW);
    expect(r.churnedCount).toBe(2);
    expect(r.lostMrr).toBe(298);
  });

  it('lista vazia retorna zerado', () => {
    expect(computeChurn30d([], NOW)).toEqual({ churnedCount: 0, lostMrr: 0 });
  });
});
