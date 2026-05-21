import { useState, useCallback } from 'react';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useApp } from '../store/app';

/**
 * Hook de autenticação.
 *
 * `user` é lido do store global (useApp) — única fonte de verdade gerenciada
 * pelo listener onAuthStateChanged em App.tsx/AuthRouter — evitando um segundo
 * listener duplicado.
 *
 * `loading` e `error` são estados locais que representam apenas o andamento
 * da ação de signIn (popup Google OAuth), não o estado inicial de carregamento.
 */
export function useAuth() {
  const { user } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Google';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao sair';
      setError(message);
    }
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signOut: signOutUser,
  };
}
