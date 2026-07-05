/**
 * Decisão PURA de cota de laudos.
 *
 * Extraída de `checkReportQuota` (/api/gemini) para ser testável sem Edge/rede.
 * Espelha a regra do cliente: admin isento; exige assinatura ativa
 * (active/past_due ou dentro do trial de 14 dias); bloqueia se a cota mensal
 * estiver esgotada (9999 = ilimitado).
 */

export interface QuotaUser {
  role?: string;
  subscriptionStatus?: string;
  createdAt?: number;
  reportsQuota?: number;
  reportsUsedThisMonth?: number;
}

export interface QuotaDecision {
  allowed: boolean;
  error?: string;
  status?: number;
  reason?: string;
}

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;
const UNLIMITED = 9999;

export function evaluateReportQuota(u: QuotaUser, now: number = Date.now()): QuotaDecision {
  if (u.role === 'admin') return { allowed: true, reason: 'admin' };

  const status = u.subscriptionStatus || '';
  const inTrial = typeof u.createdAt === 'number' && now < u.createdAt + TRIAL_MS;
  const hasActiveSub = status === 'active' || status === 'past_due' || inTrial;
  if (!hasActiveSub) {
    return {
      allowed: false,
      status: 402,
      reason: 'no-active-sub',
      error: 'Sua assinatura não está ativa. Reative o plano para gerar novos laudos.',
    };
  }

  const quota = u.reportsQuota;
  const used = u.reportsUsedThisMonth ?? 0;
  if (quota !== undefined && quota > 0 && quota !== UNLIMITED && used >= quota) {
    return {
      allowed: false,
      status: 402,
      reason: 'quota-exhausted',
      error: 'Cota mensal de laudos atingida. Faça upgrade do plano ou aguarde a renovação.',
    };
  }

  return { allowed: true, reason: 'ok' };
}
