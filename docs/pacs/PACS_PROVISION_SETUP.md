# 🔌 Como conectar as credenciais do provisionador PACS (F2)

> Depois destes passos, o botão **"Criar meu PACS"** deixa de ser Demo e passa a
> criar uma **VM real** no Google Cloud, autoconfigurando o app sozinho.
>
> Endpoint: [`api/pacs-provision.ts`](../../api/pacs-provision.ts). Enquanto as env
> não existirem, ele opera em **modo mock** (simulado) — nada quebra.
>
> Isso vale para o plano **Dedicado** (VM própria por cliente). Starter/Pro usam
> a VM compartilhada — ver [PACS_TENANT_SETUP.md](./PACS_TENANT_SETUP.md).

---

## Visão geral do que você vai obter
| Variável de ambiente | De onde vem |
|---|---|
| `GCP_SA_KEY` | JSON da service account do Google Cloud (contém `project_id`) |
| `GCP_ZONE` | ex: `southamerica-east1-c` |
| `TAILSCALE_API_KEY` | chave da API do Tailscale (`tskey-api-…`) |
| `TAILSCALE_TAILNET` | identificador do tailnet (use `-` para o padrão) |
| `TAILSCALE_TS_NET` | domínio MagicDNS, ex: `tail861dda.ts.net` |
| `PACS_SCRIPTS_URL` | URL pública com `agent.js` e `generate_wl.py` |
| `VITE_PACS_PROVISION_ENDPOINT` | `/api/pacs-provision` (liga o modo real no cliente) |

---

## 1. Google Cloud

