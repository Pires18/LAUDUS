// ═══════════════════════════════════════════════════════════════
// MÉTRICAS DE QUALIDADE — camada de dados do Dashboard Training
// ═══════════════════════════════════════════════════════════════
// auditReportQuality e o harness produzem scores que hoje são descartados
// após o uso. Aqui definimos o registro persistível e a agregação que um
// painel de evolução consome. Lógica de agregação PURA e testável.

export interface QualityRecord {
  area: string;
  examType: string;
  motor: 'lite' | 'pro';
  /** Score determinístico local (auditReportQuality), 0-100. */
  auditScore: number;
  /** Quantas vezes o médico refinou antes de finalizar. */
  refinementCount: number;
  /** True se nenhum incidente de segurança ocorreu. */
  safetyPassed: boolean;
  latencyMs: number;
  timestamp: number;
}

export interface MotorStats {
  count: number;
  avgScore: number;
  avgLatencyMs: number;
  avgRefinements: number;
}

export interface AreaStats {
  area: string;
  count: number;
  avgScore: number;
  refinementRate: number; // média de refinamentos por laudo
}

export interface QualityAggregate {
  totalReports: number;
  overallAvgScore: number;
  /** Taxa de laudos sem refinamento (meta: > 70%). */
  firstPassRate: number;
  /** Número de incidentes de segurança (meta: 0). */
  safetyIncidents: number;
  liteVsPro: { lite: MotorStats; pro: MotorStats };
  /** Áreas ordenadas por mais refinamentos (= onde o motor precisa melhorar). */
  worstAreas: AreaStats[];
}

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function motorStats(records: QualityRecord[]): MotorStats {
  return {
    count: records.length,
    avgScore: round(avg(records.map((r) => r.auditScore))),
    avgLatencyMs: Math.round(avg(records.map((r) => r.latencyMs))),
    avgRefinements: round(avg(records.map((r) => r.refinementCount)), 2),
  };
}

/**
 * Agrega registros de qualidade em estatísticas para o painel.
 * Determinístico e sem efeitos colaterais.
 */
export function aggregateQualityMetrics(records: QualityRecord[]): QualityAggregate {
  if (records.length === 0) {
    const empty: MotorStats = { count: 0, avgScore: 0, avgLatencyMs: 0, avgRefinements: 0 };
    return {
      totalReports: 0,
      overallAvgScore: 0,
      firstPassRate: 0,
      safetyIncidents: 0,
      liteVsPro: { lite: empty, pro: empty },
      worstAreas: [],
    };
  }

  const firstPass = records.filter((r) => r.refinementCount === 0).length;
  const safetyIncidents = records.filter((r) => !r.safetyPassed).length;

  // Agrupa por área.
  const byArea = new Map<string, QualityRecord[]>();
  for (const r of records) {
    const list = byArea.get(r.area) || [];
    list.push(r);
    byArea.set(r.area, list);
  }

  const worstAreas: AreaStats[] = [...byArea.entries()]
    .map(([area, list]) => ({
      area,
      count: list.length,
      avgScore: round(avg(list.map((r) => r.auditScore))),
      refinementRate: round(avg(list.map((r) => r.refinementCount)), 2),
    }))
    .sort((a, b) => b.refinementRate - a.refinementRate);

  return {
    totalReports: records.length,
    overallAvgScore: round(avg(records.map((r) => r.auditScore))),
    firstPassRate: round((firstPass / records.length) * 100),
    safetyIncidents,
    liteVsPro: {
      lite: motorStats(records.filter((r) => r.motor === 'lite')),
      pro: motorStats(records.filter((r) => r.motor === 'pro')),
    },
    worstAreas,
  };
}
