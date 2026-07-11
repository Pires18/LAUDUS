import { getDb, getAdminAuth } from './_firebase.js';
import { isAdmin, verifyAuth } from './_auth.js';

/**
 * Ativa/desativa a conta do Firebase Auth de um usuário (admin-only).
 *
 * Fecha um gap conhecido do fluxo de exclusão: `deleteUserDocument`
 * (`src/store/adminUsers.ts`) apaga `users/{uid}` e `subscriptions/sub_{uid}`
 * no Firestore, mas a conta do Firebase Auth continuava ativa — a pessoa
 * ainda conseguia logar, só encontrava um app sem perfil. Desativa (não
 * apaga) a conta: reversível pelo próprio admin, ao contrário de um
 * `deleteUser` definitivo.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const caller = await verifyAuth(req);
    if (!caller) return res.status(401).json({ error: 'Não autorizado. Token ausente ou inválido.' });

    const db = await getDb();
    if (!(await isAdmin(db, caller.uid))) {
      return res.status(403).json({ error: 'Apenas administradores podem alterar o status de autenticação de um usuário.' });
    }

    const { userId, disabled } = req.body || {};
    if (!userId || typeof disabled !== 'boolean') {
      return res.status(400).json({ error: 'userId (string) e disabled (boolean) são obrigatórios.' });
    }
    if (userId === caller.uid) {
      return res.status(400).json({ error: 'Você não pode desativar a própria conta de admin.' });
    }

    const auth = await getAdminAuth();
    await auth.updateUser(userId, { disabled });

    console.log(`[ADMIN-AUTH-STATUS] ${disabled ? 'Desativada' : 'Reativada'} conta Auth de ${userId} por ${caller.uid}`);
    return res.status(200).json({ success: true, userId, disabled });
  } catch (error: any) {
    // Conta já pode não existir mais no Auth (ex: usuário nunca fez login,
    // ou já foi removido antes) — não é uma falha real do ponto de vista do
    // admin, que só quer garantir que ninguém consiga logar com aquele uid.
    if (error?.code === 'auth/user-not-found') {
      return res.status(200).json({ success: true, userId: (req.body || {}).userId, disabled: (req.body || {}).disabled, note: 'Conta já não existia no Firebase Auth.' });
    }
    console.error('[ADMIN-AUTH-STATUS] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao alterar status de autenticação.' });
  }
}
