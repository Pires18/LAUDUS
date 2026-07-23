import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_STRUCTURE_PROMPT, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_RIGID_RULES, DEFAULT_REFINEMENT_GOLDEN_RULES, DEFAULT_COPILOT_OVERRIDE, DEFAULT_AREA_PROMPTS } from './prompts';
import {
  getInitialReportContent,
  getCombinedInitialReportContent,
  getCombinedTitle,
  combinedExamType,
  sectionTogglesFromSettings,
} from '../templates/utils';
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { auth, firestore } from '../../lib/firebase';
import { logAiUsage } from '../../store/db';
import { logger } from '../../utils/logger';
import { calculateAge } from '../../utils/format';
import { getMotorProfile } from './motorProfiles';
import { GEMINI_MODEL_PRICING } from './modelPricing';
import {
  GEMINI_LITE_MODEL,
  GEMINI_PRO_MODEL,
  VALID_GEMINI_MODELS,
  isValidGeminiModel,
  resolveGeminiModel,
  getFallbackModel,
} from './geminiModels';
import { retrieveFewShotBlock } from './training/augment';
import { scrubForGeneration } from './training/anonymize';

// ─── Interfaces públicas ─────────────────────────────────────────────────────

interface GenerateReportParams {
  examId?: string;
  template: ReportTemplate;
  /** Exame combinado: máscaras ordenadas (1ª = primária). Ausente/1 = exame simples. */
  templates?: ReportTemplate[];
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
  patientPreviousExams?: string[];
  examDateMs?: number;
  signal?: AbortSignal;
}

interface CopilotParams {
  examId?: string;
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string; anamnesis?: string; createdAt?: number; examDate?: number };
  settings: AppSettings;
  previousExams?: string[];
  patientPreviousExams?: string[];
  template?: ReportTemplate | null;
  /** Exame combinado: máscaras ordenadas (1ª = primária). Ausente/1 = exame simples. */
  templates?: ReportTemplate[] | null;
  signal?: AbortSignal;
}

interface RefineParams {
  examId?: string;
  currentReport: string;
  template: ReportTemplate;
  /** Exame combinado: máscaras ordenadas (1ª = primária). Ausente/1 = exame simples. */
  templates?: ReportTemplate[];
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
  patientPreviousExams?: string[];
  customPrompt?: string;
  examDateMs?: number;
  signal?: AbortSignal;
}

export interface BuiltPrompt {
  universalContext: string;
  areaContext: string;
  userMessage: string;
}

export interface CallMetrics {
  examId?: string;
  mode: 'generation' | 'refine' | 'copilot' | 'template';
  provider: 'gemini';
  area: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualOutputTokens?: number;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  scratchpad?: string;
  modelName?: string;
  promptHash?: string;
}

