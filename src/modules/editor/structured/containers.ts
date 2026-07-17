import { StructuredSection, StructuredFieldDef, StructuredSchema } from '../../../types';
import { groupContainerId } from './structuredKeys';

/**
 * Container REPETÍVEL uniforme — abstrai as duas formas de lista do estruturado:
 * - seção-lista pura (`section.repeatable`), e
 * - grupo aninhado numa seção (`section.repeatGroup`).
 *
 * Assim o renderizador, a compilação e o cálculo ao vivo iteram itens de um
 * único jeito, independentemente da forma. O `containerId` é a chave usada nas
 * funções de `structuredKeys` (countKey/itemFieldId).
 */
export interface RepeatContainer {
  /** Id usado nas chaves de armazenamento (section.id ou section.id#group.id). */
  containerId: string;
  /** Seção dona (para agrupar derivações/compilação). */
  sectionId: string;
  itemLabel?: string;
  addLabel?: string;
  score?: 'tirads' | 'birads' | 'orads' | 'bosniak';
  fields: StructuredFieldDef[];
  /** true quando é um grupo aninhado sob uma seção `normalable` (some quando 'Normal'). */
  nested: boolean;
}

/** Containers repetíveis de UMA seção (lista pura e/ou grupo aninhado). */
export function sectionRepeatContainers(section: StructuredSection): RepeatContainer[] {
  const out: RepeatContainer[] = [];
  if (section.repeatable) {
    out.push({
      containerId: section.id,
      sectionId: section.id,
      itemLabel: section.itemLabel,
      score: section.score,
      fields: section.fields,
      nested: false,
    });
  }
  if (section.repeatGroup) {
    const g = section.repeatGroup;
    out.push({
      containerId: groupContainerId(section.id, g.id),
      sectionId: section.id,
      itemLabel: g.itemLabel,
      addLabel: g.addLabel,
      score: g.score,
      fields: g.fields,
      nested: true,
    });
  }
  return out;
}

/** Resolve um container pelo seu id (para os handlers de add/remove). */
export function findRepeatContainer(
  schema: StructuredSchema,
  containerId: string
): RepeatContainer | null {
  for (const section of schema.sections) {
    const found = sectionRepeatContainers(section).find((c) => c.containerId === containerId);
    if (found) return found;
  }
  return null;
}
