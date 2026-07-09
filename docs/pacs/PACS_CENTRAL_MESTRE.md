# 🎛️ Central PACS/DICOM — Documento Mestre

> **O que é isto:** o ponto de entrada único pra tudo relacionado a PACS/DICOM no
> LAUD.US — mapa da documentação, checklist de configuração "irretocável" (do
> zero até produção segura), hardening, bugs corrigidos e riscos residuais.
> Escrito em 08-09/07/2026, consolidando o incidente real de suporte do MX7
> (ver `incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md`) e a auditoria completa que ele
> disparou. **Leia isto antes de tocar em qualquer coisa de PACS** — economiza
> repetir um dia inteiro de troubleshooting.

---

## 1. Mapa da documentação (o que ler, em que ordem)

| Documento | Pra quê serve | Status |
|---|---|---|
| **`PACS_TENANT_SETUP.md`** | Runbook de operação da VM compartilhada multi-tenant (`orthanc-server`) — o modelo **real em produção**. Setup de tenant, relé, e o roteiro de diagnóstico de 10 passos. | 🟢 Autoritativo — leia primeiro se for mexer em infra |
| **`PACS_PROVISION_SETUP.md`** | Variáveis de ambiente/credenciais do provisionador automático (`api/pacs-provision.ts`), plano **Dedicado** (1 VM por cliente, com anexo da arquitetura da VM/docker-compose), e a policy ACL canônica do Tailscale (com o fix de `grants`). | 🟢 Autoritativo — leia se for mexer em provisionamento ou ACL |
| **`PACS_MANUAL.md`** | Manual prático de setup **standalone** (Orthanc próprio, fora do PACS gerenciado). Só relevante pra quem NÃO usa o "Criar meu PACS" do app. | 🟢 Atual, mas escopo secundário — não confundir com o modelo gerenciado |
| **`PLANO_PACS_VM_COMPARTILHADA.md`** | Desenho original da VM compartilhada — **a arquitetura que roda em produção hoje**. Movido para `docs/pacs/` nesta reorganização (antes estava em `archive/`, o que escondia um documento vivo). | 🟢 Histórico, mas conteúdo ainda vigente |
| **`incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md`** | Postmortem do incidente real que originou este documento — 5 causas raiz empilhadas, cada uma mascarando a próxima. Primeiro de uma pasta dedicada a postmortems (`docs/pacs/incidents/`). | 🟢 Leitura obrigatória antes de investigar timeout/conexão |
| `docs/roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md` | Roadmap de automação self-service (provisionamento, admin fleet, pricing). Itens concluídos marcados; só o que resta aberto está destacado. | 🟡 Planejamento, não operação — ver também [`docs/BACKLOG.md`](../BACKLOG.md) |
| `docs/archive/PROJETO_PACS_NUVEM.md` | Desenho arquitetural **histórico** (1 VM dedicada por usuário). | 🔴 Arquivado — o próprio arquivo já se marca como tal no topo; o essencial da VM Dedicada foi resumido em `PACS_PROVISION_SETUP.md` |

**Regra prática:** se o assunto é "como funciona hoje / como diagnosticar um problema real", vá em `PACS_TENANT_SETUP.md`. Se é "como configurar do zero", siga a seção 3 deste documento (que já incorpora tudo). Se é "por que essa decisão foi tomada", os docs históricos têm o contexto. Se é "o que ainda falta fazer", veja [`docs/BACKLOG.md`](../BACKLOG.md).

---

## 2. Arquitetura real em produção (resumo)

```
                    ┌─────────────────────────────────────────────┐
                    │   VM COMPARTILHADA "orthanc-server" (GCP)    │
                    │                                               │
                    │   ┌──────────────┐  ┌──────────────┐         │
                    │   │ orthanc-t1da0af │ orthanc-t016a98 │  ...  │  ← 1 container Orthanc
                    │   │  HTTP 8103    │  │  HTTP 8102    │         │     por tenant
                    │   │  DICOM 4303   │  │  DICOM 4302   │         │
                    │   └──────────────┘  └──────────────┘         │
                    │          ▲                                    │
                    │   Agente LAUD.US (multi-tenant, systemd)      │
                    │          ▲                                    │
                    │   Tailscale + Funnel (HTTPS pública)          │
                    └──────────┬────────────────────────────────────┘
                               │ tailnet (100.x.y.z)
                               │
          ┌────────────────────┴──────────────────────┐
          │                                              │
   ┌──────▼───────┐                              ┌───────▼────────┐
   │ Relé GL.iNet │  (Wi-Fi/LAN da clínica)       │  navegador     │
   │ DNAT nativo  │ ◄──DICOM(porta local)──┐      │  (Vercel)      │
   └──────┬───────┘                        │      │  via Funnel    │
          │                                 │      └────────────────┘
   ┌──────▼───────┐
   │  Aparelho US  │
   │  (MX7, etc.)  │
   └───────────────┘
```

