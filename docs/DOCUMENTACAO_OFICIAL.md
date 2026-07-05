# 📘 Documentação Oficial — LAUD.US

**Plataforma de laudos ultrassonográficos com IA, PACS/DICOM gerenciado e SaaS de assinatura.**
Versão do documento: 2026-07-04 (v2, aprofundada) · Ambiente: produção (Vercel + Firebase).

**Status:** vivo · **Complementares:** [Arquitetura](../src/ARCHITECTURE.md) · [Auditoria Completa](AUDITORIA_COMPLETA_2026-07.md) · [Plano de Refinamento](PLANO_REFINAMENTO.md) · [Plano Final de Produção](PLANO_FINAL_PRODUCAO_2026-07.md) · [Projeto PACS Nuvem](pacs/PROJETO_PACS_NUVEM.md) · [PACS Tenant Setup](pacs/PACS_TENANT_SETUP.md) · [PACS Provision Setup](pacs/PACS_PROVISION_SETUP.md) · [PACS Manual](pacs/PACS_MANUAL.md).

---

## Índice
1. Visão geral & proposta de valor
2. Arquitetura & stack
3. Estrutura do repositório
4. Módulos & funcionalidades (detalhado)
5. Sistema de IA (LAUD.IA)
6. PACS/DICOM gerenciado (multi-tenant self-service)
7. Modelo de dados (Firestore, completo)
8. Sistema de planos, add-ons & cobrança
9. Segurança, RBAC & LGPD
10. API / Endpoints (todos)
11. Integrações externas
12. Deploy, operações & variáveis de ambiente
13. Fluxos de ponta a ponta
14. Testes & qualidade
15. Glossário

---

## 1. Visão geral & proposta de valor

O LAUD.US é um **PWA** que cobre o ciclo completo do laudo ultrassonográfico:
**agendar → gerar worklist no aparelho → receber imagens (PACS) → escrever o laudo com IA → revisar/refinar → exportar (PDF/Google Docs) → assinar.**

Sobre isso roda um **SaaS**: assinatura mensal/anual, add-ons pagos (PACS, Calculadoras, Agendamentos, Clínicas), cotas de laudos, cobrança via AbacatePay e um **painel administrativo** de operação (usuários, planos, financeiro MRR/ARR, telemetria, suporte, saúde).

**Diferenciais técnicos:** IA server-side (Gemini), **PACS gerenciado por VM na nuvem** (provisão self-service), telemetria persistente e agregada, gating de features por plano (cliente + servidor), conformidade LGPD.

---

## 2. Arquitetura & stack

```
┌───────────────── CLIENTE (navegador / PWA instalável) ─────────────────┐
│ React 18 · TypeScript · Vite · Zustand (estado) · Tiptap (editor)      │
│ Tailwind · framer-motion · lucide-react · paged.js (PDF) · docx        │
│ Firebase SDK (Auth/Firestore/Storage) · Service Worker (Workbox/PWA)   │
└──────────────┬───────────────────────────────────┬─────────────────────┘
               │ Firebase SDK                        │ fetch /api/*
               ▼                                     ▼
   ┌──────────────────────────┐      ┌──────────────────────────────────────┐
   │ Firebase                 │      │ Vercel Functions (Node) + Edge        │
   │ • Auth (Google/e-mail)   │      │ • /api/gemini (EDGE)                  │
   │ • Firestore (dados)      │      │ • /api/worklist, /api/orthanc-proxy   │
   │ • Storage (assinaturas)  │      │ • /api/abacatepay-* · /api/cron-*     │
   │ • Security Rules (RBAC)  │      │ • /api/pacs-provision · promote-admin │
   └──────────────────────────┘      └───────────┬──────────────────────────┘
                                                  │
              ┌───────────────────────────────────┼──────────────────────────┐
              ▼                    ▼               ▼                ▼
        Google Gemini       AbacatePay      Orthanc (PACS)     Google Cloud
        (Lite/Pro)          (pagamentos)    via Agente/Funnel  (VM provisionada)
                                            + Tailscale        + Google Docs/Drive
```

