import { describe, it, expect } from 'vitest';
import { computeDerivations, derivationsToLines } from '../modules/editor/structured/liveCompute';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { ReportTemplate } from '../types';

function tpl(area: string, name: string): ReportTemplate {
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate: '', conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

describe('computeDerivations — cálculo em tempo real', () => {
  it('volume do elipsoide a partir de um triplet (tireoide lobo)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    const d = computeDerivations(schema, { lobo_d_dims: '4 x 1,5 x 1,2' });
    const vol = d.find((x) => x.id === 'lobo_d_dims__vol');
    // 4 * 1,5 * 1,2 * 0,523 = 3,7656 → 3,77
    expect(vol?.text).toBe('3,77 cm³');
    expect(vol?.sectionId).toBe('lobo-d');
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

  it('derivationsToLines formata para a instrução da IA', () => {
    const lines = derivationsToLines([{ id: 'x', sectionId: 's', label: 'RCP', text: '1,58' }]);
    expect(lines[0]).toBe('  - RCP: 1,58');
  });
});
