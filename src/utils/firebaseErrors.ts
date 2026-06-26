/**
 * Tradução de erros do Firebase/Firestore para mensagens claras em português.
 *
 * Usado principalmente nos painéis administrativos, onde um erro de
 * `permission-denied` normalmente significa que as regras de segurança do
 * Firestore ainda não foram implantadas (deploy) ou que o usuário não possui
 * cargo de administrador.
 */

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

const MESSAGES: Record<string, string> = {
  'permission-denied':
    'Permissão negada. Verifique se você tem cargo de administrador e se as regras do Firestore foram implantadas (firebase deploy --only firestore:rules).',
  'unauthenticated':
    'Sessão expirada. Faça login novamente para continuar.',
  'not-found':
    'Registro não encontrado. Ele pode ter sido removido por outro usuário.',
  'already-exists':
    'Este registro já existe.',
  'unavailable':
    'Serviço temporariamente indisponível. Verifique sua conexão e tente novamente.',
  'deadline-exceeded':
    'A operação demorou demais. Verifique sua conexão e tente novamente.',
  'failed-precondition':
    'Operação não permitida no estado atual dos dados.',
  'resource-exhausted':
    'Limite de uso do banco atingido. Tente novamente em instantes.',
};

/**
 * Retorna uma mensagem amigável (PT-BR) para um erro do Firebase.
 * @param err  Erro capturado (FirebaseError ou genérico).
 * @param fallback  Mensagem padrão quando o código não for reconhecido.
 */
export function friendlyFirebaseError(err: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const e = err as FirebaseLikeError;
  const rawCode = e?.code || '';
  // Firebase usa o formato "service/code" (ex: "firestore/permission-denied").
  const code = rawCode.includes('/') ? rawCode.split('/').pop()! : rawCode;

  if (code && MESSAGES[code]) return MESSAGES[code];

  // Heurística para mensagens sem código estruturado.
  const msg = (e?.message || '').toLowerCase();
  if (msg.includes('permission') || msg.includes('insufficient')) {
    return MESSAGES['permission-denied'];
  }
  if (msg.includes('network') || msg.includes('offline')) {
    return MESSAGES['unavailable'];
  }

  return e?.message ? `${fallback} (${e.message})` : fallback;
}

/** Indica se o erro é especificamente de permissão negada. */
export function isPermissionError(err: unknown): boolean {
  const e = err as FirebaseLikeError;
  const code = e?.code || '';
  return code.includes('permission-denied') ||
    (e?.message || '').toLowerCase().includes('permission');
}
