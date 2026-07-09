# 📘 Documentação Oficial — LAUD.US

**Plataforma de laudos ultrassonográficos com IA, PACS/DICOM gerenciado e SaaS de assinatura.**
Versão do documento: 2026-07-08 (v4.2 — reorganização/unificação da documentação: BACKLOG único, PACS incidente MX7 e fix de AE-Title incorporados em §6, pendências §17 realinhadas) · Ambiente: produção (Vercel Pro + Firebase).

**Status:** vivo · **Complementares:** [Arquitetura](../src/ARCHITECTURE.md) · [Backlog (itens abertos)](BACKLOG.md) · [Cascata de Prompts LAUD.IA](CASCADE_PROMPTS.md) · [Política de Retenção LGPD](LGPD_POLITICA_RETENCAO.md) · [Termos de Uso](legal/TERMOS_DE_USO.md) · [Política de Privacidade](legal/POLITICA_DE_PRIVACIDADE.md) · [Pacote de Revisão Jurídica](legal/PACOTE_REVISAO_JURIDICA.md) · [Central PACS/DICOM (ponto de entrada)](pacs/PACS_CENTRAL_MESTRE.md) · [PACS Tenant Setup](pacs/PACS_TENANT_SETUP.md) · [PACS Provision Setup](pacs/PACS_PROVISION_SETUP.md) · [PACS Manual](pacs/PACS_MANUAL.md) · [Incidente MX7 08/07](pacs/incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md) · [Coeficientes FMF](FMF_COEFICIENTES_EXTRAIDOS.md) · auditorias/planos concluídos em [`docs/archive/`](archive/).

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

A landing institucional (hero, funcionalidades, planos, FAQ) vive **dentro do próprio app** como a tela inicial de quem não está logado — não é mais um site separado (ver §2).

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

**Landing institucional (`src/components/LandingScreen.tsx`):** unificada no mesmo app React (mesmo domínio/deploy — decisão revertida em 2026-07-06, antes era um site estático separado). É a tela renderizada por padrão para quem não está logado (`AuthRouter`/`UnauthenticatedGate` em `App.tsx`) — hero, funcionalidades, vitrine de planos (`PricingPlans`), FAQ e footer com Termos/Privacidade (`LegalModal`). Os CTAs "Entrar"/"Começar grátis" revelam a tela de login/cadastro (`LoginScreen.tsx`, agora simplificada — sem painel de marketing duplicado) dentro do mesmo app, sem navegação de página. Ao deslogar, o usuário sempre volta para a landing (nunca fica "preso" na tela de login).

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
  test/                    # 20 arquivos, 377 testes (Vitest)
api/                       # 14 funções serverless (Vercel Pro, sem teto de 12 — ver §12)
                           #   + helpers _auth,_edgeAuth,_firebase,_secure,_pricing,_entitlements,_rateLimit,_pacsLifecycle
scripts/agent.js           # Agente Local do PACS (worklist + proxy Orthanc + DELETE de tenant compartilhado)
scripts/generate_wl.py     # gera arquivos .wl (pydicom)
public/                    # favicon.svg + icons/*.png (marca padrão) + manifest
docs/                      # documentação: DOCUMENTACAO_OFICIAL (este) + legal/ (Termos/Privacidade)
                           #   + roadmaps/ (specs pendentes) + pacs/ (arquitetura/manuais PACS)
                           #   + archive/ (planos/auditorias históricas, já concluídos)
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
| **Calculadoras** | `Calculators.tsx`, `formulas.ts`, `classifiers.ts` | 20+ calculadoras clínicas (biometria fetal, dopplers, volumes). As 2 calculadoras FMF de 1º trimestre (trissomias + pré-eclâmpsia) estão **travadas** (`validated: false`, banner "EM VALIDAÇÃO") até serem conferidas contra casos-ouro — modelo já auditado dígito a dígito contra os papers-fonte (ver [FMF_COEFICIENTES_EXTRAIDOS.md](FMF_COEFICIENTES_EXTRAIDOS.md); só falta a Parte G, catalogada em [BACKLOG.md](BACKLOG.md)) | add-on `calculators` |
| **Clínicas** | `Clinics.tsx`, `ClinicDetail`, `ClinicForm`, `ClinicTeamCard` | Múltiplas clínicas, cabeçalhos de laudo por unidade, **convite de equipe** (ver §16) | add-on `clinics` |
| **PACS/DICOM** | ver §6 | Config Orthanc, guia, armazenamento, **provisão self-service** | add-on `pacs` |
| **Configurações** | `Settings.tsx`, `SubscriptionCenter.tsx`, `AuditDashboard.tsx` | Perfil, PACS, LAUD.IA, **Assinatura** | — |
| **Admin** | ver §7 do doc + Admin.tsx | Painel completo | role `admin` |
| **LAUD.IA (admin)** | `SharedLaudIA.tsx` | Treino/config da IA | role `admin` |
| **Export** | `ReportDocument.tsx`, `printReport.ts` | PDF (paged.js) + Google Docs | — |

