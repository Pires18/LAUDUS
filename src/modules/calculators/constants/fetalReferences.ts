/**
 * Referências e utilitários compartilhados de Medicina Fetal.
 *
 * Centraliza as tabelas normativas de Doppler e a lógica de cálculo de
 * percentis (biometria OMS e índices Doppler) usadas pelas calculadoras
 * de Doppler Fetal, Crescimento Fetal (Barcelona) e Biometria Fetal (OMS).
 *
 * Tabelas: [média, desvio-padrão] por semana de idade gestacional.
 */
import { WHO_COEFFICIENTS } from './whoCoefficients';

export type FetalRefTable = Record<number, [number, number]>;
export type WHODimension = keyof typeof WHO_COEFFICIENTS;

/** Artéria Umbilical — IP (Arduini & Rizzo, 1990) */
export const UA_REF: FetalRefTable = {
  20: [1.54, 0.37], 21: [1.47, 0.34], 22: [1.41, 0.32], 23: [1.35, 0.30], 24: [1.30, 0.28], 25: [1.25, 0.27],
  26: [1.20, 0.25], 27: [1.16, 0.24], 28: [1.12, 0.23], 29: [1.08, 0.22], 30: [1.05, 0.21], 31: [1.02, 0.20],
  32: [0.99, 0.19], 33: [0.96, 0.19], 34: [0.94, 0.18], 35: [0.92, 0.18], 36: [0.90, 0.17], 37: [0.89, 0.17],
  38: [0.87, 0.17], 39: [0.86, 0.16], 40: [0.85, 0.16],
};

/** Artéria Cerebral Média — IP (Mari & Deter, 1992) */
export const MCA_REF: FetalRefTable = {
  20: [1.60, 0.30], 21: [1.62, 0.31], 22: [1.65, 0.32], 23: [1.68, 0.33], 24: [1.71, 0.33], 25: [1.74, 0.34],
  26: [1.77, 0.34], 27: [1.80, 0.35], 28: [1.82, 0.35], 29: [1.83, 0.36], 30: [1.84, 0.36], 31: [1.84, 0.36],
  32: [1.83, 0.36], 33: [1.82, 0.36], 34: [1.79, 0.35], 35: [1.76, 0.35], 36: [1.71, 0.34], 37: [1.66, 0.33],
  38: [1.60, 0.32], 39: [1.53, 0.31], 40: [1.45, 0.29],
};

/** Artérias Uterinas — IP médio (Gómez, 2008) */
export const UTA_REF: FetalRefTable = {
  20: [1.20, 0.32], 21: [1.16, 0.31], 22: [1.12, 0.30], 23: [1.08, 0.29], 24: [1.04, 0.28], 25: [1.01, 0.27],
  26: [0.98, 0.26], 27: [0.95, 0.25], 28: [0.92, 0.25], 29: [0.90, 0.24], 30: [0.87, 0.24], 31: [0.85, 0.23],
  32: [0.83, 0.23], 33: [0.81, 0.22], 34: [0.79, 0.22], 35: [0.77, 0.21], 36: [0.76, 0.21], 37: [0.74, 0.21],
  38: [0.73, 0.20], 39: [0.72, 0.20], 40: [0.71, 0.20],
};

/** Ducto Venoso — PIV (Hecher, 1994) */
export const DV_REF: FetalRefTable = {
  20: [0.65, 0.18], 22: [0.60, 0.17], 24: [0.56, 0.16], 26: [0.53, 0.15], 28: [0.50, 0.14], 30: [0.48, 0.14],
  32: [0.45, 0.13], 34: [0.43, 0.13], 36: [0.41, 0.12], 38: [0.39, 0.12], 40: [0.38, 0.11],
};

/** Faixa de idade gestacional (semanas) com validação Doppler. */
export const DOPPLER_GA_MIN = 20;
export const DOPPLER_GA_MAX = 40;

/** Aproximação da função erro (Abramowitz & Stegun 7.1.26). */
function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return s * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}

/** Converte z-score em percentil (1–99). */
export function zToPercentile(z: number): number {
  return Math.max(1, Math.min(99, Math.round(50 * (1 + erf(z / Math.sqrt(2))))));
}

