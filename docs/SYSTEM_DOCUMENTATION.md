# LAUD.US — Documentação Técnica Oficial do Sistema
**Versão:** 2.0 · **Data:** Junho 2026 · **Autor:** Análise Estrutural Claude Code

---

## 1. VISÃO GERAL DO SISTEMA

**LAUD.US** é um sistema profissional de laudos ultrassonográficos potencializado por inteligência artificial, construído como Single Page Application (SPA) com suporte a PWA (Progressive Web App). O sistema atende clínicas e médicos ultrassonografistas, cobrindo todo o fluxo clínico: agendamento → worklist → geração de laudo → exportação → arquivamento PACS.

### 1.1 Identidade Técnica

| Atributo | Valor |
|---|---|
| Nome | LAUD.US |
| Versão | 2.0.0 |
| Tipo | SPA + PWA |
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilo | Tailwind CSS 3.4 + PostCSS |
| Animações | Framer Motion 12 |
| Editor de Texto | TipTap 2.x (ProseMirror) |
| State Management | Zustand 5 (com persist middleware) |
| Backend/DB | Firebase Firestore (Cloud NoSQL) |
| Autenticação | Firebase Auth (Google OAuth) |
| Deploy | Vercel (Serverless Functions) |
| IA Principal | Anthropic Claude (claude-3-5-sonnet-latest) |
| IA Alternativa | Google Gemini (2.5 Flash / 2.5 Pro) |
| PACS | Orthanc Server (DICOM) |
| Integração Docs | Google Docs / Google Drive |
| Exportação | DOCX (docx lib) + Print CSS |

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Camadas Arquiteturais

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — APRESENTAÇÃO (Frontend React)                       │
│  App.tsx → AuthRouter → UserAccessGate → ViewRenderer          │
│  Módulos: Dashboard, Worklist, ExamEditor, Patients,           │
│           Appointments, Templates, Calculators, Admin, LAUD.IA │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 2 — LÓGICA DE NEGÓCIO (Hooks + Store)                  │
│  useApp (Zustand) · useFirestore · useExamActions              │
│  useGoogleDocs · useDicomSync · useVoiceAnalyzer               │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 3 — MOTOR DE IA (engine.ts)                            │
│  buildPrompt → AnthropicProvider / GeminiProvider              │
│  Cascata 3 camadas · Streaming SSE · RAG Clínico               │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 4 — DADOS (Firebase Firestore)                         │
│  Multi-tenant user-scoped: users/{uid}/{collection}            │
│  Coleções globais: users, plans, audit_logs, system            │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 5 — INFRAESTRUTURA EXTERNA                             │
│  Vercel Serverless: /api/anthropic, /api/orthanc-proxy,       │
│  /api/worklist · Google Docs API · Firebase Auth               │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 6 — PACS/DICOM (Orthanc)                              │
│  Servidor Principal + Backup · Worklist .wl · Stone/OHIF       │
│  Tailscale VPN para acesso remoto seguro                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Diretórios

