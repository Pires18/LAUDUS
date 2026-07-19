import { describe, it, expect } from 'vitest';
import { fhrExpectedBpm, fhrLR, computeTrisomyRisk } from '../modules/calculators/fmf/trisomy';
import { ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS as P } from '../modules/calculators/fmf/trisomyData';

/**
 * FHR (frequência cardíaca fetal) — Kagan KO, Wright D, Valencia C, Maiz N,
 * Nicolaides KH. Hum Reprod 2008;23(9):1968-1975 (Tabela IV).
 * delta = FHR medido − esperado(IG); Gaussiana euploide vs afetada por trissomia.
 *
 * Validado contra a calculadora OFICIAL da FMF (rodada pelo usuário, jul/2026):
 * caso 40a, CRL65 (89d), TN2.0, MoM1/1, variando SÓ a FHR:
 *   FHR 130 → T21 1:1300, T13/18 1:2400
 *   FHR 175 → T21 1:780,  T13/18 1:1000
 *   FHR 190 → T21 1:470,  T13/18 1:400
 * As RAZÕES da LR de FHR batem dentro de ~10% (o offset absoluto residual da
 * T21 é da LR de TN/bioquímica, não da FHR). A taquicardia da T13 (FHR 190)
 * bate quase exato no combinado (1:378 vs 1:400).
 */
const F = P.fhr;

describe('FHR — modelo (Kagan 2008, Tabela IV)', () => {
  it('coeficientes exatos da Tabela IV', () => {
    expect(F.normal.sd).toBe(5.8727);
    expect(F.affected.t21).toMatchObject({ meanIntercept: 1.3836, sd: 7.2323 });
    expect(F.affected.t18).toMatchObject({ meanIntercept: -2.8089, sd: 8.2202 });
    expect(F.affected.t13).toMatchObject({ meanIntercept: 52.43, meanSlope: -0.40476, sd: 8.1444 });
    expect(F.expected).toMatchObject({ a: 265.98, b: -1.7631, c: 0.0064445 });
  });

  it('FHR esperada ~160 bpm às 12+5 (89 dias)', () => {
    expect(fhrExpectedBpm(89, F)).toBeCloseTo(160.1, 0);
  });

  it('FHR normal (≈esperada) é tranquilizadora p/ T13 (taquicardia) e ~neutra p/ T21', () => {
    const lrT13 = fhrLR(160, 89, F, 't13');
    const lrT21 = fhrLR(160, 89, F, 't21');
    expect(lrT13).toBeLessThan(0.2);            // FHR normal argumenta contra T13
    expect(lrT21).toBeGreaterThan(0.6);
    expect(lrT21).toBeLessThan(1.05);
  });

  it('TAQUICARDIA (FHR alta) sobe fortemente a LR da T13; BRADICARDIA a derruba', () => {
    expect(fhrLR(190, 89, F, 't13')).toBeGreaterThan(fhrLR(160, 89, F, 't13'));
    expect(fhrLR(160, 89, F, 't13')).toBeGreaterThan(fhrLR(130, 89, F, 't13'));
    expect(fhrLR(190, 89, F, 't13')).toBeGreaterThan(50);   // taquicardia franca → T13
    expect(fhrLR(130, 89, F, 't13')).toBeLessThan(0.1);     // bradicardia → contra T13
  });

  it('razões da LR de FHR da T21 batem com a oficial (±15%)', () => {
    const r130 = fhrLR(130, 89, F, 't21');
    const r175 = fhrLR(175, 89, F, 't21');
    const r190 = fhrLR(190, 89, F, 't21');
    expect(r175 / r130).toBeGreaterThan(1.4);   // oficial 1.667
    expect(r175 / r130).toBeLessThan(1.9);
    expect(r190 / r130).toBeGreaterThan(2.35);  // oficial 2.766
    expect(r190 / r130).toBeLessThan(3.2);
  });

  it('taquicardia franca (FHR 190) reproduz o combinado T13/18 oficial ~1:400 (±25%)', () => {
    const r = computeTrisomyRisk(
      { priorRisk: ageRelatedRisk(40), ntMm: 2.0, crlMm: 65, gestDays: 89, freeBhcgMoM: 1.0, pappaMoM: 1.0, fhrBpm: 190 },
      P,
    );
    const combinedN = 1 / (r.posterior.t18 + r.posterior.t13);
    expect(combinedN).toBeGreaterThan(300);
    expect(combinedN).toBeLessThan(500);
  });

  it('truncamento do delta a ±17,6 evita explosão de cauda (FHR extrema não vira LR absurda)', () => {
    // FHR 250 (delta ~+90, muito além de ±17,6) deve dar a mesma LR que o limite.
    expect(fhrLR(250, 89, F, 't13')).toBeCloseTo(fhrLR(190, 89, F, 't13'), 5);
  });

  it('sem FHR informada, o fator não entra (LR neutra)', () => {
    const semFhr = computeTrisomyRisk({ priorRisk: ageRelatedRisk(30), ntMm: 2.0, crlMm: 65, gestDays: 89, freeBhcgMoM: 1.0, pappaMoM: 1.0 }, P);
    expect(semFhr.factors.t21.fhr).toBeUndefined();
  });
});
