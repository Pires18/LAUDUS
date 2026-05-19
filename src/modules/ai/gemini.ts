import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_STRUCTURE_PROMPT, AREA_SPECIFIC_PROMPTS, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_RIGID_RULES } from './prompts';

interface GenerateReportParams {
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  previousExams?: string[];
}

interface CopilotParams {
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string };
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
  previousExams?: string[];
  customPrompt?: string;
}

/**
 * Calcula a idade de forma inteligente a partir da data de nascimento.
 * Suporta formatos pediátricos em meses se a idade for menor que 1 ano.
 */
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
  } catch (e) {
    return '';
  }
}

/**
 * Constrói um bloco rico de dados clínicos e cadastrais do paciente e exame.
 */
function buildPatientBlock(
  patient: Patient | null,
  examDate: string,
  requestingPhysician?: string
): string {
  if (!patient) {
    return `Paciente: Não informado
Data do Exame: ${examDate}${requestingPhysician ? `\nMédico Solicitante: ${requestingPhysician}` : ''}`;
  }

  const patientAge = patient.birthDate ? calculateAge(patient.birthDate) : '';
  const patientGenderMap = { 'M': 'Masculino', 'F': 'Feminino', 'O': 'Outro' };
  const patientGender = patient.gender ? patientGenderMap[patient.gender] || patient.gender : '';

  const lines = [
    `Paciente: ${patient.name}`,
    `Sexo: ${patientGender || 'Não informado'}`,
    `Idade: ${patientAge || 'Não informada'} (Nascimento: ${patient.birthDate || 'Não informado'})`,
  ];

  if (patient.insurance) lines.push(`Convênio: ${patient.insurance}`);
  if (patient.history) lines.push(`Histórico Clínico: ${patient.history}`);
  if (patient.notes) lines.push(`Observações do Paciente: ${patient.notes}`);
  lines.push(`Data do Exame: ${examDate}`);
  if (requestingPhysician) lines.push(`Médico Solicitante: ${requestingPhysician}`);

  return lines.join('\n');
}

/**
 * Constrói o prompt enviado ao Gemini para geração inicial do laudo.
 * O prompt força a IA a seguir EXATAMENTE a estrutura definida na Máscara.
 */
/**
 * Remove a tag <scratchpad>...</scratchpad> e todo o seu conteúdo (case-insensitive) do texto de saída.
 * Se a tag estiver aberta mas não fechada ainda (durante streaming), oculta todo o conteúdo após a abertura.
 */
export function stripScratchpad(text: string): string {
  if (!text) return '';
  let cleaned = text;
  const openIndex = cleaned.toLowerCase().indexOf('<scratchpad>');
  const closeIndex = cleaned.toLowerCase().indexOf('</scratchpad>');

  if (openIndex !== -1) {
    if (closeIndex !== -1) {
      cleaned = cleaned.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '');
    } else {
      cleaned = cleaned.substring(0, openIndex);
    }
  }
  
  cleaned = cleaned.replace(/<\/?scratchpad>/gi, '');
  return cleaned.trim();
}

/**
 * Função centralizada para compilar o Master Prompt injetando dados nos placeholders v9.0 estruturados.
 * Caso os placeholders não estejam no prompt customizado, faz fallback para compatibilidade.
 */
