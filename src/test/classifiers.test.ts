import { describe, it, expect } from 'vitest';
import { tiradsCategory, classifyBirads, BiradsInput } from '../modules/calculators/classifiers';

describe('TI-RADS (ACR 2017) — categoria por pontuação', () => {
  it('mapeia total → TR e conduta', () => {
    expect(tiradsCategory(0).tr).toBe('TR1');
    expect(tiradsCategory(2).tr).toBe('TR2');
    expect(tiradsCategory(3).tr).toBe('TR3');
    expect(tiradsCategory(4).tr).toBe('TR4');
    expect(tiradsCategory(6).tr).toBe('TR4');
    expect(tiradsCategory(7).tr).toBe('TR5');
    expect(tiradsCategory(12).tr).toBe('TR5');
  });
  it('conduta inclui PAAF na TR5', () => {
    expect(tiradsCategory(8).rec).toContain('PAAF se ≥ 1,0 cm');
  });
});

describe('BI-RADS (ACR 2013) — classificação de lesão mamária', () => {
  const base: BiradsInput = {
    shape: 'Oval', orientation: 'Paralelo', margin: 'Circunscrita', echoPattern: 'Anecóico',
  };

  it('campos faltando → categoria 0 (incompleto)', () => {
    expect(classifyBirads({ ...base, shape: null }).cat).toBe('0');
  });

  it('cisto simples clássico → BI-RADS 2', () => {
    expect(classifyBirads(base).cat).toBe('2');
  });

  it('oval + paralelo + circunscrito (não anecóico) → BI-RADS 3', () => {
    expect(classifyBirads({ ...base, echoPattern: 'Hiperecóico' }).cat).toBe('3');
  });

  it('1 feature suspeita → 4A', () => {
    expect(classifyBirads({ shape: 'Oval', orientation: 'Paralelo', margin: 'Circunscrita', echoPattern: 'Hipoecóico' }).cat).toBe('4A');
  });

  it('2 features → 4B', () => {
    expect(classifyBirads({ shape: 'Irregular', orientation: 'Paralelo', margin: 'Circunscrita', echoPattern: 'Hipoecóico' }).cat).toBe('4B');
  });

  it('3 features → 4C', () => {
    expect(classifyBirads({ shape: 'Irregular', orientation: 'Não-paralelo', margin: 'Circunscrita', echoPattern: 'Hipoecóico' }).cat).toBe('4C');
  });

  it('combinação clássica de malignidade → BI-RADS 5', () => {
    expect(classifyBirads({ shape: 'Irregular', orientation: 'Não-paralelo', margin: 'Espiculada', echoPattern: 'Isoecóico' }).cat).toBe('5');
  });

  it('≥ 4 features suspeitas → BI-RADS 5', () => {
    const r = classifyBirads({
      shape: 'Irregular', orientation: 'Não-paralelo', margin: 'Microlobulada', echoPattern: 'Hipoecóico',
      posteriorFeatures: 'Sombra Acústica',
    });
    expect(r.cat).toBe('5');
  });
});
