# 🔍 Auditoria Completa — LAUD.US

**Data:** 2026-07-04 · **Versão do sistema:** produção (Vercel + Firebase) · **Escopo:** todos os módulos, funcionalidades, interfaces, segurança e sistema de planos.

> Esta auditoria reflete o estado **após** o endurecimento de segurança/PACS/admin/cobrança realizado nesta rodada. Itens já corrigidos estão marcados ✅; pendências têm severidade 🔴 alta / 🟡 média / 🟢 baixa.

---

## 1. Retrato do sistema

| Métrica | Valor |
|---|---|
| Arquivos-fonte | ~189 (104 `.tsx`, 85 `.ts`) |
| Linhas (src) | ~53.400 |
| Módulos | 14 |
| Endpoints serverless | 18 (`api/`) |
| Testes | 188 (12 arquivos) — 100% passando |
| Coleções Firestore (raiz) | users, subscriptions, saas_plans, transactions, support_tickets, audit_logs, metrics_daily, global_config, system |
| Stack | React 18 + TS + Vite (PWA) · Firebase (Auth/Firestore/Storage) · Vercel serverless/edge · Gemini · AbacatePay |

### LOC por módulo
`ai 9.230` · `editor 7.431` · `calculators 6.045` · `admin 4.871` · `appointments 3.897` · `laud-ia 2.690` · `settings 2.063` · `dicom 1.926` · `clinics 1.252` · `templates 984` · `patients 910` · `export 813` · `worklist 751` · `dashboard 649`

---

## 2. Auditoria por módulo (estrutural · funcional · interface · segurança)

### 2.1 Dashboard (`src/modules/dashboard`)
- **Função:** visão inicial — atalhos, contadores, uso de laudos, status.
- **Estado:** funcional. Lê `getAiUsageStats` do próprio usuário.
- 🟢 Poderia consolidar KPIs com o resto; sem problemas de segurança.

### 2.2 Worklist (`src/modules/worklist`)
- **Função:** lista de exames pendentes/em andamento/finalizados; cria/edita/exclui exame; sincroniza com o PACS (.wl).
- **Estado:** funcional; remove `.wl` ao finalizar/excluir.
- 🟢 Carrega a coleção do usuário (escopo próprio, ok).

### 2.3 Pacientes (`src/modules/patients`)
- **Função:** CRUD de pacientes, histórico, exames anteriores.
- **Estado:** funcional. LGPD: acesso a paciente é auditado (`logPatientAccess`).
- 🟢 Sem achados relevantes.

### 2.4 Agendamentos (`src/modules/appointments`)
- **Função:** agenda semanal, marcação de exames, envio de worklist ao aparelho.
- **Estado:** funcional. ✅ **Agora bloqueado por add-on** (`hasAppointments` + `FeatureLocked`) — antes só sumia do menu.
- 🟢 —

### 2.5 Editor de Laudo (`src/modules/editor`) — núcleo
- **Função:** editor Tiptap, geração/refino por IA, Copiloto, visualizador PACS embutido, export PDF das imagens, versões, consentimento/anamnese.
- **Estado:** robusto. ✅ Corrigido nesta rodada: PDF/fullscreen do PACS na nuvem (auth completa no proxy); viewer externo escondido quando inacessível.
- 🟡 `ExamEditor.tsx` (1.457 L) — candidato a refatoração por tamanho.

### 2.6 Templates/Máscaras (`src/modules/templates`)
- **Função:** biblioteca de máscaras de laudo, catálogo do sistema, editor de template.
- **Estado:** funcional; máscaras do sistema (subárvore admin) legíveis por todos.
- 🟢 —

### 2.7 Calculadoras (`src/modules/calculators`)
- **Função:** 20+ calculadoras (biometria fetal, dopplers, volumes) — bem testadas.
- **Estado:** ✅ único módulo com boa cobertura de testes; gate por add-on via `FeatureLocked`.
- 🟢 —

### 2.8 Clínicas (`src/modules/clinics`)
- **Função:** múltiplas clínicas, cabeçalhos de laudo por unidade.
- **Estado:** ✅ **Agora bloqueado por add-on** (`hasClinics`).
- 🟢 —

### 2.9 PACS/DICOM (`src/modules/dicom`)
- **Função:** configuração do Orthanc (local/VM), guia, aba de armazenamento/exames.
- **Estado:** ✅ reescrito nesta rodada (guia VM-first, aba de Armazenamento, presets). Enforcement de plano server-side.
- 🟡 Migração para VM na nuvem (multi-tenant) em andamento (`api/pacs-provision.ts`, docs PACS_*).

### 2.10 Configurações/Assinatura (`src/modules/settings`)
- **Função:** perfil, PACS, LAUD.IA, e o **SubscriptionCenter** (plano, add-ons, cota, compra, cancelamento, histórico de pagamentos).
- **Estado:** ✅ nesta rodada: cancelamento via `ConfirmDialog`; fim do "portal AbacatePay" fake; histórico de pagamentos do usuário funcionando (regra owner-read).
- 🟢 —

### 2.11 Admin (`src/modules/admin`)
- **Função:** dashboard executivo, usuários & planos, financeiro, auditoria, suporte, máscaras, saúde do sistema, LAUD.IA.
- **Estado:** ✅ endurecido e ampliado (Fases 0–5 + A): guarda de acesso, telemetria persistente (`metrics_daily`), KPIs reais, visão 360º do cliente, MRR/ARR, export CSV, SLA de suporte, aba Saúde.
- 🟡 Listas de *Usuários* e *Suporte* ainda carregam a coleção inteira (ok no volume atual; paginar no futuro).

