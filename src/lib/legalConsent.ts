/**
 * Ponte entre o aceite de Termos/Privacidade no cadastro (LoginScreen, sem doc de
 * usuário ainda) e a criação do doc `users/{uid}` (App.tsx, após o Firebase Auth
 * confirmar a conta). O signup do Firebase Auth é síncrono/imediato; o doc do
 * Firestore só é criado depois, no listener onAuthStateChanged — por isso o
 * aceite precisa sobreviver nesse intervalo via localStorage.
 */
export const PENDING_TERMS_STORAGE_KEY = 'laudus_pending_terms_v1';

export interface PendingTermsAcceptance {
  termsVersion: string;
  termsAcceptedAt: number;
}

export function storePendingTermsAcceptance(version: string): void {
  const payload: PendingTermsAcceptance = { termsVersion: version, termsAcceptedAt: Date.now() };
  localStorage.setItem(PENDING_TERMS_STORAGE_KEY, JSON.stringify(payload));
}

export function consumePendingTermsAcceptance(): PendingTermsAcceptance | null {
  const raw = localStorage.getItem(PENDING_TERMS_STORAGE_KEY);
  if (!raw) return null;
  localStorage.removeItem(PENDING_TERMS_STORAGE_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