### 4.1 Editor de Laudo (núcleo)
- **`ExamEditor.tsx`** (orquestrador) + **`RichEditor.tsx`** (Tiptap) + **`LaudCopilot.tsx`** (chat de refino, 3 abas: Chat / Formulário / **Estruturado**).
- **Componentes:** `EditorHeader`, `EditorToolbar`, `DicomViewerSidebar`, `DicomThumbnail`, `DicomImagesModal` (PDF das imagens), `ReportQualityPanel` (avaliação anti-alucinação), `ReportVersionsModal` (diff/rollback), `AnamnesisConsentModal`, `ExamHistoryModal`.
- **Hooks:** `useExamActions` (salvar/finalizar/reabrir), `useDicomSync` (busca estudos/imagens no PACS com polling+cache), `useCopilotSuggestions` (sugestões via Gemini), `useGoogleDocs` (export Google Docs), `useVoiceAnalyzer` (**ditado por voz** via SpeechRecognition).
- **Funcionalidades:** geração IA (`generation`), refino (`refine`), copiloto (`copilot`); export PDF (laudo + imagens em grades) e Google Docs; versões; anamnese; termo de consentimento (assinatura); qualidade/anti-alucinação.

### 4.1.1 Aba Estruturado (formulário tipado por máscara)
3ª aba do Copiloto (`activeTab: 'structured'`), aditiva — não substitui Chat nem Formulário. Gera um formulário tipado **derivado de cada máscara**, específico por exame (ex.: ECOCARDIOGRAMA gera campos de câmaras/vias/arcos; obstétrico gera biometria fetal), com cálculo clínico em tempo real e escrita de volta ao laudo via IA.

- **Esquema:** `parseMaskSections(analysisTemplate)` (`structured/deriveSchema.ts`) extrai os compartimentos de CADA máscara → `enrichSections(area, sections)` (`structured/fieldLibrary.ts`) casa rótulo por regex+área com campos tipados/escores canônicos. As 10 áreas clínicas têm biblioteca de campos dedicada (fetal, vascular, pequenas-partes, medicina-interna, gineco, mastologia, MSK, reumato, pediatria, procedimentos).
- **Motor de vivo (`structured/liveCompute.ts`):** calcula em tempo real, sem abrir modal — volume elipsoide, PFE Hadlock IV + percentil OMS, RCP (ACM/AU), IG/DPP, ILA, índices Doppler (IR/SD/RAR renal bilateral), estenose carotídea (NASCET), ITB, volume tireoidiano, BPP, discordância gemelar, entre outros. Badges "Cálculo automático" por seção.
- **Escores inline (`structured/scoring.ts`):** TI-RADS (aditivo por foco, `multiselect`), sugestões BI-RADS/O-RADS/Bosniak, classificação de Graf (quadril infantil) — calculados ao vivo, rotulados como sugestão (não substituem julgamento médico).
- **Recursos de engine:** seções normal/alterado (toggle, compila "sem alterações"), itens repetíveis (nódulos/lesões/articulações), campos condicionais (`showIf`), write-back de calculadora clínica para um campo específico (`onOpenCalcForField`).
- **Preview no editor de máscaras:** `TemplateEditor.tsx` tem aba "Estruturado" com `StructuredPreview` (mesmo componente, sem persistência/IA) para o médico validar o formulário gerado por uma máscara antes de usá-la.
- **Persistência:** `ExamRequest.structuredValue` (autosave 800ms). **Compilação:** monta `[DADOS DE FORMULÁRIO COMPILADOS]` + instrução de área → segue o pipeline normal de geração da IA (mesmo card/fluxo do Formulário livre).
- Arquivos: `src/modules/editor/structured/` (deriveSchema, fieldLibrary, liveCompute, scoring, structuredKeys) + `src/modules/editor/components/StructuredTab.tsx` / `StructuredPreview.tsx`. Testes: `structuredSchema.test.ts`, `structuredEngine.test.ts`, `liveCompute.test.ts`.

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

