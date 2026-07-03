import { verifyAuthEdge } from './_edgeAuth.js';

export const config = {
  runtime: 'edge',
};

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

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

// Marcador de versão do proxy — permite confirmar qual build está no ar.
// Acesse /api/gemini?ping=1 no navegador: se aparecer "embed" e
// "embed-batch" em features, o suporte a embeddings está publicado.
const PROXY_VERSION = 'v2-embeddings-2026-06';

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-uid, x-gemini-model, x-gemini-stream, x-gemini-task, x-api-key',
      },
    });
  }

  // Health/version check (GET ?ping=1) — sem consumir API nem chave.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.has('ping')) {
      return new Response(
        JSON.stringify({ proxy: PROXY_VERSION, features: ['generate', 'stream', 'embed', 'embed-batch'] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
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

    let apiKey = (req.headers.get('x-api-key') || req.headers.get('x-gemini-key') || '').trim();
    if (!apiKey) {
      apiKey = (process.env.GOOGLE_API_KEY || '').trim();
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key not configured on server' }), { status: 503 });
    }

    const model = req.headers.get('x-gemini-model') || 'gemini-3.5-flash';
    const isStream = req.headers.get('x-gemini-stream') === 'true';
    const task = req.headers.get('x-gemini-task') || 'generate';
    const body = await req.text();

    let endpoint: string;
    if (task === 'embed') {
      // Vetorização única (text-embedding-004).
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    } else if (task === 'embed-batch') {
      // Vetorização em lote — muitos textos por chamada (bootstrap do corpus).
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;
    } else if (isStream) {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    } else {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
