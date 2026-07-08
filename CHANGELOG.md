# Changelog — LAUD.US

Todas as mudanças relevantes do projeto são documentadas aqui.  
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não versionado] — 2026-07-07

### Financeiro — correção de bugs de cálculo + Centro Financeiro (Fases A e B)
Auditoria profunda do Financeiro (`docs/AUDITORIA_FINANCEIRO_2026-07.md`) encontrou números com fórmula errada sendo exibidos como corretos. Fase A (fundação, 6/6) + início da Fase B (Central reorganizada):
- **MRR/ARR corrigido**: `api/cron-aggregate-metrics.ts` superestimava assinantes semestrais em 6x (só tratava `interval==='year'` como não-mensal) e usava o preço atual do catálogo em vez do preço travado na assinatura. Reescrito com `computeMrr()` (testável, usa `intervalMultiplier`).
- **Preço de IA unificado**: existiam duas tabelas de preço por modelo Gemini desconectadas (uma real em `engine.ts`, uma só de exibição no Admin) — unificadas em `src/modules/ai/modelPricing.ts`. Modelo sem preço mapeado agora loga erro (Sentry) em vez de custar $0 em silêncio.
- **Medidor de disco do PACS removido**: `diskUsedGb` nunca era atualizado após o provisionamento — era decorativo, sempre 0%. Substituído por exibição honesta da cota provisionada.
- **VMs suspensas agora entram nos KPIs de custo** (`VmInfraTab.tsx`) — antes somiam dos totais mesmo continuando a custar no GCP sem gerar receita.
- **Bug de dados real corrigido**: trocar de plano podia apagar um add-on avulso pago (ex.: comprar PACS avulso, depois fazer upgrade de plano apagava o PACS, sem estorno). `activateSubscription` agora faz merge em vez de substituir o array de add-ons.
- **Taxas de gateway implementadas** como receita líquida estimada: novo `estimateNetRevenue()` usa a taxa configurada em AbacatePay → Config contra a receita quebrada por método de pagamento (`revenueByMethod`/`countByMethod`, novos campos diários do CRON) — mostrado na Central ao lado da receita bruta.
- **Reconciliação MRR reformulada**: comparava MRR (mensal-equivalente) contra receita bruta de 30 dias, o que incluía compras avulsas semestrais/anuais e gerava falso-positivo garantido em mês de renovação. Agora compara só contra receita de assinaturas MENSAIS (`revenueByInterval`, novo campo do CRON).
- **Série histórica**: gráficos de receita bruta diária e custo de IA diário (30 dias) na Central, reutilizando o componente de gráfico SVG já usado em Analytics (extraído para `components/MiniCharts.tsx`, sem nova dependência).
- **AR aging unificado**: a lista de "cobranças" da Central agora mostra faturas a vencer em ≤7 dias E já vencidas (status `past_due`), antes só mostrava as futuras.
- **Churn, ARPU, LTV, conversão trial→pago**: novos KPIs na Central — cancelamentos dos últimos 30 dias (clientes + MRR perdido), receita média por assinante, LTV estimado, e taxa de conversão do trial de 14 dias (cohort por `users.createdAt`, já que trials orgânicos não viram documento de assinatura).
- **Alerta de margem negativa com limiar configurável**: a lista de "clientes dando prejuízo" ganhou um limiar (R$) editável — banner proeminente só quando alguém passa do limiar, tabela detalhada continua mostrando toda perda.
- **+28 testes** cobrindo os bugs de dados corrigidos e os novos KPIs (MRR, merge de add-ons, receita líquida, churn).

