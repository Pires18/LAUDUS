import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import { validateAndActivateLicense } from '../store/db';
import { useCollection } from '../hooks/useFirestore';
import { firestore } from '../lib/firebase';
import {
  Key, ShieldCheck, LogOut,
  Loader2, AlertTriangle, ChevronRight, Cpu, CloudLightning,
  CheckCircle2, ShoppingBag
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';

interface LicenseActivationScreenProps {
  isExpired?: boolean;
  expiredPlanName?: string;
  onActivated: () => void;
}

export function LicenseActivationScreen({ 
  isExpired = false, 
  expiredPlanName, 
  onActivated 
}: LicenseActivationScreenProps) {
  const { user, signOut } = useAuth();
  
  // Pre-fill code if passed via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const initialCode = urlParams.get('code') || '';
  
  const [activeTab, setActiveTab] = useState<'acquire' | 'activate'>(initialCode ? 'activate' : 'acquire');
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Carrega os planos de assinatura disponíveis
  const { data: rawPlans, loading: loadingPlans } = useCollection<any>('plans', { isGlobal: true });
  const plans = rawPlans.filter((p: any) => !p.id.startsWith('LICENSE_') && p.active !== false);

  // Formata o input no padrão LAUD-XXXX-XXXX-XXXX
  function handleCodeChange(val: string) {
    setError(null);
    let clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Garante o prefixo LAUD se o usuário começar a digitar
    if (clean.length > 0 && !clean.startsWith('LAUD')) {
      if ('LAUD'.startsWith(clean)) {
        // Deixa digitar as iniciais de LAUD
      } else {
        clean = 'LAUD' + clean;
      }
    }

    // Agrupa em partes de 4 caracteres separadas por hífen
    const parts = [];
    if (clean.length > 0) parts.push(clean.substring(0, 4));
    if (clean.length > 4) parts.push(clean.substring(4, 8));
    if (clean.length > 8) parts.push(clean.substring(8, 12));
    if (clean.length > 12) parts.push(clean.substring(12, 16));

    const formatted = parts.join('-');
    setCode(formatted.substring(0, 19)); // Máximo: LAUD-XXXX-XXXX-XXXX (19 chars)
  }

  // Ativação por Chave Existente
  async function handleActivate() {
    if (code.length < 19) {
      setError('Por favor, insira o código de licença completo.');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      await validateAndActivateLicense(
        code, 
        user.uid, 
        user.email || '', 
        user.displayName || ''
      );
      setSuccess(true);
      setTimeout(() => {
        onActivated();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ativar licença.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Aquisição Direta de Plano (Auto-ativação vinculada ao e-mail/uid)
  async function handleAcquirePlan(plan: any) {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const userRef = doc(firestore, 'users', user.uid);
      
      const now = Date.now();
      const durationMonths = plan.durationMonths || 12; // padrão de 12 meses
      const expiresAt = now + durationMonths * 30 * 24 * 60 * 60 * 1000;

      // Cria/Atualiza o perfil de acesso definitivo do usuário diretamente no Firestore
      await setDoc(userRef, {
        name: user.displayName || user.email?.split('@')[0] || 'Profissional',
        email: user.email || '',
        role: 'medico', // perfil padrão de diagnóstico médico
        active: true,
        licenseCode: `AUTO_${plan.id.toUpperCase()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        licensePlanId: plan.id,
        licensePlanName: plan.name,
        licenseExpiresAt: expiresAt,
        createdAt: now,
        updatedAt: now
      });

      // Registra a auditoria da aquisição
      try {
        const { addAuditLog } = await import('../store/db');
        await addAuditLog({
          userId: user.uid,
          userName: user.displayName || user.email || 'Usuário Autônomo',
          action: 'ADQUIRIR_PLANO',
          details: `Plano ${plan.name} adquirido diretamente pelo usuário. Acesso liberado.`,
          module: 'ACCESS_GATE'
        });
      } catch (e) {
        logger.warn('Erro ao logar auditoria da aquisição:', e);
      }

      setSuccess(true);
      setTimeout(() => {
        onActivated();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao adquirir plano comercial.');
    } finally {
      setLoading(false);
    }
  }

  const benefits = [
    {
      icon: Cpu,
      title: 'Laud.IA Master Engine',
      desc: 'Copiloto de inteligência artificial calibrado de acordo com as principais diretrizes médicas.'
    },
    {
      icon: ShieldCheck,
      title: 'Segurança Criptografada',
      desc: 'Prontuários e exames sob conformidade rígida de sigilo e backups instantâneos.'
    },
    {
      icon: CloudLightning,
      title: 'Performance Acelerada',
      desc: 'Edição ultra-rápida, templates inteligentes e sincronização automática com nuvem.'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50/30 relative overflow-hidden font-sans">
      {/* Background Neon Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-200/30 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-200/40 rounded-full blur-[140px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-[950px] mx-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-10">
        
        {/* Left Side: Brand & Benefits */}
        <div className="md:col-span-5 space-y-6 text-left p-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-md shrink-0 ring-2 ring-brand-100 overflow-hidden">
              <LogoIcon size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-ink-900 tracking-tighter leading-none select-none">
                LAUD<span className="text-brand-600">.US</span>
              </h2>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black text-ink-900 leading-tight tracking-tight">
              {isExpired ? 'Renove seu Acesso' : 'Adquira seu Plano Clínico'}
            </h1>
            <p className="text-ink-500 text-xs leading-relaxed font-semibold">
              {isExpired 
                ? 'Sua assinatura expirou. Adquira um novo plano ou insira uma nova chave de licença para reativar seu ambiente diagnóstico.'
                : 'Seja bem-vindo! Escolha uma assinatura comercial atrelada à sua conta ou ative uma chave de licença distribuída.'}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-ink-200/50">
            {benefits.map((b, idx) => (
              <div key={idx} className="flex gap-3 group">
                <div className="p-2.5 rounded-xl bg-white border border-ink-150 text-brand-600 shrink-0 shadow-sm group-hover:bg-brand-50 transition-all duration-300">
                  <b.icon size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-ink-900">{b.title}</h4>
                  <p className="text-[10px] text-ink-500 font-bold leading-relaxed mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Glass Activation Form */}
        <div className="md:col-span-7">
          <div className="bg-white/90 backdrop-blur-xl border border-ink-100 rounded-[2.5rem] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.06)] p-8 md:p-10 relative overflow-hidden group">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-colors duration-700" />

            <div className="relative space-y-6">
              
              {/* Tab Selector */}
              {!success && (
                <div className="flex bg-ink-50/60 p-1.5 rounded-2xl border border-ink-150 shadow-inner">
                  <button 
                    onClick={() => { setActiveTab('acquire'); setError(null); }} 
                    className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'acquire' ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-ink-500 hover:text-ink-900'}`}
                  >
                    <ShoppingBag size={12} />
                    Adquirir Plano
                  </button>
                  <button 
                    onClick={() => { setActiveTab('activate'); setError(null); }} 
                    className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'activate' ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-ink-500 hover:text-ink-900'}`}
                  >
                    <Key size={12} />
                    Ativar Chave
                  </button>
                </div>
              )}

              {/* Expired alert indicator inside card */}
              {isExpired && !success && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-left">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="text-xs font-black text-amber-900">Assinatura Expirada</h5>
                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5 leading-relaxed">
                      Seu plano anterior ({expiredPlanName || 'Médico Individual'}) expirou. Selecione um novo plano abaixo para regularizar seu acesso.
                    </p>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 animate-scale-in">
                  <ShieldCheck className="text-emerald-600 animate-bounce" size={42} />
                  <div>
                    <h5 className="text-base font-black text-emerald-950">Acesso Clínico Autorizado!</h5>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">Sua conta foi vinculada e ativada. Redirecionando...</p>
                  </div>
                </div>
              )}

              {/* General Error */}
              {error && !success && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-left animate-slide-up">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-red-600 font-bold leading-relaxed">{error}</p>
                </div>
              )}

              {/* TABS CONTAINER */}
              {!success && (
                <div>
                  {/* TAB 1: ACQUIRE PLAN */}
                  {activeTab === 'acquire' && (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 text-left">
                      <p className="text-[10px] text-ink-400 font-black uppercase tracking-widest mb-2 block">
                        Assinaturas Disponíveis (Vinculação Direta)
                      </p>
                      
                      {loadingPlans ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                          <Loader2 className="animate-spin text-brand-500" size={28} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-ink-400">Consultando planos médicos...</p>
                        </div>
                      ) : plans.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-ink-200 rounded-2xl">
                          <p className="text-xs text-ink-500 font-bold">Nenhum plano comercial disponível no momento.</p>
                        </div>
                      ) : (
                        plans.map(plan => (
                          <div 
                            key={plan.id} 
                            className="p-5 rounded-3xl border border-ink-150 bg-white hover:border-brand-300 hover:shadow-premium transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                          >
                            <div>
                              <h4 className="text-sm font-black text-ink-900 group-hover:text-brand-700 transition-colors flex items-center gap-1.5">
                                {plan.name}
                                <CheckCircle2 size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </h4>
                              <p className="text-[10px] text-ink-500 font-semibold mt-1 flex flex-wrap gap-2">
                                <span>{plan.examLimit ? `${plan.examLimit} exames/mês` : 'Exames Ilimitados'}</span>
                                <span>•</span>
                                <span>{plan.iaLimit ? `${plan.iaLimit} Laud.IA/mês` : 'IA Ilimitada'}</span>
                              </p>
                              {plan.features && plan.features.length > 0 && (
                                <p className="text-[9px] text-brand-600 font-bold mt-1.5">
                                  ✓ {plan.features.slice(0, 2).join(' • ')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                              <div className="text-right sm:text-right">
                                <span className="text-lg font-black text-brand-600 block leading-none">R$ {plan.price}</span>
                                <span className="text-[8px] text-ink-400 font-black uppercase tracking-widest">/ {plan.interval === 'month' ? 'mês' : 'ano'}</span>
                              </div>
                              <button
                                onClick={() => handleAcquirePlan(plan)}
                                disabled={loading}
                                className="px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer"
                              >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : 'Adquirir'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 2: ACTIVATE LICENSE KEY */}
                  {activeTab === 'activate' && (
                    <div className="space-y-4">
                      <div>
                        <label className="label text-[9px] font-black uppercase tracking-widest text-ink-400 mb-2 block text-left">
                          Código de Licença
                        </label>
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => handleCodeChange(e.target.value)}
                          disabled={loading}
                          placeholder="LAUD-XXXX-XXXX-XXXX"
                          className="w-full text-center py-4 bg-ink-50/50 border border-ink-200 rounded-2xl text-ink-900 font-mono text-xl font-black tracking-[0.2em] focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 placeholder-ink-300 transition-all"
                        />
                      </div>

                      <button
                        onClick={handleActivate}
                        disabled={loading || code.length < 19}
                        className="w-full flex items-center justify-center gap-3 bg-brand-600 hover:bg-brand-700 text-white font-black py-4 px-6 rounded-2xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                      >
                        {loading ? (
                          <Loader2 size={18} className="animate-spin text-white" />
                        ) : (
                          <>
                            <span className="text-xs uppercase tracking-widest font-black">Ativar Acesso Clínico</span>
                            <ChevronRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sign out Option */}
              <div className="flex justify-between items-center pt-6 border-t border-ink-100 text-xs text-ink-500 font-bold">
                <span>Conectado como <strong className="text-ink-900">{user?.email}</strong></span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 hover:text-red-600 transition-colors uppercase font-black text-[9px] tracking-widest cursor-pointer"
                >
                  <LogOut size={12} />
                  Sair da Conta
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


