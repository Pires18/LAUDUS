import { useEffect, useMemo, useRef, useState } from 'react';
import { preloadDicomInstances } from '../../../utils/dicom';

interface PreloadProgress {
  done: number;
  total: number;
}

/**
 * Pré-carrega o preview de todas as instâncias do estudo atual como blobs
 * locais ANTES de exibir qualquer coisa — evita o efeito de imagens
 * aparecendo aos poucos, algumas quebradas, enquanto o navegador ainda está
 * buscando cada uma direto do PACS.
 *
 * O cache é incremental e chaveado pelo CONJUNTO de IDs (não pela referência
 * do array `instances`, que pode mudar a cada poll mesmo com o mesmo
 * conteúdo — ex: a resposta do PACS reordenada). Assim, uma instância já
 * baixada nunca é buscada de novo só porque o array foi recriado; só as
 * instâncias realmente novas disparam fetch.
 */
export function useDicomInstancePreload(instances: any[], settings: any) {
  const cacheRef = useRef<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<PreloadProgress>({ done: instances.length, total: instances.length });
  const [ready, setReady] = useState(true);

  // Chave estável: mesmo CONJUNTO de instâncias (independente de ordem ou da
  // referência do array) não deve disparar um novo ciclo de carregamento.
  const instanceKey = useMemo(
    () => instances.map((i) => i.ID).slice().sort().join(','),
    [instances]
  );

  useEffect(() => {
    let cancelled = false;
    const currentIds = new Set(instances.map((i) => i.ID));

    // Descarta do cache/estado o que não pertence mais ao estudo atual
    // (troca de estudo) — evita crescimento sem limite de memória.
    for (const id of Object.keys(cacheRef.current)) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(cacheRef.current[id]);
        delete cacheRef.current[id];
      }
    }
    setFailedIds((prev) => prev.filter((id) => currentIds.has(id)));

    const pending = instances.filter((i) => !cacheRef.current[i.ID]);

    if (pending.length === 0) {
      setUrls({ ...cacheRef.current });
      setProgress({ done: instances.length, total: instances.length });
      setReady(true);
      return;
    }

    setReady(false);
    const alreadyCached = instances.length - pending.length;
    setProgress({ done: alreadyCached, total: instances.length });

    preloadDicomInstances(pending, settings, {
      onProgress: (done, total) => {
        if (!cancelled) setProgress({ done: alreadyCached + done, total: instances.length });
      },
    }).then(({ urls: newUrls, failedIds: failed }) => {
      if (cancelled) {
        Object.values(newUrls).forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      Object.assign(cacheRef.current, newUrls);
      setUrls({ ...cacheRef.current });
      setFailedIds((prev) => Array.from(new Set([...prev, ...failed])));
      setReady(true);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey]);

  // Revoga tudo ao desmontar o painel de vez.
  useEffect(() => () => {
    Object.values(cacheRef.current).forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function retryOne(instanceId: string) {
    const instance = instances.find((i) => i.ID === instanceId);
    if (!instance) return;
    const { urls: singleUrlMap, failedIds: singleFailed } = await preloadDicomInstances([instance], settings);
    if (singleFailed.length > 0) return;
    Object.assign(cacheRef.current, singleUrlMap);
    setUrls({ ...cacheRef.current });
    setFailedIds((prev) => prev.filter((id) => id !== instanceId));
  }

  return { urls, failedIds, progress, ready, retryOne };
}
