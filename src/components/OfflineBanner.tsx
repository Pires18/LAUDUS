import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * OfflineBanner — Exibe um banner fixo no topo quando o dispositivo
 * perde conexão com a internet, e um toast rápido quando reconecta.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Reconnected toast
  if (showReconnected) {
    return (
      <div className="pwa-banner pwa-banner-top bg-emerald-600 text-white shadow-lg">
        <Wifi size={14} className="shrink-0" />
        <span className="font-black text-[10px] uppercase tracking-widest">Conexão restaurada</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="pwa-banner pwa-banner-top bg-amber-600 text-white shadow-lg">
      <WifiOff size={14} className="shrink-0 animate-pulse" />
      <span className="font-black text-[10px] uppercase tracking-widest">Sem conexão — modo offline</span>
    </div>
  );
}
