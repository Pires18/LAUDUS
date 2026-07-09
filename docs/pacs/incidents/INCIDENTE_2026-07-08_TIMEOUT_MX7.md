# 🩺 Postmortem — Timeout de conexão MX7 ↔ PACS (08/07/2026)

> Incidente real de suporte, usuário `matheuskpires@gmail.com`, aparelho Mindray MX7,
> tenant compartilhado `orthanc-server`. Documentado aqui porque revelou **3 causas
> raiz independentes**, empilhadas — cada uma mascarando a próxima — num modelo
> (VM compartilhada + relé GL.iNet) que outros usuários vão repetir. Os fixes
> reutilizáveis já foram incorporados em `PACS_TENANT_SETUP.md`,
> `PACS_PROVISION_SETUP.md` e `scripts/glinet-pacs-relay.sh`; este documento é o
> relato — leia antes de investigar um caso parecido, economiza horas.

## Sintoma reportado
"Aparelho não conectando adequadamente ao PACS, dando erro tempo esgotado."

## Linha do tempo da investigação (resumida)

1. **Hipótese inicial (errada por um triz):** suspeita de mudança recente no
   deploy do app (havia um commit grande de manhã tocando telas de DICOM).
   Auditoria do `git log` descartou — o commit era só UI (lista de aparelhos),
   sem tocar `api/`, `scripts/agent.js` nem infra. **Lição:** nem toda
   coincidência de horário é causa — vale checar, mas não travar nela.
2. **Causa raiz nº1 — VM não aceitava a rota do relé.** `sudo tailscale up
   --accept-routes` resolvia só metade — a rota também precisa estar
   **aprovada** no admin console da tailnet.
3. **Causa raiz nº2 — firewall do GL.iNet não recarregado.** O toggle
   "Allow Remote Access LAN" do painel amigável do GL.iNet grava a config em
   UCI, mas **não garante** que o firewall ativo (iptables) foi recarregado —
   as chains de forwarding LAN↔tailscale0 não existiam até um
   `/etc/init.d/firewall restart` manual.
4. **Causa raiz nº3 (a real, mais funda) — ACL do Tailscale sem `grant` por
   CIDR.** Mesmo com rota aprovada + `--accept-routes` + firewall recarregado,
   o pacote de ida saía do GL.iNet mas a resposta nunca completava o ciclo.
   Diagnóstico decisivo: `tailscale status --json` na VM mostrava o peer do
   GL.iNet com `AllowedIPs` **sem** o CIDR da LAN dele (`192.168.8.0/24`),
   mesmo a rota estando "Approved" no admin console. **Rota aprovada não é
   suficiente** — o Tailscale só propaga uma rota de sub-rede pra quem tem um
   `grant`/`acl` cujo `dst` cobre aquele CIDR explicitamente.
   `"dst": ["autogroup:member"]` cobre o IP do **nó**, não as sub-redes que ele
   anuncia atrás de si. Fix: adicionar
   `{"src": ["autogroup:member"], "dst": ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"], "ip": ["*"]}`
   ao `grants` da policy.
5. **Mesmo corrigido tudo isso, subnet-routing nunca fechou o ciclo.** Depois
   do fix da ACL, `AllowedIPs` já incluía o CIDR certo e a rota existia na
   tabela do kernel da VM (`ip route show table 52`) — mas o `nc` de um
   dispositivo **sem Tailscale próprio** (teste limpo, decisivo) continuava
   em timeout. Provável bug/particularidade dessa combinação
   GL.iNet-firmware + Tailscale, sem causa raiz 100% confirmada — decisão foi
   **não insistir** e contornar.
6. **Contorno (que virou a solução definitiva):** em vez de rotear terceiros
   pela tailnet (subnet-routing), usar a **conexão nativa** do próprio
   GL.iNet — que sempre funcionou, ele é peer legítimo — via **DNAT simples**
   (`PREROUTING` na porta local 4242 → `DNAT` pro IP:porta tailnet da VM,
   mais `MASQUERADE`/`FORWARD`). Testado e confirmado funcional (Echo, e
   Storage — imagens chegaram no Orthanc). Padronizado em
   `scripts/glinet-pacs-relay.sh`.
7. **Causa raiz nº4 (separada, na camada de Worklist) — aparelho nunca
   registrado no `DicomModalities`.** Echo e Storage funcionam pra qualquer
   aparelho (`DicomAlwaysAllowEcho/Store`), mas Worklist exige registro
   explícito (`AllowFindWorklist`). O app *deveria* ter feito isso sozinho
   (card "Conectar meu ultrassom" → Passo 3), mas o registro nunca apareceu
   no tenant que o MX7 de fato alcançava fisicamente.
8. **Causa raiz nº5 (a mais sutil) — `dicomTenantId` do app não batia com o
   tenant que o relé físico alcançava.** O app estava configurado pro tenant
   `t1da0af`, mas o DNAT do GL.iNet (criado durante o troubleshooting) apontava
   pro tenant `t016a98` — o único que tinha dados no momento em que a
   investigação começou (um teste anterior, não relacionado ao usuário atual).
   Resultado: o app registrava/sincronizava dispositivos sempre em `t1da0af`
   (`syncModalityInOrthanc` sempre usa a config "primária" das settings, sem
   checagem cruzada — ver `UltrasoundSetupCard.tsx`), enquanto o aparelho
   físico batia em `t016a98` — dois sistemas "corretos" isoladamente, nunca se
   encontrando. Um exame real (paciente "Angelita Cardoso") subiu no tenant
   errado como consequência.

