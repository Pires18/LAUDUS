# 🔍 Auditoria Profunda — Módulo Financeiro do Admin (07/07/2026)

**Data:** 2026-07-07 · **Escopo:** as 9 abas do Financeiro (`Central`, `Planos`, `Planos PACS`, `VMs/Infra`, `Funcionalidades`, `Recursos Extras`, `AbacatePay`, `Custos de IA`, `Histórico`) — `AdminFinanceiro.tsx` (1.681L) + `finance/FinanceOverviewTab.tsx`, `finance/TransactionsTab.tsx`, `finance/VmInfraTab.tsx`, `finance/PacsPlansTab.tsx`.
**Método:** 3 revisões paralelas profundas (uma por grupo de abas), cada uma seguindo o dinheiro do admin até o código que efetivamente processa/exibe — não só "o botão funciona", mas "a conta bate". Complementa (não repete) a [Auditoria geral do Admin](AUDITORIA_ADMIN_2026-07.md), já corrigida numa rodada anterior (validação numérica, confirmações, auditoria).
**Complementar:** [Proposta de Centro Financeiro](PROPOSTA_CENTRO_FINANCEIRO_2026-07.md) — o que fazer com estes achados.

---

## Resumo executivo

A rodada anterior já resolveu os problemas de "proteção" (validação, confirmação, auditoria). Esta rodada foi mais fundo e achou algo mais sério: **alguns dos números mostrados no Financeiro estão matematicamente errados**, não por falta de proteção, mas por bugs reais na fórmula — e dois deles (MRR e custo de IA) alimentam o card mais visível da aba Central.

Nenhum é malicioso ou catastrófico isoladamente, mas juntos formam um padrão: **o sistema tem os dados certos guardados, mas alguns dos cálculos que os transformam em "o número que o admin vê" estão errados ou desconectados da realidade.**

---

## 🔴 Crítico — números errados sendo exibidos ou dinheiro/acesso perdido

### 1. MRR/ARR do card principal está matematicamente errado para assinantes semestrais
`api/cron-aggregate-metrics.ts:111` — `mrr += pl.interval === 'year' ? pl.price / 12 : pl.price`. Só trata `'year'` especialmente; `'semester'` cai no `else` e o preço semestral inteiro é somado como se fosse mensal — **6x de superestimação** para cada assinante semestral. Contraste: o helper correto (`intervalMultiplier`, `api/_pricing.ts:125-127`) já existe e é usado corretamente em outro lugar do mesmo sistema — só não aqui.

Dois problemas adicionais na mesma função:
- Só conta `status === 'active'`, exclui `trialing` (`cron-aggregate-metrics.ts:108-114`) — mas o rótulo da UI diz "ativas + trials c/ preço" (`FinanceOverviewTab.tsx:274`). O cálculo e o rótulo descrevem coisas diferentes.
- Usa o preço **atual do catálogo** (`saas_plans`), não o preço travado na assinatura (`subscriptions.price`/`subscriptions.interval`, gravado no ato da venda) — se o preço do plano mudou depois que alguém assinou, o MRR desse assinante muda retroativamente sem ele ter pago nada a mais.

**Consequência visível:** a aba Central mostra **dois números de MRR que não batem, lado a lado, sem explicação.** O card "MRR Teórico" (linha 240/274) usa `summary.mrr` (do CRON, com os 3 bugs acima); o painel "Receita por Intervalo" (`mrrByInterval`, linhas 97-125) é calculado no cliente, corretamente, com `intervalMultiplier` e incluindo trials. Um admin que preste atenção nos dois números vai notar que não somam e não vai saber por quê.

### 2. Custo de IA pode zerar silenciosamente
`src/modules/ai/engine.ts:105` — `prices = PRICING[m.modelName] || { input: 0, output: 0 }`. Se o nome exato do modelo retornado pela Gemini não bater com uma chave hardcoded nessa tabela, o custo daquela chamada vira **0, sem log, sem aviso**. Modelos preview da Gemini trocam de ID com frequência — isso não é hipotético.

