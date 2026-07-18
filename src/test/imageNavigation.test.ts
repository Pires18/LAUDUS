import { describe, it, expect } from 'vitest';
import { stepImageIndex } from '../modules/editor/hooks/useImageNavigation';

/** Navegação entre imagens do estudo DICOM — clamp de índice (lógica pura). */
describe('stepImageIndex', () => {
  it('avança e retrocede dentro dos limites', () => {
    expect(stepImageIndex(0, 5, 'next')).toBe(1);
    expect(stepImageIndex(3, 5, 'next')).toBe(4);
    expect(stepImageIndex(4, 5, 'prev')).toBe(3);
    expect(stepImageIndex(1, 5, 'prev')).toBe(0);
  });

  it('não passa do começo (prev em 0 fica em 0)', () => {
    expect(stepImageIndex(0, 5, 'prev')).toBe(0);
  });

  it('não passa do fim (next na última fica na última)', () => {
    expect(stepImageIndex(4, 5, 'next')).toBe(4);
  });

  it('lista com 1 imagem: prev e next ficam em 0', () => {
    expect(stepImageIndex(0, 1, 'next')).toBe(0);
    expect(stepImageIndex(0, 1, 'prev')).toBe(0);
  });

  it('lista vazia (count 0): permanece em 0 nos dois sentidos', () => {
    expect(stepImageIndex(0, 0, 'next')).toBe(0);
    expect(stepImageIndex(0, 0, 'prev')).toBe(0);
  });
});
