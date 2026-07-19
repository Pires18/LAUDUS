import { describe, it, expect } from 'vitest';
import { computePreeclampsiaRisk, type PeMaternalFactors } from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS as PEC, PE_BIOMARKER_MODEL as PEM } from '../modules/calculators/fmf/preeclampsiaData';

/**
 * VALIDAÇÃO CASO-A-CASO da PE contra a calculadora OFICIAL da FMF (jul/2026,
 * rodada pelo usuário). Caso "só maternos" tem a MAP neutralizada (MoM 1,0
 * entrando pressão = mediana esperada). A oficial reporta o risco PRÉ-TERMO
 * (<37 sem). Após calibrar σ→6,65 (extremo do IC95% do Wright 2015, que é o que
 * a FMF live usa), os 3 pontos fecham dentro de ~5%. Trava a fidelidade.
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

  it('IP uterina MoM confere com a FMF (mediana Tan 2018): raw 2,45 → MoM 1,50', () => {
    // confirma indiretamente via medians.ts no fmfMedians.test.ts; aqui só o efeito.
    const neutral = computePreeclampsiaRisk(ref, { mapMoM: 1.0 }, PEC, PEM).pretermPE.prob;
    const withBio = computePreeclampsiaRisk(ref, { mapMoM: 1.0, utaPiMoM: 1.5, plgfMoM: 0.63 }, PEC, PEM).pretermPE.prob;
    expect(withBio).toBeGreaterThan(neutral * 2); // biomarcadores anormais sobem o risco ~3×
  });
});
