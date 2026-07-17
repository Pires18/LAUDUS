import { useState, useMemo } from 'react';
import { ReportTemplate, StructuredFieldValue } from '../../../types';
import { StructuredTab } from './StructuredTab';
import { deriveStructuredSchema, summarizeStructured } from '../structured/deriveSchema';
import { computeDerivations } from '../structured/liveCompute';
import { itemCount, itemFieldId, countKey } from '../structured/structuredKeys';
import { findRepeatContainer } from '../structured/containers';

/**
 * Pré-visualização interativa do formulário estruturado derivado de uma máscara.
 * Usado no editor de máscaras (aba "Estruturado") — estado local, sem persistir
 * nem chamar a IA. Reaproveita 100% do renderizador `StructuredTab`.
 */
export function StructuredPreview({ template }: { template: ReportTemplate | null }) {
  const [values, setValues] = useState<Record<string, StructuredFieldValue>>({});
  const area = template?.area || '';

  const schema = useMemo(() => deriveStructuredSchema(template, area), [template, area]);
  const derivations = useMemo(() => computeDerivations(schema, values, Date.now()), [schema, values]);
  const summary = useMemo(() => summarizeStructured(schema, values), [schema, values]);

  const onChange = (fieldId: string, value: StructuredFieldValue) =>
    setValues((v) => ({ ...v, [fieldId]: value }));

  const onSectionNormal = (sectionId: string) => {
    const section = schema.sections.find((s) => s.id === sectionId);
    if (!section) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const f of section.fields) {
        const cur = next[f.id];
        const has = typeof cur === 'string' ? cur.trim() : cur?.text;
        if (has) continue;
        if ((f.kind === 'measure' || f.kind === 'triplet') && f.normal) next[f.id] = f.normal;
        else if (f.kind === 'text') next[f.id] = f.placeholder || 'sem alterações';
        else if (f.kind === 'select' && f.options?.length) next[f.id] = f.options[0];
      }
      return next;
    });
  };

  const onAddItem = (containerId: string) =>
    setValues((v) => ({ ...v, [countKey(containerId)]: String(Math.min(itemCount(v, containerId) + 1, 20)) }));

  const onRemoveItem = (containerId: string, index: number) => {
    const container = findRepeatContainer(schema, containerId);
    if (!container) return;
    setValues((prev) => {
      const n = itemCount(prev, containerId);
      const next = { ...prev };
      for (let i = index; i < n - 1; i++) {
        for (const f of container.fields) {
          const from = itemFieldId(containerId, i + 1, f.id);
          const to = itemFieldId(containerId, i, f.id);
          if (from in next) next[to] = next[from];
          else delete next[to];
        }
      }
      for (const f of container.fields) delete next[itemFieldId(containerId, n - 1, f.id)];
      next[countKey(containerId)] = String(Math.max(1, n - 1));
      return next;
    });
  };

  return (
    <div className="flex flex-col h-[70vh] min-h-[420px] rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm">
      <StructuredTab
        schema={schema}
        values={values}
        onChange={onChange}
        onOpenCalc={() => {}}
        onCompile={() => {}}
        onSectionNormal={onSectionNormal}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
        derivations={derivations}
        isGenerating={false}
        filledCount={summary.filledCount}
        preview
      />
    </div>
  );
}
