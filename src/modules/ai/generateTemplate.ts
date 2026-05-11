import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings, ExamArea } from '../../types';

interface GeneratedTemplate {
  title: string;
  technique: string;
  analysisTemplate: string;
  conclusionTemplate: string;
  recommendationsTemplate: string;
}

/**
 * Usa a IA (Gemini) para gerar uma estrutura padrão de laudo (máscara)
 * baseada na área médica e no nome do exame.
 */
export async function generateTemplateStructure(
  area: ExamArea,
  examName: string,
  settings: AppSettings
): Promise<GeneratedTemplate> {
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

  const prompt = `Você é um especialista em Radiologia e Ultrassonografia.
Sua tarefa é criar um "Modelo Padrão" (Máscara) para um laudo de ultrassom.
Este modelo será usado por médicos como base para seus laudos.

DADOS DO EXAME:
- Área Médica: ${area}
- Nome do Exame: ${examName}

INSTRUÇÕES:
1. Crie um Título profissional.
2. Descreva uma Técnica padrão adequada para este exame.
3. Crie um Modelo de Análise (o corpo do laudo) que descreva os órgãos/estruturas em estado NORMAL. 
   - Use placeholders entre colchetes como [medida], [descricao] para partes que variam.
   - O texto deve ser articulado e profissional (PT-BR).
4. Crie um Modelo de Conclusão padrão (ex: exame dentro da normalidade).
5. Crie um Modelo de Recomendações (se aplicável).

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "title": "String",
  "technique": "String (use \\n para quebras de linha)",
  "analysisTemplate": "String (use \\n para quebras de linha)",
  "conclusionTemplate": "String (use \\n para quebras de linha)",
  "recommendationsTemplate": "String (use \\n para quebras de linha)"
}

Retorne APENAS o JSON, sem explicações, sem markdown, sem \`\`\`.`;

  const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: settings.geminiModel || 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 4096,
    }
  });

  const result = await model.generateContent(prompt);
  let text = result.response.text();

  // Clean markdown code blocks if present
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(text) as GeneratedTemplate;
  } catch (err) {
    console.error('Erro ao processar JSON da IA:', text);
    throw new Error('A IA gerou uma resposta em formato inválido. Tente novamente.');
  }
}
