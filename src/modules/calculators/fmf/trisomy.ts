// ═══════════════════════════════════════════════════════════════════════
// MOTOR — Rastreamento combinado de 1º trimestre para trissomias (T21/T18/T13)
// ═══════════════════════════════════════════════════════════════════════
// Modelo bayesiano no estilo FMF (Nicolaides/Kagan/Wright):
//
//   odds_posterior = odds_a_priori × LR(TN) × LR(β-hCG, PAPP-A) × LR(marcadores)
//   risco = odds / (1 + odds)            → exibido como "1 : N"
//
// IMPORTANTE (segurança clínica):
//   • ESTE arquivo contém apenas MATEMÁTICA PURA — verificável e testável.
//   • Os PARÂMETROS clínicos (distribuições afetada×não-afetada, medianas
//     do analisador, tabela de risco por idade) vivem em `trisomyData.ts`
//     e estão marcados `validated: false`. NÃO habilitar a calculadora em
//     produção enquanto não forem validados contra a literatura.
//   • Posicionamento: apoio à decisão baseado em modelos publicados — NÃO é
//     a calculadora oficial da Fetal Medicine Foundation.
// ═══════════════════════════════════════════════════════════════════════

export type Trisomy = 't21' | 't18' | 't13';

/** Parâmetros de uma distribuição Gaussiana de log10(MoM). */
export interface GaussianParams {
  mean: number;
  sd: number;
}

/** Distribuição bivariada de log10(MoM) para (β-hCG livre, PAPP-A). */
export interface BiochemDist {
  bhcg: GaussianParams;
  pappa: GaussianParams;
  /** Correlação entre log10(MoM) de β-hCG e PAPP-A. */
  rho: number;
}

export type MarkerState = 'notAssessed' | 'normal' | 'abnormal';

/** Razões de verossimilhança discretas de um marcador ecográfico por trissomia. */
export interface MarkerLR {
  abnormal: Record<Trisomy, number>;
  normal: Record<Trisomy, number>;
  // 'notAssessed' ⇒ LR neutro = 1 (não altera o risco)
}

/** Conjunto completo de parâmetros do modelo (por trissomia). */
export interface TrisomyModelParams {
  /** Trava de segurança: só liberar em produção quando validado. */
  validated: boolean;
  /** Rótulo/versão do modelo para auditoria (ex.: "cobas-kagan2008-provisorio"). */
  version: string;
  /** Distribuição de log10(MoM) da TN (delta/MoM). */
  nt: {
    unaffected: GaussianParams;
    affected: Record<Trisomy, GaussianParams>;
  };
  /** Distribuição bivariada de log10(MoM) da bioquímica. */
  biochem: {
    unaffected: BiochemDist;
    affected: Record<Trisomy, BiochemDist>;
  };
  /** LRs dos marcadores ecográficos adicionais. */
  markers: {
    nasalBone: MarkerLR;
    ductusVenosus: MarkerLR;
    tricuspid: MarkerLR;
  };
}

export interface TrisomyInputs {
  /** Risco a priori (probabilidade) por trissomia, já ajustado por idade e IG. */
  priorRisk: Record<Trisomy, number>;
  /** TN medida (mm) e mediana esperada (mm) para o CCN. */
  ntMm?: number;
  ntMedianMm?: number;
  /** MoM já ajustados por covariáveis (peso, etnia, tabagismo, FIV...). */
  freeBhcgMoM?: number;
  pappaMoM?: number;
  /** Marcadores ecográficos adicionais (opcionais). */
  nasalBone?: MarkerState;
  ductusVenosus?: MarkerState;
  tricuspid?: MarkerState;
}

export interface TrisomyRisk {
  /** Probabilidades posteriores por trissomia. */
  posterior: Record<Trisomy, number>;
  /** Risco posterior como "1 : N" (arredondado) por trissomia. */
  oneInN: Record<Trisomy, number>;
  /** LRs aplicadas (para transparência/auditoria). */
  lr: Record<Trisomy, number>;
}

// ───────────────────────────── Utilidades de probabilidade ──────────────

export function probToOdds(p: number): number {
  return p / (1 - p);
}

export function oddsToProb(odds: number): number {
  return odds / (1 + odds);
}

/** Converte probabilidade em "1 : N" (N arredondado). p=0 ⇒ Infinity. */
export function probToOneInN(p: number): number {
  if (p <= 0) return Infinity;
  return Math.round(1 / p);
}

