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
  const isAdminRole = profile?.role === 'admin' || settings.currentRole === 'admin' || (import.meta.env.DEV && user?.uid === 'dev-admin-uid');

  return {
    isAdmin: isSuperAdmin || isAdminRole,
    isSuperAdmin,
    role: profile?.role || settings.currentRole || 'medico',
  };
}
