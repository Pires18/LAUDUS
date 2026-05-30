const fs = require('fs');

let content = fs.readFileSync('src/modules/ai/gemini.ts', 'utf8');

const goldenRules = `const REFINEMENT_GOLDEN_RULES = \`[REGRAS DE OURO DO REFINAMENTO E COPILOTO — EXECUÇÃO OBRIGATÓRIA:
• LAUDO COMPLETO E PERFEITO: Gerar o HTML do laudo COMPLETO do início ao fim. NÃO omita, corte ou abrevie seções (sem "..." ou "resto do laudo").
• ADEQUAÇÃO INTEGRAL AO EXAME: Adapte, formate e alinhe todo o laudo de acordo com as diretrizes e regras específicas do exame ativo (indicadas nas INSTRUÇÕES ESPECÍFICAS DO EXAME). Aplique as classificações clínicas obrigatórias (ex: O-RADS, MUSA, BI-RADS) e padronize as unidades de medida e formatação decimal de toda a ANÁLISE conforme as diretrizes do exame.
• PADRONIZAÇÃO RÍGIDA DE TÉCNICA E RECOMENDAÇÕES:
  - TÉCNICA: Deve ser reproduzida exatamente como no texto original do template/laudo atual, sendo proibido reescrevê-la, alterá-la ou inventar variações, exceto sob pedido expresso e explícito do médico solicitando alteração na técnica.
  - RECOMENDAÇÕES: A ÚNICA fonte de verdade para condutas são as INSTRUÇÕES ESPECÍFICAS DO EXAME (aiInstructions). É estritamente proibido inventar recomendações baseadas no seu próprio conhecimento médico ou em padrões gerais da área, a menos que expressamente solicitado pelo médico. Limite-se a aplicar a fraseologia que está nas instruções do exame.
• PRESERVAÇÃO DE DADOS CLÍNICOS: Mantenha intactos todos os achados patológicos, medidas e descrições clínicas reais que já foram preenchidos ou editados no LAUDO ATUAL (por você ou pelo usuário), sendo proibido reverter ou alterar achados reais de volta para a normalidade ou inventar novos valores não fornecidos.
• ELIMINAÇÃO DE PLACEHOLDERS (NÃO INVENÇÃO): Remova ou resolva todos os placeholders restantes na forma de "(...)", "[___]" ou unidades órfãs (ex: "____ cm") do LAUDO ATUAL. É terminantemente proibido inventar valores numéricos arbitrários se não fornecidos pelo usuário. Substitua-os exclusivamente por descrições qualitativas de normalidade (ex: "de dimensões preservadas") ou remova a menção. [EXCEÇÃO MEDICINA FETAL E VASCULAR: Para exames de medicina fetal e vascular, mantenha obrigatoriamente os placeholders '(...)' ou '[___]' nos campos numéricos ou Doppler que não foram preenchidos].
• INTEGRIDADE DA CASCATA TRIPARTITE: Garanta a cascata tripartite completa (Análise → Conclusão → Recomendação) para todos os achados do laudo. Cada achado patológico deve ter um bullet correspondente na Conclusão e uma conduta proporcional nas Recomendações.
• ESPAÇAMENTO E PARÁGRAFOS: Cada estrutura anatômica ou órgão na ANÁLISE deve obrigatoriamente estar em seu próprio parágrafo individual usando a tag <p>. Nunca junte múltiplas estruturas em um único parágrafo ou use <br> para separá-las.
• COMPLIANCE DA MÁSCARA: O laudo deve seguir rigorosamente a nomenclatura, ordem e estrutura de seções/títulos (tags <h1>, <h2> e parágrafos correspondentes, incluindo os estilos inline e tags internas originais como <strong>) e textos padrão definidos na MÁSCARA MODELO ORIGINAL DO EXAME.]\`;`;

// Inject REFINEMENT_GOLDEN_RULES right before buildRefinePrompt
content = content.replace(/function buildRefinePrompt/, `${goldenRules}\n\nfunction buildRefinePrompt`);

