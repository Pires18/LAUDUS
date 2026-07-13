import { describe, it, expect } from 'vitest';
import {
  zToPercentile,
  calcHadlockEfw,
  getWhoPercentile,
  getRef,
  UA_REF,
  mcaPsvMedianCmS,
  mcaPsvMoM,
} from '../modules/calculators/constants/fetalReferences';

describe('zToPercentile (z-score → percentil)', () => {
  it('z=0 → p50', () => {
    expect(zToPercentile(0)).toBe(50);
  });
  it('z≈1.2815 → ~p90; z≈-1.2815 → ~p10', () => {
    expect(zToPercentile(1.2815)).toBeGreaterThanOrEqual(89);
    expect(zToPercentile(1.2815)).toBeLessThanOrEqual(91);
    expect(zToPercentile(-1.2815)).toBeGreaterThanOrEqual(9);
    expect(zToPercentile(-1.2815)).toBeLessThanOrEqual(11);
  });
  it('clampa em 1–99', () => {
    expect(zToPercentile(-10)).toBe(1);
    expect(zToPercentile(10)).toBe(99);
  });
});

describe('calcHadlockEfw (Hadlock IV, mm → g)', () => {
  it('feto a termo ≈ 3300g', () => {
    // DBP 90, CC 330, CA 350, CF 70 mm
    const efw = calcHadlockEfw(90, 330, 350, 70);
    expect(efw).toBeGreaterThan(3000);
    expect(efw).toBeLessThan(3600);
  });
  it('monotônico: CA maior → peso maior', () => {
    expect(calcHadlockEfw(90, 330, 360, 70)).toBeGreaterThan(calcHadlockEfw(90, 330, 340, 70));
  });
});

describe('getWhoPercentile (OMS Kiserud 2017)', () => {
  it('null fora de 14–40 semanas ou valor não positivo', () => {
    expect(getWhoPercentile('AC', 10, 200)).toBeNull();
    expect(getWhoPercentile('AC', 42, 350)).toBeNull();
    expect(getWhoPercentile('AC', 30, 0)).toBeNull();
  });
  it('retorna percentil em 1–99', () => {
    const p = getWhoPercentile('AC', 30, 260);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThanOrEqual(1);
    expect(p!).toBeLessThanOrEqual(99);
  });
  it('monotônico: valor maior → percentil ≥ para mesma IG', () => {
    const pLow = getWhoPercentile('AC', 30, 240)!;
    const pHigh = getWhoPercentile('AC', 30, 300)!;
    expect(pHigh).toBeGreaterThanOrEqual(pLow);
  });
});

describe('getRef (interpolação de tabela normativa)', () => {
  it('retorna [média, DP] finitos e clampa nas bordas', () => {
    const ref = getRef(UA_REF, 28);
    expect(ref).toHaveLength(2);
    expect(Number.isFinite(ref[0])).toBe(true);
    expect(Number.isFinite(ref[1])).toBe(true);
    // Abaixo do mínimo: clampa ao primeiro valor da tabela.
    expect(getRef(UA_REF, 0)).toEqual(getRef(UA_REF, 1));
  });
});

describe('PSV-ACM — mediana e MoM (Mari, 2000)', () => {
  it('mediana bate com os anchors publicados (~±1 cm/s)', () => {
    expect(mcaPsvMedianCmS(20)).toBeCloseTo(25.5, 0);
    expect(mcaPsvMedianCmS(24)).toBeCloseTo(30.7, 0);
    expect(mcaPsvMedianCmS(28)).toBeCloseTo(36.9, 0);
    expect(mcaPsvMedianCmS(32)).toBeCloseTo(44.4, 0);
    expect(mcaPsvMedianCmS(36)).toBeCloseTo(53.5, 0);
  });
  it('mediana é monotônica crescente com a IG', () => {
    expect(mcaPsvMedianCmS(30)).toBeGreaterThan(mcaPsvMedianCmS(24));
  });
  it('MoM = medido ÷ mediana; 1,00 MoM na mediana', () => {
    expect(mcaPsvMoM(mcaPsvMedianCmS(28), 28)).toBeCloseTo(1.0, 5);
  });
  it('> 1,5 MoM sinaliza anemia (ex.: 60 cm/s em 28 sem)', () => {
    // mediana 28 sem ≈ 36,9 → 60/36,9 ≈ 1,63 MoM
    expect(mcaPsvMoM(60, 28)).toBeGreaterThan(1.5);
  });
});