```
/src
  /components         — Componentes globais reutilizáveis
    Sidebar.tsx       — Navegação lateral desktop
    BottomNav.tsx     — Navegação mobile
    CommandPalette.tsx — Busca global ⌘K
    Toast.tsx         — Sistema de notificações
    LoginScreen.tsx   — Tela de autenticação Google
    LicenseActivationScreen.tsx — Ativação por código
    ConfirmDialog.tsx — Diálogos de confirmação global
    BroadcastBanner.tsx — Avisos do sistema (admin)
    CreateExamModal.tsx — Modal criação rápida de exame
    PWAUpdatePrompt.tsx — Atualização de service worker
    OfflineBanner.tsx  — Detecção offline

  /modules
    /admin            — Painel administrativo (RBAC)
      submodules:     AdminUsers, AdminLicenses, AdminPlans,
                      AdminMasks, AdminLaudIA, AdminAudit, AdminSupport
    /ai               — Motor cognitivo LAUD.IA
      engine.ts       — Orquestrador principal
      /providers      — AnthropicProvider, GeminiProvider
      /prompts        — general.ts, areaPrompts.ts, template.ts
      generateTemplate.ts — Geração automática de máscaras
      json.ts         — Parser robusto de JSON para extração
    /appointments     — Módulo de agendamento
    /calculators      — 19 calculadoras clínicas especializadas
    /clinics          — Gestão de unidades/clínicas
    /dashboard        — Dashboard com métricas e KPIs
    /editor           — Editor de laudos (núcleo do sistema)
      ExamEditor.tsx  — Componente principal (1563 linhas)
      LaudCopilot.tsx — Assistente IA conversacional
      RichEditor.tsx  — Editor TipTap customizado
      /components     — EditorHeader, EditorToolbar,
                        DicomImagesModal, ReportVersionsModal,
                        AnamnesisConsentModal, ExamHistoryModal
      /hooks          — useExamActions, useGoogleDocs,
                        useDicomSync, useVoiceAnalyzer
    /export           — PrintLayout, PrintImagesLayout, docxExport
    /laud-ia          — Playground de configuração de IA
      SharedLaudIA.tsx — Interface completa (prompts, engine, status)
    /patients         — Cadastro e histórico de pacientes
    /settings         — Configurações do sistema
    /templates        — Gestão de máscaras de laudo
    /worklist         — Fila de trabalho clínica

  /store
    app.ts            — Estado global (Zustand + persist)
    db.ts             — Camada de acesso ao Firestore
    adminUsers.ts     — Operações admin de usuários

  /hooks
    useAuth.ts        — Hook de autenticação
    useAdmin.ts       — Hook de verificação de papel admin
    useFirestore.ts   — useDocument e useCollection (realtime)
    useConfirm.ts     — Hook de confirmação global

  /lib
    firebase.ts       — Inicialização do Firebase SDK
    googleAuth.ts     — OAuth Google para Docs/Drive
    googleDocs.ts     — Criação e manipulação de Google Docs
    googleDrive.ts    — Upload e gestão de arquivos no Drive

  /utils
    dicom.ts          — Utilitários DICOM (StudyInstanceUID)
    format.ts         — Formatadores e classNames
    logger.ts         — Logger estruturado (prod-safe)
    sanitizeHtml.ts   — Sanitização de HTML para segurança

  /types.ts           — Todos os tipos TypeScript centrais
  /config/constants.ts — ADMIN_UID, ADMIN_EMAIL, constantes

/api                  — Serverless Functions (Vercel)
  anthropic.ts        — Proxy para API da Anthropic (SSE)
  orthanc-proxy.ts    — Proxy PACS/Orthanc (CORS bypass)
  worklist.ts         — Gerenciamento de arquivos .wl DICOM
```

---

## 3. MODELO DE DADOS

### 3.1 Estrutura Firestore

**Coleções user-scoped** (isoladas por usuário):
```
users/{uid}/
  exams/          — ExamRequest (laudos)
  patients/       — Patient (pacientes)
  templates/      — ReportTemplate (máscaras)
    {id}/versions — Histórico de versões automático
  clinics/        — Clinic (unidades)
  appointments/   — Appointment (agendamentos)
  settings/app    — AppSettings (configurações)
  ai_usage/       — AiUsageLog (rastreio de tokens/custo)
```

**Coleções globais** (compartilhadas):
```
users/{uid}       — Perfil do usuário + dados de licença
plans/            — Planos e códigos de licença (LICENSE_{code})
audit_logs/       — Trilha de auditoria completa do sistema
system/broadcast  — Mensagem global do administrador
support_tickets/  — Chamados de suporte
```

### 3.2 Tipo ExamRequest (Laudo)

