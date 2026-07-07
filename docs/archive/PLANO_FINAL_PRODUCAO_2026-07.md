# 🎯 Plano Final de Produção — LAUD.US

**Data da análise:** 2026-07-05 · **Baseline:** v2.1.0 (commit `78be8a9`) + Fase 0-3 do Security Audit + commits recentes (Central de Usuários/gratuidade, alertas operacionais, Central financeira).

Este documento consolida: (1) limpeza e padronização da documentação oficial, (2) plano de ajustes finais para multi-usuário em produção, (3) plano de landing page institucional + tela de login, (4) adequação a normas brasileiras (LGPD/CFM). É uma análise — nenhuma mudança de código foi feita ainda. Aprovação item a item via "SEGUIR".

---

## 1. Limpeza e padronização da documentação

`docs/` acumulou 15 arquivos + `README.md`, `CHANGELOG.md`, `PACS_MANUAL.md`, `plan.md`, `src/ARCHITECTURE.md` — produzidos em datas diferentes, com sobreposição real.

### 1.1 Diagnóstico por arquivo

| Arquivo | Classificação | Ação proposta |
|---|---|---|
| `DOCUMENTACAO_OFICIAL.md` | Referência viva (v2, 04/07) | **Manter** como documento mestre único |
| `SYSTEM_DOCUMENTATION.md` | Duplicata ~85% de DOCUMENTACAO_OFICIAL (versão antiga, Jun) | **Arquivar** (mover para `docs/archive/`) |
| `AUDITORIA_COMPLETA_2026-07.md` | Auditoria pós-Fase 0 (04/07) | **Manter** como trilha de auditoria corrente |
| `AUDITORIA_GLOBAL_2026-07.md` | Snapshot pré-Fase 0 (02/07), superado pela Completa | **Arquivar** |
| `IMPROVEMENT_PLAN.md` | Plano v2.0→3.0 concluído (29/Jun) | **Arquivar** (virou histórico, itens migram pro CHANGELOG) |
| `ANALISE_BUGS.md` | Snapshot pontual (26/Jun), pré-Firestore rules | **Arquivar** |
| `PLANO_PACS_VM_COMPARTILHADA.md` | Alternativa **descartada** (decisão tomada: 1 VM/usuário) | **Arquivar**, deixando nota de decisão em `PROJETO_PACS_NUVEM.md` |
| `ADMIN_IMPROVEMENT_PLAN.md` | Roadmap ativo (admin panel) | **Manter** |
| `PLANO_REFINAMENTO.md` | Roadmap ativo, fases R1–R3 em execução | **Manter** — vira o "board" de execução corrente |
| `PLANO_PLANOS_INTERVALOS_ABACATEPAY.md` | Spec pronta, não implantada | **Manter** até implementar; depois migra para CHANGELOG |
| `CASCADE_PROMPTS.md` | Referência técnica (arquitetura de prompts LAUD.IA) | **Manter** |
| `PROJETO_PACS_NUVEM.md` | Decisão arquitetural (GCP + Tailscale, 1 VM/user) | **Manter** |
| `PACS_PROVISION_SETUP.md` / `PACS_TENANT_SETUP.md` | Docs operacionais | **Manter** |
| `PLANO_PACS_AUTOMACAO_SELF_SERVICE.md` | Roadmap pendente | **Manter** |
| `PACS_MANUAL.md` (raiz) | Manual prático do usuário final | **Manter**, mas mover para `docs/` (raiz do repo devia ter só README/CHANGELOG) |
| `plan.md` (raiz) | Verificar conteúdo — provável rascunho obsoleto | **Revisar e arquivar/apagar** |

### 1.2 Padronização proposta

- **Estrutura final de `docs/` (feito em 05/07/2026):**
  - `docs/DOCUMENTACAO_OFICIAL.md` — único documento técnico mestre (fonte da verdade)
  - `docs/AUDITORIA_COMPLETA_2026-07.md` — auditoria corrente
  - `docs/PLANO_REFINAMENTO.md` — board de execução ativo (única fonte de "o que falta fazer agora")
  - `docs/roadmaps/` — specs prontas aguardando implementação (PLANO_PLANOS_INTERVALOS_ABACATEPAY, PLANO_PACS_AUTOMACAO_SELF_SERVICE, ADMIN_IMPROVEMENT_PLAN)
  - `docs/pacs/` — tudo de PACS (PROJETO_PACS_NUVEM, PACS_PROVISION_SETUP, PACS_TENANT_SETUP, PACS_MANUAL)
  - `docs/archive/` — históricos (SYSTEM_DOCUMENTATION, AUDITORIA_GLOBAL, IMPROVEMENT_PLAN, ANALISE_BUGS, PLANO_PACS_VM_COMPARTILHADA, plan_calculadoras_percentis_2026-06)
  - Raiz do repo: só `README.md` e `CHANGELOG.md`
