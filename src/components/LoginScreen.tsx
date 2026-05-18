import { useAuth } from '../hooks/useAuth';
import { 
  Loader2, ShieldCheck, Sparkles, 
  Lock, CheckCircle, FileText, Layers, Bot, Activity
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { motion } from 'framer-motion';

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();

  return (
    <div className="min-h-screen w-full flex bg-[#fafafb] font-sans overflow-hidden">
      
      {/* LEFT PANEL: Clinical Hero & Ultrasound Concept (Desktop Only) */}
      <div className="hidden md:flex md:w-7/12 bg-slate-950 relative overflow-hidden flex-col justify-between p-16 text-white border-r border-slate-900 select-none">
        
        {/* Dynamic mesh gradients */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-brand-500/20 rounded-full blur-[160px] animate-pulse duration-[6000ms]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-indigo-500/20 rounded-full blur-[160px] animate-pulse duration-[8000ms]" />
        </div>

        {/* Clinical Grid lines background */}
        <div className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
        />

        {/* Top Header Row */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
            <LogoIcon size={32} />
          </div>
          <div className="flex items-center">
            <span className="text-lg font-black tracking-tighter text-white">LAUD</span>
            <span className="text-lg font-black tracking-tighter text-brand-400">.US</span>
          </div>
        </div>

        {/* Center: Stunning interactive Ultrasound concentric waves illustration */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center my-8">
          
          <div className="relative w-80 h-80 flex items-center justify-center">
            {/* Ambient diagnostic pulse ring */}
            <motion.div 
              animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0, 0.1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-72 h-72 rounded-full border-2 border-brand-500/20"
            />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0, 0.05] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute w-72 h-72 rounded-full border border-indigo-500/20"
            />

            {/* Glowing Transducer & 3 Waves Vector Graphic */}
            <svg viewBox="0 0 100 100" className="w-64 h-64 relative drop-shadow-[0_0_25px_rgba(14,165,233,0.3)]">
              {/* Outer Pulsing Wave Arc */}
              <motion.path 
                d="M15,40 Q50,0 85,40" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.3, 1, 0.3], strokeWidth: [2, 3, 2] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Middle Wave Arc */}
              <motion.path 
                d="M25,52 Q50,20 75,52" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.4, 1, 0.4], strokeWidth: [2.5, 3.5, 2.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              />
              {/* Inner Wave Arc */}
              <motion.path 
                d="M35,64 Q50,40 65,64" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.5, 1, 0.5], strokeWidth: [3, 4, 3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              />
              
              {/* Transducer Central Point */}
              <circle cx="50" cy="80" r="4" fill="#0ea5e9" className="animate-pulse" />
              <line x1="50" y1="80" x2="50" y2="92" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="3 3" opacity="0.5" />

              {/* Gradient defs */}
              <defs>
                <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#0ea5e9" stopOpacity="1" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>

            {/* Core Diagnostics badge */}
            <div className="absolute bottom-4 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-2xl">
              <Activity size={14} className="text-brand-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Processamento de Sinais Ativo</span>
            </div>
          </div>

          <div className="max-w-md text-center mt-6 space-y-3">
            <h2 className="text-3xl font-black tracking-tight leading-tight">
              O futuro do diagnóstico por ultrassom
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">
              Acelere a emissão de laudos de ultrassonografia com inteligência cognitiva de ponta, máscaras dinâmicas e total segurança.
            </p>
          </div>
        </div>

        {/* Bottom Feature Metrics */}
        <div className="relative z-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
          <div className="space-y-1">
            <h5 className="text-lg font-black text-brand-400">90%</h5>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mais rápido</p>
          </div>
          <div className="space-y-1">
            <h5 className="text-lg font-black text-indigo-400">Transdutor</h5>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Core 3.0</p>
          </div>
          <div className="space-y-1">
            <h5 className="text-lg font-black text-emerald-400">HIPAA</h5>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Audit Compliance</p>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: Login Screen Card Form */}
      <div className="w-full md:w-5/12 bg-slate-50 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden select-text">
        
        {/* Dynamic mesh glow for background screen */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[50%] bg-brand-200/20 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] space-y-6">
          
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-[3rem] shadow-[0_24px_60px_rgba(15,23,42,0.03)] p-8 sm:p-12 text-center relative overflow-hidden group">
            
            {/* Ambient hover top corner flare */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-all duration-[800ms]" />

            {/* Logo Wrapper with neon-like clinical frame */}
            <div className="relative mb-8 flex justify-center">
              <div className="w-20 h-20 rounded-[1.8rem] bg-white flex items-center justify-center shadow-lg ring-8 ring-slate-100/50 overflow-hidden relative z-10 hover:scale-105 transition-transform duration-300 border border-slate-100">
                <LogoIcon size={64} />
              </div>
              <div className="absolute inset-0 w-[90px] h-[90px] border border-brand-500/10 rounded-full mx-auto -m-[5px] pointer-events-none animate-pulse" />
            </div>

            {/* Platform Slogan Badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100/80 mb-6">
              <Sparkles size={11} className="text-brand-500 animate-spin duration-3000" />
              Laud.IA 3.0 Core Ativo
            </div>

            {/* Main Brand Identifier */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-4xl font-black text-slate-900 tracking-tighter">LAUD</span>
                <span className="text-4xl font-black text-brand-600 tracking-tighter">.US</span>
              </div>
              
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed px-1 font-medium">
                Plataforma inteligente de laudos estruturados para radiologia e ultrassonografia. Otimize seus fluxos clínicos com segurança e agilidade.
              </p>
            </div>

            {/* Error box */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-left mb-6 animate-slide-up">
                <p className="text-xs text-red-700 font-bold leading-normal">{error}</p>
              </div>
            )}

            {/* Sign-in Control */}
            <div className="space-y-6">
              <button
                onClick={signIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-4 bg-white hover:bg-slate-50 border-2 border-slate-200/80 text-slate-800 font-bold py-4 px-6 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ring-4 ring-transparent hover:ring-slate-100"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0 select-none">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.83 14.97.75 12 .75c-4.3 0-8.01 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.62 6.16-4.62Z" />
                    <path fill="#4285F4" d="M22.56 12c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                    <path fill="#FBBC05" d="M5.84 13.84c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.82H2.18C1.43 8.3 1 9.97 1 11.75s.43 3.45 1.18 4.93l3.66-2.84Z" />
                    <path fill="#34A853" d="M12 22.75c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.28 7.7 22.75 12 22.75Z" />
                  </svg>
                )}
                <span className="text-xs uppercase tracking-widest font-black">
                  {loading ? 'Acessando...' : 'Acessar com o Google'}
                </span>
              </button>

              {/* Secure Notice */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex gap-3 text-left">
                <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Acesso restrito a médicos credenciados. As sessões são criptografadas em conformidade com as normas HIPAA, LGPD e regulamentos do CFM.
                </p>
              </div>

            </div>

            {/* Compliance Icons Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between text-slate-400 text-[8px] uppercase tracking-widest font-black">
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <ShieldCheck size={11} className="text-emerald-500 animate-pulse" /> HIPAA
                </span>
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <Layers size={11} className="text-slate-400" /> AES-256
                </span>
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <FileText size={11} className="text-brand-500" /> LGPD
                </span>
              </div>

              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest pt-1 flex items-center justify-center gap-1">
                <CheckCircle size={10} className="text-emerald-500" /> SLA 99.99% ULTRA-RELIABLE CLOUD
              </p>
            </div>

          </div>

          {/* Copyright notice */}
          <p className="text-center text-slate-400 text-[8px] font-black uppercase tracking-widest select-none">
            © {new Date().getFullYear()} LAUD.US — ULTRA EDITION
          </p>

        </div>

      </div>

    </div>
  );
}

export default LoginScreen;
