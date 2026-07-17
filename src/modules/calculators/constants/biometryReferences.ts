import { getWhoPercentile, getWhoZScore, type WHODimension } from './fetalReferences';
import { HADLOCK_1984_BIOMETRY } from './hadlockBiometryData';

/**
 * REFERÊNCIAS DE BIOMETRIA FETAL — percentis de PFE e das biometrias por idade
 * gestacional, selecionáveis pelo médico. Todas EM PRODUÇÃO (`validated: true`).
 *
 * ┌────────────────┬───────────────────────────────────────┬────────────────────┐
 * │ Referência     │ Fonte                                 │ Cobertura          │
 * ├────────────────┼───────────────────────────────────────┼────────────────────┤
 * │ Hadlock        │ 1991 Radiology 181:129 (PFE)          │ PFE + DBP/CC/CA/CF │
 * │                │ 1984 Radiology 152:497 (biometria)    │ 12–40 sem          │
 * │ INTERGROWTH-21 │ Stirnemann 2017 UOG 49:478 (PFE)      │ PFE + DBP/CC/CA/CF │
 * │                │ Papageorghiou 2014 Lancet 384:869     │ 14–40 sem          │
 * │ OMS (WHO)      │ coeficientes de quantil por dimensão  │ PFE + biometrias   │
 * └────────────────┴───────────────────────────────────────┴────────────────────┘
 *
 * PADRÃO = `DEFAULT_BIOMETRY_REFERENCE` (Hadlock, 1ª validada da ordem de
 * preferência). Cada curva cobre uma janela de IG e um conjunto de dimensões;
 * fora disso o cálculo cai na OMS com `fellBack: true`, e a UI/o resumo dizem
 * de qual curva veio cada percentil.
 *
 * Coeficientes/tabelas: transcritos das fontes e auditados por
 * `src/test/biometryReferences.test.ts` e `src/test/hadlockBiometry.test.ts`
 * (âncoras publicadas, monotonicidade, e comparativos entre as três curvas).
 * Proveniência detalhada: docs/BIOMETRIA_REFERENCIAS_EXTRAIDAS.md
 */

export type BiometryReference = 'who' | 'hadlock' | 'intergrowth';

export interface BiometryReferenceMeta {
  id: BiometryReference;
  label: string;
  short: string;
  cite: string;
  validated: boolean;
  /** Dimensões com percentil disponível nesta referência. */
  dimensions: WHODimension[];
  note?: string;
}

/** Distribuição normal padrão acumulada → percentil (0–100). */
function zToPct(z: number): number {
  const p = 0.5 * (1 + erf(z / Math.SQRT2));
  return Math.round(Math.min(99.9, Math.max(0.1, p * 100)));
}

/** Aproximação de Abramowitz & Stegun 7.1.26 para a função erro. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

// ─────────────────────────── HADLOCK 1991 ───────────────────────────

/**
 * Peso fetal do percentil 50 por IG — Hadlock 1991 (equação do texto):
 *   PFE_p50(g) = e^(0,578 + 0,332·IG − 0,00354·IG²)   [IG em semanas]
 * Âncoras publicadas no abstract: 35 g em 10 sem e 3.619 g em 40 sem — ambas
 * reproduzidas por esta equação (34,6 g e 3.617 g) e travadas em teste.
 */
export function hadlockEfwMedian(gaWeeks: number): number {
  return Math.exp(0.578 + 0.332 * gaWeeks - 0.00354 * Math.pow(gaWeeks, 2));
}

/** Variância uniforme de ±12,7% (1 DP) em toda a gestação — Hadlock 1991. */
export const HADLOCK_CV = 0.127;

export function hadlockEfwZScore(gaWeeks: number, efwGrams: number): number | null {
  if (!(gaWeeks > 0 && efwGrams > 0)) return null;
  const median = hadlockEfwMedian(gaWeeks);
  if (!(median > 0)) return null;
  return (efwGrams - median) / (HADLOCK_CV * median);
}

/**
 * BIOMETRIA de Hadlock 1984 (tamanho por IG) — tabela do padrão com
 * interpolação linear entre os pontos de 0,5 semana. DP constante por
 * parâmetro; percentil por distribuição normal.
 */
export const HADLOCK_BIOMETRY_GA_MIN = 12;
export const HADLOCK_BIOMETRY_GA_MAX = 40;

type HadlockBiometryDim = keyof typeof HADLOCK_1984_BIOMETRY;

function isHadlockBiometryDim(dim: string): dim is HadlockBiometryDim {
  return dim in HADLOCK_1984_BIOMETRY;
}

