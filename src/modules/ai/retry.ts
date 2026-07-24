// ─── Retry com exponential backoff para chamadas ao proxy do Gemini ──────────
//
// fetch NÃO rejeita em erro HTTP: um 503 resolve normalmente com response.ok
// === false. Por isso, além de exceções (falha de rede), o retry também precisa
// inspecionar o status de objetos Response — senão um 503 "Model overloaded"
// volta na primeira tentativa sem nunca acionar o backoff.

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503]);

// 504 (timeout) é re-tentado NO MÁXIMO 1 vez: cada tentativa segura o usuário
// por até ~60s (até a plataforma matar a função de novo) e dispara uma geração
// completa — e cobrada — no Google que será descartada. Com o budget cheio de
// 3 retries, um timeout virava ~4 minutos de espera até o erro final.
const TIMEOUT_STATUS = 504;
const TIMEOUT_MAX_RETRIES = 1;

function retryBudgetForStatus(status: number, maxRetries: number): number {
  if (status === TIMEOUT_STATUS) return Math.min(TIMEOUT_MAX_RETRIES, maxRetries);
  return RETRYABLE_HTTP_STATUS.has(status) ? maxRetries : 0;
}

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
      if (result instanceof Response && attempt < retryBudgetForStatus(result.status, maxRetries)) {
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
      const isTimeout = msg.includes('504');
      const isRetryable =
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('overloaded') ||
        msg.includes('rate_limit') ||
        msg.includes('RESOURCE_EXHAUSTED');
      const budget = isTimeout ? Math.min(TIMEOUT_MAX_RETRIES, maxRetries) : maxRetries;
      if (attempt < budget && (isRetryable || isTimeout)) {
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
  const lower = (errText || '').toLowerCase();

  // ATENÇÃO: um 503 NÃO significa necessariamente "modelo sobrecarregado". O
  // próprio proxy (api/gemini.ts) devolve 503 quando GOOGLE_API_KEY está ausente,
  // e o Google devolve 403/permission quando a chave é inválida/sem billing.
  // Detectamos config ANTES de assumir sobrecarga — senão o erro real fica oculto
  // atrás de uma mensagem genérica de "tente de novo".
  const isConfigError =
    lower.includes('api key not configured') ||
    lower.includes('key not configured') ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('unregistered callers') ||
    lower.includes('billing') ||
    lower.includes('google_api_key') ||   // mensagens (prod/dev) que citam a env var
    lower.includes('chave de ia ausente'); // proxy de dev (vite middleware)
  if (isConfigError) {
    return new Error(
      'IA indisponível: a chave do servidor (GOOGLE_API_KEY) está ausente, inválida ou sem billing. ' +
      'Isso NÃO é sobrecarga — configure/renove a chave no ambiente (Vercel) e tente novamente. ' +
      `Detalhe: ${errText}`
    );
  }

  // Timeout da plataforma: a Vercel matou a função antes da geração terminar
  // (corpo é o texto interno "FUNCTION_INVOCATION_TIMEOUT", inútil pro usuário)
  // ou o gateway do Google expirou. Em ambos os casos a causa é geração longa
  // demais para o limite do servidor — mensagem acionável, sem vazar o erro cru.
  if (status === 504 || lower.includes('function_invocation_timeout')) {
    return new Error(
      'A geração demorou mais que o limite do servidor e foi interrompida (timeout 504). ' +
      'Tente novamente; se persistir, use o Motor Lite ou gere o laudo em partes menores.'
    );
  }

  // Sobrecarga REAL do modelo (503 UNAVAILABLE ou "overloaded" vindo do Google) —
  // transitória e não-acionável, mensagem limpa sem despejar o erro cru.
  if (status === 503 || lower.includes('overloaded') || lower.includes('unavailable')) {
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
