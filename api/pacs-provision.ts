import crypto from 'crypto';

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

// Cria uma auth-key preautorizada e com tag para a VM entrar no tailnet sozinha.
async function createTailscaleAuthKey(): Promise<string> {
  const tailnet = process.env.TAILSCALE_TAILNET!;
  const apiKey = process.env.TAILSCALE_API_KEY!;
  const res = await fetch(`https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/keys`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capabilities: { devices: { create: { reusable: false, ephemeral: false, preauthorized: true, tags: ['tag:pacs'] } } },
      expirySeconds: 3600,
    }),
  });
  const data: any = await res.json();
  if (!data.key) throw new Error(`Tailscale key: ${data.message || JSON.stringify(data)}`);
  return data.key;
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method Not Allowed' })); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // Autenticação: verifica o token (header OU corpo) DIRETO no Admin SDK para
  // capturar o motivo exato da falha (verifyIdToken não usa a chave privada —
  // valida assinatura via chaves públicas do Google e confere o projeto).
  const headerAuth = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = (headerAuth.startsWith('Bearer ') ? headerAuth.slice(7) : '') || (body?.token ? String(body.token) : '');
  let authed: any = null; let verifyErr = '';
  if (token) {
    try {
      const { getAdminAuth } = await import('./_firebase.js');
      const dec = await (await getAdminAuth()).verifyIdToken(token);
      authed = { uid: dec.uid, email: (dec.email || '').toLowerCase() };
    } catch (e: any) {
      verifyErr = ((e?.errorInfo?.code || e?.code || 'err') + ': ' + (e?.message || '')).slice(0, 130);
    }
  }
  if (!authed) {
    const reason = token ? 'verify_failed' : 'no_token';
    const fbProj = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '(default:laudus)';
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Não autorizado. Faça login novamente.', reason, fbProj, verifyErr }));
    return;
  }
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
    // Sem config compartilhada (ou PACS_MOCK) → simulação (provider 'shared').
    if (mock || !sharedUrl || !sharedAdmin) {
      const id = rand(4);
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ready', provider: 'shared', plan, region,
        instanceName: `tenant-${id}`, tenantId: `t-${id}`,
        agentUrl: 'https://orthanc-server.tailscale-demo.ts.net',
        agentSecret: rand(24), orthancVersion: '1.12.4', diskGb: spec.dataDiskGb, diskUsedGb: 0,
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
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ready', provider: 'shared', plan, region,
        instanceName: `tenant-${d.tenantId}`, tenantId: d.tenantId,
        agentUrl: sharedUrl, agentSecret: d.secret, dicomPort: d.dicomPort,
        orthancVersion: '1.12.x', diskGb: spec.dataDiskGb, diskUsedGb: 0,
      }));
      return;
    } catch (err: any) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Falha no provisionamento compartilhado.' }));
      return;
    }
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

    const [token, tsAuthkey] = await Promise.all([
      getGcpAccessToken(sa, 'https://www.googleapis.com/auth/compute'),
      createTailscaleAuthKey(),
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

    const agentUrl = `https://${name}.${process.env.TAILSCALE_TS_NET}`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'provisioning', provider: 'gcp', plan, region,
      instanceName: name, agentUrl, agentSecret,
      orthancVersion: '1.12.x', diskGb: spec.dataDiskGb, diskUsedGb: 0,
      note: 'VM criada — aguardando o Agente subir (1–4 min).',
    }));
  } catch (err: any) {
    console.error('[pacs-provision] erro:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Falha ao provisionar a VM.' }));
  }
}
