import { describe, it, expect } from 'vitest';
import {
  probToOdds, oddsToProb, probToOneInN, oneInNToProb,
  ntMixtureLR, biochemLR, markerLR, computeTrisomyRisk, ntExpectedMedianMm,
} from '../modules/calculators/fmf/trisomy';
import {
  t21TermRisk, ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS as P,
} from '../modules/calculators/fmf/trisomyData';

describe('conversões probabilidade ↔ odds ↔ 1:N', () => {
  it('probToOdds e oddsToProb são inversas', () => {
    expect(oddsToProb(probToOdds(0.01))).toBeCloseTo(0.01, 12);
  });
  it('probToOneInN arredonda 1/p; 0 ⇒ Infinity', () => {
    expect(probToOneInN(1 / 300)).toBe(300);
    expect(probToOneInN(0)).toBe(Infinity);
  });
  it('oneInNToProb é o recíproco', () => {
    expect(oneInNToProb(250)).toBeCloseTo(1 / 250, 12);
  });
});

describe('TN — modelo de mistura (Wright 2008)', () => {
  it('mediana esperada da TN cresce com o CCN e é fisiológica', () => {
    const m45 = ntExpectedMedianMm(45, P.nt);
    const m84 = ntExpectedMedianMm(84, P.nt);
    expect(m84).toBeGreaterThan(m45);
    expect(m45).toBeGreaterThan(1.0);
    expect(m84).toBeLessThan(2.6);
  });
  it('TN aumentada eleva a LR de T21; TN baixa a reduz', () => {
    const lrHigh = ntMixtureLR(3.4, 65, P.nt, 't21');
    const lrLow = ntMixtureLR(1.3, 65, P.nt, 't21');
    expect(lrHigh).toBeGreaterThan(1);
    expect(lrLow).toBeLessThan(1);
    expect(lrHigh).toBeGreaterThan(lrLow);
  });
  it('TN muito aumentada gera LR de T21 alta (>10)', () => {
    expect(ntMixtureLR(5.0, 65, P.nt, 't21')).toBeGreaterThan(10);
  });
  it('entrada inválida ⇒ LR neutra', () => {
    expect(ntMixtureLR(0, 65, P.nt, 't21')).toBe(1);
    expect(ntMixtureLR(2, 0, P.nt, 't21')).toBe(1);
  });
});

describe('Bioquímica — bivariada (Kagan 2008)', () => {
  it('padrão de T21 (β-hCG↑, PAPP-A↓) eleva a LR', () => {
    expect(biochemLR(2.0, 0.5, 89, P.biochem, 't21')).toBeGreaterThan(1);
  });
  it('bioquímica normal (1,1 MoM) reduz a LR de T21', () => {
    expect(biochemLR(1.0, 1.0, 89, P.biochem, 't21')).toBeLessThan(1);
  });
  it('padrão de T18 (β-hCG↓ e PAPP-A↓) eleva a LR de T18', () => {
    // T18: ambos baixos (~0.2 MoM). Deve dar LR de T18 alta e maior que a de T21.
    const lrT18 = biochemLR(0.2, 0.2, 89, P.biochem, 't18');
    const lrT21 = biochemLR(0.2, 0.2, 89, P.biochem, 't21');
    expect(lrT18).toBeGreaterThan(1);
    expect(lrT18).toBeGreaterThan(lrT21);
  });
  it('entrada inválida ⇒ LR neutra', () => {
    expect(biochemLR(0, 1, 89, P.biochem, 't21')).toBe(1);
  });
});

describe('LR de marcadores', () => {
  it('notAssessed/undefined ⇒ 1; abnormal/normal usam a LR', () => {
    expect(markerLR(undefined, P.markers.nasalBone, 't21')).toBe(1);
    expect(markerLR('notAssessed', P.markers.nasalBone, 't21')).toBe(1);
    expect(markerLR('abnormal', P.markers.nasalBone, 't21')).toBe(P.markers.nasalBone.abnormal.t21);
  });
});

describe('computeTrisomyRisk — combinação', () => {
  const prior = { t21: 1 / 300, t18: 1 / 3000, t13: 1 / 9000 };

  it('sem marcadores/medidas ⇒ posterior = prior', () => {
    const r = computeTrisomyRisk({ priorRisk: prior }, P);
    expect(r.posterior.t21).toBeCloseTo(prior.t21, 10);
    expect(r.oneInN.t21).toBe(300);
  });
  it('TN aumentada eleva o risco de T21 (monotonicidade)', () => {
    const low = computeTrisomyRisk({ priorRisk: prior, ntMm: 1.5, crlMm: 65 }, P);
    const high = computeTrisomyRisk({ priorRisk: prior, ntMm: 3.5, crlMm: 65 }, P);
    expect(high.posterior.t21).toBeGreaterThan(low.posterior.t21);
  });
  it('caso clássico de T21 vira alto risco (1:N pequeno)', () => {
    const r = computeTrisomyRisk({
      priorRisk: prior, ntMm: 3.5, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 2.2, pappaMoM: 0.4, nasalBone: 'abnormal',
    }, P);
    expect(r.oneInN.t21).toBeLessThan(50);
  });
  it('perfil tranquilizador reduz o risco de T21', () => {
    const base = computeTrisomyRisk({ priorRisk: prior }, P).posterior.t21;
    const reassuring = computeTrisomyRisk({
      priorRisk: prior, ntMm: 1.4, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 1.0, pappaMoM: 1.0, nasalBone: 'normal',
    }, P).posterior.t21;
    expect(reassuring).toBeLessThan(base);
  });
});

describe('risco por idade materna', () => {
  it('aumenta com a idade', () => {
    expect(t21TermRisk(25)).toBeLessThan(t21TermRisk(40));
  });
  it('T18 e T13 são frações de T21', () => {
    const r = ageRelatedRisk(35);
    expect(r.t18).toBeLessThan(r.t21);
    expect(r.t13).toBeLessThan(r.t18);
  });
});

describe('trava de segurança', () => {
  it('parâmetros não validados', () => {
    expect(P.validated).toBe(false);
  });
});
