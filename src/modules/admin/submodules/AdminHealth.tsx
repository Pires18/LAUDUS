import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { getDailyMetrics, getMetricsSummary, type DailyMetric, type MetricsSummary } from '../../../store/db';
import { logger } from '../../../utils/logger';
import { classNames } from '../../../utils/format';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, Cpu, CreditCard, ShieldCheck, Database } from 'lucide-react';

type Health = 'ok' | 'warn' | 'down' | 'unknown';

function ago(ms?: number): string {
  if (!ms) return 'nunca';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/** Aba Saúde do Sistema — sinais reais de operação (agregação, pagamentos, IA, monitoramento). */
export function AdminHealth() {
  const [loading, setLoading] = useState(true);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<number | undefined>();
  const [financeUpdatedAt, setFinanceUpdatedAt] = useState<number | undefined>();
  const [paidCount, setPaidCount] = useState(0);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sum, finSnap, d] = await Promise.all([
          getMetricsSummary(),
          getDoc(doc(firestore, 'global_config', 'finance_stats')),
          getDailyMetrics(30),
        ]);
        if (!active) return;
        setSummary(sum);
        setSummaryUpdatedAt(sum?.updatedAt);
        if (finSnap.exists()) {
          const f = finSnap.data() as any;
          setFinanceUpdatedAt(f.updatedAt);
          setPaidCount(f.paidCount || 0);
        }
        setDaily(d);
      } catch (err) {
        logger.error('[AdminHealth] Falha ao carregar sinais:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-brand-500" /></div>;
  }

  const sentryOn = !!(import.meta.env.VITE_SENTRY_DSN as string | undefined);
  const reports30 = daily.reduce((a, d) => a + (d.reports || 0), 0);
  const cost30 = daily.reduce((a, d) => a + (d.costUsd || 0), 0);

  // Pipeline de agregação: saudável se o CRON rodou nas últimas ~2h.
  const aggAge = summaryUpdatedAt ? Date.now() - summaryUpdatedAt : Infinity;
  const aggHealth: Health = !summaryUpdatedAt ? 'unknown' : aggAge < 2 * 3600000 ? 'ok' : aggAge < 12 * 3600000 ? 'warn' : 'down';

  const cards: { title: string; icon: any; health: Health; lines: { k: string; v: string }[] }[] = [
    {
      title: 'Pipeline de métricas (CRON)', icon: Database, health: aggHealth,
      lines: [
        { k: 'Última agregação', v: ago(summaryUpdatedAt) },
        { k: 'Assinantes ativos', v: (summary?.activeSubscribers ?? 0).toLocaleString('pt-BR') },
        { k: 'MRR', v: `R$ ${(summary?.mrr ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      ],
    },
    {
      title: 'Pagamentos (webhook)', icon: CreditCard, health: financeUpdatedAt ? 'ok' : 'unknown',
      lines: [
        { k: 'Último evento pago', v: ago(financeUpdatedAt) },
        { k: 'Transações pagas', v: paidCount.toLocaleString('pt-BR') },
      ],
    },
    {
      title: 'Motor de IA (30 dias)', icon: Cpu, health: reports30 > 0 ? 'ok' : 'unknown',
      lines: [
        { k: 'Laudos processados', v: reports30.toLocaleString('pt-BR') },
        { k: 'Custo estimado', v: `US$ ${cost30.toFixed(2)}` },
        { k: 'Modelos', v: 'gemini-3.5-flash / 3.1-pro' },
      ],
    },
    {
      title: 'Monitoramento', icon: ShieldCheck, health: sentryOn ? 'ok' : 'warn',
      lines: [
        { k: 'Sentry (erros)', v: sentryOn ? 'ativo' : 'não configurado' },
      ],
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h3 className="text-xl font-black text-ink-900 flex items-center gap-2"><Activity size={18} className="text-brand-600" /> Saúde do Sistema</h3>
        <p className="text-sm text-ink-500">Sinais reais de operação: agregação de métricas, pagamentos, motor de IA e monitoramento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(c => (
          <div key={c.title} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <c.icon size={16} className="text-ink-500" />
                <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider">{c.title}</h4>
              </div>
              <HealthPill health={c.health} />
            </div>
            <div className="space-y-1.5">
              {c.lines.map(l => (
                <div key={l.k} className="flex items-center justify-between text-xs">
                  <span className="text-ink-400 font-semibold">{l.k}</span>
                  <span className="text-ink-900 font-bold">{l.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {aggHealth === 'down' && (
        <div className="flex items-start gap-2 text-[11px] text-rose-800 bg-rose-50/60 border border-rose-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>A agregação de métricas não roda há mais de 12h. Verifique o cron <code>/api/cron-aggregate-metrics</code> no painel da Vercel e o <code>CRON_SECRET</code>.</span>
        </div>
      )}
    </div>
  );
}

function HealthPill({ health }: { health: Health }) {
  const map: Record<Health, { label: string; cls: string; Icon: any }> = {
    ok: { label: 'Operacional', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
    warn: { label: 'Atenção', cls: 'bg-amber-50 text-amber-700', Icon: AlertTriangle },
    down: { label: 'Falha', cls: 'bg-rose-50 text-rose-700', Icon: XCircle },
    unknown: { label: 'Sem dados', cls: 'bg-ink-100 text-ink-500', Icon: AlertTriangle },
  };
  const { label, cls, Icon } = map[health];
  return (
    <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider', cls)}>
      <Icon size={10} /> {label}
    </span>
  );
}
