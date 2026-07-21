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
});
