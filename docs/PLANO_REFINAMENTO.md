# 🛠️ Plano de Refinamento & Aprimoramento — LAUD.US

**Data:** 2026-07-04 · Baseado na [AUDITORIA_COMPLETA_2026-07.md](AUDITORIA_COMPLETA_2026-07.md).
Objetivo: elevar o sistema de "funcional e seguro" para "maduro, escalável e sem arestas", sem quebrar o que já paga/funciona.

Princípios: **fail-open** em enforcement; **nunca quebrar cobrança**; toda ação admin **auditada**; mudanças com `tsc` + testes verdes; deploy monitorado.

---

## FASE R1 — Testes dos caminhos críticos (🔴 prioridade)
*Sem risco de produção; blinda o resto.*
- Testes de **`_entitlements` / cota** (lógica de `hasPacsEntitlement` e do parser de `checkReportQuota`).
- Testes do **webhook** (mapeamento plano→add-ons, `resolveAddon`, `bumpFinanceStats` — puros).
- Testes de **`store/db`** helpers de settings/merge e `getDailyMetrics`.
- Meta: cobrir pagamentos, enforcement e roteamento de dados.

## FASE R2 — Segurança fina (🟡)
- **Restringir `global_config`**: separar docs públicos (prompts/planos que os usuários herdam) de docs sensíveis; regra de leitura mais estrita para os sensíveis.
- **Cota contável no servidor** (opcional/avaliar custo): incrementar `reportsUsedThisMonth` server-side no `/api/gemini` (via Firestore REST com o token do usuário) em vez de confiar no cliente — fecha 100% do vazamento de cota.
- Revisar `any` nos endpoints e no `store/db`.

## FASE R3 — Escala do admin (🟡)
- **Paginação + busca server-side** em *Usuários & Planos* e *Suporte* (usar `getCountFromServer` para métricas e `startAfter` para listas, como já feito no Financeiro).
- Ativar Vercel **Pro** (se/quando fizer sentido) para voltar o CRON a **horário** (`10 * * * *`) — métricas quase em tempo real.

## FASE R4 — Refatoração dos gigantes (🟡)
- Quebrar `ExamEditor.tsx`, `SharedLaudIA.tsx`, `AdminFinanceiro.tsx`, `LaudCopilot.tsx` em subcomponentes/hooks.
- `areaPrompts.ts` (dados): mover para JSON/estrutura de dados carregada, separando dado de código.

## FASE R5 — Planos avançados (🟡)
- **Upgrade/downgrade** de plano com prorata (dentro do que a AbacatePay permitir) em vez de atribuição direta.
- **Reconciliação financeira**: comparar `finance_stats` (agregado) com soma real periodicamente (botão "Auditar").
- Receita **por plano** no dashboard (dimensão extra no agregado do CRON).

## FASE R6 — PACS multi-tenant (🟡, em andamento)
- Finalizar provisão self-service (`api/pacs-provision.ts`), documentar operação da VM compartilhada e migração dos exames locais → nuvem.

## FASE R7 — Higiene contínua (🟢)
- Reduzir `any` (meta < 100), limpar TODOs, code-split do `vendor-ui`.
- Padronizar estados de loading/vazio/erro com componentes compartilhados.

---

## Ordem sugerida & impacto

| Fase | Esforço | Impacto | Risco |
|---|---|---|---|
| R1 Testes | Médio | **Alto** (confiança) | Nenhum |
| R2 Segurança | Médio | Alto | Baixo (fail-open) |
| R3 Escala admin | Médio | Médio-Alto | Baixo |
| R4 Refatoração | Alto | Médio (manutenção) | Baixo |
| R5 Planos avançados | Alto | Médio-Alto | **Médio (cobrança)** |
| R6 PACS multi-tenant | Alto | Alto (produto) | Médio |
| R7 Higiene | Baixo | Baixo | Nenhum |

**Recomendação:** R1 → R2 → R3 primeiro (blindagem + escala, baixo risco). R5/R6 (cobrança/PACS) com cuidado e monitoramento. R4/R7 conforme fôlego.
