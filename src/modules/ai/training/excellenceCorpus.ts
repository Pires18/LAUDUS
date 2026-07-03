import {
  collection,
  doc,
  setDoc,
  getDocs,
  getCountFromServer,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import { firestore, auth } from '../../../lib/firebase';
import { AppSettings, ExamArea, Patient } from '../../../types';
import { logger } from '../../../utils/logger';
import { anonymizeReport, detectResidualPII } from './anonymize';
import { embedText } from './embeddings';

// ═══════════════════════════════════════════════════════════════
// CORPUS DE EXCELÊNCIA — banco curado de laudos-modelo (RAG)
// ═══════════════════════════════════════════════════════════════
// Laudos que o médico marca como "Excelente" entram aqui, ANONIMIZADOS,
// para servir de few-shot na geração futura. É o substrato do retrieval
// semântico. Caminho: users/{uid}/excellence_corpus/{id}.
//
// REGRA INVIOLÁVEL (LGPD): nenhum documento é persistido sem passar pela
// anonimização e pelo gate detectResidualPII.

/** Rótulos do que torna um laudo exemplar (curadoria direcionada). */
export type QualityTag = 'fraseologia' | 'estrutura' | 'diagnostico-diferencial' | 'conduta' | 'classificacao';

export interface ExcellenceEntry {
  id: string;
  area: ExamArea;
  examType: string;
  motor: 'lite' | 'pro';
  /** Conteúdo do laudo JÁ ANONIMIZADO (HTML). */
  anonymizedContent: string;
  /** Texto clínico de contexto (indicação/anamnese) anonimizado — base do embedding. */
  contextText: string;
  /** Vetor de embedding do contextText (pode ser [] se a vetorização falhou). */
  embedding: number[];
  qualityTags: QualityTag[];
  sourceExamId?: string;
  approvedAt: number;
}

function corpusRef(uid: string) {
  return collection(firestore, `users/${uid}/excellence_corpus`);
}

/** Remove undefined recursivamente (Firestore rejeita undefined). */
function clean<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

/**
 * Adiciona um laudo ao corpus de excelência. Anonimiza, valida PII
 * residual (gate de segurança) e vetoriza o contexto antes de persistir.
 * Lança erro se PII residual for detectada — NUNCA persiste dado sensível.
 */
export async function addToExcellenceCorpus(params: {
  area: ExamArea;
  examType: string;
  motor: 'lite' | 'pro';
  reportHtml: string;
  clinicalIndication?: string;
  anamnesis?: string;
  patient?: Patient | null;
  qualityTags: QualityTag[];
  sourceExamId?: string;
  settings: AppSettings;
}): Promise<ExcellenceEntry> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');

  // 1. Anonimização obrigatória (LGPD).
  const anonReport = anonymizeReport(params.reportHtml, params.patient).text;
  const contextRaw = `${params.clinicalIndication || ''} ${params.anamnesis || ''}`.trim();
  const anonContext = anonymizeReport(contextRaw, params.patient).text;

  // 2. Gate de PII residual — bloqueia persistência se algo escapou.
  const residual = [...detectResidualPII(anonReport), ...detectResidualPII(anonContext)];
  if (residual.length > 0) {
    throw new Error(`Anonimização incompleta — PII residual detectada (${[...new Set(residual)].join(', ')}). Laudo NÃO foi salvo no corpus.`);
  }

  // 3. Vetorização (degrada graciosamente se falhar — entry sem embedding).
  const embedding = await embedText(`${params.examType}. ${anonContext}`, params.settings);

  const id = doc(corpusRef(uid)).id;
  const entry: ExcellenceEntry = {
    id,
    area: params.area,
    examType: params.examType,
    motor: params.motor,
    anonymizedContent: anonReport,
    contextText: anonContext,
    embedding,
    qualityTags: params.qualityTags,
    sourceExamId: params.sourceExamId,
    approvedAt: Date.now(),
  };

  await setDoc(doc(corpusRef(uid), id), clean(entry));
  logger.info(`[Corpus] Laudo adicionado ao corpus de excelência (${params.area}/${params.examType}).`);
  return entry;
}

/**
 * Lista entradas do corpus por área (candidatos para retrieval).
 * Limite generoso: usa TODOS os laudos da área do médico como candidatos
 * (o ranqueamento por similaridade escolhe os melhores). Filtrar por área
 * mantém o payload proporcional, não o corpus inteiro.
 */
export async function listExcellenceCorpus(area?: ExamArea, max = 2000): Promise<ExcellenceEntry[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const base = corpusRef(uid);
    const q = area
      ? query(base, where('area', '==', area), orderBy('approvedAt', 'desc'), fsLimit(max))
      : query(base, orderBy('approvedAt', 'desc'), fsLimit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ExcellenceEntry);
  } catch (err) {
    logger.warn('[Corpus] Falha ao listar corpus:', err);
    return [];
  }
}

/**
 * Conta o total de laudos no corpus SEM limite, via agregação do servidor
 * (getCountFromServer) — barato e sem baixar documentos. Fonte da verdade
 * para o número exibido (não capado em 500).
 */
export async function countExcellenceCorpus(): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) return 0;
  try {
    const snap = await getCountFromServer(corpusRef(uid));
    return snap.data().count;
  } catch (err) {
    logger.warn('[Corpus] Falha ao contar corpus:', err);
    return 0;
  }
}

/** Remove uma entrada do corpus. */
export async function removeFromExcellenceCorpus(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(corpusRef(uid), id));
}
