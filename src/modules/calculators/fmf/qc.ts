// ═══════════════════════════════════════════════════════════════════════
// CONTROLE DE QUALIDADE (QC) — calculadoras FMF de 1º trimestre
// ═══════════════════════════════════════════════════════════════════════
// Faixas de plausibilidade e janelas de rastreamento. Puro/testável.
// ═══════════════════════════════════════════════════════════════════════

/** Faixa plausível de MoM para biomarcadores (fora disso: provável erro). */
export const MOM_MIN = 0.2;
export const MOM_MAX = 5.0;

/** Janela do rastreamento combinado de 1º trimestre. */
export const CRL_MIN_MM = 45;
export const CRL_MAX_MM = 84;
export const GA_MIN_WEEKS = 11;
export const GA_MAX_WEEKS = 13 + 6 / 7; // 13 semanas e 6 dias

/** Verdadeiro se o MoM está na faixa plausível (ausente/None ⇒ true). */
export function momPlausible(mom: number | undefined | null): boolean {
  if (mom === undefined || mom === null || !isFinite(mom)) return true;
  return mom >= MOM_MIN && mom <= MOM_MAX;
}

/**
 * IG (semanas decimais) a partir do CCN (mm) — Hadlock 1992
 * (mesma curva do CrlCalculator). Retorna null se CCN inválido.
 */
export function crlToGaWeeks(crlMm: number): number | null {
  if (!(crlMm > 0)) return null;
  const c = crlMm / 10; // cm
  const lnMA = 1.684969
    + 0.315646 * c
    - 0.049306 * Math.pow(c, 2)
    + 0.004057 * Math.pow(c, 3)
    - 0.000120456 * Math.pow(c, 4);
  return Math.exp(lnMA);
}

/** Verdadeiro se o CCN está na janela 45–84 mm do rastreamento. */
export function crlInWindow(crlMm: number): boolean {
  return crlMm >= CRL_MIN_MM && crlMm <= CRL_MAX_MM;
}

/** Formata IG decimal (semanas) como "12s 3d". */
export function formatGa(gaWeeks: number): string {
  const totalDays = Math.round(gaWeeks * 7);
  const w = Math.floor(totalDays / 7);
  const d = totalDays % 7;
  return `${w}s ${d}d`;
}