**Runtimes serverless:**
- **Edge** (`/api/gemini`): baixa latência global, sem Admin SDK — autentica via JWKS.
- **Node** (demais): usam Firebase Admin SDK quando preciso (webhook, cron, provisão).

**Roteamento (SPA, view-based, `App.tsx`):** sem React Router; um `view` no store define a tela. Módulos são **lazy-loaded** com `Suspense` e `ErrorBoundary` por rota. Pré-login → só `LoginScreen` (+ vitrine de planos pública).

---

## 3. Estrutura do repositório

```
src/
  App.tsx                  # bootstrap, auth listener, roteamento view-based, guards
  main.tsx                 # entrypoint, initSentry, PWA
  store/
    app.ts                 # Zustand: user, profile, settings, view, clínica ativa
    db.ts                  # acesso Firestore (user-scoped + global), settings, migrações,
                           #   helpers PACS (getActivePacsUrl/getProxyEndpoint/…), métricas
    adminUsers.ts          # ações admin sobre usuários (role/status/delete)
  hooks/
    useAuth · useSubscription · useAdmin · useConfirm · useFirestore
  lib/
    firebase · authToken · sentry · crypto · googleAuth · googleDocs · googleDrive · googlePicker
  components/              # UI compartilhada (24 componentes) — Sidebar, Modal, ConfirmDialog,
                           #   FeatureLocked, PricingPlans, LoginScreen, CommandPalette, …
  modules/                 # 14 domínios (ver §4)
  test/                    # 12 arquivos, 188 testes (Vitest)
api/                       # 18 funções serverless + 6 helpers (_auth,_edgeAuth,_firebase,
                           #   _secure,_pricing,_entitlements)
scripts/agent.js           # Agente Local do PACS (worklist + proxy Orthanc)
scripts/generate_wl.py     # gera arquivos .wl (pydicom)
public/                    # favicon.svg + icons/*.png (marca padrão) + manifest
docs/                      # documentação (este arquivo + complementares)
firestore.rules            # RBAC · firestore.indexes.json · vercel.json · firebase.json
```

---

## 4. Módulos & funcionalidades

| Módulo | Arquivos-chave | Função | Gating |
|---|---|---|---|
| **Dashboard** | `Dashboard.tsx` | Início: atalhos, contadores, uso de laudos do mês | — |
| **Worklist** | `Worklist.tsx` | Fila de exames (pendente/andamento/finalizado); cria/edita/exclui; sync `.wl` | — |
| **Pacientes** | `Patients.tsx`, `PatientDetail.tsx` | CRUD, histórico, exames anteriores; **acesso auditado (LGPD)** | — |
| **Agendamentos** | `Appointments.tsx`, `WeeklyCalendar`, `useAppointmentsState` | Agenda semanal, marcação, envio de worklist ao aparelho | add-on `appointments` |
| **Editor de Laudo** | ver §4.1 | Núcleo: Tiptap + IA + Copiloto + PACS viewer + PDF/Docs | — |
| **Máscaras** | `Templates.tsx`, `TemplateEditor.tsx` | Biblioteca de máscaras + catálogo do sistema | — |
| **Calculadoras** | `Calculators.tsx`, `formulas.ts`, `classifiers.ts` | 20+ calculadoras clínicas (biometria fetal, dopplers, volumes) | add-on `calculators` |
| **Clínicas** | `Clinics.tsx`, `ClinicDetail`, `ClinicForm` | Múltiplas clínicas, cabeçalhos de laudo por unidade | add-on `clinics` |
| **PACS/DICOM** | ver §6 | Config Orthanc, guia, armazenamento, **provisão self-service** | add-on `pacs` |
| **Configurações** | `Settings.tsx`, `SubscriptionCenter.tsx`, `AuditDashboard.tsx` | Perfil, PACS, LAUD.IA, **Assinatura** | — |
| **Admin** | ver §7 do doc + Admin.tsx | Painel completo | role `admin` |
| **LAUD.IA (admin)** | `SharedLaudIA.tsx` | Treino/config da IA | role `admin` |
| **Export** | `ReportDocument.tsx`, `printReport.ts` | PDF (paged.js) + Google Docs | — |

