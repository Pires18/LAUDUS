// ═══════════════════════════════════════════════════════════════════════
// MEDIANAS ESPERADAS → cálculo automático de MoM (Multiple of Median)
// ═══════════════════════════════════════════════════════════════════════
//   MoM = valor medido / mediana esperada (10^(log10 mediana))
//
// PE (MAP, IP uterinas, PlGF): equações de regressão de Tan MY et al.,
// UOG 2018, Appendix S1 — com interceptos POR ANALISADOR (Roche Cobas e411,
// DELFIA Xpress, BRAHMS Kryptor). log10 da mediana. Referência: caucasiana,
// não-fumante, nulípara, sem comorbidade, concepção espontânea.
//
// ⚠️ MEDIANS_VALIDATED=false até conferir com casos-ouro.
// ═══════════════════════════════════════════════════════════════════════

import type { RacialOrigin } from './preeclampsia';

export const MEDIANS_VALIDATED = false;

export type Analyzer = 'cobas' | 'delfia' | 'kryptor';
export type DiabetesKind = 'none' | 'type1' | 'type2insulin' | 'type2noinsulin';
export type ParityKind = 'nulliparous' | 'parousNoPE' | 'parousPE';

export interface PeMedianCovariates {
  gaDays: number;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  racialOrigin: RacialOrigin;
  smoker: boolean;
  chronicHypertension: boolean;
  diabetes: DiabetesKind;
  ivf: boolean;
  parity: ParityKind;
  /** Intervalo entre gestações (anos); default 2 (interação nula). */
  intervalYears?: number;
}

/** MoM = medido / mediana. undefined se dados insuficientes. */
export function toMoM(measured: number | undefined, median: number | null): number | undefined {
  if (measured === undefined || !(measured > 0) || !median || median <= 0) return undefined;
  return measured / median;
}

// ─── Mediana da TN (mm) por CCN — provisória (o motor usa o modelo de mistura).
export function ntMedianMm(crlMm: number): number | null {
  if (!(crlMm > 0)) return null;
  return 1.024 + 0.0128 * crlMm;
}

// ─── MAP (mmHg): log10 mediana; intercepto 1.9364 (Tan Appendix S1) ───────
export function mapMedianMmHg(c: PeMedianCovariates): number | null {
  if (!(c.gaDays > 0)) return null;
  const g = c.gaDays - 77, w = c.weightKg - 69, h = c.heightCm - 164;
  let s = 1.936400
    + 0.000428017 * g - 0.000028811 * g * g
    + 0.001205300 * w - 0.000009280 * w * w
    - 0.000181570 * h;
  if (c.racialOrigin === 'afroCaribbean') s += -0.003930;
  if (c.smoker) s += -0.008640;
  if (c.chronicHypertension) s += 0.053630 + -0.000239750 * w;
  if (c.diabetes !== 'none') s += 0.004370;
  // familyHistoryPE não está no input de medianas — omitido (efeito 0.006240 quando presente)
  if (c.parity === 'parousNoPE') s += -0.006630 + 0.000826390 * ((c.intervalYears ?? 2) - 2);
  if (c.parity === 'parousPE') s += 0.008570;
  return Math.pow(10, s);
}

// ─── IP uterinas: log10 mediana; intercepto 0.26457 (Tan Appendix S1) ─────
export function utaPiMedian(c: PeMedianCovariates): number | null {
  if (!(c.gaDays > 0)) return null;
  const g = c.gaDays - 77, w = c.weightKg - 69, a = c.ageYears - 35;
  let s = 0.264570
    - 0.004838365 * g
    - 0.000874430 * w + 0.000007330 * w * w
    - 0.000641750 * a;
  if (c.racialOrigin === 'afroCaribbean') s += 0.021620;
  if (c.racialOrigin === 'eastAsian') s += 0.007630;
  if (c.racialOrigin === 'mixed') s += 0.011990;
  if (c.diabetes === 'type1') s += -0.027490;
  if (c.parity === 'parousNoPE') s += -0.002950;
  if (c.parity === 'parousPE') s += 0.009650;
  return Math.pow(10, s);
}

// ─── PlGF: log10 mediana; intercepto por analisador (Tan Appendix S1) ─────
const PLGF_INTERCEPT: Record<Analyzer, number> = {
  cobas: 1.542535524,
  delfia: 1.332959332,
  kryptor: 1.430615169,
};

export function plgfMedian(c: PeMedianCovariates, analyzer: Analyzer = 'cobas'): number | null {
  if (!(c.gaDays > 0)) return null;
  const g = c.gaDays - 77, w = c.weightKg - 69, a = c.ageYears - 35;
  let s = PLGF_INTERCEPT[analyzer]
    + 0.012263018 * g + 0.000149743 * g * g
    - 0.001682761 * w + 0.000008780 * w * w
    + 0.002174191 * a;
  if (c.racialOrigin === 'afroCaribbean') s += 0.193561059;
  if (c.racialOrigin === 'southAsian') s += 0.072679108;
  if (c.racialOrigin === 'eastAsian') s += 0.034550109;
  if (c.racialOrigin === 'mixed') s += 0.079010576;
  if (c.smoker) s += 0.160836176;
  if (c.diabetes === 'type1') s += -0.029630891;
  if (c.diabetes === 'type2insulin') s += -0.039984195;
  if (c.ivf) s += -0.022250585;
  if (c.parity === 'parousNoPE') s += 0.020750050;
  return Math.pow(10, s);
}
