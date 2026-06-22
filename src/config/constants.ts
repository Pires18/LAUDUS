/**
 * Constantes de configuração do sistema.
 * Valores sensíveis (admin UID, email) vêm de variáveis de ambiente — nunca hardcoded no código.
 *
 * Para desenvolvimento local, defina em .env.local:
 *   VITE_ADMIN_UID=seu-uid-firebase
 *   VITE_ADMIN_EMAIL=seu@email.com
 */

export const ADMIN_UID: string = import.meta.env.VITE_ADMIN_UID || '';
export const ADMIN_EMAIL: string = import.meta.env.VITE_ADMIN_EMAIL || 'matheuskpires@gmail.com';

export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;
export const APP_ENV: string = import.meta.env.VITE_ENVIRONMENT || (import.meta.env.DEV ? 'development' : 'production');
