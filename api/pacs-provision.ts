import crypto from 'crypto';
import { hasPacsEntitlement } from './_entitlements.js';
import { checkRateLimit } from './_rateLimit.js';

/**
 * POST /api/pacs-provision — provisiona (ou simula) o PACS gerenciado do usuário.
 *
 * MODO MOCK (padrão): se faltarem as env de GCP/Tailscale, devolve uma instância
 * SIMULADA — permite validar toda a UX self-service sem nuvem.
 *
 * MODO REAL: com as env configuradas, cria uma auth-key no Tailscale e uma VM no
 * Google Cloud (Debian + startup-script que sobe Orthanc + Agente + Funnel).
 * A VM leva alguns minutos para ficar de pé; o cliente faz o *polling* de saúde
 * do Agente (GET {agentUrl}/) até responder. Este endpoint retorna rápido com a
 * URL já calculada (MagicDNS) e o segredo.
 *
 * Credenciais necessárias no ambiente (Vercel → Environment Variables):
 *   GCP_SA_KEY        JSON da service account (Compute Admin). Contém project_id.
 *   GCP_ZONE          ex: southamerica-east1-c   (default)
 *   TAILSCALE_API_KEY chave da API do Tailscale (tskey-api-...)
 *   TAILSCALE_TAILNET identificador do tailnet (ex: seu-email ou org)
 *   TAILSCALE_TS_NET  domínio MagicDNS, ex: tail861dda.ts.net
 *   PACS_SCRIPTS_URL  base pública com agent.js e generate_wl.py (GitHub raw/GCS)
 *   PACS_MOCK=1       força o modo mock mesmo com credenciais (para testes)
 */

const PLAN_SPEC: Record<string, { machineType: string; dataDiskGb: number }> = {
  starter:  { machineType: 'e2-small',  dataDiskGb: 100 },
  pro:      { machineType: 'e2-small',  dataDiskGb: 300 },
  dedicado: { machineType: 'e2-medium', dataDiskGb: 300 },
};

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function rand(n: number): string {
  return crypto.randomBytes(n).toString('hex');
}

/**
 * Decide se o modo mock deve ser BLOQUEADO (erro claro) em vez de simular uma
 * instância falsa. Nunca simular silenciosamente em produção (Vercel) quando a
 * config necessária está genuinamente ausente — só quando PACS_MOCK=1 é
 * explícito (uso deliberado, ex.: smoke test) ou fora da Vercel (dev local).
 * Sem essa trava, um usuário pagando pelo plano Dedicado receberia uma VM
 * fictícia (URL que não existe) sem nenhum sinal de erro caso uma credencial
 * suma da Vercel (rotação de chave, env var apagada por engano etc.).
 */
export function shouldBlockMockInProduction(opts: { isVercel: boolean; forcedMock: boolean; configured: boolean }): boolean {
  return opts.isVercel && !opts.forcedMock && !opts.configured;
}

