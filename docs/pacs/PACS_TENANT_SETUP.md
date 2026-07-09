# 🏢 Ops — VM compartilhada multi-tenant (`orthanc-server`)

> **Ponto de entrada geral de PACS/DICOM:** [`PACS_CENTRAL_MESTRE.md`](./PACS_CENTRAL_MESTRE.md)
> (checklist de configuração completo, hardening, bugs corrigidos, roadmap). Este
> documento aqui é o runbook operacional específico da VM compartilhada.

> Como migrar a VM `orthanc-server` para **multi-tenant** e criar tenants (planos
> Starter/Pro). Cada tenant = 1 container Orthanc isolado. Ver desenho em
> [PLANO_PACS_VM_COMPARTILHADA.md](./PLANO_PACS_VM_COMPARTILHADA.md).

> **Estado real (validado com aparelho físico em 06/07/2026):** este é o modelo
> em produção. Relato completo de um incidente real (5 causas raiz empilhadas,
> a maioria não óbvia) em
> [INCIDENTE_2026-07-08_TIMEOUT_MX7.md](./incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md)
> — vale ler antes de investigar um "timeout" parecido. Pegadinhas que já
> causaram incidentes reais e não são óbvias — confira sempre ao configurar um
> relé novo:
> 1. **Rotas de sub-rede:** aprovar a rota do relé no admin da tailnet NÃO
>    basta — a **VM também precisa aceitá-la** (`sudo tailscale up --accept-routes`,
>    já incluído no `pacs-vm-setup.sh`). Sem isso, o C-ECHO trava em *timeout*
>    (não rejeita — o pacote chega, a resposta não acha o caminho de volta).
> 2. **DicomModalities:** o Orthanc libera C-ECHO de qualquer aparelho, mas
>    **exige o aparelho registrado** para responder consultas de Worklist
>    (permissão `AllowFindWorklist`, separada de `AllowFind`). Isso é
>    automatizado pelo app — o usuário cadastra o aparelho em "Conectar meu
>    ultrassom" e ele mesmo chama `PUT /modalities/{id}` no Orthanc via o
>    proxy do agente. Não precisa editar `orthanc.json` nem reiniciar
>    container à mão.
> 3. **`dicomTenantId` desalinhado do tenant que o relé físico alcança:** o
>    app sempre registra/sincroniza o aparelho contra o tenant guardado em
>    `settings.dicomTenantId` (client-side, sem checagem cruzada com pra
>    onde o relé do cliente está de fato encaminhando o tráfego DICOM). Se
>    esses dois divergirem — típico depois de um "Reprovisionar" que criou
>    tenant novo em vez de reparar o existente — o app "funciona" sem erro
>    (Echo passa, worklist é criada) mas tudo cai num tenant que ninguém
>    olha. Sintoma: exames sobem só no Orthanc errado; `curl .../modalities`
>    do tenant "certo" (o que o app mostra) vem vazio. Sempre confira, ao
>    investigar um caso, se o `dicomTenantId` das settings do usuário bate
>    com a porta que o relé físico dele está de fato alcançando (`sudo
>    /opt/pacs-tenant.sh list` + qual tenant tem dado recente em
>    `/opt/tenants/*/data`).
> 4. **Subnet-routing via GL.iNet pode nunca fechar o ciclo, mesmo 100%
>    configurado certo** (rota aprovada, `--accept-routes` na VM, ACL/`grants`
>    liberando por CIDR, firewall recarregado) — o SYN sai do roteador, mas a
>    resposta não completa a volta, sem nenhum erro explícito em lugar nenhum.
>    Não é sempre reproduzível nem tem causa raiz confirmada nessa versão de
>    firmware/Tailscale; **não insista indefinidamente**. Ver seção
>    "Diagnóstico" abaixo pro roteiro completo e o **plano B** (`scripts/glinet-pacs-relay.sh`,
>    DNAT usando a conexão nativa do roteador em vez de subnet-routing).

