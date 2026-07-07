import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { UserRole } from '../types';
import { addAuditLog } from './db';

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
  const userRef = doc(firestore, 'users', uid);
  const subRef = doc(firestore, 'subscriptions', `sub_${uid}`);
  await deleteDoc(userRef);
  await deleteDoc(subRef).catch(() => { /* pode não existir (usuário sem assinatura) */ });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'DELETE_USER',
    details: `Removido usuário ${uid} (e sua assinatura). Histórico de uso de IA/transações mantido por retenção financeira.`,
    module: 'ADMIN_USERS'
  });
}
