# 🏢 Plano — VM compartilhada multi-tenant + refactor do módulo PACS/DICOM

> **Data:** 04/07/2026 · Complementa [`PLANO_PACS_AUTOMACAO_SELF_SERVICE.md`](../roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md).
>
> **Objetivo:** transformar a **VM existente `orthanc-server`** no **host compartilhado** (planos Starter/Pro, muitos clientes isolados numa VM) e manter o plano **Dedicado** como **VM própria automática** (F2). Plano de segurança e **personificação** (isolamento por usuário) + refactor do módulo para os dois modelos coexistirem.

---

## 0. Sua infraestrutura hoje
- **VM compartilhada:** `orthanc-server` · `e2-medium` (2 vCPU / 4 GB) · `southamerica-east1-c` · IP `34.39.140.234` · **1 disco** (boot) · criada 03/07/2026.
- **Provisionador Dedicado:** `api/pacs-provision.ts` (GCP + Tailscale) — credenciais validadas ✅ (Compute API ativa, SA e Tailscale OK; falta `tag:pacs` na ACL).
- **App:** já fala com "um agente por usuário" (agentUrl + segredo). Precisa virar **tenant-aware** para a VM compartilhada.

---

## 1. Modelo de dois níveis (final)
| Plano | Infra | Isolamento | Provisionamento |
|---|---|---|---|
| **Starter / Pro** | **VM compartilhada** (`orthanc-server`): 1 **container Orthanc por cliente** | Forte (processo + volume + porta por tenant) | Cria **container** na VM compartilhada |
| **Dedicado** | **VM própria** automática | Máximo (máquina isolada) | `api/pacs-provision.ts` (F2) |

---

## 2. Isolamento multi-tenant na VM compartilhada — **container por tenant** (recomendado)

```
VM orthanc-server (Tailscale)                         ┌──────── tenant A (uid a1b2)
 ├─ Agente LAUD.US (tenant-aware) :3000  ── Funnel ──▶│  orthanc-a1b2  HTTP 127.0.0.1:8101
 │    └ registry: uid → {porta, pasta, segredo}       │                DICOM 0.0.0.0:4301
 ├─ /opt/tenants/a1b2/{data,worklists}                └─ volume isolado
 ├─ /opt/tenants/c3d4/{data,worklists} ───────────────┐  tenant B (uid c3d4)
 └─ ...                                                │  orthanc-c3d4  HTTP 127.0.0.1:8102
                                                       │                DICOM 0.0.0.0:4302
CLÍNICA A: US → relé → 34-tailnet-IP:4301             └─ volume isolado
CLÍNICA B: US → relé → 34-tailnet-IP:4302
```

**Regras:**
- **1 container Orthanc por cliente**, com **volume isolado** (`/opt/tenants/<uid>/data`) e **worklist isolada** (`/opt/tenants/<uid>/worklists`).
- **HTTP** de cada Orthanc só em `127.0.0.1:<porta>` (o Agente alcança; ninguém de fora).
- **DICOM** de cada Orthanc numa **porta única** (`43xx`), alcançada pelo relé do cliente via IP tailnet da VM.
- **Limites de recurso** por container (`--memory`, `--cpus`) → sem "vizinho barulhento".
- Densidade estimada na `e2-medium`: ~8–15 clientes pequenos (subir a VM se crescer).

---

## 3. Agente **tenant-aware** (refactor do `agent.js`)
Hoje o agente usa `LAUDUS_WORKLIST_DIR` e um único segredo. Passa a ter um **registry de tenants**:
- `/opt/tenants/<uid>/tenant.json` = `{ secret, dicomPort, httpPort, worklistDir }`.
- Toda requisição carrega **`tenantId`** (worklist no corpo; imagens em `?tenantId=`).
- O agente: valida o **segredo do tenant**, resolve **a pasta** e **a porta Orthanc** daquele tenant, e **nunca cruza** tenants → **personificação garantida**.
- Retrocompatível: sem `tenantId` (VM Dedicada / single-tenant), usa o comportamento atual.

---

## 4. Segurança & hardening (checklist completo)
**Rede**
- [ ] Firewall GCP: nenhuma porta pública; acesso só via Tailscale. Boot/HTTP/DICOM fechados ao mundo.
- [ ] Funnel só do **agente** (443/HTTPS). DICOM por porta na tailnet (não no Funnel).
- [ ] ACL Tailscale: `tag:pacs`; (opcional) restringir cada relé à porta do seu tenant.

