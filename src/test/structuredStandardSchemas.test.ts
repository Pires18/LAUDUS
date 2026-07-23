import { describe, it, expect } from 'vitest';
import { deriveStructuredSchema, summarizeStructured } from '../modules/editor/structured/deriveSchema';
import { findStandardSchema } from '../modules/editor/structured/standardSchemas';
import { MEDICINA_INTERNA_SCHEMAS } from '../modules/editor/structured/standardSchemas/medicinaInterna';
import { PEQUENAS_PARTES_SCHEMAS } from '../modules/editor/structured/standardSchemas/pequenasPartes';
import { GINECOLOGIA_SCHEMAS } from '../modules/editor/structured/standardSchemas/ginecologia';
import { MASTOLOGIA_SCHEMAS } from '../modules/editor/structured/standardSchemas/mastologia';
import { MEDICINA_FETAL_SCHEMAS } from '../modules/editor/structured/standardSchemas/medicinaFetal';
import { VASCULAR_SCHEMAS } from '../modules/editor/structured/standardSchemas/vascular';
import { PEDIATRIA_SCHEMAS } from '../modules/editor/structured/standardSchemas/pediatria';
import { MUSCULOESQUELETICO_SCHEMAS } from '../modules/editor/structured/standardSchemas/musculoesqueletico';
import { REUMATOLOGICO_SCHEMAS } from '../modules/editor/structured/standardSchemas/reumatologico';
import { PROCEDIMENTOS_SCHEMAS } from '../modules/editor/structured/standardSchemas/procedimentos';
import { StandardSchemaDef } from '../modules/editor/structured/standardSchemas/types';
import MASKS from '../../scripts/laudia-deploy-unified.REFINED.json';
import { validateStructuredSchema } from '../modules/editor/structured/schemaEditing';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
import { groupContainerId, countKey, itemFieldId, normalKey } from '../modules/editor/structured/structuredKeys';
import { ReportTemplate } from '../types';

function tpl(area: string, name: string): ReportTemplate {
  return {
    id: 't', area: area as ReportTemplate['area'], name, title: '', technique: '',
    analysisTemplate: '<p><strong>FÍGADO:</strong> normal.</p>', conclusionTemplate: '',
    recommendationsTemplate: '', createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('standardSchemas — resolver por área + nome', () => {
  it('resolve as 7 máscaras de medicina interna (COM DOPPLER antes do genérico)', () => {
    const cases: [string, string][] = [
      ['ABDOME SUPERIOR', 'ABDOME SUPERIOR'],
      ['ABDOME SUPERIOR COM DOPPLER', 'ABDOME SUPERIOR COM DOPPLER'],
      ['ABDOME TOTAL', 'ABDOME TOTAL'],
      ['ABDOME TOTAL COM DOPPLER', 'ABDOME TOTAL COM DOPPLER'],
      ['PRÓSTATA VIA ABDOMINAL', 'PRÓSTATA VIA ABDOMINAL'],
      ['RINS E VIAS URINÁRIAS', 'RINS E VIAS URINÁRIAS'],
      ['RINS E VIAS URINÁRIAS COM DOPPLER', 'RINS E VIAS URINÁRIAS COM DOPPLER'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('medicina-interna', examName)?.name).toBe(expected);
    }
  });

  it('cópias pessoais herdam o modelo padrão ("X (Personalizada)")', () => {
    expect(findStandardSchema('medicina-interna', 'ABDOME TOTAL (Personalizada)')?.name).toBe('ABDOME TOTAL');
  });

  it('exame desconhecido → null (cai no parser)', () => {
    // as 10 áreas têm biblioteca; o parser cobre máscaras que nenhuma regex pegue
    expect(findStandardSchema('area-inexistente', 'QUADRIL')).toBeNull();
    expect(findStandardSchema('medicina-interna', 'EXAME INVENTADO')).toBeNull();
    expect(findStandardSchema('vascular', 'EXAME INVENTADO')).toBeNull();
    expect(findStandardSchema('pediatria', 'EXAME INVENTADO')).toBeNull();
  });

  it('todos os modelos de medicina interna passam na validação de esquema', () => {
    for (const def of MEDICINA_INTERNA_SCHEMAS) {
      expect(validateStructuredSchema(def.sections()), def.name).toEqual([]);
    }
  });

  it('resolve as 10 máscaras de pequenas partes (COM DOPPLER antes do genérico)', () => {
    const cases: [string, string][] = [
      ['TIREOIDE', 'TIREOIDE'],
      ['TIREOIDE COM DOPPLER', 'TIREOIDE COM DOPPLER'],
      ['CERVICAL', 'CERVICAL'],
      ['CERVICAL COM DOPPLER', 'CERVICAL COM DOPPLER'],
      ['BOLSA ESCROTAL', 'BOLSA ESCROTAL'],
      ['BOLSA ESCROTAL COM DOPPLER', 'BOLSA ESCROTAL COM DOPPLER'],
      ['GLÂNDULAS SALIVARES', 'GLÂNDULAS SALIVARES'],
      ['PARTES MOLES', 'PARTES MOLES'],
      ['REGIÕES INGUINAIS', 'REGIÕES INGUINAIS'],
      ['PAREDE ABDOMINAL', 'PAREDE ABDOMINAL'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('pequenas-partes', examName)?.name, examName).toBe(expected);
    }
  });

  it('todos os modelos de pequenas partes passam na validação de esquema', () => {
    for (const def of PEQUENAS_PARTES_SCHEMAS) {
      expect(validateStructuredSchema(def.sections()), def.name).toEqual([]);
    }
  });

  it('fábricas retornam instâncias novas (sem estado compartilhado)', () => {
    const a = findStandardSchema('medicina-interna', 'ABDOME TOTAL')!.sections;
    const b = findStandardSchema('medicina-interna', 'ABDOME TOTAL')!.sections;
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe('standardSchemas — precedência no deriveStructuredSchema', () => {
  it('modelo padrão substitui o parser quando não há personalização', () => {
    const s = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    // Lesões hepáticas agora ficam ANINHADAS no fígado (aparecem quando 'Alterado').
    const figado = s.sections.find((x) => x.id === 'figado')!;
    expect(figado.normalable).toBe(true);
    expect(figado.repeatGroup?.itemLabel).toBe('Lesão');
    expect(s.sections.find((x) => x.id === 'rim-direito')?.fields.some((f) => f.id === 'rim_d_dims')).toBe(true);
  });

  it('esquema personalizado da máscara ainda tem prioridade sobre o modelo padrão', () => {
    const t = { ...tpl('medicina-interna', 'ABDOME TOTAL'), structuredSchema: { sections: [{ id: 'x', label: 'X', fields: [] }] } };
    expect(deriveStructuredSchema(t, 'medicina-interna').sections.map((s) => s.id)).toEqual(['x']);
  });
});

describe('standardSchemas — conteúdo clínico de medicina interna', () => {
  it('PRÓSTATA: prostata_dims liga prostate-weight; PSA presente; VRPM canônico', () => {
    const s = findStandardSchema('medicina-interna', 'PRÓSTATA VIA ABDOMINAL')!.sections;
    const prostata = s.find((x) => x.id === 'prostata')!;
    expect(prostata.fields.find((f) => f.id === 'prostata_dims')?.calcId).toBe('prostate-weight');
    expect(prostata.fields.some((f) => f.id === 'psa')).toBe(true);
    expect(s.find((x) => x.id === 'vrpm')?.fields[0].id).toBe('vrpm');
  });

  it('RINS COM DOPPLER: Doppler renal com ids canônicos (RAR/IR) e cistos com Bosniak', () => {
    const s = findStandardSchema('medicina-interna', 'RINS E VIAS URINÁRIAS COM DOPPLER')!.sections;
    const dop = s.find((x) => x.id === 'doppler-renal')!;
    for (const id of ['vps_renal_d', 'vps_renal_e', 'vps_aorta', 'ir_d', 'ir_e']) {
      expect(dop.fields.some((f) => f.id === id), id).toBe(true);
    }
    // Cistos ANINHADOS no rim (não em seção solta); lista Bosniak sob 'Alterado'.
    expect(s.some((x) => x.id === 'cistos-renais'), 'não deve haver seção solta de cistos').toBe(false);
    for (const side of ['direito', 'esquerdo']) {
      const rim = s.find((x) => x.id === `rim-${side}`)!;
      expect(rim.repeatGroup?.score, side).toBe('bosniak');
      expect(rim.repeatGroup?.fields.some((f) => f.id === 'solido'), side).toBe(true);
      // o lado é estrutural (a seção do rim), não um dropdown na lesão
      expect(rim.repeatGroup?.fields.some((f) => f.id === 'lado'), side).toBe(false);
    }
  });

  it('RINS (sem Doppler) e ABDOME: cistos DESCRITIVOS aninhados no rim, sem Bosniak', () => {
    for (const name of ['RINS E VIAS URINÁRIAS', 'ABDOME TOTAL']) {
      const s = findStandardSchema('medicina-interna', name)!.sections;
      expect(s.some((x) => x.id === 'cistos-renais'), name).toBe(false);
      const rim = s.find((x) => x.id === 'rim-direito')!;
      expect(rim.repeatGroup?.score, name).toBeUndefined();
      expect(rim.repeatGroup?.fields.some((f) => f.id === 'classificacao'), name).toBe(true);
      expect(rim.repeatGroup?.fields.find((f) => f.id === 'dims')?.calcId, name).toBe('volume-elipsoide');
    }
  });

  it('ABDOME COM DOPPLER acrescenta Doppler hepático (e renal no total)', () => {
    const sup = findStandardSchema('medicina-interna', 'ABDOME SUPERIOR COM DOPPLER')!.sections;
    expect(sup.some((x) => x.id === 'doppler-hepatico')).toBe(true);
    expect(sup.some((x) => x.id === 'doppler-renal')).toBe(false);
    const tot = findStandardSchema('medicina-interna', 'ABDOME TOTAL COM DOPPLER')!.sections;
    expect(tot.some((x) => x.id === 'doppler-hepatico')).toBe(true);
    expect(tot.some((x) => x.id === 'doppler-renal')).toBe(true);
  });
});

describe('standardSchemas — conteúdo clínico de pequenas partes', () => {
  it('TIREOIDE: lobos canônicos + nódulos (achado) com score TI-RADS aninhado', () => {
    const s = findStandardSchema('pequenas-partes', 'TIREOIDE')!.sections;
    expect(s.find((x) => x.id === 'lobo-direito')?.fields[0].id).toBe('lobo_d_dims');
    expect(s.find((x) => x.id === 'lobo-esquerdo')?.fields[0].id).toBe('lobo_e_dims');
    const nod = s.find((x) => x.id === 'nodulos')!;
    expect(nod.normalable).toBe(true); // Normal (sem nódulos) por padrão
    expect(nod.repeatGroup?.score).toBe('tirads');
    expect(nod.repeatGroup?.fields.find((f) => f.id === 'composicao')?.scoreKey).toBe('composition');
    expect(nod.repeatGroup?.fields.find((f) => f.id === 'focos')?.scoreKey).toBe('foci');
  });

  it('TIREOIDE COM DOPPLER acrescenta vascularização à glândula', () => {
    const semDop = findStandardSchema('pequenas-partes', 'TIREOIDE')!.sections;
    const comDop = findStandardSchema('pequenas-partes', 'TIREOIDE COM DOPPLER')!.sections;
    const g = (secs: typeof comDop) => secs.find((x) => x.id === 'glandula-tireoide')!;
    expect(g(semDop).fields.some((f) => f.id === 'vascularizacao')).toBe(false);
    expect(g(comDop).fields.some((f) => f.id === 'vascularizacao')).toBe(true);
  });

  it('BOLSA ESCROTAL: testículos canônicos com volume; Doppler só na variante com Doppler', () => {
    const s = findStandardSchema('pequenas-partes', 'BOLSA ESCROTAL')!.sections;
    expect(s.find((x) => x.id === 'testiculo-direito')?.fields.find((f) => f.id === 'test_d_dims')?.calcId).toBe('volume-elipsoide');
    expect(s.some((x) => x.id === 'doppler-escrotal')).toBe(false);
    const sDop = findStandardSchema('pequenas-partes', 'BOLSA ESCROTAL COM DOPPLER')!.sections;
    expect(sDop.some((x) => x.id === 'doppler-escrotal')).toBe(true);
    expect(sDop.find((x) => x.id === 'funiculos')?.fields.some((f) => f.id === 'refluxo_valsalva')).toBe(true);
  });

  it('REGIÕES INGUINAIS e PAREDE ABDOMINAL têm hérnia à Valsalva', () => {
    const ing = findStandardSchema('pequenas-partes', 'REGIÕES INGUINAIS')!.sections;
    expect(ing.map((x) => x.id)).toEqual(['inguinal-direita', 'inguinal-esquerda']);
    const par = findStandardSchema('pequenas-partes', 'PAREDE ABDOMINAL')!.sections;
    const hernias = par.find((x) => x.id === 'hernias')!;
    expect(hernias.normalable).toBe(true); // sem hérnias por padrão
    expect(hernias.repeatGroup?.itemLabel).toBe('Hérnia');
    expect(par.some((x) => x.id === 'linha-alba')).toBe(true);
  });
});

describe('standardSchemas — cálculo ao vivo em pequenas partes', () => {
  it('volume tireoidiano total soma os lobos e cai na seção do lobo direito (onde está o campo)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const d = computeDerivations(schema, { lobo_d_dims: '4,5 x 1,5 x 1,4', lobo_e_dims: '4,3 x 1,4 x 1,3' });
    const vol = d.find((x) => x.id === 'tireoide__voltotal');
    // secOf resolve para a seção real do campo lobo_d_dims (fallback 'istmo' só se ausente).
    expect(vol?.sectionId).toBe('lobo-direito');
    expect(vol?.text).toContain('cm³');
  });

  it('TI-RADS de nódulo deriva por instância no grupo aninhado (seção nodulos)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const c = groupContainerId('nodulos', 'item'); // container do grupo de nódulos
    const d = computeDerivations(schema, {
      [normalKey('nodulos')]: 'altered', // achado precisa estar 'Alterado' p/ revelar a lista
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'composicao')]: 'sólida',
      [itemFieldId(c, 0, 'ecogenicidade')]: 'muito hipoecoico',
      [itemFieldId(c, 0, 'forma')]: 'mais alto que largo',
      [itemFieldId(c, 0, 'margem')]: 'lobulada/irregular',
      [itemFieldId(c, 0, 'dims')]: '1,8 x 1,2 x 1,1',
    });
    const tr = d.find((x) => x.id.includes('__tr'));
    expect(tr?.sectionId).toBe('nodulos'); // agrupa sob a seção dona
    expect(tr?.text).toContain('TR5');
  });

  it('nódulo preenchido SEM clique em Alterado: TI-RADS deriva e compila (não "sem alterações")', () => {
    // Regressão: a UI não tem toggle de estado — o preenchimento do nódulo
    // precisa virar a seção para Alterado sozinho, senão o laudo/IA recebia
    // "sem alterações" contradizendo os descritores digitados.
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const c = groupContainerId('nodulos', 'item');
    const values = {
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'composicao')]: 'sólida',
      [itemFieldId(c, 0, 'ecogenicidade')]: 'muito hipoecoico',
      [itemFieldId(c, 0, 'forma')]: 'mais alto que largo',
      [itemFieldId(c, 0, 'margem')]: 'lobulada/irregular',
      [itemFieldId(c, 0, 'dims')]: '1,8 x 1,2 x 1,1',
    };
    expect(computeDerivations(schema, values).find((x) => x.id.includes('__tr'))?.text).toContain('TR5');
    const text = summarizeStructured(schema, values).lines.join('\n');
    expect(text).toMatch(/Nódulo 1:/);
    expect(text).toMatch(/muito hipoecoico/);
    expect(text).not.toMatch(/Achados Nodulares: sem alterações/);
  });

  it('cisto renal ANINHADO no rim: Bosniak deriva por instância na seção do rim', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'RINS E VIAS URINÁRIAS COM DOPPLER'), 'medicina-interna');
    const c = groupContainerId('rim-direito', 'lesao'); // lesões aninhadas no rim direito
    const d = computeDerivations(schema, {
      [normalKey('rim-direito')]: 'altered',
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'solido')]: 'presente', // componente sólido → Bosniak IV
      [itemFieldId(c, 0, 'dims')]: '3 x 2 x 2',
    });
    const bosniak = d.find((x) => x.id.includes('bosniak') || /Bosniak/.test(x.text));
    expect(bosniak?.sectionId).toBe('rim-direito'); // o chip cai NA seção do rim
    expect(bosniak?.text).toMatch(/Bosniak IV/);
    // e o volume do cisto também deriva na mesma seção
    expect(d.some((x) => x.sectionId === 'rim-direito' && /cm³/.test(x.text))).toBe(true);
  });
});

