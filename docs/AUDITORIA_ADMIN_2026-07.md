# 🔍 Auditoria Completa — Módulo Administrador (07/07/2026)

**Data:** 2026-07-07 · **Escopo:** todo o painel Admin — 8 abas (Geral, LAUD.IA, Central de Usuários, Financeiro, Auditoria, Suporte, Máscaras, Saúde), ~7.100 linhas em 16 arquivos + o painel de configuração do LAUD.IA (`SharedLaudIA.tsx`, 1.745 linhas).
**Método:** leitura completa de cada arquivo (5 revisões paralelas independentes, uma por área), cruzando cada botão/formulário com o backend que ele deveria acionar (`store/db.ts`, `store/adminUsers.ts`, `api/*.ts`). Sem alteração de código — auditoria pura.
**Complementares:** [Plano de Finalização do Admin](archive/PLANO_FINALIZACAO_ADMIN_2026-07.md) (arquivado — 100% executado) · [Documentação Oficial](DOCUMENTACAO_OFICIAL.md) · [Auditoria Completa 07/07 (sistema geral)](AUDITORIA_COMPLETA_2026-07-07.md)

> ✅ **Status (07/07/2026): TODOS os achados abaixo foram corrigidos** — ver [Plano de Finalização](archive/PLANO_FINALIZACAO_ADMIN_2026-07.md) (arquivado) para o detalhe de cada item, incluindo Fase 4 (C7/C8, já executada após decisão de retenção de dados). Esta página fica como o registro do estado ANTES da correção (não foi reescrita retroativamente). Únicos itens genuinamente abertos: M2/M3 da Fase 6 (baixa prioridade — paginação do recálculo de Transações e guarda de concorrência entre abas) e desativar a conta no Firebase Auth ao excluir usuário (exigiria novo endpoint serverless, fora do escopo pedido).

---

## Resumo executivo

O módulo Admin está **funcionalmente completo** — não há um único botão morto (`onClick` vazio ou só `console.log`) em nenhuma das 8 abas nem no painel do LAUD.IA. Todo CRUD está de fato ligado ao Firestore, os fluxos de PACS-pricing e AbacatePay-config foram confirmados ponta a ponta (o que o admin configura é exatamente o que o backend lê), e os estados de loading/erro/vazio são tratados na maioria das telas.

O que falta para "funcionamento total e final" **não é funcionalidade ausente — é proteção insuficiente em ações de alto impacto**: campos de preço/cota sem validação, edições que se propagam para centenas de assinantes sem confirmação nem prévia, e ações que mexem em dinheiro/PACS/prompts de IA sem deixar rastro de auditoria. É o tipo de lacuna que não aparece em uso normal — só quando alguém erra ou digita rápido demais.

**Nenhuma vulnerabilidade de segurança clássica encontrada** (sem SQL/XSS injection, sem bypass de auth) — os riscos aqui são de **integridade operacional**: preço errado indo ao ar, cota de 500 assinantes mudando por engano, chamado de suporte apagado sem registro de quem apagou.

---

## 🔴 Crítico — risco financeiro, de dados ou de segurança operacional

| # | Onde | Problema | Impacto concreto |
|---|---|---|---|
| C1 | `AdminFinanceiro.tsx` (campos de preço/cota em Planos, Add-ons, `VmInfraTab.tsx`, `PacsPlansTab.tsx`) | `parseFloat(e.target.value) \|\| 0` sem validação — aceita negativo, zero ou vazio; `min={0}` do HTML só bloqueia o spinner nativo, não digitação/paste | Um admin digita `-149` sem querer e clica salvar: plano fica **vendido a preço negativo** sem nenhum erro |
| C2 | `AdminFinanceiro.tsx:221-246` (`handleSave` do editor de plano) | Editar (não deletar) um plano propaga `reportsQuota`/`clinicsQuota` para **todos os assinantes ativos** daquele plano (`where('planId','==',editingId)`) — sem confirmação, sem prévia de quantos serão afetados | Um typo de cota num plano com 500 assinantes muda a cota dos 500, com um único toast depois — sem chance de desfazer |
| C3 | `AdminFinanceiro.tsx:908-915` (config AbacatePay) | Trocar/apagar a API key ou o webhook secret grava direto no Firestore sem confirmação, apesar do próprio banner da tela dizer que isso alterna entre "Mock" e "Pagamentos Reais" (confirmado no servidor: `abacatepay-checkout.ts:87-94`) | Um admin editando por engano pode **desligar pagamentos reais silenciosamente** — só descobre quando um cliente reclamar |
| C4 | `AdminFinanceiro.tsx:618-624` ("Plano Ativo") | Desativar um plano (some do checkout/vitrine) não mostra quantos assinantes ativos o usam nem pede confirmação | Desativa por engano um plano com clientes pagantes ainda vinculados |
| C5 | `AdminUsersSubscriptions.tsx` (Motor Pro, add-on, cancelar/reativar assinatura) | Nenhuma dessas 4 ações chama `addAuditLog` — diferente de troca de cargo/status/exclusão, que já registram | Não dá pra responder "quem deu PACS de graça pra esse usuário" ou "quem cancelou essa assinatura" depois do fato |
| C6 | `AdminSupport.tsx` (inteiro) | **Zero** chamadas a `addAuditLog` — responder, mudar status, nota interna e principalmente "Limpar Tudo" (apaga todo o histórico de suporte) não deixam rastro | Um chamado sumiu ou uma resposta oficial foi enviada — não há como saber quem fez, quando |
| C7 | `src/store/adminUsers.ts` (`deleteUserDocument`) | Exclusão de usuário é um `deleteDoc` só em `users/{uid}` — não apaga `subscriptions/sub_{uid}`, histórico de `ai_usage` nem a conta no Firebase Auth | Depois de "excluir", sobram registros órfãos de assinatura/uso, e a pessoa ainda consegue tentar logar contra um doc que não existe mais (falha feia, não uma mensagem clara de "conta removida") |
| C8 | `src/store/db.ts` (`clearAllSupportTickets`) | Um único `writeBatch` sem paginação — o limite do Firestore é 500 operações por batch | A partir de ~500 tickets, "Limpar Tudo" **quebra com erro genérico** e não há como saber se apagou parcialmente ou nada |

