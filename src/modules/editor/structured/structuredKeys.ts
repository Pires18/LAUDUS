import { StructuredFieldValue } from '../../../types';

/**
 * Convenções de chave no mapa plano `structuredValue` para suportar:
 * - Seções Normal/Alterado → chave `__n:<sectionId>` = 'normal' | 'altered'
 * - Seções repetíveis → contagem `__c:<sectionId>` e campos por instância
 *   com id composto `<sectionId>@<index>@<fieldId>`.
 */

export const normalKey = (sectionId: string) => `__n:${sectionId}`;
export const countKey = (containerId: string) => `__c:${containerId}`;
export const itemFieldId = (containerId: string, index: number, fieldId: string) =>
  `${containerId}@${index}@${fieldId}`;

/**
 * Id de container de um grupo repetível ANINHADO numa seção. Usa `#` como
 * separador (o `@` já separa instância/campo), então as chaves de item ficam
 * `<sectionId>#<groupId>@<i>@<fieldId>` — sem colisão com os campos fixos da
 * seção (`<fieldId>`) nem com uma seção-lista pura (`<sectionId>@<i>@<fieldId>`).
 */
export const groupContainerId = (sectionId: string, groupId: string) =>
  `${sectionId}#${groupId}`;

export function isInternalKey(key: string): boolean {
  return key.startsWith('__');
}

function asText(v: StructuredFieldValue | undefined): string {
  if (v == null) return '';
  return (typeof v === 'string' ? v : v.text || '').trim();
}

/** Estado de uma seção normalable: 'normal' (default) ou 'altered'. */
export function sectionState(
  values: Record<string, StructuredFieldValue> | undefined,
  sectionId: string
): 'normal' | 'altered' {
  return asText(values?.[normalKey(sectionId)]) === 'altered' ? 'altered' : 'normal';
}

/** Nº de instâncias de uma seção repetível (default 1). */
export function itemCount(
  values: Record<string, StructuredFieldValue> | undefined,
  sectionId: string
): number {
  const raw = asText(values?.[countKey(sectionId)]);
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 0) return 1;
  return Math.min(n, 20);
}
