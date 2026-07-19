import { describe, it, expect } from 'vitest';
import {
  ntCalibratedLR, computeTrisomyRisk, REASSURANCE_FLOOR_DIVISOR,
} from '../modules/calculators/fmf/trisomy';
import { PROVISIONAL_TRISOMY_PARAMS as P, ageRelatedRisk } from '../modules/calculators/fmf/trisomyData';

/**
 * CALIBRAÇÃO DA LR DA TN À FMF AO VIVO — sweep limpo (usuário, 19/jul/2026):
 * 35a, CCN 65, só a TN variando; oficial reportou (T21 base 1:230):
 *   TN 1,5→1:4600  2,0→1:4600  2,5→1:3400  3,0→1:660  3,5→1:250  4,0→1:192
 * A razão entre TNs (que cancela fatores constantes) define a FORMA da LR da
 * TN da FMF. Este teste trava que a nossa LR empírica (delta-TN) reproduz essa
 * forma, e que o PISO DE TRANQUILIZAÇÃO ÷20 está ativo.
 */
describe('LR da TN calibrada à FMF (delta-TN, CCN 65)', () => {
  const lr = (nt: number, t: 't21' | 't18' | 't13' = 't21') =>
    ntCalibratedLR(nt, 65, P.nt, P.ntDeltaLr, t);

  it('reproduz a FORMA relativa da FMF (÷ TN 2,0) para T21', () => {
    const base = lr(2.0);
    const rel = (nt: number) => lr(nt) / base;
    // alvos FMF: 2,5→1,353 · 3,0→6,979 · 3,5→18,47 · 4,0→24,08
    expect(rel(2.5)).toBeCloseTo(1.353, 1);
    expect(rel(3.0)).toBeGreaterThan(6.3);
    expect(rel(3.0)).toBeLessThan(7.7);
    expect(rel(3.5)).toBeGreaterThan(16.5);
    expect(rel(3.5)).toBeLessThan(20.5);
    expect(rel(4.0)).toBeGreaterThan(21);
    expect(rel(4.0)).toBeLessThan(27);
  });

  it('é MUITO menos íngreme que a mistura Wright 2008 (que dava LR≈30 na TN 3,5)', () => {
    expect(lr(3.5)).toBeLessThan(8);   // empírica ~5,5 (mistura dava ~30)
    expect(lr(3.5)).toBeGreaterThan(4);
  });

  it('monotônica crescente e platô abaixo da mediana', () => {
    expect(lr(3.5)).toBeGreaterThan(lr(3.0));
    expect(lr(3.0)).toBeGreaterThan(lr(2.5));
    expect(lr(1.0)).toBeCloseTo(lr(1.5), 1); // platô (não despenca em TN baixa)
  });

  it('delta-TN: mesmo delta em CCN diferente dá LR igual (independência do CCN)', () => {
    // CCN 55 tem mediana ~1,49mm; TN 2,21 → delta ~0,72 = TN 2,5 no CCN 65.
    const medianAt55 = 1.492, medianAt65 = 1.780;
    const ntAt55 = medianAt55 + 0.72;
    const ntAt65 = medianAt65 + 0.72;
    expect(ntCalibratedLR(ntAt55, 55, P.nt, P.ntDeltaLr, 't21'))
      .toBeCloseTo(ntCalibratedLR(ntAt65, 65, P.nt, P.ntDeltaLr, 't21'), 2);
  });

  it('extrapolação travada em maxLR para TN extrema', () => {
    expect(lr(8.0)).toBeLessThanOrEqual(P.ntDeltaLr.maxLR);
  });
});

describe('piso de tranquilização ÷20 (FMF)', () => {
  it('perfil muito favorável não reduz o risco abaixo de prior/20', () => {
    const prior = ageRelatedRisk(35); // T21 1:230
    const r = computeTrisomyRisk({
      priorRisk: prior, ntMm: 1.5, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 1.0, pappaMoM: 1.0,
      nasalBone: 'normal', ductusVenosus: 'normal', tricuspid: 'normal',
    }, P);
    // 1:230 → piso 1:4600 (÷20). Não pode passar disso.
    const floorN = Math.round(1 / (prior.t21 / REASSURANCE_FLOOR_DIVISOR));
    expect(r.oneInN.t21).toBeLessThanOrEqual(floorN + 1);
    expect(r.reassuranceFloored.t21).toBe(true);
  });

  it('perfil de alto risco NÃO é limitado pelo piso', () => {
    const prior = ageRelatedRisk(38);
    const r = computeTrisomyRisk({
      priorRisk: prior, ntMm: 3.5, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 2.5, pappaMoM: 0.4, nasalBone: 'abnormal',
    }, P);
    expect(r.reassuranceFloored.t21).toBe(false);
    expect(r.oneInN.t21).toBeLessThan(100); // segue rastreio-positivo
  });

  it('sem evidência, o piso não altera nada (posterior = prior)', () => {
    const prior = ageRelatedRisk(30);
    const r = computeTrisomyRisk({ priorRisk: prior }, P);
    expect(r.reassuranceFloored.t21).toBe(false);
    expect(r.posterior.t21).toBeCloseTo(prior.t21, 10);
  });
});
