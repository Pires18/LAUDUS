# Auditoria — Documentação, Configuração, Admin, Integrações e Financeiro

**Data:** 2026-07-05 · **Status:** vivo · **Complementares:** [Documentação Oficial](DOCUMENTACAO_OFICIAL.md) · [Auditoria Completa](AUDITORIA_COMPLETA_2026-07.md) · [Plano Final de Produção](PLANO_FINAL_PRODUCAO_2026-07.md)

Levantamento factual pedido pelo usuário cobrindo: documentação, configuração, painel admin, todas as integrações externas (incluindo Google Cloud/Gemini) e controle financeiro. Sem implementação ainda — é a base para decidir prioridades.

---

## 1. Documentação

**Links internos:** todos os links de `docs/DOCUMENTACAO_OFICIAL.md` resolvem corretamente após a reorganização (`docs/archive/`, `docs/roadmaps/`, `docs/pacs/`, `docs/legal/`).

**Achado — documentação desatualizada (Anthropic):**
- `CHANGELOG.md` (v2.0.0, linhas ~43-46) ainda descreve `api/anthropic.ts`, streaming via Anthropic e `claude-haiku-4-5` no copiloto.
- `README.md` (linha ~61) ainda afirma "Suporte a Gemini e Anthropic Claude".
- **Realidade:** Anthropic foi completamente removido (confirmado por memória de sessão anterior e por não existir `api/anthropic.ts` no repo). `DOCUMENTACAO_OFICIAL.md` já está correto ("Google Gemini apenas").
- **Impacto:** baixo tecnicamente, mas confunde quem ler o README/CHANGELOG achando que ainda há suporte a dois provedores de IA.

---

## 2. Configuração / variáveis de ambiente

**Gap — 11 variáveis usadas no código mas ausentes do `.env.example`** (todas relacionadas a provisionamento PACS/GCP/Tailscale, usadas em `api/pacs-provision.ts`):
`GCP_PROJECT_ID`, `GCP_SA_KEY`, `GCP_ZONE`, `PACS_MOCK`, `PACS_IMAGE`, `PACS_SCRIPTS_URL`, `PACS_SHARED_AGENT_URL`, `PACS_ADMIN_SECRET`, `TAILSCALE_API_KEY`, `TAILSCALE_TAILNET`, `TAILSCALE_TS_NET`.

Isso é um risco de onboarding: alguém configurando um ambiente novo (ou um segundo desenvolvedor) não teria como saber que essas variáveis existem sem ler o código-fonte.

**Variáveis documentadas mas sem uso encontrado** (candidatas a limpeza): `VITE_LOG_LEVEL`, `VITE_ORTHANC_WORKLIST_DIR`, `VITE_PYTHON_PATH` (legado do PACS local, pré-agente).

**Firestore — índice ausente:** a query em `ClinicTeamCard.tsx` (`where('ownerId','==',...)`, `where('clinicId','==',...)` na coleção global `clinic_memberships`) não tem índice composto correspondente em `firestore.indexes.json`. Em produção isso normalmente dispara um erro do Firestore com um link para auto-criar o índice — mas até alguém clicar nesse link, a tela "Equipe da Clínica" quebra silenciosamente para qualquer clínica com convites.

---

## 3. Painel Admin

Estrutura confirmada em `src/modules/admin/`: abas Overview, LAUD.IA Insights, Usuários/Assinaturas, **Financeiro**, Auditoria, Suporte, Máscaras, Saúde do Sistema.

**Financeiro (`AdminFinanceiro.tsx`)** tem 9 sub-abas: overview, plans, pacs-plans, vm-infra, features, extra-resources, abacatepay, **ia-costs**, transactions. Já mostra MRR, custo de VM, custo de IA (agregado) e margem líquida — mais robusto do que eu esperava.

**Gaps confirmados:**
- Custo de IA é mostrado **agregado**, não por usuário — não existe ranking "top consumidores de IA" nem visão de quanto CADA usuário custou este mês.
- Nenhuma tela dentro do Admin para configurar credenciais de integrações (GCP, Tailscale, Sentry) — tudo depende de env vars da Vercel. Isso é uma escolha razoável de segurança (segredos não deveriam ser editáveis por UI mesmo por admin), mas vale deixar explícito que não é uma lacuna a "corrigir", é intencional.

---

## 4. Integrações externas