**Pontos-chave que mudaram/foram confirmados no incidente de 08/07:**
- Cada tenant = 1 container Orthanc isolado, porta HTTP `81xx` / DICOM `43xx` (mesmo índice `xx`).
- O relé (GL.iNet) **não usa mais subnet-routing por padrão** — usa DNAT via a conexão nativa do próprio roteador (`scripts/glinet-pacs-relay.sh`), mais robusto. Subnet-routing continua documentado como método alternativo, mas com aviso de que pode falhar silenciosamente.
- `dicomTenantId` nas settings do usuário **precisa bater exatamente** com o tenant que o relé físico alcança — são dois sistemas independentes sem checagem cruzada automática (mitigado parcialmente pelo badge novo no app, ver seção 5).

---

## 3. Checklist de configuração "irretocável" (do zero à produção)

Siga nessa ordem exata. Cada item tem o "porquê" — não pule, cada um already causou um incidente real.

### 3.1 — Provisionar o tenant
```bash
sudo TS_NET=tail861dda.ts.net /opt/pacs-tenant.sh create        # id/plan automáticos
# anote: dicomTenantId, dicomAgentSecret, dicomLocalAgentUrl, Porta DICOM
```
☐ Guarde os 4 valores impressos — vão direto pras settings do usuário (seção 3.3).

### 3.2 — Configurar o relé (GL.iNet ou PC)

**Preferencial — GL.iNet com DNAT nativo (mais robusto, use por padrão):**
```bash
ssh root@<ip-do-roteador>
curl -fsSL https://laudus.vercel.app/pacs/glinet-pacs-relay.sh -o ~/glinet-pacs-relay.sh
chmod +x ~/glinet-pacs-relay.sh
~/glinet-pacs-relay.sh install <ip-tailnet-vm> <porta-dicom-do-tenant> 4242
```
☐ Confirme que o script imprimiu "Pronto" com o IP do roteador e a porta local.
☐ **NÃO** tente primeiro o subnet-routing nativo do Tailscale a menos que tenha tempo pra debugar — ele já falhou silenciosamente em produção mesmo 100% configurado certo (ver `PACS_TENANT_SETUP.md` §Diagnóstico, passos 7-10, e a ACL abaixo se optar por ele mesmo assim).

**Se usar subnet-routing mesmo assim (Modo A1), garanta as 2 pegadinhas:**
☐ VM aceita a rota: `sudo tailscale up --accept-routes` (idempotente, rode sempre com `--reset` se já tiver outras flags).
☐ ACL da tailnet tem o `grant` explícito por CIDR (não só a rota aprovada) — copie a policy canônica de `PACS_PROVISION_SETUP.md` §2, especialmente a linha:
  ```jsonc
  { "src": ["autogroup:member"], "dst": ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"], "ip": ["*"] }
  ```
☐ Depois de qualquer mudança de firewall no GL.iNet (toggle da UI, etc.), rode `/etc/init.d/firewall restart` — o toggle amigável nem sempre recarrega o firewall ativo.

### 3.3 — Configurar no app (Configurações → PACS/DICOM)
☐ `dicomTenantId` = **exatamente** o tenant do passo 3.1 (confira 2x — é a causa raiz mais sutil e mais fácil de errar).
☐ `dicomLocalAgentUrl` = a URL do Funnel compartilhado (`https://orthanc-server.<ts_net>`).
☐ `dicomAgentSecret` = o segredo **daquele tenant específico**, não de outro.
☐ Campo **Porta DICOM** (card "Conectar meu ultrassom") = a porta `43xx` do tenant — editável, confira que bate.
☐ Clique **"Testar Conexão PACS"** — deve mostrar a versão do Orthanc.