## Pré-requisitos
- VM já montada pelo `setup-vm.sh` (Docker + Tailscale + Agente + Funnel).
- Agente atualizado (`scripts/agent.js` **tenant-aware**) e `scripts/pacs-tenant.sh` copiados para a VM.
  ```bash
  gcloud compute scp scripts/agent.js scripts/generate_wl.py scripts/pacs-tenant.sh \
    orthanc-server:~ --zone=southamerica-east1-c
  sudo cp ~/agent.js ~/generate_wl.py /opt/laudus-agent/
  sudo cp ~/pacs-tenant.sh /opt/ && sudo chmod +x /opt/pacs-tenant.sh
  ```

## 1. Ligar o modo multi-tenant no Agente
Edite o serviço systemd do agente (`/etc/systemd/system/laudus-agent.service`) e
troque as variáveis para o modo multi-tenant:
```ini
Environment=PORT=3000
Environment=LAUDUS_TENANTS_DIR=/opt/tenants
# Auto-provisão (S2b) — o serverless chama /api/admin/tenant com este segredo:
Environment=LAUDUS_ADMIN_SECRET=<segredo-admin-forte>
Environment=LAUDUS_TENANT_SCRIPT=/opt/pacs-tenant.sh
Environment=LAUDUS_TS_NET=tail861dda.ts.net
# (remova LAUDUS_WORKLIST_DIR e LAUDUS_AGENT_SECRET — no multi-tenant o segredo é por tenant)
```
> O agente precisa rodar como **root** (para o Docker do `pacs-tenant.sh`) — é o
> padrão do systemd sem `User=`.

### Auto-provisão self-service (S2b) — env na Vercel
Para o botão "Criar meu PACS" (Starter/Pro) provisionar o tenant sozinho, adicione
na Vercel:
```
PACS_SHARED_AGENT_URL=https://orthanc-server.tail861dda.ts.net
PACS_ADMIN_SECRET=<o MESMO LAUDUS_ADMIN_SECRET do agente>
```
Sem essas, os planos Starter/Pro caem em **simulação** (nada quebra).
Recarregue e reinicie:
```bash
sudo systemctl daemon-reload && sudo systemctl restart laudus-agent
curl -s https://orthanc-server.tail861dda.ts.net/ | grep multi-tenant   # deve aparecer
```
> O Orthanc "default" da `setup-vm.sh` (portas 8042/4242) pode ser **desligado**
> (`docker rm -f orthanc`) — no modo multi-tenant só os containers por tenant
> (`orthanc-<id>`) são usados. Faça backup do volume antes, se houver dados.

## 2. Criar o primeiro tenant
```bash
sudo TS_NET=tail861dda.ts.net /opt/pacs-tenant.sh create        # id/plan automáticos
# ou:  sudo /opt/pacs-tenant.sh create clinicaA pro
```
A saída imprime os **dados para o app**:
```
dicomTenantId      = tXXXXXX
dicomAgentSecret   = <segredo>
dicomLocalAgentUrl = https://orthanc-server.tail861dda.ts.net
Porta DICOM (relé) = 43xx   → aparelho aponta p/ <IP-tailnet>:43xx
AE Title           = ORTHANC
```

## 3. Configurar no app
Só é manual se o tenant foi criado **direto na VM** (comando acima, uso de suporte).
Quando o cliente usa o botão **"Criar meu PACS"** no app (Starter/Pro), tudo isso é
gravado sozinho pelo provisionador (S2b já em produção). Se precisar preencher à
mão: no usuário (Configurações → PACS/DICOM), `dicomTenantId`, `dicomAgentSecret`
e `dicomLocalAgentUrl` com os valores acima. O campo **Porta DICOM** (card
"Conectar meu ultrassom") também precisa bater com a porta DICOM do tenant — se
o provisionamento foi manual, edite-o lá (é editável).

