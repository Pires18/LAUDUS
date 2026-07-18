# Auditoria de Estado — LAUD.US

> Auditoria independente do estado atual do sistema, feita **do zero** e **verificada
> contra o código real** (não contra planos arquivados), visando padronização,
> organização e versionamento em nível profissional. Somente diagnóstico — nenhuma
> alteração de código foi feita nesta rodada.

- **Data:** 2026-07-09
- **Versão auditada:** `package.json` 2.1.0 · branch `main` @ `745ed02`
- **Método:** gates de saúde (tsc/testes/build) + varredura de dívida técnica +
  leitura por módulo + cross-check com `docs/BACKLOG.md`.

---

## 1. Veredito

O sistema **já está num patamar profissional, organizado e versionado.** Não há
"bagunça" a corrigir do zero: há um CHANGELOG mantido, documentação extensa em
`docs/`, um `BACKLOG.md` vivo com disciplina de re-verificação, tipos limpos e uma
suíte de testes robusta no domínio clínico/financeiro. As oportunidades são pontuais
e de refinamento, não estruturais.

**Nota geral: A− (alto nível, com 1 gap de tooling e dívidas conhecidas e rastreadas).**

---

## 2. Linha de base de saúde (verificada)

| Dimensão | Resultado | Evidência |
|---|---|---|
| Tipos (`tsc --noEmit`) | ✅ **Zero erros** | execução limpa |
| Testes | ✅ **720 testes / 35 arquivos** | `vitest run` |
| Build de produção | ✅ OK | `vite build` |
| `@ts-ignore` / `@ts-nocheck` | ✅ **0** | grep |
| `TODO`/`FIXME` reais (comentários) | ✅ **1** | grep com word-boundary (o número "66" era ruído de "todo/todas" em PT) |
| `console.log` fora do `logger` | 🟢 **3** | baixo, mas não-zero |
| `: any` / `as any` | 🟡 **~304** | concentrado em código Firestore do admin (`.data()` casts) |
| Lint | ❌ **Sem ESLint/Prettier** | sem config nem script |
| Versionamento | ✅ SemVer 2.1.0 + `CHANGELOG.md` (Keep a Changelog) + badge no Sidebar | — |
| Regras de segurança | ✅ `firestore.rules` (298 linhas, RBAC) | — |

---

## 3. Arquitetura & organização

**Estrutura por domínio (boa).** 14 módulos em `src/modules/` (admin, ai, appointments,
calculators, clinics, dashboard, dicom, editor, export, laud-ia, patients, settings,
templates, worklist) e 24 funções serverless em `api/` (com helpers `_*.ts` bem
isolados: `_auth`, `_edgeAuth`, `_entitlements`, `_quota`, `_pricing`, `_rateLimit`,
`_secure`, `_pacsLifecycle`).

**Documentação (forte).** `ARCHITECTURE.md`, `DOCUMENTACAO_OFICIAL.md`, `BACKLOG.md`,
roadmaps, `pacs/`, `legal/`, além de `docs/archive/` com histórico de auditorias.
O `BACKLOG.md` é a fonte única de itens abertos, com origem citada e a regra explícita
de re-verificar no código antes de agir — exatamente a prática correta.

---

## 4. Achados por severidade

### 🔴 P0 — Bloqueio de processo (não é código)
- **`main` dirigido por dois agentes em paralelo.** O HEAD atual não contém os commits
  desta sessão (viraram objetos órfãos após `pull --ff`/reset do processo paralelo).
  **Isto inviabiliza "versionar tudo de forma final":** sem uma única fonte de verdade
  na branch, qualquer trabalho é sobrescrito. **Resolver o fluxo de branch é
  pré-requisito** para qualquer padronização ampla.

### 🟠 P1 — Padronização (gap real de tooling)
- **Ausência de ESLint + Prettier.** É o único gap claro de "padronização
  profissional": não há linter, formatador nem `npm run lint`. Impacto: estilo/qualidade
  dependem de disciplina manual; regras como `no-unused-vars`, `exhaustive-deps` e
  `no-explicit-any` não são aplicadas automaticamente. **Recomendado adotar** (flat
  config `eslint.config.js` + `@typescript-eslint` + `eslint-plugin-react-hooks` +
  Prettier), rodando em modo *report-only* primeiro para não travar o build.

### 🟡 P2 — Dívida técnica (conhecida e rastreada)
- **`any` alto (~304).** Concentrado em `AdminFinanceiro.tsx` (18), `AdminUsersSubscriptions.tsx`
  (16), `FinanceOverviewTab.tsx` (13), `SubscriptionCenter.tsx` (12) — quase todo em
  casts de `doc.data()` do Firestore. Idiomático, mas tipar os shapes de documento
  (interfaces por coleção) removeria a maioria. Já rastreado no BACKLOG (R7).
