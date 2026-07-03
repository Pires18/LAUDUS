# 🏗️ Projeto — PACS/DICOM unificado em VM na nuvem (Google Cloud + Tailscale)

**Decisões aprovadas (03/07/2026):**
- **Conectividade do US:** Opção A — **relé local Tailscale** (caixinha leve na clínica).
- **Modelo:** **1 VM por usuário** (isolado).

> Objetivo: mover Orthanc + Worklist + Agente + dados para uma **VM por usuário** no Google Cloud, acessada via **Tailscale**, mantendo na clínica apenas um **relé** minúsculo (sem Orthanc, sem dados). Migrar os exames atuais e desativar os Orthanc locais.

---

## 1. Topologia final

```
CLÍNICA                                   GOOGLE CLOUD — VM do usuário
┌────────────────────────┐               ┌─────────────────────────────────┐
│ Ultrassom              │               │ Debian + Tailscale              │
│   │ DICOM :4242 (LAN)  │   Tailscale   │  • Orthanc (Docker)             │
│   ▼                    │ ═══cripto════▶│      :8042 HTTP  :4242 DICOM     │
│ RELÉ (Raspberry/PC)    │               │  • Agente LAUD.US :3000          │
│   socat / subnet router│               │  • Disco persistente (imagens)  │
└────────────────────────┘               │  • Tailscale Funnel (HTTPS)     │
                                          └──────────────┬──────────────────┘
     LAUD.US (Vercel) ── HTTPS via Funnel ──────────────┘
```

**Regras de ouro:**
- O **US** só fala com o **relé** (IP local, porta 4242). O relé encaminha ao Orthanc da VM via Tailscale.
- O **LAUD.US** fala com o **Agente** da VM via **Funnel** (worklist + imagens). Igual a hoje, só muda a URL.
- **Nada de dados nem Orthanc na clínica.**

---

## 2. FASE 1 — Montar a VM padrão (POC na VM que você já criou)

### 2.1 Preparar a VM
- Região **`southamerica-east1`** (São Paulo, menor latência).
- Tipo sugerido: **e2-small** (2 vCPU/2GB) — sobe depois se precisar.
- **Disco persistente adicional** para as imagens (ex: 100GB, expansível) montado em `/opt/orthanc-data`.
- Firewall GCP: **sem portas públicas** (o acesso é só via Tailscale). Bloquear 8042/4242/3000 do mundo.

### 2.2 Instalar Docker + Tailscale
```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # relogar

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up               # autentica na sua conta
tailscale ip -4                 # anote o IP 100.x.y.z da VM
```

### 2.3 Orthanc via Docker (com Worklist + DICOMweb)
`/opt/orthanc/docker-compose.yml`:
```yaml
services:
  orthanc:
    image: orthancteam/orthanc:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8042:8042"   # HTTP só localhost (agente acessa)
      - "0.0.0.0:4242:4242"     # DICOM (Tailscale/relé alcança)
    volumes:
      - /opt/orthanc-data:/var/lib/orthanc/db
      - /opt/orthanc/orthanc.json:/etc/orthanc/orthanc.json:ro
      - /opt/orthanc-data/worklists:/var/lib/orthanc/worklists
```
`/opt/orthanc/orthanc.json` (prático, sem senha; auth real fica no Tailscale):
```jsonc
{
  "Name": "PACS LAUDUS CLOUD",
  "StorageDirectory": "/var/lib/orthanc/db",
  "IndexDirectory": "/var/lib/orthanc/db",
  "HttpPort": 8042, "HttpServerEnabled": true,
  "DicomServerEnabled": true, "DicomPort": 4242, "DicomAet": "ORTHANC",
  "AuthenticationEnabled": false, "RemoteAccessAllowed": true,
  "DicomAlwaysAllowEcho": true, "DicomAlwaysAllowStore": true, "DicomAlwaysAllowFind": true,
  "Worklists": { "Enable": true, "Database": "/var/lib/orthanc/worklists" },
  "DicomWeb": { "Enable": true }
}
```
```bash
cd /opt/orthanc && docker compose up -d
```

### 2.4 Agente LAUD.US na VM (gera worklist + proxy)
- Copiar `scripts/agent.js` + `scripts/generate_wl.py` para a VM; instalar Node + `pip install pydicom`.
- Rodar como serviço **systemd** com as variáveis:
  - `LAUDUS_AGENT_SECRET=<segredo forte>`  (o mesmo vai nas settings do usuário no app)
  - `LAUDUS_WORKLIST_DIR=/opt/orthanc-data/worklists`  (a MESMA pasta do Orthanc)
  - `LAUDUS_ALLOWED_HOSTS=localhost,127.0.0.1`  (anti-SSRF — só o Orthanc da própria VM)
- Expor **só o agente** via Funnel:
```bash
tailscale funnel --bg 3000     # devolve https://<vm>.<tailnet>.ts.net
```

### 2.5 Configurar no LAUD.US
No app (Configurações → PACS/DICOM):
- **URL do Agente Local** = a URL Funnel da VM.
- **URL do Orthanc** = `http://localhost:8042` (o agente resolve na própria VM).
- **Segredo do Agente** = o `LAUDUS_AGENT_SECRET`.
- **Pasta da Worklist** = `/opt/orthanc-data/worklists`.
- Testar Conexão → deve mostrar a versão do Orthanc. ✅ POC concluída (worklist + imagens pela nuvem).