/** shortUid usado na composição do nome da VM dedicada (mesma regra do provision). */
export function shortUidOf(uid: string): string {
  return uid.slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Posse de uma VM dedicada: os nomes nascem como `pacs-<shortUid>-<hex>`, então
 * uma VM só pode ser destruída pelo uid cujo prefixo bate. Protege a VM
 * compartilhada (`orthanc-server`) e as VMs de outros clientes contra um
 * DELETE forjado com `instanceName` arbitrário no corpo.
 */
export function isOwnedGcpInstanceName(name: string, uid: string): boolean {
  const short = shortUidOf(uid);
  return !!short && new RegExp(`^pacs-${short}-[a-z0-9]+$`).test(name);
}

/**
 * Bloqueia um novo provisionamento quando o usuário JÁ tem uma instância real
 * registrada (server-side) e não pediu explicitamente reprovisionar — sem isso,
 * cliques repetidos (ou chamadas diretas à API) criam VMs/tenants duplicados
 * que ficam órfãos gerando custo.
 */
export function shouldRejectExistingInstance(existing: { provider?: string } | null | undefined, reprovision: boolean): boolean {
  if (!existing || reprovision) return false;
  return existing.provider === 'gcp' || existing.provider === 'shared';
}

// ── Registro server-side de posse (`pacs_instances/{uid}`) ──────────────────
// Gravado pelo próprio provisionamento e inacessível ao cliente pelas rules
// (coleção sem match = deny). É a fonte de verdade de POSSE para o DELETE:
// as settings do usuário são graváveis pelo próprio cliente e portanto não
// servem como prova de que a VM/tenant pertence a ele.
async function readInstanceRecord(uid: string): Promise<Record<string, any> | null> {
  const { getDb } = await import('./_firebase.js');
  const snap = await (await getDb()).collection('pacs_instances').doc(uid).get();
  return snap.exists ? (snap.data() as Record<string, any>) : null;
}
async function writeInstanceRecord(uid: string, data: Record<string, unknown>): Promise<void> {
  const { getDb } = await import('./_firebase.js');
  await (await getDb()).collection('pacs_instances').doc(uid).set({ ...data, updatedAt: Date.now() });
}
async function deleteInstanceRecord(uid: string): Promise<void> {
  const { getDb } = await import('./_firebase.js');
  await (await getDb()).collection('pacs_instances').doc(uid).delete();
}

// Mint de um access token OAuth do Google a partir da service account (sem deps).
async function getGcpAccessToken(sa: any, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key).toString('base64url');
  const assertion = `${header}.${claim}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data: any = await res.json();
  if (!data.access_token) throw new Error(`GCP token: ${data.error_description || JSON.stringify(data)}`);
  return data.access_token;
}

// Cria uma auth-key preautorizada do Tailscale. Usada tanto para a VM entrar
// sozinha no tailnet (tag:pacs, uso único) quanto para o RELÉ DO CLIENTE
// (tag:pacs-client, reutilizável) — assim o cliente loga o próprio
// roteador/PC na tailnet sem nunca precisar da conta/senha do operador.
async function createTailscaleAuthKey(opts: { tags: string[]; reusable?: boolean; expirySeconds?: number }): Promise<string> {
  const tailnet = process.env.TAILSCALE_TAILNET!;
  const apiKey = process.env.TAILSCALE_API_KEY!;
  const res = await fetch(`https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/keys`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capabilities: { devices: { create: { reusable: !!opts.reusable, ephemeral: false, preauthorized: true, tags: opts.tags } } },
      expirySeconds: opts.expirySeconds ?? 3600,
    }),
  });
  const data: any = await res.json();
  if (!data.key) throw new Error(`Tailscale key: ${data.message || JSON.stringify(data)}`);
  return data.key;
}

// Tag compartilhada por TODO relé de cliente (não dá para ter 1 tag por tenant
// dinamicamente — o Tailscale exige que toda tag já exista em "tagOwners" da
// ACL antes de poder ser usada numa auth-key). O isolamento entre clientes é
// feito por uma regra de ACL restringindo esta tag só à porta DICOM das VMs
// (tag:pacs) — ver docs/pacs/PACS_PROVISION_SETUP.md.
const CLIENT_RELAY_TAG = 'tag:pacs-client';

// Gera a auth-key do RELÉ do cliente — best-effort: se faltar credencial ou a
// chamada falhar, retorna undefined em vez de derrubar o provisionamento
// inteiro (o PACS em si já está pronto; o cliente pode configurar depois).
async function tryCreateRelayAuthKey(): Promise<string | undefined> {
  if (!process.env.TAILSCALE_API_KEY || !process.env.TAILSCALE_TAILNET) return undefined;
  try {
    return await createTailscaleAuthKey({ tags: [CLIENT_RELAY_TAG], reusable: true, expirySeconds: 60 * 60 * 24 * 365 });
  } catch (err) {
    console.error('[pacs-provision] falha ao gerar auth-key do relé (não bloqueia o provisionamento):', err);
    return undefined;
  }
}

// startup-script (roda na VM no 1º boot): Docker+Orthanc, Tailscale, Agente, Funnel.
// startup-script ENXUTO — a imagem dourada (laudus-pacs-v1) já traz Docker,
// Tailscale, Node, pydicom e a imagem do Orthanc pré-baixada. Aqui só injetamos
// a identidade/segredo e subimos os serviços → boot ~1 min (vs ~6 min do zero).
function buildStartupScript(hostname: string): string {
  const scriptsUrl = (process.env.PACS_SCRIPTS_URL || '').replace(/\/$/, '');
  return `#!/usr/bin/env bash
set -euo pipefail
META="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
SECRET=$(curl -s -H 'Metadata-Flavor: Google' "$META/LAUDUS_AGENT_SECRET")
TSKEY=$(curl -s -H 'Metadata-Flavor: Google' "$META/TS_AUTHKEY")
tailscale up --authkey="$TSKEY" --hostname="${hostname}" --ssh || true
mkdir -p /opt/orthanc-data/worklists /opt/orthanc /opt/laudus-agent
cat > /opt/orthanc/orthanc.json <<'JSON'
{ "Name":"PACS LAUDUS CLOUD","StorageDirectory":"/var/lib/orthanc/db","IndexDirectory":"/var/lib/orthanc/db",
  "HttpPort":8042,"HttpServerEnabled":true,"DicomServerEnabled":true,"DicomPort":4242,"DicomAet":"ORTHANC",
  "AuthenticationEnabled":false,"RemoteAccessAllowed":true,"DicomAlwaysAllowEcho":true,"DicomAlwaysAllowStore":true,
  "DicomAlwaysAllowFind":true,"StorageCompression":true,
  "Worklists":{"Enable":true,"Database":"/var/lib/orthanc/worklists"},"DicomWeb":{"Enable":true} }
JSON
docker rm -f orthanc 2>/dev/null || true
docker run -d --name orthanc --restart unless-stopped \
  -p 127.0.0.1:8042:8042 -p 0.0.0.0:4242:4242 \
  -v /opt/orthanc-data:/var/lib/orthanc/db -v /opt/orthanc-data/worklists:/var/lib/orthanc/worklists \
  -v /opt/orthanc/orthanc.json:/etc/orthanc/orthanc.json:ro orthancteam/orthanc:latest
# Agente LAUD.US (sempre baixa a versão mais recente — não fica preso à imagem)
curl -fsSL "${scriptsUrl}/agent.js" -o /opt/laudus-agent/agent.js
curl -fsSL "${scriptsUrl}/generate_wl.py" -o /opt/laudus-agent/generate_wl.py
cat > /etc/systemd/system/laudus-agent.service <<UNIT
[Unit]
Description=LAUD.US Agent
After=network-online.target docker.service
[Service]
Environment=PORT=3000
Environment=LAUDUS_AGENT_SECRET=$SECRET
Environment=LAUDUS_WORKLIST_DIR=/opt/orthanc-data/worklists
Environment=LAUDUS_ALLOWED_HOSTS=localhost,127.0.0.1
ExecStart=/usr/bin/node /opt/laudus-agent/agent.js
WorkingDirectory=/opt/laudus-agent
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now laudus-agent
tailscale funnel --bg 3000 || true
`;
}

/**
 * DELETE /api/pacs-provision — destrói de verdade o PACS gerenciado do usuário
 * (VM real no GCP ou tenant na VM compartilhada). Consolidado neste arquivo
 * (em vez de api/pacs-deprovision.ts próprio) para manter baixo o número de
 * funções serverless da Vercel. A destruição em si mora em
 * `_pacsLifecycle.ts` (compartilhada com o CRON de lifecycle automático).
 */
async function handleDeprovision(req: any, res: any) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const headerAuth = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7) : '';
  if (!token) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }));
    return;
  }
  let uid = '';
  try {
    const { getAdminAuth } = await import('./_firebase.js');
    const dec = await (await getAdminAuth()).verifyIdToken(token);
    uid = dec.uid;
  } catch {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Token inválido ou expirado.' }));
    return;
  }

  // POSSE: o alvo da destruição vem do registro server-side gravado pelo
  // próprio provisionamento — NUNCA do corpo da requisição, que é controlado
  // pelo cliente e permitiria destruir a VM/tenant de outro usuário.
  let target: { provider?: string; instanceName?: string; tenantId?: string } | null = null;
  let fromRecord = false;
  try {
    const record = await readInstanceRecord(uid);
    if (record) { target = record; fromRecord = true; }
  } catch (err) {
    // Prestes a destruir infraestrutura: sem confirmar a posse, NÃO destrói
    // (fail-closed — o oposto do fail-open de leitura dos proxies).
    console.error('[pacs-provision] registro de posse indisponível no DELETE:', err);
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Não foi possível confirmar a posse da instância. Tente novamente em instantes.' }));
    return;
  }

  // Instâncias LEGADAS (provisionadas antes do registro existir): aceita os
  // dados do corpo, mas só com prova de posse — VM dedicada carrega o uid no
  // nome; tenant compartilhado precisa bater com o dicomTenantId salvo.
  if (!target) {
    const b = body || {};
    if (b.provider === 'gcp') {
      if (!isOwnedGcpInstanceName(String(b.instanceName || ''), uid)) {
        res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'A VM informada não pertence a esta conta.' }));
        return;
      }
      target = { provider: 'gcp', instanceName: String(b.instanceName) };
    } else if (b.provider === 'shared') {
      try {
        const { getDb } = await import('./_firebase.js');
        const snap = await (await getDb()).collection('users').doc(uid).collection('settings').doc('app').get();
        const savedTenant = snap.exists ? String(snap.data()?.dicomTenantId || '') : '';
        if (!savedTenant || savedTenant !== String(b.tenantId || '')) {
          res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'O tenant informado não corresponde ao PACS configurado nesta conta.' }));
          return;
        }
      } catch (err) {
        console.error('[pacs-provision] falha ao validar tenant legado no DELETE:', err);
        res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Não foi possível confirmar a posse do tenant. Tente novamente em instantes.' }));
        return;
      }
      target = { provider: 'shared', instanceName: String(b.instanceName || ''), tenantId: String(b.tenantId) };
    } else {
      // mock/none → destroyPacsInstance devolve "nada a destruir".
      target = { provider: b.provider, instanceName: b.instanceName, tenantId: b.tenantId };
    }
  }

  const { destroyPacsInstance } = await import('./_pacsLifecycle.js');
  const result = await destroyPacsInstance(target || {});
  if (result.success && fromRecord) {
    try { await deleteInstanceRecord(uid); }
    catch (err) { console.error('[pacs-provision] falha ao apagar registro pós-destruição:', err); }
  }
  res.statusCode = result.success ? 200 : 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
  if (req.method === 'DELETE') { await handleDeprovision(req, res); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method Not Allowed' })); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // Autenticação: verifica o token (header OU corpo) no Admin SDK. O motivo
  // exato de uma falha vai só para o LOG server-side — nunca para a resposta
  // (expor projeto/código de erro ao cliente ajuda reconhecimento do ambiente).
  const headerAuth = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = (headerAuth.startsWith('Bearer ') ? headerAuth.slice(7) : '') || (body?.token ? String(body.token) : '');
  let authed: any = null;
  if (token) {
    try {
      const { getAdminAuth } = await import('./_firebase.js');
      const dec = await (await getAdminAuth()).verifyIdToken(token);
      authed = { uid: dec.uid, email: (dec.email || '').toLowerCase() };
    } catch (e: any) {
      console.warn('[pacs-provision] verifyIdToken falhou:',
        ((e?.errorInfo?.code || e?.code || 'err') + ': ' + (e?.message || '')).slice(0, 130));
    }
  }
  if (!authed) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }));
    return;
  }

  // Anti-abuso: provisionar cria infraestrutura real cobrada. Cliques
  // legítimos são raros — estourar o limite é bug do cliente ou abuso.
  if (!(await checkRateLimit(`pacs-provision:${authed.uid}`, 5, 60 * 60 * 1000))) {
    res.statusCode = 429; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Muitas tentativas de provisionamento. Aguarde um pouco e tente novamente.' }));
    return;
  }

  // Enforcement de plano: PACS é add-on pago — mesma checagem dos proxies
  // (fail-open em falha de infraestrutura; bloqueia só quando confirmado).
  if (!(await hasPacsEntitlement(authed.uid, authed.email))) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'O recurso PACS/DICOM não está incluído no seu plano. Contrate o add-on PACS para criar seu servidor.' }));
    return;
  }

  // Instância única: se já existe uma instância REAL registrada para esta
  // conta, só segue com o pedido explícito de reprovisionamento (botão
  // "Reprovisionar"/"Tentar novamente" do app envia reprovision: true).
  const reprovision = body?.reprovision === true;
  try {
    const existing = await readInstanceRecord(authed.uid);
    if (shouldRejectExistingInstance(existing, reprovision)) {
      res.statusCode = 409; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Você já tem um PACS ativo nesta conta. Use "Reprovisionar" ou remova o atual antes de criar outro.' }));
      return;
    }
  } catch { /* registro indisponível → não bloqueia um provisionamento legítimo */ }

  const plan = ['starter', 'pro', 'dedicado'].includes(body?.plan) ? body.plan : 'pro';
  const zone = process.env.GCP_ZONE || 'southamerica-east1-c';
  const region = zone.replace(/-[a-z]$/, '');
  const spec = PLAN_SPEC[plan];

  const gcpConfigured = !!process.env.GCP_SA_KEY && !!process.env.TAILSCALE_API_KEY && !!process.env.TAILSCALE_TS_NET;
  const mock = process.env.PACS_MOCK === '1' || !gcpConfigured;
  const shared = plan === 'starter' || plan === 'pro';

  // ── SHARED (Starter/Pro): tenant na VM compartilhada ──
  if (shared) {
    const sharedUrl = process.env.PACS_SHARED_AGENT_URL;
    const sharedAdmin = process.env.PACS_ADMIN_SECRET;
    // Em produção (Vercel) sem a config compartilhada → ERRO CLARO (não simular,
    // senão o tenant é falso e o diagnóstico falha com "tenantId inválido").
    if (shouldBlockMockInProduction({ isVercel: !!process.env.VERCEL, forcedMock: process.env.PACS_MOCK === '1', configured: !!(sharedUrl && sharedAdmin) })) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'PACS compartilhado não configurado na Vercel. Defina PACS_SHARED_AGENT_URL e PACS_ADMIN_SECRET e faça Redeploy.' }));
      return;
    }
    // Sem config compartilhada (dev/local) ou PACS_MOCK → simulação.
    if (mock || !sharedUrl || !sharedAdmin) {
      const id = rand(4);
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ready', provider: 'shared', plan, region,
        instanceName: `tenant-${id}`, tenantId: `t-${id}`,
        agentUrl: 'https://orthanc-server.tailscale-demo.ts.net',
        agentSecret: rand(24), orthancVersion: '1.12.4', diskGb: spec.dataDiskGb, diskUsedGb: 0,
        relayAuthKey: `tskey-auth-demo${rand(8)}`, relayTag: CLIENT_RELAY_TAG,
      }));
      return;
    }
    // Real: cria o tenant via o endpoint admin do agente na VM compartilhada.
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const r = await fetch(`${sharedUrl.replace(/\/$/, '')}/api/admin/tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': sharedAdmin },
        body: JSON.stringify({ plan }), signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const d: any = await r.json();
      if (!r.ok || !d.success) throw new Error(d?.error || 'Falha ao criar tenant na VM compartilhada.');
      const relayAuthKey = await tryCreateRelayAuthKey();
      // Registro de posse server-side — fonte de verdade do DELETE e da trava
      // de instância única. Falha aqui não derruba o provisionamento (a
      // instância existe); o DELETE cai no caminho legado com validação.
      try {
        await writeInstanceRecord(authed.uid, {
          provider: 'shared', instanceName: `tenant-${d.tenantId}`, tenantId: d.tenantId,
          dicomPort: d.dicomPort ?? null, plan, createdAt: Date.now(),
        });
      } catch (err) { console.error('[pacs-provision] falha ao gravar registro da instância (shared):', err); }
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ready', provider: 'shared', plan, region,
        instanceName: `tenant-${d.tenantId}`, tenantId: d.tenantId,
        agentUrl: sharedUrl, agentSecret: d.secret, dicomPort: d.dicomPort,
        orthancVersion: '1.12.x', diskGb: spec.dataDiskGb, diskUsedGb: 0,
        relayAuthKey, relayTag: relayAuthKey ? CLIENT_RELAY_TAG : undefined,
      }));
      return;
    } catch (err: any) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Falha no provisionamento compartilhado.' }));
      return;
    }
  }

  // ── DEDICADO: em produção (Vercel) sem GCP/Tailscale configurados → ERRO
  // CLARO (mesma trava do compartilhado — não simular uma VM inexistente
  // pro plano mais caro só porque uma credencial sumiu do ambiente).
  if (shouldBlockMockInProduction({ isVercel: !!process.env.VERCEL, forcedMock: process.env.PACS_MOCK === '1', configured: gcpConfigured })) {
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'PACS dedicado não configurado na Vercel. Defina GCP_SA_KEY, TAILSCALE_API_KEY e TAILSCALE_TS_NET e faça Redeploy.' }));
    return;
  }

  // ── DEDICADO: MODO MOCK ──
  if (mock) {
    const id = rand(4);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'provisioning', provider: 'mock', plan, region,
      instanceName: `pacs-${id}`,
      agentUrl: `https://pacs-${id}.tailscale-demo.ts.net`,
      agentSecret: rand(24),
      orthancVersion: '1.12.4', diskGb: spec.dataDiskGb, diskUsedGb: 0,
      relayAuthKey: `tskey-auth-demo${rand(8)}`, relayTag: CLIENT_RELAY_TAG,
    }));
    return;
  }

  // ── MODO REAL (GCP + Tailscale) ──
  try {
    const sa = JSON.parse(process.env.GCP_SA_KEY!);
    const project = sa.project_id || process.env.GCP_PROJECT_ID;
    const agentSecret = rand(24);
    const shortUid = authed.uid.slice(0, 10).toLowerCase().replace(/[^a-z0-9]/g, '');
    const name = `pacs-${shortUid}-${rand(2)}`;

    const [token, tsAuthkey, relayAuthKey] = await Promise.all([
      getGcpAccessToken(sa, 'https://www.googleapis.com/auth/compute'),
      createTailscaleAuthKey({ tags: ['tag:pacs'] }),
      tryCreateRelayAuthKey(),
    ]);

    // Imagem dourada (Docker+Tailscale+Node+pydicom+Orthanc pré-instalados) →
    // boot ~1 min. Override via env PACS_IMAGE; default à família no projeto.
    const sourceImage = process.env.PACS_IMAGE || `projects/${project}/global/images/family/laudus-pacs`;
    const instanceBody = {
      name,
      machineType: `zones/${zone}/machineTypes/${spec.machineType}`,
      disks: [
        { boot: true, autoDelete: true, initializeParams: { sourceImage, diskSizeGb: 20 } },
        { autoDelete: false, initializeParams: { diskSizeGb: spec.dataDiskGb } },
      ],
      networkInterfaces: [{ network: 'global/networks/default', accessConfigs: [{ type: 'ONE_TO_ONE_NAT', name: 'External NAT' }] }],
      metadata: { items: [
        { key: 'startup-script', value: buildStartupScript(name) },
        { key: 'LAUDUS_AGENT_SECRET', value: agentSecret },
        { key: 'TS_AUTHKEY', value: tsAuthkey },
      ] },
      tags: { items: ['pacs'] },
      labels: { laudus_user: shortUid, laudus_plan: plan },
      // Sem service account anexada: a VM não usa APIs GCP (só Tailscale), o que
      // evita exigir o papel iam.serviceAccountUser para o provisionador.
      serviceAccounts: [],
    };

    const insertRes = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}/instances`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(instanceBody) }
    );
    const insertData: any = await insertRes.json();
    if (!insertRes.ok) throw new Error(`GCP insert: ${insertData?.error?.message || JSON.stringify(insertData)}`);

    // Registro de posse server-side (ver comentário no caminho shared).
    try {
      await writeInstanceRecord(authed.uid, { provider: 'gcp', instanceName: name, plan, createdAt: Date.now() });
    } catch (err) { console.error('[pacs-provision] falha ao gravar registro da instância (gcp):', err); }

    const agentUrl = `https://${name}.${process.env.TAILSCALE_TS_NET}`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'provisioning', provider: 'gcp', plan, region,
      instanceName: name, agentUrl, agentSecret,
      orthancVersion: '1.12.x', diskGb: spec.dataDiskGb, diskUsedGb: 0,
      note: 'VM criada — aguardando o Agente subir (1–4 min).',
      relayAuthKey, relayTag: relayAuthKey ? CLIENT_RELAY_TAG : undefined,
    }));
  } catch (err: any) {
    console.error('[pacs-provision] erro:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Falha ao provisionar a VM.' }));
  }
}
