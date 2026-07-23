# Auditoria Final — LAUD.US / LAUD.IA (2026-07-23)

Auditoria completa do sistema (LAUD.US + LAUD.IA + integrações) em 4 frentes
paralelas: **código morto**, **integrações/quebras**, **drift de dados/config**,
**docs/versões**. Este documento consolida os achados, o que foi **executado** e o
que ficou **pendente de decisão do dono**.

Veredito: **sistema saudável**. As integrações (Firebase, AbacatePay, PACS, PWA,
Sentry) estão sãs; as quebras reais estavam concentradas em (a) a fonte-única de
modelos Gemini sendo contornada, (b) duas lacunas de Firestore (regra + índice), e
(c) documentação/CHANGELOG defasados. Tudo isso foi corrigido.

---

## 1. Saúde por subsistema

| Subsistema | Status | Observação |
|---|---|---|
| Firebase (Auth/Firestore/Storage) | ✅ SÃ | Toda coleção usada tem regra; 2 lacunas corrigidas (ver §3) |
| AbacatePay (billing) | ✅ SÃ | Tudo em `/v2`; mock bloqueado em produção sem key |
| PACS/DICOM (Tailscale) | ✅ SÃ | Sem hosts/tenants mortos hardcoded; tudo via env |
| PWA / Service Worker | ✅ SÃ | version.json + force-update + headers coerentes |
| Sentry | ⚪ inativo | Código completo; ativa só setando `VITE_SENTRY_DSN` |
| LAUD.IA (Gemini) | 🔧 corrigido | Fonte única era contornada em ~8 pontos — unificada |

---

## 2. LAUD.IA — unificação da fonte única (EXECUTADO)

A "fonte única" `ai/geminiModels.ts` estava sendo contornada. Corrigido:

- **`generateTemplate.ts` REMOVIDO** (órfão) — tinha um resolvedor gêmeo que emitia
  IDs **fora do allowlist** (`gemini-2.5-pro-preview-06-05`, `…flash-preview-05-20`);
  bug real ao gerar máscara com o Pro default. Deleção mata órfão + bug.
- **`SharedLaudIA.tsx`**: `getGenerativeModel` hardcoded, defaults do motorConfig e
  labels/options passam a usar `GEMINI_LITE_MODEL`/`GEMINI_PRO_MODEL`.
- **`TelemetryDashboard`/`Dashboard`**: classificação Lite/Pro por listas hardcoded
  (que esqueciam o `gemini-2.5-pro`) → novo helper único **`motorForModel`**.
- **`evaluator.ts`**: `proHint` cai no default Pro GA (não no preview).
- **Labels** de `Admin.tsx`/`AdminHealth.tsx` leem as constantes.
- **`modelPricing.ts`**: removido `gemini-3.1-flash-lite` do allowlist (era válido
  sem preço → custo $0); allowlist e pricing agora consistentes.

Resultado: trocar de modelo agora é **1 ponto** (`geminiModels.ts`) e propaga.

---

## 3. Firestore — lacunas corrigidas (EXECUTADO + deployado)

- **[CRÍTICO] Regra de collection-group `nf`** — `collectionGroup('nf')` (aba de
  status de NF do admin) não tinha regra wildcard; toda leitura dava
  `permission-denied`. Adicionado `match /{path=**}/nf/{nfId}` (só admin). **No ar.**
- **Índice `support_tickets(userId, updatedAt desc)`** — usado pela Central de
  Suporte (todo usuário) mas não versionado (era o "índice fora do arquivo").
  Adicionado ao `firestore.indexes.json`. **Deployado.**
- **Índice `ai_usage.timestamp` escopo COLLECTION** — o `fieldOverride` só tinha
  COLLECTION_GROUP, desligando o single-field automático e quebrando
  `getAiUsageStats`. Adicionado COLLECTION (ASC+DESC). **Deployado.**