- **Convenção de cabeçalho única** em todo doc vivo: título, "Versão do documento: AAAA-MM-DD", "Status: vivo | arquivado | spec pendente", link cruzado pro `DOCUMENTACAO_OFICIAL.md`.
- **CHANGELOG.md** passa a ser o único lugar de histórico versionado — planos concluídos viram uma entrada de changelog e são arquivados, não deixados soltos em `docs/`.
- Atualizar `README.md` com link para a nova árvore de `docs/`.

**Esforço estimado:** ~2h (mover arquivos, ajustar links cruzados, sem mudança de conteúdo técnico).

---

## 2. Ajustes finais — multi-usuário em produção

Estado atual: isolamento por `clinicId` em nível de documento, regras Firestore protegem campos de privilégio/cota, mas o isolamento entre clínicas é **client-side + posse de documento**, sem tabela explícita de "quem pode acessar qual clínica".

### 2.1 Gaps identificados

1. **Sem RBAC de clínica.** Hoje qualquer usuário com acesso a uma clínica tem escrita total (não há papel "visualizador" vs "editor" vs "dono da clínica"). Se o produto crescer para equipes (secretária + médico na mesma clínica), falta granularidade.
2. **Isolamento sem tabela de membership.** Não existe coleção `clinic_memberships` — a regra de acesso depende de `clinicId` estar correto no documento e do usuário ser dono. Não há checagem servidor de "este uid pertence a esta clínica".
3. **Sem verificação de expiração/quota no fluxo de billing avulso.** Planos mensal/semestral são `ONE_TIME` sem CRON de expiração — usuário pode continuar usando após vencer se não houver esse CRON.
4. **Rate limiting não distribuído.** Mencionado como pendência: rate limit de IA é por instância, não usa Vercel KV/Upstash — sob múltiplas instâncias Edge, o limite real pode ser N× o configurado.
5. **Sem seed/onboarding para times.** O convite de outro usuário para colaborar numa mesma clínica não está mapeado (hoje o modelo é 1 usuário = 1..N clínicas próprias).

### 2.2 Plano de ação (por prioridade)

**P0 — bloqueadores de produção multi-usuário:**
- [ ] Criar `cron-expire-subscriptions.ts` (falta, spec já existe em `PLANO_PLANOS_INTERVALOS_ABACATEPAY.md`) para marcar planos avulsos vencidos e cortar acesso.
- [ ] Rate limiting distribuído via Vercel KV (item já identificado como pendência antiga — provisionar).
- [ ] Confirmar branch protection no GitHub (CI obrigatório antes de merge) — pendência aberta desde a auditoria de segurança.

**P1 — necessário para equipes/multiusuário real dentro de uma clínica:**
- [x] Modelado `clinic_memberships/{ownerId}_{clinicId}_{memberUid}` (papel `editor|viewer`) — [firestore.rules](../firestore.rules) ganhou `hasClinicAccess`/`hasClinicWriteAccess` e regras específicas para `clinics`, `patients`, `exams`, `appointments` (aditivo: sem membership criado, comportamento é idêntico ao anterior).
- [x] Fluxo de convite por e-mail — [api/clinic-invite.ts](../api/clinic-invite.ts) (resolve e-mail→uid via Admin SDK, valida posse da clínica) + UI em [ClinicTeamCard.tsx](../src/components/ClinicTeamCard.tsx) (convidar, listar, remover) plugado em `ClinicDetail.tsx`.
- [ ] **FALTANDO — bloqueador para uso real:** o cliente sempre lê/escreve em `users/{auth.currentUser.uid}/{patients,exams,appointments}` (`userPath()` em `src/hooks/useFirestore.ts` e `getCollectionRef()` em `src/store/db.ts`). Um membro convidado **ainda não tem como visualizar os dados do dono** pela UI atual — as regras permitiriam, mas nenhuma tela troca o `uid` da query pelo `ownerId` da clínica compartilhada. Isso exige revisar a camada de dados (`useFirestore.ts`, `db.ts`) para, quando há membership ativo, apontar as queries de patients/exams/appointments para a subárvore do `ownerId` — mudança de maior risco (toca quase todos os módulos) e deve ser feita e testada (idealmente com emulador do Firestore) numa sessão dedicada antes de anunciar "equipe multiusuário" como pronta.
- [ ] Ajustar `ClinicSessionModal`/`useApp.selectedClinicId` para refletir múltiplos donos por clínica (depende do item acima).

