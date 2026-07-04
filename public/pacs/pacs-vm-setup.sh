#!/usr/bin/env bash
#
# pacs-vm-setup.sh — Turnkey da VM COMPARTILHADA (orthanc-server).
# ------------------------------------------------------------------------------
# Um comando faz TUDO (idempotente):
#   • baixa agent.js, generate_wl.py, pacs-tenant.sh, pacs-harden.sh do app
#   • garante Docker/Node/Python+pydicom
#   • configura o agente em modo MULTI-TENANT (systemd) + segredo admin
#   • (re)ativa o Tailscale Funnel do agente (porta 3000)
#   • roda o hardening (permissões, logs)
#   • imprime o que colar na Vercel e como criar o 1º tenant
#
# USO (na VM, como root):
#   curl -fsSL https://laudus.vercel.app/pacs/pacs-vm-setup.sh | sudo bash
#   # com disco de dados dedicado:
#   curl -fsSL .../pacs-vm-setup.sh | sudo DATA_DISK=/dev/sdb bash
#   # reaproveitando um segredo admin já definido na Vercel:
#   curl -fsSL .../pacs-vm-setup.sh | sudo ADMIN_SECRET=xxxx bash
# ------------------------------------------------------------------------------
set -euo pipefail

SCRIPTS_URL="${SCRIPTS_URL:-https://laudus.vercel.app/pacs}"
TS_NET="${TS_NET:-tail861dda.ts.net}"
AGENT_DIR=/opt/laudus-agent
# MODE=single → VM é o SEU PACS (single-tenant, preserva Orthanc/imagens).
# MODE=multi  → host compartilhado (1 container por cliente).
MODE="${MODE:-single}"
ADMIN_SECRET="${ADMIN_SECRET:-}"   # usado no modo multi
AGENT_SECRET="${AGENT_SECRET:-}"   # usado no modo single
DATA_DISK="${DATA_DISK:-}"

