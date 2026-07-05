# LAUD.US — Documentação Técnica Oficial do Sistema
**Versão:** 3.0 · **App:** v2.1.0 · **Data:** Junho 2026 · **Autor:** Análise Estrutural Claude Code

> Esta revisão substitui a v2.0 (19/06). Mudanças estruturais desde então: o **licenciamento por
> código** foi **removido** e substituído por **assinaturas recorrentes via AbacatePay** com quotas
> mensais; entrou o **módulo de treino/feedback de IA**; novos submódulos administrativos e de
> assinatura; criptografia das senhas DICOM no Firestore.

---

## 1. VISÃO GERAL

**LAUD.US** é um sistema profissional de laudos ultrassonográficos potencializado por IA, construído
como SPA + PWA. Cobre o fluxo clínico completo: agendamento → worklist → geração de laudo (IA) →
revisão → exportação (Google Docs / DOCX / impressão) → arquivamento PACS.

### 1.1 Identidade Técnica

| Atributo | Valor |
|---|---|
| Versão do app | 2.1.0 |
| Tipo | SPA + PWA (vite-plugin-pwa) |
| Frontend | React 18 + TypeScript 5.6 + Vite 6 |
| Estilo | Tailwind CSS 3.4 + PostCSS |
| Animações | Framer Motion 12 |
| Editor de texto | TipTap 2.x (ProseMirror) |
| Estado | Zustand 5 |
| Backend/DB | Firebase Firestore (NoSQL) + Firebase Admin (serverless) |
| Autenticação | Firebase Auth (Google OAuth) |
| Deploy | Vercel (Serverless Functions) |
| IA principal | Anthropic Claude — padrão `claude-sonnet-4-6` |
| IA alternativa | Google Gemini — padrão `gemini-2.5-flash` |
| Pagamentos | **AbacatePay** (assinatura recorrente + add-ons) |
| PACS | Orthanc Server (DICOM) via agente local + Tailscale |
| Integração docs | Google Docs / Google Drive |
| Exportação | DOCX (`docx`) + Print CSS |
| Testes | Vitest — **107 testes** · `tsc --noEmit`: **0 erros** |

---

