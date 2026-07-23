import { StructuredSchema, StructuredFieldDef, StructuredFieldValue } from '../../../types';
import { itemCount, itemFieldId } from './structuredKeys';
import { sectionRepeatContainers } from './containers';

/**
 * Visibilidade condicional (`showIf`) — fonte ÚNICA do critério, usada pela UI
 * (renderGrid), pela compilação (summarizeStructured) e pelo cálculo ao vivo
 * (computeDerivations). Sem isso, um campo oculto com valor residual antigo
 * (ex.: DeBakey após marcar flap 'ausente') vazava para o laudo/IA.
 */

type Values = Record<string, StructuredFieldValue>;

function asText(v: StructuredFieldValue | undefined): string {
  if (v == null) return '';
  return (typeof v === 'string' ? v : v.text || '').trim();
}

/**
 * Campo visível? Sem `showIf` → sempre. Com `equals` → controlador igual ao
 * valor; sem `equals` → controlador preenchido. `keyFor` resolve o escopo
 * (identidade para campos fixos; itemFieldId para campos de instância).
 */
export function fieldVisible(
  field: StructuredFieldDef,
  values: Values | undefined,
  keyFor: (fieldId: string) => string = (id) => id
): boolean {
  if (!field.showIf) return true;
  const cur = asText(values?.[keyFor(field.showIf.field)]);
  return field.showIf.equals != null ? cur === field.showIf.equals : !!cur;
}

/**
 * Cópia de `values` SEM os campos atualmente ocultos por `showIf` (fixos e por
 * instância repetível) — o que o médico vê é exatamente o que compila/calcula.
 * Chaves que não pertencem ao schema (internas `__*`, resultados de calculadora
 * de seção etc.) são preservadas.
 */
export function visibleValues(
  schema: StructuredSchema,
  values: Values | undefined
): Values | undefined {
  if (!values) return values;
  const hidden = new Set<string>();
  for (const section of schema.sections) {
    if (!section.repeatable) {
      for (const f of section.fields) {
        if (f.showIf && !fieldVisible(f, values)) hidden.add(f.id);
      }
    }
    for (const c of sectionRepeatContainers(section)) {
      const n = itemCount(values, c.containerId);
      for (let i = 0; i < n; i++) {
        const keyFor = (fid: string) => itemFieldId(c.containerId, i, fid);
        for (const f of c.fields) {
          if (f.showIf && !fieldVisible(f, values, keyFor)) hidden.add(keyFor(f.id));
        }
      }
    }
  }
  if (!hidden.size) return values;
  const out: Values = {};
  for (const [k, val] of Object.entries(values)) {
    if (!hidden.has(k)) out[k] = val;
  }
  return out;
}
