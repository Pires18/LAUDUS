import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_STRUCTURE_PROMPT, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_RIGID_RULES, DEFAULT_REFINEMENT_GOLDEN_RULES, DEFAULT_COPILOT_OVERRIDE } from './prompts';
import { getInitialReportContent } from '../templates/utils';

// ─── Interfaces públicas ─────────────────────────────────────────────────────

interface GenerateReportParams {
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
  examDateMs?: number;
  signal?: AbortSignal;
}

interface CopilotParams {
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string; anamnesis?: string; dateMs?: number };
  settings: AppSettings;
  previousExams?: string[];
  template?: ReportTemplate | null;
  signal?: AbortSignal;
}

interface RefineParams {
  currentReport: string;
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
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
  mode: 'generation' | 'refine' | 'copilot' | 'template';
  provider: 'gemini' | 'anthropic';
  area: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualOutputTokens?: number;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  scratchpad?: string;
}

let lastCallMetrics: CallMetrics | null = null;
export const callMetricsHistory: CallMetrics[] = [];

function recordMetrics(m: CallMetrics) {
  lastCallMetrics = m;
  callMetricsHistory.unshift(m);
  if (callMetricsHistory.length > 20) callMetricsHistory.pop();
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

function getModeTemperature(mode: string, override?: number): number {
  if (override !== undefined && override >= 0 && override <= 1) return override;
  return TEMPERATURE_BY_MODE[mode] ?? 0.3;
}

// ─── Retry com exponential backoff ──────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      lastError = err;
      const msg = String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('overloaded') ||
        msg.includes('rate_limit') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (attempt < maxRetries && isRetryable) {
        const wait = 1000 * Math.pow(2, attempt);   // 1s, 2s
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─── Helpers utilitários ─────────────────────────────────────────────────────

function calculateAge(birthDateStr?: string, referenceDateMs?: number): string {
  if (!birthDateStr) return '';
  try {
    const birthDate = new Date(birthDateStr);
    const today = referenceDateMs ? new Date(referenceDateMs) : new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age === 0) {
      const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
      const finalMonths = months <= 0 ? 1 : months;
      return `${finalMonths} ${finalMonths === 1 ? 'mês' : 'meses'}`;
    }
    return `${age} ${age === 1 ? 'ano' : 'anos'}`;
  } catch {
    return '';
  }
}

/**
 * Trunca laudos anteriores respeitando limites semânticos (laudos inteiros).
 * Respeita aiTrainingEnabled: false — retorna [] se desabilitado.
 */
function truncatePreviousExams(
  exams: string[],
  settings: AppSettings,
  maxChars = 12000
): string[] {
  if (settings.aiTrainingEnabled === false) return [];
  if (!exams || exams.length === 0) return [];

  const result: string[] = [];
  let total = 0;
  for (const ex of exams) {
    if (!ex || !ex.trim()) continue;
    if (total + ex.length > maxChars) break;
    result.push(ex);
    total += ex.length;
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
  return parts.join('\n\n');
}

function buildSpecificContext(template?: ReportTemplate | null): string {
  if (!template || !template.aiInstructions) return '';
  return `═══════════════════════════════════════════\nINSTRUÇÕES ESPECÍFICAS DO EXAME:\n═══════════════════════════════════════════\n${template.aiInstructions}`;
}

function buildMaskHtml(template: ReportTemplate): string {
  const parts = [
    `TÍTULO:\n${template.title}`,
    `TÉCNICA:\n${template.technique}`,
    `ANÁLISE:\n${template.analysisTemplate}`,
    `CONCLUSÃO:\n${template.conclusionTemplate}`,
  ];
  if (template.classificationTemplate) {
    parts.push(`CLASSIFICAÇÃO:\n${template.classificationTemplate}`);
  }
  parts.push(`RECOMENDAÇÕES:\n${template.recommendationsTemplate}`);
  parts.push(`OBSERVAÇÕES METODOLÓGICAS:\n${template.observationsTemplate || '<p>(…)</p>'}`);
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
    `DATA DO EXAME: ${examDate} (ATENÇÃO: Use ESTA data como o "Hoje" para qualquer cálculo de datas no laudo, como DDP ou Idade Gestacional. PROIBIDO usar a data atual real do sistema.)`,
    `PACIENTE: ${patient?.name || 'Não informado'}, ${patientAge}, ${patientGender}`,
  ];
  if (patient?.insurance) lines.push(`CONVÊNIO: ${patient.insurance}`);
  if (patient?.history) lines.push(`HISTÓRICO CLÍNICO: ${patient.history}`);
  lines.push(`INDICAÇÃO: ${clinicalIndication || 'Não informada'}`);
  if (requestingPhysician) lines.push(`MÉDICO SOLICITANTE: ${requestingPhysician}`);

  if (anamnesis && anamnesis.trim()) {
    lines.push(`\nANAMNESE DO PACIENTE (dados da consulta — usar como contexto clínico prioritário para calibrar descrição, conclusão e recomendações):\n${anamnesis.trim()}`);
  }

  const notesLabel = mode === 'GERAÇÃO INICIAL' ? 'NOTAS DO MÉDICO' : 'INSTRUÇÃO DE ALTERAÇÃO';
  lines.push(`${notesLabel}: ${notes || 'Nenhuma nota adicional.'}`);

  const prevContext = previousExams.length > 0
    ? `\n\nREFERÊNCIA DE ESTILO (laudos anteriores — mimetize APENAS o estilo de escrita, NUNCA copie dados clínicos):\n[INÍCIO DOS EXEMPLOS]\n${previousExams.join('\n\n---\n\n')}\n[FIM DOS EXEMPLOS]`
    : '';

  const maskLabel = mode === 'GERAÇÃO INICIAL'
    ? 'MÁSCARA DE REFERÊNCIA'
    : 'LAUDO ATUAL (modificar conforme instrução acima)';

  const originalMaskBlock = originalMaskHtml
    ? `\n\n═══════════════════════════════════════════\nMÁSCARA MODELO ORIGINAL DO EXAME (ÂNCORA ESTRUTURAL E TEXTUAL RÍGIDA):\n═══════════════════════════════════════════\nUse o HTML abaixo apenas como a referência absoluta de estrutura de seções, nomenclatura de títulos, parágrafos, ordem e texto padrão que devem ser preservados para os órgãos inalterados:\n${originalMaskHtml}\n`
    : '';

  return `${lines.join('\n')}${prevContext}${originalMaskBlock}

${maskLabel}:
${maskHtml}`;
}

/**
 * Remove raciocínio interno do modelo do output — defesa multicamada.
 */
export function stripScratchpad(text: string, disableHtmlExtraction = false): string {
  if (!text) return '';
  let cleaned = text;

  // 1A. Remove complete scratchpad/thinking blocks first. Handles spaces inside tags.
  cleaned = cleaned.replace(/<\s*(scratchpad|think|thinking|thought)\s*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  
  // 1B. For any remaining unclosed scratchpad tags (e.g., streaming or forgotten closing tag),
  // remove from the opening tag up to the first valid content marker or end of string.
  cleaned = cleaned.replace(/<\s*(scratchpad|think|thinking|thought)\s*>[\s\S]*?(?====\s*CONVERSA|===\s*PROPOSTA|<h[1-6][\s>]|$)/gi, '');
  
  // 2. Remove python/tool_code/code blocks (internal tool calls)
  cleaned = cleaned.replace(/```(?:tool_code|python|code|javascript|typescript|bash)[\s\S]*?```/gi, '');

  // 3. Remove any loose closing/opening tags just in case
  cleaned = cleaned.replace(/<\s*\/?\s*(scratchpad|think|thinking|thought)\s*>/gi, '');

  // 5. Keep HTML block contents but strip markdown backticks if wrapped in them
  cleaned = cleaned.replace(/```html\s*([\s\S]*?)\s*```/gi, '$1');
  cleaned = cleaned.replace(/```\s*([\s\S]*?)\s*```/gi, '$1');

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

// ─── Builders de prompt ──────────────────────────────────────────────────────

export function buildPrompt({
  template,
  patient,
  clinicalIndication,
  requestingPhysician,
  anamnesis,
  settings,
  previousExams = [],
  examDateMs,
}: GenerateReportParams): BuiltPrompt {
  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(template);
  const maskHtml = buildMaskHtml(template);
  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const contextMessage = buildContextMessage({
    mode: 'GERAÇÃO INICIAL',
    examType: template.name,
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: clinicalIndication || 'Nenhuma nota adicional do médico.',
    maskHtml,
    requestingPhysician,
    previousExams: safePreviousExams,
    examDateMs,
  });

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

Gere agora o laudo completo em HTML puro. O output deve começar diretamente com <h1>. Zero texto antes do HTML.`;

  return { universalContext, areaContext, userMessage };
}



function buildRefinePrompt({
  currentReport,
  template,
  patient,
  settings,
  clinicalIndication,
  requestingPhysician,
  anamnesis,
  previousExams = [],
  customPrompt,
  examDateMs,
}: RefineParams): BuiltPrompt {
  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(template);

  const refineNote = customPrompt
    ? `INSTRUÇÃO DE REFINAMENTO: "${customPrompt}"`
    : `INSTRUÇÃO: Sanitizar, higienizar e alinhar o laudo completo.`;

  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: template.name,
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: refineNote,
    maskHtml: currentReport,
    originalMaskHtml: getInitialReportContent(template),
    requestingPhysician,
    previousExams: safePreviousExams,
    examDateMs,
  });

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

${DEFAULT_REFINEMENT_GOLDEN_RULES}

Gere agora o laudo REFINADO completo em HTML puro. 
NOVA REGRA ABSOLUTA DE FORMATO:
1. O output DEVE começar com a tag <scratchpad> contendo seu raciocínio e Self-Audit detalhado.
2. APÓS fechar a tag </scratchpad>, o laudo deve começar diretamente com a tag <h1>.
ZERO texto, avisos ou mensagens de pensamento fora da tag <scratchpad>.`;

  return { universalContext, areaContext, userMessage };
}

function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
  template,
}: CopilotParams): BuiltPrompt {
  const copilotModeOverride = DEFAULT_COPILOT_OVERRIDE;

  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(template) + copilotModeOverride;

  const isFormCompilation = instruction.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:');
  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: exam.examType,
    patient,
    clinicalIndication: exam.clinicalIndication || '',
    anamnesis: exam.anamnesis,
    notes: instruction,
    maskHtml: currentReport,
    originalMaskHtml: template ? getInitialReportContent(template) : undefined,
    requestingPhysician: exam.requestingPhysician,
    previousExams: safePreviousExams,
    examDateMs: exam.dateMs,
  });

  const userMessage = `${DEFAULT_REFINEMENT_GOLDEN_RULES}

═══════════════════════════════════════════════════════════════
INPUT CLÍNICO:
═══════════════════════════════════════════════════════════════
${contextMessage}`;

  return { universalContext, areaContext, userMessage };
}