function hashPrompt(built: BuiltPrompt): string {
  const content = built.universalContext.slice(0, 500) + built.areaContext.slice(0, 200);
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const callMetricsHistory: CallMetrics[] = [];

// Fonte única de preço por modelo: modelPricing.ts (também usada pela tabela
// de referência do Admin, IACostsTab — evita duas cópias desincronizadas).
const PRICING = GEMINI_MODEL_PRICING;

function recordMetrics(m: CallMetrics) {
  callMetricsHistory.unshift(m);
  if (callMetricsHistory.length > 20) callMetricsHistory.pop();

  if (m.success && m.modelName) {
    const prices = PRICING[m.modelName];
    if (!prices) {
      // Modelo sem preço mapeado custaria $0 em silêncio (a Gemini troca IDs de
      // modelo preview com frequência) — melhor um erro visível (vai pro Sentry
      // via logger.error) do que uma métrica de custo errada sem ninguém notar.
      logger.error(`[engine] Modelo "${m.modelName}" sem preço mapeado em PRICING — custo desta chamada registrado como $0.`);
    }
    const { input, output } = prices || { input: 0, output: 0 };
    const costUsd = ((m.estimatedInputTokens / 1000000) * input) + ((m.estimatedOutputTokens / 1000000) * output);
    
    // Log asynchronously
    logAiUsage({
      examId: m.examId,
      model: m.modelName,
      provider: m.provider,
      inputTokens: m.estimatedInputTokens,
      outputTokens: m.estimatedOutputTokens,
      costUsd,
      area: m.area,
      promptHash: m.promptHash
    }).catch(() => {});
  }
}

// ─── Temperatura adaptativa por modo ────────────────────────────────────────

const TEMPERATURE_BY_MODE: Record<string, number> = {
  generation: 0.35,  // Mais fluidez narrativa
  refine:     0.10,  // Máxima fidelidade cirúrgica
  copilot:    0.20,  // Balanceado
  template:   0.20,  // Consistência estrutural
};

// ─── maxOutputTokens adaptativo por área ────────────────────────────────────

const MAX_TOKENS_BY_AREA: Partial<Record<ExamArea, number>> = {
  'medicina-fetal':    16384,   // Morfologia + doppler + biometria = laudos longos
  'ginecologia':       12288,
  'vascular':          10240,
  'musculoesqueletico':10240,
  'medicina-interna':  10240,
  'pediatria':         10240,
  'mastologia':        10240,
  'pequenas-partes':    8192,
  'reumatologico':      8192,
  'procedimentos':      8192,
};

function getMaxTokens(area: string): number {
  return MAX_TOKENS_BY_AREA[area as ExamArea] ?? 8192;
}

/**
 * Retorna temperatura adaptativa por modo.
 * Prioridade: settings.aiTemperatureByMode[mode] → override legado → default hardcoded
 */
function getModeTemperature(mode: string, override?: number, settings?: AppSettings): number {
  // 1. Override explícito (legado, vindo direto como número)
  if (override !== undefined && override >= 0 && override <= 1) return override;
  // 2. Configuração por modo nas settings (novo)
  const byMode = settings?.aiTemperatureByMode;
  if (byMode) {
    const configured = byMode[mode as keyof typeof byMode];
    if (configured !== undefined && configured >= 0 && configured <= 1) return configured;
  }
  // 3. Default hardcoded
  return TEMPERATURE_BY_MODE[mode] ?? 0.3;
}

// ─── Retry com exponential backoff ──────────────────────────────────────────
// Implementação movida para retry.ts: além de exceções, re-tenta respostas
// HTTP com status transitório (fetch não lança em 429/503).
import { withRetry } from './retry';

// ─── Helpers utilitários ─────────────────────────────────────────────────────

/**
 * Estima tokens (heurística: 1 token ~= 3.5 caracteres para pt-BR)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Trunca laudos anteriores respeitando limites de tokens.
 * Respeita aiTrainingEnabled: false — retorna [] se desabilitado.
 * Se um laudo exceder o limite, ele é cortado de forma segura, mantendo o máximo de contexto.
 */
function truncatePreviousExams(
  exams: string[],
  settings: AppSettings,
  maxTokens = 3500 // budget aproximado para histórico
): string[] {
  if (settings.aiTrainingEnabled === false) return [];
  if (!exams || exams.length === 0) return [];

  const result: string[] = [];
  let tokensUsed = 0;

  for (const ex of exams) {
    if (!ex || !ex.trim()) continue;
    
    const exTokens = estimateTokens(ex);
    if (tokensUsed + exTokens <= maxTokens) {
      result.push(ex);
      tokensUsed += exTokens;
    } else {
      // Se não cabe inteiro, trunca o laudo atual para usar o budget restante
      const tokensLeft = maxTokens - tokensUsed;
      if (tokensLeft > 100) { // Só aproveita se sobrar um pedaço significativo
        const charsLeft = Math.floor(tokensLeft * 3.5);
        const truncated = ex.substring(0, charsLeft) + '\n\n...[HISTÓRICO TRUNCADO POR LIMITE DE MEMÓRIA]';
        result.push(truncated);
        tokensUsed += estimateTokens(truncated);
      }
      break; // Limite atingido, ignora os exames mais antigos
    }
  }
  return result;
}

// ─── Builders de contexto ────────────────────────────────────────────────────

function buildUniversalContext(settings: AppSettings): string {
  const master = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const global = settings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
  const skeleton = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rules = settings.aiRigidRules || DEFAULT_RIGID_RULES;

  const parts = [master, global, skeleton, rules];

  // Diferenciação Lite/Pro: injeta a modulação de comportamento do motor
  // efetivo (resolvido após o pro-gating em resolveMotorConfigAndCheckQuota).
  parts.push(getMotorProfile(settings.selectedMotor));

  if (settings.aiFastMode) {
    parts.push(`═══════════════════════════════════════════
ATENÇÃO: MODO RÁPIDO ATIVADO (SEM RACIOCÍNIO)
═══════════════════════════════════════════
REGRA MÁXIMA DE SAÍDA:
NÃO use a tag <scratchpad> nem faça nenhum raciocínio interno ou auto-auditoria.
NÃO comece seu output com <scratchpad> e NUNCA use a tag </scratchpad>.
Inicie sua resposta DIRETA e IMEDIATAMENTE com o HTML do laudo (iniciando com <h1>) ou com o formato de resposta do Copiloto solicitado.
Você deve pular as fases de auditoria e raciocínio prévio.`);
  }
  return parts.join('\n\n');
}

/** Máscaras efetivas de uma chamada: `templates` (combinado) ou `[template]`. */
function effectiveTemplates(
  params: GenerateReportParams | CopilotParams | RefineParams
): ReportTemplate[] {
  const list = (params as { templates?: Array<ReportTemplate | null | undefined> | null }).templates;
  const valid = (list || []).filter((t): t is ReportTemplate => Boolean(t));
  if (valid.length > 0) return valid;
  const single = (params as { template?: ReportTemplate | null }).template;
  return single ? [single] : [];
}

/**
 * buildSpecificContext — monta o contexto de Camada 2 (Área) + Camada 3 (Exame).
 *
 * Prioridade da diretriz de área:
 *   1. Diretriz customizada do usuário (settings.aiAreaPrompts[area])
 *   2. Diretriz padrão do sistema (DEFAULT_AREA_PROMPTS[area])
 *   3. Sem diretriz de área (se a área não tiver padrão definido)
 *
 * Após a(s) diretriz(es) de área, injeta as INSTRUÇÕES ESPECÍFICAS DO EXAME
 * (template.aiInstructions). Exame COMBINADO: uma diretriz por área DISTINTA
 * (ordem de aparição) e um bloco de Camada 3 por máscara, com cabeçalho
 * identificando o exame.
 */
function buildSpecificContext(
  templates: Array<ReportTemplate | null | undefined>,
  settings?: AppSettings,
  fallbackArea?: string
): string {
  const valid = templates.filter((t): t is ReportTemplate => Boolean(t));
  const combined = valid.length > 1;

  // Camada 2 — uma diretriz por área distinta (ordem de aparição)
  const areas: string[] = [];
  for (const t of valid) {
    const a = t.area || fallbackArea;
    if (a && !areas.includes(a)) areas.push(a);
  }
  if (areas.length === 0 && fallbackArea) areas.push(fallbackArea);

  const parts: string[] = [];

  for (const area of areas) {
    const customAreaPrompt = settings?.aiAreaPrompts?.[area as ExamArea];
    const defaultAreaPrompt = DEFAULT_AREA_PROMPTS[area];
    const areaPrompt = (customAreaPrompt && customAreaPrompt.trim())
      ? customAreaPrompt.trim()
      : (defaultAreaPrompt && defaultAreaPrompt.trim())
        ? defaultAreaPrompt.trim()
        : null;
    if (areaPrompt) {
      parts.push(`═══════════════════════════════════════════\nINSTRUÇÕES DA ÁREA DE ${area.toUpperCase()}:\n═══════════════════════════════════════════\n${areaPrompt}`);
    }
  }

  // Camada 3 — Instruções Específicas de cada Exame
  for (const template of valid) {
    const area = template.area || fallbackArea;
    if (template.aiInstructions && template.aiInstructions.trim()) {
      const header = combined
        ? `INSTRUÇÕES ESPECÍFICAS DO EXAME — ${template.name}:`
        : 'INSTRUÇÕES ESPECÍFICAS DO EXAME:';
      parts.push(`═══════════════════════════════════════════\n${header}\n═══════════════════════════════════════════\n${template.aiInstructions.trim()}`);
    } else if (area === 'medicina-fetal') {
      // Degradação silenciosa (auditoria D5): exame fetal sem Camada 3 gera laudo só com
      // Camadas 1+2. Sinalizar para não passar despercebido (o template no Firestore pode
      // estar sem aiInstructions — reexecutar o deploy: scripts/deploy-templates.mjs).
      console.warn(`[LAUD.IA] Template de medicina-fetal sem aiInstructions (Camada 3 ausente): "${template.name || template.id}". Laudo será gerado apenas com as Camadas Universal + Área.`);
    }
  }

  return parts.join('\n\n');
}

function buildMaskHtml(templates: ReportTemplate[], settings?: AppSettings): string {
  const withClassification = settings?.laudIaClassificationEnabled !== false;
  const withRecommendations = settings?.laudIaRecommendationsEnabled !== false;
  const withObservations = settings?.laudIaMethodologicalObsEnabled !== false;

  const templateParts = (template: ReportTemplate): string[] => {
    const sections = [
      `TÍTULO:\n${template.title}`,
      `TÉCNICA:\n${template.technique}`,
      `ANÁLISE:\n${template.analysisTemplate}`,
      `CONCLUSÃO:\n${template.conclusionTemplate}`,
    ];
    if (withClassification && template.classificationTemplate) {
      sections.push(`CLASSIFICAÇÃO:\n${template.classificationTemplate}`);
    }
    if (withRecommendations) {
      sections.push(`RECOMENDAÇÕES:\n${template.recommendationsTemplate}`);
    }
    if (withObservations && template.observationsTemplate) {
      sections.push(`OBSERVAÇÕES METODOLÓGICAS:\n${template.observationsTemplate}`);
    }
    return sections;
  };

  const parts: string[] = [];
  if (templates.length > 1) {
    parts.push(
      `LAUDO COMBINADO (${combinedExamType(templates)}): gere UM ÚNICO laudo com UM único <h1> exatamente "${getCombinedTitle(templates)}".
REGRAS DE UNIFICAÇÃO (obrigatórias, seção a seção):
1. TÉCNICA: redija UM ÚNICO parágrafo coeso e fluente unificando vias de acesso, transdutores, preparos e fases dos exames. PROIBIDO repetir "Exame realizado" mais de uma vez ou empilhar as técnicas em parágrafos separados.
2. ANÁLISE: uma única seção com os compartimentos de TODOS os exames na ordem apresentada. Órgão avaliado pelos dois exames (ex.: bexiga) aparece UMA única vez, integrando as informações exigidas por ambos.
3. CLASSIFICAÇÕES (quando presente) e CONCLUSÃO: únicas, cobrindo os achados de todos os exames — bullets na ordem dos exames, sem repetir a mesma frase de normalidade.
4. RECOMENDAÇÕES: únicas, sem recomendações duplicadas entre os exames.
5. OBSERVAÇÕES METODOLÓGICAS: UM único bloco sem frases repetidas — unifique o texto operador-dependente numa só menção e cite TODAS as diretrizes/classificações aplicáveis dos exames (CBR, LI-RADS, O-RADS, Bosniak etc.) numa única frase.
PROIBIDO empilhar dois laudos, repetir títulos de seção ou emitir mais de um <h1>.`
    );
    templates.forEach((t, i) => {
      parts.push(`═══ EXAME ${i + 1} — ${t.name} ═══`);
      parts.push(...templateParts(t));
    });
  } else if (templates[0]) {
    parts.push(...templateParts(templates[0]));
  }

  // Seções desligadas pelo usuário são omitidas do corpo gerado pela IA.
  const omit: string[] = [];
  if (!withClassification) omit.push('CLASSIFICAÇÃO');
  if (!withRecommendations) omit.push('RECOMENDAÇÕES');
  if (!withObservations) omit.push('OBSERVAÇÕES METODOLÓGICAS');
  if (omit.length > 0) {
    parts.push(
      `INSTRUÇÃO DE SEÇÕES (usuário): NÃO inclua no laudo a(s) seção(ões): ${omit.join(', ')}. ` +
        `Omita completamente esse(s) título(s) e seu conteúdo.`
    );
  }
  return parts.join('\n\n');
}

function buildContextMessage({
  mode,
  examType,
  patient,
  clinicalIndication,
  anamnesis,
  notes,
  maskHtml,
  originalMaskHtml,
  requestingPhysician,
  previousExams = [],
  patientPreviousExams = [],
  examDateMs,
}: {
  mode: 'GERAÇÃO INICIAL' | 'REFINAMENTO';
  examType: string;
  patient: Patient | null;
  clinicalIndication: string;
  anamnesis?: string;
  notes: string;
  maskHtml: string;
  originalMaskHtml?: string;
  requestingPhysician?: string;
  previousExams?: string[];
  patientPreviousExams?: string[];
  examDateMs?: number;
}): string {
  const dateObj = examDateMs ? new Date(examDateMs) : new Date();
  const examDate = dateObj.toLocaleDateString('pt-BR');
  const patientAge = patient?.birthDate ? calculateAge(patient.birthDate, examDateMs) : 'Não informada';
  const genderMap = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;
  const patientGender = patient?.gender ? genderMap[patient.gender as keyof typeof genderMap] || 'Não informado' : 'Não informado';

  const lines: string[] = [
    `MODO: ${mode}`,
    `EXAME: ${examType}`,
    `DATA DO EXAME: ${examDate} (ATENÇÃO: Use ESTA data como o "Hoje" para qualquer cálculo de datas no laudo, como DPP ou Idade Gestacional. PROIBIDO usar a data atual real do sistema.)`,
    // LGPD: o nome do paciente NÃO é enviado à IA (não é usado no corpo do
    // laudo — entra só no cabeçalho, via template, na exportação).
    `PACIENTE: ${patientAge}, ${patientGender}`,
  ];
  if (patient?.insurance) lines.push(`CONVÊNIO: ${patient.insurance}`);
  if (patient?.history) lines.push(`HISTÓRICO CLÍNICO: ${scrubForGeneration(patient.history, patient)}`);
  lines.push(`INDICAÇÃO: ${clinicalIndication || 'Não informada'}`);
  if (requestingPhysician) lines.push(`MÉDICO SOLICITANTE: ${requestingPhysician}`);

  if (anamnesis && anamnesis.trim()) {
    lines.push(`\nANAMNESE DO PACIENTE (dados da consulta — usar como contexto clínico prioritário para calibrar descrição, conclusão e recomendações):\n${scrubForGeneration(anamnesis.trim(), patient)}`);
  }

  const notesLabel = mode === 'GERAÇÃO INICIAL' ? 'NOTAS DO MÉDICO' : 'INSTRUÇÃO DE ALTERAÇÃO';
  lines.push(`${notesLabel}: ${notes || 'Nenhuma nota adicional.'}`);

  // Referências de estilo (laudos de outros exames) — limpeza estrutural de
  // identificadores diretos (CPF/telefone/e-mail); datas/medidas preservadas.
  const prevContext = previousExams.length > 0
    ? `\n\nREFERÊNCIA DE ESTILO (laudos anteriores — mimetize APENAS o estilo de escrita, NUNCA copie dados clínicos):\n[INÍCIO DOS EXEMPLOS]\n${previousExams.map((e) => scrubForGeneration(e)).join('\n\n---\n\n')}\n[FIM DOS EXEMPLOS]`
    : '';

  // Histórico do MESMO paciente — remove o nome nominal conhecido, preserva
  // datas e medidas (essenciais para a análise de evolução).
  const patientHistoryBlock = patientPreviousExams && patientPreviousExams.length > 0
    ? `\n\n═══════════════════════════════════════════\nHISTÓRICO CLÍNICO ANTERIOR DO PACIENTE:\n═══════════════════════════════════════════\nVocê tem acesso aos exames passados deste paciente na mesma especialidade. Seu dever máximo é atuar como médico analista: cruze as medidas e informações do INPUT ATUAL com o HISTÓRICO abaixo e descreva ativamente a evolução clínica (ex: informe se um nódulo aumentou de volume, se um cisto regrediu, ou se a biometria evoluiu normalmente comparado ao exame anterior). NÃO copie o laudo antigo, apenas use-o para inferir a EVOLUÇÃO cronológica da doença ou gestação.\n\n[INÍCIO DO HISTÓRICO DO PACIENTE]\n${patientPreviousExams.map((e) => scrubForGeneration(e, patient)).join('\n\n---\n\n')}\n[FIM DO HISTÓRICO DO PACIENTE]`
    : '';

  const maskLabel = mode === 'GERAÇÃO INICIAL'
    ? 'MÁSCARA DE REFERÊNCIA'
    : 'LAUDO ATUAL (modificar conforme instrução acima)';

  const originalMaskBlock = originalMaskHtml
    ? `\n\n═══════════════════════════════════════════\nMÁSCARA MODELO ORIGINAL DO EXAME (ÂNCORA ESTRUTURAL E TEXTUAL RÍGIDA):\n═══════════════════════════════════════════\nUse o HTML abaixo apenas como a referência absoluta de estrutura de seções, nomenclatura de títulos, parágrafos, ordem e texto padrão que devem ser preservados para os órgãos inalterados:\n${originalMaskHtml}\n`
    : '';

  return `${lines.join('\n')}${prevContext}${patientHistoryBlock}${originalMaskBlock}

${maskLabel}:
${maskHtml}`;
}

/**
 * Remove raciocínio interno do modelo do output — defesa multicamada.
 */
export function stripScratchpad(text: string, disableHtmlExtraction = false): string {
  if (!text) return '';
  
  const lower = text.toLowerCase();
  
  // Fast-path bypass check during streaming:
  // If a scratchpad tag is open but not yet closed, we can assume the AI is still in its reasoning phase
  // and no actual content has been generated. Returning an empty string avoids executing multiple heavy regex operations.
  const hasOpenScratch = lower.includes('<scratchpad>') && !lower.includes('</scratchpad>');
  const hasOpenThink = lower.includes('<think>') && !lower.includes('</think>');
  const hasOpenThinking = lower.includes('<thinking>') && !lower.includes('</thinking>');
  const hasOpenThought = lower.includes('<thought>') && !lower.includes('</thought>');
  
  if (hasOpenScratch || hasOpenThink || hasOpenThinking || hasOpenThought) {
    return '';
  }

  let cleaned = text;

  // Optimize: Only run regexes if corresponding patterns are actually present
  const hasScratchTags = /<\s*\/?\s*(scratchpad|think|thinking|thought)/i.test(cleaned);
  const hasCodeBlocks = /```/.test(cleaned);

  if (hasScratchTags) {
    // 1A. Remove complete scratchpad/thinking blocks first. Handles spaces inside tags.
    cleaned = cleaned.replace(/<\s*(scratchpad|think|thinking|thought)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    
    // 1B. For any remaining unclosed scratchpad tags (e.g., streaming or forgotten closing tag),
    // remove from the opening tag up to the first valid content marker or end of string.
    cleaned = cleaned.replace(/<\s*(scratchpad|think|thinking|thought)\s*>[\s\S]*?(?====\s*CONVERSA|===\s*PROPOSTA|<h[1-6][\s>]|$)/gi, '');
  }

  if (hasCodeBlocks) {
    // 2. Remove python/tool_code/code blocks (internal tool calls)
    cleaned = cleaned.replace(/```(?:tool_code|python|code|javascript|typescript|bash)[\s\S]*?```/gi, '');
  }

  if (hasScratchTags) {
    // 3. Remove any loose closing/opening tags just in case
    cleaned = cleaned.replace(/<\s*\/?\s*(scratchpad|think|thinking|thought)\s*>/gi, '');
  }

  if (hasCodeBlocks) {
    // 5. Keep HTML block contents but strip markdown backticks if wrapped in them
    cleaned = cleaned.replace(/```html\s*([\s\S]*?)\s*```/gi, '$1');
    cleaned = cleaned.replace(/```\s*([\s\S]*?)\s*```/gi, '$1');
  }

  // 6. Clean leading/trailing markdown from the response
  cleaned = cleanMarkdownFromResponse(cleaned);

  // 7. Extract HTML content if it doesn't have copilot format
  if (!disableHtmlExtraction) {
    const hasCopilotFormat = cleaned.includes('=== CONVERSA ===') || cleaned.includes('=== PROPOSTA ===');
    if (!hasCopilotFormat) {
      // Find the first HTML tag to trim conversational filler like "Claro, aqui está..."
      const firstTagMatch = cleaned.match(/<\w+[\s>]/);
      if (firstTagMatch && firstTagMatch.index && firstTagMatch.index > 0) {
        cleaned = cleaned.substring(firstTagMatch.index);
      }
    }
  }

  return cleaned.trim();
}

function cleanMarkdownFromResponse(text: string): string {
  return text
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function extractScratchpad(text: string): string | undefined {
  const match = text.match(/<\s*(scratchpad|think|thinking|thought)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/i);
  if (match) return match[2].trim();
  
  const unclosedMatch = text.match(/<\s*(scratchpad|think|thinking|thought)\s*>([\s\S]*?)(?====\s*CONVERSA|===\s*PROPOSTA|<h[1-6][\s>]|$)/i);
  if (unclosedMatch) return unclosedMatch[2].trim();
  
  return undefined;
}

export async function extractCalculatorData(
  reportContent: string,
  calcDef: { id: string, name: string, description: string },
  settings: AppSettings,
  signal?: AbortSignal
): Promise<any> {
  const aiProvider = new GeminiProvider();
  const systemContext = `Você é um assistente médico especialista em ultrassonografia e radiologia.
Sua tarefa é ler um texto (laudo médico) e extrair os dados necessários para preencher a calculadora clínica chamada "${calcDef.name}".
A calculadora faz o seguinte: "${calcDef.description}".

Regras:
1. Extraia estritamente os valores mencionados no texto.
2. Não invente valores se eles não existirem no laudo.
3. Retorne a resposta em formato JSON válido, respeitando os campos que essa calculadora espera.
4. Para a calculadora TI-RADS, por exemplo, retorne: { "lesions": [{ "location": string, "d1": number, "d2": number, "d3": number, "composition": number (0-2), "echogenicity": number (0-3), "shape": number (0,3), "margin": number (0-3), "echogenicFoci": number[] (0-3) }] }
5. Para calculadoras de volume simples: { "d1": number, "d2": number, "d3": number }
6. Você deve inferir os campos esperados baseado no nome e descrição da calculadora, caso não tenha recebido o schema completo.

Retorne APENAS um objeto JSON.`;

  const built: BuiltPrompt = {
    universalContext: systemContext,
    areaContext: '',
    userMessage: `Extraia os dados para a calculadora ${calcDef.name} a partir deste laudo:\n\n${reportContent}`
  };

  try {
    return await aiProvider.extractJson(
      built,
      settings,
      'geral',
      signal,
      {
        withRetry,
        cleanMarkdownFromResponse,
        extractScratchpad,
        stripScratchpad,
        getMaxTokens,
        getModeTemperature,
      }
    );
  } catch (error) {
    logger.error('Erro na extração de dados da calculadora', error);
    throw error;
  }
}

// ─── Auditoria Estrutural Simples ──────────────────────────────────────────────────────

export function buildPrompt(params: GenerateReportParams): BuiltPrompt {
  const {
    patient,
    clinicalIndication,
    requestingPhysician,
    anamnesis,
    settings,
    previousExams = [],
    patientPreviousExams = [],
    examDateMs,
  } = params;
  const tpls = effectiveTemplates(params);
  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(tpls, settings);
  // Guarda de tamanho de contexto (auditoria D3): as 3 camadas (Universal + Área + Exame)
  // são enviadas inteiras, sem truncagem. Avisar se o contexto de sistema ficar grande
  // demais para a janela do modelo — o corte ocorreria no proxy, sem sinal ao usuário.
  const SYSTEM_CONTEXT_TOKEN_WARN = 250_000;
  const systemTokens = estimateTokens(universalContext) + estimateTokens(areaContext);
  if (systemTokens > SYSTEM_CONTEXT_TOKEN_WARN) {
    console.warn(`[LAUD.IA] Contexto de sistema grande (~${Math.round(systemTokens / 1000)}k tokens) para o exame "${combinedExamType(tpls)}". Risco de exceder a janela do modelo — revise as camadas de prompt (Universal + Área + Exame).`);
  }
  const maskHtml = buildMaskHtml(tpls, settings);
  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const safePatientExams = truncatePreviousExams(patientPreviousExams, settings, 2500);

  const contextMessage = buildContextMessage({
    mode: 'GERAÇÃO INICIAL',
    examType: combinedExamType(tpls),
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: clinicalIndication || 'Nenhuma nota adicional do médico.',
    maskHtml,
    requestingPhysician,
    previousExams: safePreviousExams,
    patientPreviousExams: safePatientExams,
    examDateMs,
  });

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

Gere agora o laudo completo em HTML puro. O output deve começar diretamente com <h1>. Zero texto antes do HTML.`;

  return { universalContext, areaContext, userMessage };
}



function buildRefinePrompt(params: RefineParams): BuiltPrompt {
  const {
    currentReport,
    patient,
    settings,
    clinicalIndication,
    requestingPhysician,
    anamnesis,
    previousExams = [],
    patientPreviousExams = [],
    customPrompt,
    examDateMs,
  } = params;
  const tpls = effectiveTemplates(params);
  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(tpls, settings);
  // Respeita regras de refinamento customizadas no settings
  const refinementRules = settings.aiRefinementGoldenRules || DEFAULT_REFINEMENT_GOLDEN_RULES;

  const refineNote = customPrompt
    ? `INSTRUÇÃO DE REFINAMENTO: "${customPrompt}"`
    : `INSTRUÇÃO DE REFINAMENTO ESTRUTURAL (CRÍTICA): Você deve cruzar o LAUDO ATUAL com a MÁSCARA MODELO ORIGINAL. Sua função primária é GARANTIR que nenhuma seção, título, parágrafo de órgão normal ou estrutura da máscara tenha sido apagado ou corrompido no laudo atual. Restaure RIGOROSAMENTE a exata ordem, a formatação em <p> e a estruturação original da máscara, mesclando apenas os dados clínicos patológicos ou medidas inseridos no laudo atual. É proibido suprimir estruturas da máscara.`;

  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const safePatientExams = truncatePreviousExams(patientPreviousExams, settings, 2500);

  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: combinedExamType(tpls),
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: refineNote,
    maskHtml: currentReport,
    originalMaskHtml: getCombinedInitialReportContent(tpls, sectionTogglesFromSettings(settings)),
    requestingPhysician,
    previousExams: safePreviousExams,
    patientPreviousExams: safePatientExams,
    examDateMs,
  });

  const formatRule = settings.aiFastMode
    ? `REGRA ABSOLUTA DE FORMATO:
1. O output DEVE começar direta e imediatamente com a tag <h1>.
2. É ESTRITAMENTE PROIBIDO usar <scratchpad>, <think>, ou qualquer tag de raciocínio.`
    : `NOVA REGRA ABSOLUTA DE FORMATO:
1. O output DEVE começar com a tag <scratchpad> contendo seu raciocínio e Self-Audit detalhado.
2. APÓS fechar a tag </scratchpad>, o laudo deve começar diretamente com a tag <h1>.
ZERO texto, avisos ou mensagens de pensamento fora da tag <scratchpad>.`;

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