```typescript
{
  id, friendlyId, patientId, clinicId, area, examType,
  templateId, scheduledAt, requestingPhysician, examDate,
  clinicalIndication, status: 'pendente'|'em-andamento'|'finalizado',
  reportContent,          // HTML do laudo
  googleDocId, googleDocUrl,
  unlockHistory,          // Auditoria de reabertura
  chatHistory,            // Histórico do Copiloto IA
  customFormValue,        // Formulário customizado
  anamnesis, consentTerm, consentAccepted, consentAcceptedAt,
  reportVersions,         // Histórico de versões (trigger: generation|refine|copilot|manual)
  calculatorData          // Dados salvos das calculadoras
}
```

### 3.3 Tipo AppSettings (Configurações)

As configurações abrangem ~60 campos organizados em grupos:
- **IA**: provider, modelos, temperatura, prompts por camada, área e modo
- **Médico**: nome, CRM, RQE, assinatura, doutrina de normalidade
- **Clínica**: nome, endereço, telefone, clínica padrão
- **DICOM/PACS**: URLs, credenciais, AE Titles, configuração primária e backup
- **Sistema**: autoSave, soundNotifications, snippets, modelo por modo

---

## 4. MOTOR DE IA (LAUD.IA ENGINE)

### 4.1 Cascata de Prompts (3 Camadas)

```
SYSTEM CONTEXT:
├── BLOCO 1 — Doutrina Mestre (identidade, NÃO INVENÇÃO, cascata clínica)
├── BLOCO 2 — Raciocínio Clínico Global (diagnóstico diferencial, proporcionalidade)
├── BLOCO 3 — Skeleton HTML (estrutura obrigatória de seções)
├── BLOCO 4 — Compliance & Segurança (regras invioláveis)
├── CAMADA 2 — Diretriz da Área (10 especialidades)  ← admin customizável
└── CAMADA 3 — Instruções do Exame Específico        ← por template

USER MESSAGE:
└── Contexto clínico (paciente, data, indicação, anamnese, notas)
    + Máscara de referência HTML
    + RAG: últimos laudos (estilo) + histórico do paciente (clínico)
```

### 4.2 Modos Operacionais

| Modo | Função | Temperatura Padrão | Max Tokens |
|---|---|---|---|
| `generation` | Geração inicial do laudo | 0.35 | por área (até 16384) |
| `refine` | Refinamento estrutural (⌘G) | 0.10 | por área |
| `copilot` | Assistente conversacional | 0.20 | por área |
| `template` | Geração de novas máscaras | 0.20 | padrão |

### 4.3 RAG Clínico

**Contexto de Estilo** (`getRecentFinalizedReports`):
- Busca os N últimos laudos finalizados do mesmo template/área
- Injeta como exemplos de mimetização de estilo de escrita
- Truncagem inteligente por tokens (budget: 3500 tokens)

**Contexto Clínico do Paciente** (`getPatientPreviousExams`):
- Busca laudos anteriores do mesmo paciente, na mesma especialidade
- IA deve identificar e narrar a evolução cronológica
- Budget separado: 2500 tokens

### 4.4 Provedores de IA

**AnthropicProvider**:
- Modelos: `claude-3-5-sonnet-latest`, `claude-3-7-sonnet-latest`, `claude-opus-4-5`
- Streaming SSE via ReadableStream
- Prompt Caching (`cache_control: ephemeral` no BLOCO 1)
- Extended Thinking para claude-3-7 e opus-4
- Retry com exponential backoff (429, 503, overloaded)
- JSON extraction via claude-3-haiku-20240307 (menor custo)
- Proxy: `/api/anthropic` (Vercel serverless)

**GeminiProvider**:
- Modelos: `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-06-05`
- Suporte a streaming nativo
- Resolução de model aliases (`gemini-3.5-flash` → alias legado)

### 4.5 Métricas e Custo

O sistema rastreia automaticamente cada chamada de IA:
- Tokens estimados de input/output (heurística: 1 token ≈ 3.5 chars pt-BR)
- Custo USD calculado pela tabela `PRICING` (por modelo)
- Persistência em `ai_usage/` no Firestore
- Hash do prompt para detecção de duplicatas
- Histórico de até 20 chamadas em memória (`callMetricsHistory`)

