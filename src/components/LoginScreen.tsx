import { useAuth } from '../hooks/useAuth';
import { Activity, Loader2, ShieldCheck, Cloud, Sparkles } from 'lucide-react';

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Floating Elements (Static) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[15%] left-[10%] text-brand-400">
          <Activity size={48} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[20%] right-[15%] text-indigo-400">
          <Cloud size={64} strokeWidth={1} />
        </div>
        <div className="absolute top-[40%] right-[25%] text-emerald-400">
          <ShieldCheck size={32} strokeWidth={1} />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] mx-4">
        <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] p-12 text-center relative overflow-hidden group">
          {/* Internal Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl group-hover:bg-brand-500/20 transition-colors duration-700" />
          
          {/* Logo Section */}
          <div className="relative mb-10">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 p-[1px] mx-auto shadow-2xl">
              <div className="w-full h-full rounded-3xl bg-[#0a0a0c] flex items-center justify-center">
                <Activity size={42} className="text-white" />
              </div>
            </div>
            <div className="absolute inset-0 w-28 h-28 -m-2 border border-brand-500/20 rounded-full border-dashed mx-auto opacity-50" />
          </div>

          <div className="space-y-2 mb-10">
            <h1 className="text-4xl font-black text-white tracking-tighter">
              LAUD<span className="text-brand-500">.US</span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-ink-400 text-sm font-medium">
              <Sparkles size={14} className="text-brand-400" />
              <span>Plataforma Inteligente de Laudos</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 mb-8 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Login Button */}
          <div className="space-y-4">
            <button
              onClick={signIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white text-[#0a0a0c] font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
                </svg>
              )}
              <span className="text-base">{loading ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>
            
            <p className="text-ink-500 text-[11px] leading-relaxed px-4">
              Acesso restrito para médicos e profissionais de saúde autorizados.
              Seus dados estão protegidos por criptografia militar.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-ink-500 text-[10px] uppercase tracking-[0.2em] font-bold">
            <span>Security</span>
            <div className="w-1 h-1 rounded-full bg-brand-500" />
            <span>Cloud Sync</span>
            <div className="w-1 h-1 rounded-full bg-brand-500" />
            <span>AI Powered</span>
          </div>
          <span className="text-ink-600 text-[9px] mt-2">© {new Date().getFullYear()} LAUD.US 3.0 — ULTRA EDITION</span>
        </div>
      </div>
    </div>
  );
}


