import { GoogleGenerativeAI } from '@google/generative-ai';
import { FormField, ReportTemplate, AppSettings } from '../../types';
import { CALCULATORS } from '../calculators/registry';
import { genId } from '../../store/db';
import { DEFAULT_FORM_GENERATION_PROMPT } from './prompts';

/**
 * Usa a IA (Gemini) para analisar a estrutura de uma máscara
 * e gerar automaticamente os campos de formulário adequados.
 */
export async function generateFormFieldsFromTemplate(
  template: ReportTemplate,
  settings: AppSettings
): Promise<FormField[]> {
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  const calculatorList = CALCULATORS.map(c => `- ID: "${c.id}" → ${c.name}: ${c.description}`).join('\n');

  const prompt = `${DEFAULT_FORM_GENERATION_PROMPT}

═══════════════════════════════════════
DADOS DA MÁSCARA
═══════════════════════════════════════

Área: ${template.area}
Nome do Exame: ${template.name}
Título: ${template.title}

TÉCNICA:
${template.technique}

ANÁLISE (modelo):
${template.analysisTemplate}

CONCLUSÃO (modelo):
${template.conclusionTemplate}

${template.classificationTemplate ? `CLASSIFICAÇÃO (modelo):\n${template.classificationTemplate}\n` : ''}
RECOMENDAÇÕES (modelo):
${template.recommendationsTemplate}

═══════════════════════════════════════
CALCULADORAS DISPONÍVEIS NO SISTEMA
═══════════════════════════════════════
${calculatorList}

${settings.aiGlobalInstructions ? `═══════════════════════════════════════
INSTRUÇÕES GLOBAIS DO SISTEMA
═══════════════════════════════════════
${settings.aiGlobalInstructions}` : ''}`;

  const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: settings.geminiModel || 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 8192,
    }
  });

  const result = await model.generateContent(prompt);
  let text = result.response.text();

  // Clean markdown code blocks and any prefix/suffix text
  text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
  
  // Find the first [ and last ] to extract JSON array
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) {
    text = text.substring(firstBracket, lastBracket + 1);
  }

  // Parse JSON
  const parsed: any[] = JSON.parse(text);

  // Validate and normalize each field, adding unique IDs
  const fields: FormField[] = parsed.map((f: any) => ({
    id: genId(),
    type: f.type || 'text',
    label: f.label || 'Campo',
    placeholder: f.placeholder,
    helpText: f.helpText,
    required: f.required ?? false,
    defaultValue: f.defaultValue,
    unit: f.unit,
    options: f.options,
    calculatorId: f.calculatorId,
    group: f.group,
  }));

  return fields;
}