- **Arquivos grandes.** `areaPrompts.ts` (3409 — dados, ok), `LaudCopilot.tsx` (1809),
  `AdminFinanceiro.tsx` (1802), `SharedLaudIA.tsx` (1766), `DicomControlCenter.tsx`
  (1647), `ExamEditor.tsx` (1593). Refatoração em subcomponentes/hooks melhora
  manutenção. Já rastreado no BACKLOG (R4).
- **Cobertura de testes concentrada no domínio.** 35 arquivos fortíssimos em
  AI/calculadoras/FMF/biometria/estruturado/pricing/quota/dicom/webhook, mas **poucos
  testes de componentes de UI** (editor, admin). Lógica pura ✅; interações React ⚠️.
  Já rastreado no BACKLOG (Fase 5).
- **3 `console.log`** fora do `logger` — trivial de migrar.

### 🟢 Itens de negócio/roadmap (deliberadamente adiados — ver BACKLOG)
- Frota de VMs no admin (F5) — parcialmente coberto pela aba VMs/Infra.
- Reconciliação AbacatePay (Fase C) e export de billing GCP (Fase D) — bloqueio externo.
- LGPD: portal do titular, purga automática, criptografia de campo (P1–P3).
- Assinatura ICP-Brasil — 0% (bloqueado em decisão de fornecedor).
- FMF Parte G — casos-ouro pendentes (`validated:false` até validação clínica).

---

## 5. Segurança & confiabilidade (posição)

- **RBAC no Firestore** (298 linhas) com `isAdmin()`, campos protegidos, regras de
  collection-group para admin (settings/ai_usage). Sólido.
- **Fail-open deliberado** (9 menções) em cota/entitlement: nunca derruba um pagante
  por falha de infra — decisão documentada e correta para o contexto.
- **Proxy de IA** já corrigido para nunca repassar `Authorization` ao Google e exigir
  chave (dev via middleware, prod via Edge).
- **Auto-atualização de PWA** evita clientes rodando código antigo.

Nenhum achado de segurança crítico nesta varredura. Recomenda-se, quando houver
janela, ativar Sentry (já previsto) e um scan de dependências (`npm audit`).

---

## 6. Plano priorizado (proposta)

| # | Ação | Esforço | Risco | Depende de |
|---|---|---|---|---|
| 1 | **Alinhar fluxo de branch** (fonte única de verdade) | baixo | — | decisão do usuário |
| 2 | **ESLint + Prettier** (report-only → CI) | médio | baixo | #1 |
| 3 | Tipar shapes de documento Firestore (mata a maior parte dos `any`) | médio | baixo | #2 |
| 4 | Refatorar 2–3 arquivos maiores (ExamEditor, AdminFinanceiro) em subcomponentes | alto | médio | #2 |
| 5 | Testes de componente para fluxos críticos do Editor | médio | baixo | — |
| 6 | Migrar 3 `console.log` → `logger`; `npm audit` | trivial | — | — |

Itens de negócio (LGPD, ICP-Brasil, reconciliação) seguem no `BACKLOG.md`, bloqueados
por decisões externas — não entram como dívida de engenharia.

---

## 7. Recomendações de versionamento

O versionamento já existe e é bom (SemVer + CHANGELOG). Para levar ao "final
profissional":
1. **Uma fonte de verdade na `main`** (P0 acima) — sem isso, versionar é ilusório.
2. **Tag git por release** (`git tag v2.1.0`) espelhando o `package.json` — hoje o
   CHANGELOG evolui mas não há tags anotadas.
3. **`CHANGELOG.md`: fechar a seção `[Não versionado]`** num número quando a próxima
   release sair, com data.
4. **Exibir `package.json.version` no badge do Sidebar via `import.meta.env`** (injetar
   com `define` no `vite.config`) para a versão da UI nunca divergir do pacote.

---

## 8. Conclusão

O sistema não precisa de uma "reconstrução" — precisa de **1 decisão de processo**
(branch única) e **1 adoção de tooling** (ESLint/Prettier), seguidas de refino
incremental de dívidas já catalogadas. O restante (documentação, testes de domínio,
versionamento, segurança) já está em nível alto. A recomendação é executar o plano da
Seção 6 na ordem, **após** resolver o P0 — caso contrário o trabalho é sobrescrito
pelo processo paralelo.
