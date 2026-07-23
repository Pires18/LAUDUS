import { describe, it, expect } from 'vitest';
import {
  getProxyEndpoint,
  getWorklistEndpoint,
  getActivePacsUrl,
  getDicomAuthParams,
} from '../store/db';
import { getStudyInstanceUID, getNumericUidFromFirestoreId } from '../utils/dicom';
import { resolveGeminiModel, isValidGeminiModel, getFallbackModel, VALID_GEMINI_MODELS, GEMINI_LITE_MODEL, GEMINI_PRO_MODEL } from '../modules/ai/engine';

// Ambiente de teste é 'node' → `window` é undefined. getActivePacsUrl ainda tem
// ramos por ambiente; getProxyEndpoint e getWorklistEndpoint NÃO — eles preferem
// o Agente HTTPS (Funnel) em qualquer ambiente, inclusive na nuvem (a Vercel não
// alcança o Funnel server-side, então o navegador fala direto com o agente).

describe('getProxyEndpoint', () => {
  it('roteia pelo Agente quando há URL HTTPS (Funnel/nuvem)', () => {
    const s = { dicomLocalAgentUrl: 'https://vm.tail123.ts.net/' } as any;
    expect(getProxyEndpoint(s)).toBe('https://vm.tail123.ts.net/api/orthanc-proxy');
  });

  it('usa same-origin quando não há agente ou o agente é HTTP', () => {
    expect(getProxyEndpoint({} as any)).toBe('/api/orthanc-proxy');
    expect(getProxyEndpoint({ dicomLocalAgentUrl: 'http://192.168.0.10:3000' } as any))
      .toBe('/api/orthanc-proxy');
  });

  it('respeita o agente de backup quando isBackup=true', () => {
    const s = { dicomBackupLocalAgentUrl: 'https://bkp.tail.ts.net' } as any;
    expect(getProxyEndpoint(s, true)).toBe('https://bkp.tail.ts.net/api/orthanc-proxy');
  });
});

describe('getWorklistEndpoint', () => {
  it('fala direto com o Agente HTTPS quando configurado (grava .wl na VM)', () => {
    const s = { dicomLocalAgentUrl: 'https://vm.tail.ts.net' } as any;
    expect(getWorklistEndpoint(s)).toBe('https://vm.tail.ts.net/api/worklist');
  });

  it('cai no same-origin sem agente HTTPS', () => {
    expect(getWorklistEndpoint({} as any)).toBe('/api/worklist');
    expect(getWorklistEndpoint({ dicomLocalAgentUrl: 'http://localhost:3000' } as any))
      .toBe('/api/worklist');
  });

  it('inclui ?tenantId= ao falar direto com o Agente (VM compartilhada multi-tenant)', () => {
    const s = { dicomLocalAgentUrl: 'https://vm.tail.ts.net', dicomTenantId: 't1da0af' } as any;
    expect(getWorklistEndpoint(s)).toBe('https://vm.tail.ts.net/api/worklist?tenantId=t1da0af');
  });

  it('NÃO inclui tenantId no agente de backup (single-tenant do próprio cliente)', () => {
    const s = { dicomBackupLocalAgentUrl: 'https://bkp.tail.ts.net', dicomTenantId: 't1da0af' } as any;
    expect(getWorklistEndpoint(s, true)).toBe('https://bkp.tail.ts.net/api/worklist');
  });
});

describe('getActivePacsUrl', () => {
  it('retorna a URL do Orthanc configurada (ex.: localhost na VM)', () => {
    expect(getActivePacsUrl({ dicomViewerUrl: 'http://localhost:8042' } as any))
      .toBe('http://localhost:8042');
  });

  it('cai no localhost:8042 quando nada está configurado', () => {
    expect(getActivePacsUrl({} as any)).toBe('http://localhost:8042');
  });

  it('usa a URL do servidor de backup quando isBackup=true', () => {
    const s = { dicomBackupViewerUrl: 'http://10.0.0.5:8042' } as any;
    expect(getActivePacsUrl(s, true)).toBe('http://10.0.0.5:8042');
  });
});

describe('getDicomAuthParams', () => {
  it('inclui usuário/senha codificados na query', () => {
    const params = getDicomAuthParams({ dicomUsername: 'admin', dicomPassword: 'p@ss word' } as any);
    expect(params).toContain('username=admin');
    expect(params).toContain('password=p%40ss%20word');
  });

  it('inclui o segredo do agente quando presente (necessário para <img>)', () => {
    const params = getDicomAuthParams({ dicomAgentSecret: 'sec/ret' } as any);
    expect(params).toContain('agentSecret=sec%2Fret');
  });

  it('omite o segredo do agente quando ausente', () => {
    const params = getDicomAuthParams({ dicomUsername: 'x', dicomPassword: 'y' } as any);
    expect(params).not.toContain('agentSecret=');
  });

  it('usa credenciais de backup quando isBackup=true', () => {
    const params = getDicomAuthParams(
      { dicomBackupUsername: 'bkp', dicomBackupPassword: 'z' } as any,
      true,
    );
    expect(params).toContain('username=bkp');
  });
});