### 2.12 IA (`src/modules/ai`)
- **Função:** motor Gemini (Lite/Pro), prompts por área, treino/evals, telemetria.
- **Estado:** ✅ Gemini-only (Anthropic removido); IDs de modelo centralizados; enforcement de cota server-side (fail-open).
- 🟡 `prompts/areaPrompts.ts` (3.297 L) — arquivo gigante (dados, não lógica).

### 2.13 LAUD.IA (`src/modules/laud-ia`)
- **Função:** UI de treino/configuração da IA (admin).
- **Estado:** funcional; `SharedLaudIA.tsx` (1.745 L) grande.

### 2.14 Export (`src/modules/export`)
- **Função:** geração do laudo em PDF (paged.js) e Google Docs; documento de imagens.
- **Estado:** funcional. ✅ Observações metodológicas movidas para o corpo do laudo.

---

## 3. Auditoria de segurança

✅ **Sólido:**
- **Firestore rules** (13 `match`, RBAC): impedem auto-promoção a admin, inflar cota, auto-conceder add-ons; contador de uso só cresce; `transactions` admin/owner-read; default-deny.
- **Privilégio de admin** só por `profile.role` (campo protegido) — `useAdmin` não confia mais em `settings.currentRole`; `Admin.tsx` com guarda própria.
- **Endpoints:** `promote-admin` (trava tripla), `abacatepay-test` (admin-only), webhook (`safeEqual` timing-safe), `orthanc-proxy`/`worklist` (auth + entitlement PACS), `gemini` (auth + rate-limit + cota).
- **PACS por-usuário:** segredo do agente criptografado; anti-SSRF (`ALLOWED_HOSTS`).
- **LGPD:** trilha de acesso a paciente; pseudonimização nos prompts (`scrubForGeneration`).
- **Enforcement server-side:** add-on PACS (`_entitlements.ts`) e cota de laudos (Edge via Firestore REST), ambos **fail-open**.
- **Monitoramento:** Sentry configurável.

🟡 **Pendências:**
- **`global_config` legível por qualquer usuário logado** (`allow read: if isSignedIn()`) — inclui `admin_settings`. Verificar se há segredo sensível ali (chaves de IA são server-side, mas confirmar). Considerar restringir docs sensíveis.
- **Enforcement de cota** depende do cliente incrementar `reportsUsedThisMonth` (o servidor lê, não conta). Fecha o caso honesto/direto; não impede um cliente adulterado de não-incrementar. Contar server-side seria a blindagem total (custo/latência).

---

## 4. Sistema de planos — estado

✅ **Coerente após esta rodada:**
- Add-ons: `pacs`, `calculators`, `appointments`, `clinics` — **gating consistente** (paywall `FeatureLocked` em todos).
- Cota de laudos (Lite/Pro) + quota de clínicas; trial de 14 dias.
- **Enforcement:** UI (nav + paywall) + servidor (PACS + cota de laudos).
- **AbacatePay:** checkout (plano/add-on) → webhook (concede + agrega receita) → cancelamento (dono ou admin). Sem portal fake.
- **Admin:** atribuir plano (mapeia `includesX` → add-ons), editar cota, toggle Motor Pro, cancelar.

🟡 **Pendências:**
- MRR/ARR dependem do CRON (diário no Hobby) + "Recalcular métricas" inicial.
- Sem prorata/upgrade-downgrade automatizado (troca de plano é atribuição direta).

---

## 5. Qualidade & dívida técnica

| Indicador | Valor | Leitura |
|---|---|---|
| Testes | 188 ✓ | Bom, mas concentrado em IA/calculadoras/PACS-routing |
| `any`/`as any` | 225 | Alto — tipagem frouxa em pontos |
| TODO/FIXME | 60 | Moderado |
| `@ts-ignore`/eslint-disable | 25 | Moderado |
| `console.*` | 8 | Baixo (usa `logger`) |
| Arquivos > 1.000 L | areaPrompts (3.297), SharedLaudIA (1.745), LaudCopilot (1.585), AdminFinanceiro (~1.550), ExamEditor (1.457), engine (1.274), db (1.290) | Refatoração recomendada |
| Bundle `vendor-ui` | ~1 MB | Warning de build; code-split recomendado |

---

## 6. Achados priorizados (pendências)

**🔴 Alta**
1. **Cobertura de testes** dos caminhos críticos ainda parcial — pagamentos (webhook), enforcement, editor e `store/db` merecem mais testes (há base sólida agora: security/pricing/dicom-routing).

**🟡 Média**
2. `global_config` legível por qualquer logado — revisar exposição.
3. Cota de laudos contável no servidor (blindagem total) — hoje o servidor lê, não conta.
4. Paginação server-side em *Usuários* e *Suporte* (escala).
5. Refatorar arquivos gigantes (ExamEditor, SharedLaudIA, AdminFinanceiro, areaPrompts).

**🟢 Baixa**
6. Reduzir `any` (225) nos pontos quentes; limpar TODOs.
7. Code-split do bundle `vendor-ui`.
8. Multi-tenant PACS (em andamento) — finalizar/documentar.

---

## 7. Conclusão
O LAUD.US está **funcional, seguro e coerente** após esta rodada de endurecimento. As pendências são de **maturidade** (testes, escala, refatoração) — não há falha crítica aberta conhecida. O [PLANO_REFINAMENTO.md](PLANO_REFINAMENTO.md) organiza as pendências em fases; a [DOCUMENTACAO_OFICIAL.md](DOCUMENTACAO_OFICIAL.md) descreve o sistema por completo.
