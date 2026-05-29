import { useAuth } from '../hooks/useAuth';
import { 
  Loader2, ShieldCheck, Sparkles, 
  Lock, CheckCircle, FileText, Layers, Activity, Sparkle
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { motion } from 'framer-motion';

export function LoginScreen() {
  const { signIn, loading, error } = useAuth();

  // Sequential entrance animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060709] font-sans overflow-hidden relative select-none">
      
      {/* ── GLOBAL BACKGROUND GLOWS ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Animated orb 1 */}
        <motion.div 
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.9, 1]
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] md:w-[45vw] md:h-[45vw] rounded-full bg-brand-500/10 blur-[120px] mix-blend-screen"
        />
        {/* Animated orb 2 */}
        <motion.div 
          animate={{
            x: [0, -30, 40, 0],
            y: [0, 60, -40, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] md:w-[45vw] md:h-[45vw] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-screen"
        />
      </div>

      {/* ── LEFT PANEL: Clinical Tech Space (Desktop Only) ── */}
      <div className="hidden md:flex md:w-7/12 relative overflow-hidden flex-col justify-between p-16 text-white border-r border-white/5 select-none z-10">
        
        {/* Subtle grid lines background overlay */}
        <div className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
        />

        {/* Brand Logo Row */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md">
            <LogoIcon size={32} />
          </div>
          <div className="flex items-center">
            <span className="text-xl font-black tracking-tighter text-white">LAUD</span>
            <span className="text-xl font-black tracking-tighter text-brand-400">.US</span>
          </div>
        </div>

        {/* Center: Concentric Ultrasound Wave Animation */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center my-8">
          <div className="relative w-96 h-96 flex items-center justify-center">
            
            {/* Multi-layered futuristic radar sweeps */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute w-80 h-80 rounded-full border border-dashed border-white/10"
            />
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute w-64 h-64 rounded-full border border-dashed border-brand-500/10"
            />
            
            {/* Ambient diagnostic pulse ring */}
            <motion.div 
              animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0, 0.15] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-80 h-80 rounded-full border-2 border-brand-500/20"
            />
            <motion.div 
              animate={{ scale: [1, 1.6, 1], opacity: [0.08, 0, 0.08] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              className="absolute w-80 h-80 rounded-full border border-indigo-500/20"
            />

            {/* Glowing Transducer & 3 Waves Vector Graphic */}
            <svg viewBox="0 0 100 100" className="w-72 h-72 relative drop-shadow-[0_0_35px_rgba(17,134,231,0.25)]">
              {/* Outer Pulsing Wave Arc */}
              <motion.path 
                d="M15,40 Q50,0 85,40" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.25, 0.9, 0.25], strokeWidth: [2, 3, 2] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Middle Wave Arc */}
              <motion.path 
                d="M25,52 Q50,20 75,52" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.35, 1, 0.35], strokeWidth: [2.5, 3.5, 2.5] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
              />
              {/* Inner Wave Arc */}
              <motion.path 
                d="M35,64 Q50,40 65,64" 
                fill="none" 
                stroke="url(#hero-gradient)" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                animate={{ opacity: [0.45, 1, 0.45], strokeWidth: [3, 4, 3] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
              />
              
              {/* Transducer Central Point */}
              <circle cx="50" cy="80" r="4.5" fill="#1186e7" className="animate-pulse" />
              <line x1="50" y1="80" x2="50" y2="92" stroke="#1186e7" strokeWidth="2.5" strokeDasharray="3 3" opacity="0.4" />

              {/* Gradient defs */}
              <defs>
                <linearGradient id="hero-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3aa1f6" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="#1186e7" stopOpacity="1" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>

            {/* Core Diagnostics badge */}
            <div className="absolute bottom-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl">
              <Activity size={13} className="text-brand-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300">Processador Clínico Ativo</span>
            </div>
          </div>

          <div className="max-w-md text-center mt-6 space-y-4">
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">
              O futuro do diagnóstico por ultrassom
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed font-medium px-4">
              Acelere a emissão de laudos de ultrassonografia com inteligência cognitiva de ponta, máscaras dinâmicas e total conformidade regulatória.
            </p>
          </div>
        </div>

        {/* Bottom Feature Metrics */}
        <div className="relative z-10 grid grid-cols-3 gap-8 pt-8 border-t border-white/5">
          <div className="space-y-1.5">
            <h5 className="text-2xl font-black text-brand-400">90%</h5>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Mais ágil</p>
          </div>
          <div className="space-y-1.5">
            <h5 className="text-2xl font-black text-indigo-400">Transdutor</h5>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Core 3.0</p>
          </div>
          <div className="space-y-1.5">
            <h5 className="text-2xl font-black text-emerald-400">HIPAA</h5>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Audit Compliance</p>
          </div>
        </div>

      </div>

      {/* ── RIGHT PANEL: Glassmorphism Login Container ── */}
      <div className="w-full md:w-5/12 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden select-text z-10">
        
        {/* Glow for mobile screen */}
        <div className="absolute inset-0 pointer-events-none z-0 block md:hidden">
          <div className="absolute top-[20%] right-[-10%] w-[80vw] h-[80vw] bg-indigo-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] left-[-10%] w-[80vw] h-[80vw] bg-brand-500/10 rounded-full blur-[100px]" />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative w-full max-w-[420px] space-y-6"
        >
          {/* Glass Card Container */}
          <div className="bg-[#0f1115]/80 backdrop-blur-2xl border border-white/10 rounded-[3rem] shadow-[0_24px_80px_rgba(0,0,0,0.4)] p-8 sm:p-12 text-center relative overflow-hidden group">
            
            {/* Top glowing flare on group hover */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-all duration-[1000ms]" />

            {/* Mobile Header Row (shown only on mobile) */}
            <div className="md:hidden flex items-center justify-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg">
                <LogoIcon size={26} />
              </div>
              <div className="flex items-center">
                <span className="text-md font-black tracking-tighter text-white">LAUD</span>
                <span className="text-md font-black tracking-tighter text-brand-400">.US</span>
              </div>
            </div>

            {/* Logo Wrapper with pulsing technical glow */}
            <motion.div variants={itemVariants} className="relative mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-[1.8rem] bg-[#0c0d12] flex items-center justify-center shadow-2xl ring-8 ring-white/5 overflow-hidden relative z-10 border border-white/10 hover:scale-105 hover:border-brand-500/30 transition-all duration-300">
                <LogoIcon size={64} />
              </div>
              <div className="absolute inset-0 w-[92px] h-[92px] border border-brand-500/20 rounded-full mx-auto -m-[6px] pointer-events-none animate-pulse" />
            </motion.div>

            {/* Active System Badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/5 text-slate-300 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border border-white/5 mb-6 shadow-inner">
              <Sparkles size={11} className="text-brand-400 animate-pulse" />
              Laud.IA 3.0 Core Ativo
            </motion.div>

            {/* Title / Info block */}
            <motion.div variants={itemVariants} className="space-y-3 mb-8">
              <div className="hidden md:flex items-center justify-center gap-0.5">
                <span className="text-4xl font-black text-white tracking-tighter">LAUD</span>
                <span className="text-4xl font-black text-brand-500 tracking-tighter">.US</span>
              </div>
              
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed px-1 font-medium">
                Plataforma inteligente de laudos estruturados para radiologia e ultrassonografia. Acesse o ecossistema clínico seguro.
              </p>
            </motion.div>

            {/* Auth error notification */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-4 text-left mb-6"
              >
                <p className="text-xs text-rose-400 font-bold leading-normal">{error}</p>
              </motion.div>
            )}

            {/* Main Action Form / Control */}
            <motion.div variants={itemVariants} className="space-y-6">
              <button
                onClick={signIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-4 bg-white text-slate-900 hover:bg-slate-50 font-black py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-brand-500/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-transparent focus:ring-4 focus:ring-brand-500/20 outline-none"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-slate-600" />
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0 select-none">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.83 14.97.75 12 .75c-4.3 0-8.01 2.47-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.62 6.16-4.62Z" />
                    <path fill="#4285F4" d="M22.56 12c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                    <path fill="#FBBC05" d="M5.84 13.84c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.82H2.18C1.43 8.3 1 9.97 1 11.75s.43 3.45 1.18 4.93l3.66-2.84Z" />
                    <path fill="#34A853" d="M12 22.75c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.28 7.7 22.75 12 22.75Z" />
                  </svg>
                )}
                <span className="text-xs uppercase tracking-[0.15em] font-black">
                  {loading ? 'Homologando Acesso...' : 'Acessar com o Google'}
                </span>
              </button>

              {/* Secure Notice */}
              <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex gap-3 text-left">
                <Lock size={15} className="text-brand-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  Acesso restrito a profissionais de saúde autorizados. Conexão criptografada de ponta a ponta em conformidade com as normas HIPAA, LGPD e CFM.
                </p>
              </div>
            </motion.div>

            {/* Compliance Icons Footer */}
            <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between text-slate-400 text-[8px] uppercase tracking-[0.15em] font-black">
                <span className="flex items-center gap-1 bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg text-slate-300">
                  <ShieldCheck size={11} className="text-emerald-400" /> HIPAA
                </span>
                <span className="flex items-center gap-1 bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg text-slate-300">
                  <Layers size={11} className="text-indigo-400" /> AES-256
                </span>
                <span className="flex items-center gap-1 bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg text-slate-300">
                  <FileText size={11} className="text-brand-400" /> LGPD
                </span>
              </div>

              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] pt-1 flex items-center justify-center gap-1.5">
                <CheckCircle size={10} className="text-emerald-450 text-emerald-400" /> SLA Clínico 99.99% Ultra-Cloud
              </p>
            </motion.div>

          </div>

          {/* Copyright Info */}
          <motion.p 
            variants={itemVariants}
            className="text-center text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] select-none"
          >
            © {new Date().getFullYear()} LAUD.US — ULTRA EDITION
          </motion.p>

        </motion.div>

      </div>

    </div>
  );
}


