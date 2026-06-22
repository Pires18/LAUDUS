import { describe, it, expect } from 'vitest';
import {
  calcGaFromDum,
  calcGaFromPreviousUsg,
  calcEllipsoidVolume,
  classifyBirads,
  classifyTirads,
} from '../utils/calculations';

describe('calcGaFromDum — Idade Gestacional pela DUM', () => {
  it('calcula 40 semanas exatas (DPP)', () => {
    const dum = new Date('2024-01-01');
    const ref = new Date('2024-10-07'); // 280 dias depois
    const result = calcGaFromDum(dum, ref);
    expect(result).not.toBeNull();
    expect(result!.weeks).toBe(40);
    expect(result!.days).toBe(0);
  });

  it('calcula 12 semanas e 3 dias', () => {
    const dum = new Date('2024-01-01');
    const ref = new Date('2024-03-28'); // 87 dias = 12s3d (2024 é bissexto: fev=29d)
    const result = calcGaFromDum(dum, ref);
    expect(result!.weeks).toBe(12);
    expect(result!.days).toBe(3);
  });

  it('retorna null quando DUM é posterior à data de referência', () => {
    const dum = new Date('2024-06-01');
    const ref = new Date('2024-01-01');
    expect(calcGaFromDum(dum, ref)).toBeNull();
  });

  it('DPP é 280 dias após a DUM', () => {
    const dum = new Date('2024-01-01');
    const ref = new Date('2024-03-15');
    const result = calcGaFromDum(dum, ref);
    const expectedEdd = new Date('2024-10-07');
    expect(result!.edd.toDateString()).toBe(expectedEdd.toDateString());
  });
});

describe('calcGaFromPreviousUsg — IG por USG Anterior', () => {
  it('progressão correta desde USG anterior', () => {
    const usgDate = new Date('2024-01-01');
    const ref = new Date('2024-01-15'); // 14 dias depois
    // USG anterior: 10s0d → agora deve ser 12s0d
    const result = calcGaFromPreviousUsg(usgDate, 10, 0, ref);
    expect(result!.weeks).toBe(12);
    expect(result!.days).toBe(0);
  });

  it('retorna null quando totalDays < 0', () => {
    const usgDate = new Date('2024-06-01');
    const ref = new Date('2024-01-01');
    expect(calcGaFromPreviousUsg(usgDate, 8, 0, ref)).toBeNull();
  });

  it('leva em conta dias fracionários do USG anterior', () => {
    const usgDate = new Date('2024-01-01');
    const ref = new Date('2024-01-08'); // 7 dias depois
    // USG anterior: 20s5d → agora deve ser 21s5d
    const result = calcGaFromPreviousUsg(usgDate, 20, 5, ref);
    expect(result!.weeks).toBe(21);
    expect(result!.days).toBe(5);
  });
});

describe('calcEllipsoidVolume — Volume pelo elipsoide', () => {
  it('calcula volume corretamente', () => {
    // V = π/6 × d1 × d2 × d3
    const vol = calcEllipsoidVolume(4, 3, 2);
    expect(vol).toBeCloseTo((Math.PI / 6) * 4 * 3 * 2, 5);
  });

  it('retorna 0 para dimensões zero', () => {
    expect(calcEllipsoidVolume(0, 3, 2)).toBe(0);
  });
});

describe('classifyBirads — Classificação BI-RADS', () => {
  it('classifica BI-RADS 1 corretamente', () => {
    expect(classifyBirads(1)).toContain('BI-RADS 1');
    expect(classifyBirads(1)).toContain('Negativo');
  });

  it('classifica BI-RADS 4 com recomendação de biópsia', () => {
    expect(classifyBirads(4)).toContain('biópsia');
  });

  it('classifica BI-RADS 6 como malignidade conhecida', () => {
    expect(classifyBirads(6)).toContain('Malignidade conhecida');
  });

  it('retorna texto para valor inválido', () => {
    expect(classifyBirads(99)).toContain('inválido');
  });
});

describe('classifyTirads — Classificação TI-RADS', () => {
  it('TR1 para score 0', () => {
    const { category } = classifyTirads(0);
    expect(category).toContain('TR1');
  });

  it('TR5 para score alto', () => {
    const { category, recommendation } = classifyTirads(10);
    expect(category).toContain('TR5');
    expect(recommendation).toContain('1.0 cm');
  });

  it('TR3 inclui opção de biópsia por tamanho', () => {
    const { recommendation } = classifyTirads(3);
    expect(recommendation).toContain('2.5 cm');
  });
});
