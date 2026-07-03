import * as Sentry from '@sentry/react';

// ═══════════════════════════════════════════════════════════════
// SENTRY — monitoramento de erros em produção (LGPD-aware)
// ═══════════════════════════════════════════════════════════════
// Ativa apenas quando VITE_SENTRY_DSN está configurado (produção). Sem DSN,
// é no-op — nada é enviado (dev/local). Como o sistema lida com dados de saúde,
// removemos PII aparente e query strings (que podem conter tokens) antes do
// envio, e desativamos a coleta automática de PII do SDK.

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '';

/** Redige PII estrutural aparente de textos enviados ao Sentry. */
function redact(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, '[TEL]');
}

export function initSentry(): void {
  if (!DSN) return; // sem DSN → desativado (no-op)

  Sentry.init({
    dsn: DSN,
    environment:
      (import.meta.env.VITE_ENVIRONMENT as string | undefined) ||
      (import.meta.env.PROD ? 'production' : 'development'),
    // LGPD: nunca coletar PII automaticamente (IP, cookies, etc.).
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.message) event.message = redact(event.message);
      for (const ex of event.exception?.values || []) {
        if (ex.value) ex.value = redact(ex.value);
      }
      // Remove query string (pode conter token do proxy DICOM / credenciais).
      if (event.request?.url) event.request.url = event.request.url.split('?')[0];
      return event;
    },
  });
}

export { Sentry };