### 4.6 Quality Audit Local

`auditReportQuality(html, area)` retorna score 0-100 e issues:
- Estrutura: verifica abertura com `<h1>`
- Seções obrigatórias: TÉCNICA, ANÁLISE, CONCLUSÃO, RECOMENDAÇÕES, OBSERVAÇÕES METODOLÓGICAS
- Placeholders residuais: `(...)`, `[___]`, `____cm`, `[valor]`
- Bullets: CONCLUSÃO e RECOMENDAÇÕES devem usar `• `
- Tags proibidas: `<script>`, `<style>`, `<iframe>`, `<div>`, `<span>`
- Markdown residual: `**bold**`, `## heading`
- Alerta obstétrico: diástole zero sem `ALERTA` nas recomendações

---

## 5. MÓDULO EDITOR DE LAUDOS

O `ExamEditor.tsx` é o componente central do sistema (~1563 linhas).

### 5.1 Funcionalidades

- **Editor Rico** (TipTap/ProseMirror): bold, italic, underline, alinhamento, placeholders
- **Geração IA** (⌘G): geração ou refinamento com streaming em tempo real
- **LaudCopilot**: assistente conversacional flutuante (FAB) com histórico de chat
- **DICOM Viewer Integrado**: sidebar com thumbnails, navegação, fullscreen
- **Visualizador Externo**: abertura em Stone Viewer / OHIF / OE2
- **Calculadoras**: modal com 19 calculadoras clínicas integradas
- **Frases Prontas**: snippets por área inseridos no cursor
- **Anamnese & Consentimento**: modal com geração IA e assinatura digital
- **Versionamento**: histórico de versões com diff e rollback
- **Google Docs**: criação automática ao finalizar exame
- **Exportação**: Print CSS otimizado + DOCX
- **Print de Imagens**: grid configurável de imagens DICOM (PDF)
- **Auditoria de Desbloqueio**: justificativa obrigatória para reabrir laudo finalizado

### 5.2 Atalhos de Teclado

| Atalho | Ação |
|---|---|
| ⌘G | Gerar/Refinar com IA |
| ⌘S | Salvar manualmente |
| ⌘P | Imprimir laudo |
| ⌘↵ | Finalizar exame |
| ⌘⇧C | Copiar laudo para clipboard |
| ⌘⇧R | Reiniciar laudo para máscara |
| ← / → / ↑ / ↓ | Navegação DICOM (imagens) |

### 5.3 RBAC no Editor

| Papel | Gerar IA | Finalizar | Desbloquear | Editar |
|---|---|---|---|---|
| medico | ✅ | ✅ | ✅ | ✅ |
| recepcao | ❌ | ❌ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

---

## 6. INTEGRAÇÃO DICOM/PACS

### 6.1 Arquitetura DICOM

- **Servidor**: Orthanc (open-source DICOM server)
- **Protocolo**: HTTP REST API do Orthanc
- **Busca**: por PatientName (fuzzy) + StudyDate ± 1 dia
- **Thumbnails**: `/instances/{id}/preview` via proxy autenticado
- **Worklist**: geração de arquivos `.wl` para integração com equipamentos US
- **Viewers suportados**: Stone Webviewer, OHIF, Orthanc Explorer 2, Custom URL
- **Redundância**: configuração de servidor principal + backup com failover

### 6.2 Hook useDicomSync

Responsável por:
1. Detectar conectividade com PACS primário e backup
2. Buscar estudos candidatos pelo nome do paciente
3. Selecionar automaticamente o estudo mais provável
4. Listar instâncias DICOM do estudo selecionado
5. Gerenciar estado de loading/error com mensagens descritivas

### 6.3 Proxy PACS

