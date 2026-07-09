# LAUD.US — Plano de Aprimoramento Oficial
**Versão:** 2.0 → 3.0 · **Data:** Junho 2026 · **Revisado:** 29/06/2026

---

## ✅ STATUS DE IMPLEMENTAÇÃO (atualizado 29/06/2026)

Itens já implementados desde a redação original (19/06):

| Item | Status |
|---|---|
| **D5** — Modelo padrão `claude-sonnet-4-6` + migração de legados | ✅ Feito (centralizado em `migrateLegacyAnthropicModel`) |
| **A3** — Criptografia das senhas DICOM no Firestore | ✅ Feito (`utils/crypto.ts`, AES por UID) |
| **A4** — Refatoração do `ExamEditor` | ✅ Parcial (1563 → ~1388 linhas; hooks/components extraídos) |
| **D4** — Migrations de settings versionadas | ✅ Feito (`_settingsMigrationVersion`) |
| Regras Firestore + tradução de erros admin | ✅ Feito (`firestore.rules`, `firebaseErrors.ts`) |
| Contagem/busca server-side na Worklist | ✅ Feito (`countExamsByStatus`) |
| **Licenciamento por código → Assinaturas AbacatePay** | ✅ Substituído (quotas mensais, add-ons, CRON de reset) |
| Limpeza de código morto + dedup migração + logger | ✅ Feito (commits `113c052`, `4ec5fa2`) |

**Ainda pendentes e recomendados:** A1 (chave IA server-side), A2 (rate limiting),
D2 (admin em env var), B1/B2/B7 (streaming inicial, dashboard real, agenda→worklist),
C2/C3 (histórico no editor, inserir calculadora no laudo), C6 (ditado por voz).

> Observação: a tabela `PRICING` mantém modelos legados **propositalmente** (cálculo de custo
> de registros históricos em `ai_usage`) — não tratar como item de limpeza.

---

## RESUMO EXECUTIVO

Este plano foi gerado após análise estrutural completa e aprofundada do codebase LAUD.US v2.0. São identificados **28 aprimoramentos** organizados em **5 categorias** por prioridade de impacto clínico e técnico. O plano não sugere reescritas — cada item é uma evolução incremental do que já existe.

---

## CATEGORIA A — CRÍTICO: Segurança & Confiabilidade

### A1 — Chave de API exposta no Client-Side
**Arquivo:** `src/modules/ai/providers/AnthropicProvider.ts:56`
**Problema:** A chave da Anthropic (`settings.anthropicApiKey`) é passada como header `x-api-key` diretamente do browser para o proxy Vercel. O proxy em `api/anthropic.ts` repassa o header mas não valida quem está chamando. Qualquer um com a chave pode fazer chamadas ilimitadas.
**Solução:** Mover a chave para variável de ambiente no Vercel (`ANTHROPIC_API_KEY`). O proxy busca a chave do env, valida o `uid` Firebase via token JWT antes de encaminhar. A chave nunca sai do servidor.
**Impacto:** Alto — elimina risco de uso indevido da chave pelos médicos cadastrados.
**Esforço:** Médio (2–3 horas). Requer ajuste no proxy + remoção do campo `anthropicApiKey` das settings do usuário.

---

### A2 — Ausência de Rate Limiting no Proxy Anthropic
**Arquivo:** `api/anthropic.ts`
**Problema:** O proxy não limita o número de chamadas por usuário/período. Um usuário mal-intencionado ou loop de geração poderia gerar custos ilimitados.
**Solução:** Implementar rate limiting por `uid` no proxy serverless (ex: máximo 30 chamadas/hora via KV store do Vercel ou Upstash Redis). Responder 429 com mensagem amigável ao ultrapassar o limite.
**Impacto:** Alto — controle de custo e prevenção de abuso.
**Esforço:** Médio (3–4 horas).

---

### A3 — Senhas DICOM Armazenadas em Texto Claro no Firestore
**Arquivo:** `src/types.ts:226` — `AppSettings.dicomPassword`, `dicomBackupPassword`
**Problema:** As credenciais do servidor Orthanc (`dicomUsername`, `dicomPassword`) são salvas em texto plano no Firestore e exibidas na tela de configurações.
**Solução:** Criptografar com uma chave derivada do UID do usuário antes de salvar no Firestore (ex: SubtleCrypto AES-GCM). Ou, preferencialmente, mover para variáveis de ambiente do agente local (DICOM agent), removendo do Firestore.
**Impacto:** Alto — dados de acesso à infra médica não devem ficar em texto plano.
**Esforço:** Médio-Alto (4–6 horas).

