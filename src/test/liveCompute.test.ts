import { describe, it, expect } from 'vitest';
import { computeDerivations, derivationsToLines } from '../modules/editor/structured/liveCompute';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { countKey, itemFieldId, groupContainerId, normalKey } from '../modules/editor/structured/structuredKeys';
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

  it('reumato: soma GSUS/PDUS e conta articulações com atividade (PD ≥ 1)', () => {
    const schema = deriveStructuredSchema(tpl('reumatologico', 'ESCORE PDUS-28'), 'reumatologico');
    const cid = groupContainerId('articulacoes', 'item');
    const v: Record<string, string> = {
      [normalKey('articulacoes')]: 'altered',
      [countKey(cid)]: '2',
      [itemFieldId(cid, 0, 'gsus')]: '2 (moderado)',
      [itemFieldId(cid, 0, 'pdus')]: '1 (leve)',
      [itemFieldId(cid, 1, 'gsus')]: '3 (acentuado)',
      [itemFieldId(cid, 1, 'pdus')]: '0 (ausente)',
    };
    const d = computeDerivations(schema, v);
    expect(d.find((x) => x.id === 'reuma__gsus')?.text).toBe('5 — 2 articulações'); // 2+3
    expect(d.find((x) => x.id === 'reuma__pdus')?.text).toBe('1');                   // 1+0
    const ativas = d.find((x) => x.id === 'reuma__ativas');
    expect(ativas?.text).toContain('1');                                             // só a 1ª tem PD≥1
    expect(ativas?.alert).toBe(true);
  });

  it('carótidas: EMI máx com chip inline ELSA (idade/sexo) e alerta se > p90', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    // ♂ 60 anos, p90 (55-64) = 1,03 → 1,10 = acentuado (> p90)
    const d = computeDerivations(schema, { emi_d: '0,9', emi_e: '1,1', emi_idade: '60', emi_sexo: 'masculino' });
    const emi = d.find((x) => x.id === 'emi__class');
    expect(emi?.text).toContain('1,10 mm (máx)');
    expect(emi?.text).toMatch(/acentuado|p90/i);
    expect(emi?.alert).toBe(true);
  });

  it('carótidas: EMI sem idade/sexo cai no limiar absoluto e pede dados p/ percentil', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const d = computeDerivations(schema, { emi_d: '0,7' });
    const emi = d.find((x) => x.id === 'emi__class');
    expect(emi?.text).toContain('normal (< 0,9 mm)');
    expect(emi?.text).toMatch(/idade\/sexo/);
    expect(emi?.alert).toBe(false);
  });

  it('abdome: colédoco pós-colecistectomia usa limiar ≤ 10 mm', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME SUPERIOR'), 'medicina-interna');
    // 8 mm com colecistectomia → limiar 10 → NÃO dilatado
    const d = computeDerivations(schema, { coledoco: '8', vesicula_achados: 'colecistectomizado' });
    expect(d.find((x) => x.id === 'coledoco__cal')?.text).not.toContain('dilatado');
    // 8 mm sem colecistectomia → limiar 6 → dilatado
    const d2 = computeDerivations(schema, { coledoco: '8' });
    expect(d2.find((x) => x.id === 'coledoco__cal')?.text).toContain('dilatado');
  });

  it('abdome: aorta ≥ 5,5 cm sinaliza aneurisma volumoso (R6)', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME SUPERIOR'), 'medicina-interna');
    const d = computeDerivations(schema, { aorta: '5,6' });
    const aorta = d.find((x) => x.id === 'aorta__cal');
    expect(aorta?.text).toMatch(/R6|urgente|volumoso/i);
    expect(aorta?.alert).toBe(true);
    // 2,7 cm → ectasia, sem alerta
    const d2 = computeDerivations(schema, { aorta: '2,7' });
    expect(d2.find((x) => x.id === 'aorta__cal')?.text).toContain('ectasia');
    expect(d2.find((x) => x.id === 'aorta__cal')?.alert).toBe(false);
  });

  it('vascular: raiz aórtica ≥ 5,5 cm → R6; 4,2 dilatada; 3,5 normal', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'AORTA TORÁCICA'), 'vascular');
    expect(computeDerivations(schema, { raiz_calibre: '5,6' }).find((x) => x.id === 'raiz__cal')?.alert).toBe(true);
    expect(computeDerivations(schema, { raiz_calibre: '4,2' }).find((x) => x.id === 'raiz__cal')?.text).toContain('dilatada');
    expect(computeDerivations(schema, { raiz_calibre: '3,5' }).find((x) => x.id === 'raiz__cal')?.text).toBe('3,5 cm');
  });

  it('vascular: refluxo superficial > 0,5 s é patológico', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'VENOSO MEMBRO INFERIOR'), 'vascular');
    const pat = computeDerivations(schema, { 'refluxo_tempo_vs-d': '0,8' }).find((x) => x.id === 'refluxo_vs_d');
    expect(pat?.text).toContain('patológico');
    expect(pat?.alert).toBe(true);
    const fis = computeDerivations(schema, { 'refluxo_tempo_vs-e': '0,3' }).find((x) => x.id === 'refluxo_vs_e');
    expect(fis?.text).toContain('fisiológico');
    expect(fis?.alert).toBe(false);
  });

  it('pequenas partes: testículo atrofia (< 12) e assimetria (> 20%)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'BOLSA ESCROTAL'), 'pequenas-partes');
    // D ~4x3x2,5 = 15,7 cm³ ; E ~3x2x1,5 = 4,7 cm³ → E atrófico + assimetria
    const d = computeDerivations(schema, { test_d_dims: '4 x 3 x 2,5', test_e_dims: '3 x 2 x 1,5' });
    const t = d.find((x) => x.id === 'test__vol');
    expect(t?.text).toMatch(/atrofia à E/);
    expect(t?.text).toMatch(/assimetria/);
    expect(t?.alert).toBe(true);
    // simétricos normais → sem alerta
    const d2 = computeDerivations(schema, { test_d_dims: '4 x 3 x 2,5', test_e_dims: '4 x 3 x 2,5' });
    expect(d2.find((x) => x.id === 'test__vol')?.alert).toBe(false);
  });

  it('pequenas partes: linfonodo córtex ≥ 3 mm ou hilo ausente = suspeito', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'CERVICAL'), 'pequenas-partes');
    expect(computeDerivations(schema, { linf_cortical: '4' }).find((x) => x.id === 'linf__susp')?.alert).toBe(true);
    expect(computeDerivations(schema, { linf_hilo: 'ausente/deslocado' }).find((x) => x.id === 'linf__susp')?.alert).toBe(true);
    expect(computeDerivations(schema, { linf_cortical: '2' }).find((x) => x.id === 'linf__susp')?.alert).toBe(false);
  });

  it('mastologia: linfonodo axilar suspeito por córtex ≥ 3 mm', () => {
    const schema = deriveStructuredSchema(tpl('mastologia', 'MAMAS E AXILAS'), 'mastologia');
    const cid = groupContainerId('axilas', 'item');
    const susp = computeDerivations(schema, {
      [normalKey('axilas')]: 'altered',
      [countKey(cid)]: '1',
      [itemFieldId(cid, 0, 'cortex')]: '4',
      [itemFieldId(cid, 0, 'nivel')]: 'I — axila baixa',
    }).find((x) => x.id.startsWith('linf_ax_'));
    expect(susp?.text).toContain('características suspeitas');
    expect(susp?.alert).toBe(true);
    // córtex ≤ 3 mm, hilo preservado → não suspeito
    const ok = computeDerivations(schema, {
      [normalKey('axilas')]: 'altered',
      [countKey(cid)]: '1',
      [itemFieldId(cid, 0, 'cortex')]: '2',
      [itemFieldId(cid, 0, 'hilo')]: 'preservado/central',
    }).find((x) => x.id.startsWith('linf_ax_'));
    expect(ok?.alert).toBe(false);
  });

  it('pediatria: DAP da pelve gradua dilatação (< 7 normal · ≥ 10 alerta)', () => {
    const schema = deriveStructuredSchema(tpl('pediatria', 'RINS E VIAS URINÁRIAS PEDIÁTRICO'), 'pediatria');
    expect(computeDerivations(schema, { dap_d: '12' }).find((x) => x.id === 'dap__d')?.text).toContain('moderada');
    expect(computeDerivations(schema, { dap_d: '12' }).find((x) => x.id === 'dap__d')?.alert).toBe(true);
    expect(computeDerivations(schema, { dap_e: '8' }).find((x) => x.id === 'dap__e')?.text).toContain('leve');
    expect(computeDerivations(schema, { dap_e: '8' }).find((x) => x.id === 'dap__e')?.alert).toBe(false);
    expect(computeDerivations(schema, { dap_d: '5' }).find((x) => x.id === 'dap__d')?.text).toBe('5 mm');
  });

  it('reumato: sacroilíaca PD ≥ 1 = sacroileíte ativa (por lado)', () => {
    const schema = deriveStructuredSchema(tpl('reumatologico', 'SACROILÍACAS'), 'reumatologico');
    const ativa = computeDerivations(schema, { si_pd_d: '2 (moderado)' }).find((x) => x.id === 'si_pd__d');
    expect(ativa?.text).toContain('sacroileíte ativa');
    expect(ativa?.alert).toBe(true);
    const inativa = computeDerivations(schema, { si_pd_e: '0 (ausente)' }).find((x) => x.id === 'si_pd__e');
    expect(inativa?.text).toContain('sem atividade');
    expect(inativa?.alert).toBe(false);
  });

  it('MSK: nervo ulnar CSA ≥ 10 mm² = compressão (túnel cubital)', () => {
    const schema = deriveStructuredSchema(tpl('musculoesqueletico', 'COTOVELO'), 'musculoesqueletico');
    expect(computeDerivations(schema, { csa_ulnar: '12' }).find((x) => x.id === 'csa_ulnar__comp')?.alert).toBe(true);
    expect(computeDerivations(schema, { csa_ulnar: '7' }).find((x) => x.id === 'csa_ulnar__comp')?.text).toBe('7 mm²');
  });

  it('MSK: derrame do quadril > 5 mm alerta (artrite séptica se febre)', () => {
    const schema = deriveStructuredSchema(tpl('musculoesqueletico', 'QUADRIL'), 'musculoesqueletico');
    const d = computeDerivations(schema, { derrame_colo: '7' }).find((x) => x.id === 'derrame_colo__d');
    expect(d?.text).toMatch(/artrite séptica/);
    expect(d?.alert).toBe(true);
    expect(computeDerivations(schema, { derrame_colo: '2' }).find((x) => x.id === 'derrame_colo__d')?.alert).toBe(false);
  });

  it('procedimentos: linfonodo-alvo suspeito por córtex ≥ 3 mm ou hilo ausente', () => {
    const schema = deriveStructuredSchema(tpl('procedimentos', 'PUNÇÃO/BIÓPSIA DE LINFONODO'), 'procedimentos');
    expect(computeDerivations(schema, { ln_cortex: '4' }).find((x) => x.id === 'ln__susp')?.alert).toBe(true);
    expect(computeDerivations(schema, { ln_hilo: 'ausente' }).find((x) => x.id === 'ln__susp')?.alert).toBe(true);
    expect(computeDerivations(schema, { ln_cortex: '2', ln_hilo: 'preservado/central' }).find((x) => x.id === 'ln__susp')?.alert).toBe(false);
  });

  it('reumato: sem articulações preenchidas → não emite soma', () => {
    const schema = deriveStructuredSchema(tpl('reumatologico', 'ESCORE PDUS-28'), 'reumatologico');
    const d = computeDerivations(schema, {});
    expect(d.some((x) => x.id.startsWith('reuma__'))).toBe(false);
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
    const ig = d.find((x) => x.id === 'ig__ref');
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

  // Os índices Doppler genéricos (IR/PI/S-D de VPS/VDF/Vmed) vivem na
  // calculadora `vascular-ratios` (coberta em calculators.test.ts via
  // `dopplerIndices`), não em derivação ao vivo — não há campo de esquema
  // `vps`/`vdf` "cru" para dispará-la (o parser gera `vps-val`).

  it('PFE de Hadlock (fetal) a partir de DBP/CC/CA/CF, com percentil quando há DUM', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA'), 'medicina-fetal');
    const semDum = computeDerivations(schema, { dbp: '75', cc: '285', ca: '270', cf: '54' });
    expect(semDum.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/\d+ g/);
    const comDum = computeDerivations(schema, { dbp: '75', cc: '285', ca: '270', cf: '54', dum: '01/09/2025' }, new Date(2026, 0, 15).getTime());
    expect(comDum.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/p\d+/);
  });

  it('conduta TI-RADS ciente do tamanho (PAAF/seguimento)', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'RASTREIO PP', ['Achados Nodulares']), 'pequenas-partes');
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