- **Índice morto `exams(patientId, createdAt)`** — removido do arquivo (nenhuma
  query usa). ⚠️ Ainda existe no PROJETO — ver §6 (decisão do dono).

---

## 4. Código morto removido (EXECUTADO) — ~470 linhas

- **4 arquivos órfãos** (nunca importados): `generateTemplate.ts`,
  `utils/firebaseErrors.ts`, `editor/components/DicomThumbnail.tsx`,
  `editor/hooks/useVoiceAnalyzer.ts`.
- **Subsistema legado no `LaudCopilot.tsx`**: protótipo antigo da aba estruturada
  (`StructuredField` + `FETAL/GYNECO/VASCULAR_FIELDS` + `StructuredFormField`),
  o `routerDecision` useMemo (computado e nunca lido) e a flag morta `hasKey`.
  (Preservado `buildAreaInstruction`, que é vivo.)

O codebase é limpo: zero `if(false)`, zero blocos comentados grandes, zero
TODO/FIXME reais, **zero duplicação acidental** cross-file.

---

## 5. Docs & config (EXECUTADO)

- **CHANGELOG**: adicionada seção `[Não lançado]` com todo o trabalho pós-19/07.
- **README** e **DOCUMENTACAO_OFICIAL**: Pro corrigido para `gemini-2.5-pro`; fonte
  única apontada para `geminiModels.ts`.
- **`.env.example`**: documenta `ORTHANC_PROXY_ALLOWED_HOST_SUFFIXES`.
- **`.gitignore`**: removidos os globs com barra-invertida (`C:\`, `[Cc]:\…`) que
  quebravam `rg`/ferramentas; variantes com `/` mantidas.

---

## 6. Pendente de DECISÃO DO DONO (não executado)

1. **Deletar o índice morto `exams(patientId, createdAt)` do projeto** — seguro
   agora (o `support_tickets` já está versionado): `firebase deploy --only
   firestore:indexes --force`. Deleção em produção → deixado para aprovação.
2. **Migrações legadas single-tenant** (`db.ts:206-268`, v1–v6) — idempotentes e
   version-gated. Se confirmar que todos os dispositivos têm
   `_settingsMigrationVersion >= 6`, dá para colapsar num piso no-op. Não remover
   às cegas (quem nunca recarregou perderia a correção).
3. **Tipos exportados sem uso** `MotorConfig`/`UserDoc` (`types.ts`) — a
   recomendação é **adotar** `UserDoc` (o doc de usuário é acessado sem tipagem
   hoje) em vez de remover. Decisão de dívida técnica.
4. **`src/ARCHITECTURE.md`** — está em `src/` (deveria ser `docs/`), título "v2.0"
   e uma menção a "Vercel edge" incorreta (é Node serverless). Mover + corrigir.
5. **Ativar Sentry** — setar `VITE_SENTRY_DSN` (código pronto).
6. **Revogar a `GOOGLE_API_KEY`** exposta em chat e rotacionar.
7. **~130 warnings de `no-unused-vars`** (quase todos ícones lucide importados à
   toa) — inofensivos; limpar com uma passada dedicada (o `eslint --fix` não
   remove imports sem o plugin `unused-imports`).

---

## 7. Estrutura de docs recomendada

Um doc canônico por assunto; planos executados e auditorias pontuais → `archive/`;
insumos de extração → `references/`.

```
/CHANGELOG.md                → seção [Não lançado] mantida
/docs/
  DOCUMENTACAO_OFICIAL.md    → hub mestre
  ARCHITECTURE.md            → mover de src/; corrigir versão/edge/Pro
  BACKLOG.md                 → re-verificar itens vs código
  AUDITORIA_FINAL_2026-07.md → este doc
  references/                → CASCADE_PROMPTS, BIOMETRIA_*, FMF_*, PE_2T_*
  pacs/  legal/  roadmaps/
  archive/                   → AUDITORIA_2026-07.md, PLANO_PACS_VM_COMPARTILHADA
```
