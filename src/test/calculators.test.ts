import { describe, it, expect } from 'vitest';
import {
  ellipsoidVolume,
  prostateVolumeWeight,
  meanSacDiameter,
  gaFromMsd,
  balikPleuralVolume,
  amnioticMBV,
  amnioticILA,
  imtClassification,
  imtAgeGroup,
  ivcCollapsibilityIndex,
  dopplerIndices,
} from '../modules/calculators/formulas';

describe('ellipsoidVolume', () => {
  it('calcula volume em cm³ (entrada cm)', () => {
    // 4 × 3 × 2 × 0,523 = 12,552
    expect(ellipsoidVolume(4, 3, 2, 'cm')).toBeCloseTo(12.552, 3);
  });
  it('converte mm³ → cm³ (÷1000)', () => {
    expect(ellipsoidVolume(40, 30, 20, 'mm')).toBeCloseTo(12.552, 3);
  });
  it('retorna null para dimensão não positiva', () => {
    expect(ellipsoidVolume(0, 3, 2)).toBeNull();
    expect(ellipsoidVolume(4, -1, 2)).toBeNull();
  });
});

describe('prostateVolumeWeight', () => {
  it('volume (cc), peso (g) e classificação normal', () => {
    // 0,523 × 40 × 30 × 30 / 1000 = 18,828 cc → Normal
    const r = prostateVolumeWeight(40, 30, 30)!;
    expect(r.volume).toBeCloseTo(18.828, 3);
    expect(r.weight).toBeCloseTo(19.769, 3);
    expect(r.classification).toBe('Normal (até 20cc)');
  });
  it('classifica aumentos por faixa de volume', () => {
    // volume ~28.2 (leve)
    expect(prostateVolumeWeight(50, 30, 36)!.classification).toBe('Aumento leve (20-30cc)');
    // volume ~62.8 (acentuado)
    expect(prostateVolumeWeight(50, 50, 48)!.classification).toBe('Aumento acentuado (50-80cc)');
  });
  it('null sem os três diâmetros', () => {
    expect(prostateVolumeWeight(0, 30, 30)).toBeNull();
  });
});

describe('DMSG / idade gestacional', () => {
  it('média dos três diâmetros', () => {
    expect(meanSacDiameter(10, 12, 14)).toBeCloseTo(12, 6);
  });
  it('IG = round(DMSG + 30) dias', () => {
    // 12 + 30 = 42 dias = 6s 0d
    expect(gaFromMsd(12)).toEqual({ weeks: 6, days: 0, label: '6s 0d' });
    // 15 + 30 = 45 dias = 6s 3d
    expect(gaFromMsd(15)).toEqual({ weeks: 6, days: 3, label: '6s 3d' });
  });
});

describe('balikPleuralVolume', () => {
  it('V = 20 × espessura', () => {
    expect(balikPleuralVolume(15)).toBe(300);
  });
  it('null para espessura não positiva', () => {
    expect(balikPleuralVolume(0)).toBeNull();
  });
});

describe('líquido amniótico', () => {
  it('MBV: maior bolsão e classificação', () => {
    expect(amnioticMBV([15, 40, 22])!.result).toBe(40);
    expect(amnioticMBV([10, 15])!.classification).toBe('Oligoâmnio (MBV < 20mm)');
    expect(amnioticMBV([90])!.classification).toBe('Polidrâmnio (MBV > 80mm)');
    expect(amnioticMBV([0, 0])).toBeNull();
  });
  it('ILA: soma dos quadrantes e classificação', () => {
    const r = amnioticILA(30, 40, 50, 30)!; // 150 → normal
    expect(r.result).toBe(150);
    expect(r.classification).toBe('Volume normal (80-180mm)');
    expect(amnioticILA(10, 10, 10, 10)!.classification).toBe('Oligoâmnio (ILA < 50mm)');
    expect(amnioticILA(70, 70, 60, 60)!.classification).toBe('Polidrâmnio (ILA > 240mm)');
    expect(amnioticILA(0, 40, 50, 30)).toBeNull();
  });
});

describe('IMT (ELSA-Brasil)', () => {
  it('faixas etárias', () => {
    expect(imtAgeGroup(40)).toBe('35-44');
    expect(imtAgeGroup(45)).toBe('45-54');
    expect(imtAgeGroup(70)).toBe('65+');
  });
  it('classificação por percentil (homem 50a)', () => {
    // 45-54 masc: p75=0.80, p90=0.93
    expect(imtClassification(50, 'male', 0.75)).toBe('Normal (≤ p75)');
    expect(imtClassification(50, 'male', 0.88)).toBe('Espessamento moderado (p75-p90)');
    expect(imtClassification(50, 'male', 1.0)).toContain('acentuado');
  });
});

describe('índice de colapsabilidade da VCI', () => {
  it('(máx − mín)/máx × 100', () => {
    expect(ivcCollapsibilityIndex(20, 8)).toBeCloseTo(60, 6);
  });
  it('null para entradas inválidas', () => {
    expect(ivcCollapsibilityIndex(0, 8)).toBeNull();
  });
});

describe('índices Doppler', () => {
  it('IR, S/D e IP', () => {
    const r = dopplerIndices(100, 40, 60);
    expect(r.ri).toBeCloseTo(0.6, 6); // (100-40)/100
    expect(r.sd).toBeCloseTo(2.5, 6); // 100/40
    expect(r.pi).toBeCloseTo(1.0, 6); // (100-40)/60
  });
  it('IP null sem Vmed', () => {
    const r = dopplerIndices(100, 40);
    expect(r.pi).toBeNull();
    expect(r.ri).toBeCloseTo(0.6, 6);
  });
});
