import dns from 'node:dns';
import https from 'node:https';
import { verifyFirebaseIdToken } from './_edgeAuth.js';
import { hasPacsEntitlement } from './_entitlements.js';
import { getDb } from './_firebase.js';

// O Tailscale Funnel publica o host do agente em DUAL-STACK (A/IPv4 + AAAA/IPv6).
// O egress serverless da Vercel NÃO roteia IPv6 — o `fetch` (undici) tentava o
// AAAA e estourava UND_ERR_CONNECT_TIMEOUT (só na nuvem; navegador/tailnet ok).
// setDefaultResultOrder não basta (o undici tem lógica própria de conexão), então
// falamos com o agente via node:https FORÇANDO family:4 (ver requestAgentIPv4).
dns.setDefaultResultOrder('ipv4first');

/**
 * POST/GET ao agente local FORÇANDO IPv4 (family:4) — contorna o AAAA do Funnel
 * que a Vercel não consegue rotear. Usa node:https (built-in, sem risco de
 * bundling). `timeoutMs` cobre conexão + resposta.
 */
function requestAgentIPv4(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  bodyStr: string,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const r = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        family: 4, // <- força IPv4; ignora o registro AAAA do Funnel
        headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
      },
      (resp) => {
        let data = '';
        resp.setEncoding('utf8');
        resp.on('data', (c) => (data += c));
        resp.on('end', () => resolve({ status: resp.statusCode || 502, text: data }));
      },
    );
    r.setTimeout(timeoutMs, () => {
      r.destroy(Object.assign(new Error('conexão IPv4 ao agente esgotou (timeout)'), { code: 'AGENT_IPV4_TIMEOUT' }));
    });
    r.on('error', reject);
    r.write(bodyStr);
    r.end();
  });
}

// Cache curto por instância — mesmo racional de `_entitlements.ts`: evita uma
// leitura extra no Firestore em cada request de worklist só pra este log.
const tenantCheckCache = new Map<string, { tenantId: string; expires: number }>();
const TENANT_CHECK_TTL_MS = 60_000;

/**
 * Verificação server-side (observabilidade, não bloqueante) de que o
 * `tenantId` de uma requisição bate com o `dicomTenantId` salvo nas settings
 * do usuário autenticado. Uma das 5 causas-raiz do incidente MX7
 * (docs/pacs/incidents/INCIDENTE_2026-07-08_TIMEOUT_MX7.md) foi justamente
 * um `dicomTenantId` divergente do tenant que o relé físico realmente
 * alcançava — isso não deixava nenhum rastro em lugar nenhum até o exame já
 * ter sumido. Isto NÃO bloqueia a requisição (o painel PACS testa `draft`
 * com tenantId ainda não salvo antes de clicar "Salvar" — bloquear quebraria
 * esse fluxo legítimo de teste), só deixa rastro no log server-side pra uma
 * investigação futura ser mais rápida que vasculhar manualmente.
 */