### 3.4 — Cadastrar o aparelho (Passo 3 do card "Conectar meu ultrassom")
☐ AE Title = o AE Title **local** configurado no próprio aparelho (não confundir com o AE Title do PACS, que é `ORTHANC`).
☐ IP = o IP do aparelho na LAN (ex: `192.168.8.50`).
☐ Depois de salvar, confira que **não aparece** o badge vermelho "Não registrado no PACS" no card — se aparecer, o registro não chegou no Orthanc certo (veja seção 5, badge novo).
☐ Confirme manualmente na VM, se quiser 100% de certeza:
  ```bash
  curl -s http://localhost:<httpPort-do-tenant>/modalities
  ```
  Deve listar o aparelho. **Ou** clique **"Executar Diagnóstico"** (aba Servidores) — o chip **"Aparelhos registrados"** faz essa mesma checagem automaticamente e aponta exatamente quais AE Titles estão faltando.

### 3.5 — Configurar o aparelho físico
☐ **Worklist e Storage**, ambos apontando pro **IP do relé** (o roteador GL.iNet, não a VM) e a **porta local** escolhida no passo 3.2 (ex: `4242`).
☐ AE Title remoto = `ORTHANC`.
☐ AE Title local = o mesmo cadastrado no passo 3.4.
☐ Rode **Verify/Echo** — deve dar sucesso.
☐ Rode uma **busca de Worklist** — deve aparecer um exame agendado (crie um de teste no app antes, se necessário).

### 3.6 — Validação de ponta a ponta (não pule)
☐ Crie um exame de teste no app, **selecionando explicitamente** o aparelho cadastrado.
☐ Confirme que o `.wl` foi gerado na pasta certa do tenant.
☐ No aparelho, busque a Worklist — o paciente de teste deve aparecer.
☐ Finalize o exame no aparelho — as imagens devem aparecer no editor do LAUD.US.
☐ **Depois de qualquer troubleshooting que redirecionou o caminho físico do DICOM** (DNAT, subnet route, troca de tenant), **varra o tenant "errado" por estudos órfãos** antes de fechar o caso — exames reais podem ter subido lá silenciosamente durante a janela de configuração incorreta (foi exatamente o que aconteceu em 08/07 — 5 pacientes reais quase ficaram perdidos). Script rápido em `incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md` §Desfecho.

---

## 4. Hardening de segurança (checklist consolidado)

☐ **Firewall GCP:** nenhuma regra pública de entrada pra `8042/4242/3000/43xx` — só acessível via tailnet.
  ```bash
  gcloud compute firewall-rules list --filter="direction=INGRESS"
  ```
☐ **`/opt/tenants` com permissão 0700** e, se possível, em disco dedicado (`pacs-harden.sh`).
☐ **Logs do Docker limitados** (10m×3) — evita disco cheio silencioso.
☐ **Snapshots diários** do disco de dados, retenção 14 dias.
☐ **Segredo do Agente por tenant** (`dicomAgentSecret`) — nunca reutilizar entre tenants.
☐ **ACL do Tailscale restringe `tag:pacs-client`** só à porta DICOM das VMs — nunca dar acesso amplo ao relé de um cliente.
☐ **Rotação de segredos** que apareceram em qualquer sessão de suporte/chat (GCP, Tailscale, agente) — trate como comprometidos após uso em texto plano numa conversa.
☐ **Orthanc sem autenticação** é aceitável **apenas** porque o acesso é 100% via tailnet privada (nunca exposto publicamente) — não abra a porta 8042/4242 pro mundo mesmo "só pra testar".
☐ **`DicomModalities` por tenant** — nunca compartilhar registro de aparelho entre tenants (segunda camada de defesa contra um cliente mal-intencionado tentando acessar dados de outro).

---

## 5. O que foi corrigido nesta sessão (08-09/07/2026)

Relato completo em `incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md`. Resumo dos fixes que viraram produto (não ficam só no relato):

