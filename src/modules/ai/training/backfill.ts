import { collection, getDocs, query, where, doc, writeBatch } from 'firebase/firestore';
import { firestore, auth } from '../../../lib/firebase';
import { AppSettings, ExamArea, Patient, ExamRequest } from '../../../types';
import { logger } from '../../../utils/logger';
import { auditReportQuality } from '../engine';
import { anonymizeReport, detectResidualPII } from './anonymize';
import { ExcellenceEntry } from './excellenceCorpus';

// ═══════════════════════════════════════════════════════════════
// BACKFILL DO CORPUS — bootstrap com laudos finalizados existentes
// ═══════════════════════════════════════════════════════════════
// Aproveita o histórico de laudos finalizados (produzidos com o sistema
// de prompts) para popular o Corpus de Excelência de uma vez, deixando o
// retrieval funcional imediatamente.
//
// Decisões:
//  • Anonimização LGPD obrigatória (nome via Patient + regex) + gate de
//    PII residual: laudos com PII que escapou são PULADOS, nunca salvos.
//  • Filtro de qualidade: só entram laudos com auditReportQuality acima
//    do limiar (descarta laudos truncados/quebrados).
//  • Idempotente: pula laudos já importados (dedupe por sourceExamId).
//  • SEM embeddings nesta etapa (instantâneo, sem rate-limit). O retrieval
//    opera via fallback por tipo de exame; a vetorização pode ser feita
//    depois, incrementalmente.

export interface BackfillOptions {
  /** Score mínimo de auditoria para um laudo entrar (0-100). */
  minAuditScore?: number;
  /** Máximo de laudos por tipo de exame (evita um exame dominar o corpus). */
  maxPerExamType?: number;
  /** Progresso (processados, total). */
  onProgress?: (done: number, total: number) => void;
}

export interface BackfillResult {
  total: number;
  imported: number;
  skippedExisting: number;
  skippedLowQuality: number;
  skippedPII: number;
  skippedEmpty: number;
}

function userCol(name: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado.');
  return collection(firestore, `users/${uid}/${name}`);
}

function clean<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/**
 * Importa laudos finalizados para o Corpus de Excelência.
 * Roda no contexto autenticado do usuário (cada médico popula o seu).
 */
export async function backfillCorpusFromFinalized(
  settings: AppSettings,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const minAuditScore = options.minAuditScore ?? 60;
  const maxPerExamType = options.maxPerExamType ?? 40;

  // 1. Carrega pacientes num mapa (para anonimizar nomes).
  const patientMap = new Map<string, Patient>();
  try {
    const psnap = await getDocs(userCol('patients'));
    psnap.forEach((d) => patientMap.set(d.id, { ...(d.data() as Patient), id: d.id }));
  } catch (err) {
    logger.warn('[Backfill] Não foi possível carregar pacientes (seguindo só com regex):', err);
  }

  // 2. Carrega laudos já no corpus (dedupe por sourceExamId).
  const existing = new Set<string>();
  try {
    const csnap = await getDocs(userCol('excellence_corpus'));
    csnap.forEach((d) => {
      const src = (d.data() as ExcellenceEntry).sourceExamId;
      if (src) existing.add(src);
    });
  } catch (err) {
    logger.warn('[Backfill] Falha ao ler corpus existente:', err);
  }

  // 3. Carrega exames finalizados.
  const fsnap = await getDocs(query(userCol('exams'), where('status', '==', 'finalizado')));
  const exams = fsnap.docs.map((d) => ({ ...(d.data() as ExamRequest), id: d.id }));

  const result: BackfillResult = {
    total: exams.length,
    imported: 0,
    skippedExisting: 0,
    skippedLowQuality: 0,
    skippedPII: 0,
    skippedEmpty: 0,
  };

  const perExamType = new Map<string, number>();
  const motor: 'lite' | 'pro' = settings.selectedMotor === 'pro' ? 'pro' : 'lite';

  // 4. Processa em lotes (writeBatch, máx 400 por lote).
  let batch = writeBatch(firestore);
  let batchCount = 0;
  const flush = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = writeBatch(firestore);
      batchCount = 0;
    }
  };

  for (let i = 0; i < exams.length; i++) {
    const exam = exams[i];
    options.onProgress?.(i + 1, exams.length);

    const html = exam.reportContent || '';
    if (!html || html.trim().length < 80) { result.skippedEmpty++; continue; }
    if (exam.id && existing.has(exam.id)) { result.skippedExisting++; continue; }

    const examType = exam.examType || 'Exame';
    const used = perExamType.get(examType) || 0;
    if (used >= maxPerExamType) { result.skippedLowQuality++; continue; }

    // Qualidade
    const audit = auditReportQuality(html, exam.area);
    if (audit.score < minAuditScore) { result.skippedLowQuality++; continue; }

    // Anonimização + gate de PII
    const patient = exam.patientId ? patientMap.get(exam.patientId) || null : null;
    const anonReport = anonymizeReport(html, patient).text;
    const contextRaw = `${exam.clinicalIndication || ''} ${exam.anamnesis || ''}`.trim();
    const anonContext = anonymizeReport(contextRaw, patient).text;
    const residual = [...detectResidualPII(anonReport), ...detectResidualPII(anonContext)];
    if (residual.length > 0) { result.skippedPII++; continue; }

    // Monta entrada (sem embedding — fallback por tipo de exame).
    const id = doc(userCol('excellence_corpus')).id;
    const entry: ExcellenceEntry = {
      id,
      area: exam.area as ExamArea,
      examType,
      motor,
      anonymizedContent: anonReport,
      contextText: anonContext,
      embedding: [],
      qualityTags: ['estrutura', 'fraseologia'],
      sourceExamId: exam.id,
      approvedAt: exam.finalizedAt || Date.now(),
    };

    batch.set(doc(userCol('excellence_corpus'), id), clean(entry));
    batchCount++;
    perExamType.set(examType, used + 1);
    result.imported++;

    if (batchCount >= 400) await flush();
  }

  await flush();
  logger.info(`[Backfill] Importação concluída: ${result.imported} laudos no corpus.`);
  return result;
}
