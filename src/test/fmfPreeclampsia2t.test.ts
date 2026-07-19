import { describe, it, expect } from 'vitest';
import {
  SECOND_TRIMESTER_PE_VALIDATED,
  SECOND_TRIMESTER_PE_GA_MIN_WEEKS,
  SECOND_TRIMESTER_PE_GA_MAX_WEEKS,
  MEDIANS_READY_2T,
  PE_COEFFICIENTS_2T,
  PE_BIOMARKER_MODEL_2T,
  biomarkerModelReady2T,
  mapMedian2T,
  utaPiMedian2T,
  plgfMedian2T,
  psvRatioExpected2T,
  peRisk2tFromForm,
  computePe2tRisk,
  PE_2T_THRESHOLDS,
  type Pe2tFormInput,
} from '../modules/calculators/fmf/preeclampsia2t';
import { PROVISIONAL_PE_COEFFICIENTS } from '../modules/calculators/fmf/preeclampsiaData';
import type { PeMedianCovariates } from '../modules/calculators/fmf/medians';

/**
 * Rastreio de PE de 2º trimestre (Tayyar/Wright A/Tsiakkas 2015 + Gallo 2016).
 * Coeficientes transcritos das fontes; módulo permanece TRAVADO pela validação
 * mestra (`SECOND_TRIMESTER_PE_VALIDATED`) até conferência caso-a-caso vs. a
 * calculadora oficial da FMF — segurança clínica.
 */

// gestante de referência a 21 sem (branca, nulípara, 69 kg, 164 cm, 35 a)
const refCov: PeMedianCovariates = {
  gaDays: 21 * 7, weightKg: 69, heightCm: 164, ageYears: 35,
  racialOrigin: 'white', smoker: false, chronicHypertension: false,
  diabetes: 'none', ivf: false, parity: 'nulliparous',
};

const validInput: Pe2tFormInput = {
  ageYears: 34, weightKg: 70, heightCm: 165, gaWeeks: 21,
  racialOrigin: 'white', conception: 'spontaneous', parity: 'nulliparous',
  diabetes: 'none', chronicHypertension: false, sleOrAps: false,
  familyHistoryPE: false, smoker: false, analyzer: 'cobas',
  mapMmHg: 92, utaPiRaw: 1.1, plgfRaw: 200,
};