${refinementRules}

Gere agora o laudo REFINADO completo em HTML puro. 
${formatRule}`;

  return { universalContext, areaContext, userMessage };
}

function buildCopilotPrompt(params: CopilotParams): BuiltPrompt {
  const {
    instruction,
    currentReport,
    patient,
    exam,
    settings,
    previousExams = [],
    patientPreviousExams = [],
  } = params;
  const tpls = effectiveTemplates(params);
  // Respeita override customizado no settings, com fallback para o default do sistema
  let copilotModeOverride = settings.aiCopilotOverride || DEFAULT_COPILOT_OVERRIDE;
  if (settings.aiFastMode) {
    copilotModeOverride = copilotModeOverride
      .replace(
        `① Abra <scratchpad> e execute raciocínio completo sobre a instrução recebida e o laudo atual.\n② Feche </scratchpad>.\n③ Gere EXATAMENTE a seguinte estrutura (os delimitadores são parseados pelo frontend):`,
        `① É ESTRITAMENTE PROIBIDO usar <scratchpad>, <think> ou descrever qualquer raciocínio.\n② Gere DIRETA, IMEDIATA e EXATAMENTE a seguinte estrutura (os delimitadores são parseados pelo frontend):`
      )
      .replace(
        `① Abra <scratchpad> e execute raciocínio completo sobre a instrução recebida e o laudo atual.\r\n② Feche </scratchpad>.\r\n③ Gere EXATAMENTE a seguinte estrutura (os delimitadores são parseados pelo frontend):`,
        `① É ESTRITAMENTE PROIBIDO usar <scratchpad>, <think> ou descrever qualquer raciocínio.\n② Gere DIRETA, IMEDIATA e EXATAMENTE a seguinte estrutura (os delimitadores são parseados pelo frontend):`
      );
  }
  const refinementRules = settings.aiRefinementGoldenRules || DEFAULT_REFINEMENT_GOLDEN_RULES;

  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(tpls, settings, exam.area) + copilotModeOverride;

  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const safePatientExams = truncatePreviousExams(patientPreviousExams, settings, 2500);

  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: exam.examType,
    patient,
    clinicalIndication: exam.clinicalIndication || '',
    anamnesis: exam.anamnesis,
    notes: instruction,
    maskHtml: currentReport,
    originalMaskHtml: tpls.length > 0 ? getCombinedInitialReportContent(tpls, sectionTogglesFromSettings(settings)) : undefined,
    requestingPhysician: exam.requestingPhysician,
    previousExams: safePreviousExams,
    patientPreviousExams: safePatientExams,
    examDateMs: exam.examDate ?? exam.createdAt,
  });

  const userMessage = `${refinementRules}

