import { describe, it, expect } from 'vitest';
import { computePromptHash } from '../modules/ai/training/promptRegistry';
import { uidBucket, isInCanaryBucket, compareRuns } from '../modules/ai/training/experiment';
import { aggregateQualityMetrics, QualityRecord } from '../modules/ai/training/qualityMetrics';
import { EvalRunResult, EvalDimension } from '../modules/ai/training/types';

// ═══════════════════════════════════════════════════════════════
// Testes das peças PURAS da Fase 4 (sem rede/Firestore).
// ═══════════════════════════════════════════════════════════════

describe('computePromptHash', () => {
  it('é determinístico para a mesma entrada', () => {
    expect(computePromptHash(['a', 'b'])).toBe(computePromptHash(['a', 'b']));
  });
  it('muda quando o conteúdo muda', () => {
    expect(computePromptHash(['a', 'b'])).not.toBe(computePromptHash(['a', 'c']));
  });
  it('produz hash de 8 caracteres hex', () => {
    expect(computePromptHash(['teste'])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('uidBucket / isInCanaryBucket', () => {
  it('bucket é determinístico e dentro de 0-99', () => {
    const b = uidBucket('user-123');
    expect(b).toBe(uidBucket('user-123'));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });
  it('0% nunca entra, 100% sempre entra', () => {
    expect(isInCanaryBucket('qualquer', 0)).toBe(false);
    expect(isInCanaryBucket('qualquer', 100)).toBe(true);
  });
  it('decisão de canário é estável para o mesmo uid', () => {
    const a = isInCanaryBucket('user-x', 50);
    const b = isInCanaryBucket('user-x', 50);
    expect(a).toBe(b);
  });
});

function run(overrides: Partial<EvalRunResult>): EvalRunResult {
  const dims: Record<EvalDimension, number> = {
    fidelity: 90, completeness: 90, safety: 100, numeric: 90, style: 90,
  };
  return {
    runId: 'r', startedAt: 0, finishedAt: 1, totalCases: 10,
    averageByDimension: dims, overallScore: 90, safetyPassRate: 100, results: [],
    ...overrides,
  };
}

describe('compareRuns — gate de segurança', () => {
  it('bloqueia promoção se segurança regride', () => {
    const baseline = run({ safetyPassRate: 100 });
    const candidate = run({ safetyPassRate: 90, overallScore: 95 });
    const v = compareRuns(baseline, candidate);
    expect(v.promote).toBe(false);
    expect(v.safetyRegressed).toBe(true);
  });

  it('bloqueia se segurança candidata < 100%', () => {
    const baseline = run({ safetyPassRate: 95 });
    const candidate = run({ safetyPassRate: 98, overallScore: 99 });
    const v = compareRuns(baseline, candidate);
    expect(v.promote).toBe(false);
    expect(v.safetyRegressed).toBe(false);
  });

  it('bloqueia se score geral cai além da tolerância', () => {
    const baseline = run({ overallScore: 90 });
    const candidate = run({ overallScore: 85 });
    const v = compareRuns(baseline, candidate);
    expect(v.promote).toBe(false);
  });

  it('promove se segurança 100% e score melhora', () => {
    const baseline = run({ overallScore: 88 });
    const candidate = run({ overallScore: 92 });
    const v = compareRuns(baseline, candidate);
    expect(v.promote).toBe(true);
    expect(v.deltas.overall).toBeCloseTo(4, 1);
  });

  it('promove com leve queda dentro da tolerância', () => {
    const baseline = run({ overallScore: 90 });
    const candidate = run({ overallScore: 89.5 });
    const v = compareRuns(baseline, candidate);
    expect(v.promote).toBe(true);
  });
});

function rec(p: Partial<QualityRecord>): QualityRecord {
  return {
    area: 'medicina-interna', examType: 'Abdome', motor: 'lite',
    auditScore: 90, refinementCount: 0, safetyPassed: true,
    latencyMs: 5000, timestamp: Date.now(), ...p,
  };
}

describe('aggregateQualityMetrics', () => {
  it('retorna agregado vazio sem registros', () => {
    const a = aggregateQualityMetrics([]);
    expect(a.totalReports).toBe(0);
    expect(a.firstPassRate).toBe(0);
  });

  it('calcula firstPassRate e incidentes de segurança', () => {
    const records = [
      rec({ refinementCount: 0, safetyPassed: true }),
      rec({ refinementCount: 2, safetyPassed: true }),
      rec({ refinementCount: 0, safetyPassed: false }),
      rec({ refinementCount: 0, safetyPassed: true }),
    ];
    const a = aggregateQualityMetrics(records);
    expect(a.totalReports).toBe(4);
    expect(a.firstPassRate).toBe(75); // 3 de 4 sem refinamento
    expect(a.safetyIncidents).toBe(1);
  });

  it('separa estatísticas Lite vs Pro', () => {
    const records = [
      rec({ motor: 'lite', auditScore: 80 }),
      rec({ motor: 'pro', auditScore: 95 }),
      rec({ motor: 'pro', auditScore: 90 }),
    ];
    const a = aggregateQualityMetrics(records);
    expect(a.liteVsPro.lite.count).toBe(1);
    expect(a.liteVsPro.pro.count).toBe(2);
    expect(a.liteVsPro.pro.avgScore).toBeCloseTo(92.5, 1);
  });

  it('ordena piores áreas por taxa de refinamento', () => {
    const records = [
      rec({ area: 'vascular', refinementCount: 3 }),
      rec({ area: 'medicina-interna', refinementCount: 0 }),
      rec({ area: 'mastologia', refinementCount: 1 }),
    ];
    const a = aggregateQualityMetrics(records);
    expect(a.worstAreas[0].area).toBe('vascular');
  });
});
