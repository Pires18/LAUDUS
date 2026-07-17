import { describe, it, expect } from 'vitest';
import {
  gaFromBpd,
  gaFromHc,
  gaFromBiometry,
  pickBiometryDatingParam,
  parseIgLabel,
  resolveReferenceGa,
} from '../modules/calculators/formulas';
import { seedForCalculator, meanArterialPressure, bodyMassIndex } from '../modules/editor/structured/calcSeed';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
import { ReportTemplate } from '../types';

function tpl(name: string): ReportTemplate {
  return {
    id: 't', area: 'medicina-fetal', name, title: '', technique: '',
    analysisTemplate: '', conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}

const EXAM = new Date(2026, 6, 16); // 16/07/2026

describe('datação por biometria (Hadlock)', () => {
  it('DBP → IG (2º trimestre)', () => {
    // Hadlock 1984: b=5 cm → 9,54 + 7,41 + 4,19 ≈ 21,1 sem
    const r = gaFromBpd(50)!;
    expect(r.weeks).toBe(21);
    expect(gaFromBpd(0)).toBeNull();
  });

  it('CC → IG (3º trimestre)', () => {
    // h=30 cm → 8,96 + 16,2 + 8,1 ≈ 33,3 sem
    const r = gaFromHc(300)!;
    expect(r.weeks).toBe(33);
    expect(gaFromHc(-1)).toBeNull();
  });

  it('gaFromBiometry roteia CCN/DBP/CC', () => {
    expect(gaFromBiometry('ccn', 65)?.weeks).toBe(12); // CCN 65 mm ≈ 12–13 sem
    expect(gaFromBiometry('dbp', 50)?.weeks).toBe(21);
    expect(gaFromBiometry('cc', 300)?.weeks).toBe(33);
  });

  it('escolhe o parâmetro pelo trimestre: CCN (1º), DBP (2º), CC (3º)', () => {
    const all = { ccn: 60, dbp: 50, cc: 300 };
    expect(pickBiometryDatingParam(all, 12)).toBe('ccn');
    expect(pickBiometryDatingParam(all, 22)).toBe('dbp');
    expect(pickBiometryDatingParam(all, 32)).toBe('cc');
    // sem IG conhecida: CCN indica 1º trimestre
    expect(pickBiometryDatingParam({ ccn: 60 })).toBe('ccn');
    // DBP grande (≈33 sem) + CC disponível → prefere CC
    expect(pickBiometryDatingParam({ dbp: 85, cc: 300 })).toBe('cc');
    expect(pickBiometryDatingParam({})).toBeNull();
  });

  it('parseIgLabel aceita 12s3d, 12+3, "12 3", 12s e 12', () => {
    expect(parseIgLabel('12s3d')).toEqual({ weeks: 12, days: 3 });
    expect(parseIgLabel('12+3')).toEqual({ weeks: 12, days: 3 });
    expect(parseIgLabel('12 3')).toEqual({ weeks: 12, days: 3 });
    expect(parseIgLabel('12s')).toEqual({ weeks: 12, days: 0 });
    expect(parseIgLabel('12')).toEqual({ weeks: 12, days: 0 });
    expect(parseIgLabel('')).toBeNull();
    expect(parseIgLabel('abc')).toBeNull();
  });
});

describe('resolveReferenceGa — IG de referência do exame', () => {
  const dum = new Date(2026, 0, 1); // 01/01/2026 → 196 dias até 16/07 = 28s

  it('DUM: IG + DPP', () => {
    const r = resolveReferenceGa({ method: 'dum', dum, examDate: EXAM })!;
    expect(r.label).toBe('28s 0d');
    expect(r.method).toBe('dum');
    expect(r.sourceLabel).toBe('DUM');
    expect(r.edd).toBeInstanceOf(Date);
  });

  it('USG anterior: extrapola a IG conhecida até a data do exame', () => {
    // USG em 01/03/2026 com 12s0d → +137 dias = 19s4d... confere pelo cálculo
    const r = resolveReferenceGa({
      method: 'usg', usgDate: new Date(2026, 2, 1), usgWeeks: 12, usgDays: 0, examDate: EXAM,
    })!;
    expect(r.method).toBe('usg');
    expect(r.totalDays).toBe(12 * 7 + 137);
  });

  it('biometria: usa o parâmetro do trimestre e estima DPP', () => {
    const r = resolveReferenceGa({ method: 'biometria', biometry: { dbp: 50 }, examDate: EXAM })!;
    expect(r.method).toBe('biometria');
    expect(r.sourceLabel).toBe('DBP');
    expect(r.weeks).toBe(21);
    expect(r.edd).toBeInstanceOf(Date);
  });

  it('hierarquia padrão (sem método): USG > DUM > biometria', () => {
    const r = resolveReferenceGa({
      dum, usgDate: new Date(2026, 2, 1), usgWeeks: 12, usgDays: 0,
      biometry: { dbp: 50 }, examDate: EXAM,
    })!;
    expect(r.method).toBe('usg');
  });

  it('método declarado sem dados cai no próximo disponível', () => {
    const r = resolveReferenceGa({ method: 'usg', dum, examDate: EXAM })!;
    expect(r.method).toBe('dum');
    expect(resolveReferenceGa({ method: 'dum', examDate: EXAM })).toBeNull();
  });
});

describe('IG de referência no formulário estruturado (liveCompute)', () => {
  const schema = () => deriveStructuredSchema(tpl('OBSTÉTRICA ABDOMINAL COM DOPPLER'), 'medicina-fetal');

  it('percentis funcionam com datação por USG anterior (antes só a DUM servia)', () => {
    const d = computeDerivations(schema(), {
      ig_metodo: 'USG anterior (1º trimestre)',
      usg_data: '01/03/2026',
      usg_ig: '12s0d',
      dbp: '70', cc: '260', ca: '240', cf: '52',
    }, EXAM.getTime());
    const ig = d.find((x) => x.id === 'ig__ref');
    expect(ig?.label).toContain('USG anterior');
    // o PFE só ganha percentil quando há IG de referência resolvida
    expect(d.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/p\d+/);
  });

  it('percentis funcionam com datação por biometria', () => {
    const d = computeDerivations(schema(), {
      ig_metodo: 'Biometria do exame atual',
      dbp: '70', cc: '260', ca: '240', cf: '52',
    }, EXAM.getTime());
    const ig = d.find((x) => x.id === 'ig__ref');
    expect(ig?.label).toMatch(/DBP|CC/);
    expect(d.find((x) => x.id === 'pfe__hadlock')?.text).toMatch(/p\d+/);
  });

  it('IG biométrica é comparada com a referência e alerta divergência > 10%', () => {
    // DUM → 28s; DBP de 50 mm → ~21s (divergência grande)
    const d = computeDerivations(schema(), {
      ig_metodo: 'DUM', dum: '01/01/2026', dbp: '50',
    }, EXAM.getTime());
    const bio = d.find((x) => x.id === 'ig__biometrica');
    expect(bio?.text).toMatch(/divergente da referência/);
    expect(bio?.alert).toBe(true);
  });

  it('sem divergência, informa concordância', () => {
    // DUM → 28s; DBP 72 mm ≈ 28,1s
    const d = computeDerivations(schema(), {
      ig_metodo: 'DUM', dum: '01/01/2026', dbp: '72',
    }, EXAM.getTime());
    const bio = d.find((x) => x.id === 'ig__biometrica');
    expect(bio?.text).toMatch(/concordante/);
    expect(bio?.alert).toBe(false);
  });
});

describe('exame físico materno — PAM e IMC', () => {
  it('PAM = (2·diastólica + sistólica)/3', () => {
    expect(meanArterialPressure(120, 80)).toBeCloseTo(93.33, 1);
    expect(meanArterialPressure(0, 80)).toBeNull();
    expect(meanArterialPressure(80, 120)).toBeNull(); // diastólica > sistólica
  });

  it('IMC = peso / altura²', () => {
    expect(bodyMassIndex(70, 170)).toBeCloseTo(24.22, 1);
    expect(bodyMassIndex(0, 170)).toBeNull();
  });

  it('deriva PAM e IMC na seção de dados maternos', () => {
    const schema = deriveStructuredSchema(tpl('MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');
    const d = computeDerivations(schema, {
      pa_sistolica: '150', pa_diastolica: '95', mae_peso: '95', mae_altura: '160',
    });
    const pam = d.find((x) => x.id === 'pam__calc');
    expect(pam?.sectionId).toBe('dados-maternos');
    expect(pam?.alert).toBe(true); // PAM ≈ 113 mmHg
    const imc = d.find((x) => x.id === 'imc__calc');
    expect(imc?.text).toMatch(/obesidade/);
    expect(imc?.alert).toBe(true);
  });
});

describe('seedForCalculator — calculadora abre com os dados do formulário', () => {
  it('gestational-age: método, DUM, USG anterior e biometria', () => {
    const seed = seedForCalculator('gestational-age', {
      ig_metodo: 'USG anterior (1º trimestre)',
      usg_data: '01/03/2026',
      usg_ig: '12s3d',
      dum: '01/01/2026',
      ccn: '65', dbp: '70', cc: '260',
    }, EXAM.getTime())!;
    expect(seed.method).toBe('usg');
    expect(seed.prevUsgDate).toBe('2026-03-01');
    expect(seed.prevUsgWeeks).toBe('12');
    expect(seed.prevUsgDays).toBe('3');
    expect(seed.dumDate).toBe('2026-01-01');
    expect(seed.ccn).toBe('65');
    expect(seed.bpd).toBe('70');
    expect(seed.hc).toBe('260');
    expect(seed.referenceDate).toBe('2026-07-16');
  });

  it('fmf-trisomy-risk: idade, CCN, TN e marcadores traduzidos', () => {
    const seed = seedForCalculator('fmf-trisomy-risk', {
      mae_idade: '38', ccn: '65', nt: '3,8', pappa_mom: '0,4', bhcg_mom: '2,1',
      on: 'ausente', dv: 'reversa', tricuspide: 'presente',
    })!;
    expect(seed.age).toBe('38');
    expect(seed.crlMm).toBe('65');
    expect(seed.ntMm).toBe('3.8');
    expect(seed.pappaMoM).toBe('0.4');
    expect(seed.nasalBone).toBe('abnormal');
    expect(seed.ductusVenosus).toBe('abnormal');
    expect(seed.tricuspid).toBe('abnormal');
  });

  it('fmf-trisomy-risk: marcadores normais e não avaliados', () => {
    const seed = seedForCalculator('fmf-trisomy-risk', { on: 'presente', dv: 'positiva' })!;
    expect(seed.nasalBone).toBe('normal');
    expect(seed.ductusVenosus).toBe('normal');
    expect(seed.tricuspid).toBe('notAssessed'); // ausente do formulário
  });

  it('fmf-preeclampsia-risk: exame físico → PAM, enums traduzidos e P2/P1', () => {
    const seed = seedForCalculator('fmf-preeclampsia-risk', {
      mae_idade: '41', mae_peso: '82', mae_altura: '165',
      pa_sistolica: '138', pa_diastolica: '88',
      mae_etnia: 'afro-caribenha', mae_concepcao: 'FIV/ICSI',
      mae_paridade: 'multípara com PE prévia', mae_pe_ig: '34',
      mae_diabetes: 'tipo 2 em insulina',
      mae_comorbidades: 'hipertensão crônica, LES / SAF, tabagismo',
      bio_analisador: 'Delfia', plgf_mom: '0,6', ip_uta: '1,8',
      oft_p1: '20', oft_p2: '14',
    })!;
    expect(seed.age).toBe('41');
    expect(seed.weightKg).toBe('82');
    expect(seed.racialOrigin).toBe('afroCaribbean');
    expect(seed.conception).toBe('ivf');
    expect(seed.parity).toBe('parousPE');
    expect(seed.previousPeGaWeeks).toBe('34');
    expect(seed.diabetes).toBe('type2insulin');
    expect(seed.chronicHypertension).toBe(true);
    expect(seed.sleOrAps).toBe(true);
    expect(seed.smoker).toBe(true);
    expect(seed.familyHistoryPE).toBe(false);
    expect(seed.analyzer).toBe('delfia');
    expect(seed.mapMmHg).toBe('104.7'); // (2·88 + 138)/3
    expect(seed.utaPiRaw).toBe('1.8');
    expect(seed.plgfRaw).toBe('0.6');
    expect(seed.psvRatioRaw).toBe('0.70');
  });

  it('calculadora sem mapeamento → null', () => {
    expect(seedForCalculator('volume-elipsoide', { dims: '1 x 2 x 3' })).toBeNull();
  });
});
