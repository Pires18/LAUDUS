/**
 * Fonte ÚNICA de preço por modelo Gemini (USD por 1M tokens). Usada tanto pelo
 * cálculo real de custo (`ai/engine.ts`) quanto pela tabela de referência do
 * Admin (`IACostsTab`) — antes eram duas tabelas hardcoded separadas, com
 * chaves de modelo diferentes, que nunca de fato batiam com o modelo usado.
 * Módulo próprio (não dentro de `engine.ts`) para não puxar todo o motor de
 * geração de laudos (Firestore, Tiptap-adjacent, etc.) pro bundle do Admin.
 */
// Preços verificados na doc oficial do Google (ai.google.dev/gemini-api/docs/pricing,
// atualizada 21/jul/2026) — USD por 1M tokens, tier pago, faixa base (prompts ≤200k).
// Reconferir ao trocar de modelo: pricing muda.
export const GEMINI_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // ── Em uso / selecionáveis no Admin ──
  'gemini-3.6-flash':        { input: 1.50, output: 7.50  },
  'gemini-3.5-flash':        { input: 1.50, output: 9.00  }, // Lite (default)
  'gemini-flash-latest':     { input: 1.50, output: 9.00  }, // alias do 3.5-flash
  'gemini-3.5-flash-lite':   { input: 0.30, output: 2.50  },
  'gemini-2.5-pro':          { input: 1.25, output: 10.00 }, // Pro (default)
  'gemini-3.1-pro-preview':  { input: 2.00, output: 12.00 }, // Pro (opt-in, preview)
  'gemini-2.5-flash':        { input: 0.30, output: 2.50  },
  'gemini-2.5-flash-lite':   { input: 0.10, output: 0.40  },
  // ── Legado: IDs datados que ainda podem aparecer em métricas históricas ──
  'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.60  },
  'gemini-2.5-pro-preview-06-05':   { input: 1.25, output: 10.00 },
};
