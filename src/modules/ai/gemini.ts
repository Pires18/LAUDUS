import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, Patient, AppSettings } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_RIGID_RULES, DEFAULT_STRUCTURE_PROMPT, AREA_SPECIFIC_PROMPTS, DEFAULT_ADVANCED_REASONING } from './prompts';

interface GenerateReportParams {
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  previousExams?: string[];
}

interface CopilotParams {
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string };
  settings: AppSettings;
  previousExams?: string[];
}

interface RefineParams {
  currentReport: string;
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  previousExams?: string[];
  customPrompt?: string;
}

/**
 * Constrói o prompt enviado ao Gemini para geração inicial do laudo.
 * O prompt força a IA a seguir EXATAMENTE a estrutura definida na Máscara.
 */
export function buildPrompt({
  template,
  patient,
  clinicalIndication,
  settings,
  previousExams = [],
}: GenerateReportParams): string {
  const patientBlock = patient
    ? `Paciente: ${patient.name}${patient.birthDate ? ` (DN: ${patient.birthDate})` : ''}${patient.gender ? ` - ${patient.gender}` : ''}`
    : '';

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const areaInstructions = settings.aiAreaPrompts?.[template.area] || '';
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[template.area] || '';

  const previousContext = previousExams.length > 0 
    ? `\n═══════════════════════════════════════════\nREFERÊNCIA DE ESTILO (LAUDOS ANTERIORES):\n═══════════════════════════════════════════\nUse os exemplos abaixo como guia de estilo, vocabulário e padrão de recomendações:\n\n${previousExams.join('\n\n--- NEXT EXAMPLE ---\n\n')}\n`
    : '';

  return `${masterPrompt}

${areaSpecificRules ? `═══════════════════════════════════════════\nREGRAS DA ÁREA (${template.area}):\n═══════════════════════════════════════════\n${areaSpecificRules}\n` : ''}

${previousContext}

Sua tarefa é preencher uma "Máscara Aberta" (Open Mask) de laudo médico.
NUNCA deixe placeholders "(...)" ou campos vazios no laudo final. 
DETERMINISMO DE NORMALIDADE: Se uma medida ou dado não foi fornecido, você deve descrever a estrutura como "habitual", "preservada" ou "com dimensões habituais", mimetizando o estilo do médico.
TRANSFORME os dados do contexto em um laudo fluido, denso e profissional.

═══════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA (Siga à risca):
═══════════════════════════════════════════
${structurePrompt}

═══════════════════════════════════════════
DADOS DO CONTEXTO:
═══════════════════════════════════════════
Tipo de exame: ${template.name}
Área: ${template.area}
${patientBlock}
${clinicalIndication ? `\nIndicação clínica: ${clinicalIndication}` : ''}

═══════════════════════════════════════════
MÁSCARA DE REFERÊNCIA (ESTRUTURA E CONTEÚDO):
═══════════════════════════════════════════

TÍTULO: 
${template.title}

TÉCNICA:
${template.technique}

ANÁLISE:
${template.analysisTemplate}

CONCLUSÃO:
${template.conclusionTemplate}

${template.classificationTemplate ? `CLASSIFICAÇÃO:\n${template.classificationTemplate}\n` : ''}

RECOMENDAÇÕES:
${template.recommendationsTemplate}

═══════════════════════════════════════════
INSTRUÇÕES ADICIONAIS:
═══════════════════════════════════════════
${areaInstructions ? `\nCOMPORTAMENTO DA ÁREA: ${areaInstructions}` : ''}
${template.aiInstructions ? `\nINSTRUÇÕES DA MÁSCARA: ${template.aiInstructions}` : ''}
${settings.aiGlobalInstructions ? `\nINSTRUÇÕES GLOBAIS: ${settings.aiGlobalInstructions}` : ''}
${DEFAULT_ADVANCED_REASONING}

${rigidRules}

Gere agora o laudo completo (apenas HTML):`;
}

/**
 * Constrói o prompt para REFINAR o laudo.
 * Pega o laudo atual (que pode ter sido alterado pelo Copilot) e faz uma revisão final profissional.
 */
export function buildRefinePrompt({
  currentReport,
  template,
  patient,
  settings,
  clinicalIndication,
  previousExams = [],
  customPrompt,
}: RefineParams): string {
  const patientBlock = patient
    ? `Paciente: ${patient.name}${patient.birthDate ? ` (DN: ${patient.birthDate})` : ''}${patient.gender ? ` - ${patient.gender}` : ''}`
    : '';

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[template.area] || '';

  const previousContext = previousExams.length > 0 
    ? `\n═══════════════════════════════════════════\nREFERÊNCIA DE ESTILO (LAUDOS ANTERIORES):\n═══════════════════════════════════════════\nSiga rigorosamente o estilo de fraseologia e padronização de condutas destes exemplos:\n\n${previousExams.join('\n\n--- NEXT EXAMPLE ---\n\n')}\n`
    : '';

  const taskDescription = customPrompt 
    ? `Sua tarefa é AJUSTAR o laudo médico conforme a seguinte instrução: "${customPrompt}".`
    : `Sua tarefa é REFINAR e REVISAR um laudo médico que foi preenchido. 
       O laudo atual pode conter placeholders "(...)" ou anotações rápidas inseridas pelo médico.
       Transforme-o em um laudo final, elegante, profissional e sem erros, mantendo a estrutura padrão.`;

  return `${masterPrompt}

${areaSpecificRules ? `═══════════════════════════════════════════\nREGRAS DA ÁREA (${template.area}):\n═══════════════════════════════════════════\n${areaSpecificRules}\n` : ''}

${previousContext}

${taskDescription}

═══════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA:
═══════════════════════════════════════════
${structurePrompt}

═══════════════════════════════════════════
LAUDO PARA REFINAR (CONTEÚDO ATUAL):
═══════════════════════════════════════════
${currentReport}

═══════════════════════════════════════════
DADOS DO CONTEXTO:
═══════════════════════════════════════════
Tipo de exame: ${template.name}
Área: ${template.area}
${patientBlock}
${clinicalIndication ? `\nIndicação clínica: ${clinicalIndication}` : ''}

${rigidRules}

Gere agora o laudo final REFINADO (apenas o HTML completo):`;
}

