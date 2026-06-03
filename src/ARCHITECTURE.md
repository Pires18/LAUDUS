# Arquitetura do Sistema — LAUD.US v3.0.1

## Visão Geral

```
src/
├── App.tsx                    # Roteamento central (ViewRenderer + Suspense)
├── main.tsx                   # Entry point React + Firebase init
├── types.ts                   # Tipos TypeScript globais (Patient, ExamRequest, etc.)
│
├── components/                # Componentes UI globais e reutilizáveis
│   ├── Sidebar.tsx            # Nav desktop (colapsável, tooltips, RBAC)
│   ├── BottomNav.tsx          # Nav mobile PWA
│   ├── Modal.tsx              # Modal acessível com AnimatePresence
│   ├── Toast.tsx              # Sistema de notificações toast
│   ├── CreateExamModal.tsx    # Modal de criação de exame
│   ├── SupportModal.tsx       # Modal de suporte (chat interno)
│   ├── LogoIcon.tsx           # SVG do logo LAUD.US
│   └── AreaIcon.tsx           # Ícone dinâmico por especialidade médica
│
├── store/                     # Estado global e persistência
│   ├── app.ts                 # Zustand store principal (view, settings, modais)
│   └── db.ts                  # Helpers Firestore CRUD + lógica PACS/proxy
│
├── hooks/                     # Custom hooks reutilizáveis
│   ├── useAuth.ts             # Firebase Auth listener
│   ├── useAdmin.ts            # Verificação de role admin
│   └── useFirestore.ts        # useDocument<T> e useCollection<T> com realtime
│
├── styles/
│   └── index.css              # Design System: tokens, animações, print, responsividade
│
├── utils/
│   ├── format.ts              # formatDate, calculateAge, classNames, etc.
│   └── ...
│
└── modules/                   # Módulos de negócio por feature
    ├── dashboard/             # KPIs e gráficos
    ├── worklist/              # Fila de exames + integração Orthanc Worklist
    ├── editor/                # Editor de laudos (maior módulo)
    │   ├── ExamEditor.tsx     # Orquestrador central — PACS, print, status
    │   ├── LaudCopilot.tsx    # Chat IA por exame (streaming)
    │   ├── RichEditor.tsx     # Editor Tiptap com toolbar
    │   ├── components/        # Subcomponentes do editor
    │   │   ├── EditorHeader.tsx
    │   │   ├── EditorToolbar.tsx
    │   │   ├── DicomImagesModal.tsx
    │   │   ├── DicomThumbnail.tsx
    │   │   ├── ExamHistoryModal.tsx
    │   │   ├── AnamnesisConsentModal.tsx
    │   │   └── ReportVersionsModal.tsx
    │   └── hooks/
    │       ├── useExamActions.ts    # Geração IA, refinamento, save debounced
    │       └── useGoogleDocs.ts     # Criação/deleção Google Docs
    ├── laud-ia/               # Command Center LAUD.IA
    │   └── SharedLaudIA.tsx
    ├── ai/                    # Integração com LLMs
    │   ├── gemini.ts          # Google Gemini API (streaming, multi-modal)
    │   ├── generateTemplate.ts # Geração de templates via IA
    │   └── prompts/           # Construção hierárquica de prompts
    ├── patients/              # Módulo de pacientes
    ├── templates/             # Máscaras de laudo
    ├── clinics/               # Gestão de clínicas
    ├── calculators/           # Calculadoras clínicas
    ├── settings/              # Configurações do usuário
    ├── admin/                 # Painel admin
    └── export/                # Impressão e exportação
        ├── PrintLayout.tsx    # Layout de laudo para impressão
        ├── PrintImagesLayout.tsx  # Layout de imagens DICOM para impressão
        └── docxExport.ts      # Exportação para clipboard/DOCX
```

---

## Fluxo de Dados

```
Firebase Auth
    ↓
useAuth() hook
    ↓
App.tsx (viewRenderer)
    ↓ Zustand store (useApp)
Módulos ←→ useFirestore() hooks ←→ Firestore Realtime
                                         ↓
                               Zustand app state
                                         ↓
                               Componentes React
```

### Estado Global (Zustand — `store/app.ts`)
```typescript
{
  view: ViewState                 // Módulo ativo e parâmetros
  settings: AppSettings           // Configurações salvas
  selectedClinicId: string|null   // Filtro de clínica ativo
  showCreateExamModal: boolean
  showSupportModal: boolean
  toast: ToastMessage | null
  // Actions: setView, setSettings, showToast, setSelectedClinic, ...
}
```

---

## Integração PACS/DICOM

### Conexão
```
Browser
  → AgentProxy (http://localhost:PORT)
    → Orthanc Primário (localhost:8042 ou Tailscale URL)
    → Orthanc Backup (URL configurável)
```

### Busca de Estudos (ExamEditor.tsx: `locateStudies`)
```
Fase 1 — Identificadores exatos (paralelo):
  - /tools/find { StudyInstanceUID: "1.2.276.0.7230010.3.1.2.{examId}" }
  - /tools/find { AccessionNumber: examId }
  - /tools/find { AccessionNumber: friendlyId } (se existir)
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
Refs usadas em vez de deps do useEffect para evitar recriar o intervalo
```

### Impressão de Imagens
```
Grids disponíveis:
  1x2 → 1 coluna × 2 linhas = 2 imagens por página
  2x4 → 2 colunas × 4 linhas = 8 imagens por página

Fluxo:
1. Preload das imagens via fetch (URL do proxy)
2. Renderização em PrintImagesLayout.tsx (portal no document.body)
3. document.body.classList.add('print-mode-images')
4. window.print()
5. Limpeza após impressão
```

---

## Hierarquia de Prompts LAUD.IA

```
1. aiMasterPrompt        ← Instrução mestra global
2. normalDoctrine        ← Doutrina de Normalidade Habitual
3. aiGlobalInstructions  ← Regras gerais
4. aiRigidRules          ← Regras nunca quebradas
5. aiStructurePrompt     ← Estrutura obrigatória do laudo
6. aiAreaPrompts[area]   ← Prompt específico da especialidade
7. template.aiInstructions ← Instruções do template
8. aiTraining            ← Exemplos de laudos anteriores do médico
```

---

## RBAC (Controle de Acesso)

| Role | Dashboard | Worklist | Editor | Templates | LAUD.IA | Clínicas | Admin |
|---|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `medico` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `recepcao` | ✅ | ✅ | view-only | ❌ | ❌ | ❌ | ❌ |

> Recepção não pode finalizar laudos nem acessar LAUD.IA ou Templates.

---

## Design System — Convenções

### Tokens de Cor (ink-* obrigatório)
```css
ink-50  → backgrounds extremamente leves
ink-100 → bordas e dividers
ink-200 → bordas mais visíveis
ink-400 → texto terciário / ícones inativos
ink-500 → texto secundário
ink-700 → texto primário médio
ink-900 → texto primário escuro (títulos)
```

### Regra de Design
- ✅ `text-ink-900 border-ink-100 bg-ink-50` — correto
- ❌ `text-slate-900 border-slate-200 bg-slate-50` — usar apenas em componentes herdados

### Classes de Layout
```css
.module-container   /* wrapper responsivo de cada módulo */
.card               /* cartão padrão com border e shadow */
.tab-group          /* container de tabs segmentadas */
.scrollbar-hide     /* esconder scrollbar (mobile/tablets) */
.btn-primary        /* botão de ação principal */
.input              /* campo de formulário padronizado */
```