function compileMasterPrompt({
  masterPrompt,
  areaSpecificRules,
  previousExams,
  routingMode,
  patientBlock,
  clinicalIndication,
  examType,
  notes,
  maskHtml,
}: {
  masterPrompt: string;
  areaSpecificRules: string;
  previousExams: string[];
  routingMode: 'GERAÇÃO INICIAL' | 'REFINAMENTO / COPILOTO';
  patientBlock: string;
  clinicalIndication: string;
  examType: string;
  notes: string;
  maskHtml: string;
}): string {
  const hasPlaceholders = masterPrompt.includes('[INJETAR_HTML_DA_MASCARA]');

  if (hasPlaceholders) {
    let compiled = masterPrompt;
    compiled = compiled.replace('[INJETAR_REGRAS_DA_ESPECIALIDADE_AQUI]', areaSpecificRules || 'Nenhuma regra específica para esta área.');
    const safeExamples = previousExams.length > 0 
      ? `[ATENÇÃO MÁXIMA: Os laudos abaixo são EXCLUSIVAMENTE para referência do SEU ESTILO DE ESCRITA e formatação visual. SOB NENHUMA HIPÓTESE você deve copiar achados patológicos, nomes, datas, medidas ou diagnósticos destes exemplos para o laudo atual do paciente. Isole completamente as informações clínicas.]\n\n${previousExams.join('\n\n--- NEXT EXAMPLE ---\n\n')}`
      : 'Nenhum exemplo de ancoragem disponível.';
    compiled = compiled.replace('[INJETAR_EXEMPLOS_DA_ESPECIALIDADE_AQUI]', safeExamples);
    compiled = compiled.replace('[INJETAR_MODO_DE_ROTEAMENTO_AQUI]', routingMode);
    compiled = compiled.replace('[INJETAR_DADOS_PACIENTE]', patientBlock);
    compiled = compiled.replace('[INJETAR_INDICACAO_CLINICA]', clinicalIndication || 'Não informada.');
    compiled = compiled.replace('[INJETAR_TIPO_DE_EXAME]', examType);
    compiled = compiled.replace('[INJETAR_NOTAS_DO_MEDICO]', notes || 'Nenhuma nota adicional do médico.');
    compiled = compiled.replace('[INJETAR_HTML_DA_MASCARA]', maskHtml);
    return compiled;
  }

  // Fallback para Master Prompts legados customizados
  const previousContext = previousExams.length > 0 
    ? `\n═══════════════════════════════════════════\nREFERÊNCIA DE ESTILO (LAUDOS ANTERIORES - ISOLAMENTO DE DADOS):\n═══════════════════════════════════════════\n[ATENÇÃO MÁXIMA: Os laudos abaixo são EXCLUSIVAMENTE para referência do SEU ESTILO DE ESCRITA. SOB NENHUMA HIPÓTESE você deve copiar achados patológicos, medidas ou diagnósticos destes exemplos para o laudo atual. O laudo atual deve conter APENAS o que o médico informou no contexto clínico abaixo.]\n\n${previousExams.join('\n\n--- NEXT EXAMPLE ---\n\n')}\n`
    : '';

  return `${masterPrompt}

${areaSpecificRules ? `═══════════════════════════════════════════\nREGRAS DA ÁREA:\n═══════════════════════════════════════════\n${areaSpecificRules}\n` : ''}

${previousContext}

MODO OPERACIONAL: ${routingMode}

DADOS DO CONTEXTO:
Tipo de exame: ${examType}
${patientBlock}
${clinicalIndication ? `\nIndicação clínica: ${clinicalIndication}` : ''}
Notas / Instruções do Médico: ${notes}

MÁSCARA DE REFERÊNCIA:
${maskHtml}`;
}

/**
 * Constrói o prompt enviado ao Gemini para geração inicial do laudo.
 */
export function buildPrompt({
  template,
  patient,
  clinicalIndication,
  requestingPhysician,
  settings,
  previousExams = [],
}: GenerateReportParams): string {
  const examDate = new Date().toLocaleDateString('pt-BR');
  const patientBlock = buildPatientBlock(patient, examDate, requestingPhysician);

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const areaInstructions = settings.aiAreaPrompts?.[template.area] || '';
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const globalInstructions = settings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[template.area] || '';

  const maskHtml = `TÍTULO: 
${template.title}

TÉCNICA:
${template.technique}

ANÁLISE:
${template.analysisTemplate}

CONCLUSÃO:
${template.conclusionTemplate}

${template.classificationTemplate ? `CLASSIFICAÇÃO:\n${template.classificationTemplate}\n` : ''}

RECOMENDAÇÕES:
${template.recommendationsTemplate}`;

  const compiled = compileMasterPrompt({
    masterPrompt,
    areaSpecificRules,
    previousExams,
    routingMode: 'GERAÇÃO INICIAL',
    patientBlock,
    clinicalIndication: clinicalIndication || '',
    examType: template.name,
    notes: clinicalIndication || '',
    maskHtml,
  });

  return `${compiled}

═══════════════════════════════════════════
ESTRUTURA COMPLEMENTAR DE CONFORMIDADE:
═══════════════════════════════════════════
${structurePrompt}
${areaInstructions ? `\nCOMPORTAMENTO DA ÁREA: ${areaInstructions}` : ''}
${template.aiInstructions ? `\nINSTRUÇÕES DA MÁSCARA: ${template.aiInstructions}` : ''}
\nINSTRUÇÕES GLOBAIS DE RACIOCÍNIO:\n${globalInstructions}
\nREGRAS RÍGIDAS DE CONFORMIDADE CLÍNICA:\n${rigidRules}

Gere agora o laudo completo (HTML dentro de tags ou diretamente, processe obrigatoriamente pelo <scratchpad>):`;
}