### 4.1 Editor de Laudo (núcleo)
- **`ExamEditor.tsx`** (orquestrador) + **`RichEditor.tsx`** (Tiptap) + **`LaudCopilot.tsx`** (chat de refino).
- **Componentes:** `EditorHeader`, `EditorToolbar`, `DicomViewerSidebar`, `DicomThumbnail`, `DicomImagesModal` (PDF das imagens), `ReportQualityPanel` (avaliação anti-alucinação), `ReportVersionsModal` (diff/rollback), `AnamnesisConsentModal`, `ExamHistoryModal`.
- **Hooks:** `useExamActions` (salvar/finalizar/reabrir), `useDicomSync` (busca estudos/imagens no PACS com polling+cache), `useCopilotSuggestions` (sugestões via Gemini), `useGoogleDocs` (export Google Docs), `useVoiceAnalyzer` (**ditado por voz** via SpeechRecognition).
- **Funcionalidades:** geração IA (`generation`), refino (`refine`), copiloto (`copilot`); export PDF (laudo + imagens em grades) e Google Docs; versões; anamnese; termo de consentimento (assinatura); qualidade/anti-alucinação.

### 4.2 Componentes globais notáveis
`CommandPalette` (navegação ⌘K), `OnboardingScreen` + `SetupChecklist` (primeiro acesso), `SupportCenterModal` (abrir ticket), `BroadcastBanner` (avisos globais do admin), `ClinicSessionModal` (clínica ativa), `PWAUpdatePrompt`, `OfflineBanner`, `ErrorBoundary`, `FeatureLocked` (paywall), `PricingPlans` (vitrine pública).

---

## 5. Sistema de IA (LAUD.IA)

**Provedor:** **Google Gemini apenas** (Anthropic removido). Fonte única de modelos em `ai/engine.ts`:
- **Lite** = `gemini-3.5-flash` · **Pro** = `gemini-3.1-pro-preview`.
- `resolveGeminiModel()` nunca emite IDs mortos (2.5/1.5 → normaliza).

**Motor (`ai/engine.ts`):**
- Modos: `generation | refine | copilot | template`; `detectMode()` decide.
- **Temperatura adaptativa** por modo; `maxTokens` por área.
- **Cota:** valida `reportsUsedThisMonth >= reportsQuota` no cliente (engine) e no servidor (`/api/gemini`, modo `generation`).
- **Telemetria:** `recordMetrics()` grava `users/{uid}/ai_usage` (modelo, tokens, custo, área) por evento.
- **Provider (`providers/GeminiProvider.ts`):** `generate`/`stream`/`extractJson`; envia token + `x-gemini-mode`.

**Prompts (`ai/prompts/`):** camadas mestre/global/estrutura/regras + `areaPrompts.ts` (por especialidade) + `template.ts`.

**Treino & avaliação (`ai/training/`):** golden dataset, evaluator, harness de evals, retrieval few-shot (`augment`/`retrieval`/`embeddings`), corpus de excelência, anonimização (`anonymize` → `scrubForGeneration`), feedback store, métricas de qualidade, experimentos. Painel **LAUD.IA** (admin) opera isso.

---

## 6. PACS/DICOM gerenciado (multi-tenant self-service)

**Arquitetura (VM-first):** Orthanc + Agente rodam numa **VM na nuvem** (Google Cloud); a clínica só mantém um **relé Tailscale** (roteador GL.iNet ou PC). O **ultrassom não precisa de Tailscale**; o **navegador do médico também não** (usa o Funnel HTTPS).

**Modelos de instância (por plano):**
- **Starter / Pro:** *tenant* numa **VM compartilhada** (isolamento por `tenantId`).
- **Dedicado:** **VM própria** provisionada.