describe('getStudyInstanceUID / getNumericUidFromFirestoreId', () => {
  it('gera um UID DICOM com o prefixo padrão', () => {
    const uid = getStudyInstanceUID('abc123');
    expect(uid.startsWith('1.2.276.0.7230010.3.1.2.')).toBe(true);
  });

  it('é determinístico para o mesmo examId', () => {
    expect(getStudyInstanceUID('exam_XyZ')).toBe(getStudyInstanceUID('exam_XyZ'));
  });

  it('examId vazio → string vazia', () => {
    expect(getStudyInstanceUID('')).toBe('');
  });

  it('IDs diferentes geram numéricos diferentes (sem colisão trivial)', () => {
    const a = getNumericUidFromFirestoreId('aaaaaa');
    const b = getNumericUidFromFirestoreId('aaaaab');
    expect(a).not.toBe(b);
    expect(/^\d+$/.test(a)).toBe(true); // só dígitos
  });
});

describe('resolveGeminiModel', () => {
  it('honra um ID válido conhecido (permite trocar de modelo via config do Firestore)', () => {
    expect(resolveGeminiModel('gemini-3.6-flash')).toBe('gemini-3.6-flash');
    expect(resolveGeminiModel('gemini-3.1-pro-preview')).toBe('gemini-3.1-pro-preview'); // honrado (opt-in), não o default
    expect(resolveGeminiModel('gemini-2.5-pro')).toBe(GEMINI_PRO_MODEL);                 // 2.5-pro É o default do Pro
    expect(resolveGeminiModel('gemini-3.5-flash')).toBe(GEMINI_LITE_MODEL);
  });

  it('sem ID válido, usa o default do motor informado', () => {
    expect(resolveGeminiModel('lixo', 'pro')).toBe(GEMINI_PRO_MODEL);
    expect(resolveGeminiModel('lixo', 'lite')).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel(undefined, 'pro')).toBe(GEMINI_PRO_MODEL);
  });

  it('sem ID válido nem motor, cai na heurística: "pro" → Pro, resto → Lite', () => {
    expect(resolveGeminiModel('PRO')).toBe(GEMINI_PRO_MODEL);
    expect(resolveGeminiModel('gemini-2.5-pro-preview-06-05')).toBe(GEMINI_PRO_MODEL); // datado, fora do allowlist
    expect(resolveGeminiModel('gemini-2.5-flash-preview-05-20')).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel(undefined)).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel('')).toBe(GEMINI_LITE_MODEL);
  });

  it('NUNCA emite um ID fora do allowlist (IDs aposentados como 1.5 são remapeados)', () => {
    for (const input of ['gemini-1.5-pro', 'gemini-1.5-flash', 'modelo-inexistente', '']) {
      expect(VALID_GEMINI_MODELS).toContain(resolveGeminiModel(input));
    }
  });

  it('isValidGeminiModel reconhece só IDs do allowlist', () => {
    expect(isValidGeminiModel('gemini-3.5-flash')).toBe(true);
    expect(isValidGeminiModel('gemini-3.1-pro-preview')).toBe(true);
    expect(isValidGeminiModel('gemini-1.5-flash')).toBe(false);
    expect(isValidGeminiModel('')).toBe(false);
    expect(isValidGeminiModel(undefined)).toBe(false);
  });
});

describe('getFallbackModel (contingência em 503/404)', () => {
  it('quem opta pelo Pro preview cai para o Pro GA (mesmo nível, capacidade estável)', () => {
    expect(getFallbackModel('gemini-3.1-pro-preview')).toBe(GEMINI_PRO_MODEL); // GA default
  });

  it('o Lite tem contingência definida', () => {
    expect(getFallbackModel(GEMINI_LITE_MODEL)).toBe('gemini-2.5-flash');
  });

  it('todo alvo de fallback é ele mesmo um ID válido do allowlist', () => {
    for (const primary of [GEMINI_LITE_MODEL, GEMINI_PRO_MODEL, 'gemini-3.6-flash']) {
      const fb = getFallbackModel(primary);
      if (fb) expect(VALID_GEMINI_MODELS).toContain(fb);
    }
  });

  it('modelo sem contingência retorna undefined (não força troca)', () => {
    expect(getFallbackModel('gemini-2.5-pro')).toBeUndefined();
    expect(getFallbackModel('')).toBeUndefined();
    expect(getFallbackModel(undefined)).toBeUndefined();
  });
});
