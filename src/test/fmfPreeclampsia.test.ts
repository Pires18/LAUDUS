import { describe, it, expect } from 'vitest';
import {
  normalCdf, peRiskBefore, maternalMeanGa, applyBiomarkers, computePreeclampsiaRisk,
  DEFAULT_PE_THRESHOLDS, type PeMaternalFactors, type PeBiomarkers,
} from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS } from '../modules/calculators/fmf/preeclampsiaData';

const C = PROVISIONAL_PE_COEFFICIENTS;

/** Gestante do grupo de referência (Wright 2015): branca, nulípara,
 *  espontânea, 69 kg, 164 cm, sem comorbidades ⇒ μ = intercepto. */
const reference: PeMaternalFactors = {
  ageYears: 30, weightKg: 69, heightCm: 164,
  racialOrigin: 'white', conception: 'spontaneous',
  chronicHypertension: false, diabetesType1: false, diabetesType2: false,
  sleOrAps: false, familyHistoryPE: false,
  nulliparous: true, previousPE: false,
};
const noBio: PeBiomarkers = {};

describe('estatística de base', () => {
  it('normalCdf(0) = 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
  it('normalCdf é monotônica e limitada', () => {
    expect(normalCdf(-3)).toBeLessThan(0.01);
    expect(normalCdf(3)).toBeGreaterThan(0.99);
  });
  it('peRiskBefore: μ menor ⇒ maior risco pré-termo', () => {
    expect(peRiskBefore(37, 34, C.sigma)).toBeGreaterThan(peRiskBefore(37, 40, C.sigma));
  });
});

describe('média materna (μ) — coeficientes Wright 2015', () => {
  it('grupo de referência ⇒ μ = intercepto (54.36)', () => {
    expect(maternalMeanGa(reference, C)).toBeCloseTo(54.36, 6);
  });
  it('idade > 35 reduz μ em 0.207/ano', () => {
    const a40 = maternalMeanGa({ ...reference, ageYears: 40 }, C);
    expect(a40).toBeCloseTo(54.36 - 0.207 * 5, 6);
  });
  it('maior altura aumenta μ (protetor)', () => {
    expect(maternalMeanGa({ ...reference, heightCm: 174 }, C)).toBeGreaterThan(54.36);
  });
  it('HAS crônica reduz μ em 7.29', () => {
    expect(maternalMeanGa({ ...reference, chronicHypertension: true }, C)).toBeCloseTo(54.36 - 7.29, 6);
  });
  it('peso e diabetes só contam SEM HAS crônica (interação)', () => {
    const htnObese = maternalMeanGa({ ...reference, chronicHypertension: true, weightKg: 100, diabetesType2: true }, C);
    // Com HAS, peso/diabetes são ignorados ⇒ μ = 54.36 − 7.29
    expect(htnObese).toBeCloseTo(54.36 - 7.29, 6);
  });
  it('PE prévia (parosa) reduz μ mais que a referência nulípara', () => {
    const prev = maternalMeanGa({ ...reference, nulliparous: false, previousPE: true, previousPeGaWeeks: 32 }, C);
    expect(prev).toBeLessThan(maternalMeanGa(reference, C));
  });
});

describe('deslocamento por biomarcadores', () => {
  it('MAP alto reduz μ', () => {
    expect(applyBiomarkers(50, { mapMoM: 1.2 }, C)).toBeLessThan(50);
  });
  it('UtA-PI alto reduz μ', () => {
    expect(applyBiomarkers(50, { utaPiMoM: 1.5 }, C)).toBeLessThan(50);
  });
  it('PlGF BAIXO reduz μ (fator de risco)', () => {
    expect(applyBiomarkers(50, { plgfMoM: 0.4 }, C)).toBeLessThan(50);
  });
  it('PlGF alto (protetor) aumenta μ', () => {
    expect(applyBiomarkers(50, { plgfMoM: 1.6 }, C)).toBeGreaterThan(50);
  });
  it('biomarcadores neutros (MoM = 1) não alteram μ', () => {
    expect(applyBiomarkers(50, { mapMoM: 1, utaPiMoM: 1, plgfMoM: 1 }, C)).toBeCloseTo(50, 6);
  });
});

describe('risco integrado + conduta', () => {
  it('referência: baseline plausível e sem AAS', () => {
    const r = computePreeclampsiaRisk(reference, noBio, C);
    expect(r.aspirinRecommended).toBe(false);
    expect(r.pretermPE.oneInN).toBeGreaterThan(30);
    expect(r.pretermPE.oneInN).toBeLessThan(5000);
  });

  it('perfil de alto risco ⇒ recomenda AAS', () => {
    const highRisk: PeMaternalFactors = {
      ...reference, ageYears: 40, racialOrigin: 'afroCaribbean',
      chronicHypertension: true, nulliparous: false, previousPE: true, previousPeGaWeeks: 30,
    };
    const bio: PeBiomarkers = { mapMoM: 1.15, utaPiMoM: 1.6, plgfMoM: 0.45 };
    const r = computePreeclampsiaRisk(highRisk, bio, C);
    expect(r.aspirinRecommended).toBe(true);
  });

  it('adicionar HAS crônica aumenta o risco pré-termo (monotonicidade)', () => {
    const base = computePreeclampsiaRisk(reference, noBio, C).pretermPE.prob;
    const withHtn = computePreeclampsiaRisk({ ...reference, chronicHypertension: true }, noBio, C).pretermPE.prob;
    expect(withHtn).toBeGreaterThan(base);
  });

  it('risco a termo ≥ risco pré-termo', () => {
    const r = computePreeclampsiaRisk(reference, noBio, C);
    expect(r.termPE.prob).toBeGreaterThanOrEqual(r.pretermPE.prob);
  });

  it('cutoff de AAS configurável', () => {
    const r = computePreeclampsiaRisk(reference, noBio, C, { ...DEFAULT_PE_THRESHOLDS, aspirinCutoffOneInN: 100000 });
    expect(r.aspirinRecommended).toBe(true);
  });
});

describe('trava de segurança clínica', () => {
  it('coeficientes ainda NÃO estão validados', () => {
    expect(PROVISIONAL_PE_COEFFICIENTS.validated).toBe(false);
  });
});
