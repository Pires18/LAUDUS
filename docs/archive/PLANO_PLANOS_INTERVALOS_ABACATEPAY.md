# 💳 Plano de Aprimoramento — Planos, Intervalos, PACS & AbacatePay

**Data:** 2026-07-05 · **Objetivo:** planos multi-intervalo (mensal/semestral/anual) com **recorrência só no anual**, planos de **PACS/DICOM controlados no Financeiro do admin**, e AbacatePay adequado. **Pronto para produção.**

> Baseado no código atual: `Plan.interval` é `'month'|'year'`; o checkout manda `frequency=SUBSCRIPTION` para todo plano; `periodEndFrom` só trata year/mês; os planos de PACS estão **hardcoded** em `MyPacsCard.tsx`.

---

## 1. Requisitos (o que o dono pediu)
1. **Intervalos:** todo plano pode ser **Mensal**, **Semestral** ou **Anual**.
2. **Recorrência:** **apenas o Anual** é assinatura recorrente (auto-renova via AbacatePay). **Mensal e Semestral são pagamentos avulsos** (pagou → vale pelo período → expira → re-compra).
3. **Funcionalidades:** aprimorar e adequar ao sistema atual (gating por add-on já existe).
4. **PACS no Financeiro:** os planos de PACS/DICOM (Starter/Pro/Dedicado) saem do hardcode e passam a ser **gerenciados no Admin → Financeiro** (preço, disco, modelo), refletindo no card de provisão.

---

## 2. Decisões de arquitetura

### 2.1 Modelo de intervalo & recorrência
- `Plan.interval`: `'month' | 'semester' | 'year'`.
- **Regra de recorrência:** `isRecurring = interval === 'year'`. Só o anual vira `SUBSCRIPTION` na AbacatePay; mensal/semestral = `ONE_TIME` (billing avulso).
- **Preço por intervalo:** um plano pode ter **um preço por intervalo** (ex.: Pro Mensal R$149, Semestral R$799, Anual R$1.490). Duas opções:
  - ~~(A) Recomendada — um doc `saas_plans` por (tier × intervalo)~~ com `tier`, `interval`, `price`. Simples, sem migração de schema; a vitrine agrupa por `tier`.
  - ~~(B) Um doc por tier com `prices: { month, semester, year }`. Menos docs, mas muda o schema e todas as leituras. **Fica para depois**; começamos com (A).~~
  > **[CORREÇÃO 2026-07-08: na prática foi a opção (B) que foi implementada]** —
  > `Plan.prices: { month, semester, year }` num único documento é o campo vigente;
  > `Plan.interval`/`Plan.price` ficaram `@deprecated` (legado). Ver
  > `src/types.ts:678-684` e `api/_pricing.ts:200-201`.

### 2.2 Expiração dos avulsos (mensal/semestral)
Hoje não há expiração automática (só o trial é calculado no cliente). Para avulsos:
- Gravar `currentPeriodEnd` (via `periodEndFrom` estendido) e `autoRenew: false`.
- **Enforcement de expiração** (novo): quando `now > currentPeriodEnd` e `autoRenew=false`, a assinatura conta como **expirada** → `useSubscription` trata como inativa (bloqueia geração/add-ons) e a UI mostra "renovar".
- **Onde checar:** (1) no cliente `useSubscription.deriveState` (imediato, UX) **e** (2) num CRON diário (`cron-expire-subscriptions`) que marca `status='expired'` no Firestore (autoritativo). Fail-safe: o enforcement server-side de cota (`_quota.ts`) já bloqueia sem sub ativa — estender para checar `currentPeriodEnd`.

### 2.3 PACS no Financeiro
- Novo doc `global_config/pacs_plans` (editável no Admin → Financeiro): `{ starter, pro, dedicado: { label, price, interval, disk, model, badge, active } }` — ou docs `saas_plans` com `category: 'pacs'`.
- `MyPacsCard.tsx` **lê** esse config (em vez do `PLANS` hardcoded).
- O add-on `pacs` (que libera o módulo) permanece; os **planos de infra do PACS** (VM starter/pro/dedicado) passam a ser um catálogo gerenciável, com o mesmo modelo de intervalo/recorrência.

