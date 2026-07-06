# 🖥️ PACS / DICOM no LAUD.US — Manual Prático de Configuração

**Versão 3.0 · Foco: fácil e rápido.** Este guia monta um PACS (servidor de imagens) do zero e o integra ao LAUD.US — **localmente** ou **pela nuvem (Vercel) via Tailscale** — com o mínimo de burocracia.

> **A maioria dos usuários não precisa deste manual.** Se você só quer usar o
> PACS/DICOM no LAUD.US, clique em **"Criar meu PACS"** dentro do app (aba
> Servidores & Conexão) — a VM/tenant é criada e configurada sozinha, e o guia
> in-app (aba "Guia de Configuração") já traz os valores certos pro seu caso.
> Este documento é para quem quer montar e manter o **próprio Orthanc** (fora
> do PACS gerenciado do LAUD.US) — instalação local ou VM própria manual.

> **Filosofia deste manual:** priorizamos praticidade. A segurança é **opcional** e fica concentrada na seção 9. No caminho rápido, o Orthanc roda sem senha e o Agente roda aberto — suficiente para a maioria das clínicas em rede fechada.

---

## 🧭 Como funciona (visão em 30 segundos)

```
Aparelho de US ──DICOM(4242)──► Orthanc (porta 8042)  ◄── lê arquivos .wl
                                     ▲
                                     │ localhost
                        Agente LAUD.US (porta 3000)  ── grava .wl / faz proxy das imagens
                                     ▲
     navegador (local ou Vercel) ────┘  (direto na rede local, OU via Tailscale Funnel)
```

- **Orthanc** = o servidor PACS (guarda as imagens, lê a worklist).
- **Agente LAUD.US** (`scripts/agent.js`) = a ponte. Grava a worklist (`.wl`) e faz proxy das imagens do Orthanc para o navegador. **É o único componente que você expõe.**
- **Tailscale Funnel** = dá um endereço HTTPS público ao Agente, sem abrir portas no roteador e sem certificados manuais.

Cada usuário do LAUD.US tem **o seu próprio** Orthanc + Agente e cadastra isso nas configurações individuais dele.

---

## ⚡ Setup Rápido (checklist)

1. **Instalar** Orthanc + Node.js + Python (com `pydicom`). → seção 1
2. **Configurar** o Orthanc (`orthanc.json` mínimo). → seção 2
3. **Rodar** o Agente: `node scripts/agent.js`. → seção 3
4. Escolher o método:
   - **Rede local?** → seção 4 (nada mais a fazer).
   - **Nuvem/Vercel?** → seção 5 (um comando de Tailscale Funnel).
5. **Preencher** os campos DICOM no LAUD.US e clicar **Testar Conexão**. → seção 6
6. **Apontar** o aparelho de ultrassom para o Orthanc. → seção 7

Tempo estimado: **15–20 min** na primeira vez.

---

## 1. Instalação (uma vez por máquina)

Tudo roda na **máquina servidora** da clínica (o computador que fica ligado).

### 1.1 Orthanc (o PACS)
- **Windows:** baixe o instalador oficial do Orthanc e marque **"Install as a Windows Service"** (para iniciar sozinho com o PC).
- **macOS:** `brew install orthanc && brew services start orthanc`

### 1.2 Node.js (roda o Agente)
- Baixe o Node LTS em nodejs.org (Windows) ou `brew install node` (macOS). Confirme: `node --version`.

### 1.3 Python + pydicom (gera a worklist)
A geração dos arquivos `.wl` usa um script Python (`scripts/generate_wl.py`).
- **Windows:** instale o Python 3 marcando **"Add python.exe to PATH"**. Depois: `pip install pydicom`
- **macOS:** `brew install python && pip3 install pydicom`

> Sem `pydicom`, o envio de worklist falha (as imagens continuam funcionando). O Agente avisa no erro.

---

## 2. Configurar o Orthanc (`orthanc.json`)

Abra o arquivo de configuração:
- **Windows:** `C:\Program Files\Orthanc Server\Configuration\orthanc.json`
- **macOS (brew):** `/opt/homebrew/etc/orthanc/orthanc.json` (ou `/usr/local/etc/orthanc/`)