/** Média (mm) da biometria por IG em Hadlock 1984 (interpolação linear). */
export function hadlockBiometryMedian(dim: string, gaWeeks: number): number | null {
  if (!isHadlockBiometryDim(dim)) return null;
  if (gaWeeks < HADLOCK_BIOMETRY_GA_MIN || gaWeeks > HADLOCK_BIOMETRY_GA_MAX) return null;
  const { table } = HADLOCK_1984_BIOMETRY[dim];
  // exato ou entre dois pontos
  for (let i = 0; i < table.length; i++) {
    const [ga, v] = table[i];
    if (Math.abs(ga - gaWeeks) < 1e-9) return v;
    if (ga > gaWeeks) {
      if (i === 0) return null;
      const [ga0, v0] = table[i - 1];
      const t = (gaWeeks - ga0) / (ga - ga0);
      return v0 + t * (v - v0);
    }
  }
  return table[table.length - 1][1];
}

export function hadlockBiometryZScore(dim: string, gaWeeks: number, valueMm: number): number | null {
  if (!isHadlockBiometryDim(dim) || !(valueMm > 0)) return null;
  const mean = hadlockBiometryMedian(dim, gaWeeks);
  if (mean == null) return null;
  const { sd } = HADLOCK_1984_BIOMETRY[dim];
  return sd > 0 ? (valueMm - mean) / sd : null;
}

// ──────────────────────── INTERGROWTH-21st ────────────────────────

/**
 * Estimativa de peso do INTERGROWTH-21st (Stirnemann 2017) — usa só CC e CA:
 *   ln(PFE) = 5,084820 − 54,06633·(CA/100)³ − 95,80076·(CA/100)³·ln(CA/100)
 *             + 3,136370·(CC/100)          [CA e CC em cm; PFE em gramas]
 */
export function intergrowthEfw(hcMm: number, acMm: number): number | null {
  if (!(hcMm > 0 && acMm > 0)) return null;
  const ac = acMm / 10 / 100; // cm → unidade da equação
  const hc = hcMm / 10 / 100;
  const lnEfw =
    5.08482 - 54.06633 * Math.pow(ac, 3) - 95.80076 * Math.pow(ac, 3) * Math.log(ac) + 3.13637 * hc;
  const efw = Math.exp(lnEfw);
  return isFinite(efw) && efw > 0 ? efw : null;
}

/**
 * Percentis do PFE por IG — INTERGROWTH-21st (Stirnemann 2017, Tabela 2),
 * método LMS de Cole sobre ln(PFE):
 *   λ(IG) = −4,257629 − 2162,234·IG⁻² + 0,0002301829·IG³
 *   μ(IG) = 4,956737 + 0,0005019687·IG³ − 0,0001227065·IG³·ln(IG)
 *   σ(IG) = 10⁻⁴·(−6,997171 + 0,057559·IG³ − 0,01493946·IG³·ln(IG))
 *   z = ((Y/μ)^λ − 1) / (λ·σ),  Y = ln(PFE)
 */
export function intergrowthEfwLms(gaWeeks: number): { lambda: number; mu: number; sigma: number } {
  const g = gaWeeks;
  const g3 = Math.pow(g, 3);
  return {
    lambda: -4.257629 - 2162.234 * Math.pow(g, -2) + 0.0002301829 * g3,
    mu: 4.956737 + 0.0005019687 * g3 - 0.0001227065 * g3 * Math.log(g),
    sigma: 1e-4 * (-6.997171 + 0.057559 * g3 - 0.01493946 * g3 * Math.log(g)),
  };
}

/** Mediana do PFE (g) por IG no INTERGROWTH-21st: e^μ(IG). */
export function intergrowthEfwMedian(gaWeeks: number): number {
  return Math.exp(intergrowthEfwLms(gaWeeks).mu);
}

/**
 * BIOMETRIA do INTERGROWTH-21st (Papageorghiou 2014, Lancet 384:869) — mediana
 * e DP por IG, em mm, com IG em semanas decimais. Distribuição normal:
 * z = (medida − mediana) / DP.
 *
 * Equações conforme a implementação de referência open-source do projeto
 * (nutriverse/intergrowth, R/03-calculate_fetal_growth.R). Medianas conferidas
 * contra os valores publicados a 32 semanas (HC ≈ 295, DBP ≈ 84, CA ≈ 274,
 * CF ≈ 59 mm) e travadas em teste.
 */
export const INTERGROWTH_BIOMETRY_GA_MIN = 14;
export const INTERGROWTH_BIOMETRY_GA_MAX = 40;

type IgBiometryDim = 'HC' | 'BPD' | 'AC' | 'FL' | 'OFD';