**Prompts (`ai/prompts/`):** camadas mestre/global/estrutura/regras + `areaPrompts.ts` (por especialidade) + `template.ts`. Regras Rígidas (Bloco 4) em **V2.0** (`general.ts`): R1–R8 originais + **R9 (Segurança Pediátrica)** — proíbe referência de adulto em <18 anos — e **R10 (Versões de Classificações)** — fixa a versão oficial vigente de cada sistema (BI-RADS v2025, TI-RADS ACR 2017, O-RADS ACR 2022, LI-RADS v2024, Bosniak v2019, FIGO 2021 etc.) e define quais usam a seção `<h2>CLASSIFICAÇÃO</h2>` própria vs. quais são declarados dentro da ANÁLISE (SFU, CEAP, Rutherford, IOTA, Chammas...). Refino/Copiloto têm **9 Leis de Ouro** (`DEFAULT_REFINEMENT_GOLDEN_RULES`) e 3 sub-protocolos no Copiloto (Conflito, Instrução Multi-Parte, Integração de Resultado de Calculadora). A hierarquia de camadas é **doutrina textual** — não há árbitro determinístico de conflito entre Camada 2/3 no código; `auditReportQuality()` é a rede de segurança *a posteriori* (regex, não-IA) para parte das regras (R1/R5/R6/R7). Referência canônica completa e sincronizada com o código: [`docs/CASCADE_PROMPTS.md`](CASCADE_PROMPTS.md).

**Treino & avaliação (`ai/training/`):** golden dataset, evaluator, harness de evals, retrieval few-shot (`augment`/`retrieval`/`embeddings`), corpus de excelência, anonimização (`anonymize` → `scrubForGeneration`), feedback store, métricas de qualidade, experimentos. **Backfill de qualidade (`training/backfill.ts`):** os KPIs Score/Segurança do Corpus de Excelência antes só populavam com finalizações novas; `backfillQualityRecordsFromCorpus` roda `auditReportQuality`+`verifyReport` sobre o histórico (id determinístico → idempotente), acionável pelo botão "Calcular notas" no `TrainingDashboard`. Satisfação continua exigindo feedback humano real (não backfillável). Painel **LAUD.IA** (admin) opera tudo isso.

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
- **Painel (`DicomControlCenter.tsx`):** presets (Nuvem/Local), guia passo a passo, aba **Armazenamento & Exames** (estatísticas do Orthanc), chip **"Aparelhos registrados"** no "Executar Diagnóstico" (`testDevices`) — confere se todo aparelho cadastrado no app também está em `DicomModalities` no PACS ativo.

**Incidente real de produção (08/07/2026 — Mindray MX7, ver [postmortem completo](pacs/incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md) e [`PACS_CENTRAL_MESTRE.md`](pacs/PACS_CENTRAL_MESTRE.md)):** 5 causas-raiz empilhadas (VM sem `--accept-routes`, firewall de zona do GL.iNet não recarregado, ACL do Tailscale sem `grant` explícito por CIDR, aparelho não registrado em `DicomModalities`, `dicomTenantId` divergente do tenant realmente alcançado pelo relé) levaram a um timeout persistente e a 6 estudos (1 teste + 5 pacientes reais) parando no tenant errado — recuperados via download/upload. Todos os fixes viraram produto na mesma sessão: relé GL.iNet passou a usar DNAT nativo por padrão (`scripts/glinet-pacs-relay.sh`) em vez de subnet-routing; badge "Não registrado no PACS" no card de aparelhos; chip "Aparelhos registrados" no Diagnóstico (acima). **Bug adicional achado na auditoria pós-incidente** (não fazia parte da causa original): o `.wl` gravava sempre o AE Title do **Orthanc** (`settings.dicomOrthancAETitle`, sempre `'ORTHANC'` num PACS gerenciado) em vez do AE Title do **aparelho selecionado** (`targetDevice.aeTitle`) — tornando o seletor de aparelho decorativo em qualquer conta com múltiplos aparelhos. Corrigido em `src/utils/dicom.ts` (envio primário e de backup) e `scripts/generate_wl.py` (agora exige `aeTitle` explicitamente, sem fallback silencioso).

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

