import { getAdminAuth } from './_firebase.js';

export interface AuthedUser {
  uid: string;
  email: string;
}

/**
 * Verifica o Firebase ID token enviado em `Authorization: Bearer <token>`.
 * Retorna o usuário decodificado ou `null` se ausente/inválido.
 */
export async function verifyAuth(req: any): Promise<AuthedUser | null> {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return verifyIdTokenString(header.slice('Bearer '.length).trim());
}

/** Verifica um ID token avulso (ex: recebido via query string para <img src>). */
export async function verifyIdTokenString(token: string): Promise<AuthedUser | null> {
  if (!token || typeof token !== 'string') return null;
  try {
    const auth = await getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: (decoded.email || '').toLowerCase() };
  } catch {
    return null;
  }
}

/** Verifica se o chamador é admin consultando users/{uid}.role. */
export async function isAdmin(db: any, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}

/** True quando rodando no deployment de produção da Vercel. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}
