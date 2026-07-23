import { verifyAuthEdge } from './_edgeAuth.js';
import { evaluateReportQuota } from './_quota.js';
import { checkRateLimit } from './_rateLimit.js';

export const config = {
  runtime: 'edge',
};

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

/**
 * Enforcement de cota de laudos (server-side, FAIL-OPEN).
 *
 * Lê `users/{uid}` via Firestore REST usando o PRÓPRIO token do usuário (as regras
 * permitem o dono ler seu doc — sem Admin SDK, compatível com Edge). Só bloqueia
 * quando confirma, com o documento lido:
 *   - nenhuma assinatura ativa (status fora de active/past_due E fora do trial de
 *     14 dias) e o usuário não é admin, OU
 *   - cota mensal esgotada (reportsQuota finita e usados >= cota).
 *
 * Qualquer incerteza (sem projectId, leitura falhou, campo ausente, erro) →
 * `allowed:true`. Nunca derruba um pagante por falha de infraestrutura.
 */
async function checkReportQuota(uid: string, idToken: string): Promise<{ allowed: boolean; error?: string; status?: number }> {
  try {
    if (!idToken) return { allowed: true };
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
    if (!projectId) return { allowed: true };
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!resp.ok) return { allowed: true }; // não conseguimos ler → fail-open
    const doc: any = await resp.json();
    const f = doc.fields || {};
    const num = (k: string): number | undefined => {
      const v = f[k];
      if (!v) return undefined;
      if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
      if (v.doubleValue !== undefined) return Number(v.doubleValue);
      return undefined;
    };
    const str = (k: string): string => (f[k]?.stringValue || '');

    // Decisão pura e testável (ver api/_quota.ts).
    const { allowed, error, status } = evaluateReportQuota({
      role: str('role'),
      subscriptionStatus: str('subscriptionStatus'),
      createdAt: num('createdAt'),
      reportsQuota: num('reportsQuota'),
      reportsUsedThisMonth: num('reportsUsedThisMonth'),
    });
    return { allowed, error, status };
  } catch {
    return { allowed: true }; // fail-open
  }
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
    if (!(await checkRateLimit(`gemini:${uid}`, RATE_LIMIT, RATE_WINDOW_MS))) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em instantes.' }),
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Enforcement de cota — SOMENTE na geração de laudo (não copiloto/refino/
    // template/embeddings). Fail-open: só bloqueia quando confirma sem cota.
    if (req.headers.get('x-gemini-mode') === 'generation') {
      // Contas de e-mail/senha precisam confirmar o e-mail antes de gerar laudos com
      // IA (mitiga abuso de contas descartáveis no trial). Contas Google já chegam
      // com email_verified=true no token, então nunca são bloqueadas aqui.
      if (!authed.emailVerified) {
        return new Response(
          JSON.stringify({ error: 'Confirme seu e-mail para gerar laudos com IA. Reenvie o e-mail de verificação e tente novamente.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const authHeader = req.headers.get('authorization') || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const quota = await checkReportQuota(uid, idToken);
      if (!quota.allowed) {
        return new Response(
          JSON.stringify({ error: quota.error }),
          { status: quota.status || 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    let apiKey = (req.headers.get('x-api-key') || req.headers.get('x-gemini-key') || '').trim();
    if (!apiKey) {
      apiKey = (process.env.GOOGLE_API_KEY || '').trim();
    }
    if (!apiKey) {
      // NÃO é sobrecarga: a env var da chave não está no ambiente. Corpo explícito
      // para o cliente distinguir de um 503 real do Google (ver geminiHttpError).
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured on server (defina GOOGLE_API_KEY no ambiente/Vercel).' }),
        { status: 503 }
      );
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

    // Erros do Google (não-2xx) NÃO são transmitidos crus: traduzimos para uma
    // mensagem acionável. O 401 "Expected OAuth 2 access token" só aparece se um
    // cliente DESATUALIZADO (service worker antigo) chamar o Google direto, sem
    // passar por este proxy — este proxy nunca envia Authorization ao Google.
    if (!response.ok) {
      const raw = await response.text();
      let friendly = raw;
      if (response.status === 401 || /OAuth 2 access token|invalid authentication/i.test(raw)) {
        friendly = 'Autenticação da IA falhou. Provável cache antigo do app: atualize o sistema (clique em "Atualizar" no aviso, recarregue com Ctrl/Cmd+Shift+R ou limpe os dados do site) e tente de novo.';
      } else if (response.status === 403 && /unregistered callers|PERMISSION_DENIED/i.test(raw)) {
        friendly = 'Chave de IA do servidor ausente ou inválida. Configure GOOGLE_API_KEY no ambiente.';
      } else if (response.status === 404) {
        friendly = `Modelo de IA indisponível (${model}). Verifique a configuração dos motores.`;
      }
      return new Response(JSON.stringify({ error: friendly, status: response.status }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
