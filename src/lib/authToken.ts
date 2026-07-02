import { auth } from './firebase';

// Cache do Firebase ID token para uso em headers (fetch) e em URLs de
// recursos que não suportam headers (ex.: <img src> do proxy DICOM).
// O SDK renova o token automaticamente (~5 min antes de expirar) e dispara
// onIdTokenChanged, mantendo o cache fresco.

let cachedToken = '';

// Guard: em ambiente de teste o objeto auth é mockado sem onIdTokenChanged.
if (typeof (auth as any)?.onIdTokenChanged === 'function') {
  auth.onIdTokenChanged(async (user) => {
    try {
      cachedToken = user ? await user.getIdToken() : '';
    } catch {
      cachedToken = '';
    }
  });
}

/** Token síncrono (pode estar vazio logo após o boot). Para URLs de imagem. */
export function getCachedIdToken(): string {
  return cachedToken;
}

/** Token garantidamente fresco. Para chamadas fetch autenticadas. */
export async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return cachedToken;
  try {
    cachedToken = await user.getIdToken();
  } catch {
    // mantém o cache anterior
  }
  return cachedToken;
}
