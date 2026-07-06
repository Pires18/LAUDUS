import { describe, it, expect } from 'vitest';
import {
  probToOdds, oddsToProb, probToOneInN, oneInNToProb,
  ntMixtureLR, biochemLR, markerLR, computeTrisomyRisk, ntExpectedMedianMm,
} from '../modules/calculators/fmf/trisomy';
import {
  t21TermRisk, ageRelatedRisk, GA_PRIOR_CORRECTION_FACTOR, PROVISIONAL_TRISOMY_PARAMS as P,
} from '../modules/calculators/fmf/trisomyData';
import { formatOneInN, MAX_DISPLAYED_ONE_IN_N } from '../modules/calculators/fmf/qc';

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
  it('correção de IG (basal) é sempre MAIOR que o risco ao termo', () => {
    for (const age of [20, 25, 30, 35, 40, 45]) {
      expect(ageRelatedRisk(age).t21).toBeGreaterThan(t21TermRisk(age));
    }
  });
  it('fator de correção de IG ≈ 1,4 (Nicolaides 2011, citando Snijders 1999)', () => {
    expect(GA_PRIOR_CORRECTION_FACTOR).toBeGreaterThan(1.3);
    expect(GA_PRIOR_CORRECTION_FACTOR).toBeLessThan(1.5);
  });
});

describe('fato-ouro publicado — correção de IG (Nicolaides 2011)', () => {
  // "the estimated risks for fetal trisomy 21 for a woman aged 20 years at
  //  12 weeks of gestation are about 1 in 1000, and the risks of such a
  //  woman delivering an affected baby at term are 1 in 1500."
  it('20 anos: risco ao termo ≈ 1:1500 (nossa tabela)', () => {
    expect(probToOneInN(t21TermRisk(20))).toBeGreaterThan(1300);
    expect(probToOneInN(t21TermRisk(20))).toBeLessThan(1700);
  });
  it('20 anos: risco basal corrigido (~12 sem) ≈ 1:1000', () => {
    const oneInN = probToOneInN(ageRelatedRisk(20).t21);
    expect(oneInN).toBeGreaterThan(750);
    expect(oneInN).toBeLessThan(1300);
  });
});

describe('detalhamento por fator (basal → corrigido)', () => {
  const prior = { t21: 1 / 300, t18: 1 / 3000, t13: 1 / 9000 };

  it('priorOneInN reflete o risco a priori (antes de qualquer evidência)', () => {
    const r = computeTrisomyRisk({ priorRisk: prior }, P);
    expect(r.priorOneInN.t21).toBe(300);
  });
  it('sem nenhuma evidência avaliada, factors fica vazio', () => {
    const r = computeTrisomyRisk({ priorRisk: prior }, P);
    expect(Object.keys(r.factors.t21).length).toBe(0);
  });
  it('cada evidência avaliada aparece no detalhamento com sua LR individual', () => {
    const r = computeTrisomyRisk({
      priorRisk: prior, ntMm: 3.4, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 2.0, pappaMoM: 0.5, nasalBone: 'abnormal',
      ductusVenosus: 'notAssessed', tricuspid: 'normal',
    }, P);
    expect(r.factors.t21.nt).toBeDefined();
    expect(r.factors.t21.biochem).toBeDefined();
    expect(r.factors.t21.nasalBone).toBeDefined();
    expect(r.factors.t21.ductusVenosus).toBeUndefined(); // não avaliado
    expect(r.factors.t21.tricuspid).toBeDefined();
  });
  it('produto das LRs individuais reproduz a LR combinada', () => {
    const r = computeTrisomyRisk({
      priorRisk: prior, ntMm: 3.4, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 2.0, pappaMoM: 0.5, nasalBone: 'abnormal',
    }, P);
    const product = Object.values(r.factors.t21).reduce((a, b) => a * (b ?? 1), 1);
    expect(product).toBeCloseTo(r.lr.t21, 8);
  });
});

