import { describe, it, expect } from 'vitest';
import {
  deriveStructuredSchema,
  parseMaskSections,
  summarizeStructured,
} from '../modules/editor/structured/deriveSchema';
import { getAreaOverlay } from '../modules/editor/structured/areaOverlays';
import { ReportTemplate } from '../types';

function fakeTemplate(partial: Partial<ReportTemplate>): ReportTemplate {
  return {
    id: 't1',
    area: 'medicina-interna',
    name: 'Exame',
    title: 'EXAME',
    technique: '',
    analysisTemplate: '',
    conclusionTemplate: '',
    recommendationsTemplate: '',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  } as ReportTemplate;
}

describe('deriveStructuredSchema — overlay fetal', () => {
  it('usa o overlay curado para medicina-fetal', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-fetal' }), 'medicina-fetal');
    expect(schema.sections.length).toBeGreaterThan(0);
    const bio = schema.sections.find((s) => s.id === 'biometria');
    expect(bio).toBeTruthy();
    const pfe = bio!.fields.find((f) => f.id === 'pfe');
    expect(pfe?.kind).toBe('calc');
    expect(pfe?.calcId).toBe('who-fetal-biometry');
  });

  it('overlay fetal existe no registro de overlays', () => {
    expect(getAreaOverlay('medicina-fetal')).not.toBeNull();
    expect(getAreaOverlay('inexistente')).toBeNull();
  });
});

describe('deriveStructuredSchema — overlay vascular por exame', () => {
  it('CARÓTIDAS resolve overlay carotídeo com EMI (calc ELSA) e NASCET', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'vascular', name: 'CARÓTIDAS E VERTEBRAIS' }),
      'vascular'
    );
    const emi = schema.sections.find((s) => s.id === 'emi');
    expect(emi?.fields.find((f) => f.id === 'emi_d')?.calcId).toBe('imt-elsa-br');
    const carD = schema.sections.find((s) => s.id === 'carotida-d');
    expect(carD?.fields.find((f) => f.id === 'estenose_d')?.kind).toBe('select');
  });

  it('VENOSO resolve overlay venoso com compressibilidade/CEAP e cartografia', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'vascular', name: 'VENOSO MEMBRO INFERIOR' }),
      'vascular'
    );
    expect(schema.sections.find((s) => s.id === 'cartografia')?.calcId).toBe('venous-cartography');
    expect(schema.sections.find((s) => s.id === 'superficial-d')).toBeTruthy();
  });

  it('exame vascular desconhecido cai no overlay genérico (VPS/VDF + VCI)', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'vascular', name: 'ARTÉRIAS OFTÁLMICAS' }),
      'vascular'
    );
    expect(schema.sections.find((s) => s.id === 'doppler')?.calcId).toBe('vascular-ratios');
    expect(schema.sections.find((s) => s.id === 'volemia')?.calcId).toBe('ivc-index');
  });
});

describe('deriveStructuredSchema — overlays ginecologia e mastologia', () => {
  it('PÉLVICA resolve overlay padrão com útero (FIGO), O-RADS e volume ovariano', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'ginecologia', name: 'PÉLVICA TRANSVAGINAL' }),
      'ginecologia'
    );
    const utero = schema.sections.find((s) => s.id === 'utero');
    expect(utero?.fields.find((f) => f.id === 'mioma_figo')?.calcId).toBe('figo-myoma');
    const formacoes = schema.sections.find((s) => s.id === 'formacoes');
    expect(formacoes?.repeatable).toBe(true);
    expect(formacoes?.fields.find((f) => f.id === 'orads')?.options).toContain('O-RADS 4');
    expect(schema.sections.find((s) => s.id === 'ovario-d')?.fields[0].calcId).toBe('volume-elipsoide');
  });

  it('ENDOMETRIOSE resolve overlay dedicado com compartimentos', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'ginecologia', name: 'PÉLVICA — ENDOMETRIOSE' }),
      'ginecologia'
    );
    expect(schema.sections.find((s) => s.id === 'posterior')).toBeTruthy();
    expect(schema.sections.find((s) => s.id === 'parametrios')).toBeTruthy();
  });

  it('MAMAS resolve overlay com ACR e BI-RADS por mama', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'mastologia', name: 'MAMAS E AXILAS' }),
      'mastologia'
    );
    expect(schema.sections.find((s) => s.id === 'composicao')?.fields[0].options?.length).toBe(4);
    const lesoes = schema.sections.find((s) => s.id === 'lesoes');
    expect(lesoes?.repeatable).toBe(true);
    expect(lesoes?.fields.find((f) => f.id === 'birads')?.options).toContain('BI-RADS 4B');
  });

  it('LINFONODOS AXILARES resolve overlay de axilas', () => {
    const schema = deriveStructuredSchema(
      fakeTemplate({ area: 'mastologia', name: 'LINFONODOS AXILARES' }),
      'mastologia'
    );
    expect(schema.sections.map((s) => s.id)).toEqual(['axila-d', 'axila-e']);
  });
});

