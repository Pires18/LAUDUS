#!/bin/sh
#
# glinet-pacs-relay.sh — Relé DICOM (port-forward) rodando num roteador GL.iNet.
# -------------------------------------------------------------------------------
# Por que isso existe: o "Subnet Router" nativo do Tailscale (Applications >
# Tailscale > "Allow Remote Access LAN" no painel do GL.iNet) é a forma "elegante"
# de um aparelho SEM Tailscale (ex: um ultrassom) alcançar o Orthanc na nuvem
# através do roteador. Na prática, essa combinação GL.iNet + subnet-routing se
# mostrou frágil em produção (incidente 08/07/2026 — ver
# docs/pacs/PACS_TENANT_SETUP.md, seção "Diagnóstico"): mesmo com rota aprovada
# no admin console do Tailscale, ACL liberando e firewall recarregado, o pacote
# de ida saía do roteador mas a resposta nunca completava o ciclo de volta —
# sintoma indistinguível de "não configurado", sem nenhum erro explícito.
#
# Este script contorna o problema inteiro: em vez de rotear o tráfego de
# terceiros pela tailnet (subnet routing), ele usa a CONEXÃO NATIVA do próprio
# GL.iNet (que é sempre confiável — o roteador é peer legítimo da tailnet) e
# faz um DNAT simples: o aparelho aponta pro IP do roteador na LAN, e o
# roteador reencaminha pra VM usando a identidade Tailscale dele mesmo.
#
#   Aparelho ──DICOM(porta local)──► GL.iNet ──DNAT via tailscale0──► VM:porta-do-tenant
#
# Requisitos: rodar como root, via SSH, no próprio roteador GL.iNet
# (OpenWrt/BusyBox — por isso o script é POSIX sh puro, sem bashismos).
#
# USO (no roteador, como root):
#   ./glinet-pacs-relay.sh install <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]
#   ./glinet-pacs-relay.sh status  <porta-local>
#   ./glinet-pacs-relay.sh remove  <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]
#
# Exemplo (tenant t1da0af, porta DICOM 4303, na VM orthanc-server):
#   ./glinet-pacs-relay.sh install 100.95.119.69 4303 4242
#
# porta-local (default 4242): o que você configura NO APARELHO como "porta do
# PACS". Pode deixar 4242 (padrão DICOM) mesmo com múltiplos tenants na mesma
# VM compartilhada — cada roteador/relé só atende UM aparelho/tenant por vez.
# -------------------------------------------------------------------------------
set -eu

FW_USER=/etc/firewall.user
LAN_IF=br-lan

