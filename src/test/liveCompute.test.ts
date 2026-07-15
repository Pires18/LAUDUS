import { describe, it, expect } from 'vitest';
import { computeDerivations, derivationsToLines } from '../modules/editor/structured/liveCompute';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { countKey, itemFieldId } from '../modules/editor/structured/structuredKeys';
import { ReportTemplate } from '../types';

function tpl(area: string, name: string, compartments: string[] = []): ReportTemplate {
  const analysisTemplate = compartments
    .map((c) => `<p><strong>${c}:</strong> medindo [__] x [__] x [__] cm.</p>`)
    .join('');
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate, conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('computeDerivations — cálculo em tempo real', () => {
  it('volume do elipsoide a partir de um triplet (tireoide lobo)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE', ['Lobo Direito']), 'pequenas-partes');
    const d = computeDerivations(schema, { lobo_d_dims: '4 x 1,5 x 1,2' });
    const vol = d.find((x) => x.id === 'lobo_d_dims__vol');
    // 4 * 1,5 * 1,2 * 0,523 = 3,7656 → 3,77
    expect(vol?.text).toBe('3,77 cm³');
  });

  it('RCP = IP ACM / IP AU, com alerta se < 1', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    const ok = computeDerivations(schema, { ip_acm: '1,45', ip_au: '0,92' });
    const rcp = ok.find((x) => x.id === 'rcp__calc');
    expect(rcp?.text).toContain('1,58');
    expect(rcp?.alert).toBeFalsy();

    const low = computeDerivations(schema, { ip_acm: '0,8', ip_au: '1,0' });
    expect(low.find((x) => x.id === 'rcp__calc')?.alert).toBe(true);
  });

  it('IG/DPP pela DUM', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    // DUM 01/01/2026, exame 15/04/2026 → ~14-15 semanas
    const d = computeDerivations(schema, { dum: '01/01/2026' }, new Date(2026, 3, 15).getTime());
    const ig = d.find((x) => x.id === 'ig__dum');
    expect(ig?.text).toMatch(/\d+s \d+d · DPP \d{2}\/\d{2}\/\d{4}/);
  });

  it('classificação do ILA (oligo/normal/poli) com alerta nos extremos', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    expect(computeDerivations(schema, { ila: '12' }).find((x) => x.id === 'la__ila')?.text).toContain('volume normal');
    expect(computeDerivations(schema, { ila: '3' }).find((x) => x.id === 'la__ila')?.alert).toBe(true);
  });

  it('próstata: volume + peso a partir das dimensões (cm)', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'PRÓSTATA VIA ABDOMINAL'), 'medicina-interna');
    const d = computeDerivations(schema, { prostata_dims: '4 x 3 x 3' });
    const vw = d.find((x) => x.id === 'prostata__vw');
    // 40*30*30*0,523/1000 = 18,828 cc; peso ×1,05 = 19,77 g
    expect(vw?.text).toContain('18,83 cc');
    expect(vw?.text).toContain('Peso');
  });

  it('índices Doppler (IR / S/D) no vascular genérico', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'ARTÉRIAS OFTÁLMICAS'), 'vascular');
    const d = computeDerivations(schema, { vps: '100', vdf: '25' });
    const idx = d.find((x) => x.id === 'doppler__idx');
    expect(idx?.text).toContain('IR 0,75');
    expect(idx?.text).toContain('S/D 4,00');
  });

  it('PFE de Hadlock (fetal) a partir de DBP/CC/CA/CF, com percentil quando há DUM', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    const semDum = computeDerivations(schema, { dbp: '75', cc: '285', ca: '270', cf: '54' });
    expect(semDum.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/\d+ g/);
    const comDum = computeDerivations(schema, { dbp: '75', cc: '285', ca: '270', cf: '54', dum: '01/09/2025' }, new Date(2026, 0, 15).getTime());
    expect(comDum.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/p\d+/);
  });

  it('conduta TI-RADS ciente do tamanho (PAAF/seguimento)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE', ['Achados Nodulares']), 'pequenas-partes');
    const nodId = schema.sections.find((s) => s.score === 'tirads')!.id;
    const d = computeDerivations(schema, {
      [countKey(nodId)]: '1',
      [itemFieldId(nodId, 0, 'dims')]: '2 x 1,5 x 1,5',
      [itemFieldId(nodId, 0, 'composicao')]: 'sólida',
      [itemFieldId(nodId, 0, 'ecogenicidade')]: 'muito hipoecoico',
      [itemFieldId(nodId, 0, 'forma')]: 'mais alto que largo',
      [itemFieldId(nodId, 0, 'margem')]: 'lisa',
    });
    expect(d.find((x) => x.id.includes('__tr'))?.text).toMatch(/PAAF indicada/);
  });

  it('TN aumentada e SOP (CFA ≥ 20)', () => {
    const fetal = deriveStructuredSchema(tpl('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');
    expect(computeDerivations(fetal, { nt: '4,0' }).find((x) => x.id === 'nt__marker')?.alert).toBe(true);
    const gyn = deriveStructuredSchema(tpl('ginecologia', 'PÉLVICA TRANSVAGINAL'), 'ginecologia');
    expect(computeDerivations(gyn, { ovd_afc: '24' }).find((x) => x.id === 'sop_direito')?.alert).toBe(true);
  });

  it('volume tireoidiano total (soma dos lobos)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const d = computeDerivations(schema, { lobo_d_dims: '4 x 1,5 x 1,2', lobo_e_dims: '4 x 1,5 x 1,2' });
    expect(d.find((x) => x.id === 'tireoide__voltotal')?.text).toMatch(/cm³/);
  });

  it('estenose carotídea derivada por lado', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const d = computeDerivations(schema, { vps_aci_d: '260', vdf_aci_d: '120', vps_acc_d: '80' });
    const s = d.find((x) => x.id === 'car_sten_d');
    expect(s?.text).toMatch(/≥ 70%/);
    expect(s?.alert).toBe(true);
  });

  it('percentil por biometria fetal quando há DUM', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    const d = computeDerivations(schema, { cc: '285', dum: '01/09/2025' }, new Date(2026, 0, 15).getTime());
    expect(d.find((x) => x.id === 'pct_cc')?.text).toMatch(/^p\d+$/);
  });

  it('densidade do PSA (próstata)', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'PRÓSTATA VIA ABDOMINAL'), 'medicina-interna');
    const d = computeDerivations(schema, { prostata_dims: '4 x 3 x 3', psa: '4' });
    expect(d.find((x) => x.id === 'psa__density')?.text).toMatch(/ng\/mL\/cc/);
  });

  it('Fase 2: esplenomegalia, VRPM, RAR, IR intrarrenal e endométrio pós-menopausa', () => {
    const abd = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    expect(computeDerivations(abd, { baco_eixo: '14' }).find((x) => x.id === 'baco__eixo')?.alert).toBe(true);

    const rim = deriveStructuredSchema(tpl('medicina-interna', 'RINS E VIAS URINÁRIAS'), 'medicina-interna');
    expect(computeDerivations(rim, { vrpm: '120' }).find((x) => x.id === 'vrpm__class')?.text).toMatch(/acentuado/);
    // RAR e IR intraparenquimatoso agora BILATERAIS (D e E)
    const bilat = computeDerivations(rim, { vps_renal_d: '400', vps_renal_e: '100', vps_aorta: '80', ir_e: '0,82' });
    expect(bilat.find((x) => x.id === 'rar_d')?.text).toMatch(/estenose ≥ 60%/);
    expect(bilat.find((x) => x.id === 'rar_e')?.alert).toBe(false);
    expect(bilat.find((x) => x.id === 'ri_intra_e')?.alert).toBe(true);

    const gyn = deriveStructuredSchema(tpl('ginecologia', 'PÉLVICA TRANSVAGINAL'), 'ginecologia');
    expect(computeDerivations(gyn, { endometrio_esp: '8', menopausa: 'pós-menopausa' }).find((x) => x.id === 'endo__esp')?.alert).toBe(true);
    expect(computeDerivations(gyn, { endometrio_esp: '8', menopausa: 'menacme' }).find((x) => x.id === 'endo__esp')?.alert).toBe(false);
  });

  it('enriquecimento: formação anexial vira repetível O-RADS (por compartimento da máscara)', () => {
    const gyn = deriveStructuredSchema(tpl('ginecologia', 'PÉLVICA', ['Formação Anexial']), 'ginecologia');
    const f = gyn.sections.find((s) => s.score === 'orads');
    expect(f?.repeatable).toBe(true);
  });

  it('Fase 3: discordância gemelar, percentis Doppler, piloro e apêndice (cálculo por id)', () => {
    const empty = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    // DUM ~28 semanas antes do exame (dentro da faixa Doppler 20–40 sem)
    expect(computeDerivations(empty, { ip_au: '1,2', dum: '01/07/2025' }, new Date(2026, 0, 15).getTime()).find((x) => x.id === 'dop_ip_au')?.text).toMatch(/^p\d+$/);
    expect(computeDerivations(empty, { pfe1: '2000', pfe2: '1400' }).find((x) => x.id === 'gemelar__disc')?.alert).toBe(true);
    const ped = deriveStructuredSchema(tpl('pediatria', 'ABDOME'), 'pediatria');
    expect(computeDerivations(ped, { piloro_musculo: '4' }).find((x) => x.id === 'piloro__est')?.alert).toBe(true);
    expect(computeDerivations(ped, { apendice_diam: '8' }).find((x) => x.id === 'apendice__diam')?.alert).toBe(true);
  });

  it('Fase 3+: DV percentil, RCP percentil e EFW por sexo (novas derivações fetais)', () => {
    const empty = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    const dateMs = new Date(2026, 0, 15).getTime();
    const dum = '01/07/2025'; // ~28 semanas em 15/01/2026 (dentro da faixa Doppler 20–40)
    // IP do ducto venoso por percentil (Hecher) — 0,9 @28 sem está acima do P95
    const dv = computeDerivations(empty, { ip_dv: '0,9', dum }, dateMs).find((x) => x.id === 'dv_ip__pct');
    expect(dv?.text).toMatch(/^p\d+$/);
    expect(dv?.alert).toBe(true);
    // RCP agora traz percentil quando há IG na faixa
    expect(computeDerivations(empty, { ip_acm: '1,8', ip_au: '1,0', dum }, dateMs).find((x) => x.id === 'rcp__calc')?.text).toMatch(/p\d+/);
    // EFW usa a curva por sexo quando informado (não quebra; produz peso + percentil)
    expect(computeDerivations(empty, { dbp: '75', cc: '270', ca: '250', cf: '55', dum, sexo_fetal: 'masculino' }, dateMs).find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/g/);
  });

  it('Fase 3: renais/oftálmicas — seções da máscara + RAR por id', () => {
    const renal = deriveStructuredSchema(tpl('vascular', 'ARTÉRIAS RENAIS', ['Artéria Renal Direita', 'Artéria Renal Esquerda', 'Rim Direito']), 'vascular');
    expect(renal.sections.find((s) => s.label === 'Artéria Renal Direita')?.fields.some((f) => f.id === 'vps_renal_d')).toBe(true);
    expect(renal.sections.find((s) => s.label === 'Artéria Renal Esquerda')?.fields.some((f) => f.id === 'vps_renal_e')).toBe(true);
    expect(computeDerivations(renal, { vps_renal_d: '400', vps_aorta: '80' }).find((x) => x.id === 'rar_d')?.text).toMatch(/estenose ≥ 60%/);
    const oft = deriveStructuredSchema(tpl('vascular', 'ARTÉRIAS OFTÁLMICAS', ['Artéria Oftálmica Direita']), 'vascular');
    expect(oft.sections.map((s) => s.label)).toContain('Artéria Oftálmica Direita');
  });

  it('derivationsToLines formata para a instrução da IA', () => {
    const lines = derivationsToLines([{ id: 'x', sectionId: 's', label: 'RCP', text: '1,58' }]);
    expect(lines[0]).toBe('  - RCP: 1,58');
  });
});
