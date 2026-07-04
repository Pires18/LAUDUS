# 🚀 Plano — PACS individual por usuário: automação, self-service e simplificação

> **Data:** 04/07/2026 · **Complementa:** [`PROJETO_PACS_NUVEM.md`](./PROJETO_PACS_NUVEM.md) (arquitetura VM+Tailscale, já implementada nas Fases 1–4).
>
> **Objetivo desta fase:** transformar a montagem **manual** de VM em um sistema **automático e individual** — o usuário compra o add-on PACS, sua **VM dedicada nasce sozinha**, o app se **autoconfigura**, e ele faz apenas **ajustes pessoais simples** (apontar o ultrassom e, se quiser, ligar o backup local).

---

## 1. Análise do estado atual (o que já existe × o que ainda é manual)

| Camada | Estado | Onde |
|---|---|---|
| App fala com a VM (worklist + imagens) via Agente/Funnel | ✅ Pronto | `dicom.ts`, `db.ts`, `getWorklistEndpoint`, `getProxyEndpoint` |
| Segredo do Agente por usuário (criptografado) | ✅ Pronto | `dicomAgentSecret` (encrypt/decrypt em `db.ts`), header `x-agent-secret` + `?agentSecret` |
| Agente endurecido (anti-SSRF, pasta travada, secret) | ✅ Pronto | `agent.js`: `LAUDUS_ALLOWED_HOSTS`, `LAUDUS_WORKLIST_DIR`, `LAUDUS_AGENT_SECRET` |
| Proxy serverless na nuvem (auth Firebase + anti-SSRF) | ✅ Pronto | `api/orthanc-proxy.ts`, `api/worklist.ts` |
| Preset "Servidor na Nuvem (VM)" + backup local opcional | ✅ Pronto | `DicomControlCenter.tsx` (`applyServerPreset`) |
| Diagnóstico (imagens + worklist ping, princ.+backup) | ✅ Pronto | `handleTestPacsConnection` |
| Manual didático + guia da VM | ✅ Pronto | aba "Guias" |
| Bootstrap da VM (Docker+Orthanc+Agente+Tailscale+Funnel) | ⚠️ Semiautomático | `scripts/setup-vm.sh` (rodado **à mão** na VM) |
| **Criar a VM / autenticar Tailscale / Funnel / copiar URL+segredo p/ o app** | ❌ **Manual** | — |
| **Provisionamento automático por usuário (control plane)** | ❌ **Inexistente** | — |
| **Gestão da frota de VMs no Admin** | ❌ **Inexistente** | — |
| **Lifecycle (criar ao assinar / suspender ao cancelar)** | ❌ **Inexistente** | — |

**Conclusão:** a *tecnologia de dados* está pronta e segura. Falta a *camada de automação e produto* — hoje cada usuário exige um setup de sysadmin. A sua visão ("ajustes simples pessoais") depende de eliminar esse trabalho manual.

---

## 2. Visão-alvo — "comprou → PACS pronto → só ajustes pessoais"

```
Usuário compra add-on PACS
        │
        ▼
[Control Plane LAUD.US]  ── cria VM dedicada (GCP, região BR) a partir de IMAGEM PRONTA
        │                    injeta AGENT_SECRET + auth-key Tailscale (metadata)
        │                    VM sobe sozinha: Orthanc + Agente + Funnel
        ▼
[Firestore do usuário]  ← grava automaticamente: URL do Agente (Funnel) + Segredo (cripto)
        │
        ▼
Usuário abre "Meu PACS"  →  "✅ Pronto"  →  faz só:
   1) Conectar ultrassom (assistente mostra IP/porta/AE já preenchidos)
   2) (opcional) ligar Backup Local
```

**O que o usuário faz (o mínimo irredutível):**
1. **Relé + apontar o ultrassom** — 1 vez, no local (o aparelho é físico na clínica; ver §4.3). Único passo que não dá para automatizar remotamente.
2. **(Opcional) Backup local** — um toggle + assistente.

**O que deixa de existir para o usuário:** criar VM, SSH, Docker, `orthanc.json`, instalar Tailscale, gerar Funnel, copiar URL/segredo. Tudo automático.

---

## 3. Arquitetura de automação (Control Plane)

### 3.1 Componentes novos
- **Provisionador (backend):** função serverless protegida (admin/sistema) que orquestra a criação da VM. Opções:
  - **GCP Compute API** direto (recomendado p/ começar) — cria a instância a partir de uma **imagem dourada**.
  - **Terraform** (Cloud/CLI) para infra reprodutível quando a frota crescer.
- **Imagem dourada (golden image):** snapshot de uma VM já com Docker + Orthanc + Agente + Python/pydicom + Tailscale **pré-instalados**. Boot em ~30–60s (vs. minutos do `setup-vm.sh` a frio). O `setup-vm.sh` atual vira o **script que gera essa imagem** (build-time), não runtime.
- **Startup-script + metadata:** a VM recebe por *metadata* (injeção segura, sem entrar no código):
  - `AGENT_SECRET` (gerado único por usuário)
  - `TS_AUTHKEY` (chave de auth Tailscale efêmera/tagged — join sem login manual)
  - `USER_ID` (para nome/label/tag da VM)
  No boot: `tailscale up --authkey=… --hostname=pacs-<userid>` → `tailscale funnel --bg 3000` → systemd sobe Orthanc+Agente.