## Desfecho — recuperação dos exames órfãos

Depois de corrigir o DNAT pro tenant certo (`t1da0af`) e registrar o aparelho lá,
uma varredura no tenant errado (`t016a98`) achou **6 estudos órfãos** (não 1) —
o teste "Angelita Cardoso" feito durante o troubleshooting, **mais 5 exames
reais** de pacientes atendidas nesse mesmo dia (NICOLLY DOS SANTOS MELO, LARAH
DIAS SODRE, NICOLE DIAS DA SILVA, LUZIA MARIA DE LIMA, THAIANY DE JESUS) que
subiram ali antes do fix, sem que ninguém tivesse percebido. Todos migrados via
`GET .../archive` (ZIP) + `POST /instances` no tenant certo — a rota de peer
nativa do Orthanc (`/peers/{id}/store`) **não funciona entre containers Docker
via `localhost`** (cada container tem seu próprio namespace de rede; `localhost`
dentro de um container nunca alcança a porta de outro publicada no host), por
isso o método download+upload foi o que funcionou. Os 5 exames reais já
existiam no tenant certo desde antes da migração (`CountStudies` não mudou),
confirmando que só a Angelita Cardoso era de fato órfã — mas a varredura foi o
que permitiu confirmar isso com certeza, em vez de assumir.

**Lição adicional:** depois de qualquer troubleshooting que envolva redirecionar
o caminho físico do DICOM (DNAT, subnet route, etc.), **sempre varra o tenant
"errado" por estudos órfãos antes de fechar o caso** — exames reais podem ter
subido ali silenciosamente durante a janela de configuração incorreta, sem
nenhum erro visível pro usuário.

## Causas raiz — resumo para referência rápida

| # | Causa | Camada | Sintoma | Fix permanente |
|---|---|---|---|---|
| 1 | VM sem `--accept-routes` | Tailscale (VM) | Timeout | Documentado desde 06/07 em `PACS_TENANT_SETUP.md` |
| 2 | Firewall GL.iNet não recarregado | OpenWrt/iptables | Timeout | `/etc/init.d/firewall restart` — agora no roteiro de diagnóstico |
| 3 | ACL sem `grant` por CIDR pra relé sem tag | Tailscale ACL | Timeout (indistinguível de rede quebrada) | `grants` corrigido em `PACS_PROVISION_SETUP.md` |
| 4 | Aparelho não registrado em `DicomModalities` | Orthanc | Echo/Storage OK, Worklist recusa | Sempre confirmar via `curl .../modalities` além de confiar na UI |
| 5 | `dicomTenantId` do app ≠ tenant que o relé alcança | App (settings) | Tudo "funciona" mas exame cai no lugar errado | Aviso visual no app (badge "Não registrado no PACS") — ver abaixo |

## O que foi produtizado (não fica só nesse relato)

- **`docs/pacs/PACS_PROVISION_SETUP.md`** — policy ACL corrigida (`grants` com
  CIDR explícito) como exemplo canônico, com callout explicando o porquê.
- **`docs/pacs/PACS_TENANT_SETUP.md`** — seção "Diagnóstico" expandida de 5
  pra 10 passos, cobrindo firewall de zona do GL.iNet, teste "limpo" (sem
  Tailscale local) e o plano B; 2 novas pegadinhas na nota do topo.
- **`docs/pacs/PACS_MANUAL.md`** — linha da tabela de troubleshooting
  atualizada com o plano B.
- **`scripts/glinet-pacs-relay.sh`** (novo) — automatiza o DNAT que hoje foi
  feito na mão, comando único (`install`/`remove`/`status`), publicado em
  `/pacs/glinet-pacs-relay.sh` junto dos demais scripts (`npm run
  sync:pacs-scripts`).
- **`src/modules/dicom/UltrasoundSetupCard.tsx`** — cada aparelho cadastrado
  agora mostra um badge **"Não registrado no PACS"** quando o AE Title dele
  não é encontrado no `GET /modalities` do PACS que as settings apontam
  *agora* — pega exatamente a causa raiz nº5 (mismatch de tenant) na hora,
  em vez de descobrir só quando o exame já sumiu.

## O que NÃO foi automatizado (risco residual, próximos passos sugeridos)

- **Nenhuma verificação server-side** de que `dicomTenantId` bate com o tenant
  que o relé físico do cliente alcança — o badge novo é um sinal client-side
  (depende do usuário abrir a tela e reparar). Uma verificação mais forte
  seria o "Executar Diagnóstico" tentar uma consulta de Worklist de ponta a
  ponta (não só C-ECHO), o que pegaria esse tipo de mismatch de forma ativa.
- **`syncModalityInOrthanc` continua sem fallback pro servidor de backup** —
  aceitável hoje (o backup é redundância manual, não automática), mas vale
  revisitar se o backup passar a ser promovido automaticamente em algum fluxo
  futuro.
- **Subnet-routing via GL.iNet não tem causa raiz 100% confirmada** — o
  contorno (DNAT) resolve na prática, mas se isso for reproduzido em outro
  cliente/firmware, vale investir tempo em isolar a causa de verdade (ex:
  MTU, versão de firmware, bug conhecido do Tailscale com OpenWrt) em vez de
  só aplicar o plano B toda vez.
