import { describe, it, expect } from 'vitest';
import { routeMotor } from '../modules/ai/router';

// ═══════════════════════════════════════════════════════════════
// Testes do roteador de motor (determinístico).
// Princípio inviolável: red flag → Pro forçado.
// ═══════════════════════════════════════════════════════════════

describe('routeMotor — escalonamento de segurança', () => {
  it('força Pro quando há red flag, ignorando escolha do usuário', () => {
    const d = routeMotor({
      area: 'vascular',
      examType: 'Doppler Aorta',
      clinicalIndication: 'Massa abdominal pulsátil, aneurisma suspeito.',
      userMotor: 'lite',
    });
    expect(d.recommendedMotor).toBe('pro');
    expect(d.forcedPro).toBe(true);
    expect(d.redFlags.length).toBeGreaterThan(0);
  });

  it('detecta urgência oncológica e força Pro', () => {
    const d = routeMotor({
      area: 'mastologia',
      clinicalIndication: 'Nódulo com margens espiculadas, suspeita de neoplasia.',
      userMotor: 'lite',
    });
    expect(d.forcedPro).toBe(true);
    expect(d.recommendedMotor).toBe('pro');
  });

  it('detecta urgência obstétrica (gestação ectópica)', () => {
    const d = routeMotor({
      area: 'ginecologia',
      anamnesis: 'Dor pélvica, suspeita de gestação ectópica.',
    });
    expect(d.forcedPro).toBe(true);
  });
});

describe('routeMotor — casos de rotina', () => {
  it('respeita Lite do usuário sem red flags', () => {
    const d = routeMotor({
      area: 'medicina-interna',
      examType: 'Abdome Total',
      clinicalIndication: 'Rotina.',
      userMotor: 'lite',
    });
    expect(d.recommendedMotor).toBe('lite');
    expect(d.forcedPro).toBe(false);
    expect(d.redFlags).toHaveLength(0);
  });

  it('respeita Pro do usuário sem red flags', () => {
    const d = routeMotor({
      area: 'medicina-interna',
      clinicalIndication: 'Rotina.',
      userMotor: 'pro',
    });
    expect(d.recommendedMotor).toBe('pro');
    expect(d.forcedPro).toBe(false);
  });

  it('sugere Lite para caso simples quando usuário não escolheu', () => {
    const d = routeMotor({
      area: 'medicina-interna',
      clinicalIndication: 'Check-up.',
    });
    expect(d.recommendedMotor).toBe('lite');
  });
});

describe('routeMotor — complexidade', () => {
  it('atribui complexidade alta a caso com red flags', () => {
    const d = routeMotor({
      area: 'vascular',
      clinicalIndication: 'Aneurisma, trombo mural, dor aguda.',
    });
    expect(d.complexity).toBeGreaterThanOrEqual(4);
  });

  it('atribui complexidade baixa a caso de rotina', () => {
    const d = routeMotor({
      area: 'medicina-interna',
      clinicalIndication: 'Rotina.',
    });
    expect(d.complexity).toBeLessThanOrEqual(2);
  });

  it('sugere Pro para área complexa com anamnese rica mesmo sem red flag', () => {
    const d = routeMotor({
      area: 'medicina-fetal',
      clinicalIndication: 'Gestação de 32 semanas, controle de crescimento fetal seriado.',
      anamnesis: 'Paciente com diabetes gestacional bem controlada, ganho ponderal adequado, sem queixas, exames anteriores dentro da normalidade para a idade gestacional.',
    });
    expect(d.complexity).toBeGreaterThanOrEqual(3);
  });
});