- **Autoconfiguração do app:** ao final do provisioning, o backend grava no Firestore do usuário:
  - `dicomLocalAgentUrl` = URL do Funnel da VM (obtida via Tailscale API)
  - `dicomAgentSecret` = `AGENT_SECRET` (criptografado, como já é hoje)
  - `dicomViewerUrl` = `http://localhost:8042`, `dicomOrthancAETitle` = `ORTHANC`, `dicomWorklistFolder` = `/opt/orthanc-data/worklists`, `dicomSyncEnabled` = true
  → o usuário abre o painel **já configurado**.

### 3.2 Automação do Tailscale (sem login manual)
- **Auth keys** geradas via **Tailscale API** (pré-autorizadas, *ephemeral* + *tag* `tag:pacs`) → a VM entra na tailnet sozinha.
- **ACLs por tag** (`tag:pacs`) isolam as VMs entre si e liberam só o necessário.
- **Funnel/HTTPS**: habilitar *MagicDNS + HTTPS certs* na tailnet **1 vez** (config da conta). Depois cada VM roda `tailscale funnel` no boot.
- A **URL do Funnel** é lida via `tailscale funnel status` (na VM, devolvida ao provisionador) ou via **Tailscale API** (device → DNS name).

### 3.3 Lifecycle
| Evento | Ação |
|---|---|
| Assinou add-on PACS | Provisiona VM + grava settings. Status `provisioning → ready`. |
| Cancelou / inadimplente | `suspend` (para a VM, mantém disco 30d) → depois `destroy` (com export/backup). |
| Reativou | `start` a VM (disco preservado) ou reprovisiona. |
| Upgrade de armazenamento | Redimensiona o disco de dados. |

### 3.4 Isolamento e região
- **1 VM por usuário** = isolamento forte de dados (excelente p/ LGPD). Região **`southamerica-east1`** (São Paulo).
- Sem portas públicas na VM (só Tailscale). Disco de dados criptografado (CMEK opcional).

---

## 4. Simplificação radical da UX (o coração do "ajustes simples")

### 4.1 Novo card "Meu PACS na Nuvem" (aba Servidores)
Substitui os campos técnicos por um **estado vivo**:
- **Provisionando…** (barra de progresso, ~1–3 min) → **✅ Pronto** (com "última sincronização", versão do Orthanc, uso de disco).
- Botões: **Testar**, **Reprovisionar**, **Aumentar armazenamento**, **Ver detalhes técnicos** (colapsado — URL/segredo ficam **read-only**, só para suporte).
- Os campos avançados (URL do Agente, Segredo, pasta) passam a ser **preenchidos e travados** pelo provisionador; o usuário não digita nada.

### 4.2 Assistente "Conectar meu ultrassom" (device info)
- Detecta/mostra os valores prontos para digitar no aparelho: **IP do relé / porta 4242 / AE `ORTHANC`** — com botão *copiar*.
- Cadastro de **múltiplos aparelhos** (`dicomDevices` já existe no tipo): nome, AE Title local, modalidade (US). Cada exame pode escolher o aparelho.
- Botão **"Testar aparelho"** = dispara um C-ECHO / C-FIND simulado pela VM e confirma.

### 4.3 Assistente do Relé (o único passo local)
O ultrassom é físico; algo na LAN precisa levá-lo até a VM. Assistente com 2 caminhos (já documentados):
- **A1 — Roteador GL.iNet c/ Tailscale** (recomendado): aprovar rota; apontar US ao IP tailnet da VM.
- **A2 — PC do dia a dia** (`netsh portproxy`/`socat`): comandos gerados prontos p/ copiar.
- **Teste do relé** no fim (C-ECHO verde).

### 4.4 Backup local (opcional, simples)
- Toggle **"Ativar redundância local"** → assistente curto: instalar Orthanc local (installer + `orthanc.json` pronto) e preencher 2 campos. O espelhamento já existe no app (servidor de backup).
- Alternativa "zero-config": a **própria VM** faz *auto-forward* dos estudos para o Orthanc local quando online (peer DICOM), sem o app orquestrar.

---

## 5. Painel Admin — gestão da frota de VMs (novo submódulo)
- **Lista de VMs por usuário:** status (ready/suspended/error), região, uso de disco, última sincronização, custo estimado.
- **Ações:** provisionar, reiniciar, suspender, destruir (com confirmação), redimensionar disco, reemitir segredo.
- **Alertas:** VM offline, disco > 80%, Funnel caído, backup desatualizado.
- **Auditoria:** toda ação de VM em `audit_logs` (já existe a infraestrutura de auditoria).

---