describe('deriveStructuredSchema — pequenas-partes e medicina-interna', () => {
  it('TIREOIDE resolve overlay com lobos (volume) e nódulo TI-RADS', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'pequenas-partes', name: 'TIREOIDE COM DOPPLER' }), 'pequenas-partes');
    expect(schema.sections.find((s) => s.id === 'lobo-d')?.fields[0].calcId).toBe('volume-elipsoide');
    const nodulos = schema.sections.find((s) => s.id === 'nodulos');
    expect(nodulos?.repeatable).toBe(true);
    expect(nodulos?.score).toBe('tirads');
    expect(nodulos?.fields.find((f) => f.id === 'composicao')?.scoreKey).toBe('composition');
  });

  it('BOLSA ESCROTAL resolve overlay de testículos com volume', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'pequenas-partes', name: 'BOLSA ESCROTAL COM DOPPLER' }), 'pequenas-partes');
    expect(schema.sections.find((s) => s.id === 'testiculo-d')?.fields[0].calcId).toBe('volume-elipsoide');
  });

  it('partes moles cai no genérico (lesão + volume)', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'pequenas-partes', name: 'PARTES MOLES' }), 'pequenas-partes');
    expect(schema.sections.find((s) => s.id === 'lesao')?.fields.find((f) => f.id === 'lesao_dims')?.calcId).toBe('volume-elipsoide');
  });

  it('PRÓSTATA resolve overlay com prostate-weight e VRPM', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-interna', name: 'PRÓSTATA VIA ABDOMINAL' }), 'medicina-interna');
    expect(schema.sections.find((s) => s.id === 'prostata')?.fields[0].calcId).toBe('prostate-weight');
    expect(schema.sections.find((s) => s.id === 'vrpm')).toBeTruthy();
  });

  it('ABDOME (default) resolve overlay com fígado/aorta/VCI e organ-refs', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-interna', name: 'ABDOME TOTAL' }), 'medicina-interna');
    expect(schema.sections.find((s) => s.id === 'figado')).toBeTruthy();
    expect(schema.sections.find((s) => s.id === 'referencias')?.fields[0].calcId).toBe('organ-refs');
  });

  it('RINS resolve overlay renal', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-interna', name: 'RINS E VIAS URINÁRIAS' }), 'medicina-interna');
    expect(schema.sections.map((s) => s.id)).toContain('rim-d');
    expect(schema.sections.map((s) => s.id)).toContain('rim-e');
  });
});

describe('deriveStructuredSchema — MSK e reumatológico', () => {
  it('MSK (qualquer articulação) resolve overlay genérico com integridade tendínea e volume de coleção', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'musculoesqueletico', name: 'OMBRO' }), 'musculoesqueletico');
    expect(schema.sections.find((s) => s.id === 'tendoes')?.fields.find((f) => f.id === 'tendao_estado')?.kind).toBe('select');
    const colecoes = schema.sections.find((s) => s.id === 'colecoes');
    expect(colecoes?.repeatable).toBe(true);
    expect(colecoes?.fields.find((f) => f.id === 'dims')?.calcId).toBe('volume-elipsoide');
  });

  it('reumato periféricas: articulações repetíveis com GSUS/PDUS 0–3', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'reumatologico', name: 'ARTICULAÇÕES PERIFÉRICAS' }), 'reumatologico');
    const art = schema.sections.find((s) => s.id === 'articulacoes');
    expect(art?.repeatable).toBe(true);
    expect(art?.fields.find((f) => f.id === 'gsus')?.options?.length).toBe(4);
    expect(art?.fields.find((f) => f.id === 'pdus')).toBeTruthy();
  });

  it('SACROILÍACAS e PDUS-28 resolvem overlays dedicados', () => {
    const si = deriveStructuredSchema(fakeTemplate({ area: 'reumatologico', name: 'SACROILÍACAS' }), 'reumatologico');
    expect(si.sections.map((s) => s.id)).toContain('si-d');
    const pdus = deriveStructuredSchema(fakeTemplate({ area: 'reumatologico', name: 'ESCORE PDUS-28' }), 'reumatologico');
    expect(pdus.sections.find((s) => s.id === 'gloess')).toBeTruthy();
  });
});