═══════════════════════════════════════════════════════════════
INPUT CLÍNICO:
═══════════════════════════════════════════════════════════════
${contextMessage}`;

  return { universalContext, areaContext, userMessage };
}

// ─── Funções auxiliares e motor de chamada de API ────────────────────────────

// Fonte única de verdade dos modelos Gemini: ver ./geminiModels.ts. Re-exportado
// aqui por compatibilidade — vários módulos e testes importam estes símbolos de
// '../engine'.
export {
  GEMINI_LITE_MODEL,
  GEMINI_PRO_MODEL,
  VALID_GEMINI_MODELS,
  isValidGeminiModel,
  resolveGeminiModel,
  getFallbackModel,
};

function getModelForMode(settings: AppSettings, mode: string, area: string): string {
  return resolveGeminiModel(settings.geminiModel, settings.selectedMotor);
}

import { GeminiProvider } from './providers/GeminiProvider';

const helpers = {
  getModeTemperature,
  getMaxTokens,
  withRetry,
  extractScratchpad,
  cleanMarkdownFromResponse,
  stripScratchpad,
};

// Exportar builders internos para uso no Playground com streaming real
export { buildRefinePrompt, buildCopilotPrompt };

// ─── Detecção de modo e área ─────────────────────────────────────────────────

function detectMode(params: GenerateReportParams | CopilotParams | RefineParams): string {
  if ('instruction' in params) return 'copilot';
  if ('currentReport' in params && 'template' in params) return 'refine';
  return 'generation';
}

function detectArea(params: GenerateReportParams | CopilotParams | RefineParams): string {
  if ('instruction' in params) return (params as CopilotParams).exam.area;
  if ('template' in params) return (params as GenerateReportParams | RefineParams).template.area;
  return '';
}

/**
 * Augmenta o prompt de geração com exemplos few-shot do Corpus de
 * Excelência (Fase 3). Só atua no modo geração e quando aiTrainingEnabled.
 * Degrada graciosamente: qualquer falha mantém o prompt original.
 */
async function augmentWithRetrieval(
  built: BuiltPrompt,
  params: GenerateReportParams,
  settings: AppSettings,
  motor: 'lite' | 'pro',
  signal?: AbortSignal
): Promise<BuiltPrompt> {
  const block = await retrieveFewShotBlock({
    area: params.template.area,
    examType: params.template.name,
    motor,
    clinicalIndication: params.clinicalIndication,
    anamnesis: params.anamnesis,
    settings,
    signal,
  });
  if (!block) return built;
  return { ...built, universalContext: `${built.universalContext}\n\n${block}` };
}

// ─── Helpers para Controle de Motor (Lite/Pro) e Quota de Laudos ─────────────

/**
 * Decisão pura da pré-checagem de cota do cliente. `units` = laudos consumidos
 * pela chamada (1 por máscara — exame combinado de 2 máscaras consome 2).
 * As mensagens de bloqueio DEVEM conter "cota mensal" (o catch de
 * resolveMotorConfigAndCheckQuota só relança erros com essa expressão).
 */
export function evaluateClientQuota(
  reportsUsed: number,
  reportsQuota: number,
  units = 1
): { allowed: boolean; message?: string } {
  const isUnlimited = reportsQuota === 0 || reportsQuota >= 9999;
  if (isUnlimited || reportsUsed + units <= reportsQuota) return { allowed: true };
  if (units > 1) {
    const remaining = Math.max(0, reportsQuota - reportsUsed);
    return {
      allowed: false,
      message: `Este laudo combinado consome ${units} laudos e restam ${remaining} na sua cota mensal. Faça um upgrade ou aguarde o reset mensal.`,
    };
  }
  return {
    allowed: false,
    message: 'Sua cota mensal de laudos foi atingida. Faça um upgrade ou aguarde o reset mensal.',
  };
}

async function resolveMotorConfigAndCheckQuota(
  settings: AppSettings,
  mode: string,
  units = 1
): Promise<{ resolvedProvider: 'gemini'; resolvedModelName: string; resolvedMotor: 'lite' | 'pro'; uid?: string }> {
  const uid = auth.currentUser?.uid;
  let resolvedModelName = 'gemini-3.5-flash';
  let resolvedMotor: 'lite' | 'pro' = settings.selectedMotor === 'pro' ? 'pro' : 'lite';

  if (!uid) {
    return { resolvedProvider: 'gemini', resolvedModelName, resolvedMotor };
  }

  try {
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const isAdmin = userData.role === 'admin' || uid === 'dev-admin-uid';

      // 1. Validar cota mensal antes de QUALQUER chamada de IA (geração,
      // refino ou copiloto) — toda chamada consome tokens/custo real, então
      // toda chamada precisa respeitar a cota do plano (ver incrementReportUsage).
      if (!isAdmin) {
        const reportsUsed = userData.reportsUsedThisMonth ?? 0;
        const reportsQuota = userData.reportsQuota ?? 100;
        const quota = evaluateClientQuota(reportsUsed, reportsQuota, units);
        if (!quota.allowed) {
          throw new Error(quota.message);
        }
      }

      // 2. Resolver configuração dos motores (sempre Gemini)
      const isTrialing = !userData.subscriptionId && userData.createdAt && (Date.now() < userData.createdAt + 14 * 24 * 60 * 60 * 1000);
      const motorProEnabled = isAdmin || userData.motorProEnabled === true || isTrialing || userData.subscriptionStatus === 'trialing';
      let chosenMotor = settings.selectedMotor || 'lite';
      if (chosenMotor === 'pro' && !motorProEnabled) {
        chosenMotor = 'lite';
      }
      resolvedMotor = chosenMotor;

      const motorConfigRef = doc(firestore, 'global_config', 'motor_config');
      const motorConfigSnap = await getDoc(motorConfigRef);
      const motorConfig = {
        lite: { model: GEMINI_LITE_MODEL },
        pro:  { model: GEMINI_PRO_MODEL }
      };

      if (motorConfigSnap.exists()) {
        const configData = motorConfigSnap.data();
        if (configData.lite?.model) motorConfig.lite.model = configData.lite.model;
        if (configData.pro?.model)  motorConfig.pro.model  = configData.pro.model;
      }

      // Honra o modelo configurado no Firestore SE for um ID válido (allowlist);
      // senão cai no default do motor escolhido. Ver resolveGeminiModel.
      resolvedModelName = resolveGeminiModel(motorConfig[chosenMotor].model, chosenMotor);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('cota mensal')) {
      throw err;
    }
    logger.error('Erro ao resolver motor e cota:', err);
  }

  return { resolvedProvider: 'gemini', resolvedModelName, resolvedMotor, uid };
}

async function incrementReportUsage(uid: string, units = 1) {
  // O contador do doc do USUÁRIO é a fonte de verdade e é incrementado de forma
  // isolada — assim uma eventual falha ao espelhar na assinatura (doc ausente,
  // regra, userId divergente) NÃO impede a contagem de avançar.
  let newUsed = 0;
  let subscriptionId: string | undefined;
  try {
    const userRef = doc(firestore, 'users', uid);
    await runTransaction(firestore, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data();
      subscriptionId = userData.subscriptionId;
      newUsed = (userData.reportsUsedThisMonth ?? 0) + units;
      transaction.update(userRef, { reportsUsedThisMonth: newUsed, updatedAt: Date.now() });
    });
  } catch (err) {
    logger.error('Erro ao incrementar uso de laudo (usuário):', err);
    return;
  }

  // Espelho best-effort na assinatura — falha aqui não afeta o contador acima.
  if (subscriptionId && newUsed > 0) {
    try {
      await updateDoc(doc(firestore, 'subscriptions', subscriptionId), {
        reportsUsedThisMonth: newUsed,
        updatedAt: Date.now(),
      });
    } catch (err) {
      logger.warn('Falha ao espelhar uso na assinatura (ignorado):', err);
    }
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * maxOutputTokens de uma chamada: por área (caso simples) ou a soma das áreas
 * das máscaras (laudo combinado — o output cobre os dois exames), com teto.
 */
function callHelpers(tpls: ReportTemplate[]) {
  if (tpls.length <= 1) return helpers;
  const maxTokens = Math.min(
    tpls.reduce((sum, t) => sum + getMaxTokens(t.area), 0),
    20480
  );
  return { ...helpers, getMaxTokens: () => maxTokens };
}

export async function generateReport(params: GenerateReportParams | CopilotParams | RefineParams): Promise<string> {
  const { settings, signal } = params as any;
  const mode = detectMode(params);
  const area = detectArea(params);
  const t0 = Date.now();
  const tpls = effectiveTemplates(params);
  const units = Math.max(1, tpls.length);

  const { resolvedModelName, resolvedMotor, uid } = await resolveMotorConfigAndCheckQuota(settings, mode, units);

  const callSettings = {
    ...settings,
    aiProvider: 'gemini' as const,
    geminiModel: resolvedModelName,
    selectedMotor: resolvedMotor,
  };

  let built: BuiltPrompt;
  if (mode === 'copilot') {
    built = buildCopilotPrompt({ ...(params as CopilotParams), settings: callSettings });
  } else if (mode === 'refine') {
    built = buildRefinePrompt({ ...(params as RefineParams), settings: callSettings });
  } else {
    built = buildPrompt({ ...(params as GenerateReportParams), settings: callSettings });
    built = await augmentWithRetrieval(built, params as GenerateReportParams, callSettings, resolvedMotor, signal);
  }

  try {
    let text: string;
    let scratchpad: string | undefined;

    text = await new GeminiProvider().generate(built, callSettings, area, mode, signal, (sp) => scratchpad = sp, callHelpers(tpls));

    recordMetrics({
      examId: (params as any).examId,
      mode: mode as CallMetrics['mode'],
      provider: 'gemini',
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: Math.round(text.length / 4),
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: true,
      scratchpad,
      modelName: resolvedModelName,
      promptHash: hashPrompt(built)
    });

    // Toda chamada de IA (geração, refino ou copiloto) consome tokens/custo
    // real e por isso conta para a cota do plano — não só a geração inicial.
    // Exame combinado: 1 unidade por máscara.
    if (uid) {
      await incrementReportUsage(uid, units);
    }

    return text;
  } catch (err) {
    recordMetrics({
      examId: (params as any).examId,
      mode: mode as CallMetrics['mode'],
      provider: 'gemini',
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: 0,
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: false,
      modelName: resolvedModelName,
      promptHash: hashPrompt(built)
    });
    throw err;
  }
}

export async function generateReportStream(
  params: GenerateReportParams | CopilotParams | RefineParams,
  onChunk: (text: string, rawText?: string) => void
): Promise<string> {
  const { settings, signal } = params as any;
  const mode = detectMode(params);
  const area = detectArea(params);
  const t0 = Date.now();
  const tpls = effectiveTemplates(params);
  const units = Math.max(1, tpls.length);

  const { resolvedModelName, resolvedMotor, uid } = await resolveMotorConfigAndCheckQuota(settings, mode, units);

  const callSettings = {
    ...settings,
    aiProvider: 'gemini' as const,
    geminiModel: resolvedModelName,
    selectedMotor: resolvedMotor,
  };

  let built: BuiltPrompt;
  if (mode === 'copilot') {
    built = buildCopilotPrompt({ ...(params as CopilotParams), settings: callSettings });
  } else if (mode === 'refine') {
    built = buildRefinePrompt({ ...(params as RefineParams), settings: callSettings });
  } else {
    built = buildPrompt({ ...(params as GenerateReportParams), settings: callSettings });
    built = await augmentWithRetrieval(built, params as GenerateReportParams, callSettings, resolvedMotor, signal);
  }

  try {
    let text: string;
    let scratchpad: string | undefined;

    text = await new GeminiProvider().stream(built, callSettings, area, mode, onChunk, signal, (sp) => scratchpad = sp, callHelpers(tpls));

    recordMetrics({
      examId: (params as any).examId,
      mode: mode as CallMetrics['mode'],
      provider: 'gemini',
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: Math.round(text.length / 4),
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: true,
      scratchpad,
      modelName: resolvedModelName,
      promptHash: hashPrompt(built)
    });

    // Toda chamada de IA (geração, refino ou copiloto) consome tokens/custo
    // real e por isso conta para a cota do plano — não só a geração inicial.
    // Exame combinado: 1 unidade por máscara.
    if (uid) {
      await incrementReportUsage(uid, units);
    }

    return text;
  } catch (err) {
    recordMetrics({
      examId: (params as any).examId,
      mode: mode as CallMetrics['mode'],
      provider: 'gemini',
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: 0,
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: false,
      modelName: resolvedModelName,
      promptHash: hashPrompt(built)
    });
    throw err;
  }
}

// ─── Self-audit de qualidade local (sem API) ─────────────────────────────────

interface QualityReport {
  score: number;  // 0-100
  issues: Array<{
    type: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
}

export function auditReportQuality(html: string, area?: string | string[]): QualityReport {
  // Exame combinado: as regras área-específicas disparam para TODAS as áreas
  // envolvidas (ex.: Bosniak E O-RADS num Abdome + Pélvica).
  const areas = (Array.isArray(area) ? area : area ? [area] : []).filter(Boolean);
  const issues: QualityReport['issues'] = [];
  let score = 100;

  if (!html || html.trim().length < 50) {
    return { score: 0, issues: [{ type: 'empty', severity: 'error', message: 'Laudo vazio ou muito curto.' }] };
  }

  if (!html.trimStart().toLowerCase().startsWith('<h1')) {
    issues.push({ type: 'structure', severity: 'error', message: 'Laudo não começa com <h1>.' });
    score -= 15;
  }

  const requiredSections = ['TÉCNICA', 'ANÁLISE', 'CONCLUSÃO', 'RECOMENDAÇÕES', 'OBSERVAÇÕES METODOLÓGICAS'];
  for (const section of requiredSections) {
    if (!html.toUpperCase().includes(section)) {
      issues.push({ type: 'missing_section', severity: 'error', message: `Seção "${section}" ausente no laudo.` });
      score -= 10;
    }
  }

  const isFetalOrVascular = areas.includes('medicina-fetal') || areas.includes('vascular');
  
  // Extrai o conteúdo da seção de Observações Metodológicas
  const obsMatch = html.match(/<h2[^>]*>OBSERVA[ÇC][ÕO]ES\s+METODOL[OÓ]GICAS<\/h2>([\s\S]*?)(?=<h2|$)/i);
  const obsContent = obsMatch ? obsMatch[1] : '';

  const placeholderPatterns = [
    { 
      pattern: /\(\.\.\.\)/g, 
      name: '(...)', 
      isForbidden: (inObs: boolean) => !isFetalOrVascular || inObs 
    },
    { 
      pattern: /\[___\]/g, 
      name: '[___]', 
      isForbidden: (inObs: boolean) => !isFetalOrVascular || inObs 
    },
    { 
      pattern: /____\s*(cm|mm|mL|g)/gi, 
      name: 'unidade órfã (____)', 
      isForbidden: () => true 
    },
    { 
      pattern: /\[valor\]/gi, 
      name: '[valor]', 
      isForbidden: () => true 
    },
  ];

  for (const { pattern, name, isForbidden } of placeholderPatterns) {
    if (isForbidden(false)) {
      const matches = html.match(pattern);
      if (matches) {
        issues.push({ type: 'placeholder', severity: 'error', message: `Placeholder "${name}" encontrado (${matches.length}x). Laudo incompleto.` });
        score -= Math.min(20, matches.length * 5);
      }
    } else {
      // Para medicina fetal/vascular, só é proibido na seção de Observações Metodológicas
      const matches = obsContent.match(pattern);
      if (matches) {
        issues.push({ type: 'placeholder', severity: 'error', message: `Placeholder "${name}" encontrado na seção de Observações Metodológicas (${matches.length}x). Laudo incompleto.` });
        score -= Math.min(20, matches.length * 5);
      }
    }
  }

  const conclusionMatch = html.match(/<h2[^>]*>CONCLUS[ÃA]O<\/h2>([\s\S]*?)(?=<h2|$)/i);
  if (conclusionMatch) {
    const conclusionContent = conclusionMatch[1];
    const paragraphs = conclusionContent.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const withoutBullet = paragraphs.filter(p => {
      const text = p.replace(/<[^>]+>/g, '').trim();
      return text.length > 0 && !text.startsWith('•');
    });
    if (withoutBullet.length > 0) {
      issues.push({ type: 'bullet', severity: 'warning', message: `${withoutBullet.length} parágrafo(s) na CONCLUSÃO sem bullet "• ".` });
      score -= withoutBullet.length * 3;
    }
  }

  const recMatch = html.match(/<h2[^>]*>RECOMENDA[ÇC][ÕO]ES<\/h2>([\s\S]*?)(?=<h2|$)/i);
  if (recMatch) {
    const recContent = recMatch[1];
    const paragraphs = recContent.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const withoutBullet = paragraphs.filter(p => {
      const text = p.replace(/<[^>]+>/g, '').trim();
      return text.length > 0 && !text.startsWith('•');
    });
    if (withoutBullet.length > 0) {
      issues.push({ type: 'bullet', severity: 'warning', message: `${withoutBullet.length} parágrafo(s) nas RECOMENDAÇÕES sem bullet "• ".` });
      score -= withoutBullet.length * 3;
    }
  }

  const forbiddenTags = ['<script', '<style', '<iframe', '<div', '<span'];
  for (const tag of forbiddenTags) {
    if (html.toLowerCase().includes(tag)) {
      issues.push({ type: 'forbidden_tag', severity: 'warning', message: `Tag proibida "${tag}" detectada no HTML.` });
      score -= 5;
    }
  }

  if (/\*\*[^*]+\*\*/.test(html) || /##\s/.test(html)) {
    issues.push({ type: 'markdown', severity: 'warning', message: 'Markdown residual detectado (**bold** ou ## heading).' });
    score -= 5;
  }

  if (areas.includes('medicina-fetal')) {
    const hasZeroEnd = /di[aá]stole\s+zero|fluxo\s+ausente|ausência\s+de\s+diástole/i.test(html);
    const hasAlerta = /ALERTA/i.test(html);
    if (hasZeroEnd && !hasAlerta) {
      issues.push({ type: 'missing_alert', severity: 'error', message: 'Achado de diástole zero/ausente sem ALERTA OBSTÉTRICO nas recomendações (R6).' });
      score -= 20;
    }
  }

  // ── Separador decimal com ponto em medidas (deve ser vírgula) — exclui milhar (3 díg.) e peso em g ──
  const dotDecimal = html.match(/\b\d+\.\d{1,2}\s*(cm|mm|mL|cm³)/gi);
  if (dotDecimal) {
    issues.push({ type: 'decimal', severity: 'warning', message: `Separador decimal com ponto em ${dotDecimal.length} medida(s) — usar vírgula (BLOCO 1).` });
    score -= Math.min(10, dotDecimal.length * 2);
  }

  // ── Placeholders de máscara não preenchidos no output ([__], [inserir], [listar]) — proibido em não-fetal/vascular ──
  if (!isFetalOrVascular) {
    const maskPlaceholders = html.match(/\[_{2,}\]|\[inserir\]|\[listar[^\]]*\]/gi);
    if (maskPlaceholders) {
      issues.push({ type: 'placeholder', severity: 'error', message: `Placeholder de máscara não preenchido no output (${maskPlaceholders.length}x).` });
      score -= Math.min(20, maskPlaceholders.length * 5);
    }
  }

  // ── R5: lesão focal descrita exige classificação sistematizada oficial (órgão-específica) ──
  // Só dispara quando o ÓRGÃO correto está descrito na ANÁLISE (evita falso-positivo em
  // nódulo de partes moles/salivar/escroto, que não usam TI-RADS). O verifyReport (verification.ts)
  // cobre estes casos de forma finding-específica; aqui reforçamos a pontuação estrutural.
  const classRules: Array<{ area: string; organRe: RegExp; classRe: RegExp }> = [
    { area: 'mastologia', organRe: /n[óo]dulo|massa|les[ãa]o focal/i, classRe: /BI-?RADS/i },
    { area: 'pequenas-partes', organRe: /tire[óo]id[^.]{0,60}(n[óo]dulo)|(n[óo]dulo)[^.]{0,60}tire[óo]id/i, classRe: /TI-?RADS/i },
    { area: 'ginecologia', organRe: /(ov[áa]ri|anexial|anexo)[^.]{0,60}(massa|cisto|forma[çc][ãa]o|tumor)/i, classRe: /O-?RADS/i },
    // Cisto renal COMPLEXO (septo/calcificação/parede espessa/realce/componente sólido) exige
    // estratificação: categoria Bosniak OU recomendação de método seccional (TC/RM) — no US
    // convencional a conduta correta pode ser encaminhar em vez de cravar Bosniak.
    // Cisto renal simples NÃO dispara (organRe exige descritor de complexidade na mesma sentença).
    { area: 'medicina-interna', organRe: /cisto[s]? rena(l|is)[^.]{0,90}(sept|calcifica|parede espess|realce|conte[úu]do heterog|componente s[óo]lid|nodula[çr]|vegeta[çc]|complex)/i, classRe: /Bosniak|tomografi|resson[âa]nci|\bTC\b|\bRM\b|seccional|complementa[çr]/i },
    // Estenose carotídea exige graduação (NASCET/SRU) — aceita percentual/severidade como grau válido.
    { area: 'vascular', organRe: /(est[ée]nos)[^.]{0,45}(car[óo]tid|\bACI\b|bulbo)|(car[óo]tid|\bACI\b|bulbo car[óo]t)[^.]{0,70}(est[ée]nos)/i, classRe: /NASCET|SRU|\d{2}\s*[–\-a]\s*\d{2}\s*%|est[ée]nose\s+(leve|moderada|acentuada|importante|cr[íi]tica)|<\s*50\s*%|≥?\s*70\s*%/i },
  ];
  if (areas.length) {
    const rules = classRules.filter((r) => areas.includes(r.area));
    if (rules.length) {
      const analiseMatch = html.match(/<h2[^>]*>AN[ÁA]LISE<\/h2>([\s\S]*?)(?=<h2|$)/i);
      const analise = analiseMatch ? analiseMatch[1] : '';
      for (const rule of rules) {
        if (rule.organRe.test(analise) && !rule.classRe.test(html)) {
          issues.push({ type: 'classification', severity: 'warning', message: 'Lesão focal descrita sem classificação sistematizada oficial (R5).' });
          score -= 8;
          break; // uma penalidade estrutural por laudo
        }
      }
    }
  }

  // ── R6: achado potencialmente urgente (N4) exige ALERTA correspondente (todas as áreas) ──
  const urgencyFindings = /tor[çc][ãa]o testicular|trombose venosa profunda|\bTVP\b|absc[ée]sso|ruptura (completa|transfixante|total)|aneurisma roto|artrite s[ée]ptica|isquemia cr[íi]tica|gesta[çc][ãa]o ect[óo]pica|pseudoaneurisma/i;
  if (urgencyFindings.test(html) && !/ALERTA/i.test(html)) {
    issues.push({ type: 'missing_alert', severity: 'warning', message: 'Achado potencialmente urgente sem ALERTA correspondente (R6).' });
    score -= 10;
  }

  // ── R7: OBSERVAÇÕES METODOLÓGICAS não podem estar vazias/triviais ──
  const obsText = obsContent.replace(/<[^>]+>/g, '').replace(/\(…\)|\(\.\.\.\)/g, '').trim();
  if (html.toUpperCase().includes('OBSERVAÇÕES METODOLÓGICAS') && obsText.length < 20) {
    issues.push({ type: 'empty_obs', severity: 'warning', message: 'Seção OBSERVAÇÕES METODOLÓGICAS vazia ou trivial (R7).' });
    score -= 5;
  }

  // ── Cascata tripartite: achado patológico na CONCLUSÃO exige RECOMENDAÇÃO correspondente ──
  if (conclusionMatch && recMatch) {
    const conclText = conclusionMatch[1].replace(/<[^>]+>/g, ' ');
    const hasPathology = /(n[óo]dulo|cisto|massa|espessamento|derrame|esteatose|lit[íi]ase|c[áa]lculo|estenose|trombo|les[ãa]o|fratura|rotura|ruptura|sinovite|tendinopat)/i.test(conclText)
      && !/dentro dos limites da normalidade|sem altera[çc][õo]es/i.test(conclText.slice(0, 140));
    const recText = recMatch[1].replace(/<[^>]+>/g, ' ').replace(/•/g, '').trim();
    if (hasPathology && recText.length < 15) {
      issues.push({ type: 'cascade', severity: 'warning', message: 'Achado patológico na CONCLUSÃO sem RECOMENDAÇÃO correspondente (cascata tripartite).' });
      score -= 8;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

// ─── Mock (modo sem API) ──────────────────────────────────────────────────────

export function generateMockReport(params: GenerateReportParams): string {
  const { settings } = params;
  const tpls = effectiveTemplates(params);
  const withRecommendations = settings?.laudIaRecommendationsEnabled !== false;
  const withObservations = settings?.laudIaMethodologicalObsEnabled !== false;

  const title = tpls.length > 1 ? getCombinedTitle(tpls) : tpls[0].title;
  const analysis = tpls.map((t) => t.analysisTemplate).join('\n');
  const conclusion = tpls.map((t) => t.conclusionTemplate).join('\n');
  const recsBody = tpls.map((t) => t.recommendationsTemplate).filter(Boolean).join('\n');
  const obsBody = tpls.map((t) => t.observationsTemplate).filter(Boolean).join('\n');

  const recs = withRecommendations
    ? `\n<h2>RECOMENDAÇÕES</h2>\n${recsBody}`
    : '';
  const obs = withObservations && obsBody
    ? `\n<h2>OBSERVAÇÕES METODOLÓGICAS</h2>\n${obsBody}`
    : '';

  return `<h1>${title}</h1>
<h2>ANÁLISE</h2>
${analysis}
<h2>CONCLUSÃO</h2>
${conclusion}${recs}${obs}`;
}
