import { useEffect, useState } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { getDailyMetrics, getMetricsSummary, type DailyMetric, type MetricsSummary } from '../../../../store/db';
import { logger } from '../../../../utils/logger';
import { classNames } from '../../../../utils/format';
import { Spinner } from './Spinner';
import {
  DollarSign, TrendingUp, TrendingDown, Cpu, Server, RefreshCw, Loader2, Save,
  QrCode, CreditCard, Wallet, AlertTriangle, Gift,
} from 'lucide-react';

type FinanceStats = { totalRevenue?: number; paidCount?: number; pixCount?: number; ccCount?: number; manualCount?: number; otherCount?: number; updatedAt?: number };
type Plan = 'starter' | 'pro' | 'dedicado';

const money = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Central Financeira — consolida TODAS as entradas (receita real de
 * transações + MRR) e TODOS os custos (VMs/GCP + IA), com margem líquida.
 * Fonte única de "sem surpresas": puxa finance_stats, metrics_daily, o resumo
 * do CRON, vm_costs e a contagem de VMs (collection group de settings).
 */
export function FinanceOverviewTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [fin, setFin] = useState<FinanceStats | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [vmCostBrl, setVmCostBrl] = useState(0);
  const [vmCount, setVmCount] = useState(0);
  const [compCount, setCompCount] = useState(0);
  const [usdToBrl, setUsdToBrl] = useState(5.40);
  const [aggWarn, setAggWarn] = useState<string | null>(null);

  const load = async () => {
    setAggWarn(null);
    try {
      const [finSnap, sum, d, vmSnap, subsSnap] = await Promise.all([
        getDoc(doc(firestore, 'global_config', 'finance_stats')),
        getMetricsSummary(),
        getDailyMetrics(30),
        getDoc(doc(firestore, 'global_config', 'vm_costs')),
        getDocs(collection(firestore, 'subscriptions')),
      ]);
      setFin(finSnap.exists() ? (finSnap.data() as FinanceStats) : null);
      setSummary(sum);
      setDaily(d);
      const vc: any = vmSnap.exists() ? vmSnap.data() : {};
      const costByPlan: Record<Plan, number> = { starter: 70, pro: 70, dedicado: 140, ...(vc.costByPlan || {}) };
      const storagePerGbMonth = Number(vc.storagePerGbMonth) || 0.55;
      if (typeof vc.usdToBrl === 'number' && vc.usdToBrl > 0) setUsdToBrl(vc.usdToBrl);

      // Assinaturas de cortesia/vitalício (não geram receita) — visibilidade.
      setCompCount(subsSnap.docs.filter(s => { const x: any = s.data(); return x.comp || x.lifetime; }).length);

      // Custo de VMs: agrega instâncias PACS ativas (collection group settings).
      try {
        const settingsSnap = await getDocs(collectionGroup(firestore, 'settings'));
        let cost = 0, count = 0;
        settingsSnap.forEach((s: any) => {
          const inst = (s.data() || {}).pacsInstance;
          if (!inst || inst.status !== 'ready') return;
          count += 1;
          const plan = (inst.plan as Plan) || 'pro';
          cost += (costByPlan[plan] || 0) + ((inst.diskGb || 0) * storagePerGbMonth);
        });
        setVmCount(count);
        setVmCostBrl(cost);
      } catch (err: any) {
        setAggWarn(err?.code === 'permission-denied'
          ? 'Custo de VMs indisponível: publique as regras do Firestore (firebase deploy --only firestore:rules).'
          : 'Não foi possível agregar o custo das VMs.');
      }
    } catch (err) {
      logger.error('[FinanceOverview] falha:', err);
    }
  };

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, []);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'vm_costs'), { usdToBrl, updatedAt: Date.now() }, { merge: true });
    } catch (err) { logger.error('[FinanceOverview] salvar cambio:', err); }
    finally { setSavingRate(false); }
  };

  if (loading) return <Spinner />;

  // ── Entradas ──
  const mrr = summary?.mrr ?? 0;
  const totalRevenue = fin?.totalRevenue ?? 0;
  const revenue30 = daily.reduce((a, d) => a + (d.revenue || 0), 0);

  // ── Custos mensais estimados (BRL) ──
  const iaCostUsd30 = daily.reduce((a, d) => a + (d.costUsd || 0), 0);
  const iaCostBrl = iaCostUsd30 * usdToBrl; // ~custo de IA do mês
  const totalCost = vmCostBrl + iaCostBrl;
  const netMargin = mrr - totalCost;
  const marginPct = mrr > 0 ? Math.round((netMargin / mrr) * 100) : 0;

  const kpis = [
    { label: 'Receita recorrente (MRR)', value: money(mrr),           sub: 'assinaturas ativas', icon: TrendingUp,  grad: 'from-emerald-500 to-teal-600' },
    { label: 'Custo total / mês',        value: money(totalCost),     sub: 'VMs + IA',           icon: TrendingDown, grad: 'from-rose-500 to-pink-600' },
    { label: 'Margem líquida / mês',     value: money(netMargin),     sub: `${marginPct}% do MRR`, icon: Wallet,     grad: netMargin >= 0 ? 'from-brand-500 to-indigo-600' : 'from-rose-500 to-rose-700' },
    { label: 'Receita acumulada',        value: money(totalRevenue),  sub: `${fin?.paidCount ?? 0} pagamentos`, icon: DollarSign, grad: 'from-violet-500 to-purple-600' },
  ];

  const entradas = [
    { label: 'PIX',            value: fin?.pixCount ?? 0,    icon: QrCode,      color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Cartão',         value: fin?.ccCount ?? 0,     icon: CreditCard,  color: 'text-blue-600 bg-blue-50' },
    { label: 'Manual (admin)', value: fin?.manualCount ?? 0, icon: Wallet,      color: 'text-ink-600 bg-ink-50' },
    { label: 'Cortesia/Vital.',value: compCount,             icon: Gift,        color: 'text-violet-600 bg-violet-50' },
  ];

  const custos = [
    { label: 'VMs PACS (GCP)', value: money(vmCostBrl), sub: `${vmCount} VM(s) ativas`, icon: Server, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'IA (LAUD.IA)',   value: money(iaCostBrl), sub: `US$ ${iaCostUsd30.toFixed(2)} · 30d`, icon: Cpu, color: 'text-violet-700 bg-violet-50' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" /> Central Financeira
          </h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">
            Todas as entradas e custos do sistema em um só lugar — receita, VMs, IA e margem líquida.
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="h-9 px-3 rounded-xl border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 flex items-center gap-1.5 disabled:opacity-50 transition-all">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(m => (
          <div key={m.label} className={classNames('rounded-2xl p-4 text-white shadow-md bg-gradient-to-br', m.grad)}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/80 truncate">{m.label}</div>
                <div className="text-2xl font-black mt-1 tracking-tight truncate">{m.value}</div>
                <div className="text-[10px] font-bold text-white/70 mt-0.5">{m.sub}</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><m.icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      {aggWarn && (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>{aggWarn}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Entradas */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4 flex items-center gap-1.5"><TrendingUp size={13} className="text-emerald-600" /> Entradas</h4>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs font-bold text-ink-500">Receita (30 dias)</span>
            <span className="text-lg font-black text-emerald-700">{money(revenue30)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {entradas.map(e => (
              <div key={e.label} className="flex items-center gap-2 rounded-xl border border-ink-100 p-2.5">
                <div className={classNames('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', e.color)}><e.icon size={13} /></div>
                <div className="min-w-0">
                  <div className="text-[9px] font-black text-ink-400 uppercase tracking-wider truncate">{e.label}</div>
                  <div className="text-sm font-black text-ink-950">{e.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custos */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4 flex items-center gap-1.5"><TrendingDown size={13} className="text-rose-600" /> Custos mensais estimados</h4>
          <div className="space-y-2.5">
            {custos.map(c => (
              <div key={c.label} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.color)}><c.icon size={15} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-ink-900">{c.label}</div>
                  <div className="text-[10px] text-ink-400 font-medium">{c.sub}</div>
                </div>
                <div className="text-sm font-black text-rose-600">{c.value}</div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-ink-100">
              <span className="text-xs font-black text-ink-700">Total de custos</span>
              <span className="text-base font-black text-rose-700">{money(totalCost)}</span>
            </div>
          </div>

          {/* Câmbio USD→BRL (converte custo de IA) */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-50">
            <span className="text-[10px] font-bold text-ink-500">Câmbio US$ → R$</span>
            <input type="number" step="0.01" min={0} value={usdToBrl}
              onChange={e => setUsdToBrl(parseFloat(e.target.value) || 0)}
              className="input h-8 w-24 text-xs font-bold" />
            <button onClick={saveRate} disabled={savingRate}
              className="h-8 px-3 rounded-lg bg-ink-900 hover:bg-ink-800 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50 transition-all">
              {savingRate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Salvar
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-400 leading-relaxed">
        MRR e receita vêm do agregado do CRON e das transações pagas. Custos de VM usam <strong>Financeiro → VMs/Infra</strong> (custo por plano + disco); custo de IA converte o gasto real (US$) dos últimos 30 dias pelo câmbio acima. Assinaturas de cortesia/vitalício não entram na receita.
      </p>
    </div>
  );
}
