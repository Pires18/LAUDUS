import { useApp } from '../store/app';
import { useAuth } from './useAuth';

/**
 * Hook para controle de acesso administrativo de elite.
 * Garante que apenas usuários autorizados ou o Super Admin (hardcoded) acessem funções críticas.
 */
export function useAdmin() {
  const { user } = useAuth();
  const { settings, profile } = useApp();

  const SUPER_ADMIN_EMAIL = 'matheuskpires@gmail.com';

  const isSuperAdmin = (user?.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) || (import.meta.env.DEV && user?.uid === 'dev-admin-uid');
  // IMPORTANTE: o privilégio de admin vem SOMENTE do campo autoritativo
  // `profile.role` (users/{uid}.role), que as regras do Firestore só deixam um
  // admin alterar. NÃO usamos `settings.currentRole`: settings fica na subárvore
  // do próprio usuário (gravável por ele), então confiar nele deixaria qualquer
  // usuário abrir o painel admin apenas editando as próprias configurações.
  const isAdminRole = profile?.role === 'admin' || (import.meta.env.DEV && user?.uid === 'dev-admin-uid');

  return {
    isAdmin: isSuperAdmin || isAdminRole,
    isSuperAdmin,
    // `role` é só para exibir o modo de trabalho (medico/recepcao); o privilégio
    // de admin é definido por `isAdmin` acima, nunca por currentRole.
    role: profile?.role || settings.currentRole || 'medico',
  };
}
