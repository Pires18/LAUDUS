import crypto from 'crypto';

/**
 * Comparação de strings em tempo constante — evita timing attacks ao comparar
 * segredos (webhook secret, CRON secret, assinaturas HMAC). Ambos os lados são
 * reduzidos a um hash SHA-256 de tamanho fixo antes do timingSafeEqual, o que
 * também neutraliza o vazamento de comprimento e o erro do timingSafeEqual com
 * buffers de tamanhos diferentes.
 */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  const aStr = typeof a === 'string' ? a : '';
  const bStr = typeof b === 'string' ? b : '';
  const aHash = crypto.createHash('sha256').update(aStr).digest();
  const bHash = crypto.createHash('sha256').update(bStr).digest();
  return crypto.timingSafeEqual(aHash, bHash) && aStr.length > 0 && bStr.length > 0;
}