---

## 3. FASE 2 — Relé na clínica (US → nuvem)

Em um dispositivo sempre-ligado na clínica (Raspberry Pi ~R$300, mini-PC, ou um PC já existente):

**Opção recomendada — relé TCP com `socat`** (simples, transparente para DICOM):
```bash
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up
sudo apt install -y socat
# encaminha o 4242 local para o Orthanc da VM (IP tailnet da VM):
socat TCP-LISTEN:4242,fork,reuseaddr TCP:<VM-TAILSCALE-IP>:4242
# (rodar como serviço systemd para subir sozinho)
```
- No **ultrassom**: apontar Worklist e Storage para o **IP local do relé**, porta **4242**, AE **ORTHANC**.
- Alternativa ao socat: **Tailscale subnet router** no relé (`--advertise-routes`) — mais poderoso, um pouco mais de config.

**Validação:** C-ECHO no US → sucesso; criar exame no LAUD.US → worklist aparece no US; fazer exame → imagens sobem à VM e aparecem no laudo.

---

## 4. FASE 3 — Migração dos exames atuais (local → nuvem)

Para **cada** Orthanc local, com o Orthanc da nuvem já no ar:

**Método recomendado — DICOMweb/REST em lote** (script):
```bash
# No Orthanc local: enviar todos os estudos para a VM (peer).
# 1) Cadastrar a VM como "peer" no Orthanc local (Orthanc → Settings → Peers)
#    ou usar C-STORE direto para o IP tailnet da VM:4242.
# 2) Disparar o envio de todos os estudos:
for id in $(curl -s http://localhost:8042/studies | jq -r '.[]'); do
  curl -s -X POST http://localhost:8042/modalities/CLOUD/store -d "$id"
done
```
(ou usar a UI do Orthanc "Send to DICOM modality/peer" selecionando tudo)

**Conferência (obrigatória antes de desativar):**
```bash
# comparar contagens origem vs destino
curl -s http://LOCAL:8042/statistics   | jq '.CountStudies,.CountInstances'
curl -s http://VM-TAILSCALE:8042/statistics | jq '.CountStudies,.CountInstances'
```
Só prossiga quando os números baterem.

---

## 5. FASE 4 — Desativar servidores locais
- Confirmado worklist + imagens + histórico migrado → **desligar o Orthanc local**.
- Manter apenas o **relé** (Opção A). Guardar backup do Orthanc local em standby por **30 dias** antes de apagar.

---

## 6. FASE 5 — Automação por usuário + Manual
- **Provisionamento:** script (bash) ou **Terraform** que cria a VM padrão (Orthanc + agente + Tailscale + Funnel) e devolve a URL Funnel + o segredo — para cada novo usuário.
- **Imagem base (snapshot)** da VM configurada, para clonar rápido.
- **Manual único** (in-app na aba Guias + `.md`): criar VM → subir Orthanc/agente/Tailscale → instalar relé → apontar US → migrar → desativar local.

---

## 7. Ajustes de código no LAUD.US (pequenos)
O app já suporta "agente via Tailscale". Necessário:
- **Nenhuma mudança estrutural** — é configuração (URL Funnel da VM + segredo).
- **Opcional:** um preset "Servidor na Nuvem (VM)" no painel DICOM que já preenche `URL Orthanc = localhost:8042` e explica os campos.
- **Guia PACS:** adicionar a seção "Servidor na Nuvem (VM + Tailscale)" ao lado da atual "Local/Funnel".

---

## 8. Custos (1 VM/usuário)
- VM e2-small ≈ **US$ 13–18/mês** + disco (≈ US$ 0,17/GB/mês). Cresce por usuário.
- Relé: ~R$300 único (ou zero se usar PC existente).
- Reavaliar **Orthanc multi-tenant** quando o nº de usuários tornar o custo por-VM relevante.

---

## 9. Riscos & mitigações
| Risco | Mitigação |
|---|---|
| US não alcança a VM | Relé Tailscale (núcleo do projeto) |
| Perda de dados na migração | Migrar antes de desativar; conferir contagens; standby 30d |
| Latência de imagem | Região BR; imagens via Funnel; disco SSD |
| Custo ao escalar | Começar 1 VM/usuário; multi-tenant no futuro |
| Segurança da VM | Sem portas públicas; Tailscale; agente com segredo; anti-SSRF |

---

## 10. Cronograma sugerido
1. **Fase 1** (VM POC): meio dia.
2. **Fase 2** (relé + US): meio dia (depende de acesso ao aparelho).
3. **Fase 3** (migração): variável (volume de imagens).
4. **Fase 4** (desativar): rápido, após conferência.
5. **Fase 5** (automação + manual): 1–2 dias.

> **Meu papel:** forneço todos os comandos/config/scripts e o manual, e faço os ajustes de código no LAUD.US. **Seu papel:** executar os comandos na VM/relé (não tenho acesso SSH à sua VM) e testar com o aparelho.
