import { StructuredSchema, StructuredSection, StructuredFieldDef } from '../../../types';

/**
 * Esquema estruturado de um exame COMBINADO: as seções finais (já renomeadas
 * e dedupadas) mais o particionamento por máscara de origem, usado para
 * compilar o formulário em blocos por exame.
 */
export interface MergedStructuredSchema extends StructuredSchema {
  perSource: StructuredSection[][];
}

/** Assinatura de uma seção para dedupe: lista ordenada (posicional) dos field ids. */
const sectionSignature = (s: StructuredSection): string =>
  JSON.stringify([s.fields.map((f) => f.id), s.repeatGroup?.fields.map((f) => f.id) ?? []]);

const normLabel = (s: string): string => s.trim().toLowerCase();

/**
 * Mescla os esquemas estruturados de N máscaras num único formulário.
 *
 * Política de colisão (a PRIMEIRA ocorrência é canônica — ids canônicos que o
 * motor conhece, como `ir_d`/`prostata_dims`, permanecem intactos):
 * - Seção com mesmo id E mesmos field ids (na ordem) ⇒ duplicata exata,
 *   descartada (ex.: VRPM presente em Rins e Vias e em Próstata).
 * - Seção com mesmo id e campos diferentes ⇒ renomeada `${id}--${n}` e, se o
 *   rótulo também repetir, rotulada `${label} — ${examName}`.
 * - Field id repetido no escopo plano (seções não-repetíveis) ⇒ renomeado
 *   `${id}__${n}`, com reescrita dos `showIf` internos da seção. Campos de
 *   seções repetíveis e de `repeatGroup` são escopados por container e não
 *   precisam de renomeio.
 */
export function mergeStructuredSchemas(
  schemas: Array<{ schema: StructuredSchema; examName: string }>
): MergedStructuredSchema {
  const sections: StructuredSection[] = [];
  const perSource: StructuredSection[][] = [];
  const byId = new Map<string, StructuredSection>();
  const usedLabels = new Set<string>();
  const flatFieldIds = new Set<string>();

  schemas.forEach(({ schema, examName }, i) => {
    const n = i + 1;
    const mine: StructuredSection[] = [];

    for (const src of schema.sections) {
      const existing = byId.get(src.id);
      if (existing && sectionSignature(existing) === sectionSignature(src)) continue;

      let id = src.id;
      if (existing) {
        id = `${src.id}--${n}`;
        while (byId.has(id)) id += 'x';
      }

      let label = src.label;
      if (usedLabels.has(normLabel(label))) label = `${label} — ${examName}`;

      const rename = new Map<string, string>();
      const fields: StructuredFieldDef[] = src.fields.map((f) => {
        if (src.repeatable || !flatFieldIds.has(f.id)) return f;
        let fid = `${f.id}__${n}`;
        while (flatFieldIds.has(fid)) fid += 'x';
        rename.set(f.id, fid);
        return { ...f, id: fid };
      });
      const withShowIf = fields.map((f) => {
        const target = f.showIf && rename.get(f.showIf.field);
        return target ? { ...f, showIf: { ...f.showIf!, field: target } } : f;
      });
      if (!src.repeatable) for (const f of withShowIf) flatFieldIds.add(f.id);

      const merged: StructuredSection = { ...src, id, label, fields: withShowIf, sourceExam: examName };
      byId.set(id, merged);
      usedLabels.add(normLabel(merged.label));
      sections.push(merged);
      mine.push(merged);
    }
    perSource.push(mine);
  });

  return {
    area: schemas[0]?.schema.area ?? '',
    examName: schemas.map((s) => s.examName).join(' + '),
    sections,
    perSource,
  };
}
