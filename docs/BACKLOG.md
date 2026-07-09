# Backlog — itens abertos conhecidos

> Lista única e viva de tudo que foi identificado como **genuinamente ainda aberto**
> durante a auditoria documental de 2026-07-08, com a origem citada. Isto substitui
> a necessidade de vasculhar `docs/archive/` atrás de pendências — se não está aqui,
> foi resolvido ou nunca foi confirmado como problema real. Atualize esta lista (não
> os documentos arquivados) conforme os itens forem sendo tratados.
>
> Para o estado atual completo do sistema, ver [`DOCUMENTACAO_OFICIAL.md`](./DOCUMENTACAO_OFICIAL.md).
> Esta tarefa é de **documentação** — nenhum destes itens foi corrigido nesta sessão,
> apenas confirmado e catalogado.

---

## 🔴 Admin

- **Sem desativação de conta no Firebase Auth ao deletar usuário** — hoje o delete
  remove dados do Firestore mas a conta de autenticação permanece ativa; precisa de
  um endpoint serverless novo (ainda não existe).
  Origem: `docs/archive/PLANO_FINALIZACAO_ADMIN_2026-07.md` (item deixado fora de escopo).
- **M2 — recálculo de transações sem paginação** — pode ficar pesado com histórico grande.
  Origem: `docs/archive/PLANO_FINALIZACAO_ADMIN_2026-07.md`.
- **M3 — sem guarda de concorrência entre as abas "Features" e "Recursos Extras"** —
  edições simultâneas podem se sobrescrever.
  Origem: `docs/archive/PLANO_FINALIZACAO_ADMIN_2026-07.md`.
- **Busca/paginação de usuários ainda client-side** (Fase 3 do plano de admin) —
  deferido conscientemente até a base atingir ~1-2 mil usuários; não é bug, é gatilho
  de revisão futura.
  Origem: `docs/roadmaps/ADMIN_IMPROVEMENT_PLAN.md`.
- **Exportação de transações filtradas** — status "não verificado" na última passada.
  Origem: `docs/roadmaps/ADMIN_IMPROVEMENT_PLAN.md`.

## 🔴 Arquitetura multi-usuário / clínicas

- **Camada de query do client não roteia para o UID do owner em memberships
  convidados** — mesmo com `clinic_memberships` implementado, o app ainda consulta
  dados sob o UID de quem está logado, não do dono da clínica, para membros
  convidados. Gap arquitetural real, não apenas de UX.
  Origem: `docs/archive/PLANO_FINAL_PRODUCAO_2026-07.md` §2.1.

## 🔴 Billing / Financeiro

- **Cron de expiração de assinatura avulsa ausente** — `api/cron-expire-subscriptions.ts`
  não existe no repositório (confirmado por `ls api/` em 2026-07-08). Planos fora do
  ciclo mensal automático (avulsos) não são expirados automaticamente.
  Origem: `docs/archive/PLANO_PLANOS_INTERVALOS_ABACATEPAY.md` (item P6).
- **Reconciliação com a API de transações da AbacatePay** — deliberadamente adiada;
  o schema da API não está documentado/confirmado.
  Origem: `docs/archive/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md` (Fase C).
- **Exportação real de billing do GCP** — bloqueado externamente, aguardando
  confirmação de ativação do billing export pelo usuário.
  Origem: `docs/archive/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md` (Fase D).

## 🟠 PACS/DICOM

- **Sem gestão de frota de VMs no painel admin** (F5 do plano de automação) — não
  encontrado no código; provisionamento funciona, mas não há visão consolidada das
  VMs ativas para o time interno.
  Origem: `docs/roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md`.
- **Verificação server-side de consistência do `dicomTenantId`** — hoje a checagem é
  só client-side/sob demanda; foi uma das 5 causas-raiz do incidente MX7.
  Origem: `docs/pacs/incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md`.

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
  auditoria de 04/07, mas segue como dívida técnica.
  Origem: `docs/archive/PLANO_REFINAMENTO.md` (item R7).
- **Cobertura de testes dos componentes do Editor** (Fase 5 do plano de melhorias) —
  explicitamente marcada como "só se sobrar tempo", nunca executada.
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
