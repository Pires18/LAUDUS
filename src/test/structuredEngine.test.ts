import { describe, it, expect } from 'vitest';
import { tiradsScore, TIRADS_OPTIONS, biradsSuggest, oradsSuggest, grafType } from '../modules/editor/structured/scoring';
import { deriveStructuredSchema, summarizeStructured } from '../modules/editor/structured/deriveSchema';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
import { normalKey, countKey, itemFieldId } from '../modules/editor/structured/structuredKeys';
import { ReportTemplate } from '../types';

function tpl(area: string, name: string): ReportTemplate {
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate: '', conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('scoring — ACR TI-RADS inline', () => {
  it('nódulo sólido, muito hipoecoico, mais alto que largo, margem irregular, focos puntiformes → TR5', () => {
    const r = tiradsScore({
      composition: 'sólida', echogenicity: 'muito hipoecoico',
      shape: 'mais alto que largo', margin: 'lobulada/irregular', foci: 'focos puntiformes',
    });
    // 2 + 3 + 3 + 2 + 3 = 13 pts
    expect(r?.points).toBe(13);
    expect(r?.tr).toBe(5);
    expect(r?.complete).toBe(true);
    expect(r?.conduct).toContain('1,0 cm');
  });

  it('espongiforme → TR1 (benigno)', () => {
    const r = tiradsScore({ composition: 'espongiforme', echogenicity: 'anecoico', shape: 'mais largo que alto', margin: 'lisa' });
    expect(r?.tr).toBe(1);
    expect(r?.points).toBe(0);
  });

  it('descritores incompletos e sem pontos → null', () => {
    expect(tiradsScore({})).toBeNull();
  });

  it('as opções de descritor batem com as chaves de pontuação', () => {
    expect(TIRADS_OPTIONS.composition).toContain('sólida');
    expect(TIRADS_OPTIONS.shape.length).toBe(2);
  });
});

describe('scoring — sugestões BI-RADS / O-RADS e Graf', () => {
  it('BI-RADS: morfologia benigna → 3; suspeita → 4/5', () => {
    expect(biradsSuggest({ forma: 'oval', orientacao: 'paralela', margem: 'circunscrita' })?.suspicious).toBe(false);
    const susp = biradsSuggest({ forma: 'irregular', orientacao: 'não paralela (mais alta que larga)', margem: 'espiculada' });
    expect(susp?.suspicious).toBe(true);
    expect(susp?.label).toMatch(/BI-RADS/);
    expect(biradsSuggest({})).toBeNull();
  });

  it('O-RADS: cisto unilocular anecoico → benigno; sólido com fluxo → alto risco', () => {
    expect(oradsSuggest({ tipo: 'unilocular', conteudo: 'anecoico', septos: 'ausentes' })?.suspicious).toBe(false);
    const solid = oradsSuggest({ tipo: 'sólida', vascularizacao: '4 – marcante' });
    expect(solid?.suspicious).toBe(true);
    expect(solid?.label).toMatch(/O-RADS 5/);
  });

  it('Graf: α≥60 → tipo I; α<43 → displásico', () => {
    expect(grafType(64)).toMatch(/^I /);
    expect(grafType(40)).toMatch(/III/);
    expect(grafType(0)).toBeNull();
  });
});

describe('summarize — seções normal/alterado e repetíveis', () => {
  it('seção normalable em estado normal compila "sem alterações"', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    const { lines } = summarizeStructured(schema, {}); // tudo default = normal
    expect(lines.join('\n')).toMatch(/Fígado: sem alterações/);
  });

  it('seção normalable em estado alterado emite os campos preenchidos', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    const { lines } = summarizeStructured(schema, {
      [normalKey('figado')]: 'altered',
      esteatose: 'moderada (grau II)',
    });
    expect(lines.join('\n')).toMatch(/Esteatose: moderada/);
    expect(lines.join('\n')).not.toMatch(/Fígado: sem alterações/);
  });

  it('seção repetível itera instâncias por índice', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const { lines, filledCount } = summarizeStructured(schema, {
      [countKey('nodulos')]: '2',
      [itemFieldId('nodulos', 0, 'loc')]: 'lobo direito',
      [itemFieldId('nodulos', 1, 'loc')]: 'lobo esquerdo',
    });
    const text = lines.join('\n');
    expect(text).toMatch(/Nódulo 1:/);
    expect(text).toMatch(/Nódulo 2:/);
    expect(filledCount).toBeGreaterThanOrEqual(2);
  });
});

describe('liveCompute — escore TI-RADS por instância', () => {
  it('calcula TR do nódulo repetível a partir dos descritores', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const d = computeDerivations(schema, {
      [countKey('nodulos')]: '1',
      [itemFieldId('nodulos', 0, 'composicao')]: 'sólida',
      [itemFieldId('nodulos', 0, 'ecogenicidade')]: 'muito hipoecoico',
      [itemFieldId('nodulos', 0, 'forma')]: 'mais alto que largo',
      [itemFieldId('nodulos', 0, 'margem')]: 'lisa',
    });
    const tr = d.find((x) => x.id.includes('__tr'));
    expect(tr?.text).toContain('TR5');
    expect(tr?.alert).toBe(true);
    expect(tr?.label).toContain('TI-RADS');
  });

  it('pula seção normalable em estado normal (sem volume espúrio)', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    const d = computeDerivations(schema, {}); // tudo normal
    expect(d.length).toBe(0);
  });
});
