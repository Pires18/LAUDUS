import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/app';
import {
  Loader2, ShieldCheck, Gauge, AlertTriangle, PlayCircle, Sparkles,
  GraduationCap, Library, RefreshCw, TrendingUp, Cpu, DownloadCloud, Binary,
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { useConfirm } from '../../hooks/useConfirm';
import {
  listQualityRecords,
  listCorrectionSignals,
  listExcellenceCorpus,
  aggregateQualityMetrics,
  aggregatePatterns,
  buildCalibrationBlock,
  backfillCorpusFromFinalized,
  vectorizeCorpus,
  countPendingVectorization,
  runHarness,
  createEngineGenerator,
  GOLDEN_DATASET,
  QualityAggregate,
  EvalRunResult,
  DIMENSION_LABELS,
  EvalDimension,
} from '../ai/training';

// ═══════════════════════════════════════════════════════════════
// TRAINING DASHBOARD — central de observabilidade do aprendizado
// ═══════════════════════════════════════════════════════════════
// Integrado à aba "Aprendizado" do LAUD.IA. Consome quality_records,
// correction_patterns e o corpus de excelência; permite rodar o Harness
// de Evals contra o Golden Dataset. Visual alinhado ao LAUD.IA.

const DIMENSIONS: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];

export function TrainingDashboard({ readOnly = false }: { readOnly?: boolean }) {
  const { settings, showToast } = useApp();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityAggregate | null>(null);
  const [calibration, setCalibration] = useState('');
  const [corpusCount, setCorpusCount] = useState(0);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [run, setRun] = useState<EvalRunResult | null>(null);

  // Backfill (importação de laudos finalizados)
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  // Vetorização (retrieval semântico)
  const [pendingVec, setPendingVec] = useState(0);
  const [vectorizing, setVectorizing] = useState(false);
  const [vecProgress, setVecProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, signals, corpus, pending] = await Promise.all([
        listQualityRecords(1000),
        listCorrectionSignals(500),
        listExcellenceCorpus(undefined, 500),
        countPendingVectorization(),
      ]);
      setMetrics(aggregateQualityMetrics(records));
      setCalibration(buildCalibrationBlock(aggregatePatterns(signals, 5)));
      setCorpusCount(corpus.length);
      setPendingVec(pending.pending);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const handleBackfill = useCallback(async () => {
    const ok = await confirm({
      title: 'Importar laudos finalizados',
      message: 'Seus laudos finalizados serão anonimizados (LGPD) e adicionados ao Corpus de Excelência para a IA aprender seu padrão. Laudos truncados ou com dados pessoais residuais são ignorados. Esta ação é segura e idempotente (não duplica).',
      confirmLabel: 'Importar agora',
      variant: 'info',
    });
    if (!ok) return;

    setImporting(true);
    setImportProgress({ done: 0, total: 0 });
    try {
      const r = await backfillCorpusFromFinalized(settings, {
        minAuditScore: 60,
        onProgress: (done, total) => setImportProgress({ done, total }),
      });
      showToast(
        `Importação concluída: ${r.imported} laudo(s) no corpus (de ${r.total}). Ignorados — já existentes: ${r.skippedExisting}, baixa qualidade/limite: ${r.skippedLowQuality}, PII: ${r.skippedPII}, vazios: ${r.skippedEmpty}.`,
        r.imported > 0 ? 'success' : 'info'
      );
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Falha na importação', 'error');
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }, [settings, showToast, confirm, load]);

  const handleVectorize = useCallback(async () => {
    setVectorizing(true);
    setVecProgress({ done: 0, total: pendingVec });
    try {
      const r = await vectorizeCorpus(settings, {
        onProgress: (done, total) => setVecProgress({ done, total }),
      });
      showToast(
        `Vetorização concluída: ${r.vectorized}/${r.totalPending} laudos. Retrieval semântico ativo.` +
        (r.failed > 0 ? ` (${r.failed} falharam — rode novamente para reprocessar)` : ''),
        r.vectorized > 0 ? 'success' : 'info'
      );
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Falha na vetorização', 'error');
    } finally {
      setVectorizing(false);
      setVecProgress(null);
    }
  }, [settings, showToast, pendingVec, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-400">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-xs font-bold">Carregando métricas de aprendizado…</span>
      </div>
    );
  }

  const hasData = metrics && metrics.totalReports > 0;

  return (
    <div className="space-y-5">
      {/* ── KPIs principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={Gauge}        label="Score médio"        value={hasData ? `${metrics!.overallAvgScore}` : '—'} suffix="/100" tone="indigo" />
        <Kpi icon={ShieldCheck}  label="Incid. segurança"   value={hasData ? `${metrics!.safetyIncidents}` : '0'} tone={hasData && metrics!.safetyIncidents > 0 ? 'rose' : 'emerald'} />
        <Kpi icon={Sparkles}     label="Aprov. 1ª tentativa" value={hasData ? `${metrics!.firstPassRate}` : '—'} suffix="%" tone="emerald" />
        <Kpi icon={Library}      label="Corpus excelência"  value={`${corpusCount}`} tone="violet" />
        <Kpi icon={GraduationCap} label="Laudos avaliados"  value={hasData ? `${metrics!.totalReports}` : '0'} tone="slate" />
      </div>

      {/* ── Corpus de Excelência: bootstrap com laudos finalizados ── */}
      {!readOnly && (
        <div className={classNames(
          'rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap',
          corpusCount === 0 ? 'bg-indigo-50/60 border-indigo-200' : 'bg-white border-ink-100 shadow-sm'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Library size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-black text-ink-900">Corpus de Excelência · {corpusCount} laudo(s)</h4>
              <p className="text-[11px] text-ink-500 leading-relaxed">
                {corpusCount === 0
                  ? 'Importe seus laudos finalizados (anonimizados) para a IA aprender seu padrão imediatamente.'
                  : pendingVec > 0
                    ? `${pendingVec} laudo(s) sem vetor — vetorize para ativar o retrieval semântico (caso clinicamente mais parecido).`
                    : 'Corpus vetorizado · retrieval semântico ativo. Importe novos laudos a qualquer momento.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pendingVec > 0 && (
              <button
                onClick={handleVectorize}
                disabled={vectorizing || importing}
                className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {vectorizing
                  ? <><Loader2 size={12} className="animate-spin" /> {vecProgress?.done ?? 0}/{vecProgress?.total ?? 0}</>
                  : <><Binary size={12} /> Vetorizar ({pendingVec})</>}
              </button>
            )}
            <button
              onClick={handleBackfill}
              disabled={importing || vectorizing}
              className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              {importing
                ? <><Loader2 size={12} className="animate-spin" /> {importProgress?.done ?? 0}/{importProgress?.total ?? 0}</>
                : <><DownloadCloud size={12} /> Importar laudos finalizados</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Lite vs Pro + Piores áreas ── */}
      {hasData && (
        <div className="grid lg:grid-cols-2 gap-3">
          <Card title="Motor Lite vs Pro" icon={Cpu}>
            <div className="grid grid-cols-2 gap-3">
              {(['lite', 'pro'] as const).map((m) => {
                const s = metrics!.liteVsPro[m];
                return (
                  <div key={m} className="border border-ink-100 rounded-xl p-3.5 bg-ink-50/40">
                    <div className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-1.5">{m}</div>
                    <div className="text-2xl font-black text-ink-900 leading-none">
                      {s.avgScore}<span className="text-xs text-ink-400">/100</span>
                    </div>
                    <div className="text-[10px] text-ink-500 mt-1.5 leading-tight">
                      {s.count} laudo(s)<br />{s.avgRefinements} refino(s)/laudo · {Math.round(s.avgLatencyMs / 100) / 10}s
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Áreas que mais precisam melhorar" icon={TrendingUp}>
            {metrics!.worstAreas.length === 0 ? (
              <p className="text-[11px] text-ink-400">Sem dados de refinamento ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {metrics!.worstAreas.slice(0, 5).map((a) => (
                  <div key={a.area} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-ink-700">{a.area}</span>
                    <span className="text-ink-500">{a.refinementRate} refino(s) · score {a.avgScore}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Calibração pessoal ── */}
      {calibration && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
          <h4 className="text-xs font-black text-amber-900 mb-2 flex items-center gap-2 uppercase tracking-wide">
            <AlertTriangle size={13} /> Calibração pessoal aprendida (Camada 0.5)
          </h4>
          <pre className="text-[11px] text-amber-800 whitespace-pre-wrap font-mono leading-relaxed">{calibration}</pre>
          <p className="text-[10px] text-amber-600 mt-2">Passa pelo Harness de Evals antes de ativar em produção.</p>
        </div>
      )}

      {/* ── Harness de Avaliação ── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PlayCircle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-ink-900 leading-none">Harness de Avaliação</h4>
              <p className="text-[10px] text-ink-500 mt-1">Golden Dataset · {GOLDEN_DATASET.length} casos curados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="h-9 w-9 rounded-xl bg-ink-100 border border-ink-200 text-ink-500 hover:text-ink-700 hover:bg-ink-200 transition-all flex items-center justify-center"
              title="Recarregar métricas"
            >
              <RefreshCw size={13} />
            </button>
            {!readOnly && (
              <button
                onClick={handleRunHarness}
                disabled={running}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                {running ? `${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Rodar Harness'}
              </button>
            )}
          </div>
        </div>

        {run ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Score geral" value={`${run.overallScore}`} suffix="/100" tone="indigo" />
              <MiniStat label="Segurança" value={`${run.safetyPassRate}`} suffix="%" tone={run.safetyPassRate >= 100 ? 'emerald' : 'rose'} />
              <MiniStat label="Casos" value={`${run.totalCases}`} tone="slate" />
            </div>

            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-ink-400">Médias por dimensão</span>
              <div className="space-y-1.5 mt-2">
                {DIMENSIONS.map((d) => {
                  const v = run.averageByDimension[d];
                  const danger = d === 'safety' && v < 100;
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <span className="text-[10px] text-ink-600 w-40 shrink-0">{DIMENSION_LABELS[d]}</span>
                      <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                        <div className={classNames('h-full rounded-full', danger ? 'bg-rose-500' : 'bg-indigo-500')} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-ink-700 w-8 text-right">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {run.results.filter((r) => !r.safetyPassed).length > 0 && (
              <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-700">Reprovados na segurança</span>
                <div className="mt-1.5 space-y-0.5">
                  {run.results.filter((r) => !r.safetyPassed).map((r) => (
                    <div key={r.caseId} className="text-[11px] text-rose-700">• {r.caseId} ({r.examType}) — score {r.weightedScore}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          !running && (
            <p className="text-[11px] text-ink-400">Rode o harness para medir a qualidade atual dos laudos contra o conjunto-ouro. {readOnly ? '' : 'Use uma conta admin (isenta de cota).'}</p>
          )
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes ──

function Kpi({ icon: Icon, label, value, suffix, tone }: {
  icon: any; label: string; value: string; suffix?: string;
  tone: 'indigo' | 'emerald' | 'rose' | 'violet' | 'slate';
}) {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    rose: 'from-rose-500 to-rose-700',
    violet: 'from-violet-500 to-violet-700',
    slate: 'from-slate-500 to-slate-700',
  };
  return (
    <div className="bg-white border border-ink-100 rounded-2xl p-3.5 shadow-sm">
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tones[tone]} flex items-center justify-center mb-2`}>
        <Icon size={13} className="text-white" />
      </div>
      <div className="text-xl font-black text-ink-900 leading-none">{value}<span className="text-xs text-ink-400">{suffix}</span></div>
      <div className="text-[9px] text-ink-400 font-black mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone: 'indigo' | 'emerald' | 'rose' | 'slate' }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-700', emerald: 'text-emerald-700', rose: 'text-rose-700', slate: 'text-ink-700',
  };
  return (
    <div className="border border-ink-100 rounded-xl p-3 bg-ink-50/40">
      <div className={classNames('text-xl font-black leading-none', colors[tone])}>{value}<span className="text-xs opacity-60">{suffix}</span></div>
      <div className="text-[9px] text-ink-400 font-black mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-ink-400" />
        <h4 className="text-xs font-black text-ink-900 uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  );
}