- **Auth:** Firebase (Google + e-mail/senha). Todo acesso exige login (exceto a landing/vitrine de planos, pública). Contas por e-mail/senha exigem **e-mail verificado** para gerar laudos com IA (`sendEmailVerification`, checado server-side em `/api/gemini` via claim `email_verified` do token — contas Google já chegam verificadas). "Esqueci minha senha" via `sendPasswordResetEmail`.
- **RBAC:** `admin | medico | recepcao`. **Privilégio de admin só por `users/{uid}.role`** (campo protegido) — `useAdmin` não confia em `settings.currentRole`; `Admin.tsx` tem guarda própria; super-admin por e-mail.
- **RBAC de clínica (equipe multiusuário) — implementado:** `clinic_memberships` permite convidar um segundo usuário (papel `editor`/`viewer`) para colaborar numa clínica (`ClinicTeamCard.tsx` + `api/clinic-invite.ts`). Regras do Firestore validam acesso a `clinics`/`patients`/`exams`/`appointments` por membership, **incluindo proteção contra um editor reatribuir `clinicId` de um registro para fora da clínica dele** (o `update` exige que `clinicId` não mude — só dono/admin podem reclassificar). A camada de dados do cliente (`useFirestore.ts`/`db.ts`) redireciona corretamente para a subárvore do dono via `resolveOwnerUid` (`store/clinicAccess.ts`) — um membro convidado já visualiza/edita os dados do dono pela UI dentro do contexto da clínica ativa (ver §16 para detalhes e limitações).
- **Firestore rules:** default-deny; impedem escalonamento de privilégio, inflar cota, auto-conceder add-ons; contador de uso só cresce; `transactions`/`metrics_daily` restritos; `clinic_memberships` só criado pelo servidor; webhooks usam Admin SDK (ignoram rules).
- **Endpoints:** auth JWKS (Edge/serverless); **rate-limit distribuído** no `gemini` (Vercel KV/Upstash, fallback em memória); `safeEqual` (timing-safe) em segredos; entitlement server-side (PACS + cota) **fail-open**; `promote-admin` com trava tripla.
- **Segredos:** `.env`/`.env.example` sem valores reais (chave privada do Firebase Admin SDK e chave Gemini que estavam commitadas em texto puro foram rotacionadas e revogadas em 05/07/2026); chaves só em env da Vercel; senhas PACS e segredo do Agente **criptografados por-usuário** (`crypto.ts`); anti-SSRF no Agente.
- **LGPD/CFM:** trilha de acesso a paciente (`logPatientAccess`), pseudonimização nos prompts (`scrubForGeneration`), consentimento no editor, **Termos de Uso e Política de Privacidade publicados** (`docs/legal/*.md`, `LegalModal.tsx` acessível a partir da landing e do login) com **checkbox obrigatório e registro de aceite** (`termsAcceptedAt`/`termsVersion` em `users/{uid}`), **política de retenção documentada** (`docs/LGPD_POLITICA_RETENCAO.md` — prazos de guarda, pendências de expurgo/portal do titular). **Identificação da operadora (razão social/CNPJ) omitida intencionalmente** dos documentos e da interface durante a fase de testes restrita (decisão do responsável, 2026-07-06) — ver alerta em `docs/legal/PACOTE_REVISAO_JURIDICA.md`. Assinatura digital ICP-Brasil: **desenho pronto, não implementada** (aguarda escolha de fornecedor — ClickSign/D4Sign — e credenciais do usuário; ver `docs/roadmaps/ASSINATURA_ICP_BRASIL.md`).
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
| `abacatepay-mock-gateway.ts` | Node | — (bloqueado em produção) | Simula o gateway de pagamento da AbacatePay para desenvolvimento/teste local do fluxo de checkout/webhook, sem depender da API real |
| `clinic-invite.ts` | Node | dono da clínica/admin | Convida usuário (por e-mail) para `clinic_memberships` |
| `reset-monthly-reports.ts` | Node | CRON_SECRET / auth | Reset mensal de cota + expiração de assinatura (past_due/expired) + lifecycle de VM PACS (suspensão/reativação/destruição, ver §6) |
| `cron-aggregate-metrics.ts` | Node | CRON_SECRET | Agrega `metrics_daily` (uso+receita) + MRR/ARR |
| `cron-monthly-billing.ts` | Node | CRON_SECRET | Rotina mensal de cobrança/consolidação de billing |
| `promote-admin.ts` | Node | super-admin (trava tripla) | Promove o super-admin |
| `health.ts` | Node | — | Health-check |
| **Helpers** | — | — | `_auth`, `_edgeAuth` (JWKS), `_firebase` (Admin SDK), `_secure` (safeEqual), `_pricing`, `_entitlements`, `_rateLimit` (KV), `_pacsLifecycle` (suspensão/destruição de VM/tenant), `_quota` (avaliação de cota de laudos) |