// ─── Funções auxiliares e motor de chamada de API ────────────────────────────

export function resolveGeminiModel(rawModel: string | undefined): string {
  if (!rawModel) return 'gemini-3.5-flash';
  const raw = rawModel.toLowerCase();
  
  // Novas versões de ponta
  if (raw.includes('3.5') && raw.includes('flash')) return 'gemini-3.5-flash';
  if (raw.includes('3.1') && raw.includes('pro')) return 'gemini-3.1-pro';

  if (raw.includes('flash-thinking')) return 'gemini-2.5-flash'; // 2.0-flash-thinking is deprecated
  if (raw.includes('2.5') && raw.includes('flash')) return 'gemini-2.5-flash';
  if (raw.includes('2.5') && raw.includes('pro')) return 'gemini-2.5-pro';
  
  if (raw.includes('2.0') && raw.includes('flash')) return 'gemini-2.5-flash';
  if (raw.includes('2.0') && raw.includes('pro')) return 'gemini-2.5-pro';
  
  if (raw.includes('1.5') && raw.includes('pro')) return 'gemini-1.5-pro';
  if (raw.includes('pro')) return 'gemini-3.1-pro'; // Upgrade default pro to 3.1
  
  if (raw.includes('1.5') && raw.includes('flash')) return 'gemini-1.5-flash';
  if (raw.includes('flash')) return 'gemini-3.5-flash'; // Upgrade default flash to 3.5
  
  return 'gemini-3.5-flash';
}

