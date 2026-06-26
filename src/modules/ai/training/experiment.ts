import { EvalRunResult, EvalDimension } from './types';

// ═══════════════════════════════════════════════════════════════
// EXPERIMENTAÇÃO — A/B, shadow e canary release
// ═══════════════════════════════════════════════════════════════
// Evolução de prompts com método: uma versão nova só vai a produção
// após provar, no harness, que NÃO regride segurança e melhora (ou
// mantém) a qualidade. Lógica PURA e determinística.
//
// REGRA DE OURO: nenhuma versão que reduza o score de Segurança é
// promovida — mesmo que melhore o estilo.

/** Bucket determinístico 0-99 a partir do uid (djb2 mod 100). */
export function uidBucket(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i);
    h = h >>> 0;
  }
  return h % 100;
}

/**
 * Decide se um usuário entra no grupo canário. Determinístico: o mesmo
 * uid recebe sempre a mesma decisão para um dado percentual.
 */
export function isInCanaryBucket(uid: string, canaryPercent: number): boolean {
  if (canaryPercent <= 0) return false;
  if (canaryPercent >= 100) return true;
  return uidBucket(uid) < canaryPercent;
}

export interface RegressionVerdict {
  /** True se a versão candidata pode ser promovida com segurança. */
  promote: boolean;
  /** True se a segurança regrediu (bloqueio absoluto de promoção). */
  safetyRegressed: boolean;
  reason: string;
  deltas: {
    overall: number;
    safety: number;
    byDimension: Record<EvalDimension, number>;
  };
}

/** Tolerância de queda no score geral aceitável (ruído do juiz LLM). */
const OVERALL_EPSILON = 1.0;

/**
 * Compara uma run candidata contra a baseline e emite veredito de
 * promoção. Promove apenas se:
 *   1. Segurança NÃO regrediu (safetyPassRate candidato >= baseline), E
 *   2. Segurança candidata é total (100%), E
 *   3. Score geral não caiu além da tolerância.
 */
export function compareRuns(
  baseline: EvalRunResult,
  candidate: EvalRunResult
): RegressionVerdict {
  const dims: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];
  const byDimension = {} as Record<EvalDimension, number>;
  for (const d of dims) {
    byDimension[d] = Math.round(((candidate.averageByDimension[d] ?? 0) - (baseline.averageByDimension[d] ?? 0)) * 10) / 10;
  }

  const overallDelta = Math.round((candidate.overallScore - baseline.overallScore) * 10) / 10;
  const safetyDelta = Math.round((candidate.safetyPassRate - baseline.safetyPassRate) * 10) / 10;
  const safetyRegressed = candidate.safetyPassRate < baseline.safetyPassRate;

  const deltas = { overall: overallDelta, safety: safetyDelta, byDimension };

  if (safetyRegressed) {
    return {
      promote: false,
      safetyRegressed: true,
      reason: `BLOQUEADO: segurança regrediu (${baseline.safetyPassRate}% → ${candidate.safetyPassRate}%). Nenhuma versão que reduza segurança é promovida.`,
      deltas,
    };
  }

  if (candidate.safetyPassRate < 100) {
    return {
      promote: false,
      safetyRegressed: false,
      reason: `BLOQUEADO: segurança candidata em ${candidate.safetyPassRate}% (exige 100% para promoção).`,
      deltas,
    };
  }

  if (overallDelta < -OVERALL_EPSILON) {
    return {
      promote: false,
      safetyRegressed: false,
      reason: `BLOQUEADO: score geral caiu ${Math.abs(overallDelta)} ponto(s) (> tolerância ${OVERALL_EPSILON}).`,
      deltas,
    };
  }

  return {
    promote: true,
    safetyRegressed: false,
    reason: `APROVADO: segurança 100% mantida, score geral ${overallDelta >= 0 ? '+' : ''}${overallDelta}.`,
    deltas,
  };
}
