import { Patient, VitalSigns, StructuredSchema, StructuredFieldValue } from '../../../types';
import { fieldValueToText } from './deriveSchema';

/**
 * CONTEXTO DO PACIENTE para a aba Estruturado.
 *
 * Reúne os dados que o app JÁ conhece do paciente (idade derivada da data de
 * nascimento, sexo do cadastro, peso/altura do prontuário clínico) para
 * pré-preencher os campos do formulário e alimentar os cálculos automáticos —
 * sem o médico redigitar o que já está no sistema.
 *
 * O preenchimento é sempre um DEFAULT: só entra em campos vazios e continua
 * editável. O que o médico digitar prevalece.
 */
export interface PatientContext {
  /** Idade em anos completos na data do exame (null se sem data de nascimento). */
  ageYears: number | null;
  /** Sexo do cadastro. */
  sex: 'M' | 'F' | 'O' | null;
  /** Peso (kg) do exame físico mais recente do prontuário, se houver. */
  weightKg: number | null;
  /** Altura (cm) do exame físico mais recente do prontuário, se houver. */
  heightCm: number | null;
}

/** Idade em anos completos a partir da data de nascimento (mesma regra de format.calculateAge). */
export function patientAgeYears(birthDate: string | undefined, referenceMs?: number): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = referenceMs && !isNaN(new Date(referenceMs).getTime()) ? new Date(referenceMs) : new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--;
  return years >= 0 ? years : null;
}

/**
 * Monta o contexto a partir do paciente e (opcionalmente) dos sinais vitais mais
 * recentes do prontuário. `examDateMs` fixa a idade na data do exame.
 */
export function buildPatientContext(
  patient: Patient | null | undefined,
  vitals?: VitalSigns | null,
  examDateMs?: number
): PatientContext {
  return {
    ageYears: patientAgeYears(patient?.birthDate, examDateMs),
    sex: patient?.gender ?? null,
    weightKg: vitals?.weightKg != null && vitals.weightKg > 0 ? vitals.weightKg : null,
    heightCm: vitals?.heightCm != null && vitals.heightCm > 0 ? vitals.heightCm : null,
  };
}

/** Número em pt-BR para exibição no input (72.5 → "72,5"). */
function brNum(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Mapa campo-do-formulário → valor derivado do paciente. Os ids são os canônicos
 * dos schemas curados: idade/peso/altura maternos (medicina fetal), idade/sexo
 * do card de EMI (vascular — percentil ELSA-Brasil depende de idade e sexo).
 */
function patientDefaults(ctx: PatientContext): Record<string, string> {
  const out: Record<string, string> = {};
  if (ctx.ageYears != null) {
    out['mae_idade'] = String(ctx.ageYears);
    out['emi_idade'] = String(ctx.ageYears);
  }
  if (ctx.sex === 'M' || ctx.sex === 'F') {
    out['emi_sexo'] = ctx.sex === 'F' ? 'feminino' : 'masculino';
  }
  if (ctx.weightKg != null) out['mae_peso'] = brNum(ctx.weightKg);
  if (ctx.heightCm != null) out['mae_altura'] = brNum(ctx.heightCm);
  return out;
}

/**
 * Patch de pré-preenchimento: para os campos do paciente que EXISTEM no schema
 * atual e ainda estão VAZIOS, retorna o valor a inserir. Gated pelo schema, então
 * um exame sem esses campos (ex.: joelho) não recebe nada — auto-seletivo por área.
 */
export function patientPrefillPatch(
  schema: StructuredSchema,
  values: Record<string, StructuredFieldValue> | undefined,
  ctx: PatientContext
): Record<string, StructuredFieldValue> {
  const defaults = patientDefaults(ctx);
  if (Object.keys(defaults).length === 0) return {};
  const schemaIds = new Set<string>();
  for (const section of schema.sections) {
    for (const field of section.fields) schemaIds.add(field.id);
  }
  const patch: Record<string, StructuredFieldValue> = {};
  for (const [id, val] of Object.entries(defaults)) {
    if (!schemaIds.has(id)) continue;
    if (fieldValueToText(values?.[id])) continue; // já preenchido → não sobrescreve
    patch[id] = val;
  }
  return patch;
}