## 4. Conectar o relé da clínica à tailnet (Tailscale)

O relé é o que liga a rede local do cliente (onde está o ultrassom) à tailnet
onde a VM já está. **O cliente NÃO precisa da sua conta Tailscale** — o
provisionamento (`api/pacs-provision.ts`) já gera uma **auth-key própria por
cliente** (tag `tag:pacs-client`), exibida no card "Conectar meu ultrassom".
O cliente só cola essa chave no login do roteador/PC dele. Uma regra de ACL
(ver `PACS_PROVISION_SETUP.md` §2) restringe essa tag a só alcançar a porta
DICOM das VMs — o cliente nunca enxerga outros dispositivos da tailnet.

> Isso só existe para tenants criados via **provisionamento automático** (o
> endpoint gera a chave). Tenants criados manualmente (`pacs-tenant.sh create`
> direto na VM, seção 2 acima) não têm essa chave — nesse caso, ou você gera
> uma auth-key manualmente pro cliente (`tailscale.com` → Settings → Keys, tag
> `tag:pacs-client`), ou usa sua própria conta mesmo (aceitável só se você é o
> único usuário da VM).

**Opção A — roteador GL.iNet (recomendado, sempre ligado, zero manutenção):**
1. Painel admin do roteador (`192.168.8.1` por padrão) → **Mais Configurações
   → VPN → Tailscale** (nome do menu varia por firmware).
2. Login/autorizar: cole a auth-key do cliente (se o firmware pedir uma) ou
   use link/QR code com a conta apropriada.
3. Habilitar **roteamento de sub-rede** ("Subnet Router" / "Advertise Routes"),
   marcando a faixa de IP da LAN do cliente (ex: `192.168.8.0/24`). **Não**
   habilitar "route all traffic" — só a LAN local.

**Opção B — computador (Windows/Mac/Linux) sempre ligado na rede do aparelho:**
```bash
# Linux — logando direto com a auth-key do cliente (sem conta)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=<AUTH-KEY-DO-CLIENTE>
# Windows/Mac: baixar em tailscale.com/download; na tela de conexão, usar a auth-key
```
Duas formas de usar o PC como relé:
- **Encaminhamento simples de porta** (netsh/socat — ver exemplos no guia
  in-app, aba "Guia de Configuração → 4 · Relé + ultrassom").
- **Subnet router** (mais robusto, mesmo princípio do GL.iNet):
  ```bash
  sudo tailscale up --advertise-routes=192.168.x.0/24   # troque pela LAN real do cliente
  ```

**Aprovar a rota:** se a ACL tiver `autoApprovers` para `tag:pacs-client`
(ver `PACS_PROVISION_SETUP.md` §2), isso é **automático** — a rota do relé do
cliente é aprovada sozinha assim que ele conecta, sem você precisar entrar no
admin console. Sem `autoApprovers` configurado, precisa aprovar manualmente
toda vez que um relé novo conecta: `login.tailscale.com/admin/machines` →
achar o relé → "⋯" → **Edit route settings** → habilitar a sub-rede anunciada.

**A VM precisa ACEITAR a rota** (não basta aprovar) — já vem no turnkey atual;
se a VM for antiga, rode nela:
```bash
sudo tailscale up --accept-routes
```
Sem isso, o C-ECHO trava em "tempo esgotado" (o pacote chega, a resposta não
acha caminho de volta) — foi a causa real de um caso em produção (06/07/2026).

## 5. Apontar o aparelho de ultrassom
No ultrassom (Worklist + Storage): **IP do relé** na LAN, **porta = a porta DICOM
do tenant** (`43xx`), **AE = ORTHANC**. C-ECHO deve dar sucesso.

