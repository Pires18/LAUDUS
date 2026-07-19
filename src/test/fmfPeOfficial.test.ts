import { describe, it, expect } from 'vitest';
import { computePreeclampsiaRisk, type PeMaternalFactors } from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS as PEC, PE_BIOMARKER_MODEL as PEM } from '../modules/calculators/fmf/preeclampsiaData';

/**
 * VALIDAÇÃO CASO-A-CASO da PE contra a calculadora OFICIAL da FMF (jul/2026,
 * rodada pelo usuário). Caso "só maternos" tem a MAP neutralizada (MoM 1,0
 * entrando pressão = mediana esperada). A oficial reporta o risco PRÉ-TERMO
 * (<37 sem).
 *
 * RE-AUDITORIA (19/jul/2026): corrigido o bug de truncagem da integração
 * (T_MAX 60→100 em preeclampsia.ts — a cauda da prior era descartada) e
 * RESTAURADO o σ PUBLICADO do Wright 2015 (6,8833), removendo o remendo
 * σ→6,65. Com o motor correto, os 3 pontos fecham dentro de ~4% usando só
 * coeficientes publicados (sem calibração): 258/24/87 vs 270/24/90. Trava a
 * fidelidade E a ausência de coeficientes ajustados à mão.
 */
const ref: PeMaternalFactors = { ageYears: 30, weightKg: 65, heightCm: 165, racialOrigin: 'white', conception: 'spontaneous', chronicHypertension: false, diabetesType1: false, diabetesType2: false, sleOrAps: false, familyHistoryPE: false, nulliparous: true, previousPE: false };
const highRisk: PeMaternalFactors = { ...ref, ageYears: 42, weightKg: 95, heightCm: 158, racialOrigin: 'afroCaribbean' };
const within = (got: number, target: number, tol = 0.1) => {
  expect(got / target).toBeGreaterThan(1 - tol);
  expect(got / target).toBeLessThan(1 + tol);
};

describe('PE — casos oficiais da FMF (pré-termo <37 sem)', () => {
  it('PE-1 referência (MAP MoM 1,0) ≈ oficial 1:270 (±10%)', () => {
    const r = computePreeclampsiaRisk(ref, { mapMoM: 1.0 }, PEC, PEM);
    within(r.pretermPE.oneInN, 270);
    expect(r.aspirinRecommended).toBe(false);
  });

  it('PE-2 alto risco maternal (MAP MoM 1,0) ≈ oficial 1:24 (±12%)', () => {
    const r = computePreeclampsiaRisk(highRisk, { mapMoM: 1.0 }, PEC, PEM);
    within(r.pretermPE.oneInN, 24, 0.12);
    expect(r.aspirinRecommended).toBe(true);
  });

  it('PE-B referência + biomarcadores (MAP1,0 · UtA-PI 1,50 · PlGF 0,63) ≈ oficial 1:90 (±10%)', () => {
    const r = computePreeclampsiaRisk(ref, { mapMoM: 1.0, utaPiMoM: 1.5, plgfMoM: 0.63 }, PEC, PEM);
    within(r.pretermPE.oneInN, 90);
    expect(r.aspirinRecommended).toBe(true);
  });

  it('REGRESSÃO anti-truncagem: referência fecha ~1:258 (não ~1:333 do bug T_MAX=60)', () => {
    // Trava a correção da re-auditoria de 19/jul: a integração deve capturar a
    // cauda COMPLETA da prior. Se alguém reintroduzir T_MAX=60 (ou reduzir a
    // faixa de integração), o denominador perde massa e o risco de baixo risco
    // volta a inflar para ~1:333 — este teste falha antes de chegar em produção.
    const r = computePreeclampsiaRisk(ref, { mapMoM: 1.0 }, PEC, PEM);
    expect(r.pretermPE.oneInN).toBeGreaterThan(240);
    expect(r.pretermPE.oneInN).toBeLessThan(285);
  });

  it('σ é o PUBLICADO do Wright 2015 (6,8833) — sem remendo de calibração', () => {
    expect(PEC.sigma).toBeCloseTo(6.8833, 4);
  });

  it('IP uterina MoM confere com a FMF (mediana Tan 2018): raw 2,45 → MoM 1,50', () => {
    // confirma indiretamente via medians.ts no fmfMedians.test.ts; aqui só o efeito.
    const neutral = computePreeclampsiaRisk(ref, { mapMoM: 1.0 }, PEC, PEM).pretermPE.prob;
    const withBio = computePreeclampsiaRisk(ref, { mapMoM: 1.0, utaPiMoM: 1.5, plgfMoM: 0.63 }, PEC, PEM).pretermPE.prob;
    expect(withBio).toBeGreaterThan(neutral * 2); // biomarcadores anormais sobem o risco ~3×
  });
});
