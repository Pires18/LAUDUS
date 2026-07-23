import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, geminiHttpError } from '../modules/ai/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-tenta Response com status 503 e retorna a resposta bem-sucedida seguinte', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect((result as Response).status).toBe(200);
  });

  it('retorna a última Response 503 após esgotar as tentativas (caller trata o erro)', async () => {
    const fn = vi.fn(async () => new Response('overloaded', { status: 503 }));

    const promise = withRetry(fn, 2);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(3); // 1 tentativa + 2 retries
    expect((result as Response).status).toBe(503);
  });

  it('não re-tenta Response com status 400 (erro não transitório)', async () => {
    const fn = vi.fn(async () => new Response('bad request', { status: 400 }));

    const result = await withRetry(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect((result as Response).status).toBe(400);
  });

  it('re-tenta exceções com mensagem retryable (503 lançado)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Erro na API do Gemini (503): overloaded'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('não re-tenta AbortError', async () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    const fn = vi.fn().mockRejectedValue(abortErr);

    await expect(withRetry(fn)).rejects.toThrow('aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('geminiHttpError', () => {
  it('gera mensagem amigável para 503', () => {
    const err = geminiHttpError(503, '{"error":{"code":503,"message":"high demand"}}');
    expect(err.message).toContain('sobrecarregado');
    expect(err.message).not.toContain('high demand');
  });

  it('gera mensagem amigável para 429', () => {
    const err = geminiHttpError(429, 'rate limit');
    expect(err.message).toContain('429');
    expect(err.message).toContain('Limite de requisições');
  });

  it('mantém o formato original para outros status', () => {
    const err = geminiHttpError(404, 'not found');
    expect(err.message).toBe('Erro na API do Gemini (404): not found');
  });

  it('distingue erro de CONFIGURAÇÃO (chave ausente) de sobrecarga, mesmo em 503', () => {
    const err = geminiHttpError(503, '{"error":"Gemini API key not configured on server (defina GOOGLE_API_KEY no ambiente/Vercel)."}');
    expect(err.message).toContain('GOOGLE_API_KEY');
    expect(err.message).not.toContain('sobrecarregado');
  });

  it('trata chave inválida/sem billing (403 PERMISSION_DENIED) como config, não sobrecarga', () => {
    const err = geminiHttpError(403, 'PERMISSION_DENIED: API key not valid');
    expect(err.message).toContain('chave do servidor');
    expect(err.message).not.toContain('sobrecarregado');
  });

  it('trata o 503 do proxy de DEV (chave ausente no .env) como config, não sobrecarga', () => {
    const err = geminiHttpError(503, '{"error":"Chave de IA ausente no servidor de dev. Defina GOOGLE_API_KEY no .env e reinicie o \\"npm run dev\\"."}');
    expect(err.message).toContain('GOOGLE_API_KEY');
    expect(err.message).not.toContain('sobrecarregado');
  });
});
