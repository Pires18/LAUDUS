#!/usr/bin/env bash
#
# setup-vm.sh — Bootstrap de uma VM PACS LAUD.US (Debian/Ubuntu no Google Cloud)
# ------------------------------------------------------------------------------
# ⚠️  LEGADO / SINGLE-TENANT (VM dedicada). A produção multi-tenant usa
#     `pacs-vm-setup.sh` (turnkey da VM COMPARTILHADA) + `pacs-tenant.sh`.
#     Mantido como referência do caminho da VM dedicada e do builder da imagem
#     dourada. Não usar para a VM compartilhada.
# ------------------------------------------------------------------------------
# Automatiza as Fases ③–⑥ do docs/archive/PROJETO_PACS_NUVEM.md:
#   ③ Docker + Tailscale
#   ④ Orthanc (Docker) com Worklist + DICOMweb
#   ⑤ Agente LAUD.US (Node) como serviço systemd + Python/pydicom
#   ⑥ Tailscale Funnel do agente (porta 3000)
#
# Também monta (opcionalmente) o disco de imagens em /opt/orthanc-data.
#
# É IDEMPOTENTE: pode rodar de novo com segurança; pula o que já está feito.
#
# ------------------------------------------------------------------------------
# COMO USAR (na própria VM, após copiar agent.js e generate_wl.py):
#
#   1) Copie os scripts do seu Mac para a VM:
#        gcloud compute scp scripts/agent.js scripts/generate_wl.py \
#          scripts/setup-vm.sh orthanc-server:~ --zone=southamerica-east1-c
#
#   2) Conecte na VM e rode:
#        gcloud compute ssh orthanc-server --zone=southamerica-east1-c
#        chmod +x ~/setup-vm.sh
#        sudo ~/setup-vm.sh
#
#   O script pergunta o que precisa (disco, segredo) ou aceita via env:
#        DATA_DISK=/dev/sdb AGENT_SECRET=$(openssl rand -hex 32) sudo -E ~/setup-vm.sh
#
# ------------------------------------------------------------------------------
set -euo pipefail

# ---- Config (pode sobrescrever via env) --------------------------------------
DATA_DIR="${DATA_DIR:-/opt/orthanc-data}"       # disco/pasta das imagens + worklists
DATA_DISK="${DATA_DISK:-}"                       # ex: /dev/sdb — vazio = usa disco da VM
AGENT_DIR="${AGENT_DIR:-/opt/laudus-agent}"      # onde ficam agent.js/generate_wl.py
ORTHANC_DIR="${ORTHANC_DIR:-/opt/orthanc}"       # onde fica o docker-compose/orthanc.json
AGENT_PORT="${AGENT_PORT:-3000}"
AGENT_SECRET="${AGENT_SECRET:-}"                 # hex do segredo; vazio = gera um
SCRIPT_SRC="${SCRIPT_SRC:-$HOME}"                # onde estão agent.js/generate_wl.py copiados

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '  \033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como root: sudo ~/setup-vm.sh"

# Usuário real (para o grupo docker), mesmo sob sudo
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"

# ------------------------------------------------------------------------------
log "① Pré-requisitos e localização dos scripts"
# Descobre agent.js / generate_wl.py (procura em SCRIPT_SRC e /home/*)
find_script() {
  local name="$1" p
  for p in "$SCRIPT_SRC/$name" "/home/$REAL_USER/$name" "$AGENT_DIR/$name"; do
    [ -f "$p" ] && { echo "$p"; return 0; }
  done
  return 1
}
AGENT_JS="$(find_script agent.js || true)"
GEN_WL="$(find_script generate_wl.py || true)"
[ -n "$AGENT_JS" ] || die "agent.js não encontrado. Copie-o para ~ antes (veja cabeçalho)."
[ -n "$GEN_WL" ]   || warn "generate_wl.py não encontrado — worklist falhará até copiá-lo."
ok "agent.js: $AGENT_JS"

apt-get update -qq
apt-get install -y -qq curl jq ca-certificates >/dev/null
ok "utilitários base instalados"

# ------------------------------------------------------------------------------
log "② Disco de dados em $DATA_DIR"
mkdir -p "$DATA_DIR/db" "$DATA_DIR/worklists"
if [ -n "$DATA_DISK" ]; then
  if ! blkid "$DATA_DISK" >/dev/null 2>&1; then
    warn "Formatando $DATA_DISK como ext4 (primeira vez)…"
    mkfs.ext4 -F "$DATA_DISK"
  fi
  if ! grep -q "$DATA_DIR" /etc/fstab; then
    echo "$DATA_DISK $DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
  fi
  mount -a
  mkdir -p "$DATA_DIR/db" "$DATA_DIR/worklists"
  ok "disco $DATA_DISK montado em $DATA_DIR"
else
  warn "Sem DATA_DISK — usando disco da própria VM (ok para POC)."
fi

# ------------------------------------------------------------------------------
log "③ Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$REAL_USER" || true
systemctl enable --now docker
ok "docker pronto (usuário $REAL_USER no grupo docker)"

log "③ Tailscale"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
if ! tailscale status >/dev/null 2>&1; then
  warn "Tailscale ainda não autenticado."
  warn "Rode MANUALMENTE:  sudo tailscale up   e autentique no navegador."
  warn "Depois rode este script de novo (ele continua daqui)."