| Integração | Status | Observação |
|---|---|---|
| **Google Gemini** | ✅ Implementado e funcional | `api/gemini.ts`; custo por chamada gravado em `ai_usage` (tokens + `costUsd`); rate limit distribuído (KV) já em produção; sem referências a modelos mortos fora de fallbacks de compatibilidade. |
| **Firebase (Auth/Firestore/Storage)** | ✅ Implementado e funcional | Cliente e Admin SDK corretamente configurados; multi-aba via `persistentMultipleTabManager`. |
| **AbacatePay** | ✅ Implementado e funcional | Webhook valida HMAC-SHA256 + idempotência por `webhook_events/{eventId}`; endpoint mock **bloqueado em produção** (`isProduction()` check confirmado). |
| **Google Drive/Docs (export)** | ✅ Implementado e funcional | Refresh silencioso de token OAuth com fallback interativo; escopo mínimo (`drive.file`). |
| **Sentry** | ✅ Implementado e funcional | No-op sem `VITE_SENTRY_DSN`; redação de PII (e-mail/CPF/telefone) antes do envio. |
| **PACS Proxy (Orthanc/Worklist)** | ✅ Implementado e funcional | Autenticação via JWKS (Firebase ID token), anti-SSRF em duas camadas (proxy + agente local). |
| **Provisionamento de VM (GCP + Tailscale)** | ⚠️ Parcial | Criação de VM implementada e funcional (`api/pacs-provision.ts`), com modo mock seguro quando faltam credenciais. **Falta**: lifecycle completo (suspender/destruir VM ao cancelar assinatura) — mencionado no roadmap como "Fase 6", não implementado. |
| **Monitoramento de custo/billing do GCP** | ❌ Não implementado | Não há integração com a Billing API do Google Cloud nem alerta de custo de infraestrutura dentro do Admin — hoje isso só é visível no Console do Google Cloud, fora do LAUD.US. O painel Financeiro estima custo de VM por tabela de preço fixa (plano × disco), não pela fatura real do GCP. |

**Conclusão desta seção:** nenhuma integração está quebrada. As lacunas são todas de **automação/observabilidade** em torno do PACS/GCP (lifecycle de VM e billing real), não de integrações centrais do produto (IA, pagamento, dados).

---

## 5. Controle financeiro

**O que existe e funciona:**
- Receita real: `transactions` (gravada pelo webhook do AbacatePay) + `global_config/finance_stats` (agregado incremental).
- MRR teórico: calculado separadamente pelo CRON (`api/cron-aggregate-metrics.ts`), a partir da soma de preços de assinaturas ativas.
- Custo real de IA: `users/{uid}/ai_usage.costUsd`, calculado por chamada (tokens de entrada/saída × preço do modelo, tabela em `engine.ts`, editável no Admin em "Custos de IA").
- Custo de VM: estimado por plano PACS (starter/pro/dedicado) × preço fixo configurado, não pela fatura real do GCP.
- Margem líquida agregada: `MRR − (custo VM + custo IA em BRL)`, exibida no overview financeiro.

**O que NÃO existe (gaps reais, não apenas "poderia ser melhor"):**
1. **Sem reconciliação entre MRR teórico e receita realmente cobrada** — os dois números aparecem lado a lado, mas nada valida que batem (ex: assinatura marcada `active` no Firestore mas cujo pagamento na AbacatePay falhou silenciosamente não é pego automaticamente).
2. **Sem margem por usuário ou por plano** — só existe o agregado total. Não dá pra saber se o plano Essencial dá lucro ou prejuízo médio.
3. **Sem alerta de prejuízo por consumo** — um usuário no plano mais barato gerando muitos laudos no motor Pro pode custar mais em IA do que a assinatura paga, e isso não é sinalizado em lugar nenhum.
4. **Custo de VM não bate com fatura real do GCP** — é uma estimativa por tabela fixa, não a cobrança real da nuvem.

---

## 6. Resumo — o que é urgente vs o que é robustez futura

| Prioridade | Item | Esforço estimado |
|---|---|---|
| **Alta (rápido, baixo risco)** | Corrigir README.md/CHANGELOG.md (remover menções a Anthropic) | ~15 min |
| **Alta (rápido, evita bug em produção)** | Adicionar índice composto `clinic_memberships(ownerId, clinicId)` em `firestore.indexes.json` + deploy | ~15 min |
| **Média** | Documentar as 11 variáveis de PACS/GCP/Tailscale no `.env.example` | ~20 min |
| **Média** | Limpar variáveis não usadas (`VITE_LOG_LEVEL`, `VITE_ORTHANC_WORKLIST_DIR`, `VITE_PYTHON_PATH`) | ~10 min |
| **Média** | Visão de "top consumidores de IA" no Admin (usa dado que já existe em `ai_usage`) | ~meio dia |
| **Média-Alta** | Reconciliação MRR vs receita real + alerta de prejuízo por consumo | ~1-2 dias (decisão de produto: o que fazer quando detectar divergência) |
| **Baixa (decisão de negócio, não técnica)** | Lifecycle de VM (suspender/destruir ao cancelar) e integração com Billing API do GCP | Vários dias — depende de quanto a escala de PACS já justifica o investimento |

Nenhum destes itens é bloqueador de segurança ou vazamento de dado — são gaps de precisão operacional/financeira e alguns pontos de documentação desatualizada.
