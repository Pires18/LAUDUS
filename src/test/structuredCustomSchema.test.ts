import { describe, it, expect } from 'vitest';
import { deriveStructuredSchema, summarizeStructured } from '../modules/editor/structured/deriveSchema';
import {
  validateStructuredSchema,
  uniqueFieldId,
  uniqueSectionId,
  normalizeFieldId,
  newSection,
  newField,
} from '../modules/editor/structured/schemaEditing';
import { ReportTemplate, StructuredSection } from '../types';

function mask(area: string, name: string, compartments: string[]): ReportTemplate {
  const analysisTemplate = compartments
    .map((c) => `<p><strong>${c}:</strong> medindo [__] x [__] x [__] cm.</p>`)
    .join('');
  return {
    id: 't', area: area as ReportTemplate['area'], name, title: '', technique: '',
    analysisTemplate, conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

const CUSTOM: StructuredSection[] = [
  {
    id: 'figado', label: 'Fígado', normalable: true, normalText: 'homogêneo',
    fields: [
      { id: 'figado_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'esteatose', label: 'Esteatose', kind: 'select', options: ['ausente', 'leve'] },
    ],
  },
  {
    id: 'nodulos', label: 'Nódulos', repeatable: true, itemLabel: 'Nódulo', score: 'tirads',
    fields: [{ id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' }],
  },
];

describe('deriveStructuredSchema — esquema PERSONALIZADO da máscara', () => {
  it('quando presente, substitui integralmente o esquema derivado (sem parser/enriquecimento)', () => {
    const tpl = { ...mask('medicina-interna', 'ABDOME', ['Baço', 'Pâncreas']), structuredSchema: { sections: CUSTOM } };
    const s = deriveStructuredSchema(tpl, 'medicina-interna');
    expect(s.sections).toBe(CUSTOM); // usado como está
    expect(s.sections.map((x) => x.label)).toEqual(['Fígado', 'Nódulos']);
    expect(s.examName).toBe('ABDOME');
  });

  it('sections: [] desativa o formulário (custom vazio NÃO cai no automático)', () => {
    const tpl = { ...mask('medicina-interna', 'ABDOME', ['Baço']), structuredSchema: { sections: [] } };
    expect(deriveStructuredSchema(tpl, 'medicina-interna').sections).toEqual([]);
  });

  it('null/ausente volta ao esquema derivado automaticamente', () => {
    const auto = deriveStructuredSchema(mask('medicina-interna', 'ABDOME', ['Baço']), 'medicina-interna');
    expect(auto.sections.length).toBeGreaterThan(0);
    const tplNull = { ...mask('medicina-interna', 'ABDOME', ['Baço']), structuredSchema: null };
    expect(deriveStructuredSchema(tplNull, 'medicina-interna').sections.map((s) => s.id))
      .toEqual(auto.sections.map((s) => s.id));
  });

  it('o esquema personalizado compila normalmente (summarizeStructured)', () => {
    const tpl = { ...mask('medicina-interna', 'ABDOME', []), structuredSchema: { sections: CUSTOM } };
    const schema = deriveStructuredSchema(tpl, 'medicina-interna');
    const { lines, filledCount } = summarizeStructured(schema, {
      '__n:figado': 'altered',
      esteatose: 'leve',
      'nodulos@0@dims': '1,2 x 0,8 x 0,7',
    });
    expect(filledCount).toBe(2);
    expect(lines.join('\n')).toContain('Esteatose: leve');
    expect(lines.join('\n')).toContain('Nódulo 1:');
  });
});

describe('schemaEditing — ids únicos e normalização', () => {
  it('uniqueFieldId evita colisão no escopo plano (seções não-repetíveis)', () => {
    const id = uniqueFieldId('Esteatose', CUSTOM, CUSTOM[0]);
    expect(id).toBe('esteatose-2');
  });

  it('uniqueFieldId em seção repetível só considera a própria seção', () => {
    const id = uniqueFieldId('Esteatose', CUSTOM, CUSTOM[1]);
    expect(id).toBe('esteatose');
  });

  it('uniqueSectionId incrementa sufixo em duplicidade', () => {
    expect(uniqueSectionId('Fígado', CUSTOM)).toBe('figado-2');
  });

  it('normalizeFieldId remove acentos, @ e maiúsculas', () => {
    expect(normalizeFieldId('IP Artéria Umbilical')).toBe('ip-arteria-umbilical');
    expect(normalizeFieldId('sec@0@campo')).toBe('sec-0-campo');
    expect(normalizeFieldId('__interno')).toBe('interno');
  });

  it('newSection/newField geram ids placeholder únicos', () => {
    const s = newSection(CUSTOM);
    expect(s.id).toBe('nova-secao');
    const f = newField(CUSTOM, CUSTOM[0]);
    expect(f.id).toBe('novo-campo');
    expect(f.kind).toBe('text');
  });
});

describe('validateStructuredSchema', () => {
  it('esquema válido passa sem erros', () => {
    expect(validateStructuredSchema(CUSTOM)).toEqual([]);
  });

  it('detecta id de campo repetido entre seções não-repetíveis', () => {
    const bad: StructuredSection[] = [
      { id: 'a', label: 'A', fields: [{ id: 'dims', label: 'Dims', kind: 'measure' }] },
      { id: 'b', label: 'B', fields: [{ id: 'dims', label: 'Dims', kind: 'measure' }] },
    ];
    expect(validateStructuredSchema(bad).some((e) => e.includes('"dims"'))).toBe(true);
  });

  it('permite mesmo id de campo entre seção repetível e não-repetível (escopos distintos)', () => {
    const ok: StructuredSection[] = [
      { id: 'a', label: 'A', fields: [{ id: 'dims', label: 'Dims', kind: 'measure' }] },
      { id: 'b', label: 'B', repeatable: true, fields: [{ id: 'dims', label: 'Dims', kind: 'measure' }] },
    ];
    expect(validateStructuredSchema(ok)).toEqual([]);
  });

  it('detecta seleção sem opções, calc sem calculadora, ids reservados e showIf órfão', () => {
    const bad: StructuredSection[] = [
      {
        id: 'a', label: 'A',
        fields: [
          { id: 'sel', label: 'Sel', kind: 'select' },
          { id: 'clc', label: 'Clc', kind: 'calc' },
          { id: '__oculto', label: 'Oculto', kind: 'text' },
          { id: 'cond', label: 'Cond', kind: 'text', showIf: { field: 'nao-existe' } },
        ],
      },
    ];
    const errs = validateStructuredSchema(bad);
    expect(errs.some((e) => e.includes('não tem opções'))).toBe(true);
    expect(errs.some((e) => e.includes('não tem calculadora'))).toBe(true);
    expect(errs.some((e) => e.includes('Id inválido'))).toBe(true);
    expect(errs.some((e) => e.includes('inexistente'))).toBe(true);
  });

  it('detecta seção sem nome e seção repetível sem campos', () => {
    const bad: StructuredSection[] = [
      { id: 'x', label: ' ', fields: [] },
      { id: 'y', label: 'Nódulos', repeatable: true, fields: [] },
    ];
    const errs = validateStructuredSchema(bad);
    expect(errs.some((e) => e.includes('sem nome'))).toBe(true);
    expect(errs.some((e) => e.includes('repetível'))).toBe(true);
  });
});
