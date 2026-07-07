// ═══════════════════════════════════════════════════════════════════════
// MOTOR — Rastreamento de pré-eclâmpsia (1º trimestre), riscos competitivos
// ═══════════════════════════════════════════════════════════════════════
// Modelo FMF completo (Bayes) — Wright 2015 + O'Gorman 2016 (AJOG 214:103):
//
//   prior:      t = IG no parto com PE ~ Normal(μ, σ)   (μ = fatores maternos)
//   verossim.:  log10(MoM) dos biomarcadores ~ Normal multivariada com
//               média m(t) = intercepto + inclinação·t (truncada em 0) e
//               covariância comum Σ (Tabela 3).
//   posterior ∝ prior × verossimilhança  → integra-se numericamente.
//   risco(PE antes de g) = ∫_{t<g} posterior / ∫ posterior
//
// FATORES MATERNOS: Wright 2015 (Tabela 2). BIOMARCADORES: O'Gorman 2016.
// MoM dos biomarcadores é calculado com medianas por analisador (Cobas) —
// ver `medians.ts`.
//
// ARTÉRIAS OFTÁLMICAS (PSV ratio): Gana N et al., UOG 2022;59:731-736
// (doi 10.1002/uog.24914) — marcador ADICIONAL ao O'Gorman 2016, mesmo
// arcabouço Bayesiano. Diferença importante: o PSV ratio entra na
// verossimilhança como um DELTA em escala NATURAL (medido − esperado pelas
// características maternas, Tabela 2 do paper) — NÃO é MoM, não se aplica
// log10 (ao contrário de MAP/UtA-PI/PlGF/PAPP-A). Ver `psvRatioDelta` em
// `PeBiomarkers` e `psvRatioExpected()` em `medians.ts`.
//
// ⚠️ `validated: false` até conferir com casos-ouro. NÃO é a calculadora
//    oficial da FMF; apoio à decisão baseado em modelos publicados.
// ═══════════════════════════════════════════════════════════════════════

export type RacialOrigin = 'white' | 'afroCaribbean' | 'southAsian' | 'eastAsian' | 'mixed';
export type Conception = 'spontaneous' | 'ovulationInduction' | 'ivf';
export type BiomarkerKey = 'map' | 'utaPi' | 'plgf' | 'pappa' | 'psvRatio';

export interface PeMaternalFactors {
  ageYears: number;
  weightKg: number;
  heightCm: number;
  racialOrigin: RacialOrigin;
  conception: Conception;
  chronicHypertension: boolean;
  diabetesType1: boolean;
  diabetesType2: boolean;
  sleOrAps: boolean;
  familyHistoryPE: boolean;
  nulliparous: boolean;
  previousPE: boolean;
  previousPeGaWeeks?: number;
}

export interface PeBiomarkers {
  mapMoM?: number;
  utaPiMoM?: number;
  plgfMoM?: number;
  pappaMoM?: number;
  /** Delta bruto do PSV ratio da artéria oftálmica (Gana 2022): medido −
   *  esperado pelas características maternas (Tabela 2). Escala NATURAL
   *  (não é MoM — não se aplica log10, diferente dos demais marcadores). */
  psvRatioDelta?: number;
}

export interface PeCoefficients {
  validated: boolean;
  version: string;
  intercept: number;
  sigma: number;
  agePerYearOver35: number;
  heightPerCmOver164: number;
  racial: Record<RacialOrigin, number>;
  conception: Record<Conception, number>;
  chronicHypertension: number;
  sleOrAps: number;
  parousPrevPE: number;
  parousPrevPeGaQuadCoef: number;
  weightPerKgOver69_noHtn: number;
  diabetes_noHtn: number;
  familyHistoryPE_noHtn: number;
}

/** Modelo de biomarcadores (O'Gorman 2016): regressão da média + covariância. */
export interface PeBiomarkerModel {
  reg: Record<BiomarkerKey, { intercept: number; slope: number }>;
  sd: Record<BiomarkerKey, number>;
  /** correlações por par "a_b" (ordem: map,utaPi,plgf,pappa,psvRatio). */
  corr: Record<string, number>;
}

export interface PeThresholds {
  pretermGa: number;
  termGa: number;
  aspirinCutoffOneInN: number;
}

