import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { firestore, auth } from '../../../lib/firebase';
import { AppSettings } from '../../../types';
import { logger } from '../../../utils/logger';
import { embedTextBatch } from './embeddings';
import { ExcellenceEntry } from './excellenceCorpus';

// ═══════════════════════════════════════════════════════════════
// VETORIZAÇÃO INCREMENTAL DO CORPUS
// ═══════════════════════════════════════════════════════════════
// Calcula embeddings para as entradas do corpus que ainda não têm
// (ex.: laudos importados pelo backfill). Ativa o retrieval SEMÂNTICO
// completo — em vez do fallback por tipo de exame.
//
// Usa batchEmbedContents (muitos vetores por chamada) + throttle entre
// lotes para respeitar o rate limit do proxy (20 req/min). 446 laudos
// em lotes de 64 ≈ 7 chamadas — segundos, não minutos.

export interface VectorizeOptions {
  /** Textos por chamada de batch. Default 64. */
  batchSize?: number;
  /** Intervalo entre lotes (ms). Default 3500. */
  throttleMs?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface VectorizeResult {
  totalPending: number;
  vectorized: number;
  failed: number;
}

function corpusRef() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return collection(firestore, `users/${uid}/excellence_corpus`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Vetoriza todas as entradas do corpus sem embedding. Idempotente:
 * processa apenas o que falta. Seguro contra rate limit.
 */
export async function vectorizeCorpus(
  settings: AppSettings,
  options: VectorizeOptions = {}
): Promise<VectorizeResult> {
  const batchSize = options.batchSize ?? 64;
  const throttleMs = options.throttleMs ?? 3500;

  // 1. Carrega entradas sem embedding.
  const snap = await getDocs(corpusRef());
  const pending = snap.docs
    .map((d) => ({ ...(d.data() as ExcellenceEntry), id: d.id }))
    .filter((e) => !e.embedding || e.embedding.length === 0);

  const result: VectorizeResult = { totalPending: pending.length, vectorized: 0, failed: 0 };
  if (pending.length === 0) return result;

  // 2. Processa em lotes.
  for (let i = 0; i < pending.length; i += batchSize) {
    const chunk = pending.slice(i, i + batchSize);
    const inputs = chunk.map((e) => `${e.examType}. ${e.contextText || ''}`.trim());

    let vectors: number[][];
    try {
      vectors = await embedTextBatch(inputs, settings);
    } catch (err) {
      logger.warn('[Vectorize] Falha no lote, seguindo:', err);
      vectors = chunk.map(() => []);
    }

    // 3. Grava os embeddings que vieram preenchidos.
    const batch = writeBatch(firestore);
    let writes = 0;
    chunk.forEach((entry, j) => {
      const vec = vectors[j];
      if (vec && vec.length > 0) {
        batch.set(doc(corpusRef(), entry.id), { embedding: vec }, { merge: true });
        writes++;
        result.vectorized++;
      } else {
        result.failed++;
      }
    });
    if (writes > 0) await batch.commit();

    options.onProgress?.(Math.min(i + chunk.length, pending.length), pending.length);

    if (i + batchSize < pending.length) await sleep(throttleMs);
  }

  logger.info(`[Vectorize] Concluído: ${result.vectorized}/${result.totalPending} vetorizados.`);
  return result;
}

/** Conta quantas entradas do corpus ainda não têm embedding. */
export async function countPendingVectorization(): Promise<{ pending: number; total: number }> {
  try {
    const snap = await getDocs(corpusRef());
    let pending = 0;
    snap.forEach((d) => {
      const e = d.data() as ExcellenceEntry;
      if (!e.embedding || e.embedding.length === 0) pending++;
    });
    return { pending, total: snap.size };
  } catch {
    return { pending: 0, total: 0 };
  }
}
