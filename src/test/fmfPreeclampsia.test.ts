import { describe, it, expect } from 'vitest';
import {
  normalCdf, peRiskBefore, maternalMeanGa, computePreeclampsiaRisk,
  DEFAULT_PE_THRESHOLDS, type PeMaternalFactors, type PeBiomarkers,
} from '../modules/calculators/fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL } from '../modules/calculators/fmf/preeclampsiaData';
import { formatOneInN } from '../modules/calculators/fmf/qc';

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

describe('teto de exibição do risco "1:N" (mesma convenção da calculadora FMF)', () => {
  it('gestante de risco muito baixo tem o denominador travado em ">1:10.000"', () => {
    // Referência sem nenhuma comorbidade e biomarcadores todos protetores.
    const r = risk(reference, { mapMoM: 0.85, utaPiMoM: 0.7, plgfMoM: 2.0 });
    if (r.pretermPE.oneInN > 10000) {
      expect(formatOneInN(r.pretermPE.oneInN)).toBe('>1:10.000');
    }
  });
  it('risco a termo, tipicamente maior que o pré-termo, também respeita o teto', () => {
    expect(formatOneInN(999999)).toBe('>1:10.000');
  });
});

describe('trava de segurança', () => {
  it('coeficientes não validados', () => {
    expect(PROVISIONAL_PE_COEFFICIENTS.validated).toBe(false);
  });
});

describe('risco basal (fatores maternos) — auditoria', () => {
  it('sempre presente no resultado, mesmo sem biomarcadores', () => {
    const r = risk(reference, noBio);
    expect(r.basalPretermPE.oneInN).toBeGreaterThan(0);
    expect(r.basalTermPE.oneInN).toBeGreaterThan(0);
  });
  it('sem biomarcadores, basal = final (risco só de fatores maternos)', () => {
    const r = risk(reference, noBio);
    expect(r.basalPretermPE.oneInN).toBe(r.pretermPE.oneInN);
    expect(r.basalTermPE.oneInN).toBe(r.termPE.oneInN);
    expect(r.biomarkerLikelihoodUnderflow).toBe(false);
  });
  it('com biomarcadores presentes, basal permanece igual ao prior (não muda com a evidência)', () => {
    const noBioResult = risk(reference, noBio);
    const withBio = risk(reference, { mapMoM: 1.3, utaPiMoM: 1.8, plgfMoM: 0.4 });
    expect(withBio.basalPretermPE.oneInN).toBe(noBioResult.pretermPE.oneInN);
    expect(withBio.basalTermPE.oneInN).toBe(noBioResult.termPE.oneInN);
  });
});

describe('rede de segurança — underflow numérico dos biomarcadores', () => {
  it('MoM absurdo (erro de digitação) não gera risco falsamente baixo: cai para o basal', () => {
    // MoM=1e8 é fisiologicamente impossível (janela plausível QC é 0,2–5,0) —
    // simula um valor bruto digitado por engano no campo de MoM.
    const r = risk(reference, { mapMoM: 1e8, utaPiMoM: 1e8, plgfMoM: 1e8 });
    expect(r.biomarkerLikelihoodUnderflow).toBe(true);
    expect(r.pretermPE.oneInN).toBe(r.basalPretermPE.oneInN);
    expect(r.termPE.oneInN).toBe(r.basalTermPE.oneInN);
  });
  it('valores plausíveis normais não disparam a rede de segurança', () => {
    const r = risk(reference, { mapMoM: 1.0, utaPiMoM: 1.0, plgfMoM: 1.0 });
    expect(r.biomarkerLikelihoodUnderflow).toBe(false);
  });
});

describe('PSV ratio da artéria oftálmica (Gana 2022, UOG 59:731) — marcador adicional', () => {
  it('delta muito elevado (padrão de PE precoce) eleva bastante o risco de PE pré-termo', () => {
    // Tabela 3: intercepto do delta em PE = 0.446837 (delta grande e positivo
    // é o padrão de PE, especialmente precoce) — SD 0.09541, então um delta
    // de +0.4 está bem dentro da distribuição afetada e distante da null (0).
    const base = risk(reference, noBio).pretermPE.prob;
    const elevated = risk(reference, { psvRatioDelta: 0.4 }).pretermPE.prob;
    expect(elevated).toBeGreaterThan(base * 3);
  });
  it('delta próximo de zero (padrão não afetado/termo) fica próximo do prior', () => {
    const base = risk(reference, noBio).pretermPE.prob;
    const neutral = risk(reference, { psvRatioDelta: 0 }).pretermPE.prob;
    expect(neutral).toBeLessThan(base * 2);
    expect(neutral).toBeGreaterThan(base / 5);
  });
  it('combinado com MAP/UtA-PI/PlGF anormais, eleva ainda mais o risco', () => {
    const withoutPsv = risk(reference, { mapMoM: 1.3, utaPiMoM: 1.8, plgfMoM: 0.4 }).pretermPE.prob;
    const withPsv = risk(reference, { mapMoM: 1.3, utaPiMoM: 1.8, plgfMoM: 0.4, psvRatioDelta: 0.4 }).pretermPE.prob;
    expect(withPsv).toBeGreaterThan(withoutPsv);
  });
  it('basal não é afetado pela presença do PSV ratio (só entra na verossimilhança)', () => {
    const noBioResult = risk(reference, noBio);
    const withPsv = risk(reference, { psvRatioDelta: 0.4 });
    expect(withPsv.basalPretermPE.oneInN).toBe(noBioResult.pretermPE.oneInN);
  });
  it('delta implausível (erro de digitação) dispara a rede de segurança e cai para o basal', () => {
    const r = risk(reference, { psvRatioDelta: 1e8 });
    expect(r.biomarkerLikelihoodUnderflow).toBe(true);
    expect(r.pretermPE.oneInN).toBe(r.basalPretermPE.oneInN);
  });
  it('coeficientes do PSV ratio presentes no modelo (Gana 2022, Tabela 3)', () => {
    expect(M.reg.psvRatio.intercept).toBeCloseTo(0.446837, 6);
    expect(M.reg.psvRatio.slope).toBeCloseTo(-0.01079, 6);
    expect(M.sd.psvRatio).toBeCloseTo(0.09541, 6);
  });
});
