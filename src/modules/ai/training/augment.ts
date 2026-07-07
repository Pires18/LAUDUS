import { AppSettings, ExamArea } from '../../../types';
import { logger } from '../../../utils/logger';
import { embedText } from './embeddings';
import { listExcellenceCorpus } from './excellenceCorpus';
import { getPersonalCalibration } from './feedbackStore';
import { selectExamples, buildFewShotBlock } from './retrieval';

// ═══════════════════════════════════════════════════════════════
// AUGMENTAÇÃO POR RETRIEVAL — ponte entre o corpus e o motor
// ═══════════════════════════════════════════════════════════════
// Chamada pelo engine antes da geração. Busca os laudos-modelo mais
// similares do Corpus de Excelência e devolve um bloco few-shot para
// reforçar o estilo/qualidade. Degrada SEMPRE graciosamente: qualquer
// falha (rede, vetorização, corpus vazio) retorna '' e a geração segue
// normalmente, sem reforço.

export interface RetrievalParams {
  area: ExamArea;
  examType: string;
  motor: 'lite' | 'pro';
  clinicalIndication?: string;
  anamnesis?: string;
  settings: AppSettings;
  signal?: AbortSignal;
}

/**
 * Retorna o bloco few-shot a injetar no contexto, ou '' se desabilitado/
 * indisponível. Gated por settings.aiTrainingEnabled (opt-in).
 */
export async function retrieveFewShotBlock(params: RetrievalParams): Promise<string> {
  if (!params.settings.aiTrainingEnabled) return '';

  try {
    // Calibração pessoal (Camada 0.5) — correções + feedback do médico.
    // Lida em paralelo; degrada para '' se ausente.
    const [candidates, calibration] = await Promise.all([
      listExcellenceCorpus(params.area),
      getPersonalCalibration().catch(() => ''),
    ]);

    let fewShot = '';
    if (candidates.length > 0) {
      const contextText = `${params.examType}. ${params.clinicalIndication || ''} ${params.anamnesis || ''}`.trim();
      const embedding = await embedText(contextText, params.settings, params.signal);
      const examples = selectExamples(
        { examType: params.examType, motor: params.motor, embedding },
        candidates,
        2
      );
      fewShot = buildFewShotBlock(examples);
      if (fewShot) {
        logger.info(`[Retrieval] ${examples.length} exemplo(s) injetado(s) para ${params.area}/${params.examType}.`);
      }
    }

    // Camada 0.5 vem ANTES dos exemplos few-shot.
    return [calibration, fewShot].filter(Boolean).join('\n\n');
  } catch (err) {
    logger.warn('[Retrieval] Falha na augmentação (seguindo sem reforço):', err);
    return '';
  }
}
