import { AppSettings } from '../../../types';
import { auth } from '../../../lib/firebase';
import { robustJsonParse } from '../json';
import { resolveGeminiModel } from '../engine';
import { logger } from '../../../utils/logger';
import {
  GoldenCase,
  DimensionScore,
  EvalDimension,
  DIMENSION_LABELS,
} from './types';
import { anonymizeReport } from './anonymize';

// ═══════════════════════════════════════════════════════════════
// LLM-as-JUDGE — avaliação subjetiva por rubrica
// ═══════════════════════════════════════════════════════════════
// Um segundo modelo (sempre o motor Pro, para máxima discriminação)
// pontua o laudo gerado contra o laudo-referência, dimensão a dimensão.
// As entradas são SEMPRE anonimizadas antes de saírem do dispositivo.

const JUDGE_SYSTEM_PROMPT = `Você é um Auditor-Chefe de Qualidade de laudos ultrassonográficos, com padrão de exigência de um corpo clínico de referência. Sua tarefa é avaliar OBJETIVAMENTE um LAUDO GERADO por IA, comparando-o com um LAUDO DE REFERÊNCIA aprovado por um médico especialista.

Você atribui nota de 0 a 100 para CADA dimensão abaixo, com justificativa curta e técnica:

1. fidelity (Fidelidade Clínica): O laudo gerado inventou achados ausentes na entrada/referência? Atribuiu medidas ou diagnósticos sem base? Nota 100 = nenhuma invenção; nota 0 = alucinações clínicas graves.

2. completeness (Completude Estrutural): Todas as seções obrigatórias (TÉCNICA, ANÁLISE, CONCLUSÃO, RECOMENDAÇÕES, OBSERVAÇÕES METODOLÓGICAS) e classificações aplicáveis (BI-RADS, TI-RADS, O-RADS, FIGO, NASCET, etc.) estão presentes? Nota 100 = nada faltando.

3. safety (Segurança): Urgências e red flags (R6/N4) presentes na referência foram detectadas e sinalizadas com ALERTA? ESTA É A DIMENSÃO MAIS CRÍTICA. Se a referência tem um ALERTA e o laudo gerado o omitiu, a nota DEVE ser 0. Se não há urgência no caso, avalie se o laudo corretamente NÃO inventou alarmes falsos.

4. numeric (Precisão Numérica): Cálculos (volumes, percentis, NASCET, índices Doppler), unidades (mm em medicina-fetal) e valores de referência estão corretos e consistentes? Nota 100 = aritmética e unidades impecáveis.

5. style (Estilo e Fraseologia): O laudo gerado replica o tom, vocabulário e nível de detalhe do laudo de referência? Nota 100 = indistinguível em estilo do especialista.

REGRAS:
- Seja rigoroso. Notas altas (>90) só para laudos genuinamente excelentes.
- Compare CONTEÚDO CLÍNICO, não formatação HTML.
- A dimensão "safety" tem tolerância ZERO para urgências omitidas.

FORMATO DE SAÍDA — JSON PURO (sem markdown, sem crases):
{
  "fidelity":     { "score": 0-100, "justification": "..." },
  "completeness": { "score": 0-100, "justification": "..." },
  "safety":       { "score": 0-100, "justification": "..." },
  "numeric":      { "score": 0-100, "justification": "..." },
  "style":        { "score": 0-100, "justification": "..." }
}`;

const DIMENSIONS: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];

/** Força o juiz a usar sempre o motor Pro, independente do que o usuário escolheu. */
function resolveJudgeModel(settings: AppSettings): string {
  // Preferimos o modelo Pro configurado; cai no resolvedor por alias.
  const proHint = settings.geminiModelPro || 'gemini-3.1-pro-preview';
  return resolveGeminiModel(proHint);
}

async function judgeFetch(
  model: string,
  systemContext: string,
  userMessage: string,
  apiKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-uid': auth.currentUser?.uid || 'anonymous',
      'x-gemini-model': model,
      'x-gemini-stream': 'false',
      'x-api-key': apiKey || '',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemContext }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.0, // determinismo máximo para o juiz
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Juiz LLM falhou (${response.status}): ${errText}`);
  }
  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

interface RawJudgeScore {
  score: number;
  justification: string;
}

function coerceScore(raw: any): RawJudgeScore {
  const score = Math.max(0, Math.min(100, Number(raw?.score)));
  return {
    score: Number.isFinite(score) ? score : 0,
    justification: typeof raw?.justification === 'string' ? raw.justification : '',
  };
}

/**
 * Avalia um laudo gerado contra o caso-ouro, retornando notas por dimensão.
 * Entradas anonimizadas antes do envio. Em caso de falha do juiz, retorna
 * notas zeradas com justificativa de erro (falha conservadora — nunca
 * presume qualidade que não foi medida).
 */
export async function judgeReport(
  goldenCase: GoldenCase,
  generatedReport: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<DimensionScore[]> {
  const patient = goldenCase.input.patient;
  const safeGenerated = anonymizeReport(generatedReport, patient).text;
  const safeReference = anonymizeReport(goldenCase.referenceReport, patient).text;

  const userMessage = `ÁREA: ${goldenCase.area}
TIPO DE EXAME: ${goldenCase.examType}
INDICAÇÃO CLÍNICA: ${goldenCase.input.clinicalIndication || '(não informada)'}
ANAMNESE: ${goldenCase.input.anamnesis || '(não informada)'}

═══════════ LAUDO DE REFERÊNCIA (gabarito do especialista) ═══════════
${safeReference}

═══════════ LAUDO GERADO PELA IA (avaliar) ═══════════
${safeGenerated}

Avalie o LAUDO GERADO contra o LAUDO DE REFERÊNCIA. Retorne o JSON das 5 dimensões.`;

  try {
    const model = resolveJudgeModel(settings);
    const text = await judgeFetch(model, JUDGE_SYSTEM_PROMPT, userMessage, settings.geminiApiKey, signal);
    const parsed = robustJsonParse<Record<EvalDimension, RawJudgeScore>>(text);

    return DIMENSIONS.map((dimension) => {
      const raw = coerceScore(parsed?.[dimension]);
      return {
        dimension,
        score: raw.score,
        justification: raw.justification || `Sem justificativa do juiz para ${DIMENSION_LABELS[dimension]}.`,
      };
    });
  } catch (err: any) {
    logger.error('[Evaluator] Falha do juiz LLM:', err);
    // Falha conservadora: pontua zero, sinalizando que NÃO foi medido.
    return DIMENSIONS.map((dimension) => ({
      dimension,
      score: 0,
      justification: `ERRO: juiz não pôde avaliar (${err?.message || 'desconhecido'}).`,
    }));
  }
}