**Provisão self-service (`api/pacs-provision.ts`, `MyPacsCard.tsx`, `UltrasoundSetupCard.tsx`):**
1. Usuário escolhe o plano → `POST /api/pacs-provision`.
2. **Modo real (GCP):** cria **auth-key Tailscale** + **VM no Google Cloud** com *startup-script* (Docker+Orthanc, Tailscale, Agente, `tailscale funnel`). Retorna `agentUrl`, `agentSecret`, `tenantId`.
3. **Modo mock** (sem env): simula a criação (tenant/VM fake) para desenvolvimento.
4. Cliente faz **polling de saúde** do Agente até responder; `MyPacsCard` mostra **uso de disco real**, versão do Orthanc, status.
5. `settings.pacsInstance` guarda o estado (`PacsInstanceStatus`: none/provisioning/ready/error/suspended).

**Fluxo de dados:** LAUD.US → Agente grava `.wl` → Orthanc oferece worklist (4242) → aparelho lê e faz o exame → envia imagens (C-STORE 4242) → Orthanc guarda → LAUD.US busca imagens (8042) pelo proxy do Agente (Funnel HTTPS) e mostra no laudo.

**Componentes:**
- **Agente Local (`scripts/agent.js`):** grava worklists (`generate_wl.py`/pydicom) e faz proxy REST do Orthanc (`/api/orthanc-proxy`). Segredo por-usuário (`x-agent-secret`), anti-SSRF (`ALLOWED_HOSTS`), **multi-tenant** via `tenantId` (query).
- **Proxies Vercel** (`/api/worklist`, `/api/orthanc-proxy`): auth JWKS + **entitlement PACS** (`_entitlements.ts`); encaminham ao Agente.
- **Painel (`DicomControlCenter.tsx`):** presets (Nuvem/Local), guia passo a passo, aba **Armazenamento & Exames** (estatísticas do Orthanc).

---

## 7. Modelo de dados (Firestore)

### Coleções raiz (globais)
| Coleção | Conteúdo | Read | Write |
|---|---|---|---|
| `users/{uid}` | `name,email,role`, `subscriptionStatus/subscriptionId`, `reportsQuota/UsedThisMonth`, `clinicsQuota`, `tokenQuota*`, `motorProEnabled`, `active`, `createdAt`, `licenseExpiresAt` | dono/admin | dono (exceto campos protegidos) / admin |
| `subscriptions/sub_{uid}` | `plan,planId`, `addons[]`, `status`, `reportsQuota`, `currentPeriod*`, `trialEndsAt`, `abacatePaySubscriptionId` | dono/admin | admin / Admin SDK |
| `saas_plans/{id}` | Catálogo: `name,price,interval,description,featured,active`, `reportsQuota,clinicsQuota,tokenQuota*`, `includesCalculators/Pacs/Appointments/Clinics`, `motorProDefault`, `trialDays` | **público** | admin |
| `transactions/{id}` | `userId,userEmail`, `type(subscription/addon)`, `description`, `amount`, `status(paid/failed/refunded)`, `paymentMethod`, `timestamp` | admin / **dono (próprias)** | Admin SDK |
| `support_tickets/{id}` | `subject,message,status,priority`, `messages[]`, `adminNotes[]`, `category`, `rating` | dono/admin | dono cria; admin gerencia |
| `audit_logs/{id}` | `userId,userName,action,details,module,timestamp` | admin | dono cria (autoria própria) |
| `metrics_daily/{YYYY-MM-DD}` | `reports,reportsLite/Pro,inputTokens,outputTokens,costUsd,revenue,activeUsers`; doc `_summary`: `mrr,arr,activeSubscribers,trials` | admin | Admin SDK (CRON) |
| `global_config/{doc}` | `admin_settings` (prompts/config), `addons_config`, `pricing_config`, `abacatepay_config`, `finance_stats` (totalRevenue/paidCount/…) | logado | admin |
| `system/{doc}` | Broadcast/mensagens de sistema | logado | admin |

