# 📘 Documentação Oficial — LAUD.US

**Sistema de laudos ultrassonográficos com IA, PACS/DICOM e SaaS.**
Versão do documento: 2026-07-04 · Ambiente: produção (Vercel + Firebase).

Documentos complementares: [ARQUITETURA](../src/ARCHITECTURE.md) · [Auditoria](AUDITORIA_COMPLETA_2026-07.md) · [Plano de Refinamento](PLANO_REFINAMENTO.md) · [Projeto PACS Nuvem](PROJETO_PACS_NUVEM.md) · [Documentação de Sistema (legado)](SYSTEM_DOCUMENTATION.md).

---

## 1. Visão geral

O LAUD.US é uma plataforma web (PWA) para **médicos ultrassonografistas** produzirem laudos com apoio de IA, integrados a um **servidor PACS/DICOM** (imagens do aparelho) e a um **modelo SaaS** de assinatura (planos + add-ons pagos).

**Pilares:**
1. **Editor de laudo com IA** (LAUD.IA) — geração, refino e copiloto sobre máscaras clínicas por área.
2. **PACS/DICOM** — worklist enviada ao aparelho, imagens recebidas e anexadas ao laudo, exportação em PDF.
3. **SaaS** — planos, add-ons (PACS, Calculadoras, Agendamentos, Clínicas), cotas de laudos, cobrança via AbacatePay.
4. **Painel Admin** — controle de usuários, planos, financeiro (MRR/ARR), telemetria, suporte e saúde do sistema.

---

## 2. Arquitetura & stack

```
┌────────────── CLIENTE (navegador / PWA) ──────────────┐
│  React 18 + TypeScript + Vite · Zustand · Tiptap      │
│  Tailwind · framer-motion · lucide-react · paged.js   │
└───────────────┬──────────────────────┬────────────────┘
                │ Firebase SDK          │ fetch /api/*
                ▼                       ▼
      ┌──────────────────┐   ┌────────────────────────────┐
      │ Firebase         │   │ Vercel Serverless / Edge   │
      │ Auth · Firestore │   │ api/gemini (Edge)          │
      │ Storage          │   │ api/worklist, orthanc-proxy│
      └──────────────────┘   │ api/abacatepay-*, cron-*   │
                             └───────────┬────────────────┘
                                         │
                   ┌─────────────────────┼───────────────────┐
                   ▼                     ▼                   ▼
             Google Gemini        AbacatePay            Orthanc (PACS)
             (Lite/Pro)           (pagamentos)          via Agente/Tailscale
```

**Camadas do código:**
- `src/modules/*` — UI + lógica de cada domínio.
- `src/store/` — `app.ts` (estado Zustand), `db.ts` (acesso Firestore), `adminUsers.ts`.
- `src/hooks/` — `useAuth`, `useSubscription`, `useAdmin`, `useConfirm`, `useFirestore`.
- `src/lib/` — firebase, authToken, sentry, crypto, googlePicker.
- `src/components/` — UI compartilhada (Sidebar, Modal, ConfirmDialog, FeatureLocked, ErrorBoundary…).
- `api/*` — funções serverless (Node) e edge (`gemini`).
- `scripts/agent.js` — Agente Local do PACS (roda na clínica/VM).

**Roteamento:** view-based (`App.tsx`), módulos **lazy-loaded** com `Suspense` + `ErrorBoundary` por rota.

---

## 3. Módulos & funcionalidades

