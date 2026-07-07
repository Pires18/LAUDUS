import { describe, it, expect, afterEach } from 'vitest';
import handler, { shouldBlockMockInProduction } from '../../api/pacs-provision';

/**
 * pacs-provision.ts cria/destrói infraestrutura de nuvem cobrada — testado por
 * ser o endpoint de maior custo de erro depois do webhook de pagamento.
 */
function fakeRes() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (body?: string) => { if (body !== undefined) res.body = body; };
  res.status = (code: number) => { res.statusCode = code; return res; }; // não usado aqui, mas inofensivo
  return res;
}

afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.PACS_MOCK;
});

describe('shouldBlockMockInProduction', () => {
  it('bloqueia em produção (Vercel) sem config e sem mock forçado', () => {
    expect(shouldBlockMockInProduction({ isVercel: true, forcedMock: false, configured: false })).toBe(true);
  });

  it('NÃO bloqueia em produção quando a config está presente', () => {
    expect(shouldBlockMockInProduction({ isVercel: true, forcedMock: false, configured: true })).toBe(false);
  });

  it('NÃO bloqueia em produção quando o mock foi forçado explicitamente (PACS_MOCK=1)', () => {
    expect(shouldBlockMockInProduction({ isVercel: true, forcedMock: true, configured: false })).toBe(false);
  });

  it('NÃO bloqueia fora da Vercel (dev local), mesmo sem config', () => {
    expect(shouldBlockMockInProduction({ isVercel: false, forcedMock: false, configured: false })).toBe(false);
  });
});

describe('handler — gating de auth/método (sem invocar GCP/Tailscale/Firebase)', () => {
  it('OPTIONS → 200 imediato (preflight CORS)', async () => {
    const res = fakeRes();
    await handler({ method: 'OPTIONS', headers: {} }, res);
    expect(res.statusCode).toBe(200);
  });

  it('método não suportado (ex.: PUT) → 405', async () => {
    const res = fakeRes();
    await handler({ method: 'PUT', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('POST sem token (header nem body) → 401, sem tentar provisionar nada', async () => {
    const res = fakeRes();
    await handler({ method: 'POST', headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
    const parsed = JSON.parse(res.body);
    expect(parsed.reason).toBe('no_token');
  });

  it('DELETE sem token → 401, sem tentar destruir nada', async () => {
    const res = fakeRes();
    await handler({ method: 'DELETE', headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it('POST com token claramente inválido → 401 (não provisiona com credencial forjada)', async () => {
    const res = fakeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer token-forjado-invalido' }, body: {} }, res);
    expect(res.statusCode).toBe(401);
    const parsed = JSON.parse(res.body);
    expect(parsed.reason).toBe('verify_failed');
  });
});
