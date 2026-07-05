import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Loader2, Lock, Mail, KeyRound } from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { PricingPlans } from './PricingPlans';
import { LegalModal, LEGAL_TERMS_VERSION } from './LegalModal';
import { storePendingTermsAcceptance } from '../lib/legalConsent';

interface Props {
  initialMode?: 'login' | 'signup';
  onBack?: () => void;
}

export function LoginScreen({ initialMode = 'login', onBack }: Props) {
  const { signIn, signInWithEmail, signUpWithEmail, resetPassword, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(initialMode === 'signup');
  const [showPricing, setShowPricing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
    } catch (err) {
      // error handled by useAuth hook
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-ink-50 font-sans p-6">
      <div className="w-full max-w-[420px] space-y-8">

        {onBack && (
          <button type="button" onClick={onBack} className="text-[10px] font-black text-ink-400 hover:text-ink-700 uppercase tracking-widest transition-all">
            ← Voltar
          </button>
        )}

        <div className="flex flex-col items-center justify-center gap-4">
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

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
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
            <button type="button" onClick={() => setLegalDoc('terms')} className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Termos de Uso</button>
            <span className="text-ink-300 mx-2">·</span>
            <button type="button" onClick={() => setLegalDoc('privacy')} className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Política de Privacidade</button>
          </p>
        </div>

      </div>

      <PricingPlans
        open={showPricing}
        onClose={() => setShowPricing(false)}
        onChoose={() => { setShowPricing(false); setIsRegister(true); }}
      />

      <LegalModal open={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