1. **Projeto + billing:** em [console.cloud.google.com](https://console.cloud.google.com), crie/escolha um projeto e ative o **faturamento**.
2. **Habilite a API:** "APIs e Serviços" → habilite **Compute Engine API**.
3. **Service account:** "IAM e Admin" → **Contas de serviço** → Criar:
   - Nome: `laudus-pacs-provisioner`.
   - Papel: **Compute Admin** (`roles/compute.admin`).
4. **Chave JSON:** na conta criada → "Chaves" → **Adicionar chave** → JSON. Baixa um arquivo `.json`.
   - O **conteúdo inteiro** desse arquivo é o valor de `GCP_SA_KEY`.
5. **Zona/região:** use `southamerica-east1-c` (São Paulo) em `GCP_ZONE`.

> A VM é criada **sem** service account anexada (não usa APIs GCP), então você **não** precisa do papel `iam.serviceAccountUser`.

---

## 2. Tailscale

1. **API key:** em [login.tailscale.com](https://login.tailscale.com) → **Settings → Keys** → *Generate API key*. Guarde como `TAILSCALE_API_KEY`.
2. **Tailnet:** use `-` (atalho para o tailnet do dono da chave) em `TAILSCALE_TAILNET`. (Ou o nome/org exato.)
3. **Domínio MagicDNS:** em **DNS**, veja o sufixo `xxxxx.ts.net` do seu tailnet → `TAILSCALE_TS_NET` (ex: `tail861dda.ts.net`).
4. **HTTPS + Funnel:** em **DNS**, clique **Enable HTTPS**. Em **Access controls (ACL)**, garanta o Funnel, a tag das VMs (`tag:pacs`) e a tag dos **relés dos clientes** (`tag:pacs-client`) — isolando o relé de cada cliente pra só alcançar a porta DICOM das VMs, nunca outros dispositivos da tailnet:
   ```jsonc
   {
     "tagOwners": {
       "tag:pacs": ["autogroup:admin"],
       "tag:pacs-client": ["autogroup:admin"]
     },
     "nodeAttrs": [
       { "target": ["tag:pacs"], "attr": ["funnel"] }
     ],
     "acls": [
       { "action": "accept", "src": ["tag:pacs-client"], "dst": ["tag:pacs:4242", "tag:pacs:4300-4399"] }
     ]
   }
   ```
   (`tag:pacs` é usada pela auth-key das VMs; `tag:pacs-client` é a auth-key que o provisionador gera **por cliente**, pra ele logar o próprio relé — GL.iNet ou PC — sem precisar da sua conta. A regra de `acls` restringe: quem tem `tag:pacs-client` só alcança a porta DICOM fixa das VMs dedicadas (4242) e a faixa de portas dos tenants na VM compartilhada (4300–4399) — nada além disso, nem SSH, nem outros dispositivos seus.)

   > **Isolamento entre clientes:** hoje todos os relés de clientes compartilham a mesma tag (`tag:pacs-client`) — o Tailscale exige que toda tag já exista em `tagOwners` antes de virar uma auth-key, então não dá pra criar 1 tag por cliente automaticamente. Isso já impede um relé de cliente de alcançar qualquer coisa fora do PACS (seu Mac, outras VMs, etc.). Um cliente mal-intencionado ainda poderia, em teoria, tentar a porta DICOM de OUTRO tenant na VM compartilhada — mas o Orthanc de cada tenant só responde a aparelhos registrados em `DicomModalities` (feito pelo próprio cliente, via "Conectar meu ultrassom"), então isso funciona como uma segunda camada de defesa.

---

## 3. Hospedar os scripts do agente (`PACS_SCRIPTS_URL`)

A VM baixa `agent.js` e `generate_wl.py` no primeiro boot. Aponte `PACS_SCRIPTS_URL` para uma base pública que sirva **exatamente esses dois arquivos**:

- **Opção fácil — GitHub raw:** se o repositório for público:
  `https://raw.githubusercontent.com/Pires18/LAUDUS/main/scripts`
- **Opção robusta — bucket GCS público:** suba `agent.js` e `generate_wl.py` num bucket e use a URL pública da pasta.

> Teste: `curl $PACS_SCRIPTS_URL/agent.js` deve retornar o código do agente.

---

## 4. Configurar as variáveis

### Na Vercel (produção)
Project → **Settings → Environment Variables** → adicione todas as da tabela.
- `GCP_SA_KEY` = cole o JSON inteiro (a Vercel aceita multilinha).
- `VITE_PACS_PROVISION_ENDPOINT` = `/api/pacs-provision` (o prefixo `VITE_` é lido pelo cliente).
- Redeploy para aplicar.

### Local (`.env`, opcional — para testar o endpoint em dev)
```
GCP_SA_KEY={"type":"service_account","project_id":"...",...}
GCP_ZONE=southamerica-east1-c
TAILSCALE_API_KEY=tskey-api-...
TAILSCALE_TAILNET=-
TAILSCALE_TS_NET=tailXXXXX.ts.net
PACS_SCRIPTS_URL=https://raw.githubusercontent.com/Pires18/LAUDUS/main/scripts
VITE_PACS_PROVISION_ENDPOINT=/api/pacs-provision
# Para forçar simulação mesmo com credenciais: PACS_MOCK=1
```
> Também são necessárias `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (já usadas pelos outros endpoints) para validar o login.

---

## 5. Testar

1. **Modo mock primeiro:** sem `GCP_SA_KEY` (ou com `PACS_MOCK=1`) → "Criar meu PACS" simula e autoconfigura. Confirma que a UX está redonda.
2. **Modo real:** com tudo configurado → "Criar meu PACS":
   - o endpoint cria a auth-key + a VM e devolve a URL do agente;
   - o card faz *polling* de `GET {agentUrl}/` por até 4 min até o Agente subir;
   - status vira **✅ Pronto** e as settings DICOM ficam preenchidas.
3. **Valide:** aba Servidores → **Executar Diagnóstico** → Imagens e Worklist verdes.
4. **Chave do relé:** no card "Conectar meu ultrassom", confirme que apareceu a caixa "Chave para logar o relé". Se não aparecer, a geração da auth-key do cliente falhou silenciosamente (é best-effort — não derruba o provisionamento do PACS em si) — confira `TAILSCALE_API_KEY`/`TAILSCALE_TAILNET` e a tag `tag:pacs-client` na ACL (seção 2).

---

## 6. Troubleshooting
| Sintoma | Causa provável | Solução |
|---|---|---|
| `GCP token: invalid_grant` | Relógio/JSON da SA incorretos | Rebaixe a chave JSON; confira `client_email`/`private_key` |
| `GCP insert: ... 403` | Compute API off ou papel insuficiente | Habilite Compute Engine API; papel Compute Admin |
| `Tailscale key: ...` | API key inválida ou tag ausente | Regenere a key; adicione `tag:pacs` na ACL |
| VM criada mas Agente não responde | Funnel/HTTPS não habilitados ou scripts não baixaram | Habilite HTTPS+Funnel; teste `PACS_SCRIPTS_URL`; veja `serial-port` logs da VM no GCP |
| Card fica em "provisionando" | Boot demora (1ª vez ~3–4 min) | Aguarde; use "Tentar novamente"; veja logs de boot da VM |
| Card não mostra a chave do relé | `tag:pacs-client` ausente na ACL, ou `TAILSCALE_API_KEY`/`TAILSCALE_TAILNET` faltando | Adicione a tag na ACL (seção 2); confira as env — a falha é silenciosa (best-effort), não trava o resto do provisionamento |

---

## 7. Custos e status

- Custo por VM: ver §7 do [PLANO_PACS_AUTOMACAO_SELF_SERVICE.md](../roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md).
- **F1 (imagem dourada):** ✅ feito e em produção — a VM dedicada sobe com Docker/Tailscale/Orthanc pré-instalados (boot ~3 min, era ~6 min).
- **F6 (lifecycle):** ✅ feito — `api/reset-monthly-reports.ts` suspende o PACS quando a assinatura cancela/expira (período de graça), reativa se o cliente voltar antes do prazo, e destrói de vez (VM/tenant) se o prazo vencer.
