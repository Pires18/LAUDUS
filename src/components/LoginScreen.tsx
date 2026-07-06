import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Loader2, Lock, Mail, KeyRound, Eye, EyeOff,
  Sparkles, Server, ShieldCheck, Building2, FlaskConical,
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { PricingPlans } from './PricingPlans';
import { LegalModal, LEGAL_TERMS_VERSION } from './LegalModal';
import { storePendingTermsAcceptance } from '../lib/legalConsent';

interface Props {
  initialMode?: 'login' | 'signup';
  onBack?: () => void;
}

/** Bullets honestos do painel de marca (sem prova social inventada). */
const VALUE_POINTS = [
  { icon: Sparkles, title: 'IA com revisão médica obrigatória', text: 'O LAUD.IA sugere o texto do laudo; a decisão clínica e a assinatura são sempre do médico.' },
  { icon: Server, title: 'PACS/DICOM gerenciado', text: 'Imagens do aparelho entram direto na worklist, sem pendrive e sem servidor local.' },
  { icon: ShieldCheck, title: 'LGPD by design', text: 'Identificadores do paciente são removidos antes de qualquer chamada à IA.' },
  { icon: Building2, title: 'Multi-clínica', text: 'Agenda, pacientes e laudos organizados por clínica, com permissões por equipe.' },
];

