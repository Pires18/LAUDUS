import { describe, it, expect } from 'vitest';
import {
  normalCdf, peRiskBefore, maternalMeanGa, computePreeclampsiaRisk,
  DEFAULT_PE_THRESHOLDS, type PeMaternalFactors, type PeBiomarkers,
} from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL } from '../modules/calculators/fmf/preeclampsiaData';

const C = PROVISIONAL_PE_COEFFICIENTS;
const M = PE_BIOMARKER_MODEL;

const reference: PeMaternalFactors = {
  ageYears: 30, weightKg: 69, heightCm: 164,
  racialOrigin: 'white', conception: 'spontaneous',
  chronicHypertension: false, diabetesType1: false, diabetesType2: false,
  sleOrAps: false, familyHistoryPE: false,
  nulliparous: true, previousPE: false,
};
const noBio: PeBiomarkers = {};
const risk = (f: PeMaternalFactors, b: PeBiomarkers) => computePreeclampsiaRisk(f, b, C, M);

describe('estatística de base', () => {
  it('normalCdf(0) = 0.5; monotônica', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(-3)).toBeLessThan(0.01);
    expect(normalCdf(3)).toBeGreaterThan(0.99);
  });
  it('peRiskBefore: μ menor ⇒ maior risco pré-termo', () => {
    expect(peRiskBefore(37, 34, C.sigma)).toBeGreaterThan(peRiskBefore(37, 40, C.sigma));
  });
});

describe('média materna (μ) — Wright 2015', () => {
  it('referência ⇒ μ = intercepto', () => {
    expect(maternalMeanGa(reference, C)).toBeCloseTo(54.36, 6);
  });
  it('HAS crônica reduz μ; peso/diabetes só sem HAS', () => {
    expect(maternalMeanGa({ ...reference, chronicHypertension: true }, C)).toBeCloseTo(54.36 - 7.29, 6);
    const htnObese = maternalMeanGa({ ...reference, chronicHypertension: true, weightKg: 100, diabetesType2: true }, C);
    expect(htnObese).toBeCloseTo(54.36 - 7.29, 6);
  });
});

describe('risco integrado (Bayes) — sem biomarcadores = prior', () => {
  it('referência: baseline plausível, sem AAS', () => {
    const r = risk(reference, noBio);
    expect(r.aspirinRecommended).toBe(false);
    expect(r.pretermPE.oneInN).toBeGreaterThan(30);
    expect(r.pretermPE.oneInN).toBeLessThan(5000);
  });
  it('sem biomarcadores ⇒ risco = CDF do prior', () => {
    const r = risk(reference, noBio);
    expect(r.pretermPE.prob).toBeCloseTo(peRiskBefore(37, 54.36, C.sigma), 6);
  });
  it('risco a termo ≥ risco pré-termo', () => {
    const r = risk(reference, noBio);
    expect(r.termPE.prob).toBeGreaterThanOrEqual(r.pretermPE.prob);
  });
});

describe('risco integrado (Bayes) — com biomarcadores', () => {
  it('biomarcadores normais (MoM=1) ficam próximos do prior', () => {
    const base = risk(reference, noBio).pretermPE.prob;
    const withNormal = risk(reference, { mapMoM: 1, utaPiMoM: 1, plgfMoM: 1 }).pretermPE.prob;
    // MoM 1 (log10=0) é levemente tranquilizador; deve ficar na mesma ordem de grandeza
    expect(withNormal).toBeLessThan(base * 3);
    expect(withNormal).toBeGreaterThan(base / 10);
  });
  it('MAP e UtA-PI altos + PlGF baixo elevam muito o risco', () => {
    const base = risk(reference, noBio).pretermPE.prob;
    const abnormal = risk(reference, { mapMoM: 1.3, utaPiMoM: 1.8, plgfMoM: 0.4 }).pretermPE.prob;
    expect(abnormal).toBeGreaterThan(base * 5);
  });
  it('PlGF alto (protetor) reduz o risco', () => {
    const base = risk(reference, { plgfMoM: 1.0 }).pretermPE.prob;
    const high = risk(reference, { plgfMoM: 2.0 }).pretermPE.prob;
    expect(high).toBeLessThan(base);
  });
  it('perfil de alto risco ⇒ recomenda AAS', () => {
    const highRisk: PeMaternalFactors = {
      ...reference, ageYears: 40, racialOrigin: 'afroCaribbean',
      chronicHypertension: true, nulliparous: false, previousPE: true, previousPeGaWeeks: 30,
    };
    const r = risk(highRisk, { mapMoM: 1.25, utaPiMoM: 1.8, plgfMoM: 0.4 });
    expect(r.aspirinRecommended).toBe(true);
  });
});

describe('conduta', () => {
  it('cutoff de AAS configurável', () => {
    const r = computePreeclampsiaRisk(reference, noBio, C, M, { ...DEFAULT_PE_THRESHOLDS, aspirinCutoffOneInN: 100000 });
    expect(r.aspirinRecommended).toBe(true);
  });
});

describe('trava de segurança', () => {
  it('coeficientes não validados', () => {
    expect(PROVISIONAL_PE_COEFFICIENTS.validated).toBe(false);
  });
});
