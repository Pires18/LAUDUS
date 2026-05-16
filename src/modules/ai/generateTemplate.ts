import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings, ExamArea } from '../../types';
import { getRecentFinalizedReports } from '../../store/db';

interface GeneratedTemplate {
  title: string;
  technique: string;
  analysisTemplate: string;
  conclusionTemplate: string;
  recommendationsTemplate: string;
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
  if (!settings.geminiApiKey) {
    throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
  }

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

  const prompt = `Você é um Médico Radiologista Sênior especialista em ultrassonografia. Crie uma Máscara de Laudo (Template) de MÁXIMA QUALIDADE CLÍNICA para o sistema LAUD.US.

EXAME ALVO:
- Área: ${area}
- Nome do Exame: ${examName}
- Contexto da área: ${areaContext[area] || 'Exame ultrassonográfico geral.'}

${examples.length > 0 ? `ESTILO DE REFERÊNCIA DO MÉDICO (replique vocabulário, fraseologia e nível de detalhe):\n${examples.join('\n\n---\n\n')}\n` : ''}

REGRAS PARA CADA CAMPO:

1. title: Nome oficial do exame em CAIXA ALTA. Sem HTML. Ex: "ULTRASSONOGRAFIA DO ABDOME SUPERIOR".

2. technique: Parágrafo técnico completo: equipamento, frequência do transdutor, janelas acústicas, planos de corte, uso de Doppler se relevante. Use <p> e <strong>. Mimetize o estilo do médico de referência.

3. analysisTemplate: Descrição de um exame COMPLETAMENTE NORMAL. Regras:
   - Use <p><strong>NOME DO ÓRGÃO:</strong> descrição normal detalhada.</p> para cada estrutura.
   - Use "(…)" APENAS para campos de medidas numéricas que variam por paciente (ex: "medindo (…) x (…) x (…) cm").
   - Para estruturas qualitativas normais, escreva a descrição completa (não use placeholder).
   - Inclua TODAS as estruturas relevantes para este tipo de exame, na ordem anatômica lógica.
   - Nível de detalhe: denso, técnico, equivalente a um laudo real de especialista.

4. conclusionTemplate: Conclusão padrão de exame normal. Use <p>• [achado].</p> com marcador para cada item. Ex: <p>• Aspecto ultrassonográfico dentro dos limites da normalidade.</p>

5. recommendationsTemplate: Recomendação padrão ou <p>• Seguimento clínico de rotina conforme protocolo da especialidade solicitante.</p>

6. classificationTemplate: SE o exame envolver mama (BI-RADS), tireoide (TI-RADS), ovário (O-RADS), fígado em cirrótico (LI-RADS) ou cisto renal (BOSNIAK): inclua tabela HTML simples com a classificação padrão. Caso contrário, retorne string vazia "".

DIRETRIZES DE QUALIDADE:
- Terminologia CBR/SBUS/ISUOG/ACR conforme a área.
- Frases declarativas completas, sem coloquialismos.
- NÃO inclua títulos de seção (TÉCNICA, ANÁLISE, etc.) dentro dos campos — o sistema os insere automaticamente.
- NÃO use markdown (##, **, ---).
- HTML limpo: apenas <p>, <strong>, <em>, <table>, <tr>, <td>, <ul>, <li>.

FORMATO DE SAÍDA — JSON PURO (sem markdown, sem \`\`\`):
{
  "title": "NOME EM CAIXA ALTA",
  "technique": "HTML da técnica",
  "analysisTemplate": "HTML da análise normal",
  "conclusionTemplate": "HTML da conclusão",
  "recommendationsTemplate": "HTML das recomendações",
  "classificationTemplate": "HTML da classificação ou string vazia"
}`;

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