const IG_BIOMETRY: Record<IgBiometryDim, { median: (g: number) => number; sd: (g: number) => number }> = {
  HC: {
    median: (g) => -28.2849 + 1.69267 * g ** 2 - 0.397485 * g ** 2 * Math.log(g),
    sd: (g) =>
      1.98735 + 0.0136772 * g ** 3 - 0.00726264 * g ** 3 * Math.log(g) + 0.000976253 * g ** 3 * Math.log(g) ** 2,
  },
  BPD: {
    median: (g) => 5.60878 + 0.158369 * g ** 2 - 0.00256379 * g ** 3,
    sd: (g) =>
      Math.exp(
        0.101242 + 0.00150557 * g ** 3 - 0.000771535 * g ** 3 * Math.log(g) + 0.0000999638 * g ** 3 * Math.log(g) ** 2
      ),
  },
  OFD: {
    median: (g) => -12.4097 + 0.626342 * g ** 2 - 0.148075 * g ** 2 * Math.log(g),
    sd: (g) =>
      Math.exp(
        -0.880034 + 0.0631165 * g ** 2 - 0.0317136 * g ** 2 * Math.log(g) + 0.00408302 * g ** 2 * Math.log(g) ** 2
      ),
  },
  AC: {
    median: (g) => -81.3243 + 11.6772 * g - 0.000561865 * g ** 3,
    sd: (g) => -4.36302 + 0.121445 * g ** 2 - 0.0130256 * g ** 3 + 0.00282143 * g ** 3 * Math.log(g),
  },
  FL: {
    median: (g) => -39.9616 + 4.32298 * g - 0.0380156 * g ** 2,
    sd: (g) => Math.exp(0.605843 - 42.0014 * g ** -2 + 0.00000917972 * g ** 3),
  },
};

function isIgBiometryDim(dim: string): dim is IgBiometryDim {
  return dim in IG_BIOMETRY;
}

/** Mediana (mm) da biometria por IG no INTERGROWTH-21st. */
export function intergrowthBiometryMedian(dim: string, gaWeeks: number): number | null {
  if (!isIgBiometryDim(dim) || !(gaWeeks > 0)) return null;
  const m = IG_BIOMETRY[dim].median(gaWeeks);
  return isFinite(m) && m > 0 ? m : null;
}

/**
 * Z-score da biometria no INTERGROWTH-21st. Fora da janela de 14–40 semanas o
 * padrão não se aplica → null (o chamador decide o fallback).
 */
export function intergrowthBiometryZScore(dim: string, gaWeeks: number, valueMm: number): number | null {
  if (!isIgBiometryDim(dim) || !(valueMm > 0)) return null;
  if (gaWeeks < INTERGROWTH_BIOMETRY_GA_MIN || gaWeeks > INTERGROWTH_BIOMETRY_GA_MAX) return null;
  const { median, sd } = IG_BIOMETRY[dim];
  const m = median(gaWeeks);
  const s = sd(gaWeeks);
  if (!isFinite(m) || !isFinite(s) || s <= 0) return null;
  return (valueMm - m) / s;
}

export function intergrowthEfwZScore(gaWeeks: number, efwGrams: number): number | null {
  if (!(gaWeeks > 0 && efwGrams > 0)) return null;
  const { lambda, mu, sigma } = intergrowthEfwLms(gaWeeks);
  if (!(mu > 0) || !isFinite(lambda) || !(sigma > 0)) return null;
  const y = Math.log(efwGrams);
  if (lambda === 0) return Math.log(y / mu) / sigma;
  const z = (Math.pow(y / mu, lambda) - 1) / (lambda * sigma);
  return isFinite(z) ? z : null;
}

// ───────────────────────────── REGISTRY ─────────────────────────────

export const BIOMETRY_REFERENCES: Record<BiometryReference, BiometryReferenceMeta> = {
  hadlock: {
    id: 'hadlock',
    label: 'Hadlock 1991',
    short: 'Hadlock',
    cite: 'Hadlock FP, et al. Radiology. 1991;181(1):129-133 (PFE) · Hadlock FP, Deter RL, Harrist RB, Park SK. Radiology. 1984;152(2):497-501 (biometria).',
    validated: true,
    dimensions: ['EFW', 'BPD', 'HC', 'AC', 'FL'],
    note: 'PFE pela EQUAÇÃO de 1991 (±12,7% = 1 DP) — a tabela impressa no artigo diverge da equação e subdiagnostica RCIU. Biometrias pela tabela de crescimento de 1984 (DP constante por parâmetro), válida de 12 a 40 semanas. Úmero não faz parte do padrão.',
  },
  intergrowth: {
    id: 'intergrowth',
    label: 'INTERGROWTH-21st',
    short: 'INTERGROWTH',
    cite: 'Papageorghiou AT, et al. International standards for fetal growth. Lancet. 2014;384(9946):869-879 (biometria) · Stirnemann J, et al. Ultrasound Obstet Gynecol. 2017;49(4):478-486 (PFE).',
    validated: true,
    dimensions: ['EFW', 'BPD', 'HC', 'AC', 'FL'],
    note: 'PFE por LMS (Stirnemann 2017) e biometrias por média/DP (Papageorghiou 2014). Padrão prescritivo válido de 14 a 40 semanas — fora dessa janela, o percentil cai na OMS. Úmero não faz parte do padrão.',
  },
  who: {
    id: 'who',
    label: 'OMS (WHO)',
    short: 'OMS',
    cite: 'WHO Fetal Growth Charts — coeficientes de quantil por dimensão (em uso no sistema).',
    validated: true,
    dimensions: ['EFW', 'EFW_M', 'EFW_F', 'BPD', 'HC', 'AC', 'FL'],
  },
};

