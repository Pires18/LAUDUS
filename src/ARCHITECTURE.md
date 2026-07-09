# Arquitetura do Sistema — LAUD.US v2.0

**Última atualização:** 08/07/2026

> Referência técnica enxuta para quem navega o código pela primeira vez. Para o
> estado completo e mais atualizado do sistema (módulos, modelo de dados, PACS
> multi-tenant, billing, segurança, pendências), a fonte da verdade é
> [`docs/DOCUMENTACAO_OFICIAL.md`](../docs/DOCUMENTACAO_OFICIAL.md).

## Visão Geral

```
src/
├── App.tsx                    # Roteamento central (ViewRenderer + Suspense + lazy)
├── main.tsx                   # Entry point React + Firebase init
├── types.ts                   # Tipos TypeScript globais (Patient, ExamRequest, etc.)
│
├── config/
│   └── constants.ts           # ADMIN_UID, ADMIN_EMAIL via variáveis de ambiente
│
├── components/                # Componentes UI globais e reutilizáveis
│   ├── Sidebar.tsx            # Nav desktop (colapsável, tooltips, RBAC)
│   ├── BottomNav.tsx          # Nav mobile PWA
│   ├── Modal.tsx              # Modal acessível com AnimatePresence
│   ├── Toast.tsx              # Sistema de notificações toast
│   ├── CreateExamModal.tsx    # Modal de criação de exame
│   ├── SupportCenterModal.tsx # Modal de suporte (chat interno)
│   ├── CommandPalette.tsx     # Paleta de comandos (cmd+k)
│   ├── LogoIcon.tsx           # SVG do logo LAUD.US
│   ├── AreaIcon.tsx           # Ícone dinâmico por especialidade médica
│   ├── ErrorBoundary.tsx      # Captura de erros React com fallback UI
│   ├── BroadcastBanner.tsx    # Banner de mensagens globais do sistema
│   └── PWAUpdatePrompt.tsx    # Prompt de atualização PWA
│
├── store/                     # Estado global e persistência
│   ├── app.ts                 # Zustand store principal (view, settings, modais)
│   └── db.ts                  # DAL Firestore CRUD + lógica PACS/proxy/licenças
│
├── hooks/                     # Custom hooks reutilizáveis
│   ├── useAuth.ts             # Firebase Auth listener
│   ├── useAdmin.ts            # Verificação de role admin
│   └── useFirestore.ts        # useDocument<T>, useCollection<T>, usePaginatedCollection<T>
│
├── utils/
│   ├── format.ts              # formatDate, calculateAge, classNames, etc.
│   ├── logger.ts              # Logger centralizado (silencia em produção, prepara Sentry)
│   ├── sanitizeHtml.ts        # Sanitização HTML (XSS prevention)
│   └── dicom.ts               # Helpers DICOM/PACS (StudyInstanceUID, etc.)
│
├── styles/
│   └── index.css              # Design System: tokens, animações, print, responsividade
│
└── modules/                   # Módulos de negócio por feature
    ├── dashboard/             # KPIs, gráficos e timeline de atividades
    ├── worklist/              # Fila de exames + integração Orthanc Worklist
    ├── editor/                # Editor de laudos (módulo principal)
    │   ├── ExamEditor.tsx     # Orquestrador central — PACS, print, status
    │   ├── LaudCopilot.tsx    # Chat IA por exame (streaming SSE)
    │   ├── RichEditor.tsx     # Editor Tiptap (ProseMirror) com toolbar
    │   ├── components/
    │   │   ├── EditorHeader.tsx       # Header com status PACS/Save/Realtime
    │   │   ├── EditorToolbar.tsx      # Toolbar de formatação e ações
    │   │   ├── DicomImagesModal.tsx   # Visualizador de imagens DICOM
    │   │   ├── DicomThumbnail.tsx     # Thumbnail de instância DICOM
    │   │   ├── ExamHistoryModal.tsx   # Histórico de exames do paciente
    │   │   ├── AnamnesisConsentModal.tsx # Anamnese e consentimento
    │   │   └── ReportVersionsModal.tsx   # Versões do laudo (snapshot history)
    │   └── hooks/
    │       ├── useExamActions.ts    # Geração IA, refinamento, save debounced (saveState)
    │       ├── useGoogleDocs.ts     # Criação/deleção Google Docs
    │       ├── useDicomSync.ts      # Polling DICOM (5s viewer aberto / 30s fechado)
    │       └── useVoiceAnalyzer.ts  # Reconhecimento de voz para copiloto
    ├── laud-ia/               # Command Center LAUD.IA (geração em lote, playground)
    │   └── SharedLaudIA.tsx
    ├── ai/                    # Motor de integração com LLMs
    │   ├── engine.ts          # Funções públicas: generateReport, generateReportStream, auditReportQuality
    │   ├── types.ts           # Interface AiProvider (Strategy Pattern)
    │   ├── json.ts            # robustJsonParse com auto-healing
    │   ├── generateTemplate.ts # Geração de templates via IA
    │   ├── providers/
    │   │   └── GeminiProvider.ts    # Google Gemini (generate + stream + extractJson)
    │   └── prompts/
    │       ├── general.ts      # Prompts mestre, global, estrutura, regras rígidas
    │       ├── areaPrompts.ts  # Diretrizes por especialidade (~235 KB)
    │       ├── template.ts     # Prompts de geração de templates
    │       └── index.ts        # Re-exportações centralizadas
    ├── patients/              # CRUD de pacientes + histórico
    ├── templates/             # Editor de máscaras de laudo
    ├── clinics/               # Gestão de unidades/clínicas
    ├── calculators/           # 22+ calculadoras clínicas (Hadlock, TI-RADS, etc.)
    ├── appointments/          # Agendamentos com ShiftConfigPanel
    ├── dicom/                 # Painel PACS/DICOM (DicomControlCenter, MyPacsCard, UltrasoundSetupCard)
    ├── settings/              # Configurações do usuário (PACS, IA, prompts)
    ├── admin/                 # Painel admin (users, plans, financeiro, audit, support, saúde)
    └── export/                # Impressão e exportação
        ├── PrintLayout.tsx        # Layout de laudo para impressão
        ├── PrintImagesLayout.tsx  # Layout de imagens DICOM para impressão
        └── docxExport.ts          # Exportação para clipboard/DOCX
```

