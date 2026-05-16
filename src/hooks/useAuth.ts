import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({ user, loading: false, error: null });
      },
      (error) => {
        console.error('[Auth] State change error:', error);
        setState({ user: null, loading: false, error: error.message });
      }
    );
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com Google';
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao sair';
      setState((s) => ({ ...s, error: message }));
    }
  }, []);

  /**
   * Obtém o access token OAuth do Google (necessário para Google Docs/Drive APIs).
   * Requer que o usuário esteja autenticado.
   */
  const getGoogleAccessToken = useCallback(async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    // O token OAuth fica disponível no credential do provedor
    // Para obter um token fresco, podemos usar getIdToken ou re-autenticar
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      return credential?.accessToken ?? null;
    } catch {
      return null;
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signOut: signOutUser,
    getGoogleAccessToken,
  };
}