/**
 * Referência PADRÃO do sistema: a primeira da ordem de preferência clínica que
 * estiver VALIDADA. Hadlock assume o padrão automaticamente assim que seus
 * coeficientes forem conferidos contra casos-ouro (`validated: true`).
 */
const PREFERENCE_ORDER: BiometryReference[] = ['hadlock', 'intergrowth', 'who'];

export const DEFAULT_BIOMETRY_REFERENCE: BiometryReference =
  PREFERENCE_ORDER.find((r) => BIOMETRY_REFERENCES[r].validated) || 'who';

/** A referência cobre esta dimensão? */
export function referenceSupports(ref: BiometryReference, dim: WHODimension): boolean {
  return BIOMETRY_REFERENCES[ref].dimensions.includes(dim);
}

/**
 * Percentil por referência. Dimensões não cobertas caem na OMS (que tem todas),
 * sinalizado por `fellBack` para a UI poder explicitar a origem do número.
 */
export function getPercentileBy(
  ref: BiometryReference,
  dimension: WHODimension,
  gaWeeks: number,
  value: number
): { percentile: number | null; usedRef: BiometryReference; fellBack: boolean } {
  const r = getZScoreBy(ref, dimension, gaWeeks, value);
  return {
    percentile: r.z == null ? (r.usedRef === 'who' ? getWhoPercentile(dimension, gaWeeks, value) : null) : zToPct(r.z),
    usedRef: r.usedRef,
    fellBack: r.fellBack,
  };
}

/** Z-score por referência (mesma regra de fallback do percentil). */
export function getZScoreBy(
  ref: BiometryReference,
  dimension: WHODimension,
  gaWeeks: number,
  value: number
): { z: number | null; usedRef: BiometryReference; fellBack: boolean } {
  const isEfw = dimension === 'EFW' || dimension === 'EFW_M' || dimension === 'EFW_F';

  if (ref === 'hadlock') {
    if (isEfw) return { z: hadlockEfwZScore(gaWeeks, value), usedRef: 'hadlock', fellBack: false };
    // Biometria: tabela de 1984 (12–40 sem). Fora da janela, ou dimensão fora
    // do padrão (ex.: úmero), cai na OMS.
    const z = hadlockBiometryZScore(dimension, gaWeeks, value);
    if (z != null) return { z, usedRef: 'hadlock', fellBack: false };
  }
  if (ref === 'intergrowth') {
    if (isEfw) return { z: intergrowthEfwZScore(gaWeeks, value), usedRef: 'intergrowth', fellBack: false };
    // Biometria: só dentro da janela prescritiva de 14–40 semanas; fora dela
    // (ou em dimensão não coberta, ex.: úmero) cai na OMS.
    const z = intergrowthBiometryZScore(dimension, gaWeeks, value);
    if (z != null) return { z, usedRef: 'intergrowth', fellBack: false };
  }
  return { z: getWhoZScore(dimension, gaWeeks, value), usedRef: 'who', fellBack: ref !== 'who' };
}

/** Mediana (mm) da BIOMETRIA na referência, quando o padrão a cobre. */
export function biometryMedianBy(ref: BiometryReference, dim: string, gaWeeks: number): number | null {
  if (ref === 'hadlock') return hadlockBiometryMedian(dim, gaWeeks);
  if (ref === 'intergrowth') return intergrowthBiometryMedian(dim, gaWeeks);
  return null;
}

/** Mediana do PFE (g) na referência, quando disponível. */
export function efwMedianBy(ref: BiometryReference, gaWeeks: number): number | null {
  if (ref === 'hadlock') return hadlockEfwMedian(gaWeeks);
  if (ref === 'intergrowth') return intergrowthEfwMedian(gaWeeks);
  return null;
}
