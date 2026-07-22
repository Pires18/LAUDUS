import { AppSettings } from '../../../types';
import { auth } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';
import { logger } from '../../../utils/logger';
import { withRetry } from '../retry';

// ═══════════════════════════════════════════════════════════════
// EMBEDDINGS — vetorização para retrieval semântico
// ═══════════════════════════════════════════════════════════════
// Converte texto clínico em vetores para encontrar casos similares no
// Corpus de Excelência. Usa o modelo text-embedding-004 do Gemini via
// o proxy server-side (api/gemini.ts, task 'embed').
//
// A matemática de similaridade é PURA e testável; a vetorização é a
// única parte que toca a rede.

export const EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Modelos de embedding candidatos, em ordem de preferência. Chaves
 * diferentes do Gemini têm acesso a modelos diferentes — testamos em
 * cascata e usamos o primeiro que responder com vetor.
 * gemini-embedding-001 vem primeiro por ser o compatível com as chaves
 * atuais (text-embedding-004 retorna 404 nelas).
 */
export const EMBEDDING_MODEL_CANDIDATES = [
  'gemini-embedding-001',
  'text-embedding-004',
  'embedding-001',
];

/**
 * Sonda de diagnóstico: faz UMA chamada de embedding e devolve o status
 * HTTP real e um trecho do corpo da resposta. Serve para descobrir por
 * que a vetorização falha (404 modelo/endpoint, 403 chave, proxy antigo
 * roteando para generateContent, etc.).
 */
export async function probeEmbedding(
  settings: AppSettings,
  model: string = EMBEDDING_MODEL
): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`,
        'x-uid': auth.currentUser?.uid || 'anonymous',
        'x-gemini-model': model,
        'x-gemini-task': 'embed',
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: 'teste de diagnóstico' }] },
      }),
    });
    const detail = (await response.text()).slice(0, 400);
    return { ok: response.ok, status: response.status, detail };
  } catch (e: any) {
    return { ok: false, status: 0, detail: e?.message || String(e) };
  }
}

/**
 * Descobre qual modelo de embedding funciona com a chave atual, testando
 * os candidatos em cascata. Retorna o modelo funcional (ou null) e um
 * diagnóstico legível com o status de cada tentativa.
 */
export async function resolveWorkingEmbeddingModel(
  settings: AppSettings
): Promise<{ model: string | null; diagnostics: string }> {
  const tried: string[] = [];
  for (const model of EMBEDDING_MODEL_CANDIDATES) {
    const probe = await probeEmbedding(settings, model);
    if (probe.ok) {
      return { model, diagnostics: `Modelo de embedding ativo: ${model}.` };
    }
    tried.push(`${model} → HTTP ${probe.status}: ${probe.detail.slice(0, 120)}`);
  }
  return { model: null, diagnostics: tried.join(' | ') };
}

/** Similaridade de cosseno entre dois vetores. Retorna [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Vetoriza um texto via proxy Gemini. Trunca para 8000 caracteres
 * (limite confortável do modelo de embedding). Retorna [] em falha —
 * o chamador deve degradar graciosamente (sem retrieval, não quebra).
 */
export async function embedText(
  text: string,
  settings: AppSettings,
  signal?: AbortSignal,
  model: string = EMBEDDING_MODEL
): Promise<number[]> {
  const clean = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (clean.length < 3) return [];

  try {
    const response = await withRetry(async () => fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`,
        'x-uid': auth.currentUser?.uid || 'anonymous',
        'x-gemini-model': model,
        'x-gemini-task': 'embed',
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: clean }] },
      }),
      signal,
    }));

    if (!response.ok) {
      logger.warn('[Embeddings] Proxy falhou:', response.status);
      return [];
    }
    const result = await response.json();
    const values = result?.embedding?.values;
    return Array.isArray(values) ? values : [];
  } catch (err) {
    logger.warn('[Embeddings] Erro ao vetorizar:', err);
    return [];
  }
}

/**
 * Vetoriza vários textos em UMA chamada (batchEmbedContents). Reduz
 * drasticamente o número de requisições (essencial para o bootstrap do
 * corpus). Retorna um vetor por texto, na mesma ordem; entradas inválidas
 * recebem []. Em falha total, retorna array de [] do mesmo tamanho.
 */
export async function embedTextBatch(
  texts: string[],
  settings: AppSettings,
  signal?: AbortSignal,
  model: string = EMBEDDING_MODEL
): Promise<number[][]> {
  const cleaned = texts.map((t) => (t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000));
  if (cleaned.length === 0) return [];

  const empties = () => cleaned.map(() => [] as number[]);

  try {
    const response = await withRetry(async () => fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`,
        'x-uid': auth.currentUser?.uid || 'anonymous',
        'x-gemini-model': model,
        'x-gemini-task': 'embed-batch',
      },
      body: JSON.stringify({
        requests: cleaned.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text: text || ' ' }] },
        })),
      }),
      signal,
    }));

    if (!response.ok) {
      logger.warn('[Embeddings] Batch proxy falhou:', response.status);
      return empties();
    }
    const result = await response.json();
    const embeddings = result?.embeddings;
    if (!Array.isArray(embeddings)) return empties();
    return cleaned.map((_, i) => {
      const v = embeddings[i]?.values;
      return Array.isArray(v) ? v : [];
    });
  } catch (err) {
    logger.warn('[Embeddings] Erro no batch de vetorização:', err);
    return empties();
  }
}
