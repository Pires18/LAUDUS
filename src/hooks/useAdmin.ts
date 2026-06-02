import { useApp } from '../store/app';
import { useAuth } from './useAuth';

/**
 * Hook para controle de acesso administrativo de elite.
 * Garante que apenas usuários autorizados ou o Super Admin (hardcoded) acessem funções críticas.
 */
export function useAdmin() {
  const { user } = useAuth();
  const { settings } = useApp();

  const SUPER_ADMIN_EMAIL = 'matheuskpires@gmail.com';

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const isAdminRole = settings.currentRole === 'admin';

  return {
    isAdmin: isSuperAdmin || isAdminRole,
    isSuperAdmin,
    role: settings.currentRole,
  };
}
