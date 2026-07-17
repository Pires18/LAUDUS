import { describe, it, expect, afterEach } from 'vitest';
import handler, {
  shouldBlockMockInProduction,
  shortUidOf,
  isOwnedGcpInstanceName,
  shouldRejectExistingInstance,
} from '../../api/pacs-provision';
import { destroyPacsInstance } from '../../api/_pacsLifecycle';

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
  });

  it('401 NÃO vaza detalhes de diagnóstico (reason/fbProj/verifyErr — só no log do servidor)', async () => {
    const res = fakeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer token-forjado-invalido' }, body: {} }, res);
    const parsed = JSON.parse(res.body);
    expect(parsed.reason).toBeUndefined();
    expect(parsed.fbProj).toBeUndefined();
    expect(parsed.verifyErr).toBeUndefined();
  });
});

describe('posse de VM dedicada (isOwnedGcpInstanceName)', () => {
  const UID = 'AbC123xyz789restodouid';
  const SHORT = shortUidOf(UID); // 'abc123xyz7'

  it('shortUidOf espelha a regra do provisionamento (10 chars, minúsculo, alfanumérico)', () => {
    expect(SHORT).toBe('abc123xyz7');
  });

  it('aceita a VM cujo nome carrega o shortUid do dono', () => {
    expect(isOwnedGcpInstanceName(`pacs-${SHORT}-a1`, UID)).toBe(true);
  });

  it('recusa a VM de OUTRO usuário', () => {
    expect(isOwnedGcpInstanceName('pacs-outrouid99-a1', UID)).toBe(false);
  });

  it('recusa a VM compartilhada (orthanc-server) e nomes arbitrários', () => {
    expect(isOwnedGcpInstanceName('orthanc-server', UID)).toBe(false);
    expect(isOwnedGcpInstanceName('', UID)).toBe(false);
    expect(isOwnedGcpInstanceName(`pacs-${SHORT}-a1-e-mais-coisa!`, UID)).toBe(false);
  });
});

describe('trava de instância única (shouldRejectExistingInstance)', () => {
  it('sem registro → permite provisionar', () => {
    expect(shouldRejectExistingInstance(null, false)).toBe(false);
    expect(shouldRejectExistingInstance(undefined, false)).toBe(false);
  });

  it('registro real (shared/gcp) sem flag → bloqueia', () => {
    expect(shouldRejectExistingInstance({ provider: 'shared' }, false)).toBe(true);
    expect(shouldRejectExistingInstance({ provider: 'gcp' }, false)).toBe(true);
  });

  it('registro real + reprovision explícito → permite', () => {
    expect(shouldRejectExistingInstance({ provider: 'gcp' }, true)).toBe(false);
  });

  it('registro mock/desconhecido → não bloqueia', () => {
    expect(shouldRejectExistingInstance({ provider: 'mock' }, false)).toBe(false);
  });
});

describe('destroyPacsInstance — guarda dura de nome de VM (gcp)', () => {
  const savedSaKey = process.env.GCP_SA_KEY;
  afterEach(() => {
    if (savedSaKey === undefined) delete process.env.GCP_SA_KEY;
    else process.env.GCP_SA_KEY = savedSaKey;
  });

  it('NUNCA destrói a VM compartilhada (orthanc-server), mesmo com pedido explícito', async () => {
    const r = await destroyPacsInstance({ provider: 'gcp', instanceName: 'orthanc-server' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/padrão de VM gerenciada/);
  });

  it('nome no padrão gerenciado passa da guarda (sem GCP configurado → nada a destruir)', async () => {
    delete process.env.GCP_SA_KEY;
    const r = await destroyPacsInstance({ provider: 'gcp', instanceName: 'pacs-abc123xyz7-a1' });
    expect(r.success).toBe(true);
    expect(r.note).toMatch(/GCP não configurado/);
  });
});