| Fix | Onde | O que resolve |
|---|---|---|
| ACL com `grant` explícito por CIDR | `PACS_PROVISION_SETUP.md` §2 (policy canônica) | Rota de sub-rede aprovada mas nunca propagada — causa raiz nº3 do incidente |
| Roteiro de diagnóstico expandido (10 passos) | `PACS_TENANT_SETUP.md` §Diagnóstico | Cobre firewall de zona do GL.iNet, teste "limpo" sem Tailscale local, plano B |
| `scripts/glinet-pacs-relay.sh` | Novo script, publicado em `/pacs/` | Contorno robusto quando subnet-routing falha silenciosamente — DNAT via conexão nativa do roteador |
| Badge "Não registrado no PACS" | `UltrasoundSetupCard.tsx` | Detecta na hora quando `dicomTenantId` diverge do tenant que o app realmente alcança — causa raiz nº5 |
| **`aeTitle` do Worklist usa o aparelho, não o Orthanc** | `src/utils/dicom.ts:106,144` | **Bug adicional achado na auditoria pós-incidente** (não fazia parte do incidente original): `settings.dicomOrthancAETitle` (identidade do PACS) tinha prioridade sobre `targetDevice.aeTitle` (identidade do aparelho selecionado) no campo que vira `ScheduledStationAETitle` do `.wl`. Assim que o PACS gerenciado é provisionado, `dicomOrthancAETitle` sempre tem valor (`'ORTHANC'`) — **todo exame gravava a mesma AE Title, não importa qual aparelho foi escolhido no formulário**, tornando o seletor de aparelho decorativo em qualquer conta com múltiplos aparelhos. Corrigido: `aeTitle` agora é sempre `targetDevice.aeTitle`, tanto no envio primário quanto no de backup |
| `generate_wl.py` exige `aeTitle` explicitamente | `scripts/generate_wl.py` | Removido o fallback silencioso `'MINDRAYMX7'` — sem `aeTitle` no payload, agora falha alto (erro claro) em vez de gravar um `.wl` pro aparelho errado sem avisar ninguém |
| Chip **"Aparelhos registrados"** no Diagnóstico de Rede | `DicomControlCenter.tsx` (`testDevices`) | "Executar Diagnóstico" agora também consulta `DicomModalities` do PACS ativo e aponta quais aparelhos cadastrados não estão lá — visibilidade ativa e central, não só o badge no card de aparelhos |

---

## 6. Riscos residuais conhecidos (não automatizados ainda)

Ordenados por prioridade sugerida:

1. ~~[Médio] Fallback oculto em `generate_wl.py:65`~~ **[Resolvido 09/07]** — agora exige `aeTitle` explicitamente, falha alto se ausente.
2. ~~[Médio] Nenhuma verificação server-side de consistência de tenant~~ **[Mitigado 09/07]** — chip "Aparelhos registrados" no "Executar Diagnóstico" agora confere isso ativamente e centralmente, não só via o badge do card de aparelhos. (Ainda é client-side, não server-side — só roda quando o usuário clica; uma verificação real server-side segue como melhoria futura, não crítica.)
3. **[Baixo] Subnet-routing via GL.iNet sem causa raiz 100% confirmada** — o contorno (DNAT) resolve na prática e virou o método recomendado, mas se o mesmo sintoma aparecer noutro cliente/firmware, vale investir tempo pra isolar a causa real (MTU, versão de firmware, bug conhecido do Tailscale com OpenWrt) em vez de só aplicar o plano B toda vez.
4. **[Baixo] `syncModalityInOrthanc` sem fallback pro servidor de backup** — aceitável hoje (backup é redundância manual), mas revisitar se o backup passar a ser promovido automaticamente em algum fluxo futuro.
5. **[Baixo] Docs históricos com decisões desatualizadas não sinalizadas** — achado durante a auditoria: `PROJETO_PACS_NUVEM.md` registra "1 VM por usuário" como decisão **aprovada/travada**, mas a arquitetura que realmente foi pra produção (VM compartilhada) está descrita num arquivo em `archive/` que uma triagem anterior rotulou como "descartado" — já corrigido nesta sessão (`archive/PLANO_FINAL_PRODUCAO_2026-07.md`). Passe geral pelo resto de `archive/` em andamento — ver seção 8.

---

## 7. Roadmap de aprimoramento sugerido

