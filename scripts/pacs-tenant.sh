#!/usr/bin/env bash
#
# pacs-tenant.sh — Provisiona/remove um TENANT na VM compartilhada (orthanc-server).
# ------------------------------------------------------------------------------
# Cada tenant = 1 container Orthanc isolado (volume + porta DICOM + segredo),
# registrado em ${TENANTS_DIR}/<id>/tenant.json para o agente tenant-aware.
#
# USO (como root, na VM compartilhada):
#   sudo ./pacs-tenant.sh create [tenantId] [plan]     # cria (id/plan opcionais)
#   sudo ./pacs-tenant.sh remove <tenantId>            # remove container + dados
#   sudo ./pacs-tenant.sh list                         # lista tenants
#
# Env:
#   TENANTS_DIR   (default /opt/tenants)   — a MESMA de LAUDUS_TENANTS_DIR do agente
#   ORTHANC_IMAGE (default orthancteam/orthanc:latest)
#   TS_NET        (default tail861dda.ts.net) — para imprimir a agentUrl
# ------------------------------------------------------------------------------
set -euo pipefail

TENANTS_DIR="${TENANTS_DIR:-/opt/tenants}"
ORTHANC_IMAGE="${ORTHANC_IMAGE:-orthancteam/orthanc:latest}"
TS_NET="${TS_NET:-tail861dda.ts.net}"
HTTP_BASE=8100
DICOM_BASE=4300

# Logs vão para stderr — assim o stdout carrega só o resultado (JSON no modo admin).
log(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*" >&2; }
ok(){ printf '  \033[1;32m✓ %s\033[0m\n' "$*" >&2; }
die(){ printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

require_root(){
  [ "$(id -u)" -eq 0 ] || die "Rode como root: sudo $0 ..."
  command -v docker >/dev/null || die "Docker não encontrado na VM."
  mkdir -p "$TENANTS_DIR"
}

# Próximo índice livre (a partir das portas já usadas nos tenant.json).
next_index(){
  local i=1
  while :; do
    local http=$((HTTP_BASE + i))
    if ! grep -rqs "\"httpPort\": *$http" "$TENANTS_DIR"/*/tenant.json 2>/dev/null; then
      echo "$i"; return
    fi
    i=$((i+1))
  done
}

json_get(){ # json_get <file> <key>
  grep -oE "\"$2\" *: *\"?[^,\"}]*\"?" "$1" | head -1 | sed -E "s/\"$2\" *: *\"?([^\"}]*)\"?/\1/"
}

cmd_create(){
  require_root
  local tid="${1:-}"; local plan="${2:-pro}"
  if [ -z "$tid" ]; then tid="t$(openssl rand -hex 3)"; fi
  [[ "$tid" =~ ^[A-Za-z0-9_-]{1,64}$ ]] || die "tenantId inválido: $tid"
  local dir="$TENANTS_DIR/$tid"
  [ -f "$dir/tenant.json" ] && die "Tenant '$tid' já existe. Use remove antes de recriar."

  local idx; idx="$(next_index)"
  local http=$((HTTP_BASE + idx))
  local dicom=$((DICOM_BASE + idx))
  local secret; secret="$(openssl rand -hex 24)"

  log "Criando tenant '$tid' (plan=$plan · http=$http · dicom=$dicom)"
  mkdir -p "$dir/data" "$dir/worklists"
  chmod 700 "$dir"

  cat > "$dir/orthanc.json" <<JSON
{ "Name":"PACS-$tid","StorageDirectory":"/var/lib/orthanc/db","IndexDirectory":"/var/lib/orthanc/db",
  "HttpPort":8042,"HttpServerEnabled":true,"DicomServerEnabled":true,"DicomPort":4242,"DicomAet":"ORTHANC",
  "AuthenticationEnabled":false,"RemoteAccessAllowed":true,"DicomAlwaysAllowEcho":true,"DicomAlwaysAllowStore":true,
  "DicomAlwaysAllowFind":true,"StorageCompression":true,
  "Worklists":{"Enable":true,"Database":"/var/lib/orthanc/worklists"},"DicomWeb":{"Enable":true} }
JSON

  docker rm -f "orthanc-$tid" 2>/dev/null || true
  docker run -d --name "orthanc-$tid" --restart unless-stopped \
    --memory 512m --cpus 1 \
    -p "127.0.0.1:$http:8042" -p "0.0.0.0:$dicom:4242" \
    -v "$dir/data:/var/lib/orthanc/db" \
    -v "$dir/worklists:/var/lib/orthanc/worklists" \
    -v "$dir/orthanc.json:/etc/orthanc/orthanc.json:ro" \
    "$ORTHANC_IMAGE" >/dev/null
  ok "Container orthanc-$tid no ar."

  cat > "$dir/tenant.json" <<JSON
{ "secret": "$secret", "worklistDir": "$dir/worklists", "httpPort": $http, "dicomPort": $dicom, "plan": "$plan" }
JSON
  chmod 600 "$dir/tenant.json"
  ok "Registry $dir/tenant.json gravado."

  local ip; ip="$(tailscale ip -4 2>/dev/null | head -1 || echo '')"

  # Saída JSON (LAUDUS_JSON=1) — consumida pelo endpoint admin do agente.
  if [ -n "${LAUDUS_JSON:-}" ]; then
    printf '{"tenantId":"%s","secret":"%s","dicomPort":%s,"httpPort":%s,"tailnetIp":"%s","agentUrl":"https://orthanc-server.%s"}\n' \
      "$tid" "$secret" "$dicom" "$http" "$ip" "$TS_NET"
    return
  fi

  echo ""
  echo "════════════ DADOS PARA O APP (settings do usuário) ════════════"
  echo "  dicomTenantId      = $tid"
  echo "  dicomAgentSecret   = $secret"
  echo "  dicomLocalAgentUrl = https://orthanc-server.$TS_NET   (Funnel do agente)"
  echo "  Porta DICOM (relé) = $dicom   → aparelho aponta p/ ${ip:-<IP-TAILNET>}:$dicom"
  echo "  AE Title           = ORTHANC"
  echo "════════════════════════════════════════════════════════════════"
}

cmd_remove(){
  require_root
  local tid="${1:?tenantId obrigatório}"
  local dir="$TENANTS_DIR/$tid"
  [ -d "$dir" ] || die "Tenant '$tid' não existe."
  log "Removendo tenant '$tid'"
  docker rm -f "orthanc-$tid" 2>/dev/null || true
  # Backup do volume antes de apagar (segurança).
  local bak="/opt/tenants-removed/$tid-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$(dirname "$bak")"; mv "$dir" "$bak"
  ok "Container removido. Dados movidos para $bak (apague manualmente após conferir)."
}

cmd_list(){
  printf '%-16s %-8s %-8s %-6s\n' TENANT HTTP DICOM PLAN
  for f in "$TENANTS_DIR"/*/tenant.json; do
    [ -f "$f" ] || continue
    local tid; tid="$(basename "$(dirname "$f")")"
    printf '%-16s %-8s %-8s %-6s\n' "$tid" "$(json_get "$f" httpPort)" "$(json_get "$f" dicomPort)" "$(json_get "$f" plan)"
  done
}

case "${1:-}" in
  create) cmd_create "${2:-}" "${3:-}" ;;
  remove) cmd_remove "${2:-}" ;;
  list)   cmd_list ;;
  *) echo "Uso: $0 {create [id] [plan] | remove <id> | list}"; exit 1 ;;
esac
