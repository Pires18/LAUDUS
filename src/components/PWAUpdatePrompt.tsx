import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, X, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useApp } from '../store/app';
import { firestore } from '../lib/firebase';
import { logger } from '../utils/logger';
import { isNewVersionAvailable } from '../utils/appVersion';

// Momento (~) em que ESTE cliente carregou o código atual. Se um admin forçar a
// atualização (global_config/app_config.forceReloadAt) DEPOIS disto, o cliente
// está rodando código antigo e deve recarregar — mesmo numa tela de trabalho.
const APP_LOADED_AT = Date.now();

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
 *
 * Detecção: quanto mais gatilhos de `registration.update()`, menor a janela
 * entre "deploy enviado" e "cliente percebe". Checar é barato — o sw.js é
 * servido com `must-revalidate` (vercel.json), então uma checagem sem novidade
 * volta 304. Gatilhos: timer, foco, volta de aba (visibilitychange), reconexão
 * (online) e cada troca de tela (sessão ativa detecta em segundos).
 */
const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000; // 15 min (piso; os gatilhos abaixo pegam antes)

// Telas onde há trabalho não salvo em risco — nunca recarregar sozinho.
const BUSY_VIEWS = new Set(['exam-editor', 'template-editor', 'laud-ia', 'clinic-form']);

export function PWAUpdatePrompt() {
  const { view } = useApp();
  const isBusy = BUSY_VIEWS.has(view.name);
  const [applying, setApplying] = useState(false);
  // Divergência detectada por /version.json — sinal independente do SW (pega
  // deploy novo mesmo com service worker travado).
  const [versionUpdate, setVersionUpdate] = useState(false);
  // Atualização CRÍTICA forçada por um admin — recarrega mesmo em tela de trabalho.
  const [critical, setCritical] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      regRef.current = registration;
      logger.info('[PWA] Service Worker registrado.');
    },
    onRegisterError(err) {
      logger.warn('[PWA] Falha ao registrar Service Worker:', err);
    },
  });

  const pending = needRefresh || versionUpdate;

  // Verifica nova versão por DOIS caminhos: o SW (registration.update) e o
  // /version.json (independente do SW). Estável (useCallback) para casar
  // add/removeEventListener e não recriar o interval.
  const checkForUpdate = useCallback(() => {
    regRef.current?.update().catch(() => {});
    isNewVersionAvailable()
      .then((isNew) => { if (isNew) setVersionUpdate(true); })
      .catch(() => {});
  }, []);

  // Gatilhos — todos com limpeza (sem vazar interval/listeners na remontagem).
  // Quanto mais gatilhos, menor a janela entre "deploy enviado" e "cliente vê".
  useEffect(() => {
    checkForUpdate(); // imediato: pega um deploy que saiu enquanto o app carregava
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
    const id = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkForUpdate]);

  // Sessão em uso ativo: verifica a cada troca de tela — deploy detectado em
  // segundos, sem depender do timer de 15 min.
  useEffect(() => {
    checkForUpdate();
  }, [view.name, checkForUpdate]);

  // Força-crítica do admin: assina global_config/app_config. Se forceReloadAt for
  // posterior ao carregamento deste cliente, ele está com código antigo → recarrega.
  useEffect(() => {
    const ref = doc(firestore, 'global_config', 'app_config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const forcedAt = snap.exists() ? (snap.data() as { forceReloadAt?: number }).forceReloadAt : undefined;
        if (typeof forcedAt === 'number' && forcedAt > APP_LOADED_AT) {
          logger.info('[PWA] Atualização crítica forçada pelo admin.');
          setCritical(true);
          setVersionUpdate(true);
        }
      },
      () => {},
    );
    return () => unsub();
  }, []);

  // Recarga forçada — limpa caches e recarrega. Usada quando não há SW em espera
  // (divergência só de version.json) ou quando o updateServiceWorker falha.
  const hardReload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ignore */ }
    window.location.reload();
  };

  const applyUpdate = async () => {
    if (applying) return;
    setApplying(true);
    try {
      if (needRefresh) {
        await updateServiceWorker(true); // skipWaiting + reload confiável
      } else {
        await hardReload(); // versão nova sem SW em espera (ou SW travado)
      }
    } catch (err) {
      logger.warn('[PWA] Falha ao atualizar — recarregando manualmente:', err);
      await hardReload();
    }
  };

  // Auto-aplica quando há pendente E a tela é segura — OU quando é crítica
  // (força mesmo em tela de trabalho, com um respiro maior pro auto-save flushar).
  useEffect(() => {
    if (!pending || applying) return;
    if (isBusy && !critical) return;
    const t = setTimeout(() => { applyUpdate(); }, critical ? 6000 : 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, isBusy, applying, critical]);

  if (!pending) return null;

  // Atualização crítica → banner urgente; recarrega em instantes em qualquer tela.
  if (critical) {
    return (
      <div className="pwa-banner pwa-banner-bottom bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle size={16} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-black text-xs uppercase tracking-widest leading-tight">Atualização crítica</p>
            <p className="text-[10px] text-white/80 font-medium">Recarregando para a versão mais recente — salve seu trabalho.</p>
          </div>
        </div>
        <button
          onClick={applyUpdate}
          disabled={applying}
          className="h-9 px-4 rounded-xl bg-white text-rose-700 font-black text-[10px] uppercase tracking-widest hover:bg-white/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60 shrink-0"
        >
          {applying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {applying ? 'Atualizando…' : 'Atualizar já'}
        </button>
      </div>
    );
  }

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
          onClick={() => { setNeedRefresh(false); setVersionUpdate(false); }}
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
