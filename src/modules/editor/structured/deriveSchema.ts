import {
  ReportTemplate,
  StructuredSchema,
  StructuredSection,
  StructuredFieldDef,
  StructuredFieldValue,
} from '../../../types';
import { getAreaOverlay } from './areaOverlays';
import { sectionState, itemCount, itemFieldId } from './structuredKeys';

/** Placeholders de preenchimento usados nas máscaras (fetal `(...)` / não-fetal `[__]`). */
const PLACEHOLDER_RE = /\(\.\.\.\)|\(…\)|\[_{2,}\]|\[inserir\]/g;
const UNIT_RE = /\b(mm|cm³|cm3|cm\/s|m\/s|cm|mL|ml|bpm|g|%)\b/;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'campo'
  );
}

/**
 * Parser genérico: converte o analysisTemplate compartimentado
 * (`<p><strong>RÓTULO:</strong> …</p>`) em seções/campos. Cada compartimento
 * vira uma seção; placeholders viram campos de medida/triplet; compartimentos
 * sem placeholder viram um campo de texto (normal/alteração).
 */
export function parseMaskSections(analysisTemplate: string): StructuredSection[] {
  const blocks = analysisTemplate.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const sections: StructuredSection[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const strongMatch = block.match(/<strong>\s*([^<:]+?):?\s*<\/strong>/i);
    const rawLabel = strongMatch
      ? strongMatch[1].trim()
      : stripTags(block).split('.')[0].slice(0, 40);
    // remove parênteses explicativos do rótulo (ex.: "(CCN)")
    const label = rawLabel.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || 'Estrutura';

    let id = slug(label);
    while (seen.has(id)) id += '-x';
    seen.add(id);

    const text = stripTags(block);
    const placeholders = text.match(PLACEHOLDER_RE) || [];
    const unit = text.match(UNIT_RE)?.[1];

    let field: StructuredFieldDef;
    if (placeholders.length >= 3) {
      field = { id: `${id}-dims`, label: 'Dimensões (C x L x A)', kind: 'triplet', unit };
    } else if (placeholders.length >= 1) {
      field = { id: `${id}-val`, label, kind: 'measure', unit };
    } else {
      field = { id: `${id}-desc`, label, kind: 'text', placeholder: 'normal / descrever alteração' };
    }
    sections.push({ id, label, fields: [field] });
  }
  return sections;
}

/**
 * Deriva o esquema estruturado de um exame.
 * - Área com overlay curado (ex.: medicina-fetal) → usa o overlay (campos
 *   tipados + calculadoras ligadas).
 * - Demais áreas → parser genérico do analysisTemplate da máscara.
 */
export function deriveStructuredSchema(
  template: ReportTemplate | null,
  area: string
): StructuredSchema {
  const overlay = getAreaOverlay(area, template?.name);
  if (overlay) {
    return { area, examName: template?.name, sections: overlay };
  }
  const sections = template?.analysisTemplate
    ? parseMaskSections(template.analysisTemplate)
    : [];
  return { area, examName: template?.name, sections };
}

/** Texto compilável de um valor de campo (string ou objeto calc/triplet). */
export function fieldValueToText(v: StructuredFieldValue | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return (v.text || '').trim();
}

function withUnit(field: StructuredFieldDef, text: string): string {
  const unit = field.unit && !new RegExp(`${field.unit}\\b`).test(text) ? ` ${field.unit}` : '';
  return `${text}${unit}`;
}

/**
 * Resume os campos preenchidos numa lista `rótulo: valor unidade`, pronta para
 * compor a instrução `[DADOS ESTRUTURADOS]`. Lida com seções Normal/Alterado
 * (emite "normal") e seções repetíveis (itera instâncias). Retorna também a
 * contagem de itens preenchidos (habilita o botão de compilar).
 */
export function summarizeStructured(
  schema: StructuredSchema,
  values: Record<string, StructuredFieldValue> | undefined
): { lines: string[]; filledCount: number } {
  const lines: string[] = [];
  let filledCount = 0;
  const vals = values || {};

  for (const section of schema.sections) {
    // Seção normalable em estado 'normal' → emite normalidade e segue.
    if (section.normalable && sectionState(vals, section.id) === 'normal') {
      lines.push(`${section.label}: sem alterações${section.normalText ? ` (${section.normalText})` : ''}`);
      filledCount++;
      continue;
    }

    if (section.repeatable) {
      const n = itemCount(vals, section.id);
      const block: string[] = [];
      for (let i = 0; i < n; i++) {
        const itemLines: string[] = [];
        for (const field of section.fields) {
          const text = fieldValueToText(vals[itemFieldId(section.id, i, field.id)]);
          if (!text) continue;
          filledCount++;
          itemLines.push(`    - ${field.label}: ${withUnit(field, text)}`);
        }
        if (itemLines.length) {
          block.push(`  ${section.itemLabel || 'Item'} ${i + 1}:`);
          block.push(...itemLines);
        }
      }
      if (block.length) {
        lines.push(`${section.label}:`);
        lines.push(...block);
      }
      continue;
    }

    const sectionLines: string[] = [];
    for (const field of section.fields) {
      const text = fieldValueToText(vals[field.id]);
      if (!text) continue;
      filledCount++;
      sectionLines.push(`  - ${field.label}: ${withUnit(field, text)}`);
    }
    if (sectionLines.length) {
      lines.push(`${section.label}:`);
      lines.push(...sectionLines);
    }
  }
  return { lines, filledCount };
}
