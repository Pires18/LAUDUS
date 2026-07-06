// ═══════════════════════════════════════════════════════════════════════
// MOTOR — Rastreamento combinado de 1º trimestre para trissomias (T21/T18/T13)
// ═══════════════════════════════════════════════════════════════════════
// Modelo FMF (Nicolaides/Kagan/Wright):
//
//   odds_posterior = odds_a_priori × LR(TN) × LR(β-hCG, PAPP-A) × LR(marcadores)
//   risco = odds / (1 + odds)            → exibido como "1 : N"
//
// TN: modelo de MISTURA de duas Gaussianas (Wright 2008, UOG 31:376-383).
// Bioquímica: Gaussiana BIVARIADA de log10(MoM) com médias dependentes da IG
//   (Kagan 2008, UOG 31:493-502). Parâmetros exatos em `trisomyData.ts`.
//
// ⚠️  T21 = parâmetros publicados (validar com casos-ouro). T18/T13 na
//     bioquímica e as LRs de marcadores ainda são provisórios (ver data).
//     Apoio à decisão — NÃO é a calculadora oficial da FMF.
// ═══════════════════════════════════════════════════════════════════════

export type Trisomy = 't21' | 't18' | 't13';

export type MarkerState = 'notAssessed' | 'normal' | 'abnormal';

export interface MarkerLR {
  abnormal: Record<Trisomy, number>;
  normal: Record<Trisomy, number>;
}

/** Modelo de mistura da TN (log10 da TN em mm). */
export interface NtMixtureParams {
  /** Componente CRL-dependente: μ0 = b0 + b1·CRL + b2·CRL²; DP = sd. */
  crlDependent: { b0: number; b1: number; b2: number; sd: number };
  /** Componente CRL-independente (euploide): proporção logística + μ/σ. */
  normalIndep: { alpha0: number; alpha1: number; mu: number; sd: number };
  /** Componente CRL-independente por aneuploidia: proporção p + μ/σ. */
  affectedIndep: Record<Trisomy, { p: number; mu: number; sd: number }>;
}

/** Bioquímica: bivariada de log10(MoM), médias afetadas dependentes da IG. */
export interface BiochemParams {
  /** Não-afetada: médias = 0; DPs e correlação. */
  unaffected: { sdBhcg: number; sdPappa: number; rho: number };
  affected: Record<Trisomy, {
    // média log10(MoM) = intercepto + inclinação·(gestação_dias − 77)
    bhcgMeanIntercept: number; bhcgMeanSlope: number;
    pappaMeanIntercept: number; pappaMeanSlope: number;
    sdBhcg: number; sdPappa: number; rho: number;
  }>;
}

export interface TrisomyModelParams {
  validated: boolean;
  version: string;
  nt: NtMixtureParams;
  biochem: BiochemParams;
  markers: { nasalBone: MarkerLR; ductusVenosus: MarkerLR; tricuspid: MarkerLR };
}

export interface TrisomyInputs {
  priorRisk: Record<Trisomy, number>;
  /** TN medida (mm) + CCN (mm) — necessários para o modelo de mistura. */
  ntMm?: number;
  crlMm?: number;
  /** Gestação em dias (para as médias da bioquímica). Default 89 (~12+5). */
  gestDays?: number;
  /** MoM já ajustados por covariáveis (do laudo laboratorial). */
  freeBhcgMoM?: number;
  pappaMoM?: number;
  nasalBone?: MarkerState;
  ductusVenosus?: MarkerState;
  tricuspid?: MarkerState;
}

/** LR individual de cada evidência aplicada (ausente = fator não avaliado). */
export interface TrisomyFactorBreakdown {
  nt?: number;
  biochem?: number;
  nasalBone?: number;
  ductusVenosus?: number;
  tricuspid?: number;
}

export interface TrisomyRisk {
  posterior: Record<Trisomy, number>;
  oneInN: Record<Trisomy, number>;
  lr: Record<Trisomy, number>;
  /** Risco BASAL (a priori, só idade/IG) em "1:N", por trissomia. */
  priorOneInN: Record<Trisomy, number>;
  /** Detalhamento das LRs individuais que compõem `lr` — para exibir a
   *  "jornada" basal → corrigido fator a fator. */
  factors: Record<Trisomy, TrisomyFactorBreakdown>;
}

// ───────────────────────────── Probabilidade ────────────────────────────

export function probToOdds(p: number): number { return p / (1 - p); }
export function oddsToProb(odds: number): number { return odds / (1 + odds); }
export function probToOneInN(p: number): number { return p <= 0 ? Infinity : Math.round(1 / p); }
export function oneInNToProb(n: number): number { return n > 0 ? 1 / n : 0; }

// ───────────────────────────── Densidades ───────────────────────────────

function normalPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function bivariatePdf(x: number, y: number, mx: number, my: number, sx: number, sy: number, rho: number): number {
  const zx = (x - mx) / sx;
  const zy = (y - my) / sy;
  const oneMinusR2 = 1 - rho * rho;
  const quad = (zx * zx - 2 * rho * zx * zy + zy * zy) / oneMinusR2;
  const norm = 2 * Math.PI * sx * sy * Math.sqrt(oneMinusR2);
  return Math.exp(-0.5 * quad) / norm;
}

