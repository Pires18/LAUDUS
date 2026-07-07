# 🛠️ Plano de Melhorias — LAUD.US (07/07/2026)

**Base:** [AUDITORIA_COMPLETA_2026-07-07.md](AUDITORIA_COMPLETA_2026-07-07.md).
**Meta:** fechar os riscos de maior custo (pagamento/infra sem teste), reduzir dívida visível sem tocar em nada que já paga/funciona.
**Princípios invioláveis (mantidos do plano anterior):** enforcement fail-open; nunca quebrar cobrança; toda ação admin auditada; toda mudança com `tsc` + testes verdes; commits pequenos e reversíveis.

Cada fase é independente — pode ser aprovada e executada isoladamente.

---

## Fase 0 — Higiene rápida ✅ EXECUTADA em 07/07/2026

- ✅ `logger.error` agora reporta ao Sentry (`Sentry.captureException`) — fechava o único TODO real do código.
- ✅ 5 documentos históricos já executados (auditorias/planos de 04-05/07) movidos para `docs/archive/`; links corrigidos em `README.md`/`DOCUMENTACAO_OFICIAL.md`.
- ✅ `docs/roadmaps/ADMIN_IMPROVEMENT_PLAN.md` marcado com aviso de desatualização + o que já foi confirmado feito.
- ✅ `cron-aggregate-metrics` migrado para horário (habilitado pelo Vercel Pro).

---

## Fase 1 — Testar os dois endpoints de maior risco ✅ EXECUTADA em 07/07/2026

`api/abacatepay-webhook.ts` e `api/pacs-provision.ts` ganharam teste dedicado (`src/test/abacatepayWebhook.test.ts`, `src/test/pacsProvision.test.ts` — 24 testes novos, 401 no total). Como nenhum dos dois endpoints tinha lógica extraída em funções puras, `verifyWebhook` e `markEventProcessedOnce` (idempotência via transação) foram exportados de `abacatepay-webhook.ts`, e `shouldBlockMockInProduction` foi extraída em `pacs-provision.ts` — mesmo padrão já usado em `_pricing.ts`/`_quota.ts`.

**2 bugs reais encontrados e corrigidos, não só cobertura:**
1. **Comentário incorreto em `api/reset-monthly-reports.ts`** — dizia "mensal e anual são recorrentes" mas o código (`isRecurringInterval`) só trata mensal como recorrente; semestral e anual sempre expiravam direto. Confirmado com o usuário que o **código** estava certo (anual/semestral são compra avulsa, não tem por que dar carência) — só o comentário estava desatualizado. Corrigido o comentário, não o comportamento.
2. **`api/pacs-provision.ts` — falha de segurança real:** o caminho compartilhado (Starter/Pro) já tinha uma trava contra simular silenciosamente em produção quando faltava config; o caminho **Dedicado** (o plano mais caro) **não tinha essa trava** — se `GCP_SA_KEY`/`TAILSCALE_API_KEY`/`TAILSCALE_TS_NET` sumissem da Vercel (rotação de chave, env var apagada), o endpoint devolvia silenciosamente uma VM **falsa** (URL inexistente) para quem pagou pelo plano dedicado, sem nenhum erro. Corrigido: mesma trava (`shouldBlockMockInProduction`) aplicada aos dois caminhos.

**Não coberto ainda (documentado, não é regressão):** o fluxo completo com Firestore real (gravação de transação/addon/interval dentro do handler) segue sem teste — testado foi a lógica pura extraída (HMAC, idempotência, guarda de mock) e o gating de auth/método do handler, que já cobre os pontos de maior risco de segurança/dinheiro. Testar o handler fim-a-fim exigiria um emulador do Firestore — não feito por ora (retorno menor pelo esforço, dado que a parte de maior risco já está coberta).

**Critério de aceite:** `tsc` 0, 401 testes verdes, `vite build` ok. Confirmado.

---

## Fase 2 — `vendor-icons` (905 kB) ✅ EXECUTADA em 07/07/2026 — causa raiz encontrada e corrigida

**Causa raiz:** não era tree-shaking quebrado por config — era um único `import * as LucideIcons from 'lucide-react'` (namespace import) em `src/components/AreaIcon.tsx`, que resolvia o ícone de cada área clínica por **nome dinâmico** (`LucideIcons[areaMeta.icon]`). Um namespace import com acesso dinâmico por string impede o Rollup de provar estaticamente quais dos **3.904** ícones exportados pelo pacote são usados — então ele inclui o pacote inteiro. Confirmado empiricamente: ícones completamente irrelevantes ao app (`Bitcoin`, `Pizza`, `Sailboat`, `Volleyball`...) apareciam no bundle de produção antes da correção.

**Fix:** `AreaIcon.tsx` reescrito com um mapa estático (`Record<string, LucideIcon>`) dos 10 ícones que `EXAM_AREAS` (`src/types.ts`) realmente usa, importados por nome — mesmo comportamento (mesmo ícone por área, mesmo fallback `Stethoscope`), só que agora tree-shakeável. Nenhum outro arquivo no repo tinha esse padrão (`grep` confirmou ser o único namespace import de `lucide-react`).

**Resultado medido:** `vendor-icons` **898 kB → 87,6 kB** (gzip 166 kB → 17,5 kB) — **queda de ~90%**, sem crescer nenhum outro chunk (o `index` principal ficou igual). Precache do Service Worker caiu ~800 kB (4747 kB → 3955 kB) de brinde. `tsc` 0, 401 testes verdes, build ok, checado visualmente no preview (landing carrega sem erro de console).

