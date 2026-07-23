# Backlog — itens abertos conhecidos

> Lista única e viva de tudo que foi identificado como **genuinamente ainda aberto**
> durante a auditoria documental de 2026-07-08, com a origem citada. Isto substitui
> a necessidade de vasculhar `docs/archive/` atrás de pendências — se não está aqui,
> foi resolvido ou nunca foi confirmado como problema real. Atualize esta lista (não
> os documentos arquivados) conforme os itens forem sendo tratados.
>
> Para o estado atual completo do sistema, ver [`DOCUMENTACAO_OFICIAL.md`](./DOCUMENTACAO_OFICIAL.md).
>
> **Correção em 09/07/2026:** ao começar a tratar estes itens, 2 se revelaram falsos
> positivos ao verificar contra o código atual (não contra o plano arquivado que os
> originou) — removidos daqui, ver "Itens fechados" no fim. Isso confirma que todo
> item deste backlog deve ser re-verificado no código **antes** de qualquer trabalho,
> não só confiado na origem histórica.
>
> **5 itens tratados em 09/07/2026** (implementação, não só documentação — ver "Itens
> fechados" no fim para detalhe de cada um): desativação de conta no Firebase Auth ao
> excluir usuário, paginação do recálculo de transações (M2), guarda de concorrência
> Features/Recursos Extras (M3), export de transações respeitando filtros ativos,
> verificação server-side (log, não bloqueante) de consistência de `dicomTenantId`.

---

## 🟠 PACS/DICOM

- **Sem gestão de frota de VMs no painel admin** (F5 do plano de automação) — não
  encontrado no código; provisionamento funciona, mas não há visão consolidada das
  VMs ativas para o time interno.
  Origem: `docs/roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md`.

## 🔴 Admin

- **Busca/paginação de usuários ainda client-side** (Fase 3 do plano de admin) —
  deferido conscientemente até a base atingir ~1-2 mil usuários; não é bug, é gatilho
  de revisão futura.
  Origem: `docs/roadmaps/ADMIN_IMPROVEMENT_PLAN.md`.

## 🟡 Billing / Financeiro

- **Reconciliação com a API de transações da AbacatePay** — deliberadamente adiada;
  o schema da API não está documentado/confirmado.
  Origem: `docs/archive/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md` (Fase C).
- **Exportação real de billing do GCP** — bloqueado externamente, aguardando
  confirmação de ativação do billing export pelo usuário.
  Origem: `docs/archive/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md` (Fase D).

## 🔄 Atualização de sistema (PWA)

- **[FEITO] Detecção de deploy mais rápida e à prova de SW travado** — `PWAUpdatePrompt`
  ganhou gatilhos (imediato, foco, visibilitychange, online, cada troca de tela) com
  cleanup, e um `version.json` (emitido no build via `__BUILD_ID__`, único por deploy)
  que o cliente compara — sinal independente do Service Worker (recarrega até com SW
  travado). Headers: `sw.js`/`index.html`/`version.json` revalidam; `/assets/*` imutável.
- **[FEITO] Forçar atualização (crítica)** — Admin→Saúde do Sistema tem botão que grava
  `global_config/app_config.forceReloadAt`; clientes que carregaram antes recarregam,
  inclusive em tela de trabalho (após respiro pro auto-save). Rules já cobriam o doc
  (leitura por logados, escrita só admin) — sem deploy de rules.

## 💰 Custos de IA (pricing por modelo)

- **[FEITO] Preços atualizados e desduplicados** — `modelPricing.ts` (fonte única)
  corrigido com valores verificados na doc oficial do Google (21/jul/2026): 3.5-flash
  1.50/9.00, 3.6-flash 1.50/7.50, 2.5-pro 1.25/10.0, 3.1-pro-preview 2.0/12.0, etc.
  (antes reusava preços do 1.5-flash, ~20x defasado). `TelemetryDashboard` deixou de
  duplicar a tabela e passou a importar da fonte única; `DEFAULT_MOTOR` (custo/laudo)
  recalibrado com token split realista.

## 🤖 IA / LAUD.IA (motores Gemini)

- **[FEITO] IDs de modelo consolidados numa fonte única** (achados B+C da auditoria
  2026-07) — criado `src/modules/ai/geminiModels.ts` (constantes `GEMINI_LITE_MODEL`
  / `GEMINI_PRO_MODEL`, allowlist `VALID_GEMINI_MODELS`, resolvedor único
  `resolveGeminiModel(raw, motor?)`). O provider deixou de ter normalizador gêmeo
  (`resolveGeminiModelId` removido) e o `global_config/motor_config` do Firestore
  agora É honrado quando o ID está no allowlist (antes qualquer valor era colapsado
  por substring `'pro'`). IDs verificados na doc oficial do Google (jul/2026):
  Lite=`gemini-3.5-flash` (GA), Pro=`gemini-3.1-pro-preview` (preview).
- **[RESOLVIDO — achado A / 503] Pro não depende mais de modelo `-preview`** — o
  default do Pro passou a ser `gemini-2.5-pro` (GA, estável) por decisão do usuário
  (o `gemini-3.1-pro-preview` retornava 503 "overloaded" sob carga por ser preview).
  O preview segue disponível como opção consciente no Admin→Custos de IA e como alvo
  de fallback. Defesa em profundidade: **fallback automático de modelo** em
  `GeminiProvider.postWithModelFallback` cobre TODOS os caminhos user-facing
  (generate, stream, refino, copiloto-chat, `extractJson`/estruturado e copiloto
  inline em `useCopilotSuggestions`): em 503/404 tenta uma vez o GA de contingência
  (`GEMINI_FALLBACK` em geminiModels.ts). Alternativa de economia no Lite:
  `gemini-3.6-flash` (GA, mais barato) via Admin→Custos de IA, sem redeploy.
- **[ABERTO — resíduo de C] Literais de modelo ainda fora do módulo único** —
  `laud-ia/SharedLaudIA.tsx:359` (`getGenerativeModel({ model: 'gemini-3.5-flash' })`)
  e o resolvedor local próprio de `ai/generateTemplate.ts`. Não migrados por serem
  território do processo paralelo (risco de conflito de merge). Apontar ambos para
  `GEMINI_LITE_MODEL`/`resolveGeminiModel` quando a janela permitir.

- **[CORRIGIDO] "503 sobrecarregado" mascarava o erro real** — o proxy `api/gemini.ts`
  devolve **status 503 em dois casos distintos**: (a) modelo do Google sobrecarregado
  e (b) `GOOGLE_API_KEY` ausente no ambiente. O cliente (`geminiHttpError`) traduzia
  QUALQUER 503 para "modelo sobrecarregado", escondendo o problema de configuração.
  Corrigido: `geminiHttpError` agora detecta erros de config/chave (key not configured,
  API key not valid, PERMISSION_DENIED, billing) e mostra mensagem acionável distinta,
  ANTES de assumir sobrecarga. **Investigar em produção**: se o erro persiste em todos
  os modelos, a causa mais provável é `GOOGLE_API_KEY` ausente/inválida/sem billing na
  Vercel (env de Production) — confirmar via DevTools→Network→resposta de `/api/gemini`.

## 🟠 Legal / LGPD

- **Razão social e CNPJ ainda não divulgados** nos documentos legais (decisão de
  negócio deliberada durante a fase de testes restritos, não um esquecimento) —
  sinalizado como risco jurídico prioritário pelo próprio pacote de revisão.
  Origem: `docs/legal/PACOTE_REVISAO_JURIDICA.md`.
- **Sem portal de solicitação de titular de dados, sem rotina automática de
  purga/anonimização, sem criptografia em nível de campo para CPF/RG** (só regras do
  Firestore) — itens P1–P3 do plano de retenção.
  Origem: `docs/LGPD_POLITICA_RETENCAO.md`.
- **Assinatura ICP-Brasil — 0% implementado** (confirmado por grep: nenhuma
  referência a ICP/ClickSign/D4Sign no código). Spec de implementação já pronta,
  bloqueada em decisão de fornecedor (ClickSign vs D4Sign) e credenciais.
  Origem: `docs/roadmaps/ASSINATURA_ICP_BRASIL.md`.

## 🟡 Calculadoras FMF

- **Parte G — casos-ouro de validação clínica pendentes.** Coeficientes já auditados
  dígito-a-dígito contra o código (ver `docs/FMF_COEFICIENTES_EXTRAIDOS.md`), mas
  `validated: false` só pode virar `true` depois de rodar 5-10 casos reais na
  calculadora oficial da FMF (fetalmedicine.org) e bater dentro da tolerância.
  Origem: `docs/archive/FMF_DADOS_VALIDACAO.md` (Parte G).

## 🟢 Higiene técnica

- **Arquivos grandes ainda não refatorados** (R4 do plano de refinamento) — confirmado
  em 2026-07-08: `src/modules/laud-ia/SharedLaudIA.tsx` (1766 linhas),
  `src/modules/editor/ExamEditor.tsx` (1574 linhas), `src/modules/ai/engine.ts` (1282 linhas).
  Origem: `docs/archive/PLANO_REFINAMENTO.md` (item R4).
- **Uso de `any` ainda alto** (R7) — caiu de ~248 para ~183 ocorrências desde a
  auditoria de 04/07, mas segue como dívida técnica. A maioria são casts de
  `doc.data()` (aceitáveis) e o padrão de setter dinâmico `setField(key, {...} as any)`
  (extras de preço em `AdminFinanceiro.tsx`), que exigiria genéricos pesados.
  Origem: `docs/archive/PLANO_REFINAMENTO.md` (item R7).
- **Readers do Financeiro — parte deferida** (item 2 da auditoria 2026-07) — os
  leitores de `AdminFinanceiro.tsx` (planos + histórico de preço) foram tipados
  (`Plan`, `PriceHistoryEntry`), removendo os `as any`. FALTAM os leitores em
  `finance/FinanceOverviewTab.tsx` e `finance/TransactionsTab.tsx` (casts inline de
  `doc.data()`), **deferidos por serem território do processo paralelo** — mexer
  amplo neles gera conflito de merge.
- **`FinanceStats` duplicado** — definido 3× com shapes divergentes
  (`AdminAnalytics.tsx`, `finance/FinanceOverviewTab.tsx`, `finance/TransactionsTab.tsx`;
  o de Analytics não tem `otherCount`/`updatedAt`). Consolidar num tipo único em
  `store/db.ts`. Também deferido (toca arquivos do processo paralelo).
- **Cobertura de testes dos componentes do Editor** (Fase 5 do plano de melhorias) —
  infra de teste de UI habilitada em 2026-07-18 (`@testing-library/react` + `jsdom`
  por-arquivo via docblock `@vitest-environment`); primeiros testes de render/hook
  escritos (`PlaygroundPanel`, `useImageNavigation`). Expandir para os demais
  componentes extraídos do Editor.
  Origem: `docs/archive/PLANO_MELHORIAS_2026-07.md`.

---

## Itens fechados nesta auditoria (não precisam de ação)

Para referência — confirmados como já resolvidos em código durante a checagem de
2026-07-08, então **não** entram no backlog acima: exposição do Anthropic (integração
removida por completo), rate limiting da IA, `global_config` restrito a admin,
`calculateAge` duplicado, bundle `vendor-icons` inflado, MRR de assinantes semestrais,
custo de IA zerando silenciosamente, VMs suspensas fora do KPI de custo, add-ons
sobrescritos em upgrade de plano, `AdminUsers.tsx` morto, CSV de auditoria quebrado,
AE-Title incorreto no worklist DICOM (fix do incidente MX7, 08/07/2026).

**Corrigidos em 09/07/2026 (eram falsos positivos no backlog original):**
- ~~Camada de query do client não roteia para o UID do owner em memberships
  convidados~~ — **já implementado** (`resolveOwnerUid`, `src/store/clinicAccess.ts`,
  usado por `useFirestore.ts` e `db.ts`); a fonte original (`archive/PLANO_FINAL_PRODUCAO_2026-07.md`)
  é anterior ao wiring de 05/07/2026 documentado em §16 de `DOCUMENTACAO_OFICIAL.md`.
- ~~Cron de expiração de assinatura avulsa ausente~~ — a *funcionalidade* existe,
  só não como arquivo separado: `api/reset-monthly-reports.ts` (CRON diário) já
  expira planos avulsos (`sub.interval` semestral/anual) que passam de
  `currentPeriodEnd`, distinto do fluxo `past_due` dos planos mensais recorrentes.

**Implementados em 09/07/2026:**
- ~~Sem desativação de conta no Firebase Auth ao deletar usuário~~ — novo endpoint
  `api/admin-set-user-auth-status.ts` (admin-only, `auth.updateUser(uid, {disabled})`
  via Admin SDK — desativa, não apaga, pra ficar reversível). `deleteUserDocument`
  (`src/store/adminUsers.ts`) chama antes de limpar o Firestore; best-effort (se
  falhar, a limpeza segue e o audit log registra o aviso).
- ~~M2 — recálculo de transações sem paginação~~ — `TransactionsTab.tsx#recalcStats`
  agora lê em lotes de 500 (cursor `startAfter`) em vez de um `getDocs()` sobre a
  coleção inteira.
- ~~M3 — sem guarda de concorrência entre "Features" e "Recursos Extras"~~ —
  `AdminFinanceiro.tsx`: cada aba agora grava só as próprias chaves
  (`FEATURES_META`/`RESOURCES_META`) no `setDoc(..., {merge:true})`, em vez de
  espalhar o estado local inteiro (que incluía uma cópia potencialmente
  desatualizada das chaves da OUTRA aba, sobrescrevendo edições concorrentes).
- ~~Exportação de transações exporta tudo, ignorando filtros~~ — extraído um
  predicado único `matchesTxFilters` usado tanto pela tabela em tela quanto pelo
  `exportCsv()`; o CSV agora reflete exatamente os filtros ativos na tela.
- ~~Verificação server-side de consistência do `dicomTenantId`~~ — `api/worklist.ts`
  agora compara o `tenantId` de cada requisição com o `dicomTenantId` salvo nas
  settings do usuário (Firestore) e loga (`console.warn`) uma divergência, sem
  bloquear a requisição (bloquear quebraria o fluxo legítimo de testar um
  `tenantId` ainda não salvo antes de clicar "Salvar" no painel PACS). Não
  aplicado a `orthanc-proxy.ts` — chamado a cada poll de imagem (5-30s), o custo
  de uma leitura extra no Firestore por request não compensa pra um log
  observacional; se quiser cobertura ali também, dá pra reusar o mesmo cache.
