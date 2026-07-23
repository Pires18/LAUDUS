import { describe, it, expect } from 'vitest';
import { findStandardSchema } from '../modules/editor/structured/standardSchemas';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
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
import { validateStructuredSchema } from '../modules/editor/structured/schemaEditing';
import { sectionRepeatContainers } from '../modules/editor/structured/containers';
import { CALCULATORS } from '../modules/calculators/registry';
import { calculatorsForArea } from '../modules/editor/structured/calcMap';
import { seedForCalculator } from '../modules/editor/structured/calcSeed';
import { StructuredFieldDef, StructuredSection } from '../types';
import MASKS from '../../scripts/laudia-deploy-unified.REFINED.json';

/**
 * AUDITORIA FINAL DO SISTEMA ESTRUTURADO — as 10 áreas, as 71 máscaras.
 *
 * Invariantes que, se quebrados, NÃO produzem erro visível: o médico só vê um
 * botão que não abre nada, um campo que nunca aparece, um percentil de curva
 * errada, ou dois campos gravando no mesmo valor. Por isso ficam travados aqui.
 */

const ALL: [string, StandardSchemaDef[]][] = [
  ['medicina-interna', MEDICINA_INTERNA_SCHEMAS],
  ['pequenas-partes', PEQUENAS_PARTES_SCHEMAS],
  ['ginecologia', GINECOLOGIA_SCHEMAS],
  ['mastologia', MASTOLOGIA_SCHEMAS],
  ['medicina-fetal', MEDICINA_FETAL_SCHEMAS],
  ['vascular', VASCULAR_SCHEMAS],
  ['pediatria', PEDIATRIA_SCHEMAS],
  ['musculoesqueletico', MUSCULOESQUELETICO_SCHEMAS],
  ['reumatologico', REUMATOLOGICO_SCHEMAS],
  ['procedimentos', PROCEDIMENTOS_SCHEMAS],
];

const CALC_IDS = new Set(CALCULATORS.map((c) => c.id));

/** Todos os campos de um modelo: fixos + os de cada container repetível. */
function allFields(sections: StructuredSection[]): { field: StructuredFieldDef; section: StructuredSection }[] {
  const out: { field: StructuredFieldDef; section: StructuredSection }[] = [];
  for (const s of sections) {
    for (const f of s.fields) out.push({ field: f, section: s });
    for (const c of sectionRepeatContainers(s)) {
      for (const f of c.fields) out.push({ field: f, section: s });
    }
  }
  return out;
}

/** Percorre (área, modelo, seções) de tudo que existe. */
function forEachSchema(fn: (area: string, def: StandardSchemaDef, sections: StructuredSection[]) => void) {
  for (const [area, defs] of ALL) for (const def of defs) fn(area, def, def.sections());
}

describe('AUDITORIA — cobertura das máscaras', () => {
  it('as 71 máscaras do JSON de deploy resolvem, cada uma para o modelo do seu nome', () => {
    const erros: string[] = [];
    for (const m of MASKS as { area: string; name: string }[]) {
      const got = findStandardSchema(m.area, m.name)?.name;
      if (!got) erros.push(`SEM MODELO: ${m.area} / ${m.name}`);
      else if (got !== m.name) erros.push(`CRUZADO: ${m.area} / "${m.name}" → "${got}"`);
    }
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
    expect((MASKS as unknown[]).length).toBe(71);
  });

  it('as 10 áreas do sistema têm biblioteca de modelos', () => {
    const areasDasMascaras = new Set((MASKS as { area: string }[]).map((m) => m.area));
    const areasComModelo = new Set(ALL.map(([a]) => a));
    for (const a of areasDasMascaras) expect(areasComModelo.has(a), `área "${a}" sem biblioteca`).toBe(true);
    expect(areasDasMascaras.size).toBe(10);
  });
});

