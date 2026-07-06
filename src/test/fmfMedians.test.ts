import { describe, it, expect } from 'vitest';
import {
  ntMedianMm, mapMedianMmHg, utaPiMedian, plgfMedian, toMoM, MEDIANS_VALIDATED,
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