### Financeiro — Centro Financeiro, Fases C e D (rastreabilidade + compliance BR)
Continuação da [Proposta de Centro Financeiro](docs/PROPOSTA_CENTRO_FINANCEIRO_2026-07.md): 5/7 itens executados, 2 adiados conscientemente (dependem de informação externa indisponível hoje).
- **Histórico de mudança de preço por plano**: `saas_plans/{id}/price_history` (subcoleção, apend-only) grava snapshot antes/depois a cada mudança de preço via `PlansTab`; modal de edição ganhou seção "Ver histórico de preço".
- **Ledger de despesas gerais**: nova coleção `general_expenses` (descrição, categoria, valor, data) — lançamento manual na Central, últimos 30 dias somam ao custo total (VM + IA + despesas gerais), refletindo a margem líquida do negócio inteiro.
- **Status de nota fiscal por transação**: `transactions/{id}/nf/status` (subcoleção — a transação em si permanece imutável fora do webhook); badge clicável (Pendente/Emitida) e filtro na aba Transações.
- **Export CSV de contador**: colunas de Valor Bruto, Taxa de Gateway Estimada e Valor Líquido Estimado por transação, mais status de NF.
- **Adiado — reconciliação automática AbacatePay vs Firestore**: schema do endpoint de listagem de transações da AbacatePay não está confirmado no código; implementar contra campos adivinhados foi julgado arriscado demais. Retomar só após confirmar o schema real.
- **Adiado — billing export real do GCP**: bloqueado externamente (depende de ativação na conta GCP), fora do alcance de mudança de código.
- **Pendente de deploy**: regras novas do Firestore (`price_history`, `general_expenses`, `transactions/{id}/nf`) escritas em `firestore.rules` mas não deployadas — rodar `firebase deploy --only firestore:rules` antes de usar em produção.

### Adicionado
- **Aba Estruturado do Copiloto** — 3ª aba do editor (Chat/Formulário/Estruturado): formulário tipado derivado de cada máscara, cobrindo as 10 áreas clínicas, com cálculo em tempo real (`liveCompute.ts`: PFE Hadlock+percentil OMS, RCP, IG/DPP, ILA, Doppler renal bilateral, NASCET, ITB, BPP...), escores inline (TI-RADS aditivo, sugestões BI-RADS/O-RADS/Bosniak, Graf), seções normal/alterado, itens repetíveis e campos condicionais. Preview interativo dentro do editor de máscaras (`TemplateEditor`). Ver §4.1.1 da [Documentação Oficial](docs/DOCUMENTACAO_OFICIAL.md).
- **LAUD.IA — backfill de qualidade** — `backfillQualityRecordsFromCorpus` calcula Score/Segurança retroativamente sobre o histórico do Corpus de Excelência (antes só populava com finalizações novas); botão "Calcular notas" no `TrainingDashboard`.
- **LAUD.IA — Regras Rígidas V2.0** (`general.ts`): R9 (Segurança Pediátrica) e R10 (Versões de Classificações RADS/Bosniak/GRADS/FIGO), 9 Leis de Ouro do Refinamento (eram 6), 3 sub-protocolos do Copiloto documentados. `docs/CASCADE_PROMPTS.md` sincronizado com o código real (V2.0).
- **Calculadora FMF pré-eclâmpsia** — adicionado marcador PSV ratio (Gana 2022) ao modelo bayesiano.

### Modificado
- **Infraestrutura Vercel** — projeto migrado de Hobby para **Pro**; removido o teto de 12 funções serverless; `cron-aggregate-metrics` passou de 1×/dia para horário.
- **`logger.error`** agora reporta exceções ao Sentry (`Sentry.captureException`) quando `VITE_SENTRY_DSN` está configurado — fechava o único TODO real remanescente no código.
- **Documentação reorganizada** — auditorias/planos já executados (`AUDITORIA_COMPLETA_2026-07`, `AUDITORIA_INTEGRACOES_FINANCEIRO_2026-07`, `PLANO_REFINAMENTO`, `PLANO_FINAL_PRODUCAO_2026-07`, `PLANO_PLANOS_INTERVALOS_ABACATEPAY`) movidos para `docs/archive/`; nova [Auditoria Completa 07/07](docs/AUDITORIA_COMPLETA_2026-07-07.md) e [Plano de Melhorias](docs/PLANO_MELHORIAS_2026-07.md) substituem os anteriores como fonte viva.
- **`vendor-icons` 898 kB → 87,6 kB (−90%)** — `AreaIcon.tsx` usava `import * as LucideIcons` com lookup dinâmico por string, o que impedia o Rollup de tree-shakear o pacote inteiro (3.904 ícones exportados, ~200 usados); reescrito com mapa estático dos 10 ícones de `EXAM_AREAS`.
- **`calculateAge()` consolidada** — a versão usada na UI/documentos (`utils/format.ts`) mostrava "0 anos" para bebês e nunca pluralizava corretamente ("1 anos"); promovida a versão mais completa de `ai/engine.ts` (já usada só no prompt da IA) para `format.ts`, removida a duplicata.