function getModelForMode(settings: AppSettings, mode: string, area: string): string {
  let modelToUse = settings.geminiModel || 'gemini-1.5-flash';
  if (settings.geminiModelByMode?.[mode as keyof typeof settings.geminiModelByMode]) {
    modelToUse = settings.geminiModelByMode[mode as keyof typeof settings.geminiModelByMode]!;
  }
  return resolveGeminiModel(modelToUse);
}

async function callGemini(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  signal?: AbortSignal,
  onComplete?: (scratchpad?: string) => void
): Promise<string> {
  const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
  const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
  const modelName = getModelForMode(settings, mode, area);
  const maxTokens = Math.min(getMaxTokens(area), 8192);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: getModeTemperature(mode, settings.aiTemperature),
      topP: 0.9,
      maxOutputTokens: maxTokens,
    }
  });
  const result = await withRetry(() => model.generateContent(built.userMessage, { signal }));
  const fullText = result.response.text();
  if (onComplete) onComplete(extractScratchpad(fullText));
  return cleanMarkdownFromResponse(fullText);
}

async function callGeminiStream(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onComplete?: (scratchpad?: string) => void
): Promise<string> {
  const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
  const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
  const modelName = getModelForMode(settings, mode, area);
  const maxTokens = Math.min(getMaxTokens(area), 8192);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: getModeTemperature(mode, settings.aiTemperature),
      topP: 0.9,
      maxOutputTokens: maxTokens,
    }
  });

  const result = await withRetry(() => model.generateContentStream(built.userMessage, { signal }));
  let fullText = '';

  for await (const chunk of result.stream) {
    fullText += chunk.text();
    onChunk(stripScratchpad(cleanMarkdownFromResponse(fullText)));
  }

  if (onComplete) onComplete(extractScratchpad(fullText));
  return stripScratchpad(cleanMarkdownFromResponse(fullText));
}