else
  ok "Tailscale autenticado — IP tailnet: $(tailscale ip -4 2>/dev/null | head -1)"
fi

# ------------------------------------------------------------------------------
log "④ Orthanc (Docker + Worklist + DICOMweb)"
mkdir -p "$ORTHANC_DIR"
cat > "$ORTHANC_DIR/orthanc.json" <<'JSON'
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
JSON

cat > "$ORTHANC_DIR/docker-compose.yml" <<YAML
services:
  orthanc:
    image: orthancteam/orthanc:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8042:8042"   # HTTP só localhost (o agente acessa)
      - "0.0.0.0:4242:4242"     # DICOM (Tailscale/relé alcança)
    volumes:
      - $DATA_DIR/db:/var/lib/orthanc/db
      - $ORTHANC_DIR/orthanc.json:/etc/orthanc/orthanc.json:ro
      - $DATA_DIR/worklists:/var/lib/orthanc/worklists
YAML

( cd "$ORTHANC_DIR" && docker compose up -d )
# aguarda o Orthanc responder
for i in $(seq 1 30); do
  if curl -fs http://localhost:8042/system >/dev/null 2>&1; then break; fi
  sleep 2
done
if curl -fs http://localhost:8042/system >/dev/null 2>&1; then
  ok "Orthanc no ar: $(curl -s http://localhost:8042/system | jq -r '.Name + " v" + .Version')"
else
  warn "Orthanc ainda não respondeu em :8042 — veja: docker compose -f $ORTHANC_DIR/docker-compose.yml logs"
fi

# ------------------------------------------------------------------------------
log "⑤ Agente LAUD.US (Node + Python/pydicom) via systemd"
# Node LTS
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node --version)"

# Python + pydicom
apt-get install -y -qq python3 python3-pip >/dev/null
python3 -c 'import pydicom' 2>/dev/null || pip3 install --break-system-packages -q pydicom
ok "python3 + pydicom prontos"

# Instala scripts
mkdir -p "$AGENT_DIR"
cp -f "$AGENT_JS" "$AGENT_DIR/agent.js"
[ -n "$GEN_WL" ] && cp -f "$GEN_WL" "$AGENT_DIR/generate_wl.py"

# Segredo
if [ -z "$AGENT_SECRET" ]; then
  AGENT_SECRET="$(openssl rand -hex 32)"
  warn "AGENT_SECRET gerado automaticamente (anote — vai no app também)."
fi

NODE_BIN="$(command -v node)"
cat > /etc/systemd/system/laudus-agent.service <<UNIT
[Unit]
Description=LAUD.US Local Agent
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=$AGENT_DIR
ExecStart=$NODE_BIN $AGENT_DIR/agent.js
Restart=always
Environment=PORT=$AGENT_PORT
Environment=LAUDUS_AGENT_SECRET=$AGENT_SECRET
Environment=LAUDUS_WORKLIST_DIR=$DATA_DIR/worklists
Environment=LAUDUS_ALLOWED_HOSTS=localhost,127.0.0.1

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now laudus-agent
sleep 2
systemctl is-active --quiet laudus-agent \
  && ok "laudus-agent ativo na porta $AGENT_PORT" \
  || warn "laudus-agent não subiu — veja: journalctl -u laudus-agent -n 50"

# ------------------------------------------------------------------------------
log "⑥ Tailscale Funnel do agente (porta $AGENT_PORT)"
FUNNEL_URL=""
if tailscale status >/dev/null 2>&1; then
  tailscale funnel --bg "$AGENT_PORT" >/dev/null 2>&1 || true
  sleep 2
  FUNNEL_URL="$(tailscale funnel status 2>/dev/null | grep -oE 'https://[^ ]+' | head -1 || true)"
  [ -n "$FUNNEL_URL" ] && ok "Funnel: $FUNNEL_URL" \
    || warn "Funnel não retornou URL — confira MagicDNS+HTTPS na tailnet e rode: tailscale funnel --bg $AGENT_PORT"
else
  warn "Tailscale não autenticado — pulei o Funnel. Após 'tailscale up', rode: tailscale funnel --bg $AGENT_PORT"
fi

# ------------------------------------------------------------------------------
TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || echo '(rode: tailscale ip -4)')"
cat <<RESUMO

═══════════════════════════════════════════════════════════════════════
  ✅ SETUP CONCLUÍDO — anote estes valores para configurar o LAUD.US
═══════════════════════════════════════════════════════════════════════
  IP tailnet da VM (US/relé)   : $TS_IP        (porta 4242, AE ORTHANC)
  URL Funnel (URL do Agente)   : ${FUNNEL_URL:-<gere com: tailscale funnel --bg $AGENT_PORT>}
  URL do Orthanc (no app)      : http://localhost:8042
  Pasta da Worklist (no app)   : $DATA_DIR/worklists
  Segredo do Agente (no app)   : $AGENT_SECRET
  AE Title                     : ORTHANC
───────────────────────────────────────────────────────────────────────
  No LAUD.US → Configurações → PACS/DICOM → preset "Servidor na Nuvem (VM)"
  e cole os valores acima. Depois clique "Testar Conexão".
═══════════════════════════════════════════════════════════════════════
RESUMO
