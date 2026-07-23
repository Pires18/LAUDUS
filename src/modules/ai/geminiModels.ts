// ═══════════════════════════════════════════════════════════════
// MODELOS GEMINI — FONTE ÚNICA DE VERDADE
// ═══════════════════════════════════════════════════════════════
// Todo ID de modelo Gemini que o sistema envia à API do Google nasce aqui.
// Antes os IDs estavam hardcoded em ~5 lugares (engine, provider, playground,
// generateTemplate, admin) com dois normalizadores gêmeos — atualizar um e
// esquecer outro fazia Lite/Pro divergirem em silêncio. Este módulo centraliza:
//   • os defaults de cada motor (Lite/Pro);
//   • o allowlist dos IDs que consideramos válidos na API (confirmados na doc
//     oficial do Google — evita mandar um ID inexistente e tomar 404);
//   • o resolvedor único usado pelo engine e pelo provider.
//
// Fonte dos IDs válidos: https://ai.google.dev/gemini-api/docs/models (jul/2026).

import type { Motor } from './motorProfiles';

/** Modelo padrão do Motor LITE (rápido/econômico). GA, é o atual gemini-flash-latest. */
export const GEMINI_LITE_MODEL = 'gemini-3.5-flash';
/**
 * Modelo padrão do Motor PRO. GA e estável — escolhido por confiabilidade
 * (o `gemini-3.1-pro-preview`, sendo -preview, sobrecarrega e retorna 503 sob
 * carga). O preview continua disponível como opção via Admin→Custos de IA e
 * como alvo de fallback; para promovê-lo de volta a default, basta trocá-lo aqui.
 */
export const GEMINI_PRO_MODEL = 'gemini-2.5-pro';

/**
 * IDs que aceitamos enviar à API do Google. Um valor configurado no Firestore
 * (`global_config/motor_config`) só é honrado se estiver nesta lista — caso
 * contrário, cai no default do motor. Assim um typo/ID morto na config nunca
 * chega ao Google como 404. Mantido em sincronia com a doc oficial.
 */
export const VALID_GEMINI_MODELS: readonly string[] = [
  'gemini-3.6-flash',       // GA, mais novo e mais barato que o 3.5-flash
  'gemini-3.5-flash',       // Lite (default)
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview', // Pro (opt-in, preview)
  'gemini-2.5-flash',
  'gemini-2.5-pro',         // Pro (default)
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',    // alias GA (aponta para o 3.5-flash hoje)
];

/** True se `id` é um ID que aceitamos enviar à API (comparação case-insensitive). */
export function isValidGeminiModel(id: string | undefined): boolean {
  const raw = (id || '').trim().toLowerCase();
  return VALID_GEMINI_MODELS.some((m) => m.toLowerCase() === raw);
}

/**
 * Classe de motor de um modelo (para telemetria/UI): qualquer modelo "pro" é
 * Pro; todo o resto (flash/flash-lite) é Lite. Fonte ÚNICA da classificação —
 * antes havia listas hardcoded paralelas (TelemetryDashboard/Dashboard) que
 * precisavam ser atualizadas a cada troca de modelo e esqueciam o Pro atual.
 */
export function motorForModel(model: string | undefined): 'lite' | 'pro' {
  return (model || '').toLowerCase().includes('pro') ? 'pro' : 'lite';
}

/**
 * Modelo GA de contingência quando o primário fica indisponível (503 sobrecarga
 * ou 404 descontinuado). O default do Pro já é GA (gemini-2.5-pro), mas quem
 * optar pelo preview `gemini-3.1-pro-preview` (via Admin) ainda cai para o GA
 * quando ele sobrecarregar. O fallback mantém o mesmo NÍVEL sempre que possível
 * (Pro→Pro GA) para não degradar a qualidade clínica. Todos os alvos estão em
 * VALID_GEMINI_MODELS.
 */
export const GEMINI_FALLBACK: Readonly<Record<string, string>> = {
  'gemini-3.1-pro-preview': 'gemini-2.5-pro',        // Pro preview (opt-in) → Pro GA (capacidade estável)
  'gemini-3.6-flash': 'gemini-3.5-flash',
  'gemini-3.5-flash': 'gemini-2.5-flash',
  'gemini-3.5-flash-lite': 'gemini-2.5-flash-lite',
};

/** Retorna o modelo de contingência para `model`, ou undefined se não houver. */
export function getFallbackModel(model: string | undefined): string | undefined {
  return GEMINI_FALLBACK[(model || '').trim().toLowerCase()];
}

/**
 * Resolve o ID de modelo FINAL enviado à API, em 3 camadas:
 *   1. Se `rawModel` é um ID válido conhecido → honra como está (permite trocar
 *      de modelo via config do Firestore sem redeploy — ex.: apontar o Lite pro
 *      gemini-3.6-flash, mais barato).
 *   2. Senão, se o motor é conhecido → usa o default daquele motor.
 *   3. Senão, heurística de compat: qualquer coisa com "pro" → Pro; resto → Lite.
 * Nunca emite um ID fora do allowlist.
 */
export function resolveGeminiModel(rawModel: string | undefined, motor?: Motor | string): string {
  const raw = (rawModel || '').trim().toLowerCase();

  // 1. ID válido explícito — honra a configuração.
  const known = VALID_GEMINI_MODELS.find((m) => m.toLowerCase() === raw);
  if (known) return known;

  // 2. Fallback pelo motor escolhido.
  if (motor === 'pro') return GEMINI_PRO_MODEL;
  if (motor === 'lite') return GEMINI_LITE_MODEL;

  // 3. Fallback por heurística (entradas legadas/livres, sem motor explícito).
  return raw.includes('pro') ? GEMINI_PRO_MODEL : GEMINI_LITE_MODEL;
}