describe('standardSchemas — cálculos ao vivo apontam para as seções do modelo', () => {
  it('esplenomegalia, VRPM e volume renal derivam nas seções corretas', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'RINS E VIAS URINÁRIAS'), 'medicina-interna');
    const schemaAbd = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    const dAbd = computeDerivations(schemaAbd, { baco_eixo: '13,5' });
    expect(dAbd.find((x) => x.id === 'baco__eixo')?.sectionId).toBe('baco');
    expect(dAbd.find((x) => x.id === 'baco__eixo')?.alert).toBe(true);

    const d = computeDerivations(schema, {
      vrpm: '120',
      '__n:rim-direito': 'altered', // seção normalable precisa estar 'Alterado' p/ derivar
      rim_d_dims: '10,2 x 4,8 x 4,1',
    });
    expect(d.find((x) => x.id === 'vrpm__class')?.sectionId).toBe('vrpm');
    expect(d.find((x) => x.id === 'vrpm__class')?.alert).toBe(true);
    expect(d.find((x) => x.id === 'rim_d_dims__vol')?.sectionId).toBe('rim-direito');
  });

  it('RAR e IR intraparenquimatoso derivam na seção doppler-renal do modelo', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'RINS E VIAS URINÁRIAS COM DOPPLER'), 'medicina-interna');
    const d = computeDerivations(schema, {
      vps_renal_d: '200', vps_aorta: '50', ir_e: '0,75',
    });
    const rar = d.find((x) => x.id === 'rar_d');
    expect(rar?.sectionId).toBe('doppler-renal');
    expect(rar?.alert).toBe(true); // 200/50 = 4,0 ≥ 3,5
    const ir = d.find((x) => x.id === 'ri_intra_e');
    expect(ir?.sectionId).toBe('doppler-renal');
    expect(ir?.alert).toBe(true);
  });

  it('próstata: volume/peso e densidade do PSA derivam na seção prostata', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'PRÓSTATA VIA ABDOMINAL'), 'medicina-interna');
    const d = computeDerivations(schema, { prostata_dims: '5,1 x 4,6 x 4,2', psa: '6,0' });
    expect(d.find((x) => x.id === 'prostata__vw')?.sectionId).toBe('prostata');
    const dens = d.find((x) => x.id === 'psa__density');
    expect(dens?.sectionId).toBe('prostata');
    expect(dens?.text).toContain('ng/mL/cc');
  });
});

