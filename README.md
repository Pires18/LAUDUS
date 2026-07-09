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
| PACS | Orthanc gerenciado (VM multi-tenant self-service na nuvem) ou standalone — via Agente/Proxy HTTP |
| Editor | Tiptap (ProseMirror) |
| Animações | Framer Motion |
| PWA | Vite PWA Plugin (service worker, manifest) |

---

## Módulos do Sistema

14 módulos em `src/modules/`. Detalhamento completo de cada um em
[`docs/DOCUMENTACAO_OFICIAL.md`](docs/DOCUMENTACAO_OFICIAL.md) §4 — aqui vai só um
mapa rápido, com destaque para os que têm mais superfície (Editor, LAUD.IA).

| # | Módulo | Pasta | Resumo |
|---|---|---|---|
| 1 | Dashboard | `dashboard/` | KPIs, gráficos de produtividade, timeline |
| 2 | Worklist | `worklist/` | Fila de exames, integração `.wl` DICOM, busca |
| 3 | Agendamentos | `appointments/` | Agenda semanal, marcação, envio de worklist |
| 4 | Editor de Laudos | `editor/` | Núcleo do sistema — ver detalhe abaixo |
| 5 | LAUD.IA | `laud-ia/`, `ai/` | Command Center + motor de IA — ver detalhe abaixo |
| 6 | Pacientes | `patients/` | CRUD, histórico clínico, acesso auditado (LGPD) |
| 7 | Máscaras | `templates/` | Templates de laudo por especialidade + geração por IA |
| 8 | Calculadoras | `calculators/` | 20+ calculadoras clínicas (add-on `calculators`) |
| 9 | Clínicas | `clinics/` | Unidades, cabeçalho de impressão, equipe/convites |
| 10 | PACS/DICOM | `dicom/` | Painel de conexão, provisão self-service, diagnóstico (add-on `pacs`) |
| 11 | Configurações | `settings/` | Perfil, PACS, IA, assinatura |
| 12 | Administração | `admin/` | Painel completo — usuários, financeiro, auditoria, suporte, saúde (role `admin`) |
| 13 | Export | `export/` | PDF (paged.js) e Google Docs |

### Editor de Laudos (`/src/modules/editor`)
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

### LAUD.IA (`/src/modules/laud-ia`, `/src/modules/ai`)
- **Command Center** (admin): Prompts, Contexto, Treinamento, Modelos, Snippets
- Cascata de prompts: Sistema → Área → Exame (detalhe completo em [`docs/CASCADE_PROMPTS.md`](docs/CASCADE_PROMPTS.md))
- Training mode: contexto dos últimos N laudos do médico (mimetismo de estilo)
- Configuração de modelo por modo (geração, refinamento, copiloto, template)
- Provedor de IA: Google Gemini (server-side, chave nunca exposta ao cliente)

Os demais módulos (Pacientes, Máscaras, Calculadoras, Clínicas, PACS/DICOM,
Configurações, Administração, Export) estão resumidos na tabela acima — detalhe
completo de cada um em `docs/DOCUMENTACAO_OFICIAL.md` §4.

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

PACS/DICOM **gerenciado**: o Orthanc e o Agente rodam numa **VM na nuvem**
provisionada self-service (Starter/Pro em VM compartilhada multi-tenant; Dedicado
em VM própria), a clínica só mantém um relé Tailscale (roteador GL.iNet ou PC), e
o navegador fala com a VM via Funnel HTTPS. Também é possível apontar para um
Orthanc **standalone** fora do PACS gerenciado (setup manual).

Documentação completa: [`docs/pacs/PACS_CENTRAL_MESTRE.md`](docs/pacs/PACS_CENTRAL_MESTRE.md)
(ponto de entrada), [`docs/pacs/PACS_MANUAL.md`](docs/pacs/PACS_MANUAL.md) (setup standalone).

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

- [Documentação Oficial](docs/DOCUMENTACAO_OFICIAL.md) — documento técnico mestre e fonte da verdade (arquitetura, módulos, IA, dados, segurança, API, pendências)
- [Backlog](docs/BACKLOG.md) — lista única e viva de tudo que ainda está genuinamente aberto no sistema
- [Arquitetura do repositório](src/ARCHITECTURE.md) — referência técnica enxuta de código
- [Cascata de Prompts LAUD.IA](docs/CASCADE_PROMPTS.md) — referência canônica do sistema de prompts da IA
- `docs/pacs/` — arquitetura, provisionamento e manuais de PACS/DICOM (entrada: `PACS_CENTRAL_MESTRE.md`)
- `docs/legal/` + [Política de Retenção LGPD](docs/LGPD_POLITICA_RETENCAO.md) — Termos, Privacidade, retenção de dados
- [Coeficientes FMF](docs/FMF_COEFICIENTES_EXTRAIDOS.md) — referência das calculadoras de 1º trimestre
- `docs/roadmaps/` — specs de features ainda não implementadas ou parcialmente implementadas
- `docs/archive/` — auditorias e planos já concluídos (histórico, não precisa ler para entender o estado atual)

---

## Licença

Software proprietário. Todos os direitos reservados — LAUD.US.
