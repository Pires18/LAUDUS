import { describe, it, expect } from 'vitest';
import {
  zToPercentile,
  calcHadlockEfw,
  getWhoPercentile,
  getRef,
  UA_REF,
  mcaPsvMedianCmS,
  mcaPsvMoM,
  getWhoZScore,
  getWhoValueAtZ,
  computeGrowthVelocity,
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

describe('Z-score OMS contínuo e projeção (getWhoZScore / getWhoValueAtZ)', () => {
  it('z=0 devolve a mediana; round-trip valor→z≈0', () => {
    const median = getWhoValueAtZ('EFW', 28, 0)!;
    expect(median).toBeGreaterThan(0);
    expect(getWhoZScore('EFW', 28, median)!).toBeCloseTo(0, 1);
  });
  it('valor maior → z maior (monotônico)', () => {
    const lo = getWhoValueAtZ('EFW', 30, -1)!;
    const hi = getWhoValueAtZ('EFW', 30, 1)!;
    expect(hi).toBeGreaterThan(lo);
    expect(getWhoZScore('EFW', 30, hi)!).toBeGreaterThan(getWhoZScore('EFW', 30, lo)!);
  });
  it('fora da janela OMS (14–40 sem) → null', () => {
    expect(getWhoZScore('EFW', 12, 500)).toBeNull();
  });
});

describe('Velocidade de crescimento fetal (Hugh & Gardosi, 2022)', () => {
  it('feto que mantém o percentil → velocidade ≈ 0 e "adequada"', () => {
    const efw1 = getWhoValueAtZ('EFW', 28, 0.5)!;
    const efw2 = getWhoValueAtZ('EFW', 34, 0.5)!;
    const r = computeGrowthVelocity({ efw1, ga1Weeks: 28, efw2, ga2Weeks: 34 })!;
    expect(Math.abs(r.zVelocityPerWeek)).toBeLessThan(0.05);
    expect(r.classification).toBe('adequate');
    expect(r.alert).toBe(false);
  });
  it('queda de z (0,5 → −1,0 em 6 sem) → desaceleração significativa (< −0,13/sem)', () => {
    const efw1 = getWhoValueAtZ('EFW', 28, 0.5)!;
    const efw2 = getWhoValueAtZ('EFW', 34, -1.0)!;
    const r = computeGrowthVelocity({ efw1, ga1Weeks: 28, efw2, ga2Weeks: 34 })!;
    expect(r.zVelocityPerWeek).toBeLessThan(-0.13);
    expect(r.classification).toBe('deceleration');
    expect(r.alert).toBe(true);
    expect(r.centileDrop).toBeGreaterThan(0);
  });
  it('intervalo não positivo ou EPF inválido → null', () => {
    expect(computeGrowthVelocity({ efw1: 1000, ga1Weeks: 30, efw2: 1200, ga2Weeks: 30 })).toBeNull();
    expect(computeGrowthVelocity({ efw1: 0, ga1Weeks: 28, efw2: 1200, ga2Weeks: 32 })).toBeNull();
  });
  it('intervalo < 2 semanas marca reliable=false', () => {
    const efw1 = getWhoValueAtZ('EFW', 28, 0)!;
    const efw2 = getWhoValueAtZ('EFW', 29, 0)!;
    const r = computeGrowthVelocity({ efw1, ga1Weeks: 28, efw2, ga2Weeks: 29 })!;
    expect(r.reliable).toBe(false);
  });
});
