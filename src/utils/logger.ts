/**
 * Logger centralizado — silencia logs em produção.
 * Erros são sempre registrados (necessários para debugging).
 * Avisos e logs informativos apenas em desenvolvimento.
 *
 * Preparado para integração futura com Sentry:
 *   Substitua os console.error por Sentry.captureException(err)
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },

  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args);
  },

  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },

  error: (message: string, err?: unknown): void => {
    // Erros sempre logados (mesmo em produção) para debugging crítico
    if (err !== undefined) {
      console.error(`[LAUDUS] ${message}`, err);
    } else {
      console.error(`[LAUDUS] ${message}`);
    }
    // TODO: Sentry.captureException(err, { extra: { message } });
  },
};