---

### A4 — ExamEditor.tsx monolítico (1563 linhas) — Risco de Manutenção
**Arquivo:** `src/modules/editor/ExamEditor.tsx`
**Problema:** Componente único com 1563 linhas acumulando ~20 estados locais distintos. Qualquer mudança no editor cria risco de regressão em funcionalidades não relacionadas. Já há extração parcial de hooks (useExamActions, useGoogleDocs, useDicomSync) mas o corpo principal ainda é monolítico.
**Solução:** Extrair 3 partes restantes do corpo em componentes dedicados:
  - `DicomViewerSidebar.tsx` (linhas 583–901)
  - `CopilotWidget.tsx` (linhas 1119–1196)
  - `EditorModals.tsx` (unlock, prompt preview, versions, print)
**Impacto:** Médio — reduz risco de bugs em manutenções futuras.
**Esforço:** Médio (3–4 horas). Zero breaking changes — pura extração.

---

## CATEGORIA B — ALTA PRIORIDADE: Performance & UX

### B1 — Ausência de Streaming na Geração Inicial
**Arquivo:** `src/modules/editor/hooks/useExamActions.ts`
**Problema:** O modo de geração inicial (`mode === 'generation'`) usa `generateReport` (não-streaming) enquanto o Copiloto e o Refinamento já usam `generateReportStream`. O médico fica aguardando sem feedback visual até o laudo completo retornar.
**Solução:** Migrar `handleRefine` (que cobre geração inicial) para usar `generateReportStream` com callback `onChunk` atualizando o `reportContent` em tempo real. O streaming já está implementado no engine — só precisa ser conectado.
**Impacto:** Alto — melhoria dramática na percepção de velocidade (feedback em <500ms vs. 10-30s atual).
**Esforço:** Baixo-Médio (2–3 horas). O engine já suporta — é questão de conectar.

---

### B2 — Dashboard sem Dados Reais
**Arquivo:** `src/modules/dashboard/Dashboard.tsx`
**Problema:** O Dashboard provavelmente exibe métricas estáticas ou vazias. O sistema já tem todos os dados: exams, patients, appointments, ai_usage — mas não há um hook de métricas que os agregue.
**Solução:** Criar `useDashboardMetrics()` que busca do Firestore:
  - Exames por status (pendente/em-andamento/finalizado) hoje/semana/mês
  - Custo IA acumulado do mês
  - Pacientes cadastrados
  - Próximos agendamentos
  - Taxa de utilização de IA (% dos laudos gerados por IA)
**Impacto:** Alto — o Dashboard passa de decorativo para ferramenta de gestão real.
**Esforço:** Médio (4–5 horas).

---

### B3 — Worklist sem Paginação para Grandes Volumes
**Arquivo:** `src/modules/worklist/Worklist.tsx`
**Problema:** `useCollection('exams')` carrega TODOS os exames do usuário sem limite. Médicos com histórico de 2000+ laudos terão degradação de performance.
**Solução:** Implementar paginação via Firestore `limit()` + `startAfter()`. Mostrar os últimos 50 exames com botão "carregar mais" ou scroll infinito. Adicionar índice Firestore composto em `status + createdAt DESC`.
**Impacto:** Alto para usuários com histórico extenso.
**Esforço:** Médio (3–4 horas).

---

### B4 — Formulário Customizado (customForm) não visível no Editor
**Arquivo:** `src/modules/editor/ExamEditor.tsx` + `src/types.ts:87`
**Problema:** O campo `customForm` existe no template e o valor é salvo em `customFormValue` no exame, mas não há uma UI clara no editor para o médico preencher esse formulário antes de gerar o laudo. É uma funcionalidade valiosa (campos estruturados) que provavelmente está subutilizada.
**Solução:** Adicionar painel colapsável na toolbar do editor quando `template.customForm` existir, com textarea ou campos estruturados para preenchimento antes da geração.
**Impacto:** Médio — ativa uso do formulário estruturado que já está nos templates.
**Esforço:** Médio (3–4 horas).

