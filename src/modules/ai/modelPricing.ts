/**
 * Fonte ÚNICA de preço por modelo Gemini (USD por 1M tokens). Usada tanto pelo
 * cálculo real de custo (`ai/engine.ts`) quanto pela tabela de referência do
 * Admin (`IACostsTab`) — antes eram duas tabelas hardcoded separadas, com
 * chaves de modelo diferentes, que nunca de fato batiam com o modelo usado.
 * Módulo próprio (não dentro de `engine.ts`) para não puxar todo o motor de
 * geração de laudos (Firestore, Tiptap-adjacent, etc.) pro bundle do Admin.
 */
export const GEMINI_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash':               { input: 0.075, output: 0.30  },
  'gemini-3.1-pro-preview':         { input: 1.25,  output: 5.0   },
  'gemini-2.5-flash-preview-05-20': { input: 0.15,  output: 0.60  },
  'gemini-2.5-pro-preview-06-05':   { input: 1.25,  output: 10.0  },
};
