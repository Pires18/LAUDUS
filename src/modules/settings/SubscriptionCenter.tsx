import { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { useSubscription } from '../../hooks/useSubscription';
import { useConfirm } from '../../hooks/useConfirm';
import { useApp } from '../../store/app';
import { createSupportTicket, getAiUsageStats } from '../../store/db';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firestore, auth } from '../../lib/firebase';
import { classNames } from '../../utils/format';
import { planPriceBrl, addonPriceBrl } from '../../../api/_pricing';
import {
  CreditCard, QrCode, Database, Calculator, Loader2, CheckCircle2,
  AlertCircle, Clock, Ban, Zap, Lock, Sparkles, FileText, Wallet,
  Building2, RefreshCw, ChevronDown, ChevronUp,
  Package, ShieldCheck, Calendar, TrendingUp, CalendarDays, Hospital, Plus,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LaudoStats {
  liteCount: number;
  proCount:  number;
}

interface AddonsConfig {
  calculators?:  { price: number; description: string; enabled: boolean };
  pacs?:         { price: number; description: string; enabled: boolean; assisted?: boolean };
  appointments?: { price: number; description: string; enabled: boolean };
  clinics?:      { price: number; description: string; enabled: boolean };
  extraReport?:  { price: number; description: string; enabled: boolean };
  extraClinic?:  { price: number; description: string; enabled: boolean };
  tokenLite?:    { price: number; bundleSize: number; description: string; enabled: boolean };
  tokenPro?:     { price: number; bundleSize: number; description: string; enabled: boolean };
}

const ADDONS_DEFAULT: AddonsConfig = {
  calculators: { price: 49,    description: 'Calculadoras clínicas integradas ao editor.',        enabled: true },
  pacs:        { price: 0,     description: 'PACS/DICOM com worklist e sincronização de exames.', enabled: true },
  appointments: { price: 39,   description: 'Agendamentos e gestão de agenda do médico.',          enabled: true },
  clinics:     { price: 49,    description: 'Módulo de clínicas para multi-unidades.',             enabled: true },
  extraReport: { price: 1.50,  description: 'Laudo extra além da quota (inclui 1 Token Lite/Pro).', enabled: true },
  extraClinic: { price: 29,    description: 'Clínica extra além da quota do plano.',              enabled: true },
  tokenLite:   { price: 9.90,  bundleSize: 50,  description: 'Pacote de laudos adicionais do LAUD.IA (usável no Lite ou Pro).', enabled: true },
  tokenPro:    { price: 24.90, bundleSize: 20,  description: 'Descontinuado — unificado no Pacote de Laudos LAUD.IA.',        enabled: false },
};

// Tiers de PACS (infra) — fallback caso o admin ainda não tenha publicado
// global_config/pacs_plans. Espelha os defaults do MyPacsCard/PacsPlansTab.
const PACS_TIERS_DEFAULT: Record<string, any> = {
  starter:  { label: 'Starter',  prices: { month: 99,  semester: 534,  year: 950  }, disk: 100, model: 'Compartilhado isolado', active: true },
  pro:      { label: 'Pro',      prices: { month: 149, semester: 804,  year: 1430 }, disk: 300, model: 'Compartilhado isolado', badge: 'Popular', active: true },
  dedicado: { label: 'Dedicado', prices: { month: 249, semester: 1344, year: 2390 }, disk: 300, model: 'VM exclusiva', active: true },
};
const PACS_TIER_ORDER = ['starter', 'pro', 'dedicado'] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export function SubscriptionCenter() {
  const {
    subscription, isActive, isTrialing, isPastDue, isCanceled,
    hasCalculators, hasPacs, hasAppointments, hasClinics, reportsUsed, reportsQuota, reportsRemaining,
    trialDaysLeft, motorProEnabled, motorOptions,
  } = useSubscription();

  const { user, showToast, settings, updateSettings } = useApp();
  const confirm = useConfirm();

  const [loadingAddon,      setLoadingAddon]      = useState<string | null>(null);
  const [planInterval,      setPlanInterval]      = useState<'month' | 'semester' | 'year'>('month');
  const [addonInterval,     setAddonInterval]     = useState<'month' | 'semester' | 'year'>('month');
  const addonMult = addonInterval === 'year' ? 12 : addonInterval === 'semester' ? 6 : 1;
  const addonPer = addonInterval === 'year' ? 'ano' : addonInterval === 'semester' ? 'semestre' : 'mês';
  // Usa os preços explícitos por intervalo do módulo (admin) quando existirem;
  // senão projeta do mensal (×1/×6/×12).
  const addonPriceMeta = (meta: any, fallbackBase: number) => {
    const brl = meta?.prices ? addonPriceBrl(meta, addonInterval) : (meta?.price ?? fallbackBase) * addonMult;
    return `R$ ${brl.toFixed(2).replace('.', ',')}/${addonPer}`;
  };
  const [sendingPacsTicket, setSendingPacsTicket] = useState(false);
  const [pacsRequested,     setPacsRequested]     = useState(false);
  const [pacsTiers,         setPacsTiers]         = useState<Record<string, any>>(PACS_TIERS_DEFAULT);
  const [savingPacsTier,    setSavingPacsTier]    = useState(false);
  const [showHistory,       setShowHistory]       = useState(true);
  const [laudoStats,        setLaudoStats]        = useState<LaudoStats>({ liteCount: 0, proCount: 0 });
  const [loadingStats,      setLoadingStats]      = useState(false);
  const [addonsConfig,      setAddonsConfig]      = useState<AddonsConfig>(ADDONS_DEFAULT);
  const [planName,          setPlanName]          = useState<string | null>(null);
  
  const [plansList, setPlansList] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // ── Load add-ons pricing from admin config ────────────────────────────────
  useEffect(() => {
    getDoc(doc(firestore, 'global_config', 'addons_config'))
      .then(snap => { if (snap.exists()) setAddonsConfig({ ...ADDONS_DEFAULT, ...snap.data() }); })
      .catch(() => {});
  }, []);

  // ── Load PACS tiers (starter/pro/dedicado) from admin config ──────────────
  useEffect(() => {
    getDoc(doc(firestore, 'global_config', 'pacs_plans'))
      .then(snap => { if (snap.exists()) setPacsTiers({ ...PACS_TIERS_DEFAULT, ...(snap.data() as any) }); })
      .catch(() => {});
  }, []);

  // ── Load plan name from saas_plans ───────────────────────────────────────
  useEffect(() => {
    const planId = (subscription as any)?.planId;
    if (planId) {
      getDoc(doc(firestore, 'saas_plans', planId))
        .then(snap => { if (snap.exists()) setPlanName(snap.data().name); })
        .catch(() => {});
    }
  }, [subscription]);

  // ── Load active plans from saas_plans ────────────────────────────────────
  useEffect(() => {
    const q = query(collection(firestore, 'saas_plans'), where('active', '==', true));
    getDocs(q)
      .then(snap => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        list.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        setPlansList(list);
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // ── Load user transactions from transactions ────────────────────────────
  const fetchUserTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTransactions(true);
    try {
      const q = query(collection(firestore, 'transactions'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setUserTransactions(list);
    } catch (err) {
      logger.error('Erro ao buscar transações do usuário:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserTransactions();
  }, [fetchUserTransactions]);

  // ── PACS request state ────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      if (localStorage.getItem(`pacs_requested_${user.uid}`)) setPacsRequested(true);
    }
  }, [user]);

  // ── AI usage stats (1 laudo = 1 token Lite ou Pro) ───────────────────────
  const fetchLaudoStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const now   = new Date();
      // Filtra o consumo a partir do início do ciclo mensal da assinatura (lastResetAt)
      let start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      if (subscription?.lastResetAt) {
        start = subscription.lastResetAt;
      } else if (subscription?.currentPeriodStart) {
        start = subscription.currentPeriodStart;
      }
      
      const logs  = await getAiUsageStats(start, Date.now());
      setLaudoStats({
        liteCount: logs.filter(l => (l.model || '').toLowerCase().includes('flash')).length,
        proCount:  logs.filter(l => (l.model || '').toLowerCase().includes('pro')).length,
      });
    } finally { setLoadingStats(false); }
  }, [subscription]);

  useEffect(() => { fetchLaudoStats(); }, [fetchLaudoStats]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleBuyAddon = async (addon: string) => {
    if (!user) return;
    setLoadingAddon(addon);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/abacatepay-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ userId: user.uid, email: user.email, type: 'addon', addon, interval: addonInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar checkout.');
      if (data.mock) {
        showToast('Modo simulado: redirecionando para ativação de teste...', 'info');
      } else {
        showToast('Redirecionando para o pagamento seguro...', 'info');
      }
      window.location.href = data.url;
    } catch (err: any) {
      showToast(err.message || 'Falha ao processar compra. Verifique se o AbacatePay está configurado no admin.', 'error');
      setLoadingAddon(null);
    }
  };

  const handleBuyPlan = async (planId: string) => {
    if (!user) return;
    setLoadingAddon(planId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/abacatepay-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ userId: user.uid, email: user.email, type: 'subscription', planId, interval: planInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar checkout.');
      if (data.mock) {
        showToast('Modo simulado: redirecionando para ativação de teste...', 'info');
      } else {
        showToast('Redirecionando para o pagamento seguro...', 'info');
      }
      window.location.href = data.url;
    } catch (err: any) {
      showToast(err.message || 'Falha ao processar assinatura. Verifique se o AbacatePay está configurado no admin.', 'error');
      setLoadingAddon(null);
    }
  };

  // Escolha do tier de PACS do pacote — salva em settings.pacsSelectedPlan
  // (mesma fonte de verdade do card 'Meu PACS na Nuvem' na área DICOM).
  const handleChoosePacsTier = async (tier: 'starter' | 'pro' | 'dedicado') => {
    if (settings.pacsSelectedPlan === tier) return;
    setSavingPacsTier(true);
    try {
      await updateSettings({ pacsSelectedPlan: tier });
      showToast(`Plano PACS ${pacsTiers[tier]?.label || tier} selecionado para o seu pacote.`, 'success');
    } catch {
      showToast('Não foi possível salvar o plano PACS escolhido.', 'error');
    } finally { setSavingPacsTier(false); }
  };

  const handleRequestPacs = async () => {
    if (!user) return;
    setSendingPacsTicket(true);
    try {
      await createSupportTicket({
        userId:   user.uid,
        userName: user.displayName || user.email || 'Médico',
        subject:  'Solicitação de Add-on PACS / DICOM',
        message:  'Gostaria de ativar o add-on PACS/DICOM no meu plano de assinatura.',
        priority: 'medium',
        status:   'open',
        type:     'pacs_request',
      });
      setPacsRequested(true);
      localStorage.setItem(`pacs_requested_${user.uid}`, 'true');
      showToast('Solicitação enviada! Nosso suporte entrará em contato.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Falha ao enviar solicitação.', 'error');
    } finally { setSendingPacsTicket(false); }
  };

  const handleCancel = async () => {
    if (!subscription || !user) return;
    const ok = await confirm({
      title: 'Cancelar assinatura',
      message: 'Deseja cancelar a assinatura? O acesso à LAUD.IA continua até o fim do período já pago e a cobrança recorrente é encerrada.',
      variant: 'danger',
      confirmLabel: 'Cancelar assinatura',
      cancelLabel: 'Manter',
    });
    if (!ok) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/abacatepay-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ userId: user.uid, subscriptionId: subscription.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao cancelar.');
      if (data.gatewayCancelPending) {
        showToast('Assinatura cancelada. A cobrança recorrente será encerrada pelo suporte em breve.', 'info');
      } else {
        showToast('Assinatura cancelada com sucesso.', 'info');
      }
    } catch (err: any) { showToast(err.message || 'Falha ao cancelar.', 'error'); }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const canUsePro      = motorOptions.includes('pro');
  const selectedMotor  = (settings as any).selectedMotor || 'lite';

  const reportsPercent  = reportsQuota > 0 ? Math.min(100, Math.round((reportsUsed  / reportsQuota)  * 100)) : 0;
  const isHighUsage     = reportsPercent >= 85;

  // O split Lite/Pro vem do ai_usage (janela de mês calendário), que pode não
  // bater com `reportsUsed` (o contador oficial, que trava a cota e aparece
  // em todo o resto do app — badge do editor, Dashboard, Admin). Normaliza a
  // proporção Lite/Pro do ai_usage sobre o total real, para que "Total este
  // mês" aqui NUNCA divirja do número mostrado em qualquer outra tela.
  const laudoStatsTotal = laudoStats.liteCount + laudoStats.proCount;
  const proShare  = laudoStatsTotal > 0 ? laudoStats.proCount / laudoStatsTotal : 0;
  const proUsed   = Math.round(reportsUsed * proShare);
  const liteUsed  = reportsUsed - proUsed;

  const displayPlanName = planName || subscription?.plan || 'Base';
  const nextReset = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
    : null;

  const statusLabel = isPastDue ? 'Em Atraso' : isTrialing ? 'Trial' : isCanceled ? 'Cancelada' : isActive ? 'Ativa' : 'Inativa';
  const statusColor = isPastDue ? 'bg-rose-100 text-rose-700'
    : isTrialing  ? 'bg-indigo-100 text-indigo-700'
    : isCanceled  ? 'bg-amber-100 text-amber-700'
    : isActive    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-ink-200 text-ink-600';

  const ac = addonsConfig;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

      {/* ═══ COMPARTIVO DE PLANOS (CASO INATIVO / SEM ASSINATURA) ═══════════════ */}
      {(!subscription || isCanceled) && plansList.length > 0 && (
        <div className="space-y-4">
          <SectionHeader icon={Sparkles} title="Escolha seu Plano de Assinatura" />

          {/* Seletor de intervalo — cada plano cobre os 3 (mensal/semestral/anual) */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 bg-ink-100 p-1 rounded-2xl border border-ink-200">
              {([
                { iv: 'month'    as const, label: 'Mensal',    hint: '↻ Recorrente' },
                { iv: 'semester' as const, label: 'Semestral', hint: '' },
                { iv: 'year'     as const, label: 'Anual',     hint: '' },
              ]).map(o => (
                <button
                  key={o.iv}
                  onClick={() => setPlanInterval(o.iv)}
                  className={classNames(
                    'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5',
                    planInterval === o.iv ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'
                  )}
                >
                  {o.label}
                  {o.hint && <span className={classNames('text-[8px] font-black px-1 rounded', planInterval === o.iv ? 'bg-white/20' : o.iv === 'month' ? 'text-indigo-500' : 'text-emerald-600')}>{o.hint}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plansList.map((p) => {
              const isSelected = (subscription as any)?.planId === p.id;
              const isFeatured = p.featured;

              return (
                <div
                  key={p.id}
                  className={classNames(
                    'bg-white rounded-2xl border p-5 flex flex-col justify-between relative shadow-sm hover:border-brand-300 transition-all',
                    isFeatured ? 'border-indigo-400 ring-1 ring-indigo-300/30' : 'border-ink-150'
                  )}
                >
                  {isFeatured && (
                    <div className="absolute -top-2.5 left-5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">
                      Recomendado
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-black text-ink-950">{p.name}</h4>
                    {p.description && <p className="text-[10px] text-ink-400 font-medium leading-relaxed mt-0.5">{p.description}</p>}

                    {(() => {
                      const pv = planPriceBrl(p, planInterval);
                      const installments = planInterval === 'year' ? 12 : planInterval === 'semester' ? 6 : 1;
                      const monthlyEquivalent = pv / installments;
                      const cents = Math.round((monthlyEquivalent % 1) * 100).toString().padStart(2, '0');
                      return (
                        <div className="my-3">
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-xs font-bold text-ink-400">R$</span>
                            <span className="text-3xl font-black text-ink-950 tracking-tight">{Math.floor(monthlyEquivalent)}</span>
                            <span className="text-[10px] font-bold text-ink-400">,{cents}/mês</span>
                          </div>
                          {planInterval !== 'month' && (
                            <div className="text-[9px] text-ink-400 font-semibold mt-1">
                              Cobrado como R$ {pv.toFixed(2).replace('.', ',')} por {planInterval === 'year' ? 'ano' : 'semestre'}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Badges de método de pagamento por intervalo ── */}
                    {planInterval === 'month' ? (
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[8px] font-black text-indigo-700 uppercase tracking-wide">
                          <RefreshCw size={7} /> PIX Recorrente
                        </span>
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[8px] font-black text-indigo-700 uppercase tracking-wide">
                          <RefreshCw size={7} /> Cartão Recorrente
                        </span>
                      </div>
                    ) : (() => {
                      const installments = planInterval === 'year' ? 12 : 6;
                      const pv = planPriceBrl(p, planInterval);
                      const installmentVal = (pv / installments).toFixed(2).replace('.', ',');
                      return (
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-[8px] font-black text-emerald-700 uppercase tracking-wide">
                            <QrCode size={7} /> PIX à vista
                          </span>
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-ink-100 border border-ink-200 text-[8px] font-black text-ink-600 uppercase tracking-wide">
                            <CreditCard size={7} /> {installments}× R$ {installmentVal} *
                          </span>
                        </div>
                      );
                    })()}

                    <div className="space-y-2 border-t border-ink-50 pt-3 text-[11px] font-medium text-ink-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
                        <span><strong>{p.reportsQuota === 0 ? 'Laudos LAUD.IA ilimitados' : `${p.reportsQuota} laudos LAUD.IA`}</strong>/mês</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
                        <span>Até <strong>{p.clinicsQuota === 0 ? 'locais de atendimento ilimitados' : `${p.clinicsQuota} local(is) de atendimento`}</strong></span>
                      </div>
                      {p.motorProDefault && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-violet-600 shrink-0" />
                          <span><strong>Motor Pro</strong> incluído (cota usável no Lite ou Pro)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className={p.includesCalculators ? 'text-indigo-600' : 'text-ink-300'} />
                        <span className={p.includesCalculators ? '' : 'text-ink-400 line-through'}>Calculadoras inclusas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className={p.includesPacs ? 'text-indigo-600' : 'text-ink-300'} />
                        <span className={p.includesPacs ? '' : 'text-ink-400 line-through'}>PACS / Worklist inclusa</span>
                      </div>
                      {p.features?.map((f: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-indigo-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                      {planInterval !== 'month' && (
                        <p className="text-[9px] text-ink-400 font-medium pt-1">
                          * Parcelamento no cartão sujeito a taxas repassadas ao cliente.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuyPlan(p.id)}
                    disabled={loadingAddon === p.id}
                    className={classNames(
                      'mt-5 w-full h-9 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                      isFeatured
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md hover:opacity-90'
                        : 'bg-white border border-ink-200 hover:bg-ink-50 text-ink-800'
                    )}
                  >
                    {loadingAddon === p.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : planInterval === 'month' ? (
                      <><RefreshCw size={12} /> Assinar Mensal</>
                    ) : planInterval === 'semester' ? (
                      <><QrCode size={12} /> Assinar Semestral</>
                    ) : (
                      <><QrCode size={12} /> Assinar Anual</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 1. HERO — PLANO ATUAL ═══════════════════════════════════════════ */}
      {subscription && !isCanceled && (
        <div className={classNames(
          'rounded-2xl border shadow-sm overflow-hidden',
          isPastDue ? 'border-rose-200' : isTrialing ? 'border-indigo-200' : 'border-ink-150'
        )}>
          {/* Trial / Past Due banner */}
          {(isTrialing || isPastDue) && (
            <div className={classNames(
              'px-5 py-2.5 flex items-center gap-2 text-xs font-bold',
              isPastDue ? 'bg-rose-500 text-white' : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white'
            )}>
              {isPastDue
                ? <><AlertCircle size={13} /> Pagamento em atraso — regularize para manter o acesso.</>
                : <><Sparkles size={13} /> Você está no período de avaliação — <strong>{trialDaysLeft} dias restantes</strong></>
              }
            </div>
          )}

          <div className="bg-white p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                  <ShieldCheck size={20} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-ink-900">LAUD.US — Plano {displayPlanName}</h3>
                    <span className={classNames('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider', statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-400 font-medium mt-0.5">
                    {subscription?.lifetime
                      ? '♾️ Plano vitalício · acesso permanente sem custos'
                      : isTrialing
                      ? `Trial expira em ${trialDaysLeft} dias`
                      : nextReset
                      ? `Renova em ${nextReset}`
                      : 'Assine para acessar todos os recursos'}
                  </p>
                </div>
              </div>

              {/* Plan features pills */}
              <div className="flex items-center flex-wrap gap-1.5">
                {hasCalculators && <FeaturePill label="Calculadoras" active />}
                {hasPacs        && <FeaturePill label="PACS / DICOM" active />}
                {canUsePro      && <FeaturePill label="Motor Pro" active color="violet" />}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-ink-100 border border-ink-100 rounded-xl mb-5">
              <StatCell label="Laudos / mês" value={reportsQuota === 9999 ? '∞' : String(reportsQuota)} sub={`${reportsUsed} usados`} />
              <StatCell label="Clínicas"     value={subscription?.clinicsQuota === 9999 ? '∞' : String(subscription?.clinicsQuota ?? 5)} sub="quota" />
              <StatCell
                label="Motor Atual"
                value={selectedMotor === 'pro' ? 'Pro' : 'Lite'}
                sub={selectedMotor === 'pro' ? 'gemini-pro' : 'gemini-flash'}
                color={selectedMotor === 'pro' ? 'violet' : 'indigo'}
              />
            </div>

            {/* Detalhes de Pagamento do Plano Ativo */}
            {!subscription?.lifetime && (
              <div className="flex items-center gap-2 flex-wrap mb-5">
                <span className="h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-ink-50 border border-ink-150 text-ink-700 flex items-center gap-1.5 shadow-sm">
                  Valor: R$ {(subscription?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {subscription?.interval === 'year' ? 'ano' : subscription?.interval === 'semester' ? 'semestre' : 'mês'}
                </span>
                {subscription?.paymentMethod && (
                  <span className="h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center gap-1.5 shadow-sm">
                    {subscription.paymentMethod === 'pix' ? (
                      <><QrCode size={12} /> Pago via PIX</>
                    ) : subscription.paymentMethod === 'credit_card' ? (
                      <><CreditCard size={12} /> Pago via Cartão {subscription.installments && subscription.installments > 1 ? `(${subscription.installments}x)` : ''}</>
                    ) : (
                      <><Wallet size={12} /> Ativação Manual</>
                    )}
                  </span>
                )}
                {subscription?.billingMode === 'invoice' && (
                  <span className="h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-50 border border-amber-100 text-amber-700 flex items-center gap-1.5 shadow-sm">
                    <Clock size={12} /> Modo Fatura Mensal
                  </span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {subscription?.lifetime && (
                <span className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-violet-50 border border-violet-100 text-violet-600 flex items-center gap-1.5">
                  ♾️ Vitalício · R$ 0 — sem cobranças
                </span>
              )}
              {!isCanceled && !subscription?.lifetime && (
                <button
                  onClick={handleCancel}
                  className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 transition-all flex items-center gap-1.5"
                >
                  <Ban size={13} /> Cancelar
                </button>
              )}
              {isCanceled && (
                <span className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 border border-rose-100 text-rose-500 flex items-center gap-1.5">
                  <Ban size={13} /> Assinatura cancelada
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. USO DE LAUDOS LAUD.IA ════════════════════════════════════════ */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <SectionHeader icon={TrendingUp} title="Uso de Laudos LAUD.IA" noMargin />
          <button onClick={fetchLaudoStats} disabled={loadingStats}
            className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-ink-700 transition-colors disabled:opacity-40">
            <RefreshCw size={10} className={loadingStats ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {loadingStats ? (
          <div className="flex items-center gap-2 text-xs text-ink-400 py-4">
            <Loader2 size={13} className="animate-spin" /> Carregando uso do mês...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total quota bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-ink-700">Laudos LAUD.IA (mês)</span>
                <span className={classNames('font-black', isHighUsage ? 'text-rose-600' : 'text-ink-600')}>
                  {reportsUsed} / {reportsQuota === 9999 ? '∞' : reportsQuota}
                </span>
              </div>
              {reportsQuota !== 9999 && (
                <div className="w-full h-3 bg-ink-100 rounded-full overflow-hidden border border-ink-200/30">
                  <div
                    className={classNames('h-full rounded-full transition-all duration-500', isHighUsage ? 'bg-rose-500' : 'bg-emerald-500')}
                    style={{ width: `${reportsPercent}%` }}
                  />
                </div>
              )}
              {isHighUsage && (
                <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> Você atingiu {reportsPercent}% da sua quota mensal.
                </p>
              )}
            </div>

            {/* Breakdown — laudos LAUD.IA unificados; a quota Pro só aparece
                quando o Motor Pro está disponível para o usuário. */}
            <div className={classNames('grid gap-3 pt-2 border-t border-ink-50', canUsePro ? 'grid-cols-2' : 'grid-cols-1')}>
              <LaudoBar tier="lite" used={liteUsed} />
              {canUsePro && <LaudoBar tier="pro" used={proUsed} />}
            </div>

            <div className="flex items-center justify-between text-[10px] text-ink-400 pt-1">
              <span>
                <strong className="text-ink-700">1 laudo gerado = 1 Token Lite ou Pro</strong> (conforme motor usado no editor)
              </span>
              {nextReset && !subscription?.lifetime && (
                <span className="flex items-center gap-1 shrink-0 ml-3">
                  <Calendar size={10} /> Renova em {nextReset}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ═══ 3. ADD-ONS E MÓDULOS ════════════════════════════════════════════ */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <SectionHeader icon={Package} title="Funcionalidades / Módulos Extras" noMargin />
          <div className="inline-flex items-center gap-1 bg-ink-100 p-1 rounded-xl border border-ink-200">
            {(['month', 'semester', 'year'] as const).map(iv => (
              <button
                key={iv}
                onClick={() => setAddonInterval(iv)}
                className={classNames(
                  'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                  addonInterval === iv ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800'
                )}
              >
                {iv === 'month' ? 'Mensal' : iv === 'semester' ? 'Semestral' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-ink-400 mb-4">Add-ons são assinaturas recorrentes; semestral = 6× e anual = 12× o valor mensal.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Calculadoras */}
          <AddonCard
            icon={Calculator} iconColor="indigo"
            title="Calculadoras Clínicas"
            description={ac.calculators?.description ?? ADDONS_DEFAULT.calculators!.description}
            price={addonPriceMeta(ac.calculators, 49)}
            active={hasCalculators}
            actionLabel="Assinar Módulo"
            onAction={() => handleBuyAddon('calculators')}
            loading={loadingAddon === 'calculators'}
          />

          {/* PACS — habilitado: escolha do tier do pacote; senão: contratar ou solicitar */}
          {hasPacs ? (
            <div className="md:col-span-2 bg-gradient-to-br from-white to-emerald-50/10 rounded-2xl border border-emerald-300 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-ink-100 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                    <Database size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-ink-950">PACS / DICOM Sync</h4>
                    <p className="text-[10px] text-emerald-600 font-bold">Módulo Habilitado na Assinatura</p>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500 text-white flex items-center gap-1 shadow-sm">
                  <CheckCircle2 size={11} /> Ativo no Pacote
                </span>
              </div>

              <div>
                <p className="text-[11px] font-bold text-ink-700 mb-2.5">Escolha o plano de PACS para provisionamento da sua VM:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PACS_TIER_ORDER.filter(k => pacsTiers[k]?.active !== false).map(k => {
                    const t = pacsTiers[k] || {};
                    const selected = (settings.pacsSelectedPlan || '') === k;
                    const priceBrl = planPriceBrl(t, addonInterval);
                    return (
                      <button
                        key={k}
                        onClick={() => handleChoosePacsTier(k)}
                        disabled={savingPacsTier}
                        className={classNames(
                          'relative text-left p-3.5 rounded-xl border transition-all disabled:opacity-60 cursor-pointer',
                          selected ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/10' : 'border-ink-200 hover:border-ink-300 bg-white shadow-sm'
                        )}
                      >
                        {t.badge && (
                          <span className="absolute -top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-sm">{t.badge}</span>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-ink-900">{t.label || k}</p>
                          {selected && <CheckCircle2 size={14} className="text-emerald-600" />}
                        </div>
                        <p className="text-sm font-black text-emerald-700 mt-1">R$ {Math.round(priceBrl).toLocaleString('pt-BR')}<span className="text-[9px] text-ink-400 font-bold">/{addonPer}</span></p>
                        <p className="text-[10px] text-ink-500 mt-1.5 leading-relaxed">{t.disk ? `${t.disk} GB · ` : ''}{t.model || ''}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-ink-400 pt-1.5 flex items-start gap-1.5">
                <ShieldCheck size={12} className="shrink-0 mt-0.5 text-emerald-600" />
                O provisionamento do servidor (VM) é feito em <strong>1 clique</strong> na área <strong>PACS / DICOM</strong>, usando o tier escolhido aqui.
              </p>
            </div>
          ) : (
            (() => {
              const pacsPrice = ac.pacs?.price ?? 0;
              const hasPrice = pacsPrice > 0;
              return (
                <AddonCard
                  icon={Database} iconColor="emerald"
                  title="PACS / DICOM Sync"
                  description={ac.pacs?.description ?? ADDONS_DEFAULT.pacs!.description}
                  price={hasPrice ? addonPriceMeta(ac.pacs, 0) : 'Sob Consulta'}
                  active={hasPacs}
                  actionLabel={hasPrice ? "Assinar Módulo" : pacsRequested ? 'Solicitação Enviada' : 'Solicitar PACS'}
                  actionIcon={!hasPrice && pacsRequested ? Clock : undefined}
                  onAction={hasPrice ? () => handleBuyAddon('pacs') : (pacsRequested ? undefined : handleRequestPacs)}
                  loading={loadingAddon === 'pacs' || (!hasPrice && sendingPacsTicket)}
                  disabled={!hasPrice && pacsRequested}
                />
              );
            })()
          )}

          {/* Agendamentos */}
          <AddonCard
            icon={CalendarDays} iconColor="amber"
            title="Módulo de Agendamentos"
            description={ac.appointments?.description ?? ADDONS_DEFAULT.appointments!.description}
            price={addonPriceMeta(ac.appointments, 39)}
            active={hasAppointments}
            actionLabel="Assinar Módulo"
            onAction={() => handleBuyAddon('appointments')}
            loading={loadingAddon === 'appointments'}
          />

          {/* Clínicas — recurso do médico individual (locais de atendimento
              próprios, dentro da cota do plano). Autoatendimento normal, como
              os demais add-ons; o Enterprise (múltiplos médicos por clínica)
              é um conceito à parte, ainda não lançado (ver landing/#clinicas). */}
          <AddonCard
            icon={Hospital} iconColor="teal"
            title="Módulo de Clínicas"
            description={ac.clinics?.description ?? ADDONS_DEFAULT.clinics!.description}
            price={addonPriceMeta(ac.clinics, 49)}
            active={hasClinics}
            actionLabel="Assinar Módulo"
            onAction={() => handleBuyAddon('clinics')}
            loading={loadingAddon === 'clinics'}
          />
        </div>

        <SectionHeader icon={Plus} title="Recursos Adicionais (Consumíveis)" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pacote de Laudos LAUD.IA (unificado — usável no Lite ou Pro) */}
          <AddonCard
            icon={Sparkles} iconColor="violet"
            title={`Pacote de Laudos LAUD.IA (+${ac.tokenLite?.bundleSize ?? 50})`}
            description={ac.tokenLite?.description ?? ADDONS_DEFAULT.tokenLite!.description}
            price={`R$ ${(ac.tokenLite?.price ?? 9.90).toFixed(2).replace('.', ',')}/pacote`}
            active={false}
            actionLabel="Comprar Pacote"
            onAction={() => handleBuyAddon('token_lite')}
            loading={loadingAddon === 'token_lite'}
          />

          {/* Laudo Extra */}
          <AddonCard
            icon={FileText} iconColor="amber"
            title="Laudos Extras"
            description={ac.extraReport?.description ?? ADDONS_DEFAULT.extraReport!.description}
            price={`R$ ${(ac.extraReport?.price ?? 1.50).toFixed(2).replace('.', ',')}/laudo`}
            active={false}
            actionLabel="Comprar Laudos"
            onAction={() => handleBuyAddon('extra_reports')}
            loading={loadingAddon === 'extra_reports'}
          />

          {/* Clínica Extra */}
          <AddonCard
            icon={Building2} iconColor="teal"
            title="Clínica Extra"
            description={ac.extraClinic?.description ?? ADDONS_DEFAULT.extraClinic!.description}
            price={`R$ ${(ac.extraClinic?.price ?? 29).toFixed(2).replace('.', ',')}/mês`}
            active={false}
            actionLabel="Adicionar Clínica"
            onAction={() => handleBuyAddon('extra_clinic')}
            loading={loadingAddon === 'extra_clinic'}
          />
        </div>
      </Card>

      {/* ═══ 4. HISTÓRICO DE FATURAMENTO ════════════════════════════════════ */}
      <Card>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between group"
        >
          <SectionHeader icon={CreditCard} title="Faturamento" noMargin />
          {showHistory ? <ChevronUp size={15} className="text-ink-400" /> : <ChevronDown size={15} className="text-ink-400" />}
        </button>

        {showHistory && (
          <div className="mt-5 space-y-4">
            {/* User Transactions Table */}
            {userTransactions.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-ink-100 mb-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-ink-50/50 border-b border-ink-100 text-[9px] font-black uppercase text-ink-400 tracking-wider">
                      <th className="px-4 py-2.5">Data</th>
                      <th className="px-4 py-2.5">Descrição</th>
                      <th className="px-4 py-2.5 text-right">Valor</th>
                      <th className="px-4 py-2.5 text-center">Método</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 text-[11px]">
                    {userTransactions.map((t: any) => {
                      const dateStr = t.timestamp
                        ? new Date(t.timestamp).toLocaleDateString('pt-BR')
                        : '—';
                      
                      const methodNames: Record<string, string> = {
                        pix: 'PIX',
                        credit_card: 'Cartão',
                        manual: 'Manual',
                      };

                      const statusColors: Record<string, string> = {
                        paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                        failed: 'bg-rose-50 text-rose-700 border-rose-100',
                        refunded: 'bg-amber-50 text-amber-700 border-amber-100',
                      };

                      const statusLabels: Record<string, string> = {
                        paid: 'Pago',
                        failed: 'Falhou',
                        refunded: 'Reembolsado',
                      };

                      return (
                        <tr key={t.id} className="hover:bg-ink-50/20">
                          <td className="px-4 py-2.5 font-medium text-ink-500">{dateStr}</td>
                          <td className="px-4 py-2.5 font-bold text-ink-800">{t.description || 'Assinatura'}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">
                            R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-ink-500">
                            {methodNames[t.paymentMethod] || t.paymentMethod || 'Manual'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={classNames(
                              'px-1.5 py-0.5 rounded text-[8px] font-black uppercase border',
                              statusColors[t.status] || 'bg-ink-50 text-ink-400'
                            )}>
                              {statusLabels[t.status] || t.status || 'Pago'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-ink-400 border border-dashed border-ink-200 rounded-xl">
                <FileText size={24} className="mx-auto mb-1.5 opacity-30" />
                <p className="text-xs font-semibold">Nenhum pagamento registrado no sistema.</p>
                <p className="text-[10px] mt-0.5">As transações serão exibidas assim que o pagamento do plano for processado.</p>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
              <CreditCard size={14} className="text-indigo-500 shrink-0 mt-0.5" />
              <span className="font-medium">O comprovante de cada pagamento é enviado ao seu e-mail pela AbacatePay no momento da confirmação. Dúvidas sobre cobrança? Fale com o suporte.</span>
            </div>

            {subscription && (
              <div className="flex items-center gap-2 text-[10px] text-ink-400 font-medium px-2">
                <Calendar size={11} />
                Assinatura desde {new Date(subscription.createdAt || Date.now()).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        )}
      </Card>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-150 shadow-sm p-6">
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, noMargin }: { icon: typeof TrendingUp; title: string; noMargin?: boolean }) {
  return (
    <h3 className={classNames(
      'text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2',
      noMargin ? '' : 'mb-4'
    )}>
      <Icon size={15} className="text-brand-600" /> {title}
    </h3>
  );
}

function StatCell({ label, value, sub, color = 'ink' }: { label: string; value: string; sub: string; color?: string }) {
  const valueColor = color === 'violet' ? 'text-violet-700' : color === 'indigo' ? 'text-indigo-700' : 'text-ink-900';
  return (
    <div className="flex flex-col items-center py-4 px-3 text-center">
      <div className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-1">{label}</div>
      <div className={classNames('text-lg font-black', valueColor)}>{value}</div>
      <div className="text-[9px] text-ink-400 font-medium mt-0.5">{sub}</div>
    </div>
  );
}

function FeaturePill({ label, active, color = 'emerald' }: { label: string; active: boolean; color?: string }) {
  if (!active) return null;
  const cls = color === 'violet' ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800';
  return (
    <span className={classNames('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full', cls)}>
      {label}
    </span>
  );
}

function LaudoBar({ tier, used }: { tier: 'lite' | 'pro'; used: number }) {
  const isLite = tier === 'lite';

  return (
    <div className={classNames('p-4 rounded-xl border space-y-2', isLite ? 'bg-indigo-50/50 border-indigo-100' : 'bg-violet-50/50 border-violet-100')}>
      <div className={classNames('flex items-center justify-between')}>
        <div className={classNames('flex items-center gap-1 text-[9px] font-black uppercase tracking-widest', isLite ? 'text-indigo-700' : 'text-violet-700')}>
          {isLite ? <Zap size={9} /> : <Sparkles size={9} />}
          Laudos {isLite ? 'Lite' : 'Pro'}
        </div>
      </div>

      <div className="text-2xl font-black text-ink-900">{used.toLocaleString('pt-BR')}</div>
      <div className="text-[10px] text-ink-400 font-medium">laudos {isLite ? 'Lite' : 'Pro'} gerados este mês</div>
    </div>
  );
}

function AddonCard({
  icon: Icon, iconColor, title, description, price,
  active, actionLabel, actionIcon: ActionIcon, onAction, loading, disabled, disabledTip,
}: {
  icon: typeof Calculator; iconColor: string; title: string; description: string;
  price: string; active: boolean; actionLabel: string; actionIcon?: typeof Clock;
  onAction?: () => void; loading?: boolean; disabled?: boolean; disabledTip?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo:  'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    teal:    'bg-teal-50 text-teal-600',
    violet:  'bg-violet-50 text-violet-600',
    pink:    'bg-pink-50 text-pink-600',
  };
  const btnColorMap: Record<string, string> = {
    indigo:  'bg-indigo-600 hover:bg-indigo-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber:   'bg-amber-600 hover:bg-amber-700',
    teal:    'bg-teal-600 hover:bg-teal-700',
    violet:  'bg-violet-600 hover:bg-violet-700',
    pink:    'bg-pink-600 hover:bg-pink-700',
  };

  return (
    <div className="p-5 rounded-2xl border border-ink-100 bg-white shadow-sm flex flex-col gap-3 hover:border-ink-200 transition-all">
      <div className="flex gap-4">
        <div className={classNames('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colorMap[iconColor])}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-ink-950 flex items-center gap-1.5 flex-wrap">
            {title}
            {active && <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Ativo</span>}
          </h4>
          <p className="text-[11px] text-ink-400 font-medium leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-ink-50 pt-3 mt-auto">
        <span className="text-xs font-bold text-ink-600">{price}</span>
        {active ? (
          <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={13} /> Ativo no Plano
          </span>
        ) : disabled ? (
          <span className="text-[10px] text-ink-400 font-bold flex items-center gap-1" title={disabledTip}>
            <Lock size={11} /> {disabledTip || actionLabel}
          </span>
        ) : (
          <button
            onClick={onAction}
            disabled={loading || !onAction}
            className={classNames(
              'h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5',
              btnColorMap[iconColor]
            )}
          >
            {loading   ? <Loader2 size={12} className="animate-spin" /> :
             ActionIcon ? <ActionIcon size={12} /> : null}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
