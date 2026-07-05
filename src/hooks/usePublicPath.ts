import { useCallback, useEffect, useState } from 'react';

/**
 * Mini-router das superfícies públicas (pré-auth) do LAUD.US.
 *
 * O app não usa react-router: o fluxo autenticado é uma máquina de views no
 * Zustand, e o vercel.json reescreve todo path não-/api para /index.html.
 * Isso permite URLs reais e compartilháveis para as telas públicas — landing,
 * login/cadastro e páginas legais — lendo window.location.pathname e mantendo
 * o histórico via pushState/popstate.
 */

export type PublicPath = 'landing' | 'login' | 'signup' | 'terms' | 'privacy';

export const PATHS: Record<PublicPath, string> = {
  landing: '/',
  login: '/login',
  signup: '/cadastro',
  terms: '/termos',
  privacy: '/privacidade',
};

export function getPublicPath(): PublicPath {
  if (typeof window === 'undefined') return 'landing';
  const raw = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  switch (raw) {
    case '/login': return 'login';
    case '/cadastro': return 'signup';
    case '/termos': return 'terms';
    case '/privacidade': return 'privacy';
    default: return 'landing';
  }
}

export function usePublicPath() {
  const [path, setPath] = useState<PublicPath>(getPublicPath);

  useEffect(() => {
    const onPop = () => setPath(getPublicPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: PublicPath, opts?: { replace?: boolean }) => {
    const url = PATHS[next];
    if (window.location.pathname !== url) {
      if (opts?.replace) window.history.replaceState({}, '', url);
      else window.history.pushState({}, '', url);
    }
    setPath(next);
  }, []);

  return { path, navigate };
}
