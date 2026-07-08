# LAUD.US

> **Plataforma profissional de laudos ultrassonográficos com IA integrada**

LAUD.US é um sistema web PWA de gestão clínica para laudos de ultrassonografia, com copiloto de IA (LAUD.IA), integração PACS/DICOM via Orthanc, worklist em tempo real e editor rich-text.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS v3 + CSS Modules |
| Estado Global | Zustand |
| Banco de Dados | Firebase Firestore (realtime) |
| Autenticação | Firebase Auth (Google + Email) |
| IA | Google Gemini via proxy server-side (Lite: `gemini-3.5-flash` · Pro: `gemini-3.1-pro-preview`) |
| PACS | Orthanc (primário + backup) via Proxy HTTP local |
| Editor | Tiptap (ProseMirror) |
| Animações | Framer Motion |
| PWA | Vite PWA Plugin (service worker, manifest) |

---

## Módulos do Sistema

### 1. Dashboard (`/src/modules/dashboard`)
- KPIs em tempo real: exames pendentes, finalizados, pacientes
- Gráficos de produtividade por área e período
- Timeline de atividade

### 2. Worklist (`/src/modules/worklist`)
- Fila de exames com filtros avançados (status, área, data, clínica)
- Integração com Worklist DICOM (Orthanc): cria/remove arquivos `.wl` no servidor
- Busca full-text em paciente, tipo de exame e ID amigável
- Layout responsivo: tabela no desktop, cards no mobile

### 3. Editor de Laudos (`/src/modules/editor`)
- **ExamEditor**: componente central — gerencia todo o ciclo de vida do laudo
- **RichEditor**: Tiptap com atalhos, toolbar formatação, placeholder dinâmico
- **LaudCopilot**: Chat IA por exame com streaming de resposta
- **EditorHeader**: Header sticky com info do paciente + ações rápidas
- **EditorToolbar**: Barra de ferramentas (Copiloto, Snippets, Calculadoras, DICOM, Versões)
- **Hooks**:
  - `useExamActions` — geração/refinamento IA, save debounced, troca de status
  - `useGoogleDocs` — criação/deleção de Google Docs ao finalizar
- **PACS/DICOM**:
  - Polling inteligente (5s viewer aberto / 30s background)
  - Busca bifásica: StudyInstanceUID/AccessionNumber → PatientID fallback
  - Scoring por proximidade temporal ao exame
  - Suporte a servidor primário + backup com failover
  - Visualizador integrado + lightbox fullscreen
  - Impressão de imagens: layout **1×2** (2 fotos/pág) ou **2×4** (8 fotos/pág)

### 4. LAUD.IA (`/src/modules/laud-ia`)
- **Command Center**: 5 abas — Prompts, Contexto, Treinamento, Modelos, Snippets
- Prompt hierárquico: Master → Área → Template → Instrução
- Training mode: contexto dos últimos N laudos do médico
- Configuração de modelo por modo (geração, refinamento, copiloto, template)
- Provedor de IA: Google Gemini (server-side, chave nunca exposta ao cliente)

### 5. Pacientes (`/src/modules/patients`)
- CRUD completo: cadastro, histórico clínico, laudos anteriores

### 6. Máscaras (`/src/modules/templates`)
- Templates de laudo por área médica (10 especialidades)
- Editor de template com placeholders, anamnese, termo de consentimento
- IA para geração automática de templates

### 7. Calculadoras (`/src/modules/calculators`)
- Hadlock (biometria fetal), IG, IMC, etc.
- Dados salvos por exame no Firestore

### 8. Clínicas (`/src/modules/clinics`)
- CRUD de unidades de atendimento
- Logotipo, cabeçalho/rodapé de impressão, Google Docs template
- Seletor de clínica no Sidebar com filtro de worklist

### 9. Configurações (`/src/modules/settings`)
- Perfil do médico (nome, CRM, RQE, assinatura)
- PACS/DICOM: URLs primário/backup, credenciais, tipo de viewer, proxy
- IA: API keys, modelos, temperatura, prompts globais

### 10. Administração (`/src/modules/admin`)
- Painel admin: usuários, planos, licenças, auditoria, financeiro
- Só acessível por usuários com role `admin`

---

## Responsividade

| Breakpoint | Largura | Layout |
|---|---|---|
| Mobile | < 475px | BottomNav, cards stack, modais sheet |
| XS | 475–639px | BottomNav, layout híbrido |
| Tablet (SM) | 640–767px | BottomNav, 2 colunas |
| Tablet (MD) | 768–1023px | Sidebar **colapsada** automática |
| Desktop | ≥ 1024px | Sidebar expandida, tabela completa |