---

### B5 — Ausência de Busca Global nos Pacientes/Exames
**Arquivo:** `src/modules/patients/Patients.tsx`
**Problema:** A busca é feita via filtro client-side (`filter()`) sobre todos os pacientes carregados. Com crescimento da base, isso é ineficiente e não funciona para busca por exame.
**Solução:** Implementar busca server-side via Firestore `where('name', '>=', query)` + Algolia ou Typesense para full-text search. Curto prazo: manter client-side mas paginar a carga.
**Impacto:** Médio — afeta clínicas com +500 pacientes.
**Esforço:** Alto (para Algolia: 6–8h). Médio para client-side paginado (2–3h).

---

### B6 — Copiloto sem Capacidade de Geração de Sugestões Proativas
**Arquivo:** `src/modules/editor/LaudCopilot.tsx`
**Problema:** O Copiloto é puramente reativo (aguarda instrução do médico). Poderia oferecer sugestões automáticas baseadas no laudo atual, como: "Detectei que não há medida de nódulo — deseja que eu adicione um campo?".
**Solução:** Após cada geração/refinamento, chamar o Copiloto em modo silencioso com o laudo atual para extrair 2–3 sugestões contextuais. Exibi-las como chips clicáveis acima do campo de input.
**Impacto:** Alto — transforma o fluxo de trabalho (menos digitação, mais decisão).
**Esforço:** Médio-Alto (5–6 horas).

---

### B7 — Agendamento sem Integração com Worklist
**Arquivo:** `src/modules/appointments/Appointments.tsx`
**Problema:** Ao confirmar um agendamento, o exame não é automaticamente criado na worklist. O médico precisa criar manualmente.
**Solução:** Ao mudar status do Appointment para `'confirmado'`, criar automaticamente o `ExamRequest` correspondente com status `'pendente'` e vincular `appointment.id`. Botão "Confirmar e Criar Exame" no modal de confirmação.
**Impacto:** Alto — elimina dupla entrada de dados (agendamento + criação manual do exame).
**Esforço:** Médio (3–4 horas).

---

## CATEGORIA C — MÉDIA PRIORIDADE: Funcionalidades Clínicas

### C1 — Exportação de Laudos Finalizados sem Assinatura Digital
**Arquivo:** `src/modules/export/PrintLayout.tsx`
**Problema:** O sistema suporta `signatureImageUrl` e `defaultSignature` nas settings, mas não está claro se a assinatura digital (imagem) aparece no laudo impresso de forma confiável.
**Solução:** Garantir que `PrintLayout` exibe a imagem da assinatura com posicionamento correto abaixo do nome e CRM. Adicionar suporte a assinatura digital com certificado ICP-Brasil (integração com plataforma de assinatura como ClickSign ou D4Sign).
**Impacto:** Médio — conformidade legal para laudos.
**Esforço:** Baixo para assinatura imagem (1–2h). Alto para ICP-Brasil (15–20h).

---

### ~~C2 — Histórico Clínico do Paciente não exibido no Editor~~
> **[CORREÇÃO 2026-07-08: já implementado]** — `PatientHistoryPanel` colapsável no
> `ExamEditor`, com o comentário `{/* ── Histórico Clínico do Paciente (C2) ── */}`
> referenciando explicitamente este item do plano. Ver
> `src/modules/editor/ExamEditor.tsx:49-80,985-987`.

**Arquivo:** `src/modules/editor/ExamEditor.tsx`
**Problema:** O campo `patient.history` existe e é enviado para a IA como contexto, mas não é exibido de forma clara para o médico durante a edição do laudo.
**Solução:** Adicionar aba ou seção colapsável no painel de informações do exame (EditorHeader) mostrando o histórico clínico do paciente, observações e convênio.
**Impacto:** Médio — o médico ter visibilidade rápida do histórico melhora a qualidade clínica.
**Esforço:** Baixo (1–2 horas).

---