---

## 🟠 Alto — funcionalidade arriscada, mas de blast radius menor ou uso menos frequente

| # | Onde | Problema | Impacto |
|---|---|---|---|
| A1 | `AdminMasks.tsx` (exclusão de máscara) | Confirmação é um OK/Cancelar simples, sem mostrar quantas clínicas/médicos usam aquela máscara; é **hard delete sem lixeira**; o ícone de lixeira só aparece no hover, colado ao lado de Duplicar/Preview | 1 clique errado apaga permanentemente uma máscara do sistema usada por **toda a base de médicos** |
| A2 | `src/modules/templates/TemplateEditor.tsx` (`handleSave`, usado pelo Admin de Máscaras) | Zero validação — pode salvar nome vazio ou `analysisTemplate`/`conclusionTemplate` em branco numa máscara do sistema | Máscara quebra silenciosamente para todo mundo que a usa |
| A3 | `AdminMasks.tsx` (`handleImportAI`) | Só checa se o JSON importado é um array — não valida tipos/formato de cada campo antes de gravar | Import malformado pode corromper máscaras globais sem aviso |
| A4 | `SharedLaudIA.tsx` (editor de prompt, `CognitiveCodeEditor`) | `<textarea>` sem validação nenhuma — inclusive os marcadores `=== CONVERSA ===`/`=== PROPOSTA ===` que o parser do Copiloto exige (a própria tela avisa "nunca remover", mas não impede) | Editar o prompt errado quebra o Copiloto só na próxima geração, não no momento do save |
| A5 | `SharedLaudIA.tsx` ("Salvar Bloco") | O botão diz que salva só o bloco ativo, mas na verdade grava **todo o `localSettings`** de uma vez | Um rascunho não-salvo em OUTRA aba do mesmo painel é publicado sem querer junto |
| ~~A6~~ | ~~`SharedLaudIA.tsx` ("Publicar")~~ | **RESOLVIDO NA AUDITORIA (não é bug):** verificado em `engine.ts:251-254` — `settings.aiMasterPrompt \|\| DEFAULT_MASTER_PROMPT` (mesmo padrão para os 6 blocos). Um valor salvo em Firestore via "Publicar" **sobrescreve o padrão do código imediatamente**, sem rebuild. A ressalva "Camada 1/2 precisa rebuild" (histórico do projeto) só vale pra mudar o texto do `DEFAULT_*` no código-fonte — algo que a UI do Admin não faz. A linguagem "Publicar"/"salvo com sucesso" está correta. | — |
| A7 | `AdminUsersSubscriptions.tsx` (Motor Pro, add-on, reativar assinatura) | Sem confirmação — assimétrico com "Cancelar assinatura", que confirma. Reativar reseta o período de cobrança para 30 dias a partir de agora, sem avisar a nova data | Clique único remove PACS pago ou desliga Motor Pro; reativação pode mudar a data de cobrança sem o admin perceber |
| A8 | `AdminUsersSubscriptions.tsx` (`AssignSubModal`, campo "Duração (dias)") | `min`/`max` só no HTML — não validado no `handleConfirm` | Admin digita `0` e cria uma assinatura **já nascendo expirada**, com toast de sucesso |
| A9 | `AdminUsersSubscriptions.tsx` (`handleSaveQuota`) | Update de `subscriptions/sub_{uid}` envolto em `.catch(() => {})` — se o doc de assinatura não existir, falha em silêncio enquanto `users.reportsQuota` já foi alterado, e o toast diz sucesso mesmo assim | Falha parcial invisível: usuário tem cota nova só em metade dos dois documentos |
| A10 | `AdminAudit.tsx` (linha ~217) | "Carregar mais registros" **some** assim que qualquer filtro é ativado | Admin filtrando por data/módulo fica travado no que já carregou — nunca consegue paginar dentro do filtro |

---

## 🟡 Médio