---

## Integração PACS

O sistema conecta-se a servidores Orthanc locais via um **agente proxy HTTP** que contorna restrições CORS do navegador.

### Fluxo de Conexão
```
Browser → Agente Local (localhost:PORT) → Orthanc (localhost:8042 ou Tailscale)
```

### Localização de Estudos (Bifásica)
1. **Fase 1 — Identificadores exatos**: `StudyInstanceUID` e `AccessionNumber`
2. **Fase 2 — Fallback por PatientID**: se nenhum estudo for encontrado na fase 1

### Servidor Backup
Quando configurado, o sistema busca em ambos os servidores (primário e backup) em paralelo e prioriza o servidor primário em caso de duplicatas.

---

## Design System

### Tokens de Cor
```
brand-500: #1186e7  (azul principal)
ink-900:   #343945  (texto primário)
ink-500:   #67748d  (texto secundário)
ink-100:   #eceef2  (bordas leves)
```

**Importante:** usar sempre `ink-*` para greys/neutros. Evitar `slate-*`, `gray-*` direto.

### Classes Utilitárias Principais
- `.module-container` — wrapper responsivo dos módulos
- `.card`, `.card-premium` — cartões
- `.btn`, `.btn-primary`, etc. — botões padronizados
- `.input`, `.label` — formulários
- `.tab-group`, `.tab-item` — tabs segmentadas
- `.scrollbar-hide` — esconder scrollbar (mobile)
- `.animate-fade-in`, `.animate-slide-up`, etc. — animações

---

## Scripts

```bash
npm run dev      # Servidor de desenvolvimento (Vite)
npm run build    # Build de produção
npm run preview  # Preview do build de produção
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha. Node **22.x** é exigido (ver `engines`).

**Cliente (Vite — expostas no browser, prefixo `VITE_`):**
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Servidor (proxies `api/*` — nunca expostas ao browser):**
```env
# Chave de IA — server-side (o cliente NÃO envia mais a chave)
GOOGLE_API_KEY=...
# Admin SDK do Firebase (usado por api/_firebase, _edgeAuth, webhooks)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
# Pagamentos e cron (se usar)
ABACATEPAY_API_KEY=...
ABACATEPAY_WEBHOOK_SECRET=...
CRON_SECRET=...
# Monitoramento de erros (opcional)
VITE_SENTRY_DSN=
```

> **Dev local:** `npm run dev` (Vite) já intermedia `/api/gemini` para a API real — coloque `GOOGLE_API_KEY` no `.env` que o proxy de dev a usa (sem precisar de chave na UI). As demais vars de servidor só são necessárias ao rodar as funções serverless (`vercel dev`) ou em produção na Vercel.

---

## Versões

Histórico completo de versões em [CHANGELOG.md](CHANGELOG.md).

---

## Documentação

- [Documentação Oficial](docs/DOCUMENTACAO_OFICIAL.md) — documento técnico mestre (arquitetura, módulos, IA, dados, segurança, API)
- [Arquitetura do repositório](src/ARCHITECTURE.md)
- [Auditoria Completa 07/07](docs/AUDITORIA_COMPLETA_2026-07-07.md) — estado atual de dívida técnica, testes, performance e documentação
- [Plano de Melhorias](docs/PLANO_MELHORIAS_2026-07.md) — board de execução ativo (substitui o Plano de Refinamento anterior)
- [Auditoria do Admin](docs/AUDITORIA_ADMIN_2026-07.md) + [Plano de Finalização do Admin](docs/archive/PLANO_FINALIZACAO_ADMIN_2026-07.md) (arquivado — 100% executado) — auditoria completa das 8 abas do painel administrativo
- [Auditoria do Financeiro](docs/AUDITORIA_FINANCEIRO_2026-07.md) + [Proposta de Centro Financeiro](docs/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md) — auditoria profunda das 9 abas do Financeiro (achou bugs de cálculo, não só falta de proteção); Fases A-D EXECUTADAS (16/18 itens)
- `docs/roadmaps/` — specs prontas aguardando implementação
- `docs/pacs/` — arquitetura e manuais de PACS/DICOM
- `docs/archive/` — planos e auditorias históricas (já concluídos/superados)

---

## Licença

Software proprietário. Todos os direitos reservados — LAUD.US.