describe('standardSchemas — grupo de lesões ANINHADO (Alterado) + valores de normalidade', () => {
  const abdomeSchema = () => deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
  const figadoLesao = groupContainerId('figado', 'lesoes');

  it('lesão preenchida vira a seção para Alterado sozinha e compila (sem clique)', () => {
    const s = abdomeSchema();
    const { lines } = summarizeStructured(s, {
      [countKey(figadoLesao)]: '1',
      [itemFieldId(figadoLesao, 0, 'segmento')]: 'S6',
    });
    // Lesão registrada É um achado: compila mesmo sem marcar 'Alterado'
    // (a UI não tem toggle de estado — o auto-alterado é o caminho real).
    expect(lines.join('\n')).not.toMatch(/Fígado: sem alterações/);
    expect(lines.join('\n')).toMatch(/S6/);
  });

  it('escolha MANUAL de Normal vence e oculta a lesão residual', () => {
    const s = abdomeSchema();
    const { lines } = summarizeStructured(s, {
      [normalKey('figado')]: 'normal',
      [countKey(figadoLesao)]: '1',
      [itemFieldId(figadoLesao, 0, 'segmento')]: 'S6',
    });
    expect(lines.join('\n')).toMatch(/Fígado: sem alterações/);
    expect(lines.join('\n')).not.toMatch(/S6/);
  });

  it('fígado ALTERADO compila campos fixos + a lesão aninhada, e deriva o volume', () => {
    const s = abdomeSchema();
    const values = {
      [normalKey('figado')]: 'altered',
      esteatose: 'grau II (moderada)',
      [countKey(figadoLesao)]: '1',
      [itemFieldId(figadoLesao, 0, 'segmento')]: 'S6',
      [itemFieldId(figadoLesao, 0, 'dims')]: '2 x 1,5 x 1,5',
    };
    const text = summarizeStructured(s, values).lines.join('\n');
    expect(text).toMatch(/Esteatose: grau II/);
    expect(text).toMatch(/Lesão 1:/);
    expect(text).toMatch(/Segmento.*S6/);

    // Volume da lesão aninhada deriva sob a seção fígado.
    const d = computeDerivations(s, values);
    const vol = d.find((x) => x.id === itemFieldId(figadoLesao, 0, 'dims') + '__vol');
    expect(vol?.sectionId).toBe('figado');
    expect(vol?.text).toContain('cm³');
  });

  it('campos de medida expõem valor de referência de normalidade (field.normal)', () => {
    const s = findStandardSchema('medicina-interna', 'ABDOME TOTAL')!.sections;
    const coledoco = s.find((x) => x.id === 'vias-biliares')!.fields.find((f) => f.id === 'coledoco');
    expect(coledoco?.normal).toBe('≤ 6 mm');
    const baco = s.find((x) => x.id === 'baco')!.fields.find((f) => f.id === 'baco_eixo');
    expect(baco?.normal).toBe('≤ 12 cm');
  });
});

describe('standardSchemas — biometria registrada MESMO em normalidade (alwaysShow)', () => {
  const abdome = () => deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');

  it('marca as medidas que se registram na normalidade (fígado, colédoco, baço, rim, aorta)', () => {
    const s = findStandardSchema('medicina-interna', 'ABDOME TOTAL')!.sections;
    const f = (sec: string, id: string) => s.find((x) => x.id === sec)!.fields.find((x) => x.id === id);
    expect(f('figado', 'figado_lobo_d')?.alwaysShow).toBe(true);
    expect(f('vias-biliares', 'coledoco')?.alwaysShow).toBe(true);
    expect(f('baco', 'baco_eixo')?.alwaysShow).toBe(true);
    expect(f('rim-direito', 'rim_d_dims')?.alwaysShow).toBe(true);
    expect(f('grandes-vasos', 'aorta')?.alwaysShow).toBe(true);
    // descritores de alteração NÃO persistem no card Normal
    expect(f('figado', 'esteatose')?.alwaysShow).toBeUndefined();
  });

  it('seção NORMAL compila a frase de normalidade + as medidas registradas', () => {
    const { lines, filledCount } = summarizeStructured(abdome(), {
      baco_eixo: '11',        // baço normal (dentro da faixa), medida registrada
    });
    const text = lines.join('\n');
    expect(text).toMatch(/Baço: sem alterações/);
    expect(text).toMatch(/Maior eixo longitudinal: 11 cm/);
    expect(filledCount).toBeGreaterThanOrEqual(2);
  });

  it('select clínico fora da 1ª opção vira a seção para Alterado e compila', () => {
    // Regressão: esteatose 'grau II (moderada)' (select sem normalOption) era
    // ENGOLIDA — compilava "Fígado: sem alterações" contradizendo o achado.
    const { lines } = summarizeStructured(abdome(), { esteatose: 'grau II (moderada)' });
    const text = lines.join('\n');
    expect(text).toMatch(/grau II/);
    expect(text).not.toMatch(/Fígado: sem alterações/);
    // 1ª opção ('ausente' = normal por convenção) NÃO altera a seção
    const normal = summarizeStructured(abdome(), { esteatose: 'ausente' }).lines.join('\n');
    expect(normal).toMatch(/Fígado: sem alterações/);
  });

  it('multiselect com chip marcado vira a seção para Alterado e compila', () => {
    // 'cálculo(s)' na vesícula era engolido como "sem alterações".
    const { lines } = summarizeStructured(abdome(), { vesicula_achados: 'cálculo(s)' });
    const text = lines.join('\n');
    expect(text).toMatch(/cálculo/);
    expect(text).not.toMatch(/Vesícula Biliar: sem alterações/);
  });

  it('texto digitado em campo Achados/Observação vira Alterado e compila', () => {
    // Campos de texto livre eram engolidos na seção normal.
    const { lines } = summarizeStructured(abdome(), { rim_d_achados: 'nefropatia parenquimatosa G3' });
    const text = lines.join('\n');
    expect(text).toMatch(/nefropatia parenquimatosa G3/);
    expect(text).not.toMatch(/Rim Direito: sem alterações/);
    // auto-preenchimento do botão Normal NÃO conta como achado
    const auto = summarizeStructured(abdome(), { rim_d_achados: 'sem alterações' }).lines.join('\n');
    expect(auto).toMatch(/Rim Direito: sem alterações/);
  });

  it('cálculo ao vivo segue rodando na seção NORMAL (volume renal e baço)', () => {
    const d = computeDerivations(abdome(), { rim_d_dims: '10 x 4,5 x 4', baco_eixo: '11' });
    // volume do rim deriva mesmo com a seção 'Normal' (medida de rotina)
    expect(d.find((x) => x.id === 'rim_d_dims__vol')?.sectionId).toBe('rim-direito');
    // baço dentro da faixa → sem alerta
    const baco = d.find((x) => x.id === 'baco__eixo');
    expect(baco?.text).toContain('11');
    expect(baco?.alert).toBe(false);
  });

  it('lesão preenchida deriva volume (auto-alterado); Normal MANUAL oculta', () => {
    const c = groupContainerId('figado', 'lesoes');
    const values = {
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'dims')]: '2 x 2 x 2',
    };
    // preencheu a lesão → seção vira Alterado sozinha → volume deriva
    expect(computeDerivations(abdome(), values).find((x) => x.id.includes(c))?.text).toContain('cm³');
    // escolha manual de Normal vence e suprime a derivação residual
    expect(
      computeDerivations(abdome(), { ...values, [normalKey('figado')]: 'normal' }).find((x) => x.id.includes(c))
    ).toBeUndefined();
  });
});