| # | Onde | Problema | Impacto |
|---|---|---|---|
| M1 | `FinanceOverviewTab.tsx` | "MRR Teórico" inclui assinaturas em trial com preço (ainda sem pagamento) — o rótulo não deixa isso claro (mitigado parcialmente pelo alerta de reconciliação ≥20%) | Número de MRR mostrado é otimista em relação à receita realmente cobrável |
| M2 | `TransactionsTab.tsx` ("Recalcular") | Faz `getDocs` da coleção `transactions` inteira, sem paginação, sem confirmação | Custo/latência crescem sem limite conforme o histórico cresce |
| M3 | `AdminFinanceiro.tsx` (abas Features e Recursos Extras) | Ambas editam o mesmo doc `global_config/addons_config` com estado local separado, sem trava de concorrência | Duas abas abertas em paralelo: a última a salvar apaga silenciosamente a mudança da outra (caso raro) |
| M4 | `AdminSupport.tsx` (`highPriorityCount`) | Contado só sobre os 200 tickets carregados, não via `getCountFromServer` como os outros 3 contadores | Subconta se houver mais de 200 tickets abertos de alta prioridade |
| M5 | `AdminHealth.tsx` ("Pagamentos") | Só existe `'ok'`/`'unknown'` — nunca mostra `'warn'`/`'down'` mesmo que o pipeline esteja parado há dias | Painel de Saúde pode parecer neutro quando na verdade há um problema real |
| M6 | `TrainingDashboard.tsx` ("Calcular notas"/"Vetorizar") | Sem confirmação, ao contrário de "Importar" que confirma | Inconsistência de padrão — baixo risco (ações idempotentes) mas some sem aviso |
| M7 | `AdminLaudIAInsights.tsx` | Lê a collection group `ai_usage` inteira e filtra data no cliente | Fica mais lento/caro conforme o uso cresce — não é bug, é escala |

---

## 🟢 Baixo — código morto / cosmético

- `AdminUsersSubscriptions.tsx`: campos de tipo `lastLogin`, `licenseCode`, `licensePlanId` declarados e nunca lidos.
- `AdminFinanceiro.tsx`: `tokenPro` em `DEFAULT_EXTRAS` marcado `enabled:false`/"Descontinuado", órfão (fora de `RESOURCES_META`, nunca editável na UI).
- `CognitiveCodeEditor.tsx`: falha ao copiar para a área de transferência só loga no console, sem toast pro usuário.
- `MyPacsCard.tsx`: usa `window.confirm` nativo em vez do `useConfirm()` estilizado do resto do app (só inconsistência visual).
- `SharedLaudIA.tsx`: UI de diff (`pendingDiff`/`GitCompare`) está ligada mas não ficou claro onde `setPendingDiff` é de fato acionado — possível recurso morto, precisa de um grep dedicado para confirmar.

---

## ✅ O que já está sólido (confirmado, não precisa de retrabalho)

- **Nenhum botão morto em nenhuma aba** — toda ação de salvar/criar/excluir/publicar está ligada a uma escrita real no Firestore.
- **`AdminUserDetail.tsx` (visão 360º do cliente)**: as 5 seções (assinatura, transações, auditoria, tickets, uso de IA) são 100% dados reais, com estado vazio tratado — nada hardcoded.
- **Fluxo PACS-pricing confirmado ponta a ponta**: `PacsPlansTab.tsx` escreve em `global_config/pacs_plans`; `MyPacsCard.tsx` lê exatamente esse path.
- **Fluxo AbacatePay confirmado ponta a ponta**: os campos que o admin edita em `AdminFinanceiro.tsx` são os mesmos que `abacatepay-checkout.ts`/`abacatepay-webhook.ts` leem — sem divergência de nome/path.
- **Exportação CSV** (Auditoria e Transações) — escapamento RFC 4180 correto, sem risco de corromper o arquivo.
- **SLA de Suporte** — matemática correta (1ª resposta = 1ª mensagem cronológica de não-dono; tickets sem resposta corretamente excluídos da média, não contam como zero).
- **`AdminAnalytics.tsx`/`AdminHealth.tsx`/`AdminLaudIAInsights.tsx`** — dados 100% reais, nenhum mock/placeholder; estado vazio (deploy novo, sem métricas ainda) tratado com mensagem clara em vez de gráfico quebrado ou tela em branco.
- **Confirmação e auditoria já corretas em**: troca de cargo, ativar/desativar usuário, excluir usuário, atribuir plano (em `AdminUsersSubscriptions.tsx`) e exclusão/exclusão-em-lote de planos (em `AdminFinanceiro.tsx`) — o padrão certo existe no código, só não foi aplicado de forma consistente em todas as ações.
- **Proteção contra duplo-clique** no painel de treino do LAUD.IA (`TrainingDashboard.tsx`) — todas as ações bulk (importar/vetorizar/calcular/rodar harness) se bloqueiam mutuamente enquanto uma está em andamento.

---

*Ver [PLANO_FINALIZACAO_ADMIN_2026-07.md](archive/PLANO_FINALIZACAO_ADMIN_2026-07.md) (arquivado) para a correção priorizada de cada item acima.*
