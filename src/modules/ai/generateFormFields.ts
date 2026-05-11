import { GoogleGenerativeAI } from '@google/generative-ai';
import { FormField, ReportTemplate, AppSettings } from '../../types';
import { CALCULATORS } from '../calculators/registry';
import { genId } from '../../store/db';

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

  const prompt = `Você é um especialista em ultrassonografia e sistemas de laudos médicos.
Analise a máscara/template de laudo abaixo e gere uma lista de campos de formulário (FormField[]) que o médico deve preencher durante o exame.

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

═══════════════════════════════════════
TIPOS DE CAMPO DISPONÍVEIS
═══════════════════════════════════════
- "text": Texto curto (1 linha)
- "textarea": Texto longo (várias linhas, para descrições livres)
- "number": Valor numérico
- "measurement": Valor com unidade (ex: mm, cc, cm). Requer campo "unit"
- "select": Dropdown de seleção única. Requer "options" com {value, label}
- "multiselect": Seleção múltipla
- "radio": Botões de rádio
- "checkbox": Sim/Não
- "date": Campo de data
- "separator": Divisor visual de seção (título agrupador). Use "label" como título
- "calculator": Calculadora integrada. Requer "calculatorId" com o ID da lista acima

═══════════════════════════════════════
REGRAS DE GERAÇÃO
═══════════════════════════════════════

1. Analise os placeholders [nomeDoPlaceholder] na máscara e crie campos correspondentes.
2. Crie campos de "measurement" para medidas com unidades (mm, cc, cm/s, etc.).
3. Use "select" para opções finitas e conhecidas (ex: posição fetal, grau de esteatose).
4. Use "separator" para agrupar campos em seções lógicas (ex: "BIOMETRIA", "DOPPLER", "ANEXOS").
5. Inclua calculadoras quando o exame exigir cálculos conhecidos (peso fetal, TI-RADS, BI-RADS, volume, etc.).
6. Gere IDs em camelCase sem acentos e descritivos (ex: "volumeUterino", "compRimDir").
7. Defina "required: true" apenas para campos absolutamente essenciais.
8. Adicione "defaultValue" quando houver um valor normal típico.
9. Adicione "helpText" para campos que necessitem orientação.
10. Gere um formulário COMPLETO e PROFISSIONAL, sem omitir campos importantes.

═══════════════════════════════════════
FORMATO DE SAÍDA (JSON puro, sem markdown)
═══════════════════════════════════════

Retorne APENAS um array JSON válido de objetos FormField. Cada objeto deve ter:
{
  "id": "string (camelCase)",
  "type": "text|textarea|number|measurement|select|multiselect|radio|checkbox|date|separator|calculator",
  "label": "string (português)",
  "placeholder": "string (opcional)",
  "helpText": "string (opcional)",
  "required": boolean,
  "defaultValue": "any (opcional)",
  "unit": "string (apenas para measurement)",
  "options": [{"value":"string","label":"string"}] (apenas para select/radio/multiselect),
  "calculatorId": "string (apenas para calculator, use ID da lista acima)"
}

Retorne APENAS o JSON, sem explicações, sem markdown, sem \`\`\`.`;

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

  // Clean markdown code blocks if present
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

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
