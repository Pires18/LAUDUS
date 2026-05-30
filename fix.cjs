const fs = require('fs');
let content = fs.readFileSync('src/modules/ai/gemini.ts', 'utf8');

const regex = /const copilotFormat = isFormCompilation\s*\n\s*\?\s*`═════════════════════════════════════════════.*?\]`/s;

const replacement = `const copilotFormat = isFormCompilation
    ? \`═══════════════════════════════════════════════════════════════
MODO COPILOTO (FORMULÁRIO) — FORMATO DE RESPOSTA OBRIGATÓRIO
═══════════════════════════════════════════════════════════════
Responda EXCLUSIVAMENTE nesta estrutura:

=== CONVERSA ===
[UMA única frase descrevendo a inserção dos dados do formulário.]

=== PROPOSTA ===
[HTML COMPLETO do laudo com a alteração integrada.
REGRAS:
• OBRIGATÓRIO: Gerar o HTML do laudo COMPLETO do início ao fim.
• CASCATA TRIPARTITE: Após inserir os dados na ANÁLISE, atualizar a CONCLUSÃO e as RECOMENDAÇÕES.
• TÉCNICA: Reproduzir exatamente como no laudo atual. Proibido alterar.
• RECOMENDAÇÕES: Usar rigorosamente as condutas padronizadas definidas nas INSTRUÇÕES ESPECÍFICAS DO EXAME.]\``;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/modules/ai/gemini.ts', content, 'utf8');
    console.log("Fixed!");
} else {
    console.log("Regex not matched.");
}
