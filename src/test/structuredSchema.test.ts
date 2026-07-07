import { describe, it, expect } from 'vitest';
import {
  deriveStructuredSchema,
  parseMaskSections,
  summarizeStructured,
} from '../modules/editor/structured/deriveSchema';
import { normalKey, countKey, itemFieldId } from '../modules/editor/structured/structuredKeys';
import { ReportTemplate } from '../types';

/** Monta uma máscara com compartimentos (cada um vira um <p><strong>rótulo:</strong> …). */
function mask(area: string, name: string, compartments: string[]): ReportTemplate {
  const analysisTemplate = compartments
    .map((c) => `<p><strong>${c}:</strong> medindo [__] x [__] x [__] cm.</p>`)
    .join('');
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate, conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('deriveStructuredSchema — seções vêm da MÁSCARA (por exame)', () => {
  it('cada máscara gera suas próprias seções a partir dos compartimentos', () => {
    const echo = deriveStructuredSchema(
      mask('medicina-fetal', 'ECOCARDIOGRAMA FETAL', ['Situs', 'Corte de 4 Câmaras', 'Vias de Saída', 'Arcos Aórtico e Ductal']),
      'medicina-fetal'
    );
    expect(echo.sections.map((s) => s.label)).toEqual(['Situs', 'Corte de 4 Câmaras', 'Vias de Saída', 'Arcos Aórtico e Ductal']);
  });
});

describe('deriveStructuredSchema — enriquecimento por rótulo', () => {
  it('nódulo tireoidiano → repetível + escore TI-RADS', () => {
    const s = deriveStructuredSchema(mask('pequenas-partes', 'TIREOIDE', ['Lobo Direito', 'Achados Nodulares']), 'pequenas-partes');
    const lobo = s.sections.find((x) => x.label === 'Lobo Direito');
    expect(lobo?.fields.find((f) => f.id === 'lobo_d_dims')?.calcId).toBe('volume-elipsoide');
    const nod = s.sections.find((x) => x.label === 'Achados Nodulares');
    expect(nod?.repeatable).toBe(true);
    expect(nod?.score).toBe('tirads');
    expect(nod?.fields.find((f) => f.id === 'composicao')?.scoreKey).toBe('composition');
  });

  it('carótida direita → velocidades + NASCET (ids canônicos)', () => {
    const s = deriveStructuredSchema(mask('vascular', 'CARÓTIDAS', ['Sistema Carotídeo Direito', 'Artérias Vertebrais']), 'vascular');
    const car = s.sections.find((x) => x.label === 'Sistema Carotídeo Direito');
    expect(car?.fields.find((f) => f.id === 'vps_aci_d')).toBeTruthy();
    expect(car?.fields.find((f) => f.id === 'estenose_d')?.options).toContain('estenose ≥70%');
  });

  it('mama → lesões repetíveis BI-RADS; abdome fígado → normal/alterado', () => {
    const m = deriveStructuredSchema(mask('mastologia', 'MAMAS', ['Composição do Parênquima', 'Nódulos']), 'mastologia');
    expect(m.sections.find((x) => x.label === 'Nódulos')?.score).toBe('birads');
    const abd = deriveStructuredSchema(mask('medicina-interna', 'ABDOME', ['Fígado', 'Baço']), 'medicina-interna');
    expect(abd.sections.find((x) => x.label === 'Fígado')?.normalable).toBe(true);
  });

  it('ginecologia → útero (volume), formação anexial (O-RADS), endométrio', () => {
    const s = deriveStructuredSchema(mask('ginecologia', 'PÉLVICA', ['Útero', 'Endométrio', 'Formação Anexial']), 'ginecologia');
    expect(s.sections.find((x) => x.label === 'Útero')?.fields.find((f) => f.id === 'utero_dims')?.calcId).toBe('volume-elipsoide');
    expect(s.sections.find((x) => x.label === 'Formação Anexial')?.score).toBe('orads');
    expect(s.sections.find((x) => x.label === 'Endométrio')?.fields.find((f) => f.id === 'menopausa')).toBeTruthy();
  });

  it('fetal → biometria (DBP..CF + PFE) e Doppler por vaso (IP AU/ACM)', () => {
    const s = deriveStructuredSchema(mask('medicina-fetal', 'OBSTÉTRICA', ['Biometria Fetal', 'Artéria Umbilical', 'Artéria Cerebral Média']), 'medicina-fetal');
    const bio = s.sections.find((x) => x.label === 'Biometria Fetal');
    expect(bio?.fields.map((f) => f.id)).toEqual(expect.arrayContaining(['dbp', 'cc', 'ca', 'cf']));
    expect(s.sections.find((x) => x.label === 'Artéria Umbilical')?.fields.find((f) => f.id === 'ip_au')).toBeTruthy();
    expect(s.sections.find((x) => x.label === 'Artéria Cerebral Média')?.fields.find((f) => f.id === 'ip_acm')).toBeTruthy();
  });

  it('fetal por exame: ecocardio (situs/4câmaras), 1T (CCN/TN/osso nasal), neuro (ventrículo)', () => {
    const echo = deriveStructuredSchema(mask('medicina-fetal', 'ECOCARDIOGRAMA', ['Situs', 'Corte de 4 Câmaras', 'Função Ventricular']), 'medicina-fetal');
    // campos descritivos têm id prefixado pela seção → checa pelas opções
    expect(echo.sections.find((x) => x.label === 'Situs')?.fields.some((f) => f.options?.includes('inversus'))).toBe(true);
    expect(echo.sections.find((x) => x.label === 'Corte de 4 Câmaras')?.fields.some((f) => f.id.endsWith('quatro_camaras'))).toBe(true);

    const t1 = deriveStructuredSchema(mask('medicina-fetal', 'MORFOLÓGICA 1T', ['Comprimento Cabeça-Nádega', 'Translucência Nucal', 'Osso Nasal', 'Ducto Venoso']), 'medicina-fetal');
    expect(t1.sections.find((x) => x.label.includes('Cabeça-Nádega'))?.fields.find((f) => f.id === 'ccn')).toBeTruthy();
    expect(t1.sections.find((x) => x.label.includes('Nucal'))?.fields.find((f) => f.id === 'nt')?.unit).toBe('mm');
    expect(t1.sections.find((x) => x.label === 'Osso Nasal')?.fields.some((f) => f.options?.includes('ausente'))).toBe(true);

    const neuro = deriveStructuredSchema(mask('medicina-fetal', 'NEURO', ['Sistema Ventricular']), 'medicina-fetal');
    expect(neuro.sections[0].fields.find((f) => f.id.endsWith('atrio_vent'))?.hint).toMatch(/ventriculomegalia/);
  });

  it('dedup canônico: dois compartimentos de "Idade Gestacional" não colidem', () => {
    const s = deriveStructuredSchema(
      mask('medicina-fetal', 'OBSTÉTRICA', ['Idade Gestacional de Referência', 'Idade Gestacional Biométrica']),
      'medicina-fetal'
    );
    const withDum = s.sections.filter((x) => x.fields.some((f) => f.id === 'dum'));
    expect(withDum.length).toBe(1); // só o primeiro recebe os ids canônicos
  });

  it('compartimento sem enricher mantém campo genérico (fidelidade por máscara)', () => {
    const s = deriveStructuredSchema(mask('vascular', 'OFTÁLMICAS', ['Artéria Oftálmica Direita']), 'vascular');
    expect(s.sections.length).toBe(1);
    expect(s.sections[0].label).toBe('Artéria Oftálmica Direita');
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
    expect(sections[1].fields[0].kind).toBe('measure');
    expect(sections[2].fields[0].kind).toBe('text');
  });
});

describe('summarizeStructured — normal/alterado e repetível', () => {
  it('seção normalable normal compila "sem alterações"; alterada emite campos', () => {
    const s = deriveStructuredSchema(mask('medicina-interna', 'ABDOME', ['Baço']), 'medicina-interna');
    const baco = s.sections.find((x) => x.label === 'Baço')!;
    expect(baco.normalable).toBe(true);
    expect(summarizeStructured(s, {}).lines.join('\n')).toMatch(/Baço: sem alterações/);
    const alt = summarizeStructured(s, { [normalKey(baco.id)]: 'altered', baco_eixo: '14' });
    expect(alt.lines.join('\n')).toMatch(/14/);
  });

  it('seção repetível itera instâncias por índice', () => {
    const s = deriveStructuredSchema(mask('pequenas-partes', 'TIREOIDE', ['Achados Nodulares']), 'pequenas-partes');
    const nod = s.sections.find((x) => x.label === 'Achados Nodulares')!;
    const { lines, filledCount } = summarizeStructured(s, {
      [countKey(nod.id)]: '2',
      [itemFieldId(nod.id, 0, 'loc')]: 'lobo direito',
      [itemFieldId(nod.id, 1, 'loc')]: 'lobo esquerdo',
    });
    expect(lines.join('\n')).toMatch(/Nódulo 1:/);
    expect(lines.join('\n')).toMatch(/Nódulo 2:/);
    expect(filledCount).toBeGreaterThanOrEqual(2);
  });
});
