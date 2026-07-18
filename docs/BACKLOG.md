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