---

## 3. Mudanças por camada (concreto, pronto p/ produção)

### 3.1 Tipos & catálogo — `src/types.ts`, `api/_pricing.ts`
- `Plan.interval: 'month' | 'semester' | 'year'`.
- `Plan.autoRenew?: boolean` (derivado do intervalo, mas persistido para o webhook).
- `api/_pricing.ts`:
  - `periodEndFrom(start, interval)` → +30 / **+182** (semestre) / +365.
  - `isRecurringInterval(interval)` → `interval === 'year'` (fonte única).
  - `intervalLabel(interval)` → 'mês' | 'semestre' | 'ano'. Testável.

### 3.2 Admin — `AdminFinanceiro` (PlansTab + novo PacsPlansTab)
- **PlanFormModal:** campo **Intervalo** (Mensal/Semestral/Anual); mostrar aviso "Anual = assinatura recorrente; demais = pagamento único".
- **Nova aba "PACS/DICOM"** no Financeiro: CRUD dos planos de infra PACS (label, preço, intervalo, disco, modelo, badge, ativo) → grava `global_config/pacs_plans`.
- Métricas: separar receita **por categoria** (assinatura vs PACS) no dashboard/agregado (dimensão no CRON).

### 3.3 Vitrine & assinatura — `PricingPlans.tsx`, `SubscriptionCenter.tsx`
- **Seletor de intervalo** (Mensal/Semestral/Anual) na vitrine; agrupar planos por tier e mostrar o preço do intervalo selecionado.
- Badge "Recorrente" só no Anual; "Pagamento único" no mensal/semestral.
- SubscriptionCenter: mostrar o intervalo atual, `currentPeriodEnd`, e CTA "Renovar" quando avulso perto de expirar; "Gerenciar recorrência" só no anual.

### 3.4 AbacatePay — `abacatepay-checkout.ts`, `abacatepay-webhook.ts`, `abacatepay-cancel.ts`
- **Checkout:** `frequency = isRecurringInterval(interval) ? 'SUBSCRIPTION' : 'ONE_TIME'` (hoje é sempre SUBSCRIPTION para plano). Passar o `interval` correto.
- **Webhook:**
  - Anual (SUBSCRIPTION): grava `abacatePaySubscriptionId`, `autoRenew: true`, `status: 'active'`, `currentPeriodEnd = +1 ano`.
  - Mensal/Semestral (ONE_TIME): `autoRenew: false`, `status: 'active'`, `currentPeriodEnd = periodEndFrom(now, interval)`. Sem `abacatePaySubscriptionId`.
  - **PACS plan** (ONE_TIME ou recorrente conforme intervalo): concede a instância/tenant + grava a transação com `category: 'pacs'`.
- **Cancel:** só faz sentido para recorrentes (anual). Para avulsos, "cancelar" = deixar expirar (UI explica).

### 3.5 Expiração — novo `api/cron-expire-subscriptions.ts` + `useSubscription`
- CRON diário: `subscriptions` com `autoRenew=false` e `currentPeriodEnd < now` → `status='expired'` + espelha no user.
- `useSubscription.deriveState`: tratar `expired` e `currentPeriodEnd < now` (avulso) como inativo.
- `_quota.ts` (server): incluir checagem de `currentPeriodEnd` na definição de "assinatura ativa".

### 3.6 PACS card — `MyPacsCard.tsx`, `UltrasoundSetupCard.tsx`
- Ler `global_config/pacs_plans` (em vez do `PLANS` hardcoded). Fallback para os defaults atuais se o doc não existir (retrocompat).

---