/** Interpola [média, DP] para a IG informada a partir de uma tabela normativa. */
export function getRef(table: FetalRefTable, ga: number): [number, number] {
  if (table[ga]) return table[ga];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (ga <= keys[0]) return table[keys[0]];
  if (ga >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  const lo = keys.filter(k => k <= ga).pop()!;
  const hi = keys.filter(k => k > ga).shift()!;
  const frac = (ga - lo) / (hi - lo);
  return [
    table[lo][0] + (table[hi][0] - table[lo][0]) * frac,
    table[lo][1] + (table[hi][1] - table[lo][1]) * frac,
  ];
}

/** Referência da Relação Cerebro-Placentária (ACM/AU) derivada das médias. */
export function getCprRef(ga: number): [number, number] {
  const [mcaM] = getRef(MCA_REF, ga);
  const [uaM] = getRef(UA_REF, ga);
  const mean = mcaM / uaM;
  const sd = mean * 0.18; // ~18% CV, aproximação baseada na literatura
  return [mean, sd];
}

/**
 * Percentil OMS (Kiserud, 2017) para uma dimensão biométrica.
 * Válido entre 14 e 40 semanas. Interpolação logarítmica entre quantis.
 */
export function getWhoPercentile(dimension: WHODimension, gaWeeks: number, value: number): number | null {
  if (gaWeeks < 14 || gaWeeks > 40 || value <= 0) return null;

  const coeffs = WHO_COEFFICIENTS[dimension];
  if (!coeffs) return null;

  const evaluated = coeffs.map(c => {
    const poly = c.b0 + c.b1 * gaWeeks + c.b2 * Math.pow(gaWeeks, 2) + c.b3 * Math.pow(gaWeeks, 3) + c.b4 * Math.pow(gaWeeks, 4);
    return { q: c.q, val: Math.exp(poly) };
  });

  if (value <= evaluated[0].val) return 1;
  if (value >= evaluated[evaluated.length - 1].val) return 99;

  for (let i = 0; i < evaluated.length - 1; i++) {
    const q1 = evaluated[i];
    const q2 = evaluated[i + 1];
    if (value >= q1.val && value <= q2.val) {
      if (value === q1.val) return Math.round(q1.q * 100);
      if (value === q2.val) return Math.round(q2.q * 100);
      const frac = (Math.log(value) - Math.log(q1.val)) / (Math.log(q2.val) - Math.log(q1.val));
      const p = (q1.q + frac * (q2.q - q1.q)) * 100;
      return Math.max(1, Math.min(99, Math.round(p)));
    }
  }
  return null;
}

/**
 * Peso Fetal Estimado pela fórmula de Hadlock IV (em gramas).
 * Recebe medidas em milímetros (DBP, CC, CA, CF).
 */
export function calcHadlockEfw(bpdMm: number, hcMm: number, acMm: number, flMm: number): number {
  const b = bpdMm / 10, h = hcMm / 10, a = acMm / 10, f = flMm / 10;
  const logEfw = 1.3596 + 0.0064 * h + 0.0424 * a + 0.174 * f + 0.00061 * b * a - 0.00386 * a * f;
  return Math.pow(10, logEfw);
}

/**
 * Mediana do Pico de Velocidade Sistólica da ACM (PSV-ACM), em cm/s, por IG (Mari, 2000).
 * Ajuste log-linear às medianas publicadas (1,00 MoM): mediana = e^(2,3129 + 0,0463·IG).
 * Anchors validados: 20 sem ≈ 25,5 · 24 ≈ 30,7 · 28 ≈ 36,9 · 32 ≈ 44,4 · 36 ≈ 53,5 cm/s.
 */
export function mcaPsvMedianCmS(gaWeeks: number): number {
  const g = Math.max(15, Math.min(42, gaWeeks));
  return Math.exp(2.3129 + 0.0463 * g);
}

/**
 * PSV-ACM em Múltiplos da Mediana (MoM) = valor medido ÷ mediana da IG (Mari, 2000).
 * > 1,5 MoM = anemia fetal moderada a grave (sensibilidade ~100%). Usar SEMPRE MoM,
 * nunca o cm/s absoluto isolado (o mesmo cm/s muda de MoM conforme a IG).
 */
export function mcaPsvMoM(psvCmS: number, gaWeeks: number): number {
  return psvCmS / mcaPsvMedianCmS(gaWeeks);
}

/** Inversa da normal padrão (probit / quantil) — algoritmo de Acklam. */
function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const plow = 0.02425, phigh = 1 - plow;
  if (p < plow) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p <= phigh) { const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** Avalia os quantis OMS (valor por quantil) para a dimensão/IG informadas. */
function whoQuantiles(dimension: WHODimension, gaWeeks: number): { z: number; val: number }[] | null {
  const coeffs = WHO_COEFFICIENTS[dimension];
  if (!coeffs) return null;
  return coeffs
    .map((c) => ({
      z: probit(c.q),
      val: Math.exp(c.b0 + c.b1 * gaWeeks + c.b2 * gaWeeks ** 2 + c.b3 * gaWeeks ** 3 + c.b4 * gaWeeks ** 4),
    }))
    .sort((p, q) => p.val - q.val);
}

/** Z-score contínuo OMS (Kiserud, 2017) — interpolação em log(valor) entre quantis. */
export function getWhoZScore(dimension: WHODimension, gaWeeks: number, value: number): number | null {
  if (gaWeeks < 14 || gaWeeks > 40 || value <= 0) return null;
  const q = whoQuantiles(dimension, gaWeeks);
  if (!q) return null;
  const clamp = (z: number) => Math.max(-4, Math.min(4, z));
  if (value <= q[0].val) return clamp(q[0].z);
  const last = q[q.length - 1];
  if (value >= last.val) return clamp(last.z);
  for (let i = 0; i < q.length - 1; i++) {
    if (value >= q[i].val && value <= q[i + 1].val) {
      const frac = (Math.log(value) - Math.log(q[i].val)) / (Math.log(q[i + 1].val) - Math.log(q[i].val));
      return clamp(q[i].z + frac * (q[i + 1].z - q[i].z));
    }
  }
  return null;
}

/** Inversa: valor OMS esperado para um dado z-score na IG (para projeção de crescimento). */
export function getWhoValueAtZ(dimension: WHODimension, gaWeeks: number, z: number): number | null {
  if (gaWeeks < 14 || gaWeeks > 40) return null;
  const q = whoQuantiles(dimension, gaWeeks);
  if (!q) return null; // já ordenado por val (⇒ por z, ambos monotônicos)
  if (z <= q[0].z) return q[0].val;
  const last = q[q.length - 1];
  if (z >= last.z) return last.val;
  for (let i = 0; i < q.length - 1; i++) {
    if (z >= q[i].z && z <= q[i + 1].z) {
      const frac = (z - q[i].z) / (q[i + 1].z - q[i].z);
      return Math.exp(Math.log(q[i].val) + frac * (Math.log(q[i + 1].val) - Math.log(q[i].val)));
    }
  }
  return null;
}

export type FetalSex = 'male' | 'female' | 'unknown';
export interface GrowthVelocityInput {
  efw1: number; ga1Weeks: number; // exame anterior
  efw2: number; ga2Weeks: number; // exame atual
  sex?: FetalSex;
}
export interface GrowthVelocityResult {
  intervalWeeks: number;
  z1: number; z2: number;
  zVelocityPerWeek: number;   // Δz-score de EPF por semana
  projectedEfw2: number;      // EPF projetada (mesmo z do exame anterior)
  pctVsProjected: number;     // desvio % vs. a projeção
  pctRaw: number;             // variação bruta de peso entre exames
  percentile1: number; percentile2: number;
  centileDrop: number;        // queda de percentil (p1 − p2)
  classification: 'deceleration' | 'adequate' | 'acceleration';
  reliable: boolean;          // false se intervalo < 2 semanas
  alert: boolean;             // true na desaceleração significativa
}

/**
 * Velocidade de crescimento fetal entre dois exames (perinatal.org.uk — Hugh & Gardosi, UOG 2022).
 * Métrica primária: Δz-score de EPF por semana; limiar patológico < −0,13 z/semana
 * (associado a ~6× mais risco de óbito perinatal, mesmo com EPF ≥ P10).
 * Métricas de apoio: desvio % vs. a projeção no mesmo percentil (lento ≈ −8%, acelerado ≈ +9,3%)
 * e queda de percentil (>2 quartis = desaceleração no critério Delphi).
 */
export function computeGrowthVelocity(input: GrowthVelocityInput): GrowthVelocityResult | null {
  const { efw1, ga1Weeks, efw2, ga2Weeks } = input;
  if (!(efw1 > 0) || !(efw2 > 0)) return null;
  const intervalWeeks = ga2Weeks - ga1Weeks;
  if (!(intervalWeeks > 0)) return null;

  const dim: WHODimension = input.sex === 'male' ? 'EFW_M' : input.sex === 'female' ? 'EFW_F' : 'EFW';
  const z1 = getWhoZScore(dim, ga1Weeks, efw1);
  const z2 = getWhoZScore(dim, ga2Weeks, efw2);
  const p1 = getWhoPercentile(dim, ga1Weeks, efw1);
  const p2 = getWhoPercentile(dim, ga2Weeks, efw2);
  if (z1 == null || z2 == null || p1 == null || p2 == null) return null;

  const zVelocityPerWeek = (z2 - z1) / intervalWeeks;
  const projectedEfw2 = getWhoValueAtZ(dim, ga2Weeks, z1) ?? efw1;
  const pctVsProjected = ((efw2 - projectedEfw2) / projectedEfw2) * 100;
  const pctRaw = ((efw2 - efw1) / efw1) * 100;
  const centileDrop = p1 - p2;

  let classification: GrowthVelocityResult['classification'] = 'adequate';
  if (zVelocityPerWeek < -0.13 || pctVsProjected <= -8) classification = 'deceleration';
  else if (pctVsProjected >= 9.3) classification = 'acceleration';

  return {
    intervalWeeks, z1, z2, zVelocityPerWeek, projectedEfw2, pctVsProjected, pctRaw,
    percentile1: p1, percentile2: p2, centileDrop,
    classification, reliable: intervalWeeks >= 2, alert: classification === 'deceleration',
  };
}
