# 🎯 Plano de Finalização — Módulo Administrador (07/07/2026)

**Base:** [AUDITORIA_ADMIN_2026-07.md](../AUDITORIA_ADMIN_2026-07.md) — 30 achados em 8 abas + painel LAUD.IA.
**Status: TOTALMENTE EXECUTADO em 07/07/2026** ("seguir com plano") — todas as 6 fases concluídas na mesma sessão, incluindo a Fase 4 (após o usuário decidir a política de retenção de dados na exclusão de usuário). `tsc` 0, testes verdes, `vite build` ok após cada fase. Único item que ficou de fora (fora do escopo da decisão pedida): desativar a conta no Firebase Auth ao excluir usuário — exigiria um novo endpoint serverless, ver Fase 4.

---

## Fase 0 — Guard de validação numérica (preço/cota) ✅ EXECUTADA

**Causa raiz:** `parseFloat(e.target.value) || 0` não bloqueia negativo (`-149` é truthy, passa direto) em todo campo de preço/cota do Financeiro.

**Fix:** `parseNonNegativeNumber`/`parseNonNegativeInt` (`src/utils/format.ts`, 5 testes em `src/test/parseNonNegativeNumber.test.ts`) aplicados em `NumInput` (`FinanceFormControls.tsx`) e em **12 campos inline** que não usavam o componente compartilhado: preços de plano/add-on, taxas de cartão/PIX, câmbio USD→BRL, custo de token IA (`AdminFinanceiro.tsx`), custo de disco/VM por plano (`VmInfraTab.tsx`), preço/disco dos planos PACS (`PacsPlansTab.tsx`), câmbio na Central Financeira (`FinanceOverviewTab.tsx`), trial days/bundleSize/tokensPerReport (`AdminFinanceiro.tsx`) e duração de assinatura avulsa (`AdminUsersSubscriptions.tsx`, também resolve A8 da Fase 3).

---

## Fase 1 — Confirmações em ações de alto impacto ✅ EXECUTADA

1. **Chave/segredo AbacatePay** (`AdminFinanceiro.tsx`): `useConfirm()` avisando que a troca alterna Mock ↔ Pagamentos Reais — só dispara quando a credencial de fato mudou (comparação contra o valor salvo).
2. **Desativar plano + mudar cota** (`AdminFinanceiro.tsx`, `PlansTab.handleSave`): resolvido **junto com C2** (Fase 3) — antes de gravar, conta assinantes vinculados ao plano via `getCountFromServer` e exige confirmação mostrando o número real, tanto pra desativação quanto pra mudança de cota que se propaga aos assinantes.
3. **Excluir máscara do sistema** (`AdminMasks.tsx`): mensagem de confirmação agora distingue máscara do sistema (visível a todos os médicos) de máscara de clínica, com aviso específico pra system-wide.
4. **Motor Pro / add-on / reativar assinatura** (`AdminUsersSubscriptions.tsx`): as 3 ações ganharam `useConfirm()` (cancelar já tinha); reativar mostra a nova data de vencimento do período **antes** de confirmar, não só depois.

---

## Fase 2 — Auditoria faltando ✅ EXECUTADA

`addAuditLog(...)` adicionado em: Motor Pro, add-on, cancelar assinatura, reativar assinatura (`AdminUsersSubscriptions.tsx` — as 3 primeiras já vieram com o `confirm()` da Fase 1); e em `AdminSupport.tsx` inteiro — responder ticket, mudar status, nota interna, e **"Limpar Tudo"** (log gravado ANTES do batch de exclusão rodar, com a contagem de tickets no momento — se o batch falhar no meio, ao menos fica registrado que a operação foi tentada).

---

## Fase 3 — Correções pontuais de integridade de dados ✅ EXECUTADA

1. **C2 — propagação de cota**: resolvido junto da Fase 1 (ver item 2 acima).
2. **A8 — duração inválida em `AssignSubModal`**: resolvido na Fase 0 — `Math.min(365, Math.max(1, parseNonNegativeInt(...)))` no próprio `onChange`, não só no atributo HTML.
3. **A9 — falha silenciosa em `handleSaveQuota`**: agora rastreia se a escrita em `subscriptions/sub_{uid}` falhou e mostra erro específico ("cota do usuário atualizada, mas a assinatura não pôde ser sincronizada") em vez do toast de sucesso genérico.
4. **A10 — "Carregar mais" sumindo com filtro ativo** (`AdminAudit.tsx`): botão agora aparece independente de filtro; texto de apoio explica que buscar mais reaplica o filtro sobre o lote novo.

---

## Fase 4 — Higiene de exclusão ✅ EXECUTADA em 07/07/2026 (após decisão do usuário)

**Decisão do usuário (confirmada):** ao excluir um usuário, apagar a assinatura (`subscriptions/sub_{uid}`) junto — não faz sentido ficar órfã — mas **manter** `ai_usage`/`transactions` por retenção financeira/fiscal (o usuário já foi cobrado por aqueles laudos).

