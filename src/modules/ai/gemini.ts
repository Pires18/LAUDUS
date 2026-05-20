import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_STRUCTURE_PROMPT, AREA_SPECIFIC_PROMPTS, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_RIGID_RULES } from './prompts';

interface GenerateReportParams {
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
}

interface CopilotParams {
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string; anamnesis?: string };
  settings: AppSettings;
  previousExams?: string[];
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
}

/**
 * Separação entre contexto de sistema (cacheável) e mensagem do usuário (dinâmica).
 * O systemContext é enviado como `systemInstruction` no Gemini e `system[]` no Anthropic,
 * permitindo cache automático de tokens — redução de 30-40% no custo por chamada.
 */
interface BuiltPrompt {
  systemContext: string;
  userMessage: string;
}

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
 * Monta o contexto do sistema (Blocos 1-4 + regras de área).
 * Este bloco é ESTÁTICO por chamada — ideal para cache de API.
 * Gemini → systemInstruction | Anthropic → system[] com cache_control.
 */
function buildSystemContext(settings: AppSettings, area: string): string {
  const master = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const global = settings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
  const skeleton = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaRules = AREA_SPECIFIC_PROMPTS[area] || '';
  const areaExtra = settings.aiAreaPrompts?.[area as ExamArea] || '';

  const parts = [master, global, skeleton, rules];
  if (areaRules) {
    parts.push(`═══════════════════════════════════════════\nPROTOCOLO DE ÁREA ATIVO:\n═══════════════════════════════════════════\n${areaRules}`);
  }
  if (areaExtra) {
    parts.push(`═══════════════════════════════════════════\nINSTRUÇÕES PERSONALIZADAS DA ÁREA:\n═══════════════════════════════════════════\n${areaExtra}`);
  }
  return parts.join('\n\n');
}

/**
 * Serializa a máscara HTML em bloco de texto para o prompt.
 */
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
  if (template.aiInstructions) {
    parts.push(`INSTRUÇÕES ESPECÍFICAS DA MÁSCARA:\n${template.aiInstructions}`);
  }
  return parts.join('\n\n');
}

/**
 * Monta a mensagem de contexto clínico — formato mínimo BLOCO 3.
 * Esta é a parte DINÂMICA — varia por paciente/exame/notas.
 */
function buildContextMessage({
  mode,
  examType,
  patient,
  clinicalIndication,
  anamnesis,
  notes,
  maskHtml,
  requestingPhysician,
  previousExams = [],
}: {
  mode: 'GERAÇÃO INICIAL' | 'REFINAMENTO';
  examType: string;
  patient: Patient | null;
  clinicalIndication: string;
  anamnesis?: string;
  notes: string;
  maskHtml: string;
  requestingPhysician?: string;
  previousExams?: string[];
}): string {
  const examDate = new Date().toLocaleDateString('pt-BR');
  const patientAge = patient?.birthDate ? calculateAge(patient.birthDate) : 'Não informada';
  const genderMap = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;
  const patientGender = patient?.gender ? genderMap[patient.gender as keyof typeof genderMap] || 'Não informado' : 'Não informado';

  const lines: string[] = [
    `MODO: ${mode}`,
    `EXAME: ${examType}`,
    `DATA: ${examDate}`,
    `PACIENTE: ${patient?.name || 'Não informado'}, ${patientAge}, ${patientGender}`,
  ];
  if (patient?.insurance) lines.push(`CONVÊNIO: ${patient.insurance}`);
  if (patient?.history) lines.push(`HISTÓRICO CLÍNICO: ${patient.history}`);
  lines.push(`INDICAÇÃO: ${clinicalIndication || 'Não informada'}`);
  if (requestingPhysician) lines.push(`MÉDICO SOLICITANTE: ${requestingPhysician}`);

  // Anamnese — contexto clínico detalhado coletado na consulta
  if (anamnesis && anamnesis.trim()) {
    lines.push(`\nANAMNESE DO PACIENTE (dados da consulta — usar como contexto clínico prioritário para calibrar descrição, conclusão e recomendações):\n${anamnesis.trim()}`);
  }

  lines.push(`NOTAS DO MÉDICO: ${notes || 'Nenhuma nota adicional.'}`);

  const prevContext = previousExams.length > 0
    ? `\n\nREFERÊNCIA DE ESTILO (laudos anteriores — mimetize APENAS o estilo de escrita, NUNCA copie dados clínicos):\n[INÍCIO DOS EXEMPLOS]\n${previousExams.join('\n\n---\n\n')}\n[FIM DOS EXEMPLOS]`
    : '';

  return `${lines.join('\n')}${prevContext}

MÁSCARA DE REFERÊNCIA:
${maskHtml}`;
}

/**
 * Remove raciocínio interno do modelo do output — defesa multicamada.
 * Captura: <scratchpad>...</scratchpad>, blocos tool_code/python, e
 * qualquer texto antes da primeira tag <h1> (defesa de última linha).
 */
