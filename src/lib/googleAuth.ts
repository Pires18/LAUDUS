import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Adiciona os escopos necessários para a integração
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/documents');

// Variável para armazenar o token em memória
let cachedAccessToken: string | null = null;
let tokenExpirationTime: number | null = null;

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

    cachedAccessToken = credential.accessToken;
    // O token OAuth do Google costuma valer por 1 hora
    tokenExpirationTime = Date.now() + 3600000; 

    return cachedAccessToken;
  } catch (error: unknown) {
    // Se falhar em background, tentamos com prompt interativo
    console.warn('[Google Auth] Erro ao renovar token silenciosamente, solicitando interativamente...', error);
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential || !credential.accessToken) {
      throw new Error('Não foi possível obter o Access Token do Google após prompt.');
    }

    cachedAccessToken = credential.accessToken;
    tokenExpirationTime = Date.now() + 3600000; 
    return cachedAccessToken;
  }
}