| Módulo | Rota | Função | Gating |
|---|---|---|---|
| **Dashboard** | `dashboard` | Início: atalhos, contadores, uso de laudos | — |
| **Worklist** | `worklist` | Exames pendentes/andamento/finalizados; sync PACS | — |
| **Pacientes** | `patients` | CRUD, histórico, exames anteriores (LGPD auditado) | — |
| **Agendamentos** | `appointments` | Agenda, marcação, worklist ao aparelho | add-on `appointments` |
| **Editor de Laudo** | `exam-editor` | Tiptap + IA + Copiloto + viewer PACS + PDF | — |
| **Máscaras** | `templates` | Biblioteca de máscaras + catálogo do sistema | — |
| **Calculadoras** | `calculators` | 20+ calculadoras clínicas | add-on `calculators` |
| **Clínicas** | `clinics` | Múltiplas clínicas, cabeçalhos | add-on `clinics` |
| **PACS/DICOM** | `dicom` | Config Orthanc, guia, armazenamento | add-on `pacs` |
| **Configurações** | `settings` | Perfil, PACS, LAUD.IA, **Assinatura** | — |
| **Admin** | `admin` | Painel completo (ver §7) | role `admin` |
| **LAUD.IA (admin)** | dentro de admin | Treino/config da IA | role `admin` |

### 3.1 Editor de Laudo (núcleo)
- **Tiptap** (rich text) com máscara por área (título, técnica, análise, conclusão, recomendações, observações metodológicas).
- **Geração IA** (`generation`), **refino** (`refine`), **Copiloto** (`copilot`), **template**.
- **Visualizador PACS embutido**: thumbnails + fullscreen via proxy do Agente; navegação por estudo; seletor de estudos.
- **Export**: PDF (paged.js) e Google Docs; **imagens em PDF** (grades 1×1…2×4).
- **Versões** do laudo (diff/rollback), **anamnese** e **termo de consentimento**.

### 3.2 LAUD.IA (motor de IA)
- **Google Gemini apenas** (Anthropic removido). Modelos: **Lite = `gemini-3.5-flash`**, **Pro = `gemini-3.1-pro-preview`** (fonte única em `engine.ts`; nunca emite IDs 2.5/1.5 mortos).
- Prompts por área (`ai/prompts/areaPrompts.ts`) + camadas mestre/global/estrutura/regras.
- **Temperatura adaptativa** por modo; `maxTokens` por área.
- **Telemetria** persistida em `users/{uid}/ai_usage` (por evento) → agregada em `metrics_daily` pelo CRON.
- **Treino/Evals** (`ai/training/*`): golden dataset, evaluator, retrieval few-shot, anonimização.

---

## 4. Modelo de dados (Firestore)

### Coleções raiz (globais)
| Coleção | Conteúdo | Leitura | Escrita |
|---|---|---|---|
| `users/{uid}` | Perfil, `role`, `subscriptionStatus`, `subscriptionId`, cotas, `motorProEnabled` | dono/admin | dono (exceto campos protegidos) / admin |
| `subscriptions/sub_{uid}` | Plano, `addons[]`, status, cotas, período | dono/admin | admin / Admin SDK (webhook) |
| `saas_plans/{id}` | Catálogo de planos (`price`, `interval`, `includesX`, cotas) | logado | admin |
| `transactions/{id}` | Pagamentos (`amount`, `type`, `status`, `timestamp`, `userId`) | admin / **dono (as próprias)** | só Admin SDK (webhook) |
| `support_tickets/{id}` | Tickets (msgs, status, prioridade) | dono/admin | dono cria; admin gerencia |
| `audit_logs/{id}` | Trilha de auditoria | admin | dono cria (autoria própria) |
| `metrics_daily/{YYYY-MM-DD}` | Agregado diário (laudos, custo, receita, ativos) + `_summary` (MRR/ARR) | admin | só Admin SDK (CRON) |
| `global_config/{doc}` | `admin_settings`, `addons_config`, `pricing_config`, `abacatepay_config`, `finance_stats` | logado | admin |
| `system/{doc}` | Broadcast, mensagens de sistema | logado | admin |

### Subcoleções por usuário — `users/{uid}/…`
`settings/app` · `templates` · `exams` · `patients` · `clinics` · `appointments` · `ai_usage` · (dados do usuário). Dono e admin acessam; **máscaras do admin** (sistema) são legíveis por todos.

### Campos protegidos de `users/{uid}` (só admin/Admin SDK altera)
`role`, `motorProEnabled`, `reportsQuota`, `clinicsQuota`, `subscriptionStatus`, `subscriptionId`, `licenseExpiresAt`, `active`, `addons`, `createdAt`, `email`. O dono só pode **incrementar** `reportsUsedThisMonth`.

