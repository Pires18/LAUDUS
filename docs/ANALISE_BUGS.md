# Análise de Bugs e Erros — LAUD.US

> Gerado em 2026-06-26 · Revisão completa do sistema (frontend React/TS + Firestore + API serverless).
> `tsc --noEmit`: **0 erros** · Suíte de testes: **107/107 passando**.

Esta análise acompanha o conjunto de correções aplicadas nesta sessão. Cada item indica
**Severidade**, **Status** (✅ corrigido / ⚠️ requer ação do usuário / 📋 recomendação) e o(s) arquivo(s).

---

## 🔴 Críticos

### 1. Regras de segurança do Firestore ausentes → "erro de permissão" no admin
- **Status:** ✅ corrigido (deploy pendente — ver abaixo)
- **Sintoma:** ao editar usuários/planos pelo painel admin (alterar cargo, ativar/desativar,
  Motor Pro, quota, assinaturas), a operação falhava com *permission-denied*.
- **Causa raiz:** o repositório **não tinha `firestore.rules`** e `firebase.json` só publicava
  índices. As escritas administrativas (`users/{id}`, `subscriptions/{id}`, `audit_logs`, ...)
  eram bloqueadas pelas regras vigentes (que não concedem acesso cross-user a admins).
- **Correção:**
  - Novo [`firestore.rules`](../firestore.rules) com RBAC: super-admin por e-mail **ou** `role == 'admin'`;
    cada usuário é dono da própria subárvore `users/{uid}/**`; admins gerenciam coleções globais.
  - [`firebase.json`](../firebase.json) agora publica as regras.
  - **Ação necessária:** revisar e implantar →
    `firebase deploy --only firestore:rules`

### 2. Mensagens de erro cruas/ genéricas no painel admin
- **Status:** ✅ corrigido
- **Sintoma:** toasts como `Erro: Missing or insufficient permissions` (sem orientação) ou
  genéricos demais (`Erro ao alterar papel`).
- **Correção:** novo utilitário [`src/utils/firebaseErrors.ts`](../src/utils/firebaseErrors.ts)
  (`friendlyFirebaseError`) traduz códigos do Firebase para PT-BR, com dica específica para
  *permission-denied* (verificar cargo + deploy das regras). Aplicado em
  [`AdminUsers.tsx`](../src/modules/admin/submodules/AdminUsers.tsx) e
  [`AdminSubscriptions.tsx`](../src/modules/admin/submodules/AdminSubscriptions.tsx).

---

## 🟠 Altos

### 3. Contagem e busca de laudos só consideravam a página carregada
- **Status:** ✅ corrigido
- **Sintoma:** os badges de status (Todos/Aguardando/Em Andamento/Finalizado) e a busca da
  Worklist refletiam apenas os **primeiros 100 laudos** (PAGE_SIZE). Com mais de uma página,
  os números ficavam **subestimados** e a busca não encontrava laudos não carregados.
- **Causa raiz:** `counts` e o filtro de busca operavam sobre o array paginado `exams`
  ([Worklist.tsx](../src/modules/worklist/Worklist.tsx)).
- **Correção:**
  - Nova agregação no servidor `countExamsByStatus()` em
    [`src/store/db.ts`](../src/store/db.ts) (via `getCountFromServer`) → contagens **reais**
    por status, independentes da paginação, respeitando o filtro de clínica.
  - Sem filtro secundário → usa contagens reais do servidor.
  - Com filtro (busca/área/data) → carrega automaticamente **todas as páginas** da clínica
    atual para que busca e contagem cubram o conjunto completo (indicador "Carregando…" no campo).

### 4. Anamnese padrão das máscaras
- **Status:** ✅ código pronto · ⚠️ migração de dados requer execução
- **Pedido:** zerar a anamnese padrão de todas as máscaras, mantendo o campo de anamnese
  funcional e ligado em todo o fluxo.
- **Achados:**
  - `anamnesisTemplate` é um campo da máscara; ao criar exame, pré-preenchia a anamnese
    ([CreateExamModal.tsx](../src/components/CreateExamModal.tsx)).
  - O **editor de máscaras não possui campo** para `anamnesisTemplate` — os valores vieram dos
    scripts de seed. Logo, novas máscaras já nascem sem anamnese padrão.
  - O campo de anamnese do exame está corretamente ligado: criação → editor
    ([ExamEditor.tsx](../src/modules/editor/ExamEditor.tsx)) → IA
    ([engine.ts](../src/modules/ai/engine.ts), usado como contexto clínico) → exportação.
- **Correção:** script de migração única
  [`scripts/clear-anamnesis-templates.mjs`](../scripts/clear-anamnesis-templates.mjs).
  - **Ação necessária (dados em produção):**
    `node scripts/clear-anamnesis-templates.mjs <email_admin> <senha_admin> --dry-run`
    (confirmar) e depois sem `--dry-run` para aplicar.

---

## 🟡 Médios

### 5. Seletor global de clínica sem busca, sem fechar ao clicar fora, listando inativas
- **Status:** ✅ corrigido
- **Arquivo:** [`Sidebar.tsx`](../src/components/Sidebar.tsx)
- **Melhorias:** busca dentro do dropdown (quando > 5 clínicas), fechamento ao clicar fora
  (click-away), clínicas **ativas primeiro** e ordenadas por nome, rótulo "Inativa", e
  **badge de laudos pendentes** por clínica.

### 6. Tela de início com saudação estática
- **Status:** ✅ corrigido
- **Arquivo:** [`Dashboard.tsx`](../src/modules/dashboard/Dashboard.tsx)
- **Melhoria:** saudação dinâmica por horário (Bom dia/Boa tarde/Boa noite) e o prefixo "Dr."
  deixa de ser forçado para o perfil de **recepção**.

---

## 📋 Recomendações (não aplicadas — fora do escopo imediato)

1. **Inconsistência de autenticação nos scripts de seed.** `scripts/update-templates.mjs`
   documenta uso de *ID token* mas chama `signInWithCustomToken` (que exige *custom token*).
   Padronizar para `signInWithEmailAndPassword` (como em `clear-anamnesis-templates.mjs`).
2. **Dashboard carrega todos os exames** (`useCollection('exams')` sem paginação). Aceitável
   hoje, mas para clínicas grandes considerar agregações server-side como na Worklist.
3. **Filtro de clínica e exames sem `clinicId`.** Ao selecionar uma clínica, exames sem clínica
   ficam ocultos (comportamento esperado, mas vale um aviso/atribuição em massa na UI).
4. **Índices compostos.** As contagens por status usam apenas filtros de igualdade
   (clínica + status), atendidos por índices de campo único — sem novo índice composto. Caso o
   Firestore solicite um índice em produção, criar `(clinicId ASC, status ASC)` em `exams`.
5. **Credenciais do Firebase hardcoded nos scripts** (`scripts/*.mjs`). São chaves públicas de
   client, porém convém centralizar via `.env`.