// ───────────────────────────── LRs ──────────────────────────────────────

/** Mediana esperada da TN (mm) para o CCN — componente CRL-dependente. */
export function ntExpectedMedianMm(crlMm: number, nt: NtMixtureParams): number {
  const { b0, b1, b2 } = nt.crlDependent;
  return Math.pow(10, b0 + b1 * crlMm + b2 * crlMm * crlMm);
}

/** LR da TN pelo modelo de mistura (Wright 2008). */
export function ntMixtureLR(ntMm: number, crlMm: number, nt: NtMixtureParams, t: Trisomy): number {
  if (!(ntMm > 0) || !(crlMm > 0)) return 1;
  const x = Math.log10(ntMm);
  const { b0, b1, b2, sd: sd0 } = nt.crlDependent;
  const mu0 = b0 + b1 * crlMm + b2 * crlMm * crlMm;
  const fDep = normalPdf(x, mu0, sd0);

  const { alpha0, alpha1, mu: mu1, sd: sd1 } = nt.normalIndep;
  const pNorm = 1 / (1 + Math.exp(-(alpha0 + alpha1 * crlMm)));
  const fNorm = (1 - pNorm) * fDep + pNorm * normalPdf(x, mu1, sd1);

  const aff = nt.affectedIndep[t];
  const fAff = (1 - aff.p) * fDep + aff.p * normalPdf(x, aff.mu, aff.sd);

  return fNorm > 0 ? fAff / fNorm : 1;
}

/** LR bivariada da bioquímica com médias afetadas dependentes da IG. */
export function biochemLR(bhcgMoM: number, pappaMoM: number, gestDays: number, bio: BiochemParams, t: Trisomy): number {
  if (!(bhcgMoM > 0) || !(pappaMoM > 0)) return 1;
  const x = Math.log10(bhcgMoM);
  const y = Math.log10(pappaMoM);
  const u = bio.unaffected;
  const a = bio.affected[t];
  const g = gestDays - 77;
  const meanBhcg = a.bhcgMeanIntercept + a.bhcgMeanSlope * g;
  const meanPappa = a.pappaMeanIntercept + a.pappaMeanSlope * g;

  const fU = bivariatePdf(x, y, 0, 0, u.sdBhcg, u.sdPappa, u.rho);
  const fA = bivariatePdf(x, y, meanBhcg, meanPappa, a.sdBhcg, a.sdPappa, a.rho);
  return fU > 0 ? fA / fU : 1;
}

export function markerLR(state: MarkerState | undefined, lr: MarkerLR, t: Trisomy): number {
  if (!state || state === 'notAssessed') return 1;
  return state === 'abnormal' ? lr.abnormal[t] : lr.normal[t];
}

// ───────────────────────────── Orquestração ─────────────────────────────

export function computeTrisomyRisk(inputs: TrisomyInputs, params: TrisomyModelParams): TrisomyRisk {
  const trisomies: Trisomy[] = ['t21', 't18', 't13'];
  const posterior = {} as Record<Trisomy, number>;
  const oneInN = {} as Record<Trisomy, number>;
  const lrOut = {} as Record<Trisomy, number>;
  const priorOneInN = {} as Record<Trisomy, number>;
  const factors = {} as Record<Trisomy, TrisomyFactorBreakdown>;

  const gestDays = inputs.gestDays ?? 89; // ~12+5 semanas

  for (const t of trisomies) {
    let lr = 1;
    const factorLRs: TrisomyFactorBreakdown = {};

    if (inputs.ntMm && inputs.crlMm) {
      const ntLr = ntMixtureLR(inputs.ntMm, inputs.crlMm, params.nt, t);
      factorLRs.nt = ntLr;
      lr *= ntLr;
    }
    if (inputs.freeBhcgMoM !== undefined && inputs.pappaMoM !== undefined) {
      const bioLr = biochemLR(inputs.freeBhcgMoM, inputs.pappaMoM, gestDays, params.biochem, t);
      factorLRs.biochem = bioLr;
      lr *= bioLr;
    }
    if (inputs.nasalBone && inputs.nasalBone !== 'notAssessed') {
      const nbLr = markerLR(inputs.nasalBone, params.markers.nasalBone, t);
      factorLRs.nasalBone = nbLr;
      lr *= nbLr;
    }
    if (inputs.ductusVenosus && inputs.ductusVenosus !== 'notAssessed') {
      const dvLr = markerLR(inputs.ductusVenosus, params.markers.ductusVenosus, t);
      factorLRs.ductusVenosus = dvLr;
      lr *= dvLr;
    }
    if (inputs.tricuspid && inputs.tricuspid !== 'notAssessed') {
      const trLr = markerLR(inputs.tricuspid, params.markers.tricuspid, t);
      factorLRs.tricuspid = trLr;
      lr *= trLr;
    }

    const postOdds = probToOdds(inputs.priorRisk[t]) * lr;
    const p = oddsToProb(postOdds);
    posterior[t] = p;
    oneInN[t] = probToOneInN(p);
    lrOut[t] = lr;
    priorOneInN[t] = probToOneInN(inputs.priorRisk[t]);
    factors[t] = factorLRs;
  }

  return { posterior, oneInN, lr: lrOut, priorOneInN, factors };
}
