import { AppSettings } from '../../../types';
import { auditReportQuality } from '../engine';
import { judgeReport } from './evaluator';
import {
  GoldenCase,
  HardAssertion,
  EvalResult,
  EvalRunResult,
  EvalDimension,
  HarnessOptions,
  DimensionScore,
  DIMENSION_WEIGHTS,
} from './types';

// ═══════════════════════════════════════════════════════════════
// HARNESS DE AVALIAÇÃO — orquestrador
// ═══════════════════════════════════════════════════════════════
// Roda cada caso-ouro através de três camadas independentes:
//   1. Geração   → produz o laudo (callback injetado, desacoplado do motor)
//   2. Determinística → auditReportQuality + hardAssertions (código, não IA)
//   3. Juiz LLM  → notas subjetivas por rubrica
// e agrega num EvalRunResult comparável entre versões de prompt.

/** Limiar mínimo de segurança para um caso "passar" no gate crítico. */
const SAFETY_THRESHOLD = 80;
/** Penalidade aplicada ao score ponderado por asserção determinística falha. */
const ASSERTION_PENALTY = 12;

/**
 * Resultado de uma geração para o harness. O callback de geração é
 * responsável por escolher/forçar o motor e medir a latência — isso
 * mantém o harness desacoplado do motor de produção (e evita consumir
 * cota de laudos durante a avaliação).
 */
export interface GenerationOutput {
  report: string;
  motorUsed: 'lite' | 'pro';
  latencyMs: number;
}

export type GenerateFn = (goldenCase: GoldenCase, signal?: AbortSignal) => Promise<GenerationOutput>;

const ALL_DIMENSIONS: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];

/** Avalia as asserções determinísticas contra o laudo gerado. */
function checkAssertions(report: string, assertions: HardAssertion[] = []): HardAssertion[] {
  const failed: HardAssertion[] = [];
  const haystack = report.toLowerCase();

  for (const a of assertions) {
    let ok = true;
    if (a.kind === 'mustContain') {
      ok = haystack.includes(a.value.toLowerCase());
    } else if (a.kind === 'mustNotContain') {
      ok = !haystack.includes(a.value.toLowerCase());
    } else if (a.kind === 'mustMatch') {
      try {
        ok = new RegExp(a.value, 'i').test(report);
      } catch {
        ok = false;
      }
    }
    if (!ok) failed.push(a);
  }
  return failed;
}

/** Combina notas do juiz em um score ponderado 0-100. */
function weightedFromDimensions(dimensions: DimensionScore[]): number {
  let total = 0;
  for (const d of dimensions) {
    total += d.score * (DIMENSION_WEIGHTS[d.dimension] ?? 0);
  }
  return Math.round(total * 10) / 10;
}

/** Avalia um único caso-ouro. */
export async function evaluateCase(
  goldenCase: GoldenCase,
  generate: GenerateFn,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<EvalResult> {
  // 1. Geração
  const gen = await generate(goldenCase, signal);

  // 2. Verificações determinísticas
  const audit = auditReportQuality(gen.report, goldenCase.area);
  const failedAssertions = checkAssertions(gen.report, goldenCase.hardAssertions);

  // 3. Juiz LLM
  const dimensions = await judgeReport(goldenCase, gen.report, settings, signal);

  // Score ponderado, com penalidade por asserção determinística falha.
  let weightedScore = weightedFromDimensions(dimensions);
  weightedScore = Math.max(0, weightedScore - failedAssertions.length * ASSERTION_PENALTY);

  // Gate de segurança: nenhuma asserção de 'safety' pode falhar E o juiz
  // precisa atribuir nota de segurança acima do limiar.
  const safetyAssertionFailed = failedAssertions.some((a) => a.dimension === 'safety');
  const judgeSafety = dimensions.find((d) => d.dimension === 'safety')?.score ?? 0;
  const safetyPassed = !safetyAssertionFailed && judgeSafety >= SAFETY_THRESHOLD;

  return {
    caseId: goldenCase.id,
    area: goldenCase.area,
    examType: goldenCase.examType,
    motorUsed: gen.motorUsed,
    weightedScore,
    dimensions,
    failedAssertions,
    deterministicIssues: audit.issues,
    latencyMs: gen.latencyMs,
    generatedReport: gen.report,
    safetyPassed,
    timestamp: Date.now(),
  };
}

/** Filtra o conjunto-ouro conforme as opções do harness. */
function selectCases(cases: GoldenCase[], options: HarnessOptions): GoldenCase[] {
  let selected = cases;
  if (options.area) selected = selected.filter((c) => c.area === options.area);
  if (options.caseIds && options.caseIds.length > 0) {
    const set = new Set(options.caseIds);
    selected = selected.filter((c) => set.has(c.id));
  }
  return selected;
}

/**
 * Executa o harness completo sobre o Golden Dataset.
 * Roda os casos em série (sequencial) para respeitar o rate limit do
 * proxy (20 req/min) — geração + juiz são duas chamadas por caso.
 */
export async function runHarness(
  cases: GoldenCase[],
  generate: GenerateFn,
  settings: AppSettings,
  options: HarnessOptions = {}
): Promise<EvalRunResult> {
  const startedAt = Date.now();
  const selected = selectCases(cases, options);
  const results: EvalResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const result = await evaluateCase(selected[i], generate, settings);
    results.push(result);
    options.onProgress?.(i + 1, selected.length, result);
  }

  // Agregações
  const averageByDimension = {} as Record<EvalDimension, number>;
  for (const dim of ALL_DIMENSIONS) {
    if (results.length === 0) {
      averageByDimension[dim] = 0;
      continue;
    }
    const sum = results.reduce((acc, r) => {
      const d = r.dimensions.find((x) => x.dimension === dim);
      return acc + (d?.score ?? 0);
    }, 0);
    averageByDimension[dim] = Math.round((sum / results.length) * 10) / 10;
  }

  const overallScore =
    results.length === 0
      ? 0
      : Math.round((results.reduce((acc, r) => acc + r.weightedScore, 0) / results.length) * 10) / 10;

  const safetyPassRate =
    results.length === 0
      ? 0
      : Math.round((results.filter((r) => r.safetyPassed).length / results.length) * 1000) / 10;

  return {
    runId: `run-${startedAt}`,
    promptVersion: options.promptVersion,
    startedAt,
    finishedAt: Date.now(),
    totalCases: results.length,
    averageByDimension,
    overallScore,
    safetyPassRate,
    results,
  };
}
