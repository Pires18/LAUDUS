# 📘 Documentação Oficial — LAUD.US

**Plataforma de laudos ultrassonográficos com IA, PACS/DICOM gerenciado e SaaS de assinatura.**
Versão do documento: 2026-07-05 (v3 — produção multi-usuário, LGPD/CFM, landing institucional) · Ambiente: produção (Vercel + Firebase).

**Status:** vivo · **Complementares:** [Arquitetura](../src/ARCHITECTURE.md) · [Auditoria Completa](AUDITORIA_COMPLETA_2026-07.md) · [Auditoria Integrações/Financeiro](AUDITORIA_INTEGRACOES_FINANCEIRO_2026-07.md) · [Plano de Refinamento](PLANO_REFINAMENTO.md) · [Plano Final de Produção](PLANO_FINAL_PRODUCAO_2026-07.md) · [Política de Retenção LGPD](LGPD_POLITICA_RETENCAO.md) · [Termos de Uso](legal/TERMOS_DE_USO.md) · [Política de Privacidade](legal/POLITICA_DE_PRIVACIDADE.md) · [Pacote de Revisão Jurídica](legal/PACOTE_REVISAO_JURIDICA.md) · [Projeto PACS Nuvem](pacs/PROJETO_PACS_NUVEM.md) · [PACS Tenant Setup](pacs/PACS_TENANT_SETUP.md) · [PACS Provision Setup](pacs/PACS_PROVISION_SETUP.md) · [PACS Manual](pacs/PACS_MANUAL.md).

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
15. Controle financeiro (Admin)
16. Multi-usuário e equipes de clínica (estado atual)
17. Pendências conhecidas
18. Glossário

---

## 1. Visão geral & proposta de valor

O LAUD.US é um **PWA** que cobre o ciclo completo do laudo ultrassonográfico:
**agendar → gerar worklist no aparelho → receber imagens (PACS) → escrever o laudo com IA → revisar/refinar → exportar (PDF/Google Docs) → assinar.**

Sobre isso roda um **SaaS**: assinatura mensal/semestral/anual, add-ons pagos (PACS, Calculadoras, Agendamentos, Clínicas), cotas de laudos, cobrança via AbacatePay e um **painel administrativo** de operação (usuários, planos, financeiro MRR/ARR/reconciliação, telemetria, suporte, saúde).

Há também uma **landing page institucional separada** (`landing/`, site estático próprio, ver §2) para marketing/aquisição, distinta do app autenticado.

**Diferenciais técnicos:** IA server-side (Gemini) com rate limit distribuído, **PACS gerenciado por VM na nuvem** (provisão E desprovisão self-service — a VM/tenant é realmente destruída ao remover o PACS), telemetria persistente e agregada com reconciliação financeira (MRR teórico vs receita real, alerta de prejuízo por usuário), gating de features por plano (cliente + servidor), conformidade LGPD/CFM (Termos de Uso, Política de Privacidade, consentimento explícito no cadastro, política de retenção documentada).

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

**Roteamento (SPA, view-based, `App.tsx`):** sem React Router; um `view` no store define a tela. Módulos são **lazy-loaded** com `Suspense` e `ErrorBoundary` por rota. Pré-login → só `LoginScreen` (+ vitrine de planos pública + modal de Termos/Privacidade).

**Landing institucional (`landing/`):** projeto **separado**, HTML/CSS puro (sem framework, sem build), deploy independente na Vercel (domínio/subdomínio próprio, ex. `laudus.com.br` apontando para o marketing enquanto o app fica em outro domínio). Hero, funcionalidades, planos, FAQ e páginas públicas de Termos/Privacidade; CTAs apontam para a URL do app (constante `APP_URL` em `landing/index.html`).

**Rate limit distribuído (`api/_rateLimit.ts`):** `/api/gemini` usa Vercel KV/Upstash Redis via REST (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) quando configurado; cai para memória local por instância como fallback (funciona, mas não é compartilhado entre instâncias Edge).

---

## 3. Estrutura do repositório

