import { useState, useCallback } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useApp } from '../store/app';
import { storeGoogleAccessToken, clearGoogleAccessToken } from '../lib/googleAuth';

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
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        storeGoogleAccessToken(credential.accessToken);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Google';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com email e senha';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      clearGoogleAccessToken();
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
    signInWithEmail,
    signUpWithEmail,
    signOut: signOutUser,
  };
}