export const DEFAULT_PE_THRESHOLDS: PeThresholds = {
  pretermGa: 37,
  termGa: 42,
  aspirinCutoffOneInN: 100,
};

export interface PeRisk {
  mu: number;
  pretermPE: { prob: number; oneInN: number };
  termPE: { prob: number; oneInN: number };
  aspirinRecommended: boolean;
  /** Risco BASAL (só fatores maternos, antes dos biomarcadores). */
  basalPretermPE: { prob: number; oneInN: number };
  basalTermPE: { prob: number; oneInN: number };
  /** true se a verossimilhança dos biomarcadores sofreu underflow numérico
   *  (MoM implausível/extremo) e o motor caiu de volta para o risco basal
   *  por segurança — ver `computePreeclampsiaRisk`. */
  biomarkerLikelihoodUnderflow: boolean;
}

// ───────────────────────────── Estatística ──────────────────────────────

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return s * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function peRiskBefore(gaTarget: number, mu: number, sigma: number): number {
  return normalCdf((gaTarget - mu) / sigma);
}

/** Inversa de matriz simétrica pequena (Gauss-Jordan). */
function invertMatrix(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
}

// ───────────────────────────── Média materna ────────────────────────────

export function maternalMeanGa(f: PeMaternalFactors, c: PeCoefficients): number {
  let mu = c.intercept;
  if (f.ageYears > 35) mu += c.agePerYearOver35 * (f.ageYears - 35);
  mu += c.heightPerCmOver164 * (f.heightCm - 164);
  mu += c.racial[f.racialOrigin] ?? 0;
  mu += c.conception[f.conception] ?? 0;
  if (f.chronicHypertension) {
    mu += c.chronicHypertension;
  } else {
    if (f.weightKg > 69) mu += c.weightPerKgOver69_noHtn * (f.weightKg - 69);
    if (f.diabetesType1 || f.diabetesType2) mu += c.diabetes_noHtn;
    if (f.familyHistoryPE) mu += c.familyHistoryPE_noHtn;
  }
  if (f.sleOrAps) mu += c.sleOrAps;
  if (!f.nulliparous && f.previousPE) {
    const prevGa = f.previousPeGaWeeks ?? 32;
    mu += c.parousPrevPE + c.parousPrevPeGaQuadCoef * Math.pow(prevGa - 24, 2);
  }
  return mu;
}

// ───────────────────────────── Verossimilhança ──────────────────────────

/** Média do marcador (log10 MoM, ou delta bruto no caso do PSV ratio) na
 *  IG de parto t (semanas), truncada em 0. */
function markerMean(reg: { intercept: number; slope: number }, t: number): number {
  const m = reg.intercept + reg.slope * t;
  return reg.intercept > 0 ? Math.max(0, m) : Math.min(0, m);
}

function corr(model: PeBiomarkerModel, a: BiomarkerKey, b: BiomarkerKey): number {
  if (a === b) return 1;
  return model.corr[`${a}_${b}`] ?? model.corr[`${b}_${a}`] ?? 0;
}

// ───────────────────────────── Orquestração ─────────────────────────────

const oneInN = (p: number) => (p > 0 && isFinite(p) ? Math.round(1 / p) : Infinity);

/** Risco (basal, só fatores maternos) de PE antes de cada limiar. */
function basalRisk(mu: number, sigma: number, thresholds: PeThresholds) {
  const pPre = peRiskBefore(thresholds.pretermGa, mu, sigma);
  const pTerm = peRiskBefore(thresholds.termGa, mu, sigma);
  return {
    pretermPE: { prob: pPre, oneInN: oneInN(pPre) },
    termPE: { prob: pTerm, oneInN: oneInN(pTerm) },
  };
}

