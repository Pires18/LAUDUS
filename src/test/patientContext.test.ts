import { describe, it, expect } from 'vitest';
import { buildPatientContext, patientAgeYears, patientPrefillPatch } from '../modules/editor/structured/patientContext';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import { Patient, ReportTemplate } from '../types';

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

describe('patientContext', () => {
  it('idade em anos completos a partir da data de nascimento e da data do exame', () => {
    // DN 15/06/1990, exame 20/07/2026 → 36 anos
    expect(patientAgeYears('1990-06-15', new Date(2026, 6, 20).getTime())).toBe(36);
    // aniversário ainda não feito no ano do exame
    expect(patientAgeYears('1990-12-31', new Date(2026, 6, 20).getTime())).toBe(35);
    expect(patientAgeYears(undefined)).toBeNull();
    expect(patientAgeYears('data-invalida')).toBeNull();
  });

  it('constrói o contexto com idade/sexo do cadastro e peso/altura do prontuário', () => {
    const ctx = buildPatientContext(
      patient({ birthDate: '1988-01-10', gender: 'F' }),
      { weightKg: 72, heightCm: 165 },
      new Date(2026, 0, 20).getTime()
    );
    expect(ctx).toEqual({ ageYears: 38, sex: 'F', weightKg: 72, heightCm: 165 });
  });

  it('descarta peso/altura inválidos (≤ 0)', () => {
    const ctx = buildPatientContext(patient({ gender: 'M' }), { weightKg: 0, heightCm: -1 });
    expect(ctx.weightKg).toBeNull();
    expect(ctx.heightCm).toBeNull();
  });

  it('prefill de EMI (idade + sexo) numa máscara vascular de carótidas', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const ctx = buildPatientContext(patient({ birthDate: '1960-03-01', gender: 'M' }), null, new Date(2026, 6, 20).getTime());
    const patch = patientPrefillPatch(schema, {}, ctx);
    expect(patch['emi_idade']).toBe('66');
    expect(patch['emi_sexo']).toBe('masculino');
  });

  it('prefill materno (idade/peso/altura) numa máscara obstétrica', () => {
    const schema = deriveStructuredSchema(tpl('medicina-fetal', 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE'), 'medicina-fetal');
    const ctx = buildPatientContext(patient({ birthDate: '1994-05-05', gender: 'F' }), { weightKg: 68.5, heightCm: 170 }, new Date(2026, 6, 20).getTime());
    const patch = patientPrefillPatch(schema, {}, ctx);
    expect(patch['mae_idade']).toBe('32');
    expect(patch['mae_peso']).toBe('68,5');
    expect(patch['mae_altura']).toBe('170');
  });

  it('não sobrescreve campos já preenchidos', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const ctx = buildPatientContext(patient({ birthDate: '1960-03-01', gender: 'M' }), null, new Date(2026, 6, 20).getTime());
    const patch = patientPrefillPatch(schema, { emi_idade: '70' }, ctx);
    expect(patch['emi_idade']).toBeUndefined();
    expect(patch['emi_sexo']).toBe('masculino');
  });

  it('não injeta nada quando a máscara não tem campos do paciente (ex.: joelho)', () => {
    const schema = deriveStructuredSchema(tpl('musculoesqueletico', 'JOELHO'), 'musculoesqueletico');
    const ctx = buildPatientContext(patient({ birthDate: '1994-05-05', gender: 'F' }), { weightKg: 68, heightCm: 170 });
    expect(patientPrefillPatch(schema, {}, ctx)).toEqual({});
  });

  it('sexo indefinido (O) não preenche emi_sexo', () => {
    const schema = deriveStructuredSchema(tpl('vascular', 'CARÓTIDAS E VERTEBRAIS'), 'vascular');
    const ctx = buildPatientContext(patient({ birthDate: '1960-03-01', gender: 'O' }), null, new Date(2026, 6, 20).getTime());
    const patch = patientPrefillPatch(schema, {}, ctx);
    expect(patch['emi_sexo']).toBeUndefined();
    expect(patch['emi_idade']).toBe('66');
  });
});