/**
 * Constrói o prompt para o Copilot IA.
 * Recebe o laudo atual e uma instrução do médico.
 */
export function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
}: CopilotParams): string {
  const patientBlock = patient
    ? `Paciente: ${patient.name}${patient.birthDate ? ` (DN: ${patient.birthDate})` : ''}${patient.gender ? ` - ${patient.gender}` : ''}`
    : '';

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[exam.area] || '';

  const previousContext = previousExams.length > 0 
    ? `\n═══════════════════════════════════════════\nREFERÊNCIA DE ESTILO (LAUDOS ANTERIORES):\n═══════════════════════════════════════════\nUse estes exemplos para guiar a forma de inserir novos dados e manter a consistência:\n\n${previousExams.join('\n\n--- NEXT EXAMPLE ---\n\n')}\n`
    : '';

  return `${masterPrompt}

${areaSpecificRules ? `═══════════════════════════════════════════\nREGRAS DA ÁREA (${exam.area}):\n═══════════════════════════════════════════\n${areaSpecificRules}\n` : ''}

${previousContext}

Sua tarefa agora é ATUALIZAR ou EDITAR um laudo existente com base em uma nova instrução do médico.
Mantenha rigorosamente a estrutura de tópicos (TÍTULO, TÉCNICA, ANÁLISE, CONCLUSÃO, etc).

═══════════════════════════════════════════
${structurePrompt}
═══════════════════════════════════════════

DADOS DO CONTEXTO:
Tipo de exame: ${exam.examType}
Área: ${exam.area}
${patientBlock}
${exam.clinicalIndication ? `\nIndicação clínica: ${exam.clinicalIndication}` : ''}

═══════════════════════════════════════════
LAUDO ATUAL (CONTEÚDO PARA EDITAR):
═══════════════════════════════════════════
${currentReport}

═══════════════════════════════════════════
INSTRUÇÃO DO MÉDICO (O QUE MUDAR):
═══════════════════════════════════════════
>>> ${instruction} <<<

${settings.aiGlobalInstructions ? `═══════════════════════════════════════════\nINSTRUÇÕES GLOBAIS AVANÇADAS\n═══════════════════════════════════════════\n\n${settings.aiGlobalInstructions}\n` : ''}

${DEFAULT_ADVANCED_REASONING}

${rigidRules}

Gere agora o laudo completo ATUALIZADO (apenas o HTML final):`;
}

export async function generateReport(params: GenerateReportParams | CopilotParams | RefineParams): Promise<string> {
  const { settings } = params;
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  let prompt: string;
  if ('instruction' in params) {
    prompt = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    prompt = buildRefinePrompt(params as RefineParams);
  } else {
    prompt = buildPrompt(params as GenerateReportParams);
  }

  const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: settings.geminiModel || 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: settings.aiTemperature ?? 0.3,
      topP: 0.9,
      maxOutputTokens: 4096,
    }
  });

  const result = await model.generateContent(prompt);
  let text = result.response.text();

  text = text.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
  text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  return text;
}

export async function generateReportStream(
  params: GenerateReportParams | CopilotParams | RefineParams,
  onChunk: (text: string) => void
): Promise<string> {
  const { settings } = params;
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  let prompt: string;
  if ('instruction' in params) {
    prompt = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    prompt = buildRefinePrompt(params as RefineParams);
  } else {
    prompt = buildPrompt(params as GenerateReportParams);
  }

  const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: settings.geminiModel || 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: settings.aiTemperature ?? 0.3,
      topP: 0.9,
      maxOutputTokens: 4096,
    }
  });

  const result = await model.generateContentStream(prompt);
  let fullText = '';
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    
    let cleanText = fullText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    onChunk(cleanText);
  }

  fullText = fullText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
  fullText = fullText.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  
  return fullText;
}

/**
 * Versão de teste sem chamar a API: gera um laudo "fake" baseado na máscara,
 * útil quando ainda não há API key.
 */
export function generateMockReport(params: GenerateReportParams): string {
  const { template } = params;
  
  return `<h2>${template.title}</h2>
<h2>TÉCNICA</h2>
<p>${template.technique}</p>
<h2>ANÁLISE</h2>
${template.analysisTemplate}
<h2>CLASSIFICAÇÕES</h2>
<p>${template.classificationTemplate || '(...)'}</p>
<h2>CONCLUSÃO</h2>
<p>${template.conclusionTemplate}</p>
<h2>RECOMENDAÇÕES</h2>
<p>${template.recommendationsTemplate}</p>
<p><em>[Laudo gerado em modo de demonstração — configure a API Key do Gemini em Configurações para usar IA real]</em></p>`;
}