**Vercel Pro ativo (desde 07/07/2026):** o projeto deixou o plano Hobby — o teto de 12 funções serverless não se aplica mais (14 hoje, ver §3). `abacatepay-checkout.ts` e `pacs-provision.ts` continuam consolidando `test-key`/`DELETE` por padrão de design (menos superfície, não mais por necessidade do teto), mas novas funções não quebram mais o deploy.

**Crons (`vercel.json`):** `reset-monthly-reports` (03:00 diário) · `cron-monthly-billing` (03:45 diário) · `cron-aggregate-metrics` — **agora horário** (`10 * * * *`, habilitado pelo Pro em 07/07/2026; antes 1×/dia no Hobby) — painel financeiro/telemetria do admin fica com dados agregados mais frescos ao longo do dia (agregação é idempotente sobre as últimas 48h, seguro rodar com mais frequência).

---

## 11. Integrações externas
- **Google Gemini** — IA (server-side, `GOOGLE_API_KEY`); custo por chamada gravado em `ai_usage` (tokens + `costUsd`).
- **AbacatePay** — pagamentos (checkout/webhook/cancel); webhook valida HMAC-SHA256 + idempotência (`webhook_events`); mock bloqueado em produção.
- **Google Cloud** — provisão **e desprovisão** de VM PACS (`pacs-provision.ts`, `POST`/`DELETE`).
  - **Billing real (em setup, 05/07/2026):** a Cloud Billing API sozinha **não expõe gasto real** — só confirma billing ativo/conta vinculada e catálogo de preços (SKUs). Para custo detalhado é necessário o **BigQuery Billing Export**. Já configurado nesta sessão:
    1. Cloud Billing API (`cloudbilling.googleapis.com`) e BigQuery API (`bigquery.googleapis.com`) habilitadas no projeto `antigravity-laudus`.
    2. Billing Console → Billing export → BigQuery export → dataset **`laudussys`** criado no projeto `antigravity-laudus`, exportação "Standard usage cost" ativada.
    3. Service account (a mesma do `GCP_SA_KEY`) recebeu os papéis **BigQuery Data Viewer** e **BigQuery Job User** no dataset `laudussys`.
    4. **Pendente:** aguardando o Google criar a 1ª tabela e popular dados (~24-48h após a ativação — normal não haver tabela nem linhas nesse meio-tempo). Quando a tabela `laudussys.gcp_billing_export_v1_XXXXXX` (nome exato varia) tiver linhas, falta implementar a query server-side (BigQuery API, mesma service account) e ligar ao painel Financeiro (`FinanceOverviewTab.tsx`), substituindo a estimativa fixa por custo real por SKU/serviço.
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
Landing (tela inicial, deslogado) → "Começar grátis"/"Entrar" → **cadastro** (checkbox obrigatório de Termos/Privacidade, e-mail de verificação enviado) → trial 14d → Centro de Assinatura → **checkout AbacatePay** → webhook concede (add-ons/cota, grava `interval`/`price`) → `useSubscription` reflete via snapshot → módulos liberam. Geração de laudos com IA exige e-mail confirmado (contas e-mail/senha).

**B. Exame → laudo → PDF**
Agenda/Worklist cria exame → (PACS) worklist ao aparelho → imagens recebidas → Editor gera laudo IA (**cota checada no servidor**) → refino/copiloto → qualidade/anti-alucinação → export **PDF** (laudo + imagens) ou **Google Docs** → finaliza (remove `.wl`).

**C. Provisão do PACS**
Escolhe plano PACS → `/api/pacs-provision` (VM/tenant) → polling de saúde do Agente → `pacsInstance = ready` → aparelho aponta para o relé → imagens fluem.

**D. Telemetria → decisão**
Cada geração grava `ai_usage` → CRON diário agrega `metrics_daily`/`_summary` → Admin (Analytics/Saúde/Usuários/Financeiro) lê os agregados (MRR/ARR, laudos/dia, custo, receita).

---

