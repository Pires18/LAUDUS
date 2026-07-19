import {
  ReportTemplate,
  StructuredSchema,
  StructuredSection,
  StructuredFieldDef,
  StructuredFieldValue,
} from '../../../types';
import { enrichSections } from './fieldLibrary';
import { findStandardSchema } from './standardSchemas';
import { mergeStructuredSchemas, MergedStructuredSchema } from './mergeSchemas';
import { sectionState, itemCount, itemFieldId } from './structuredKeys';
import { sectionRepeatContainers } from './containers';

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

  // Linhas puramente instrucionais da máscara (não são compartimentos anatômicos):
  // ex.: "(Repetir este item para cada nódulo…)", "[Expandir aqui…]", "[listar…]".
  // Sem <strong> (rótulo de compartimento), viram seções-fantasma → devem ser ignoradas.
  const INSTRUCTIONAL_RE = /^\s*[([]?\s*(repetir\b|expandir\b|preencher\b|listar\b|adicionar\b|incluir\b|inserir aqui|descrever aqui|para cada\b|se houver\b|quando aplic)/i;

  for (const block of blocks) {
    const bodyText = stripTags(block);
    if (!bodyText) continue; // pula <p> vazios (evita seções-fantasma)

    // Rótulo: conteúdo do <strong> até o primeiro ':' (aceita rótulo com valor inline).
    const strongMatch =
      block.match(/<strong>\s*([^<:]+?)\s*:/i) || block.match(/<strong>\s*([^<]+?)\s*<\/strong>/i);
    // Bloco sem rótulo de compartimento e com texto instrucional → não é seção.
    if (!strongMatch && INSTRUCTIONAL_RE.test(bodyText)) continue;
    const rawLabel = strongMatch ? strongMatch[1].trim() : bodyText.split('.')[0].slice(0, 40);
    // remove parênteses/colchetes explicativos do rótulo (ex.: "(CCN)", "[listar músculos]")
    const label = rawLabel
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s*\[[^\]]*\]\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!label) continue; // sem rótulo utilizável → ignora

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
 * Deriva o esquema estruturado de um exame PADRONIZADO POR MÁSCARA:
 * as seções vêm dos compartimentos do `analysisTemplate` da própria máscara
 * (fidelidade por exame), e cada seção casada é ENRIQUECIDA com campos
 * tipados/escores da biblioteca (`fieldLibrary`). Seções sem casamento mantêm
 * os campos genéricos derivados dos placeholders.
 */
export function deriveStructuredSchema(
  template: ReportTemplate | null,
  area: string
): StructuredSchema {
  // Esquema PERSONALIZADO salvo na máscara tem precedência total — é usado
  // como está, sem parser nem enriquecimento (inclusive `[]` = formulário
  // desativado para este exame).
  if (template?.structuredSchema?.sections) {
    return { area, examName: template.name, sections: template.structuredSchema.sections };
  }
  // MODELO PADRÃO curado por exame (standardSchemas) — já vem tipado e com
  // calculadoras/escores ligados; dispensa parser e enriquecimento.
  const std = findStandardSchema(area, template?.name);
  if (std) {
    return { area, examName: template?.name, sections: std.sections };
  }
  const parsed = template?.analysisTemplate
    ? parseMaskSections(template.analysisTemplate)
    : [];
  return { area, examName: template?.name, sections: enrichSections(area, parsed) };
}

/**
 * Deriva o esquema estruturado de um exame COMBINADO (N máscaras): cada
 * sub-esquema é derivado com a ÁREA DA PRÓPRIA MÁSCARA (crítico para o lookup
 * de modelos padrão quando as máscaras são de áreas diferentes, ex.: Abdome
 * Total [medicina-interna] + Pélvica [ginecologia]) e depois mesclado com a
 * política de colisão de `mergeStructuredSchemas`. Com 0–1 máscara, delega
 * para `deriveStructuredSchema` com a semântica atual (área do exame primeiro)
 * — comportamento idêntico ao de exames simples.
 */
export function deriveCombinedStructuredSchema(
  templates: Array<ReportTemplate | null | undefined>,
  fallbackArea: string
): MergedStructuredSchema {
  const valid = templates.filter((t): t is ReportTemplate => Boolean(t));
  if (valid.length <= 1) {
    const t = valid[0] ?? null;
    const schema = deriveStructuredSchema(t, fallbackArea || t?.area || '');
    return { ...schema, perSource: [schema.sections] };
  }
  return mergeStructuredSchemas(
    valid.map((t) => ({
      schema: deriveStructuredSchema(t, t.area || fallbackArea),
      examName: t.name,
    }))
  );
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
    // Seção normalable em estado 'normal' → emite a normalidade e, junto, a
    // biometria registrada mesmo na normalidade (campos `alwaysShow`).
    if (section.normalable && sectionState(vals, section.id) === 'normal') {
      lines.push(`${section.label}: sem alterações${section.normalText ? ` (${section.normalText})` : ''}`);
      filledCount++;
      for (const field of section.fields) {
        if (!field.alwaysShow) continue;
        const text = fieldValueToText(vals[field.id]);
        if (!text) continue;
        filledCount++;
        lines.push(`  - ${field.label}: ${withUnit(field, text)}`);
      }
      continue;
    }

    const sectionLines: string[] = [];

    // Campos FIXOS da seção (não valem para seções-lista puras, cujos `fields`
    // pertencem a cada item — esses são emitidos como container abaixo).
    if (!section.repeatable) {
      for (const field of section.fields) {
        const text = fieldValueToText(vals[field.id]);
        if (!text) continue;
        filledCount++;
        sectionLines.push(`  - ${field.label}: ${withUnit(field, text)}`);
      }
    }

    // Containers repetíveis: seção-lista pura e/ou grupo de lesões aninhado.
    for (const container of sectionRepeatContainers(section)) {
      const n = itemCount(vals, container.containerId);
      for (let i = 0; i < n; i++) {
        const itemLines: string[] = [];
        for (const field of container.fields) {
          const text = fieldValueToText(vals[itemFieldId(container.containerId, i, field.id)]);
          if (!text) continue;
          filledCount++;
          itemLines.push(`    - ${field.label}: ${withUnit(field, text)}`);
        }
        if (itemLines.length) {
          sectionLines.push(`  ${container.itemLabel || 'Item'} ${i + 1}:`);
          sectionLines.push(...itemLines);
        }
      }
    }

    if (sectionLines.length) {
      lines.push(`${section.label}:`);
      lines.push(...sectionLines);
    }
  }
  return { lines, filledCount };
}
