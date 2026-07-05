import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Loader2, ShieldCheck, Sparkles,
  Lock, CheckCircle, FileText, Layers,
  Mail, KeyRound, Database, Calculator, CalendarDays, Building2, CreditCard
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';

const LANDING_FEATURES = [
  { icon: Sparkles,    label: 'Laudos com IA' },
  { icon: Database,    label: 'PACS / DICOM' },
  { icon: Calculator,  label: 'Calculadoras clínicas' },
  { icon: CalendarDays,label: 'Agenda & Worklist' },
  { icon: Building2,   label: 'Múltiplas clínicas' },
  { icon: CreditCard,  label: 'Planos & assinatura' },
];

export function LoginScreen() {
  const { signIn, signInWithEmail, signUpWithEmail, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      if (isRegister) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      // error handled by useAuth hook
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-ink-50 font-sans overflow-hidden relative select-none">
      
      {/* ── LEFT PANEL: Clean Branding & Value Prop ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-16 bg-white border-r border-ink-200 select-none z-10">
        
        {/* Subtle grid lines background overlay */}
        <div className="absolute inset-0 opacity-[0.4] z-0 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
        />

        {/* Brand Logo Row (Official System Style) */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-ink-200 overflow-hidden">
            <LogoIcon size={36} />
          </div>
          <div className="flex items-center">
            <span className="text-2xl font-black tracking-tighter text-ink-900">LAUD</span>
            <span className="text-2xl font-black tracking-tighter text-brand-600">.US</span>
          </div>
        </div>

        {/* Center: Value proposition + real feature map */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-start max-w-lg mt-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 mb-6">
            <Sparkles size={14} className="text-brand-500" />
            <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">LAUD.IA · Powered by Google Gemini</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] text-ink-900 mb-5">
            Do agendamento ao laudo assinado — em minutos.
          </h2>
          <p className="text-ink-500 text-base leading-relaxed font-medium mb-8">
            Plataforma completa de laudos ultrassonográficos com IA, PACS/DICOM integrado e gestão de clínica. Foque no diagnóstico; a LAUD.IA cuida do resto.
          </p>

          {/* Funcionalidades reais, mapeadas */}
          <div className="grid grid-cols-2 gap-2.5 w-full">
            {LANDING_FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-ink-50/70 border border-ink-100">
                <div className="w-8 h-8 rounded-lg bg-white border border-ink-100 flex items-center justify-center text-brand-600 shrink-0">
                  <f.icon size={15} />
                </div>
                <span className="text-xs font-bold text-ink-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: métricas + planos */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-ink-100">
          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-0.5">
              <h5 className="text-xl font-black text-ink-900">90%</h5>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Mais ágil</p>
            </div>
            <div className="space-y-0.5">
              <h5 className="text-xl font-black text-ink-900">Cloud</h5>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Sync nativo</p>
            </div>
            <div className="space-y-0.5">
              <h5 className="text-xl font-black text-ink-900">LGPD</h5>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Conformidade</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Planos a partir de</p>
            <p className="text-lg font-black text-brand-600">assinatura mensal</p>
          </div>
        </div>

      </div>

      {/* ── RIGHT PANEL: Clean Login Container ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden select-text z-10">
        
        <div className="w-full max-w-[400px] space-y-8">
          
          {/* Mobile Header (shown only on mobile) */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-4 mb-10">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-ink-200 overflow-hidden">
              <LogoIcon size={48} />
            </div>
            <div className="flex items-center">
              <span className="text-3xl font-black tracking-tighter text-ink-900">LAUD</span>
              <span className="text-3xl font-black tracking-tighter text-brand-600">.US</span>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2 mb-8">
            <h1 className="text-3xl font-black text-ink-900 tracking-tight">
              {isRegister ? 'Criar Conta' : 'Bem-vindo(a)'}
            </h1>
            <p className="text-ink-500 font-medium">
              {isRegister ? 'Cadastre suas credenciais clínicas.' : 'Faça login para acessar seu workspace clínico.'}
            </p>
          </div>

          {/* Auth error notification */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 text-left mb-6">
              <p className="text-sm text-rose-600 font-semibold leading-normal">{error}</p>
            </div>
          )}

          {/* Main Action Form / Control */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">E-mail Profissional</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  required
                  placeholder="exemplo@laud.us"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border-2 border-ink-100 rounded-2xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all text-sm font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border-2 border-ink-100 rounded-2xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all text-sm font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-brand-600 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-700 rounded-2xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : isRegister ? (
                'Criar Minha Conta'
              ) : (
                'Entrar no Sistema'
              )}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-ink-200"></div>
              <span className="px-3 text-[10px] font-black text-ink-400 uppercase tracking-widest">ou</span>
              <div className="flex-1 border-t border-ink-200"></div>
            </div>

            <button
              type="button"
              onClick={signIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white text-ink-900 font-bold py-3.5 px-6 rounded-2xl transition-all duration-200 shadow-sm border border-ink-200 hover:bg-ink-50 hover:border-ink-300 hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:ring-4 focus:ring-brand-500/10 outline-none"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0 select-none">
                <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.83 14.97.75 12 .75c-4.3 0-8.01 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.62 6.16-4.62Z" />
                <path fill="#4285F4" d="M22.56 12c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                <path fill="#FBBC05" d="M5.84 13.84c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.82H2.18C1.43 8.3 1 9.97 1 11.75s.43 3.45 1.18 4.93l3.66-2.84Z" />
                <path fill="#34A853" d="M12 22.75c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.28 7.7 22.75 12 22.75Z" />
              </svg>
              <span className="text-xs font-black uppercase tracking-wider">Continuar com o Google</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-all"
              >
                {isRegister ? 'Já possui cadastro? Entre' : 'Não tem conta? Cadastre-se'}
              </button>
            </div>

            {/* Secure Notice */}
            <div className="bg-ink-100/50 p-4 rounded-xl border border-ink-200 flex gap-3 text-left">
              <Lock size={16} className="text-ink-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-ink-500 font-medium leading-relaxed">
                Acesso restrito a profissionais de saúde autorizados. Conexão criptografada de ponta a ponta em conformidade com as normas HIPAA, LGPD e CFM.
              </p>
            </div>
          </form>

          {/* Compliance Icons Footer */}
          <div className="mt-8 pt-8 border-t border-ink-200 space-y-4">
            <div className="flex items-center justify-center lg:justify-start gap-4 text-[9px] uppercase tracking-widest font-bold">
              <span className="flex items-center gap-1.5 text-ink-500">
                <ShieldCheck size={14} className="text-emerald-500" /> HIPAA
              </span>
              <span className="flex items-center gap-1.5 text-ink-500">
                <Layers size={14} className="text-brand-500" /> AES-256
              </span>
              <span className="flex items-center gap-1.5 text-ink-500">
                <FileText size={14} className="text-ink-500" /> LGPD
              </span>
            </div>

            <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest flex items-center justify-center lg:justify-start gap-1.5">
              <CheckCircle size={12} className="text-emerald-500" /> SLA Clínico 99.99% Cloud
            </p>
          </div>

          {/* Copyright Info */}
          <p className="text-center lg:text-left text-ink-400 text-[10px] font-bold uppercase tracking-widest select-none mt-8">
            © {new Date().getFullYear()} LAUD.US — PLATAFORMA DE LAUDOS
          </p>

        </div>

      </div>

    </div>
  );
}