export function LoginScreen({ initialMode = 'login', onBack }: Props) {
  const { signIn, signInWithEmail, signUpWithEmail, resetPassword, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(initialMode === 'signup');
  const [showPricing, setShowPricing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Botão Voltar do navegador entre /login ↔ /cadastro atualiza o modo.
  useEffect(() => {
    setIsRegister(initialMode === 'signup');
  }, [initialMode]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${isRegister ? 'Criar conta' : 'Entrar'} — LAUD.US`;
    return () => { document.title = prev; };
  }, [isRegister]);

  // Superfície pré-auth light-only (coerente com a landing): suspende o tema
  // escuro do dispositivo enquanto a tela estiver montada e restaura ao sair.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    return () => {
      if (wasDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      }
    };
  }, []);

  const switchMode = (register: boolean) => {
    setIsRegister(register);
    // URL linkável sem poluir o histórico (replace, não push).
    window.history.replaceState({}, '', register ? '/cadastro' : '/login');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // erro já exposto via useAuth().error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegister && !acceptedTerms) return;
    try {
      if (isRegister) {
        storePendingTermsAcceptance(LEGAL_TERMS_VERSION);
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // error handled by useAuth hook
    }
  };

  const handleGoogle = async () => {
    // Google OAuth pode criar a conta transparentemente (primeiro acesso).
    // Registra o aceite pendente SEMPRE antes do popup: App.tsx só o consome
    // ao criar um doc de usuário NOVO — logins de contas existentes ignoram.
    if (isRegister && !acceptedTerms) return;
    storePendingTermsAcceptance(LEGAL_TERMS_VERSION);
    await signIn();
  };

  return (
    <div className="h-full w-full flex overflow-y-auto bg-ink-50 font-sans">

      {/* ══ Painel de marca (desktop) ══ */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white overflow-hidden select-none">
        {/* textura + brilhos decorativos */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-24 w-[380px] h-[380px] rounded-full bg-sky-300/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-white/[0.06] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[680px] rounded-full border border-white/[0.04] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg overflow-hidden shrink-0">
            <LogoIcon size={36} />
          </div>
          <div className="flex items-center text-2xl font-black tracking-tighter">
            <span>LAUD</span><span className="text-sky-300">.US</span>
          </div>
        </div>

        {/* Proposta de valor */}
        <div className="relative z-10 space-y-8 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-black tracking-tight leading-[1.15]">
            Do agendamento ao laudo assinado — em minutos.
          </h2>
          <ul className="space-y-5">
            {VALUE_POINTS.map((p) => (
              <li key={p.title} className="flex items-start gap-3.5 group">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-white/15 group-hover:border-white/25 transition-colors">
                  <p.icon size={16} className="text-sky-200" />
                </div>
                <div>
                  <p className="text-sm font-black leading-tight">{p.title}</p>
                  <p className="text-[13px] text-brand-100/80 leading-relaxed mt-1">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Badge de fase */}
        <div className="relative z-10 flex items-center gap-2.5 text-brand-100/90 border-t border-white/10 pt-6">
          <FlaskConical size={14} className="shrink-0" />
          <p className="text-[11px] font-bold uppercase tracking-widest">Programa de testes restrito · acesso por convite</p>
        </div>
      </div>

      {/* ══ Coluna do formulário ══ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px] space-y-7">

          {onBack && (
            <button type="button" onClick={onBack} className="text-[10px] font-black text-ink-400 hover:text-ink-700 uppercase tracking-widest transition-all">
              ← Voltar
            </button>
          )}

          {/* Logo (mobile e desktop) */}
          <div className="flex flex-col items-center justify-center gap-4 lg:hidden">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-ink-200 overflow-hidden">
              <LogoIcon size={48} />
            </div>
            <div className="flex items-center">
              <span className="text-3xl font-black tracking-tighter text-ink-900">LAUD</span>
              <span className="text-3xl font-black tracking-tighter text-brand-600">.US</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-ink-900 tracking-tight">
              {forgotPassword ? 'Redefinir Senha' : isRegister ? 'Criar Conta' : 'Bem-vindo(a)'}
            </h1>
            <p className="text-ink-500 font-medium text-sm">
              {forgotPassword
                ? 'Informe seu e-mail para receber o link de redefinição.'
                : isRegister ? 'Cadastre suas credenciais clínicas.' : 'Faça login para acessar seu workspace clínico.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-ink-200 shadow-sm p-6 sm:p-8 space-y-5">
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 text-left">
                <p className="text-sm text-rose-600 font-semibold leading-normal">{error}</p>
              </div>
            )}

            {forgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {resetSent ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 text-left">
                    <p className="text-sm text-emerald-700 font-semibold leading-normal">
                      Se existir uma conta com este e-mail, enviamos um link de redefinição de senha. Verifique sua caixa de entrada.
                    </p>
                  </div>
                ) : (
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
                )}

                {!resetSent && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-brand-600 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-700 rounded-2xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin text-white" /> : 'Enviar Link de Redefinição'}
                  </button>
                )}

                <div className="flex items-center justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setForgotPassword(false); setResetSent(false); }}
                    className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-all"
                  >
                    ← Voltar ao login
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">E-mail Profissional</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-12 pr-12 bg-white border-2 border-ink-100 rounded-2xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all text-sm font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 transition-colors"
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isRegister && (
                  <p className="text-[10px] text-ink-400 font-medium ml-1">Mínimo de 6 caracteres.</p>
                )}
              </div>

              {isRegister && (
                <label className="flex items-start gap-2.5 px-1 py-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-2 border-ink-300 text-brand-600 focus:ring-brand-500/30 shrink-0"
                  />
                  <span className="text-[11px] text-ink-500 font-medium leading-relaxed">
                    Li e aceito os{' '}
                    <button type="button" onClick={() => setLegalDoc('terms')} className="text-brand-600 font-bold underline underline-offset-2 hover:text-brand-700">
                      Termos de Uso
                    </button>{' '}
                    e a{' '}
                    <button type="button" onClick={() => setLegalDoc('privacy')} className="text-brand-600 font-bold underline underline-offset-2 hover:text-brand-700">
                      Política de Privacidade
                    </button>.
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading || (isRegister && !acceptedTerms)}
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
                onClick={handleGoogle}
                disabled={loading || (isRegister && !acceptedTerms)}
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

              {!isRegister && (
                <p className="text-[10px] text-ink-400 font-medium leading-relaxed text-center px-2">
                  Ao continuar com o Google você concorda com os{' '}
                  <button type="button" onClick={() => setLegalDoc('terms')} className="underline underline-offset-2 hover:text-ink-600">Termos de Uso</button>{' '}
                  e a{' '}
                  <button type="button" onClick={() => setLegalDoc('privacy')} className="underline underline-offset-2 hover:text-ink-600">Política de Privacidade</button>.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => switchMode(!isRegister)}
                  className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-all"
                >
                  {isRegister ? 'Já possui cadastro? Entre' : 'Não tem conta? Cadastre-se'}
                </button>
                <span className="w-px h-3 bg-ink-200" />
                <button
                  type="button"
                  onClick={() => setShowPricing(true)}
                  className="text-[10px] font-black text-ink-500 hover:text-ink-800 uppercase tracking-widest transition-all"
                >
                  Ver planos
                </button>
                {!isRegister && (
                  <>
                    <span className="w-px h-3 bg-ink-200" />
                    <button
                      type="button"
                      onClick={() => setForgotPassword(true)}
                      className="text-[10px] font-black text-ink-500 hover:text-ink-800 uppercase tracking-widest transition-all"
                    >
                      Esqueci minha senha
                    </button>
                  </>
                )}
              </div>

              <div className="bg-ink-100/50 p-4 rounded-xl border border-ink-200 flex gap-3 text-left">
                <Lock size={16} className="text-ink-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-ink-500 font-medium leading-relaxed">
                  Acesso restrito a profissionais de saúde autorizados. Ambiente em fase de testes — dados protegidos por autenticação e regras de acesso por usuário/clínica.
                </p>
              </div>
            </form>
            )}
          </div>

          <div className="text-center space-y-2">
            <p className="text-ink-400 text-[10px] font-bold uppercase tracking-widest select-none">
              © {new Date().getFullYear()} LAUD.US — Sistemas de Laudos Inteligentes
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest">
              <a href="/termos" className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Termos de Uso</a>
              <span className="text-ink-300 mx-2">·</span>
              <a href="/privacidade" className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Política de Privacidade</a>
            </p>
          </div>

        </div>
      </div>

      <PricingPlans
        open={showPricing}
        onClose={() => setShowPricing(false)}
        onChoose={() => { setShowPricing(false); switchMode(true); }}
      />

      <LegalModal open={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
