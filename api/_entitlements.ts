import { getDb } from './_firebase.js';

const SUPER_ADMIN_EMAIL = 'matheuskpires@gmail.com';

// Cache em memória por instância serverless quente. Endpoints como o
// orthanc-proxy são chamados a cada miniatura/imagem — sem cache, cada request
// faria uma leitura no Firestore (lento e caro). TTL curto mantém a checagem
// barata sem atrasar mudanças de plano por muito tempo.
const cache = new Map<string, { allowed: boolean; expires: number }>();
const TTL_MS = 60_000;

/**
 * Verifica, server-side, se o usuário tem direito ao add-on PACS.
 *
 * Espelha exatamente a lógica do cliente (`useSubscription`): admin OU a
 * assinatura `sub_{uid}` inclui o add-on `pacs`. O id da assinatura é
 * determinístico (definido pelo webhook), então basta uma leitura direta.
 *
 * FAIL-OPEN: se a verificação em si falhar (Admin SDK indisponível/erro
 * transitório), retorna `true` — nunca derrubamos um pagante por causa de uma
 * falha de infraestrutura. Só bloqueamos quando confirmamos que não há o add-on.
 */
export async function hasPacsEntitlement(uid: string, email: string): Promise<boolean> {
  if (!uid) return true; // sem uid (ex.: ambiente local sem VERCEL) → não bloqueia
  const cached = cache.get(uid);
  if (cached && Date.now() < cached.expires) return cached.allowed;

  let allowed = true; // default fail-open
  try {
    const db = await getDb();
    const isSuper = (email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
    if (isSuper) {
      allowed = true;
    } else {
      const [userSnap, subSnap] = await Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('subscriptions').doc(`sub_${uid}`).get(),
      ]);
      const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin';
      const addons: string[] = (subSnap.exists && subSnap.data()?.addons) || [];
      allowed = isAdmin || addons.includes('pacs');
    }
    cache.set(uid, { allowed, expires: Date.now() + TTL_MS });
  } catch {
    // Não conseguimos verificar → fail-open (não cacheia, para reavaliar já já).
    allowed = true;
  }
  return allowed;
}
