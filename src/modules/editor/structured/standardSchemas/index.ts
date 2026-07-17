import { StructuredSection } from '../../../../types';
import { StandardSchemaDef } from './types';
import { MEDICINA_INTERNA_SCHEMAS } from './medicinaInterna';
import { PEQUENAS_PARTES_SCHEMAS } from './pequenasPartes';
import { GINECOLOGIA_SCHEMAS } from './ginecologia';
import { MASTOLOGIA_SCHEMAS } from './mastologia';
import { MEDICINA_FETAL_SCHEMAS } from './medicinaFetal';
import { VASCULAR_SCHEMAS } from './vascular';
import { PEDIATRIA_SCHEMAS } from './pediatria';
import { MUSCULOESQUELETICO_SCHEMAS } from './musculoesqueletico';
import { REUMATOLOGICO_SCHEMAS } from './reumatologico';
import { PROCEDIMENTOS_SCHEMAS } from './procedimentos';

/**
 * MODELOS PADRÃO de formulário estruturado por exame (curados por área).
 *
 * Resolução do esquema em deriveStructuredSchema:
 *   1. `template.structuredSchema` (personalizado na máscara) — prioridade total;
 *   2. MODELO PADRÃO desta biblioteca (área + nome do exame);
 *   3. parser genérico do analysisTemplate + enriquecimento da fieldLibrary.
 *
 * Rollout por área (plano em docs/roadmaps/PLANO_MODELOS_PADRAO_ESTRUTURADOS.md):
 * ROLLOUT COMPLETO — as 10 áreas têm modelo padrão curado, cobrindo as 71
 * máscaras do sistema. O parser (3) segue como rede de segurança para máscaras
 * novas/renomeadas que nenhuma regex capture.
 */
const BY_AREA: Record<string, StandardSchemaDef[]> = {
  'medicina-interna': MEDICINA_INTERNA_SCHEMAS,
  'pequenas-partes': PEQUENAS_PARTES_SCHEMAS,
  ginecologia: GINECOLOGIA_SCHEMAS,
  mastologia: MASTOLOGIA_SCHEMAS,
  'medicina-fetal': MEDICINA_FETAL_SCHEMAS,
  vascular: VASCULAR_SCHEMAS,
  pediatria: PEDIATRIA_SCHEMAS,
  musculoesqueletico: MUSCULOESQUELETICO_SCHEMAS,
  reumatologico: REUMATOLOGICO_SCHEMAS,
  procedimentos: PROCEDIMENTOS_SCHEMAS,
};

/** Normaliza o nome do exame para casamento (minúsculas, sem acentos). */
export function normalizeExamName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findStandardSchema(
  area: string,
  examName?: string
): { name: string; sections: StructuredSection[] } | null {
  if (!examName) return null;
  const defs = BY_AREA[area];
  if (!defs) return null;
  const n = normalizeExamName(examName);
  const def = defs.find((d) => d.match.test(n));
  return def ? { name: def.name, sections: def.sections() } : null;
}
