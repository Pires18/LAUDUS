import { useEffect, useState } from 'react';
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, query, orderBy, limit, where,
} from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import {
  getDailyMetrics, getMetricsSummary, getAiUsageByUser,
  type DailyMetric, type MetricsSummary,
} from '../../../../store/db';
import { intervalMultiplier } from '../../../../../api/_pricing';
import { logger } from '../../../../utils/logger';
import { classNames, parseNonNegativeNumber } from '../../../../utils/format';
import { Spinner } from './Spinner';
import {
  DollarSign, TrendingUp, TrendingDown, Cpu, Server, RefreshCw, Loader2, Save,
  QrCode, CreditCard, Wallet, AlertTriangle, Gift, Calendar, Clock,
  BarChart3, CheckCircle2, Users,
} from 'lucide-react';

type FinanceStats = {
  totalRevenue?: number; paidCount?: number; pixCount?: number;
  ccCount?: number; manualCount?: number; otherCount?: number; updatedAt?: number;
};
type Plan = 'starter' | 'pro' | 'dedicado';
type UpcomingInvoice = { userId: string; email: string; daysLeft: number; amount: number; planName: string };

const money = (n: number) =>
  `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INTERVAL_LABELS: Record<string, string> = { month: 'Mensal', semester: 'Semestral', year: 'Anual' };

export function FinanceOverviewTab() {
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [savingRate, setSavingRate]         = useState(false);
  const [fin, setFin]                       = useState<FinanceStats | null>(null);
  const [summary, setSummary]               = useState<MetricsSummary | null>(null);
  const [daily, setDaily]                   = useState<DailyMetric[]>([]);
  const [vmCostBrl, setVmCostBrl]           = useState(0);
  const [vmCount, setVmCount]               = useState(0);
  const [compCount, setCompCount]           = useState(0);
  const [plansBreakdown, setPlansBreakdown] = useState<Record<string, {
    planName: string;
    activeCount: number;
    monthlyRevenue: number;
    monthlyIaCost: number;
    monthlyVmCost: number;
    netProfit: number;
  }>>({});
  const [usdToBrl, setUsdToBrl]             = useState(5.40);
  const [aggWarn, setAggWarn]               = useState<string | null>(null);
  const [lossyUsers, setLossyUsers]         = useState<{ userId: string; email: string; revenueBrl: number; costBrl: number }[]>([]);
  const [mrrByInterval, setMrrByInterval]   = useState<Record<string, number>>({});
  const [upcomingInvoices, setUpcomingInvoices] = useState<UpcomingInvoice[]>([]);
  const [subsCount, setSubsCount]           = useState({ active: 0, trialing: 0, pastDue: 0, canceled: 0 });

  const load = async () => {
    setAggWarn(null);
    try {
      const [finSnap, sum, d, vmSnap, subsSnap, motorSnap] = await Promise.all([
        getDoc(doc(firestore, 'global_config', 'finance_stats')),
        getMetricsSummary(),
        getDailyMetrics(30),
        getDoc(doc(firestore, 'global_config', 'vm_costs')),
        getDocs(collection(firestore, 'subscriptions')),
        getDoc(doc(firestore, 'global_config', 'motor_config')),
      ]);

      setFin(finSnap.exists() ? (finSnap.data() as FinanceStats) : null);
      setSummary(sum);
      setDaily(d);

      const vc: any = vmSnap.exists() ? vmSnap.data() : {};
      const mc: any = motorSnap.exists() ? motorSnap.data() : {};
      const costByPlan: Record<Plan, number> = { starter: 70, pro: 70, dedicado: 140, ...(vc.costByPlan || {}) };
      const storagePerGbMonth = Number(vc.storagePerGbMonth) || 0.55;
      
      // A taxa de IA (aiConversionRateBRL) tem prioridade total; senão cai para usdToBrl.
      const resolvedRate = mc.aiConversionRateBRL || vc.usdToBrl || 5.40;
      setUsdToBrl(resolvedRate);
      const rate = resolvedRate;

      setCompCount(subsSnap.docs.filter(s => { const x: any = s.data(); return x.comp || x.lifetime; }).length);

      // ── Status counters ──
      let activeN = 0, trialN = 0, pastDueN = 0, canceledN = 0;
      subsSnap.docs.forEach(s => {
        const d: any = s.data() || {};
        if (d.status === 'active') activeN++;
        else if (d.status === 'trialing') trialN++;
        else if (d.status === 'past_due') pastDueN++;
        else if (d.status === 'canceled') canceledN++;
      });
      setSubsCount({ active: activeN, trialing: trialN, pastDue: pastDueN, canceled: canceledN });

      // ── MRR breakdown por intervalo ──
      const mrrByIv: Record<string, number> = { month: 0, semester: 0, year: 0 };
      const now = Date.now();
      const SEVEN_DAYS = 7 * 86400000;

      const upcoming: UpcomingInvoice[] = [];

      subsSnap.docs.forEach(s => {
        const d: any = s.data() || {};
        if (d.status !== 'active' && d.status !== 'trialing') return;
        const iv = d.interval || 'month';
        const monthlyRev = (d.price || 0) / intervalMultiplier(iv);
        if (mrrByIv[iv] !== undefined) mrrByIv[iv] += monthlyRev;

        // Detecta cobranças próximas (billingMode: invoice, vence em ≤ 7 dias)
        if (d.billingMode === 'invoice' && d.currentPeriodEnd && d.status === 'active') {
          const msLeft = d.currentPeriodEnd - now;
          if (msLeft > 0 && msLeft <= SEVEN_DAYS) {
            upcoming.push({
              userId: d.userId, email: d.userEmail || d.userId,
              daysLeft: Math.ceil(msLeft / 86400000),
              amount: d.lastInvoiceAmount || d.price || 0,
              planName: d.plan || 'Plano',
            });
          }
        }
      });

      setMrrByInterval(mrrByIv);
      setUpcomingInvoices(upcoming.sort((a, b) => a.daysLeft - b.daysLeft));

      // ── Alerta de prejuízo + custo de VMs ──
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const [usageResult, settingsResult] = await Promise.allSettled([
        getAiUsageByUser(monthStart, Date.now()),
        getDocs(collectionGroup(firestore, 'settings')),
      ]);

      let usageByUid: Record<string, any> = {};
      if (usageResult.status === 'fulfilled') {
        usageByUid = usageResult.value;
        const lossy: typeof lossyUsers = [];
        subsSnap.docs.forEach(s => {
          const x: any = s.data();
          if (x.comp || x.lifetime || x.status !== 'active') return;
          const costUsd = usageByUid[x.userId]?.costUsd || 0;
          if (costUsd <= 0) return;
          const costBrl = costUsd * rate;
          const monthlyRevenue = (x.price || 0) / intervalMultiplier(x.interval);
          if (costBrl > monthlyRevenue) {
            lossy.push({ userId: x.userId, email: x.userEmail || x.userId, revenueBrl: monthlyRevenue, costBrl });
          }
        });
        setLossyUsers(lossy.sort((a, b) => (b.costBrl - b.revenueBrl) - (a.costBrl - a.revenueBrl)));
      } else {
        logger.error('[FinanceOverview] falha prejuízo:', (usageResult as any).reason);
      }

      const pacsByUid: Record<string, { plan: string; cost: number }> = {};
      if (settingsResult.status === 'fulfilled') {
        let cost = 0, count = 0;
        settingsResult.value.forEach((s: any) => {
          const inst = (s.data() || {}).pacsInstance;
          if (!inst || !inst.status || inst.status === 'none') return;
          const uid = s.ref.parent.parent?.id || '';
          const plan = (inst.plan as Plan) || 'pro';
          const pacsCost = (costByPlan[plan] || 0) + ((inst.diskGb || 0) * storagePerGbMonth);
          
          if (inst.status === 'ready') {
            count += 1;
            cost += pacsCost;
            pacsByUid[uid] = { plan, cost: pacsCost };
          }
        });
        setVmCount(count);
        setVmCostBrl(cost);
      } else {
        const err: any = (settingsResult as any).reason;
        setAggWarn(err?.code === 'permission-denied'
          ? 'Custo de VMs indisponível: publique as regras do Firestore (firebase deploy --only firestore:rules).'
          : 'Não foi possível agregar o custo das VMs.');
      }

      // ── Análise de Lucratividade por Plano de Acesso ──
      const breakdowns: Record<string, any> = {};
      subsSnap.docs.forEach(s => {
        const d: any = s.data() || {};
        if (d.status !== 'active') return;
        const rawPlan = d.plan || 'Base';
        const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
        const iv = d.interval || 'month';
        const monthlyRev = (d.price || 0) / intervalMultiplier(iv);

        // Custo de IA real do usuário no mês
        const iaCostUsd = usageByUid[d.userId]?.costUsd || 0;
        const userIaCostBrl = iaCostUsd * rate;

        // Custo PACS real do usuário
        const userVmCostBrl = pacsByUid[d.userId]?.cost || 0;

        if (!breakdowns[planName]) {
          breakdowns[planName] = {
            planName,
            activeCount: 0,
            monthlyRevenue: 0,
            monthlyIaCost: 0,
            monthlyVmCost: 0,
            netProfit: 0,
          };
        }

        const b = breakdowns[planName];
        b.activeCount += 1;
        b.monthlyRevenue += monthlyRev;
        b.monthlyIaCost += userIaCostBrl;
        b.monthlyVmCost += userVmCostBrl;
        b.netProfit = b.monthlyRevenue - b.monthlyIaCost - b.monthlyVmCost;
      });
      setPlansBreakdown(breakdowns);

    } catch (err) {
      logger.error('[FinanceOverview] falha geral:', err);
    }
  };

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, []);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await Promise.all([
        setDoc(doc(firestore, 'global_config', 'vm_costs'), { usdToBrl, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(firestore, 'global_config', 'motor_config'), { aiConversionRateBRL: usdToBrl, updatedAt: Date.now() }, { merge: true }),
      ]);
    } catch (err) { logger.error('[FinanceOverview] salvar câmbio:', err); }
    finally { setSavingRate(false); }
  };

  if (loading) return <Spinner />;

  const mrr          = summary?.mrr ?? 0;
  const totalRevenue = fin?.totalRevenue ?? 0;
  const revenue30    = daily.reduce((a, d) => a + (d.revenue || 0), 0);
  const iaCostUsd30  = daily.reduce((a, d) => a + (d.costUsd || 0), 0);
  const iaCostBrl    = iaCostUsd30 * usdToBrl;
  const totalCost    = vmCostBrl + iaCostBrl;
  const netMargin    = mrr - totalCost;
  const marginPct    = mrr > 0 ? Math.round((netMargin / mrr) * 100) : 0;

  const mrrDivergencePct = mrr > 0 ? Math.round(((mrr - revenue30) / mrr) * 100) : 0;
  const showMrrWarning   = mrr > 0 && Math.abs(mrrDivergencePct) >= 20;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" /> Central Financeira
          </h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">
            Receita, custos, margens e assinaturas — visão consolidada em tempo real.
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="h-9 px-3 rounded-xl border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 flex items-center gap-1.5 disabled:opacity-50 transition-all">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* ── KPIs principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'MRR Teórico',        value: money(mrr),          sub: 'ativas + trials c/ preço', grad: 'from-emerald-500 to-teal-600',  icon: TrendingUp  },
          { label: 'Custo Total / Mês',  value: money(totalCost),    sub: 'VMs + IA',            grad: 'from-rose-500 to-pink-600',    icon: TrendingDown },
          { label: 'Margem Líquida',     value: money(netMargin),    sub: `${marginPct}% do MRR`, grad: netMargin >= 0 ? 'from-brand-500 to-indigo-600' : 'from-rose-600 to-rose-700', icon: BarChart3 },
          { label: 'Receita Acumulada',  value: money(totalRevenue), sub: `${fin?.paidCount ?? 0} pagamentos`, grad: 'from-violet-500 to-purple-600', icon: DollarSign },
        ].map(m => (
          <div key={m.label} className={classNames('rounded-2xl p-4 text-white shadow-md bg-gradient-to-br', m.grad)}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-wider text-white/80 truncate">{m.label}</div>
                <div className="text-xl font-black mt-1 tracking-tight">{m.value}</div>
                <div className="text-[10px] font-bold text-white/70 mt-0.5">{m.sub}</div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><m.icon size={16} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alertas ── */}
      {aggWarn && (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>{aggWarn}</span>
        </div>
      )}
      {showMrrWarning && (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            <strong>MRR teórico ({money(mrr)}) diverge {Math.abs(mrrDivergencePct)}% da receita real dos últimos 30 dias ({money(revenue30)})</strong>
            {' '}— possível assinatura ativa sem pagamento correspondente (falha de webhook ou estorno não refletido).
          </span>
        </div>
      )}

      {/* ── Grid: status assinaturas + breakdown por intervalo + entradas + custos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Status das assinaturas */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Users size={13} className="text-indigo-600" /> Status das Assinaturas
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ativas',     value: subsCount.active,   cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { label: 'Trial',      value: subsCount.trialing,  cls: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Vencidas',   value: subsCount.pastDue,   cls: 'text-amber-600 bg-amber-50 border-amber-100' },
              { label: 'Canceladas', value: subsCount.canceled,  cls: 'text-rose-600 bg-rose-50 border-rose-100' },
            ].map(s => (
              <div key={s.label} className={classNames('rounded-xl border p-3 flex items-center justify-between', s.cls)}>
                <span className="text-[10px] font-black uppercase tracking-wider">{s.label}</span>
                <span className="text-xl font-black">{s.value}</span>
              </div>
            ))}
          </div>

          {/* MRR por intervalo */}
          <div className="mt-4 pt-3 border-t border-ink-50 space-y-2">
            <div className="text-[10px] font-black text-ink-500 uppercase tracking-wider mb-2">Receita por intervalo</div>
            {(['month', 'semester', 'year'] as const).map(iv => {
              const val = mrrByInterval[iv] || 0;
              const pct = mrr > 0 ? Math.round((val / mrr) * 100) : 0;
              return (
                <div key={iv}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-ink-700">{INTERVAL_LABELS[iv]}</span>
                    <span className="font-mono font-black text-ink-900">{money(val)}<span className="text-[9px] text-ink-400 ml-1">{pct}%</span></span>
                  </div>
                  <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Entradas e Custos */}
        <div className="space-y-4">
          {/* Entradas por método */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-600" /> Entradas (30 dias)
            </h4>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-xs text-ink-500 font-bold">Receita real coletada</span>
              <span className="text-lg font-black text-emerald-700">{money(revenue30)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'PIX',            value: fin?.pixCount ?? 0,    icon: QrCode,     color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Cartão',         value: fin?.ccCount ?? 0,     icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
                { label: 'Manual (Admin)', value: fin?.manualCount ?? 0, icon: Wallet,     color: 'text-ink-600 bg-ink-100' },
                { label: 'Cortesia/Vital.',value: compCount,             icon: Gift,       color: 'text-violet-600 bg-violet-50' },
              ].map(e => (
                <div key={e.label} className="flex items-center gap-2 rounded-xl border border-ink-100 p-2.5">
                  <div className={classNames('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', e.color)}>
                    <e.icon size={13} />
                  </div>
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
            <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <TrendingDown size={13} className="text-rose-600" /> Custos mensais estimados
            </h4>
            <div className="space-y-2.5">
              {[
                { label: 'VMs PACS (GCP)', value: money(vmCostBrl), sub: `${vmCount} VM(s)`, icon: Server, color: 'text-emerald-700 bg-emerald-50' },
                { label: 'IA (LAUD.IA)',   value: money(iaCostBrl), sub: `US$ ${iaCostUsd30.toFixed(2)} · 30d`, icon: Cpu, color: 'text-violet-700 bg-violet-50' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                  <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.color)}>
                    <c.icon size={15} />
                  </div>
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
            {/* Câmbio */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-50">
              <span className="text-[10px] font-bold text-ink-500">Câmbio US$→R$</span>
              <input type="number" step="0.01" min={0} value={usdToBrl}
                onChange={e => setUsdToBrl(parseNonNegativeNumber(e.target.value))}
                className="input h-8 w-20 text-xs font-bold" />
              <button onClick={saveRate} disabled={savingRate}
                className="h-8 px-3 rounded-lg bg-ink-900 hover:bg-ink-800 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50 transition-all">
                {savingRate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Próximas cobranças (billingMode: invoice) ── */}
      {upcomingInvoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Clock size={13} /> Cobranças próximas — modo fatura ({upcomingInvoices.length})
          </h4>
          <p className="text-[10px] text-ink-500 mb-3">
            Estas assinaturas mensais estão no modo invoice (CRON cria faturas).
            Vencem em até 7 dias — o CRON de 03:45 UTC criará as faturas automaticamente.
          </p>
          <div className="overflow-x-auto rounded-xl border border-amber-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-50/80 border-b border-amber-100 text-[9px] font-black uppercase text-amber-600 tracking-wider">
                  <th className="px-4 py-2.5 text-left">Usuário</th>
                  <th className="px-4 py-2.5 text-left">Plano</th>
                  <th className="px-4 py-2.5 text-center">Vence em</th>
                  <th className="px-4 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {upcomingInvoices.map(u => (
                  <tr key={u.userId} className="hover:bg-amber-50/40">
                    <td className="px-4 py-2.5 font-medium text-ink-800 max-w-[220px] truncate">{u.email}</td>
                    <td className="px-4 py-2.5 text-ink-600">{u.planName}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={classNames(
                        'px-1.5 py-0.5 rounded text-[8px] font-black border',
                        u.daysLeft <= 1 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        u.daysLeft <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                         'bg-blue-50 text-blue-700 border-blue-100'
                      )}>
                        {u.daysLeft === 0 ? 'Hoje' : `${u.daysLeft}d`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-black text-ink-900">{money(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lucratividade por Plano de Acesso ── */}
      {Object.keys(plansBreakdown).length > 0 && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <BarChart3 size={13} className="text-brand-600" /> Lucratividade Mensal Estimada por Plano
          </h4>
          <p className="text-[10px] text-ink-500 mb-3">
            Detalhamento de receita teórica mensal contra os custos reais de IA (Gemini) e VMs de PACS agregados dos usuários ativos de cada plano.
          </p>
          <div className="overflow-x-auto rounded-xl border border-ink-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-ink-50/80 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                  <th className="px-4 py-3 text-left">Plano</th>
                  <th className="px-4 py-3 text-center">Ativos</th>
                  <th className="px-4 py-3 text-right">Receita Mensal</th>
                  <th className="px-4 py-3 text-right">Custo IA (BRL)</th>
                  <th className="px-4 py-3 text-right">Custo PACS (BRL)</th>
                  <th className="px-4 py-3 text-right">Lucro Estimado</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {Object.values(plansBreakdown)
                  .sort((a, b) => b.netProfit - a.netProfit)
                  .map(p => {
                    const margin = p.monthlyRevenue > 0 ? Math.round((p.netProfit / p.monthlyRevenue) * 100) : 0;
                    return (
                      <tr key={p.planName} className="hover:bg-ink-50/20">
                        <td className="px-4 py-3 font-bold text-ink-900">{p.planName}</td>
                        <td className="px-4 py-3 text-center font-bold text-ink-600">{p.activeCount}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink-800">{money(p.monthlyRevenue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-violet-600">-{money(p.monthlyIaCost)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600">-{money(p.monthlyVmCost)}</td>
                        <td className={classNames(
                          'px-4 py-3 text-right font-mono font-black',
                          p.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        )}>
                          {p.netProfit >= 0 ? '' : '-'}{money(Math.abs(p.netProfit))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={classNames(
                            'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider',
                            margin >= 40 ? 'bg-emerald-50 text-emerald-700' :
                            margin >= 15 ? 'bg-indigo-50 text-indigo-700' :
                            margin >= 0 ? 'bg-amber-50 text-amber-700' :
                                          'bg-rose-50 text-rose-700'
                          )}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alerta de prejuízo ── */}
      {lossyUsers.length > 0 && (
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-5">
          <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Alerta de prejuízo — custo IA acima da receita ({lossyUsers.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-ink-50/80 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3 text-right">Receita mensal</th>
                  <th className="px-4 py-3 text-right">Custo IA (mês)</th>
                  <th className="px-4 py-3 text-right">Prejuízo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {lossyUsers.map(u => (
                  <tr key={u.userId} className="hover:bg-rose-50/30">
                    <td className="px-4 py-3 text-ink-700 font-medium truncate max-w-[220px]">{u.email}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(u.revenueBrl)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(u.costBrl)}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700 font-bold">-{money(u.costBrl - u.revenueBrl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-400 leading-relaxed">
        MRR e receita vêm do agregado do CRON e das transações pagas. Custos de VM usam <strong>VMs/Infra</strong> (custo por plano + disco). Custo de IA converte o gasto real (US$) dos últimos 30 dias pelo câmbio definido. Assinaturas de cortesia/vitalício não entram na receita.
      </p>
    </div>
  );
}
