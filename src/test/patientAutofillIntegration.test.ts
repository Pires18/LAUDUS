import { describe, it, expect } from 'vitest';
import { buildPatientContext, patientPrefillPatch } from '../modules/editor/structured/patientContext';
import { computeDerivations } from '../modules/editor/structured/liveCompute';
import { seedForCalculator } from '../modules/editor/structured/calcSeed';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { Patient, ReportTemplate, StructuredFieldValue } from '../types';

function tpl(area: string, name: string): ReportTemplate {
  return {
    id: 't', area: area as any, name, title: '', technique: '',
    analysisTemplate: '', conclusionTemplate: '', recommendationsTemplate: '',
    createdAt: 0, updatedAt: 0,
  } as ReportTemplate;
}
function patient(p: Partial<Patient>): Patient {
  return { id: 'p1', name: 'X', createdAt: 0, updatedAt: 0, ...p } as Patient;
}
/** Simula o efeito de pré-preenchimento do LaudCopilot: aplica o patch aos valores. */
function applyPrefill(schema: any, values: Record<string, StructuredFieldValue>, ctx: any) {
  return { ...values, ...patientPrefillPatch(schema, values, ctx) };
}

describe('INTEGRAÇÃO fim-a-fim: paciente → pré-preenchimento → cálculo/calculadora', () => {
  const examDate = new Date(2026, 6, 20).getTime();

  it('carótidas: idade+sexo do cadastro preenchem o EMI e chegam à calculadora ELSA-Brasil', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const ctx = buildPatientContext(patient({ birthDate: '1958-02-10', gender: 'M' }), null, examDate);

    // 1) o médico abre o exame → campos EMI vêm pré-preenchidos
    const values = applyPrefill(schema, { emi_d: '0,9', emi_e: '1,0' }, ctx);
    expect(values['emi_idade']).toBe('68');
    expect(values['emi_sexo']).toBe('masculino');

    // 2) computeDerivations roda sem erro sobre os valores preenchidos
    expect(() => computeDerivations(schema, values, examDate, ctx)).not.toThrow();

    // 3) a calculadora de EMI (ELSA-Brasil, que exige idade E sexo) já chega pronta
    const seed = seedForCalculator('imt-elsa-br', values, examDate, ctx);
    // numStr normaliza vírgula→ponto para o input numérico da calculadora
    expect(seed).toMatchObject({ age: '68', sex: 'male', imtRight: '0.9', imtLeft: '1.0' });
  });

  it('obstétrica 1º T: idade materna do cadastro faz o risco FMF de trissomias ser calculado ao vivo', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');
    // gestante de 40 anos (idade a priori alta) — SEM digitar a idade no formulário
    const ctx = buildPatientContext(patient({ birthDate: '1986-01-15', gender: 'F' }), null, examDate);

    // CCN na janela (11–13+6) + TN → evidência suficiente para o rastreio
    const raw: Record<string, StructuredFieldValue> = { ig_metodo: 'USG', ccn: '65', nt: '2,4', bcf: '160' };
    const values = applyPrefill(schema, raw, ctx);
    expect(values['mae_idade']).toBe('40'); // veio do cadastro

    const d = computeDerivations(schema, values, examDate, ctx);
    const t21 = d.find((x) => x.id === 'fmf_t21');
    expect(t21).toBeDefined();               // risco T21 calculado usando a idade do paciente
    expect(t21?.text).toMatch(/basal .* → /); // formato "basal 1:X → 1:Y"
  });

  it('abdome: a idade do paciente (> 70) evita falso alarme de colédoco dilatado', () => {
    const schema = deriveStructuredSchema(tpl('medicina-interna', 'ABDOME TOTAL'), 'medicina-interna');
    const idoso = buildPatientContext(patient({ birthDate: '1944-04-04', gender: 'M' }), null, examDate); // 82 anos
    const jovem = buildPatientContext(patient({ birthDate: '1990-04-04', gender: 'M' }), null, examDate); // 36 anos

    const coledoco7 = { coledoco: '7' };
    expect(computeDerivations(schema, coledoco7, examDate, idoso).find((x) => x.id === 'coledoco__cal')?.alert).toBeFalsy();
    expect(computeDerivations(schema, coledoco7, examDate, jovem).find((x) => x.id === 'coledoco__cal')?.alert).toBe(true);
  });

  it('peso/altura do prontuário chegam à calculadora de risco de pré-eclâmpsia', () => {
    const ctx = buildPatientContext(
      patient({ birthDate: '1992-09-09', gender: 'F' }),
      { weightKg: 88, heightCm: 162 },
      examDate
    );
    // médico não digitou peso/altura no formulário → vêm do prontuário.
    // nascida em set/1992, exame jul/2026 → aniversário ainda não feito = 33 anos
    const seed = seedForCalculator('fmf-preeclampsia-risk', {}, examDate, ctx);
    expect(seed).toMatchObject({ age: '33', weightKg: '88', heightCm: '162' });
  });

  it('a calculadora de PE de 2º trimestre (antes órfã) agora abre pré-preenchida', () => {
    const ctx = buildPatientContext(patient({ birthDate: '1990-01-01', gender: 'F' }), { weightKg: 70, heightCm: 165 }, examDate);
    const values: Record<string, StructuredFieldValue> = {
      ig_metodo: 'DUM', dum: '01/02/2026', // ~24 sem em 20/07/2026
      pa_sistolica: '128', pa_diastolica: '82', ip_uta: '1,1', plgf_mom: '0,8',
    };
    const seed = seedForCalculator('fmf-preeclampsia-risk-2t', values, examDate, ctx);
    expect(seed).not.toBeNull();
    expect(seed).toMatchObject({ age: '36', weightKg: '70', heightCm: '165', utaR: '1.1' });
    expect(Number(seed!.gaWeeks)).toBeGreaterThan(19); // IG de referência resolvida do laudo
    expect(seed!.mapMmHg).toBeTruthy();                // PAM calculada da PA materna
  });
});