> **Depois do C-ECHO, cadastre o aparelho** no card "Conectar meu ultrassom" (AE
> Title + IP) — sem isso, o Orthanc aceita o Echo mas recusa a consulta de
> Worklist ("This AET is not listed in configuration option DicomModalities").
> O app registra automaticamente via `PUT /modalities/{id}`, sem precisar editar
> `orthanc.json` nem reiniciar o container.

## Comandos úteis
```bash
sudo /opt/pacs-tenant.sh list          # lista tenants (precisa sudo — /opt/tenants é 0700)
sudo /opt/pacs-tenant.sh remove <id>   # remove container; move dados p/ /opt/tenants-removed
docker stats --no-stream               # uso de CPU/RAM por container
sudo bash -c 'du -sh /opt/tenants/*/data'   # qual tenant tem dados reais (glob precisa rodar JÁ como root)
```

## Diagnóstico "aparelho não conecta" (ordem que funciona)

**Camada VM/Orthanc — sempre confira primeiro (rápido, elimina metade dos casos):**
1. `sudo docker ps --filter name=orthanc-<tid>` + `sudo ss -tlnp | grep <porta>` — container de pé e escutando?
2. `nc -zv -w 3 <ip-tailnet-vm> <porta>` **rodado na própria VM** — a porta responde localmente?
3. O mesmo `nc` rodado de **outro nó da tailnet** (ex: seu Mac, **com Tailscale ligado**) — isola "VM alcançável por peer nativo" vs. "problema é específico do relé/subnet-routing". ⚠️ Rodar esse teste com Tailscale **desligado** no dispositivo de teste é o que de fato isola o caminho do relé — ver passo 7.
4. `tailscale status` na VM — procure "peers are advertising routes but --accept-routes is false".
5. `sudo docker logs orthanc-<tid> --tail 50` **no momento exato da tentativa** — a causa real quase sempre aparece aqui (ex: rejeição de DicomModalities).
6. `curl -s http://localhost:<httpPort>/modalities` — o aparelho está mesmo registrado nesse tenant específico? (Confira também se `dicomTenantId` do usuário bate com esse tenant — ver pegadinha nº3 acima.)

**Se a VM está OK mas o aparelho físico ainda não conecta — isola o caminho relé→tailnet (mais demorado, mas decisivo):**

7. **Teste "limpo" a partir da rede do cliente**: pegue um dispositivo **sem Tailscale rodando** (desligue-o se já tiver — `tailscale down`, ou celular sem o app), conectado na **mesma rede do relé** (mesmo Wi-Fi do GL.iNet, por exemplo), e rode `nc -zv -w 3 <ip-tailnet-vm> <porta>`. Só esse teste separa "subnet-routing funcionando" de "só peers nativos alcançam" — testar de um device que já tem Tailscale instalado (mesmo que na mesma rede física) dá **falso positivo**, porque ele usa a própria conexão dele, não a rota do relé.
8. Se o passo 7 falhar, `tcpdump -i tailscale0 -n port <porta>` **na VM**, retestando em paralelo — confirma se o pacote sequer chega (problema é no relé/rede do cliente) ou se chega e não recebe resposta (problema é no retorno).
9. No **relé (GL.iNet)**, via SSH (`ssh root@<ip-do-roteador>`, senha = a do painel; se o LuCI pedir senha separada, geralmente é a mesma):
   - `tailscale status` — o peer da VM aparece `active`?
   - `ip route | grep tailscale` e `iptables -t nat -L -n -v | grep -A3 tailscale` — rotas e NAT básicos.
   - `iptables -L zone_lan_forward -n -v` e `iptables -L zone_tailscale0_forward -n -v` — **os dois sentidos**. Teste `nc`/`timeout nc` de novo enquanto olha os contadores de pacote: se `zone_lan_forward`→`zone_tailscale0_dest_ACCEPT` incrementa mas `zone_tailscale0_forward` (o **retorno**) fica sempre em zero, o pacote de ida sai mas a resposta nunca completa o ciclo — sintoma real observado em produção (08/07/2026), sem causa raiz 100% confirmada nessa combinação de firmware.
   - Se as chains de zona parecerem "vazias"/desatualizadas mesmo com a config em `uci show firewall` correta, rode `/etc/init.d/firewall restart` — o toggle da UI amigável do GL.iNet nem sempre recarrega o firewall ativo.
