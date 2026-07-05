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
  collection, collectionGroup, doc, updateDoc, setDoc, deleteField, getDoc, getDocs, query, where,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import {
  Users, DollarSign, AlertTriangle, TrendingDown, CheckCircle, Sparkles,
  Search, Shield, ChevronDown, Trash2, Filter, Edit2, Calculator, Database,
  MoreVertical, CheckCircle2, XCircle, Loader2, RefreshCw, ShieldAlert,
  UserCheck, Zap, Plus, FileText, Check, CalendarDays, Hospital, Eye,
  TrendingUp,
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
  const [openMenu,    setOpenMenu]    = useState<string | null>(null);

  // Plans from saas_plans/
  const [saasPlansList, setSaasPlansList] = useState<SaasPlan[]>([]);
  useEffect(() => {
    getDocs(collection(firestore, 'saas_plans'))
      .then(snap => setSaasPlansList(snap.docs.map(d => ({ ...d.data(), id: d.id } as SaasPlan))))
      .catch(() => {});
  }, []);

  // Modals
  const [roleTarget,    setRoleTarget]   = useState<SystemUser | null>(null);
  const [detailTarget,  setDetailTarget] = useState<SystemUser | null>(null);
  const [statusTarget,  setStatusTarget] = useState<SystemUser | null>(null);
  const [deleteTarget,  setDeleteTarget] = useState<SystemUser | null>(null);
  const [assignTarget,  setAssignTarget] = useState<SystemUser | null>(null);
  const [assignIsLegacy, setAssignIsLegacy] = useState(false);
  const [quotaTarget,   setQuotaTarget]  = useState<SystemUser | null>(null);
  const [quotaValue,    setQuotaValue]   = useState('100');

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

  // Contagem REAL de laudos gerados no mês por usuário (collection group de
  // ai_usage). Fonte da verdade dos "laudos gerados" e do split Lite/Pro.
  type Usage = { total: number; lite: number; pro: number };
  const [usageByUid, setUsageByUid] = useState<Record<string, Usage>>({});
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const loadUsage = async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const now = new Date();
      const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      // Sem where/orderBy → não exige índice composto (só a regra de leitura
      // admin). Filtramos o mês corrente em memória. Fallback à consulta
      // indexada caso o volume cresça e a bare falhe.
      let snap;
      try {
        snap = await getDocs(collectionGroup(firestore, 'ai_usage'));
      } catch {
        snap = await getDocs(query(collectionGroup(firestore, 'ai_usage'), where('timestamp', '>=', startMs)));
      }
      const map: Record<string, Usage> = {};
      snap.forEach((d: any) => {
        const data = d.data() || {};
        if (typeof data.timestamp === 'number' && data.timestamp < startMs) return;
        const uid = d.ref.parent?.parent?.id;
        if (!uid) return;
        const isPro = /pro/i.test(String(data.model || ''));
        const u = map[uid] || (map[uid] = { total: 0, lite: 0, pro: 0 });
        u.total += 1;
        isPro ? u.pro += 1 : u.lite += 1;
      });
      setUsageByUid(map);
    } catch (err: any) {
      setUsageError(err?.code === 'permission-denied'
        ? 'Publique as regras do Firestore (firebase deploy --only firestore:rules) para ver a contagem real de laudos por usuário.'
        : (err?.code === 'failed-precondition'
          ? 'Falta o índice de ai_usage: rode firebase deploy --only firestore:indexes.'
          : (err?.message || 'Falha ao carregar a contagem de laudos.')));
    } finally {
      setUsageLoading(false);
    }
  };
  useEffect(() => { loadUsage(); }, []);

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
  // reportsUsed/quota = contador de cota (reset a cada 30d); lite/pro/geradosMes
  // = contagem REAL de laudos gerados no mês (collection group de ai_usage).
  const consumoRows = users
    .filter(u => u.role !== 'admin')
    .map(u => {
      const sub = subscriptions.find((s: any) => s.id === `sub_${u.id}`);
      const reportsUsed  = u.reportsUsedThisMonth ?? sub?.reportsUsedThisMonth ?? 0;
      const reportsQuota = u.reportsQuota ?? sub?.reportsQuota ?? 100;
      const unlimited    = reportsQuota >= 9999;
      const pct          = unlimited ? 0 : Math.min(100, Math.round((reportsUsed / Math.max(1, reportsQuota)) * 100));
      const usage        = usageByUid[u.id] || { total: 0, lite: 0, pro: 0 };
      return {
        u, sub, reportsUsed, reportsQuota, unlimited, pct,
        geradosMes: usage.total, liteUsed: usage.lite, proUsed: usage.pro,
        status: u.subscriptionStatus || (sub?.status ?? '—'),
      };
    })
    .sort((a, b) => {
      if (consumoSort === 'reports') return b.geradosMes - a.geradosMes;
      if (consumoSort === 'tokens')  return b.proUsed - a.proUsed;
      return b.pct - a.pct; // usage (default)
    });

  const totalGeradosMes  = consumoRows.reduce((acc, r) => acc + r.geradosMes, 0);
  const totalLiteMes     = consumoRows.reduce((acc, r) => acc + r.liteUsed, 0);
  const totalProMes      = consumoRows.reduce((acc, r) => acc + r.proUsed, 0);
  const nearLimitCount   = consumoRows.filter(r => !r.unlimited && r.pct >= 80).length;
  const exhaustedCount   = consumoRows.filter(r => !r.unlimited && r.reportsUsed >= r.reportsQuota).length;
  const avgUsagePct      = consumoRows.length ? Math.round(consumoRows.filter(r => !r.unlimited).reduce((a, r) => a + r.pct, 0) / Math.max(1, consumoRows.filter(r => !r.unlimited).length)) : 0;

  // ─── Distribuições para o dashboard (Visão Geral) ─────────────────────────────
  const noSubCount = users.filter(u => u.role !== 'admin' && !u.subscriptionStatus).length;
  const lifetimeCount = subscriptions.filter((s: any) => s.lifetime === true).length;

  const statusDist = [
    { key: 'active',   label: 'Ativos',     value: activeCount,   color: 'bg-emerald-500', text: 'text-emerald-700' },
    { key: 'trialing', label: 'Trial',      value: trialCount,    color: 'bg-amber-500',   text: 'text-amber-700'   },
    { key: 'past_due', label: 'Em atraso',  value: pastDueCount,  color: 'bg-rose-500',    text: 'text-rose-700'    },
    { key: 'canceled', label: 'Cancelados', value: canceledCount, color: 'bg-ink-400',     text: 'text-ink-500'     },
    { key: 'none',     label: 'Sem plano',  value: noSubCount,    color: 'bg-ink-200',     text: 'text-ink-400'     },
  ];
  const statusTotal = Math.max(1, statusDist.reduce((a, s) => a + s.value, 0));

  // Assinantes por plano (usa nome do saas_plans quando disponível)
  const planCounts: Record<string, number> = {};
  subscriptions.forEach((s: any) => {
    if (s.status === 'canceled' || s.status === 'paused') return;
    const plan = saasPlansList.find(p => p.id === s.planId);
    const name = plan?.name || s.plan || 'Sem plano';
    planCounts[name] = (planCounts[name] || 0) + 1;
  });
  const planDist = Object.entries(planCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const planTotal = Math.max(1, planDist.reduce((a, p) => a + p.value, 0));

  // Adoção de add-ons
  const addonAdoption = [
    { key: 'calculators',  label: 'Calculadoras', icon: Calculator },
    { key: 'pacs',         label: 'PACS / DICOM', icon: Database },
    { key: 'appointments', label: 'Agendamentos', icon: CalendarDays },
    { key: 'clinics',      label: 'Clínicas',     icon: Hospital },
  ].map(a => ({ ...a, value: subscriptions.filter((s: any) => s.addons?.includes(a.key)).length }));
  const addonBase = Math.max(1, activeCount);

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

  // Abre o editor de cota (modal). Cota única de laudos LAUD.IA (reportsQuota).
  function handleEditQuota(u: SystemUser) {
    setQuotaTarget(u);
    setQuotaValue(String(u.reportsQuota ?? 100));
  }

  async function handleSaveQuota() {
    if (!quotaTarget) return;
    const n = parseInt(quotaValue, 10);
    if (isNaN(n) || n < 0) { showToast('Valor inválido.', 'error'); return; }
    const u = quotaTarget;
    setQuotaTarget(null);
    await run(u.id, async () => {
      await updateDoc(doc(firestore, 'users', u.id), { reportsQuota: n, updatedAt: Date.now() });
      await updateDoc(doc(firestore, 'subscriptions', `sub_${u.id}`), { reportsQuota: n, updatedAt: Date.now() }).catch(() => {});
      showToast('Cota de laudos atualizada.', 'success');
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

  const TABS: { id: UsersTab; label: string; icon: any; desc: string; count?: number; badge?: number }[] = [
    { id: 'overview', label: 'Visão Geral', icon: TrendingDown, desc: 'Receita, churn e saúde da base' },
    { id: 'users',    label: 'Usuários',    icon: Users,        desc: 'Gestão de planos e add-ons', count: users.length },
    { id: 'consumo',  label: 'Consumo',     icon: Zap,          desc: 'Uso de laudos e tokens', count: consumoRows.length, badge: nearLimitCount },
  ];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── PAGE HEADER ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <UserCheck size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-ink-950 tracking-tight leading-none">Usuários & Planos</h2>
            <p className="text-[11px] text-ink-500 font-medium mt-1">
              {users.length} usuário(s) · {activeDisplay} ativo(s) · {trialCount} em trial
            </p>
          </div>
        </div>
        {legacyUsers.length > 0 && (
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
          >
            <ShieldAlert size={13} /> {legacyUsers.length} conta(s) legada(s)
          </button>
        )}
      </div>

      {/* ── TAB NAV ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {TABS.map(t => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={classNames(
                'group flex items-center gap-3 p-3 rounded-2xl border text-left transition-all',
                on
                  ? 'bg-white border-brand-300 shadow-md ring-1 ring-brand-200/50'
                  : 'bg-white/60 border-ink-100 hover:border-ink-200 hover:bg-white',
              )}
            >
              <div className={classNames(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                on ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500 group-hover:bg-ink-200',
              )}>
                <t.icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={classNames('text-xs font-black', on ? 'text-brand-700' : 'text-ink-800')}>{t.label}</span>
                  {typeof t.count === 'number' && (
                    <span className={classNames('text-[9px] font-black px-1.5 py-0.5 rounded-full', on ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500')}>{t.count}</span>
                  )}
                  {!!t.badge && t.badge > 0 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Perto do limite">{t.badge} ⚠</span>
                  )}
                </div>
                <p className="text-[10px] text-ink-400 font-medium truncate">{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (<>

      {/* ── HERO KPIs (receita) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: summary ? 'Receita Recorrente (MRR)' : 'MRR (estimado local)', value: `R$ ${mrrDisplay.toLocaleString('pt-BR')}`, sub: 'por mês',   icon: DollarSign,   grad: 'from-emerald-500 to-teal-600' },
          { label: 'Receita Anual (ARR)', value: `R$ ${arr.toLocaleString('pt-BR')}`, sub: 'projeção 12m', icon: TrendingUp,   grad: 'from-brand-500 to-indigo-600' },
          { label: 'Receita por Usuário', value: `R$ ${arpu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'ARPU', icon: Users, grad: 'from-violet-500 to-purple-600' },
          { label: 'Taxa de Cancelamento', value: `${churnRate}%`, sub: `${canceledCount} cancelados`, icon: TrendingDown, grad: 'from-rose-500 to-pink-600' },
        ].map(m => (
          <div key={m.label} className={classNames('relative overflow-hidden rounded-2xl p-4 text-white shadow-md bg-gradient-to-br', m.grad)}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/80 truncate">{m.label}</div>
                <div className="text-2xl font-black mt-1 tracking-tight truncate">{m.value}</div>
                <div className="text-[10px] font-bold text-white/70 mt-0.5">{m.sub}</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <m.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── SECONDARY STATS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Ativos',      value: activeDisplay,  icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Trials',      value: trialCount,     icon: Sparkles,      color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Em Atraso',   value: pastDueCount,   icon: AlertTriangle, color: 'text-rose-600',    bg: 'bg-rose-50'    },
          { label: 'Vitalícios',  value: lifetimeCount,  icon: Zap,           color: 'text-violet-600',  bg: 'bg-violet-50'  },
          { label: 'Sem Plano',   value: noSubCount,     icon: XCircle,       color: 'text-ink-400',     bg: 'bg-ink-50'     },
          { label: 'Total',       value: users.length,   icon: Users,         color: 'text-teal-600',    bg: 'bg-teal-50'    },
        ].map(m => (
          <div key={m.label} className="bg-white p-3.5 rounded-2xl border border-ink-100 shadow-sm flex items-center gap-3">
            <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', m.bg, m.color)}>
              <m.icon size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-ink-500 uppercase tracking-wider truncate">{m.label}</div>
              <div className="text-lg font-black text-ink-950 truncate leading-none mt-0.5">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── DISTRIBUIÇÕES ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status da base */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h3 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4">Distribuição da Base</h3>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-ink-50">
            {statusDist.filter(s => s.value > 0).map(s => (
              <div key={s.key} className={s.color} style={{ width: `${(s.value / statusTotal) * 100}%` }} title={`${s.label}: ${s.value}`} />
            ))}
          </div>
          <div className="space-y-2.5">
            {statusDist.map(s => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className={classNames('w-2.5 h-2.5 rounded-sm shrink-0', s.color)} />
                <span className="text-ink-600 font-medium flex-1">{s.label}</span>
                <span className="font-black text-ink-900 tabular-nums">{s.value}</span>
                <span className="text-[10px] text-ink-400 font-bold tabular-nums w-9 text-right">{Math.round((s.value / statusTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assinantes por plano */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h3 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4">Assinantes por Plano</h3>
          {planDist.length === 0 ? (
            <p className="text-xs text-ink-400 font-medium py-6 text-center">Nenhuma assinatura ativa.</p>
          ) : (
            <div className="space-y-3">
              {planDist.map((p, i) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-700 font-bold truncate max-w-[140px]">{p.name}</span>
                    <span className="font-black text-ink-900 tabular-nums">{p.value}</span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className={classNames('h-full rounded-full', ['bg-brand-500', 'bg-indigo-500', 'bg-violet-500', 'bg-teal-500', 'bg-amber-500'][i % 5])} style={{ width: `${(p.value / planTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Adoção de add-ons + consumo */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <h3 className="text-[11px] font-black text-ink-700 uppercase tracking-widest mb-4">Adoção de Add-ons</h3>
          <div className="space-y-3">
            {addonAdoption.map(a => (
              <div key={a.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-700 font-bold flex items-center gap-1.5"><a.icon size={12} className="text-ink-400" /> {a.label}</span>
                  <span className="font-black text-ink-900 tabular-nums">{a.value}</span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (a.value / addonBase) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-ink-50">
            <div className="text-center">
              <div className="text-lg font-black text-ink-900">{avgUsagePct}%</div>
              <div className="text-[9px] font-black text-ink-400 uppercase tracking-wider">Uso médio de laudos</div>
            </div>
            <div className="text-center">
              <div className={classNames('text-lg font-black', nearLimitCount > 0 ? 'text-amber-600' : 'text-ink-900')}>{nearLimitCount}</div>
              <div className="text-[9px] font-black text-ink-400 uppercase tracking-wider">Perto do limite</div>
            </div>
          </div>
        </div>
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

      {/* ── USER TABLE (enxuta e profissional) ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50/50 border-b border-ink-100 text-[10px] font-black uppercase text-ink-400 tracking-wider">
                <th className="px-5 py-3.5">Usuário</th>
                <th className="px-5 py-3.5">Cargo</th>
                <th className="px-5 py-3.5">Plano &amp; Status</th>
                <th className="px-5 py-3.5 min-w-[180px]">Consumo de laudos</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-ink-400 text-sm">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const sub    = subscriptions.find((s: any) => s.id === `sub_${u.id}`);
                const isProc = processing === u.id;
                const used   = u.reportsUsedThisMonth || 0;
                const quota  = u.reportsQuota         || 100;

                // Direitos ativos (somente leitura aqui — edição fica no menu ⋯).
                const ents = [
                  { on: sub?.addons?.includes('calculators'),  icon: Calculator,   label: 'Calculadoras', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                  { on: sub?.addons?.includes('pacs'),         icon: Database,     label: 'PACS',         cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                  { on: sub?.addons?.includes('appointments'), icon: CalendarDays, label: 'Agendamentos', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
                  { on: sub?.addons?.includes('clinics'),      icon: Hospital,     label: 'Clínicas',     cls: 'bg-teal-50 text-teal-600 border-teal-100' },
                  { on: u.motorProEnabled,                     icon: Sparkles,     label: 'Motor Pro',    cls: 'bg-violet-50 text-violet-600 border-violet-100' },
                ].filter(e => e.on);

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-ink-50/40 transition-colors cursor-pointer group"
                    onClick={() => setDetailTarget(u)}
                    title="Abrir visão 360º"
                  >
                    {/* Usuário */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={classNames(
                          'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border shrink-0',
                          u.active !== false ? 'bg-brand-50 text-brand-600 border-brand-100' : 'bg-ink-100 text-ink-400 border-ink-200'
                        )}>
                          {(u.name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-ink-900 group-hover:text-brand-700 transition-colors truncate max-w-[200px]">{u.name || 'Sem nome'}</p>
                          <p className="text-[10px] text-ink-400 font-medium truncate max-w-[200px]">{u.email}</p>
                        </div>
                        {u.active === false && (
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 border border-rose-100 shrink-0">Inativa</span>
                        )}
                      </div>
                    </td>

                    {/* Cargo */}
                    <td className="px-5 py-4">
                      <span className={classNames(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border',
                        u.role === 'admin'  ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        u.role === 'medico' ? 'bg-brand-50 text-brand-700 border-brand-200' :
                        'bg-ink-50 text-ink-600 border-ink-200'
                      )}>
                        <Shield size={10} /> {u.role}
                      </span>
                    </td>

                    {/* Plano & Status */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {subBadge(u.subscriptionStatus)}
                        {sub?.plan && <span className="text-[10px] font-bold text-ink-600 truncate max-w-[110px]">{sub.plan}</span>}
                        {!u.subscriptionStatus && (
                          <button
                            onClick={() => { setAssignIsLegacy(false); setAssignTarget(u); }}
                            className="text-[9px] font-black uppercase flex items-center gap-0.5 text-brand-600 hover:text-brand-800 transition-colors"
                          >
                            <Plus size={9} /> Atribuir
                          </button>
                        )}
                      </div>
                      {ents.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {ents.map(e => (
                            <span key={e.label} title={e.label} className={classNames('w-5 h-5 rounded-md border flex items-center justify-center', e.cls)}>
                              <e.icon size={11} />
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Consumo */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      {quotaBar(used, quota)}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                      {isProc ? (
                        <Loader2 size={16} className="animate-spin text-brand-500 ml-auto" />
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setDetailTarget(u)}
                            title="Visão 360º"
                            className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                          >
                            <Eye size={16} />
                          </button>
                          <div className="relative inline-block">
                            <button
                              onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                              title="Gerenciar"
                              className="p-2 text-ink-400 hover:bg-ink-100 rounded-xl transition-all"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenu === u.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                                <div className="absolute right-0 top-full z-50 bg-white rounded-xl border border-ink-200 shadow-xl mt-1 min-w-[230px] py-1 text-xs">
                                  <MenuItem icon={Eye}          label="Ver visão 360º"        onClick={() => { setOpenMenu(null); setDetailTarget(u); }} color="indigo" />
                                  <MenuItem icon={FileText}     label={u.subscriptionStatus ? 'Trocar Plano' : 'Atribuir Plano'} onClick={() => { setOpenMenu(null); setAssignIsLegacy(false); setAssignTarget(u); }} color="indigo" />
                                  <MenuItem icon={Edit2}        label="Editar cota de laudos" onClick={() => { setOpenMenu(null); handleEditQuota(u); }} />
                                  <hr className="border-ink-100 my-1" />
                                  <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-ink-300">Direitos</div>
                                  <MenuItem icon={Calculator}   label={`${sub?.addons?.includes('calculators') ? 'Remover' : 'Ativar'} Calculadoras`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'calculators'); }} color="indigo" />
                                  <MenuItem icon={Database}     label={`${sub?.addons?.includes('pacs') ? 'Remover' : 'Ativar'} PACS / DICOM`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'pacs'); }} color="emerald" />
                                  <MenuItem icon={CalendarDays} label={`${sub?.addons?.includes('appointments') ? 'Remover' : 'Ativar'} Agendamentos`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'appointments'); }} color="amber" />
                                  <MenuItem icon={Hospital}     label={`${sub?.addons?.includes('clinics') ? 'Remover' : 'Ativar'} Clínicas`} onClick={() => { setOpenMenu(null); handleToggleAddon(u, 'clinics'); }} color="teal" />
                                  <MenuItem icon={Sparkles}     label={`${u.motorProEnabled ? 'Desativar' : 'Ativar'} Motor Pro`} onClick={() => handleToggleMotorPro(u)} color="violet" />
                                  <hr className="border-ink-100 my-1" />
                                  <MenuItem icon={Shield}       label="Alterar cargo"          onClick={() => { setOpenMenu(null); setRoleTarget(u); }} />
                                  <MenuItem icon={CheckCircle2} label={u.active !== false ? 'Desativar conta' : 'Ativar conta'} onClick={() => { setOpenMenu(null); setStatusTarget(u); }} />
                                  {(u.subscriptionStatus === 'canceled' || u.subscriptionStatus === 'paused') ? (
                                    <MenuItem icon={RefreshCw}  label="Reativar assinatura"    onClick={() => handleReactivate(u)} color="emerald" />
                                  ) : u.subscriptionStatus && u.subscriptionStatus !== 'canceled' ? (
                                    <MenuItem icon={Trash2}     label="Cancelar assinatura"    onClick={() => handleCancelSub(u)} color="rose" />
                                  ) : null}
                                  <hr className="border-ink-100 my-1" />
                                  <MenuItem icon={Trash2}       label="Excluir usuário"        onClick={() => { setOpenMenu(null); setDeleteTarget(u); }} color="rose" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {activeTab === 'consumo' && (<>

      {/* ── CONSUMO: MÉTRICAS (contagem real de ai_usage) ──────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Laudos gerados (mês)', value: totalGeradosMes.toLocaleString('pt-BR'), icon: FileText,      color: 'text-brand-600',   bg: 'bg-brand-50'   },
          { label: 'Lite (mês)',           value: totalLiteMes.toLocaleString('pt-BR'),    icon: Zap,           color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
          { label: 'Pro (mês)',            value: totalProMes.toLocaleString('pt-BR'),     icon: Sparkles,      color: 'text-violet-600',  bg: 'bg-violet-50'  },
          { label: 'Usuários rastreados',  value: consumoRows.length,                      icon: Users,         color: 'text-teal-600',    bg: 'bg-teal-50'    },
          { label: 'Perto do limite',      value: nearLimitCount,                          icon: AlertTriangle, color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Cota esgotada',        value: exhaustedCount,                          icon: XCircle,       color: 'text-rose-600',    bg: 'bg-rose-50'    },
        ].map(m => (
          <div key={m.label} className="bg-white p-3.5 rounded-2xl border border-ink-100 shadow-sm flex items-center gap-3">
            <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', m.bg, m.color)}>
              <m.icon size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-ink-500 uppercase tracking-wider truncate">{m.label}</div>
              <div className="text-lg font-black text-ink-950 truncate leading-none mt-0.5">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {usageError && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-[11px]">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <span className="text-amber-800 font-medium">{usageError} A cota mensal continua exibida normalmente.</span>
        </div>
      )}

      {/* ── CONSUMO: ORDENAÇÃO + REFRESH ───────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black text-ink-500 uppercase tracking-wider">Ordenar por</span>
        {([
          { id: 'usage',   label: '% da cota' },
          { id: 'reports', label: 'Laudos gerados' },
          { id: 'tokens',  label: 'Laudos Pro' },
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
        <div className="flex-1" />
        <button
          onClick={loadUsage}
          disabled={usageLoading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 disabled:opacity-50 transition-all"
        >
          <RefreshCw size={12} className={usageLoading ? 'animate-spin' : ''} /> Atualizar contagem
        </button>
      </div>

      {/* ── CONSUMO: TABELA ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-100 text-[10px] font-black text-ink-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 min-w-[170px]">Cota de laudos (uso / cota)</th>
                <th className="text-right px-4 py-3">Gerados (mês)</th>
                <th className="text-right px-4 py-3">Lite</th>
                <th className="text-right px-4 py-3">Pro</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {consumoRows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400 font-medium">Nenhum usuário com consumo registrado.</td></tr>
              )}
              {consumoRows.map(({ u, reportsUsed, reportsQuota, unlimited, pct, geradosMes, liteUsed, proUsed, status }) => {
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
                        <div className="min-w-[150px]">
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
                    <td className="px-4 py-3 text-right font-black text-ink-900">{geradosMes.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{liteUsed.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-bold text-violet-700">{proUsed.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleEditQuota(u)}
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
        <div className="px-4 py-2.5 border-t border-ink-50 text-[10px] text-ink-400 font-medium flex items-center gap-1.5">
          <FileText size={11} /> "Gerados/Lite/Pro" = contagem real de laudos deste mês (ai_usage). "Cota" = contador que reseta a cada 30 dias e rege o bloqueio.
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

      {/* Editar cota de laudos LAUD.IA */}
      <Modal open={quotaTarget !== null} onClose={() => setQuotaTarget(null)} title="Cota de Laudos LAUD.IA" size="sm">
        {quotaTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-500">
              Cota mensal de laudos de <strong>{quotaTarget.name || quotaTarget.email}</strong>. Vale para Lite e Pro (cota única).
            </p>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-ink-400 block mb-1">Laudos por mês</label>
              <input
                type="number"
                min={0}
                autoFocus
                value={quotaValue}
                onChange={e => setQuotaValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveQuota(); }}
                className="input h-11 text-sm w-full font-black"
              />
              <p className="text-[10px] text-ink-400 mt-1">Use 0 para ilimitado. Atual: {quotaTarget.reportsQuota ?? 100}.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setQuotaTarget(null)} className="h-10 px-4 rounded-xl border border-ink-200 text-ink-700 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all">Cancelar</button>
              <button onClick={handleSaveQuota} className="h-10 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
                <Check size={13} /> Salvar cota
              </button>
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
                        {p.reportsQuota === 0 ? '∞' : p.reportsQuota} laudos LAUD.IA/mês
                      </span>
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
              <div className="flex justify-between"><span className="text-ink-500">Laudos LAUD.IA/mês</span><span className="font-bold">{plan.reportsQuota === 0 ? 'Ilimitado' : plan.reportsQuota}</span></div>
              {plan.motorProDefault && (
                <div className="flex justify-between"><span className="text-ink-500">Motor Pro</span><span className="font-bold text-violet-600">Incluído</span></div>
              )}
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
