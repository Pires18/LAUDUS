import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_STRUCTURE_PROMPT, AREA_SPECIFIC_PROMPTS, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_RIGID_RULES } from './prompts';
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
}

interface CopilotParams {
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string; anamnesis?: string; dateMs?: number };
  settings: AppSettings;
  previousExams?: string[];
  template?: ReportTemplate | null;
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
}

export let lastCallMetrics: CallMetrics | null = null;
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

function calculateAge(birthDateStr?: string): string {
  if (!birthDateStr) return '';
  try {
    const birthDate = new Date(birthDateStr);
    const today = new Date();
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
  if (settings.normalDoctrine?.trim()) {
    parts.push(`═══════════════════════════════════════════\nDOUTRINA DE NORMALIDADE HABITUAL DO MÉDICO:\n═══════════════════════════════════════════\n${settings.normalDoctrine.trim()}`);
  }
  return parts.join('\n\n');
}

function buildAreaContext(settings: AppSettings, area: string): string {
  const areaRules = AREA_SPECIFIC_PROMPTS[area] || '';
  const areaExtra = settings.aiAreaPrompts?.[area as ExamArea] || '';

  const parts: string[] = [];
  if (areaRules) {
    parts.push(`═══════════════════════════════════════════\nPROTOCOLO DE ÁREA ATIVO:\n═══════════════════════════════════════════\n${areaRules}`);
  }
  if (areaExtra) {
    parts.push(`═══════════════════════════════════════════\nINSTRUÇÕES PERSONALIZADAS DA ÁREA:\n═══════════════════════════════════════════\n${areaExtra}`);
  }
  return parts.join('\n\n');
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
  if (template.observationsTemplate) {
    parts.push(`OBSERVAÇÕES METODOLÓGICAS:\n${template.observationsTemplate}`);
  }
  if (template.aiInstructions) {
    parts.push(`INSTRUÇÕES ESPECÍFICAS DA MÁSCARA:\n${template.aiInstructions}`);
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
  const patientAge = patient?.birthDate ? calculateAge(patient.birthDate) : 'Não informada';
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
export function stripScratchpad(text: string): string {
  if (!text) return '';
  let cleaned = text;

  cleaned = cleaned.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '');
  cleaned = cleaned.replace(/```(?:tool_code|python|code)?[\s\S]*?```/gi, '');

  const openXmlIndex = cleaned.toLowerCase().indexOf('<scratchpad>');
  if (openXmlIndex !== -1) {
    cleaned = cleaned.substring(0, openXmlIndex);
  }
  cleaned = cleaned.replace(/<\/?scratchpad>/gi, '');

  const hasCopilotFormat = cleaned.includes('=== CONVERSA ===') || cleaned.includes('=== PROPOSTA ===');
  if (!hasCopilotFormat) {
    const h1Index = cleaned.search(/<h1[\s>]/i);
    if (h1Index !== -1) {
      cleaned = cleaned.substring(h1Index);
    } else {
      const h2Index = cleaned.search(/<h2[\s>]/i);
      if (h2Index !== -1) {
        cleaned = cleaned.substring(h2Index);
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
  const areaContext = buildAreaContext(settings, template.area);
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

export function buildRefinePrompt({
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
  const areaContext = buildAreaContext(settings, template.area);

  const refineNote = customPrompt
    ? `INSTRUÇÃO DE REFINAMENTO: "${customPrompt}"
[REGRAS DE OURO DO REFINAMENTO — EXECUÇÃO OBRIGATÓRIA:
• OBRIGATÓRIO: Gerar o HTML do laudo COMPLETO do início ao fim. NÃO omita, corte ou abrevie seções (sem "..." ou "resto do laudo").
• PROIBIDO: Adicionar ou concatenar texto no final do laudo. As alterações DEVEM ser integradas no local correto.
• COMPLIANCE RÍGIDO DA MÁSCARA: O laudo refinado deve seguir rigorosamente a nomenclatura, ordem e estrutura de seções/títulos (tags <h1>, <h2> e parágrafos correspondentes, incluindo os estilos inline e tags internas originais como <strong>) e textos padrão definidos na MÁSCARA MODELO ORIGINAL DO EXAME. É terminantemente proibido alterar nomes de seções ou remover cabeçalhos originais. Mantenha intacta toda a formatação HTML, a redação e os parágrafos originais da máscara modelo para todos os órgãos que não foram alterados. ATENÇÃO: As seções e a estrutura do HTML da MÁSCARA MODELO ORIGINAL DO EXAME têm prioridade absoluta sobre qualquer outra regra de estrutura (como a do Bloco 3); mantenha a estrutura e estilos da máscara original exatamente como estão.
• PRESERVAÇÃO E PREENCHIMENTO: Mantenha intactos todos os dados clínicos, medidas, descrições e alterações que já foram preenchidos ou editados no LAUDO ATUAL. Resolva e preencha todos os placeholders restantes na forma de "(...)" ou "[___]" do LAUDO ATUAL, substituindo-os por descrições qualitativas ou valores normais coerentes com o contexto, de modo que o laudo final seja totalmente preenchido e livre de placeholders.
• ESPAÇAMENTO E PARÁGRAFOS: Cada estrutura anatômica ou órgão na ANÁLISE deve obrigatoriamente estar em seu próprio parágrafo individual usando a tag <p>. Nunca junte múltiplas estruturas em um único parágrafo ou use <br> para separá-las.
• Aplicar a instrução em TODOS os locais que ela afeta no laudo.
• Atualizar OBRIGATORIAMENTE as 3 seções impactadas:
  1. ANÁLISE: descrição morfológica correta e adequada do achado.
  2. CONCLUSÃO: bullet específico e clinicamente preciso para o achado.
  3. RECOMENDAÇÕES: conduta adequada ao achado (N1/N2/N3/N4) seguindo o nível de urgência clínica correto.
• Cascata Análise→Conclusão→Recomendação deve ser íntegra após a mudança.
• Achado patológico adicionado → criar bullet de conclusão + conduta correspondente.
• Achado removido ou normalizado → remover seu bullet de conclusão e conduta.
• Usar anamnese e contexto clínico do paciente para calibrar a conduta.
• O laudo completo deve ser retornado na íntegra, incluindo todas as seções. As partes, parágrafos, valores, descrições e linhas do laudo que não foram afetados pela instrução de alteração devem ser reproduzidos na íntegra e exatamente iguais ao texto original, byte a byte, sem qualquer modificação ou reescrita.
• PROIBIDO adicionar bullets extras além dos derivados da instrução.
• PROIBIDO reformatar ou reescrever seções não afetadas.]`
    : `INSTRUÇÃO: Sanitizar e higienizar o laudo completo.
• COMPLIANCE RÍGIDO DA MÁSCARA: O laudo refinado deve seguir rigorosamente a nomenclatura, ordem e estrutura de seções/títulos (tags <h1>, <h2> e parágrafos correspondentes, incluindo os estilos inline e tags internas originais como <strong>) e textos padrão definidos na MÁSCARA MODELO ORIGINAL DO EXAME. É terminantemente proibido alterar nomes de seções ou remover cabeçalhos originais. Mantenha intacta toda a formatação HTML, a redação e os parágrafos originais da máscara modelo para todos os órgãos que não foram alterados. ATENÇÃO: As seções e a estrutura do HTML da MÁSCARA MODELO ORIGINAL DO EXAME têm prioridade absoluta sobre qualquer outra regra de estrutura (como a do Bloco 3); mantenha a estrutura e estilos da máscara original exatamente como estão.
• Eliminar todos os placeholders (R1: "(...)", "[___]", unidades sem valor).
• Garantir Cascata Tripartite completa (Análise→Conclusão→Recomendação).
• Aplicar normalidade habitual para estruturas sem dado fornecido.
• Aplicar Lei da Conclusão Enxuta: colapsar normalidades em 1 bullet de síntese.
• Manter fidelidade ao contexto clínico do paciente (indicação, sexo, idade).
• Usar anamnese fornecida para calibrar recomendações e contexto diagnóstico.`;

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

Gere agora o laudo REFINADO completo em HTML puro. O output deve começar diretamente com <h1>. Zero texto antes do HTML.`;

  return { universalContext, areaContext, userMessage };
}

export function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
  template,
}: CopilotParams): BuiltPrompt {
  const copilotModeOverride = `\n\n═══════════════════════════════════════════════════════════════
OVERRIDE — MODO COPILOTO ATIVO (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════════════════
⚠ REGRAS DOS BLOCOS 2 E 3 SUSPENSAS NESTE MODO:
  • "Output começa diretamente com <h1>" — SUSPENSA
  • "Zero texto antes do HTML" — SUSPENSA
  • "ZERO caractere fora das tags HTML" — SUSPENSA

NOVA REGRA ABSOLUTA DE FORMATO (substitui as acima):
O output DEVE começar com "=== CONVERSA ===" e conter
as duas seções exatamente como especificado na mensagem.
O HTML do laudo modificado vai DENTRO de "=== PROPOSTA ===".
Violar este formato invalida completamente a resposta.
═══════════════════════════════════════════════════════════════`;

  const universalContext = buildUniversalContext(settings);
  const areaContext = buildAreaContext(settings, exam.area) + copilotModeOverride;

  const copilotFormat = `═══════════════════════════════════════════════════════════════
MODO COPILOTO — FORMATO DE RESPOSTA OBRIGATÓRIO
═══════════════════════════════════════════════════════════════
Responda EXCLUSIVAMENTE nesta estrutura:

=== CONVERSA ===
[UMA única frase (máx. 15 palavras) descrevendo a alteração clínica feita.
Exemplo: "Vesícula biliar alterada para ausente por cirurgia prévia."
SEM saudações. SEM explicações prolixas. Puramente clínica.]

=== PROPOSTA ===
[HTML COMPLETO do laudo com a alteração integrada.
REGRAS DE OURO DO COPILOTO:
• OBRIGATÓRIO: Gerar o HTML do laudo COMPLETO do início ao fim. NÃO omita, corte ou abrevie seções (sem "..." ou "resto do laudo").
• PROIBIDO: Adicionar ou concatenar o texto no final do laudo. As alterações DEVEM ser mescladas/integradas no local correto dentro da ANÁLISE.
• COMPLIANCE RÍGIDO DA MÁSCARA: O laudo refinado deve seguir rigorosamente a nomenclatura, ordem e estrutura de seções/títulos (tags <h1>, <h2> e parágrafos correspondentes, incluindo os estilos inline e tags internas originais como <strong>) e textos padrão definidos na MÁSCARA MODELO ORIGINAL DO EXAME. É terminantemente proibido alterar nomes de seções ou remover cabeçalhos originais. Mantenha intacta toda a formatação HTML, a redação e os parágrafos originais da máscara modelo para todos os órgãos que não foram alterados. ATENÇÃO: As seções e a estrutura do HTML da MÁSCARA MODELO ORIGINAL DO EXAME têm prioridade absoluta sobre qualquer outra regra de estrutura (como a do Bloco 3); mantenha a estrutura e estilos da máscara original exatamente como estão.
• ESPAÇAMENTO E PARÁGRAFOS: Cada estrutura anatômica ou órgão na ANÁLISE deve obrigatoriamente estar em seu próprio parágrafo individual usando a tag <p>. Nunca junte múltiplas estruturas em um único parágrafo ou use <br> para separá-las.
• Atualizar ANÁLISE (descrição morfológica adequada do achado, no órgão correto).
• Atualizar CONCLUSÃO (bullet específico e preciso para o achado).
• Atualizar RECOMENDAÇÕES (conduta N1-N4 adequada ao achado e contexto clínico).
• A cascata Análise→Conclusão→Recomendação deve ser íntegra.
• Achado patológico → bullet de conclusão obrigatório + conduta.
• Usar anamnese e contexto clínico para calibrar recomendações.
• PROIBIDO alterar qualquer seção não relacionada à instrução.
• Todo o restante permanece byte a byte idêntico ao laudo original.]`;

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

  const userMessage = `${copilotFormat}

═══════════════════════════════════════════════════════════════
INPUT CLÍNICO:
═══════════════════════════════════════════════════════════════
${contextMessage}`;

  return { universalContext, areaContext, userMessage };
}

// ─── Funções auxiliares e motor de chamada de API ────────────────────────────

function getModelForMode(settings: AppSettings, mode: string, area: string): string {
  if (settings.geminiModelByMode?.[mode as keyof typeof settings.geminiModelByMode]) {
    return settings.geminiModelByMode[mode as keyof typeof settings.geminiModelByMode]!;
  }
  if (mode === 'generation' && (area === 'medicina-fetal' || area === 'vascular')) {
    return settings.geminiModelPro || 'gemini-2.5-pro';
  }
  return settings.geminiModel || 'gemini-2.5-flash';
}

async function callGemini(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
  const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
  const modelName = getModelForMode(settings, mode, area);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: getModeTemperature(mode, settings.aiTemperature),
      topP: 0.9,
      maxOutputTokens: getMaxTokens(area),
    }
  });
  const result = await withRetry(() => model.generateContent(built.userMessage));
  return cleanMarkdownFromResponse(result.response.text());
}

async function callGeminiStream(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  onChunk: (text: string) => void
): Promise<string> {
  const genAI = new GoogleGenerativeAI(settings.geminiApiKey!);
  const systemInstruction = built.universalContext + (built.areaContext ? '\n\n' + built.areaContext : '');
  const modelName = getModelForMode(settings, mode, area);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: getModeTemperature(mode, settings.aiTemperature),
      topP: 0.9,
      maxOutputTokens: getMaxTokens(area),
    }
  });

  const result = await withRetry(() => model.generateContentStream(built.userMessage));
  let fullText = '';

  for await (const chunk of result.stream) {
    fullText += chunk.text();
    onChunk(stripScratchpad(cleanMarkdownFromResponse(fullText)));
  }

  return stripScratchpad(cleanMarkdownFromResponse(fullText));
}

async function callAnthropic(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string
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

  const response = await withRetry(() => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-1-0',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
      max_tokens: getMaxTokens(area),
      system: systemBlocks,
      messages: [{ role: 'user', content: built.userMessage }],
      temperature: getModeTemperature(mode, settings.aiTemperature)
    })
  }));

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
  }

  const result = await response.json();
  return cleanMarkdownFromResponse(result.content?.[0]?.text || '');
}

async function callAnthropicStream(
  built: BuiltPrompt,
  settings: AppSettings,
  area: string,
  mode: string,
  onChunk: (text: string) => void
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

  const response = await withRetry(() => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-1-0',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
      max_tokens: getMaxTokens(area),
      system: systemBlocks,
      messages: [{ role: 'user', content: built.userMessage }],
      temperature: getModeTemperature(mode, settings.aiTemperature),
      stream: true
    })
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
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';
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
    if (provider === 'gemini') {
      if (!settings.geminiApiKey) throw new Error('API Key do Gemini não configurada.');
      text = await callGemini(built, settings, area, mode);
    } else {
      if (!settings.anthropicApiKey) throw new Error('API Key do Anthropic não configurada.');
      text = await callAnthropic(built, settings, area, mode);
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
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';
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
    if (provider === 'gemini') {
      if (!settings.geminiApiKey) throw new Error('API Key do Gemini não configurada.');
      text = await callGeminiStream(built, settings, area, mode, onChunk);
    } else {
      if (!settings.anthropicApiKey) throw new Error('API Key do Anthropic não configurada.');
      text = await callAnthropicStream(built, settings, area, mode, onChunk);
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

export interface QualityReport {
  score: number;  // 0-100
  issues: Array<{
    type: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
}

export function auditReportQuality(html: string, area?: string): QualityReport {
  const issues: QualityReport['issues'] = [];
  let score = 100;

  if (!html || html.trim().length < 50) {
    return { score: 0, issues: [{ type: 'empty', severity: 'error', message: 'Laudo vazio ou muito curto.' }] };
  }

  if (!html.trimStart().toLowerCase().startsWith('<h1')) {
    issues.push({ type: 'structure', severity: 'error', message: 'Laudo não começa com <h1>.' });
    score -= 15;
  }

  const requiredSections = ['TÉCNICA', 'ANÁLISE', 'CONCLUSÃO', 'RECOMENDAÇÕES', 'OBSERVAÇÕES'];
  for (const section of requiredSections) {
    if (!html.toUpperCase().includes(section)) {
      issues.push({ type: 'missing_section', severity: 'error', message: `Seção "${section}" ausente no laudo.` });
      score -= 10;
    }
  }

  const placeholderPatterns = [
    { pattern: /\(\.\.\.\)/g, name: '(...)' },
    { pattern: /\[___\]/g, name: '[___]' },
    { pattern: /____\s*(cm|mm|mL|g)/gi, name: 'unidade órfã (____)' },
    { pattern: /\[valor\]/gi, name: '[valor]' },
  ];
  for (const { pattern, name } of placeholderPatterns) {
    const matches = html.match(pattern);
    if (matches) {
      issues.push({ type: 'placeholder', severity: 'error', message: `Placeholder "${name}" encontrado (${matches.length}x). Laudo incompleto.` });
      score -= Math.min(20, matches.length * 5);
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
