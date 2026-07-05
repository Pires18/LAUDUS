import { describe, it, expect } from 'vitest';
import { evaluateReportQuota } from '../../api/_quota';

/**
 * Enforcement de cota de laudos (server-side). Regras:
 * admin isento · exige assinatura ativa (active/past_due ou trial <14d) ·
 * bloqueia com cota mensal esgotada (9999 = ilimitado).
 */
const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('evaluateReportQuota', () => {
  it('admin é sempre liberado (ignora sub/cota)', () => {
    const r = evaluateReportQuota({ role: 'admin', reportsQuota: 1, reportsUsedThisMonth: 999 }, NOW);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('admin');
  });

  it('assinatura ativa e dentro da cota → libera', () => {
    const r = evaluateReportQuota({ subscriptionStatus: 'active', reportsQuota: 100, reportsUsedThisMonth: 40 }, NOW);
    expect(r.allowed).toBe(true);
  });

  it('past_due dentro da cota → libera (grace period)', () => {
    expect(evaluateReportQuota({ subscriptionStatus: 'past_due', reportsQuota: 100, reportsUsedThisMonth: 0 }, NOW).allowed).toBe(true);
  });

  it('cota mensal esgotada → 402 quota-exhausted', () => {
    const r = evaluateReportQuota({ subscriptionStatus: 'active', reportsQuota: 100, reportsUsedThisMonth: 100 }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(402);
    expect(r.reason).toBe('quota-exhausted');
  });

  it('cota 9999 (ilimitado) nunca esgota', () => {
    expect(evaluateReportQuota({ subscriptionStatus: 'active', reportsQuota: 9999, reportsUsedThisMonth: 50000 }, NOW).allowed).toBe(true);
  });

  it('cota 0 (convenção ilimitado) nunca bloqueia por cota', () => {
    expect(evaluateReportQuota({ subscriptionStatus: 'active', reportsQuota: 0, reportsUsedThisMonth: 99999 }, NOW).allowed).toBe(true);
  });

  it('sem assinatura mas dentro do trial de 14d → libera', () => {
    const r = evaluateReportQuota({ createdAt: NOW - 5 * DAY, reportsQuota: 100, reportsUsedThisMonth: 0 }, NOW);
    expect(r.allowed).toBe(true);
  });

  it('trial expirado (>14d) e sem sub ativa → 402 no-active-sub', () => {
    const r = evaluateReportQuota({ subscriptionStatus: 'trialing', createdAt: NOW - 20 * DAY, reportsQuota: 100, reportsUsedThisMonth: 0 }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(402);
    expect(r.reason).toBe('no-active-sub');
  });

  it('assinatura cancelada e trial antigo → bloqueia', () => {
    const r = evaluateReportQuota({ subscriptionStatus: 'canceled', createdAt: NOW - 100 * DAY, reportsQuota: 100, reportsUsedThisMonth: 0 }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('no-active-sub');
  });

  it('trial ativo mas cota esgotada → bloqueia por cota', () => {
    const r = evaluateReportQuota({ createdAt: NOW - 2 * DAY, reportsQuota: 100, reportsUsedThisMonth: 100 }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('quota-exhausted');
  });
});
