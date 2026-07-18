import { useState } from 'react';
import { useApp } from '../../../store/app';
import { preloadDicomInstances } from '../../../utils/dicom';
import { logger } from '../../../utils/logger';
import type { AppSettings } from '../../../types';

// Otimização por layout: reduzir aqui deixa o PDF mais leve e a montagem mais
// rápida, principalmente com estudos grandes (muitas imagens ou pesadas).
const PRINT_OPTIMIZE_BY_GRID: Record<string, { maxWidth: number; quality: number }> = {
  '1x1': { maxWidth: 1600, quality: 0.88 },
  '1x2': { maxWidth: 1200, quality: 0.85 },
  '2x3': { maxWidth: 900, quality: 0.82 },
  '2x4': { maxWidth: 700, quality: 0.8 },
};

/**
 * Impressão de imagens DICOM em PDF — encapsula todo o fluxo (pré-carregamento
 * com retry/otimização, estados de progresso e o print-mode-images).
 * Extraído de ExamEditor para reduzir o tamanho do componente.
 *
 * @param settings           configurações (fonte, PACS…)
 * @param dicomPreloadedUrls blobs já pré-carregados no painel (evita re-baixar)
 */
export function usePrintImages(settings: AppSettings, dicomPreloadedUrls: Record<string, string>) {
  const { showToast } = useApp();
  const [selectedInstancesForPrint, setSelectedInstancesForPrint] = useState<any[]>([]);
  const [selectedGridType, setSelectedGridType] = useState<string>('2x4');
  const [isPrintingImages, setIsPrintingImages] = useState(false);
  const [printProgress, setPrintProgress] = useState<string>('');
  const [printLocalUrls, setPrintLocalUrls] = useState<Record<string, string>>({});

  const handlePrintImages = async (instances: any[], gridType: string = '2x4') => {
    if (instances.length === 0) return;
    setIsPrintingImages(true);
    setPrintProgress(`Otimizando imagens (0/${instances.length})...`);
    showToast('Preparando imagens para a impressão...', 'info');

    let localUrlsMap: Record<string, string> = {};
    try {
      // Baixa tudo como blob local ANTES de imprimir, com timeout + 3 tentativas
      // por imagem — imagem pesada ou rede instável não pode travar pra sempre,
      // nem uma falha pontual derrubar o PDF inteiro. Também otimiza cada imagem
      // pro tamanho real que vai ocupar na página. `sourceUrls`: imagens já
      // pré-carregadas no painel são lidas do blob local (instantâneo).
      const preloadResult = await preloadDicomInstances(instances, settings, {
        maxAttempts: 3,
        sourceUrls: dicomPreloadedUrls,
        optimize: PRINT_OPTIMIZE_BY_GRID[gridType] || { maxWidth: 1000, quality: 0.82 },
        onProgress: (done, total, failed) => {
          setPrintProgress(`Otimizando imagens (${done}/${total})${failed ? ` — ${failed} falharam` : ''}...`);
        },
      });
      localUrlsMap = preloadResult.urls;
      const failedInstanceIds = preloadResult.failedIds;

      const printableInstances = instances.filter((inst) => localUrlsMap[inst.ID]);
      if (printableInstances.length === 0) {
        throw new Error('Nenhuma imagem pôde ser carregada.');
      }
      if (failedInstanceIds.length > 0) {
        showToast(`${failedInstanceIds.length} de ${instances.length} imagem(ns) falharam mesmo após 3 tentativas e foram puladas — o PDF sai com as demais ${printableInstances.length}.`, 'error');
      }

      setPrintLocalUrls(localUrlsMap);
      setSelectedInstancesForPrint(printableInstances);
      setSelectedGridType(gridType);

      document.body.classList.add('print-mode-images');

      // Pequeno delay para o DOM renderizar as imagens dos blobs locais.
      setTimeout(() => {
        window.print();
        document.body.classList.remove('print-mode-images');
        setIsPrintingImages(false);
        setPrintProgress('');

        // Delay para resetar instâncias e revogar URLs sem "rasgar" a viewport.
        setTimeout(() => {
          setSelectedInstancesForPrint([]);
          Object.values(localUrlsMap).forEach((url) => URL.revokeObjectURL(url));
          setPrintLocalUrls({});
        }, 500);
      }, 300);
    } catch (err) {
      logger.error('[PACS Print Preload Error]', err);
      showToast('Erro ao carregar imagens para a impressão.', 'error');
      setIsPrintingImages(false);
      setPrintProgress('');
      Object.values(localUrlsMap).forEach((url) => URL.revokeObjectURL(url));
      setPrintLocalUrls({});
    }
  };

  return {
    selectedInstancesForPrint,
    selectedGridType,
    isPrintingImages,
    printProgress,
    printLocalUrls,
    handlePrintImages,
  };
}