describe('standardSchemas — GINECOLOGIA (Fase 3)', () => {
  it('resolve as 5 máscaras (ENDOMETRIOSE e COM DOPPLER antes das genéricas)', () => {
    const cases: [string, string][] = [
      ['PÉLVICA TRANSVAGINAL', 'PÉLVICA TRANSVAGINAL'],
      ['PÉLVICA TRANSVAGINAL COM DOPPLER', 'PÉLVICA TRANSVAGINAL COM DOPPLER'],
      ['PÉLVICA ABDOMINAL', 'PÉLVICA ABDOMINAL'],
      ['PÉLVICA ABDOMINAL COM DOPPLER', 'PÉLVICA ABDOMINAL COM DOPPLER'],
      ['PÉLVICA — ENDOMETRIOSE', 'PÉLVICA — ENDOMETRIOSE'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('ginecologia', examName)?.name, examName).toBe(expected);
    }
  });

  it('todos os modelos de ginecologia passam na validação de esquema', () => {
    for (const def of GINECOLOGIA_SCHEMAS) {
      expect(validateStructuredSchema(def.sections()), def.name).toEqual([]);
    }
  });

  it('ÚTERO: dims canônicas com volume no card Normal + miomas FIGO aninhados', () => {
    const s = findStandardSchema('ginecologia', 'PÉLVICA TRANSVAGINAL')!.sections;
    const utero = s.find((x) => x.id === 'utero')!;
    const dims = utero.fields.find((f) => f.id === 'utero_dims')!;
    expect(dims.calcId).toBe('volume-elipsoide');
    expect(dims.alwaysShow).toBe(true); // volume uterino é medido mesmo normal
    expect(utero.repeatGroup?.itemLabel).toBe('Mioma');
    expect(utero.repeatGroup?.fields.find((f) => f.id === 'figo')?.calcId).toBe('figo-myoma');
  });

  it('ENDOMÉTRIO e OVÁRIOS preservam os ids canônicos do cálculo ao vivo', () => {
    const s = findStandardSchema('ginecologia', 'PÉLVICA TRANSVAGINAL')!.sections;
    const endo = s.find((x) => x.id === 'endometrio')!;
    expect(endo.fields.find((f) => f.id === 'endometrio_esp')?.alwaysShow).toBe(true);
    expect(endo.fields.find((f) => f.id === 'menopausa')?.alwaysShow).toBe(true);
    for (const [sec, dims, afc] of [['ovario-direito', 'ovd_dims', 'ovd_afc'], ['ovario-esquerdo', 'ove_dims', 'ove_afc']] as const) {
      const ov = s.find((x) => x.id === sec)!;
      expect(ov.fields.some((f) => f.id === dims), dims).toBe(true);
      expect(ov.fields.some((f) => f.id === afc), afc).toBe(true);
    }
  });

  it('FORMAÇÕES ANEXIAIS: achado com score O-RADS aninhado e descritores IOTA', () => {
    const anexos = findStandardSchema('ginecologia', 'PÉLVICA TRANSVAGINAL')!.sections.find((x) => x.id === 'anexos')!;
    expect(anexos.normalable).toBe(true);
    expect(anexos.repeatGroup?.score).toBe('orads');
    for (const id of ['tipo', 'conteudo', 'septos', 'vascularizacao']) {
      expect(anexos.repeatGroup?.fields.some((f) => f.id === id), id).toBe(true);
    }
  });

  it('via ABDOMINAL acrescenta técnica/bexiga; Doppler só nas variantes com Doppler', () => {
    const tv = findStandardSchema('ginecologia', 'PÉLVICA TRANSVAGINAL')!.sections;
    expect(tv.some((x) => x.id === 'via-abdominal')).toBe(false);
    expect(tv.some((x) => x.id === 'estudo-doppler')).toBe(false);
    const abd = findStandardSchema('ginecologia', 'PÉLVICA ABDOMINAL')!.sections;
    expect(abd.some((x) => x.id === 'via-abdominal')).toBe(true);
    expect(abd.some((x) => x.id === 'bexiga')).toBe(true);
    const tvDop = findStandardSchema('ginecologia', 'PÉLVICA TRANSVAGINAL COM DOPPLER')!.sections;
    expect(tvDop.some((x) => x.id === 'estudo-doppler')).toBe(true);
  });

  it('ENDOMETRIOSE: compartimentos IDEA + focos de DIE (mapa) e endometriomas', () => {
    const s = findStandardSchema('ginecologia', 'PÉLVICA — ENDOMETRIOSE')!.sections;
    expect(s.map((x) => x.id)).toEqual(expect.arrayContaining([
      'utero-endometrio', 'ovarios-endometriose', 'compartimento-anterior', 'compartimento-posterior', 'parametrios', 'focos-die',
    ]));
    // sinais do deslizamento e uterossacros são registrados mesmo na normalidade
    const post = s.find((x) => x.id === 'compartimento-posterior')!;
    expect(post.fields.find((f) => f.id === 'sliding_post')?.alwaysShow).toBe(true);
    expect(post.fields.find((f) => f.id === 'uterossacro_d')?.normal).toBe('≤ 3 mm');
    expect(s.find((x) => x.id === 'ovarios-endometriose')?.repeatGroup?.itemLabel).toBe('Endometrioma');
    expect(s.find((x) => x.id === 'focos-die')?.repeatGroup?.itemLabel).toBe('Foco');
  });
});

describe('standardSchemas — cálculo ao vivo em ginecologia', () => {
  const tv = () => deriveStructuredSchema(tpl('ginecologia', 'PÉLVICA TRANSVAGINAL'), 'ginecologia');

  it('volume uterino/ovariano deriva mesmo com as seções em NORMAL', () => {
    const d = computeDerivations(tv(), { utero_dims: '7,5 x 4 x 5', ovd_dims: '3 x 2 x 2' });
    expect(d.find((x) => x.id === 'utero_dims__vol')?.sectionId).toBe('utero');
    expect(d.find((x) => x.id === 'ovd_dims__vol')?.sectionId).toBe('ovario-direito');
  });

  it('espessura endometrial: o limiar segue o estado hormonal (TH muda o corte)', () => {
    const d = computeDerivations(tv(), { endometrio_esp: '9', menopausa: 'pós-menopausa sem TH' });
    const endo = d.find((x) => x.id === 'endo__esp');
    expect(endo?.sectionId).toBe('endometrio');
    expect(endo?.alert).toBe(true);
    expect(endo?.text).toMatch(/espessado/);
  });

  it('morfologia de SOP a partir do CFA/volume ovariano', () => {
    const d = computeDerivations(tv(), { ovd_afc: '24', ovd_dims: '4 x 3 x 3' });
    const sop = d.find((x) => x.id === 'sop_direito');
    expect(sop?.sectionId).toBe('ovario-direito');
    expect(sop?.text).toMatch(/SOP/);
  });

  it('O-RADS sugerido por instância da formação anexial (grupo aninhado)', () => {
    const c = groupContainerId('anexos', 'item');
    const d = computeDerivations(tv(), {
      [normalKey('anexos')]: 'altered',
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'tipo')]: 'unilocular',
      [itemFieldId(c, 0, 'conteudo')]: 'anecoico',
      [itemFieldId(c, 0, 'septos')]: 'ausentes',
      [itemFieldId(c, 0, 'vascularizacao')]: '1 – ausente',
    });
    const or = d.find((x) => x.id.includes('__or'));
    expect(or?.sectionId).toBe('anexos');
    expect(or?.text).toMatch(/O-RADS/);
  });
});

describe('standardSchemas — MASTOLOGIA (Fase 4)', () => {
  it('resolve as 3 máscaras (LINFONODOS e COM DOPPLER antes da genérica)', () => {
    const cases: [string, string][] = [
      ['MAMAS E AXILAS', 'MAMAS E AXILAS'],
      ['MAMAS COM DOPPLER', 'MAMAS COM DOPPLER'],
      ['LINFONODOS AXILARES', 'LINFONODOS AXILARES'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('mastologia', examName)?.name, examName).toBe(expected);
    }
  });

  it('todos os modelos de mastologia passam na validação de esquema', () => {
    for (const def of MASTOLOGIA_SCHEMAS) {
      expect(validateStructuredSchema(def.sections()), def.name).toEqual([]);
    }
  });

  it('léxico BI-RADS US v2025: "lobulada" na forma e "microlobulada" MANTIDA na margem', () => {
    const s = findStandardSchema('mastologia', 'MAMAS E AXILAS')!.sections;
    const lesao = s.find((x) => x.id === 'parenquima')!.repeatGroup!;
    const forma = lesao.fields.find((f) => f.id === 'forma')!;
    const margem = lesao.fields.find((f) => f.id === 'margem')!;
    expect(forma.options).toContain('lobulada'); // descritor novo do v2025 (US)
    // a fusão microlobulada→indistinta é MAMOGRÁFICA; no US permanece distinta
    expect(margem.options).toContain('microlobulada');
    expect(margem.options).toContain('indistinta');
  });

  it('lesões BI-RADS aninhadas sob o parênquima, com escore e calculadora', () => {
    const parenquima = findStandardSchema('mastologia', 'MAMAS E AXILAS')!.sections.find((x) => x.id === 'parenquima')!;
    expect(parenquima.normalable).toBe(true);
    expect(parenquima.repeatGroup?.score).toBe('birads');
    expect(parenquima.repeatGroup?.fields.find((f) => f.id === 'dims')?.calcId).toBe('volume-elipsoide');
    expect(parenquima.repeatGroup?.fields.find((f) => f.id === 'birads')?.calcId).toBe('birads-us-2013');
  });

  it('MAMAS COM DOPPLER separa as mamas (lesão sem campo "mama") e tem Doppler', () => {
    const s = findStandardSchema('mastologia', 'MAMAS COM DOPPLER')!.sections;
    expect(s.some((x) => x.id === 'mama-direita')).toBe(true);
    expect(s.some((x) => x.id === 'mama-esquerda')).toBe(true);
    expect(s.some((x) => x.id === 'estudo-doppler')).toBe(true);
    // lesão sob a mama específica não repete o campo de lado
    expect(s.find((x) => x.id === 'mama-direita')!.repeatGroup!.fields.some((f) => f.id === 'mama')).toBe(false);
    // já em MAMAS E AXILAS (parênquima único) o lado é necessário
    const mea = findStandardSchema('mastologia', 'MAMAS E AXILAS')!.sections.find((x) => x.id === 'parenquima')!;
    expect(mea.repeatGroup!.fields.some((f) => f.id === 'mama')).toBe(true);
  });

  it('LINFONODOS AXILARES: axilas por lado com níveis de Berg e córtex ≤ 3 mm', () => {
    const s = findStandardSchema('mastologia', 'LINFONODOS AXILARES')!.sections;
    expect(s.map((x) => x.id)).toEqual(['axila-direita', 'axila-esquerda', 'outros-achados']);
    const linf = s[0].repeatGroup!;
    expect(linf.fields.find((f) => f.id === 'cortex')?.normal).toBe('≤ 3 mm');
    expect(linf.fields.find((f) => f.id === 'nivel')?.options?.[0]).toMatch(/I —/);
  });
});