### Corrigido
- **`api/pacs-provision.ts`** — o plano Dedicado podia devolver silenciosamente uma VM **falsa** em produção se `GCP_SA_KEY`/`TAILSCALE_API_KEY`/`TAILSCALE_TS_NET` sumissem do ambiente (rotação de chave, env var apagada), sem nenhum erro visível. Aplicada a mesma trava que já existia no plano compartilhado (`shouldBlockMockInProduction`).
- **`api/reset-monthly-reports.ts`** — comentário incorreto dizia que assinaturas anuais tinham período de graça (`past_due`) antes de expirar; o código sempre tratou anual como compra avulsa (expira direto, igual semestral) — comportamento confirmado correto, só o comentário foi corrigido.

### Testado
- **34 testes novos**: os dois endpoints serverless de maior risco (`api/abacatepay-webhook.ts` 15, `api/pacs-provision.ts` 9) e `calculateAge` (10) — 411 testes no total (era 377).

### Módulo Admin — auditoria completa + finalização (07/07/2026)
Auditoria de todas as 8 abas do painel Admin + LAUD.IA (`docs/AUDITORIA_ADMIN_2026-07.md`, 30 achados) seguida da correção da maior parte deles (`docs/PLANO_FINALIZACAO_ADMIN_2026-07.md`):
- **Validação numérica**: preço/cota/disco em todo o Financeiro aceitavam negativo sem checagem (`parseFloat(v) || 0` não bloqueia `-149`); centralizado em `parseNonNegativeNumber`/`parseNonNegativeInt` (`utils/format.ts`) e aplicado em 13+ campos.
- **Confirmações adicionadas**: trocar credenciais AbacatePay (alterna Mock↔Pagamentos Reais), desativar plano ou mudar sua cota (agora mostra quantos assinantes são afetados via `getCountFromServer` antes de gravar), excluir máscara do sistema (avisa que é visível a todos os médicos), Motor Pro/add-on/reativar assinatura.
- **Auditoria (`addAuditLog`) adicionada** onde faltava: Motor Pro, add-on, cancelar/reativar assinatura, e todo o módulo de Suporte (responder/status/nota/limpar tudo).
- **Bugs de dados corrigidos**: falha silenciosa ao sincronizar cota de usuário agora mostra erro real; "Carregar mais" da Auditoria não some mais quando um filtro está ativo.
- **Validação de conteúdo**: `TemplateEditor` exige campos essenciais não-vazios; import de máscaras (`AdminMasks`) valida o lote inteiro antes de gravar qualquer item (rejeita tudo se algo estiver malformado); editor de prompt do Copiloto avisa se um save removeria os marcadores que o parser exige.
- **"Salvar Bloco" do LAUD.IA** agora salva de verdade só o bloco ativo (antes gravava todo o `localSettings`, publicando de brinde rascunhos não-salvos de outras abas).
- Card "Pagamentos" da aba Saúde agora sinaliza `warn`/`down` (não só `ok`/`unknown`); `window.confirm` nativo trocado por `useConfirm()` estilizado em `MyPacsCard.tsx`.
- **Exclusão de usuário (`adminUsers.ts`)** agora também apaga a assinatura órfã (`subscriptions/sub_{uid}`); `ai_usage`/`transactions` mantidos por retenção financeira/fiscal (decisão confirmada com o responsável).
- **`clearAllSupportTickets`** ("Limpar Tudo" do Suporte) reescrita para deletar em lotes de ≤500 (limite do Firestore) — antes um único `writeBatch` quebrava silenciosamente acima disso; botão agora mostra progresso ("Excluindo X/Y...").

### Removido (04/07)
- **Anthropic Claude** — provedor removido por completo (`api/anthropic.ts` excluído); a plataforma passa a usar exclusivamente **Google Gemini** como motor de IA. Corrige também IDs de modelo default e do copiloto que ainda apontavam para versões descontinuadas. As menções a "Anthropic/Claude" em versões anteriores deste changelog refletem o estado da época e não a versão atual.

---

## [2.1.0] — 2026-06-24

