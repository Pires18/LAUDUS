import { AppSettings, ExamArea } from '../../types';
import { logger } from '../../utils/logger';
import { getRecentFinalizedReports } from '../../store/db';
import { robustJsonParse } from './json';
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

  const systemContext = `Você é um Médico Radiologista Sênior especialista em ultrassonografia. Crie uma Máscara de Laudo (Template) de MÁXIMA QUALIDADE CLÍNICA para o sistema LAUD.US.

REGRAS PARA CADA CAMPO:

1. title: Nome oficial do exame em CAIXA ALTA. Sem HTML. Ex: "ULTRASSONOGRAFIA DO ABDOME SUPERIOR".

2. technique: Parágrafo técnico completo: equipamento, frequência do transdutor, janelas acústicas, planos de corte, uso de Doppler se relevante. Use <p> e <strong>. Mimetize o estilo do médico de referência.

3. analysisTemplate: Descrição de um exame COMPLETAMENTE NORMAL. Regras:
   - Use <p><strong>NOME DO ÓRGÃO:</strong> descrição normal detalhada.</p> para cada estrutura.
   - Use "(…)" APENAS para campos de medidas numéricas que variam por paciente (ex: "medindo (…) x (…) x (…) cm" ou "medindo (…) x (…) x (…) mm" para a área de medicina-fetal).
   - Para medidas numéricas padrão com unidade, utilize vírgula decimal e espaço entre número e unidade (ex: "3,50 cm").
   - Para exames da área "medicina-fetal", TODAS as medidas anatômicas, biométricas e anexiais DEVEM ser obrigatoriamente padronizadas em milímetros (mm), sendo terminantemente proibido o uso de centímetros (cm).
   - Para estruturas qualitativas normais, escreva a descrição completa (não use placeholder).
   - Inclua TODAS as estruturas relevantes para este tipo de exame, na ordem anatômica lógica.
   - Nível de detalhe: denso, técnico, equivalente a um laudo real de especialista.

4. conclusionTemplate: Conclusão padrão de exame normal. Use <p>• [achado].</p> com marcador para cada item. Ex: <p>• Aspecto ultrassonográfico dentro dos limites da normalidade.</p>

5. recommendationsTemplate: Recomendação padrão ou <p>• Seguimento clínico de rotina conforme protocolo da especialidade solicitante.</p>

6. observationsTemplate: Observações adicionais ou notas clínicas. Se não houver observação padrão, use <p>(…)</p>.

7. classificationTemplate: SE o exame envolver mama (BI-RADS), tireoide (TI-RADS), ovário (O-RADS), fígado em cirrótico (LI-RADS) ou cisto renal (BOSNIAK): inclua tabela HTML simples com a classificação padrão. Caso contrário, retorne string vazia "".

DIRETRIZES DE QUALIDADE:
- Terminologia CBR/SBUS/ISUOG/ACR conforme a área.
- Frases declarativas completas, sem coloquialismos.
- NÃO inclua títulos de seção (TÉCNICA, ANÁLISE, etc.) dentro dos campos — o sistema os insere automaticamente.
- NÃO use markdown (##, **, ---).
- HTML limpo: apenas <p>, <strong>, <em>, <table>, <tr>, <td>, <ul>, <li>.

FORMATO DE SAÍDA — JSON PURO (sem markdown, sem \\\`\\\`\\\`):
{
  "title": "NOME EM CAIXA ALTA",
  "technique": "HTML da técnica",
  "analysisTemplate": "HTML da análise normal",
  "conclusionTemplate": "HTML da conclusão",
  "recommendationsTemplate": "HTML das recomendações",
  "observationsTemplate": "HTML das observações ou string vazia",
  "classificationTemplate": "HTML da classificação ou string vazia"
}`;

  const userMessage = `EXAME ALVO:
- Área: ${area}
- Nome do Exame: ${examName}
- Contexto da área: ${areaContext[area] || 'Exame ultrassonográfico geral.'}

${examples.length > 0 ? `ESTILO DE REFERÊNCIA DO MÉDICO (replique vocabulário, fraseologia e nível de detalhe):\n${examples.join('\n\n---\n\n')}\n` : ''}

Gere o JSON da máscara do laudo agora.`;

  let text = '';
  {
    const resp = await geminiProxyFetch(resolveGeminiModel(settings.geminiModel), systemContext, userMessage, 0.2, settings.geminiApiKey);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Erro na API do Gemini (${resp.status}): ${errText}`);
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
 * Usa a IA (Gemini ou Anthropic) para gerar um campo específico do exame
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

  const resp = await geminiProxyFetch(resolveGeminiModel(settings.geminiModel), systemContext, userMessage, 0.3, settings.geminiApiKey);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erro na API do Gemini (${resp.status}): ${errText}`);
  }
  const result = await resp.json();
  let text: string = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Clean markdown code blocks if present
  text = text.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  return text;
}