/** Converte "1 : N" em probabilidade. */
export function oneInNToProb(n: number): number {
  return n > 0 ? 1 / n : 0;
}

// ───────────────────────────── Razões de verossimilhança ────────────────

const LN10 = Math.LN10;

/**
 * LR de uma medida com distribuição Gaussiana de log10(MoM).
 * @param mom  Multiple of Median (já ajustado por covariáveis).
 * @returns    razão densidade_afetada / densidade_não-afetada.
 */
export function gaussianMoMLR(mom: number, unaffected: GaussianParams, affected: GaussianParams): number {
  if (!(mom > 0)) return 1;
  const x = Math.log10(mom);
  const du = gaussianPdf(x, unaffected.mean, unaffected.sd);
  const da = gaussianPdf(x, affected.mean, affected.sd);
  return du > 0 ? da / du : 1;
}

/**
 * LR bivariada para (β-hCG, PAPP-A) em log10(MoM), com correlação.
 */
export function biochemLR(bhcgMoM: number, pappaMoM: number, unaffected: BiochemDist, affected: BiochemDist): number {
  if (!(bhcgMoM > 0) || !(pappaMoM > 0)) return 1;
  const x = Math.log10(bhcgMoM);
  const y = Math.log10(pappaMoM);
  const du = bivariatePdf(x, y, unaffected);
  const da = bivariatePdf(x, y, affected);
  return du > 0 ? da / du : 1;
}

/** LR discreta de um marcador ecográfico. 'notAssessed' ⇒ 1 (neutro). */
export function markerLR(state: MarkerState | undefined, lr: MarkerLR, t: Trisomy): number {
  if (!state || state === 'notAssessed') return 1;
  return state === 'abnormal' ? lr.abnormal[t] : lr.normal[t];
}

// ───────────────────────────── Densidades ───────────────────────────────

function gaussianPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function bivariatePdf(x: number, y: number, d: BiochemDist): number {
  const { bhcg, pappa, rho } = d;
  const zx = (x - bhcg.mean) / bhcg.sd;
  const zy = (y - pappa.mean) / pappa.sd;
  const oneMinusR2 = 1 - rho * rho;
  const quad = (zx * zx - 2 * rho * zx * zy + zy * zy) / oneMinusR2;
  const norm = 2 * Math.PI * bhcg.sd * pappa.sd * Math.sqrt(oneMinusR2);
  return Math.exp(-0.5 * quad) / norm;
}

// ───────────────────────────── Orquestração ─────────────────────────────

/**
 * Combina o risco a priori com todas as LRs disponíveis e devolve o risco
 * posterior por trissomia. Campos ausentes usam LR neutra (=1).
 */
export function computeTrisomyRisk(inputs: TrisomyInputs, params: TrisomyModelParams): TrisomyRisk {
  const trisomies: Trisomy[] = ['t21', 't18', 't13'];
  const posterior = {} as Record<Trisomy, number>;
  const oneInN = {} as Record<Trisomy, number>;
  const lrOut = {} as Record<Trisomy, number>;

  // MoM da TN a partir da medida e da mediana esperada.
  const ntMoM = (inputs.ntMm && inputs.ntMedianMm && inputs.ntMedianMm > 0)
    ? inputs.ntMm / inputs.ntMedianMm
    : undefined;

  for (const t of trisomies) {
    let lr = 1;

    if (ntMoM !== undefined) {
      lr *= gaussianMoMLR(ntMoM, params.nt.unaffected, params.nt.affected[t]);
    }
    if (inputs.freeBhcgMoM !== undefined && inputs.pappaMoM !== undefined) {
      lr *= biochemLR(inputs.freeBhcgMoM, inputs.pappaMoM, params.biochem.unaffected, params.biochem.affected[t]);
    }
    lr *= markerLR(inputs.nasalBone, params.markers.nasalBone, t);
    lr *= markerLR(inputs.ductusVenosus, params.markers.ductusVenosus, t);
    lr *= markerLR(inputs.tricuspid, params.markers.tricuspid, t);

    const priorOdds = probToOdds(inputs.priorRisk[t]);
    const postOdds = priorOdds * lr;
    const p = oddsToProb(postOdds);

    posterior[t] = p;
    oneInN[t] = probToOneInN(p);
    lrOut[t] = lr;
  }

  return { posterior, oneInN, lr: lrOut };
}
