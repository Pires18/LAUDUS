import { StructuredSection, StructuredFieldValue, StructuredFieldDef } from '../../../types';
import { normalKey, itemFieldId, itemCount } from './structuredKeys';
import { sectionRepeatContainers } from './containers';

/**
 * ALTERADO AUTOMÁTICO — interpreta o texto de faixa normal de um campo
 * (`field.normal`, ex.: '≤ 3,5 mm', '110–160 bpm', '< 140 mmHg', '45° ± 20°')
 * e decide se o valor digitado está FORA da faixa. Usado para:
 *  1. marcar um chip "alterado" no próprio campo; e
 *  2. virar a seção normalable para "Alterado" sozinha (sem clique), a menos
 *     que o médico tenha escolhido manualmente Normal/Alterado (override).
 *
 * Faixas aproximadas ('≈ 1,0 MoM') não são auto-classificadas (retornam null) —
 * ali o julgamento é do médico / de uma calculadora dedicada.
 */

function asText(v: StructuredFieldValue | undefined): string {
  if (v == null) return '';
  return (typeof v === 'string' ? v : v.text || '').trim();
}

/** Número (pt-BR: vírgula decimal) de um valor de campo. null se ausente. */
function num(v: StructuredFieldValue | undefined): number | null {
  const t = asText(v);
  if (!t) return null;
  const m = t.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function firstNum(s: string): number | null {
  const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export interface NormalRange {
  min?: number;
  max?: number;
  minIncl: boolean;
  maxIncl: boolean;
}

/** Converte '≤ X' / '≥ X' / '< X' / '> X' / 'X–Y' / 'X ± Y' em limites. */
export function parseNormalRange(normal: string): NormalRange | null {
  const s = normal.trim();
  if (!s || /[≈~]/.test(s)) return null; // aproximado → sem auto-classificação

  // X ± Y  (tolera unidade entre o número e o ±, ex.: '45° ± 20°')
  let m = s.match(/(-?\d+[.,]?\d*)[^0-9±]*±[^0-9]*(\d+[.,]?\d*)/);
  if (m) {
    const c = firstNum(m[1])!;
    const d = firstNum(m[2])!;
    return { min: c - d, max: c + d, minIncl: true, maxIncl: true };
  }
  // faixa X–Y (en/em-dash ou hífen entre dois números)
  m = s.match(/(-?\d+[.,]?\d*)\s*[–—-]\s*(-?\d+[.,]?\d*)/);
  if (m) return { min: firstNum(m[1])!, max: firstNum(m[2])!, minIncl: true, maxIncl: true };
  // operador unilateral
  m = s.match(/(≤|<=|≥|>=|<|>)\s*(-?\d+[.,]?\d*)/);
  if (m) {
    const val = firstNum(m[2])!;
    switch (m[1]) {
      case '≤': case '<=': return { max: val, minIncl: true, maxIncl: true };
      case '<': return { max: val, minIncl: true, maxIncl: false };
      case '≥': case '>=': return { min: val, minIncl: true, maxIncl: true };
      case '>': return { min: val, minIncl: false, maxIncl: true };
    }
  }
  return null;
}

/** Verdadeiro se o valor está FORA da faixa normal (alterado). */
export function isValueAbnormal(value: number, normal: string): boolean {
  const r = parseNormalRange(normal);
  if (!r) return false;
  if (r.min != null && (r.minIncl ? value < r.min : value <= r.min)) return true;
  if (r.max != null && (r.maxIncl ? value > r.max : value >= r.max)) return true;
  return false;
}

/** Um valor (texto de campo) está alterado para a faixa dada? (ausente ⇒ false) */
export function fieldValueAbnormal(value: StructuredFieldValue | undefined, normal?: string): boolean {
  if (!normal) return false;
  const v = num(value);
  return v != null && isValueAbnormal(v, normal);
}

/**
 * Alterado por CAMPO (faixa numérica `normal` OU select clínico `normalOption`).
 * Select: qualquer opção selecionada (não vazia) diferente de `normalOption`
 * marca como alterado (ex.: osso nasal 'ausente'/'hipoplásico').
 */
export function fieldDefAbnormal(field: StructuredFieldDef, value: StructuredFieldValue | undefined): boolean {
  if (field.normalOption != null) {
    const t = asText(value);
    return t !== '' && t !== field.normalOption;
  }
  return fieldValueAbnormal(value, field.normal);
}

/**
 * Verdadeiro se a seção tem ACHADO: campo fixo com valor fora de faixa OU
 * qualquer campo preenchido numa instância repetível (lesão/nódulo registrado
 * é um achado por definição — não existe lesão "normal" digitada à toa).
 * As instâncias usam o containerId real (`section` ou `section#group`), não
 * `section.id` cru — grupos aninhados guardam em `<section>#<group>@<i>@<campo>`.
 */
export function sectionHasAbnormalValue(
  section: StructuredSection,
  values: Record<string, StructuredFieldValue> | undefined,
): boolean {
  if (!values) return false;
  for (const f of section.fields) {
    if ((f.normal || f.normalOption) && fieldDefAbnormal(f, values[f.id])) return true;
  }
  for (const c of sectionRepeatContainers(section)) {
    const cnt = itemCount(values, c.containerId);
    for (let i = 0; i < cnt; i++) {
      for (const f of c.fields) {
        if (asText(values[itemFieldId(c.containerId, i, f.id)])) return true;
      }
    }
  }
  return false;
}

/**
 * Estado EFETIVO da seção normalable, considerando o auto-alterado:
 * - escolha manual do médico ('altered'/'normal') sempre vence;
 * - sem escolha manual (default), vira 'altered' se houver valor fora de faixa.
 */
export function effectiveSectionState(
  section: StructuredSection,
  values: Record<string, StructuredFieldValue> | undefined,
): 'normal' | 'altered' {
  const manual = asText(values?.[normalKey(section.id)]);
  if (manual === 'altered') return 'altered';
  if (manual === 'normal') return 'normal';
  return sectionHasAbnormalValue(section, values) ? 'altered' : 'normal';
}

/** Verdadeiro quando o "alterado" veio do valor (não de clique do médico). */
export function isAutoAltered(
  section: StructuredSection,
  values: Record<string, StructuredFieldValue> | undefined,
): boolean {
  const manual = asText(values?.[normalKey(section.id)]);
  return manual === '' && sectionHasAbnormalValue(section, values);
}