/**
 * Constrói o prompt para REFINAR o laudo.
 */
export function buildRefinePrompt({
  currentReport,
  template,
  patient,
  settings,
  clinicalIndication,
  requestingPhysician,
  previousExams = [],
  customPrompt,
}: RefineParams): string {
  const examDate = new Date().toLocaleDateString('pt-BR');
  const patientBlock = buildPatientBlock(patient, examDate, requestingPhysician);

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const areaInstructions = settings.aiAreaPrompts?.[template.area] || '';
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const globalInstructions = settings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[template.area] || '';

  const notesText = customPrompt 
    ? `AJUSTAR E REFINAR o laudo de acordo com o comando do médico: "${customPrompt}".
       Mantenha a blindagem médico-legal, aplique a Cascata Tripartite e garanta que todas as novas medidas introduzidas sigam a padronização obrigatória da especialidade. Entenda e traduza adequadamente todas as abreviações médicas (ex: DUM, IG, CCN, BCF, ILA). Revise O LAUDO COMPLETO, adequando frases, ajustes e recomendações para que fiquem 100% coesos com as mudanças.`
    : `REFINAR, REVISAR, SANITIZAR E HIGIENIZAR O LAUDO COMPLETO.
       Substitua TODOS os placeholders residuais pela Doutrina de Normalidade Habitual.
       Garanta a Cascata Tripartite perfeitamente alinhada e as 12 Regras do Guardian Core v9.0.
       Melhore as frases, ajuste recomendações e traduza abreviações médicas (DUM, IG, etc.) adequadamente.`;

  const compiled = compileMasterPrompt({
    masterPrompt,
    areaSpecificRules,
    previousExams,
    routingMode: 'REFINAMENTO / COPILOTO',
    patientBlock,
    clinicalIndication: clinicalIndication || '',
    examType: template.name,
    notes: notesText,
    maskHtml: currentReport,
  });

  return `${compiled}

═══════════════════════════════════════════
ESTRUTURA COMPLEMENTAR DE CONFORMIDADE:
═══════════════════════════════════════════
${structurePrompt}
${areaInstructions ? `\nCOMPORTAMENTO DA ÁREA: ${areaInstructions}` : ''}
${template.aiInstructions ? `\nINSTRUÇÕES DA MÁSCARA: ${template.aiInstructions}` : ''}
\nINSTRUÇÕES GLOBAIS DE RACIOCÍNIO:\n${globalInstructions}
\nREGRAS RÍGIDAS DE CONFORMIDADE CLÍNICA:\n${rigidRules}

Gere agora o laudo final REFINADO e higienizado com maestria (processe obrigatoriamente pelo <scratchpad>):`;
}

/**
 * Constrói o prompt para o Copilot IA.
 */
