import { useState } from 'react';
import { MailWarning, Loader2 } from 'lucide-react';
import { useApp } from '../store/app';
import { useAuth } from '../hooks/useAuth';

/**
 * Aviso fixo quando a conta foi criada por e-mail/senha e ainda não confirmou o
 * e-mail. Contas Google já chegam com emailVerified=true (não exibe nada).
 * O bloqueio real de geração de laudo acontece no servidor (api/gemini.ts);
 * este banner é só a superfície visível para o usuário resolver.
 */
export function EmailVerificationBanner() {
  const { user } = useApp();
  const { resendVerificationEmail } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) return null;
  const isPasswordAccount = user.providerData?.some((p) => p.providerId === 'password');
  if (!isPasswordAccount) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail();
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pwa-banner pwa-banner-top bg-amber-600 text-white shadow-lg">
      <MailWarning size={14} className="shrink-0" />
      <span className="font-black text-[10px] uppercase tracking-widest">
        {sent ? 'E-mail de verificação reenviado' : 'Confirme seu e-mail para gerar laudos com IA'}
      </span>
      {!sent && (
        <button
          onClick={handleResend}
          disabled={sending}
          className="ml-2 text-[10px] font-black uppercase tracking-widest underline underline-offset-2 disabled:opacity-60"
        >
          {sending ? <Loader2 size={12} className="animate-spin inline" /> : 'Reenviar e-mail'}
        </button>
      )}
    </div>
  );
}