### C3 — Calculadoras sem Exportação de Resultado para o Laudo
**Arquivo:** `src/modules/calculators/CalculatorModal.tsx`
**Problema:** O resultado das calculadoras pode ser enviado ao Copiloto ou ao formulário customizado, mas não há integração direta para inserir o resultado formatado no corpo do laudo no cursor atual.
**Solução:** Adicionar botão "Inserir no Laudo" que usa `editorRef.insertContent()` para inserir o resultado em HTML no ponto do cursor (já existe `insertContent` na ref do editor).
**Impacto:** Médio — fluxo mais rápido (calcular → inserir direto).
**Esforço:** Baixo (1–2 horas).

---

### C4 — Templates sem Preview antes de Aplicar
**Arquivo:** `src/components/CreateExamModal.tsx`
**Problema:** Ao criar um exame e selecionar um template, o médico não tem como visualizar a estrutura do template antes de confirmar.
**Solução:** Adicionar preview do `analysisTemplate` no modal de criação de exame ao selecionar um template (popover ou painel lateral).
**Impacto:** Médio — evita escolha errada de máscara.
**Esforço:** Baixo (1–2 horas).

---

### C5 — DICOM: Correlação automática de Estudo por Data do Exame
**Arquivo:** `src/modules/editor/hooks/useDicomSync.ts`
**Problema:** A busca no Orthanc é feita por nome do paciente. Em clínicas com múltiplos exames do mesmo dia, vários estudos aparecem como "candidatos" e o médico precisa selecionar manualmente.
**Solução:** Refinar o algoritmo de scoring da busca para priorizar o estudo cuja `StudyDate` DICOM é mais próxima da `exam.examDate` (já disponível). Se score de confiança > 90%, selecionar automaticamente sem intervenção.
**Impacto:** Médio — reduz interação manual em 80% dos casos.
**Esforço:** Baixo-Médio (2–3 horas).

---

### ~~C6 — Suporte a Ditado por Voz não implementado completamente~~
> **[CORREÇÃO 2026-07-08: já implementado]** — botão de microfone funcional na toolbar
> do Copiloto (`onClick={toggleListening}`, `title="Ditado por voz"`), consumindo
> `useVoiceAnalyzer.ts`. Ver `src/modules/editor/LaudCopilot.tsx:1583-1592`.

**Arquivo:** `src/modules/editor/hooks/useVoiceAnalyzer.ts`
**Problema:** O hook `useVoiceAnalyzer` existe mas a UI de ativação do ditado por voz não está visível/acessível no editor. O plano menciona `voiceDictation: boolean` por plano.
**Solução:** Adicionar botão de microfone na toolbar do editor para usuários com plano que inclui `voiceDictation`. Usar a Web Speech API para transcrição em tempo real inserindo texto no cursor do TipTap.
**Impacto:** Alto para médicos que ditam — acelera criação de laudos manualmente.
**Esforço:** Médio (4–5 horas).

---

## CATEGORIA D — MEDIA PRIORIDADE: Infraestrutura & Developer Experience

### D1 — Ausência de Testes Automatizados
**Problema:** O codebase não possui testes (unit, integration, e2e). Com o sistema sendo usado em ambiente clínico, um bug de regressão num cálculo de IG ou numa regra de geração de laudo tem impacto direto na assistência médica.
**Solução:** Implementar:
  1. **Testes unitários** para `engine.ts` (builders de prompt, stripScratchpad, auditReportQuality) com Vitest
  2. **Testes de calculadoras** para todas as 19 calculadoras com casos clínicos conhecidos
  3. **Testes de snapshot** para os principais componentes
**Impacto:** Médio-Alto — proteção contra regressão.
**Esforço:** Alto (20–30 horas). Mas pode ser feito gradualmente.

---

### D2 — Variável ADMIN_UID e ADMIN_EMAIL hardcoded no código-fonte
**Arquivo:** `src/config/constants.ts`
**Problema:** O UID e email do administrador estão em arquivo de configuração que vai para o repositório. Isso torna difícil mudar o admin sem novo deploy.
**Solução:** Mover para variáveis de ambiente Vite (`VITE_ADMIN_UID`, `VITE_ADMIN_EMAIL`) no `.env.local` e `.env.production`. Nunca commitar valores reais.
**Impacto:** Baixo — boas práticas de segurança.
**Esforço:** Baixo (30 minutos).

---

