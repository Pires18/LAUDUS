import { AppSettings } from '../../../types';
import { auth } from '../../../lib/firebase';
import { logger } from '../../../utils/logger';

// ═══════════════════════════════════════════════════════════════
// EMBEDDINGS — vetorização para retrieval semântico
// ═══════════════════════════════════════════════════════════════
// Converte texto clínico em vetores para encontrar casos similares no
// Corpus de Excelência. Usa o modelo text-embedding-004 do Gemini via
// o proxy server-side (api/gemini.ts, task 'embed').
//
// A matemática de similaridade é PURA e testável; a vetorização é a
// única parte que toca a rede.

export const EMBEDDING_MODEL = 'text-embedding-004';

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
  signal?: AbortSignal
): Promise<number[]> {
  const clean = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
  if (clean.length < 3) return [];

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uid': auth.currentUser?.uid || 'anonymous',
        'x-gemini-model': EMBEDDING_MODEL,
        'x-gemini-task': 'embed',
        'x-api-key': settings.geminiApiKey || '',
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: clean }] },
      }),
      signal,
    });

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
