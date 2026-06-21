import { useState, useEffect } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { useApp } from '../../../store/app';
import {
  Users, DollarSign, AlertTriangle, TrendingDown,
  CheckCircle, Database, Calculator, Sparkles,
  Edit2, Trash2, UserCheck, ShieldAlert, Loader2, RefreshCw
} from 'lucide-react';
import { doc, updateDoc, setDoc, deleteField, getDoc } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { classNames } from '../../../utils/format';

interface PricingConfig {
  basePlanPrice: number;
  calculatorsAddonPrice: number;
}

const DEFAULT_PRICING: PricingConfig = { basePlanPrice: 149, calculatorsAddonPrice: 49 };

type StatusFilter = 'all' | 'active' | 'trialing' | 'past_due' | 'canceled';
type AddonFilter = 'all' | 'calculators' | 'pacs';

export function AdminSubscriptions() {
  const { data: users, loading: loadingUsers } = useCollection<any>('users', { isGlobal: true });
  const { data: subscriptions, loading: loadingSubs } = useCollection<any>('subscriptions', { isGlobal: true });
  const { showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [addonFilter, setAddonFilter] = useState<AddonFilter>('all');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'pricing_config'));
        if (snap.exists()) setPricing({ ...DEFAULT_PRICING, ...snap.data() });
      } catch {}
    })();
  }, []);

  if (loadingUsers || loadingSubs) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  // --- METRICS ---
  const activeSubsCount = users.filter((u: any) => u.subscriptionStatus === 'active').length;
  const pastDueCount = users.filter((u: any) => u.subscriptionStatus === 'past_due').length;
  const trialCount = users.filter((u: any) => u.subscriptionStatus === 'trialing').length;
  const canceledCount = users.filter((u: any) => u.subscriptionStatus === 'canceled').length;
  const totalWithSub = users.filter((u: any) => !!u.subscriptionStatus).length;
  const churnRate = totalWithSub > 0 ? Math.round((canceledCount / totalWithSub) * 100) : 0;

  // MRR dynamic
  let calculatedMrr = activeSubsCount * pricing.basePlanPrice;
  let addonRevenue = 0;
  subscriptions.forEach((sub: any) => {
    if (sub.status === 'active' && sub.addons?.includes('calculators')) {
      calculatedMrr += pricing.calculatorsAddonPrice;
      addonRevenue += pricing.calculatorsAddonPrice;
    }
  });

  // Filter
  const filteredUsers = users.filter((u: any) => {
    const text = `${u.name || ''} ${u.email || ''}`.toLowerCase();
    const matchText = text.includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || u.subscriptionStatus === statusFilter;
    const subId = `sub_${u.id}`;
    const sub = subscriptions.find((s: any) => s.id === subId);
    const matchAddon = addonFilter === 'all' || sub?.addons?.includes(addonFilter);
    return matchText && matchStatus && matchAddon;
  });

  const legacyUsers = users.filter((u: any) => u.licenseExpiresAt && u.licenseExpiresAt > Date.now());

  // --- ACTIONS ---
  const handleToggleMotorPro = async (userId: string, currentVal: boolean) => {
    setUpdatingUser(userId);
    try {
      const userRef = doc(firestore, 'users', userId);
      await updateDoc(userRef, { motorProEnabled: !currentVal, updatedAt: Date.now() });
      showToast('Permissão de Motor Pro alterada.', 'success');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleEditQuota = async (userId: string, currentQuota: number) => {
    const newValStr = window.prompt('Informe a nova quota de laudos mensais:', String(currentQuota));
    if (newValStr === null) return;
    const newVal = parseInt(newValStr, 10);
    if (isNaN(newVal) || newVal < 0) { showToast('Valor de quota inválido.', 'error'); return; }
    setUpdatingUser(userId);
    try {
      await updateDoc(doc(firestore, 'users', userId), { reportsQuota: newVal, updatedAt: Date.now() });
      await updateDoc(doc(firestore, 'subscriptions', `sub_${userId}`), { reportsQuota: newVal, updatedAt: Date.now() }).catch(() => {});
      showToast('Quota mensal atualizada.', 'success');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleToggleAddon = async (userId: string, addon: 'pacs' | 'calculators') => {
    setUpdatingUser(userId);
    try {
      const subId = `sub_${userId}`;
      const subRef = doc(firestore, 'subscriptions', subId);
      const sub = subscriptions.find((s: any) => s.id === subId);
      let nextAddons: string[] = sub?.addons ? [...sub.addons] : [];
      nextAddons = nextAddons.includes(addon) ? nextAddons.filter(a => a !== addon) : [...nextAddons, addon];
      await setDoc(subRef, { id: subId, userId, addons: nextAddons, updatedAt: Date.now() }, { merge: true });
      showToast(`Add-on ${addon.toUpperCase()} alterado.`, 'success');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleMigrateUser = async (u: any) => {
    if (!window.confirm(`Deseja converter o médico ${u.name} (${u.email}) para o modelo de assinaturas?`)) return;
    setUpdatingUser(u.id);
    try {
      const now = Date.now();
      const subId = `sub_${u.id}`;
      await setDoc(doc(firestore, 'subscriptions', subId), {
        id: subId, userId: u.id, userEmail: u.email, plan: 'base', addons: [],
        status: 'active', paymentMethod: 'manual',
        currentPeriodStart: now, currentPeriodEnd: u.licenseExpiresAt,
        reportsUsedThisMonth: 0, reportsQuota: u.reportsQuota || 100,
        clinicsQuota: u.clinicsQuota || 5, lastResetAt: now, createdAt: now, updatedAt: now,
      });
      await updateDoc(doc(firestore, 'users', u.id), {
        subscriptionId: subId, subscriptionStatus: 'active',
        licenseCode: deleteField(), licensePlanId: deleteField(),
        licensePlanName: deleteField(), licenseExpiresAt: deleteField(), updatedAt: now,
      });
      showToast('Médico migrado com sucesso.', 'success');
    } catch (err: any) {
      showToast('Erro na migração: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleCancelSubscription = async (userId: string) => {
    if (!window.confirm('Deseja cancelar a assinatura deste médico imediatamente?')) return;
    setUpdatingUser(userId);
    try {
      await updateDoc(doc(firestore, 'subscriptions', `sub_${userId}`), { status: 'canceled', canceledAt: Date.now() });
      await updateDoc(doc(firestore, 'users', userId), { subscriptionStatus: 'canceled' });
      showToast('Assinatura cancelada.', 'info');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setUpdatingUser(userId);
    try {
      const now = Date.now();
      const subId = `sub_${userId}`;
      await setDoc(doc(firestore, 'subscriptions', subId), {
        status: 'active', updatedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      }, { merge: true });
      await updateDoc(doc(firestore, 'users', userId), { subscriptionStatus: 'active', updatedAt: now });
      showToast('Assinatura reativada com sucesso.', 'success');
    } catch (err: any) {
      showToast('Erro ao reativar: ' + err.message, 'error');
    } finally {
      setUpdatingUser(null);
    }
  };

  function subStatusBadge(status: string | undefined) {
    const map: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700',
      trialing: 'bg-indigo-50 text-indigo-700',
      past_due: 'bg-rose-50 text-rose-700',
      canceled: 'bg-ink-100 text-ink-500',
      paused: 'bg-amber-50 text-amber-700',
    };
    const cls = map[status || ''] || 'bg-ink-100 text-ink-500';
    return <span className={classNames('px-2 py-0.5 rounded text-[9px] font-black uppercase', cls)}>{status || 'Inativo'}</span>;
  }

  return (
    <div className="space-y-6">

      {/* ─── DASHBOARD METRICS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'MRR Estimado', value: `R$ ${calculatedMrr.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Assinantes Ativos', value: activeSubsCount, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Em Atraso', value: pastDueCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Trials Ativos', value: trialCount, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Receita Add-ons', value: `R$ ${addonRevenue.toLocaleString('pt-BR')}`, icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Churn Rate', value: `${churnRate}%`, icon: TrendingDown, color: 'text-pink-600', bg: 'bg-pink-50' },
        ].map(m => (
          <div key={m.label} className="bg-white p-4 rounded-2xl border border-ink-150 shadow-sm flex items-center gap-3">
            <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', m.bg, m.color)}>
              <m.icon size={17} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-ink-500 uppercase tracking-wider truncate">{m.label}</div>
              <div className="text-base font-black text-ink-950">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── LEGACY MIGRATION ─── */}
      {legacyUsers.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="text-amber-600" size={18} />
            <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest">Migração de Contas Legadas</h3>
          </div>
          <div className="divide-y divide-amber-200/50 bg-white rounded-xl border border-amber-200 overflow-hidden">
            {legacyUsers.map((u: any) => (
              <div key={u.id} className="px-4 py-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-ink-950">{u.name || 'Médico'}</p>
                  <p className="text-[10px] text-ink-500 font-medium">
                    {u.email} • Licença: <strong>{u.licensePlanName || 'Manual'}</strong> (Expira: {new Date(u.licenseExpiresAt).toLocaleDateString('pt-BR')})
                  </p>
                </div>
                <button
                  onClick={() => handleMigrateUser(u)}
                  disabled={updatingUser === u.id}
                  className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingUser === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  Converter para Assinatura
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SUBSCRIBERS LIST ─── */}
      <div className="bg-white rounded-2xl border border-ink-150 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <h3 className="text-xs font-black text-ink-900 uppercase tracking-widest">Lista de Assinantes</h3>
          <div className="flex flex-wrap gap-2">
            {/* Status filter */}
            <div className="flex gap-1 bg-ink-50 rounded-lg p-0.5 border border-ink-100">
              {(['all', 'active', 'trialing', 'past_due', 'canceled'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={classNames('px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all',
                    statusFilter === s ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700')}>
                  {s === 'all' ? 'Todos' : s === 'past_due' ? 'Atraso' : s}
                </button>
              ))}
            </div>
            {/* Addon filter */}
            <div className="flex gap-1 bg-ink-50 rounded-lg p-0.5 border border-ink-100">
              {(['all', 'calculators', 'pacs'] as AddonFilter[]).map(a => (
                <button key={a} onClick={() => setAddonFilter(a)}
                  className={classNames('px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all',
                    addonFilter === a ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700')}>
                  {a === 'all' ? 'Add-ons' : a}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 px-3 bg-ink-50 border border-ink-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-ink-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50/50 border-b border-ink-100 text-[10px] font-black uppercase text-ink-500 tracking-wider">
                <th className="px-5 py-3.5">Nome / E-mail</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Add-ons</th>
                <th className="px-5 py-3.5">Laudos Mensais</th>
                <th className="px-5 py-3.5 text-center">Motor Pro</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-xs">
              {filteredUsers.map((u: any) => {
                const subId = `sub_${u.id}`;
                const sub = subscriptions.find((s: any) => s.id === subId);
                const used = u.reportsUsedThisMonth || 0;
                const quota = u.reportsQuota || 100;
                const pct = Math.min(100, Math.round((used / quota) * 100));
                const isCanceledOrPaused = u.subscriptionStatus === 'canceled' || u.subscriptionStatus === 'paused';

                return (
                  <tr key={u.id} className="hover:bg-ink-50/20">
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink-950">{u.name || 'Médico'}</p>
                      <p className="text-[10px] text-ink-400 font-semibold">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      {subStatusBadge(u.subscriptionStatus)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleToggleAddon(u.id, 'calculators')}
                          className={classNames(
                            "p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                            sub?.addons?.includes('calculators')
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                              : "bg-white border-ink-200 text-ink-400 hover:border-ink-300"
                          )}
                          title="Calculadoras Clínicas"
                        >
                          <Calculator size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleAddon(u.id, 'pacs')}
                          className={classNames(
                            "p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                            sub?.addons?.includes('pacs')
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                              : "bg-white border-ink-200 text-ink-400 hover:border-ink-300"
                          )}
                          title="PACS / DICOM"
                        >
                          <Database size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-ink-800">
                      <div className="space-y-1 min-w-[80px]">
                        <div className="flex items-center gap-2">
                          <span>{used} / {quota}</span>
                          <button onClick={() => handleEditQuota(u.id, quota)} className="text-ink-400 hover:text-indigo-600 transition-all cursor-pointer">
                            <Edit2 size={11} />
                          </button>
                        </div>
                        <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                          <div className={classNames('h-full rounded-full', pct >= 85 ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleToggleMotorPro(u.id, u.motorProEnabled === true)}
                        disabled={updatingUser === u.id}
                        className={classNames(
                          "w-10 h-6 rounded-full relative transition-all cursor-pointer inline-block",
                          u.motorProEnabled ? "bg-indigo-600" : "bg-ink-300"
                        )}
                      >
                        <div className={classNames(
                          "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                          u.motorProEnabled ? "left-5" : "left-1"
                        )} />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {updatingUser === u.id ? (
                          <Loader2 size={14} className="animate-spin text-brand-500" />
                        ) : (
                          <>
                            {isCanceledOrPaused ? (
                              <button
                                onClick={() => handleReactivate(u.id)}
                                className="p-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-600 transition-all cursor-pointer"
                                title="Reativar Assinatura"
                              >
                                <RefreshCw size={13} />
                              </button>
                            ) : u.subscriptionStatus && (
                              <button
                                onClick={() => handleCancelSubscription(u.id)}
                                className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-all cursor-pointer"
                                title="Cancelar Assinatura"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
