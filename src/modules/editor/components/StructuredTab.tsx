import { Calculator, Sparkles, Loader2, RotateCcw, LayoutGrid } from 'lucide-react';
import { classNames } from '../../../utils/format';
import {
  StructuredSchema,
  StructuredFieldDef,
  StructuredFieldValue,
} from '../../../types';
import { fieldValueToText } from '../structured/deriveSchema';

interface StructuredTabProps {
  schema: StructuredSchema;
  values: Record<string, StructuredFieldValue>;
  onChange: (fieldId: string, value: StructuredFieldValue) => void;
  onOpenCalc: (calcId: string, fieldId: string, label: string) => void;
  onCompile: () => void;
  isGenerating: boolean;
  filledCount: number;
}

/** Renderiza um input de medida/texto com sufixo de unidade opcional. */
function TextLikeInput({
  field,
  value,
  onChange,
}: {
  field: StructuredFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-stretch">
      <input
        type="text"
        inputMode={field.kind === 'measure' ? 'decimal' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || (field.kind === 'measure' ? '—' : 'descrever')}
        className="h-8 flex-1 min-w-0 px-2 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-medium text-ink-800 placeholder-ink-300 outline-none transition-all"
      />
      {field.unit && (
        <span className="ml-1 flex items-center px-1.5 rounded-lg bg-ink-50 border border-ink-100 text-[9px] font-black text-ink-400 uppercase tracking-wide shrink-0">
          {field.unit}
        </span>
      )}
    </div>
  );
}

/** Três medidas (C × L × A) combinadas numa string "a x b x c". */
function TripletInput({
  field,
  value,
  onChange,
}: {
  field: StructuredFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const parts = value ? value.split(/\s*x\s*/i) : ['', '', ''];
  const setPart = (i: number, v: string) => {
    const next = [parts[0] || '', parts[1] || '', parts[2] || ''];
    next[i] = v;
    const anyFilled = next.some((p) => p.trim());
    onChange(anyFilled ? next.map((p) => p.trim()).join(' x ') : '');
  };
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <input
          key={i}
          type="text"
          inputMode="decimal"
          value={parts[i] || ''}
          onChange={(e) => setPart(i, e.target.value)}
          placeholder="—"
          className="h-8 w-full min-w-0 px-1.5 text-center bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-medium text-ink-800 placeholder-ink-300 outline-none transition-all"
        />
      ))}
      {field.unit && (
        <span className="flex items-center px-1.5 h-8 rounded-lg bg-ink-50 border border-ink-100 text-[9px] font-black text-ink-400 uppercase tracking-wide shrink-0">
          {field.unit}
        </span>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  onOpenCalc,
}: {
  field: StructuredFieldDef;
  value: StructuredFieldValue | undefined;
  onChange: (v: StructuredFieldValue) => void;
  onOpenCalc: (calcId: string, fieldId: string, label: string) => void;
}) {
  const asText = fieldValueToText(value);

  const calcButton = field.calcId && (
    <button
      type="button"
      onClick={() => onOpenCalc(field.calcId!, field.id, field.label)}
      title="Abrir calculadora"
      className="h-8 px-2 shrink-0 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1 active:scale-95"
    >
      <Calculator size={12} />
      <span className="text-[9px] font-black uppercase tracking-wide">Calc</span>
    </button>
  );

  let control: React.ReactNode;
  if (field.kind === 'select') {
    control = (
      <select
        value={asText}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 min-w-0 px-2 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-medium text-ink-800 outline-none transition-all"
      >
        <option value="">—</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === 'triplet') {
    control = <div className="flex-1 min-w-0"><TripletInput field={field} value={asText} onChange={onChange} /></div>;
  } else if (field.kind === 'calc') {
    control = (
      <div className="flex-1 min-w-0">
        <div className="min-h-8 px-2 py-1.5 bg-ink-50 border border-ink-200 rounded-lg text-xs font-medium text-ink-700 leading-snug whitespace-pre-wrap">
          {asText || <span className="text-ink-300">Use a calculadora →</span>}
        </div>
      </div>
    );
  } else {
    control = <div className="flex-1 min-w-0"><TextLikeInput field={field} value={asText} onChange={onChange} /></div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest">
        {field.label}
      </label>
      <div className="flex items-start gap-1.5">
        {control}
        {calcButton}
      </div>
      {field.hint && <span className="text-[9px] text-ink-400 font-medium leading-tight">{field.hint}</span>}
    </div>
  );
}

export function StructuredTab({
  schema,
  values,
  onChange,
  onOpenCalc,
  onCompile,
  isGenerating,
  filledCount,
}: StructuredTabProps) {
  if (!schema.sections.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-ink-100 flex items-center justify-center mb-3">
          <LayoutGrid size={22} className="text-ink-400" />
        </div>
        <p className="text-xs text-ink-500 font-medium max-w-[240px]">
          Este exame ainda não possui um formulário estruturado. Use a aba Formulário ou o Chat.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {schema.sections.map((section) => (
          <div key={section.id} className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm">
            <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-ink-100">
              <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">{section.label}</span>
              {section.calcId && (
                <button
                  type="button"
                  onClick={() => onOpenCalc(section.calcId!, `${section.id}__section`, section.label)}
                  className="h-6 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 active:scale-95"
                >
                  <Calculator size={10} />
                  Calc.
                </button>
              )}
            </div>
            <div className="p-3 grid grid-cols-2 gap-2.5">
              {section.fields.map((field) => (
                <div key={field.id} className={classNames(field.kind === 'triplet' || field.kind === 'calc' ? 'col-span-2' : '')}>
                  <FieldRenderer
                    field={field}
                    value={values[field.id]}
                    onChange={(v) => onChange(field.id, v)}
                    onOpenCalc={onOpenCalc}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 pb-4 bg-white border-t border-ink-100 shrink-0">
        <button
          onClick={onCompile}
          disabled={isGenerating || filledCount === 0}
          className="w-full h-11 rounded-2xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Processando...
            </>
          ) : (
            <>
              <Sparkles size={15} /> Processar e Integrar ao Laudo
              {filledCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black">{filledCount}</span>
              )}
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[9px] text-ink-400 font-medium flex items-center justify-center gap-1">
          <RotateCcw size={9} /> Campos vazios são ignorados — a IA preenche apenas o informado.
        </p>
      </div>
    </div>
  );
}