10. **Confira a ACL do Tailscale** (admin console → Access controls): rota aprovada **não basta**. Rode `tailscale status --json | grep -A10 "<hostname-do-relé>"` **na VM** e confirme se o `AllowedIPs` do peer relé inclui o CIDR da LAN dele. Se não incluir, falta um `grant` com `dst` explícito por CIDR — ver `PACS_PROVISION_SETUP.md` §2 (pegadinha documentada ali, com o exemplo de policy corrigido).

**Se depois de tudo isso (passos 7–10) o subnet-routing ainda não fechar o ciclo — não insista mais.** É um modo de falha conhecido dessa combinação GL.iNet+Tailscale, sem reprodução 100% confiável. Use o **plano B**:

```bash
# baixa e roda direto no roteador (o script é publicado em /pacs junto com os
# demais — agent.js, generate_wl.py etc. — via `npm run sync:pacs-scripts`)
ssh root@<ip-do-roteador> "curl -fsSL https://laudus.vercel.app/pacs/glinet-pacs-relay.sh -o ~/glinet-pacs-relay.sh && chmod +x ~/glinet-pacs-relay.sh && ~/glinet-pacs-relay.sh install <ip-tailnet-vm> <porta-dicom-do-tenant> 4242"
```
Isso troca subnet-routing por um DNAT simples usando a **conexão nativa** do próprio roteador (que sempre funciona, ele é peer legítimo da tailnet) — muito mais robusto, e o aparelho passa a apontar pro **IP do próprio roteador** em vez do IP tailnet da VM.

## Atualizar `agent.js` na VM depois de um fix no código
```bash
sudo curl -fsSL "https://laudus.vercel.app/pacs/agent.js?t=$(date +%s)" -o /opt/laudus-agent/agent.js
sudo systemctl restart laudus-agent
# valide direto pela VM (sem depender de cache do navegador):
curl -s -X OPTIONS -i https://orthanc-server.<ts_net>/api/orthanc-proxy | grep -i access-control-allow-methods
```
O `?t=$(date +%s)` força ignorar cache de CDN — sem ele, o `curl` às vezes traz uma
cópia antiga mesmo já publicada. Se `sudo` responder com uma frase estranha em vez
de pedir senha, é uma trava intermitente dessa VM — repita o comando sozinho (sem
colar em bloco); costuma passar na 2ª tentativa.

## Segurança / hardening (S4)
Rode o script de endurecimento na VM (idempotente):
```bash
sudo cp ~/pacs-harden.sh /opt/ && sudo chmod +x /opt/pacs-harden.sh
# Com disco de dados dedicado (recomendado — anexe um disco no GCP antes):
sudo DATA_DISK=/dev/sdb /opt/pacs-harden.sh
# Sem disco extra (só permissões + limite de logs):
sudo /opt/pacs-harden.sh
```
Ele faz: monta o **disco de dados** em `/opt/tenants` (+fstab, migra dados), aplica
**permissões 0700**, **limita logs do Docker** (10m×3) e imprime o **checklist GCP**.

Checklist adicional (fora da VM):
- [ ] **Firewall GCP:** nenhuma regra pública para `8042/4242/3000/43xx` (as portas `43xx` são alcançadas só via tailnet pelo relé). `gcloud compute firewall-rules list --filter="direction=INGRESS"`.
- [ ] **Snapshots** diários do disco de dados (comandos impressos pelo script; retenção 14 dias).
- [ ] (Opcional) ACL Tailscale restringindo cada relé à porta do seu tenant.
- [ ] **Rotação** dos segredos GCP/Tailscale que apareceram no chat.