// Rewrite buildRefinePrompt
const refineRegex = /function buildRefinePrompt.*?(?=function buildCopilotPrompt)/s;
const newRefine = `function buildRefinePrompt({
  currentReport,
  template,
  patient,
  settings,
  clinicalIndication,
  requestingPhysician,
  anamnesis,
  previousExams = [],
  customPrompt,
  examDateMs,
}: RefineParams): BuiltPrompt {
  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(template);

  const refineNote = customPrompt
    ? \`INSTRUÇÃO DE REFINAMENTO: "\${customPrompt}"\`
    : \`INSTRUÇÃO: Sanitizar, higienizar e alinhar o laudo completo.\`;

  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: template.name,
    patient,
    clinicalIndication: clinicalIndication || '',
    anamnesis,
    notes: refineNote,
    maskHtml: currentReport,
    originalMaskHtml: getInitialReportContent(template),
    requestingPhysician,
    previousExams: safePreviousExams,
    examDateMs,
  });

  const userMessage = \`═══════════════════════════════════════════════════════════════
INPUT CLÍNICO — EXECUTAR FASES 1-5 ANTES DO OUTPUT:
═══════════════════════════════════════════════════════════════
\${contextMessage}

\${REFINEMENT_GOLDEN_RULES}

Gere agora o laudo REFINADO completo em HTML puro. 
NOVA REGRA ABSOLUTA DE FORMATO:
1. O output DEVE começar com a tag <scratchpad> contendo seu raciocínio e Self-Audit detalhado.
2. APÓS fechar a tag </scratchpad>, o laudo deve começar diretamente com a tag <h1>.
ZERO texto, avisos ou mensagens de pensamento fora da tag <scratchpad>.\`;

  return { universalContext, areaContext, userMessage };
}
`;
content = content.replace(refineRegex, newRefine + '\n');

// Rewrite buildCopilotPrompt
const copilotRegex = /function buildCopilotPrompt.*?(?=\/\/ ─── Funções auxiliares)/s;
const newCopilot = `function buildCopilotPrompt({
  instruction,
  currentReport,
  patient,
  exam,
  settings,
  previousExams = [],
  template,
}: CopilotParams): BuiltPrompt {
  const copilotModeOverride = \`\\n\\n═══════════════════════════════════════════════════════════════
OVERRIDE — MODO COPILOTO ATIVO (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════════════════
⚠ REGRAS DOS BLOCOS 2 E 3 SUSPENSAS NESTE MODO:
  • "Output começa diretamente com <h1>" — SUSPENSA
  • "Zero texto antes do HTML" — SUSPENSA
  • "ZERO caractere fora das tags HTML" — SUSPENSA

NOVA REGRA ABSOLUTA DE FORMATO (substitui as acima):
1. O output DEVE começar com a tag <scratchpad> contendo seu raciocínio e Self-Audit detalhado.
2. APÓS fechar a tag </scratchpad>, você DEVE gerar exatamente a estrutura:
=== CONVERSA ===
[UMA única frase (máx. 15 palavras) descrevendo a alteração clínica feita.
Exemplo: "Vesícula biliar alterada para ausente por cirurgia prévia."
SEM saudações. SEM explicações prolixas. Puramente clínica.]

=== PROPOSTA ===
[HTML COMPLETO do laudo com a alteração integrada.
Violar este formato invalida completamente a resposta.]
═══════════════════════════════════════════════════════════════\`;

  const universalContext = buildUniversalContext(settings);
  const areaContext = buildSpecificContext(template) + copilotModeOverride;

  const isFormCompilation = instruction.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:');
  const safePreviousExams = truncatePreviousExams(previousExams, settings);
  const contextMessage = buildContextMessage({
    mode: 'REFINAMENTO',
    examType: exam.examType,
    patient,
    clinicalIndication: exam.clinicalIndication || '',
    anamnesis: exam.anamnesis,
    notes: instruction,
    maskHtml: currentReport,
    originalMaskHtml: template ? getInitialReportContent(template) : undefined,
    requestingPhysician: exam.requestingPhysician,
    previousExams: safePreviousExams,
    examDateMs: exam.dateMs,
  });

  const userMessage = \`\${REFINEMENT_GOLDEN_RULES}

═══════════════════════════════════════════════════════════════
INPUT CLÍNICO:
═══════════════════════════════════════════════════════════════
\${contextMessage}\`;

  return { universalContext, areaContext, userMessage };
}
`;
content = content.replace(copilotRegex, newCopilot + '\n');

fs.writeFileSync('src/modules/ai/gemini.ts', content);
console.log("gemini.ts updated!");