describe('teto de exibição do risco "1:N" (mesma convenção da calculadora FMF)', () => {
  it('risco muito baixo (N > teto) é exibido travado em ">1:10.000"', () => {
    expect(formatOneInN(2847392)).toBe('>1:10.000');
    expect(formatOneInN(50000)).toBe('>1:10.000');
    expect(formatOneInN(Infinity)).toBe('—'); // Infinity não é finito ⇒ traço, não trava
  });
  it('risco abaixo do teto é exibido normalmente, com separador de milhar', () => {
    expect(formatOneInN(31)).toBe('1:31');
    expect(formatOneInN(1234)).toBe('1:1.234');
    expect(formatOneInN(9999)).toBe('1:9.999');
  });
  it('exatamente no teto trava (convenção: ≥ teto vira ">1:teto")', () => {
    expect(formatOneInN(MAX_DISPLAYED_ONE_IN_N)).toBe('>1:10.000');
  });
  it('valores inválidos (0, negativo, NaN) viram "—"', () => {
    expect(formatOneInN(0)).toBe('—');
    expect(formatOneInN(-5)).toBe('—');
    expect(formatOneInN(NaN)).toBe('—');
  });
  it('a banda de risco (clínica) continua usando o valor BRUTO, não o travado', () => {
    // Uma paciente jovem e tranquilizadora pode ter risco real de 1:50.000+,
    // mas isso não deve quebrar a classificação de "baixo risco" internamente.
    const veryLow = computeTrisomyRisk({
      priorRisk: { t21: 1 / 50000, t18: 1 / 500000, t13: 1 / 1500000 },
    }, P);
    expect(veryLow.oneInN.t21).toBeGreaterThan(MAX_DISPLAYED_ONE_IN_N);
    expect(formatOneInN(veryLow.oneInN.t21)).toBe('>1:10.000');
  });
});

describe('trava de segurança', () => {
  it('parâmetros não validados', () => {
    expect(P.validated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VALIDAÇÃO POR "FATOS-OURO" PUBLICADOS — sem depender de calculadora externa.
// Cada valor abaixo é um número declarado EXPLICITAMENTE no texto/abstract
// dos papers-fonte (não um caso individual, mas um resumo estatístico da
// população estudada). Se os parâmetros foram transcritos corretamente, o
// modelo deve reproduzi-los a partir dos coeficientes de tabela armazenados.
// ═══════════════════════════════════════════════════════════════════════
describe('fatos-ouro publicados — mediana da TN (Wright 2008, UOG 31:376)', () => {
  // "the median NT was different, being 2.0 mm for the unaffected group and
  //  3.4, 5.5, 4.0 mm for trisomies 21, 18, 13, respectively" (abstract).
  // Esses são os componentes CRL-independentes (µ) da mistura, em mm.
  it('euploide: componente CRL-independente ≈ 2,0 mm', () => {
    expect(Math.pow(10, P.nt.normalIndep.mu)).toBeCloseTo(2.0, 1);
  });
  it('T21: componente CRL-independente ≈ 3,4 mm', () => {
    expect(Math.pow(10, P.nt.affectedIndep.t21.mu)).toBeCloseTo(3.4, 1);
  });
  it('T18: componente CRL-independente ≈ 5,5 mm', () => {
    expect(Math.pow(10, P.nt.affectedIndep.t18.mu)).toBeCloseTo(5.5, 1);
  });
  it('T13: componente CRL-independente ≈ 4,0 mm', () => {
    expect(Math.pow(10, P.nt.affectedIndep.t13.mu)).toBeCloseTo(4.0, 1);
  });
});

describe('fatos-ouro publicados — medianas de MoM da bioquímica (Kagan 2008)', () => {
  // uog.5331: "In trisomy 21 pregnancies the median free β-hCG was 2.0 MoM
  //  and PAPP-A was 0.5 MoM" — medido na IG média do estudo (12+5 sem = dia 89,
  //  consistente com "median gestational age at screening was 12+5" do uog.5332).
  const gestDaysStudyMedian = 89;
  it('T21: mediana de β-hCG no dia 89 ≈ 2,0 MoM (±15%)', () => {
    const t21 = P.biochem.affected.t21;
    const mean = t21.bhcgMeanIntercept + t21.bhcgMeanSlope * (gestDaysStudyMedian - 77);
    const mom = Math.pow(10, mean);
    expect(mom).toBeGreaterThan(2.0 * 0.85);
    expect(mom).toBeLessThan(2.0 * 1.15);
  });
  it('T21: mediana de PAPP-A no dia 89 ≈ 0,5 MoM (±25%)', () => {
    const t21 = P.biochem.affected.t21;
    const mean = t21.pappaMeanIntercept + t21.pappaMeanSlope * (gestDaysStudyMedian - 77);
    const mom = Math.pow(10, mean);
    expect(mom).toBeGreaterThan(0.5 * 0.75);
    expect(mom).toBeLessThan(0.5 * 1.25);
  });
  // uog.6123: "the trisomy 18 pregnancies the median free β-hCG was 0.2 MoM
  //  and the median PAPP-A was 0.2 MoM" — sem dependência de IG (slope=0).
  it('T18: mediana de β-hCG ≈ 0,2 MoM (±15%)', () => {
    expect(Math.pow(10, P.biochem.affected.t18.bhcgMeanIntercept)).toBeCloseTo(0.2, 1);
  });
  it('T18: mediana de PAPP-A ≈ 0,2 MoM (±15%)', () => {
    expect(Math.pow(10, P.biochem.affected.t18.pappaMeanIntercept)).toBeCloseTo(0.2, 1);
  });
});
