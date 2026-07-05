/**
 * Rate limit distribuído via KV REST API (Vercel KV / Upstash Redis — mesma API).
 * Usa fetch puro (compatível com Edge runtime), sem SDK adicional.
 *
 * Fallback: se KV_REST_API_URL/KV_REST_API_TOKEN não estiverem configurados, ou a
 * chamada falhar, cai para um Map em memória (mesmo comportamento de antes — só
 * eficaz por instância, mas nunca quebra a rota por causa do rate limit).
 */

const memoryStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimitMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

async function checkRateLimitKv(key: string, limit: number, windowMs: number): Promise<boolean | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const kvKey = `ratelimit:${key}`;
    // INCR + EXPIRE (NX) via pipeline REST do Upstash.
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', kvKey],
        ['EXPIRE', kvKey, String(windowSec), 'NX'],
      ]),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count)) return null;

    return count <= limit;
  } catch {
    return null;
  }
}

/** Retorna `true` se a requisição é permitida (ainda dentro do limite). */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const kvResult = await checkRateLimitKv(key, limit, windowMs);
  if (kvResult !== null) return kvResult;
  return checkRateLimitMemory(key, limit, windowMs);
}