**Isolamento / personificação**
- [ ] 1 container + 1 volume + 1 porta + 1 segredo **por tenant**; permissões de arquivo restritas (`0700`).
- [ ] Agente valida segredo do tenant e barra acesso cruzado (testes automatizados).
- [ ] Orthanc por tenant com nome/AET próprios.

**Robustez**
- [ ] Limites de CPU/RAM por container; `StorageCompression` ligado.
- [ ] **Disco de dados separado** do boot (hoje a VM tem só 1 disco) + snapshots diários + retenção.
- [ ] Monitoramento de saúde por tenant (reaproveita o *ping* de worklist) → status no admin.

**Dados / LGPD**
- [ ] Criptografia de disco (CMEK opcional); backup criptografado; retenção/expurgo por política.
- [ ] Trilha de acesso a imagens (reaproveita auditoria existente).

**Segredos**
- [ ] Segredo por tenant (não compartilhado); segredos GCP/Tailscale só server-side.
- [ ] Rotação: **girar a SA e a API key** que apareceram no chat; apagar o `.json` de Downloads.

---

## 5. Provisionamento
**Starter/Pro (novo — container na VM compartilhada):**
- `api/pacs-tenant.ts` (ou modo `shared` no provisionador): via SSH/agent-admin na VM, cria pasta + container + porta + segredo + registry, e devolve ao app: `agentUrl` (Funnel da VM compartilhada), `tenantId`, `secret`, `dicomPort`.
- **Todos os dados preenchidos automaticamente** nas settings do usuário (igual ao Dedicado).

**Dedicado (F2, pronto):** cria a VM própria e autoconfigura. Só falta `tag:pacs` na ACL + testar.

---

## 6. Refactor do módulo PACS/DICOM (app)
- **Tipos:** `dicomTenantId?: string`; `PacsInstance.provider` ganha `'shared'`; `plan` decide o caminho.
- **Cliente:** `syncExamToOrthancWorklist`, `deleteWorklistEntry`, `getProxyEndpoint`/`getDicomAuthParams` passam a enviar **`tenantId`** (corpo e `?tenantId=`).
- **MyPacsCard:** Starter/Pro → provisiona **tenant compartilhado**; Dedicado → **VM própria**. Mesma UX "1 clique → pronto".
- **Diagnóstico:** já cobre imagens+worklist; passa a testar com o `tenantId`.
- **Backup local:** mantém auto-forward (a VM/tenant espelha para o Orthanc local do cliente).
- **Compatibilidade:** instalações atuais (agente único) seguem funcionando (tenantId ausente = modo atual).

---

## 7. Fases de execução
| Fase | Entregável | Testável por mim? |
|---|---|---|
| **S1** | `agent.js` tenant-aware + registry + testes de isolamento | ✅ (unit) |
| **S2** | Script/endpoint que cria um tenant (container+porta+segredo) na `orthanc-server` | ⚠️ precisa SSH/execução na VM |
| **S3** | Refactor do app (tenantId no cliente + MyPacsCard por plano) | ✅ (mock) |
| **S4** | Hardening da VM (disco de dados, limites, backups, firewall, ACL) | ⚠️ na VM |
| **S5** | Dedicado: `tag:pacs` na ACL + teste real ponta a ponta | ⚠️ juntos |

---

## 8. Decisão-chave (preciso confirmar antes do refactor)
**Isolamento na VM compartilhada:** **container Orthanc por tenant** (recomendado — isolamento forte, o que planejamos) **ou** um Orthanc único namespaced por rótulo (mais simples, isolamento fraco — não recomendado para dados médicos)?

> Recomendo **container por tenant**. Confirmando, começo por **S1 (agente tenant-aware)** e **S3 (refactor do app)** — as partes que testo sozinho — enquanto preparamos a execução na VM (S2/S4) com você.

## 9. O que depende de você
- Acesso de execução na `orthanc-server` (SSH/gcloud) para S2/S4 — eu forneço os comandos/scripts.
- Adicionar `tag:pacs` na ACL (ou me autorizar via API).
- Confirmar a densidade/limites por plano e a política de backup/retenção.