export function stripScratchpad(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Camada 1: Remove blocos <scratchpad>...</scratchpad> (formato XML)
  cleaned = cleaned.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '');

  // Camada 2: Remove blocos tool_code / python / code completos com conteúdo
  // Captura ```tool_code ... ```, ```python ... ```, ``` ... ``` no início do texto
  cleaned = cleaned.replace(/```(?:tool_code|python|code)?[\s\S]*?```/gi, '');

  // Camada 3: Remove <scratchpad> aberto sem fechamento (streaming)
  const openXmlIndex = cleaned.toLowerCase().indexOf('<scratchpad>');
  if (openXmlIndex !== -1) {
    cleaned = cleaned.substring(0, openXmlIndex);
  }

  // Camada 4: Remove tags órfãs residuais
  cleaned = cleaned.replace(/<\/?scratchpad>/gi, '');

  // Camada 5 (defesa final): Remove qualquer texto antes do primeiro <h1>
  // Se o modelo vazou raciocínio antes do HTML, descarta tudo antes do <h1>
  const h1Index = cleaned.search(/<h1[\s>]/i);
  if (h1Index > 0) {
    // Há conteúdo antes do <h1> — verificar se parece texto de raciocínio
    const before = cleaned.substring(0, h1Index).trim();
    // Se tem mais de 20 caracteres antes do h1, é provável raciocínio vazado
    if (before.length > 20) {
      cleaned = cleaned.substring(h1Index);
    }
  }

  return cleaned.trim();
}

/**
 * Prompt de GERAÇÃO INICIAL — laudo construído do zero a partir da máscara.
 * Retorna { systemContext, userMessage } para aproveitamento de cache de API.
 */
export function buildPrompt({
  template,
  patient,
  clinicalIndication,
  requestingPhysician,
  anamnesis,
  settings,
  previousExams = [],
}: GenerateReportParams): BuiltPrompt {
  const systemContext = buildSystemContext(settings, template.area);
  const maskHtml = buildMaskHtml(template);
  const contextMessage = buildContextMessage({
    mode: 'GERAÇÃO INICIAL',
    examType: template.name,
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: clinicalIndication || 'Nenhuma nota adicional do médico.',
    maskHtml,
    requestingPhysician,
    previousExams,
  });

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

Gere agora o laudo completo em HTML puro. O output deve começar diretamente com <h1>. Zero texto antes do HTML.`;

  return { systemContext, userMessage };
}

/**
 * Prompt de REFINAMENTO — higienização e/ou edição cirúrgica de laudo existente.
 * Aplica R10 (Congelamento): altera apenas o trecho solicitado.
 * Retorna { systemContext, userMessage } para aproveitamento de cache de API.
 */
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
}: RefineParams): BuiltPrompt {
  const systemContext = buildSystemContext(settings, template.area);

  const refineNote = customPrompt
    ? `INSTRUÇÃO DE REFINAMENTO: "${customPrompt}"
[REGRAS DE OURO DO REFINAMENTO — EXECUÇÃO OBRIGATÓRIA:
• Aplicar a instrução em TODOS os locais que ela afeta no laudo.
• Atualizar OBRIGATORIAMENTE as 3 seções impactadas:
  1. ANÁLISE: descrição morfológica correta e adequada do achado.
  2. CONCLUSÃO: bullet específico e clinicamente preciso para o achado.
  3. RECOMENDAÇÕES: conduta adequada ao achado (N1/N2/N3/N4) seguindo
     o nível de urgência clínica correto.
• Cascata Análise→Conclusão→Recomendação deve ser íntegra após a mudança.
• Achado patológico adicionado → criar bullet de conclusão + conduta correspondente.
• Achado removido ou normalizado → remover seu bullet de conclusão e conduta.
• Usar anamnese e contexto clínico do paciente para calibrar a conduta.
• PROIBIDO alterar qualquer linha não relacionada à instrução acima.
• PROIBIDO adicionar bullets extras além dos derivados da instrução.
• PROIBIDO reformatar ou reescrever seções não afetadas.]`
    : `INSTRUÇÃO: Sanitizar e higienizar o laudo completo.
• Eliminar todos os placeholders (R1: "(...)", "[___]", unidades sem valor).
• Garantir Cascata Tripartite completa (Análise→Conclusão→Recomendação).
• Aplicar normalidade habitual para estruturas sem dado fornecido.
• Aplicar Lei da Conclusão Enxuta: colapsar normalidades em 1 bullet de síntese.
• Manter fidelidade ao contexto clínico do paciente (indicação, sexo, idade).
• Usar anamnese fornecida para calibrar recomendações e contexto diagnóstico.`;

  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: template.name,
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: refineNote,
    maskHtml: currentReport,
    requestingPhysician,
    previousExams,
  });

  const userMessage = `═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
${contextMessage}

Gere agora o laudo REFINADO completo em HTML puro. O output deve começar diretamente com <h1>. Zero texto antes do HTML.`;

  return { systemContext, userMessage };
}

/**
 * Prompt do COPILOTO — edição incremental com resposta estruturada em dois blocos.
 * Aplica R10 (Congelamento) + formato === CONVERSA === / === PROPOSTA ===.
 * Retorna { systemContext, userMessage } para aproveitamento de cache de API.
 */
export function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
}: CopilotParams): BuiltPrompt {
  const systemContext = buildSystemContext(settings, exam.area);

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
• Atualizar ANÁLISE (descrição morfológica adequada do achado).
• Atualizar CONCLUSÃO (bullet específico e preciso para o achado).
• Atualizar RECOMENDAÇÕES (conduta N1-N4 adequada ao achado e contexto clínico).
• A cascata Análise→Conclusão→Recomendação deve ser íntegra.
• Achado patológico → bullet de conclusão obrigatório + conduta.
• Usar anamnese e contexto clínico para calibrar recomendações.
• PROIBIDO alterar qualquer seção não relacionada à instrução.
• Todo o restante permanece byte a byte idêntico ao laudo original.]`;

  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: exam.examType,
    patient,
    clinicalIndication: exam.clinicalIndication || '',
    anamnesis: exam.anamnesis,
    notes: instruction,
    maskHtml: currentReport,
    requestingPhysician: exam.requestingPhysician,
    previousExams,
  });

  const userMessage = `${copilotFormat}

═══════════════════════════════════════════════════════════════
INPUT CLÍNICO:
═══════════════════════════════════════════════════════════════
${contextMessage}`;

  return { systemContext, userMessage };
}

