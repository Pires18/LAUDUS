import { cosineSimilarity } from './embeddings';
import { ExcellenceEntry } from './excellenceCorpus';

// ═══════════════════════════════════════════════════════════════
// RETRIEVAL SEMÂNTICO — seleção de exemplos few-shot
// ═══════════════════════════════════════════════════════════════
// Dado o caso atual (embedding + metadados), encontra os laudos mais
// similares do Corpus de Excelência e monta um bloco de referência para
// injetar na Camada 1. Lógica PURA e testável.
//
// Score = similaridade de cosseno + bônus de metadados (mesmo tipo de
// exame e mesmo motor pesam a favor). Isso supera a busca por palavra-
// chave: encontra o caso CLINICAMENTE próximo, não só da mesma área.

export interface RetrievalQuery {
  examType: string;
  motor: 'lite' | 'pro';
  /** Embedding do contexto clínico atual (indicação + anamnese). */
  embedding: number[];
}

export interface RankedEntry {
  entry: ExcellenceEntry;
  score: number;
  similarity: number;
}

const SAME_EXAMTYPE_BONUS = 0.08;
const SAME_MOTOR_BONUS = 0.04;
/** Similaridade mínima para considerar um exemplo relevante. */
const MIN_SIMILARITY = 0.55;

/**
 * Ranqueia candidatos do corpus por relevância ao caso atual.
 * Entradas sem embedding caem para o fim (similaridade 0), mas ainda
 * recebem bônus de metadados — útil quando o corpus é pequeno.
 */
export function rankBySimilarity(
  query: RetrievalQuery,
  candidates: ExcellenceEntry[]
): RankedEntry[] {
  const ranked = candidates.map((entry) => {
    const similarity =
      query.embedding.length > 0 && entry.embedding.length > 0
        ? cosineSimilarity(query.embedding, entry.embedding)
        : 0;

    let score = similarity;
    if (entry.examType === query.examType) score += SAME_EXAMTYPE_BONUS;
    if (entry.motor === query.motor) score += SAME_MOTOR_BONUS;

    return { entry, score, similarity };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

/**
 * Seleciona os top-K exemplos relevantes. Aplica o piso de similaridade
 * quando há embedding; sem embedding, cai para correspondência de tipo
 * de exame (fallback para corpus pequeno/sem vetorização).
 */
export function selectExamples(
  query: RetrievalQuery,
  candidates: ExcellenceEntry[],
  k = 2
): ExcellenceEntry[] {
  const ranked = rankBySimilarity(query, candidates);
  const hasEmbeddings = query.embedding.length > 0;

  const relevant = ranked.filter((r) => {
    if (hasEmbeddings && r.similarity > 0) return r.similarity >= MIN_SIMILARITY;
    // Fallback sem embedding: aceita mesmo tipo de exame.
    return r.entry.examType === query.examType;
  });

  return relevant.slice(0, k).map((r) => r.entry);
}

/**
 * Monta o bloco de referência few-shot para injetar no contexto.
 * Retorna string vazia se não houver exemplos relevantes (o motor opera
 * normalmente, só sem reforço de estilo).
 */
export function buildFewShotBlock(examples: ExcellenceEntry[]): string {
  if (examples.length === 0) return '';

  const blocks = examples
    .map(
      (ex, i) => `── EXEMPLO ${i + 1} (${ex.examType}) ──
${ex.anonymizedContent}`
    )
    .join('\n\n');

  return `═══════════════════════════════════════════
EXEMPLOS DE REFERÊNCIA DO MÉDICO (replique vocabulário, fraseologia, nível de detalhe e estrutura — NÃO copie achados nem medidas, que são específicos de cada paciente)
═══════════════════════════════════════════
${blocks}
═══════════════════════════════════════════
FIM DOS EXEMPLOS. Gere o laudo do caso atual seguindo este padrão de qualidade, mas com os dados clínicos do INPUT abaixo.`;
}