describe('AUDITORIA — integridade dos esquemas', () => {
  it('todo modelo passa na validação de esquema', () => {
    forEachSchema((area, def, sections) => {
      const errs = validateStructuredSchema(sections);
      expect(errs, `${area}/${def.name}: ${errs.join(' | ')}`).toEqual([]);
    });
  });

  it('nenhum id de campo se repete entre seções — o id é GLOBAL no formulário', () => {
    // dois campos com o mesmo id em seções diferentes gravam no MESMO valor;
    // dentro de um container repetível o id é escopado por instância, então
    // a checagem é entre campos FIXOS de seções distintas.
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      const seen = new Map<string, string>();
      for (const s of sections) {
        for (const f of s.fields) {
          if (seen.has(f.id)) erros.push(`${area}/${def.name}: "${f.id}" em "${seen.get(f.id)}" e "${s.label}"`);
          seen.set(f.id, s.label);
        }
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('todo showIf aponta para um campo existente no mesmo escopo', () => {
    // showIf órfão = campo que nunca aparece, sem erro visível
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const s of sections) {
        const fixos = new Set(s.fields.map((f) => f.id));
        for (const f of s.fields) {
          if (f.showIf && !fixos.has(f.showIf.field)) erros.push(`${area}/${def.name}/${s.label}: "${f.id}".showIf → "${f.showIf.field}" inexistente`);
        }
        for (const c of sectionRepeatContainers(s)) {
          const doItem = new Set(c.fields.map((f) => f.id));
          for (const f of c.fields) {
            if (f.showIf && !doItem.has(f.showIf.field)) erros.push(`${area}/${def.name}/${s.label}[${c.itemLabel}]: "${f.id}".showIf → "${f.showIf.field}" inexistente`);
          }
        }
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('todo showIf compara com um valor que a opção realmente oferece', () => {
    // showIf com `equals` fora das options = campo morto (nunca aparece).
    // `equals` ausente é intencional: significa "aparece quando o alvo tiver
    // QUALQUER valor" (StructuredTab: `equals != null ? cur === equals : !!cur`).
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      const check = (fields: StructuredFieldDef[], escopo: string) => {
        for (const f of fields) {
          if (f.showIf?.equals == null) continue;
          const alvo = fields.find((x) => x.id === f.showIf!.field);
          if (!alvo?.options) continue; // alvo textual: qualquer valor é possível
          if (!alvo.options.includes(f.showIf.equals)) {
            erros.push(`${area}/${def.name}/${escopo}: "${f.id}" só aparece se "${alvo.id}" = "${f.showIf.equals}", que não é opção dele`);
          }
        }
      };
      for (const s of sections) {
        check(s.fields, s.label);
        for (const c of sectionRepeatContainers(s)) check(c.fields, `${s.label}[${c.itemLabel}]`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('toda seção com toggle Normal declara o texto de normalidade', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const s of sections) {
        if (s.normalable && !s.normalText?.trim()) erros.push(`${area}/${def.name}: seção "${s.label}" normalable sem normalText`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('todo select/multiselect oferece opções', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const { field: f, section: s } of allFields(sections)) {
        if ((f.kind === 'select' || f.kind === 'multiselect') && !f.options?.length) {
          erros.push(`${area}/${def.name}/${s.label}: "${f.id}" é ${f.kind} sem options`);
        }
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('todo campo tem id e rótulo não vazios', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const { field: f, section: s } of allFields(sections)) {
        if (!f.id?.trim()) erros.push(`${area}/${def.name}/${s.label}: campo sem id`);
        if (!f.label?.trim()) erros.push(`${area}/${def.name}/${s.label}: "${f.id}" sem rótulo`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });
});

describe('AUDITORIA — calculadoras integradas', () => {
  it('todo calcId dos modelos existe no registry (botão que abre de verdade)', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const s of sections) {
        if (s.calcId && !CALC_IDS.has(s.calcId)) erros.push(`${area}/${def.name}: seção "${s.label}" → calcId inexistente "${s.calcId}"`);
      }
      for (const { field: f, section: s } of allFields(sections)) {
        if (f.calcId && !CALC_IDS.has(f.calcId)) erros.push(`${area}/${def.name}/${s.label}: "${f.id}" → calcId inexistente "${f.calcId}"`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('toda calculadora usada por uma área DECLARA aquela área', () => {
    // se não declarar, ela some da lista de calculadoras daquele exame —
    // o atalho do campo abre, mas o médico não a encontra pelo menu
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      const ids = new Set(calculatorsForArea(area).map((c) => c.id));
      const usa = new Set<string>();
      for (const s of sections) if (s.calcId) usa.add(s.calcId);
      for (const { field: f } of allFields(sections)) if (f.calcId) usa.add(f.calcId);
      for (const c of usa) {
        if (!ids.has(c)) erros.push(`${area}/${def.name}: usa "${c}", que não declara areas:['${area}']`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('campo kind:"calc" sempre aponta para uma calculadora', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const { field: f, section: s } of allFields(sections)) {
        if (f.kind === 'calc' && !f.calcId) erros.push(`${area}/${def.name}/${s.label}: "${f.id}" é kind:'calc' sem calcId`);
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('toda calculadora do registry é alcançável — por campo ou pela lista da área', () => {
    const porCampo = new Set<string>();
    forEachSchema((_area, _def, sections) => {
      for (const s of sections) if (s.calcId) porCampo.add(s.calcId);
      for (const { field: f } of allFields(sections)) if (f.calcId) porCampo.add(f.calcId);
    });
    const orfas = CALCULATORS.filter((c) => !porCampo.has(c.id) && c.areas.length === 0);
    expect(orfas.map((c) => c.id), 'calculadora sem área e sem campo: inalcançável').toEqual([]);

    // as que não têm âncora em campo são ferramentas de consulta avulsa —
    // continuam acessíveis pelo menu de calculadoras da área
    const semCampo = CALCULATORS.filter((c) => !porCampo.has(c.id)).map((c) => c.id).sort();
    // fmf-preeclampsia-risk-2t: calculadora de 2ª visita EM VALIDAÇÃO, disponível
    // como ferramenta avulsa do menu de medicina fetal (não ancorada a campo, pois
    // o risco quantitativo de 2º T ainda não entra em laudo automaticamente).
    expect(semCampo).toEqual(['fmf-preeclampsia-risk-2t', 'liver-elastography', 'organ-refs', 'pleural-effusion']);
  });

  it('os escores com calculadora dedicada estão vinculados ao campo de categoria', () => {
    // TI-RADS, BI-RADS, O-RADS e FIGO têm calculadora própria: o campo de
    // categoria precisa abri-la (e receber o resultado de volta)
    const casos: [string, string, string, string][] = [
      ['pequenas-partes', 'TIREOIDE', 'tirads_cat', 'tirads-2017'],
      ['mastologia', 'MAMAS E AXILAS', 'birads', 'birads-us-2013'],
      ['ginecologia', 'PÉLVICA TRANSVAGINAL', 'orads', 'orads-us-2022'],
      ['procedimentos', 'PAAF TIREOIDE', 'tirads_cat', 'tirads-2017'],
      ['procedimentos', 'PAAF MAMA', 'birads', 'birads-us-2013'],
    ];
    for (const [area, exame, fieldId, calcId] of casos) {
      const sections = findStandardSchema(area, exame)!.sections;
      const f = allFields(sections).find((x) => x.field.id === fieldId)?.field;
      expect(f, `${area}/${exame}: campo "${fieldId}" não existe`).toBeTruthy();
      expect(f!.calcId, `${area}/${exame}/${fieldId}`).toBe(calcId);
    }
  });

  it('toda calculadora com semente recebe dados do formulário do exame certo', () => {
    // a semente evita redigitação; se o calcId não bater, ela silenciosamente
    // não preenche nada (o médico só vê a calculadora vazia)
    const comSeed = ['gestational-age', 'who-fetal-biometry', 'amniotic-fluid', 'msd-dmsg', 'fmf-trisomy-risk', 'fmf-preeclampsia-risk'];
    for (const id of comSeed) {
      expect(CALC_IDS.has(id), `semente para calcId inexistente: ${id}`).toBe(true);
      expect(seedForCalculator(id, { ccn: '65' }), id).not.toBeNull();
    }
    // calcId desconhecido não explode
    expect(seedForCalculator('nao-existe', { ccn: '65' })).toBeNull();
  });

  it('o parser (fallback) também só vincula calcIds que existem', () => {
    // máscaras conhecidas resolvem pelo modelo padrão; o parser+fieldLibrary só
    // roda para nomes novos/desconhecidos. Um calcId órfão na fieldLibrary
    // passaria despercebido por não estar em nenhum modelo — então exercito o
    // parser com seções que casam os enrichers e confiro os calcIds derivados.
    const mask = (area: string, name: string, comps: string[]) =>
      ({ id: 't', area, name, title: '', technique: '',
         analysisTemplate: comps.map((c) => `<p><strong>${c}:</strong> normal.</p>`).join(''),
         conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never);
    const parserCases: [string, string[]][] = [
      ['medicina-interna', ['Próstata', 'Bexiga', 'Rim Direito', 'Aorta', 'Fígado']],
      ['vascular', ['Carótidas Direita', 'Índice Tornozelo-Braquial (ITB)', 'Artéria Renal Direita']],
      ['pediatria', ['Quadril Direito', 'Piloro', 'Apêndice']],
      ['medicina-fetal', ['Datação', 'Biometria', 'Líquido Amniótico']],
    ];
    for (const [area, comps] of parserCases) {
      const s = deriveStructuredSchema(mask(area, `PARSER ${area} ${comps.length}`, comps), area);
      for (const { field: f, section: sec } of allFields(s.sections)) {
        if (f.calcId) expect(CALC_IDS.has(f.calcId), `parser ${area}/${sec.label}: calcId "${f.calcId}" órfão`).toBe(true);
      }
    }
  });
});

describe('AUDITORIA — ids canônicos que o motor lê', () => {
  /**
   * `liveCompute` lê estes ids DIRETO do mapa de valores (`v['vps_aci_d']`).
   * Um modelo que os renomeie silencia o chip; um modelo que os reutilize fora
   * do órgão certo emite um chip com o rótulo errado.
   */
  const CANONICOS: [string, string, string][] = [
    // id, área, exame onde ele DEVE existir
    ['vps_aci_d', 'vascular', 'CARÓTIDAS E VERTEBRAIS'],
    ['vdf_aci_d', 'vascular', 'CARÓTIDAS E VERTEBRAIS'],
    ['vps_acc_d', 'vascular', 'CARÓTIDAS E VERTEBRAIS'],
    ['emi_d', 'vascular', 'CARÓTIDAS E VERTEBRAIS'],
    ['itb_d', 'vascular', 'ARTERIAL MEMBRO INFERIOR'],
    ['itb_e', 'vascular', 'ARTERIAL MEMBRO INFERIOR'],
    ['vps_renal_d', 'vascular', 'ARTÉRIAS RENAIS'],
    ['vps_aorta', 'vascular', 'ARTÉRIAS RENAIS'],
    ['ir_d', 'vascular', 'ARTÉRIAS RENAIS'],
    ['alfa_d', 'pediatria', 'QUADRIL PEDIÁTRICO (DDQ)'],
    ['beta_e', 'pediatria', 'QUADRIL PEDIÁTRICO (DDQ)'],
    ['piloro_musculo', 'pediatria', 'ABDOME TOTAL PEDIÁTRICO'],
    ['apendice_diam', 'pediatria', 'ABDOME TOTAL PEDIÁTRICO'],
    ['atrio_vent', 'pediatria', 'TRANSFONTANELAR'],
    ['dum', 'medicina-fetal', 'OBSTÉTRICA ABDOMINAL'],
    ['dbp', 'medicina-fetal', 'MORFOLÓGICO DE SEGUNDO TRIMESTRE'],
    ['dum', 'procedimentos', 'AMNIOCENTESE'],
  ];

  it('os ids canônicos existem nos exames que o motor espera', () => {
    for (const [id, area, exame] of CANONICOS) {
      const sections = findStandardSchema(area, exame)!.sections;
      const achou = allFields(sections).some((x) => x.field.id === id);
      expect(achou, `${area}/${exame}: id canônico "${id}" sumiu`).toBe(true);
    }
  });

  it('ir_d/ir_e são RESERVADOS ao rim — o chip deles diz "IR intraparenq."', () => {
    // usá-los em carótidas/oftálmicas emitiria um chip com rótulo renal
    const proibido = ['CARÓTIDAS E VERTEBRAIS', 'ARTÉRIAS OFTÁLMICAS', 'ARTERIAL MEMBRO INFERIOR', 'VENOSO MEMBRO INFERIOR'];
    for (const exame of proibido) {
      const sections = findStandardSchema('vascular', exame)!.sections;
      for (const id of ['ir_d', 'ir_e', 'ir']) {
        expect(allFields(sections).some((x) => x.field.id === id), `${exame} usa "${id}", reservado ao rim`).toBe(false);
      }
    }
    // no exame renal (e no pediátrico) eles são o certo
    expect(allFields(findStandardSchema('vascular', 'ARTÉRIAS RENAIS')!.sections).some((x) => x.field.id === 'ir_d')).toBe(true);
  });

  it('as medidas que disparam cálculo ficam visíveis no card Normal', () => {
    // sem alwaysShow, a medida some quando a seção está 'Normal' e o cálculo
    // nunca acontece — que é justamente quando se lauda o valor normal
    const casos: [string, string, string][] = [
      ['vascular', 'CARÓTIDAS E VERTEBRAIS', 'vps_aci_d'],
      ['vascular', 'ARTERIAL MEMBRO INFERIOR', 'itb_d'],
      ['vascular', 'ARTÉRIAS RENAIS', 'vps_aorta'],
      ['vascular', 'ARTÉRIAS RENAIS', 'vps_renal_d'],
      ['pediatria', 'QUADRIL PEDIÁTRICO (DDQ)', 'alfa_d'],
      ['pediatria', 'ABDOME TOTAL PEDIÁTRICO', 'piloro_musculo'],
      ['pediatria', 'TRANSFONTANELAR', 'atrio_vent'],
    ];
    for (const [area, exame, id] of casos) {
      const f = allFields(findStandardSchema(area, exame)!.sections).find((x) => x.field.id === id);
      expect(f?.field.alwaysShow, `${area}/${exame}: "${id}" não aparece no card Normal`).toBe(true);
    }
  });
});

describe('AUDITORIA — valores de referência', () => {
  it('todo chip `normal` é texto útil (não vazio, não placeholder)', () => {
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const { field: f, section: s } of allFields(sections)) {
        if (f.normal === undefined) continue;
        if (!f.normal.trim() || f.normal.trim() === '-' || /^\.\.\.$/.test(f.normal)) {
          erros.push(`${area}/${def.name}/${s.label}: "${f.id}" tem normal vazio/placeholder`);
        }
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('MSK: os chips repetem a Tabela Mestra do prompt da área', () => {
    // mesma classe de bug do ITB: o mesmo limiar clínico em dois lugares,
    // divergindo em silêncio entre o formulário e o laudo gerado pela IA
    const casos: [string, string, RegExp][] = [
      ['OMBRO', 'supra_esp', /5–7 mm/],
      ['OMBRO', 'bursa_esp', /< 2 mm/],
      ['OMBRO', 'espaco_subacromial', /≥ 7 mm/],
      ['OMBRO', 'biceps_esp', /4–6 mm/],
      ['COTOVELO', 'csa_ulnar', /≤ 8 mm²/],
      ['PUNHO', 'csa_mediano', /≤ 9 mm²/],
      ['MÃO E PUNHO', 'csa_mediano', /≤ 9 mm²/],
      ['JOELHO', 'quadricipital_esp', /5–7 mm/],
      ['JOELHO', 'patelar_esp', /3–5 mm/],
      ['TORNOZELO', 'aquiles_esp', /4–6 mm/],
      ['TORNOZELO', 'tibial_posterior_esp', /3–5 mm/],
      ['PÉ', 'fascia_plantar', /≤ 4 mm/],
      ['QUADRIL', 'derrame_colo', /< 3 mm/],
    ];
    for (const [exame, id, ref] of casos) {
      const f = allFields(findStandardSchema('musculoesqueletico', exame)!.sections).find((x) => x.field.id === id);
      expect(f, `MSK/${exame}: campo "${id}" não existe`).toBeTruthy();
      expect(f!.field.normal ?? '', `MSK/${exame}/${id}`).toMatch(ref);
    }
  });

  it('ITB: o chip do formulário concorda com a classificação do motor (ESC/AHA)', () => {
    const itb = allFields(findStandardSchema('vascular', 'ARTERIAL MEMBRO INFERIOR')!.sections)
      .find((x) => x.field.id === 'itb_d')!.field;
    expect(itb.normal).toBe('1,00–1,40');
    expect(itb.normal).not.toMatch(/0,9/); // os cortes antigos não podem voltar
  });
});

describe('AUDITORIA — limiares clínicos: motor × prompt da IA', () => {
  /**
   * Cada limiar abaixo vive em DOIS lugares: no motor (chip do formulário) e na
   * tabela de referência do prompt (o que a IA escreve no laudo). Quando eles
   * divergem, o médico vê um alerta e lê um laudo que o contradiz — sem que nada
   * quebre. Foi o que aconteceu com o ITB, com o piloro e com o endométrio.
   * As fronteiras ficam travadas aqui, do lado do motor.
   */
  const tplPed = { id: 't', area: 'pediatria', name: 'ABDOME TOTAL PEDIÁTRICO', title: '', technique: '', analysisTemplate: '<p><strong>X:</strong> y.</p>', conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never;
  const tplGyn = { id: 't', area: 'ginecologia', name: 'PÉLVICA TRANSVAGINAL', title: '', technique: '', analysisTemplate: '<p><strong>X:</strong> y.</p>', conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never;

  it('PILORO (EHP): exige AMBOS — músculo ≥ 4 mm E canal ≥ 17 mm (casado com o prompt)', () => {
    const s = deriveStructuredSchema(tplPed, 'pediatria');
    const chip = (val: Record<string, string>) => computeDerivations(s, val).find((x) => x.id === 'piloro__est');
    // EHP plena = os DOIS critérios (o prompt afirma "EHP = AMBOS")
    const full = chip({ piloro_musculo: '4', piloro_canal: '17' });
    expect(full?.text).toContain('estenose hipertrófica');
    expect(full?.alert).toBe(true);
    // um só no limiar → parcial: alerta para medir o outro, NÃO afirma EHP
    const soMusculo = chip({ piloro_musculo: '4' });
    expect(soMusculo?.alert, 'músculo 4 mm isolado alerta').toBe(true);
    expect(soMusculo?.text).toMatch(/limiar/);
    expect(soMusculo?.text).not.toContain('estenose hipertrófica');
    const soCanal = chip({ piloro_canal: '17' });
    expect(soCanal?.text).toMatch(/limiar/);
    // fronteiras exatas: 3,9/16 ainda é normal (ambos abaixo)
    expect(chip({ piloro_musculo: '3,9', piloro_canal: '16' })?.alert, '3,9/16').toBe(false);
    expect(chip({ piloro_musculo: '3,9' })?.alert).toBe(false);
  });

  it('APÊNDICE: > 6 mm — o corte não mudou', () => {
    const s = deriveStructuredSchema(tplPed, 'pediatria');
    const ap = (d: string) => computeDerivations(s, { apendice_diam: d }).find((x) => x.id === 'apendice__diam')?.alert;
    expect(ap('6')).toBe(false);
    expect(ap('6,5')).toBe(true);
  });

  it('ENDOMÉTRIO: o limiar depende da terapia hormonal (5 / 8 / 6 mm)', () => {
    const s = deriveStructuredSchema(tplGyn, 'ginecologia');
    const endo = (esp: string, meno: string) =>
      computeDerivations(s, { endometrio_esp: esp, menopausa: meno }).find((x) => x.id === 'endo__esp');

    // sem TH: ≤ 5 mm normal
    expect(endo('5', 'pós-menopausa sem TH')?.alert).toBe(false);
    expect(endo('5,5', 'pós-menopausa sem TH')?.alert).toBe(true);
    // TH cíclica tolera até 8 mm — 7 mm alertaria no corte de 5
    expect(endo('7', 'pós-menopausa com TH cíclica')?.alert).toBe(false);
    expect(endo('8,5', 'pós-menopausa com TH cíclica')?.alert).toBe(true);
    // TH contínua tolera até 6 mm
    expect(endo('6', 'pós-menopausa com TH contínua')?.alert).toBe(false);
    expect(endo('6,5', 'pós-menopausa com TH contínua')?.alert).toBe(true);
    // no menacme não há limiar único (varia com a fase do ciclo): só registra
    expect(endo('12', 'menacme')?.alert).toBe(false);
    expect(endo('12', 'menacme')?.text).toMatch(/12/);
    // exames antigos gravaram só 'pós-menopausa': cai no corte sem TH
    expect(endo('5,5', 'pós-menopausa')?.alert).toBe(true);
  });

  it('o chip do formulário declara o mesmo limiar que o motor usa', () => {
    const campo = (area: string, exame: string, id: string) =>
      allFields(findStandardSchema(area, exame)!.sections).find((x) => x.field.id === id)!.field;
    expect(campo('pediatria', 'ABDOME TOTAL PEDIÁTRICO', 'piloro_musculo').normal).toBe('< 4 mm');
    expect(campo('pediatria', 'ABDOME TOTAL PEDIÁTRICO', 'piloro_canal').normal).toBe('< 17 mm');
    expect(campo('ginecologia', 'PÉLVICA TRANSVAGINAL', 'endometrio_esp').normal).toMatch(/≤ 5 mm/);
    // o estado hormonal precisa oferecer as opções que o motor sabe distinguir
    const meno = campo('ginecologia', 'PÉLVICA TRANSVAGINAL', 'menopausa');
    expect(meno.options).toContain('pós-menopausa sem TH');
    expect(meno.options).toContain('pós-menopausa com TH cíclica');
    expect(meno.options).toContain('pós-menopausa com TH contínua');
  });

  it('valores da tabela do prompt que o modelo repete', () => {
    const campo = (area: string, exame: string, id: string) =>
      allFields(findStandardSchema(area, exame)!.sections).find((x) => x.field.id === id)!.field;
    // pediatria
    expect(campo('pediatria', 'TRANSFONTANELAR', 'ir_aca').normal).toBe('0,60–0,80');
    expect(campo('pediatria', 'COLUNA LOMBOSSACRA', 'cone_nivel').normal).toMatch(/L1–L2/);
    expect(campo('pediatria', 'COLUNA LOMBOSSACRA', 'filum_esp').normal).toBe('≤ 2 mm');
    expect(campo('pediatria', 'QUADRIL PEDIÁTRICO (DDQ)', 'alfa_d').normal).toBe('≥ 60°');
    expect(campo('pediatria', 'QUADRIL PEDIÁTRICO (DDQ)', 'cobertura_d').normal).toBe('> 50%');
    expect(campo('pediatria', 'RINS E VIAS URINÁRIAS PEDIÁTRICO', 'dap_d').normal).toMatch(/< 7 mm/);
    // vascular
    expect(campo('vascular', 'AORTO-ILÍACO', 'aorta').normal).toMatch(/< 2,5 cm/);
    expect(campo('vascular', 'AORTA TORÁCICA', 'raiz_calibre').normal).toMatch(/< 4,0 cm/);
    expect(campo('vascular', 'CARÓTIDAS E VERTEBRAIS', 'emi_d').normal).toBe('< 0,9 mm');
  });
});

describe('AUDITORIA — calculadoras multi-campo integradas ao card completo', () => {
  /**
   * Uma calculadora que produz uma ESTRUTURA (líquido amniótico pelos 4
   * quadrantes, Doppler multi-vaso) precisa ter essa estrutura inteira no card:
   * o médico mede tudo no formulário, o motor deriva ao vivo, e a calculadora
   * abre semeada com os mesmos valores. Senão o card e a calculadora divergem.
   */
  const tvDop = { id: 't', area: 'medicina-fetal', name: 'OBSTÉTRICA ABDOMINAL COM DOPPLER', title: '', technique: '', analysisTemplate: '<p><strong>X:</strong> y.</p>', conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never;

  it('LÍQUIDO AMNIÓTICO: os 4 quadrantes estão no card e o motor soma → classifica', () => {
    const sections = findStandardSchema('medicina-fetal', 'OBSTÉTRICA ABDOMINAL')!.sections;
    const la = sections.find((s) => s.id === 'liquido-amniotico')!;
    // 2º/3ºT: MBV é o método principal (sempre visível); avaliação subjetiva idem.
    for (const id of ['la_subjetivo', 'mbv']) {
      const f = la.fields.find((x) => x.id === id);
      expect(f, `LA: campo principal "${id}" ausente`).toBeTruthy();
      expect(f!.alwaysShow, `LA: "${id}" some no card`).toBe(true);
    }
    // ILA e os 4 quadrantes existem como OPCIONAIS (o motor soma quando preenchidos).
    for (const id of ['ila_q1', 'ila_q2', 'ila_q3', 'ila_q4', 'ila']) {
      expect(la.fields.find((x) => x.id === id), `LA: campo opcional "${id}" ausente`).toBeTruthy();
    }
    // 3+4+5+4 = 16 cm → volume normal, pela SOMA
    const s = deriveStructuredSchema(tvDop, 'medicina-fetal');
    const d = computeDerivations(s, { ila_q1: '3', ila_q2: '4', ila_q3: '5', ila_q4: '4' });
    const ila = d.find((x) => x.id === 'la__ila');
    expect(ila?.text).toMatch(/16,0 cm \(soma dos 4 quadrantes\) — volume normal/);
    expect(ila?.alert).toBe(false);
    // oligoâmnio pela soma (1+1+1+1 = 4 cm < 5)
    expect(computeDerivations(s, { ila_q1: '1', ila_q2: '1', ila_q3: '1', ila_q4: '1' }).find((x) => x.id === 'la__ila')?.alert).toBe(true);
    // sem quadrantes, cai no total manual. ILA 8–24 = normal (padrão clínico,
    // casado com o prompt de área); só > 24 é polidrâmnio.
    expect(computeDerivations(s, { ila: '22' }).find((x) => x.id === 'la__ila')?.text).toMatch(/22,0 cm — volume normal/);
    const poli = computeDerivations(s, { ila: '26' }).find((x) => x.id === 'la__ila');
    expect(poli?.text).toMatch(/polidrâmnio/);
    expect(poli?.alert).toBe(true);
  });

  it('MBV: classificação automática por bolsão único (mm)', () => {
    const s = deriveStructuredSchema(tvDop, 'medicina-fetal');
    const mbv = (d: string) => computeDerivations(s, { mbv: d }).find((x) => x.id === 'la__mbv');
    expect(mbv('15')?.alert).toBe(true); // < 20 oligoâmnio
    expect(mbv('50')?.text).toMatch(/50 mm — volume normal/);
    expect(mbv('90')?.alert).toBe(true); // > 80 polidrâmnio
  });

  it('SEMENTE amniotic-fluid: quadrantes cm→mm, método e bolsão do card', () => {
    const seed = seedForCalculator('amniotic-fluid', { ila_q1: '3', ila_q2: '4', ila_q3: '5', ila_q4: '4', mbv: '55' }) as Record<string, unknown>;
    expect(seed.method).toBe('ila');
    expect(seed.q1).toBe('30'); // 3 cm → 30 mm (a calculadora trabalha em mm)
    expect(seed.q4).toBe('40');
    // o MBV entra pelo array `pockets` que a calculadora lê (não por campo único)
    expect((seed.pockets as { depth: string }[])[0].depth).toBe('55');
    // só MBV → método do bolsão
    expect((seedForCalculator('amniotic-fluid', { mbv: '55' }) as Record<string, unknown>).method).toBe('mbv');
  });

  it('DOPPLER: os vasos e os inputs de estadiamento estão no card', () => {
    const dop = findStandardSchema('medicina-fetal', 'OBSTÉTRICA ABDOMINAL COM DOPPLER')!.sections.find((s) => s.id === 'doppler')!;
    // vasos que a calculadora usa + fluxo diastólico da AU (estadiamento)
    for (const id of ['ip_au', 'ip_acm', 'ip_uta', 'au_diastole']) {
      expect(dop.fields.some((f) => f.id === id), `Doppler: campo "${id}" ausente`).toBe(true);
    }
    // o percentil de cada vaso já é derivado ao vivo pelo motor
    const s = deriveStructuredSchema(tvDop, 'medicina-fetal');
    // a DUM só existe (showIf) com o método de datação 'DUM' — como na UI
    const d = computeDerivations(s, { ig_metodo: 'DUM', dum: '01/01/2026', ip_au: '2,5' });
    expect(d.some((x) => x.id === 'dop_ip_au'), 'IP AU sem percentil derivado').toBe(true);
  });

  it('SEMENTE doppler-fetal: vasos + IG do formulário + fluxo/onda mapeados', () => {
    const seed = seedForCalculator('doppler-fetal', {
      dum: '01/01/2026', ip_au: '1,2', ip_acm: '1,8', ip_uta: '0,9', ip_dv: '0,6',
      au_diastole: 'ausente', dv: 'reversa',
    }, new Date('2026-08-01').getTime()) as Record<string, unknown>;
    expect(seed.auPi).toBe('1.2');
    expect(seed.acmPi).toBe('1.8');
    // 'ausente'/'reversa' do card → códigos da calculadora
    expect(seed.auFlow).toBe('aedf');
    expect(seed.dvWave).toBe('rav');
    // a IG vem da datação do formulário (DUM 01/01 → exame 01/08 ≈ 30 sem)
    expect(Number(seed.gaWeeks)).toBeGreaterThan(28);
    expect(Number(seed.gaWeeks)).toBeLessThan(32);
  });
});

describe('AUDITORIA — sementes das demais calculadoras multi-campo', () => {
  const tvDop = { id: 't', area: 'medicina-fetal', name: 'OBSTÉTRICA ABDOMINAL COM DOPPLER', title: '', technique: '', analysisTemplate: '<p><strong>X:</strong> y.</p>', conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never;
  const tvMi = { id: 't', area: 'medicina-interna', name: 'ABDOME TOTAL', title: '', technique: '', analysisTemplate: '<p><strong>X:</strong> y.</p>', conclusionTemplate: '', recommendationsTemplate: '', createdAt: 0, updatedAt: 0 } as never;

  it('SEMENTE barcelona-fetal-growth: biometria + Doppler + IG, tudo do card', () => {
    const seed = seedForCalculator('barcelona-fetal-growth', {
      dbp: '84', cc: '295', ca: '274', cf: '59', sexo_fetal: 'feminino',
      dum: '01/01/2026', ip_au: '1,2', ip_acm: '1,8', au_diastole: 'reversa',
    }, new Date('2026-08-01').getTime()) as Record<string, unknown>;
    expect(seed.bpd).toBe('84');
    expect(seed.hc).toBe('295');
    expect(seed.sex).toBe('female');
    expect(seed.auPi).toBe('1.2');
    expect(seed.auFlow).toBe('redf'); // 'reversa' → REDF
    expect(Number(seed.gaWeeks)).toBeGreaterThan(28);
  });

  it('SEMENTE imt-elsa-br: EMI + idade + SEXO (a curva ELSA depende do sexo)', () => {
    const emi = findStandardSchema('vascular', 'CARÓTIDAS E VERTEBRAIS')!.sections.find((s) => s.id === 'emi')!;
    expect(emi.fields.some((f) => f.id === 'emi_sexo'), 'sexo ausente na seção EMI').toBe(true);
    const seed = seedForCalculator('imt-elsa-br', { emi_d: '0,8', emi_e: '1,1', emi_idade: '58', emi_sexo: 'feminino' }) as Record<string, unknown>;
    expect(seed.imtRight).toBe('0.8');
    expect(seed.imtLeft).toBe('1.1');
    expect(seed.age).toBe('58');
    expect(seed.sex).toBe('female');
    // sem sexo → a calculadora não chuta cego: cai em 'male' (default do componente)
    expect((seedForCalculator('imt-elsa-br', { emi_d: '0,8' }) as Record<string, unknown>).sex).toBe('male');
  });

  it('VCI: os diâmetros estão no card, o motor deriva a colapsabilidade e a semente passa', () => {
    const vasos = findStandardSchema('medicina-interna', 'ABDOME TOTAL')!.sections.find((s) => s.id === 'grandes-vasos')!;
    for (const id of ['vci_max', 'vci_min']) {
      expect(vasos.fields.some((f) => f.id === id), `VCI: campo "${id}" ausente`).toBe(true);
    }
    // 20 → 8 mm = (20-8)/20 = 60% (colapsa bem, sem alerta)
    const d = computeDerivations(deriveStructuredSchema(tvMi, 'medicina-interna'), { vci_max: '20', vci_min: '8' });
    const idx = d.find((x) => x.id === 'vci__idx');
    expect(idx?.text).toMatch(/60%/);
    expect(idx?.alert).toBe(false);
    // 22 → 18 mm = 18% (< 50%, congestão → alerta)
    expect(computeDerivations(deriveStructuredSchema(tvMi, 'medicina-interna'), { vci_max: '22', vci_min: '18' }).find((x) => x.id === 'vci__idx')?.alert).toBe(true);
    // semente
    const seed = seedForCalculator('ivc-index', { vci_max: '20', vci_min: '8' }) as Record<string, unknown>;
    expect(seed.maxDia).toBe('20');
    expect(seed.minDia).toBe('8');
  });

  it('cada calcId ancorado num campo que lê ids canônicos tem semente OU derivação inline', () => {
    // as calculadoras de escore/volume (tirads/birads/orads/figo/volume/prostate)
    // são cobertas pela derivação inline do motor a partir dos descritores do
    // card — não precisam de semente global (que é por calcId, não por campo).
    // As que leem ids fixos e não têm derivação inline PRECISAM de semente.
    const comSemente = new Set(['gestational-age', 'who-fetal-biometry', 'amniotic-fluid', 'doppler-fetal', 'barcelona-fetal-growth', 'imt-elsa-br', 'ivc-index', 'msd-dmsg', 'fmf-trisomy-risk', 'fmf-preeclampsia-risk']);
    for (const id of comSemente) {
      expect(seedForCalculator(id, { ccn: '65', emi_d: '0,8', vci_max: '20', vci_min: '8', dbp: '84' }), `${id}: semente vazia`).not.toBeNull();
    }
  });
});

describe('AUDITORIA — achados aninhados na estrutura (não como seção solta)', () => {
  it('lesão aninhada num órgão lateralizado não repete o seletor de lado', () => {
    // o lado é ESTRUTURAL (a seção do rim/testículo direito|esquerdo); um campo
    // `lado: direito|esquerdo` na lesão duplicaria a informação da própria seção.
    const erros: string[] = [];
    forEachSchema((area, def, sections) => {
      for (const s of sections) {
        const lateralizada = /-(direito|esquerdo)$/.test(s.id);
        if (!lateralizada) continue;
        for (const c of sectionRepeatContainers(s)) {
          for (const f of c.fields) {
            const soLados = f.options && f.options.every((o) => /^(direit|esquerd|bilateral|—)/i.test(o));
            if (/^lad/i.test(f.id) && soLados) {
              erros.push(`${area}/${def.name}/${s.label}[${c.itemLabel}]: "${f.id}" repete o lado da seção`);
            }
          }
        }
      }
    });
    expect(erros, `\n${erros.join('\n')}`).toEqual([]);
  });

  it('cistos renais vivem DENTRO do rim (nenhuma máscara tem seção solta de cistos)', () => {
    // regressão do ajuste "estruturas integradas dentro das estruturas"
    forEachSchema((area, def, sections) => {
      if (area !== 'medicina-interna') return;
      expect(sections.some((s) => s.id === 'cistos-renais'), `${def.name}: seção solta de cistos`).toBe(false);
    });
    // e todo rim dedicado carrega o grupo de cistos/lesões aninhado
    for (const exame of ['ABDOME TOTAL', 'RINS E VIAS URINÁRIAS', 'RINS E VIAS URINÁRIAS COM DOPPLER']) {
      const rim = findStandardSchema('medicina-interna', exame)!.sections.find((s) => s.id === 'rim-direito')!;
      expect(rim.repeatGroup?.fields.some((f) => f.id === 'polo'), exame).toBe(true);
    }
  });
});
