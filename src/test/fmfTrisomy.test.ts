import { describe, it, expect } from 'vitest';
import {
  probToOdds, oddsToProb, probToOneInN, oneInNToProb,
  gaussianMoMLR, biochemLR, markerLR, computeTrisomyRisk,
  type TrisomyModelParams, type GaussianParams,
} from '../modules/calculators/fmf/trisomy';
import {
  t21TermRisk, ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS,
} from '../modules/calculators/fmf/trisomyData';

describe('conversões probabilidade ↔ odds ↔ 1:N', () => {
  it('probToOdds e oddsToProb são inversas', () => {
    const p = 0.01;
    expect(oddsToProb(probToOdds(p))).toBeCloseTo(p, 12);
  });

  it('probToOneInN arredonda 1/p', () => {
    expect(probToOneInN(1 / 300)).toBe(300);
    expect(probToOneInN(0)).toBe(Infinity);
  });

  it('oneInNToProb é o recíproco', () => {
    expect(oneInNToProb(250)).toBeCloseTo(1 / 250, 12);
  });
});

describe('LR Gaussiana de log10(MoM)', () => {
  const same: GaussianParams = { mean: 0, sd: 0.2 };

  it('distribuições idênticas ⇒ LR = 1 para qualquer MoM', () => {
    expect(gaussianMoMLR(1.0, same, same)).toBeCloseTo(1, 12);
    expect(gaussianMoMLR(2.5, same, same)).toBeCloseTo(1, 12);
  });

  it('MoM maior aumenta a LR quando a média afetada é maior', () => {
    const unaff: GaussianParams = { mean: 0, sd: 0.2 };
    const aff: GaussianParams = { mean: 0.3, sd: 0.2 };
    const lrLow = gaussianMoMLR(0.8, unaff, aff);
    const lrHigh = gaussianMoMLR(2.0, unaff, aff);
    expect(lrHigh).toBeGreaterThan(lrLow);
  });

  it('MoM inválido (≤0) ⇒ LR neutra = 1', () => {
    expect(gaussianMoMLR(0, same, { mean: 0.3, sd: 0.2 })).toBe(1);
  });

  it('bate com o valor calculado à mão', () => {
    // x = log10(1) = 0; unaff N(0,0.2), aff N(0.3,0.2)
    // LR = (sd_u/sd_a) exp( (x-μ_u)²/2σ_u² - (x-μ_a)²/2σ_a² )
    //    = 1 * exp( 0 - 0.09/(2*0.04) ) = exp(-1.125)
    expect(gaussianMoMLR(1.0, { mean: 0, sd: 0.2 }, { mean: 0.3, sd: 0.2 }))
      .toBeCloseTo(Math.exp(-1.125), 10);
  });
});

describe('LR bivariada da bioquímica', () => {
  const dist = { bhcg: { mean: 0, sd: 0.26 }, pappa: { mean: 0, sd: 0.28 }, rho: 0.2 };

  it('distribuições idênticas ⇒ LR = 1', () => {
    expect(biochemLR(1.0, 1.0, dist, dist)).toBeCloseTo(1, 12);
    expect(biochemLR(1.7, 0.5, dist, dist)).toBeCloseTo(1, 12);
  });

  it('MoM inválido ⇒ LR neutra', () => {
    expect(biochemLR(0, 1, dist, dist)).toBe(1);
  });
});

describe('LR de marcadores discretos', () => {
  const lr = {
    abnormal: { t21: 27, t18: 20, t13: 8 },
    normal: { t21: 0.41, t18: 0.5, t13: 0.7 },
  };
  it('notAssessed / undefined ⇒ LR neutra = 1', () => {
    expect(markerLR(undefined, lr, 't21')).toBe(1);
    expect(markerLR('notAssessed', lr, 't21')).toBe(1);
  });
  it('abnormal e normal usam a LR correspondente', () => {
    expect(markerLR('abnormal', lr, 't21')).toBe(27);
    expect(markerLR('normal', lr, 't21')).toBe(0.41);
  });
});

describe('computeTrisomyRisk — combinação bayesiana', () => {
  // Parâmetros neutros: afetada == não-afetada, marcadores = 1 ⇒ posterior == prior.
  const g: GaussianParams = { mean: 0, sd: 0.2 };
  const bio = { bhcg: { mean: 0, sd: 0.26 }, pappa: { mean: 0, sd: 0.28 }, rho: 0.2 };
  const neutral: TrisomyModelParams = {
    validated: false,
    version: 'neutral-test',
    nt: { unaffected: g, affected: { t21: g, t18: g, t13: g } },
    biochem: { unaffected: bio, affected: { t21: bio, t18: bio, t13: bio } },
    markers: {
      nasalBone: { abnormal: { t21: 1, t18: 1, t13: 1 }, normal: { t21: 1, t18: 1, t13: 1 } },
      ductusVenosus: { abnormal: { t21: 1, t18: 1, t13: 1 }, normal: { t21: 1, t18: 1, t13: 1 } },
      tricuspid: { abnormal: { t21: 1, t18: 1, t13: 1 }, normal: { t21: 1, t18: 1, t13: 1 } },
    },
  };
  const prior = { t21: 1 / 300, t18: 1 / 3000, t13: 1 / 9000 };

  it('parâmetros neutros ⇒ posterior = prior', () => {
    const r = computeTrisomyRisk(
      { priorRisk: prior, ntMm: 2.0, ntMedianMm: 2.0, freeBhcgMoM: 1, pappaMoM: 1, nasalBone: 'normal' },
      neutral,
    );
    expect(r.posterior.t21).toBeCloseTo(prior.t21, 10);
    expect(r.oneInN.t21).toBe(300);
  });

  it('TN aumentada eleva o risco de T21 (monotonicidade)', () => {
    const low = computeTrisomyRisk({ priorRisk: prior, ntMm: 1.8, ntMedianMm: 2.0 }, PROVISIONAL_TRISOMY_PARAMS);
    const high = computeTrisomyRisk({ priorRisk: prior, ntMm: 3.5, ntMedianMm: 2.0 }, PROVISIONAL_TRISOMY_PARAMS);
    expect(high.posterior.t21).toBeGreaterThan(low.posterior.t21);
  });

  it('osso nasal ausente aumenta o risco de T21', () => {
    const base = computeTrisomyRisk({ priorRisk: prior }, PROVISIONAL_TRISOMY_PARAMS);
    const absent = computeTrisomyRisk({ priorRisk: prior, nasalBone: 'abnormal' }, PROVISIONAL_TRISOMY_PARAMS);
    expect(absent.posterior.t21).toBeGreaterThan(base.posterior.t21);
  });
});

describe('risco por idade materna', () => {
  it('aumenta com a idade (N diminui)', () => {
    expect(t21TermRisk(25)).toBeLessThan(t21TermRisk(40));
    expect(probToOneInN(t21TermRisk(35))).toBeLessThan(probToOneInN(t21TermRisk(25)));
  });

  it('faz clamp fora da faixa da tabela', () => {
    expect(t21TermRisk(18)).toBeCloseTo(t21TermRisk(20), 12);
    expect(t21TermRisk(50)).toBeCloseTo(t21TermRisk(45), 12);
  });

  it('T18 e T13 são frações de T21', () => {
    const r = ageRelatedRisk(35);
    expect(r.t18).toBeLessThan(r.t21);
    expect(r.t13).toBeLessThan(r.t18);
  });
});

describe('trava de segurança clínica', () => {
  it('parâmetros provisórios NÃO estão validados', () => {
    expect(PROVISIONAL_TRISOMY_PARAMS.validated).toBe(false);
  });
});