### D3 — Falta de Error Boundary por Módulo
**Arquivo:** `src/components/ErrorBoundary.tsx`
**Problema:** Há um único `ErrorBoundary` no topo da aplicação (`App.tsx`). Se um módulo secundário (ex: Calculators) crashar com erro de JS, toda a aplicação mostra tela de erro.
**Solução:** Adicionar `ErrorBoundary` individual em cada módulo lazy-loaded no `ViewRenderer`. Erros ficam isolados ao módulo, a aplicação continua funcionando.
**Impacto:** Médio — resiliência operacional.
**Esforço:** Baixo (1 hora).

---

### D4 — Migrations de dados sem versionamento controlado
**Arquivo:** `src/store/db.ts:147-175`
**Problema:** As migrações automáticas de settings (ex: atualizar URLs do Orthanc) estão hardcoded em `getSettings()` com strings literais de endereços do desenvolvedor (`servidor-mac.tail861dda.ts.net`). Isso é específico de um ambiente e pode afetar outros usuários.
**Solução:** Criar sistema de migrations versionado (`MIGRATION_VERSION` no documento de settings) com array de migrações numeradas que só executam se a versão salva for menor que a versão atual.
**Impacto:** Médio — evita migrações acidentais em ambientes de outros usuários.
**Esforço:** Médio (3–4 horas).

---

### D5 — Modelo de IA desatualizado nas Settings padrão
**Arquivo:** `src/store/db.ts:114` + `src/store/app.ts:93`
**Problema:** O modelo padrão hardcoded é `'gemini-3.5-flash'` (alias legado) e `'claude-3-5-sonnet-latest'`. Com o lançamento do Claude Sonnet 4.6 (modelo atual), o sistema deveria usar o melhor modelo disponível.
**Solução:** Atualizar o modelo Anthropic padrão para `'claude-sonnet-4-6'` e remover aliases de modelos Gemini legados (`gemini-3.5-flash`, `gemini-3.1-pro-preview`) que não existem mais.
**Impacto:** Alto — laudos gerados com modelo mais capaz sem configuração manual.
**Esforço:** Muito Baixo (15 minutos).

---

### D6 — Prompt Cache não ativado no modo Gemini
**Arquivo:** `src/modules/ai/providers/GeminiProvider.ts`
**Problema:** O AnthropicProvider utiliza `cache_control: ephemeral` no BLOCO 1 (universal context), reduzindo custos em ~90% no input quando o mesmo contexto é reutilizado. O GeminiProvider não utiliza Context Caching.
**Solução:** Implementar Gemini Context Caching para o `universalContext` (que muda raramente) usando a API `cachedContents` do Google AI.
**Impacto:** Médio — redução de ~60-80% no custo Gemini por chamada.
**Esforço:** Médio (3–4 horas).

---

## CATEGORIA E — BAIXA PRIORIDADE: Nice-to-Have & Futuro

### E1 — Módulo Financeiro (FinancialControl) incompleto
**Arquivo:** `src/modules/settings/FinancialControl.tsx`
**Problema:** O módulo de controle financeiro existe mas provavelmente é mínimo. O sistema já tem dados suficientes para um controle completo: exames por período, planos, clínicas.
**Solução:** Expandir com: receita estimada por período, exames por clínica/médico, relatórios exportáveis CSV/Excel, comparação mensal.
**Impacto:** Médio — gestão financeira real da clínica.
**Esforço:** Alto (10–15 horas).

---

### E2 — Sem modo offline real
**Arquivo:** `src/components/OfflineBanner.tsx`
**Problema:** O app detecta offline mas não funciona sem internet. A PWA poderia suportar edição offline de laudos existentes (já carregados) com sync ao reconectar.
**Solução:** Usar Firestore offline persistence (`enableIndexedDbPersistence`) + service worker para cache de assets. Laudos em edição são salvos localmente e sincronizados ao reconectar.
**Impacto:** Médio — clínicas com conexão instável.
**Esforço:** Alto (8–12 horas).

---

### E3 — Sem integração com HIS/sistema hospitalar
**Problema:** Clínicas maiores usam sistemas HIS (ex: Tasy, MV, TrakCare) para envio de resultados. Não há API pública documentada do LAUD.US.
**Solução:** Criar API REST documentada (OpenAPI) para: criação de exame, consulta de laudo, webhook de finalização. Implementar como Vercel serverless functions com autenticação por API key.
**Impacto:** Alto para clínicas institucionais.
**Esforço:** Muito Alto (30–40 horas).