---

## 5. Sistema de planos & cobrança

### Add-ons e cotas
- **Add-ons:** `pacs`, `calculators`, `appointments`, `clinics` — cada um libera o módulo correspondente.
- **Cotas:** `reportsQuota` (laudos/mês, 9999 = ilimitado), `clinicsQuota`, tokens Lite/Pro.
- **Trial:** 14 dias a partir de `createdAt` (100 laudos, sem add-ons pagos).
- **Admin:** `role === 'admin'` → tudo liberado, cota ilimitada.

### `useSubscription` (fonte de verdade no cliente)
Deriva `isActive`, `isTrialing`, `hasPacs/hasCalculators/hasAppointments/hasClinics`, `reportsRemaining`, `canGenerateReport`, `motorOptions`. Reset mensal disparado quando `lastResetAt + 30d` expira (via CRON + gatilho autenticado).

### Gating (enforcement)
1. **Navegação:** Sidebar/BottomNav escondem módulos sem add-on.
2. **Paywall:** `FeatureLocked` bloqueia o módulo (Calculadoras, PACS, Clínicas, Agendamentos) com CTA para a assinatura.
3. **Servidor:** `/api/worklist` e `/api/orthanc-proxy` exigem add-on PACS (`_entitlements.ts`); `/api/gemini` (modo `generation`) exige assinatura ativa + cota — ambos **fail-open**.

### AbacatePay (pagamentos)
- **Checkout** (`/api/abacatepay-checkout`): plano ou add-on → URL de pagamento (retorno para a aba de assinatura). Autenticado + checagem de posse.
- **Webhook** (`/api/abacatepay-webhook`): concede plano/add-on (mapeia `includesX` → `addons[]`), registra `transactions`, agrega receita em `finance_stats` (best-effort), assina com HMAC (`safeEqual`).
- **Cancelamento** (`/api/abacatepay-cancel`): dono ou admin; cancela no gateway + marca `canceled` local.
- **Sem portal de cliente** (AbacatePay não oferece); comprovantes vão por e-mail; histórico de pagamentos do usuário na própria aba de Assinatura.
- **Teste de chave** (`/api/abacatepay-test`): admin-only.

---

## 6. PACS / DICOM

**Arquitetura (VM-first):** Orthanc + Agente LAUD.US rodam numa **VM por usuário** (Google Cloud); a clínica mantém apenas um **relé Tailscale** (roteador GL.iNet ou PC do dia a dia). Ver [PROJETO_PACS_NUVEM.md](PROJETO_PACS_NUVEM.md) e docs `PACS_*`.

**Fluxo:** LAUD.US → Agente grava `.wl` → Orthanc oferece worklist (4242) → aparelho lê e faz o exame → envia imagens (C-STORE 4242) → Orthanc guarda → LAUD.US busca as imagens (8042) pelo proxy do Agente (Funnel HTTPS) e mostra no laudo.

**Componentes:**
- **Agente Local** (`scripts/agent.js`): grava worklists (`generate_wl.py`/pydicom) e faz **proxy** REST do Orthanc (`/api/orthanc-proxy`). Segredo por-usuário (`x-agent-secret`), anti-SSRF (`ALLOWED_HOSTS`). Multi-tenant via `tenantId`.
- **Proxy Vercel** (`/api/orthanc-proxy`, `/api/worklist`): auth JWKS + entitlement PACS; encaminha ao Agente (Funnel HTTPS).
- **Provisão** (`/api/pacs-provision.ts`): self-service da VM/tenant (em evolução).
- **Painel** (`src/modules/dicom`): configuração (presets Nuvem/Local), guia passo a passo, aba **Armazenamento & Exames** (estatísticas do Orthanc).

**Quem precisa de Tailscale:** VM (sim) · relé/roteador (sim) · **ultrassom (não)** · **navegador do médico (não — usa o Funnel HTTPS)**.

---

## 7. Painel Admin

