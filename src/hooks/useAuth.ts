import { useState, useCallback } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, linkWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useApp } from '../store/app';
import { storeGoogleAccessToken, clearGoogleAccessToken } from '../lib/googleAuth';
import { mapAuthError } from '../lib/authErrors';

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
      const message = mapAuthError(err, 'Erro ao entrar com Google. Tente novamente.');
      if (message) setError(message);
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
      const message = mapAuthError(err, 'Erro ao entrar. Verifique e-mail e senha.');
      if (message) setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // não bloqueia o cadastro se o envio do e-mail de verificação falhar
      }
    } catch (err: unknown) {
      const message = mapAuthError(err, 'Erro ao criar a conta. Tente novamente.');
      if (message) setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      const message = mapAuthError(err, 'Erro ao enviar o e-mail de redefinição. Tente novamente.');
      if (message) setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Vincula uma senha à conta atual (ex.: usuário que hoje só entra via
   * Google e quer passar a poder entrar com e-mail/senha também). O valor da
   * senha nunca sai do navegador do próprio usuário — só ele digita.
   */
  const setPassword = useCallback(async (password: string) => {
    if (!auth.currentUser?.email) throw new Error('Usuário não autenticado.');
    try {
      setLoading(true);
      setError(null);
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await linkWithCredential(auth.currentUser, credential);
    } catch (err: unknown) {
      const message = mapAuthError(err, 'Erro ao definir a senha. Tente novamente.');
      if (message) setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
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
    resetPassword,
    setPassword,
    resendVerificationEmail,
    signOut: signOutUser,
  };
}

