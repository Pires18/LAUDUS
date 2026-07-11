import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { UserRole } from '../types';
import { addAuditLog } from './db';
import { logger } from '../utils/logger';

/**
 * Atualiza o papel de um usuário no sistema.
 */
export async function updateUserRole(uid: string, role: UserRole, adminId: string, adminName: string) {
  const userRef = doc(firestore, 'users', uid);
  await updateDoc(userRef, { role, updatedAt: Date.now() });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'UPDATE_USER_ROLE',
    details: `Alterado papel do usuário ${uid} para ${role}`,
    module: 'ADMIN_USERS'
  });
}

/**
 * Ativa ou desativa um usuário.
 */
export async function setUserActiveStatus(uid: string, active: boolean, adminId: string, adminName: string) {
  const userRef = doc(firestore, 'users', uid);
  await updateDoc(userRef, { active, updatedAt: Date.now() });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    details: `${active ? 'Ativado' : 'Desativado'} usuário ${uid}`,
    module: 'ADMIN_USERS'
  });
}

export async function createUserDocument(
  userData: { 
    name: string; 
    email: string; 
    role: UserRole;
  }, 
  adminId: string, 
  adminName: string
) {
  const colRef = collection(firestore, 'users');
  const now = Date.now();
  const docRef = await addDoc(colRef, {
    ...userData,
    active: true,
    subscriptionStatus: 'trialing',
    createdAt: now,
    updatedAt: now
  });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'CREATE_USER',
    details: `Criado documento para usuário ${userData.email} (${docRef.id}) em período Trial`,
    module: 'ADMIN_USERS'
  });
  
  return docRef.id;
}

/**
 * Remove um usuário do sistema.
 *
 * Decisão de retenção de dados (confirmada com o responsável em 07/07/2026):
 * apaga `users/{uid}` e `subscriptions/sub_{uid}` (não faz sentido uma
 * assinatura órfã apontando pra um usuário que não existe mais) — mas MANTÉM
 * `ai_usage` e `transactions`, que são registros financeiros/fiscais
 * (o usuário já foi cobrado por aqueles laudos) e continuam consultáveis por
 * uid nas telas de Financeiro/Auditoria mesmo após a exclusão.
 */
export async function deleteUserDocument(uid: string, adminId: string, adminName: string) {
  const { deleteDoc } = await import('firebase/firestore');

  // Desativa a conta no Firebase Auth ANTES de apagar os dados — impede
  // login com um uid que já não tem mais perfil no Firestore. Best-effort:
  // se a chamada falhar (rede, endpoint fora do ar), a limpeza do Firestore
  // segue normalmente (comportamento anterior), mas fica registrada no
  // audit log pra o admin saber que precisa tentar desativar de novo.
  let authDisabled = false;
  let authWarning = '';
  try {
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin-set-user-auth-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ userId: uid, disabled: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) authDisabled = true;
    else authWarning = data?.error || `HTTP ${res.status}`;
  } catch (err: any) {
    authWarning = err?.message || 'Falha de rede';
  }
  if (!authDisabled) logger.error('Não foi possível desativar a conta no Firebase Auth:', authWarning);

  const userRef = doc(firestore, 'users', uid);
  const subRef = doc(firestore, 'subscriptions', `sub_${uid}`);
  await deleteDoc(userRef);
  await deleteDoc(subRef).catch(() => { /* pode não existir (usuário sem assinatura) */ });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'DELETE_USER',
    details: `Removido usuário ${uid} (e sua assinatura). Histórico de uso de IA/transações mantido por retenção financeira. `
      + (authDisabled
        ? 'Conta desativada no Firebase Auth.'
        : `AVISO: conta NÃO desativada no Firebase Auth (${authWarning}) — usuário ainda consegue logar.`),
    module: 'ADMIN_USERS'
  });
}