## 14. Testes & qualidade
- **377 testes (Vitest, 20 arquivos):** calculadoras (incl. FMF trissomias + pré-eclâmpsia), classificadores, motor de IA, verificação/evolução/aprendizado/treino, Aba Estruturada (schema/engine/live-compute), segurança (`safeEqual`), preços (`_pricing`), roteamento PACS + multi-tenant + `resolveGeminiModel`.
- **Gate de build:** `tsc && vite build`. CI (GitHub Actions).
- **Dívida conhecida:** ~183 usos de `any` (medido em 08/07/2026, caiu de 248 desde a auditoria de 04/07; concentrados em fronteiras de integração — admin/pagamento/PACS), arquivos grandes ainda não refatorados (`SharedLaudIA.tsx` 1766 L, `ExamEditor.tsx` 1574 L, `ai/engine.ts` 1282 L), chunk `vendor-icons` já corrigido (905 kB → 87,6 kB, ver [`docs/archive/PLANO_MELHORIAS_2026-07.md`](archive/PLANO_MELHORIAS_2026-07.md) Fase 2). Só 3 de 16 endpoints serverless têm teste dedicado; 10 de 14 módulos de UI não têm teste dedicado (cobertura hoje é toda em lógica pura — calculadoras/engine/pricing). Lista completa em [`docs/BACKLOG.md`](BACKLOG.md).

---

## 15. Controle financeiro (Admin)

Painel **Financeiro** (`AdminFinanceiro.tsx`, 9 sub-abas: overview, plans, pacs-plans, vm-infra, features, extra-resources, abacatepay, ia-costs, transactions).

- **Central Financeira (`FinanceOverviewTab.tsx`):** MRR/ARR (`computeMrr()`, `api/_pricing.ts` — usa `intervalMultiplier` e o preço travado na assinatura, não o do catálogo), receita bruta e líquida-de-taxas estimada (`estimateNetRevenue`) dos últimos 30 dias, custo de VMs (estimado, inclui `suspended`) + custo de IA (real, via `ai_usage`) + despesas gerais (`general_expenses`, lançamento manual), margem líquida do negócio inteiro. Série histórica (30 dias) de receita e custo de IA. Churn 30d, ARPU, LTV estimado e conversão trial→pago (14 dias, cohort por `users.createdAt`, já que trial orgânico não vira doc em `subscriptions`). AR aging unificado (a vencer ≤7d + já vencidas).
- **Reconciliação MRR vs receita real:** compara MRR só contra receita de assinaturas **mensais** dos últimos 30 dias (`revenueByInterval`, agregado pelo CRON) — evita falso-positivo em mês com renovação avulsa semestral/anual.
- **Alerta de prejuízo por usuário com limiar configurável (`lossThresholdBrl`):** compara o custo real de IA do mês de cada assinante (via `getAiUsageByUser`, collection-group `ai_usage`) com a receita mensal-equivalente do plano dele; banner proeminente só para quem passa do limiar, tabela detalhada mostra toda perda.
- **Top 10 consumidores de IA (`ia-costs`):** ranking por custo, com e-mail do usuário, via `getAllUsersAiUsageStats` (collection-group, restrito a admin pelas regras).
- **Fonte única de preço de IA** (`src/modules/ai/modelPricing.ts`, `GEMINI_MODEL_PRICING`), usada tanto pelo cálculo real de custo (`engine.ts`) quanto pela exibição (`IACostsTab`) — modelo sem preço mapeado loga erro (Sentry) em vez de custar $0 em silêncio.
- **Histórico de mudança de preço por plano** (`saas_plans/{id}/price_history`, apend-only) e **status de nota fiscal por transação** (`transactions/{id}/nf`, metadado separado — a transação em si continua imutável fora do webhook).
- **Export CSV de contador** (aba Transações): valor bruto, taxa de gateway estimada e valor líquido estimado por transação, mais status de NF.
- **Custo de VM ainda é estimativa por tabela de preço fixa** (plano × disco) — a integração com o custo real do GCP está com o setup de infraestrutura pronto (BigQuery Billing Export configurado, ver §11), só falta o Google popular os dados (~24-48h) e então implementar a leitura no painel.
- **Lifecycle automático de VM por cancelamento de assinatura:** implementado (ver §6) — não depende mais de ação manual do usuário.
- **Auditoria profunda em 07/07/2026** encontrou 6 números com fórmula errada (MRR 6x superestimado em assinante semestral, custo de IA podendo zerar em silêncio, medidor de disco decorativo, VMs `suspended` somindo dos KPIs, taxas de gateway não aplicadas, overwrite de add-on avulso no troca-de-plano) — **todos os 6 corrigidos** (Fase A), mais Fases B/C/D de evolução (métricas de SaaS, histórico de preço, ledger de despesas, NF, export contábil) — **16 de 18 itens executados**. Restam 2, adiados por dependência externa: reconciliação automática AbacatePay vs Firestore (schema do endpoint não confirmado) e billing export real do GCP (aguarda ativação na conta). Ver [Auditoria do Financeiro](archive/AUDITORIA_FINANCEIRO_2026-07.md) e [Proposta de Centro Financeiro](archive/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md) (arquivados — ~90% executados) para detalhes completos.

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