Piora: existe uma **segunda tabela de preços completamente desconectada** só para exibição — `GEMINI_PRICING` dentro do `IACostsTab` (`AdminFinanceiro.tsx:99-106`). As duas coincidem hoje por acaso (mesmos valores digitados duas vezes em lugares diferentes); nada garante que continuam sincronizadas quando uma mudar. Um admin editando o "custo por mil tokens" na aba Custos de IA pode estar editando um número que a aba **Central** nem lê.

### 3. Medidor de disco do PACS é decorativo — sempre mostra 0%
`api/pacs-provision.ts` inicializa `diskUsedGb: 0` na hora de provisionar e **nenhum código em todo o `api/` escreve nesse campo depois**. `VmInfraTab.tsx` usa esse valor pro medidor de uso por VM e pro alerta de "90% cheio" (linhas ~107, 304, 321-325) — que **nunca pode disparar**, porque o número nunca sai de 0. Não é "estimativa imprecisa" (isso já é sabido/aceito para o custo de GCP) — é um campo morto, dando falsa sensação de que nenhum PACS está perto do limite.

### 4. VMs suspensas (ainda rodando, ainda custando, sem receita) somem dos KPIs
`VmInfraTab.tsx:151` — `active = rows.filter(r => r.status === 'ready')`, e só `active` entra em `totalRevenue`/`totalCost`/`totalMargin`. Uma VM `suspended` (assinatura cancelada, 14 dias de carência antes de destruir de vez — `api/reset-monthly-reports.ts:156-174`) continua **rodando e sendo cobrada pelo GCP**, mas some dos totais de receita/custo/margem — exatamente o cenário de pior margem que uma ferramenta financeira deveria destacar, e ele fica invisível.

### 5. Taxas de cartão/PIX configuradas não afetam nenhum número real
`cardFeePercent`/`cardFeeFixedBrl`/`pixFeePercent` só são lidos em `api/abacatepay-mock-gateway.ts` (fluxo de simulação). No fluxo real (`abacatepay-checkout.ts`, `abacatepay-webhook.ts`) esses campos nunca são lidos. Resultado: a aba AbacatePay deixa o admin configurar "taxa do cartão" achando que isso vai aparecer em algum cálculo de receita líquida — e não aparece em nenhum. Toda receita mostrada no sistema é bruta (antes da taxa do gateway), sem essa configuração ter efeito nenhum sobre dinheiro real.

### 6. Trocar de plano pode apagar um add-on avulso pago, sem aviso nem estorno
`api/abacatepay-webhook.ts:230-233` — no caminho de assinatura nova/upgrade (`!opts.isRenewal`), `subData.addons = addons` **sobrescreve o array inteiro** com só o que o novo plano inclui (`planToAddons`), descartando qualquer add-on comprado avulso antes. Cenário real: usuário compra "Calculadoras" avulso no Plano Base, depois faz upgrade pro Plano Pro (que não inclui PACS, mas ele também tinha comprado PACS avulso) — o upgrade zera os add-ons pro que o Plano Pro define, e o PACS pago some. Sem estorno, sem aviso, só descoberto quando o usuário notar que perdeu acesso.

---

## 🟠 Alto

