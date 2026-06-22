import { useState, useEffect } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

/**
 * PWAUpdatePrompt — Exibe um banner elegante quando uma nova versão
 * do Service Worker está disponível, permitindo que o usuário atualize.
 */
export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Only run in production (SW not active in dev)
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // New SW activated — reload to apply
      window.location.reload();
    };

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        // Listen for new installing worker
        const onUpdateFound = () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed but waiting — prompt user
              setRegistration(reg);
              setShowUpdate(true);
            }
          });
        };

        reg.addEventListener('updatefound', onUpdateFound);

        // Also check if there's already a waiting worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          setRegistration(reg);
          setShowUpdate(true);
        }

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
          reg.removeEventListener('updatefound', onUpdateFound);
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
      } catch (err) {
        logger.warn('[PWA Update] Erro ao verificar atualização:', err);
      }
    };

    checkForUpdates();
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

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
          className="h-9 px-4 rounded-xl bg-white text-brand-700 font-black text-[10px] uppercase tracking-widest hover:bg-white/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={12} />
          Atualizar
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
