import crypto from 'crypto';

/**
 * Destruição real de uma instância PACS (VM dedicada no GCP ou tenant na VM
 * compartilhada). Extraído de `pacs-provision.ts` para ser reaproveitado
 * tanto pelo endpoint `DELETE /api/pacs-provision` (botão manual do usuário)
 * quanto pelo CRON de lifecycle automático (`reset-monthly-reports.ts`, ao
 * expirar o período de graça pós-cancelamento) — sem duplicar a lógica de
 * autenticação OAuth do GCP/chamada à Compute API/Agente compartilhado.
 */

export interface DestroyPacsInput {
  provider?: 'mock' | 'gcp' | 'shared' | string;
  instanceName?: string;
  tenantId?: string;
}

export interface DestroyPacsResult {
  success: boolean;
  note?: string;
  error?: string;
}

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

export async function destroyPacsInstance(input: DestroyPacsInput): Promise<DestroyPacsResult> {
  const { provider, instanceName, tenantId } = input;

  if (!provider || provider === 'mock' || !instanceName) {
    return { success: true, note: 'Nada a destruir (instância simulada ou inexistente).' };
  }

  if (provider === 'shared') {
    const sharedUrl = process.env.PACS_SHARED_AGENT_URL;
    const sharedAdmin = process.env.PACS_ADMIN_SECRET;
    if (!sharedUrl || !sharedAdmin || !tenantId) {
      return { success: true, note: 'PACS compartilhado não configurado ou sem tenantId — nada a destruir remotamente.' };
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
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao remover tenant compartilhado.' };
    }
  }

  if (provider === 'gcp') {
    const gcpConfigured = !!process.env.GCP_SA_KEY;
    if (!gcpConfigured) {
      return { success: true, note: 'GCP não configurado no servidor — nada a destruir remotamente.' };
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
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`GCP delete: ${delData?.error?.message || JSON.stringify(delData)}`);
      }
      return { success: true };
    } catch (err: any) {
      console.error('[destroyPacsInstance] erro GCP:', err);
      return { success: false, error: err.message || 'Falha ao destruir a VM.' };
    }
  }

  return { success: false, error: `provider desconhecido: ${provider}` };
}
