import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../store/app';
import { Loader2, GraduationCap, ShieldCheck, Gauge, AlertTriangle, PlayCircle, Sparkles } from 'lucide-react';
import {
  listQualityRecords,
  listCorrectionSignals,
  aggregateQualityMetrics,
  aggregatePatterns,
  buildCalibrationBlock,
  runHarness,
  createEngineGenerator,
  GOLDEN_DATASET,
  QualityAggregate,
  EvalRunResult,
  DIMENSION_LABELS,
  EvalDimension,
} from '../../ai/training';

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TRAINING — observabilidade do módulo LAUD.IA Training
// ═══════════════════════════════════════════════════════════════
// Consome quality_records + correction_patterns e permite rodar o
// Harness de Evals contra o Golden Dataset. Restrito ao Admin.

const DIMENSIONS: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];

export function AdminTraining() {
  const { settings, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityAggregate | null>(null);
  const [calibration, setCalibration] = useState('');

  // Estado do harness
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [run, setRun] = useState<EvalRunResult | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [records, signals] = await Promise.all([
          listQualityRecords(1000),
          listCorrectionSignals(500),
        ]);
        setMetrics(aggregateQualityMetrics(records));
        setCalibration(buildCalibrationBlock(aggregatePatterns(signals, 5)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRunHarness = useCallback(async () => {
    setRunning(true);
    setRun(null);
    setProgress({ done: 0, total: GOLDEN_DATASET.length });
    try {
      const generate = createEngineGenerator(settings);
      const result = await runHarness(GOLDEN_DATASET, generate, settings, {
        promptVersion: 'atual',
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRun(result);
      if (result.safetyPassRate < 100) {
        showToast(`⚠️ Segurança em ${result.safetyPassRate}% — revisar casos reprovados.`, 'error');
      } else {
        showToast(`Harness concluído: ${result.overallScore}/100, segurança 100%.`, 'success');
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Falha ao rodar o harness', 'error');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [settings, showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando métricas de treinamento…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Gauge} label="Score médio" value={metrics ? `${metrics.overallAvgScore}` : '—'} suffix="/100" tone="indigo" />
        <Kpi icon={ShieldCheck} label="Incidentes de segurança" value={metrics ? `${metrics.safetyIncidents}` : '—'} tone={metrics && metrics.safetyIncidents > 0 ? 'red' : 'emerald'} />
        <Kpi icon={Sparkles} label="Aprovação 1ª tentativa" value={metrics ? `${metrics.firstPassRate}` : '—'} suffix="%" tone="emerald" />
        <Kpi icon={GraduationCap} label="Laudos avaliados" value={metrics ? `${metrics.totalReports}` : '0'} tone="slate" />
      </div>

      {/* Lite vs Pro */}
      {metrics && metrics.totalReports > 0 && (
        <div className="bg-white border border-ink-200 rounded-2xl p-5">
          <h3 className="text-sm font-black text-ink-900 mb-3">Motor Lite vs Pro</h3>
          <div className="grid grid-cols-2 gap-4">
            {(['lite', 'pro'] as const).map((m) => {
              const s = metrics.liteVsPro[m];
              return (
                <div key={m} className="border border-ink-100 rounded-xl p-4">
                  <div className="text-[11px] font-black uppercase tracking-wide text-ink-500 mb-2">{m}</div>
                  <div className="text-2xl font-black text-ink-900">{s.avgScore}<span className="text-sm text-ink-400">/100</span></div>
                  <div className="text-[11px] text-ink-500 mt-1">{s.count} laudo(s) · {s.avgRefinements} refino(s)/laudo · {Math.round(s.avgLatencyMs / 100) / 10}s</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Piores áreas */}
      {metrics && metrics.worstAreas.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-2xl p-5">
          <h3 className="text-sm font-black text-ink-900 mb-3">Áreas com mais refinamentos (onde o motor precisa melhorar)</h3>
          <div className="space-y-1.5">
            {metrics.worstAreas.slice(0, 6).map((a) => (
              <div key={a.area} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-ink-700">{a.area}</span>
                <span className="text-ink-500">{a.refinementRate} refino(s)/laudo · score {a.avgScore} · {a.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calibração pessoal aprendida */}
      {calibration && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-sm font-black text-amber-900 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Calibração pessoal aprendida (Camada 0.5)
          </h3>
          <pre className="text-[11px] text-amber-800 whitespace-pre-wrap font-mono">{calibration}</pre>
          <p className="text-[10px] text-amber-600 mt-2">Deve passar pelo Harness de Evals antes de ser ativada em produção.</p>
        </div>
      )}

      {/* Harness de Evals */}
      <div className="bg-white border border-ink-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-ink-900">Harness de Avaliação (Golden Dataset: {GOLDEN_DATASET.length} casos)</h3>
          <button
            onClick={handleRunHarness}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            {running ? `Rodando ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Rodar Harness'}
          </button>
        </div>

        {run && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Kpi icon={Gauge} label="Score geral" value={`${run.overallScore}`} suffix="/100" tone="indigo" />
              <Kpi icon={ShieldCheck} label="Segurança" value={`${run.safetyPassRate}`} suffix="%" tone={run.safetyPassRate >= 100 ? 'emerald' : 'red'} />
              <Kpi icon={GraduationCap} label="Casos" value={`${run.totalCases}`} tone="slate" />
            </div>

            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wide text-ink-500 mb-2">Médias por dimensão</h4>
              <div className="space-y-1.5">
                {DIMENSIONS.map((d) => (
                  <div key={d} className="flex items-center gap-3">
                    <span className="text-[11px] text-ink-600 w-44">{DIMENSION_LABELS[d]}</span>
                    <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={d === 'safety' && run.averageByDimension[d] < 100 ? 'h-full bg-red-500' : 'h-full bg-indigo-500'}
                        style={{ width: `${run.averageByDimension[d]}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-ink-700 w-10 text-right">{run.averageByDimension[d]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Casos reprovados na segurança */}
            {run.results.filter((r) => !r.safetyPassed).length > 0 && (
              <div className="border border-red-200 bg-red-50/50 rounded-xl p-3">
                <h4 className="text-[11px] font-black uppercase tracking-wide text-red-700 mb-1.5">Casos reprovados na segurança</h4>
                {run.results.filter((r) => !r.safetyPassed).map((r) => (
                  <div key={r.caseId} className="text-[11px] text-red-700">• {r.caseId} ({r.examType}) — score {r.weightedScore}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {!run && !running && (
          <p className="text-[12px] text-ink-400">Rode o harness para medir a qualidade atual dos laudos contra o conjunto-ouro. Use uma conta admin (isenta de cota).</p>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, suffix, tone }: {
  icon: any; label: string; value: string; suffix?: string;
  tone: 'indigo' | 'emerald' | 'red' | 'slate';
}) {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    red: 'from-red-500 to-red-700',
    slate: 'from-slate-500 to-slate-700',
  };
  return (
    <div className="bg-white border border-ink-200 rounded-2xl p-4">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tones[tone]} flex items-center justify-center mb-2`}>
        <Icon size={15} className="text-white" />
      </div>
      <div className="text-2xl font-black text-ink-900 leading-none">{value}<span className="text-sm text-ink-400">{suffix}</span></div>
      <div className="text-[10px] text-ink-500 font-medium mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}
