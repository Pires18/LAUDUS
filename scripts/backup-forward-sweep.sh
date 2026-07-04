#!/usr/bin/env bash
# ============================================================================
# backup-forward-sweep.sh — Reenvio periódico do BACKUP local → VM (principal)
# ============================================================================
# Complementa o backup-forward.lua: o Lua encaminha cada exame NA HORA em que
# ele chega. Este sweep cobre o caso em que a VM esteve OFFLINE quando o exame
# chegou — ele varre os estudos que sobraram no backup e tenta enviar de novo,
# apagando os que a VM aceitar. Rode via cron (ex.: a cada 10 minutos).
#
# Uso:
#   ./backup-forward-sweep.sh
#   ORTHANC=http://localhost:8042 ./backup-forward-sweep.sh   # customiza a URL
#
# Cron (a cada 10 min):
#   */10 * * * * ORTHANC=http://localhost:8042 /caminho/backup-forward-sweep.sh >> /var/log/backup-forward.log 2>&1
#
# Requisitos: curl e jq instalados; a modality CLOUD definida no orthanc.json
# do backup apontando para o IP tailnet da VM (porta 4242).
# ============================================================================
set -euo pipefail

ORTHANC="${ORTHANC:-http://localhost:8042}"
CLOUD_MODALITY="${CLOUD_MODALITY:-CLOUD}"

# Auth opcional do Orthanc (se AuthenticationEnabled=true no backup).
CURL_AUTH=()
if [ -n "${ORTHANC_USER:-}" ]; then
  CURL_AUTH=(-u "${ORTHANC_USER}:${ORTHANC_PASSWORD:-}")
fi

studies="$(curl -fsS "${CURL_AUTH[@]}" "$ORTHANC/studies" | jq -r '.[]' 2>/dev/null || true)"
if [ -z "$studies" ]; then
  echo "[sweep] Backup vazio — nada a reenviar."
  exit 0
fi

sent=0; kept=0
for id in $studies; do
  if curl -fsS "${CURL_AUTH[@]}" -X POST "$ORTHANC/modalities/$CLOUD_MODALITY/store" \
       -H 'Content-Type: application/json' \
       -d "{\"Resources\":[\"$id\"],\"Synchronous\":true}" >/dev/null 2>&1; then
    curl -fsS "${CURL_AUTH[@]}" -X DELETE "$ORTHANC/studies/$id" >/dev/null 2>&1 || true
    echo "[sweep] enviado+removido: $id"
    sent=$((sent+1))
  else
    echo "[sweep] VM indisponivel, mantido no backup: $id"
    kept=$((kept+1))
  fi
done
echo "[sweep] Concluido. Enviados: $sent · Mantidos: $kept."