export function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
}: CopilotParams): string {
  const examDate = new Date().toLocaleDateString('pt-BR');
  const patientBlock = buildPatientBlock(patient, examDate, exam.requestingPhysician);

  const masterPrompt = settings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
  const areaInstructions = settings.aiAreaPrompts?.[exam.area as ExamArea] || '';
  const structurePrompt = settings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
  const globalInstructions = settings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
  const rigidRules = settings.aiRigidRules || DEFAULT_RIGID_RULES;
  const areaSpecificRules = AREA_SPECIFIC_PROMPTS[exam.area as ExamArea] || '';

  const compiled = compileMasterPrompt({
    masterPrompt,
    areaSpecificRules,
    previousExams,
    routingMode: 'REFINAMENTO / COPILOTO',
    patientBlock,
    clinicalIndication: exam.clinicalIndication || '',
    examType: exam.examType,
    notes: instruction,
    maskHtml: currentReport,
  });

  return `${compiled}

═══════════════════════════════════════════════════════════════
CO-AUTORIA / COPILOTO FORMAT INTEGRATION
═══════════════════════════════════════════════════════════════
Sua tarefa agora é ATUALIZAR ou EDITAR o laudo existente com base na nova instrução do médico de forma extremamente direta, sucinta, objetiva e puramente clínica. NUNCA utilize floreios, formalidades exageradas, saudações amigáveis ou explicações prolixas. Vá direto aos fatos e à conduta clínica.

Sua resposta DEVE ser estruturada rigorosamente usando os marcadores exatos (dentro ou fora do scratchpad, mas o HTML final da proposta de laudo deve vir sob === PROPOSTA ===):

=== CONVERSA ===
[Forneça apenas UMA única frase extremamente curta (máximo 15 palavras) resumindo de forma ultra-direta e puramente clínica a alteração feita no laudo (ex: "Vesícula biliar alterada para ausente por cirurgia prévia."). NÃO use mais do que uma frase. NUNCA faça saudações, introduções ou explicações prolixas.]

=== PROPOSTA ===
[Forneça o código HTML COMPLETO do laudo atualizado contendo todas as alterações integradas perfeitamente, mantendo o padrão do Skeleton v9.0.]

Mantenha rigorosamente a estrutura de tópicos (TÍTULO, TÉCNICA, ANÁLISE, CONCLUSÃO, etc).
${structurePrompt ? `\nESTRUTURA COMPLEMENTAR DE CONFORMIDADE:\n${structurePrompt}` : ''}
${areaInstructions ? `\nCOMPORTAMENTO DA ÁREA: ${areaInstructions}` : ''}
\nINSTRUÇÕES GLOBAIS DE RACIOCÍNIO:\n${globalInstructions}
\nREGRAS RÍGIDAS DE CONFORMIDADE CLÍNICA:\n${rigidRules}

Gere agora a resposta completa estruturada with === CONVERSA === and === PROPOSTA === (sem blocos extras de código fora desses marcadores):`;
}

export async function generateReport(params: GenerateReportParams | CopilotParams | RefineParams): Promise<string> {
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';

  let prompt: string;
  if ('instruction' in params) {
    prompt = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    prompt = buildRefinePrompt(params as RefineParams);
  } else {
    prompt = buildPrompt(params as GenerateReportParams);
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
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
    text = stripScratchpad(text);
    return text;
  } else {
    if (!settings.anthropicApiKey) {
      throw new Error('API Key do Anthropic não configurada. Vá em Configurações para adicionar.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: settings.aiTemperature ?? 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API da Anthropic (${response.status}): ${errText}`);
    }

    const result = await response.json();
    let text = result.content?.[0]?.text || '';
    text = text.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    text = stripScratchpad(text);
    return text;
  }
}

export async function generateReportStream(
  params: GenerateReportParams | CopilotParams | RefineParams,
  onChunk: (text: string) => void
): Promise<string> {
  const { settings } = params;
  const provider = settings.aiProvider || 'gemini';

  let prompt: string;
  if ('instruction' in params) {
    prompt = buildCopilotPrompt(params as CopilotParams);
  } else if ('currentReport' in params && 'template' in params) {
    prompt = buildRefinePrompt(params as RefineParams);
  } else {
    prompt = buildPrompt(params as GenerateReportParams);
  }

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('API Key do Gemini não configurada. Vá em Configurações para adicionar.');
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: settings.geminiModel || 'gemini-2.5-flash',
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
      cleanText = stripScratchpad(cleanText);
      onChunk(cleanText);
    }

    fullText = fullText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    fullText = fullText.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    fullText = stripScratchpad(fullText);
    return fullText;
  } else {
    if (!settings.anthropicApiKey) {
      throw new Error('API Key do Anthropic não configurada. Vá em Configurações para adicionar.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-3-5-sonnet-latest',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
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
            
            let cleanText = fullText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '');
            cleanText = cleanText.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
            cleanText = stripScratchpad(cleanText);
            onChunk(cleanText);
          }
        } catch (e) {
          // Ignorar erros de parseamento de JSON malformatados ou de outros tipos de eventos
        }
      }
    }

    fullText = fullText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    fullText = fullText.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    fullText = stripScratchpad(fullText);
    return fullText;
  }
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