// ─── URL da API Anthropic (resolve CORS em desenvolvimento via proxy Vite) ───
// Em produção, as chamadas vão direto para api.anthropic.com (sem proxy Vite).
// Em desenvolvimento (localhost), usamos o proxy configurado em vite.config.ts.
export function getAnthropicBaseUrl(): string {
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalDev ? '/api/anthropic' : 'https://api.anthropic.com';
}

async function callAnthropic(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  signal?: AbortSignal,
  onComplete?: (scratchpad?: string) => void
): Promise<string> {
  const systemBlocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
    {
      type: 'text',
      text: built.universalContext,
      cache_control: { type: 'ephemeral' }
    }
  ];
  if (built.areaContext) {
    systemBlocks.push({
      type: 'text',
      text: built.areaContext
    });
  }

  const response = await withRetry(() => fetch(`${getAnthropicBaseUrl()}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': settings.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31, max-tokens-3-5-sonnet-2024-07-15',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.anthropicModel || 'claude-sonnet-4-5',
      max_tokens: getMaxTokens(area),
      system: systemBlocks,
      messages: [{ role: 'user', content: built.userMessage }],
      temperature: getModeTemperature(mode, settings.aiTemperature)
    }),
    signal
  }));

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const fullText = result.content?.[0]?.text || '';
  if (onComplete) onComplete(extractScratchpad(fullText));
  return stripScratchpad(cleanMarkdownFromResponse(fullText));
}

async function callAnthropicStream(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onComplete?: (scratchpad?: string) => void
): Promise<string> {
  const systemBlocks: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
    {
      type: 'text',
      text: built.universalContext,
      cache_control: { type: 'ephemeral' }
    }
  ];
  if (built.areaContext) {
    systemBlocks.push({
      type: 'text',
      text: built.areaContext
    });
  }

  const response = await withRetry(() => fetch(`${getAnthropicBaseUrl()}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': settings.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31, max-tokens-3-5-sonnet-2024-07-15',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.anthropicModel || 'claude-sonnet-4-5',
      max_tokens: getMaxTokens(area),
      system: systemBlocks,
      messages: [{ role: 'user', content: built.userMessage }],
      temperature: getModeTemperature(mode, settings.aiTemperature),
      stream: true
    }),
    signal
  }));

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Não foi possível inicializar o leitor de stream.');

  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || !cleanLine.startsWith('data:')) continue;

      const dataStr = cleanLine.slice(5).trim();
      if (dataStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullText += parsed.delta.text;
          onChunk(stripScratchpad(cleanMarkdownFromResponse(fullText)));
        }
      } catch {
        // Ignorar eventos não-JSON
      }
    }
  }

  return stripScratchpad(cleanMarkdownFromResponse(fullText));
}

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

// ─── API pública ─────────────────────────────────────────────────────────────

