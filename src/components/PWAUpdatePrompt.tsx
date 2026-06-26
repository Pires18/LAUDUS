import { useState } from 'react';
import { Download, X, RefreshCw, Loader2 } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { logger } from '../utils/logger';

/**
 * PWAUpdatePrompt — Banner de atualização do sistema.
 *
 * Usa a API oficial do vite-plugin-pwa (useRegisterSW), que registra o
 * Service Worker, detecta novas versões de forma confiável e aplica a
 * atualização via SKIP_WAITING + reload — sem depender de gambiarra de
 * mensagem manual. Verifica atualizações periodicamente (a cada 30 min)
 * e também quando a aba volta ao foco.
 */
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 min

export function PWAUpdatePrompt() {
  const [applying, setApplying] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      logger.info('[PWA] Service Worker registrado.');

      // Checagem periódica de novas versões.
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL);

      // Checa também ao voltar o foco para a aba.
      const onFocus = () => registration.update().catch(() => {});
      window.addEventListener('focus', onFocus);
    },
    onRegisterError(err) {
      logger.warn('[PWA] Falha ao registrar Service Worker:', err);
    },
  });

  const handleUpdate = async () => {
    setApplying(true);
    try {
      // true → aplica skipWaiting e recarrega a página de forma confiável.
      await updateServiceWorker(true);
    } catch (err) {
      logger.warn('[PWA] Falha ao atualizar — recarregando manualmente:', err);
      // Fallback duro: limpa caches e recarrega.
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
      window.location.reload();
    }
  };

  if (!needRefresh) return null;

  return (
    <div className="pwa-banner pwa-banner-bottom bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Download size={16} />
        </div>
        <div className="min-w-0">
          <p className="font-black text-xs uppercase tracking-widest leading-tight">Nova versão disponível</p>
          <p className="text-[10px] text-white/70 font-medium">Atualize para obter melhorias e correções.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleUpdate}
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
