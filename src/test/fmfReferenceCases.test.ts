import { describe, it, expect } from 'vitest';
import { computeTrisomyRisk } from '../modules/calculators/fmf/trisomy';
import { ageRelatedRisk, t21TermRisk, PROVISIONAL_TRISOMY_PARAMS as P } from '../modules/calculators/fmf/trisomyData';
import { computePreeclampsiaRisk, type PeMaternalFactors, type PeBiomarkers } from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS as PEC, PE_BIOMARKER_MODEL as PEM } from '../modules/calculators/fmf/preeclampsiaData';

/**
 * VALIDAÇÃO COMPORTAMENTAL PONTA-A-PONTA — casos de referência.
 *
 * A auditoria interna confirmou que os motores reproduzem FIELMENTE os modelos
 * publicados (Wright 2008, Kagan 2008, Wright 2015, O'Gorman 2016) — sem bugs.
 * Estes testes fecham parte da lacuna de "validação de saída" ancorando o risco
 * COMPOSTO final em fatos documentados: incidência populacional e limiares de
 * rastreio (screen-positive). NÃO são as saídas exatas da calculadora OFICIAL da
 * FMF (não acessível), portanto usam faixas documentadas, não igualdades. O flag
 * `validated` permanece FALSE até haver casos exatos da calculadora oficial.
 */

describe('Trissomia — casos de referência (comportamento de rastreio documentado)', () => {
  it('risco a termo por idade (Snijders 1999): 35 anos ≈ 1:250–1:500', () => {
    // Valor clássico publicado para T21 a termo aos 35 anos ≈ 1:356.
    const oneInN = 1 / t21TermRisk(35);
    expect(oneInN).toBeGreaterThan(250);
    expect(oneInN).toBeLessThan(500);
  });

  it('gestante jovem (25a) com marcadores tranquilizadores permanece rastreio-negativa (T21 > 1:1000)', () => {
    const r = computeTrisomyRisk({
      priorRisk: ageRelatedRisk(25),
      ntMm: 1.4, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 1.0, pappaMoM: 1.0,
      nasalBone: 'normal', ductusVenosus: 'normal', tricuspid: 'normal',
    }, P);
    expect(r.oneInN.t21).toBeGreaterThan(1000);
  });

  it('gestante 38a com perfil clássico de T21 (TN 3,5; β-hCG 2,5; PAPP-A 0,4; ON ausente) fica rastreio-positiva (T21 < 1:100) e acima do prior', () => {
    const prior = ageRelatedRisk(38);
    const r = computeTrisomyRisk({
      priorRisk: prior,
      ntMm: 3.5, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 2.5, pappaMoM: 0.4, nasalBone: 'abnormal',
    }, P);
    expect(r.oneInN.t21).toBeLessThan(100);            // screen-positive (corte 1:100)
    expect(r.oneInN.t21).toBeLessThan(1 / prior.t21);  // risco sobe vs. o basal por idade
  });

  it('sem marcadores, o posterior = prior por idade (composição sem viés)', () => {
    const prior = ageRelatedRisk(32);
    const r = computeTrisomyRisk({ priorRisk: prior }, P);
    expect(r.posterior.t21).toBeCloseTo(prior.t21, 12);
  });

  it('monotonicidade por idade: 40a tem risco basal maior que 25a', () => {
    expect(ageRelatedRisk(40).t21).toBeGreaterThan(ageRelatedRisk(25).t21);
  });
});

describe('Pré-eclâmpsia — casos de referência (incidência populacional documentada)', () => {
  const reference: PeMaternalFactors = {
    ageYears: 30, weightKg: 69, heightCm: 164,
    racialOrigin: 'white', conception: 'spontaneous',
    chronicHypertension: false, diabetesType1: false, diabetesType2: false,
    sleOrAps: false, familyHistoryPE: false, nulliparous: true, previousPE: false,
  };
  const risk = (f: PeMaternalFactors, b: PeBiomarkers = {}) => computePreeclampsiaRisk(f, b, PEC, PEM);

  it('perfil de referência: PE pré-termo na faixa de incidência populacional (~0,3–1,3%)', () => {
    const r = risk(reference);
    expect(r.pretermPE.oneInN).toBeGreaterThan(75);   // < ~1,3%
    expect(r.pretermPE.oneInN).toBeLessThan(350);     // > ~0,3%
  });

  it('perfil de referência: PE a termo mais comum que a pré-termo (~1,5–7%)', () => {
    const r = risk(reference);
    expect(r.termPE.oneInN).toBeLessThan(r.pretermPE.oneInN); // termo é mais frequente
    expect(r.termPE.oneInN).toBeGreaterThan(14);
    expect(r.termPE.oneInN).toBeLessThan(70);
  });

  it('perfil tipo ASPRE de alto risco fica rastreio-positivo e recomenda AAS', () => {
    const highRisk: PeMaternalFactors = {
      ...reference, ageYears: 41, weightKg: 92, racialOrigin: 'afroCaribbean',
      chronicHypertension: true, nulliparous: false, previousPE: true, previousPeGaWeeks: 31,
    };
    const r = risk(highRisk, { mapMoM: 1.3, utaPiMoM: 1.9, plgfMoM: 0.35 });
    expect(r.pretermPE.oneInN).toBeLessThan(100);  // corte ASPRE 1:100
    expect(r.aspirinRecommended).toBe(true);
  });
});

describe('gate de uso clínico permanece fechado (validação de saída pendente)', () => {
  it('parâmetros de trissomia e PE seguem NÃO validados até casos oficiais da FMF', () => {
    expect(P.validated).toBe(false);
    expect(PEC.validated).toBe(false);
  });
});