### Subcoleções por usuário — `users/{uid}/…`
`settings/app` (config do app/PACS) · `templates` (máscaras) · `exams` · `patients` · `clinics` · `appointments` · `ai_usage` (telemetria por evento). **Máscaras do admin** (sistema) são legíveis por todos os autenticados.

### Campos protegidos de `users/{uid}`
Só admin/Admin SDK altera: `role, motorProEnabled, reportsQuota, clinicsQuota, subscriptionStatus, subscriptionId, licenseExpiresAt, active, addons, createdAt, email`. O dono só **incrementa** `reportsUsedThisMonth`.

### Índices
- Compostos: `exams(clinicId,createdAt)`, `exams(patientId,createdAt)`, `excellence_corpus(area,approvedAt)`.
- **Collection-group:** `ai_usage.timestamp` (usado pelo CRON de agregação).

---

## 8. Sistema de planos, add-ons & cobrança

### Planos (`saas_plans`)
Cada plano define preço/intervalo, **cotas** (`reportsQuota`, `clinicsQuota`, tokens Lite/Pro), quais **add-ons** inclui (`includesX`), Motor Pro padrão e `trialDays`.

### Add-ons (catálogo)
| Add-on | Preço padrão | Libera |
|---|---|---|
| `pacs` | (definido no plano) | PACS/DICOM |
| `calculators` | R$ 49 | Calculadoras clínicas |
| `appointments` | R$ 39 | Agendamentos |
| `clinics` | R$ 49 | Múltiplas clínicas |
| `token_lite` | R$ 9,90 (50) | Pacote de laudos Lite |
| `token_pro` | R$ 24,90 (20) | Pacote de laudos Pro |
| `extra_reports` | R$ 1,50 | Laudos extras avulsos |
| `extra_clinic` | R$ 29 | Clínica extra |

Fallbacks em `api/_pricing.ts`; valores reais em `global_config/addons_config` (admin).

### Direitos (`useSubscription`)
Deriva no cliente: `isActive/isTrialing/isPastDue/isCanceled`, `hasPacs/hasCalculators/hasAppointments/hasClinics`, `reportsRemaining`, `canGenerateReport`, `motorOptions`. **Trial:** 14 dias a partir de `createdAt` (100 laudos, sem add-ons pagos). **Admin:** tudo liberado.

### Enforcement (gating) — em 3 camadas
1. **Navegação:** Sidebar/BottomNav escondem módulos sem add-on.
2. **Paywall:** `FeatureLocked` bloqueia o módulo (Calculadoras/PACS/Clínicas/Agendamentos) com CTA.
3. **Servidor:** `/api/worklist` e `/api/orthanc-proxy` exigem add-on PACS; `/api/gemini` (modo `generation`) exige assinatura ativa + cota — **fail-open**.

### AbacatePay (pagamentos)
- **Vitrine pública** (`PricingPlans.tsx`): planos antes do login → cadastro.
- **Checkout** (`/api/abacatepay-checkout`): plano ou add-on → URL de pagamento (autenticado + posse). `returnUrl` → aba de assinatura.
- **Webhook** (`/api/abacatepay-webhook`): concede plano/add-on (mapeia `includesX` → `addons[]`; aplica cotas/pacotes de token), registra `transactions`, agrega receita em `finance_stats` (best-effort), assina com HMAC (`safeEqual`).
- **Cancelamento** (`/api/abacatepay-cancel`): dono ou admin; cancela no gateway + status `canceled` local (acesso até o fim do período).
- **Sem portal de cliente** (AbacatePay não tem): comprovantes por e-mail; histórico de pagamentos do próprio usuário na aba de Assinatura.
- **Teste de chave** (`/api/abacatepay-test`): admin-only.

---

## 9. Segurança, RBAC & LGPD

