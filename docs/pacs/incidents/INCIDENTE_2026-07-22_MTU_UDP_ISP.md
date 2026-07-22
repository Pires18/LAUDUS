# 🩺 Postmortem — ISP da clínica passou a descartar UDP grande: store DICOM e app estancados (22/07/2026)

> Incidente real de suporte, usuário `matheuskpires@gmail.com`, aparelho Mindray MX7
> (relé GL-MT3000), tenant `t1da0af` na VM `orthanc-server` (GCP, e2-medium).
> Complementa os postmortems de 08/07 e 15/07. **Sistema funcionava perfeitamente
> e "do nada" parou no meio dos atendimentos** — nada mudou na clínica, na VM ou
> no app: mudou o comportamento do provedor de internet.

## Sintomas reportados (em sequência)

1. "MX7 parou de conectar ao Orthanc — ping ok, verificação de worklist e PACS falham."
   *(este primeiro sintoma era outra causa: configuração de IP/porta no próprio
   aparelho; corrigida no aparelho, verificação voltou)*
2. "MX7 reconhece mas **não consegue enviar exames** ao PACS."
3. Diagnóstico de rede do LAUDUS: **Imagens / Worklist / Aparelhos — tudo
   "Failed to fetch"** no servidor principal.

## Causa raiz

**O provedor da clínica (IP público 200.192.19.207) começou a descartar pacotes
UDP grandes no sentido de upload** — exatamente o transporte do túnel
Tailscale/WireGuard. Medição (ping pelo túnel Mac→VM):

- payload interno ≤ 1200 bytes (≈1290 no fio): **0% de perda**
- payload interno ≥ 1220 bytes (≈1310 no fio): **100% de perda, estável**
- upload TCP puro (scp 2MB pro IP público da VM): rápido — **o link em si estava bom**
- download (VM→clínica): normal o tempo todo

Consequência: tudo que é **pacote pequeno** passava (ping, C-ECHO, C-FIND de
worklist — por isso "reconhece"), e tudo que é **fluxo grande de subida** morria
(C-STORE de imagens, POST do app ao agente). No Orthanc: `Store SCP Failed:
DIMSE No data available` / `DUL network read timeout` em série.

## Por que o fix precisou de TRÊS camadas na VM

O MSS/MTU precisa ser reduzido em cada plano de dados que o tráfego usa:

| Camada | Tráfego que passa por ela | Fix |
|---|---|---|
| iptables mangle **OUTPUT** da VM | Serviços do host | `TCPMSS --set-mss 1000 -o tailscale0` |
| iptables mangle **FORWARD** da VM | **Containers Docker** (portas DICOM 43xx são DNAT pro container — o SYN-ACK sai via FORWARD, não OUTPUT!) | idem, na FORWARD |
| **tailscaled em userspace** (netstack) | **`tailscale serve`/Funnel (porta 443 do agente)** — interceptado dentro do tailscaled, **nunca toca o iptables** | `TS_DEBUG_MTU=1100` (drop-in systemd) |

A primeira tentativa (só OUTPUT) não mudou nada — contador da regra em 0. A
segunda (FORWARD) consertou o DICOM mas o app continuou "Failed to fetch". Só o
`TS_DEBUG_MTU` fechou o caminho do agente HTTPS.

## Estado final aplicado (persistente)

- `/etc/cron.d/pacs-mss-clamp` — reaplica as duas regras TCPMSS no boot
  (`@reboot`, com `sleep 30`).
- `/etc/systemd/system/tailscaled.service.d/mtu.conf` —
  `Environment=TS_DEBUG_MTU=1100` (sobrevive a reboot e a updates do pacote).
- `docker update --memory=1g orthanc-t1da0af` — correção do problema latente
  descoberto no serial console: o container era OOM-killed no teto de 512MB
  (várias vezes em 17–18/07). *Obs.: se o container for recriado via compose,
  o limite volta ao do compose — atualizar lá também.*

## Verificação (antes → depois)

| Teste | Antes | Depois |
|---|---|---|
| C-STORE 478KB via relé GL.iNet (caminho do MX7) | timeout 65–114s | **0,5s** |
| C-STORE 478KB direto pela tailnet | timeout | **0,6s** |
| POST 2MB ao agente (caminho do app) | 130KB em 60s (2KB/s) e aborto | **completo em 0,3s** |

## Lições / pegadinhas de suporte

- **"Echo passa, store morre" não é sempre o MSS do roteador** (15/07): desta
  vez o clamp do GL.iNet estava correto e o problema era na outra ponta do
  túnel. O teste decisivo e barato é o **ping com tamanhos crescentes pelo
  túnel** (`ping -s 1000` vs `ping -s 1220`): 10 segundos e aponta blackhole
  de MTU sem depender de nenhum log.
- **`tailscale serve`/Funnel é invisível pro iptables** — regra TCPMSS não
  alcança; o único controle é o MTU do tailscaled (`TS_DEBUG_MTU`).
- **Conexão a serviço em container Docker atravessa FORWARD, não OUTPUT** —
  regra de MSS em OUTPUT casa 0 pacotes e parece "não funcionar".
- **SSH à VM pela tailnet trava junto** quando o problema é MTU (o próprio SSH
  usa pacotes grandes no handshake) — usar o **IP público** da VM para
  diagnosticar (`gcloud compute ssh` ou chave GCE direta).
- O **serial console do GCP** (`gcloud compute instances get-serial-port-output`)
  diagnostica OOM/disco/rede sem precisar de SSH — foi onde o OOM do Orthanc
  apareceu.
- Diagnóstico do app com **"Failed to fetch" em tudo** = o navegador nem
  conseguiu falar com o agente — problema de transporte/TLS, não de settings
  (settings erradas dão 401/404, não "Failed to fetch").

## Risco residual

- O comportamento do ISP pode mudar de novo (ou normalizar). Com MTU 1100 +
  MSS 1000 há folga de ~190 bytes contra o limiar medido (~1290). Se um dia
  os envios estancarem de novo com echo passando, repetir o teste de ping por
  tamanho e, se preciso, baixar mais (`TS_DEBUG_MTU=1000` / `--set-mss 900`).
- Trocar o ISP da clínica ou ativar IPv6 muda a matemática toda — retestar.
