# 🔍 Auditoria Completa — LAUD.US (07/07/2026)

**Data:** 2026-07-07 · **Ambiente:** produção (Vercel Pro + Firebase) · **Status:** vivo
**Complementares:** [Documentação Oficial v4](DOCUMENTACAO_OFICIAL.md) · [Plano de Melhorias](PLANO_MELHORIAS_2026-07.md) · [CASCADE_PROMPTS](CASCADE_PROMPTS.md) · auditorias anteriores em [`docs/archive/`](archive/)

Levantamento pedido pelo usuário ("análise completa e detalhada da documentação e do sistema"), com números reais coletados do repositório atual — não estimativas. Substitui `AUDITORIA_COMPLETA_2026-07.md` (04/07) e `AUDITORIA_INTEGRACOES_FINANCEIRO_2026-07.md` (05/07), ambas arquivadas: seus achados abertos já foram resolvidos ou estão consolidados aqui.

---

## 1. Resumo executivo

O sistema está **funcional, testado e em produção** (Vercel Pro + Firebase), sem falha crítica conhecida em aberto. As pendências reais são de três naturezas:

1. **Decisão externa do usuário** — fornecedor ICP-Brasil, confirmação da tabela de billing do GCP.
2. **Maturidade de engenharia** — cobertura de testes concentrada em lógica pura (calculadoras/engine), quase nenhuma em endpoints serverless que mexem com dinheiro/infra; alguns componentes grandes (>1.500 linhas); um chunk de bundle (`vendor-icons`) desproporcionalmente grande.
3. **Higiene de documentação** — 5 documentos históricos (auditorias/planos já executados) estavam soltos na raiz de `docs/`, competindo por atenção com a documentação viva; um roadmap (`ADMIN_IMPROVEMENT_PLAN.md`) descrevia um estado do painel Admin que não existe mais (a maior parte já foi implementada). **Corrigido nesta rodada** — ver §7.

Nenhum achado desta auditoria é de segurança crítica: a Fase 0-2 do Security Audit (Jul/2026) já endereçou escalonamento de privilégio, proxies abertos e LGPD técnico (ver `project_laudus_security_audit` / documentação oficial §9).

---

## 2. Saúde técnica (baseline medido em 07/07/2026)

| Checagem | Resultado |
|---|---|
| `tsc --noEmit` | ✅ 0 erros |
| `vitest run` | ✅ 377/377 testes (20 arquivos) |
| `vite build` | ✅ build de produção ok (avisos de chunk size, ver §6) |
| Revisão dos 2 commits de madrugada sem mensagem descritiva (FMF pré-eclâmpsia PSV ratio + motor da Aba Estruturado) | ✅ Sem bug vivo no HEAD — um bug transitório (enricher renal esquerdo sem `canonical:true` no 1º commit) já havia sido corrigido pelo commit seguinte, com teste cobrindo o caso bilateral |
| Revisão do `docs/CASCADE_PROMPTS.md` V2.0 (sincronização doc↔código feita pelo usuário à tarde) | ✅ Afirmações conferidas contra `general.ts`/`engine.ts`/`GeminiProvider.ts` — corretas |

---

## 3. Dívida técnica (números reais, `grep`/`wc` sobre `src/` e `api/`)

### 3.1 Tipagem
- **248 usos de `any`** em `src/`+`api/`. Concentrados em fronteiras de integração (esperado, não sistêmico): `AdminUsersSubscriptions.tsx` (13), `api/abacatepay-webhook.ts` (13), `useDicomSync.ts` (11), `api/pacs-provision.ts` (11), `FinanceOverviewTab.tsx` (9).
- **0 `@ts-ignore`/`@ts-expect-error`** — nenhum escape de tipo forçado.
- **32 `eslint-disable`** — todos `react-hooks/exhaustive-deps`, concentrados em calculadoras (29). Risco baixo (deps estáveis por design nos hooks de cálculo).