**Critério de aceite:** confirmado — build reduz o chunk, nenhum ícone quebrado (verificação por tipo + preview).
**Risco realizado:** nenhum — mudança mecânica e localizada em 1 arquivo.

---

## Fase 3 — Admin: busca server-side + SLA de Suporte — revisada em 07/07/2026

**Correção: SLA de Suporte já estava implementado** (achado da auditoria estava desatualizado — não tinha olhado `AdminSupport.tsx` a fundo, só `AdminHealth.tsx`). `AdminSupport.tsx` já calcula e exibe tempo médio até 1ª resposta de admin, tempo médio de resolução e idade do ticket aberto mais antigo, tudo derivado dos 200 tickets mais recentes já carregados (sem custo extra de leitura). Nada a fazer aqui.

**`AdminUsersSubscriptions.tsx` — busca/paginação server-side: adiada por decisão consciente (07/07/2026), não esquecida.** Perguntei ao usuário o tamanho atual da base para calibrar a urgência; resposta foi "não sei ao certo". Dado que o produto ainda está em fase de testes restrita (poucos clientes reais — ver `docs/legal/PACOTE_REVISAO_JURIDICA.md`, CNPJ ainda não publicado), a mudança tem custo/risco desproporcional ao problema agora:
- Precisaria abandonar o listener realtime dessa tela (a busca por prefixo com cursor não é compatível com `onSnapshot` sobre a coleção inteira do jeito atual).
- Firestore não tem busca por substring nativa — a busca vira "começa com" (prefixo indexado), uma regressão de UX perceptível vs. a busca "contém" atual.
- Exigiria adicionar `emailLower`/`nameLower` indexados e migrar usuários existentes que não têm esses campos.
- É a tela mais usada do admin pra gerenciar clientes pagantes — o maior blast radius de qualquer item deste plano.

**Gatilho para revisitar:** quando a lista de usuários/assinaturas no Admin começar a demorar perceptivelmente para carregar, ou a base passar de ~1-2 mil usuários (estimativa conservadora para `onSnapshot` completo começar a pesar no navegador). Até lá, o código atual (client-side sobre a coleção completa) continua correto e mais simples.

**Risco:** nenhum — decisão de não mexer, documentada com o motivo e o gatilho para reconsiderar.

---

## Fase 4 — `calculateAge` duplicado ✅ EXECUTADA em 07/07/2026 — 2 bugs reais corrigidos, não só duplicação

Escrito `src/test/format.test.ts` (10 testes) contra a versão ANTIGA de `utils/format.ts` primeiro, pra confirmar o diagnóstico antes de mexer — **3 dos 10 casos já falhavam**:
1. **"0 anos" para bebês** — `format.ts` só calculava anos; um recém-nascido de 2 meses aparecia como "0 anos" em `PatientDetail`, `ReportDocument.tsx` (PDF) e `docxExport.ts` (Word) — informação clinicamente inútil num laudo pediátrico impresso.
2. **Plural sempre errado no singular** — `` `${years} anos` `` era hardcoded, então 1 ano aparecia como "1 anos".

A versão de `ai/engine.ts:202` (usada só internamente, no prompt da IA) já tratava os dois casos corretamente. Promovida para `utils/format.ts` (mantendo a guarda extra contra data inválida que só o `format.ts` tinha) e `engine.ts` passou a importar dali, removendo a duplicata. Comportamento do prompt da IA **não mudou** (mesma fórmula, só mudou de arquivo); os 8 consumidores de UI/documento de `format.ts` ganharam o comportamento correto.

**Critério de aceite:** os 10 testes de `format.test.ts` verdes na versão nova, `tsc` 0, 411 testes no total, build ok.
**Risco realizado:** nenhum — mudança comportamental isolada e testada antes/depois.

---

## Fase 5 — Cobertura de teste para o núcleo do Editor *(impacto alto a longo prazo, esforço alto — só entrar se houver tempo dedicado)*

`ExamEditor.tsx`/`LaudCopilot.tsx` (o produto em si) não têm teste de componente — toda a cobertura hoje é da lógica pura por trás (engine, calculadoras, verificação). Isso é uma escolha razoável até aqui (testar lógica pura tem mais retorno por esforço que testar componentes React grandes), mas é o maior "buraco" de confiança para regressão de UI. Não é urgente — só vale priorizar se o ritmo de mudanças no editor aumentar ou se um bug de UI real acontecer em produção.

---

## Ordem recomendada

| Fase | Esforço | Impacto | Status |
|---|---|---|---|
| 0 — Higiene | ½ dia | Médio | ✅ Feita hoje |
| 1 — Testar webhook/PACS provision | 1-2 dias | **Alto** (risco financeiro/infra) | Recomendada a seguir |
| 2 — Investigar `vendor-icons` | ½ dia (investigação) | Médio | Pode rodar em paralelo com a 1 |
| 3 — Admin busca server-side + SLA | 2-3 dias | Alto (operação) | Depois da 1 |
| 4 — `calculateAge` duplicado | 1-2h | Baixo | Quando conveniente |
| 5 — Testes de componente do Editor | Alto (dias) | Alto a longo prazo | Só sob demanda |

**Pendências fora deste plano (decisão do usuário, não trabalho de engenharia):** fornecedor ICP-Brasil; confirmação da tabela `laudussys.gcp_billing_export_v1_*` no BigQuery (ver auditoria §9).
