import { useAuth } from '../hooks/useAuth';
import { useApp } from '../store/app';
import { 
  Loader2, ShieldCheck, Sparkles, 
  Lock, CheckCircle, FileText, Layers
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();

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

        {/* Center: Minimalist Proposition */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-start max-w-lg mt-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-100 border border-ink-200 mb-6">
            <Sparkles size={14} className="text-brand-500" />
            <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">LAUD.IA CORE V2.0 ATIVO</span>
          </div>
          
          <h2 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] text-ink-900 mb-6">
            Inteligência e agilidade na sua rotina clínica.
          </h2>
          <p className="text-ink-500 text-lg leading-relaxed font-medium">
            Plataforma ultrarrápida e minimalista de laudos estruturados. Reduza a carga cognitiva, foque no diagnóstico e deixe a IA cuidar do resto.
          </p>
        </div>

        {/* Bottom Feature Metrics */}
        <div className="relative z-10 flex flex-wrap items-center gap-12 pt-8 border-t border-ink-100">
          <div className="space-y-1">
            <h5 className="text-2xl font-black text-ink-900">90%</h5>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Mais ágil</p>
          </div>
          <div className="space-y-1">
            <h5 className="text-2xl font-black text-ink-900">Cloud</h5>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Sync Nativo</p>
          </div>
          <div className="space-y-1">
            <h5 className="text-2xl font-black text-ink-900">HIPAA</h5>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Compliance</p>
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
            <h1 className="text-3xl font-black text-ink-900 tracking-tight">Bem-vindo(a)</h1>
            <p className="text-ink-500 font-medium">Faça login para acessar seu workspace clínico.</p>
          </div>

          {/* Auth error notification */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 text-left mb-6">
              <p className="text-sm text-rose-600 font-semibold leading-normal">{error}</p>
            </div>
          )}

          {/* Main Action Form / Control */}
          <div className="space-y-6">
            <button
              onClick={signIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white text-ink-900 font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-sm border border-ink-200 hover:bg-ink-50 hover:border-ink-300 hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:ring-4 focus:ring-brand-500/10 outline-none animate-fade-in"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin text-ink-400" />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0 select-none">
                  <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.83 14.97.75 12 .75c-4.3 0-8.01 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.62 6.16-4.62Z" />
                  <path fill="#4285F4" d="M22.56 12c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                  <path fill="#FBBC05" d="M5.84 13.84c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.82H2.18C1.43 8.3 1 9.97 1 11.75s.43 3.45 1.18 4.93l3.66-2.84Z" />
                  <path fill="#34A853" d="M12 22.75c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.28 7.7 22.75 12 22.75Z" />
                </svg>
              )}
              <span className="text-sm font-bold">
                {loading ? 'Autenticando...' : 'Continuar com o Google'}
              </span>
            </button>

            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  const { setUser } = useApp.getState();
                  setUser({
                    uid: 'dev-admin-uid',
                    email: 'admin@laud.us',
                    displayName: 'Dr. Dev Admin',
                    emailVerified: true,
                    isAnonymous: false,
                    providerId: 'google.com',
                    metadata: {},
                    providerData: []
                  } as any);
                }}
                className="w-full flex items-center justify-center gap-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-sm border border-indigo-200 active:scale-95 cursor-pointer outline-none text-sm animate-fade-in"
              >
                <Sparkles size={20} className="text-indigo-600 animate-pulse" />
                <span>Bypass de Teste (Admin Dev)</span>
              </button>
            )}

            {/* Secure Notice */}
            <div className="bg-ink-100/50 p-4 rounded-xl border border-ink-200 flex gap-3 text-left">
              <Lock size={16} className="text-ink-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-ink-500 font-medium leading-relaxed">
                Acesso restrito a profissionais de saúde autorizados. Conexão criptografada de ponta a ponta em conformidade com as normas HIPAA, LGPD e CFM.
              </p>
            </div>
          </div>

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
