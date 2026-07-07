import { describe, it, expect } from 'vitest';
import { calculateAge } from '../utils/format';

/**
 * calculateAge é usada tanto na UI (PatientDetail, Patients, CommandPalette) quanto
 * em documentos oficiais impressos (ReportDocument, docxExport, googleDocSync) e no
 * prompt enviado à IA (ai/engine.ts) — precisa ser clinicamente correta, inclusive
 * para bebês (onde "0 anos" é uma informação inútil/errada num laudo).
 */
describe('calculateAge', () => {
  it('idade adulta simples', () => {
    expect(calculateAge('2000-01-01', '2026-01-01')).toBe('26 anos');
  });

  it('singular correto para 1 ano (não "1 anos")', () => {
    expect(calculateAge('2025-01-01', '2026-01-01')).toBe('1 ano');
  });

  it('ainda não fez aniversário este ano → não incrementa', () => {
    expect(calculateAge('2000-12-31', '2026-01-01')).toBe('25 anos');
  });

  it('exatamente no dia do aniversário → já incrementou', () => {
    expect(calculateAge('2000-06-15', '2026-06-15')).toBe('26 anos');
  });

  it('bebê com menos de 1 ano → mostra em MESES, não "0 anos"', () => {
    expect(calculateAge('2026-05-01', '2026-07-01')).toBe('2 meses');
  });

  it('recém-nascido (mesmo mês) → "1 mês" (nunca 0)', () => {
    expect(calculateAge('2026-07-01', '2026-07-15')).toBe('1 mês');
  });

  it('sem data de nascimento → string vazia', () => {
    expect(calculateAge(undefined, '2026-01-01')).toBe('');
  });

  it('data inválida → string vazia (não NaN)', () => {
    expect(calculateAge('data-invalida', '2026-01-01')).toBe('');
  });

  it('aceita referenceDate como number (ms) — usado por ai/engine.ts', () => {
    const ref = new Date('2026-01-01').getTime();
    expect(calculateAge('2000-01-01', ref)).toBe('26 anos');
  });

  it('sem referenceDate → usa a data atual (só checa que não quebra)', () => {
    expect(() => calculateAge('2000-01-01')).not.toThrow();
  });
});
