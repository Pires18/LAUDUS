# LAUD.US — Auditoria Global (Estrutura · Dados · Segurança · LGPD)
**Data:** 02/07/2026 · **Versão auditada:** 2.1.0 · **Status:** Fase 0 aplicada em 02/07/2026

---

## 1. Escopo e método

Auditoria completa do codebase: 14 módulos de produto, 14 endpoints serverless (`api/`),
regras do Firestore, fluxo de dados de pacientes, integrações (Firebase, Gemini, Anthropic,
AbacatePay, Google Drive/Docs, Orthanc PACS) e conformidade LGPD. Build TypeScript e suíte
de testes (91) verificados antes e depois das correções.

## 2. Notas por dimensão (pré-correções)

| Dimensão | Nota | Comentário |
|---|---|---|
| Funcionalidades/Produto | 8,5/10 | Escopo maduro e completo para o nicho |
| Estrutura de código | 7/10 | Modular e tipado; arquivos gigantes (LaudIA, engine, db) |
| Dados | 6,5/10 | Modelo limpo; sem retenção, backup e testes clínicos |
| Segurança | 3,5/10 | S1+S2+S3 exploráveis em produção |
| LGPD | 4/10 | Boa base (anonimização no treino), lacunas centrais |

## 3. Achados de segurança

### Críticos (corrigidos na Fase 0 — 02/07/2026)
- **S1 — Escalada de privilégio para admin global.** `firestore.rules` permitia o usuário
  atualizar o próprio `users/{uid}` sem restrição de campos → gravar `role: 'admin'` dava
  acesso total aos dados de TODOS os usuários. **Corrigido:** campos protegidos
  (`role`, `motorProEnabled`, `reportsQuota`, `clinicsQuota`, `subscriptionStatus`,
  `subscriptionId`, `licenseExpiresAt`, `active`, `addons`, `createdAt`, `email`) só por
  admin; `reportsUsedThisMonth` é increment-only pelo cliente; criação (trial) não pode
  nascer com role admin nem cotas infladas.
- **S2 — Proxies de IA abertos.** `/api/anthropic` e `/api/gemini` não exigiam login;
  rate limit por header `x-uid` auto-declarado. **Corrigido:** verificação do Firebase ID
  token no Edge (`api/_edgeAuth.ts`, JWKS + WebCrypto); rate limit pelo uid verificado.
  Todos os chamadores no cliente enviam `Authorization: Bearer <idToken>`
  (`src/lib/authToken.ts`).
- **S3 — SSRF + senha default no proxy Orthanc.** `/api/orthanc-proxy` aceitava qualquer
  URL sem login e tinha fallback `admin:123456789`. **Corrigido:** na nuvem exige token
  (header ou `?token=` para `<img src>`), destino HTTPS público (bloqueio de IPs
  privados/loopback/link-local/metadata), senha default removida. `/api/worklist` também
  passou a exigir token na nuvem.
- **S4 — Mensagens de tickets abertas.** Subcoleções de `support_tickets` legíveis/graváveis
  por qualquer autenticado. **Corrigido:** apenas dono do ticket ou admin.
- **S5 — Templates pessoais públicos.** `users/{uid}/templates` legível por todos.
  **Corrigido:** dono/admin + máscaras "do sistema" (subárvore de admin) continuam
  legíveis por todos.
- Extra: `audit_logs` agora exige `userId == auth.uid` na criação (sem forjar autoria).
  Arquivos `.wl` com dados de pacientes removidos do diretório local do projeto.

### Pendentes (Fases 1+)
- **S6:** CORS `*` em todas as APIs; sem CSP/HSTS/X-Frame-Options (`vercel.json`).
- **S7:** Chaves de IA pessoais em texto plano no Firestore e trafegando do browser.
- **S8:** Criptografia DICOM deriva chave do próprio UID (ofuscação, não proteção real).
- **S9:** Webhook AbacatePay e CRON aceitam secret em query string; comparação não
  constant-time.
