import { useState, useEffect } from 'react';
import { Coins, TrendingUp, CalendarDays, Activity, Loader2, Sparkles, BrainCircuit, History } from 'lucide-react';
import { getAiUsageStats, AiUsageLog } from '../../store/db';

const USD_TO_BRL = 5.50;

export function FinancialControl() {
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [weeklyStats, setWeeklyStats] = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ tokens: 0, costUsd: 0, count: 0 });
  const [modelBreakdown, setModelBreakdown] = useState<Record<string, { tokens: number, costUsd: number }>>({});
  const [recentLogs, setRecentLogs] = useState<AiUsageLog[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const dayOfWeek = now.getDay(); // 0 is Sunday
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
        
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const logs = await getAiUsageStats(startOfMonth, endOfDay);
        // Sort logs descending for the extrato
        logs.sort((a, b) => b.timestamp - a.timestamp);
        
        let dTokens = 0, dCost = 0, dCount = 0;
        let wTokens = 0, wCost = 0, wCount = 0;
        let mTokens = 0, mCost = 0, mCount = 0;
        const breakdown: Record<string, { tokens: number, costUsd: number }> = {};

        logs.forEach(log => {
          const totalTokens = log.inputTokens + log.outputTokens;
          
          mTokens += totalTokens;
          mCost += log.costUsd;
          mCount++;

          if (log.timestamp >= startOfWeek) {
            wTokens += totalTokens;
            wCost += log.costUsd;
            wCount++;
          }

          if (log.timestamp >= startOfDay) {
            dTokens += totalTokens;
            dCost += log.costUsd;
            dCount++;
          }

          if (!breakdown[log.model]) {
            breakdown[log.model] = { tokens: 0, costUsd: 0 };
          }
          breakdown[log.model].tokens += totalTokens;
          breakdown[log.model].costUsd += log.costUsd;
        });

        setDailyStats({ tokens: dTokens, costUsd: dCost, count: dCount });
        setWeeklyStats({ tokens: wTokens, costUsd: wCost, count: wCount });
        setMonthlyStats({ tokens: mTokens, costUsd: mCost, count: mCount });
        setModelBreakdown(breakdown);
        setRecentLogs(logs.slice(0, 10)); // Mostrar os últimos 10
      } catch (err) {
        console.error('Failed to load financial data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-ink-100 shadow-sm mt-8">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const formatBrl = (valUsd: number) => `R$ ${(valUsd * USD_TO_BRL).toFixed(4)}`;
  const formatTokens = (val: number) => new Intl.NumberFormat('pt-BR').format(val);
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden animate-fade-in mt-8">
      <div className="p-8 border-b border-ink-100 bg-gradient-to-b from-brand-50/30 to-white">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-inner">
            <Coins size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-ink-900 tracking-tight">Controle Financeiro de IA</h3>
            <p className="text-sm text-ink-500">Acompanhamento de custos operacionais com motores de IA (Valores convertidos para Reais).</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Daily Card */}
          <div className="p-6 rounded-2xl border border-ink-100 bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity size={64} className="text-brand-600" />
            </div>
            <div className="flex items-center gap-2 text-brand-600 mb-4 relative z-10">
              <CalendarDays size={18} />
              <h4 className="text-sm font-bold uppercase tracking-widest">Hoje</h4>
            </div>
            <div className="space-y-1 mb-4 relative z-10">
              <p className="text-3xl font-black text-ink-900">{formatBrl(dailyStats.costUsd)}</p>
              <p className="text-[10px] font-medium text-ink-500 uppercase tracking-wider">Custo Exato</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-ink-50 relative z-10">
              <div>
                <p className="text-xs font-bold text-ink-700">{formatTokens(dailyStats.tokens)}</p>
                <p className="text-[9px] text-ink-400 uppercase tracking-wider">Tokens</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-ink-700">{dailyStats.count}</p>
                <p className="text-[9px] text-ink-400 uppercase tracking-wider">Laudos</p>
              </div>
            </div>
          </div>

          {/* Weekly Card */}
          <div className="p-6 rounded-2xl border border-ink-100 bg-brand-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={64} className="text-brand-600" />
            </div>
            <div className="flex items-center gap-2 text-brand-700 mb-4 relative z-10">
              <Activity size={18} />
              <h4 className="text-sm font-bold uppercase tracking-widest">Esta Semana</h4>
            </div>
            <div className="space-y-1 mb-4 relative z-10">
              <p className="text-3xl font-black text-brand-900">{formatBrl(weeklyStats.costUsd)}</p>
              <p className="text-[10px] font-medium text-brand-500 uppercase tracking-wider">Custo Exato</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-brand-100 relative z-10">
              <div>
                <p className="text-xs font-bold text-brand-800">{formatTokens(weeklyStats.tokens)}</p>
                <p className="text-[9px] text-brand-600 uppercase tracking-wider">Tokens</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-brand-800">{weeklyStats.count}</p>
                <p className="text-[9px] text-brand-600 uppercase tracking-wider">Laudos</p>
              </div>
            </div>
          </div>

          {/* Monthly Card */}
          <div className="p-6 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group text-white">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={64} className="text-white" />
            </div>
            <div className="flex items-center gap-2 text-slate-300 mb-4 relative z-10">
              <TrendingUp size={18} />
              <h4 className="text-sm font-bold uppercase tracking-widest">Mês Atual</h4>
            </div>
            <div className="space-y-1 mb-4 relative z-10">
              <p className="text-3xl font-black text-white">{formatBrl(monthlyStats.costUsd)}</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Custo Exato</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-700 relative z-10">
              <div>
                <p className="text-xs font-bold text-slate-200">{formatTokens(monthlyStats.tokens)}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Tokens Totais</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-200">{monthlyStats.count}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Laudos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Model Breakdown */}
        {Object.keys(modelBreakdown).length > 0 && (
          <div className="mb-8">
            <h4 className="text-xs font-black text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BrainCircuit size={14} className="text-ink-400" />
              Consumo por Motor de IA (Mês Atual)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(modelBreakdown).map(([model, stats]) => (
                <div key={model} className="p-4 rounded-xl bg-ink-50 border border-ink-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{model}</p>
                    <p className="text-[11px] text-ink-500">{formatTokens(stats.tokens)} tokens</p>
                  </div>
                  <p className="text-sm font-black text-ink-700">{formatBrl(stats.costUsd)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extrato Recente */}
        {recentLogs.length > 0 && (
          <div>
            <h4 className="text-xs font-black text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History size={14} className="text-ink-400" />
              Extrato Recente
            </h4>
            <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-ink-50/50 text-ink-500 text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="px-6 py-4">Data/Hora</th>
                      <th className="px-6 py-4">Motor Utilizado</th>
                      <th className="px-6 py-4">Área</th>
                      <th className="px-6 py-4 text-right">Tokens</th>
                      <th className="px-6 py-4 text-right">Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {recentLogs.map((log, i) => (
                      <tr key={log.id || i} className="hover:bg-ink-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-ink-900">{formatDate(log.timestamp)}</td>
                        <td className="px-6 py-4 text-brand-700 font-bold">{log.model}</td>
                        <td className="px-6 py-4 text-ink-600">{log.area}</td>
                        <td className="px-6 py-4 text-right text-ink-600">{formatTokens(log.inputTokens + log.outputTokens)}</td>
                        <td className="px-6 py-4 text-right font-black text-ink-900">{formatBrl(log.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
