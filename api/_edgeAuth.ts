// Verificação de Firebase ID token em Edge Runtime (sem firebase-admin).
// Valida assinatura RS256 contra as chaves públicas do Google (JWKS),
// além de iss/aud/exp — o mesmo contrato do Admin SDK verifyIdToken.

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache: { keys: any[]; expiresAt: number } | null = null;

async function getJwks(): Promise<any[]> {
  if (jwksCache && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = await res.json();
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAge = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAge ? parseInt(maxAge[1], 10) * 1000 : 60 * 60 * 1000;
  jwksCache = { keys, expiresAt: Date.now() + ttlMs };
  return keys;
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  let s = value.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface EdgeAuthedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export async function verifyFirebaseIdToken(token: string): Promise<EdgeAuthedUser | null> {
  try {
    const projectId = (
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      ''
    ).trim();
    if (!projectId) return null;

    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));

    if (header.alg !== 'RS256' || !header.kid) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;

    const keys = await getJwks();
    const jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!valid) return null;

    return { uid: payload.sub, email: (payload.email || '').toLowerCase(), emailVerified: payload.email_verified === true };
  } catch {
    return null;
  }
}

/** Extrai e valida o token do header `Authorization: Bearer <idToken>`. */
export async function verifyAuthEdge(req: Request): Promise<EdgeAuthedUser | null> {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyFirebaseIdToken(header.slice('Bearer '.length).trim());
}
