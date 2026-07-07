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

/** Faixa plausível do PSV ratio BRUTO da artéria oftálmica (Gana 2022) —
 *  não é MoM (a razão em si, tipicamente ~0,3–1,0 na população). */
export const PSV_RATIO_MIN = 0.2;
export const PSV_RATIO_MAX = 2.0;

/** Verdadeiro se o PSV ratio bruto está na faixa plausível (ausente ⇒ true). */
export function psvRatioPlausible(value: number | undefined | null): boolean {
  if (value === undefined || value === null || !isFinite(value)) return true;
  return value >= PSV_RATIO_MIN && value <= PSV_RATIO_MAX;
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

/**
 * Teto de exibição do denominador de risco "1:N" — mesma convenção da
 * calculadora oficial da FMF, que também trava em 10.000. Risco muito baixo
 * (N grande) não muda a conduta clínica além desse ponto, então exibir
 * denominadores astronômicos (ex.: "1:2.847.392") só adiciona falsa precisão.
 *
 * Aplicado apenas na EXIBIÇÃO — o valor numérico bruto (não travado) segue
 * usado internamente para banda de risco, ordenação e testes.
 */
export const MAX_DISPLAYED_ONE_IN_N = 10000;

/**
 * Formata um risco "1:N" com separador de milhar (pt-BR) e teto em
 * MAX_DISPLAYED_ONE_IN_N — acima do teto, exibe ">1:10.000" em vez do
 * denominador real. `n` não finito/≤0 vira "—".
 */
export function formatOneInN(n: number, max: number = MAX_DISPLAYED_ONE_IN_N): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= max) return `>1:${max.toLocaleString('pt-BR')}`;
  return `1:${Math.round(n).toLocaleString('pt-BR')}`;
}