1. **C7 — `deleteUserDocument`** (`src/store/adminUsers.ts`): agora apaga `users/{uid}` E `subscriptions/sub_{uid}`; `ai_usage`/`transactions` mantidos intencionalmente (decisão acima, documentada no comentário da função e no log de auditoria).
2. **C8 — `clearAllSupportTickets`** (`src/store/db.ts`): reescrita para deletar em lotes de ≤500 (limite de operações por `writeBatch` do Firestore) em vez de um único batch que quebrava acima disso. Ganhou callback de progresso (`onProgress(done, total)`), exibido no botão "Limpar Tudo" do `AdminSupport.tsx` (`"Excluindo X/Y..."`) enquanto roda.

**Não incluído nesta fase (fora do escopo da decisão pedida):** a conta do usuário no **Firebase Auth** continua intocada após a exclusão — ele ainda consegue tentar fazer login contra um `users/{uid}` que não existe mais (falha, não uma mensagem clara de "conta removida"). Corrigir isso exigiria um **novo endpoint serverless** (Admin SDK, `getAdminAuth().deleteUser()`/`.updateUser({disabled:true})`) — mudança de escopo maior (novo endpoint deployado) que não foi pedida explicitamente. Ver `docs/AUDITORIA_ADMIN_2026-07.md` (C7) para o achado original.

**Critério de aceite:** `tsc` 0, 416 testes verdes, build ok. Confirmado.

---

## Fase 5 — Validação de conteúdo (Máscaras e Prompts do LAUD.IA) ✅ EXECUTADA

1. **A2 — `TemplateEditor.handleSave`**: exige `name`, `analysisTemplate` e `conclusionTemplate` não-vazios antes de salvar.
2. **A3 — `AdminMasks.handleImportAI`**: valida o lote INTEIRO antes de gravar qualquer item — tipo de cada campo presente, `area` contra a lista real de `EXAM_AREAS`, e campos essenciais em máscaras novas. Rejeita o import inteiro (não parcial) se qualquer item falhar, com mensagem listando os erros.
3. **A4 — marcadores do Copiloto**: bloco "Copiloto" ganhou `requiredMarkers: ['=== CONVERSA ===', '=== PROPOSTA ===']`; "Salvar Bloco" avisa (via `useConfirm`, não bloqueia) se algum estiver ausente do texto a salvar.
4. **A5 — "Salvar Bloco" enganoso**: implementada a opção (a), mais correta do que o previsto no plano original — `updateSettings({ [activeBlock.settingsKey]: currentValue })` salva só o campo do bloco ativo (merge parcial contra o que já está persistido), não mais o `localSettings` inteiro. Não precisou separar estado por bloco; `updateSettings` já faz merge parcial no store.

~~A6~~ confirmado como não-bug na própria auditoria (`engine.ts:251-254` — valor salvo no Firestore sobrescreve o padrão do código imediatamente, sem rebuild).

---

## Fase 6 — Médios e limpeza — parcialmente executada

**Feitos:**
- M1: rótulo "MRR Teórico" agora diz "ativas + trials c/ preço".
- M4: `highPriorityCount` (Suporte) ganhou indicador "+" quando a lista carregada (200 tickets) pode estar subcontando — sem exigir um índice composto novo no Firestore.
- M5: `AdminHealth` — card "Pagamentos" agora escala `ok`/`warn`/`down` pela idade do último evento pago (7d/30d), não só `ok`/`unknown`.
- M6: "Calcular notas" e "Vetorizar" (`TrainingDashboard.tsx`) ganharam `useConfirm()`, consistente com "Importar".
- Baixo: campo morto `lastLogin` removido de `SystemUser`; toast de erro no copy-to-clipboard (`CognitiveCodeEditor.tsx`); `window.confirm` trocado por `useConfirm()` estilizado em `MyPacsCard.tsx` (deprovisionar + reprovisionar).

**Não feitos (baixa prioridade, ficam para outra sessão):**
- M2: paginar o "Recalcular" de Transações (hoje `getDocs` completo, sem paginação).
- M3: guarda de concorrência entre as abas Features/Recursos Extras (`updatedAt` comparado antes de salvar).
- `tokenPro` em `DEFAULT_EXTRAS`: **não removido** — é campo obrigatório do tipo `SaasAddonsConfig` (compartilhado com `_pricing.ts`), removê-lo exigiria mudar o tipo em vários lugares; escopo maior que o achado "baixo/inofensivo" original justificava.
- `pendingDiff`/`GitCompare` em `SharedLaudIA.tsx`: não investigado se é recurso morto — precisa de um grep dedicado.

---

## Decisão do usuário — resolvida em 07/07/2026

**Exclusão de usuário (C7, Fase 4):** decidido apagar a assinatura junto (evita órfã), manter `ai_usage`/`transactions` por retenção financeira/fiscal. Implementado — ver Fase 4 acima.

## Possível próximo passo (não pedido, não implementado)

Desativar/excluir a conta no **Firebase Auth** ao excluir um usuário — hoje a pessoa ainda consegue tentar logar contra um `users/{uid}` inexistente (falha feia, não uma mensagem clara). Exige um novo endpoint serverless com Admin SDK. Ver nota na Fase 4.
