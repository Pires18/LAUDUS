# 💰 Proposta — Centro Financeiro Completo e Funcional (07/07/2026)

**Base:** [AUDITORIA_FINANCEIRO_2026-07.md](AUDITORIA_FINANCEIRO_2026-07.md).
**Status (07/07/2026): Fases A, B, C e D EXECUTADAS** (6/6 + 7/7 + 3/4 + 2/3 — os 2 itens restantes, C.3 e D.3, foram conscientemente adiados por dependerem de informação externa hoje indisponível; ver seção de cada fase).
**Princípio central:** hoje o Financeiro mostra vários números plausíveis, mas alguns não batem entre si e alguns estão simplesmente errados. Antes de adicionar qualquer funcionalidade nova, a Fase A corrige a fundação — sem isso, um Centro Financeiro "mais completo" só mostraria os mesmos bugs com mais gráficos.

---

## Fase A — Corrigir a fundação ✅ 6/6 EXECUTADOS em 07/07/2026

Resolve os 6 achados 🔴 críticos da auditoria. Sem redesenho de tela — foram consertos de fórmula/dado.

1. **✅ MRR/ARR unificado.** `api/cron-aggregate-metrics.ts` reescrito: nova função pura `computeMrr()` (testável, 10 testes em `src/test/cronMrr.test.ts`) usa `intervalMultiplier()` em vez do `if interval==='year'` incompleto, e lê `subscriptions.price`/`subscriptions.interval` (o que o assinante travou) em vez de reler `saas_plans`. A fórmula agora espelha exatamente a do painel "Receita por Intervalo" (que já estava correta) — os dois números da Central devem bater agora. Também incluiu `trialing` automaticamente (assinaturas trial reais, quando existem como doc — a maioria dos trials orgânicos é só virtual em memória, sem doc, então naturalmente não infla o MRR com compromisso que não existe).
2. **✅ Fonte única de preço de IA.** Nova tabela `GEMINI_MODEL_PRICING` em `src/modules/ai/modelPricing.ts` (módulo próprio, não puxa o `engine.ts` inteiro pro bundle do Admin) — usada tanto pelo cálculo real de custo (`engine.ts`) quanto pela "Referência de Preços Gemini" do `IACostsTab`. Modelo sem preço mapeado agora loga erro visível (`logger.error`, já vai pro Sentry) em vez de custar `$0` em silêncio.
3. **✅ Medidor de disco decorativo removido.** Investigado: o dado real existe, mas só via consulta ao vivo do Orthanc que `MyPacsCard.tsx` faz para o próprio usuário — sincronizar isso pro admin (todas as VMs de todos os usuários) exigiria um mecanismo novo (CRON consultando cada Agente), maior que "corrigir fórmula". Substituído por exibição honesta: só a cota provisionada (real), com nota "uso real não sincronizado" em vez de uma % sempre em 0.
4. **✅ VMs `suspended` incluídas nos KPIs.** `VmInfraTab.tsx`: custo agora inclui `ready` E `suspended` (ambas custam GCP de verdade); receita só conta `ready` (suspensa não paga mais). Badge de alerta específico "Suspensa (sem receita, ainda custando)" no `StatusPill`.
5. **✅ Taxas de gateway implementadas** como receita líquida ESTIMADA (não altera o valor cobrado do cliente, só o relatório): novo `estimateNetRevenue()` (`api/_pricing.ts`, 7 testes) usa a taxa configurada em AbacatePay → Config contra `revenueByMethod`/`countByMethod` (novos campos agregados pelo CRON por dia). Mostrado na Central como "Líquida de taxas (estimada)" ao lado da receita bruta. Continua sendo uma ESTIMATIVA (usa a taxa que o admin digitou, não a taxa real cobrada pela AbacatePay em cada transação — essa não é exposta hoje) — decisão consciente, documentada na própria UI (tooltip).
6. **✅ Overwrite de add-ons corrigido.** `activateSubscription` (`api/abacatepay-webhook.ts`) agora faz merge (`[...new Set([...addonsDoNovoPlano, ...addonsExistentes])]`) em vez de substituir — nunca mais revoga um add-on avulso pago ao trocar de plano. 4 testes de regressão em `abacatepayWebhook.test.ts` (novo cenário, sem doc anterior, upgrade preservando avulso, sem duplicar, renovação não mexe em addons). Bônus: `createdAt` da assinatura também parou de resetar a cada troca de plano (mesmo bug de raiz).

**Critério de aceite:** `tsc` 0, 437 testes verdes (+21 desde o início da Fase A), `vite build` ok — confirmado após cada item.
**Risco:** médio (assumido) — tocou cálculo de receita/custo real e o caminho de escrita do webhook de pagamento; cada item testado isoladamente antes do próximo, com teste de regressão para os bugs de dados (MRR, add-ons, taxas de gateway).

---

## Fase B — Um Centro Financeiro coeso ✅ 7/7 EXECUTADOS em 07/07/2026

Meta: a aba "Central" vira o que o nome promete — um lugar só que responde "como está o negócio", sem números que se contradizem.

