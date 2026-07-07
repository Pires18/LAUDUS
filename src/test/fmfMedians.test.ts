import { describe, it, expect } from 'vitest';
import {
  ntMedianMm, mapMedianMmHg, utaPiMedian, plgfMedian, psvRatioExpected, toMoM, toDelta, MEDIANS_VALIDATED,
  type PeMedianCovariates,
} from '../modules/calculators/fmf/medians';

/** Covariáveis de referência (caucasiana, não-fumante, nulípara, 12+5, 69kg/164cm/35a). */
const ref: PeMedianCovariates = {
  gaDays: 89, weightKg: 69, heightCm: 164, ageYears: 35,
  racialOrigin: 'white', smoker: false, chronicHypertension: false,
  diabetes: 'none', ivf: false, parity: 'nulliparous',
};

describe('medianas de PE (Tan 2018 Appendix S1)', () => {
  it('MAP mediana ~85–90 mmHg na referência', () => {
    const m = mapMedianMmHg(ref)!;
    expect(m).toBeGreaterThan(83);
    expect(m).toBeLessThan(92);
  });
  it('IP uterinas mediana ~1,6–2,0 na referência', () => {
    const m = utaPiMedian(ref)!;
    expect(m).toBeGreaterThan(1.4);
    expect(m).toBeLessThan(2.1);
  });
  it('PlGF Cobas > Kryptor > DELFIA (interceptos)', () => {
    const cobas = plgfMedian(ref, 'cobas')!;
    const kryptor = plgfMedian(ref, 'kryptor')!;
    const delfia = plgfMedian(ref, 'delfia')!;
    expect(cobas).toBeGreaterThan(kryptor);
    expect(kryptor).toBeGreaterThan(delfia);
  });
  it('PlGF Cobas: em 11 sem (gaDays=77) = 10^intercepto; cresce com a IG', () => {
    const at77 = plgfMedian({ ...ref, gaDays: 77 }, 'cobas')!;
    expect(at77).toBeCloseTo(Math.pow(10, 1.542535524), 3);
    expect(plgfMedian(ref, 'cobas')!).toBeGreaterThan(at77); // 12+5 > 11 sem
  });

  it('HAS crônica eleva a mediana de MAP (MoM cai)', () => {
    const base = mapMedianMmHg(ref)!;
    const htn = mapMedianMmHg({ ...ref, chronicHypertension: true })!;
    expect(htn).toBeGreaterThan(base);
  });
  it('afro-caribenha eleva a mediana de PlGF e de IP uterinas', () => {
    expect(plgfMedian({ ...ref, racialOrigin: 'afroCaribbean' }, 'cobas')!).toBeGreaterThan(plgfMedian(ref, 'cobas')!);
    expect(utaPiMedian({ ...ref, racialOrigin: 'afroCaribbean' })!).toBeGreaterThan(utaPiMedian(ref)!);
  });

  it('MoM = medido / mediana; MAP medido = mediana ⇒ 1,0 MoM', () => {
    const m = mapMedianMmHg(ref)!;
    expect(toMoM(m, m)).toBeCloseTo(1.0, 6);
    expect(toMoM(undefined, 1.6)).toBeUndefined();
    expect(toMoM(2, 0)).toBeUndefined();
  });

  it('IG inválida ⇒ null', () => {
    expect(mapMedianMmHg({ ...ref, gaDays: 0 })).toBeNull();
    expect(utaPiMedian({ ...ref, gaDays: -1 })).toBeNull();
    expect(plgfMedian({ ...ref, gaDays: 0 }, 'cobas')).toBeNull();
  });

  it('ntMedianMm cresce com o CCN', () => {
    expect(ntMedianMm(84)!).toBeGreaterThan(ntMedianMm(45)!);
    expect(ntMedianMm(0)).toBeNull();
  });

  it('gate de validação continua falso', () => {
    expect(MEDIANS_VALIDATED).toBe(false);
  });
});

describe('PSV ratio da artéria oftálmica (Gana 2022, Tabela 2)', () => {
  it('fato-ouro: na referência (69kg/35a/164cm/branca/não-fumante/não-HAS/nulípara), esperado = intercepto exato', () => {
    // Todos os termos de covariável são centrados em 0 na referência —
    // "Intercept 0.657922" é declarado explicitamente na Tabela 2.
    expect(psvRatioExpected(ref)).toBeCloseTo(0.657922, 6);
  });
  it('idade acima de 35 eleva o PSV ratio esperado (slope positivo)', () => {
    expect(psvRatioExpected({ ...ref, ageYears: 40 })!).toBeGreaterThan(psvRatioExpected(ref)!);
  });
  it('altura acima de 164cm reduz o PSV ratio esperado (slope negativo)', () => {
    expect(psvRatioExpected({ ...ref, heightCm: 180 })!).toBeLessThan(psvRatioExpected(ref)!);
  });
  it('HAS crônica eleva bastante o PSV ratio esperado', () => {
    const base = psvRatioExpected(ref)!;
    const htn = psvRatioExpected({ ...ref, chronicHypertension: true })!;
    expect(htn - base).toBeCloseTo(0.072817, 6);
  });
  it('parosa sem PE prévia reduz levemente o PSV ratio esperado', () => {
    const base = psvRatioExpected(ref)!;
    const parous = psvRatioExpected({ ...ref, parity: 'parousNoPE' })!;
    expect(base - parous).toBeCloseTo(0.007652, 6);
  });
  it('dados maternos insuficientes ⇒ null', () => {
    expect(psvRatioExpected({ ...ref, weightKg: 0 })).toBeNull();
    expect(psvRatioExpected({ ...ref, heightCm: 0 })).toBeNull();
    expect(psvRatioExpected({ ...ref, ageYears: 0 })).toBeNull();
  });
});

describe('toDelta — escala natural (PSV ratio, não é MoM)', () => {
  it('delta = medido − esperado', () => {
    expect(toDelta(0.75, 0.657922)).toBeCloseTo(0.092078, 6);
    expect(toDelta(0.5, 0.657922)).toBeCloseTo(-0.157922, 6);
  });
  it('medido = esperado ⇒ delta = 0', () => {
    expect(toDelta(0.657922, 0.657922)).toBeCloseTo(0, 10);
  });
  it('entradas inválidas ⇒ undefined', () => {
    expect(toDelta(undefined, 0.6)).toBeUndefined();
    expect(toDelta(0.6, null)).toBeUndefined();
    expect(toDelta(NaN, 0.6)).toBeUndefined();
  });
});
