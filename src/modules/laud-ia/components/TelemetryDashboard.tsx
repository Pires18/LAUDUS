import { useState, useEffect } from 'react';
import { AlertCircle, BarChart3, BrainCircuit, CheckCircle2, Download, Database, Coins, Clock, TrendingUp } from 'lucide-react';
import { callMetricsHistory, motorForModel, type CallMetrics } from '../../ai/engine';
import { GEMINI_MODEL_PRICING } from '../../ai/modelPricing';
import { classNames } from '../../../utils/format';

// Preços de modelos Claude que aparecem só em métricas HISTÓRICAS (o runtime hoje
// é Gemini-only). Os preços Gemini vêm da fonte única (modelPricing.ts) — antes
// eram duplicados aqui e ficavam defasados. USD por 1M tokens (input/output).
const PRICING_REF: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':        { input: 3.0,  output: 15.0 },
  'claude-3-5-sonnet-latest': { input: 3.0,  output: 15.0 },
  'claude-3-7-sonnet-latest': { input: 3.0,  output: 15.0 },
  'claude-opus-4-5':          { input: 15.0, output: 75.0 },
  'claude-3-haiku-20240307':  { input: 0.25, output: 1.25 },
  ...GEMINI_MODEL_PRICING,
};

// Painel de telemetria de IA — extraído de SharedLaudIA (autocontido).
export function TelemetryDashboard({
  modeFilter = 'all',
  conversionRate = 5.5,
}: {
  modeFilter?: string;
  conversionRate?: number;
}) {
  const [metrics, setMetrics] = useState<CallMetrics[]>([]);
  const [expandedMetricIndex, setExpandedMetricIndex] = useState<number | null>(null);

  useEffect(() => {
    setMetrics([...callMetricsHistory]);
    const interval = setInterval(() => {
      setMetrics([...callMetricsHistory]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredMetrics = modeFilter === 'all' ? metrics : metrics.filter(m => m.mode === modeFilter);

  const handleExportCsv = () => {
    const rows = [
      ['Modo','Provider','Modelo','Area','Tokens In','Tokens Out','Latência (ms)','Custo USD','Custo BRL','Sucesso','Timestamp'],
      ...filteredMetrics.map(m => {
        const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
        const costUsd = ((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output);
        const costBrl = costUsd * conversionRate;
        return [
          m.mode, m.provider, m.modelName || '', m.area,
          m.estimatedInputTokens, m.estimatedOutputTokens,
          m.latencyMs, costUsd.toFixed(6), costBrl.toFixed(4),
          m.success ? 'sim' : 'não',
          new Date(m.timestamp).toLocaleString('pt-BR')
        ];
      })
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laudia_telemetria_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (filteredMetrics.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-ink-100 p-8 text-center">
        <BarChart3 size={28} className="text-ink-300 mx-auto mb-3" />
        <p className="font-bold text-ink-500 text-sm">{modeFilter === 'all' ? 'Nenhuma chamada registrada ainda.' : `Nenhuma chamada de modo "${modeFilter}" registrada.`}</p>
        <p className="text-xs text-ink-400 mt-1">As métricas aparecerão após gerar o primeiro laudo.</p>
      </div>
    );
  }

  const totalTokensIn = filteredMetrics.reduce((s, m) => s + m.estimatedInputTokens, 0);
  const totalTokensOut = filteredMetrics.reduce((s, m) => s + m.estimatedOutputTokens, 0);
  const avgLatency = filteredMetrics.length > 0 ? Math.round(filteredMetrics.reduce((s, m) => s + m.latencyMs, 0) / filteredMetrics.length) : 0;
  const successRate = filteredMetrics.length > 0 ? Math.round((filteredMetrics.filter(m => m.success).length / filteredMetrics.length) * 100) : 0;

  const totalCostUsd = filteredMetrics.reduce((s, m) => {
    const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
    return s + ((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output);
  }, 0);
  const totalCostBrl = totalCostUsd * conversionRate;

  const modeColors: Record<string, string> = {
    generation: 'bg-brand-100 text-brand-700',
    refine: 'bg-amber-100 text-amber-700',
    copilot: 'bg-violet-100 text-violet-700',
    template: 'bg-teal-100 text-teal-700',
  };
  const modeLabels: Record<string, string> = {
    generation: 'Geração',
    refine: 'Refinamento',
    copilot: 'Copiloto',
    template: 'Template',
  };

  return (
    <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
      <div className="p-4 border-b border-ink-100 bg-ink-50/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={16} className="text-brand-600" />
          <div>
            <span className="font-black text-ink-900 text-sm">Telemetria de Chamadas</span>
            <p className="text-[10px] text-ink-500 mt-0.5">
              {filteredMetrics.length} chamada{filteredMetrics.length !== 1 ? 's' : ''} {modeFilter !== 'all' ? `· modo: ${modeLabels[modeFilter] || modeFilter}` : '· todos os modos'}
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Download size={11} />
          CSV
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-5 gap-px bg-ink-100">
        {[
          { label: 'Tok In', value: totalTokensIn.toLocaleString('pt-BR'), icon: Database, color: 'brand' },
          { label: 'Tok Out', value: totalTokensOut.toLocaleString('pt-BR'), icon: Coins, color: 'emerald' },
          { label: 'Latência', value: `${(avgLatency / 1000).toFixed(1)}s`, icon: Clock, color: 'amber' },
          { label: 'Sucesso', value: `${successRate}%`, icon: CheckCircle2, color: successRate >= 90 ? 'emerald' : 'rose' },
          { label: 'Custo BRL', value: `R$${totalCostBrl.toFixed(3)}`, icon: TrendingUp, color: 'violet' },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-3 text-center">
            <stat.icon size={14} className={`text-${stat.color}-500 mx-auto mb-1`} />
            <span className={`text-base font-black text-${stat.color}-700 block leading-none`}>{stat.value}</span>
            <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Motor breakdown */}
      <div className="px-3 pt-3 pb-2 border-t border-ink-100 bg-ink-50/30">
        {(() => {
          // Classificação de tier pela fonte única (motorForModel) — antes havia
          // listas hardcoded paralelas com IDs datados que esqueciam o Pro atual.
          const proCount = filteredMetrics.filter(m => m.modelName && motorForModel(m.modelName) === 'pro').length;
          const liteCount = filteredMetrics.filter(m => m.modelName && motorForModel(m.modelName) === 'lite').length;
          const total = filteredMetrics.length;
          const litePct = total > 0 ? Math.round((liteCount / total) * 100) : 0;
          const proPct = total > 0 ? Math.round((proCount / total) * 100) : 0;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-black text-ink-500 uppercase tracking-widest">
                <span>Distribuição por Tier de Motor</span>
                <span>{total} chamadas</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" /> Lite</span>
                    <span className="font-black text-indigo-700">{liteCount} ({litePct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${litePct}%` }} />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" /> Pro</span>
                    <span className="font-black text-violet-700">{proCount} ({proPct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${proPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Log das últimas chamadas */}
      <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
        {filteredMetrics.slice(0, 15).map((m, i) => {
          const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
          const costBrl = (((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output)) * conversionRate;
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className={classNames(
                'flex items-center gap-2 p-2.5 rounded-xl border text-xs',
                m.success ? 'bg-ink-50/60 border-ink-100' : 'bg-rose-50 border-rose-100'
              )}>
                <div className={classNames('px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shrink-0', modeColors[m.mode] || 'bg-ink-100 text-ink-600')}>
                  {modeLabels[m.mode] || m.mode}
                </div>
                <span className="text-[10px] font-mono text-ink-600 shrink-0">{m.area || '—'}</span>
                <div className="flex-1 flex items-center gap-2 min-w-0 text-ink-500 text-[10px]">
                  <span>↑{m.estimatedInputTokens.toLocaleString('pt-BR')}</span>
                  <span>↓{m.estimatedOutputTokens.toLocaleString('pt-BR')}</span>
                  <span>{(m.latencyMs / 1000).toFixed(1)}s</span>
                  {costBrl > 0 && <span className="text-violet-600 font-bold">R${costBrl.toFixed(4)}</span>}
                </div>
                <span className={classNames('text-[9px] font-black uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded',
                  m.provider === 'gemini' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                )}>{m.provider}</span>
                {m.scratchpad && (
                  <button
                    onClick={() => setExpandedMetricIndex(expandedMetricIndex === i ? null : i)}
                    className="px-2 py-0.5 bg-white border border-ink-200 rounded text-ink-600 text-[9px] font-bold hover:bg-ink-50 transition-all shrink-0"
                  >
                    {expandedMetricIndex === i ? 'Ocultar' : 'Raciocínio'}
                  </button>
                )}
                {m.success
                  ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  : <AlertCircle size={13} className="text-rose-500 shrink-0" />}
              </div>
              {expandedMetricIndex === i && m.scratchpad && (
                <div className="p-3 bg-ink-900 text-ink-300 font-mono text-[10px] rounded-xl overflow-x-auto border border-ink-800">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-ink-800">
                    <BrainCircuit size={12} className="text-brand-500" />
                    <span className="font-black text-ink-400 uppercase tracking-widest text-[9px]">Scratchpad</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{m.scratchpad}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
