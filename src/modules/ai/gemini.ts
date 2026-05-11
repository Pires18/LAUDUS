import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, FormField, Patient, AppSettings } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_RIGID_RULES, DEFAULT_STRUCTURE_PROMPT } from './prompts';

interface GenerateReportParams {
  template: ReportTemplate;
  formData: Record<string, any>;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
}

/**
 * Constrói o prompt enviado ao Gemini.
 * O prompt inclui instruções rígidas para manter a estrutura padrão dos laudos:
 * TÍTULO ; TÉCNICA ; ANÁLISE ; CONCLUSÃO ; CLASSIFICAÇÃO (quando houver) ; RECOMENDAÇÕES
 */
export function buildPrompt({
  template,
  formData,
  patient,
  clinicalIndication,
  settings,
}: GenerateReportParams): string {
  // Achados do formulário em formato legível
  const findingsLines: string[] = [];
  for (const field of template.formFields) {
    if (field.type === 'separator') continue;
    const v = formData[field.id];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;

    let valueStr = '';
    if (field.type === 'calculator') {
      if (v && typeof v === 'object' && v._summary) {
        valueStr = v._summary;
      } else {
        continue; // ignora se não tem resumo
      }
    } else if (field.type === 'measurement' && typeof v === 'object') {
      valueStr = `${v.value ?? ''} ${v.unit ?? field.unit ?? ''}`.trim();
    } else if (Array.isArray(v)) {
      valueStr = v.join(', ');
    } else if (typeof v === 'boolean') {
      valueStr = v ? 'Sim' : 'Não';
    } else {
      valueStr = String(v);
    }
    findingsLines.push(`- ${field.label}: ${valueStr}`);
  }

  const findings = findingsLines.join('\n') || '(sem achados preenchidos)';

  const patientBlock = patient
    ? `Paciente: ${patient.name}${patient.birthDate ? ` (DN: ${patient.birthDate})` : ''}${patient.gender ? ` - ${patient.gender}` : ''}`
    : '';

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const areaInstructions = settings.aiAreaPrompts?.[template.area] || '';
  const examInstructions = settings.aiExamPrompts?.[template.name] || '';
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;

  return `${masterPrompt}

═══════════════════════════════════════════
${structurePrompt}
═══════════════════════════════════════════

═══════════════════════════════════════════
DADOS DO EXAME
═══════════════════════════════════════════

Tipo de exame: ${template.name}
Área: ${template.area}
${patientBlock}
${clinicalIndication ? `\nIndicação clínica: ${clinicalIndication}` : ''}

═══════════════════════════════════════════
MÁSCARA / TEMPLATE BASE (siga estrutura, terminologia e estilo)
═══════════════════════════════════════════

TÍTULO: ${template.title}

TÉCNICA:
${template.technique}

ANÁLISE (modelo):
${template.analysisTemplate}

CONCLUSÃO (modelo):
${template.conclusionTemplate}

${template.classificationTemplate ? `CLASSIFICAÇÃO (modelo):\n${template.classificationTemplate}\n` : ''}

RECOMENDAÇÕES (modelo):
${template.recommendationsTemplate}

═══════════════════════════════════════════
ACHADOS DO EXAME ATUAL (preenchidos pelo médico)
═══════════════════════════════════════════

${findings}

${areaInstructions ? `═══════════════════════════════════════════\nCOMPORTAMENTO DA ÁREA (${template.area.toUpperCase()})\n═══════════════════════════════════════════\n\n${areaInstructions}\n` : ''}
${examInstructions ? `═══════════════════════════════════════════\nCOMPORTAMENTO ESPECÍFICO DO EXAME (${template.name.toUpperCase()})\n═══════════════════════════════════════════\n\n${examInstructions}\n` : ''}
${template.aiInstructions ? `═══════════════════════════════════════════\nINSTRUÇÕES ESPECÍFICAS DA MÁSCARA\n═══════════════════════════════════════════\n\n${template.aiInstructions}\n` : ''}
${settings.aiGlobalInstructions ? `═══════════════════════════════════════════\nINSTRUÇÕES GLOBAIS AVANÇADAS\n═══════════════════════════════════════════\n\n${settings.aiGlobalInstructions}\n` : ''}

${rigidRules}

Gere agora o laudo completo:`;
}

export async function generateReport(params: GenerateReportParams): Promise<string> {
  const { settings } = params;
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  const prompt = buildPrompt(params);
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

  // Limpa eventuais blocos de markdown que o modelo possa ter adicionado
  text = text.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
  text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  return text;
}

export async function generateReportStream(
  params: GenerateReportParams,
  onChunk: (text: string) => void
): Promise<string> {
  const { settings } = params;
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  const prompt = buildPrompt(params);
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
    
    // Attempt to clean markdown block tags during stream
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
  const { template, formData } = params;
  const findingsList = template.formFields
    .filter(f => f.type !== 'separator')
    .map(f => {
      const v = formData[f.id];
      if (v === undefined || v === '' || v === null) return null;
      let valStr = String(v);
      if (f.type === 'calculator') {
        if (typeof v === 'object' && v._summary) valStr = v._summary;
        else return null;
      } else if (typeof v === 'object') {
        valStr = JSON.stringify(v);
      }
      return `<li><strong>${f.label}:</strong> ${valStr}</li>`;
    })
    .filter(Boolean)
    .join('');

  return `<h2>${template.title}</h2>
<h2>TÉCNICA</h2>
<p>${template.technique}</p>
<h2>ANÁLISE</h2>
<p>${template.analysisTemplate}</p>
${findingsList ? `<p><strong>Achados preenchidos:</strong></p><ul>${findingsList}</ul>` : ''}
<h2>CONCLUSÃO</h2>
<p>${template.conclusionTemplate}</p>
${template.classificationTemplate ? `<h2>CLASSIFICAÇÃO</h2><p>${template.classificationTemplate}</p>` : ''}
<h2>RECOMENDAÇÕES</h2>
<p>${template.recommendationsTemplate}</p>
<p><em>[Laudo gerado em modo de demonstração — configure a API Key do Gemini em Configurações para usar IA real]</em></p>`;
}