```
src/
  App.tsx                  # bootstrap, auth listener, roteamento view-based, guards
  main.tsx                 # entrypoint, initSentry, PWA
  store/
    app.ts                 # Zustand: user, profile, settings, view, clínica ativa
    db.ts                  # acesso Firestore (user-scoped + global), settings, migrações,
                           #   helpers PACS (getActivePacsUrl/getProxyEndpoint/…), métricas,
                           #   uso de IA agregado (getAllUsersAiUsageStats/groupAiUsageByUser)
    adminUsers.ts          # ações admin sobre usuários (role/status/delete)
  hooks/
    useAuth (+ resetPassword/resendVerificationEmail) · useSubscription · useAdmin · useConfirm · useFirestore
  lib/
    firebase · authToken · sentry · crypto · googleAuth · googleDocs · googleDrive · googlePicker
    legalConsent.ts        # ponte (localStorage) entre aceite de termos no cadastro e criação do doc do usuário
  components/              # UI compartilhada — Sidebar, Modal, ConfirmDialog, FeatureLocked,
                           #   PricingPlans, LoginScreen, CommandPalette, LegalModal,
                           #   EmailVerificationBanner, ClinicTeamCard, …
  modules/                 # 14 domínios (ver §4)
  test/                    # 13 arquivos, 218 testes (Vitest)
api/                       # 12 funções serverless (teto do plano Hobby da Vercel — ver §12)
                           #   + helpers _auth,_edgeAuth,_firebase,_secure,_pricing,_entitlements,_rateLimit
scripts/agent.js           # Agente Local do PACS (worklist + proxy Orthanc + DELETE de tenant compartilhado)
scripts/generate_wl.py     # gera arquivos .wl (pydicom)
public/                    # favicon.svg + icons/*.png (marca padrão) + manifest
docs/                      # documentação: DOCUMENTACAO_OFICIAL (este) + legal/ (Termos/Privacidade)
                           #   + roadmaps/ (specs pendentes) + pacs/ (arquitetura/manuais PACS)
                           #   + archive/ (planos/auditorias históricas, já concluídos)
landing/                   # site institucional separado (HTML/CSS puro, deploy Vercel independente)
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
| **Clínicas** | `Clinics.tsx`, `ClinicDetail`, `ClinicForm`, `ClinicTeamCard` | Múltiplas clínicas, cabeçalhos de laudo por unidade, **convite de equipe** (ver §16) | add-on `clinics` |
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
`CommandPalette` (navegação ⌘K), `OnboardingScreen` + `SetupChecklist` (primeiro acesso), `SupportCenterModal` (abrir ticket), `BroadcastBanner` (avisos globais do admin), `ClinicSessionModal` (clínica ativa), `PWAUpdatePrompt`, `OfflineBanner`, `EmailVerificationBanner` (exige confirmação de e-mail antes de gerar laudos com IA, contas e-mail/senha), `ErrorBoundary`, `FeatureLocked` (paywall), `PricingPlans` (vitrine pública), `LegalModal` (Termos de Uso/Política de Privacidade, também usado no cadastro).

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

**Desprovisão real (`DELETE /api/pacs-provision`):** o botão "Remover PACS" não apenas limpa o Firestore — **destrói de fato** a infraestrutura: VM dedicada via GCP Compute API (`instances.delete`) ou tenant na VM compartilhada via endpoint `DELETE /api/admin/tenant/:id` no Agente (`scripts/agent.js`, roda `pacs-tenant.sh remove`). A destruição em si mora em `api/_pacsLifecycle.ts` (helper compartilhado, não conta como função serverless própria). **Atenção operacional:** o Agente da VM compartilhada precisa estar rodando a versão atualizada de `agent.js` para que o endpoint DELETE exista — o Agente se auto-atualiza no boot, mas não em quente; se a VM compartilhada não for reiniciada após esta mudança, a desprovisão de tenants falha com erro claro (não silenciosamente).

**Lifecycle automático por cancelamento (`api/reset-monthly-reports.ts`, CRON diário):** quando a assinatura de um usuário vira `canceled`/`expired` e ele tem PACS `ready`, o CRON marca `pacsInstance.status = 'suspended'` com `scheduledDeletionAt` = agora + **14 dias de período de graça** (`MyPacsCard.tsx` mostra contagem regressiva + CTA "Reativar assinatura agora"). Se a assinatura for reativada dentro do prazo, o CRON desfaz a suspensão automaticamente. Se o prazo vencer e a assinatura continuar cancelada/expirada, o CRON chama `destroyPacsInstance()` (mesmo helper do botão manual) e zera o estado local. Sem isso, VMs de assinantes cancelados ficariam rodando (e sendo cobradas) indefinidamente.

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
| `users/{uid}` | `name,email,role`, `subscriptionStatus/subscriptionId`, `reportsQuota/UsedThisMonth`, `clinicsQuota`, `tokenQuota*`, `motorProEnabled`, `active`, `createdAt`, `licenseExpiresAt`, `termsAcceptedAt/termsVersion` (cadastro por e-mail/senha) | dono/admin | dono (exceto campos protegidos) / admin |
| `subscriptions/sub_{uid}` | `plan,planId`, `addons[]`, `status(active/past_due/expired/canceled)`, `reportsQuota`, `currentPeriod*`, `interval(month/semester/year)`, `price`, `trialEndsAt`, `abacatePaySubscriptionId` | dono/admin | admin / Admin SDK |
| `clinic_memberships/{ownerId}_{clinicId}_{memberUid}` | Equipe de clínica: `ownerId,clinicId,memberUid,memberEmail,role(editor/viewer),invitedByUid,createdAt` | dono da clínica, o próprio membro, ou admin | **criação só pelo servidor** (`api/clinic-invite.ts`, resolve e-mail→uid); remoção pelo dono, pelo próprio membro, ou admin |
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
- Compostos: `exams(clinicId,createdAt)`, `exams(patientId,createdAt)`, `excellence_corpus(area,approvedAt)`, `clinic_memberships(ownerId,clinicId)`.
- **Collection-group:** `ai_usage.timestamp` (usado pelo CRON de agregação e por `getAllUsersAiUsageStats`, admin-only).

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

### Expiração de assinatura (`api/reset-monthly-reports.ts`, CRON diário)
Quando `currentPeriodEnd` vence com status `active`/`past_due`:
- **Recorrente (`interval === 'year'`):** vira `past_due` (grace period — aguarda retry/webhook da AbacatePay).
- **Avulso (`month`/`semester`, sem cobrança futura):** vira `expired` — `evaluateReportQuota` (`api/_quota.ts`) bloqueia geração de laudos.
- **`interval` ausente** (assinatura antiga, criada antes deste campo existir): tratado como **recorrente por padrão** — mais seguro errar mantendo acesso do que cortar assinante anual pago por engano.

### AbacatePay (pagamentos)
- **Vitrine pública** (`PricingPlans.tsx`): planos antes do login → cadastro (com aceite obrigatório de Termos/Privacidade).
- **Checkout** (`/api/abacatepay-checkout`): plano ou add-on → URL de pagamento (autenticado + posse). `returnUrl` → aba de assinatura. Também expõe `action:'test-key'` (admin-only, testa a chave da AbacatePay — consolidado aqui para caber no teto de 12 funções do plano Hobby, ver §12).
- **Webhook** (`/api/abacatepay-webhook`): concede plano/add-on (mapeia `includesX` → `addons[]`; aplica cotas/pacotes de token), grava `interval`/`price` no doc da assinatura (usado pela expiração acima), registra `transactions`, agrega receita em `finance_stats` (best-effort), assina com HMAC (`safeEqual`).
- **Cancelamento** (`/api/abacatepay-cancel`): dono ou admin; cancela no gateway + status `canceled` local (acesso até o fim do período).
- **Sem portal de cliente** (AbacatePay não tem): comprovantes por e-mail; histórico de pagamentos do próprio usuário na aba de Assinatura.

---

## 9. Segurança, RBAC & LGPD

- **Auth:** Firebase (Google + e-mail/senha). Todo acesso exige login (exceto vitrine de planos e landing institucional). Contas por e-mail/senha exigem **e-mail verificado** para gerar laudos com IA (`sendEmailVerification`, checado server-side em `/api/gemini` via claim `email_verified` do token — contas Google já chegam verificadas). "Esqueci minha senha" via `sendPasswordResetEmail`.
- **RBAC:** `admin | medico | recepcao`. **Privilégio de admin só por `users/{uid}.role`** (campo protegido) — `useAdmin` não confia em `settings.currentRole`; `Admin.tsx` tem guarda própria; super-admin por e-mail.
- **RBAC de clínica (equipe multiusuário) — implementado:** `clinic_memberships` permite convidar um segundo usuário (papel `editor`/`viewer`) para colaborar numa clínica (`ClinicTeamCard.tsx` + `api/clinic-invite.ts`). Regras do Firestore validam acesso a `clinics`/`patients`/`exams`/`appointments` por membership, **incluindo proteção contra um editor reatribuir `clinicId` de um registro para fora da clínica dele** (o `update` exige que `clinicId` não mude — só dono/admin podem reclassificar). A camada de dados do cliente (`useFirestore.ts`/`db.ts`) redireciona corretamente para a subárvore do dono via `resolveOwnerUid` (`store/clinicAccess.ts`) — um membro convidado já visualiza/edita os dados do dono pela UI dentro do contexto da clínica ativa (ver §16 para detalhes e limitações).
- **Firestore rules:** default-deny; impedem escalonamento de privilégio, inflar cota, auto-conceder add-ons; contador de uso só cresce; `transactions`/`metrics_daily` restritos; `clinic_memberships` só criado pelo servidor; webhooks usam Admin SDK (ignoram rules).
- **Endpoints:** auth JWKS (Edge/serverless); **rate-limit distribuído** no `gemini` (Vercel KV/Upstash, fallback em memória); `safeEqual` (timing-safe) em segredos; entitlement server-side (PACS + cota) **fail-open**; `promote-admin` com trava tripla.
- **Segredos:** `.env`/`.env.example` sem valores reais (chave privada do Firebase Admin SDK e chave Gemini que estavam commitadas em texto puro foram rotacionadas e revogadas em 05/07/2026); chaves só em env da Vercel; senhas PACS e segredo do Agente **criptografados por-usuário** (`crypto.ts`); anti-SSRF no Agente.
- **LGPD/CFM:** trilha de acesso a paciente (`logPatientAccess`), pseudonimização nos prompts (`scrubForGeneration`), consentimento no editor, **Termos de Uso e Política de Privacidade publicados** (`docs/legal/*.md`, modal no app, páginas públicas na landing) com **checkbox obrigatório e registro de aceite** (`termsAcceptedAt`/`termsVersion` em `users/{uid}`), **política de retenção documentada** (`docs/LGPD_POLITICA_RETENCAO.md` — prazos de guarda, pendências de expurgo/portal do titular). Assinatura digital ICP-Brasil: **desenho pronto, não implementada** (aguarda escolha de fornecedor — ClickSign/D4Sign — e credenciais do usuário; ver `docs/roadmaps/ASSINATURA_ICP_BRASIL.md`).
- **Monitoramento:** Sentry (opt-in por DSN); **aba Saúde** (admin) com status real.

---

## 10. API / Endpoints (`api/`)

| Endpoint | Runtime | Auth | Função |
|---|---|---|---|
| `gemini.ts` | **Edge** | JWKS + rate-limit distribuído + **cota** + e-mail verificado | Proxy Gemini (generate/stream/embed) |
| `worklist.ts` | Node | JWKS + **entitlement PACS** | Grava `.wl` / encaminha ao Agente (multi-tenant) |
| `orthanc-proxy.ts` | Node | JWKS + **entitlement PACS** | Proxy REST do Orthanc (imagens) |
| `pacs-provision.ts` | Node | auth + posse | `POST` provisiona VM/tenant (GCP+Tailscale) ou mock; **`DELETE` desprovisiona de verdade** (destrói VM/tenant) |
| `abacatepay-checkout.ts` | Node | `verifyAuth` + posse (ou admin p/ `test-key`) | Inicia checkout (plano/add-on); `action:'test-key'` testa chave AbacatePay (admin) |
| `abacatepay-webhook.ts` | Node | HMAC `safeEqual` | Concede compra + grava `interval`/`price` + registra transação + agrega receita |
| `abacatepay-cancel.ts` | Node | dono/admin | Cancela assinatura (gateway + local) |
| `clinic-invite.ts` | Node | dono da clínica/admin | Convida usuário (por e-mail) para `clinic_memberships` |
| `reset-monthly-reports.ts` | Node | CRON_SECRET / auth | Reset mensal de cota + expiração de assinatura (past_due/expired) |
| `cron-aggregate-metrics.ts` | Node | CRON_SECRET | Agrega `metrics_daily` (uso+receita) + MRR/ARR |
| `promote-admin.ts` | Node | super-admin (trava tripla) | Promove o super-admin |
| `health.ts` | Node | — | Health-check |
| **Helpers** | — | — | `_auth`, `_edgeAuth` (JWKS), `_firebase` (Admin SDK), `_secure` (safeEqual), `_pricing`, `_entitlements`, `_rateLimit` (KV) |

**⚠️ Teto do plano Hobby da Vercel:** exatamente **12 funções** acima = o limite do plano. `api/abacatepay-test.ts` e `api/pacs-deprovision.ts` foram **consolidados** dentro de `abacatepay-checkout.ts` (via `action` no corpo) e `pacs-provision.ts` (via método `DELETE`) especificamente para caber nesse teto — a próxima função nova quebra o deploy a menos que outra seja consolidada ou o projeto suba para o plano Pro.

**Crons (`vercel.json`):** `reset-monthly-reports` (03:00 diário) · `cron-aggregate-metrics` (03:30 diário). *Plano Hobby limita a 1×/dia; no Pro, voltar `cron-aggregate-metrics` para horário (`10 * * * *`).*

---

## 11. Integrações externas
- **Google Gemini** — IA (server-side, `GOOGLE_API_KEY`); custo por chamada gravado em `ai_usage` (tokens + `costUsd`).
- **AbacatePay** — pagamentos (checkout/webhook/cancel); webhook valida HMAC-SHA256 + idempotência (`webhook_events`); mock bloqueado em produção.
- **Google Cloud** — provisão **e desprovisão** de VM PACS (`pacs-provision.ts`, `POST`/`DELETE`). **Não integrado:** monitoramento de custo/billing real do GCP no Admin — o custo de VM exibido no painel Financeiro é uma estimativa por tabela de preço fixa (plano × disco), não a fatura real da nuvem.
- **Tailscale** — VPN/Funnel do PACS; auth-keys pré-autorizadas geradas por VM/tenant.
- **Google Docs/Drive/Picker** (`lib/google*`) — export do laudo para Google Docs, seleção de arquivos; refresh silencioso de token OAuth com fallback interativo.
- **Sentry** — monitoramento de erros (opt-in por DSN), com redação de PII (e-mail/CPF/telefone) antes do envio.
- **Vercel KV / Upstash Redis** (opcional) — rate limit distribuído do `/api/gemini`.

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
- **Cliente (VITE_):** `VITE_FIREBASE_*`, `VITE_ADMIN_UID/EMAIL`, `VITE_SENTRY_DSN`, `VITE_ENVIRONMENT`, `VITE_PUBLIC_URL`, `VITE_ORTHANC_WORKLIST_DIR`, `VITE_PYTHON_PATH` (dev local do PACS), `VITE_PACS_PROVISION_ENDPOINT`.
- **Servidor:** `GOOGLE_API_KEY`; `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (Admin SDK); `ABACATEPAY_API_KEY/WEBHOOK_SECRET`; `CRON_SECRET`; `KV_REST_API_URL/TOKEN` (rate limit distribuído, opcional).
- **PACS provision:** `GCP_PROJECT_ID`, `GCP_SA_KEY`, `GCP_ZONE`, `PACS_MOCK`, `PACS_IMAGE`, `PACS_SCRIPTS_URL`, `TAILSCALE_API_KEY/TAILSCALE_TAILNET/TAILSCALE_TS_NET`, `PACS_SHARED_AGENT_URL`, `PACS_ADMIN_SECRET` — quando as credenciais GCP/Tailscale estão ausentes, `pacs-provision` opera em **mock**. Todas documentadas em `.env.example`.
- **Agente PACS (`scripts/agent.js`):** `LAUDUS_AGENT_SECRET`, `LAUDUS_WORKLIST_DIR`, `LAUDUS_ALLOWED_HOSTS`, `PORT`.

**⚠️ Segredos rotacionados em 05/07/2026:** `.env.example` chegou a ter, por engano, a private key real do Firebase Admin SDK e uma chave Gemini real commitadas em texto puro no histórico do git. Ambas foram revogadas no Firebase Console/GCP IAM e no Google AI Studio, e novas chaves foram geradas e aplicadas (Vercel + `.env` local). `.env.example` hoje só contém placeholders.

---

## 13. Fluxos de ponta a ponta

**A. Visitante → cliente pagante**
Landing institucional ou vitrine de planos (pré-login) → "Começar" → **cadastro** (checkbox obrigatório de Termos/Privacidade, e-mail de verificação enviado) → trial 14d → Centro de Assinatura → **checkout AbacatePay** → webhook concede (add-ons/cota, grava `interval`/`price`) → `useSubscription` reflete via snapshot → módulos liberam. Geração de laudos com IA exige e-mail confirmado (contas e-mail/senha).

**B. Exame → laudo → PDF**
Agenda/Worklist cria exame → (PACS) worklist ao aparelho → imagens recebidas → Editor gera laudo IA (**cota checada no servidor**) → refino/copiloto → qualidade/anti-alucinação → export **PDF** (laudo + imagens) ou **Google Docs** → finaliza (remove `.wl`).

**C. Provisão do PACS**
Escolhe plano PACS → `/api/pacs-provision` (VM/tenant) → polling de saúde do Agente → `pacsInstance = ready` → aparelho aponta para o relé → imagens fluem.

**D. Telemetria → decisão**
Cada geração grava `ai_usage` → CRON diário agrega `metrics_daily`/`_summary` → Admin (Analytics/Saúde/Usuários/Financeiro) lê os agregados (MRR/ARR, laudos/dia, custo, receita).

---

## 14. Testes & qualidade
- **218 testes (Vitest, 13 arquivos):** calculadoras, classificadores, motor de IA, verificação/evolução/aprendizado/treino, segurança (`safeEqual`), preços (`_pricing`), roteamento PACS + multi-tenant + `resolveGeminiModel`.
- **Gate de build:** `tsc && vite build`. CI (GitHub Actions).
- **Dívida conhecida:** ~225 `any`, arquivos > 1.000 L, bundle `vendor-ui` ~1 MB. Roadmap: [PLANO_REFINAMENTO.md](PLANO_REFINAMENTO.md).

---

## 15. Controle financeiro (Admin)

Painel **Financeiro** (`AdminFinanceiro.tsx`, 9 sub-abas: overview, plans, pacs-plans, vm-infra, features, extra-resources, abacatepay, ia-costs, transactions).

- **Central Financeira (`FinanceOverviewTab.tsx`):** MRR (teórico, agregado pelo CRON), receita real dos últimos 30 dias, custo de VMs (estimado) + custo de IA (real, via `ai_usage`), margem líquida.
- **Reconciliação MRR vs receita real:** alerta quando o MRR teórico diverge ≥20% da receita realmente cobrada nos últimos 30 dias — sinaliza possível assinatura `active` sem pagamento correspondente (falha de webhook, estorno não refletido).
- **Alerta de prejuízo por usuário:** compara o custo real de IA do mês de cada assinante (via `getAiUsageByUser`, collection-group `ai_usage`) com a receita mensal-equivalente do plano dele (`price / intervalMultiplier(interval)`); lista quem está dando prejuízo.
- **Top 10 consumidores de IA (`ia-costs`):** ranking por custo, com e-mail do usuário — corrige um bug em que o total de "Custos de IA" só refletia o próprio uso do admin (a função usada não fazia collection-group; hoje `getAllUsersAiUsageStats` cobre todos os usuários, restrito a admin pelas regras).
- **Fonte única de agregação por usuário:** `groupAiUsageByUser` (`store/db.ts`), usada tanto pelo ranking quanto pelo alerta de prejuízo, evita duas implementações divergentes do mesmo cálculo.
- **Não implementado:** integração com a Billing API real do Google Cloud (custo de VM é estimativa por tabela de preço, não a fatura real); lifecycle automático de VM disparado por cancelamento de assinatura (a desprovisão é manual, pelo botão do usuário — ver §6).

---

## 16. Multi-usuário e equipes de clínica (estado atual)

O modelo de dados é histórico **per-usuário** (`users/{uid}/{collection}/{doc}`) — cada usuário é dono de sua própria subárvore de pacientes/exames/clínicas/agenda. **Wiring multi-owner implementado em 05/07/2026** — um membro convidado agora vê e edita de verdade os dados da clínica compartilhada, não só a própria subárvore.

**Como funciona:**
- `useClinicMemberships` (montado uma vez em `App.tsx`) escuta `clinic_memberships` (filtrando por `memberUid == uid atual`) e popula `clinicOwnerMap` (clinicId → {ownerId, role}) no store `useApp`, espelhado também em `src/store/clinicAccess.ts` (módulo à parte, sem Zustand, para evitar import circular com `store/db.ts`).
- `useFirestore.ts` (`useCollection`/`useDocument`/`usePaginatedCollection`) e `store/db.ts` (`getCollectionRef`/`getDocRef`/`addItem`) resolvem o path físico (`users/{ownerUid}/...`) via `resolveOwnerUid()`: para `patients`/`exams`/`appointments`, usa a clínica **ativa** (`selectedClinicId`) ou o `clinicId` explícito do payload sendo criado; para `clinics`, só a leitura/edição de UMA clínica específica (por id) redireciona — a **lista** de clínicas nunca redireciona (sempre a própria, é o mecanismo de troca).
- `useAllAccessibleClinics()` mescla clínicas próprias + compartilhadas (leitura pontual dos docs compartilhados) para os seletores de clínica (`Sidebar`, `ClinicSessionModal`, `Clinics.tsx`, `CreateExamModal`), com selo "Editor"/"Leitura" visual.
- `ClinicDetail.tsx` força a clínica ativa (`selectedClinic`) quando a clínica aberta é compartilhada — não quando é própria, para não mudar o contexto global de quem não usa equipe multiusuário sem necessidade.
- `updateItem`/`deleteItem` (`db.ts`) aceitam um `explicitClinicId` opcional (mesmo padrão do `addItem`), para telas futuras que precisem editar um registro fora do contexto da clínica ativa sem depender só do ambiente.

**Limitação conhecida:** hoje não existe tela que mescle patients/exams/appointments de **múltiplos** owners numa lista só — o usuário opera dentro de UMA clínica ativa por vez (própria ou compartilhada), trocando pelo seletor. "Todas as clínicas" (`selectedClinicId = null`) continua significando "todas as MINHAS PRÓPRIAS clínicas", não uma mescla cross-owner.

---

## 17. Pendências conhecidas

| Item | Descrição | Bloqueador |
|---|---|---|
| Assinatura digital ICP-Brasil | Hoje só imagem de assinatura escaneada; sem valor jurídico pleno de laudo assinado | Escolha de fornecedor (ClickSign/D4Sign) + credenciais do usuário |
| Billing API do GCP no Admin | Custo de VM é estimativa, não a fatura real | Usuário habilitando a Cloud Billing API + permissão na service account (em andamento) |
| Teto de 12 funções serverless (Vercel Hobby) | Já no limite — próxima função nova quebra o deploy | Consolidar mais endpoints ou migrar para o plano Pro |
| Revisão jurídica dos Termos/Privacidade/Retenção | Pacote pronto em [`docs/legal/PACOTE_REVISAO_JURIDICA.md`](legal/PACOTE_REVISAO_JURIDICA.md) (8 pontos específicos + contexto) | Validação por advogado especializado em LGPD/saúde digital |

---

## 18. Glossário
**Add-on** — recurso pago avulso. **Orthanc** — servidor PACS. **Worklist** — lista de exames que o aparelho lê (`.wl`). **Agente** — programa que grava `.wl` e faz proxy do Orthanc. **Tenant** — instância isolada numa VM compartilhada (`tenantId`). **Tailscale/Funnel** — VPN privada + endereço HTTPS público. **MRR/ARR** — receita recorrente mensal/anual. **Entitlement** — direito de uso derivado do plano. **Fail-open** — se a checagem falha, libera (não derruba pagante). **Collection-group query** — consulta sobre todas as subcoleções de mesmo nome (ex.: `ai_usage`). **Clinic membership** — vínculo de um usuário convidado (não dono) a uma clínica, com papel `editor`/`viewer` (`clinic_memberships`). **Reconciliação financeira** — comparação entre receita/MRR teóricos e valores reais cobrados/consumidos, para detectar divergência.

---
*Documentação oficial v3. Detalhamento de pendências e roadmap nos documentos complementares.*
