import { verifyFirebaseIdToken } from './_edgeAuth.js';
import { hasPacsEntitlement } from './_entitlements.js';
import { getDb } from './_firebase.js';

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
    try {
      // tenantId (VM compartilhada) vai na QUERY — o agente resolve a auth e a
      // pasta pelo tenant antes de ler o corpo.
      const tenantQs = body?.tenantId ? `?tenantId=${encodeURIComponent(String(body.tenantId))}` : '';
      const targetUrl = `${localAgentUrl.replace(/\/$/, '')}/api/worklist${tenantQs}`;
      console.log(`[Vercel Worklist Proxy] Forwarding ${req.method} request to: ${targetUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      // Segredo do Agente Local (per-usuário): cada usuário tem o próprio agente
      // e o próprio segredo. O navegador envia x-agent-secret e o Vercel apenas
      // REPASSA (não usa segredo global). Fallback ao env global só por
      // retrocompatibilidade de instalações single-tenant.
      const perUserSecret = req.headers['x-agent-secret'] || body?.agentSecret || process.env.LAUDUS_AGENT_SECRET;
      const fwdHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (perUserSecret) {
        fwdHeaders['x-agent-secret'] = String(perUserSecret);
      }
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: fwdHeaders,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      const responseText = await response.text();
      res.end(responseText);
      return;
    } catch (err: any) {
      console.error('[Vercel Worklist Proxy Error]:', err);
      const isTimeout = err?.name === 'AbortError';
      res.statusCode = 200; // Retorna 200 com success: false para exibir o erro amigável na UI
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: isTimeout
          ? 'O Agente Local não respondeu a tempo (timeout). Verifique se o agente está rodando e exposto via Tailscale Funnel.'
          : `Não foi possível conectar ao Agente Local via Vercel. Certifique-se de que o Agente está ativo e acessível (Detalhes: ${err.message})`
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