**Mapeamento consolidado em 07/07/2026** (varredura de todo o sistema: código, docs, `firestore.rules`/`indexes`, variáveis de ambiente da Vercel via `vercel env ls`, proteção de branch via `gh api`), **revisado em 08/07/2026** contra a auditoria documental completa. Todo item abaixo foi verificado contra o estado real, não apenas contra memória de sessões anteriores. Para itens de dívida técnica/produto (não deploy/config/decisão externa), ver a lista completa e viva em [`docs/BACKLOG.md`](BACKLOG.md) — as tabelas abaixo cobrem especificamente o que depende de deploy/config ou de decisão externa.

### Ação técnica pronta, só falta deploy/config (sem decisão de negócio)

| Item | Descrição | Ação |
|---|---|---|
| `firestore.rules`/`indexes` desatualizados em produção | `price_history`, `general_expenses`, `transactions/{id}/nf` (regras novas do Centro Financeiro, ver §15) e o índice collection-group de `ai_usage`/`timestamp` (causa erro `COLLECTION_ASC index` visto em produção) estão no código mas não deployados | `firebase deploy --only firestore:rules,firestore:indexes` — pendente de confirmação explícita do usuário |
| Branch `main` sem proteção | `gh api repos/.../branches/main/protection` retorna 404 ("Branch not protected") — nada impede merge direto sem o CI (`tsc`+testes+build) passar | GitHub → Settings → Branches → exigir status check antes de merge (ação só do usuário, fora do alcance de CLI) |
| Sentry configurado no código mas não ativado | `logger.error` já reporta ao Sentry (`ErrorBoundary`, `beforeSend` redige PII) — mas `VITE_SENTRY_DSN` não aparece em nenhuma env var da Vercel (`vercel env ls`, checado 07/07/2026); hoje é no-op silencioso, sistema roda sem monitoramento de erro em produção | Criar projeto no Sentry + `vercel env add VITE_SENTRY_DSN` (produção) + `.env` local |
| Variáveis de PACS dedicado/compartilhado ausentes na Vercel | `vercel env ls` (07/07/2026) mostra só 13 variáveis em produção — nenhuma de `GCP_SA_KEY`, `TAILSCALE_API_KEY`, `TAILSCALE_TS_NET` (plano Dedicado) nem `PACS_SHARED_AGENT_URL`, `PACS_ADMIN_SECRET` (plano Compartilhado) aparece na lista. O código já bloqueia com segurança (`shouldBlockMockInProduction`, ver §10) em vez de devolver uma VM falsa — mas **provisionamento real de PACS pode estar indisponível em produção agora**. Precisa confirmação do usuário: ou as env vars existem com outro nome, ou o self-service de PACS está de fato pausado | Usuário confirmar no dashboard da Vercel (só nomes, sem expor valor) — item não confirmável por mim sem acesso a segredo de produção |
| Rate limit sem KV distribuído | `KV_REST_API_URL`/`KV_REST_API_TOKEN` também ausentes — `api/_rateLimit.ts` cai no fallback em memória (funciona, mas não é compartilhado entre instâncias serverless). Documentado como opcional desde a implementação | Provisionar Vercel KV/Upstash se o rate limit precisar ser realmente distribuído |

### Bloqueado por decisão externa ao código (negócio, jurídico ou terceiro)

