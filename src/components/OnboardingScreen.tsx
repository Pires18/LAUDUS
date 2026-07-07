import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../store/app';
import { planPriceBrl } from '../../api/_pricing';
import {
  Sparkles, CheckCircle2, CreditCard, QrCode, LogOut, Loader2,
  ShieldCheck, Zap, Clock, BarChart3, Building2, Calculator,
  Stethoscope, ChevronRight, AlertTriangle, Wallet,
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';

export function OnboardingScreen() {
  const { signOut } = useAuth();
  const { profile, user, showToast } = useApp();
  const [loading, setLoading] = useState(false);

  const [plans, setPlans]           = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planInterval, setPlanInterval]     = useState<'month' | 'semester' | 'year'>('month');
  const [loadingPlans, setLoadingPlans]     = useState(true);

  // Detect return from AbacatePay / mock redirect
  const [verifying, setVerifying] = useState(false);
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('subscribed') || hash.includes('tab=assinatura')) {
      setVerifying(true);
      // Firestore onSnapshot in UserAccessGate will pick up the change automatically
      // Just show a nice loading state for 3s then reset
      setTimeout(() => setVerifying(false), 3000);
    }
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'saas_plans'), where('active', '==', true));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        setPlans(list);
        const featured = list.find((p: any) => p.featured);
        setSelectedPlanId(featured?.id || list[0]?.id || '');
      } catch (err) {
        logger.error('Erro ao buscar planos:', err);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/abacatepay-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          type: 'subscription',
          planId: selectedPlanId,
          interval: planInterval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar assinatura.');

      if (data.mock) {
        showToast('Simulando pagamento (modo dev)... abrindo sandbox de testes.', 'info');
      }
      window.location.href = data.url;
    } catch (err: any) {
      showToast(err.message || 'Falha ao iniciar checkout.', 'error');
      setLoading(false);
    }
  };

  const FEATURES = [
    {
      icon: <Zap size={14} className="text-brand-400" />,
      title: 'LAUD.IA Motor Lite & Pro',
      desc: 'Geração de laudos estruturados com IA em segundos. Motor Lite para rotina, Motor Pro para casos complexos.',
    },
    {
      icon: <BarChart3 size={14} className="text-brand-400" />,
      title: 'Worklist & Editor Completo',
      desc: 'Gestão de fila de exames, edição rica com formatação e macros de normalidade habitual.',
    },
    {
      icon: <Building2 size={14} className="text-brand-400" />,
      title: 'Múltiplas Clínicas',
      desc: 'Configure e gerencie laudos para até 5 clínicas diferentes com cabeçalhos e dados independentes.',
    },
    {
      icon: <Stethoscope size={14} className="text-brand-400" />,
      title: 'Pacientes & Histórico',
      desc: 'Cadastro completo de pacientes com histórico de laudos e buscas avançadas.',
    },
    {
      icon: <Calculator size={14} className="text-brand-400" />,
      title: 'Add-ons Opcionais',
      desc: 'Calculadoras clínicas biométricas e integração PACS/DICOM disponíveis como complementos.',
    },
    {
      icon: <ShieldCheck size={14} className="text-brand-400" />,
      title: 'Segurança & Conformidade',
      desc: 'Dados criptografados, acesso por autenticação segura, backups automáticos na nuvem.',
    },
  ];

  if (verifying) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-white">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-brand-500 mx-auto" />
          <p className="text-sm font-bold text-ink-300">Verificando status do pagamento...</p>
          <p className="text-[11px] text-ink-500">Aguarde enquanto confirmamos sua assinatura.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] flex flex-col items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden text-white select-none">

      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[140px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[900px] bg-[#121216] border border-white/8 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative z-10">

        {/* Left: Product intro */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/8">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                <LogoIcon size={22} />
              </div>
              <div className="flex items-center text-lg font-black tracking-tight">
                <span>LAUD</span>
                <span className="text-brand-500">.US</span>
              </div>
            </div>

            {/* Trial / Expired badge */}
            {profile?.subscriptionStatus === 'expired' || profile?.subscriptionStatus === 'canceled' ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-5">
                <AlertTriangle size={11} />
                <span className="text-[9px] font-black uppercase tracking-widest">Acesso Clínico Suspenso</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-5">
                <Clock size={11} />
                <span className="text-[9px] font-black uppercase tracking-widest">14 Dias de Avaliação Gratuita Inclusos</span>
              </div>
            )}

            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-white mb-2">
              Laudos estruturados com IA, do jeito que você precisa.
            </h1>
            <p className="text-sm text-ink-400 font-medium mb-7 leading-relaxed">
              Plataforma médica individual para ultrassonografia. Motor inteligente, worklist na nuvem, e fluxo otimizado para alta produtividade clínica.
            </p>

            <ul className="space-y-3.5">
              {FEATURES.map((feat, idx) => (
                <li key={idx} className="flex gap-3 text-left">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-ink-100">{feat.title}</h4>
                    <p className="text-[10px] text-ink-500 font-medium leading-relaxed mt-0.5">{feat.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-6 mt-8 border-t border-white/8 flex items-center justify-between text-[10px] text-ink-600 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-500" /> Dados Criptografados</span>
            <span>Firebase Auth · Firestore</span>
          </div>
        </div>

        {/* Right: Checkout CTA */}
        <div className="w-full md:w-[320px] p-8 md:p-10 bg-[#16161c] flex flex-col justify-between items-center text-center gap-6">

          <div className="w-full flex-1 flex flex-col justify-center animate-fade-in">
            {/* Plan selector */}
            {plans.length > 1 && (
              <div className="flex gap-1 bg-[#1c1c24] p-1 rounded-xl border border-white/6 mb-3">
                {plans.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      selectedPlanId === p.id ? 'bg-brand-600 text-white shadow' : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {/* Interval selector */}
            <div className="flex gap-1 bg-[#1c1c24] p-1 rounded-xl border border-white/6 mb-5">
              {(['month', 'semester', 'year'] as const).map(iv => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setPlanInterval(iv)}
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    planInterval === iv ? 'bg-brand-600 text-white shadow' : 'text-ink-400 hover:text-white'
                  }`}
                >
                  {iv === 'month' ? 'Mensal' : iv === 'semester' ? 'Semestral' : 'Anual'}
                </button>
              ))}
            </div>

            {/* Trial vs Expired info box */}
            {profile?.subscriptionStatus === 'expired' || profile?.subscriptionStatus === 'canceled' ? (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 mb-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Assinatura Expirada</span>
                </div>
                <p className="text-[11px] text-ink-300 leading-relaxed font-medium">
                  Seu período de acesso ao LAUD.US terminou. Escolha um plano e realize a assinatura para reativar seu acesso instantaneamente.
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 mb-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Período de Avaliação</span>
                </div>
                <p className="text-[11px] text-ink-300 leading-relaxed font-medium">
                  Ao criar sua conta, você tem <strong className="text-emerald-400">14 dias de acesso completo gratuito</strong> — sem cartão, sem compromisso.
                  Assine antes do trial expirar para não perder acesso.
                </p>
              </div>
            )}

            {/* Price display */}
            <div className="mb-5">
              {loadingPlans ? (
                <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-ink-500" /></div>
              ) : (
                <>
                  <span className="text-ink-500 text-[9px] font-black uppercase tracking-widest">
                    {selectedPlan?.name ? (selectedPlan.name.toLowerCase().startsWith('plano') ? selectedPlan.name : `Plano ${selectedPlan.name}`) : 'Plano Base'}
                  </span>
                  {(() => {
                    const pv = selectedPlan ? planPriceBrl(selectedPlan, planInterval) : 149;
                    const installments = planInterval === 'year' ? 12 : planInterval === 'semester' ? 6 : 1;
                    const monthlyEquivalent = pv / installments;
                    const cents = Math.round((monthlyEquivalent % 1) * 100).toString().padStart(2, '0');
                    return (
                      <div className="mt-1">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-base font-black text-ink-400">R$</span>
                          <span className="text-5xl font-black tracking-tighter text-white">
                            {Math.floor(monthlyEquivalent)}
                          </span>
                          <span className="text-xs font-bold text-ink-500">
                            ,{cents}/mês
                          </span>
                        </div>
                        {planInterval !== 'month' && (
                          <div className="text-[9px] text-ink-400 font-semibold mt-1.5">
                            Cobrado como R$ {pv.toFixed(2).replace('.', ',')} por {planInterval === 'year' ? 'ano' : 'semestre'}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-ink-500 font-medium mt-2">
                    {selectedPlan?.reportsQuota === 0
                      ? 'Laudos ilimitados'
                      : `${selectedPlan?.reportsQuota || 100} laudos/mês`}
                    {' · '}
                    {selectedPlan?.clinicsQuota || 5} local(is) de atendimento
                  </p>
                </>
              )}
            </div>

            {/* CTA buttons */}
            <div className="space-y-2.5 w-full">
              <button
                onClick={handleSubscribe}
                disabled={loading || loadingPlans}
                className="w-full h-12 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <QrCode size={15} />
                    <span>Assinar via PIX / Cartão</span>
                    <ChevronRight size={14} className="ml-1" />
                  </>
                )}
              </button>

              {planInterval === 'month' ? (
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-ink-500">
                  <CreditCard size={11} />
                  Cobrança recorrente — cancele quando quiser
                </p>
              ) : (() => {
                const installments = planInterval === 'year' ? 12 : 6;
                const pv = selectedPlan ? planPriceBrl(selectedPlan, planInterval) : 149;
                const installmentVal = (pv / installments).toFixed(2).replace('.', ',');
                return (
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-ink-500">
                    <CreditCard size={11} />
                    Disponível em até {installments}× R$ {installmentVal} no cartão
                  </p>
                );
              })()}
            </div>

            {/* Highlights row */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                { icon: <Sparkles size={10} />, label: 'Motor IA Incluso' },
                { icon: <ShieldCheck size={10} />, label: 'Dados Seguros' },
                { icon: <Clock size={10} />, label: '14 Dias Grátis' },
                { icon: <CheckCircle2 size={10} />, label: 'Cancele Online' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px] font-bold text-ink-500 uppercase tracking-wide">
                  <span className="text-brand-500">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <div className="w-full pt-5 border-t border-white/8">
            <button
              onClick={signOut}
              className="w-full h-10 border border-white/8 hover:bg-white/5 text-ink-500 hover:text-ink-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut size={12} />
              Sair da Conta
            </button>
          </div>
        </div>

      </div>

      {/* Footer note */}
      <p className="mt-6 text-[10px] text-ink-700 font-medium text-center max-w-md">
        Já possui assinatura? Aguarde alguns instantes — seu acesso é restaurado automaticamente ao fazer login.
      </p>
    </div>
  );
}