Dois modos de operação:
- **Desenvolvimento**: `/api/orthanc-proxy` (Next.js/Vercel local)
- **Produção Vercel + VPN**: roteamento via Tailscale HTTPS (`dicomLocalAgentUrl`)
- **Produção Local**: acesso direto via URL local

---

## 7. SISTEMA DE LICENCIAMENTO

### 7.1 Fluxo de Ativação

```
1. Usuário faz login Google (Firebase Auth)
2. UserAccessGate → verifica doc em users/{uid}
3. Se não existe OU active=false → LicenseActivationScreen
4. Usuário digita código LAUD-XXXX-XXXX-XXXX
5. validateAndActivateLicense():
   a. Verifica plans/LICENSE_{code}
   b. Checa se não foi usada (usedByUid)
   c. Calcula expiresAt (durationMonths × 30 dias)
   d. Batch write: marca licença como usada + cria/atualiza users/{uid}
   e. Loga em audit_logs
6. Reload → acesso liberado
```

### 7.2 Papéis (RBAC)

| Papel | Descrição | Acesso |
|---|---|---|
| `admin` | Super Admin | Tudo + painel admin + bypass de licença |
| `medico` | Médico padrão | Todos os módulos clínicos |
| `recepcao` | Secretária | Worklist, pacientes, agendamentos (sem editar laudos) |

---

## 8. CALCULADORAS CLÍNICAS

O sistema possui **19 calculadoras** especializadas em ultrassonografia:

| Calculadora | Área |
|---|---|
| GestationalAgeCalculator | Medicina Fetal |
| CrlCalculator | Medicina Fetal |
| WhoFetalBiometryCalculator | Medicina Fetal |
| BarcelonaFetalGrowthCalculator | Medicina Fetal |
| AmnioticFluidCalculator | Medicina Fetal |
| DopplerCalculator | Medicina Fetal / Vascular |
| FigoCalculator | Ginecologia |
| OradsCalculator | Ginecologia |
| BiradsCalculator | Mastologia |
| TiradsCalculator | Pequenas Partes |
| ImtCalculator | Vascular |
| VascularRatiosCalculator | Vascular |
| IvcIndexCalculator | Vascular |
| VenousCartographyCalculator | Vascular |
| PleuralEffusionCalculator | Medicina Interna |
| ProstateWeightCalculator | Medicina Interna |
| MsdCalculator | Medicina Interna |
| VolumeCalculator | Universal |
| OrganReferenceCalculator | Universal |

**Funcionalidades das calculadoras**:
- Integração com IA para extração automática de dados do laudo (`extractCalculatorData`)
- Dados salvos por exame no Firestore (`calculatorData`)
- Envio de resultado para o Copiloto IA ou formulário customizado
- Persistência entre sessões

---

## 9. ESPECIALIDADES MÉDICAS SUPORTADAS

| Área | ID | Templates Padrão |
|---|---|---|
| Medicina Interna | `medicina-interna` | Abdome, Rins, Tireoide, etc. |
| Ginecologia | `ginecologia` | TV, TA, ORADS, FIGO |
| Medicina Fetal | `medicina-fetal` | Morfológico 1º/2º/3º trim., Doppler |
| Pequenas Partes | `pequenas-partes` | Tireoide TI-RADS, Testículo, etc. |
| Musculoesquelético | `musculoesqueletico` | Tendões, articulações |
| Vascular | `vascular` | Carótidas, IMT, membro inferior |
| Reumatológico | `reumatologico` | Articulações, bursas |
| Pediatria | `pediatria` | Cranial neonatal, abdominal |
| Procedimentos | `procedimentos` | Punção, biópsia guiada |
| Mastologia | `mastologia` | BI-RADS, linfonodos |

---

## 10. SEGURANÇA E CONFORMIDADE

### 10.1 Isolamento de Dados

- **Multi-tenant**: todos os dados clínicos isolados em `users/{uid}/`
- **Regras Firestore**: users só acessam os próprios documentos
- **Templates admin**: fallback de leitura ao admin UID (sem escrita)
- **Settings admin**: prompts globais propagados para todos os usuários