**P2 — robustez operacional:**
- [ ] Ativar Sentry em produção (`VITE_SENTRY_DSN` — código já pronto, falta configurar).
- [ ] Política formal de retenção/expurgo de dados (LGPD) — decisão de produto pendente (ver seção 4).

**Esforço estimado:** P0 ≈ 1-2 dias; P1 ≈ 4-6 dias (modelo de dados novo + regras + UI de convite); P2 ≈ 1 dia (Sentry) + decisão de negócio (retenção).

---

## 3. Landing page institucional + tela de login

Confirmado com você: **landing separada** (site institucional) apontando para o app atual (que continua com login como porta de entrada).

### 3.1 Estado atual do login

`src/components/LoginScreen.tsx` já funciona como uma "mini-landing": painel esquerdo com copy de marketing e 6 ícones de funcionalidades, painel direito com formulário de login/cadastro + Google OAuth, modal de vitrine de planos, selos "HIPAA · AES-256 · LGPD". Faltam: link de "esqueci minha senha", termos de uso, política de privacidade, checkbox de consentimento LGPD no cadastro, verificação de e-mail antes de ativar trial.

### 3.2 Plano — Landing institucional (site separado)

- **Objetivo:** página de marketing pública (SEO, conversão) hospedada em domínio/subdomínio próprio (ex.: `laudus.com.br` apontando para o marketing, `app.laudus.com.br` para o produto atual), com CTA para cadastro/login no app.
- **Escopo de conteúdo:**
  1. Hero — proposta de valor ("Do agendamento ao laudo assinado — em minutos"), CTA "Começar grátis" / "Ver planos".
  2. Funcionalidades (IA, PACS/DICOM, calculadoras, agenda, multi-clínica) — reaproveitar os 6 blocos já escritos no LoginScreen.
  3. Vitrine de planos (reaproveitar `PricingPlans`, ou uma versão pública sem necessidade de login).
  4. Prova social / compliance (selos LGPD, segurança, uptime).
  5. FAQ.
  6. Rodapé: Termos de Uso, Política de Privacidade, contato, CNPJ (exigência para SaaS B2B no Brasil).
- **Stack recomendada:** projeto separado, estático (ex. Next.js estático ou Astro) para SEO/performance — não acoplar ao bundle do app React atual (evita inflar o app autenticado com conteúdo de marketing).
- **Integração:** botões "Entrar"/"Criar conta" linkam para `app.laudus.../login`. Nenhuma duplicação de lógica de auth no site institucional.

### 3.3 Plano — Ajustes na tela de login do app

- [ ] Adicionar "Esqueci minha senha" (Firebase `sendPasswordResetEmail`, já disponível no SDK, só falta UI).
- [ ] Adicionar checkbox obrigatório "Li e aceito os Termos de Uso e a Política de Privacidade" no cadastro, com links (para as páginas hospedadas no site institucional ou em `/termos` e `/privacidade` do próprio app).
- [ ] Verificação de e-mail (Firebase `sendEmailVerification`) antes de liberar geração de laudos com IA (trial só ativa após confirmação) — mitiga abuso de contas descartáveis.
- [ ] Persistir timestamp + versão dos termos aceitos em `users/{uid}.termsAcceptedAt/termsVersion` (rastreabilidade LGPD).

**Esforço estimado:** landing institucional ≈ 3-5 dias (novo projeto, design, deploy); ajustes de login ≈ 1 dia.

---

## 4. Adequação a normas brasileiras (LGPD/CFM)

### 4.1 O que já está implementado

- **LGPD — minimização de dados enviados à IA:** `anonymize.ts` remove nome/CPF/RG/telefone/e-mail antes de qualquer prompt, preservando idade/sexo/medidas.
- **LGPD — trilha de acesso:** `logPatientAccess` registra `view_patient`/`view_report` em `audit_logs`.
- **Chave de IA 100% server-side**, sem exposição de segredo ao cliente.
- **CFM — identificação do médico:** captura de CRM/RQE em Settings, exibido no rodapé do PDF/DOCX exportado.
- **Segurança correlata:** AES-256 para senhas DICOM, headers de segurança + CSP.

### 4.2 O que falta para conformidade completa (produção real, não só piloto)