async function logTenantMismatchIfAny(uid: string, requestTenantId: string | undefined): Promise<void> {
  if (!requestTenantId || !uid) return;
  try {
    let saved = tenantCheckCache.get(uid);
    if (!saved || Date.now() >= saved.expires) {
      const db = await getDb();
      const snap = await db.collection('users').doc(uid).collection('settings').doc('app').get();
      const tenantId = snap.exists ? String(snap.data()?.dicomTenantId || '') : '';
      saved = { tenantId, expires: Date.now() + TENANT_CHECK_TTL_MS };
      tenantCheckCache.set(uid, saved);
    }
    if (saved.tenantId && saved.tenantId !== requestTenantId) {
      console.warn(`[TENANT-CHECK] uid=${uid} requisitou tenantId=${requestTenantId} mas settings salvas apontam para tenantId=${saved.tenantId} — possível divergência (draft não salvo, ou config desalinhada).`);
    }
  } catch (err) {
    // Fail-open: nunca atrasa/derruba a requisição real por causa deste log.
    console.warn('[TENANT-CHECK] Falha ao verificar consistência de tenantId (ignorado):', (err as any)?.message);
  }
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-agent-secret');

  // Preflight CORS request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let body = req.body;
  if (typeof body === 'string' && body.trim()) {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }

  // Autenticação obrigatória na nuvem (o encaminhamento server-side para o
  // Agente Local não pode ficar aberto à internet).
  // Usa verificação por JWKS (mesma dos endpoints de IA, comprovadamente
  // funcional no Vercel) em vez do Firebase Admin SDK — este último exige a
  // conta de serviço (FIREBASE_CLIENT_EMAIL/PRIVATE_KEY) que pode não estar
  // provisionada no ambiente serverless, causando 401 mesmo com token válido.
  if (process.env.VERCEL) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';
    const authed = await verifyFirebaseIdToken(bearer);
    if (!authed) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Não autorizado. Faça login novamente.' }));
      return;
    }
    // Enforcement de plano: PACS é add-on pago. Fail-open se a checagem falhar.
    if (!(await hasPacsEntitlement(authed.uid, authed.email))) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'O recurso PACS/DICOM não está incluído no seu plano.' }));
      return;
    }
    // Não bloqueante — ver comentário em logTenantMismatchIfAny.
    void logTenantMismatchIfAny(authed.uid, body?.tenantId ? String(body.tenantId) : undefined);
  }

  const localAgentUrl = body?.localAgentUrl;

  if (localAgentUrl) {
    // Só encaminha para agentes HTTPS — a função roda em HTTPS e endereços HTTP
    // puros seriam recusados/instáveis. Mixed Content não se aplica aqui (é
    // server-to-server), mas exigir HTTPS evita destinos não-expostos.
    if (!/^https:\/\//i.test(localAgentUrl)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'A URL do Agente Local precisa ser HTTPS (ex: https://servidor.tailXXXX.ts.net) para funcionar na nuvem. Exponha o agente via Tailscale Funnel.'
      }));
      return;
    }
    // Mesma allowlist de sufixos do orthanc-proxy (anti-SSRF/DNS-rebinding):
    // na nuvem, o agente só pode viver atrás do Tailscale Funnel (*.ts.net),
    // salvo ampliação explícita via env.
    if (process.env.VERCEL) {
      const allowedSuffixes = (process.env.ORTHANC_PROXY_ALLOWED_HOST_SUFFIXES || '.ts.net')
        .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      let agentHost = '';
      try { agentHost = new URL(localAgentUrl).hostname.toLowerCase(); } catch { /* cai no bloqueio abaixo */ }
      if (!agentHost || !allowedSuffixes.some((suf) => agentHost.endsWith(suf))) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Na nuvem, o Agente Local precisa estar atrás do Tailscale Funnel (*.ts.net). Se usar domínio próprio, configure ORTHANC_PROXY_ALLOWED_HOST_SUFFIXES.'
        }));
        return;
      }
    }
    try {
      // tenantId (VM compartilhada) vai na QUERY — o agente resolve a auth e a
      // pasta pelo tenant antes de ler o corpo.
      const tenantQs = body?.tenantId ? `?tenantId=${encodeURIComponent(String(body.tenantId))}` : '';
      const targetUrl = `${localAgentUrl.replace(/\/$/, '')}/api/worklist${tenantQs}`;
      console.log(`[Vercel Worklist Proxy] Forwarding ${req.method} request to: ${targetUrl}`);

      // Segredo do Agente Local (per-usuário): cada usuário tem o próprio agente
      // e o próprio segredo. O navegador envia x-agent-secret e o Vercel apenas
      // REPASSA (não usa segredo global). Fallback ao env global só por
      // retrocompatibilidade de instalações single-tenant.
      const perUserSecret = req.headers['x-agent-secret'] || body?.agentSecret || process.env.LAUDUS_AGENT_SECRET;
      const fwdHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (perUserSecret) {
        fwdHeaders['x-agent-secret'] = String(perUserSecret);
      }
      // Fala com o agente FORÇANDO IPv4 (family:4) — ver requestAgentIPv4.
      const result = await requestAgentIPv4(targetUrl, req.method, fwdHeaders, JSON.stringify(body), 15000);

      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(result.text);
      return;
    } catch (err: any) {
      // Diagnóstico: node:https expõe o código real em err.code (ETIMEDOUT,
      // ENETUNREACH, ECONNREFUSED, ENOTFOUND, AGENT_IPV4_TIMEOUT). Incluímos
      // também o IPv4 que foi tentado — se ainda estourar por IPv4, o problema é
      // a Vercel não alcançar o Funnel (não é IP family).
      const cause = err?.code || err?.cause?.code || err?.cause?.message || err?.message || 'erro';
      let triedIpv4 = '';
      try { triedIpv4 = (await dns.promises.resolve4(new URL(localAgentUrl).hostname))[0] || ''; } catch { /* ignore */ }
      console.error('[Vercel Worklist Proxy Error]:', err?.message, '| code:', cause, '| ipv4:', triedIpv4);
      res.statusCode = 200; // 200 com success:false para a UI exibir a mensagem
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: `Não foi possível conectar ao Agente Local via Vercel (IPv4${triedIpv4 ? ` ${triedIpv4}` : ''}: ${cause}). Confirme que o Agente está ativo e exposto via Tailscale Funnel (na VM: sudo tailscale funnel --bg 3000).`
      }));
      return;
    }
  }

  // A geração de worklist física exige gravação de arquivos locais no servidor da clínica (Mac/Windows).
  // Na nuvem (Vercel), esse endpoint deve informar ao usuário de forma amigável sobre essa limitação.
  res.statusCode = 200; // Retorna 200 com JSON informando falha para a UI exibir a mensagem corretamente
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: false,
    error: 'A geração de arquivos de Worklist local (.wl) exige que o Laud.us esteja rodando localmente no servidor da clínica ou que um Agente Local esteja configurado.'
  }));
}
