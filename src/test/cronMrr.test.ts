import { describe, it, expect } from 'vitest';
import { computeMrr } from '../../api/cron-aggregate-metrics';

/**
 * MRR alimenta o card mais visível do Financeiro — testado por dinheiro.
 * Regressão do bug real: assinante semestral era contado com o preço CHEIO
 * como se fosse mensal (6x de superestimação), porque o cálculo antigo só
 * tratava interval==='year' como não-mensal.
 */
describe('computeMrr', () => {
  it('assinatura mensal conta o preço cheio', () => {
    const r = computeMrr([{ status: 'active', price: 149, interval: 'month' }]);
    expect(r.mrr).toBe(149);
  });

  it('assinatura semestral conta 1/6 do preço (não o preço cheio)', () => {
    const r = computeMrr([{ status: 'active', price: 894, interval: 'semester' }]);
    expect(r.mrr).toBe(149); // 894/6
  });

  it('assinatura anual conta 1/12 do preço', () => {
    const r = computeMrr([{ status: 'active', price: 1788, interval: 'year' }]);
    expect(r.mrr).toBe(149); // 1788/12
  });

  it('interval ausente é tratado como mensal (fallback seguro)', () => {
    const r = computeMrr([{ status: 'active', price: 149 }]);
    expect(r.mrr).toBe(149);
  });

  it('mistura de intervalos soma corretamente o equivalente mensal de cada uma', () => {
    const r = computeMrr([
      { status: 'active', price: 149, interval: 'month' },
      { status: 'active', price: 894, interval: 'semester' }, // 149/mês
      { status: 'active', price: 1788, interval: 'year' },    // 149/mês
    ]);
    expect(r.mrr).toBe(447); // 149*3
    expect(r.activeSubscribers).toBe(3);
  });

  it('assinatura trialing entra no MRR (não só em "trials")', () => {
    const r = computeMrr([{ status: 'trialing', price: 149, interval: 'month' }]);
    expect(r.mrr).toBe(149);
    expect(r.trials).toBe(1);
    expect(r.activeSubscribers).toBe(0);
  });

  it('canceled/past_due/expired NÃO entram no MRR', () => {
    const r = computeMrr([
      { status: 'canceled', price: 149, interval: 'month' },
      { status: 'past_due', price: 149, interval: 'month' },
      { status: 'expired', price: 149, interval: 'month' },
    ]);
    expect(r.mrr).toBe(0);
    expect(r.activeSubscribers).toBe(0);
    expect(r.trials).toBe(0);
  });

  it('assinatura sem price definido (ex.: cortesia/comp) contribui 0, não NaN', () => {
    const r = computeMrr([{ status: 'active', interval: 'month' }]);
    expect(r.mrr).toBe(0);
    expect(Number.isNaN(r.mrr)).toBe(false);
  });

  it('lista vazia retorna tudo zerado', () => {
    const r = computeMrr([]);
    expect(r).toEqual({ mrr: 0, activeSubscribers: 0, trials: 0 });
  });

  it('arredonda para 2 casas decimais', () => {
    const r = computeMrr([{ status: 'active', price: 100, interval: 'semester' }]);
    expect(r.mrr).toBe(16.67); // 100/6 = 16.666...
  });
});