### Adicionado
- **ClinicSessionModal** — ao abrir o sistema com 2+ clínicas cadastradas e sem padrão definido, o usuário é solicitado a escolher a unidade ativa da sessão, com opção de fixar como padrão
- **CollectionError** — componente de estado de erro reutilizável para coleções Firestore; exibe mensagem de falha e botão de retry
- **firestore.indexes.json** — índices compostos do Firestore para consultas críticas: `exams` (clinicId + createdAt, patientId + createdAt) e `patients` (name)
- **Settings: Centro de PDF** — nova aba dedicada a configurações de impressão; inclui prévia tipográfica ao vivo, controle de fonte/tamanho/espaçamento/alinhamento e upload de assinatura digitalizada (PNG com fundo transparente)
- **Settings: Upload de assinatura** — imagem enviada para Firebase Storage; exibida no rodapé dos laudos PDF
- **PatientDetail: Edição de histórico clínico inline** — botão de edição no card de Dados Clínicos abre textarea para editar e salvar o histórico sem modal adicional
- **PatientDetail: Acesso rápido a novo laudo** — botão "Novo Laudo" na barra de cabeçalho abre o `CreateExamModal` com o paciente pré-selecionado
- **CreateExamModal: Seletor de data do exame** — campo de data permite registrar a data real do exame independente da data de entrada no sistema
- **CreateExamModal: Auto-registro de paciente** — ao buscar um nome sem resultados, o formulário de cadastro rápido abre automaticamente com o nome já preenchido
- **CreateExamModal: Anamnese pré-preenchida** — ao selecionar um template que possui `anamnesisTemplate`, o campo de anamnese é preenchido automaticamente
- **Worklist: Paginação infinita** — migrada para `usePaginatedCollection` com lotes de 100; botão "Carregar mais" ao atingir o limite
- **Worklist: Notificações sonoras** — ao receber novos exames pendentes em tempo real, um beep suave é sintetizado via Web Audio API (pode ser desativado em Configurações)
- **Patients: Paginação e sort** — migrada para `usePaginatedCollection` (50 iniciais) com ordenação alfabética garantida no cliente
- **Templates: Tratamento de erro** — CollectionError integrado; caso a coleção falhe, exibe estado de erro acionável

### Modificado
- **Settings** — aba "PACS & Integrações" removida do fluxo principal (migrada internamente); abas ativas: Perfil, Centro de PDF, Auditoria, Assinatura & Faturamento
- **Settings: Foto de perfil** — upload direto para Firebase Storage com atualização simultânea do Firebase Auth profile e documento Firestore do usuário
- **PatientDetail** — redesign completo com cabeçalho compacto, grids de informações e seção de laudos históricos com badges de status e clínica

### Corrigido
- **Settings.tsx** — removidos 6 imports Lucide não utilizados (`Database`, `Server`, `Wifi`, `HardDrive`, `Shield`, `Cloud`) que geravam dead-code no bundle
- **CreateExamModal** — conflito de clínica inicial resolvido: usa `selectedClinicId` do contexto como primeiro critério

### Infraestrutura
- Versão bump: `2.0.0` → `2.1.0`

---

## [2.0.0] — 2026-06-21

### Adicionado (Sprint 1–4)
- Chave Anthropic server-side via Vercel Edge (`api/anthropic.ts`) com rate limiting 20 req/min por usuário
- Proxy Gemini server-side (`api/gemini.ts`) — nenhuma chave exposta no browser
- Senhas DICOM criptografadas com AES-GCM (`utils/crypto.ts`)
- Streaming SSE na geração inicial de laudos (Anthropic)
- Dashboard com KPIs reais de uso de IA (custo estimado, chamadas, hoje)
- Paginação na Worklist (`usePaginatedCollection`, 100/lote) e lazy-load em Pacientes
- Formulário clínico customizável colapsável no ExamEditor
- Sugestões proativas do Copiloto pós-geração (`useCopilotSuggestions`, claude-haiku-4-5)
- Criação automática de exame ao confirmar agendamento
- Chip de histórico clínico no EditorHeader
- Botão "Inserir no Laudo" nas calculadoras
- Preview de template antes de criar exame
- Auto-correlação DICOM por StudyDate + bônus de modalidade
- Ditado por voz (Web Speech API pt-BR) na toolbar do editor
- Vitest configurado com 32 testes passando (calculations + engine)
- ADMIN_UID/EMAIL via variáveis de ambiente VITE_*
- ErrorBoundary por módulo lazy-loaded com retry inline
- Sistema de migrations versionado (5 versões, `_settingsMigrationVersion`)
- Aliases de modelos Gemini corrigidos (`gemini-2.0-flash` como padrão)
- ExamEditor refatorado: `DicomViewerSidebar` extraído (1.616 → ~1.340 linhas)

---

## [1.x] — Versões Anteriores

Versões 1.x não possuem changelog estruturado. Ver histórico do Git.
