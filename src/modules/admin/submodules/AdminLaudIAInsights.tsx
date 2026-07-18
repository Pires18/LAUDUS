import { useEffect, useState } from 'react';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { logger } from '../../../utils/logger';
import { classNames } from '../../../utils/format';
import { Sparkles, Loader2, RefreshCw, AlertTriangle, Cpu, FileText } from 'lucide-react';

type AreaAgg = { area: string; total: number; lite: number; pro: number; costUsd: number };

/**
 * Painel admin de insights do LAUD.IA: uso e custo por área clínica nos
 * últimos 30 dias, direto da contagem real (collection group de ai_usage).
 * Renderizado acima da interface do LAUD.IA no módulo admin.
 */
export function AdminLaudIAInsights() {
  const [rows, setRows] = useState<AreaAgg[]>([]);
  const [totals, setTotals] = useState({ total: 0, lite: 0, pro: 0, costUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const startMs = Date.now() - 30 * 86400000;
      const snap = await getDocs(collectionGroup(firestore, 'ai_usage'));
      const byArea: Record<string, AreaAgg> = {};
      const t = { total: 0, lite: 0, pro: 0, costUsd: 0 };
      snap.forEach((d: any) => {
        const x = d.data() || {};
        if (typeof x.timestamp === 'number' && x.timestamp < startMs) return;
        const area = (x.area && String(x.area).trim()) || 'sem-área';
        const isPro = /pro/i.test(String(x.model || ''));
        const cost = Number(x.costUsd) || 0;
        const a = byArea[area] || (byArea[area] = { area, total: 0, lite: 0, pro: 0, costUsd: 0 });
        a.total += 1; if (isPro) a.pro += 1; else a.lite += 1; a.costUsd += cost;
        t.total += 1; if (isPro) t.pro += 1; else t.lite += 1; t.costUsd += cost;
      });
      setRows(Object.values(byArea).sort((a, b) => b.total - a.total));
      setTotals(t);
    } catch (err: any) {
      logger.error('[AdminLaudIAInsights] falha:', err);
      setError(err?.code === 'permission-denied'
        ? 'Publique as regras do Firestore para ver o uso por área (firebase deploy --only firestore:rules).'
        : (err?.message || 'Falha ao carregar o uso do LAUD.IA.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maxTotal = Math.max(1, ...rows.map(r => r.total));

  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={16} className="text-brand-600" /> LAUD.IA — uso &amp; custo por área (30d)
        </h3>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 disabled:opacity-50 transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ink-400 py-6"><Loader2 size={14} className="animate-spin" /> Carregando uso do LAUD.IA…</div>
      ) : error ? (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-ink-400">
          <FileText size={26} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs font-semibold">Sem laudos gerados nos últimos 30 dias.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Laudos (30d)', value: totals.total.toLocaleString('pt-BR'), icon: FileText, color: 'text-brand-600 bg-brand-50' },
              { label: 'Lite', value: totals.lite.toLocaleString('pt-BR'), icon: Sparkles, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'Pro', value: totals.pro.toLocaleString('pt-BR'), icon: Sparkles, color: 'text-violet-600 bg-violet-50' },
              { label: 'Custo estimado', value: `US$ ${totals.costUsd.toFixed(2)}`, icon: Cpu, color: 'text-emerald-600 bg-emerald-50' },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-ink-100 p-3">
                <div className={classNames('w-7 h-7 rounded-lg flex items-center justify-center mb-1.5', m.color)}><m.icon size={13} /></div>
                <div className="text-[9px] font-black text-ink-400 uppercase tracking-wider">{m.label}</div>
                <div className="text-base font-black text-ink-950">{m.value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {rows.map(r => (
              <div key={r.area}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-ink-700 capitalize">{r.area.replace(/-/g, ' ')}</span>
                  <span className="text-ink-500 tabular-nums">
                    <strong className="text-ink-900">{r.total}</strong> laudos · {r.lite} Lite · {r.pro} Pro · <span className="text-emerald-700 font-bold">US$ {r.costUsd.toFixed(2)}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
