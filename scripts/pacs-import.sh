#!/usr/bin/env bash
#
# pacs-import.sh — Importa estudos existentes para o Orthanc de um TENANT.
# ------------------------------------------------------------------------------
# Cada tenant tem um Orthanc próprio (nasce vazio). Este script traz seus exames
# antigos para dentro do tenant. Dois modos:
#
#   LOCAL (imagens já no próprio orthanc-server, no Orthanc 'default'):
#     sudo TENANT=<id> SRC_DIR=/opt/orthanc-data /opt/pacs-import.sh
#
#   REMOTO via DICOMweb (imagens em OUTRO Orthanc — ex: o do seu Mac):
#     sudo TENANT=<id> \
#          SRC_ORTHANC=https://servidor-mac.tail861dda.ts.net:8443 \
#          SRC_USER=admin SRC_PASS=<senha> /opt/pacs-import.sh
# ------------------------------------------------------------------------------
set -euo pipefail
TENANTS_DIR="${TENANTS_DIR:-/opt/tenants}"
TENANT="${TENANT:?defina TENANT=<tenantId> (veja /opt/pacs-tenant.sh list)}"
[ "$(id -u)" -eq 0 ] || { echo "Rode como root (sudo)."; exit 1; }

DEST_DIR="$TENANTS_DIR/$TENANT/data"
[ -f "$TENANTS_DIR/$TENANT/tenant.json" ] || { echo "Tenant '$TENANT' não existe. Crie com: sudo /opt/pacs-tenant.sh create"; exit 1; }
HTTP_PORT="$(grep -oE '"httpPort"[: ]*[0-9]+' "$TENANTS_DIR/$TENANT/tenant.json" | grep -oE '[0-9]+')"

if [ -n "${SRC_DIR:-}" ]; then
  # ── LOCAL: copia a base do Orthanc (índice + arquivos) para o tenant ──
  [ -d "$SRC_DIR" ] || { echo "SRC_DIR '$SRC_DIR' não existe."; exit 1; }
  echo "▶ Importação LOCAL: $SRC_DIR → tenant $TENANT"
  echo "  Parando containers para cópia consistente..."
  docker stop "orthanc-$TENANT" >/dev/null 2>&1 || true
  docker stop orthanc >/dev/null 2>&1 || true
  echo "  Copiando base do Orthanc (pode demorar conforme o volume)..."
  mkdir -p "$DEST_DIR"
  # Copia o índice/arquivos do Orthanc; ignora a subpasta 'worklists'.
  ( cd "$SRC_DIR" && tar --exclude=worklists -cf - . ) | ( cd "$DEST_DIR" && tar -xf - )
  docker start "orthanc-$TENANT" >/dev/null 2>&1 || true
  echo "✔ Importado. Aguarde ~15s e confira no app (Diagnóstico + abrir um exame)."

elif [ -n "${SRC_ORTHANC:-}" ]; then
  # ── REMOTO: puxa todas as instâncias via DICOMweb e envia ao Orthanc do tenant ──
  command -v curl >/dev/null || { echo "curl necessário."; exit 1; }
  SRC_USER="${SRC_USER:-}"; SRC_PASS="${SRC_PASS:-}"
  AUTH=(); [ -n "$SRC_USER" ] && AUTH=(-u "$SRC_USER:$SRC_PASS")
  DST="http://127.0.0.1:${HTTP_PORT}"
  echo "▶ Importação REMOTA (DICOMweb): $SRC_ORTHANC → tenant $TENANT (:$HTTP_PORT)"
  IDS="$(curl -s "${AUTH[@]}" "$SRC_ORTHANC/instances")" || { echo "Falha ao listar instâncias na origem."; exit 1; }
  N=$(echo "$IDS" | grep -oE '[0-9a-f-]{36}' | wc -l | tr -d ' ')
  echo "  $N instâncias na origem. Transferindo..."
  i=0
  for id in $(echo "$IDS" | grep -oE '[0-9a-f-]{36}'); do
    curl -s "${AUTH[@]}" "$SRC_ORTHANC/instances/$id/file" -o /tmp/inst.dcm \
      && curl -s -X POST "$DST/instances" -H 'Content-Type: application/dicom' --data-binary @/tmp/inst.dcm >/dev/null \
      && i=$((i+1))
    [ $((i % 25)) -eq 0 ] && echo "  ...$i/$N"
  done
  rm -f /tmp/inst.dcm
  echo "✔ Transferidas $i/$N instâncias. Confira no app."

else
  echo "Defina SRC_DIR=/opt/orthanc-data (local) OU SRC_ORTHANC=<url> (remoto). Veja o topo do script."
  exit 1
fi
