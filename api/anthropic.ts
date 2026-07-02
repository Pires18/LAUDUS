import { verifyAuthEdge } from './_edgeAuth.js';

export const config = {
  runtime: 'edge',
};

// In-memory rate limiter — resets per Edge instance restart.
// For distributed rate limiting, replace with Vercel KV.
const RATE_LIMIT = 20;         // max requests
const RATE_WINDOW_MS = 60_000; // per 60 seconds

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-uid, x-api-key, anthropic-version, anthropic-beta',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    // Autenticação obrigatória: token Firebase do usuário logado.
    const authed = await verifyAuthEdge(req);
    if (!authed) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting pelo uid VERIFICADO (não pelo header auto-declarado).
    const uid = authed.uid;
    if (!checkRateLimit(uid)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em instantes.' }),
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const headers = new Headers();
    headers.set('content-type', 'application/json');

    let apiKey = (req.headers.get('x-api-key') || req.headers.get('x-anthropic-key') || '').trim();
    if (!apiKey) {
      apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), { status: 503 });
    }
    headers.set('x-api-key', apiKey);

    const anthropicVersion = req.headers.get('anthropic-version');
    if (anthropicVersion) headers.set('anthropic-version', anthropicVersion);

    const anthropicBeta = req.headers.get('anthropic-beta');
    if (anthropicBeta) headers.set('anthropic-beta', anthropicBeta);

    const body = await req.text();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
