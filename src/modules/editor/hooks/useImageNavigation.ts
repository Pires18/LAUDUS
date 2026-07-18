import { useState, useEffect, useCallback } from 'react';

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
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex((prev) => (prev < instanceCount - 1 ? prev + 1 : prev));
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