- **S10:** OAuth Google pede escopo total do Drive; usar `drive.file`.
- Credenciais do Orthanc ainda trafegam em query string para o proxy (migrar p/ headers).

## 4. LGPD

- **L1 (ALTO, pendente):** Nome completo do paciente + histórico clínico enviados a
  Gemini/Anthropic na geração de laudos (`engine.ts:392`) — transferência internacional de
  dado sensível identificado sem necessidade clínica. Corrigir: enviar apenas
  iniciais/idade/sexo. A anonimização robusta já existente (`ai/training/anonymize.ts`) é
  usada apenas no corpus de treinamento.
- **L2:** Sem registro estruturado de base legal/consentimento do paciente para IA
  (o `AnamnesisConsentModal` cobre só anamnese).
- **L3:** Sem política de retenção/expurgo nem fluxo de eliminação (Art. 18).
- **L4:** CPF/RG/endereço/histórico sem criptografia em nível de campo.
- **L5:** `audit_logs` não registra ACESSO/visualização a dados de pacientes.
- **L6:** Formalizar DPAs com Google (Firebase/Gemini) e Anthropic; zero-retention; RIPD.

## 5. Dados & Arquitetura

- **D1:** Fallback de settings/templates do admin em `db.ts` conflita com as rules para
  não-admins (bug latente; caminho primário é `global_config`).
- **D2 (bug pré-existente, não alterado):** `incrementReportUsage` (engine.ts) tenta
  atualizar `subscriptions/{subId}` do cliente, mas as rules só permitem admin → a
  transação inteira falha silenciosamente para assinantes e
  `reportsUsedThisMonth` NÃO é incrementado (quota não é cobrada). Corrigir na Fase 1
  (incremento server-side ou regra específica).
- **D3:** Testes das 21 calculadoras médicas foram removidos junto com
  `utils/calculations.ts` — recriar (risco clínico).
- **D4:** Sem CI; **D5:** sem monitoramento de erros; **D6:** arquivos gigantes
  (LaudIA.tsx ~1.9k linhas, engine.ts 1.2k, db.ts 1.1k); **D7:** backup/PITR não documentado.

## 6. Plano de aprimoramento aprovado

- **FASE 0 (✅ concluída 02/07/2026):** itens S1–S5 + limpeza `.wl`.
- **FASE 1 (endurecimento):** headers de segurança/CSP, CORS restrito, chaves IA 100%
  server-side, rate limit distribuído (KV), secrets via header/constant-time, escopo
  Drive mínimo, credenciais Orthanc via header, correção D2.
- **FASE 2 (LGPD):** pseudonimização na geração (L1), consentimento/transparência (L2),
  retenção/expurgo (L3), trilha de acesso (L5), DPAs/RIPD (L6), criptografia de campo (L4).
- **FASE 3 (qualidade):** testes das calculadoras, CI, Sentry, refatoração dos arquivos
  gigantes, fallback admin do db.ts, backup/PITR.
- **FASE 4 (produto):** B1/B2/B7, C2/C3/C6 do IMPROVEMENT_PLAN.md + multi-perfil por clínica.

## 7. Pós-implantação da Fase 0 (ações operacionais)

1. **Deploy das rules:** `firebase deploy --only firestore:rules`
2. **Deploy do app na Vercel** (handlers de API + cliente com token).
3. Conferir env na Vercel: `FIREBASE_PROJECT_ID` (usado pelo verificador Edge),
   `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `CRON_SECRET`, `ABACATEPAY_*`.
4. Smoke test: login → gerar laudo (Lite e Pro) → visualizar imagens DICOM na nuvem →
   criar worklist → painel admin.
5. Nota: quem dependia da senha default `admin:123456789` do proxy Orthanc precisa
   preencher usuário/senha nas configurações DICOM.
