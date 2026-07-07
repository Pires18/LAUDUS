/**
 * Logger centralizado — silencia logs em produção.
 * Erros são sempre registrados (necessários para debugging) e reportados ao
 * Sentry quando VITE_SENTRY_DSN está configurado (initSentry é no-op sem DSN,
 * então captureException some silenciosamente em dev/local).
 * Avisos e logs informativos apenas em desenvolvimento.
 */
import { Sentry } from '../lib/sentry';

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
    Sentry.captureException(err instanceof Error ? err : new Error(message), {
      extra: { message },
    });
  },
};
