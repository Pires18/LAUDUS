# Changelog — LAUD.US

Todas as mudanças relevantes do projeto são documentadas aqui.  
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2.1.0] — 2026-06-24

### Adicionado
- **ClinicSessionModal** — ao abrir o sistema com 2+ clínicas cadastradas e sem padrão definido, o usuário é solicitado a escolher a unidade ativa da sessão, com opção de fixar como padrão
- **CollectionError** — componente de estado de erro reutilizável para coleções Firestore; exibe mensagem de falha e botão de retry
- **firestore.indexes.json** — índices compostos do Firestore para consultas críticas: `exams` (clinicId + createdAt, patientId + createdAt) e `patients` (name)
- **Settings: Centro de PDF** — nova aba dedicada a configurações de impressão; inclui prévia tipográfica ao vivo, controle de fonte/tamanho/espaçamento/alinhamento e upload de assinatura digitalizada (PNG com fundo transparente)
- **Settings: Upload de assinatura** — imagem enviada para Firebase Storage; exibida no rodapé dos laudos PDF
- **PatientDetail: Edição de histórico clínico inline** — botão de edição no card de Dados Clínicos abre textarea para editar e salvar o histórico sem modal adicional
- **PatientDetail: Acesso rápido a novo laudo** — botão "Novo Laudo" na barra de cabeçalho abre o `CreateExamModal` com o paciente pré-selecionado
- **CreateExamModal: Seletor de data do exame** — campo de data permite registrar a data real do exame independente da data de entrada no sistema
- **CreateExamModal: Auto-registro de paciente** — ao buscar um nome sem resultados, o formulário de cadastro rápido abre automaticamente com o nome já preenchido
- **CreateExamModal: Anamnese pré-preenchida** — ao selecionar um template que possui `anamnesisTemplate`, o campo de anamnese é preenchido automaticamente
- **Worklist: Paginação infinita** — migrada para `usePaginatedCollection` com lotes de 100; botão "Carregar mais" ao atingir o limite
- **Worklist: Notificações sonoras** — ao receber novos exames pendentes em tempo real, um beep suave é sintetizado via Web Audio API (pode ser desativado em Configurações)
- **Patients: Paginação e sort** — migrada para `usePaginatedCollection` (50 iniciais) com ordenação alfabética garantida no cliente
- **Templates: Tratamento de erro** — CollectionError integrado; caso a coleção falhe, exibe estado de erro acionável

### Modificado
- **Settings** — aba "PACS & Integrações" removida do fluxo principal (migrada internamente); abas ativas: Perfil, Centro de PDF, Auditoria, Assinatura & Faturamento
- **Settings: Foto de perfil** — upload direto para Firebase Storage com atualização simultânea do Firebase Auth profile e documento Firestore do usuário
- **PatientDetail** — redesign completo com cabeçalho compacto, grids de informações e seção de laudos históricos com badges de status e clínica

### Corrigido
- **Settings.tsx** — removidos 6 imports Lucide não utilizados (`Database`, `Server`, `Wifi`, `HardDrive`, `Shield`, `Cloud`) que geravam dead-code no bundle
- **CreateExamModal** — conflito de clínica inicial resolvido: usa `selectedClinicId` do contexto como primeiro critério

### Infraestrutura
- Versão bump: `2.0.0` → `2.1.0`

---

## [2.0.0] — 2026-06-21

### Adicionado (Sprint 1–4)
- Chave Anthropic server-side via Vercel Edge (`api/anthropic.ts`) com rate limiting 20 req/min por usuário
- Proxy Gemini server-side (`api/gemini.ts`) — nenhuma chave exposta no browser
- Senhas DICOM criptografadas com AES-GCM (`utils/crypto.ts`)
- Streaming SSE na geração inicial de laudos (Anthropic)
- Dashboard com KPIs reais de uso de IA (custo estimado, chamadas, hoje)
- Paginação na Worklist (`usePaginatedCollection`, 100/lote) e lazy-load em Pacientes
- Formulário clínico customizável colapsável no ExamEditor
- Sugestões proativas do Copiloto pós-geração (`useCopilotSuggestions`, claude-haiku-4-5)
- Criação automática de exame ao confirmar agendamento
- Chip de histórico clínico no EditorHeader
- Botão "Inserir no Laudo" nas calculadoras
- Preview de template antes de criar exame
- Auto-correlação DICOM por StudyDate + bônus de modalidade
- Ditado por voz (Web Speech API pt-BR) na toolbar do editor
- Vitest configurado com 32 testes passando (calculations + engine)
- ADMIN_UID/EMAIL via variáveis de ambiente VITE_*
- ErrorBoundary por módulo lazy-loaded com retry inline
- Sistema de migrations versionado (5 versões, `_settingsMigrationVersion`)
- Aliases de modelos Gemini corrigidos (`gemini-2.0-flash` como padrão)
- ExamEditor refatorado: `DicomViewerSidebar` extraído (1.616 → ~1.340 linhas)

---

## [1.x] — Versões Anteriores

Versões 1.x não possuem changelog estruturado. Ver histórico do Git.
