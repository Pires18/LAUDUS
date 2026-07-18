import { useState, useEffect, useCallback } from 'react';

/**
 * Próximo índice de imagem ao navegar, com clamp nos limites (pura, testável).
 * Nunca sai de [0, count-1]; com lista vazia (count 0) permanece em 0.
 */
export function stepImageIndex(current: number, count: number, dir: 'prev' | 'next'): number {
  if (dir === 'prev') return current > 0 ? current - 1 : current;
  return current < count - 1 ? current + 1 : current;
}

/**
 * Navegação entre imagens do estudo DICOM (índice ativo, prev/next e setas do
 * teclado). Extraído de ExamEditor para reduzir o tamanho do componente.
 *
 * @param instanceCount        total de imagens do estudo atual
 * @param selectedStudyId      ao trocar de estudo, volta para a 1ª imagem
 * @param showIntegratedViewer visor lateral aberto (habilita as setas)
 * @param showFullScreenImage  visor em tela cheia aberto (habilita as setas)
 */
export function useImageNavigation(
  instanceCount: number,
  selectedStudyId: string | null,
  showIntegratedViewer: boolean,
  showFullScreenImage: boolean,
) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Ao trocar de estudo PACS, volta para a primeira imagem do novo estudo.
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedStudyId]);

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex((prev) => stepImageIndex(prev, instanceCount, 'prev'));
  }, [instanceCount]);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex((prev) => stepImageIndex(prev, instanceCount, 'next'));
  }, [instanceCount]);

  // Navegação por teclado (setas) — só com um visor aberto.
  useEffect(() => {
    if (!showIntegratedViewer && !showFullScreenImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora quando o médico está digitando num campo.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntegratedViewer, showFullScreenImage, handlePrevImage, handleNextImage]);

  return { activeImageIndex, setActiveImageIndex, handlePrevImage, handleNextImage };
}