export async function generateReport(params: GenerateReportParams | CopilotParams | RefineParams): Promise<string> {
  const { settings, signal } = params as any;
  const provider = settings.aiProvider || 'anthropic';
  const mode = detectMode(params);
  const area = detectArea(params);
  const t0 = Date.now();
  let success = false;

  let built: BuiltPrompt;
  if (mode === 'copilot') {
    built = buildCopilotPrompt(params as CopilotParams);
  } else if (mode === 'refine') {
    built = buildRefinePrompt(params as RefineParams);
  } else {
    built = buildPrompt(params as GenerateReportParams);
  }

  try {
    let text: string;
    let scratchpad: string | undefined;
    if (provider === 'gemini') {
      if (!settings.geminiApiKey) throw new Error('API Key do Gemini não configurada.');
      text = await callGemini(built, settings, area, mode, signal, (sp) => scratchpad = sp);
    } else {
      if (!settings.anthropicApiKey) throw new Error('API Key do Anthropic não configurada.');
      text = await callAnthropic(built, settings, area, mode, signal, (sp) => scratchpad = sp);
    }
    success = true;
    recordMetrics({
      mode: mode as CallMetrics['mode'],
      provider,
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: Math.round(text.length / 4),
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: true,
      scratchpad
    });
    return text;
  } catch (err) {
    recordMetrics({
      mode: mode as CallMetrics['mode'],
      provider,
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: 0,
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: false,
    });
    throw err;
  }
}

export async function generateReportStream(
  params: GenerateReportParams | CopilotParams | RefineParams,
  onChunk: (text: string) => void
): Promise<string> {
  const { settings, signal } = params as any;
  const provider = settings.aiProvider || 'anthropic';
  const mode = detectMode(params);
  const area = detectArea(params);
  const t0 = Date.now();

  let built: BuiltPrompt;
  if (mode === 'copilot') {
    built = buildCopilotPrompt(params as CopilotParams);
  } else if (mode === 'refine') {
    built = buildRefinePrompt(params as RefineParams);
  } else {
    built = buildPrompt(params as GenerateReportParams);
  }

  try {
    let text: string;
    let scratchpad: string | undefined;
    if (provider === 'gemini') {
      if (!settings.geminiApiKey) throw new Error('API Key do Gemini não configurada.');
      text = await callGeminiStream(built, settings, area, mode, onChunk, signal, (sp) => scratchpad = sp);
    } else {
      if (!settings.anthropicApiKey) throw new Error('API Key do Anthropic não configurada.');
      text = await callAnthropicStream(built, settings, area, mode, onChunk, signal, (sp) => scratchpad = sp);
    }
    recordMetrics({
      mode: mode as CallMetrics['mode'],
      provider,
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: Math.round(text.length / 4),
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: true,
      scratchpad
    });
    return text;
  } catch (err) {
    recordMetrics({
      mode: mode as CallMetrics['mode'],
      provider,
      area,
      estimatedInputTokens: Math.round((built.universalContext.length + built.areaContext.length + built.userMessage.length) / 4),
      estimatedOutputTokens: 0,
      latencyMs: Date.now() - t0,
      timestamp: Date.now(),
      success: false,
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

function auditReportQuality(html: string, area?: string): QualityReport {
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

  const isFetalOrVascular = area === 'medicina-fetal' || area === 'vascular';
  
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

  if (area === 'medicina-fetal') {
    const hasZeroEnd = /di[aá]stole\s+zero|fluxo\s+ausente|ausência\s+de\s+diástole/i.test(html);
    const hasAlerta = /ALERTA/i.test(html);
    if (hasZeroEnd && !hasAlerta) {
      issues.push({ type: 'missing_alert', severity: 'error', message: 'Achado de diástole zero/ausente sem ALERTA OBSTÉTRICO nas recomendações (R9).' });
      score -= 20;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

// ─── Mock (modo sem API) ──────────────────────────────────────────────────────

export function generateMockReport(params: GenerateReportParams): string {
  const { template } = params;

  const obs = template.observationsTemplate
    ? `<h2>OBSERVAÇÕES METODOLÓGICAS</h2>\n${template.observationsTemplate}`
    : `<h2>OBSERVAÇÕES METODOLÓGICAS</h2>\n<p><em>[Laudo gerado em modo de demonstração — configure a API Key do Gemini ou Anthropic em Configurações para usar IA real]</em></p>`;

  return `<h1>${template.title}</h1>
<h2>ANÁLISE</h2>
${template.analysisTemplate}
<h2>CONCLUSÃO</h2>
${template.conclusionTemplate}
<h2>RECOMENDAÇÕES</h2>
${template.recommendationsTemplate}
${obs}`;
}