describe('standardSchemas — cálculo ao vivo em mastologia', () => {
  const mamas = () => deriveStructuredSchema(tpl('mastologia', 'MAMAS E AXILAS'), 'mastologia');
  const c = groupContainerId('parenquima', 'lesoes');

  it('sugestão BI-RADS de alta suspeita a partir dos descritores (por lesão)', () => {
    const d = computeDerivations(mamas(), {
      [normalKey('parenquima')]: 'altered',
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'forma')]: 'irregular',
      [itemFieldId(c, 0, 'orientacao')]: 'não paralela (mais alta que larga)',
      [itemFieldId(c, 0, 'margem')]: 'espiculada',
      [itemFieldId(c, 0, 'acusticas')]: 'sombra acústica',
      [itemFieldId(c, 0, 'dims')]: '1,2 x 1,5 x 1,1',
    });
    const bi = d.find((x) => x.id.includes('__bi'));
    expect(bi?.sectionId).toBe('parenquima');
    expect(bi?.text).toMatch(/4C–5/);
    expect(bi?.alert).toBe(true);
    // volume da lesão também deriva no item
    expect(d.some((x) => x.id === itemFieldId(c, 0, 'dims') + '__vol')).toBe(true);
  });

  it('cisto simples → BI-RADS 2 sem alerta; margem microlobulada segue suspeita no US', () => {
    const cisto = computeDerivations(mamas(), {
      [normalKey('parenquima')]: 'altered',
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'forma')]: 'oval',
      [itemFieldId(c, 0, 'orientacao')]: 'paralela',
      [itemFieldId(c, 0, 'margem')]: 'circunscrita',
      [itemFieldId(c, 0, 'eco')]: 'anecoico',
      [itemFieldId(c, 0, 'acusticas')]: 'reforço acústico posterior',
    }).find((x) => x.id.includes('__bi'));
    expect(cisto?.text).toMatch(/BI-RADS 2/);
    expect(cisto?.alert).toBe(false);

    const micro = computeDerivations(mamas(), {
      [normalKey('parenquima')]: 'altered',
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'forma')]: 'oval',
      [itemFieldId(c, 0, 'orientacao')]: 'paralela',
      [itemFieldId(c, 0, 'margem')]: 'microlobulada',
    }).find((x) => x.id.includes('__bi'));
    expect(micro?.text).toMatch(/microlobulada/);
    expect(micro?.alert).toBe(true);
  });

  it('lesão preenchida deriva BI-RADS sozinha; Normal MANUAL suprime', () => {
    const values = {
      [countKey(c)]: '1',
      [itemFieldId(c, 0, 'forma')]: 'irregular',
      [itemFieldId(c, 0, 'margem')]: 'espiculada',
    };
    // descritores preenchidos → parênquima vira Alterado sozinho → BI-RADS deriva
    expect(computeDerivations(mamas(), values).find((x) => x.id.includes('__bi'))?.alert).toBe(true);
    // escolha manual de Normal vence e suprime
    expect(
      computeDerivations(mamas(), { ...values, [normalKey('parenquima')]: 'normal' }).find((x) => x.id.includes('__bi'))
    ).toBeUndefined();
  });
});

