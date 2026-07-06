import { describe, it, expect } from 'vitest';
import {
  momPlausible, crlToGaWeeks, crlInWindow, formatGa,
  MOM_MIN, MOM_MAX, CRL_MIN_MM, CRL_MAX_MM,
} from '../modules/calculators/fmf/qc';

describe('QC — plausibilidade de MoM', () => {
  it('ausente/None ⇒ sem alerta (true)', () => {
    expect(momPlausible(undefined)).toBe(true);
    expect(momPlausible(null)).toBe(true);
    expect(momPlausible(NaN)).toBe(true);
  });
  it('dentro da faixa 0,2–5,0 ⇒ true', () => {
    expect(momPlausible(1.0)).toBe(true);
    expect(momPlausible(MOM_MIN)).toBe(true);
    expect(momPlausible(MOM_MAX)).toBe(true);
  });
  it('fora da faixa ⇒ false', () => {
    expect(momPlausible(0.1)).toBe(false);
    expect(momPlausible(6)).toBe(false);
  });
});

describe('QC — janela do CCN / IG', () => {
  it('CCN na janela 45–84 mm', () => {
    expect(crlInWindow(45)).toBe(true);
    expect(crlInWindow(84)).toBe(true);
    expect(crlInWindow(CRL_MIN_MM - 1)).toBe(false);
    expect(crlInWindow(CRL_MAX_MM + 1)).toBe(false);
  });
  it('crlToGaWeeks cresce com o CCN e cai na faixa de 1º trimestre', () => {
    const ga45 = crlToGaWeeks(45)!;
    const ga84 = crlToGaWeeks(84)!;
    expect(ga84).toBeGreaterThan(ga45);
    // CCN de 45–84mm corresponde a ~11–14 semanas
    expect(ga45).toBeGreaterThan(10);
    expect(ga84).toBeLessThan(15);
  });
  it('CCN inválido ⇒ null', () => {
    expect(crlToGaWeeks(0)).toBeNull();
    expect(crlToGaWeeks(-5)).toBeNull();
  });
  it('formatGa formata semanas decimais', () => {
    expect(formatGa(12 + 3 / 7)).toBe('12s 3d');
    expect(formatGa(13)).toBe('13s 0d');
  });
});