function cleanMarkdownFromResponse(text: string): string {
  return text
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export async function generateReport(params: GenerateReportParams | CopilotParams | RefineParams): Promise<string> {
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';

  let built: BuiltPrompt;
  if ('instruction' in params) {
    built = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    built = buildRefinePrompt(params as RefineParams);
  } else {
    built = buildPrompt(params as GenerateReportParams);
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    // systemInstruction separado → ativação automática de cache de tokens no Gemini 2.5
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
      systemInstruction: built.systemContext,
      generationConfig: {
        temperature: settings.aiTemperature ?? 0.3,
        topP: 0.9,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent(built.userMessage);
    let text = cleanMarkdownFromResponse(result.response.text());
    return stripScratchpad(text);
  } else {
    if (!settings.anthropicApiKey) {
      throw new Error('API Key do Anthropic não configurada. Vá em Configurações para adicionar.');
    }

    // system[] com cache_control → tokens de sistema cobrados ~10x mais barato
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-1-0',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: built.systemContext,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [{ role: 'user', content: built.userMessage }],
        temperature: settings.aiTemperature ?? 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    let text = cleanMarkdownFromResponse(result.content?.[0]?.text || '');
    return stripScratchpad(text);
  }
}

export async function generateReportStream(
  params: GenerateReportParams | CopilotParams | RefineParams,
  onChunk: (text: string) => void
): Promise<string> {
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';

  let built: BuiltPrompt;
  if ('instruction' in params) {
    built = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    built = buildRefinePrompt(params as RefineParams);
  } else {
    built = buildPrompt(params as GenerateReportParams);
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    // systemInstruction separado → ativação automática de cache de tokens no Gemini 2.5
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
      systemInstruction: built.systemContext,
      generationConfig: {
        temperature: settings.aiTemperature ?? 0.3,
        topP: 0.9,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContentStream(built.userMessage);
    let fullText = '';

    for await (const chunk of result.stream) {
      fullText += chunk.text();
      onChunk(stripScratchpad(cleanMarkdownFromResponse(fullText)));
    }

    fullText = stripScratchpad(cleanMarkdownFromResponse(fullText));
    return fullText;
  } else {
    if (!settings.anthropicApiKey) {
      throw new Error('API Key do Anthropic não configurada. Vá em Configurações para adicionar.');
    }

    // system[] com cache_control + stream
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-1-0',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: built.systemContext,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [{ role: 'user', content: built.userMessage }],
        temperature: settings.aiTemperature ?? 0.3,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Não foi possível inicializar o leitor de stream.');
    }

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
          // Ignorar eventos não-JSON (SSE de controle)
        }
      }
    }

    fullText = stripScratchpad(cleanMarkdownFromResponse(fullText));
    return fullText;
  }
}

export function generateMockReport(params: GenerateReportParams): string {
  const { template } = params;

  return `<h1>${template.title}</h1>
<h2>ANÁLISE</h2>
${template.analysisTemplate}
<h2>CONCLUSÃO</h2>
${template.conclusionTemplate}
<h2>RECOMENDAÇÕES</h2>
${template.recommendationsTemplate}
<h2>OBSERVAÇÕES METODOLÓGICAS</h2>
<p><em>[Laudo gerado em modo de demonstração — configure a API Key do Gemini ou Anthropic em Configurações para usar IA real]</em></p>`;
}
