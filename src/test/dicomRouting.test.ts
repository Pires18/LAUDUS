import { describe, it, expect } from 'vitest';
import {
  getProxyEndpoint,
  getWorklistEndpoint,
  getActivePacsUrl,
  getDicomAuthParams,
} from '../store/db';
import { getStudyInstanceUID, getNumericUidFromFirestoreId } from '../utils/dicom';
import { resolveGeminiModel, GEMINI_LITE_MODEL, GEMINI_PRO_MODEL } from '../modules/ai/engine';

// Ambiente de teste é 'node' → `window` é undefined, então getActivePacsUrl/
// getWorklistEndpoint tomam o ramo não-Vercel (comportamento local/on-premise).

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
  it('mapeia qualquer variante "pro" para o modelo Pro atual', () => {
    expect(resolveGeminiModel('gemini-3.1-pro-preview')).toBe(GEMINI_PRO_MODEL);
    expect(resolveGeminiModel('gemini-2.5-pro-preview-06-05')).toBe(GEMINI_PRO_MODEL);
    expect(resolveGeminiModel('PRO')).toBe(GEMINI_PRO_MODEL);
  });

  it('mapeia flash/vazio/legado para o modelo Lite atual', () => {
    expect(resolveGeminiModel('gemini-3.5-flash')).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel('gemini-2.5-flash-preview-05-20')).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel(undefined)).toBe(GEMINI_LITE_MODEL);
    expect(resolveGeminiModel('')).toBe(GEMINI_LITE_MODEL);
  });

  it('NUNCA emite IDs de modelo mortos (2.5/1.5 → 404)', () => {
    for (const input of ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']) {
      const out = resolveGeminiModel(input);
      expect(out === GEMINI_LITE_MODEL || out === GEMINI_PRO_MODEL).toBe(true);
    }
  });
});
