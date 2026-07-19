import { describe, it, expect } from 'vitest';
import { mergeStructuredSchemas } from '../modules/editor/structured/mergeSchemas';
import { deriveStructuredSchema, deriveCombinedStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { validateStructuredSchema } from '../modules/editor/structured/schemaEditing';
import { calculatorsForArea } from '../modules/editor/structured/calcMap';
import { ReportTemplate, StructuredSchema } from '../types';
import MASKS from '../../scripts/laudia-deploy-unified.REFINED.json';

/** Máscara mínima que resolve para o MODELO PADRÃO da área (tier 2). */
function mask(area: string, name: string): ReportTemplate {
  return {
    id: 'id-' + name, area, name, title: '', technique: '',
    analysisTemplate: '', conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

const ABDOME = mask('medicina-interna', 'ABDOME TOTAL');
const RINS = mask('medicina-interna', 'RINS E VIAS URINÁRIAS');
const PROSTATA = mask('medicina-interna', 'PRÓSTATA VIA ABDOMINAL');
const PELVICA = mask('ginecologia', 'PÉLVICA ABDOMINAL');

const derive = (templates: ReportTemplate[]) =>
  deriveCombinedStructuredSchema(templates, templates[0].area);

const fieldIds = (schema: StructuredSchema) =>
  schema.sections.flatMap((s) => (s.repeatable ? [] : s.fields.map((f) => f.id)));

describe('deriveCombinedStructuredSchema — combos-alvo reais', () => {
  it('Rins e Vias + Próstata: seção VRPM idêntica deduplica; bexiga_parede/achados renomeiam', () => {
    const m = derive([RINS, PROSTATA]);
    expect(m.sections.filter((s) => s.id === 'vrpm')).toHaveLength(1);
    const ids = fieldIds(m);
    expect(ids).toContain('bexiga_parede');
    expect(ids).toContain('bexiga_parede__2');
    expect(ids).toContain('bexiga_achados');
    expect(ids).toContain('bexiga_achados__2');
    // canônicos da próstata intactos (não colidem)
    expect(ids).toContain('prostata_dims');
    expect(ids).toContain('psa');
    expect(ids).toContain('trabeculacao');
    // o VRPM canônico permanece 1× e sem sufixo
    expect(ids.filter((i) => i.startsWith('vrpm'))).toEqual(['vrpm']);
  });

  it('Abdome Total + Pélvica Abdominal: seção bexiga renomeia (bexiga--2), zero field renomeado', () => {
    const m = derive([ABDOME, PELVICA]);
    const secIds = m.sections.map((s) => s.id);
    expect(secIds).toContain('bexiga');
    expect(secIds).toContain('bexiga--2');
    const ids = fieldIds(m);
    expect(ids).toContain('bexiga_parede');
    expect(ids).toContain('bexiga_repl');
    expect(ids.some((i) => i.includes('__'))).toBe(false);
    // canônicos da ginecologia intactos
    expect(ids).toContain('bexiga_desc');
  });

  it('Rins e Vias + Pélvica Abdominal: bexiga--2, zero field renomeado, ir_d/ir_e intactos', () => {
    const m = derive([RINS, PELVICA]);
    const secIds = m.sections.map((s) => s.id);
    expect(secIds).toContain('bexiga');
    expect(secIds).toContain('bexiga--2');
    expect(fieldIds(m).some((i) => i.includes('__'))).toBe(false);
  });

  it('Abdome Total + Próstata: seções distintas (bexiga vs bexiga-pre), fields renomeiam', () => {
    const m = derive([ABDOME, PROSTATA]);
    const secIds = m.sections.map((s) => s.id);
    expect(secIds).toContain('bexiga');
    expect(secIds).toContain('bexiga-pre');
    const ids = fieldIds(m);
    expect(ids).toContain('bexiga_parede');
    expect(ids).toContain('bexiga_parede__2');
    expect(ids).toContain('bexiga_achados__2');
  });

  it('todo combo-alvo passa na validação global (nenhum field id repetido, showIf íntegro)', () => {
    for (const combo of [[RINS, PROSTATA], [ABDOME, PELVICA], [RINS, PELVICA], [ABDOME, PROSTATA]]) {
      expect(validateStructuredSchema(derive(combo).sections)).toEqual([]);
    }
  });

  it('perSource particiona exatamente as seções finais e marca sourceExam', () => {
    const m = derive([ABDOME, PELVICA]);
    expect(m.perSource.flat()).toEqual(m.sections);
    for (const s of m.perSource[0]) expect(s.sourceExam).toBe('ABDOME TOTAL');
    for (const s of m.perSource[1]) expect(s.sourceExam).toBe('PÉLVICA ABDOMINAL');
    expect(m.examName).toBe('ABDOME TOTAL + PÉLVICA ABDOMINAL');
    expect(m.area).toBe('medicina-interna');
  });

  it('com 1 máscara delega para deriveStructuredSchema (comportamento idêntico)', () => {
    const single = deriveStructuredSchema(ABDOME, 'medicina-interna');
    const m = deriveCombinedStructuredSchema([ABDOME], 'medicina-interna');
    expect(m.sections).toEqual(single.sections);
    expect(m.perSource).toEqual([single.sections]);
  });

  it('deriva cada sub-schema com a área da PRÓPRIA máscara (Pélvica acha o modelo de ginecologia)', () => {
    // Se a derivação usasse a área do exame (medicina-interna), a Pélvica não
    // casaria nenhum modelo padrão e cairia no parser (seções genéricas).
    const m = derive([ABDOME, PELVICA]);
    const pelvicaSections = m.perSource[1].map((s) => s.id);
    expect(pelvicaSections).toContain('utero');
  });
});

describe('mergeStructuredSchemas — política de colisão (sintético)', () => {
  it('reescreve showIf que aponta para field renomeado na mesma seção', () => {
    const a: StructuredSchema = {
      area: 'x', sections: [
        { id: 's1', label: 'S1', fields: [{ id: 'campo', label: 'C', kind: 'text' }] },
      ],
    };
    const b: StructuredSchema = {
      area: 'x', sections: [
        {
          id: 's2', label: 'S2', fields: [
            { id: 'campo', label: 'C', kind: 'select', options: ['a', 'b'] },
            { id: 'detalhe', label: 'D', kind: 'text', showIf: { field: 'campo', equals: 'a' } },
          ],
        },
      ],
    };
    const m = mergeStructuredSchemas([
      { schema: a, examName: 'A' },
      { schema: b, examName: 'B' },
    ]);
    const s2 = m.sections.find((s) => s.id === 's2')!;
    expect(s2.fields.map((f) => f.id)).toEqual(['campo__2', 'detalhe']);
    expect(s2.fields[1].showIf).toEqual({ field: 'campo__2', equals: 'a' });
  });

  it('rótulo de seção repetido é disambiguado com o nome do exame', () => {
    const sec = (id: string, fieldId: string) => ({
      id, label: 'Bexiga', fields: [{ id: fieldId, label: 'F', kind: 'text' as const }],
    });
    const m = mergeStructuredSchemas([
      { schema: { area: 'x', sections: [sec('bexiga', 'f1')] }, examName: 'A' },
      { schema: { area: 'x', sections: [sec('bexiga', 'f2')] }, examName: 'B' },
    ]);
    expect(m.sections.map((s) => s.label)).toEqual(['Bexiga', 'Bexiga — B']);
    expect(m.sections.map((s) => s.id)).toEqual(['bexiga', 'bexiga--2']);
  });

  it('seções repetíveis não renomeiam fields (escopo por item)', () => {
    const rep = { id: 'nodulos', label: 'Nódulos', repeatable: true, fields: [{ id: 'tam', label: 'T', kind: 'measure' as const }] };
    const m = mergeStructuredSchemas([
      { schema: { area: 'x', sections: [{ id: 'a', label: 'A', fields: [{ id: 'tam', label: 'T', kind: 'measure' }] }] }, examName: 'A' },
      { schema: { area: 'x', sections: [rep] }, examName: 'B' },
    ]);
    const nodulos = m.sections.find((s) => s.id === 'nodulos')!;
    expect(nodulos.fields[0].id).toBe('tam');
  });
});

describe('calculatorsForArea com múltiplas áreas', () => {
  it('array = união sem duplicatas', () => {
    const mi = calculatorsForArea('medicina-interna');
    const gin = calculatorsForArea('ginecologia');
    const both = calculatorsForArea(['medicina-interna', 'ginecologia']);
    expect(both.length).toBeGreaterThanOrEqual(Math.max(mi.length, gin.length));
    expect(new Set(both.map((c) => c.id)).size).toBe(both.length);
    for (const c of mi) expect(both.map((b) => b.id)).toContain(c.id);
    for (const c of gin) expect(both.map((b) => b.id)).toContain(c.id);
  });

  it('string única mantém comportamento atual', () => {
    expect(calculatorsForArea('ginecologia')).toEqual(calculatorsForArea(['ginecologia']));
  });
});

describe('smoke: merge de todos os pares plausíveis de máscaras reais', () => {
  const templates = (MASKS as unknown as ReportTemplate[]).filter(
    (t) => t.area !== 'medicina-fetal' && t.area !== 'procedimentos'
  );

  it('nenhum par produz schema inválido (field ids únicos, showIf íntegro)', () => {
    for (let i = 0; i < templates.length; i++) {
      for (let j = 0; j < templates.length; j++) {
        if (i === j) continue;
        const m = derive([templates[i], templates[j]]);
        const errors = validateStructuredSchema(m.sections);
        expect(
          errors,
          `${templates[i].name} + ${templates[j].name}: ${errors.join(' | ')}`
        ).toEqual([]);
      }
    }
  });
});