log(){ printf '\n\033[1;36m>> %s\033[0m\n' "$*" >&2; }
ok(){ printf '   \033[1;32mOK: %s\033[0m\n' "$*" >&2; }
warn(){ printf '   \033[1;33m!! %s\033[0m\n' "$*" >&2; }
die(){ printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

require_root(){
  [ "$(id -u)" = "0" ] || die "Rode como root (você já deve estar, via ssh root@<ip-do-roteador>)."
}

# Testa se o PRÓPRIO roteador alcança o destino nativamente pela tailnet —
# se isso falhar, o resto do script não vai adiantar (o problema está antes,
# na conexão Tailscale do roteador em si, não no relé).
check_native(){
  local_ip="$1"; local_port="$2"
  log "Testando conexão nativa do roteador -> ${local_ip}:${local_port} (via tailscale0)..."
  if command -v timeout >/dev/null 2>&1; then
    if timeout 3 nc "$local_ip" "$local_port" </dev/null 2>/dev/null; then
      ok "Roteador alcança ${local_ip}:${local_port} nativamente."
      return 0
    fi
  fi
  warn "Não foi possível confirmar via nc/timeout (BusyBox nc é limitado) — prosseguindo mesmo assim."
  warn "Se o relé não funcionar depois de instalado, rode 'tailscale status' e confirme que a VM aparece 'active'."
  return 0
}

# Remove regras existentes pra essa porta local (idempotente — evita duplicar
# se rodar 'install' mais de uma vez, ou trocar de tenant/porta).
remove_rules(){
  vm_ip="$1"; vm_port="$2"; local_port="$3"
  iptables -t nat -D PREROUTING -i "$LAN_IF" -p tcp --dport "$local_port" -j DNAT --to-destination "${vm_ip}:${vm_port}" 2>/dev/null || true
  iptables -t nat -D POSTROUTING -p tcp -d "$vm_ip" --dport "$vm_port" -j MASQUERADE 2>/dev/null || true
  iptables -D FORWARD -p tcp -d "$vm_ip" --dport "$vm_port" -j ACCEPT 2>/dev/null || true
}

# Remove só as linhas desse relé específico do /etc/firewall.user (mantém as
# de outros relés, se o roteador já tiver mais de um configurado antes).
remove_persisted(){
  vm_ip="$1"; vm_port="$2"; local_port="$3"
  [ -f "$FW_USER" ] || return 0
  grep -v -- "--dport ${local_port} -j DNAT --to-destination ${vm_ip}:${vm_port}\|-d ${vm_ip} --dport ${vm_port}" "$FW_USER" > "${FW_USER}.tmp" 2>/dev/null || true
  mv "${FW_USER}.tmp" "$FW_USER"
}

cmd_install(){
  vm_ip="${1:?uso: install <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]}"
  vm_port="${2:?uso: install <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]}"
  local_port="${3:-4242}"

  require_root
  check_native "$vm_ip" "$vm_port"

  log "Aplicando DNAT: LAN:${local_port} -> ${vm_ip}:${vm_port}"
  remove_rules "$vm_ip" "$vm_port" "$local_port"
  iptables -t nat -I PREROUTING -i "$LAN_IF" -p tcp --dport "$local_port" -j DNAT --to-destination "${vm_ip}:${vm_port}"
  iptables -t nat -I POSTROUTING -p tcp -d "$vm_ip" --dport "$vm_port" -j MASQUERADE
  iptables -I FORWARD -p tcp -d "$vm_ip" --dport "$vm_port" -j ACCEPT
  ok "Regras aplicadas (ativas até o próximo reboot/firewall reload)."

  log "Tornando permanente em ${FW_USER}..."
  remove_persisted "$vm_ip" "$vm_port" "$local_port"
  {
    echo "# glinet-pacs-relay: LAN:${local_port} -> ${vm_ip}:${vm_port} ($(date '+%Y-%m-%d' 2>/dev/null || echo ''))"
    echo "iptables -t nat -C PREROUTING -i ${LAN_IF} -p tcp --dport ${local_port} -j DNAT --to-destination ${vm_ip}:${vm_port} 2>/dev/null || \\"
    echo "iptables -t nat -I PREROUTING -i ${LAN_IF} -p tcp --dport ${local_port} -j DNAT --to-destination ${vm_ip}:${vm_port}"
    echo "iptables -t nat -C POSTROUTING -p tcp -d ${vm_ip} --dport ${vm_port} -j MASQUERADE 2>/dev/null || \\"
    echo "iptables -t nat -I POSTROUTING -p tcp -d ${vm_ip} --dport ${vm_port} -j MASQUERADE"
    echo "iptables -C FORWARD -p tcp -d ${vm_ip} --dport ${vm_port} -j ACCEPT 2>/dev/null || \\"
    echo "iptables -I FORWARD -p tcp -d ${vm_ip} --dport ${vm_port} -j ACCEPT"
  } >> "$FW_USER"
  ok "Persistido — sobrevive a reboot e a '/etc/init.d/firewall restart'."

  router_lan_ip="$(uci get network.lan.ipaddr 2>/dev/null || echo '192.168.8.1')"
  log "Pronto. Configure NO APARELHO (menu DICOM):"
  printf '   IP remoto:  %s\n   Porta:      %s\n   AE Title:   ORTHANC (ou o AE Title do PACS configurado)\n' "$router_lan_ip" "$local_port" >&2
  warn "Não esqueça de registrar o AE Title do aparelho no Orthanc do tenant (Worklist exige — Echo/Store funcionam sem isso):"
  printf "   curl -X PUT http://localhost:%s/modalities/<nome> -H 'Content-Type: application/json' -d '{\"AET\":\"<AE_DO_APARELHO>\",\"Host\":\"<ip-lan-do-aparelho>\",\"Port\":104,\"AllowEcho\":true,\"AllowFind\":true,\"AllowFindWorklist\":true,\"AllowStore\":true}'\n" "$((vm_port - 4300 + 8100))" >&2
}

cmd_remove(){
  vm_ip="${1:?uso: remove <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]}"
  vm_port="${2:?uso: remove <ip-tailnet-da-vm> <porta-dicom-do-tenant> [porta-local]}"
  local_port="${3:-4242}"
  require_root
  log "Removendo relé LAN:${local_port} -> ${vm_ip}:${vm_port}"
  remove_rules "$vm_ip" "$vm_port" "$local_port"
  remove_persisted "$vm_ip" "$vm_port" "$local_port"
  ok "Removido (ativo e persistido)."
}

cmd_status(){
  local_port="${1:-4242}"
  log "Regras DNAT ativas na porta local ${local_port}:"
  iptables -t nat -L PREROUTING -n -v | grep -- "dpt:${local_port}" || echo "  (nenhuma)"
  log "Persistido em ${FW_USER}:"
  grep -- "--dport ${local_port}" "$FW_USER" 2>/dev/null || echo "  (nenhuma)"
}

case "${1:-}" in
  install) shift; cmd_install "$@" ;;
  remove)  shift; cmd_remove "$@" ;;
  status)  shift; cmd_status "$@" ;;
  *) die "uso: $0 {install|remove|status} ..." ;;
esac