### 10.2 Sanitização

- `sanitize()` em toda escrita no Firestore (remove `undefined`)
- `sanitizeHtml.ts` para conteúdo HTML de laudos
- Proxy PACS isola credenciais do servidor do client-side

### 10.3 Auditoria

Todo evento sensível é registrado em `audit_logs`:
- Ativação de licença
- Finalização de exames
- Desbloqueio de laudos (com justificativa obrigatória)
- Ações administrativas

### 10.4 Chaves de API

- Chaves da Anthropic e Gemini armazenadas no Firestore `settings` do usuário
- **Nunca** propagadas do admin para outros usuários (isolamento estrito)
- Passadas via header `x-api-key` no proxy serverless

---

## 11. INTEGRAÇÕES EXTERNAS

### 11.1 Google Docs / Drive

- **Criação automática**: ao finalizar exame, se clínica tem `googleDocsTemplateId`
- **Template clone**: copia o documento template da clínica
- **Inserção de conteúdo**: substitui o HTML do laudo no documento
- **Cabeçalho/Rodapé**: HTML customizável por clínica
- **Embedded editor**: exames finalizados exibem o Google Doc inline via `<iframe>`
- **Exclusão ao desbloquear**: Google Doc removido quando laudo é reaberto

### 11.2 Exportação DOCX

- Via biblioteca `docx` (pure JavaScript)
- Inclui dados do paciente, clínica, médico, assinatura
- Cópia para clipboard em formato rico (RTF-compatible)

### 11.3 Impressão

- `PrintLayout`: laudo com cabeçalho/rodapé da clínica, logo, assinatura
- `PrintImagesLayout`: grade configurável de imagens DICOM (1×2, 2×4, etc.)
- Título do documento customizado com: data, paciente, exame, clínica

---

## 12. INFRAESTRUTURA DE DEPLOY

### 12.1 Ambientes

| Ambiente | URL | Notas |
|---|---|---|
| Produção | laud.us (Vercel) | Tailscale para PACS |
| Desenvolvimento | localhost:5173 | PACS via URL local |
| Preview | *.vercel.app | Configuração staging |

### 12.2 Serverless Functions (Vercel)

```
/api/anthropic.ts     — Proxy Anthropic API + SSE streaming
/api/orthanc-proxy.ts — Proxy PACS com autenticação Basic Auth
/api/worklist.ts      — CRUD de arquivos .wl DICOM (via agente local)
```

### 12.3 Docker / Self-hosted

`Dockerfile` e `docker-compose.yml` disponíveis para deploy self-hosted com Nginx como reverse proxy.

---

## 13. GLOSSÁRIO TÉCNICO

| Termo | Definição |
|---|---|
| Laudo | Relatório médico de ultrassonografia |
| Máscara | Template de laudo com estrutura pré-definida (ReportTemplate) |
| Worklist | Fila de exames pendentes |
| Copiloto | Assistente IA conversacional dentro do editor |
| Refinamento | Processo de melhoria estrutural do laudo pela IA (⌘G) |
| PACS | Picture Archiving and Communication System (Orthanc) |
| DICOM | Digital Imaging and Communications in Medicine |
| Worklist .wl | Arquivo de entrada de exame para o equipamento de US |
| RAG | Retrieval-Augmented Generation (contexto clínico da IA) |
| Scratchpad | Bloco de raciocínio interno da IA (stripped antes de exibir) |
| Score QA | Pontuação 0-100 da qualidade do laudo gerado |
| Cascata | Sistema de 3 camadas de prompts da LAUD.IA |
| Doutrina | Instrução mestre de normalidade habitual do médico |
| AE Title | Application Entity Title (identificador DICOM do equipamento) |

---

*Documentação gerada em 19/06/2026 via análise estática completa do codebase LAUD.US v2.0*
