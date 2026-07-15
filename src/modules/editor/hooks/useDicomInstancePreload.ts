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
/** Teto do cache de previews (LRU): segura vários estudos do mesmo paciente
 * quentes na memória — trocar entre exames e voltar não re-baixa nada — sem
 * deixar a memória crescer sem limite (previews são JPEGs pequenos). */
const MAX_CACHED_PREVIEWS = 400;

export function useDicomInstancePreload(instances: any[], settings: any) {
  const cacheRef = useRef<Record<string, string>>({});
  // Ordem de uso dos IDs em cache (mais recente no fim) — base da poda LRU.
  const lruRef = useRef<string[]>([]);
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
    // Cancela downloads do estudo anterior ao trocar de estudo — sem isso eles
    // continuam ocupando os workers/banda e atrasam o estudo que o usuário
    // está olhando agora.
    const abortController = new AbortController();
    const currentIds = new Set(instances.map((i) => i.ID));

    const touch = (id: string) => {
      const i = lruRef.current.indexOf(id);
      if (i !== -1) lruRef.current.splice(i, 1);
      lruRef.current.push(id);
    };

    // Poda LRU: só descarta quando estoura o teto, nunca do estudo aberto.
    // (Antes, TUDO que não era do estudo atual era revogado — alternar entre
    // exames do paciente re-baixava o estudo inteiro a cada volta.)
    const evictOverflow = () => {
      while (lruRef.current.length > MAX_CACHED_PREVIEWS) {
        const idx = lruRef.current.findIndex((id) => !currentIds.has(id));
        if (idx === -1) break;
        const [id] = lruRef.current.splice(idx, 1);
        URL.revokeObjectURL(cacheRef.current[id]);
        delete cacheRef.current[id];
      }
    };

    instances.forEach((i) => { if (cacheRef.current[i.ID]) touch(i.ID); });
    // Poda no início de cada ciclo (nunca no .then de um ciclo cancelado, que
    // teria um `currentIds` velho e poderia revogar URLs do estudo recém-aberto).
    evictOverflow();
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
      signal: abortController.signal,
      onProgress: (done, total) => {
        if (!cancelled) setProgress({ done: alreadyCached + done, total: instances.length });
      },
    }).then(({ urls: newUrls, failedIds: failed }) => {
      // Mesmo num ciclo cancelado (troca de estudo), os blobs que chegaram a
      // baixar continuam válidos — entram no cache pra quando o usuário voltar.
      Object.assign(cacheRef.current, newUrls);
      Object.keys(newUrls).forEach(touch);
      if (cancelled) return;
      evictOverflow();
      setUrls({ ...cacheRef.current });
      setFailedIds((prev) => Array.from(new Set([...prev, ...failed])));
      setReady(true);
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
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
    lruRef.current.push(...Object.keys(singleUrlMap).filter((id) => !lruRef.current.includes(id)));
    setUrls({ ...cacheRef.current });
    setFailedIds((prev) => prev.filter((id) => id !== instanceId));
  }

  return { urls, failedIds, progress, ready, retryOne };
}