1. ~~**MRR/ARR como uma única verdade**~~ ✅ feito na Fase A (`computeMrr`).
2. ✅ **Reconciliação reformulada.** Implementado — mas com uma fórmula um pouco diferente da originalmente proposta aqui (mais simples de implementar com o dado já existente, mesmo efeito prático): em vez de "receita de caixa esperada" (que exigiria simular cobrança por `currentPeriodEnd` de cada assinatura), o CRON agora quebra a receita diária por **intervalo da assinatura** (`revenueByInterval`, só transações tipo `subscription`) e a Central compara MRR só contra a receita de **assinaturas mensais** dos últimos 30 dias — excluindo compras avulsas semestrais/anuais, que são a causa raiz do falso-positivo. Alerta suprimido automaticamente enquanto a janela de 30 dias ainda não tem dado suficiente do novo campo (transição).
   - ✅ **Receita líquida de taxas (estimada)** também implementada (era o item de decisão "1" em aberto) — nova função `estimateNetRevenue` (`api/_pricing.ts`, 7 testes) usa a config de taxas do AbacatePay + `revenueByMethod`/`countByMethod` (novos, agregados pelo CRON) pra mostrar receita líquida ao lado da bruta. É uma estimativa (usa a taxa configurada pelo admin, não a taxa real cobrada pela AbacatePay em cada transação — essa não é exposta hoje).
3. ✅ **Série histórica** — receita bruta diária e custo de IA diário (30 dias), gráfico de área SVG reutilizado de `AdminAnalytics.tsx` (extraído pra `components/MiniCharts.tsx`, sem nova dependência). **Limitação encontrada:** MRR em si não tem histórico diário — o CRON só grava o snapshot atual em `metrics_daily/_summary`, sobrescrito a cada execução. Fazer o CRON também gravar um snapshot diário de MRR é um passo futuro (não feito agora — mudaria o que é persistido diariamente, merece mais reflexão isolada).
4. ✅ **Churn e retenção.** Nova `computeChurn30d()` (`api/_pricing.ts`, 7 testes): conta cancelamentos/expirações dos últimos 30 dias (`canceledAt` pro cancelamento explícito, `updatedAt` pra expiração automática — sem timestamp dedicado nesse caso) + MRR perdido. Taxa de churn = churned / (ativos hoje + churned) — aproximação honesta, já que não existe snapshot histórico da base de assinantes pra uma coorte fechada de verdade (documentado na própria UI via tooltip).
5. ✅ **ARPU, LTV estimado, conversão trial→pago.** ARPU = MRR/assinantes ativos (trivial, dado já existia). LTV = ARPU ÷ taxa de churn (fórmula clássica SaaS — herda a aproximação do churn). Conversão trial→pago: nova query em `users` por cohort de `createdAt` (trial de 14 dias que terminou nos últimos 30 dias) — conta quantos saíram do status `trialing`. Limitação documentada: trials orgânicos são virtuais (nunca viram doc em `subscriptions`), então a coorte só é identificável via `users.createdAt`, não via assinaturas.
6. ✅ **AR aging unificado** — uma lista só (faturas a vencer em ≤7 dias E já vencidas com status `past_due`), com badge distinto pra vencidas.
7. ✅ **Alerta de margem negativa por cliente com threshold configurável** — novo campo `lossThresholdBrl` (persistido, editável na própria tela). A tabela detalhada continua mostrando toda perda (mesmo pequena); um banner proeminente no topo da página só conta/soma quem passa do limiar configurado, com linhas destacadas na tabela.

**Risco realizado:** baixo, como previsto — mudanças de leitura/exibição sobre dados corretos (Fase A), mais campos novos agregados pelo CRON (`revenueByMethod`, `countByMethod`, `revenueByInterval`) e uma nova query em `users` (cohort de trial) que só populam/refletem dados daqui pra frente ou do histórico já existente.

---

## Fase C — Rastreabilidade financeira ✅ 3/4 EXECUTADOS em 07/07/2026

1. **✅ Histórico de mudança de preço por plano.** `PlansTab.handleSave` (`AdminFinanceiro.tsx`) agora grava em `saas_plans/{id}/price_history` (subcoleção, `addDoc`) sempre que `prices` muda num `updateDoc` — snapshot `before`/`after`, `changedBy`/`changedByName`, `changedAt`. O modal de edição de plano ganhou seção "Ver histórico de preço" (últimas 10 mudanças). Regras: `price_history` só admin lê/cria, `update`/`delete` bloqueados (histórico é apend-only).
2. ~~**Preço travado por assinante como fonte de verdade explícita**~~ já era o comportamento real (`subscriptions.price`/`interval`); não havia gap de código a corrigir, só a formalização já registrada aqui e no `AUDITORIA_FINANCEIRO_2026-07.md` (achado A4).
3. **⏭️ Reconciliação periódica automática AbacatePay vs Firestore — adiada, não implementada.** Decisão consciente: o schema de resposta do endpoint de listagem de transações da AbacatePay (`/v2/checkouts/list` ou equivalente) não está documentado no código nem confirmado neste projeto — só a existência do endpoint e um health-check (`{success:true}`) foram vistos. Implementar um parser contra nomes de campo adivinhados arrisca introduzir falsos-negativos/positivos piores que não ter reconciliação nenhuma. **Pré-requisito pra retomar:** confirmar o schema real (docs oficiais da AbacatePay ou uma chamada de teste registrada) antes de escrever o parser.
4. **✅ Ledger simples de despesas gerais.** Nova coleção `general_expenses` (descrição, categoria — domínio/ferramentas/contratado/outro —, valor, data), lançamento manual na aba Central (`FinanceOverviewTab.tsx`) com listagem dos últimos 90 dias e exclusão. Os últimos 30 dias somam-se ao `totalCost` (VM + IA + despesas gerais) — a margem líquida agora reflete o negócio inteiro, não só infraestrutura técnica.

