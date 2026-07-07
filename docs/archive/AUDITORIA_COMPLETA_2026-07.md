# 🔍 Auditoria Completa — LAUD.US

**Data:** 2026-07-04 (v2, aprofundada) · **Ambiente:** produção (Vercel + Firebase).
**Escopo:** todos os módulos, funcionalidades, interfaces, segurança, sistema de planos e infraestrutura.

> Reflete o estado **após** o endurecimento desta rodada (segurança, PACS na nuvem, painel admin, planos/cobrança, marca/landing). ✅ = já corrigido · 🔴 alta · 🟡 média · 🟢 baixa.

---

## 1. Retrato do sistema

| Métrica | Valor |
|---|---|
| Arquivos-fonte | ~191 (105 `.tsx`, 86 `.ts`) |
| Linhas (src) | ~53.400 |
| Módulos | 14 |
| Endpoints serverless | 12 funções + 6 helpers |
| Testes | 188 (12 arquivos) — 100% ✓ |
| Coleções raiz | users, subscriptions, saas_plans, transactions, support_tickets, audit_logs, metrics_daily, global_config, system |
| Stack | React 18 + TS + Vite (PWA) · Firebase · Vercel serverless/edge · Gemini · AbacatePay · GCP/Tailscale (PACS) |

**LOC por módulo:** `ai 9.230` · `editor 7.431` · `calculators 6.045` · `admin 4.871` · `appointments 3.897` · `laud-ia 2.690` · `settings 2.063` · `dicom 1.926` · `clinics 1.252` · `templates 984` · `patients 910` · `export 813` · `worklist 751` · `dashboard 649`.

---

## 2. Auditoria por módulo

### 2.1 Dashboard — `dashboard/Dashboard.tsx`
Início com atalhos, contadores e uso de laudos do mês (`getAiUsageStats` do próprio usuário). **Funcional.** 🟢 sem achados.

### 2.2 Worklist — `worklist/Worklist.tsx`
Fila de exames; CRUD; remove `.wl` ao finalizar/excluir (`deleteWorklistEntry`). **Funcional.** 🟢 escopo próprio (ok).

### 2.3 Pacientes — `patients/Patients.tsx`, `PatientDetail.tsx`
CRUD + histórico + exames anteriores. **LGPD:** `logPatientAccess`. 🟢 —

### 2.4 Agendamentos — `appointments/*`
Agenda semanal (`WeeklyCalendar`), marcação, worklist ao aparelho. ✅ **Agora bloqueado por add-on** (`hasAppointments` + `FeatureLocked`). 🟢 —

### 2.5 Editor de Laudo — `editor/*` (núcleo, 7.431 L)
`ExamEditor` + `RichEditor` (Tiptap) + `LaudCopilot` + 9 componentes + 5 hooks (`useExamActions`, `useDicomSync`, `useCopilotSuggestions`, `useGoogleDocs`, `useVoiceAnalyzer`). ✅ Corrigido: PDF/fullscreen do PACS na nuvem (auth completa no proxy); viewer externo escondido quando inacessível.
- 🟡 `ExamEditor.tsx` (1.457 L), `LaudCopilot.tsx` (1.585 L) — refatorar.

### 2.6 Máscaras — `templates/*`
Biblioteca + catálogo do sistema (subárvore admin legível por todos). Editor de template. 🟢 —

### 2.7 Calculadoras — `calculators/*` (6.045 L)
20+ calculadoras (`formulas.ts`, `classifiers.ts`, `fetalReferences`). ✅ **Melhor cobertura de testes**; gate por add-on. 🟢 —

### 2.8 Clínicas — `clinics/*`
Múltiplas clínicas + cabeçalhos. ✅ **Agora bloqueado por add-on** (`hasClinics`). 🟢 —

### 2.9 PACS/DICOM — `dicom/*`
`DicomControlCenter` (config/guia/armazenamento) + **`MyPacsCard`/`UltrasoundSetupCard`** (provisão self-service). ✅ Reescrito (guia VM-first, aba Armazenamento, presets) + enforcement server-side.
- 🟡 **Multi-tenant em produção** (`api/pacs-provision.ts`, VM compartilhada por `tenantId`) — validar robustez do provisionamento real (GCP+Tailscale) e a migração dos exames locais.

