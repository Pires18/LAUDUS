import { StructuredSection, StructuredFieldDef } from '../../../types';
import { slug } from './deriveSchema';

/**
 * Helpers puros da EDIÇÃO de esquema estruturado (aba "Estruturado" do editor
 * de máscaras): geração de ids únicos, fábrica de seções/campos e validação
 * antes de persistir na máscara.
 *
 * Regra de escopo dos ids (imposta pelo mapa plano `structuredValue`):
 * - Seções NÃO-repetíveis gravam os valores direto por `field.id` → o id
 *   precisa ser único entre TODAS as seções não-repetíveis do esquema.
 * - Seções repetíveis escopam por instância (`sec@i@field`) → o id só precisa
 *   ser único dentro da própria seção.
 * - Ids iniciados em `__` são reservados (chaves internas) e `@` é o separador
 *   de instância — ambos proibidos em ids.
 */

/** Normaliza um id digitado manualmente (minúsculas, sem `@`/espaços/acentos). */
export function normalizeFieldId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 60);
}

/** Ids já usados no escopo plano (todas as seções não-repetíveis). */
export function flatFieldIds(sections: StructuredSection[]): Set<string> {
  const ids = new Set<string>();
  for (const s of sections) {
    if (s.repeatable) continue;
    for (const f of s.fields) ids.add(f.id);
  }
  return ids;
}

/** Gera um id único para um novo campo da seção, a partir do rótulo. */
export function uniqueFieldId(
  label: string,
  sections: StructuredSection[],
  section: StructuredSection
): string {
  const base = slug(label) || 'campo';
  const taken = section.repeatable
    ? new Set(section.fields.map((f) => f.id))
    : flatFieldIds(sections);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

export function uniqueSectionId(label: string, sections: StructuredSection[]): string {
  const base = slug(label) || 'secao';
  const taken = new Set(sections.map((s) => s.id));
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

export function newSection(sections: StructuredSection[]): StructuredSection {
  const label = 'Nova seção';
  return { id: uniqueSectionId(label, sections), label, fields: [] };
}

export function newField(
  sections: StructuredSection[],
  section: StructuredSection
): StructuredFieldDef {
  const label = 'Novo campo';
  return { id: uniqueFieldId(label, sections, section), label, kind: 'text' };
}

/**
 * Valida um esquema personalizado antes de salvar a máscara. Retorna a lista
 * de problemas (vazia = ok). Mensagens em PT-BR, prontas para toast/inline.
 */
export function validateStructuredSchema(sections: StructuredSection[]): string[] {
  const errors: string[] = [];
  const secIds = new Set<string>();
  const flat = new Map<string, string>(); // fieldId → rótulo da seção dona

  for (const s of sections) {
    const sName = s.label?.trim() || s.id || '(sem nome)';
    if (!s.label?.trim()) errors.push('Há uma seção sem nome.');
    if (!s.id?.trim()) errors.push(`Seção "${sName}" sem id.`);
    else if (secIds.has(s.id)) errors.push(`Id de seção duplicado: "${s.id}".`);
    else secIds.add(s.id);
    if (s.repeatable && s.fields.length === 0)
      errors.push(`A seção repetível "${sName}" não tem campos.`);

    const local = new Set<string>();
    for (const f of s.fields) {
      const where = `"${f.label?.trim() || f.id}" (seção "${sName}")`;
      if (!f.label?.trim()) errors.push(`Campo sem rótulo na seção "${sName}".`);
      if (!f.id?.trim()) { errors.push(`Campo ${where} sem id.`); continue; }
      if (f.id.startsWith('__') || f.id.includes('@'))
        errors.push(`Id inválido em ${where}: não pode começar com "__" nem conter "@".`);
      if (local.has(f.id)) errors.push(`Id de campo duplicado na seção "${sName}": "${f.id}".`);
      local.add(f.id);
      if (!s.repeatable) {
        if (flat.has(f.id))
          errors.push(
            `Id de campo "${f.id}" repetido nas seções "${flat.get(f.id)}" e "${sName}" — em seções não-repetíveis o id precisa ser único no esquema todo.`
          );
        else flat.set(f.id, sName);
      }
      if ((f.kind === 'select' || f.kind === 'multiselect') && !f.options?.length)
        errors.push(`Campo ${where} é de seleção mas não tem opções.`);
      if (f.kind === 'calc' && !f.calcId)
        errors.push(`Campo ${where} é do tipo calculadora mas não tem calculadora vinculada.`);
      if (f.showIf && !s.fields.some((o) => o.id === f.showIf!.field))
        errors.push(`Condição de exibição de ${where} referencia campo inexistente ("${f.showIf.field}").`);
    }

    // Grupo de lesões repetível aninhado — campos escopados por instância, então
    // os ids só precisam ser únicos dentro do próprio grupo (não no mapa plano).
    const g = s.repeatGroup;
    if (g) {
      if (!g.id?.trim()) errors.push(`Grupo repetível da seção "${sName}" sem id.`);
      else if (g.id.startsWith('__') || g.id.includes('@') || g.id.includes('#'))
        errors.push(`Id de grupo inválido em "${sName}": não pode conter "__", "@" ou "#".`);
      if (s.repeatable)
        errors.push(`A seção "${sName}" não pode ser repetível e ter um grupo repetível ao mesmo tempo.`);
      if (g.fields.length === 0) errors.push(`O grupo repetível da seção "${sName}" não tem campos.`);
      const glocal = new Set<string>();
      for (const f of g.fields) {
        const where = `"${f.label?.trim() || f.id}" (grupo de "${sName}")`;
        if (!f.label?.trim()) errors.push(`Campo sem rótulo no grupo de "${sName}".`);
        if (!f.id?.trim()) { errors.push(`Campo ${where} sem id.`); continue; }
        if (f.id.startsWith('__') || f.id.includes('@'))
          errors.push(`Id inválido em ${where}: não pode começar com "__" nem conter "@".`);
        if (glocal.has(f.id)) errors.push(`Id de campo duplicado no grupo de "${sName}": "${f.id}".`);
        glocal.add(f.id);
        if ((f.kind === 'select' || f.kind === 'multiselect') && !f.options?.length)
          errors.push(`Campo ${where} é de seleção mas não tem opções.`);
        if (f.kind === 'calc' && !f.calcId)
          errors.push(`Campo ${where} é do tipo calculadora mas não tem calculadora vinculada.`);
        if (f.showIf && !g.fields.some((o) => o.id === f.showIf!.field))
          errors.push(`Condição de exibição de ${where} referencia campo inexistente ("${f.showIf.field}").`);
      }
    }
  }
  return errors;
}