- **Auth:** Firebase (Google + e-mail/senha). Todo acesso exige login (exceto vitrine de planos).
- **RBAC:** `admin | medico | recepcao`. **Privilégio de admin só por `users/{uid}.role`** (campo protegido) — `useAdmin` não confia em `settings.currentRole`; `Admin.tsx` tem guarda própria; super-admin por e-mail.
- **Firestore rules (13 `match`):** default-deny; impedem escalonamento de privilégio, inflar cota, auto-conceder add-ons; contador de uso só cresce; `transactions`/`metrics_daily` restritos; webhooks usam Admin SDK (ignoram rules).
- **Endpoints:** auth JWKS (Edge/serverless); rate-limit no `gemini`; `safeEqual` (timing-safe) em segredos; entitlement server-side (PACS + cota) **fail-open**; `promote-admin` com trava tripla.
- **Segredos:** `.env` gitignored; chaves só em env da Vercel; senhas PACS e segredo do Agente **criptografados por-usuário** (`crypto.ts`); anti-SSRF no Agente.
- **LGPD/CFM:** trilha de acesso a paciente (`logPatientAccess`), pseudonimização nos prompts (`scrubForGeneration`), consentimento no editor.
- **Monitoramento:** Sentry (opt-in por DSN); **aba Saúde** (admin) com status real.

---

## 10. API / Endpoints (`api/`)

| Endpoint | Runtime | Auth | Função |
|---|---|---|---|
| `gemini.ts` | **Edge** | JWKS + rate-limit + **cota** | Proxy Gemini (generate/stream/embed) |
| `worklist.ts` | Node | JWKS + **entitlement PACS** | Grava `.wl` / encaminha ao Agente (multi-tenant) |
| `orthanc-proxy.ts` | Node | JWKS + **entitlement PACS** | Proxy REST do Orthanc (imagens) |
| `pacs-provision.ts` | Node | auth + posse | Provisiona VM/tenant (GCP+Tailscale) ou mock |
| `abacatepay-checkout.ts` | Node | `verifyAuth` + posse | Inicia checkout (plano/add-on) |
| `abacatepay-webhook.ts` | Node | HMAC `safeEqual` | Concede compra + registra transação + agrega receita |
| `abacatepay-cancel.ts` | Node | dono/admin | Cancela assinatura (gateway + local) |
| `abacatepay-test.ts` | Node | **admin** | Testa chave AbacatePay |
| `reset-monthly-reports.ts` | Node | CRON_SECRET / auth | Reset mensal de cota |
| `cron-aggregate-metrics.ts` | Node | CRON_SECRET | Agrega `metrics_daily` (uso+receita) + MRR/ARR |
| `promote-admin.ts` | Node | super-admin (trava tripla) | Promove o super-admin |
| `health.ts` | Node | — | Health-check |
| **Helpers** | — | — | `_auth`, `_edgeAuth` (JWKS), `_firebase` (Admin SDK), `_secure` (safeEqual), `_pricing`, `_entitlements` |

**Crons (`vercel.json`):** `reset-monthly-reports` (03:00 diário) · `cron-aggregate-metrics` (03:30 diário). *Plano Hobby limita a 1×/dia; no Pro, voltar `cron-aggregate-metrics` para horário (`10 * * * *`).*

---

## 11. Integrações externas
- **Google Gemini** — IA (server-side, `GOOGLE_API_KEY`).
- **AbacatePay** — pagamentos (checkout/webhook/cancel).
- **Google Cloud** — provisão de VM PACS (`pacs-provision`).
- **Tailscale** — VPN/Funnel do PACS.
- **Google Docs/Drive/Picker** (`lib/google*`) — export do laudo para Google Docs, seleção de arquivos.
- **Sentry** — monitoramento de erros (opt-in).

---

## 12. Deploy, operações & variáveis de ambiente

### Vercel (frontend + serverless)
- Deploy automático a cada push na `main`; build `tsc && vite build`.
- **`vercel.json`** declara `functions` (todo `api/*.ts` referenciado **deve existir** — remover órfãos senão o build quebra) e `crons` (diários no Hobby).