describe('standardSchemas — MEDICINA FETAL (Fase 5)', () => {
  it('resolve as 9 máscaras (específicas antes das genéricas)', () => {
    const cases: [string, string][] = [
      ['OBSTÉTRICA INICIAL', 'OBSTÉTRICA INICIAL'],
      ['OBSTÉTRICA ABDOMINAL', 'OBSTÉTRICA ABDOMINAL'],
      ['OBSTÉTRICA ABDOMINAL COM DOPPLER', 'OBSTÉTRICA ABDOMINAL COM DOPPLER'],
      ['MORFOLÓGICA DO PRIMEIRO TRIMESTRE', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'],
      ['MORFOLÓGICO DE SEGUNDO TRIMESTRE', 'MORFOLÓGICO DE SEGUNDO TRIMESTRE'],
      ['NEUROSSONOGRAFIA FETAL', 'NEUROSSONOGRAFIA FETAL'],
      ['ECOCARDIOGRAMA FETAL', 'ECOCARDIOGRAMA FETAL'],
      ['GEMELAR', 'GEMELAR'],
      ['CERVICOMETRIA', 'CERVICOMETRIA'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('medicina-fetal', examName)?.name, examName).toBe(expected);
    }
  });

  it('todos os modelos de medicina fetal passam na validação de esquema', () => {
    for (const def of MEDICINA_FETAL_SCHEMAS) {
      expect(validateStructuredSchema(def.sections()), def.name).toEqual([]);
    }
  });

  it('todas as máscaras fetais têm datação com o id canônico `dum`', () => {
    for (const def of MEDICINA_FETAL_SCHEMAS) {
      const dat = def.sections().find((s) => s.id === 'datacao');
      expect(dat?.fields.some((f) => f.id === 'dum'), def.name).toBe(true);
    }
  });

  it('BIOMETRIA usa os ids canônicos do PFE + percentil OMS', () => {
    const s = findStandardSchema('medicina-fetal', 'MORFOLÓGICO DE SEGUNDO TRIMESTRE')!.sections;
    const bio = s.find((x) => x.id === 'biometria')!;
    for (const id of ['dbp', 'dof', 'cc', 'ca', 'cf', 'sexo_fetal']) {
      expect(bio.fields.some((f) => f.id === id), id).toBe(true);
    }
    expect(bio.fields.find((f) => f.id === 'pfe')?.calcId).toBe('who-fetal-biometry');
  });

  it('1º trimestre: CCN/TN/DV canônicos + calculadoras FMF; anatomia é a do 1T', () => {
    const s = findStandardSchema('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE')!.sections;
    // a calculadora de IG foi unificada (DUM / USG / Biometria com CCN-DBP-CC)
    expect(s.find((x) => x.id === 'biometria-1t')!.fields.find((f) => f.id === 'ccn')?.calcId).toBe('gestational-age');
    const mk = s.find((x) => x.id === 'marcadores')!;
    expect(mk.fields.find((f) => f.id === 'nt')?.alwaysShow).toBe(true);
    expect(mk.fields.some((f) => f.id === 'ip_dv')).toBe(true);
    expect(mk.fields.find((f) => f.id === 'risco_trissomias')?.calcId).toBe('fmf-trisomy-risk');
    expect(s.find((x) => x.id === 'doppler-1t')!.fields.find((f) => f.id === 'risco_pe')?.calcId).toBe('fmf-preeclampsia-risk');
    // checklist do 1T não carrega as biometrias do 2T (átrio, cerebelo, prega nucal)
    expect(s.find((x) => x.id === 'polo-cefalico')!.fields.some((f) => f.id === 'atrio_vent')).toBe(false);
    expect(s.find((x) => x.id === 'colo-uterino')!.fields.some((f) => f.id === 'colo')).toBe(true);
  });

  it('OBSTÉTRICA COM DOPPLER: vasos canônicos + oftálmicas + velocidade de crescimento', () => {
    const semDop = findStandardSchema('medicina-fetal', 'OBSTÉTRICA ABDOMINAL')!.sections;
    expect(semDop.some((x) => x.id === 'doppler')).toBe(false);
    const s = findStandardSchema('medicina-fetal', 'OBSTÉTRICA ABDOMINAL COM DOPPLER')!.sections;
    const dop = s.find((x) => x.id === 'doppler')!;
    for (const id of ['ip_au', 'ip_acm', 'psv_acm', 'ip_uta', 'oft_p1', 'oft_p2']) {
      expect(dop.fields.some((f) => f.id === id), id).toBe(true);
    }
    expect(dop.fields.find((f) => f.id === 'crescimento_vel')?.calcId).toBe('growth-velocity');
  });

  it('GEMELAR: corionicidade obrigatória + pfe1/pfe2 canônicos por feto', () => {
    const s = findStandardSchema('medicina-fetal', 'GEMELAR')!.sections;
    expect(s.some((x) => x.id === 'corionicidade')).toBe(true);
    expect(s.find((x) => x.id === 'biometria-1')!.fields.some((f) => f.id === 'pfe1')).toBe(true);
    expect(s.find((x) => x.id === 'biometria-2')!.fields.some((f) => f.id === 'pfe2')).toBe(true);
    expect(s.find((x) => x.id === 'discordancia')!.fields.some((f) => f.id === 'quintero')).toBe(true);
  });

  it('CERVICOMETRIA e NEUROSSONOGRAFIA: medidas-chave no card Normal', () => {
    const cerv = findStandardSchema('medicina-fetal', 'CERVICOMETRIA')!.sections.find((x) => x.id === 'colo-uterino')!;
    expect(cerv.fields.find((f) => f.id === 'colo')?.alwaysShow).toBe(true);
    expect(cerv.fields.find((f) => f.id === 'colo')?.normal).toBe('≥ 25 mm');
    const neuro = findStandardSchema('medicina-fetal', 'NEUROSSONOGRAFIA FETAL')!.sections;
    expect(neuro.find((x) => x.id === 'sistema-ventricular')!.fields.find((f) => f.id === 'atrio_vent')?.alwaysShow).toBe(true);
    expect(neuro.find((x) => x.id === 'fossa-posterior')!.fields.some((f) => f.id === 'cisterna_magna')).toBe(true);
  });
});

describe('standardSchemas — cálculo ao vivo em medicina fetal', () => {
  const obst = () => deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA ABDOMINAL COM DOPPLER'), 'medicina-fetal');
  // DUM ~28 semanas antes da data do exame de referência
  const examDate = new Date(2026, 6, 16).getTime();
  const dum = '01/01/2026';

  it('DUM → IG/DPP; biometria → PFE Hadlock + percentil OMS', () => {
    const d = computeDerivations(obst(), { dum, dbp: '70', cc: '260', ca: '240', cf: '52' }, examDate);
    const ig = d.find((x) => x.id === 'ig__ref');
    expect(ig?.sectionId).toBe('datacao');
    expect(ig?.text).toMatch(/DPP/);
    const pfe = d.find((x) => x.id === 'pfe__hadlock');
    expect(pfe?.sectionId).toBe('biometria');
    expect(pfe?.text).toMatch(/g/);
    expect(pfe?.text).toMatch(/p\d+/); // percentil OMS (requer IG pela DUM)
  });

  it('exame NORMAL preenchido: medidas digitadas e selects descritivos compilam (não são engolidos)', () => {
    // Regressão: em seções normalable, medidas sem alwaysShow (PSV ACM,
    // oftálmicas) e selects descritivos/normais (movimentos, incisura, dorso)
    // eram descartados da compilação — o copiloto recebia o exame incompleto.
    const s = obst();
    const { lines } = summarizeStructured(s, {
      bcf: '140',
      movimentos: 'presentes e adequados',   // normalOption escolhida → ainda compila
      psv_acm: '38,2',                       // medida digitada sem alwaysShow
      oft_p1: '24,1',
      oft_p2: '13,5',
      uta_incisura: 'ausente bilateral',
    });
    const text = lines.join('\n');
    for (const esperado of ['140', 'presentes e adequados', '38,2', '24,1', '13,5', 'ausente bilateral']) {
      expect(text, `faltou "${esperado}" na compilação`).toContain(esperado);
    }
    // e a seção Doppler continua marcada como normalidade (nada disso é achado)
    const soNormais = summarizeStructured(s, { psv_acm: '38,2', uta_incisura: 'ausente bilateral' }).lines.join('\n');
    expect(soNormais).toMatch(/Dopplerfluxometria: sem alterações/);
    expect(soNormais).toContain('38,2');
  });

  it('RCP automática (ACM/AU) e percentis Doppler caem na seção doppler', () => {
    // a DUM só existe (showIf) com o método de datação 'DUM' — como na UI
    const d = computeDerivations(obst(), { ig_metodo: 'DUM', dum, ip_au: '1,4', ip_acm: '1,1' }, examDate);
    const rcp = d.find((x) => x.id === 'rcp__calc');
    expect(rcp?.sectionId).toBe('doppler');
    expect(rcp?.alert).toBe(true); // 1,1/1,4 < 1 → reduzida
    expect(d.find((x) => x.id === 'dop_ip_au')?.sectionId).toBe('doppler');
  });

  it('razão P2/P1 oftálmica ≥ 0,65 alerta risco de pré-eclâmpsia', () => {
    const d = computeDerivations(obst(), { dum, oft_p1: '20', oft_p2: '14' }, examDate);
    const oft = d.find((x) => x.id === 'oft__ratio');
    expect(oft?.sectionId).toBe('doppler');
    expect(oft?.alert).toBe(true);
    expect(oft?.text).toMatch(/pré-eclâmpsia/);
  });

  it('CERVICOMETRIA: colo < 25 mm alerta; 1º trimestre: TN > 3,5 e IG pelo CCN', () => {
    const cerv = deriveStructuredSchema(tpl('medicina-fetal', 'CERVICOMETRIA'), 'medicina-fetal');
    const dc = computeDerivations(cerv, { colo: '18' });
    expect(dc.find((x) => x.id === 'colo__cervico')?.sectionId).toBe('colo-uterino');
    expect(dc.find((x) => x.id === 'colo__cervico')?.alert).toBe(true);

    const m1 = deriveStructuredSchema(tpl('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');
    const d1 = computeDerivations(m1, { ccn: '65', nt: '4,2' });
    expect(d1.find((x) => x.id === 'ig__ccn')?.sectionId).toBe('biometria-1t');
    const nt = d1.find((x) => x.id === 'nt__marker');
    expect(nt?.sectionId).toBe('marcadores');
    expect(nt?.alert).toBe(true);
  });

  it('GEMELAR: discordância de peso > 20% alerta', () => {
    const g = deriveStructuredSchema(tpl('medicina-fetal', 'GEMELAR'), 'medicina-fetal');
    const d = computeDerivations(g, { pfe1: '1500', pfe2: '1100' });
    const disc = d.find((x) => x.id === 'gemelar__disc');
    expect(disc?.sectionId).toBe('biometria-1');
    expect(disc?.alert).toBe(true);
    expect(disc?.text).toMatch(/27%/);
  });

  it('OBSTÉTRICA INICIAL: IG pelo DMSG e pelo CCN nas seções certas', () => {
    const s = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA INICIAL'), 'medicina-fetal');
    const d = computeDerivations(s, { dmsg: '25', ccn: '12' });
    expect(d.find((x) => x.id === 'ig__dmsg')?.sectionId).toBe('saco-gestacional');
    expect(d.find((x) => x.id === 'ig__ccn')?.sectionId).toBe('embriao');
  });
});

// ───────────────────────────── FASE 6 — VASCULAR ─────────────────────────────

describe('standardSchemas — VASCULAR (9 máscaras)', () => {
  it('resolve as 9 máscaras vasculares do sistema', () => {
    const cases: [string, string][] = [
      ['CARÓTIDAS E VERTEBRAIS', 'CARÓTIDAS E VERTEBRAIS'],
      ['ARTÉRIAS OFTÁLMICAS', 'ARTÉRIAS OFTÁLMICAS'],
      ['ARTÉRIAS RENAIS', 'ARTÉRIAS RENAIS'],
      ['AORTA TORÁCICA', 'AORTA TORÁCICA'],
      ['AORTO-ILÍACO', 'AORTO-ILÍACO'],
      ['ARTERIAL MEMBRO INFERIOR', 'ARTERIAL MEMBRO INFERIOR'],
      ['ARTERIAL MEMBRO SUPERIOR', 'ARTERIAL MEMBRO SUPERIOR'],
      ['VENOSO MEMBRO INFERIOR', 'VENOSO MEMBRO INFERIOR'],
      ['VENOSO MEMBRO SUPERIOR', 'VENOSO MEMBRO SUPERIOR'],
    ];
    for (const [examName, expected] of cases) {
      expect(findStandardSchema('vascular', examName)?.name, examName).toBe(expected);
    }
  });

  it('ordem das regexes: AORTA TORÁCICA não é capturada por AORTO-ILÍACO, nem vice-versa', () => {
    expect(findStandardSchema('vascular', 'AORTA TORÁCICA')?.name).toBe('AORTA TORÁCICA');
    expect(findStandardSchema('vascular', 'AORTO-ILÍACO')?.name).toBe('AORTO-ILÍACO');
    // arterial × venoso e inferior × superior não se confundem
    expect(findStandardSchema('vascular', 'ARTERIAL MEMBRO SUPERIOR')?.name).toBe('ARTERIAL MEMBRO SUPERIOR');
    expect(findStandardSchema('vascular', 'VENOSO MEMBRO INFERIOR')?.name).toBe('VENOSO MEMBRO INFERIOR');
    // cópias pessoais herdam
    expect(findStandardSchema('vascular', 'CARÓTIDAS E VERTEBRAIS (Personalizada)')?.name).toBe('CARÓTIDAS E VERTEBRAIS');
  });

  it('todos os modelos vasculares passam na validação de esquema', () => {
    for (const def of VASCULAR_SCHEMAS) {
      const errs = validateStructuredSchema(def.sections());
      expect(errs, `${def.name}: ${errs.join(' | ')}`).toEqual([]);
    }
  });

  it('nenhum id de campo se repete entre seções (o id é global no formulário)', () => {
    // dois campos `ir` em seções diferentes gravariam no MESMO valor: por isso
    // os vasos orbitários usam ir_ao-d / ir_acr-d etc.
    for (const def of VASCULAR_SCHEMAS) {
      const seen = new Map<string, string>();
      for (const sec of def.sections()) {
        for (const f of sec.fields) {
          expect(seen.has(f.id), `${def.name}: id "${f.id}" repetido em "${seen.get(f.id)}" e "${sec.label}"`).toBe(false);
          seen.set(f.id, sec.label);
        }
      }
    }
  });

  it('CARÓTIDAS: ids canônicos da estenose + EMI no card Normal + placas aninhadas', () => {
    const s = findStandardSchema('vascular', 'CARÓTIDAS E VERTEBRAIS')!.sections;
    const emi = s.find((x) => x.id === 'emi')!;
    for (const id of ['emi_d', 'emi_e']) {
      expect(emi.fields.find((f) => f.id === id)?.calcId, id).toBe('imt-elsa-br');
      expect(emi.fields.find((f) => f.id === id)?.alwaysShow, id).toBe(true);
    }
    for (const side of ['d', 'e'] as const) {
      const car = s.find((x) => x.id === `carotida-${side}`)!;
      // sem VPS/VDF no card Normal não há grau de estenose automático
      for (const id of [`vps_acc_${side}`, `vps_aci_${side}`, `vdf_aci_${side}`]) {
        expect(car.fields.find((f) => f.id === id)?.alwaysShow, id).toBe(true);
      }
      expect(car.repeatGroup?.id).toBe('placa');
      expect(car.repeatGroup?.fields.some((f) => f.id === 'superficie')).toBe(true);
    }
  });

  it('ARTERIAL MMII: ITB canônico por lado, no card Normal', () => {
    const s = findStandardSchema('vascular', 'ARTERIAL MEMBRO INFERIOR')!.sections;
    const itb = s.find((x) => x.id === 'itb')!;
    for (const id of ['itb_d', 'itb_e']) {
      expect(itb.fields.find((f) => f.id === id)?.alwaysShow, id).toBe(true);
    }
    expect(itb.fields.some((f) => f.id === 'rutherford')).toBe(true);
  });

  it('ARTÉRIAS RENAIS: RAR depende da VPS da aorta — ela não pode ser opcional', () => {
    const s = findStandardSchema('vascular', 'ARTÉRIAS RENAIS')!.sections;
    const aorta = s.find((x) => x.id === 'aorta')!;
    expect(aorta.fields.find((f) => f.id === 'vps_aorta')?.alwaysShow).toBe(true);
    for (const side of ['d', 'e'] as const) {
      const ar = s.find((x) => x.id === `arteria-renal-${side === 'd' ? 'direita' : 'esquerda'}`)!;
      expect(ar.fields.find((f) => f.id === `vps_renal_${side}`)?.alwaysShow, side).toBe(true);
      const ind = s.find((x) => x.id === `indices-intraparenquimatosos-${side === 'd' ? 'direitos' : 'esquerdos'}`)!;
      expect(ind.fields.some((f) => f.id === `ir_${side}`), side).toBe(true);
    }
  });

  it('VENOSO MMII: trombo aninhado no profundo + refluxo/CEAP no superficial', () => {
    const s = findStandardSchema('vascular', 'VENOSO MEMBRO INFERIOR')!.sections;
    const vp = s.find((x) => x.id === 'vp-d')!;
    expect(vp.repeatGroup?.id).toBe('trombo');
    // a topografia é o que separa risco de TEP significativo do menor
    expect(vp.repeatGroup?.fields.some((f) => f.id === 'topografia')).toBe(true);
    expect(vp.fields.find((f) => f.id === 'compress_vp-d')?.alwaysShow).toBe(true);
    const vs = s.find((x) => x.id === 'vs-d')!;
    expect(vs.fields.some((f) => f.id === 'ceap_vs-d')).toBe(true);
    expect(vs.fields.find((f) => f.id === 'magna_vs-d')?.alwaysShow).toBe(true);
  });

  it('OFTÁLMICAS: cada vaso tem ids próprios (os dois olhos não colidem)', () => {
    const s = findStandardSchema('vascular', 'ARTÉRIAS OFTÁLMICAS')!.sections;
    const aoD = s.find((x) => x.id === 'ao-d')!;
    const aoE = s.find((x) => x.id === 'ao-e')!;
    expect(aoD.fields.some((f) => f.id === 'ir_ao-d')).toBe(true);
    expect(aoE.fields.some((f) => f.id === 'ir_ao-e')).toBe(true);
    // nenhum vaso usa o id genérico `ir`, reservado ao rim em liveCompute
    for (const sec of s) {
      expect(sec.fields.some((f) => f.id === 'ir' || f.id === 'ir_d' || f.id === 'ir_e'), sec.label).toBe(false);
    }
  });
});

describe('VASCULAR — derivações ao vivo nas seções do modelo', () => {
  it('CARÓTIDAS: VPS da ACI dispara o grau de estenose na seção do lado certo', () => {
    const s = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const d = computeDerivations(s, { vps_aci_d: '260', vdf_aci_d: '110', vps_acc_d: '65' });
    const st = d.find((x) => x.id === 'car_sten_d');
    expect(st?.sectionId).toBe('carotida-d');
    expect(st?.text).toMatch(/≥ 70%/);
    expect(st?.text).toMatch(/ACI\/ACC 4,0/);
    expect(st?.alert).toBe(true);
  });

  it('ARTERIAL MMII: ITB classifica por lado na seção do ITB', () => {
    const s = deriveStructuredSchema(tpl('vascular', 'ARTERIAL MEMBRO INFERIOR'), 'vascular');
    const d = computeDerivations(s, { itb_d: '0,55', itb_e: '1,05' });
    expect(d.find((x) => x.id === 'itb_d')?.sectionId).toBe('itb');
    expect(d.find((x) => x.id === 'itb_d')?.alert).toBe(true);
    expect(d.find((x) => x.id === 'itb_e')?.alert).toBe(false);
  });

  it('ARTÉRIAS RENAIS: RAR e IR intraparenquimatoso caem nas seções certas', () => {
    const s = deriveStructuredSchema(tpl('vascular', 'ARTÉRIAS RENAIS'), 'vascular');
    const d = computeDerivations(s, { vps_renal_d: '400', vps_aorta: '80', ir_d: '0,78' });
    const rar = d.find((x) => x.id === 'rar_d');
    expect(rar?.sectionId).toBe('arteria-renal-direita');
    expect(rar?.text).toMatch(/estenose ≥ 60%/);
    expect(rar?.alert).toBe(true);
    const ir = d.find((x) => x.id === 'ri_intra_d');
    expect(ir?.sectionId).toBe('indices-intraparenquimatosos-direitos');
    expect(ir?.alert).toBe(true);
  });
});

// ─────────────── FASES 7–9 — PEDIATRIA · MSK · REUMATO · PROCEDIMENTOS ───────────────

const ALL_AREAS: [string, StandardSchemaDef[]][] = [
  ['pediatria', PEDIATRIA_SCHEMAS],
  ['musculoesqueletico', MUSCULOESQUELETICO_SCHEMAS],
  ['reumatologico', REUMATOLOGICO_SCHEMAS],
  ['procedimentos', PROCEDIMENTOS_SCHEMAS],
];

describe('standardSchemas — ROLLOUT COMPLETO (as 71 máscaras do sistema)', () => {
  /**
   * Prova de cobertura contra a FONTE REAL das máscaras (o mesmo JSON de deploy
   * de onde os modelos foram curados). Se alguém renomear/adicionar uma máscara,
   * este teste aponta exatamente qual ficou sem modelo padrão.
   */
  it('toda máscara do JSON de deploy resolve para um modelo padrão', () => {
    const semModelo: string[] = [];
    for (const m of MASKS as { area: string; name: string }[]) {
      if (!findStandardSchema(m.area, m.name)) semModelo.push(`${m.area} / ${m.name}`);
    }
    expect(semModelo, `máscaras sem modelo padrão:\n${semModelo.join('\n')}`).toEqual([]);
    expect((MASKS as unknown[]).length).toBe(71);
  });

  it('cada máscara resolve para o modelo do NOME dela (sem casamento cruzado)', () => {
    // pega regex ampla demais: 'PÉ' capturando 'PUNHO', 'QUADRIL' pediátrico
    // capturando o do MSK (áreas distintas), 'CISTO' capturando 'CORE BIOPSY'…
    const erros: string[] = [];
    for (const m of MASKS as { area: string; name: string }[]) {
      const got = findStandardSchema(m.area, m.name)?.name;
      if (got !== m.name) erros.push(`${m.area} / "${m.name}" → resolveu "${got}"`);
    }
    expect(erros, `casamento cruzado:\n${erros.join('\n')}`).toEqual([]);
  });

  it('todos os modelos das 4 áreas novas passam na validação de esquema', () => {
    for (const [area, defs] of ALL_AREAS) {
      for (const def of defs) {
        const errs = validateStructuredSchema(def.sections());
        expect(errs, `${area} / ${def.name}: ${errs.join(' | ')}`).toEqual([]);
      }
    }
  });

  it('nenhum id de campo se repete entre seções (o id é global no formulário)', () => {
    for (const [area, defs] of ALL_AREAS) {
      for (const def of defs) {
        const seen = new Map<string, string>();
        for (const sec of def.sections()) {
          for (const f of sec.fields) {
            expect(
              seen.has(f.id),
              `${area}/${def.name}: id "${f.id}" repetido em "${seen.get(f.id)}" e "${sec.label}"`
            ).toBe(false);
            seen.set(f.id, sec.label);
          }
        }
      }
    }
  });

  it('todo showIf aponta para um campo que existe na mesma seção', () => {
    // um showIf órfão esconde o campo para sempre, sem erro visível
    for (const [area, defs] of ALL_AREAS) {
      for (const def of defs) {
        for (const sec of def.sections()) {
          const ids = new Set(sec.fields.map((f) => f.id));
          for (const f of sec.fields) {
            if (!f.showIf) continue;
            expect(ids.has(f.showIf.field), `${area}/${def.name}/${sec.label}: showIf de "${f.id}" aponta para "${f.showIf.field}", que não existe`).toBe(true);
          }
        }
      }
    }
  });
});

describe('PEDIATRIA — modelos e derivações', () => {
  it('resolve as 6 máscaras pediátricas', () => {
    for (const n of ['TRANSFONTANELAR', 'COLUNA LOMBOSSACRA', 'ABDOME TOTAL PEDIÁTRICO', 'RINS E VIAS URINÁRIAS PEDIÁTRICO', 'QUADRIL PEDIÁTRICO (DDQ)', 'ESCROTO AGUDO PEDIÁTRICO']) {
      expect(findStandardSchema('pediatria', n)?.name, n).toBe(n);
    }
  });

  it('QUADRIL: α/β canônicos disparam o tipo de Graf por lado', () => {
    const s = deriveStructuredSchema(tpl('pediatria', 'QUADRIL PEDIÁTRICO (DDQ)'), 'pediatria');
    const d = computeDerivations(s, { alfa_d: '52', beta_e: '50', alfa_e: '65' });
    const gd = d.find((x) => x.id === 'graf_d');
    expect(gd?.sectionId).toBe('quadril-d');
    expect(gd?.alert).toBe(true); // α < 60 → displasia
    expect(d.find((x) => x.id === 'graf_e')?.alert).toBe(false);
  });

  it('ABDOME PEDIÁTRICO: piloro e apêndice com ids canônicos', () => {
    const s = deriveStructuredSchema(tpl('pediatria', 'ABDOME TOTAL PEDIÁTRICO'), 'pediatria');
    const d = computeDerivations(s, { piloro_musculo: '4', piloro_canal: '17', apendice_diam: '9' });
    const pil = d.find((x) => x.id === 'piloro__est');
    expect(pil?.sectionId).toBe('piloro');
    expect(pil?.alert).toBe(true);
    const ap = d.find((x) => x.id === 'apendice__diam');
    expect(ap?.sectionId).toBe('apendice');
    expect(ap?.alert).toBe(true);
  });

  it('TRANSFONTANELAR: átrio ventricular canônico + Papile no card Normal', () => {
    const s = findStandardSchema('pediatria', 'TRANSFONTANELAR')!.sections;
    const par = s.find((x) => x.id === 'parenquima')!;
    expect(par.fields.find((f) => f.id === 'hemorragia')?.alwaysShow).toBe(true);
    const vent = s.find((x) => x.id === 'sistema-ventricular')!;
    expect(vent.fields.find((f) => f.id === 'atrio_vent')?.alwaysShow).toBe(true);
    const d = computeDerivations(deriveStructuredSchema(tpl('pediatria', 'TRANSFONTANELAR'), 'pediatria'), { atrio_vent: '14' });
    expect(d.find((x) => x.id === 'atrio__vm')?.alert).toBe(true);
  });
});

describe('MSK — modelos', () => {
  it('resolve as 9 máscaras de MSK; MÃO E PUNHO não é capturada por PUNHO', () => {
    for (const n of ['OMBRO', 'COTOVELO', 'PUNHO', 'MÃO E PUNHO', 'JOELHO', 'QUADRIL', 'TORNOZELO', 'PÉ', 'MUSCULAR']) {
      expect(findStandardSchema('musculoesqueletico', n)?.name, n).toBe(n);
    }
  });

  it('os valores de referência repetem a tabela mestra do prompt da área', () => {
    // se o chip e o prompt divergirem, o formulário e o laudo brigam (ver ITB)
    const ombro = findStandardSchema('musculoesqueletico', 'OMBRO')!.sections;
    expect(ombro.find((x) => x.id === 'supraespinal')!.fields.find((f) => f.id === 'supra_esp')?.normal).toMatch(/5–7 mm/);
    expect(ombro.find((x) => x.id === 'bursa')!.fields.find((f) => f.id === 'bursa_esp')?.normal).toMatch(/< 2 mm/);
    const tornozelo = findStandardSchema('musculoesqueletico', 'TORNOZELO')!.sections;
    expect(tornozelo.find((x) => x.id === 'posterior')!.fields.find((f) => f.id === 'aquiles_esp')?.normal).toMatch(/4–6 mm/);
    const punho = findStandardSchema('musculoesqueletico', 'PUNHO')!.sections;
    expect(punho.find((x) => x.id === 'volar')!.fields.find((f) => f.id === 'csa_mediano')?.normal).toMatch(/≤ 9 mm²/);
    const pe = findStandardSchema('musculoesqueletico', 'PÉ')!.sections;
    expect(pe.find((x) => x.id === 'plantar')!.fields.find((f) => f.id === 'fascia_plantar')?.normal).toMatch(/≤ 4 mm/);
  });

  it('MUSCULAR: lesões graduadas em grupo aninhado (a graduação orienta o retorno)', () => {
    const s = findStandardSchema('musculoesqueletico', 'MUSCULAR')!.sections;
    const m = s.find((x) => x.id === 'musculos')!;
    expect(m.repeatGroup?.id).toBe('lesao');
    expect(m.repeatGroup?.fields.some((f) => f.id === 'grau')).toBe(true);
    expect(m.repeatGroup?.fields.find((f) => f.id === 'dims')?.calcId).toBe('volume-elipsoide');
  });

  it('JOELHO: cisto de Baker com volume condicional ao seu preenchimento', () => {
    const s = findStandardSchema('musculoesqueletico', 'JOELHO')!.sections;
    const post = s.find((x) => x.id === 'posterior')!;
    expect(post.fields.find((f) => f.id === 'baker')?.alwaysShow).toBe(true);
    expect(post.fields.find((f) => f.id === 'baker_dims')?.showIf?.field).toBe('baker');
  });
});

describe('REUMATOLÓGICO — modelos', () => {
  it('resolve as 3 máscaras; PDUS-28 não é capturada por ARTICULAÇÕES PERIFÉRICAS', () => {
    for (const n of ['ARTICULAÇÕES PERIFÉRICAS', 'SACROILÍACAS', 'ESCORE PDUS-28']) {
      expect(findStandardSchema('reumatologico', n)?.name, n).toBe(n);
    }
  });

  it('PDUS-28: articulações são grupo REPETÍVEL com GSUS e PDUS por item', () => {
    const s = findStandardSchema('reumatologico', 'ESCORE PDUS-28')!.sections;
    const art = s.find((x) => x.id === 'articulacoes')!;
    expect(art.repeatGroup?.fields.some((f) => f.id === 'gsus')).toBe(true);
    expect(art.repeatGroup?.fields.some((f) => f.id === 'pdus')).toBe(true);
    // as 28 articulações do protocolo estão na lista
    expect(art.repeatGroup?.fields.find((f) => f.id === 'articulacao')?.options?.length).toBe(28);
    const esc = s.find((x) => x.id === 'escore-combinado')!;
    expect(esc.fields.find((f) => f.id === 'n_ativas')?.alwaysShow).toBe(true);
  });
});

describe('PROCEDIMENTOS — modelos', () => {
  it('resolve as 10 máscaras de procedimentos', () => {
    for (const n of ['PAAF TIREOIDE', 'PAAF MAMA', 'PUNÇÃO/BIÓPSIA DE LINFONODO', 'PUNÇÃO/DRENAGEM DE CISTO', 'CORE BIOPSY', 'BIÓPSIA DE VILO CORIÔNICO', 'AMNIOCENTESE', 'DRENAGEM/PUNÇÃO DE COLEÇÃO', 'ACESSO VASCULAR', 'ESCLEROTERAPIA']) {
      expect(findStandardSchema('procedimentos', n)?.name, n).toBe(n);
    }
  });

  it('PAAF TIREOIDE herda o léxico TI-RADS e pontua ao vivo', () => {
    const s = deriveStructuredSchema(tpl('procedimentos', 'PAAF TIREOIDE'), 'procedimentos');
    const nod = s.sections.find((x) => x.id === 'nodulo-alvo')!;
    expect(nod.score).toBe('tirads');
    // nódulo sólido, muito hipoecoico, mais alto que largo, margem irregular,
    // focos puntiformes → TR5 (o mesmo cálculo da máscara de tireoide)
    const d = computeDerivations(s, {
      composicao: 'sólida', ecogenicidade: 'muito hipoecoico', forma: 'mais alto que largo',
      margem: 'lobulada/irregular', focos: 'focos puntiformes',
    });
    const tr = d.find((x) => x.id === 'nodulo-alvo__tr');
    expect(tr?.text).toMatch(/TR5/);
    expect(tr?.alert).toBe(true);
  });

  it('PAAF MAMA herda o léxico BI-RADS v2025 do US (microlobulada é margem)', () => {
    const s = findStandardSchema('procedimentos', 'PAAF MAMA')!.sections;
    const lesao = s.find((x) => x.id === 'lesao-alvo')!;
    expect(lesao.score).toBe('birads');
    expect(lesao.fields.find((f) => f.id === 'margem')?.options).toContain('microlobulada');
    expect(lesao.fields.find((f) => f.id === 'forma')?.options).toContain('lobulada');
  });

  it('procedimentos fetais herdam a datação canônica (DUM → IG/DPP auto)', () => {
    for (const n of ['BIÓPSIA DE VILO CORIÔNICO', 'AMNIOCENTESE']) {
      const s = deriveStructuredSchema(tpl('procedimentos', n), 'procedimentos');
      expect(s.sections.find((x) => x.id === 'datacao')!.fields.some((f) => f.id === 'dum'), n).toBe(true);
      const d = computeDerivations(s, { dum: '01/01/2026' });
      expect(d.find((x) => x.id === 'ig__ref'), n).toBeTruthy();
    }
  });

  it('todo procedimento registra indicação, técnica e intercorrências', () => {
    // é o mínimo médico-legal de um procedimento guiado
    for (const def of PROCEDIMENTOS_SCHEMAS) {
      const ids = def.sections().map((s) => s.id);
      expect(ids, def.name).toContain('indicacao');
      expect(ids.some((i) => i === 'tecnica'), `${def.name}: sem seção de técnica`).toBe(true);
    }
  });
});