---

## Fluxo de Dados

```
Firebase Auth (Google + Email/Password)
    ↓
App.tsx → UserAccessGate (verifica licença + RBAC)
    ↓
Zustand store (useApp) → view, settings, selectedClinicId, toast
    ↓
ViewRenderer (lazy load por módulo)
    ↓
Módulos ←→ useFirestore() hooks ←→ Firestore Realtime (onSnapshot)
                                         ↓
                            users/{uid}/{collection} (user-scoped)
```

### Estado Global (Zustand — `store/app.ts`)
```typescript
{
  view: ViewState                 // Módulo ativo e parâmetros
  settings: AppSettings           // Configurações salvas (Firestore + defaults)
  selectedClinicId: string|null   // Filtro de clínica ativo
  showCreateExamModal: boolean
  showSupportModal: boolean
  toast: ToastMessage | null
  // Actions: setView, setSettings, showToast, setSelectedClinic, ...
}
```

---

## Providers de IA (Strategy Pattern)

```typescript
interface AiProvider {
  resolveModelName(settings, mode, area): string
  generate(built, settings, area, mode, signal?, onComplete?, helpers?): Promise<string>
  stream(built, settings, area, mode, onChunk, signal?, onComplete?, helpers?): Promise<string>
  extractJson(built, settings, area, signal?, helpers?): Promise<unknown>
}
```

| Provider | Modelos Suportados | Streaming |
|---|---|---|
| `GeminiProvider` | gemini-3.5-flash (Lite), gemini-3.1-pro-preview (Pro) | SSE via SDK |

### Temperatura adaptativa por modo
| Modo | Temperatura | Razão |
|---|---|---|
| `generation` | 0.35 | Fluidez narrativa |
| `refine` | 0.10 | Máxima fidelidade cirúrgica |
| `copilot` | 0.20 | Balanceado |
| `template` | 0.20 | Consistência estrutural |

---

## Integração PACS/DICOM

> Esta seção descreve os **mecanismos client-side** (proxy, busca, polling) — ainda
> corretos. Para a **topologia de infraestrutura real** (VM multi-tenant self-service
> na nuvem, não mais só agente local), ver
> [`docs/pacs/PACS_CENTRAL_MESTRE.md`](../docs/pacs/PACS_CENTRAL_MESTRE.md).

### Conexão
```
Browser
  → /api/orthanc-proxy (Vite dev middleware ou Vercel edge)
    → Agente (local ou na VM provisionada, via Funnel HTTPS)
    → Orthanc Primário (configura via Settings)
    → Orthanc Backup (opcional, configura via Settings)
```

### Busca de Estudos (useDicomSync.ts)
```
Fase 1 — Identificadores exatos (paralelo):
  - /tools/find { StudyInstanceUID }
  - /tools/find { AccessionNumber: examId }
  - /tools/find { AccessionNumber: friendlyId }
  → Se encontrado: retornar imediatamente

Fase 2 — Fallback por PatientID (se fase 1 vazia):
  - /tools/find { PatientID: patientId }
  - /tools/find { PatientID: examId }
```

### Polling de Imagens
```
Timer base: 5s
- Viewer/modal aberto → executa a cada 5s
- Viewer fechado (background) → executa a cada 30s (6 ticks)
```

---

## Hierarquia de Prompts LAUD.IA (3 camadas + override de modo)

