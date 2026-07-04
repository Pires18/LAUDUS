import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseIdToken } from './_edgeAuth.js';
import { hasPacsEntitlement } from './_entitlements.js';

// Desabilita o bodyParser padrão do Vercel Serverless Functions.
// Isso impede que a Vercel tente analisar payloads binários brutos (como arquivos DICOM)
// como JSON ou strings UTF-8, o que poderia corromper os dados enviados.
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Guarda anti-SSRF: na nuvem o proxy só pode alcançar servidores Orthanc
 * públicos expostos via HTTPS (ex: Tailscale Funnel). Bloqueia IPs privados,
 * loopback, link-local e endpoints de metadados de nuvem.
 */
function isBlockedTarget(url: URL): string | null {
  if (url.protocol !== 'https:') {
    return 'Na nuvem, o destino precisa ser HTTPS (ex: URL pública do Tailscale Funnel).';
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return 'Destino local não permitido.';
  if (host.endsWith('.internal') || host === 'metadata.google.internal') return 'Destino interno não permitido.';
  if (host.includes(':')) return 'Endereços IPv6 literais não são permitidos.';
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = parseInt(ipv4[1], 10);
    const b = parseInt(ipv4[2], 10);
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      return 'Endereços IP privados/reservados não são permitidos.';
    }
  }
  return null;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight CORS request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Robust parsing of query parameters
  let query = req.query || {};
  if (!req.query && req.url) {
    try {
      const host = req.headers.host || 'localhost';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const parsedUrl = new URL(req.url, `${protocol}://${host}`);
      query = Object.fromEntries(parsedUrl.searchParams.entries());
    } catch (e) {
      console.error('[Vercel Orthanc Proxy] Failed to parse URL:', e);
    }
  }

  const targetUrl = query.url as string | undefined;

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'O parâmetro query "url" é obrigatório.' }));
    return;
  }

  // Autenticação obrigatória na nuvem: header Authorization (fetch) ou
  // parâmetro ?token= (URLs de <img src>, que não suportam headers).
  // Usa validação por JWKS (mesma dos endpoints de IA/worklist, funcional no
  // Vercel) em vez do Firebase Admin SDK, que exige conta de serviço ausente.
  if (process.env.VERCEL) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';
    const authed = (bearer ? await verifyFirebaseIdToken(bearer) : null)
      || (query.token ? await verifyFirebaseIdToken(String(query.token)) : null);
    if (!authed) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }));
      return;
    }
    // Enforcement de plano: PACS é add-on pago (cache + fail-open no helper).
    if (!(await hasPacsEntitlement(authed.uid, authed.email))) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'O recurso PACS/DICOM não está incluído no seu plano.' }));
      return;
    }
  }

  try {
    const targetUrlObj = new URL(targetUrl);

    if (process.env.VERCEL) {
      const blocked = isBlockedTarget(targetUrlObj);
      if (blocked) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Destino recusado: ${blocked}` }));
        return;
      }
    }

    const headers: Record<string, string> = {};

    // Credenciais do Orthanc: query params ou embutidas na URL. Sem
    // credenciais, a requisição segue anônima (sem senha default).
    const queryUsername = query.username as string | undefined;
    const queryPassword = query.password as string | undefined;

    if (queryUsername && queryPassword) {
      const authString = Buffer.from(`${queryUsername}:${queryPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else if (targetUrlObj.username && targetUrlObj.password) {
      const authString = Buffer.from(`${targetUrlObj.username}:${targetUrlObj.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    }

    // Forward content-type if present
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    // Read raw request body stream directly (since bodyParser is disabled)
    let body: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', (err: Error) => reject(err));
      });
    }

    // Perform fetch to target Orthanc server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    res.statusCode = response.status;

    // Forward response headers (ignoring transfer encoding and basic auth prompts)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey !== 'transfer-encoding' &&
        lowerKey !== 'www-authenticate' &&
        lowerKey !== 'content-encoding' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'keep-alive'
      ) {
        res.setHeader(key, value);
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[Vercel Orthanc Proxy Error]:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Erro ao conectar ao servidor Orthanc.' }));
  }
}