| Aba | Conteúdo |
|---|---|
| **Geral** | KPIs (via `getCountFromServer`) + **Analytics** (gráficos SVG de laudos/dia, ativos/dia, receita/dia; MRR/ARR) + Broadcast |
| **LAUD.IA** | Treino/config da IA (prompts, modelos, evals) |
| **Usuários & Planos** | Lista, filtros/busca, métricas (MRR/ARR do agregado), role/cota/add-on/Motor Pro/atribuir plano/cancelar, **visão 360º do cliente** |
| **Financeiro** | Planos (CRUD), preços, add-ons; **transações paginadas + export CSV**; "Recalcular métricas" (semeia `finance_stats`) |
| **Auditoria** | Logs paginados, filtros, **export CSV** |
| **Suporte** | Tickets, resposta, status, **SLA** (1ª resposta, resolução, backlog) |
| **Máscaras** | Máscaras do sistema (criar/importar/exportar) |
| **Saúde** | Status real: pipeline de métricas (CRON), pagamentos (webhook), motor de IA, Sentry |

**Acesso:** só `role === 'admin'` (autoritativo) ou super-admin por e-mail. Guarda no `Admin.tsx` + regras do Firestore.

**Telemetria:** cada geração grava `ai_usage`; o **CRON** (`cron-aggregate-metrics`, diário 03:30) faz *collection-group* sobre todos os `ai_usage`, consolida em `metrics_daily` e calcula MRR/ARR das assinaturas ativas em `metrics_daily/_summary`.

---

## 8. Segurança & conformidade

- **Autenticação:** Firebase Auth (Google + e-mail/senha). Todo acesso exige login.
- **RBAC:** `admin` | `medico` | `recepcao`. Privilégio de admin só por `users/{uid}.role` (campo protegido).
- **Firestore rules:** default-deny; impedem escalonamento de privilégio, inflar cota, auto-conceder add-ons; contador de uso só cresce; `transactions`/`metrics_daily` restritos; webhooks usam Admin SDK.
- **Endpoints:** auth obrigatória (JWKS no Edge/serverless), rate-limit no `gemini`, `safeEqual` (timing-safe) em segredos, entitlement server-side (PACS + cota) **fail-open**.
- **Segredos:** `.env` gitignored; chaves só em env da Vercel; senhas PACS e segredo do Agente **criptografados** por-usuário; anti-SSRF no Agente.
- **LGPD:** trilha de acesso a paciente (`logPatientAccess`), pseudonimização nos prompts (`scrubForGeneration`).
- **Monitoramento:** Sentry (opt-in por DSN); aba Saúde no admin.

---

## 9. API / Endpoints (`api/`)

| Endpoint | Runtime | Auth | Função |
|---|---|---|---|
| `gemini.ts` | **Edge** | JWKS + rate-limit + **cota** | Proxy Gemini (generate/stream/embed) |
| `worklist.ts` | Node | JWKS + **entitlement PACS** | Grava `.wl` (local/encaminha ao Agente) |
| `orthanc-proxy.ts` | Node | JWKS + **entitlement PACS** | Proxy REST do Orthanc (imagens) |
| `pacs-provision.ts` | Node | — | Provisão de tenant/VM (evolução) |
| `abacatepay-checkout.ts` | Node | `verifyAuth` + posse | Inicia checkout (plano/add-on) |
| `abacatepay-webhook.ts` | Node | HMAC `safeEqual` | Concede compra + agrega receita |
| `abacatepay-cancel.ts` | Node | dono/admin | Cancela assinatura |
| `abacatepay-test.ts` | Node | **admin** | Testa chave AbacatePay |
| `reset-monthly-reports.ts` | Node | CRON_SECRET / auth | Reset mensal de cota |
| `cron-aggregate-metrics.ts` | Node | CRON_SECRET | Agrega `metrics_daily` + MRR/ARR |
| `promote-admin.ts` | Node | super-admin (trava tripla) | Promove o super-admin |
| `health.ts` | Node | — | Health-check |
| **Helpers** | — | — | `_auth`, `_edgeAuth`, `_firebase`, `_secure`, `_pricing`, `_entitlements` |