| Item | Descrição | Bloqueador |
|---|---|---|
| Assinatura digital ICP-Brasil | Hoje só imagem de assinatura escaneada; sem valor jurídico pleno de laudo assinado. Desenho pronto em [`docs/roadmaps/ASSINATURA_ICP_BRASIL.md`](roadmaps/ASSINATURA_ICP_BRASIL.md) | Escolha de fornecedor (ClickSign/D4Sign) + credenciais do usuário — decisão adiada conscientemente (07/07/2026) |
| Billing API do GCP no Admin | Custo de VM é estimativa, não a fatura real. Setup do BigQuery Billing Export já feito (ver §11); falta confirmar se a tabela `laudussys.gcp_billing_export_v1_*` já tem linhas (~24-48h após ativação) e então implementar a query server-side + ligar ao painel Financeiro | Confirmação do usuário de que a tabela já tem dados |
| Reconciliação automática AbacatePay vs Firestore | Schema do endpoint de listagem de transações da AbacatePay não confirmado — implementar contra campos adivinhados foi julgado arriscado demais | Confirmar schema real do endpoint (docs oficiais da AbacatePay ou chamada de teste registrada) |
| Calculadoras FMF (trissomias + pré-eclâmpsia) travadas | `validated: false`, banner "EM VALIDAÇÃO" — modelo já auditado dígito a dígito contra os papers-fonte, falta só os casos-ouro de validação clínica (ver [BACKLOG.md](BACKLOG.md)) | Usuário preencher os casos-ouro (dados clínicos reais para conferência) |
| Revisão jurídica dos Termos/Privacidade/Retenção | Documentos v3.0 sem identificação da operadora (razão social/CNPJ removida por decisão do responsável durante a fase de testes) — pacote em [`docs/legal/PACOTE_REVISAO_JURIDICA.md`](legal/PACOTE_REVISAO_JURIDICA.md) já sinaliza esse ponto como prioritário para o advogado | Validação por advogado especializado em LGPD/saúde digital |
| Identificação da operadora nos documentos legais | Razão social/CNPJ removidos de todos os documentos e da interface durante a fase de testes — recomendável reintroduzir ao menos nos documentos legais antes da operação comercial plena | Decisão do responsável, a rever com o advogado |

### Dívida técnica e itens adiados conscientemente

Ver a lista completa e sempre atualizada em [`docs/BACKLOG.md`](BACKLOG.md) — inclui: desativação de conta no Firebase Auth ao excluir usuário, M2/M3 do Admin (paginação de recálculo de transações, guarda de concorrência), busca/paginação server-side em Usuários, gap arquitetural de query multi-usuário, cron de expiração de assinatura avulsa ausente, gestão de frota de VMs PACS no admin, arquivos grandes ainda não refatorados e uso residual de `any`.

**Resolvido em 07/07/2026:** teto de 12 funções serverless (Vercel Hobby) — projeto migrou para o **plano Pro**; sem mais limite de contagem de funções, cron de agregação de métricas agora roda horário (era 1×/dia no Hobby). Auditoria completa do módulo Admin (8 abas + LAUD.IA) — 30 achados, todos corrigidos exceto os 3 itens de baixa prioridade em [`docs/BACKLOG.md`](BACKLOG.md) (ver [Auditoria](archive/AUDITORIA_ADMIN_2026-07.md) / [Plano de Finalização](archive/PLANO_FINALIZACAO_ADMIN_2026-07.md), ambos arquivados). Centro Financeiro (Fases A-D) — 16 de 18 itens executados, ver §15.

---

## 18. Glossário
**Add-on** — recurso pago avulso. **Orthanc** — servidor PACS. **Worklist** — lista de exames que o aparelho lê (`.wl`). **Agente** — programa que grava `.wl` e faz proxy do Orthanc. **Tenant** — instância isolada numa VM compartilhada (`tenantId`). **Tailscale/Funnel** — VPN privada + endereço HTTPS público. **MRR/ARR** — receita recorrente mensal/anual. **Entitlement** — direito de uso derivado do plano. **Fail-open** — se a checagem falha, libera (não derruba pagante). **Collection-group query** — consulta sobre todas as subcoleções de mesmo nome (ex.: `ai_usage`). **Clinic membership** — vínculo de um usuário convidado (não dono) a uma clínica, com papel `editor`/`viewer` (`clinic_memberships`). **Reconciliação financeira** — comparação entre receita/MRR teóricos e valores reais cobrados/consumidos, para detectar divergência.

---
*Documentação oficial v4.2 (08/07/2026). Pendências vivas em [`docs/BACKLOG.md`](BACKLOG.md); detalhamento por área nos documentos complementares listados no topo.*
