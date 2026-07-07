import { describe, it, expect } from 'vitest';
import { parseNonNegativeNumber } from '../utils/format';

/**
 * `parseFloat(v) || 0` sozinho deixa negativo passar (-149 é truthy) — usado
 * em todo campo de preço/cota do Admin, por isso testado isoladamente.
 */
describe('parseNonNegativeNumber', () => {
  it('número positivo normal passa direto', () => {
    expect(parseNonNegativeNumber('149')).toBe(149);
    expect(parseNonNegativeNumber('9.9')).toBe(9.9);
  });

  it('negativo é travado em 0, não passa direto', () => {
    expect(parseNonNegativeNumber('-149')).toBe(0);
    expect(parseNonNegativeNumber('-0.01')).toBe(0);
  });

  it('vazio/NaN cai no fallback (default 0)', () => {
    expect(parseNonNegativeNumber('')).toBe(0);
    expect(parseNonNegativeNumber('abc')).toBe(0);
  });

  it('aceita fallback customizado para o caso NaN/vazio', () => {
    expect(parseNonNegativeNumber('', 5.5)).toBe(5.5);
    expect(parseNonNegativeNumber('lixo', 5.5)).toBe(5.5);
  });

  it('zero é preservado (cota 0 = convenção de ilimitado em alguns campos)', () => {
    expect(parseNonNegativeNumber('0')).toBe(0);
  });
});
