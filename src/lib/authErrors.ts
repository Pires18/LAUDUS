/**
 * Mapeia códigos de erro do Firebase Auth para mensagens pt-BR amigáveis.
 * Sem isto, o usuário via mensagens cruas como "Firebase: Error
 * (auth/invalid-credential)".
 *
 * Retorna `null` para erros que devem ser silenciados (ex.: usuário fechou o
 * popup do Google — não é um erro real).
 */

const MESSAGES: Record<string, string | null> = {
  // Credenciais
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido. Verifique o endereço digitado.',
  'auth/user-disabled': 'Esta conta foi desativada. Entre em contato com o suporte.',

  // Cadastro
  'auth/email-already-in-use': 'Este e-mail já possui cadastro. Faça login ou use "Esqueci minha senha".',
  'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',

  // Limites / rede
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',

  // Google OAuth — fechamento do popup não é erro
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/popup-blocked': 'O navegador bloqueou a janela de login do Google. Permita popups e tente novamente.',
  'auth/account-exists-with-different-credential': 'Este e-mail já está vinculado a outro método de login. Tente entrar com e-mail e senha.',
};

/** Extrai o código `auth/...` de um erro do Firebase (se houver). */
function extractCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    return (err as any).code;
  }
  const msg = err instanceof Error ? err.message : '';
  const m = msg.match(/\(auth\/[a-z-]+\)/);
  return m ? m[0].slice(1, -1) : null;
}

/**
 * @returns mensagem pt-BR, ou `null` se o erro deve ser silenciado.
 */
export function mapAuthError(err: unknown, fallback: string): string | null {
  const code = extractCode(err);
  if (code && code in MESSAGES) return MESSAGES[code];
  return fallback;
}