**Curto prazo (baixo esforço, alto retorno):**
- [x] Endpoint `/api/worklist` (ou `generate_wl.py`) passa a **exigir** `aeTitle` explicitamente (erro claro em vez de fallback silencioso) — mitigou risco residual #1. *(09/07)*
- [x] "Executar Diagnóstico" no app ganha um passo de **checagem de aparelhos registrados** (`DicomModalities` do PACS ativo) — mitigou risco residual #2. *(09/07)*
- [x] Correção pontual em `archive/PLANO_FINAL_PRODUCAO_2026-07.md` (decisão desatualizada sobre a arquitetura de VM). Passe geral pelo resto de `archive/` — ver seção 8. *(09/07)*

**Médio prazo:**
- [ ] Automatizar a varredura de "estudos órfãos" (seção 3.6) como um botão/rotina no painel admin, em vez de script manual — reduz risco de perder exames reais em futuros troubleshootings.
- [ ] Investigar a causa raiz real do subnet-routing GL.iNet (risco residual #3) se o padrão se repetir em outro cliente — hoje é só contornado.
- [ ] Considerar promover automaticamente o servidor de backup se o primário cair (hoje é 100% manual).
- [ ] Tornar a checagem de "Aparelhos registrados" (seção 5) server-side/automática (ex: cron ou trigger pós-provisionamento), não só sob demanda quando o usuário clica em "Executar Diagnóstico".

**Já coberto por este documento + os 4 docs canônicos** — não precisa replanejar: setup de tenant, relé (DNAT e subnet-routing), ACL, hardening básico, diagnóstico de conectividade, e o fluxo de cadastro de aparelho/Worklist.

---

## 8. Auditoria de docs históricos (decisões desatualizadas)

Passe de revisão em `docs/archive/` procurando o mesmo padrão do item já corrigido (`PLANO_FINAL_PRODUCAO_2026-07.md`, seção 5): uma afirmação registrada como final/descartada/faltante que a realidade depois contradisse, sem nota de correção.

**5 achados confirmados e já corrigidos** (2 rodadas de auditoria — a segunda cobriu os arquivos que a primeira não teve tempo de terminar):

1. `archive/PLANO_FINAL_PRODUCAO_2026-07.md` — rotulava a arquitetura de VM compartilhada como "alternativa descartada" quando na verdade é o modelo real em produção.
2. `archive/AUDITORIA_INTEGRACOES_FINANCEIRO_2026-07.md:56` — afirmava que o lifecycle de VM (suspender/reativar/destruir por assinatura) estava **faltando** ("Fase 6, não implementado"); já está implementado e em produção (`api/reset-monthly-reports.ts`, ✅ feito em `PACS_PROVISION_SETUP.md`).
3. `archive/IMPROVEMENT_PLAN.md` (C6, ditado por voz) — dizia que a UI não estava acessível no editor; já está implementada (botão de microfone na toolbar do Copiloto, `LaudCopilot.tsx:1583-1592`).
4. `archive/IMPROVEMENT_PLAN.md` (C2, histórico clínico) — dizia que o histórico do paciente não era exibido no editor; já está implementado (`PatientHistoryPanel`, `ExamEditor.tsx:49-80,985-987`).
5. `archive/PLANO_PLANOS_INTERVALOS_ABACATEPAY.md` — registrava a opção (A) como escolhida e (B) como "fica pra depois"; na prática foi (B) que foi implementada (`Plan.prices: {month,semester,year}`, `types.ts:678-684`).

*(todas corrigidas nesta sessão, com nota de correção inline no formato tachado + colchetes, sem reescrever o histórico)*

**Cobertura completa:** todos os arquivos de `docs/archive/` com conteúdo de decisão/status foram revisados nas duas rodadas — `AUDITORIA_COMPLETA_2026-07.md`, `AUDITORIA_GLOBAL_2026-07.md`, `ANALISE_BUGS.md`, `PLANO_FINALIZACAO_ADMIN_2026-07.md`, `PLANO_REFINAMENTO.md`, `SYSTEM_DOCUMENTATION.md` e `plan_calculadoras_percentis_2026-06.md` foram revisados sem achados adicionais (status ali são snapshots pontuais precisos, ou itens genuinamente ainda pendentes — não afirmações "definitivas" que a realidade contradisse).
