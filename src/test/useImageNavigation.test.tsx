// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useImageNavigation } from '../modules/editor/hooks/useImageNavigation';

afterEach(cleanup);

describe('useImageNavigation', () => {
  it('começa no índice 0', () => {
    const { result } = renderHook(() => useImageNavigation(5, 'study-a', false, false));
    expect(result.current.activeImageIndex).toBe(0);
  });

  it('next/prev respeitam os limites do estudo', () => {
    const { result } = renderHook(() => useImageNavigation(3, 'study-a', false, false));
    act(() => result.current.handleNextImage());
    expect(result.current.activeImageIndex).toBe(1);
    act(() => result.current.handleNextImage());
    act(() => result.current.handleNextImage()); // já na última, não passa
    expect(result.current.activeImageIndex).toBe(2);
    act(() => result.current.handlePrevImage());
    act(() => result.current.handlePrevImage());
    act(() => result.current.handlePrevImage()); // já na primeira, não passa
    expect(result.current.activeImageIndex).toBe(0);
  });

  it('ao trocar de estudo, volta para a primeira imagem', () => {
    const { result, rerender } = renderHook(
      ({ studyId }) => useImageNavigation(5, studyId, false, false),
      { initialProps: { studyId: 'study-a' } },
    );
    act(() => result.current.handleNextImage());
    act(() => result.current.handleNextImage());
    expect(result.current.activeImageIndex).toBe(2);
    rerender({ studyId: 'study-b' });
    expect(result.current.activeImageIndex).toBe(0);
  });

  it('setas do teclado navegam quando um visor está aberto', () => {
    const { result } = renderHook(() => useImageNavigation(4, 'study-a', true, false));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.activeImageIndex).toBe(1);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(result.current.activeImageIndex).toBe(0);
  });

  it('sem visor aberto, o teclado é ignorado', () => {
    const { result } = renderHook(() => useImageNavigation(4, 'study-a', false, false));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.activeImageIndex).toBe(0);
  });
});