| # | Achado | Onde |
|---|---|---|
| A1 | Alerta de reconciliação (MRR vs receita 30d) compara mensal-equivalente recorrente contra receita bruta de 30 dias que inclui compras avulsas semestrais/anuais de valor cheio — **qualquer mês com renovações semestrais/anuais dispara falso alarme** de "possível falha de webhook" | `FinanceOverviewTab.tsx:249-250` |
| A2 | Margem mistura janelas de tempo: MRR é snapshot do dia, custo de IA é acumulado de 30 dias — margem parece artificialmente boa logo após crescimento, artificialmente ruim logo após cancelamento em massa | `FinanceOverviewTab.tsx:246` |
| A3 | Zero validação de coerência entre preços mensal/semestral/anual — pode salvar semestral mais caro por mês que o mensal, ou anual mais barato que 1 mês | `PlanFormModal`, `AdminFinanceiro.tsx:591-609` |
| A4 | Sem versionamento/grandfathering de preço — mudar o preço do plano no catálogo muda o que assinantes existentes pagam na renovação, não só novos assinantes | `activateSubscription`, `api/abacatepay-webhook.ts:199-223` |
| A5 | Sem AR aging — só mostra faturas vencendo em ≤7 dias, nada mostra as que já venceram e não foram pagas (modo `billingMode:'invoice'`) | `FinanceOverviewTab.tsx:423-465` |
| A6 | `PacsPlansTab` (preço do PACS) e `VmInfraTab` (custo real do PACS) são desconectados no momento de DEFINIR o preço — a checagem de margem só existe depois, reativamente, na aba de infra | `PacsPlansTab.tsx`, `VmInfraTab.tsx:149` |
| A7 | Texto da UI desatualizado: bulk-delete de planos ainda fala em "variantes de intervalo" (modelo de dados antigo) — hoje é 1 doc só com os 3 preços embutidos, não existe mais risco de drift entre variantes, mas o texto confunde sobre o que a ação realmente faz | `AdminFinanceiro.tsx:320,360` |
| A8 | Risco de drift entre webhook secret no Firestore e env var da Vercel — Firestore sempre vence quando populado (mitigado), mas nada avisa se divergirem, e o onboarding ainda instrui configurar os dois | `api/abacatepay-webhook.ts:343-351` |

---

## 🟡 Lacunas estruturais (não são bugs — são o que falta para ser um centro financeiro completo)

- Sem série histórica de MRR/custo/margem (tudo é foto do dia atual, não dá pra ver tendência sem acompanhar manualmente).
- Sem churn (nem de clientes nem de receita), sem cohort/retenção, sem ARPU, sem LTV, sem taxa de conversão trial→pago.
- Sem previsão/projeção de receita.
- Sem alerta configurável de "cliente com margem negativa" (a coluna existe na tabela, mas não gera alerta com threshold).
- Sem reconciliação periódica automática entre o que a AbacatePay diz que processou e o que está gravado localmente (a trilha confia 100% no próprio processamento do webhook).
- Sem cupons/promoções, sem A/B de preço, sem pricing regional.
- Sem rastreio de despesas fora de VM+IA (domínio, ferramentas, contratados, etc.).
- Sem status de nota fiscal / obrigação fiscal por transação.
- Sem exportação com taxa/líquido separados (CSV atual é só valor bruto).

---

## ✅ O que já está sólido — confirmado, não retrabalhar

- CSV export (Transações e Auditoria) com escaping correto.
- Validação numérica, confirmações e `addAuditLog` já corrigidos na rodada anterior — nenhum reaparece aqui.
- **Fluxo PACS-pricing → `MyPacsCard.tsx` confirmado ponta a ponta**: o preço que o admin configura é exatamente o que o cliente vê.
- **Fluxo AbacatePay credenciais → checkout/webhook confirmado ponta a ponta**: os nomes de campo batem exatamente (`apiKey`, `webhookSecret`, `sandboxMode`).
- **`FeaturesTab` NÃO é órfão** — achado inicial da auditoria estava incompleto: `FeaturesTab` define preço/descrição do add-on avulso; quem concede o acesso de fato são os toggles `includesX` no editor de plano, via `planToAddons` → `sub.addons[]` → `useSubscription` → consumido em Calculators/DicomControlCenter/Sidebar. As duas telas juntas formam o mecanismo completo — confirmado rastreando até o consumo real no cliente.
- Contadores de status/exclusão de planos já protegidos por confirmação (rodada anterior).
- `SubscriptionCenter.tsx` trata corretamente "já incluso no plano" — não oferece recompra ao usuário, evitando duplo-charge na *UI* (o risco real é o overwrite de add-on avulso no webhook, achado #6 acima — invisível na UI, só descoberto quando o acesso some).

---

*Ver [PROPOSTA_CENTRO_FINANCEIRO_2026-07.md](PROPOSTA_CENTRO_FINANCEIRO_2026-07.md) para o plano de correção e evolução.*
