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
  const provider = settings.aiProvider || 'gemini';
  const hasKey = provider === 'anthropic' ? !!settings.anthropicApiKey : !!settings.geminiApiKey;
  if (!hasKey) {
    throw new Error(`API Key do ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} não configurada. Vá em Configurações para adicionar.`);
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
   - Use "(…)" APENAS para campos de medidas numéricas que variam por paciente (ex: "medindo (…) x (…) x (…) cm" ou "medindo (…) x (…) x (…) mm" para a área de medicina-fetal).
   - Para exames da área "medicina-fetal", TODAS as medidas anatômicas, biométricas e anexiais DEVEM ser obrigatoriamente padronizadas em milímetros (mm), sendo terminantemente proibido o uso de centímetros (cm).
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

  let text = '';
  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey || '');
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 8192,
      }
    });

    const result = await model.generateContent(prompt);
    text = result.response.text();
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    text = result.content?.[0]?.text || '';
  }

  // Clean markdown code blocks if present
  text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.technique !== 'string' ||
      typeof parsed.analysisTemplate !== 'string' ||
      typeof parsed.conclusionTemplate !== 'string' ||
      typeof parsed.recommendationsTemplate !== 'string'
    ) {
      throw new Error('Campos obrigatórios ausentes na resposta da IA.');
    }
    return parsed as GeneratedTemplate;
  } catch (err) {
    console.error('Erro ao processar JSON da IA:', text);
    throw new Error('A IA gerou uma resposta em formato inválido. Tente novamente.');
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
  const provider = settings.aiProvider || 'gemini';
  const hasKey = provider === 'anthropic' ? !!settings.anthropicApiKey : !!settings.geminiApiKey;
  if (!hasKey) {
    throw new Error(`API Key do ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} não configurada. Vá em Configurações para adicionar.`);
  }

  let prompt = '';
  if (fieldType === 'customForm') {
    prompt = `Você é um Médico Radiologista Sênior especialista em ultrassonografia. Crie um modelo de formulário em formato de texto livre para o copiloto do exame de "${examName}" (Área: ${area}).
Este formulário deve servir de guia para o médico preencher de forma rápida os achados durante a realização do exame.
O formato deve listar os principais órgãos, regiões ou estruturas avaliados neste tipo de exame em linhas separadas, utilizando colchetes vazios ou com valores padrão indicativos de normalidade, de forma que o médico possa editar os dados de forma rápida.

Exemplo de formato esperado:
Fígado: [Aspecto habitual]
Vesícula biliar: [Normal, sem cálculos]
Pâncreas: [Aspecto habitual]
Rins: [Normais]
Bexiga: [Cheia, com paredes finas]

Regras importantes:
- Retorne APENAS o modelo de texto livre sugerido.
- NÃO inclua títulos, explicações, saudações, introduções ou bloco de código markdown (como \`\`\`). Retorne apenas o texto puro das linhas do formulário.`;
  } else if (fieldType === 'anamnesis') {
    prompt = `Você é um Médico Radiologista Sênior especialista em ultrassonografia. Crie um modelo de anamnese padrão no formato de formulário estruturado para o exame de "${examName}" (Área: ${area}).
Este formulário deve listar perguntas e itens clínicos essenciais a serem respondidos/preenchidos pelo médico ou recepcionista antes ou durante o exame.
Cada item deve seguir rigorosamente o padrão "Rótulo do Campo: [Valor Padrão]" em linhas separadas. O valor padrão entre colchetes deve indicar uma resposta comum ou ficar vazio para preenchimento.

Personalize as perguntas de acordo com o tipo de exame. Exemplos:
- Se for exame Obstétrico (Medicina Fetal):
  DUM (Data da Última Menstruação): [Não recorda / Informar]
  Gestações anteriores (G/P/A): [ ]
  Queixa ou Indicação: [Acompanhamento de rotina]
- Se for Abdome (Medicina Interna):
  Indicação / Suspeita Clínica: [Dor abdominal / Pesquisa de colelitíase]
  Tempo de evolução dos sintomas: [ ]
  Sintomas associados: [Nenhum / Náuseas / Vômitos]
  Cirurgias abdominais prévias: [Nega]
- Se for Musculoesquelético:
  Indicação / Queixa: [Dor articular]
  Trauma ou queda recente: [Não]
  Tempo de evolução: [ ]

Regras importantes:
- Cada linha de pergunta/campo DEVE seguir o formato: "Nome do Campo: [Valor Padrão]".
- Crie de 3 a 6 campos essenciais e relevantes para este exame específico.
- Retorne APENAS as linhas do formulário estruturado.
- NÃO inclua títulos, explicações, saudações, introduções ou bloco de código markdown (como \`\`\`). Retorne apenas o texto puro do formulário.`;
  } else {
    prompt = `Você é um Médico Radiologista Sênior especialista em ultrassonografia e especialista em direito médico. Crie um Termo de Consentimento Livre e Esclarecido (TCLE) completo e formal para a realização do exame de "${examName}" (Área: ${area}).
O termo deve incluir:
1. Título: TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO - [Nome do Exame] (substitua [Nome do Exame] pelo nome correspondente).
2. Explicação simples do procedimento e seus benefícios.
3. Riscos mínimos (como desconforto leve pela pressão do transdutor, preparo prévio se houver).
4. Declaração de consentimento voluntário em primeira pessoa: "Eu, [Nome do Paciente] (ou seu responsável legal), declaro que fui devidamente esclarecido(a) sobre o exame..."

Regras importantes:
- Retorne APENAS o texto completo do termo de consentimento.
- NÃO inclua explicações adicionais, comentários, notas ao programador ou bloco de código markdown (como \`\`\`). Retorne apenas o texto puro do termo.`;
  }

  let text = '';
  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey || '');
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 8192,
      }
    });

    const result = await model.generateContent(prompt);
    text = result.response.text();
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    text = result.content?.[0]?.text || '';
  }

  // Clean markdown code blocks if present
  text = text.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  return text;
}
