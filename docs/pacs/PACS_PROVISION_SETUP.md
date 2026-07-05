# 🔌 Como conectar as credenciais do provisionador PACS (F2)

> Depois destes passos, o botão **"Criar meu PACS"** deixa de ser Demo e passa a
> criar uma **VM real** no Google Cloud, autoconfigurando o app sozinho.
>
> Endpoint: [`api/pacs-provision.ts`](../api/pacs-provision.ts). Enquanto as env
> não existirem, ele opera em **modo mock** (simulado) — nada quebra.

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
4. **HTTPS + Funnel:** em **DNS**, clique **Enable HTTPS**. Em **Access controls (ACL)**, garanta o Funnel e a tag `tag:pacs`:
   ```jsonc
   {
     "tagOwners": { "tag:pacs": ["autogroup:admin"] },
     "nodeAttrs": [
       { "target": ["tag:pacs"], "attr": ["funnel"] }
     ]
   }
   ```
   (A tag `tag:pacs` é usada pela auth-key que o provisionador gera; o atributo `funnel` permite o `tailscale funnel` do agente.)

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

---

## 6. Troubleshooting
| Sintoma | Causa provável | Solução |
|---|---|---|
| `GCP token: invalid_grant` | Relógio/JSON da SA incorretos | Rebaixe a chave JSON; confira `client_email`/`private_key` |
| `GCP insert: ... 403` | Compute API off ou papel insuficiente | Habilite Compute Engine API; papel Compute Admin |
| `Tailscale key: ...` | API key inválida ou tag ausente | Regenere a key; adicione `tag:pacs` na ACL |
| VM criada mas Agente não responde | Funnel/HTTPS não habilitados ou scripts não baixaram | Habilite HTTPS+Funnel; teste `PACS_SCRIPTS_URL`; veja `serial-port` logs da VM no GCP |
| Card fica em "provisionando" | Boot demora (1ª vez ~3–4 min) | Aguarde; use "Tentar novamente"; veja logs de boot da VM |

---

## 7. Custos e próximos passos
- Custo por VM: ver §7 do [PLANO_PACS_AUTOMACAO_SELF_SERVICE.md](./PLANO_PACS_AUTOMACAO_SELF_SERVICE.md).
- **F1 (imagem dourada)** vai acelerar o boot (de ~4 min para ~1 min) — o `startup-script` atual já funciona sem ela.
- **F6 (lifecycle)** liga o provisionamento ao evento de compra do add-on PACS (hook AbacatePay).
