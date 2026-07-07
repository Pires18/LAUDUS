import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store/app';
import {
  Loader2, ShieldCheck, Gauge, AlertTriangle, PlayCircle, Sparkles,
  GraduationCap, Library, RefreshCw, TrendingUp, Cpu, DownloadCloud, Binary,
  CheckCircle2, Circle, ChevronRight, Database, Activity, ThumbsUp,
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { useConfirm } from '../../hooks/useConfirm';
import {
  listQualityRecords,
  listCorrectionSignals,
  listHumanFeedback,
  aggregateHumanFeedback,
  HumanFeedbackAggregate,
  countExcellenceCorpus,
  aggregateQualityMetrics,
  aggregatePatterns,
  buildCalibrationBlock,
  buildPersonalCalibration,
  savePersonalCalibration,
  backfillCorpusFromFinalized,
  backfillQualityRecordsFromCorpus,
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
// CENTRO DE APRENDIZADO — central de controle e acompanhamento
// ═══════════════════════════════════════════════════════════════
// Painel único que controla e monitora todo o ciclo de aprendizado da
// LAUD.IA: importação → corpus → vetorização → retrieval → feedback →
// avaliação. Visual alinhado ao LAUD.IA.

const DIMENSIONS: EvalDimension[] = ['fidelity', 'completeness', 'safety', 'numeric', 'style'];

interface Props {
  readOnly?: boolean;
  trainingEnabled: boolean;
  onToggleTraining: () => void;
  contextSize: number;
  onContextSizeChange: (n: number) => void;
}

type StageStatus = 'done' | 'active' | 'pending';

export function TrainingDashboard({
  readOnly = false,
  trainingEnabled,
  onToggleTraining,
  contextSize,
  onContextSizeChange,
}: Props) {
  const { settings, showToast } = useApp();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityAggregate | null>(null);
  const [calibration, setCalibration] = useState('');
  const [corpusCount, setCorpusCount] = useState(0);
  const [pendingVec, setPendingVec] = useState(0);
  const [feedback, setFeedback] = useState<HumanFeedbackAggregate | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [run, setRun] = useState<EvalRunResult | null>(null);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [vectorizing, setVectorizing] = useState(false);
  const [vecProgress, setVecProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, signals, total, pending, humanFb] = await Promise.all([
        listQualityRecords(1000),
        listCorrectionSignals(500),
        countExcellenceCorpus(),
        countPendingVectorization(),
        listHumanFeedback(1000),
      ]);
      setMetrics(aggregateQualityMetrics(records));
      const patterns = aggregatePatterns(signals, 5);
      const fbAgg = aggregateHumanFeedback(humanFb);
      setCalibration(buildCalibrationBlock(patterns));
      setFeedback(fbAgg);
      // Recomputa e persiste a Camada 0.5 (correções + feedback) usada na
      // geração — mantém a calibração viva sem custo por laudo.
      void savePersonalCalibration(buildPersonalCalibration(patterns, fbAgg.worstAreas));
      // Contagem real do servidor (sem cap). Fallback para o total do
      // contador de pendências caso a agregação falhe.
      setCorpusCount(total || pending.total);
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
        `Importação concluída: ${r.imported} laudo(s) no corpus (de ${r.total}). Ignorados — existentes: ${r.skippedExisting}, baixa qualidade/limite: ${r.skippedLowQuality}, PII: ${r.skippedPII}, vazios: ${r.skippedEmpty}.`,
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
    const ok = await confirm({
      title: 'Vetorizar corpus',
      message: `Gerar embeddings para os ${pendingVec} laudo(s) pendentes do Corpus de Excelência? Ativa o retrieval semântico para eles. Ação segura e idempotente (não duplica).`,
      confirmLabel: 'Vetorizar agora',
      variant: 'info',
    });
    if (!ok) return;
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
  }, [settings, showToast, pendingVec, load, confirm]);

  // Recalcula as notas de qualidade a partir do corpus (popula Score/Segurança).
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState<{ done: number; total: number } | null>(null);
  const handleComputeScores = useCallback(async () => {
    const ok = await confirm({
      title: 'Calcular notas de qualidade',
      message: `Rodar auditoria de qualidade (Score/Segurança) sobre os ${corpusCount} laudo(s) do corpus? Ação segura e idempotente (não duplica registros).`,
      confirmLabel: 'Calcular agora',
      variant: 'info',
    });
    if (!ok) return;
    setScoring(true);
    setScoreProgress({ done: 0, total: corpusCount });
    try {
      const r = await backfillQualityRecordsFromCorpus({
        onProgress: (done, total) => setScoreProgress({ done, total }),
      });
      showToast(`Notas calculadas: ${r.written}/${r.total} laudos. Score e segurança atualizados.`, r.written > 0 ? 'success' : 'info');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Falha ao calcular notas', 'error');
    } finally {
      setScoring(false);
      setScoreProgress(null);
    }
  }, [showToast, corpusCount, load, confirm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400">
        <Loader2 className="animate-spin mr-2" size={18} />
        <span className="text-xs font-bold">Carregando central de aprendizado…</span>
      </div>
    );
  }

  // ── Estado derivado ──
  const hasData = !!metrics && metrics.totalReports > 0;
  const vectorized = Math.max(0, corpusCount - pendingVec);
  const vecPct = corpusCount > 0 ? Math.round((vectorized / corpusCount) * 100) : 0;
  const lastScore = run?.overallScore ?? (hasData ? metrics!.overallAvgScore : null);

  const systemState: { label: string; tone: 'emerald' | 'amber' | 'slate'; desc: string } = !trainingEnabled
    ? { label: 'Treino desativado', tone: 'amber', desc: 'Ative o aprendizado para a IA usar seu corpus e correções.' }
    : corpusCount === 0
      ? { label: 'Aguardando dados', tone: 'slate', desc: 'Importe laudos finalizados para iniciar o aprendizado.' }
      : { label: 'Operacional', tone: 'emerald', desc: 'A IA está aprendendo com seus laudos, correções e exemplos.' };

  const stages: { key: string; label: string; icon: any; status: StageStatus }[] = [
    { key: 'import', label: 'Importação', icon: DownloadCloud, status: corpusCount > 0 ? 'done' : 'pending' },
    { key: 'corpus', label: 'Corpus', icon: Library, status: corpusCount > 0 ? 'done' : 'pending' },
    { key: 'vector', label: 'Vetorização', icon: Binary, status: corpusCount === 0 ? 'pending' : pendingVec === 0 ? 'done' : vectorized > 0 ? 'active' : 'pending' },
    { key: 'retrieval', label: 'Retrieval', icon: Sparkles, status: trainingEnabled && corpusCount > 0 ? 'done' : 'pending' },
    { key: 'feedback', label: 'Feedback', icon: RefreshCw, status: hasData ? 'done' : 'pending' },
    { key: 'eval', label: 'Avaliação', icon: Gauge, status: run ? 'done' : hasData ? 'active' : 'pending' },
  ];

  return (
    <div className="space-y-5">
      {/* ══════════ STATUS DO SISTEMA + CONTROLE ══════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.06)_0%,transparent_60%)]" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <GraduationCap size={22} className="text-white" />
                </div>
                <StateDot tone={systemState.tone} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-ink-900 tracking-tight">Centro de Aprendizado</h3>
                  <StateBadge tone={systemState.tone} label={systemState.label} />
                </div>
                <p className="text-[11px] text-ink-500 mt-0.5">{systemState.desc}</p>
              </div>
            </div>

            {/* Toggle de treino */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className={classNames('text-[10px] font-black uppercase tracking-widest', trainingEnabled ? 'text-emerald-600' : 'text-ink-400')}>
                {trainingEnabled ? 'Ativo' : 'Inativo'}
              </span>
              <button
                onClick={onToggleTraining}
                disabled={readOnly}
                className={classNames(
                  'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50',
                  trainingEnabled ? 'bg-indigo-600' : 'bg-ink-200',
                  !readOnly && 'cursor-pointer'
                )}
              >
                <span className={classNames('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200', trainingEnabled ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4">
            <QuickStat icon={Library} label="Corpus" value={`${corpusCount}`} sub="laudos" />
            <QuickStat icon={Binary} label="Vetorizado" value={`${vecPct}%`} sub={`${vectorized}/${corpusCount}`} />
            <QuickStat icon={Gauge} label="Score" value={lastScore != null ? `${lastScore}` : '—'} sub="/100" />
            <QuickStat icon={ShieldCheck} label="Segurança" value={hasData ? `${metrics!.safetyIncidents}` : '0'} sub="incidentes" tone={hasData && metrics!.safetyIncidents > 0 ? 'rose' : 'emerald'} />
            <QuickStat icon={ThumbsUp} label="Satisfação" value={feedback && feedback.total > 0 ? `${feedback.satisfactionRate}%` : '—'} sub={feedback ? `${feedback.total} feedbacks` : 'sem dados'} tone={feedback && feedback.total > 0 && feedback.satisfactionRate < 70 ? 'rose' : 'emerald'} />
          </div>

          {/* Pipeline do aprendizado */}
          <div className="mt-5 pt-4 border-t border-ink-100">
            <div className="flex items-center gap-1 mb-2.5">
              <Activity size={12} className="text-ink-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-ink-400">Pipeline de Aprendizado</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {stages.map((s, i) => (
                <div key={s.key} className="flex items-center shrink-0">
                  <PipelineStage label={s.label} icon={s.icon} status={s.status} />
                  {i < stages.length - 1 && <ChevronRight size={14} className="text-ink-300 mx-0.5 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Mimetismo */}
          <div className={classNames('mt-4 pt-4 border-t border-ink-100', !trainingEnabled && 'opacity-40 pointer-events-none')}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-ink-700">Exames contextuais (mimetismo)</span>
              <span className="text-indigo-600 font-black text-sm">{contextSize}</span>
            </div>
            <input
              type="range" min={1} max={10} value={contextSize}
              onChange={(e) => onContextSizeChange(parseInt(e.target.value))}
              disabled={readOnly}
              className="w-full h-2 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-1">
              <span>1 — Rápido</span>
              <span className="text-indigo-600">3-5 Ideal</span>
              <span>10 — Lento</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ CORPUS DE EXCELÊNCIA ══════════ */}
      {!readOnly && (
        <SectionCard title="Corpus de Excelência" icon={Database} accent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-ink-900">{corpusCount}</span>
                <span className="text-[11px] text-ink-500">laudos no banco · {vectorized} vetorizados</span>
              </div>
              {/* Barra de vetorização */}
              <div className="mt-2 h-2 bg-ink-100 rounded-full overflow-hidden max-w-md">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{ width: `${vecPct}%` }} />
              </div>
              <p className="text-[10px] text-ink-400 mt-1.5">
                {corpusCount === 0
                  ? 'Importe seus laudos finalizados para começar.'
                  : pendingVec > 0
                    ? `${pendingVec} laudo(s) sem vetor — vetorize para ativar o retrieval semântico (caso clinicamente mais parecido).`
                    : 'Retrieval semântico ativo — a IA encontra o caso clinicamente mais parecido.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {corpusCount > 0 && (
                <button
                  onClick={handleComputeScores}
                  disabled={scoring || importing || vectorizing}
                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                  title="Calcula Score e Segurança dos laudos do corpus"
                >
                  {scoring ? <><Loader2 size={12} className="animate-spin" /> {scoreProgress?.done ?? 0}/{scoreProgress?.total ?? 0}</> : <><Gauge size={12} /> Calcular notas</>}
                </button>
              )}
              {pendingVec > 0 && (
                <button
                  onClick={handleVectorize}
                  disabled={vectorizing || importing || scoring}
                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {vectorizing ? <><Loader2 size={12} className="animate-spin" /> {vecProgress?.done ?? 0}/{vecProgress?.total ?? 0}</> : <><Binary size={12} /> Vetorizar</>}
                </button>
              )}
              <button
                onClick={handleBackfill}
                disabled={importing || vectorizing || scoring}
                className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {importing ? <><Loader2 size={12} className="animate-spin" /> {importProgress?.done ?? 0}/{importProgress?.total ?? 0}</> : <><DownloadCloud size={12} /> Importar</>}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══════════ DESEMPENHO ══════════ */}
      {hasData && (
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard title="Motor Lite vs Pro" icon={Cpu}>
            <div className="grid grid-cols-2 gap-3">
              {(['lite', 'pro'] as const).map((m) => {
                const s = metrics!.liteVsPro[m];
                return (
                  <div key={m} className="border border-ink-100 rounded-xl p-3.5 bg-ink-50/40">
                    <div className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-1.5">{m}</div>
                    <div className="text-2xl font-black text-ink-900 leading-none">{s.avgScore}<span className="text-xs text-ink-400">/100</span></div>
                    <div className="text-[10px] text-ink-500 mt-1.5 leading-tight">{s.count} laudo(s)<br />{s.avgRefinements} refino(s) · {Math.round(s.avgLatencyMs / 100) / 10}s</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Áreas que mais precisam melhorar" icon={TrendingUp}>
            {metrics!.worstAreas.length === 0 ? (
              <p className="text-[11px] text-ink-400">Sem dados de refinamento ainda.</p>
            ) : (
              <div className="space-y-2">
                {metrics!.worstAreas.slice(0, 5).map((a) => {
                  const pct = Math.min(100, (a.refinementRate / 3) * 100);
                  return (
                    <div key={a.area}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-bold text-ink-700">{a.area}</span>
                        <span className="text-ink-500">{a.refinementRate} refino(s) · score {a.avgScore}</span>
                      </div>
                      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div className={classNames('h-full rounded-full', pct > 66 ? 'bg-rose-400' : pct > 33 ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: `${Math.max(6, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ══════════ CALIBRAÇÃO PESSOAL ══════════ */}
      {calibration && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
          <h4 className="text-xs font-black text-amber-900 mb-2 flex items-center gap-2 uppercase tracking-wide">
            <AlertTriangle size={13} /> Calibração pessoal aprendida (Camada 0.5)
          </h4>
          <pre className="text-[11px] text-amber-800 whitespace-pre-wrap font-mono leading-relaxed">{calibration}</pre>
          <p className="text-[10px] text-amber-600 mt-2">Passa pelo Harness de Evals antes de ativar em produção.</p>
        </div>
      )}

      {/* ══════════ HARNESS DE AVALIAÇÃO ══════════ */}
      <SectionCard
        title={`Harness de Avaliação · ${GOLDEN_DATASET.length} casos`}
        icon={PlayCircle}
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 w-9 rounded-xl bg-ink-100 border border-ink-200 text-ink-500 hover:text-ink-700 hover:bg-ink-200 transition-all flex items-center justify-center" title="Recarregar">
              <RefreshCw size={13} />
            </button>
            {!readOnly && (
              <button
                onClick={handleRunHarness}
                disabled={running}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {running ? <><Loader2 size={12} className="animate-spin" /> {progress?.done ?? 0}/{progress?.total ?? 0}</> : <><PlayCircle size={12} /> Rodar Harness</>}
              </button>
            )}
          </div>
        }
      >
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
          !running && <p className="text-[11px] text-ink-400">Rode o harness para medir a qualidade atual dos laudos contra o conjunto-ouro. {readOnly ? '' : 'Use uma conta admin (isenta de cota).'}</p>
        )}
      </SectionCard>
    </div>
  );
}

// ════════════════ Subcomponentes ════════════════

function StateDot({ tone }: { tone: 'emerald' | 'amber' | 'slate' }) {
  const map = { emerald: 'bg-emerald-400 border-white', amber: 'bg-amber-400 border-white', slate: 'bg-ink-300 border-white' };
  const inner = { emerald: 'bg-emerald-300', amber: 'bg-amber-300', slate: 'bg-ink-200' };
  return (
    <div className={classNames('absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center', map[tone])}>
      <div className={classNames('w-1.5 h-1.5 rounded-full', inner[tone], tone === 'emerald' && 'animate-pulse')} />
    </div>
  );
}

function StateBadge({ tone, label }: { tone: 'emerald' | 'amber' | 'slate'; label: string }) {
  const map = {
    emerald: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-600',
    amber: 'bg-amber-500/10 border-amber-400/20 text-amber-600',
    slate: 'bg-ink-500/10 border-ink-400/20 text-ink-500',
  };
  return <span className={classNames('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', map[tone])}>{label}</span>;
}

function QuickStat({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub: string; tone?: 'emerald' | 'rose' }) {
  return (
    <div className="border border-ink-100 rounded-xl p-2.5 bg-white">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-ink-400" />
        <span className="text-[9px] font-black uppercase tracking-widest text-ink-400">{label}</span>
      </div>
      <div className={classNames('text-lg font-black leading-none', tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-ink-900')}>
        {value}<span className="text-[10px] text-ink-400 font-bold ml-0.5">{sub}</span>
      </div>
    </div>
  );
}

function PipelineStage({ label, icon: Icon, status }: { label: string; icon: any; status: StageStatus }) {
  const styles = {
    done: { box: 'bg-emerald-50 border-emerald-200 text-emerald-600', text: 'text-emerald-700' },
    active: { box: 'bg-indigo-50 border-indigo-200 text-indigo-600', text: 'text-indigo-700' },
    pending: { box: 'bg-ink-50 border-ink-200 text-ink-300', text: 'text-ink-400' },
  }[status];
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className={classNames('relative w-9 h-9 rounded-xl border flex items-center justify-center', styles.box)}>
        <Icon size={15} />
        {status === 'done' && <CheckCircle2 size={11} className="absolute -top-1 -right-1 text-emerald-500 bg-white rounded-full" />}
        {status === 'active' && <Circle size={11} className="absolute -top-1 -right-1 text-indigo-500 bg-white rounded-full animate-pulse" fill="currentColor" />}
      </div>
      <span className={classNames('text-[8.5px] font-black uppercase tracking-wide text-center leading-none', styles.text)}>{label}</span>
    </div>
  );
}

function MiniStat({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone: 'indigo' | 'emerald' | 'rose' | 'slate' }) {
  const colors = { indigo: 'text-indigo-700', emerald: 'text-emerald-700', rose: 'text-rose-700', slate: 'text-ink-700' };
  return (
    <div className="border border-ink-100 rounded-xl p-3 bg-ink-50/40">
      <div className={classNames('text-xl font-black leading-none', colors[tone])}>{value}<span className="text-xs opacity-60">{suffix}</span></div>
      <div className="text-[9px] text-ink-400 font-black mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action, accent }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={classNames('rounded-2xl border shadow-sm p-5', accent ? 'bg-white border-ink-200' : 'bg-white border-ink-100')}>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-indigo-500" />
          <h4 className="text-xs font-black text-ink-900 uppercase tracking-wide">{title}</h4>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