---

### E4 — Repositório de laudos para treinamento de IA
**Arquivo:** `src/modules/ai/engine.ts:507-549`
**Problema:** O RAG clínico busca laudos finalizados do Firestore em tempo real a cada geração. Com muitos laudos, isso cria queries Firestore custosas sem índice otimizado.
**Solução:** Criar um processo de "embedding" periódico que pre-processa os laudos finalizados em vetores (ex: usando embeddings da Anthropic) salvos num banco vetorial (Pinecone ou Firebase Vector Search). A busca de estilo passa a ser semântica e mais precisa.
**Impacto:** Alto para clínicas com muitos laudos.
**Esforço:** Muito Alto (20–30 horas + custo de infraestrutura).

---

### E5 — Sem relatório de produtividade médica
**Problema:** Não há visão de quantos laudos cada médico (se houver múltiplos) gerou, tempo médio por laudo, taxa de uso de IA, etc.
**Solução:** Dashboard administrativo com métricas por usuário: laudos/dia, tempo médio de conclusão, % uso IA, custo IA por médico.
**Impacto:** Médio para gestores.
**Esforço:** Médio (5–7 horas).

---

## PRIORIZAÇÃO RECOMENDADA — ROADMAP

### Sprint 1 (Imediato — 1 semana)
| Item | Esforço | Impacto |
|---|---|---|
| D5 — Atualizar modelo padrão (claude-sonnet-4-6) | 15min | Alto |
| D2 — Admin UID/EMAIL para variável de ambiente | 30min | Baixo |
| D3 — Error Boundary por módulo | 1h | Médio |
| C3 — Inserir resultado calculadora no laudo | 1–2h | Médio |
| C4 — Preview de template antes de criar exame | 1–2h | Médio |
| C2 — Histórico clínico visível no editor | 1–2h | Médio |

### Sprint 2 (Curto prazo — 2 semanas)
| Item | Esforço | Impacto |
|---|---|---|
| B1 — Streaming na geração inicial | 2–3h | Alto |
| A4 — Refatorar ExamEditor em sub-componentes | 3–4h | Médio |
| C5 — Correlação automática de estudo DICOM | 2–3h | Médio |
| B7 — Criar exame ao confirmar agendamento | 3–4h | Alto |
| B4 — UI para formulário customizado no editor | 3–4h | Médio |

### Sprint 3 (Médio prazo — 1 mês)
| Item | Esforço | Impacto |
|---|---|---|
| A1 — Chave Anthropic para env server-side | 2–3h | Alto (Segurança) |
| A2 — Rate limiting no proxy | 3–4h | Alto (Segurança) |
| B2 — Dashboard com dados reais | 4–5h | Alto |
| B3 — Paginação na Worklist | 3–4h | Alto |
| C6 — Ditado por voz ativo | 4–5h | Alto |
| B6 — Sugestões proativas do Copiloto | 5–6h | Alto |

### Sprint 4 (Longo prazo — 2–3 meses)
| Item | Esforço | Impacto |
|---|---|---|
| A3 — Criptografia de senhas DICOM | 4–6h | Alto (Segurança) |
| D1 — Testes automatizados | 20–30h | Alto |
| D4 — Sistema de migrations versionado | 3–4h | Médio |
| D6 — Gemini Context Caching | 3–4h | Médio |
| B5 — Busca server-side de pacientes | 2–3h (paginado) | Médio |

---

## MÉTRICAS DE SUCESSO

Para avaliar o impacto do plano, sugerimos acompanhar:

| Métrica | Baseline Estimado | Meta após Sprint 3 |
|---|---|---|
| Tempo médio de geração de laudo | 15–30s | <3s (com streaming) |
| Taxa de correção manual pós-IA | ~40% | <20% (com sugestões proativas) |
| Cliques manuais para correlacionar DICOM | ~3 cliques | 0 cliques (auto-correlação) |
| Custo IA por laudo (USD) | ~$0.05–0.15 | <$0.03 (com cache + modelo 4.6) |
| Exames finalizados sem reabrir | ~70% | >90% (com QA score visível) |

---

*Plano gerado em 19/06/2026 — Aguardando aprovação para início da implementação.*
*Para iniciar qualquer item, confirme: "seguir [código-do-item]" (ex: "seguir D5")*