log(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok(){ printf '  \033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '  \033[1;33m! %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Rode como root (sudo)."

log "1/6 Baixando scripts do app ($SCRIPTS_URL)"
mkdir -p "$AGENT_DIR"
curl -fsSL "$SCRIPTS_URL/agent.js"        -o "$AGENT_DIR/agent.js"
curl -fsSL "$SCRIPTS_URL/generate_wl.py"  -o "$AGENT_DIR/generate_wl.py"
curl -fsSL "$SCRIPTS_URL/pacs-tenant.sh"  -o /opt/pacs-tenant.sh
curl -fsSL "$SCRIPTS_URL/pacs-harden.sh"  -o /opt/pacs-harden.sh
curl -fsSL "$SCRIPTS_URL/pacs-import.sh"  -o /opt/pacs-import.sh
chmod +x /opt/pacs-tenant.sh /opt/pacs-harden.sh /opt/pacs-import.sh
ok "Scripts atualizados."

log "2/6 Dependências (Docker / Node / Python / pydicom)"
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; }
command -v node   >/dev/null || { apt-get update -y && apt-get install -y nodejs npm; }
command -v python3 >/dev/null || { apt-get update -y && apt-get install -y python3 python3-pip; }
python3 -c 'import pydicom' 2>/dev/null || pip3 install --break-system-packages pydicom 2>/dev/null || pip3 install pydicom
ok "Dependências OK."

log "3/6 Segredos"
if [ "$MODE" = "multi" ]; then
  if [ -z "$ADMIN_SECRET" ]; then
    if [ -f /opt/laudus-admin-secret ]; then ADMIN_SECRET="$(cat /opt/laudus-admin-secret)"; ok "Reaproveitando segredo admin.";
    else ADMIN_SECRET="$(openssl rand -hex 24)"; echo "$ADMIN_SECRET" > /opt/laudus-admin-secret; chmod 600 /opt/laudus-admin-secret; ok "Novo segredo admin gerado."; fi
  fi
else
  if [ -z "$AGENT_SECRET" ]; then
    if [ -f /opt/laudus-agent-secret ]; then AGENT_SECRET="$(cat /opt/laudus-agent-secret)"; ok "Reaproveitando segredo do agente.";
    else AGENT_SECRET="$(openssl rand -hex 24)"; echo "$AGENT_SECRET" > /opt/laudus-agent-secret; chmod 600 /opt/laudus-agent-secret; ok "Novo segredo do agente gerado."; fi
  fi
fi

log "4/6 Serviço do agente (modo: $MODE)"
if [ "$MODE" = "multi" ]; then
  mkdir -p /opt/tenants
  cat > /etc/systemd/system/laudus-agent.service <<UNIT
[Unit]
Description=LAUD.US Agent (multi-tenant)
After=network-online.target docker.service
[Service]
Environment=PORT=3000
Environment=LAUDUS_TENANTS_DIR=/opt/tenants
Environment=LAUDUS_ADMIN_SECRET=${ADMIN_SECRET}
Environment=LAUDUS_TENANT_SCRIPT=/opt/pacs-tenant.sh
Environment=LAUDUS_TS_NET=${TS_NET}
ExecStart=$(command -v node) ${AGENT_DIR}/agent.js
WorkingDirectory=${AGENT_DIR}
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
else
  # SINGLE: preserva o Orthanc 'default' (suas imagens) e usa segredo único.
  mkdir -p /opt/orthanc-data/worklists
  cat > /etc/systemd/system/laudus-agent.service <<UNIT
[Unit]
Description=LAUD.US Agent (single-tenant)
After=network-online.target docker.service
[Service]
Environment=PORT=3000
Environment=LAUDUS_AGENT_SECRET=${AGENT_SECRET}
Environment=LAUDUS_WORKLIST_DIR=/opt/orthanc-data/worklists
Environment=LAUDUS_ALLOWED_HOSTS=localhost,127.0.0.1
ExecStart=$(command -v node) ${AGENT_DIR}/agent.js
WorkingDirectory=${AGENT_DIR}
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
  # Garante o Orthanc 'default' de pé (não perde imagens).
  if docker ps -a --format '{{.Names}}' | grep -qx orthanc; then docker start orthanc >/dev/null 2>&1 || true; ok "Orthanc 'default' em execução."; else warn "Container 'orthanc' não encontrado — se suas imagens estão em outro Orthanc, aponte o app para ele."; fi
fi
systemctl daemon-reload && systemctl enable --now laudus-agent && systemctl restart laudus-agent
sleep 1
systemctl is-active --quiet laudus-agent && ok "Agente ativo (modo $MODE)." || warn "Agente não subiu — veja: journalctl -u laudus-agent -n 30"

log "5/6 Tailscale Funnel (porta 3000) + hardening"
tailscale funnel --bg 3000 >/dev/null 2>&1 && ok "Funnel ativo." || warn "Funnel não ativou — confira HTTPS/MagicDNS na tailnet e rode: tailscale funnel --bg 3000"
[ "$MODE" = "multi" ] && { DATA_DISK="$DATA_DISK" /opt/pacs-harden.sh || warn "Hardening retornou aviso."; }

log "6/6 Pronto!"
IP="$(tailscale ip -4 2>/dev/null | head -1 || echo '<IP-TAILNET>')"
if [ "$MODE" = "multi" ]; then
cat <<FIM

════════════ COLE NA VERCEL (Environment Variables) ════════════
  PACS_SHARED_AGENT_URL = https://orthanc-server.${TS_NET}
  PACS_ADMIN_SECRET     = ${ADMIN_SECRET}
  (depois: Redeploy) · Criar tenant: sudo /opt/pacs-tenant.sh create
════════════════════════════════════════════════════════════════
FIM
else
cat <<FIM

════════ COLE NO APP (Configurações → PACS/DICOM → Servidores) ════════
  URL do Agente Local  = https://orthanc-server.${TS_NET}
  Segredo do Agente    = ${AGENT_SECRET}
  URL do Servidor PACS = http://localhost:8042
  AE Title (Orthanc)   = ORTHANC
  Pasta da Worklist    = /opt/orthanc-data/worklists
  Sincronização        = LIGADA   ·   tenantId = (VAZIO)
═══════════════════════════════════════════════════════════════════════
  Teste:  curl https://orthanc-server.${TS_NET}/   (deve dizer online)
  IP tailnet da VM (para o relé apontar o ultrassom): ${IP}
═══════════════════════════════════════════════════════════════════════
FIM
fi