### Firebase
- `firebase deploy --only firestore:rules,firestore:indexes` após mudar regras/índices (ex.: leitura pública de `saas_plans`, histórico de pagamentos, `metrics_daily`, índice collection-group de `ai_usage` — que leva alguns minutos para construir).

### Pós-deploy (uma vez)
1. Admin → Financeiro → **"Recalcular métricas"** (semeia `finance_stats` e `_summary`).
2. Aguardar o 1º CRON (03:30) ou uso de IA para popular `metrics_daily`.

### Variáveis de ambiente
- **Cliente (VITE_):** `VITE_FIREBASE_*`, `VITE_ADMIN_UID/EMAIL`, `VITE_SENTRY_DSN`, `VITE_ENVIRONMENT`, `VITE_PUBLIC_URL`.
- **Servidor:** `GOOGLE_API_KEY`; `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (Admin SDK); `ABACATEPAY_API_KEY/WEBHOOK_SECRET`; `CRON_SECRET`.
- **PACS provision:** credenciais GCP (service account) + Tailscale (auth-key/tag) — quando ausentes, `pacs-provision` opera em **mock**.
- **Agente PACS (`scripts/agent.js`):** `LAUDUS_AGENT_SECRET`, `LAUDUS_WORKLIST_DIR`, `LAUDUS_ALLOWED_HOSTS`, `PORT`.

---

## 13. Fluxos de ponta a ponta

**A. Visitante → cliente pagante**
Vitrine de planos (pré-login) → "Começar" → **cadastro** → trial 14d → Centro de Assinatura → **checkout AbacatePay** → webhook concede (add-ons/cota) → `useSubscription` reflete via snapshot → módulos liberam.

**B. Exame → laudo → PDF**
Agenda/Worklist cria exame → (PACS) worklist ao aparelho → imagens recebidas → Editor gera laudo IA (**cota checada no servidor**) → refino/copiloto → qualidade/anti-alucinação → export **PDF** (laudo + imagens) ou **Google Docs** → finaliza (remove `.wl`).

**C. Provisão do PACS**
Escolhe plano PACS → `/api/pacs-provision` (VM/tenant) → polling de saúde do Agente → `pacsInstance = ready` → aparelho aponta para o relé → imagens fluem.

**D. Telemetria → decisão**
Cada geração grava `ai_usage` → CRON diário agrega `metrics_daily`/`_summary` → Admin (Analytics/Saúde/Usuários/Financeiro) lê os agregados (MRR/ARR, laudos/dia, custo, receita).

---

## 14. Testes & qualidade
- **188 testes (Vitest, 12 arquivos):** calculadoras, classificadores, motor de IA, verificação/evolução/aprendizado/treino, segurança (`safeEqual`), preços (`_pricing`), roteamento PACS + multi-tenant + `resolveGeminiModel`.
- **Gate de build:** `tsc && vite build`. CI (GitHub Actions).
- **Dívida conhecida:** ~225 `any`, arquivos > 1.000 L, bundle `vendor-ui` ~1 MB. Roadmap: [PLANO_REFINAMENTO.md](PLANO_REFINAMENTO.md).

---

## 15. Glossário
**Add-on** — recurso pago avulso. **Orthanc** — servidor PACS. **Worklist** — lista de exames que o aparelho lê (`.wl`). **Agente** — programa que grava `.wl` e faz proxy do Orthanc. **Tenant** — instância isolada numa VM compartilhada (`tenantId`). **Tailscale/Funnel** — VPN privada + endereço HTTPS público. **MRR/ARR** — receita recorrente mensal/anual. **Entitlement** — direito de uso derivado do plano. **Fail-open** — se a checagem falha, libera (não derruba pagante). **Collection-group query** — consulta sobre todas as subcoleções de mesmo nome (ex.: `ai_usage`).

---
*Documentação oficial v2. Detalhamento de pendências e roadmap nos documentos complementares.*
