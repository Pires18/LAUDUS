// ─── Retry com exponential backoff para chamadas ao proxy do Gemini ──────────
//
// fetch NÃO rejeita em erro HTTP: um 503 resolve normalmente com response.ok
// === false. Por isso, além de exceções (falha de rede), o retry também precisa
// inspecionar o status de objetos Response — senão um 503 "Model overloaded"
// volta na primeira tentativa sem nunca acionar o backoff.

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  // 1s, 2s, 4s (+ jitter para não sincronizar clientes)
  return 1000 * Math.pow(2, attempt) + Math.random() * 250;
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result instanceof Response && RETRYABLE_HTTP_STATUS.has(result.status) && attempt < maxRetries) {
        result.body?.cancel().catch(() => {});
        await sleep(backoffMs(attempt));
        continue;
      }
      return result;
    } catch (err) {
      if ((err instanceof Error && err.name === 'AbortError') || String(err).toLowerCase().includes('abort')) {
        throw err;
      }
      lastError = err;
      const msg = String(err);
      const isRetryable =
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('overloaded') ||
        msg.includes('rate_limit') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (attempt < maxRetries && isRetryable) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Converte um erro HTTP do proxy Gemini em Error com mensagem amigável.
 * Chamado depois que o withRetry esgotou as tentativas.
 */
export function geminiHttpError(status: number, errText: string, context = 'Gemini'): Error {
  if (status === 503 || errText.toLowerCase().includes('overloaded')) {
    return new Error(
      'O modelo do Gemini está sobrecarregado no momento (erro 503). ' +
      'Já re-tentamos automaticamente sem sucesso — aguarde alguns segundos e tente novamente.'
    );
  }
  if (status === 429) {
    return new Error(
      'Limite de requisições do Gemini atingido (erro 429). Aguarde um instante e tente novamente.'
    );
  }
  return new Error(`Erro na API do ${context} (${status}): ${errText}`);
}