describe('deriveStructuredSchema — pediatria e procedimentos', () => {
  it('QUADRIL PEDIÁTRICO resolve overlay de Graf (ângulos + tipo)', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'pediatria', name: 'QUADRIL PEDIÁTRICO (DDQ)' }), 'pediatria');
    const qd = schema.sections.find((s) => s.id === 'quadril-d');
    expect(qd?.fields.find((f) => f.id === 'alfa_d')?.unit).toBe('°');
    expect(qd?.fields.find((f) => f.id === 'graf_d')?.options).toContain('IIc');
  });

  it('TRANSFONTANELAR e RINS PEDIÁTRICO resolvem overlays próprios', () => {
    const tf = deriveStructuredSchema(fakeTemplate({ area: 'pediatria', name: 'TRANSFONTANELAR' }), 'pediatria');
    expect(tf.sections.find((s) => s.id === 'ventriculos')).toBeTruthy();
    const rins = deriveStructuredSchema(fakeTemplate({ area: 'pediatria', name: 'RINS E VIAS URINÁRIAS PEDIÁTRICO' }), 'pediatria');
    expect(rins.sections.find((s) => s.id === 'rim-d')?.fields.find((f) => f.id === 'rim_d_dilat')?.options).toContain('SFU III');
  });

  it('PAAF TIREOIDE resolve overlay com TI-RADS + cauda (técnica/material/controle)', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'procedimentos', name: 'PAAF TIREOIDE' }), 'procedimentos');
    const alvo = schema.sections.find((s) => s.id === 'alvo');
    expect(alvo?.score).toBe('tirads');
    expect(alvo?.fields.find((f) => f.id === 'composicao')?.scoreKey).toBe('composition');
    expect(schema.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['tecnica', 'material', 'controle']));
  });

  it('procedimento genérico tem alvo com volume e cauda padrão', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'procedimentos', name: 'CORE BIOPSY' }), 'procedimentos');
    expect(schema.sections.find((s) => s.id === 'alvo')?.fields.find((f) => f.id === 'alvo_dims')?.calcId).toBe('volume-elipsoide');
  });

  it('AMNIOCENTESE resolve overlay obstétrico', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'procedimentos', name: 'AMNIOCENTESE' }), 'procedimentos');
    expect(schema.sections.find((s) => s.id === 'pre')?.fields.find((f) => f.id === 'vitalidade')).toBeTruthy();
  });
});

describe('parseMaskSections — parser genérico da máscara', () => {
  const analysis =
    '<p><strong>Fígado:</strong> Dimensões normais, medindo [__] x [__] x [__] cm.</p>' +
    '<p><strong>Vesícula Biliar:</strong> Paredes finas, medindo [__] mm.</p>' +
    '<p><strong>Baço:</strong> Homogêneo, sem alterações.</p>';

  it('cria uma seção por compartimento', () => {
    const sections = parseMaskSections(analysis);
    expect(sections.length).toBe(3);
    expect(sections.map((s) => s.label)).toEqual(['Fígado', 'Vesícula Biliar', 'Baço']);
  });

  it('detecta triplet, medida única e texto', () => {
    const sections = parseMaskSections(analysis);
    expect(sections[0].fields[0].kind).toBe('triplet');
    expect(sections[0].fields[0].unit).toBe('cm');
    expect(sections[1].fields[0].kind).toBe('measure');
    expect(sections[1].fields[0].unit).toBe('mm');
    expect(sections[2].fields[0].kind).toBe('text');
  });

  it('deriva do analysisTemplate quando a área não tem overlay', () => {
    // área desconhecida (sem overlay curado) → cai no parser genérico da máscara.
    const schema = deriveStructuredSchema(fakeTemplate({ analysisTemplate: analysis }), 'area-sem-overlay');
    expect(schema.sections.length).toBe(3);
  });
});

describe('summarizeStructured — compilação de valores', () => {
  it('ignora vazios e conta preenchidos', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-fetal' }), 'medicina-fetal');
    const { lines, filledCount } = summarizeStructured(schema, {
      dbp: '75',
      cf: '54',
      dof: '',
    });
    // ≥2 campos reais (morfologia normalable também conta como "sem alterações")
    expect(filledCount).toBeGreaterThanOrEqual(2);
    expect(lines.join('\n')).toMatch(/DBP: 75 mm/);
    expect(lines.join('\n')).toMatch(/CF: 54 mm/);
  });

  it('não duplica unidade já presente no valor', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-fetal' }), 'medicina-fetal');
    const { lines } = summarizeStructured(schema, { ila: '14,2 cm' });
    expect(lines.join('\n')).toMatch(/ILA: 14,2 cm/);
    expect(lines.join('\n')).not.toMatch(/cm cm/);
  });

  it('lê valores de objeto (calc) via .text', () => {
    const schema = deriveStructuredSchema(fakeTemplate({ area: 'medicina-fetal' }), 'medicina-fetal');
    const { lines, filledCount } = summarizeStructured(schema, {
      pfe: { text: '1888 g (P45)', calcId: 'who-fetal-biometry' },
    });
    expect(filledCount).toBeGreaterThanOrEqual(1);
    expect(lines.join('\n')).toMatch(/PFE \/ Percentil: 1888 g \(P45\)/);
  });
});
