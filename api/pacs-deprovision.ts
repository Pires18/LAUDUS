import crypto from 'crypto';

/**
 * POST /api/pacs-deprovision — destrói de verdade o PACS gerenciado do usuário.
 *
 * Antes desta rota existir, o botão "Remover PACS" (MyPacsCard.tsx) só limpava
 * os campos no Firestore — a VM real no GCP (provider='gcp') ou o tenant na VM
 * compartilhada (provider='shared') continuavam rodando e sendo cobrados
 * indefinidamente. Este endpoint fecha esse ciclo.
 */

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method Not Allowed' })); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const headerAuth = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = headerAuth.startsWith('Bearer ') ? headerAuth.slice(7) : '';
  if (!token) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }));
    return;
  }
  try {
    const { getAdminAuth } = await import('./_firebase.js');
    await (await getAdminAuth()).verifyIdToken(token);
  } catch {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Token inválido ou expirado.' }));
    return;
  }

  const { provider, instanceName, tenantId } = body || {};

  // Mock ou nunca provisionado de verdade: nada para destruir na nuvem.
  if (!provider || provider === 'mock' || !instanceName) {
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, note: 'Nada a destruir (instância simulada ou inexistente).' }));
    return;
  }

  // ── Tenant na VM compartilhada (Starter/Pro) ──
  if (provider === 'shared') {
    const sharedUrl = process.env.PACS_SHARED_AGENT_URL;
    const sharedAdmin = process.env.PACS_ADMIN_SECRET;
    if (!sharedUrl || !sharedAdmin || !tenantId) {
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, note: 'PACS compartilhado não configurado ou sem tenantId — nada a destruir remotamente.' }));
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const r = await fetch(`${sharedUrl.replace(/\/$/, '')}/api/admin/tenant/${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': sharedAdmin },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!r.ok) {
        const d: any = await r.json().catch(() => ({}));
        throw new Error(d?.error || `Agente respondeu ${r.status} ao remover o tenant.`);
      }
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (err: any) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Falha ao remover tenant compartilhado.' }));
    }
    return;
  }

  // ── VM dedicada real (GCP) ──
  if (provider === 'gcp') {
    const gcpConfigured = !!process.env.GCP_SA_KEY;
    if (!gcpConfigured) {
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, note: 'GCP não configurado no servidor — nada a destruir remotamente.' }));
      return;
    }
    try {
      const sa = JSON.parse(process.env.GCP_SA_KEY!);
      const project = sa.project_id || process.env.GCP_PROJECT_ID;
      const zone = process.env.GCP_ZONE || 'southamerica-east1-c';
      const gcpToken = await getGcpAccessToken(sa, 'https://www.googleapis.com/auth/compute');
      const delRes = await fetch(
        `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}/instances/${encodeURIComponent(instanceName)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${gcpToken}` } }
      );
      const delData: any = await delRes.json().catch(() => ({}));
      // 404 = já não existe (idempotente, trata como sucesso).
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`GCP delete: ${delData?.error?.message || JSON.stringify(delData)}`);
      }
      res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    } catch (err: any) {
      console.error('[pacs-deprovision] erro:', err);
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Falha ao destruir a VM.' }));
    }
    return;
  }

  res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: `provider desconhecido: ${provider}` }));
}
