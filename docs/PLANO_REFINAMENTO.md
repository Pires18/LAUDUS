# 🛠️ Plano de Refinamento & Aprimoramento — LAUD.US

**Data:** 2026-07-04 (v2, aprofundado) · Base: [AUDITORIA_COMPLETA_2026-07.md](AUDITORIA_COMPLETA_2026-07.md).
**Meta:** de "funcional e seguro" para "maduro, escalável e sem arestas", sem quebrar o que já paga/funciona.

**Princípios invioláveis:** enforcement **fail-open**; **nunca quebrar cobrança**; toda ação admin **auditada**; toda mudança com `tsc` + 188 testes verdes; deploy monitorado; commits pequenos e reversíveis.

Cada fase traz **tarefas concretas (arquivos)**, **critério de aceite** e **risco**.

---

## FASE R1 — Testes dos caminhos críticos 🔴
*Objetivo: blindar pagamentos, enforcement e dados. Risco: nenhum (código de teste).*

**Tarefas**
- `test/entitlements.test.ts` — parser de cota (`checkReportQuota`): admin isento, trial dentro/fora de 14d, `status` ativo/cancelado, cota esgotada vs 9999. Mockar o fetch REST do Firestore.
- `test/webhook.test.ts` — `_pricing.resolveAddon`/`mapAddonKey`/`periodEndFrom` (puros) + lógica de mapeamento `includesX`→`addons[]` (extrair para função pura testável).
- `test/finance.test.ts` — `bumpFinanceStats` (chave por método), agregação diária (extrair a redução do CRON para função pura).
- `test/db-settings.test.ts` — merge/migração de settings e `getDailyMetrics`.

**Aceite:** cobertura dos módulos de pagamento/enforcement/dados; suíte ≥ 210 testes; CI verde.

---

## FASE R2 — Segurança fina 🟡
*Objetivo: fechar exposições e a última brecha de cota. Risco: baixo (fail-open).* 

**Tarefas**
- **Restringir `global_config`** (`firestore.rules`): separar docs públicos (prompts/planos herdados) de sensíveis (`abacatepay_config`, `admin_settings`). Docs sensíveis → `allow read: if isAdmin()`. Garantir que o cliente não dependa de ler segredos (já são server-side).
- **Cota contável no servidor** (`api/gemini.ts`): após gerar (modo `generation`), **incrementar** `reportsUsedThisMonth` via Firestore REST com o token do usuário (as rules permitem o dono incrementar) — em vez de confiar no cliente. Fecha 100% do vazamento.
- **Auditar `pacs-provision.ts`**: tratamento de erro/segredos, escopo mínimo da service account GCP, rotação de auth-key Tailscale.
- Reduzir `any` nos endpoints e `store/db.ts`.

**Aceite:** visitante/usuário comum não lê docs sensíveis; cota não excedível por adulteração de cliente; sem regressão nas gerações legítimas.

---

## FASE R3 — Escala do admin 🟡
*Objetivo: painel escala para milhares de usuários. Risco: baixo.*

**Tarefas**
- **Paginação server-side** em `AdminUsersSubscriptions` e `AdminSupport` (padrão já usado em `AdminFinanceiro`: `getCountFromServer` para métricas + `startAfter` para listas). Busca por prefixo de e-mail/nome via query.
- (Opcional) Vercel **Pro** → `cron-aggregate-metrics` volta a horário (`10 * * * *`) para métricas quase em tempo real.

**Aceite:** listas paginadas sem baixar coleção inteira; métricas continuam corretas (agregados).

---

## FASE R4 — Refatoração dos gigantes 🟡
*Objetivo: manutenibilidade. Risco: baixo (com testes).* 

**Tarefas**
- Quebrar `ExamEditor.tsx` (1.457) e `LaudCopilot.tsx` (1.585) em subcomponentes/hooks.
- `AdminFinanceiro.tsx` — separar abas (Planos/Transações/Preços) em arquivos.
- `SharedLaudIA.tsx` (1.745) — dividir por seção.
- `ai/prompts/areaPrompts.ts` (3.297) — mover conteúdo para dados (JSON) carregados, separando dado de código.

**Aceite:** nenhum arquivo de módulo > 800 L (salvo dados); `tsc`+testes verdes; sem mudança de comportamento.

---

## FASE R5 — Planos avançados 🟡 (risco médio — cobrança)
*Objetivo: gestão de assinatura profissional.*

**Tarefas**
- **Upgrade/downgrade com prorata** (dentro do que a AbacatePay permite) em vez de atribuição direta.
- **Reconciliação financeira:** botão "Auditar" comparando `finance_stats` vs soma real de `transactions`.
- **Receita por plano** no dashboard: adicionar a dimensão de plano no agregado do CRON (`metrics_daily`).
- Vitrine pública dedicada de **pricing** (página, não só modal) + add-ons avulsos + FAQ.

**Aceite:** trocas de plano sem cobrança dupla; agregados batem com o real; pricing público navegável.

---

## FASE R6 — PACS multi-tenant (em andamento) 🟡 (risco médio)
*Objetivo: PACS gerenciado robusto e documentado.*

**Tarefas**
- Endurecer `api/pacs-provision.ts` (retries, timeouts, estados de erro claros, idempotência).
- **Migração** dos exames locais → VM/tenant (script + conferência de contagem).
- Observabilidade do Agente (health, uso de disco) na aba PACS e na Saúde do admin.
- Consolidar docs `PACS_*` num único manual operacional.

**Aceite:** provisão previsível e reversível; migração com verificação; docs unificadas.

---

## FASE R7 — Higiene contínua 🟢
- Reduzir `any` (meta < 100), limpar ~60 TODOs.
- Code-split do bundle `vendor-ui` (dynamic import / manualChunks).
- Padronizar loading/vazio/erro em componentes compartilhados.

---

## Ordem, impacto & risco

| Fase | Esforço | Impacto | Risco | Quando |
|---|---|---|---|---|
| **R1** Testes | Médio | **Alto** | Nenhum | **1º** |
| **R2** Segurança | Médio | Alto | Baixo | **2º** |
| **R3** Escala admin | Médio | Médio-Alto | Baixo | 3º |
| R4 Refatoração | Alto | Médio | Baixo | conforme fôlego |
| R5 Planos avançados | Alto | Médio-Alto | **Médio (cobrança)** | com cuidado |
| R6 PACS multi-tenant | Alto | Alto (produto) | Médio | contínuo |
| R7 Higiene | Baixo | Baixo | Nenhum | oportunístico |

**Recomendação:** executar **R1 → R2 → R3** (blindagem + escala, baixo risco) antes de R5/R6 (cobrança/PACS, mais sensíveis). R4/R7 em paralelo, oportunisticamente.
