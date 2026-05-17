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

/**
 * Cria um novo registro de usuário manualmente.
 * Nota: Isso não cria a conta no Firebase Auth, apenas o documento no Firestore.
 */
export async function createUserDocument(userData: { name: string, email: string, role: UserRole }, adminId: string, adminName: string) {
  const colRef = collection(firestore, 'users');
  const now = Date.now();
  const docRef = await addDoc(colRef, {
    ...userData,
    active: true,
    createdAt: now,
    updatedAt: now
  });

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'CREATE_USER',
    details: `Criado documento para usuário ${userData.email} (${docRef.id})`,
    module: 'ADMIN_USERS'
  });
  
  return docRef.id;
}

/**
 * Remove um usuário do sistema.
 */
export async function deleteUserDocument(uid: string, adminId: string, adminName: string) {
  const userRef = doc(firestore, 'users', uid);
  // Por segurança, vamos usar o deleteDoc direto, mas em prod geralmente usamos soft-delete
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(userRef);

  await addAuditLog({
    userId: adminId,
    userName: adminName,
    action: 'DELETE_USER',
    details: `Removido usuário ${uid}`,
    module: 'ADMIN_USERS'
  });
}
