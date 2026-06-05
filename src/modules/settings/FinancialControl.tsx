import { useState, useEffect } from 'react';
import {
  Coins, TrendingUp, CalendarDays, Activity, Loader2,
  Sparkles, BrainCircuit, History, RefreshCw, BarChart3, Zap
} from 'lucide-react';
import { getAiUsageStats, AiUsageLog } from '../../store/db';
import { classNames } from '../../utils/format';

const USD_TO_BRL = 5.50;

const PRICING: Record<string, { input: number; output: number; label: string; color: string }> = {
  'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0, label: 'Claude 3.5 Sonnet', color: 'amber' },
  'claude-3-7-sonnet-latest': { input: 3.0, output: 15.0, label: 'Claude 3.7 Sonnet', color: 'amber' },
  'gemini-3.5-flash':         { input: 0.075, output: 0.30, label: 'Gemini 3.5 Flash', color: 'brand' },
  'gemini-3.1-pro-preview':   { input: 1.25, output: 5.0,  label: 'Gemini 3.1 Pro',   color: 'violet' },
};

function resolveModelName(rawModel: string): string {
  const raw = (rawModel || '').toLowerCase();
  if (raw.includes('claude-3-7-sonnet')) return 'claude-3-7-sonnet-latest';
  if (raw.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet-latest';
  if (raw.includes('gemini-3.1-pro') || raw.includes('gemini-3.1-pro-preview')) return 'gemini-3.1-pro-preview';
  if (raw.includes('gemini-3.5-flash') || raw.includes('gemini-2.0-flash') || raw.includes('gemini-1.5-flash')) return 'gemini-3.5-flash';
  if (raw.includes('claude')) return 'claude-3-5-sonnet-latest';
  if (raw.includes('gemini')) return 'gemini-3.5-flash';
  return rawModel || 'Desconhecido';
}

function calculateCost(model: string, input: number, output: number): number {
  const prices = PRICING[model];
  if (!prices) return 0;
  return ((input / 1_000_000) * prices.input) + ((output / 1_000_000) * prices.output);
}

function formatBrl(valUsd: number) {
  return `R$ ${(valUsd * USD_TO_BRL).toFixed(4)}`;
}
function formatTokens(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val);
}
function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

const MODEL_BADGE: Record<string, string> = {
  'gemini-3.5-flash':         'bg-brand-50 text-brand-700 border-brand-100',
  'gemini-3.1-pro-preview':   'bg-violet-50 text-violet-700 border-violet-100',
  'claude-3-5-sonnet-latest': 'bg-amber-50 text-amber-700 border-amber-100',
  'claude-3-7-sonnet-latest': 'bg-amber-50 text-amber-700 border-amber-100',
};

interface GroupedLog {
  key: string;
  examId?: string;
  timestamp: number;
  models: Set<string>;
  area: string;
  tokens: number;
  costUsd: number;
  requests: number;
}