### 2.1 Configuração mínima (caminho rápido, sem senha)

```jsonc
{
  "Name": "PACS LAUDUS",
  "HttpPort": 8042,
  "HttpServerEnabled": true,
  "DicomServerEnabled": true,
  "DicomPort": 4242,
  "DicomAet": "ORTHANC",

  // Caminho rápido: SEM autenticação (rede fechada da clínica).
  "AuthenticationEnabled": false,
  "RemoteAccessAllowed": true,

  // Aceita imagens e worklist de qualquer aparelho (prático):
  "DicomAlwaysAllowEcho": true,
  "DicomAlwaysAllowStore": true,
  "DicomAlwaysAllowFind": true,

  // Plugin de Worklist — pasta onde o Agente grava os .wl:
  "Worklists": {
    "Enable": true,
    "Database": "PASTA_DA_WORKLIST_AQUI"
  }
}
```

Troque `PASTA_DA_WORKLIST_AQUI` por (crie a pasta se não existir):
- **Windows:** `C:\\OrthancServer\\db\\WorklistsDatabase\\`
- **macOS:** `/Users/SEU_USUARIO/OrthancServer/db/WorklistsDatabase/`

> Esse é **o mesmo caminho** que você vai colar no campo "Pasta da Worklist" do LAUD.US (seção 6). É o único ponto que precisa bater exatamente.

Salve e **reinicie o Orthanc** (Windows: `services.msc` → Orthanc → Reiniciar / macOS: `brew services restart orthanc`).

### 2.2 Cadastrar os aparelhos por nome (obrigatório para a Worklist)
`DicomAlwaysAllowFind: true` libera **C-ECHO** e consultas normais de C-FIND, mas
**NÃO cobre a Worklist** — o plugin de Worklist tem sua própria checagem
(`AllowFindWorklist`), separada. Sem o aparelho cadastrado aqui, o Orthanc
aceita o Echo mas rejeita a consulta de Worklist com "This AET is not listed in
configuration option DicomModalities" (confirmado em produção). Cadastre cada
aparelho:
```jsonc
"DicomModalities": {
  "US_SALA_01": { "AET": "MINDRAYMX7", "Host": "192.168.1.150", "Port": 104, "AllowEcho": true, "AllowFind": true, "AllowFindWorklist": true, "AllowStore": true }
}
```
Ou registre em tempo real (sem editar o arquivo nem reiniciar o Orthanc) via REST:
```bash
curl -X PUT http://localhost:8042/modalities/us_sala_01 \
  -H "Content-Type: application/json" \
  -d '{"AET":"MINDRAYMX7","Host":"192.168.1.150","Port":104,"AllowEcho":true,"AllowFind":true,"AllowFindWorklist":true,"AllowStore":true}'
```
No modelo de PACS gerenciado do LAUD.US (self-service), isso é **automático** — o
card "Conectar meu ultrassom" faz essa chamada por você.

---

## 3. O Agente LAUD.US

Na pasta do projeto, rode:
```bash
node scripts/agent.js
```
Deve aparecer: `LAUD.US Local Agent rodando na porta 3000`. **Deixe rodando.**

### 3.1 Manter rodando sempre (recomendado)
- **Windows (NSSM):** `nssm install LaudusLocalAgent` → Path: `node.exe`, Startup dir: pasta do projeto, Arguments: `scripts/agent.js` → Install → inicie em `services.msc`.
- **macOS (launchd):** crie `~/Library/LaunchAgents/com.laudus.agent.plist` apontando para `node` + o caminho do `agent.js` com `RunAtLoad` e `KeepAlive` = true, e `launchctl load -w` nele.

### 3.2 Variáveis opcionais do Agente
| Variável | O que faz |
|---|---|
| `PORT` | Porta do agente (padrão 3000). |
| `LAUDUS_WORKLIST_DIR` | Força a pasta de gravação da worklist (ignora o que o app manda). |
| `LAUDUS_ALLOWED_HOSTS` | Restringe o proxy a estes hosts (ex: `localhost,127.0.0.1`). |
| `LAUDUS_AGENT_SECRET` | Exige um segredo (ver seção 9 — opcional). |

