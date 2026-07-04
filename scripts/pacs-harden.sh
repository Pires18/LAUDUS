#!/usr/bin/env bash
#
# pacs-harden.sh — Endurecimento (S4) da VM compartilhada (orthanc-server).
# ------------------------------------------------------------------------------
# Faz (idempotente, como root):
#   1. Monta um DISCO DE DADOS dedicado em /opt/tenants (dados sobrevivem à VM
#      e podem ser "snapshotados" à parte). Migra dados existentes.
#   2. Ajusta permissões restritas (0700) de /opt/tenants.
#   3. Limita o tamanho dos logs do Docker (evita encher o disco).
#   4. Imprime o checklist do que fazer no GCP (firewall, snapshots).
#
# USO:
#   sudo DATA_DISK=/dev/sdb ./pacs-harden.sh      # com disco de dados dedicado
#   sudo ./pacs-harden.sh                         # sem disco extra (só perms/logs)
# ------------------------------------------------------------------------------
set -euo pipefail

DATA_DIR="${DATA_DIR:-/opt/tenants}"
DATA_DISK="${DATA_DISK:-}"

log(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*" >&2; }
ok(){ printf '  \033[1;32m✓ %s\033[0m\n' "$*" >&2; }
warn(){ printf '  \033[1;33m! %s\033[0m\n' "$*" >&2; }
die(){ printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Rode como root: sudo ./pacs-harden.sh"

# 1) Disco de dados dedicado em /opt/tenants
if [ -n "$DATA_DISK" ]; then
  log "Disco de dados: $DATA_DISK → $DATA_DIR"
  [ -b "$DATA_DISK" ] || die "Dispositivo $DATA_DISK não existe."
  if ! blkid "$DATA_DISK" >/dev/null 2>&1; then
    warn "Disco sem filesystem — formatando ext4 (dados serão zerados NELE)."
    mkfs.ext4 -F "$DATA_DISK"
  else
    ok "Disco já tem filesystem — não será formatado."
  fi
  mkdir -p "$DATA_DIR"
  # Migra dados existentes (se /opt/tenants já tinha conteúdo em disco de boot)
  if mountpoint -q "$DATA_DIR"; then
    ok "$DATA_DIR já está montado."
  else
    if [ -n "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
      log "Migrando conteúdo existente de $DATA_DIR para o novo disco..."
      TMP="$(mktemp -d)"; mount "$DATA_DISK" "$TMP"; cp -a "$DATA_DIR/." "$TMP/"; umount "$TMP"; rmdir "$TMP"
    fi
    mount "$DATA_DISK" "$DATA_DIR"
  fi
  UUID="$(blkid -s UUID -o value "$DATA_DISK")"
  if ! grep -q "$UUID" /etc/fstab; then
    echo "UUID=$UUID $DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    ok "Entrada no /etc/fstab (montagem automática no boot)."
  fi
else
  warn "Sem DATA_DISK — /opt/tenants fica no disco de boot (menos ideal p/ snapshot)."
  mkdir -p "$DATA_DIR"
fi

# 2) Permissões restritas
chmod 700 "$DATA_DIR"
ok "Permissões de $DATA_DIR = 0700."

# 3) Limite de logs do Docker (json-file com rotação)
log "Limitando logs do Docker (10m x3)"
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl restart docker || warn "Reinicie o Docker manualmente para aplicar."
  ok "daemon.json criado."
else
  warn "daemon.json já existe — confira manualmente os log-opts."
fi

# 4) Checklist GCP (fora da VM)
cat >&2 <<'CHECK'

════════════ CHECKLIST GCP (rode no seu computador / Console) ════════════
  • Firewall: confirme que NÃO há regra pública para 8042/4242/3000/43xx.
      gcloud compute firewall-rules list --filter="direction=INGRESS"
    (o DICOM dos tenants é alcançado só via tailnet pelo relé.)

  • Snapshots automáticos do disco de dados (retenção 14 dias):
      gcloud compute resource-policies create snapshot-schedule pacs-daily \
        --region=southamerica-east1 --max-retention-days=14 \
        --daily-schedule --start-time=06:00
      gcloud compute disks add-resource-policies <DISCO-DADOS> \
        --resource-policies=pacs-daily --zone=southamerica-east1-c

  • Rotacione os segredos que apareceram no chat (SA do GCP + API key Tailscale).
══════════════════════════════════════════════════════════════════════════
CHECK
ok "Hardening da VM concluído."