## 6. Segurança / LGPD / isolamento
- **Isolamento por VM** = dados de cada clínica fisicamente separados (forte p/ LGPD).
- **Segredos:** `AGENT_SECRET` único/usuário (cripto no Firestore); `TS_AUTHKEY` efêmera; credenciais GCP e Tailscale **só no backend** (Vercel env / secret manager) — nunca no cliente.
- **Rede:** VM sem porta pública; acesso só via Tailscale; agente com anti-SSRF (`ALLOWED_HOSTS`) e pasta travada (`WORKLIST_DIR`).
- **Dados:** disco criptografado; backups criptografados; retenção/expurgo conforme política LGPD (Fase 2 da auditoria global).
- **Trilha:** provisionamento e acesso a imagens auditados.

---

## 7. Custos e escala
- **1 VM/usuário:** e2-small ≈ **US$ 13–18/mês** + disco (~US$ 0,17/GB/mês). Simples e isolado.
- **Gatilho de reavaliação:** quando a frota tornar o custo por-VM relevante, migrar para **multi-tenant** (containers Orthanc isolados por tenant em VMs compartilhadas, um agente por tenant). Mantém isolamento lógico com melhor densidade. Decisão de produto — não bloqueia o começo.
- **Controles:** desligar VM ociosa fora do horário (agendamento), alertas de custo, cotas de disco por plano.

---

## 8. Operação (Ops) — o que a automação exige do negócio
- **Backups** automáticos do disco de dados (snapshots diários + retenção) e **restauração testada**.
- **Monitoramento**: health da VM/Orthanc/Funnel (ping periódico → status no admin e no card do usuário). Reaproveita o **ping de worklist** já criado.
- **Atualizações**: recriar VMs a partir de nova imagem dourada (blue/green) sem perder dados (disco de dados separado do disco de boot).
- **DR**: procedimento de recuperação (recriar VM + reanexar disco).
- **Pré-requisitos de negócio:** projeto GCP com billing, **service account** com permissão de Compute, **Tailscale API key**, cofre de segredos.

---

## 9. Plano faseado

| Fase | Entregável | Esforço | Depende de |
|---|---|---|---|
| **F1 — Imagem dourada** | Transformar `setup-vm.sh` em builder de imagem; snapshot boot-rápido; parametrização 100% por *metadata* (secret, authkey) | 1–2 dias | conta GCP |
| **F2 — Provisionador** | Função backend (admin) que cria a VM da imagem, injeta metadata, lê o Funnel e **grava as settings do usuário** | 2–4 dias | F1, Tailscale API |
| **F3 — UX "Meu PACS"** | Card de status vivo (provisionando→pronto), campos infra read-only, botões (testar/reprovisionar) | 2–3 dias | F2 |
| **F4 — Assistentes** | "Conectar ultrassom" (device wizard + teste) e "Relé" (GL.iNet/PC) e "Backup local" | 2–3 dias | F3 |
| **F5 — Admin frota** | Submódulo admin: lista/ações/alertas/auditoria de VMs | 2–3 dias | F2 |
| **F6 — Lifecycle + Ops** | Provisionar ao assinar / suspender ao cancelar (hook billing), backups, monitoramento, atualização blue/green | 3–5 dias | F2, F5 |

**MVP recomendado:** F1 + F2 + F3 → "compra → VM pronta → app autoconfigurado", com o relé/aparelho ainda por assistente manual (F4 logo em seguida).

---

## 10. Decisões — TRAVADAS (04/07/2026)
1. ✅ **Gatilho:** provisionamento **automático ao comprar o add-on PACS** (hook no billing → cria VM → autoconfigura o app).
2. ✅ **Motor:** **GCP Compute API direto** (função backend + imagem dourada). Terraform fica para reavaliação futura em escala.
3. ✅ **Backup local:** **auto-forward pela própria VM** (peer DICOM, zero-config no app). O toggle de backup no app deixa de ser o caminho principal.
4. ✅ **Modelo:** **1 VM por usuário** agora; multi-tenant reavaliado ao escalar.
5. **Onde roda o provisionador:** função serverless na Vercel com **service account GCP** nas env vars (a confirmar na F2, mas é o default).

### Pré-requisitos de infra que dependem de você (para a F2 rodar de verdade)
- Projeto **GCP com billing** ativo + **service account** com papel de Compute Admin (JSON nas env da Vercel).
- **Imagem dourada** publicada no projeto (saída da F1).
- **Tailscale API key** + **auth keys** com tag `tag:pacs`; HTTPS/MagicDNS habilitados na tailnet.
- Hook do **billing** (AbacatePay) que dispara o provisionamento ao ativar o add-on PACS.

---

## 11. Divisão de trabalho
- **Eu (código):** builder da imagem, função provisionadora, autoconfiguração das settings, card "Meu PACS", assistentes, submódulo admin, hooks de lifecycle.
- **Você (infra/negócio):** projeto GCP + billing, service account, Tailscale API key + habilitar HTTPS/Funnel na tailnet, executar o relé/aparelho no local (acesso físico), decidir custos/planos.

> **Próximo passo sugerido:** responder as decisões da §10 e eu começo pela **F1 (imagem dourada) + F2 (provisionador)** — o MVP que entrega "comprou → PACS pronto".
