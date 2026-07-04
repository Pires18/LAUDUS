import { describe, it, expect } from 'vitest';
import { safeEqual } from '../../api/_secure';

/**
 * safeEqual protege a comparação de segredos (webhook HMAC, CRON secret, etc.).
 * Regras críticas: comparação constante, case-sensitive, e NUNCA aceita strings
 * vazias (mesmo vazio-vs-vazio deve ser false, para não validar segredo ausente).
 */
describe('safeEqual', () => {
  it('retorna true para strings iguais e não-vazias', () => {
    expect(safeEqual('super-secret-123', 'super-secret-123')).toBe(true);
    expect(safeEqual('a', 'a')).toBe(true);
  });

  it('retorna false para strings diferentes', () => {
    expect(safeEqual('secret-a', 'secret-b')).toBe(false);
    expect(safeEqual('secret', 'secret ')).toBe(false); // espaço extra
  });

  it('é case-sensitive', () => {
    expect(safeEqual('ABC', 'abc')).toBe(false);
  });

  it('NUNCA valida strings vazias (nem vazio-vs-vazio)', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('x', '')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });

  it('trata null/undefined como vazio → false', () => {
    expect(safeEqual(null, null)).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual('secret', null)).toBe(false);
    expect(safeEqual(undefined, 'secret')).toBe(false);
  });

  it('lida com segredos longos de comprimentos diferentes sem lançar', () => {
    const a = 'x'.repeat(200);
    const b = 'x'.repeat(199);
    expect(() => safeEqual(a, b)).not.toThrow();
    expect(safeEqual(a, b)).toBe(false);
    expect(safeEqual(a, 'x'.repeat(200))).toBe(true);
  });
});
