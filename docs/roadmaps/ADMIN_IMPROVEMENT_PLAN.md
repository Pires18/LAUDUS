# 🛠️ Plano de Aprimoramento — Módulo Admin (SaaS Control)

**Escopo:** todos os submódulos do Admin **exceto LAUD.IA**.
**Objetivo:** transformar o painel de "telas com contadores" em um **centro de controle de SaaS** de verdade — métricas confiáveis, séries temporais, visão 360º do cliente, exportações e saúde do sistema.

---

## 1. Diagnóstico atual (o que existe hoje)

| Submódulo | LOC | Estado | Principais lacunas |
|---|---|---|---|
| **Overview** (`Admin.tsx`) | 272 | 4 cards + broadcast + status IA | Sem **receita/MRR/churn**; contadores carregam coleções **inteiras**; métricas de IA **efêmeras** (memória) |
| **Usuários & Planos** (`AdminUsersSubscriptions`) | 1112 | Funcional (role, cota, add-on, plano) | Carrega **todos** os usuários/assinaturas; sem paginação/busca no servidor; sem **visão 360º** do cliente |
| **Financeiro** (`AdminFinanceiro`) | 1583 | Bom (após PR: agregado + paginação) | Sem **série temporal** de receita; sem receita por plano; sem MRR/ARR/churn de receita; sem export |
| **Auditoria** (`AdminAudit`) | 207 | Paginado | Botão **"Exportar CSV" morto** (sem `onClick`); busca só na página carregada |
| **Suporte** (`AdminSupport`) | 510 | Funcional (responder, status, notas) | Carrega **todos** os tickets; sem SLA/tempo de 1ª resposta; sem atribuição |
| **Máscaras** (`AdminMasks`) | 345 | Funcional (criar, importar, filtrar) | Carrega **todos** os templates; sem métricas de uso por máscara |
| **`AdminUsers.tsx`** | 485 | ❌ **Código morto** (não importado) | Remover |

---

## 2. Problemas transversais (a raiz do "básico e sem dados")

1. **Métricas de IA efêmeras.** `callMetricsHistory` vive **em memória, cap 20, some no reload**. "Taxa de sucesso", "latência" e "custo de IA" (Overview + Financeiro) refletem só a sessão atual do navegador — **não é telemetria real**.
2. **Sem persistência de métricas.** Não há coleção de telemetria (uso de laudos por dia, por motor, por usuário; latência; erros). Tudo é contado ao vivo varrendo coleções.
3. **Leituras sem limite.** Overview, Usuários, Suporte e Máscaras fazem `useCollection` da coleção **inteira** — custo e lentidão crescem com a base. (Transações já foi resolvido no último PR.)
4. **Sem séries temporais / gráficos.** Tudo é contagem pontual — impossível ver **tendência** (crescimento, churn, receita mês a mês).
5. **KPIs de SaaS ausentes:** MRR, ARR, ARPU, churn (logo e de receita), conversão trial→pago, LTV, DAU/MAU, laudos/usuário.
6. **Botões/telas incompletos:** export CSV da Auditoria não faz nada; nenhuma exportação funcional no painel.
7. **Sem visão 360º do cliente:** dados do usuário, assinatura, pagamentos, uso, atividade e tickets estão espalhados — não há uma tela única por cliente.
8. **Saúde do sistema não exposta:** o Sentry existe (`src/lib/sentry.ts`) mas erros/latência não aparecem no admin.

---

## 3. Plano de aprimoramento (faseado)

### FASE 0 — Higiene rápida (1 dia) — *baixo risco*
- **Remover `AdminUsers.tsx`** (código morto).
- **Corrigir o botão "Exportar CSV"** da Auditoria (implementar export real dos logs filtrados).
- **Limitar as leituras do Overview**: trocar contagens client-side por leitura de um doc de métricas agregadas (ver Fase 1) ou, provisoriamente, `count()` server-side (`getCountFromServer`) em vez de baixar as coleções.