### 3.2 Arquivos grandes (>800 linhas)
`areaPrompts.ts` (3.305 L — config de prompt por área, tamanho esperado), `LaudCopilot.tsx` (1.804), `SharedLaudIA.tsx` (1.745), `AdminFinanceiro.tsx` (1.681), `DicomControlCenter.tsx` (1.520), `ExamEditor.tsx` (1.519), `AdminUsersSubscriptions.tsx` (1.510), `db.ts` (1.375), `engine.ts` (1.290), `general.ts` (1.135), `SubscriptionCenter.tsx` (1.072), `Settings.tsx` (893), `CreateExamModal.tsx` (804).

### 3.3 TODOs e logging
- **1 TODO real** encontrado em todo o código: `src/utils/logger.ts:32` (Sentry não conectado ao `logger.error`). **Corrigido nesta sessão** — ver §8.
- **56 `console.*`** fora de testes — na leitura amostral, a grande maioria é logging intencional e taggeado (`[WEBHOOK]`, `[ABACATEPAY]`, cron) em `api/`, não debug esquecido.

### 3.4 Duplicação
- `calculateAge()` existe **duas vezes**: versão exportada em `src/utils/format.ts` (simples) e versão privada em `src/modules/ai/engine.ts:202` (mais completa — trata mês/ano). A versão do engine nunca importa a de format.ts. Baixo risco, mas é debt real — ver plano §2.4.
- Datas, moeda e queries Firestore: sem duplicação relevante encontrada (centralizadas em `format.ts`/`db.ts`).

---

## 4. Cobertura de testes

**377 testes, 20 arquivos** — todos focados em **lógica pura**: calculadoras (FMF trissomia 44 testes, pré-eclâmpsia 26, medianas 19, QC 10), classificadores, motor de IA (engine/router/verification/evolution/learning/training), Aba Estruturada (schema/engine/liveCompute), pricing/quota/secure, roteamento DICOM.

**Gaps concretos:**
- **10 de 14 módulos de UI sem nenhum teste dedicado:** admin, appointments, clinics, dashboard, **editor** (o núcleo do produto — `ExamEditor`/`LaudCopilot`), export, laud-ia, patients, settings, templates, worklist.
- **13 de 16 endpoints serverless sem teste:** só `_secure`, `_pricing`, `_quota` têm cobertura direta. **`abacatepay-webhook.ts` (concede acesso pago, valida HMAC) e `pacs-provision.ts` (cria/destrói infraestrutura de nuvem cobrada) não têm nenhum teste** — são os dois endpoints com maior custo de erro no sistema.

Isso não significa que o sistema está frágil (a lógica de negócio mais sensível — cálculos clínicos, pricing, cota — é justamente a mais testada), mas é o maior risco de regressão silenciosa hoje.

---

## 5. Performance / bundle

`vite build` já usa `manualChunks` (`vendor-firebase`, `vendor-motion`, `vendor-icons`, `vendor-editor`, `vendor-ai`, `vendor-pdf`, `vendor-sentry`) e o editor é lazy-loaded (decisão da Fase 4 do audit anterior). Chunks acima de 500 kB (raw):

| Chunk | Raw | Gzip | Fonte |
|---|---|---|---|
| `vendor-icons` | 905 kB | 169 kB | lucide-react |
| `vendor-firebase` | 620 kB | 146 kB | Firebase SDK |
| `vendor-pdf` | 512 kB | 103 kB | paged.js (só carrega ao exportar/imprimir) |

`vendor-icons` é o maior chunk do bundle e o mais estranho — 905 kB para uma biblioteca de ícones sugere que o barrel de importação (`import { X } from 'lucide-react'`) não está sendo tree-shaken como esperado. `vendor-firebase` e `vendor-pdf` são tamanho normal para o que fazem.

---

## 6. Infraestrutura (mudanças de hoje)