**Risco realizado:** baixo — itens 1 e 4 são coleções/subcoleções novas e aditivas, sem tocar em dado financeiro existente; regras do Firestore atualizadas (`firestore.rules`) e **precisam de deploy** (`firebase deploy --only firestore:rules`) antes de funcionar em produção.

---

## Fase D — Operação e compliance (Brasil) ✅ 2/3 EXECUTADOS em 07/07/2026

1. **✅ Status de nota fiscal por transação.** Metadado em `transactions/{id}/nf/status` (subcoleção — a transação em si continua imutável fora do webhook, só admin SDK escreve nela). Badge clicável na tabela de transações (Pendente/Emitida, toggle), filtro por status de NF na aba Transações. Emissão da NF continua fora do sistema (outro serviço de NF-e); isto só rastreia se já foi emitida.
2. **✅ Exportação formatada pra contador.** CSV de Transações evoluído: colunas de Valor Bruto, Taxa de Gateway Estimada e Valor Líquido Estimado por transação (usa `estimateNetRevenue` por linha, mesma fórmula da Central), mais coluna de status de Nota Fiscal.
3. **⏭️ Terreno pronto pro Billing Export real do GCP — bloqueado externamente, não implementado.** Depende de ativação de billing export do GCP (fora do alcance de mudança de código; ver `DOCUMENTACAO_OFICIAL.md` §11/§17). A Fase A já deixa o sistema pronto pra receber o número real quando disponível (VM suspensa contando, disco real documentado como não sincronizado).

**Risco realizado:** baixo — feature aditiva, não mexeu em cálculo existente. Item D.1 introduziu uma subcoleção nova (`transactions/{id}/nf`) com regra própria (mesmo motivo do item C.1: manter a transação em si imutável fora do webhook).

---

## Ordem recomendada

| Fase | O que resolve | Esforço | Risco |
|---|---|---|---|
| A — Fundação | 6 números errados sendo exibidos/perdidos hoje | Médio | Médio (toca receita/custo real) |
| B — Centro coeso | Painel confuso vira painel confiável + métricas de SaaS que faltam | Médio-alto | Baixo |
| C — Rastreabilidade | Histórico de preço, reconciliação externa, despesas gerais | Médio | Baixo-médio |
| D — Compliance BR | Nota fiscal, export contábil, preparação pro billing real | Baixo-médio | Baixo |

**Sugestão:** Fase A é a única não-negociável antes de qualquer coisa nova — construir métricas bonitas em cima de um MRR que já está errado só espalha o erro. B/C/D podem ser priorizadas por você conforme a urgência real do negócio (ex.: se ainda são poucos clientes, churn/cohort da Fase B tem menos valor imediato que a reconciliação da Fase C).

---

## Decisões ainda em aberto

1. ~~Taxas de gateway (item A5)~~ — resolvido na Fase A: implementado como estimativa (`estimateNetRevenue`), documentado na UI que é uma estimativa (taxa configurada pelo admin, não a taxa real por transação — essa a AbacatePay não expõe hoje).
2. ~~`diskUsedGb` (item A3)~~ — resolvido: removido o medidor decorativo (ligar ao dado real exigiria um mecanismo de sincronização novo, maior escopo que a Fase A).
3. ~~Prioridade das Fases B/C/D~~ — resolvido: todas executadas em sequência (A→B→C→D) em 07/07/2026.
4. **Reconciliação automática AbacatePay (item C.3) — pendente, bloqueada.** Precisa do schema real do endpoint de listagem de transações da AbacatePay antes de implementar (ver Fase C acima).
5. **Billing export real do GCP (item D.3) — pendente, bloqueado externamente.** Fora do alcance de mudança de código; depende de ativação de billing export na conta GCP.
6. **Deploy pendente:** as novas regras do Firestore (`price_history`, `general_expenses`, `transactions/{id}/nf`) foram escritas em `firestore.rules` mas **não foram deployadas**. Rodar `firebase deploy --only firestore:rules` antes de usar essas features em produção — sem isso, leitura/escrita nessas coleções falha com permission-denied.
