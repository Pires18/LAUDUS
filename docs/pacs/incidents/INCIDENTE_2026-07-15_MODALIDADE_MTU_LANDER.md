# 🩺 Postmortem — Worklist rejeitada + Storage estancado + scripts sobrescritos por HTML (15/07/2026)

> Incidente real de suporte, usuário `matheuskpires@gmail.com`, aparelho Mindray MX7
> (relé GL-MT3000), tenant `t1da0af` na VM compartilhada `orthanc-server`.
> **3 causas raiz independentes no mesmo dia**, cada uma com sintoma distinto.
> Complementa o postmortem de 08/07 (`INCIDENTE_2026-07-08_TIMEOUT_MX7.md`).

## Sintomas reportados (em sequência)

1. "Sistema parou de funcionar com a worklist do aparelho" — app com toast de
   sucesso, aparelho com **"worklist server error"**.
2. Depois de corrigido: "parou de reconhecer o IP do GL.iNet" — echo ok,
   **envio de imagens morrendo no meio**.
3. Depois do comando de atualização do agente: **todo envio de worklist falhando
   com `SyntaxError` em `generate_wl.py`**.

## Causas raiz

| # | Causa | Sintoma | Diagnóstico decisivo | Fix permanente |
|---|---|---|---|---|
| 1 | **MX7 sumiu do `DicomModalities`** do tenant. Mecanismo provável: o fluxo de edição de aparelho fazia `delete` do registro antigo **antes** do `put` do novo — se o put falha, o aparelho fica des-registrado com cara de sucesso. | Aparelho: "worklist server error". App: toast de sucesso (o `.wl` grava normalmente; a recusa é na consulta C-FIND do aparelho). | `docker logs orthanc-t1da0af` → `DICOM authorization rejected for AET MX7 ... not listed in "DicomModalities"` | `UltrasoundSetupCard`: ordem invertida (put→delete) **+ auto-recuperação**: ao abrir o Centro de Controle PACS, qualquer aparelho cadastrado que esteja fora do `/modalities` é re-autorizado automaticamente. Correção pontual: `curl -X PUT http://localhost:<httpPort>/modalities/MX7 ...` na VM. |
| 2 | **MTU do túnel Tailscale** (1280) vs LAN (1500): sem MSS clamp, handshake/echo passam mas o envio de imagens estanca — pior quando a conexão roteador↔VM cai pra relay DERP. | Echo ok; store morre no meio. Orthanc: `Store SCP Failed: DIMSE Read PDV failed` / `DUL network read timeout`. | Contador DNAT avançando no roteador + associações chegando no Orthanc e morrendo mid-transfer. | MSS clamp (`--clamp-mss-to-pmtu` nos dois sentidos de `tailscale0`) incorporado ao `glinet-pacs-relay.sh` (aplica + persiste). |
| 3 | **`SCRIPTS_URL` servindo página de lander**: `laud.us/pacs/*` e `laudus.vercel.app/pacs/*` devolvem HTML de redirect com HTTP 200 — o `curl -o` direto no destino **sobrescreveu `generate_wl.py` com HTML** e todo envio de worklist passou a falhar. | Toast de erro no app: `SyntaxError: invalid syntax` apontando `<!DOCTYPE html>` na linha 1. | `head -2 /opt/laudus-agent/generate_wl.py` → HTML. | `pacs-vm-setup.sh`: função `fetch()` baixa em `.part`, rejeita HTML e valida `generate_wl.py` com `py_compile` **antes** de substituir — arquivo antigo fica intacto se o download vier errado. Recuperação: colar o arquivo via heredoc no terminal da VM (não depende de URL). |

### Causa raiz nº 4 (latente, descoberta durante o caso)

**Firmware GL.iNet 4.x (fw4/OpenWrt 21+) não executa `/etc/firewall.user` no
boot** — a persistência do relé documentada até então só funcionava em
firmware 3.x. No GL-MT3000 do caso, uma queda de luz apagaria DNAT + MSS clamp
em silêncio ("aparelho parou de conectar", sem nenhum erro em lugar nenhum).
**Fix:** `glinet-pacs-relay.sh install` agora instala (a) init script
`/etc/init.d/pacs-relay` (START=99) que reaplica `/etc/firewall.user` no boot e
(b) watchdog via cron a cada 5 min — as regras usam `-C || -I` (idempotentes),
então reaplicar é sempre inofensivo e também cobre um reload de firewall no
meio do expediente. `status` passa a denunciar quando boot/watchdog faltam.

## Pegadinhas de suporte que custaram tempo

- **Comandos com placeholder** (`orthanc-<tenant>`, `/caminho/...`) foram executados
  literalmente — sempre enviar comandos prontos, que descobrem sozinhos nomes e
  caminhos (`docker ps --format`, `os.walk` para achar pastas de worklist).
- **Paste multi-linha + sudo**: o prompt de senha engole a linha seguinte do
  paste como senha ("I'm sorry ... I can't do that" = senha errada). Autenticar
  antes com `sudo -v`, sozinho.
- **`scp` do Mac para a VM recusado (publickey)** — a sessão interativa do
  usuário na VM não vem do terminal do Mac. Plano B universal: colar o arquivo
  inteiro via `cat > arquivo <<'EOF'` no terminal da VM.
- O toast de sucesso do app cobre só **gravar o `.wl`** — a consulta do aparelho
  é outra etapa, com outras permissões (`AllowFindWorklist`). Sucesso no app +
  erro no aparelho = olhar o log do Orthanc, que diz a causa exata na hora.

## Correções relacionadas na mesma sessão (app)

- Data do `.wl` **nunca sai no passado** (`syncExamToOrthancWorklist` usa hoje,
  ou futuro para agendamento) — `examDate` editado para trás (correção da data
  do laudo) não faz mais o exame "sumir" do aparelho com toast de sucesso.
- Reenvio ↻ da worklist passa `clinicId` (seleção correta do aparelho padrão) e
  documenta que a data de reenvio é intencionalmente a de hoje.
- `generate_wl.py` grava o `.wl` de forma **atômica** (`.tmp` + `os.replace`) —
  um arquivo truncado derrubava a consulta de worklist inteira do aparelho.
