import { AppSettings, ExamArea } from '../../types';
import { logger } from '../../utils/logger';
import { getRecentFinalizedReports } from '../../store/db';
import { robustJsonParse } from './json';
import { withRetry, geminiHttpError } from './retry';
import { auth } from '../../lib/firebase';
import { getIdToken } from '../../lib/authToken';

async function geminiProxyFetch(
  model: string,
  systemContext: string,
  userMessage: string,
  temperature: number,
  apiKey?: string
): Promise<Response> {
  return fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getIdToken()}`,
      'x-uid': auth.currentUser?.uid || 'anonymous',
      'x-gemini-model': model,
      'x-gemini-stream': 'false',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemContext }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature, topP: 0.9, maxOutputTokens: 8192 },
    }),
  });
}

function resolveGeminiModel(rawModel?: string): string {
  const raw = (rawModel || '').toLowerCase();

  if (raw.includes('3.5') && raw.includes('flash')) return 'gemini-3.5-flash';
  if (raw.includes('3.1') && raw.includes('pro'))   return 'gemini-3.1-pro-preview';
  if (raw.includes('2.5') && raw.includes('pro'))   return 'gemini-2.5-pro-preview-06-05';
  if (raw.includes('2.5') && raw.includes('flash')) return 'gemini-2.5-flash-preview-05-20';
  if (raw.includes('2.5'))                           return 'gemini-2.5-flash-preview-05-20';
  if (raw.includes('pro'))                           return 'gemini-3.1-pro-preview';
  if (raw.includes('flash'))                         return 'gemini-3.5-flash';

  return 'gemini-3.5-flash';
}
import {
  DEFAULT_TEMPLATE_GENERATION_PROMPT,
  DEFAULT_CUSTOM_FORM_PROMPT,
  DEFAULT_ANAMNESIS_PROMPT,
  DEFAULT_CONSENT_PROMPT
} from './prompts/template';

interface GeneratedTemplate {
  title: string;
  technique: string;
  analysisTemplate: string;
  conclusionTemplate: string;
  recommendationsTemplate: string;
  observationsTemplate?: string;
  classificationTemplate?: string;
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
  // Busca exemplos de laudos da mesma área para mimetizar o estilo
  // Como é um novo template, buscamos laudos da área em geral
  const examples = await getRecentFinalizedReports(area, 2); 

  const areaContext: Record<string, string> = {
    'medicina-interna': 'Abdome total: fígado, vias biliares, pâncreas, baço, rins, bexiga, próstata ou útero, aorta. Use normalidade CBR com medidas referenciais.',
    'ginecologia': 'Útero (posição, dimensões, miométrio, endométrio), ovários, anexos, Douglas. Inclua BI-RADS se mama, O-RADS se massa anexial.',
    'medicina-fetal': 'Biometria fetal completa (DBP, CC, CA, CF, PFE + percentil), morfologia por trimestre, Doppler obstétrico (AU, ACM, uterinas), placenta e ILA.',
    'pequenas-partes': 'Tireoide com TI-RADS por nódulo, glândulas salivares, linfonodos cervicais, testículos ou partes moles superficiais conforme o exame.',
    'musculoesqueletico': 'Tendões (fibrilar/tendinopatia/ruptura), articulações (derrame/sinovite OMERACT), bursas, nervos periféricos.',
    'vascular': 'Carótidas (VPS/VDF/EIM), sistema venoso (compressibilidade TVP), aorta (calibre), doppler hepático/renal conforme exame.',
    'pediatria': 'Adapte à faixa etária: transfontanelar (recém-nato), quadril (Graf), piloro, abdome pediátrico, rim.',
    'procedimentos': 'Descritivo técnico de PAAF, core biopsy, drenagem ou infiltração. Inclua técnica, material obtido e status pós-procedimento.',
    'reumatologico': 'Articulações afetadas, sinovite OMERACT modo B + Power Doppler, erosões, enteses, depósitos de cristais.',
  };

  const systemContext = settings.aiTemplateGenerationPrompt || DEFAULT_TEMPLATE_GENERATION_PROMPT;

  const userMessage = `EXAME ALVO:
- Área: ${area}
- Nome do Exame: ${examName}
- Contexto da área: ${areaContext[area] || 'Exame ultrassonográfico geral.'}

${examples.length > 0 ? `ESTILO DE REFERÊNCIA DO MÉDICO (replique vocabulário, fraseologia e nível de detalhe):\n${examples.join('\n\n---\n\n')}\n` : ''}

Gere o JSON da máscara do laudo agora.`;

  let text = '';
  {
    const resp = await withRetry(() => geminiProxyFetch(resolveGeminiModel(settings.geminiModel), systemContext, userMessage, 0.2, settings.geminiApiKey));
    if (!resp.ok) {
      const errText = await resp.text();
      throw geminiHttpError(resp.status, errText);
    }
    const result = await resp.json();
    text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  try {
    const parsed = robustJsonParse<GeneratedTemplate>(text);
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.technique !== 'string' ||
      typeof parsed.analysisTemplate !== 'string' ||
      typeof parsed.conclusionTemplate !== 'string' ||
      typeof parsed.recommendationsTemplate !== 'string'
    ) {
      throw new Error('Campos obrigatórios ausentes na resposta da IA.');
    }
    return parsed;
  } catch (err: any) {
    logger.error('Erro ao processar JSON da IA:', err);
    throw new Error('A IA gerou uma resposta em formato inválido que não pôde ser auto-corrigida. Tente novamente.');
  }
}

/**
 * Usa a IA (Gemini) para gerar um campo específico do exame
 * (formulário padrão, anamnese ou termo de consentimento).
 */
export async function generateTemplateField(
  area: ExamArea,
  examName: string,
  fieldType: 'customForm' | 'anamnesis' | 'consent',
  settings: AppSettings
): Promise<string> {
  let systemContext = '';
  let userMessage = '';

  if (fieldType === 'customForm') {
    systemContext = settings.aiCustomFormPrompt || DEFAULT_CUSTOM_FORM_PROMPT;
    userMessage = `Gere o formulário para o exame de "${examName}" (Área: ${area}).`;
  } else if (fieldType === 'anamnesis') {
    systemContext = settings.aiAnamnesisPrompt || DEFAULT_ANAMNESIS_PROMPT;
    userMessage = `Gere o formulário estruturado de anamnese para o exame de "${examName}" (Área: ${area}).`;
  } else {
    systemContext = settings.aiConsentPrompt || DEFAULT_CONSENT_PROMPT;
    userMessage = `Gere o Termo de Consentimento para o exame de "${examName}" (Área: ${area}).`;
  }

  const resp = await withRetry(() => geminiProxyFetch(resolveGeminiModel(settings.geminiModel), systemContext, userMessage, 0.3, settings.geminiApiKey));
  if (!resp.ok) {
    const errText = await resp.text();
    throw geminiHttpError(resp.status, errText);
  }
  const result = await resp.json();
  let text: string = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Clean markdown code blocks if present
  text = text.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  return text;
}