Sem nenhuma delas, o agente roda no modo mais prático (aberto, pasta padrão `~/OrthancServer/db/WorklistsDatabase/`).

---

## 4. Método A — Rede Local (mesma Wi-Fi/cabo)

Se o navegador do médico e o aparelho estão na **mesma rede** do servidor: **não precisa de mais nada.** O LAUD.US acessado por `http://localhost` (ou pelo IP local da máquina) conversa direto com o Orthanc/Agente. Pule para a seção 6 usando:
- URL do Orthanc: `http://localhost:8042` (ou `http://IP_DA_MAQUINA:8042` se acessar de outro PC da rede).

---

## 5. Método B — Nuvem / Vercel (via Tailscale Funnel)

Quando você acessa o LAUD.US pela internet (`laud.us`/Vercel, HTTPS), o navegador **bloqueia** chamadas HTTP locais. A solução mais simples: dar um endereço **HTTPS público** ao Agente com **Tailscale Funnel** — sem abrir portas no roteador e sem gerar certificados à mão.

### 5.1 Passos
1. Instale o **Tailscale** na máquina servidora e faça login (mesma conta).
2. No painel do Tailscale, habilite **MagicDNS** e **HTTPS Certificates** (Settings → DNS). *(uma vez por tailnet)*
3. Exponha **o Agente** (porta 3000) — **não** o Orthanc, **não** o Vite:
   ```bash
   tailscale funnel --bg 3000
   ```
4. O Tailscale te dá uma URL pública, tipo:
   `https://servidor-mac.tailXXXX.ts.net`

Pronto. Essa URL é o que você cola em "URL do Agente Local" no LAUD.US. O Agente cuida do resto (proxy das imagens do Orthanc em `localhost` + gravação da worklist).

> **Por que Funnel do Agente e não do Orthanc?** Assim você expõe **um só** componente (o Agente), que já fala com o Orthanc localmente. Dispensa `tailscale cert`, combinar arquivos `.pem` e habilitar SSL no Orthanc — toda a burocracia da versão antiga deste manual.

---

## 6. Configurar no LAUD.US (Configurações → PACS / DICOM)

Preencha e clique em **"Testar Conexão PACS"** (o botão valida tudo na hora).

### Configuração recomendada — modelo Agente + Funnel (nuvem)
| Campo | Valor |
|---|---|
| **URL do Agente Local** | `https://servidor-mac.tailXXXX.ts.net` (a URL do Funnel) |
| **URL do Orthanc / Viewer** | `http://localhost:8042` (o Agente resolve localmente) |
| **URL Pública Tailscale** | *(deixe vazio)* — assim as imagens passam pelo Agente |
| **Usuário / Senha do Orthanc** | *(vazio, se sem senha)* |
| **Pasta da Worklist** | o **mesmo** caminho do `Worklists.Database` do Orthanc (seção 2.1) |
| **AE Title do Orthanc** | `ORTHANC` |

### Configuração — modelo Rede Local (on-premise)
| Campo | Valor |
|---|---|
| **URL do Agente Local** | *(vazio)* — usa o agente same-origin/local |
| **URL do Orthanc / Viewer** | `http://localhost:8042` (ou `http://IP_LOCAL:8042`) |
| **Pasta da Worklist** | mesma pasta do `Worklists.Database` |

> Ao salvar, o LAUD.US valida e mostra a versão do Orthanc se a conexão funcionar. Se der erro, veja a seção 8.

---

## 7. Configurar o aparelho de ultrassom

No menu DICOM do aparelho (Mindray, GE, Samsung…):

### 7.1 Worklist (lista de trabalho)
- **IP:** IP local da máquina do Orthanc (ex: `192.168.1.100`)
- **Porta:** `4242`
- **AE Title (remoto):** `ORTHANC`
- **AE Title (local do aparelho):** o nome do aparelho (ex: `MINDRAYMX7`)
- Clique **Verify/Test** → deve dar sucesso.

### 7.2 Envio de imagens (Storage)
- Mesmos dados (IP, `4242`, `ORTHANC`). Verify/Test.