export function FinancialControl() {
  const [loading, setLoading] = useState(true);
  const [dailyStats,   setDailyStats]   = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [weeklyStats,  setWeeklyStats]  = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [modelBreakdown, setModelBreakdown] = useState<Record<string, { tokens: number; costUsd: number }>>({});
  const [groupedLogs,    setGroupedLogs]    = useState<GroupedLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayOfWeek    = now.getDay();
      const startOfWeek  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const endOfRange   = now.getTime();

      const rawLogs = await getAiUsageStats(startOfMonth, endOfRange);
      rawLogs.sort((a, b) => b.timestamp - a.timestamp);

      let dTokens = 0, dCost = 0, dCount = 0;
      let wTokens = 0, wCost = 0, wCount = 0;
      let mTokens = 0, mCost = 0, mCount = 0;
      const breakdown: Record<string, { tokens: number; costUsd: number }> = {};

      // Normalize every log in place
      const logs: (AiUsageLog & { _resolvedModel: string })[] = rawLogs.map(log => {
        const model    = resolveModelName(log.model);
        const costUsd  = calculateCost(model, log.inputTokens, log.outputTokens);
        return { ...log, _resolvedModel: model, costUsd };
      });

      logs.forEach(log => {
        const totalTokens = log.inputTokens + log.outputTokens;
        mTokens += totalTokens; mCost += log.costUsd; mCount++;
        if (log.timestamp >= startOfWeek) { wTokens += totalTokens; wCost += log.costUsd; wCount++; }
        if (log.timestamp >= startOfDay)  { dTokens += totalTokens; dCost += log.costUsd; dCount++; }

        const m = log._resolvedModel;
        if (!breakdown[m]) breakdown[m] = { tokens: 0, costUsd: 0 };
        breakdown[m].tokens  += totalTokens;
        breakdown[m].costUsd += log.costUsd;
      });

      // Group by examId
      const map = new Map<string, GroupedLog>();
      logs.forEach(log => {
        const key = log.examId || `solo-${log.id || log.timestamp}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            examId: log.examId,
            timestamp: log.timestamp,
            models: new Set(),
            area: log.area,
            tokens: 0,
            costUsd: 0,
            requests: 0,
          });
        }
        const g = map.get(key)!;
        g.tokens    += log.inputTokens + log.outputTokens;
        g.costUsd   += log.costUsd;
        g.requests  += 1;
        g.models.add(log._resolvedModel);
        if (log.timestamp > g.timestamp) g.timestamp = log.timestamp;
      });

      const sorted = Array.from(map.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      setDailyStats({ tokens: dTokens, costUsd: dCost, count: dCount });
      setWeeklyStats({ tokens: wTokens, costUsd: wCost, count: wCount });
      setMonthlyStats({ tokens: mTokens, costUsd: mCost, count: mCount });
      setModelBreakdown(breakdown);
      setGroupedLogs(sorted);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load financial data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Carregando dados financeiros…</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Hoje',
      icon: CalendarDays,
      value: formatBrl(dailyStats.costUsd),
      tokens: dailyStats.tokens,
      count: dailyStats.count,
      accent: 'text-brand-600',
      bg: 'bg-brand-50',
      border: 'border-brand-100',
    },
    {
      label: 'Esta Semana',
      icon: Activity,
      value: formatBrl(weeklyStats.costUsd),
      tokens: weeklyStats.tokens,
      count: weeklyStats.count,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Mês Atual',
      icon: TrendingUp,
      value: formatBrl(monthlyStats.costUsd),
      tokens: monthlyStats.tokens,
      count: monthlyStats.count,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-100',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header card */}
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-inner">
              <Coins size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Financeiro IA</h3>
              <p className="text-xs text-ink-500 mt-0.5">
                Custo operacional dos motores de IA · USD→BRL @ {USD_TO_BRL.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-ink-50 hover:bg-ink-100 text-ink-600 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
            title="Atualizar dados"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map(card => (
            <div
              key={card.label}
              className={classNames(
                'p-5 rounded-2xl border flex flex-col gap-3',
                card.bg, card.border
              )}
            >
              <div className={classNames('flex items-center gap-2', card.accent)}>
                <card.icon size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">{card.label}</span>
              </div>
              <p className="text-2xl font-black text-ink-900 tracking-tight">{card.value}</p>
              <div className="flex items-center justify-between border-t border-black/5 pt-3">
                <div>
                  <p className="text-xs font-bold text-ink-700">{formatTokens(card.tokens)}</p>
                  <p className="text-[9px] text-ink-400 uppercase tracking-wider">Tokens</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-ink-700">{card.count}</p>
                  <p className="text-[9px] text-ink-400 uppercase tracking-wider">Req.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Breakdown */}
      {Object.keys(modelBreakdown).length > 0 && (
        <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-500 flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Consumo por Motor</h3>
              <p className="text-xs text-ink-500 mt-0.5">Distribuição do mês atual por modelo de IA</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Object.entries(modelBreakdown).map(([model, stats]) => {
              const info = PRICING[model];
              const badgeCls = MODEL_BADGE[model] || 'bg-ink-50 text-ink-700 border-ink-100';
              return (
                <div
                  key={model}
                  className="p-4 rounded-2xl border border-ink-100 bg-ink-50/50 hover:bg-ink-50 transition-colors"
                >
                  <span className={classNames(
                    'inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border mb-3',
                    badgeCls
                  )}>
                    {info?.label || model}
                  </span>
                  <p className="text-xl font-black text-ink-900">{formatBrl(stats.costUsd)}</p>
                  <p className="text-[10px] text-ink-500 mt-1">{formatTokens(stats.tokens)} tokens</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extrato por Laudo */}
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-500 flex items-center justify-center">
            <History size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Extrato por Laudo</h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Todas as requisições de IA agrupadas por laudo · múltiplos modelos por laudo
            </p>
          </div>
        </div>

        {groupedLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-ink-50 rounded-3xl flex items-center justify-center mx-auto mb-3 text-ink-300 border border-ink-100">
              <Sparkles size={28} />
            </div>
            <p className="text-sm font-bold text-ink-600">Nenhum laudo gerado este mês</p>
            <p className="text-xs text-ink-400 mt-0.5">Os dados aparecerão assim que você usar a IA nos laudos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest">Data / Hora</th>
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest">Motores no Laudo</th>
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest">Área</th>
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest text-center">Req.</th>
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest text-right">Tokens</th>
                  <th className="pb-3 px-2 text-[9px] font-black text-ink-400 uppercase tracking-widest text-right">Custo (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {groupedLogs.map((log, i) => (
                  <tr key={log.key || i} className="hover:bg-ink-50/50 transition-colors group">
                    <td className="py-3 px-2 font-medium text-ink-700 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(log.models).map(model => {
                          const badgeCls = MODEL_BADGE[model] || 'bg-ink-50 text-ink-700 border-ink-100';
                          const info = PRICING[model];
                          return (
                            <span
                              key={model}
                              className={classNames(
                                'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border whitespace-nowrap',
                                badgeCls
                              )}
                            >
                              <Zap size={9} className="inline mr-0.5 -mt-0.5" />
                              {info?.label || model}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-ink-500 whitespace-nowrap">{log.area || '—'}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink-100 text-ink-600 text-[10px] font-black">
                        {log.requests}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-ink-600 font-medium whitespace-nowrap">
                      {formatTokens(log.tokens)}
                    </td>
                    <td className="py-3 px-2 text-right font-black text-ink-900 whitespace-nowrap">
                      {formatBrl(log.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastUpdated && (
          <p className="text-[9px] text-ink-300 text-right mt-4 uppercase tracking-widest">
            Atualizado em {lastUpdated.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </div>
    </div>
  );
}
