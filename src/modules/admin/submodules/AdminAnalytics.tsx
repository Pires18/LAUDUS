import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { getDailyMetrics, getMetricsSummary, type DailyMetric, type MetricsSummary } from '../../../store/db';
import { logger } from '../../../utils/logger';
import { classNames } from '../../../utils/format';
import { TrendingUp, FileText, Users, Cpu, DollarSign, Loader2, Repeat } from 'lucide-react';

type FinanceStats = { totalRevenue?: number; paidCount?: number; pixCount?: number; ccCount?: number; manualCount?: number };

/** Dashboard executivo: séries reais de metrics_daily + finance_stats + resumo MRR. */
export function AdminAnalytics() {
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [finance, setFinance] = useState<FinanceStats | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [d, fSnap, sum] = await Promise.all([
          getDailyMetrics(30),
          getDoc(doc(firestore, 'global_config', 'finance_stats')),
          getMetricsSummary(),
        ]);
        if (!active) return;
        setDaily(d);
        setFinance(fSnap.exists() ? (fSnap.data() as FinanceStats) : null);
        setSummary(sum);
      } catch (err) {
        logger.error('[AdminAnalytics] Falha ao carregar métricas:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-brand-500" /></div>
    );
  }

  const reports30 = daily.reduce((a, d) => a + (d.reports || 0), 0);
  const cost30 = daily.reduce((a, d) => a + (d.costUsd || 0), 0);
  const revenue30 = daily.reduce((a, d) => a + (d.revenue || 0), 0);
  const revenue = finance?.totalRevenue ?? 0;
  const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpis = [
    { label: 'MRR', value: brl(summary?.mrr ?? 0), icon: Repeat, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'ARR', value: brl(summary?.arr ?? 0), icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Assinantes ativos', value: (summary?.activeSubscribers ?? 0).toLocaleString('pt-BR'), icon: Users, tone: 'text-blue-600 bg-blue-50' },
    { label: 'Trials', value: (summary?.trials ?? 0).toLocaleString('pt-BR'), icon: Users, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Faturamento acumulado', value: brl(revenue), icon: DollarSign, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Receita (30d)', value: brl(revenue30), icon: DollarSign, tone: 'text-teal-600 bg-teal-50' },
    { label: 'Laudos (30 dias)', value: reports30.toLocaleString('pt-BR'), icon: FileText, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Custo de IA (30d)', value: `US$ ${cost30.toFixed(2)}`, icon: Cpu, tone: 'text-violet-600 bg-violet-50' },
  ];

  const hasSeries = daily.length > 0;
  const hasRevenue = daily.some(d => (d.revenue || 0) > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-brand-600" />
        <h4 className="text-sm font-black text-ink-900 uppercase tracking-widest">Analytics (dados reais)</h4>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-ink-100 shadow-sm">
            <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center mb-3', k.tone)}>
              <k.icon size={17} />
            </div>
            <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">{k.label}</p>
            <p className="text-2xl font-black text-ink-900 mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      {!hasSeries ? (
        <div className="bg-white rounded-2xl border border-ink-100 p-8 text-center">
          <FileText size={30} className="mx-auto mb-2 opacity-30 text-ink-400" />
          <p className="text-sm font-bold text-ink-700">Sem métricas diárias ainda</p>
          <p className="text-xs text-ink-400 mt-1 max-w-md mx-auto leading-relaxed">
            A coleção <code>metrics_daily</code> é preenchida de hora em hora pelo CRON de agregação. Assim que houver uso de IA, os gráficos aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Laudos por dia" subtitle="Lite vs Pro">
            <StackedBars data={daily} />
            <Legend items={[{ label: 'Lite', color: '#6366f1' }, { label: 'Pro', color: '#a855f7' }]} />
          </ChartCard>
          <ChartCard title="Usuários ativos por dia">
            <AreaLine data={daily.map(d => ({ date: d.date, value: d.activeUsers || 0 }))} color="#10b981" />
          </ChartCard>
          {hasRevenue && (
            <ChartCard title="Receita por dia" subtitle="Transações pagas (R$)">
              <AreaLine data={daily.map(d => ({ date: d.date, value: d.revenue || 0 }))} color="#0ea5e9" money />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
      <div className="mb-3">
        <h5 className="text-xs font-black text-ink-800 uppercase tracking-wider">{title}</h5>
        {subtitle && <p className="text-[10px] text-ink-400 font-bold">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-4 mt-3">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />
          <span className="text-[10px] font-bold text-ink-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

const CHART_W = 520;
const CHART_H = 150;
const PAD = 4;

/** Barras empilhadas (lite embaixo, pro em cima) — SVG, sem dependências. */
function StackedBars({ data }: { data: DailyMetric[] }) {
  const max = Math.max(1, ...data.map(d => (d.reportsLite || 0) + (d.reportsPro || 0)));
  const n = data.length;
  const bw = (CHART_W - PAD * 2) / n;
  const barW = Math.max(2, bw * 0.7);
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const lite = d.reportsLite || 0;
        const pro = d.reportsPro || 0;
        const x = PAD + i * bw + (bw - barW) / 2;
        const hLite = (lite / max) * (CHART_H - PAD * 2);
        const hPro = (pro / max) * (CHART_H - PAD * 2);
        const yLite = CHART_H - PAD - hLite;
        const yPro = yLite - hPro;
        return (
          <g key={d.date}>
            <rect x={x} y={yLite} width={barW} height={hLite} fill="#6366f1" rx={1}>
              <title>{`${d.date}: ${lite} Lite`}</title>
            </rect>
            <rect x={x} y={yPro} width={barW} height={hPro} fill="#a855f7" rx={1}>
              <title>{`${d.date}: ${pro} Pro`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

/** Gráfico de área/linha simples — SVG. */
function AreaLine({ data, color, money }: { data: { date: string; value: number }[]; color: string; money?: boolean }) {
  const fmt = (v: number) => (money ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${v}`);
  const max = Math.max(1, ...data.map(d => d.value));
  const n = data.length;
  const stepX = n > 1 ? (CHART_W - PAD * 2) / (n - 1) : 0;
  const pts = data.map((d, i) => {
    const x = PAD + i * stepX;
    const y = CHART_H - PAD - (d.value / max) * (CHART_H - PAD * 2);
    return { x, y, d };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${CHART_H - PAD} L${pts[0].x.toFixed(1)},${CHART_H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.d.date} cx={p.x} cy={p.y} r={2} fill={color}>
          <title>{`${p.d.date}: ${fmt(p.d.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