> O aparelho fala com o **Orthanc** direto na rede local (porta 4242) — isso é sempre local, independentemente de você usar nuvem ou não.

---

## 8. Testar e diagnosticar

1. **No app:** botão **"Testar Conexão PACS"** → mostra a versão do Orthanc = conexão OK.
2. **Worklist:** crie um agendamento/exame → confira se surgiu um `agendamento_XXX.wl` na pasta da worklist.
3. **No aparelho:** faça uma busca de worklist → o paciente deve aparecer.
4. **Imagens:** finalize um exame no aparelho → as fotos aparecem no editor do LAUD.US.

---

## 9. Troubleshooting (problemas comuns)

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Testar" falha na nuvem | Agente não exposto / Funnel caiu | `tailscale funnel status`; rode `tailscale funnel --bg 3000` de novo |
| Imagens não carregam (nuvem) | "URL Pública Tailscale" preenchida indevidamente | Deixe-a **vazia**; URL do Orthanc = `http://localhost:8042` |
| Aparelho: "No worklists found" | Pasta da worklist diverge OU sem `.wl` | Confira se `Worklists.Database` (Orthanc) == "Pasta da Worklist" (app); veja se o `.wl` foi criado |
| **C-ECHO ok, mas Worklist dá "query error"** | Aparelho não registrado em `DicomModalities` — Echo é sempre liberado, Worklist não | Cadastre o aparelho (seção 2.2). No PACS gerenciado, isso é automático pelo card "Conectar meu ultrassom" |
| Worklist falha com erro de Python | `pydicom` não instalado | `pip install pydicom` (ou `pip3`) |
| Aparelho não conecta na 4242 | Firewall, OU rota de sub-rede Tailscale não aceita pelo servidor (se o relé for um subnet router) | Libere a porta **4242** (entrada) no firewall; se usar relé Tailscale (GL.iNet/roteador), rode `tailscale up --accept-routes` no servidor Orthanc |
| Mixed Content no console | App HTTPS tentando HTTP local | Use o método Tailscale Funnel (seção 5) |
| Agente escreve `.wl` no lugar errado | Pasta padrão diferente do Orthanc | Preencha "Pasta da Worklist" no app **ou** defina `LAUDUS_WORKLIST_DIR` no agente |

---

## 10. (Opcional) Segurança — fechar o Agente na internet

O Funnel deixa o Agente **público**. No caminho rápido ele fica aberto (qualquer um que descubra a URL pode usá-lo como proxy). Se quiser fechar — **recomendado se você funelar em produção** — ative o segredo do Agente (por usuário):

1. Inicie o Agente com um segredo:
   ```bash
   # macOS/Linux
   export LAUDUS_AGENT_SECRET="$(openssl rand -hex 32)"
   node scripts/agent.js     # deve logar "🔒 Autenticação ATIVA"
   ```
2. No LAUD.US → Configurações → PACS/DICOM → campo **"Segredo do Agente"** → cole **o mesmo valor** → salve.
3. (Opcional, reforço) no Agente:
   - `LAUDUS_ALLOWED_HOSTS="localhost,127.0.0.1"` → o proxy só alcança o seu Orthanc.
   - `LAUDUS_WORKLIST_DIR="/caminho/WorklistsDatabase/"` → trava a pasta de gravação.

Sem o segredo correto, o Agente responde **401** a qualquer requisição. Se você **não** definir segredo, tudo continua funcionando aberto (opt-in).

> Você também pode ligar a senha do Orthanc (`"AuthenticationEnabled": true` + `RegisteredUsers`) e preencher usuário/senha nos campos DICOM do app.

---

## Anexo — Portas e componentes
| Componente | Porta | Exposto? |
|---|---|---|
| Orthanc (API HTTP) | 8042 | Só localmente (o Agente acessa) |
| Orthanc (DICOM) | 4242 | Só na rede local (aparelho de US) |
| Agente LAUD.US | 3000 | Local (Método A) ou via Funnel (Método B) |

**Regra de ouro:** exponha **só o Agente (3000)** via Funnel. Nunca funele o Vite (5173) nem o Orthanc diretamente.