> Referência canônica completa e sincronizada com o código:
> [`docs/CASCADE_PROMPTS.md`](../docs/CASCADE_PROMPTS.md).

```
Camada 1 — SISTEMA (universal)
  ├── aiMasterPrompt          ← Persona e lei de não-invenção
  ├── aiGlobalInstructions    ← Regras gerais de segurança
  ├── aiStructurePrompt       ← Estrutura HTML obrigatória (h1, h2 TÉCNICA, ANÁLISE, ...)
  └── aiRigidRules            ← Regras nunca quebradas (R1–R10, inclui R9 Segurança
                                 Pediátrica e R10 Versões de Classificações)

Camada 2 — ÁREA (especialidade)
  └── aiAreaPrompts[area]     ← Diretriz da especialidade (customizável no Settings)
      → Fallback: DEFAULT_AREA_PROMPTS[area] do código

Camada 3 — EXAME (template específico)
  └── template.aiInstructions ← Instruções específicas do exame/máscara

Mensagem do usuário (contexto clínico)
  ├── Modo (GERAÇÃO / REFINAMENTO)
  ├── Dados do paciente (nome, idade, gênero, histórico)
  ├── Indicação clínica + anamnese
  ├── Médico solicitante
  ├── Laudos anteriores do mesmo template/área (RAG estilo)
  ├── Histórico clínico do paciente (RAG temporal)
  └── Máscara/laudo atual
```

---

## RBAC (Controle de Acesso)

| Role | Dashboard | Worklist | Editor | Templates | LAUD.IA | Clínicas | Admin |
|---|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `medico` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `recepcao` | ✅ | ✅ | view-only | ❌ | ❌ | ❌ | ❌ |

> Recepção: não finaliza laudos, não acessa LAUD.IA, Templates, ou Clínicas.
> Além dos 3 roles de conta acima, existe um RBAC **por clínica** independente:
> `clinic_memberships` permite convidar um segundo usuário como `editor` ou
> `viewer` de uma clínica específica (ver §16 de `docs/DOCUMENTACAO_OFICIAL.md`).

---

## Sistema de Licenças — LEGADO, não ativo

> Confirmado por grep em 08/07/2026: não existe código real de ativação/validação
> de licença por código (`validateAndActivateLicense`/`checkUserLicenseStatus` não
> são encontrados em `src/` nem `api/`). O único resquício são 2 filtros
> defensivos de UI (`PricingPlans.tsx`, `PricingTeaser.tsx`) que apenas excluem
> IDs de plano prefixados com `LICENSE_` da vitrine pública. O modelo de
> entitlement real hoje é **assinatura/SaaS via AbacatePay** (`subscriptions/`,
> `useSubscription`), documentado em §8 de `docs/DOCUMENTACAO_OFICIAL.md`. O
> desenho abaixo é mantido só como registro histórico do que existiu antes do
> pivot para SaaS por assinatura:

```
Firestore: plans/LICENSE_{CODE}
  → active: boolean, usedByUid: string, durationMonths: number

Ativação (validateAndActivateLicense):
  1. Verifica existence + active + !usedByUid
  2. Batch: marca licença como usada + atualiza users/{uid}
  3. Log de auditoria em audit_logs

Verificação (checkUserLicenseStatus):
  - Super Admin (ADMIN_EMAIL) → sempre ativo, sem expiração
  - Licença expirada → active: false, expired: true
  - Licença válida → active: true, licenseExpiresAt: timestamp
```

---

## Design System — Convenções

### Tokens de Cor (ink-* obrigatório)
```css
brand-500 → #1186e7 (azul principal)
ink-50    → backgrounds extremamente leves
ink-100   → bordas e dividers suaves
ink-200   → bordas mais visíveis
ink-400   → texto terciário / ícones inativos
ink-500   → texto secundário
ink-700   → texto primário médio
ink-900   → texto primário escuro (títulos)
```

### Regra de Design
- ✅ `text-ink-900 border-ink-100 bg-ink-50` — correto
- ❌ `text-slate-900 border-slate-200 bg-slate-50` — usar apenas em componentes legados

### Classes de Layout
```css
.module-container   /* wrapper responsivo de cada módulo */
.card               /* cartão padrão com border e shadow */
.tab-group          /* container de tabs segmentadas */
.scrollbar-hide     /* esconder scrollbar (mobile/tablets) */
.btn-primary        /* botão de ação principal */
.input              /* campo de formulário padronizado */
```

---

## Configuração de Ambiente

Variáveis obrigatórias (`.env.local`):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_ADMIN_UID=          # UID do administrador no Firebase Auth
VITE_ADMIN_EMAIL=        # E-mail do administrador
VITE_ENVIRONMENT=development
```

Variáveis opcionais:
```
VITE_ORTHANC_WORKLIST_DIR=   # Diretório local da worklist DICOM
VITE_PYTHON_PATH=python3     # Executável Python para geração .wl
```