## 4. Modelo de dados (novo/alterado)
- `saas_plans/{id}`: **+ `interval` (month|semester|year)**, `+ autoRenew`, `+ tier` (agrupador da vitrine), `+ category` ('subscription' | 'pacs').
- `subscriptions/sub_{uid}`: **+ `autoRenew`**, `+ `interval``; usa `currentPeriodEnd` já existente; `status` ganha `'expired'`.
- `global_config/pacs_plans`: catálogo de infra PACS gerenciável.
- `transactions`: **+ `category`** ('subscription' | 'addon' | 'pacs') para receita segmentada.

---

## 5. Compatibilidade & migração
- **Retrocompat:** planos existentes com `interval` ausente → tratados como `'month'` avulso (ou mantidos como estão). `autoRenew` ausente → derivado do intervalo.
- **Assinaturas ativas hoje** (SUBSCRIPTION): continuam recorrentes; nenhuma quebra.
- **PACS hardcoded → config:** `MyPacsCard` cai no fallback (defaults atuais) até o admin publicar `pacs_plans`. Zero downtime.
- **Migração leve:** script/admin marca os planos existentes com `interval='year', autoRenew=true` se forem os recorrentes atuais.

---

## 6. Testes (estender a suíte pura)
- `_pricing.test.ts`: `periodEndFrom` (mês/semestre/ano), `isRecurringInterval`, `intervalLabel`.
- `quota.test.ts`: "assinatura expirada (currentPeriodEnd < now, autoRenew=false) → bloqueia".
- Novo `plans.test.ts`: derivação de `autoRenew`/recorrência por intervalo; agrupamento por tier.

---

## 7. Fases de execução (ordem segura)

| Fase | Escopo | Risco | Deploy |
|---|---|---|---|
| **P1** | Tipos + `_pricing` (interval/period/recurring/label) + testes | Baixo | Vercel |
| **P2** | Admin: intervalo no PlanFormModal + aba PACS Plans (`pacs_plans`) | Baixo | Vercel |
| **P3** | `MyPacsCard` lê `pacs_plans` (fallback) | Baixo | Vercel |
| **P4** | Vitrine + SubscriptionCenter: seletor de intervalo + badges | Baixo | Vercel |
| **P5** | **AbacatePay** checkout/webhook: recorrência só no anual, avulso c/ período | **Médio (cobrança)** | Vercel |
| **P6** | Expiração: `cron-expire-subscriptions` + `useSubscription`/`_quota` | **Médio** | Vercel + `vercel.json` cron |
| **P7** | Receita por categoria (CRON + dashboard) | Baixo | Vercel |

**Recomendação:** P1→P4 são seguros e entregam a UX/gestão. **P5/P6 (cobrança + expiração)** exigem cuidado e monitoramento — testar em staging, fail-open, sem quebrar quem já paga.

---

## 8. Riscos & mitigações
| Risco | Mitigação |
|---|---|
| Quebrar cobrança de assinantes atuais | P5 mantém SUBSCRIPTION para os anuais existentes; avulso é caminho novo |
| Avulso não expirar (uso grátis) | Dupla checagem (cliente + CRON + `_quota` server) |
| PACS card sem catálogo | Fallback para os defaults atuais |
| AbacatePay ONE_TIME vs SUBSCRIPTION | O checkout já suporta `frequency`; só ajustar a regra |
| Confusão de UX (recorrente vs avulso) | Badges e copy explícitos na vitrine e no SubscriptionCenter |

---

## 9. Pronto para produção — checklist final
- [ ] `firebase deploy --only firestore:rules` se `pacs_plans`/novos campos exigirem regra (catálogo público como `saas_plans`).
- [ ] Cron `cron-expire-subscriptions` em `vercel.json` (diário no Hobby).
- [ ] Admin publica os planos por intervalo + os planos de PACS.
- [ ] Testar: compra mensal/semestral (avulso, expira) e anual (recorrente, renova/cancela).
- [ ] Monitorar webhook (aba Saúde) nos primeiros dias.

---

*Este é o plano. A implementação segue as fases P1–P7 — P1–P4 seguras (executo direto), P5/P6 com sua aprovação por mexerem em cobrança/expiração.*