## 2. ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────┐
│ CAMADA 1 — APRESENTAÇÃO (React)                                  │
│ App.tsx → AuthRouter → UserAccessGate → AuthenticatedApp        │
│ ViewRenderer (lazy): Dashboard, Worklist, ExamEditor, Patients, │
│ Appointments, Templates, Calculators, Clinics, Settings,        │
│ DICOM, LAUD.IA, Admin                                           │
├─────────────────────────────────────────────────────────────────┤
│ CAMADA 2 — LÓGICA (Hooks + Store)                               │
│ store/app.ts (Zustand) · store/db.ts (Firestore)               │
│ hooks: useFirestore, useSubscription, useAuth, useAdmin,        │
│        useConfirm                                               │
├─────────────────────────────────────────────────────────────────┤
│ CAMADA 3 — MOTOR DE IA (modules/ai)                            │
│ engine.ts → providers (Anthropic/Gemini) · prompts cascata 3   │
│ camadas · RAG clínico · training/ (few-shot, feedback, evals)  │
├─────────────────────────────────────────────────────────────────┤
│ CAMADA 4 — DADOS (Firestore)                                   │
│ user-scoped: users/{uid}/{exams,patients,templates,clinics,    │
│   appointments,settings,ai_usage}                              │
│ globais: users, plans, audit_logs, support_tickets,            │
│   transactions, system/broadcast, global_config/*              │
├─────────────────────────────────────────────────────────────────┤
│ CAMADA 5 — SERVERLESS (Vercel /api) + integrações externas     │
│ IA · PACS proxy · worklist · AbacatePay · Google Docs/Drive    │
├─────────────────────────────────────────────────────────────────┤
│ CAMADA 6 — PACS/DICOM (Orthanc + agente local + Tailscale)     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Estrutura de Diretórios (atual)

```
/src
  /components     — globais: Sidebar, BottomNav, CommandPalette, Toast,
                    LoginScreen, OnboardingScreen, ConfirmDialog,
                    BroadcastBanner, CreateExamModal, ClinicSessionModal,
                    SupportCenterModal, PWAUpdatePrompt, OfflineBanner,
                    ErrorBoundary, PageHeader, PageTransition, Modal, ...
  /modules
    /admin        — Admin.tsx + submodules: AdminUsersSubscriptions,
                    AdminFinanceiro, AdminAudit, AdminSupport, AdminMasks
                    (LAUD.IA reusa SharedLaudIA)
    /ai           — engine.ts, router.ts, motorProfiles.ts, generateTemplate.ts,
                    json.ts, verification.ts
      /providers  — AnthropicProvider, GeminiProvider
      /prompts    — general.ts, areaPrompts.ts, template.ts, index.ts
      /training   — augment, feedback, feedbackStore, excellenceCorpus,
                    goldenDataset, evaluator, harness, retrieval, embeddings,
                    qualityMetrics, experiment, anonymize, backfill, ...
    /appointments — Agenda
    /calculators  — 19 calculadoras + registry.tsx + CalculatorModal
    /clinics      — Clinics, ClinicDetail, ClinicForm
    /dashboard    — Dashboard
    /dicom        — DicomControlCenter (PACS / agente)
    /editor       — ExamEditor, LaudCopilot, RichEditor
      /components  — EditorHeader, EditorToolbar, DicomViewerSidebar,
                     DicomImagesModal, DicomThumbnail, ReportVersionsModal,
                     ReportQualityPanel, AnamnesisConsentModal, ExamHistoryModal
      /hooks       — useExamActions, useGoogleDocs, useDicomSync,
                     useVoiceAnalyzer, useCopilotSuggestions
    /export       — PrintLayout, PrintImagesLayout, docxExport
    /laud-ia      — LaudIA + SharedLaudIA + TrainingDashboard
    /patients     — Patients, PatientDetail
    /settings     — Settings, SubscriptionCenter, AuditDashboard
    /templates    — Templates, TemplateEditor
    /worklist     — Worklist
  /store          — app.ts, db.ts, adminUsers.ts
  /hooks          — useFirestore, useSubscription, useAuth, useAdmin, useConfirm
  /lib            — firebase, googleAuth, googleDocs, googleDrive
  /utils          — calculations, crypto, dicom, firebaseErrors, format,
                    logger, sanitizeHtml, theme
  /config         — constants.ts (ADMIN_UID, ADMIN_EMAIL)
  types.ts

/api  (Vercel serverless)
  anthropic.ts · gemini.ts · orthanc-proxy.ts · worklist.ts · health.ts
  promote-admin.ts · reset-monthly-reports.ts
  abacatepay-checkout.ts · abacatepay-webhook.ts · abacatepay-portal.ts
  abacatepay-cancel.ts · abacatepay-test.ts
  _auth.ts · _firebase.ts · _pricing.ts   (helpers internos)

/scripts
  agent.js (agente DICOM local) · generate_wl.py · get_hadlock.py
  laudia-deploy-aiInstructions.json (deploy de máscaras)
  clear-anamnesis-templates.mjs · update-templates.mjs · export-templates.mjs
  /_archive  — migrações já executadas (phase*, *-build.mjs, *-templates.json)
```

---

## 3. MODELO DE DADOS

### 3.1 Coleções Firestore

**User-scoped** (`users/{uid}/...`): `exams`, `patients`, `templates` (+ `versions`),
`clinics`, `appointments`, `settings/app`, `ai_usage`.

**Globais:**
| Coleção | Conteúdo |
|---|---|
| `users/{uid}` | Perfil + status de assinatura + quotas |
| `plans/` | Planos disponíveis (`Plan`) |
| `subscriptions/` | Assinaturas por usuário |
| `transactions/` | Histórico de cobranças AbacatePay |
| `audit_logs/` | Trilha de auditoria |
| `support_tickets/` | Chamados de suporte |
| `system/broadcast` | Aviso global do admin |
| `global_config/admin_settings` | Prompts/IA publicados pelo admin |
| `global_config/addons_config` | Catálogo de preços/quotas de add-ons |

### 3.2 ExamRequest (laudo)
`id, friendlyId, patientId, clinicId, area, examType, templateId, scheduledAt,
requestingPhysician, examDate, clinicalIndication, status('pendente'|'em-andamento'|
'finalizado'), reportContent(HTML), googleDocId/Url, unlockHistory, chatHistory,
customFormValue, anamnesis, consentTerm/Accepted, reportVersions, calculatorData`.

### 3.3 AppSettings
~60 campos: IA (provider, modelos, temperatura por modo, prompts por camada/área),
médico (nome, CRM, RQE, assinatura, doutrina), clínica, **DICOM/PACS** (URLs, AE Titles,
credenciais **criptografadas**, primário + backup), sistema (autoSave, sons, snippets).
Migrações **versionadas** via `_settingsMigrationVersion` (ver `db.ts`).

---

## 4. ASSINATURAS & FATURAMENTO (AbacatePay)

Substitui o antigo modelo de licença por código. Gerenciado em
`hooks/useSubscription.ts`, `settings/SubscriptionCenter.tsx`,
`admin/submodules/AdminFinanceiro.tsx` e nos endpoints `api/abacatepay-*`.

### 4.1 Status de assinatura
`SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'`.
Acesso liberado para `trialing`, `active`, `past_due` (banner de regularização).
Super admin (`matheuskpires@gmail.com`) e `role === 'admin'` têm bypass total.

### 4.2 Quotas mensais (no perfil do usuário)
- `reportsUsedThisMonth` / `reportsQuota` (0 = ilimitado)
- `clinicsQuota`
- `trialEndsAt`, `planId`, `abacatePayCustomerId`, `abacatePaySubscriptionId`
- Reset mensal automático via **CRON** `api/reset-monthly-reports.ts`
  (protegido por `CRON_SECRET`), que itera as assinaturas e zera o contador.

### 4.3 Add-ons (`global_config/addons_config`, fallback em `api/_pricing.ts`)
`calculators`, `pacs` (assistido), `appointments`, `clinics`, `extraReport`,
`extraClinic`, `tokenLite`, `tokenPro` (bundles de tokens). Cada um com preço,
`enabled` e `abacatePayProductId`.

### 4.4 Plano (`Plan`)
`reportsQuota`, `clinicsQuota`, `trialDays`, `motorProDefault`, `voiceDictation`,
`abacatePayProductId`, etc.

### 4.5 Endpoints de pagamento
| Endpoint | Função |
|---|---|
| `abacatepay-checkout` | Cria cobrança de assinatura/add-on (autenticado) |
| `abacatepay-webhook` | Recebe eventos do gateway (verificação de assinatura, `bodyParser:false`) |
| `abacatepay-portal` | Redireciona ao portal de gestão de cobrança |
| `abacatepay-cancel` | Cancela recorrência no gateway + revoga acesso local |
| `abacatepay-test` | Sandbox/diagnóstico |

---

## 5. MOTOR DE IA (LAUD.IA)

### 5.1 Cascata de prompts (3 camadas)
1. **BLOCO 1** Doutrina mestre (identidade, NÃO-INVENÇÃO) — com `cache_control` (Anthropic)
2. **BLOCO 2** Raciocínio clínico global
3. **BLOCO 3** Skeleton HTML obrigatório
4. **BLOCO 4** Compliance & segurança
5. **CAMADA 2** Diretriz da área (10 especialidades) — customizável pelo admin
6. **CAMADA 3** Instruções do exame específico (por template)

**USER:** contexto clínico + máscara HTML + **RAG** (laudos recentes p/ estilo +
histórico do paciente p/ evolução) + **few-shot** do corpus de excelência (`training/augment`).

### 5.2 Modos
`generation` (~0.35) · `refine` (~0.10, ⌘G) · `copilot` (~0.20) · `template` (~0.20).

### 5.3 Provedores
- **AnthropicProvider** — padrão `claude-sonnet-4-6`; streaming SSE; prompt caching;
  extended thinking (opus); retry com backoff; proxy `api/anthropic.ts`.
- **GeminiProvider** — padrão `gemini-2.5-flash`; streaming nativo; resolução de aliases;
  proxy `api/gemini.ts`.

### 5.4 Custo e métricas
Cada chamada estima tokens e calcula custo via tabela `PRICING` (em `engine.ts`),
persistindo em `ai_usage/`. A tabela **mantém modelos legados** propositalmente, para
calcular corretamente o custo de registros históricos. Histórico em memória:
`callMetricsHistory` (até 20).

### 5.5 Treino & feedback (`modules/ai/training/`)
- `feedback` / `feedbackStore` — classifica e registra correções do médico (sinais de qualidade)
- `excellenceCorpus` — laudos finalizados de alta qualidade alimentam o RAG few-shot
- `goldenDataset` + `evaluator` + `harness` — evals automatizadas (cobertas por testes)
- Conectado a `engine.ts`, `editor/useExamActions.ts` e `editor/ExamEditor.tsx`

### 5.6 Auditoria de qualidade local
`auditReportQuality(html, area)` → score 0-100 + issues (estrutura, seções obrigatórias,
placeholders residuais, bullets, tags proibidas, markdown, alerta obstétrico).

---

## 6. EDITOR DE LAUDOS (`ExamEditor.tsx`, ~1388 linhas)

Editor rico (TipTap), geração IA (⌘G, streaming), **LaudCopilot** (assistente conversacional),
DICOM viewer integrado + viewers externos (Stone/OHIF/OE2), 19 calculadoras, frases prontas,
anamnese & consentimento (com assinatura), versionamento com rollback, Google Docs automático,
exportação (Print CSS + DOCX), print de imagens DICOM, auditoria de desbloqueio.

**Atalhos:** ⌘G gerar/refinar · ⌘S salvar · ⌘P imprimir · ⌘↵ finalizar · ⌘⇧C copiar ·
⌘⇧R reiniciar p/ máscara · setas navegação DICOM.

---

## 7. PACS / DICOM

Orthanc via **agente local** (`scripts/agent.js`) + **Tailscale** para acesso remoto seguro.
Busca de estudos por nome do paciente + StudyDate, thumbnails via proxy autenticado,
geração de worklist `.wl` (`generate_wl.py`), redundância primário + backup.
Proxy: `api/orthanc-proxy.ts`. Credenciais **criptografadas** no Firestore
(`utils/crypto.ts`, AES via UID).

---

## 8. RBAC

| Papel | Acesso |
|---|---|
| `admin` | Tudo + painel admin + bypass de assinatura |
| `medico` | Todos os módulos clínicos |
| `recepcao` | Worklist, pacientes, agenda (sem editar/gerar laudos) |

Provisionamento automático no primeiro login (perfil `trialing`, quota 100 laudos/5 clínicas).

---

## 9. PAINEL ADMIN (abas)

`Geral` · `LAUD.IA` (SharedLaudIA) · `Usuários & Planos` (AdminUsersSubscriptions) ·
`Financeiro` (AdminFinanceiro) · `Auditoria` (AdminAudit) · `Suporte` (AdminSupport) ·
`Máscaras` (AdminMasks).

## 9.1 CONFIGURAÇÕES (abas)
`Perfil` · `Centro de PDF` · `Auditoria` · `Assinatura & Faturamento` (SubscriptionCenter).

---

## 10. CALCULADORAS (19) e ESPECIALIDADES (10)

**19 calculadoras** (registry.tsx): IG, CRL, WHO/Barcelona biometria fetal, líquido amniótico,
Doppler, FIGO, ORADS, BI-RADS, TI-RADS, IMT, razões vasculares, IVC, cartografia venosa,
derrame pleural, peso prostático, MSD, volume, referência de órgãos.

**10 áreas:** medicina-interna, ginecologia, medicina-fetal, pequenas-partes,
musculoesqueletico, vascular, reumatologico, pediatria, procedimentos, mastologia.

---

## 11. SEGURANÇA

- **Multi-tenant**: dados clínicos isolados em `users/{uid}/`; regras em `firestore.rules`
  (RBAC: dono da própria subárvore; admin gerencia coleções globais).
- **Senhas DICOM criptografadas** no Firestore (AES derivado do UID) — `utils/crypto.ts`.
- **Webhook AbacatePay** valida assinatura do gateway; **CRON** protegido por `CRON_SECRET`.
- `sanitize()` em toda escrita; `sanitizeHtml.ts` no HTML do laudo; proxy isola credenciais PACS.
- **Auditoria** de eventos sensíveis (finalização, desbloqueio com justificativa, ações admin).

### 11.1 Pontos de atenção em aberto (ver IMPROVEMENT_PLAN.md)
- Chave de IA ainda trafega via header do browser para o proxy (mover para env + validar `uid`).
- Sem rate limiting nos proxies de IA.
- `ADMIN_EMAIL`/`ADMIN_UID` hardcoded em `config/constants.ts` e `App.tsx`.

---

## 12. DEPLOY

| Ambiente | Notas |
|---|---|
| Produção | Vercel + Tailscale para PACS |
| Dev | `localhost:5173` (PACS via URL local) |
| Self-hosted | `Dockerfile` + `docker-compose.yml` + `nginx.conf` |

Build: `tsc && vite build`. Testes: `vitest run`. Regras: `firebase deploy --only firestore:rules`.

---

*Documentação regenerada em 29/06/2026 via análise estática do codebase LAUD.US v2.1.0.*
