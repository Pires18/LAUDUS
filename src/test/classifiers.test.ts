import { describe, it, expect } from 'vitest';
import { tiradsCategory, classifyBirads, BiradsInput, classifyOrads } from '../modules/calculators/classifiers';

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

describe('O-RADS (ACR) — massa anexial', () => {
  const base = { type: null as string | null, colorScore: 1, innerWall: null as string | null, ascites: false, maxDim: 40 };

  it('ascite → O-RADS 5 (alto risco)', () => {
    expect(classifyOrads({ ...base, ascites: true }).cat).toBe('5');
  });
  it('lesão sólida com color score 4 ou parede irregular → 5', () => {
    expect(classifyOrads({ ...base, type: 'Lesão Sólida', colorScore: 4 }).cat).toBe('5');
    expect(classifyOrads({ ...base, type: 'Lesão Sólida', innerWall: 'Irregular' }).cat).toBe('5');
  });
  it('lesão sólida sem suspeição → 4', () => {
    expect(classifyOrads({ ...base, type: 'Lesão Sólida' }).cat).toBe('4');
  });
  it('cisto unilocular simples: <10cm → 2, ≥10cm → 3', () => {
    expect(classifyOrads({ ...base, type: 'Cisto Unilocular Simples', maxDim: 50 }).cat).toBe('2');
    expect(classifyOrads({ ...base, type: 'Cisto Unilocular Simples', maxDim: 100 }).cat).toBe('3');
  });
  it('cisto multilocular grande ou vascularizado → 4, senão → 3', () => {
    expect(classifyOrads({ ...base, type: 'Cisto Multilocular', maxDim: 120 }).cat).toBe('4');
    expect(classifyOrads({ ...base, type: 'Cisto Multilocular', maxDim: 50 }).cat).toBe('3');
  });
  it('sem tipo definido → 0 (incompleto)', () => {
    expect(classifyOrads(base).cat).toBe('0');
  });
});