- **Vercel Pro ativado** (confirmado pelo usuário) — removido o teto de 12 funções serverless (eram 14 antes de mais nada quebrar).
- **`cron-aggregate-metrics` mudou de 1×/dia para horário** (`vercel.json`, 07/07/2026) — a agregação é idempotente sobre as últimas 48h, seguro rodar mais vezes; painel financeiro/admin fica com dado mais fresco ao longo do dia.
- **`logger.error` agora reporta ao Sentry** (`Sentry.captureException`) quando `VITE_SENTRY_DSN` está configurado — antes só logava no console; TODO fechado. Sentry segue **opt-in** (sem DSN configurado ainda, é no-op — ativação continua pendência do usuário).

---

## 7. Higiene de documentação (executada nesta sessão)

**Problema encontrado:** `docs/` (raiz) acumulava 4 auditorias/planos já **executados e finalizados** (confirmado via histórico) competindo visualmente com a documentação viva: `AUDITORIA_COMPLETA_2026-07.md` (04/07), `AUDITORIA_INTEGRACOES_FINANCEIRO_2026-07.md` (05/07), `PLANO_REFINAMENTO.md` (04/07), `PLANO_FINAL_PRODUCAO_2026-07.md` (05/07, o próprio doc já dizia "EXECUTADO"). Em `docs/roadmaps/`, `PLANO_PLANOS_INTERVALOS_ABACATEPAY.md` descrevia uma spec ("planos multi-intervalo, PACS configurável") que **já está implementada** no código atual (`interval` inclui `semester`; `MyPacsCard.tsx` lê `global_config/pacs_plans`) — confirmado por grep direto no código, não por inferência.

**Ação:** os 5 documentos foram movidos para `docs/archive/` (`git mv`, preserva histórico). Links quebrados corrigidos em `README.md` e `DOCUMENTACAO_OFICIAL.md`.

**Achado adicional:** `docs/roadmaps/ADMIN_IMPROVEMENT_PLAN.md` também estava desatualizado — seu "Diagnóstico atual" descreve um painel Admin sem telemetria persistente, sem visão 360º do cliente, sem SLA de suporte e com código morto, mas todos já foram resolvidos (confirmado por grep/leitura direta: `metrics_daily` usado em 5 arquivos incl. `AdminAnalytics.tsx`, que não existia quando o plano foi escrito; drawer "Visão 360º" existe em `AdminUsersSubscriptions.tsx`; `AdminUsers.tsx` morto não existe mais no repo; `AdminSupport.tsx` já calcula e exibe SLA de 1ª resposta/resolução). Este não foi arquivado (ainda tem 1 item genuinamente pendente — busca/paginação server-side em Usuários, adiado por decisão consciente dado o estágio atual do produto, ver `PLANO_MELHORIAS_2026-07.md` Fase 3), mas ganhou um aviso de desatualização no topo apontando o que já está feito.

---

## 8. Segurança / LGPD (recapitulação — sem mudanças nesta rodada)

Já maduro: Fases 0-2 do Security Audit no ar (RBAC, proxies autenticados, pseudonimização de IA, trilha de acesso a paciente), Termos/Privacidade publicados com aceite obrigatório, segredos rotacionados (05/07). Sem achado novo nesta auditoria. Ver `DOCUMENTACAO_OFICIAL.md` §9 para o estado completo.

---

## 9. Pendências que dependem do usuário (não bloqueiam o resto)

| Item | Estado |
|---|---|
| Assinatura digital ICP-Brasil | Adiado por decisão do usuário (07/07/2026) |
| Billing real do GCP no painel Financeiro | Setup (Billing API + BigQuery export) feito; falta o usuário confirmar que a tabela `laudussys.gcp_billing_export_v1_*` já tem dados (o agente não tem permissão para consultar a credencial de produção sem autorização explícita para essa ação específica) |

---

*Ver [PLANO_MELHORIAS_2026-07.md](PLANO_MELHORIAS_2026-07.md) para a priorização faseada dos achados de dívida técnica (§3-§6) desta auditoria.*