### 2.10 Configurações/Assinatura — `settings/*`
`Settings` + **`SubscriptionCenter`** (plano/add-ons/cota/compra/cancelamento/**histórico de pagamentos**) + `AuditDashboard`. ✅ Cancelamento via `ConfirmDialog`; fim do portal-fake; histórico de pagamentos do usuário (regra owner-read). 🟢 —

### 2.11 Admin — `admin/*` (4.871 L)
9 submódulos: Overview/Analytics, Usuários & Planos, Financeiro, Auditoria, Suporte, Máscaras, **Saúde**, LAUD.IA, **UserDetail (360º)**. ✅ Endurecido e ampliado (guarda de acesso, telemetria persistente, KPIs reais, MRR/ARR, export CSV, SLA, aba Saúde).
- 🟡 *Usuários*/*Suporte* ainda carregam a coleção inteira (paginar).

### 2.12 IA — `ai/*` (9.230 L)
Motor Gemini (Lite/Pro), prompts por área, **pipeline de treino/evals** (`training/*` — 18 arquivos). ✅ Gemini-only; IDs centralizados; cota server-side (fail-open); telemetria persistida.
- 🟡 `prompts/areaPrompts.ts` (3.297 L) — dado grande em código.

### 2.13 LAUD.IA — `laud-ia/SharedLaudIA.tsx` (1.745 L)
UI de treino/config da IA (admin). 🟡 arquivo grande.

### 2.14 Export — `export/*`
PDF (paged.js) + Google Docs (`lib/googleDocs`/`googleDrive`/`googlePicker`). ✅ Observações metodológicas no corpo do laudo. 🟢 —

---

## 3. Auditoria de segurança

✅ **Sólido:**
- **Firestore rules** (RBAC, 13 `match`): sem escalonamento de privilégio (campos protegidos), cota só cresce, add-ons só admin, `transactions`/`metrics_daily` restritos, default-deny, `saas_plans` público (catálogo).
- **Admin** só por `profile.role` (autoritativo) + guarda em `Admin.tsx` + super-admin por e-mail.
- **Endpoints:** JWKS (Edge/serverless), rate-limit (`gemini`), `safeEqual` (webhook/cron), entitlement PACS + cota (fail-open), `promote-admin` (trava tripla), `abacatepay-test` (admin-only).
- **Segredos:** criptografia por-usuário (senhas PACS + agent secret), anti-SSRF no Agente, `.env` gitignored.
- **LGPD:** trilha de acesso, pseudonimização (`scrubForGeneration`), consentimento.

🟡 **Pendências:**
1. **`global_config` legível por qualquer logado** (`allow read: if isSignedIn()`) — inclui `admin_settings`/`abacatepay_config`. Confirmar que não há segredo sensível exposto (chaves de pagamento/IA devem estar server-side); **restringir docs sensíveis**.
2. **Cota contável no servidor**: hoje o servidor **lê** `reportsUsedThisMonth` (não conta). Um cliente adulterado poderia não incrementar. Blindagem total = incrementar server-side.
3. **PACS provision** manipula credenciais GCP/Tailscale server-side — revisar tratamento de erro/segredos e permissões da service account.

---

## 4. Sistema de planos & cobrança

✅ **Coerente:** add-ons (`pacs/calculators/appointments/clinics` + pacotes de token/extra) com **gating consistente** (nav + `FeatureLocked` + servidor); trial 14d; checkout→webhook→cancel; vitrine pública de preços (`PricingPlans`); admin atribui plano (mapeia `includesX`→add-ons).

🟡 **Pendências:**
- MRR/ARR dependem do CRON (diário no Hobby) + "Recalcular métricas".
- Sem upgrade/downgrade com prorata (troca = atribuição direta).
- Sem reconciliação automática `finance_stats` vs soma real.

---

## 5. Interfaces & UX
✅ Sem botões mortos; ações com toast + tratamento de erro; **confirmações padronizadas** (`ConfirmDialog`); estados loading/vazio/erro; `ErrorBoundary` por rota; **marca padronizada** (favicon+PWA) e **tela de entrada como landing** com vitrine de planos.
🟢 Oportunidade: página pública de pricing dedicada (hoje é modal na entrada), FAQ, add-ons avulsos na vitrine.

---

## 6. Qualidade & dívida técnica

| Indicador | Valor | Leitura |
|---|---|---|
| Testes | 188 ✓ | Bom; concentrado em IA/calculadoras/segurança/PACS-routing |
| `any`/`as any` | ~225 | Alto |
| TODO/FIXME | ~60 | Moderado |
| `@ts-ignore`/eslint-disable | ~25 | Moderado |
| Arquivos > 1.000 L | areaPrompts, SharedLaudIA, LaudCopilot, AdminFinanceiro, ExamEditor, engine, db | Refatorar |
| Bundle `vendor-ui` | ~1 MB | Code-split |

---

## 7. Achados priorizados

**🔴 Alta**
1. Ampliar **testes dos caminhos críticos** — webhook (pagamentos), `_entitlements`/cota, `store/db` (base sólida já existe).

**🟡 Média**
2. Restringir `global_config` (exposição de docs sensíveis).
3. Cota contável no servidor (blindagem total).
4. Robustez do **PACS multi-tenant** (provisão real GCP + migração).
5. Paginação server-side em *Usuários*/*Suporte*.
6. Refatorar arquivos gigantes.

**🟢 Baixa**
7. Reduzir `any`; limpar TODOs; code-split; página pública de pricing.

---

## 8. Conclusão
O LAUD.US está **funcional, seguro, coerente e agora em produção atualizada**. As pendências são de **maturidade** (testes, escala, refatoração, robustez do PACS multi-tenant) — sem falha crítica aberta conhecida. Roadmap organizado em [PLANO_REFINAMENTO.md](PLANO_REFINAMENTO.md); sistema descrito por completo em [DOCUMENTACAO_OFICIAL.md](DOCUMENTACAO_OFICIAL.md).
