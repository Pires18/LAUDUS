import { useState, useEffect } from 'react';
import { Download, X, RefreshCw, Loader2 } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useApp } from '../store/app';
import { logger } from '../utils/logger';

/**
 * PWAUpdatePrompt — atualização do sistema.
 *
 * Estratégia: a nova versão é aplicada AUTOMATICAMENTE quando é seguro
 * (usuário fora de telas de trabalho), evitando que um cliente rode código
 * antigo — que já causou falhas (ex.: IA chamando o Google direto). Em telas
 * de trabalho (editor de laudo/máscara, LAUD.IA, formulário de clínica) NÃO
 * recarregamos sozinhos: mostramos o banner para o usuário aplicar quando
 * quiser, sem risco de perder trabalho. Ao sair da tela de trabalho com uma
 * atualização pendente, ela é aplicada automaticamente.
 */
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 min

// Telas onde há trabalho não salvo em risco — nunca recarregar sozinho.
const BUSY_VIEWS = new Set(['exam-editor', 'template-editor', 'laud-ia', 'clinic-form']);

export function PWAUpdatePrompt() {
  const { view } = useApp();
  const isBusy = BUSY_VIEWS.has(view.name);
  const [applying, setApplying] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      logger.info('[PWA] Service Worker registrado.');
      setInterval(() => { registration.update().catch(() => {}); }, UPDATE_CHECK_INTERVAL);
      const onFocus = () => registration.update().catch(() => {});
      window.addEventListener('focus', onFocus);
    },
    onRegisterError(err) {
      logger.warn('[PWA] Falha ao registrar Service Worker:', err);
    },
  });

  const applyUpdate = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await updateServiceWorker(true); // skipWaiting + reload confiável
    } catch (err) {
      logger.warn('[PWA] Falha ao atualizar — recarregando manualmente:', err);
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
      window.location.reload();
    }
  };

  // Auto-aplica a atualização quando há uma pendente E a tela é segura.
  // Um pequeno atraso evita recarregar bruscamente logo após uma navegação.
  useEffect(() => {
    if (!needRefresh || isBusy || applying) return;
    const t = setTimeout(() => { applyUpdate(); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRefresh, isBusy, applying]);

  if (!needRefresh) return null;

  // Tela segura → aplicando automaticamente: indicador discreto (sem ação).
  if (!isBusy) {
    return (
      <div className="pwa-banner pwa-banner-bottom bg-ink-900 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <p className="font-black text-xs uppercase tracking-widest leading-tight">Atualizando o sistema…</p>
        </div>
      </div>
    );
  }

  // Tela de trabalho → não recarrega sozinho; usuário decide.
  return (
    <div className="pwa-banner pwa-banner-bottom bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Download size={16} />
        </div>
        <div className="min-w-0">
          <p className="font-black text-xs uppercase tracking-widest leading-tight">Nova versão disponível</p>
          <p className="text-[10px] text-white/70 font-medium">Aplica automaticamente ao sair desta tela — ou atualize agora.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          disabled={applying}
          className="h-9 px-4 rounded-xl bg-white text-brand-700 font-black text-[10px] uppercase tracking-widest hover:bg-white/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
        >
          {applying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {applying ? 'Atualizando…' : 'Atualizar'}
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          disabled={applying}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-60"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
