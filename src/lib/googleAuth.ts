import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Adiciona os escopos necessários para a integração
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/documents');

// Inicializa a partir do localStorage para persistir entre recarregamentos de página/abas
let cachedAccessToken: string | null = null;
let tokenExpirationTime: number | null = null;

try {
  cachedAccessToken = localStorage.getItem('google_access_token');
  const storedExpiration = localStorage.getItem('google_token_expiration');
  tokenExpirationTime = storedExpiration ? Number(storedExpiration) : null;
} catch (e) {
  console.warn('[Google Auth] Erro ao ler do localStorage:', e);
}

/**
 * Salva o token de acesso do Google no cache em memória e no localStorage.
 */
export function storeGoogleAccessToken(token: string, expirationTimeOffsetMs = 3600000): void {
  cachedAccessToken = token;
  tokenExpirationTime = Date.now() + expirationTimeOffsetMs;
  try {
    localStorage.setItem('google_access_token', token);
    localStorage.setItem('google_token_expiration', tokenExpirationTime.toString());
  } catch (e) {
    console.warn('[Google Auth] Erro ao salvar no localStorage:', e);
  }
}

/**
 * Limpa o token de acesso do Google do cache e do localStorage.
 */
export function clearGoogleAccessToken(): void {
  cachedAccessToken = null;
  tokenExpirationTime = null;
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiration');
  } catch (e) {
    console.warn('[Google Auth] Erro ao limpar o localStorage:', e);
  }
}

/**
 * Obtém um token de acesso válido para as APIs do Google Workspace.
 * Reutiliza o token em cache se ainda for válido.
 */
export async function getGoogleAccessToken(forceRefresh = false): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Usuário não autenticado no Firebase.');
  }

  // Verifica se o token em cache ainda é válido (dando 5 min de margem)
  if (!forceRefresh && cachedAccessToken && tokenExpirationTime && Date.now() < tokenExpirationTime - 300000) {
    return cachedAccessToken;
  }

  try {
    // Para obter um token OAuth novo ou renovado, chamamos signInWithPopup novamente
    // O Firebase lidará com a sessão sem pedir credenciais de novo (se não houver prompt forced)
    provider.setCustomParameters({ prompt: 'none' }); 
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential || !credential.accessToken) {
      throw new Error('Não foi possível obter o Access Token do Google.');
    }

    storeGoogleAccessToken(credential.accessToken);
    return cachedAccessToken!;
  } catch (error: unknown) {
    // Se falhar em background, tentamos com prompt interativo
    console.warn('[Google Auth] Erro ao renovar token silenciosamente, solicitando interativamente...', error);
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential || !credential.accessToken) {
      throw new Error('Não foi possível obter o Access Token do Google após prompt.');
    }

    storeGoogleAccessToken(credential.accessToken);
    return cachedAccessToken!;
  }
}