export function computePreeclampsiaRisk(
  factors: PeMaternalFactors,
  biomarkers: PeBiomarkers,
  coeffs: PeCoefficients,
  model: PeBiomarkerModel,
  thresholds: PeThresholds = DEFAULT_PE_THRESHOLDS,
): PeRisk {
  const mu = maternalMeanGa(factors, coeffs);
  const sigma = coeffs.sigma;
  const basal = basalRisk(mu, sigma, thresholds);

  // Marcadores presentes: log10(MoM) para MAP/UtA-PI/PlGF/PAPP-A; para o PSV
  // ratio (Gana 2022) o valor já é um DELTA em escala natural (não é MoM),
  // então NÃO se aplica log10 — ver comentário no topo do arquivo.
  const logMomByKey: Partial<Record<BiomarkerKey, number>> = {
    map: biomarkers.mapMoM, utaPi: biomarkers.utaPiMoM, plgf: biomarkers.plgfMoM, pappa: biomarkers.pappaMoM,
  } as Partial<Record<BiomarkerKey, number>>;
  const observedByKey: Partial<Record<BiomarkerKey, number>> = {};
  for (const k of ['map', 'utaPi', 'plgf', 'pappa'] as BiomarkerKey[]) {
    const mom = logMomByKey[k];
    if (mom && mom > 0) observedByKey[k] = Math.log10(mom);
  }
  if (biomarkers.psvRatioDelta !== undefined && isFinite(biomarkers.psvRatioDelta)) {
    observedByKey.psvRatio = biomarkers.psvRatioDelta;
  }
  const present = (Object.keys(observedByKey) as BiomarkerKey[]);

  // Sem biomarcadores: risco final = risco basal (competing-risks só com fatores maternos).
  if (present.length === 0) {
    return {
      mu,
      pretermPE: basal.pretermPE,
      termPE: basal.termPE,
      basalPretermPE: basal.pretermPE,
      basalTermPE: basal.termPE,
      aspirinRecommended: basal.pretermPE.prob >= 1 / thresholds.aspirinCutoffOneInN,
      biomarkerLikelihoodUnderflow: false,
    };
  }

  // Vetor observado y e precisão Σ⁻¹ dos marcadores presentes.
  const y = present.map(k => observedByKey[k]!);
  const cov = present.map(a => present.map(b => corr(model, a, b) * model.sd[a] * model.sd[b]));
  const prec = invertMatrix(cov);

  // Integração numérica do posterior sobre t (IG de parto), 20–60 semanas.
  const T_MIN = 20, T_MAX = 60, STEP = 0.05;
  let total = 0, cumPreterm = 0, cumTerm = 0;
  for (let t = T_MIN; t <= T_MAX; t += STEP) {
    const zp = (t - mu) / sigma;
    const priorLog = -0.5 * zp * zp;
    const resid = present.map((k, i) => y[i] - markerMean(model.reg[k], t));
    let quad = 0;
    for (let i = 0; i < resid.length; i++)
      for (let j = 0; j < resid.length; j++) quad += resid[i] * prec[i][j] * resid[j];
    const f = Math.exp(priorLog - 0.5 * quad);
    total += f;
    if (t < thresholds.pretermGa) cumPreterm += f;
    if (t < thresholds.termGa) cumTerm += f;
  }

  // ⚠️ SEGURANÇA NUMÉRICA: um MoM absurdo/fora de qualquer faixa plausível
  // (ex.: valor bruto digitado por engano no campo de MoM) pode fazer a
  // verossimilhança de TODOS os pontos da integração colapsar (underflow de
  // ponto flutuante) para 0. Sem esta rede de segurança, `total=0` faria o
  // risco final aparentar ser ~zero (falsa tranquilização perigosa). Nesse
  // caso, caímos de volta para o risco BASAL (mais conservador) em vez de
  // reportar um risco artificialmente baixo.
  const underflow = !(total > 0);
  if (underflow) {
    return {
      mu,
      pretermPE: basal.pretermPE,
      termPE: basal.termPE,
      basalPretermPE: basal.pretermPE,
      basalTermPE: basal.termPE,
      aspirinRecommended: basal.pretermPE.prob >= 1 / thresholds.aspirinCutoffOneInN,
      biomarkerLikelihoodUnderflow: true,
    };
  }

  const pPre = cumPreterm / total;
  const pTerm = cumTerm / total;
  return {
    mu,
    pretermPE: { prob: pPre, oneInN: oneInN(pPre) },
    termPE: { prob: pTerm, oneInN: oneInN(pTerm) },
    basalPretermPE: basal.pretermPE,
    basalTermPE: basal.termPE,
    aspirinRecommended: pPre >= 1 / thresholds.aspirinCutoffOneInN,
    biomarkerLikelihoodUnderflow: false,
  };
}