| Item | Exigência | Status | Prioridade |
|---|---|---|---|
| **Assinatura digital ICP-Brasil** | CFM exige assinatura eletrônica válida (ICP-Brasil ou certificado digital qualificado) em laudo médico para ter valor legal pleno; hoje é só imagem de assinatura escaneada | 🔴 Não implementado | **Alta** — sem isso o laudo pode não ter validade jurídica plena como documento médico assinado |
| **Termos de Uso + Política de Privacidade** | Base legal e transparência exigidas pela LGPD (art. 9º) | 🔴 Ausente na UI | **Alta** |
| **Consentimento explícito / base legal de tratamento** | LGPD exige base legal declarada para tratamento de dado de saúde (dado sensível, art. 11) | 🔴 Não coletado | **Alta** |
| **Política de retenção e expurgo de dados** | LGPD exige prazo definido e mecanismo de exclusão/anonimização | 🔴 Não definida | **Média-Alta** (decisão de produto + implementação) |
| **DPA (Data Processing Agreement) com Google (Gemini)** | Necessário formalizar que o Google é operador dos dados de saúde processados | 🔴 Pendência jurídica/administrativa, fora do código | **Média** |
| **Criptografia de campo para CPF/RG** | Dado sensível armazenado — hoje sem criptografia em nível de campo no Firestore (só em trânsito/rules) | 🟡 Parcial | **Média** |
| **Portal de titular de dados (LGPD art. 18)** | Direito do paciente de solicitar acesso/exclusão dos próprios dados | 🔴 Não existe | **Baixa-Média** (pode ser processo manual no início, não necessariamente feature) |

### 4.3 Plano de ação sugerido

**Fase L1 — Base legal (rápida, pré-requisito para qualquer cliente pagante real):**
- [ ] Publicar Termos de Uso e Política de Privacidade (site institucional + link no app).
- [ ] Checkbox de aceite no cadastro + registro de versão/timestamp aceito.
- [ ] Documento interno definindo base legal do tratamento (execução de contrato + consentimento, conforme art. 7º/11º LGPD) — trabalho jurídico, não técnico.

**Fase L2 — Retenção e portal do titular:**
- [ ] Definir e documentar política de retenção (ex.: prontuário médico tem prazo legal mínimo de guarda — CFM recomenda 20 anos para prontuário físico; verificar aplicação a laudo digital).
- [ ] Processo (manual ou UI) de atendimento a solicitação de acesso/exclusão de dados do paciente.

**Fase L3 — Assinatura digital ICP-Brasil (já estimada em 15-20h no `IMPROVEMENT_PLAN.md`):**
- [ ] Integração com provedor de assinatura (ClickSign ou D4Sign) para assinatura com certificado ICP-Brasil no laudo final, substituindo/complementando a imagem de assinatura escaneada.
- [ ] Manter imagem escaneada como opção para uso não-oficial/rascunho, mas sinalizar claramente na UI qual laudo tem valor de assinatura eletrônica qualificada.

**Nota importante:** os itens de base legal (L1) e política de retenção (parte de L2) são decisões jurídicas/de produto, não apenas técnicas — recomendo validação com um advogado especializado em saúde digital/LGPD antes de redigir os textos finais de Termos e Política de Privacidade, já que o produto trata dado de saúde (categoria sensível).

---

## 5. Resumo executivo — ordem de execução recomendada

| Ordem | Bloco | Duração estimada | Bloqueia produção? |
|---|---|---|---|
| 1 | Limpeza/padronização de docs (seção 1) | ~2h | Não, mas remove confusão antes de tocar no resto |
| 2 | P0 multi-usuário: CRON expiração, rate limit distribuído, branch protection (seção 2.1) | 1-2 dias | **Sim** |
| 3 | Fase L1 LGPD: Termos + Privacidade + checkbox de aceite (seção 4.3) | 1-2 dias (+ jurídico) | **Sim**, para vender legalmente |
| 4 | Ajustes de login (reset de senha, verificação de e-mail) (seção 3.3) | 1 dia | Recomendado antes de escalar cadastros |
| 5 | Landing institucional separada (seção 3.2) | 3-5 dias | Não bloqueia, mas necessário para aquisição de clientes |
| 6 | P1 multi-usuário: RBAC de clínica + convites (seção 2.2) | 4-6 dias | Só se for vender para clínicas com múltiplos usuários simultâneos |
| 7 | Fase L2/L3: retenção + assinatura ICP-Brasil | Retenção: decisão + poucas horas; ICP-Brasil: 15-20h | Depende do apetite de risco jurídico do negócio |

Me diga **"SEGUIR"** indicando quais blocos (por número) quer que eu execute agora, ou se quer discutir/ajustar algum item antes.
