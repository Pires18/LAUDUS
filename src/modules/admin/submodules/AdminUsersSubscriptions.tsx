/**
 * Painel unificado: Usuários + Assinaturas
 * Combina gestão de usuários (cargo, ativo, exclusão) com
 * controle de assinaturas (tokens, laudos, add-ons, Motor Pro).
 */
import { useState, useEffect } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { useConfirm } from '../../../hooks/useConfirm';
import { useAuth } from '../../../hooks/useAuth';
import { useApp } from '../../../store/app';
import { addAuditLog, getMetricsSummary, type MetricsSummary } from '../../../store/db';
import { updateUserRole, setUserActiveStatus, deleteUserDocument } from '../../../store/adminUsers';
import type { UserRole } from '../../../types';
import {
  collection, doc, updateDoc, setDoc, deleteField, getDoc, getDocs,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import {
  Users, DollarSign, AlertTriangle, TrendingDown, CheckCircle, Sparkles,
  Search, Shield, ChevronDown, Trash2, Filter, Edit2, Calculator, Database,
  MoreVertical, CheckCircle2, XCircle, Loader2, RefreshCw, ShieldAlert,
  UserCheck, Zap, ChevronRight, ChevronUp, Plus, FileText, Check, CalendarDays, Hospital, Eye,
} from 'lucide-react';
import { AdminUserDetail } from './AdminUserDetail';

// ─── Local types ──────────────────────────────────────────────────────────────

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLogin?: number;
  subscriptionStatus?: string;
  subscriptionId?: string;
  motorProEnabled?: boolean;
  reportsUsedThisMonth?: number;
  reportsQuota?: number;
  tokenQuotaLite?: number;
  tokenQuotaPro?: number;
  // Legacy
  licenseExpiresAt?: number;
  licensePlanName?: string;
  licenseCode?: string;
  licensePlanId?: string;
  createdAt?: number;
}

interface PricingConfig {
  basePlanPrice: number;
  calculatorsAddonPrice: number;
}

interface SaasPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  interval: 'month' | 'semester' | 'year';
  reportsQuota: number;
  clinicsQuota: number;
  tokenQuotaLite: number;
  tokenQuotaPro: number;
  trialDays: number;
  includesCalculators: boolean;
  includesPacs: boolean;
  includesAppointments?: boolean;
  includesClinics?: boolean;
  motorProDefault: boolean;
  active: boolean;
  featured?: boolean;
  abacatePayProductId?: string;
}