**Crons (Vercel):** `reset-monthly-reports` (03:00 diário) · `cron-aggregate-metrics` (03:30 diário). *Plano Hobby limita a 1×/dia; no Pro, voltar `cron-aggregate-metrics` para horário.*

---

## 10. Deploy & operações

### Vercel (frontend + serverless)
- Deploy automático a cada push na `main`. Build: `tsc && vite build`.
- **`vercel.json`** declara `functions` (cada `api/*.ts` deve existir — remover referências a arquivos deletados) e `crons` (diários no Hobby).
- Env vars: `GOOGLE_API_KEY`, `FIREBASE_*` (Admin SDK), `ABACATEPAY_*`, `CRON_SECRET`, `VITE_FIREBASE_*`.

### Firebase
- `firebase deploy --only firestore:rules,firestore:indexes` — **necessário** após mudar regras/índices (ex.: histórico de pagamentos do usuário, `metrics_daily`, índice collection-group de `ai_usage`).
- O índice **collection-group** de `ai_usage.timestamp` leva alguns minutos para construir.

### Pós-deploy (uma vez)
1. Admin → Financeiro → **"Recalcular métricas"** (semeia `finance_stats` e `_summary`).
2. Aguardar o 1º CRON (03:30) ou uso de IA para popular `metrics_daily`.

### Variáveis de ambiente (resumo)
- **Cliente:** `VITE_FIREBASE_*`, `VITE_ADMIN_UID/EMAIL`, `VITE_SENTRY_DSN`, `VITE_ENVIRONMENT`.
- **Servidor:** `GOOGLE_API_KEY`, `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`, `ABACATEPAY_API_KEY/WEBHOOK_SECRET`, `CRON_SECRET`.
- **Agente PACS:** `LAUDUS_AGENT_SECRET`, `LAUDUS_WORKLIST_DIR`, `LAUDUS_ALLOWED_HOSTS`, `PORT`.

---

## 11. Fluxos principais

**A. Criar exame → laudo → PDF**
Worklist/Agenda cria exame → (opcional) worklist ao aparelho → aparelho envia imagens → Editor gera laudo com IA (cota verificada no servidor) → revisão/refino/copiloto → export PDF (laudo + imagens) ou Google Docs.

**B. Assinar / comprar add-on**
SubscriptionCenter → checkout AbacatePay → pagamento → webhook concede (add-ons/cota) → `useSubscription` reflete via snapshot → módulos liberados (gating cai).

**C. Cancelar**
SubscriptionCenter (ou Admin) → `/api/abacatepay-cancel` → gateway + status `canceled` → acesso mantido até o fim do período.

**D. Telemetria → dashboard**
Cada geração grava `ai_usage` → CRON diário agrega `metrics_daily`/`_summary` → Admin (Analytics/Saúde/Usuários) lê os agregados.

---

## 12. Testes & qualidade
- **188 testes** (Vitest): calculadoras, classificadores, motor de IA, verificação/evolução/aprendizado/treino, segurança (`safeEqual`), preços (`_pricing`), roteamento PACS + `resolveGeminiModel`.
- Gate de build: `tsc && vite build`. CI (GitHub Actions).
- Roadmap de testes/refino: ver [PLANO_REFINAMENTO.md](PLANO_REFINAMENTO.md).

---

## 13. Glossário
**Add-on** — recurso pago avulso (PACS/Calculadoras/Agendamentos/Clínicas). **Orthanc** — servidor PACS. **Worklist** — lista de exames que o aparelho lê (`.wl`). **Agente** — programa que grava `.wl` e faz proxy do Orthanc. **Tailscale/Funnel** — VPN privada + endereço HTTPS público. **MRR/ARR** — receita recorrente mensal/anual. **Entitlement** — direito de uso derivado do plano. **Fail-open** — em caso de falha na checagem, libera (não derruba pagante).

---

*Fim da documentação oficial. Para o detalhamento de decisões e pendências, ver os documentos complementares no topo.*