describe('computeDerivations — riscos FMF AO VIVO (integração calculadora↔estruturado)', () => {
  const schema1T = deriveStructuredSchema(tpl('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');

  it('trissomias: perfil clássico de T21 gera chip de risco alto ao preencher', () => {
    const d = computeDerivations(schema1T, {
      mae_idade: '38', ccn: '65', nt: '3.5', bhcg_mom: '2.5', pappa_mom: '0.4', on: 'ausente',
    });
    const t21 = d.find((x) => x.id === 'fmf_t21');
    expect(t21).toBeDefined();
    expect(t21?.text).toContain('alto risco');
    expect(t21?.alert).toBe(true);
    expect(d.find((x) => x.id === 'fmf_t1318')).toBeDefined();
  });

  it('trissomias: o chip mostra BASAL → CORRIGIDO (1:N nos dois)', () => {
    const d = computeDerivations(schema1T, {
      mae_idade: '38', ccn: '65', nt: '3.5', bhcg_mom: '2.5', pappa_mom: '0.4', on: 'ausente',
    });
    const t21 = d.find((x) => x.id === 'fmf_t21');
    expect(t21?.text).toMatch(/basal 1:\d+.*→.*1:\d+/); // basal e corrigido presentes
    const t1318 = d.find((x) => x.id === 'fmf_t1318');
    expect(t1318?.text).toMatch(/basal .*→/);
  });

  it('trissomias: só idade (sem TN/bioquímica/marcador) NÃO gera chip', () => {
    const d = computeDerivations(schema1T, { mae_idade: '38' });
    expect(d.find((x) => x.id === 'fmf_t21')).toBeUndefined();
  });

  it('trissomias: chip suprimido quando o risco OFICIAL da FMF foi colado', () => {
    const d = computeDerivations(schema1T, {
      mae_idade: '38', ccn: '65', nt: '3.5', on: 'ausente', risco_trissomias_fmf: 'T21 1:50',
    });
    expect(d.find((x) => x.id === 'fmf_t21')).toBeUndefined();
  });

  it('pré-eclâmpsia: fatores maternos + PAM + IP uterina geram chip de risco', () => {
    const d = computeDerivations(schema1T, {
      ig_metodo: 'Biometria do exame atual', ccn: '65',
      mae_idade: '42', mae_peso: '95', mae_altura: '158', mae_etnia: 'afro-caribenha',
      pa_sistolica: '135', pa_diastolica: '85', ip_uta: '2.2',
    });
    const pe = d.find((x) => x.id === 'fmf_pe_preterm');
    expect(pe).toBeDefined();
    expect(pe?.text).toMatch(/1:\d/);
  });

  it('pré-eclâmpsia: só fatores maternos (sem biomarcador) NÃO gera chip', () => {
    const d = computeDerivations(schema1T, {
      mae_idade: '42', mae_peso: '95', mae_altura: '158', mae_etnia: 'afro-caribenha',
    });
    expect(d.find((x) => x.id === 'fmf_pe_preterm')).toBeUndefined();
  });

  it('TRAVA 1º TRIMESTRE: obstétrica com Doppler de 2º/3º T (IG ~30 sem) NÃO calcula risco de PE do 1º T', () => {
    const schemaDoppler = deriveStructuredSchema(tpl('medicina-fetal', 'OBSTÉTRICA ABDOMINAL COM DOPPLER'), 'medicina-fetal');
    // DUM 17/09/2025, exame 15/04/2026 → ~30 semanas (fora da janela 11–13+6)
    const d = computeDerivations(schemaDoppler, {
      ig_metodo: 'DUM', dum: '17/09/2025',
      mae_idade: '42', mae_peso: '95', mae_altura: '158', mae_etnia: 'afro-caribenha',
      pa_sistolica: '135', pa_diastolica: '85', ip_uta: '2.2',
    }, new Date(2026, 3, 15).getTime());
    // medianas Tan 2018 são do 1º T — não aplicar em 30 sem
    expect(d.find((x) => x.id === 'fmf_pe_preterm')).toBeUndefined();
    // mas a razão P2/P1 oftálmica (marcador GA-independente) e a PAM seguem valendo
    expect(d.find((x) => x.id === 'pam__calc')).toBeDefined();
  });
});

describe('computeDerivations — novos cálculos (abdome, tireoide, nervo)', () => {
  const abdome = () => deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');

  it('colédoco: dilatado > 6 mm; limiar sobe para 8 mm em > 70 anos (idade do paciente)', () => {
    const dNoCtx = computeDerivations(abdome(), { coledoco: '7' });
    expect(dNoCtx.find((x) => x.id === 'coledoco__cal')?.alert).toBe(true);
    expect(dNoCtx.find((x) => x.id === 'coledoco__cal')?.text).toContain('dilatado (> 6');

    const idoso = { ageYears: 80, sex: 'M' as const, weightKg: null, heightCm: null };
    const dCtx = computeDerivations(abdome(), { coledoco: '7' }, undefined, idoso);
    expect(dCtx.find((x) => x.id === 'coledoco__cal')?.alert).toBeFalsy();

    const dCtxHigh = computeDerivations(abdome(), { coledoco: '9' }, undefined, idoso);
    expect(dCtxHigh.find((x) => x.id === 'coledoco__cal')?.text).toContain('> 70 anos');
  });

  it('ducto de Wirsung: dilatado se ≥ 3 mm', () => {
    expect(computeDerivations(abdome(), { wirsung: '2' }).find((x) => x.id === 'wirsung__cal')?.alert).toBeFalsy();
    expect(computeDerivations(abdome(), { wirsung: '3,5' }).find((x) => x.id === 'wirsung__cal')?.alert).toBe(true);
  });

  it('aorta abdominal: ectasia (2,5–2,9) e aneurisma (≥ 3,0)', () => {
    expect(computeDerivations(abdome(), { aorta: '2,2' }).find((x) => x.id === 'aorta__cal')?.text).not.toMatch(/ectasia|aneurisma/);
    expect(computeDerivations(abdome(), { aorta: '2,7' }).find((x) => x.id === 'aorta__cal')?.text).toContain('ectasia');
    const aneur = computeDerivations(abdome(), { aorta: '3,4' }).find((x) => x.id === 'aorta__cal');
    expect(aneur?.text).toContain('aneurisma');
    expect(aneur?.alert).toBe(true);
  });

  it('istmo tireoidiano: espessado se > 0,4 cm', () => {
    const schema = deriveStructuredSchema(tpl('pequenas-partes', 'TIREOIDE'), 'pequenas-partes');
    expect(computeDerivations(schema, { istmo: '0,3' }).find((x) => x.id === 'istmo__esp')?.alert).toBeFalsy();
    expect(computeDerivations(schema, { istmo: '0,6' }).find((x) => x.id === 'istmo__esp')?.alert).toBe(true);
  });

  it('nervo mediano (CSA): STC ≥ 10 mm², moderado/grave > 13', () => {
    const schema = deriveStructuredSchema(tpl('musculoesqueletico', 'PUNHO'), 'musculoesqueletico');
    expect(computeDerivations(schema, { csa_mediano: '8' }).find((x) => x.id === 'csa_mediano__stc')?.alert).toBeFalsy();
    expect(computeDerivations(schema, { csa_mediano: '11' }).find((x) => x.id === 'csa_mediano__stc')?.text).toContain('STC (≥ 10');
    expect(computeDerivations(schema, { csa_mediano: '15' }).find((x) => x.id === 'csa_mediano__stc')?.text).toContain('moderado/grave');
  });
});