### FASE 1 — Fundação de dados / telemetria (a base de tudo)
Sem isso, o resto continua "sem dados".
1. **Coleção de telemetria persistente** (`ai_usage` / `usage_events`): cada geração de laudo grava um evento leve (uid, motor lite/pro, tokens, latência, sucesso, timestamp, área). Escrito server-side (proxy Gemini já autentica) ou via agente de métricas.
2. **Agregados diários** (`global_config/metrics_daily/{YYYY-MM-DD}` ou coleção `metrics_daily`): job (CRON já existe) consolida por dia — novos usuários, ativos, laudos por motor, receita, churn. Alimenta gráficos sem varrer nada.
3. **Estender `finance_stats`** (já criado) com séries mensais: `revenueByMonth`, `newSubsByMonth`, `churnByMonth`.

### FASE 2 — Dashboard executivo (Overview repaginado)
Com os agregados da Fase 1:
- **KPIs de topo:** MRR, ARR, ARPU, Assinantes ativos, Churn %, Conversão trial→pago, Receita do mês.
- **Gráficos (série temporal):** receita mensal, novos assinantes vs cancelamentos, laudos/dia por motor, usuários ativos (DAU/MAU).
- **Funil:** cadastros → trials → pagantes.
- Manter broadcast; **status de IA vindo da telemetria persistente** (não da memória).

### FASE 3 — Visão 360º do cliente (Usuários & Planos)
- **Paginação + busca server-side** (por e-mail/nome) na lista de usuários.
- **Drawer/página por usuário** consolidando: perfil, assinatura + histórico de pagamentos (transações do usuário), uso de laudos (da telemetria), add-ons, atividade recente (audit logs do usuário), tickets de suporte.
- Ações no mesmo lugar: mudar plano/cota/role, conceder add-on, cancelar, reembolsar — com **log de auditoria** e confirmação.

### FASE 4 — Financeiro avançado
- **Receita ao longo do tempo** (gráfico), **receita por plano/add-on**, **MRR/ARR**, **churn de receita**, reembolsos.
- **Export** (CSV) de transações filtradas por período.
- Reconciliação: comparar `finance_stats` (agregado) com soma real (botão "Auditar", já temos o "Recalcular").

### FASE 5 — Suporte, Auditoria & Saúde
- **Suporte:** paginação; métricas de SLA (tempo até 1ª resposta, tempo de resolução), fila por status, atribuição de responsável.
- **Auditoria:** busca/filtro **server-side** (não só na página), export CSV real (Fase 0), filtros por período/usuário/módulo.
- **Saúde do sistema (nova aba ou card):** taxa de erro (Sentry), latência de IA (telemetria), status dos webhooks de pagamento, últimas falhas.

---

## 4. Ordem recomendada & impacto

| Fase | Esforço | Impacto | Observação |
|---|---|---|---|
| 0 — Higiene | ½ dia | Médio | Elimina lixo e botão morto já |
| 1 — Telemetria | 2–3 dias | **Alto** | Habilita todo o resto |
| 2 — Dashboard | 2 dias | **Alto** | Onde o dono "entende tudo" |
| 3 — Cliente 360º | 3 dias | Alto | Operação diária de SaaS |
| 4 — Financeiro | 2 dias | Médio-Alto | Receita/contabilidade |
| 5 — Suporte/Saúde | 2 dias | Médio | Operação + confiabilidade |

**Sugestão:** começar por **Fase 0** (rápida, visível) e **Fase 1** (a fundação). Sem a Fase 1, o dashboard bonito continua mostrando números frágeis.

---

## 5. Princípios de implementação
- **Não quebrar pagamento:** toda escrita de telemetria/agregado é *best-effort* (como o `finance_stats`).
- **Ler agregados, não coleções:** o painel consulta docs consolidados; varreduras completas só em ações explícitas ("Recalcular").
- **Tudo auditado:** ações admin geram `audit_log`.
- **Server-side onde importa:** contagens via `getCountFromServer`, agregação via CRON, nunca baixar a base inteira no navegador.