type StatusFilter = 'all' | 'active' | 'trialing' | 'past_due' | 'canceled';
type AddonFilter  = 'all' | 'calculators' | 'pacs' | 'appointments' | 'clinics';
type UsersTab     = 'overview' | 'users' | 'consumo';

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminUsersSubscriptions() {
  const { user: currentUser } = useAuth();
  const { showToast }         = useApp();
  const confirm               = useConfirm();

  const { data: users,         loading: loadingUsers } = useCollection<SystemUser>('users',         { isGlobal: true });
  const { data: subscriptions, loading: loadingSubs  } = useCollection<any>       ('subscriptions', { isGlobal: true });

  const [activeTab,    setActiveTab]    = useState<UsersTab>('overview');
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [addonFilter,  setAddonFilter]  = useState<AddonFilter>('all');
  const [consumoSort,  setConsumoSort]  = useState<'usage' | 'reports' | 'tokens'>('usage');

  const [processing,  setProcessing]  = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [openMenu,    setOpenMenu]    = useState<string | null>(null);

  // Plans from saas_plans/
  const [saasPlansList, setSaasPlansList] = useState<SaasPlan[]>([]);
  useEffect(() => {
    getDocs(collection(firestore, 'saas_plans'))
      .then(snap => setSaasPlansList(snap.docs.map(d => ({ id: d.id, ...d.data() } as SaasPlan))))
      .catch(() => {});
  }, []);

  // Modals
  const [roleTarget,    setRoleTarget]   = useState<SystemUser | null>(null);
  const [detailTarget,  setDetailTarget] = useState<SystemUser | null>(null);
  const [statusTarget,  setStatusTarget] = useState<SystemUser | null>(null);
  const [deleteTarget,  setDeleteTarget] = useState<SystemUser | null>(null);
  const [assignTarget,  setAssignTarget] = useState<SystemUser | null>(null);
  const [assignIsLegacy, setAssignIsLegacy] = useState(false);

  // Pricing for MRR
  const [pricing, setPricing] = useState<PricingConfig>({ basePlanPrice: 149, calculatorsAddonPrice: 49 });
  useEffect(() => {
    getDoc(doc(firestore, 'global_config', 'pricing_config'))
      .then(s => { if (s.exists()) setPricing(p => ({ ...p, ...s.data() })); })
      .catch(() => {});
  }, []);

  // MRR/ARR autoritativos vêm do agregado do CRON (metrics_daily/_summary) —
  // consistente com o dashboard. Enquanto não populado, cai no cálculo local.
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  useEffect(() => { getMetricsSummary().then(setSummary).catch(() => {}); }, []);

  if (loadingUsers || loadingSubs) {
    return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-500" /></div>;
  }

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const activeCount   = users.filter(u => u.subscriptionStatus === 'active').length;
  const pastDueCount  = users.filter(u => u.subscriptionStatus === 'past_due').length;
  const trialCount    = users.filter(u => u.subscriptionStatus === 'trialing').length;
  const canceledCount = users.filter(u => u.subscriptionStatus === 'canceled').length;
  const totalWithSub  = users.filter(u => !!u.subscriptionStatus).length;
  const churnRate     = totalWithSub > 0 ? Math.round((canceledCount / totalWithSub) * 100) : 0;

  // Mapeia preço dos planos
  const planPrices: Record<string, number> = {};
  saasPlansList.forEach(p => {
    planPrices[p.id] = p.price;
    planPrices[p.name.toLowerCase()] = p.price;
  });

  let mrr = 0;
  subscriptions.forEach((s: any) => {
    if (s.status === 'active') {
      const planPrice = planPrices[s.planId] || planPrices[(s.plan || '').toLowerCase()] || pricing.basePlanPrice;
      mrr += planPrice;

      // Adiciona addons individuais
      if (s.addons?.includes('calculators')) {
        // Se já não estiver incluso no plano
        const planObj = saasPlansList.find(p => p.id === s.planId);
        if (!planObj?.includesCalculators) {
          mrr += pricing.calculatorsAddonPrice;
        }
      }
    }
  });

  // Prefere o agregado do CRON (autoritativo); cai no cálculo local se ausente.
  const mrrDisplay = summary?.mrr ?? mrr;
  const arr = mrrDisplay * 12;
  const activeDisplay = summary?.activeSubscribers ?? activeCount;
  const arpu = activeDisplay > 0 ? mrrDisplay / activeDisplay : 0;

  const legacyUsers = users.filter(u => u.licenseExpiresAt && u.licenseExpiresAt > Date.now());

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const sub     = subscriptions.find((s: any) => s.id === `sub_${u.id}`);
    const txt     = `${u.name || ''} ${u.email || ''} ${sub?.plan || ''} ${u.subscriptionStatus || ''}`.toLowerCase();
    const matchTx = txt.includes(search.toLowerCase());
    const matchRo = roleFilter === 'all' || u.role === roleFilter;
    const matchSt = statusFilter === 'all' || u.subscriptionStatus === statusFilter;
    const matchAd = addonFilter === 'all' || sub?.addons?.includes(addonFilter);
    return matchTx && matchRo && matchSt && matchAd;
  });

  // ─── Consumo por usuário ──────────────────────────────────────────────────────
  // Agrega uso de laudos + tokens por usuário (dados já carregados de users/subscriptions).
  const consumoRows = users
    .filter(u => u.role !== 'admin')
    .map(u => {
      const sub = subscriptions.find((s: any) => s.id === `sub_${u.id}`);
      const reportsUsed  = u.reportsUsedThisMonth ?? sub?.reportsUsedThisMonth ?? 0;
      const reportsQuota = u.reportsQuota ?? sub?.reportsQuota ?? 100;
      const unlimited    = reportsQuota >= 9999;
      const pct          = unlimited ? 0 : Math.min(100, Math.round((reportsUsed / Math.max(1, reportsQuota)) * 100));
      const tokenLite    = u.tokenQuotaLite ?? sub?.tokenQuotaLite ?? 0;
      const tokenPro     = u.tokenQuotaPro  ?? sub?.tokenQuotaPro  ?? 0;
      return {
        u, sub, reportsUsed, reportsQuota, unlimited, pct, tokenLite, tokenPro,
        status: u.subscriptionStatus || (sub?.status ?? '—'),
      };
    })
    .sort((a, b) => {
      if (consumoSort === 'reports') return b.reportsUsed - a.reportsUsed;
      if (consumoSort === 'tokens')  return (b.tokenLite + b.tokenPro) - (a.tokenLite + a.tokenPro);
      return b.pct - a.pct; // usage (default)
    });

  const totalReportsUsed = consumoRows.reduce((acc, r) => acc + r.reportsUsed, 0);
  const nearLimitCount   = consumoRows.filter(r => !r.unlimited && r.pct >= 80).length;
  const exhaustedCount   = consumoRows.filter(r => !r.unlimited && r.reportsUsed >= r.reportsQuota).length;

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const run = async (userId: string, fn: () => Promise<void>) => {
    setProcessing(userId);
    try { await fn(); }
    catch (err: any) { showToast(err.message || 'Erro inesperado.', 'error'); }
    finally { setProcessing(null); setOpenMenu(null); }
  };

  async function handleRoleChange(newRole: UserRole) {
    if (!roleTarget || !currentUser) return;
    await run(roleTarget.id, async () => {
      await updateUserRole(roleTarget.id, newRole, currentUser.uid, currentUser.displayName || 'Admin');
      await addAuditLog({ action: 'ALTERAR_CARGO', details: `Cargo de ${roleTarget.name} → ${newRole}.`, module: 'Admin' });
      showToast(`Cargo alterado para ${newRole}.`, 'success');
    });
    setRoleTarget(null);
  }

  async function handleStatusToggle() {
    if (!statusTarget || !currentUser) return;
    const next = !statusTarget.active;
    await run(statusTarget.id, async () => {
      await setUserActiveStatus(statusTarget.id, next, currentUser.uid, currentUser.displayName || 'Admin');
      await addAuditLog({ action: 'ALTERAR_STATUS_USUARIO', details: `Status de ${statusTarget.name} → ${next ? 'Ativo' : 'Inativo'}.`, module: 'Admin' });
      showToast(`Usuário ${next ? 'ativado' : 'desativado'}.`, 'success');
    });
    setStatusTarget(null);
  }

  async function handleDeleteUser() {
    if (!deleteTarget || !currentUser) return;
    await run(deleteTarget.id, async () => {
      await deleteUserDocument(deleteTarget.id, currentUser.uid, currentUser.displayName || 'Admin');
      await addAuditLog({ action: 'EXCLUIR_USUARIO', details: `Usuário ${deleteTarget.name} excluído.`, module: 'Admin' });
      showToast(`Usuário ${deleteTarget.name} removido.`, 'success');
    });
    setDeleteTarget(null);
  }

  async function handleToggleMotorPro(u: SystemUser) {
    await run(u.id, async () => {
      await updateDoc(doc(firestore, 'users', u.id), { motorProEnabled: !u.motorProEnabled, updatedAt: Date.now() });
      showToast('Motor Pro alterado.', 'success');
    });
  }

  async function handleEditQuota(u: SystemUser, field: 'reportsQuota' | 'tokenQuotaLite' | 'tokenQuotaPro') {
    const labels: Record<typeof field, string> = {
      reportsQuota: 'quota de laudos mensais',
      tokenQuotaLite: 'quota de Tokens Lite mensais (0 = ilimitado)',
      tokenQuotaPro:  'quota de Tokens Pro mensais (0 = ilimitado)',
    };
    const current = (u as any)[field] ?? (field === 'reportsQuota' ? 100 : 0);
    const val = window.prompt(`Nova ${labels[field]}:`, String(current));
    if (val === null) return;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { showToast('Valor inválido.', 'error'); return; }
    await run(u.id, async () => {
      await updateDoc(doc(firestore, 'users', u.id), { [field]: n, updatedAt: Date.now() });
      if (field === 'reportsQuota') {
        await updateDoc(doc(firestore, 'subscriptions', `sub_${u.id}`), { reportsQuota: n, updatedAt: Date.now() }).catch(() => {});
      }
      showToast('Quota atualizada.', 'success');
    });
  }

  async function handleToggleAddon(u: SystemUser, addon: 'calculators' | 'pacs' | 'appointments' | 'clinics') {
    const subId = `sub_${u.id}`;
    const sub   = subscriptions.find((s: any) => s.id === subId);
    await run(u.id, async () => {
      const curr: string[] = sub?.addons ? [...sub.addons] : [];
      const next = curr.includes(addon) ? curr.filter(a => a !== addon) : [...curr, addon];
      await setDoc(doc(firestore, 'subscriptions', subId), { id: subId, userId: u.id, addons: next, updatedAt: Date.now() }, { merge: true });
      showToast(`Add-on ${addon} alterado.`, 'success');
    });
  }

  async function handleCancelSub(u: SystemUser) {
    const ok = await confirm({
      title: 'Cancelar assinatura',
      message: `Cancelar a assinatura de ${u.name}? O acesso pago é encerrado.`,
      variant: 'danger',
      confirmLabel: 'Cancelar assinatura',
      cancelLabel: 'Voltar',
    });
    if (!ok) return;
    await run(u.id, async () => {
      await updateDoc(doc(firestore, 'subscriptions', `sub_${u.id}`), { status: 'canceled', canceledAt: Date.now() });
      await updateDoc(doc(firestore, 'users', u.id), { subscriptionStatus: 'canceled' });
      showToast('Assinatura cancelada.', 'info');
    });
  }

  async function handleReactivate(u: SystemUser) {
    const now = Date.now();
    await run(u.id, async () => {
      await setDoc(doc(firestore, 'subscriptions', `sub_${u.id}`), {
        status: 'active', updatedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      }, { merge: true });
      await updateDoc(doc(firestore, 'users', u.id), { subscriptionStatus: 'active', updatedAt: now });
      showToast('Assinatura reativada.', 'success');
    });
  }

  function handleMigrateClick(u: SystemUser) {
    setAssignIsLegacy(true);
    setAssignTarget(u);
  }

  async function handleAssignSub(
    u: SystemUser,
    plan: SaasPlan,
    opts: { status: string; paymentMethod: string; periodEndMs: number; lifetime?: boolean }
  ) {
    const now   = Date.now();
    const subId = `sub_${u.id}`;
    const addons: string[] = [];
    if (plan.includesCalculators) addons.push('calculators');
    if (plan.includesPacs)        addons.push('pacs');
    if (plan.includesAppointments) addons.push('appointments');
    if (plan.includesClinics)      addons.push('clinics');

    await run(u.id, async () => {
      await setDoc(doc(firestore, 'subscriptions', subId), {
        id: subId, userId: u.id, userEmail: u.email,
        plan: plan.name, planId: plan.id,
        addons,
        status: opts.status,
        lifetime: !!opts.lifetime,
        autoRenew: !opts.lifetime,
        paymentMethod: opts.paymentMethod,
        currentPeriodStart: now,
        currentPeriodEnd: opts.periodEndMs,
        reportsUsedThisMonth: 0,
        reportsQuota:   plan.reportsQuota,
        clinicsQuota:   plan.clinicsQuota,
        tokenQuotaLite: plan.tokenQuotaLite,
        tokenQuotaPro:  plan.tokenQuotaPro,
        lastResetAt: now, createdAt: now, updatedAt: now,
        ...(opts.status === 'trialing' && plan.trialDays > 0
          ? { trialEndsAt: now + plan.trialDays * 24 * 60 * 60 * 1000 }
          : {}),
      });

      const userUpdate: Record<string, any> = {
        subscriptionId: subId,
        subscriptionStatus: opts.status,
        motorProEnabled: plan.motorProDefault,
        reportsQuota: plan.reportsQuota,
        tokenQuotaLite: plan.tokenQuotaLite,
        tokenQuotaPro: plan.tokenQuotaPro,
        updatedAt: now,
      };

      if (assignIsLegacy) {
        userUpdate.licenseCode     = deleteField();
        userUpdate.licensePlanId   = deleteField();
        userUpdate.licensePlanName = deleteField();
        userUpdate.licenseExpiresAt = deleteField();
      }

      await updateDoc(doc(firestore, 'users', u.id), userUpdate);

      await addAuditLog({
        action: 'ATRIBUIR_ASSINATURA',
        details: `Plano "${plan.name}" atribuído a ${u.name || u.email} (${opts.status}).`,
        module: 'Admin',
      });
      showToast(`Assinatura "${plan.name}" atribuída com sucesso.`, 'success');
    });

    setAssignTarget(null);
    setAssignIsLegacy(false);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function subBadge(status: string | undefined) {
    const map: Record<string, string> = {
      active:   'bg-emerald-50 text-emerald-700',
      trialing: 'bg-indigo-50 text-indigo-700',
      past_due: 'bg-rose-50 text-rose-700',
      canceled: 'bg-ink-100 text-ink-500',
      paused:   'bg-amber-50 text-amber-700',
    };
    return (
      <span className={classNames('px-2 py-0.5 rounded text-[9px] font-black uppercase', map[status || ''] || 'bg-ink-100 text-ink-500')}>
        {status || '—'}
      </span>
    );
  }

  function quotaBar(used: number, quota: number) {
    if (quota === 0) return <span className="text-[10px] text-ink-400 font-semibold">{used} / ∞</span>;
    const pct = Math.min(100, Math.round((used / quota) * 100));
    return (
      <div className="space-y-0.5">
        <span className="text-[10px] font-bold text-ink-700">{used} / {quota}</span>
        <div className="w-16 h-1.5 bg-ink-100 rounded-full overflow-hidden">
          <div className={classNames('h-full rounded-full', pct >= 85 ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const TABS: { id: UsersTab; label: string; icon: any; hint: string }[] = [
    { id: 'overview', label: 'Visão Geral', icon: TrendingDown, hint: 'MRR, ARR, churn e status' },
    { id: 'users',    label: 'Usuários',    icon: Users,        hint: 'Gestão, planos e add-ons' },
    { id: 'consumo',  label: 'Consumo',     icon: Zap,          hint: 'Uso de laudos e tokens por usuário' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── TAB NAV ────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 p-1 bg-ink-100/70 rounded-2xl w-fit">
        {TABS.map(t => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              title={t.hint}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all',
                on ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-800',
              )}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (<>

      {/* ── METRICS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: summary ? 'MRR' : 'MRR (local)', value: `R$ ${mrrDisplay.toLocaleString('pt-BR')}`,  icon: DollarSign,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'ARR',             value: `R$ ${arr.toLocaleString('pt-BR')}`,  icon: DollarSign,    color: 'text-emerald-700', bg: 'bg-emerald-100/50' },
          { label: 'ARPU',            value: `R$ ${arpu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Churn Rate',      value: `${churnRate}%`,                       icon: TrendingDown,  color: 'text-pink-600',    bg: 'bg-pink-50'    },
          { label: 'Ativos',          value: activeDisplay,                         icon: Users,         color: 'text-emerald-600', bg: 'bg-emerald-50'  },
          { label: 'Trials',          value: trialCount,                            icon: Sparkles,      color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Em Atraso',       value: pastDueCount,                          icon: AlertTriangle, color: 'text-rose-600',    bg: 'bg-rose-50'    },
          { label: 'Total Usuários',  value: users.length,                          icon: Users,         color: 'text-teal-600',    bg: 'bg-teal-50'    },
        ].map(m => (
          <div key={m.label} className="bg-white p-4 rounded-2xl border border-ink-100 shadow-sm flex items-center gap-3">
            <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', m.bg, m.color)}>
              <m.icon size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-ink-500 uppercase tracking-wider truncate">{m.label}</div>
              <div className="text-base font-black text-ink-950 truncate">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── LEGACY MIGRATION ───────────────────────────────────────────── */}
      {legacyUsers.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={18} className="text-amber-600" />
            <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest">Contas Legadas — Migração Pendente</h3>
          </div>
          <div className="divide-y divide-amber-200/50 bg-white rounded-xl border border-amber-200 overflow-hidden">
            {legacyUsers.map((u: SystemUser) => (
              <div key={u.id} className="px-4 py-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-ink-950">{u.name || 'Médico'}</p>
                  <p className="text-[10px] text-ink-500 font-medium">
                    {u.email} · Licença: <strong>{u.licensePlanName || 'Manual'}</strong>
                    {u.licenseExpiresAt ? ` (Expira: ${new Date(u.licenseExpiresAt).toLocaleDateString('pt-BR')})` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleMigrateClick(u)}
                  disabled={processing === u.id}
                  className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  {processing === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  Converter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      </>)}

      {activeTab === 'users' && (<>

      {/* ── FILTER BAR ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, e-mail, plano ou status..."
            className="w-full h-10 pl-9 pr-24 bg-ink-50 border border-ink-200 rounded-xl focus:border-indigo-400 outline-none text-xs font-semibold"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-ink-400 tabular-nums">
            {filtered.length}/{users.length}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Role */}
          <FilterPills
            options={[
              { key: 'all',      label: 'Todos' },
              { key: 'admin',    label: 'Admin' },
              { key: 'medico',   label: 'Médico' },
              { key: 'recepcao', label: 'Recepção' },
            ]}
            value={roleFilter}
            onChange={v => setRoleFilter(v as any)}
          />
          {/* Status */}
          <FilterPills
            options={[
              { key: 'all',      label: 'Status' },
              { key: 'active',   label: 'Ativo' },
              { key: 'trialing', label: 'Trial' },
              { key: 'past_due', label: 'Atraso' },
              { key: 'canceled', label: 'Cancelado' },
            ]}
            value={statusFilter}
            onChange={v => setStatusFilter(v as any)}
          />
          {/* Addon */}
          <FilterPills
            options={[
              { key: 'all',          label: 'Add-ons' },
              { key: 'calculators',  label: 'Calc.' },
              { key: 'pacs',         label: 'PACS' },
              { key: 'appointments', label: 'Agend.' },
              { key: 'clinics',      label: 'Clín.' },
            ]}
            value={addonFilter}
            onChange={v => setAddonFilter(v as any)}
          />
        </div>
      </div>

      {/* ── USER TABLE ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50/50 border-b border-ink-100 text-[10px] font-black uppercase text-ink-400 tracking-wider">
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">Cargo</th>
                <th className="px-5 py-3.5">Assinatura / Plano</th>
                <th className="px-5 py-3.5">Laudos / mês</th>
                <th className="px-5 py-3.5">Laudos Lite</th>
                <th className="px-5 py-3.5">Laudos Pro</th>
                <th className="px-5 py-3.5 text-center">Motor Pro</th>
                <th className="px-5 py-3.5">Add-ons</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-ink-400 text-sm">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const sub    = subscriptions.find((s: any) => s.id === `sub_${u.id}`);
                const isExp  = expandedRow === u.id;
                const isProc = processing === u.id;

                const used      = u.reportsUsedThisMonth || 0;
                const quota     = u.reportsQuota         || 100;
                const tQLite    = u.tokenQuotaLite        ?? 0;
                const tQPro     = u.tokenQuotaPro         ?? 0;

                return (
                  <>
                    <tr
                      key={u.id}
                      className="hover:bg-ink-50/30 transition-colors cursor-pointer group"
                      onClick={() => setExpandedRow(isExp ? null : u.id)}
                    >
                      {/* Nome */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm border border-brand-100 shrink-0">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-black text-ink-900 group-hover:text-brand-700 transition-colors">{u.name || 'Sem nome'}</p>
                            <p className="text-[10px] text-ink-400 font-medium">{u.email}</p>
                          </div>
                          {isExp ? <ChevronUp size={12} className="text-ink-300 ml-1" /> : <ChevronRight size={12} className="text-ink-200 ml-1" />}
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setRoleTarget(u)}
                          className={classNames(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                            u.role === 'admin'   ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            u.role === 'medico'  ? 'bg-brand-50 text-brand-700 border-brand-200' :
                            'bg-ink-50 text-ink-600 border-ink-200'
                          )}
                        >
                          <Shield size={10} /> {u.role} <ChevronDown size={9} />
                        </button>
                      </td>

                      {/* Assinatura */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="space-y-1">
                          {subBadge(u.subscriptionStatus)}
                          {sub?.plan && (
                            <p className="text-[9px] font-bold text-ink-500 truncate max-w-[120px]">{sub.plan}</p>
                          )}
                          {!u.subscriptionStatus && (
                            <button
                              onClick={() => { setAssignIsLegacy(false); setAssignTarget(u); }}
                              className="text-[9px] font-black uppercase flex items-center gap-0.5 text-brand-600 hover:text-brand-800 transition-colors"
                            >
                              <Plus size={9} /> Atribuir Plano
                            </button>
                          )}
                          <button
                            onClick={() => setStatusTarget(u)}
                            className={classNames(
                              'text-[9px] font-black uppercase flex items-center gap-0.5 transition-colors',
                              u.active !== false ? 'text-emerald-600 hover:text-emerald-800' : 'text-rose-500 hover:text-rose-700'
                            )}
                          >
                            {u.active !== false ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                            {u.active !== false ? 'Conta ativa' : 'Conta inativa'}
                          </button>
                        </div>
                      </td>

                      {/* Laudos */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {quotaBar(used, quota)}
                          <button onClick={() => handleEditQuota(u, 'reportsQuota')} className="text-ink-300 hover:text-indigo-600 transition-colors">
                            <Edit2 size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Token Lite */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-0.5">
                              <Zap size={9} /> {tQLite === 0 ? '∞' : tQLite.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[9px] text-ink-400">tokens / mês</span>
                          </div>
                          <button onClick={() => handleEditQuota(u, 'tokenQuotaLite')} className="text-ink-300 hover:text-indigo-600 transition-colors">
                            <Edit2 size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Token Pro */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-violet-700 flex items-center gap-0.5">
                              <Sparkles size={9} /> {tQPro === 0 ? '∞' : tQPro.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[9px] text-ink-400">tokens / mês</span>
                          </div>
                          <button onClick={() => handleEditQuota(u, 'tokenQuotaPro')} className="text-ink-300 hover:text-violet-600 transition-colors">
                            <Edit2 size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Motor Pro */}
                      <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleMotorPro(u)}
                          disabled={isProc}
                          className={classNames('w-10 h-6 rounded-full relative transition-all cursor-pointer inline-block', u.motorProEnabled ? 'bg-indigo-600' : 'bg-ink-300')}
                        >
                          <div className={classNames('w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all', u.motorProEnabled ? 'left-5' : 'left-1')} />
                        </button>
                      </td>

                      {/* Add-ons */}
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleToggleAddon(u, 'calculators')}
                            disabled={isProc}
                            title="Calculadoras"
                            className={classNames(
                              'p-1.5 rounded-lg border flex items-center justify-center transition-all',
                              sub?.addons?.includes('calculators')
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300'
                            )}
                          >
                            <Calculator size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleAddon(u, 'pacs')}
                            disabled={isProc}
                            title="PACS / DICOM"
                            className={classNames(
                              'p-1.5 rounded-lg border flex items-center justify-center transition-all',
                              sub?.addons?.includes('pacs')
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300'
                            )}
                          >
                            <Database size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleAddon(u, 'appointments')}
                            disabled={isProc}
                            title="Agendamentos"
                            className={classNames(
                              'p-1.5 rounded-lg border flex items-center justify-center transition-all',
                              sub?.addons?.includes('appointments')
                                ? 'bg-amber-50 border-amber-200 text-amber-600'
                                : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300'
                            )}
                          >
                            <CalendarDays size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleAddon(u, 'clinics')}
                            disabled={isProc}
                            title="Clínicas"
                            className={classNames(
                              'p-1.5 rounded-lg border flex items-center justify-center transition-all',
                              sub?.addons?.includes('clinics')
                                ? 'bg-teal-50 border-teal-200 text-teal-600'
                                : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300'
                            )}
                          >
                            <Hospital size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        {isProc ? (
                          <Loader2 size={16} className="animate-spin text-brand-500 ml-auto" />
                        ) : (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                              className="p-2 text-ink-400 hover:bg-ink-100 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenu === u.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                                <div className="absolute right-0 top-full z-50 bg-white rounded-xl border border-ink-200 shadow-xl mt-1 min-w-[220px] py-1 text-xs">
                                  <MenuItem icon={Shield}     label="Alterar Cargo"         onClick={() => { setOpenMenu(null); setRoleTarget(u); }} />
                                  <MenuItem icon={CheckCircle2} label={u.active !== false ? 'Desativar Conta' : 'Ativar Conta'} onClick={() => { setOpenMenu(null); setStatusTarget(u); }} />
                                  <MenuItem icon={FileText}  label={u.subscriptionStatus ? 'Trocar Plano' : 'Atribuir Plano'} onClick={() => { setOpenMenu(null); setAssignIsLegacy(false); setAssignTarget(u); }} color="indigo" />
                                  <hr className="border-ink-100 my-1" />
                                  <MenuItem icon={CalendarDays} label={`${sub?.addons?.includes('appointments') ? 'Desativar' : 'Ativar'} Agendamentos`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'appointments'); }} color="amber" />
                                  <MenuItem icon={Hospital}     label={`${sub?.addons?.includes('clinics') ? 'Desativar' : 'Ativar'} Clínicas`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'clinics'); }} color="teal" />
                                  <MenuItem icon={Sparkles}  label={`${u.motorProEnabled ? 'Desativar' : 'Ativar'} Motor Pro`} onClick={() => handleToggleMotorPro(u)} color="indigo" />
                                  <MenuItem icon={Edit2}     label="Editar Quota Laudos"        onClick={() => handleEditQuota(u, 'reportsQuota')} />
                                  <MenuItem icon={Zap}       label="Editar Tokens Lite"          onClick={() => handleEditQuota(u, 'tokenQuotaLite')} color="indigo" />
                                  <MenuItem icon={Sparkles}  label="Editar Tokens Pro"           onClick={() => handleEditQuota(u, 'tokenQuotaPro')}  color="violet" />
                                  <hr className="border-ink-100 my-1" />
                                  {(u.subscriptionStatus === 'canceled' || u.subscriptionStatus === 'paused') ? (
                                    <MenuItem icon={RefreshCw} label="Reativar Assinatura" onClick={() => handleReactivate(u)} color="emerald" />
                                  ) : u.subscriptionStatus && u.subscriptionStatus !== 'canceled' ? (
                                    <MenuItem icon={Trash2}    label="Cancelar Assinatura"  onClick={() => handleCancelSub(u)} color="rose" />
                                  ) : null}
                                  <hr className="border-ink-100 my-1" />
                                  <MenuItem icon={Trash2}    label="Excluir Usuário"       onClick={() => { setOpenMenu(null); setDeleteTarget(u); }} color="rose" />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExp && (
                      <tr key={`${u.id}-exp`} className="bg-ink-50/20">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Assinatura */}
                            <DetailBox title="Assinatura">
                              <DetailRow k="Status"  v={u.subscriptionStatus || '—'} />
                              <DetailRow k="Plano"   v={sub?.plan || '—'} />
                              <DetailRow k="Método"  v={sub?.paymentMethod || '—'} />
                              {sub?.currentPeriodEnd && (
                                <DetailRow k="Vence em" v={new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')} />
                              )}
                              {sub?.id && <DetailRow k="Sub ID" v={sub.id} mono />}
                            </DetailBox>

                            {/* Tokens */}
                            <DetailBox title="Tokens LAUD.IA">
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-indigo-600 font-black flex items-center gap-1"><Zap size={9} /> Token Lite</span>
                                    <span className="font-bold text-ink-700">{tQLite === 0 ? 'Ilimitado' : `${tQLite.toLocaleString('pt-BR')} / mês`}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-violet-600 font-black flex items-center gap-1"><Sparkles size={9} /> Token Pro</span>
                                    <span className="font-bold text-ink-700">{tQPro === 0 ? 'Ilimitado' : `${tQPro.toLocaleString('pt-BR')} / mês`}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-ink-500">Motor Pro</span>
                                    <span className={classNames('font-bold', u.motorProEnabled ? 'text-indigo-600' : 'text-ink-400')}>
                                      {u.motorProEnabled ? 'Habilitado' : 'Bloqueado'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </DetailBox>

                            {/* Add-ons */}
                            <DetailBox title="Add-ons">
                              <div className="flex gap-2 flex-wrap">
                                <AddonPill label="Calculadoras" icon={Calculator} active={sub?.addons?.includes('calculators')} />
                                <AddonPill label="PACS / DICOM" icon={Database}   active={sub?.addons?.includes('pacs')} />
                                <AddonPill label="Agendamentos" icon={CalendarDays} active={sub?.addons?.includes('appointments')} />
                                <AddonPill label="Clínicas" icon={Hospital} active={sub?.addons?.includes('clinics')} />
                              </div>
                              <div className="mt-3 text-[10px] text-ink-500 font-medium">
                                Último login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('pt-BR') : '—'}
                              </div>
                            </DetailBox>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => setDetailTarget(u)}
                              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                              <Eye size={12} /> Ver visão 360º (pagamentos, uso, tickets)
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {activeTab === 'consumo' && (<>

      {/* ── CONSUMO: MÉTRICAS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Laudos usados (mês)', value: totalReportsUsed.toLocaleString('pt-BR'), icon: FileText,      color: 'text-brand-600',   bg: 'bg-brand-50'   },
          { label: 'Usuários rastreados', value: consumoRows.length,                       icon: Users,         color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
          { label: 'Perto do limite (≥80%)', value: nearLimitCount,                        icon: AlertTriangle, color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Cota esgotada',       value: exhaustedCount,                           icon: XCircle,       color: 'text-rose-600',    bg: 'bg-rose-50'    },
        ].map(m => (
          <div key={m.label} className="bg-white p-4 rounded-2xl border border-ink-100 shadow-sm flex items-center gap-3">
            <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', m.bg, m.color)}>
              <m.icon size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-ink-500 uppercase tracking-wider truncate">{m.label}</div>
              <div className="text-base font-black text-ink-950 truncate">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CONSUMO: ORDENAÇÃO ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black text-ink-500 uppercase tracking-wider">Ordenar por</span>
        {([
          { id: 'usage',   label: '% da cota' },
          { id: 'reports', label: 'Laudos usados' },
          { id: 'tokens',  label: 'Tokens' },
        ] as const).map(o => (
          <button
            key={o.id}
            onClick={() => setConsumoSort(o.id)}
            className={classNames(
              'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border',
              consumoSort === o.id
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-ink-600 border-ink-200 hover:border-brand-300',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ── CONSUMO: TABELA ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-100 text-[10px] font-black text-ink-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 min-w-[180px]">Laudos (uso / cota)</th>
                <th className="text-right px-4 py-3">Tokens Lite</th>
                <th className="text-right px-4 py-3">Tokens Pro</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {consumoRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400 font-medium">Nenhum usuário com consumo registrado.</td></tr>
              )}
              {consumoRows.map(({ u, reportsUsed, reportsQuota, unlimited, pct, tokenLite, tokenPro, status }) => {
                const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500';
                return (
                  <tr key={u.id} className="hover:bg-ink-50/40">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink-950 truncate max-w-[160px]">{u.name || 'Médico'}</p>
                      <p className="text-[10px] text-ink-500 font-medium truncate max-w-[160px]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={classNames(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-black',
                        status === 'active'   ? 'bg-emerald-50 text-emerald-700' :
                        status === 'trialing' ? 'bg-amber-50 text-amber-700'    :
                        status === 'past_due' ? 'bg-rose-50 text-rose-700'      :
                        'bg-ink-100 text-ink-500',
                      )}>{status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {unlimited ? (
                        <span className="text-[11px] font-bold text-emerald-600">♾️ Ilimitado</span>
                      ) : (
                        <div className="min-w-[160px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-ink-800">{reportsUsed} / {reportsQuota}</span>
                            <span className={classNames('text-[10px] font-black', pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-ink-400')}>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
                            <div className={classNames('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-ink-700">{tokenLite === 0 ? '∞' : tokenLite.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink-700">{tokenPro === 0 ? '∞' : tokenPro.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleEditQuota(u, 'reportsQuota')}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50"
                          title="Editar cota de laudos"
                        ><Edit2 size={14} /></button>
                        <button
                          onClick={() => setDetailTarget(u)}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Ver detalhes 360º"
                        ><Eye size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {/* ── VISÃO 360º DO CLIENTE ──────────────────────────────────────── */}
      <AdminUserDetail user={detailTarget} onClose={() => setDetailTarget(null)} />

      {/* ── ASSIGN SUBSCRIPTION MODAL ──────────────────────────────────── */}
      {assignTarget && (
        <AssignSubModal
          user={assignTarget}
          plans={saasPlansList}
          isLegacy={assignIsLegacy}
          onClose={() => { setAssignTarget(null); setAssignIsLegacy(false); }}
          onConfirm={(plan, opts) => handleAssignSub(assignTarget, plan, opts)}
          loading={processing === assignTarget.id}
        />
      )}

      {/* ── MODALS ─────────────────────────────────────────────────────── */}

      {/* Role change */}
      <Modal open={roleTarget !== null} onClose={() => setRoleTarget(null)} title="Alterar Cargo" size="sm">
        {roleTarget && (
          <div className="space-y-5">
            <p className="text-sm text-ink-500">Novo nível de acesso para <strong>{roleTarget.name}</strong>:</p>
            <div className="space-y-2">
              {(['admin', 'medico', 'recepcao'] as UserRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={classNames(
                    'w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition-all',
                    roleTarget.role === role ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-brand-200 hover:bg-ink-50'
                  )}
                >
                  <div>
                    <p className={classNames('font-black uppercase tracking-widest text-xs', roleTarget.role === role ? 'text-brand-700' : 'text-ink-900')}>{role}</p>
                    <p className="text-[10px] text-ink-400 mt-0.5">
                      {role === 'admin' ? 'Controle total do sistema e IA.' :
                       role === 'medico' ? 'Criação de laudos e máscaras.' :
                       'Acesso à worklist e pacientes.'}
                    </p>
                  </div>
                  {roleTarget.role === role && <CheckCircle2 size={18} className="text-brand-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Status toggle */}
      <ConfirmDialog
        open={statusTarget !== null}
        onConfirm={handleStatusToggle}
        onCancel={() => setStatusTarget(null)}
        title={statusTarget?.active !== false ? 'Desativar Usuário' : 'Ativar Usuário'}
        message={`Deseja ${statusTarget?.active !== false ? 'desativar' : 'ativar'} o acesso de ${statusTarget?.name}?`}
        confirmLabel={statusTarget?.active !== false ? 'Sim, Desativar' : 'Sim, Ativar'}
        variant={statusTarget?.active !== false ? 'danger' : 'info'}
      />

      {/* Delete user */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
        title="Remover Usuário"
        message={`AVISO: irreversível. O registro de ${deleteTarget?.name} será permanentemente removido.`}
        confirmLabel="Sim, Remover"
        variant="danger"
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterPills({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-ink-50 rounded-lg p-0.5 border border-ink-100">
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={classNames(
            'px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all',
            value === o.key ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, color = 'ink' }: {
  icon: typeof Shield; label: string; onClick: () => void; color?: string;
}) {
  const cls = color === 'rose' ? 'text-rose-600 hover:bg-rose-50'
    : color === 'emerald' ? 'text-emerald-700 hover:bg-emerald-50'
    : color === 'indigo'  ? 'text-indigo-700 hover:bg-indigo-50'
    : color === 'violet'  ? 'text-violet-700 hover:bg-violet-50'
    : 'text-ink-700 hover:bg-ink-50';
  return (
    <button className={classNames('w-full px-4 py-2.5 text-left font-semibold flex items-center gap-2 text-xs transition-colors', cls)} onClick={onClick}>
      <Icon size={13} /> {label}
    </button>
  );
}

function DetailBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 space-y-2">
      <div className="text-[9px] font-black uppercase text-ink-400 tracking-widest mb-2">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-ink-500">{k}</span>
      <span className={classNames('font-bold text-ink-800 max-w-[60%] text-right truncate', mono && 'font-mono')}>{v}</span>
    </div>
  );
}

function AddonPill({ label, icon: Icon, active }: { label: string; icon: typeof Calculator; active: boolean }) {
  return (
    <span className={classNames(
      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border',
      active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-ink-50 border-ink-200 text-ink-400'
    )}>
      <Icon size={11} /> {label}
    </span>
  );
}

// ─── AssignSubModal ───────────────────────────────────────────────────────────

interface AssignOpts {
  status: string;
  paymentMethod: string;
  periodEndMs: number;
  lifetime?: boolean;
}

/** Fim de período "infinito" para planos vitalícios (~ano 2999). */
const LIFETIME_END_MS = new Date('2999-12-31T23:59:59Z').getTime();

function AssignSubModal({
  user, plans, isLegacy, onClose, onConfirm, loading,
}: {
  user: SystemUser;
  plans: SaasPlan[];
  isLegacy: boolean;
  onClose: () => void;
  onConfirm: (plan: SaasPlan, opts: AssignOpts) => void;
  loading: boolean;
}) {
  const activePlans = plans.filter(p => p.active);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activePlans[0]?.id || '');
  const [status, setStatus]                 = useState('active');
  const [paymentMethod, setPaymentMethod]   = useState('manual');
  const [periodDays, setPeriodDays]         = useState(30);
  const [lifetime, setLifetime]             = useState(false);

  const plan = activePlans.find(p => p.id === selectedPlanId);

  const handleConfirm = () => {
    if (!plan) return;
    onConfirm(plan, {
      status: lifetime ? 'active' : status,
      paymentMethod: lifetime ? 'manual' : paymentMethod,
      periodEndMs: lifetime ? LIFETIME_END_MS : Date.now() + periodDays * 24 * 60 * 60 * 1000,
      lifetime,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-ink-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">
              {isLegacy ? 'Migrar & Atribuir Plano' : 'Atribuir / Trocar Plano'}
            </h3>
            <p className="text-[11px] text-ink-400 mt-0.5">{user.name || user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-ink-100 rounded-lg transition-colors">
            <XCircle size={16} className="text-ink-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Plan selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-3">
              Selecionar Plano
            </label>
            {activePlans.length === 0 ? (
              <div className="text-center py-8 text-ink-400 bg-ink-50 rounded-xl border border-ink-100">
                <FileText size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">Nenhum plano ativo cadastrado.</p>
                <p className="text-xs mt-0.5">Configure planos na aba Financeiro → Planos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlans.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={classNames(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      selectedPlanId === p.id
                        ? 'border-brand-500 bg-brand-50/60 shadow-sm'
                        : 'border-ink-100 bg-white hover:border-brand-200'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-black text-ink-900">{p.name}</p>
                        {p.description && <p className="text-[10px] text-ink-500 mt-0.5 line-clamp-2">{p.description}</p>}
                      </div>
                      <div className={classNames('w-4 h-4 rounded-full border-2 flex-shrink-0 ml-2 mt-0.5 transition-all',
                        selectedPlanId === p.id ? 'border-brand-500 bg-brand-500' : 'border-ink-300 bg-white')}>
                        {selectedPlanId === p.id && <Check size={10} className="text-white m-auto" />}
                      </div>
                    </div>
                    <p className="text-base font-black text-ink-950 mb-2">
                      R$ {p.price.toFixed(2)}
                      <span className="text-[10px] font-medium text-ink-400">/{p.interval === 'year' ? 'ano' : p.interval === 'semester' ? 'semestre' : 'mês'}</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                        {p.reportsQuota === 0 ? '∞' : p.reportsQuota} laudos/mês
                      </span>
                      {p.tokenQuotaLite > 0 && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <Zap size={8} /> {p.tokenQuotaLite} Lite
                        </span>
                      )}
                      {p.tokenQuotaPro > 0 && (
                        <span className="text-[9px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                          <Sparkles size={8} /> {p.tokenQuotaPro} Pro
                        </span>
                      )}
                      {p.includesCalculators && <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Calc</span>}
                      {p.motorProDefault && <span className="text-[9px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-bold">Motor Pro</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status + Payment + Period */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="input h-10 text-sm w-full">
                <option value="active">Ativo</option>
                <option value="trialing">Trial</option>
                <option value="past_due">Em Atraso</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-1">Método Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input h-10 text-sm w-full">
                <option value="manual">Manual (Admin)</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de Crédito</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-1">Duração (dias)</label>
              <input type="number" min={1} max={365} value={periodDays}
                onChange={e => setPeriodDays(parseInt(e.target.value) || 30)}
                disabled={lifetime}
                className="input h-10 text-sm w-full disabled:opacity-40" />
            </div>
          </div>

          {/* Plano vitalício */}
          <label className={classNames(
            'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
            lifetime ? 'border-violet-400 bg-violet-50/60' : 'border-ink-150 bg-white hover:border-ink-300'
          )}>
            <input type="checkbox" checked={lifetime} onChange={e => setLifetime(e.target.checked)} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black text-ink-900">Plano vitalício (∞)</p>
              <p className="text-[10px] text-ink-500 leading-relaxed">Acesso permanente: status Ativo, sem expiração e sem cobrança recorrente. Ignora a duração acima.</p>
            </div>
          </label>

          {/* Summary */}
          {plan && (
            <div className="bg-ink-50 rounded-xl border border-ink-100 p-4 text-xs space-y-1.5">
              <p className="text-[10px] font-black uppercase text-ink-400 tracking-widest mb-2">Resumo da Atribuição</p>
              <div className="flex justify-between"><span className="text-ink-500">Plano</span><span className="font-bold">{plan.name}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Status</span><span className="font-bold capitalize">{status}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Laudos/mês</span><span className="font-bold">{plan.reportsQuota === 0 ? 'Ilimitado' : plan.reportsQuota}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Laudos Lite/mês</span><span className="font-bold">{plan.tokenQuotaLite === 0 ? 'Ilimitado' : plan.tokenQuotaLite}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Laudos Pro/mês</span><span className="font-bold">{plan.tokenQuotaPro === 0 ? 'Ilimitado' : plan.tokenQuotaPro}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Válido por</span><span className="font-bold">{lifetime ? 'Vitalício (∞)' : `${periodDays} dias`}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Vence em</span>
                <span className="font-bold">{lifetime ? 'Nunca' : new Date(Date.now() + periodDays * 86400000).toLocaleDateString('pt-BR')}</span>
              </div>
              {isLegacy && <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                Campos de licença legada serão removidos automaticamente.
              </div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-ink-200 text-ink-700 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!plan || loading}
            className="flex items-center gap-2 h-10 px-5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isLegacy ? 'Migrar & Ativar' : 'Atribuir Plano'}
          </button>
        </div>
      </div>
    </div>
  );
}