describe('PE 2º trimestre (esboço Tayyar/Gallo)', () => {
  it('está TRAVADO até validação (não é a calc oficial)', () => {
    expect(SECOND_TRIMESTER_PE_VALIDATED).toBe(false);
  });

  it('não produz risco enquanto travado — retorna null mesmo com input válido', () => {
    expect(peRisk2tFromForm(validInput)).toBeNull();
  });

  it('define a janela de rastreio de 2ª visita (19–24+6 sem)', () => {
    expect(SECOND_TRIMESTER_PE_GA_MIN_WEEKS).toBe(19);
    expect(SECOND_TRIMESTER_PE_GA_MAX_WEEKS).toBeGreaterThan(24);
    expect(SECOND_TRIMESTER_PE_GA_MAX_WEEKS).toBeLessThan(25);
  });

  it('reusa o PRIOR materno de Wright 2015 (compartilhado entre épocas)', () => {
    expect(PE_COEFFICIENTS_2T.intercept).toBe(PROVISIONAL_PE_COEFFICIENTS.intercept);
    expect(PE_COEFFICIENTS_2T.sigma).toBe(PROVISIONAL_PE_COEFFICIENTS.sigma);
    expect(PE_COEFFICIENTS_2T.validated).toBe(false);
  });

  it('modelo de biomarcadores (Gallo 2016) está PREENCHIDO e verificado', () => {
    expect(biomarkerModelReady2T()).toBe(true);
    for (const k of ['map', 'utaPi', 'plgf'] as const) {
      expect(Number.isFinite(PE_BIOMARKER_MODEL_2T.reg[k].intercept)).toBe(true);
      expect(Number.isFinite(PE_BIOMARKER_MODEL_2T.reg[k].slope)).toBe(true);
      expect(Number.isFinite(PE_BIOMARKER_MODEL_2T.sd[k])).toBe(true);
    }
    // conversão de centragem 24 sem → não centrado: a_unc = a₂₄ − 24·slope
    expect(PE_BIOMARKER_MODEL_2T.reg.utaPi.intercept).toBeCloseTo(0.34798 - 24 * -0.0195256, 6);
    expect(PE_BIOMARKER_MODEL_2T.reg.map.intercept).toBeCloseTo(0.063088 - 24 * -0.002842, 6);
    expect(PE_BIOMARKER_MODEL_2T.reg.plgf.intercept).toBeCloseTo(-1.11759 - 24 * 0.078571, 6);
  });

  it('medianas de 2º T transcritas (Tayyar/Wright A/Tsiakkas)', () => {
    expect(MEDIANS_READY_2T).toBe(true);
  });

  it('medianas dão valores plausíveis p/ a gestante de referência a 21 sem', () => {
    // sanity da regra de combinação (2º T + termos independentes de trimestre)
    const utaPi = utaPiMedian2T(refCov)!;
    const map = mapMedian2T(refCov)!;
    const plgfDelfia = plgfMedian2T({ ...refCov }, 'delfia')!;
    const plgfCobas = plgfMedian2T({ ...refCov }, 'cobas')!;
    expect(utaPi).toBeGreaterThan(0.9);
    expect(utaPi).toBeLessThan(1.2);           // ~1,05
    expect(map).toBeGreaterThan(82);
    expect(map).toBeLessThan(89);              // ~85,5 mmHg
    expect(plgfDelfia).toBeGreaterThan(120);
    expect(plgfDelfia).toBeLessThan(210);      // ~164 pg/mL
    expect(plgfCobas).toBeGreaterThan(plgfDelfia); // Roche/Cobas > DELFIA
    expect(plgfMedian2T(refCov, 'kryptor')).toBeNull(); // não modelado por Tsiakkas
  });

  it('reporta nos limiares de 2ª visita da FMF (<32 e <36 sem)', () => {
    expect(PE_2T_THRESHOLDS.pretermGa).toBe(32);
    expect(PE_2T_THRESHOLDS.termGa).toBe(36);
  });

  it('inclui a artéria oftálmica (Sapantzoglou 2021) no modelo de biomarcadores', () => {
    expect(Number.isFinite(PE_BIOMARKER_MODEL_2T.reg.psvRatio.intercept)).toBe(true);
    expect(Number.isFinite(PE_BIOMARKER_MODEL_2T.sd.psvRatio)).toBe(true);
  });

  it('o delta da oftálmica bate com os laudos OFICIAIS da FMF (validação forte)', () => {
    // razão medida 0,641 nos 3 casos; delta = 0,641 − esperado(Sapantzoglou T2).
    // Laudos oficiais: 0,03 / −0,08 / 0,08.
    const c1 = { gaDays: 21 * 7, weightKg: 69, heightCm: 164, ageYears: 35, racialOrigin: 'white' as const, smoker: false, chronicHypertension: false, diabetes: 'none' as const, ivf: false, parity: 'nulliparous' as const };
    const c2 = { gaDays: 22 * 7, weightKg: 88, heightCm: 160, ageYears: 40, racialOrigin: 'afroCaribbean' as const, smoker: false, chronicHypertension: true, diabetes: 'none' as const, ivf: false, parity: 'parousPE' as const };
    const c3 = { gaDays: 20 * 7, weightKg: 62, heightCm: 168, ageYears: 27, racialOrigin: 'white' as const, smoker: false, chronicHypertension: false, diabetes: 'none' as const, ivf: false, parity: 'nulliparous' as const };
    expect(0.641 - psvRatioExpected2T(c1)!).toBeCloseTo(0.03, 2);
    expect(0.641 - psvRatioExpected2T(c2)!).toBeCloseTo(-0.08, 2);
    expect(0.641 - psvRatioExpected2T(c3)!).toBeCloseTo(0.08, 2);
  });

  it('a CALCULADORA (computePe2tRisk) calcula e estratifica os casos-ouro', () => {
    // referência → BAIXO ; alto risco → ALTO (concordante com a calc oficial FMF)
    const ref = computePe2tRisk({
      ageYears: 35, weightKg: 69, heightCm: 164, gaWeeks: 21,
      racialOrigin: 'white', conception: 'spontaneous', parity: 'nulliparous',
      diabetes: 'none', chronicHypertension: false, sleOrAps: false, familyHistoryPE: false,
      smoker: false, analyzer: 'cobas', mapMmHg: 85.5, utaPiRaw: 1.05, plgfRaw: 251.8, oaRatio: 0.641,
    });
    expect(ref).not.toBeNull();
    expect(ref!.risk.termPE.oneInN).toBeGreaterThan(1000); // < 36 sem: BAIXO

    const alto = computePe2tRisk({
      ageYears: 40, weightKg: 88, heightCm: 160, gaWeeks: 22,
      racialOrigin: 'afroCaribbean', conception: 'spontaneous', parity: 'parousPE', previousPeGaWeeks: 30,
      diabetes: 'none', chronicHypertension: true, sleOrAps: false, familyHistoryPE: true,
      smoker: false, analyzer: 'cobas', mapMmHg: 102, utaPiRaw: 1.70, plgfRaw: 90, oaRatio: 0.641,
    });
    expect(alto).not.toBeNull();
    expect(alto!.risk.termPE.oneInN).toBeLessThanOrEqual(100); // < 36 sem: ALTO
    expect(alto!.psvRatioDelta).toBeDefined();
  });

  it('a CALCULADORA respeita a janela (null fora de 19–24+6)', () => {
    const foraJanela = computePe2tRisk({
      ageYears: 30, weightKg: 65, heightCm: 165, gaWeeks: 30,
      racialOrigin: 'white', conception: 'spontaneous', parity: 'nulliparous',
      diabetes: 'none', chronicHypertension: false, sleOrAps: false, familyHistoryPE: false,
      smoker: false, analyzer: 'cobas', mapMmHg: 90,
    });
    expect(foraJanela).toBeNull();
  });
});
