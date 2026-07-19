import { Calculator, Sparkles, Loader2, RotateCcw, LayoutGrid, Zap, CheckCircle2, Plus, X, Ruler } from 'lucide-react';
import { classNames } from '../../../utils/format';
import {
  StructuredSchema,
  StructuredFieldDef,
  StructuredFieldValue,
} from '../../../types';
import { fieldValueToText } from '../structured/deriveSchema';
import { Derivation } from '../structured/liveCompute';
import { itemCount, itemFieldId, normalKey } from '../structured/structuredKeys';
import { effectiveSectionState, isAutoAltered, fieldDefAbnormal } from '../structured/abnormalRange';
import { sectionRepeatContainers, RepeatContainer } from '../structured/containers';

/**
 * Texto SEM trim, pro valor ao vivo do campo de digitação livre — fieldValueToText
 * corta espaço nas pontas (certo pra resumo/derivação), mas usado como `value`
 * do input controlado apagava o espaço que o médico acabava de digitar no fim
 * da frase a cada tecla (o input re-renderiza com o valor "corrigido" antes de
 * ele conseguir digitar o próximo caractere).
 */
function rawFieldText(v: StructuredFieldValue | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v.text || '';
}

interface StructuredTabProps {
  schema: StructuredSchema;
  values: Record<string, StructuredFieldValue>;
  onChange: (fieldId: string, value: StructuredFieldValue) => void;
  onOpenCalc: (calcId: string, fieldId: string, label: string) => void;
  onCompile: () => void;
  onSectionNormal: (sectionId: string) => void;
  onAddItem: (sectionId: string) => void;
  onRemoveItem: (sectionId: string, index: number) => void;
  derivations: Derivation[];
  isGenerating: boolean;
  filledCount: number;
  /** Pré-visualização (ex.: dentro do editor de máscara): oculta o rodapé de compilar. */
  preview?: boolean;
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

/** Multisseleção como chips (valor = opções separadas por vírgula). */
function MultiSelectInput({
  field,
  value,
  onChange,
}: {
  field: StructuredFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join(', '));
  };
  return (
    <div className="flex flex-wrap gap-1">
      {field.options?.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={classNames(
              'px-2 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95',
              on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink-600 border-ink-200 hover:border-brand-300'
            )}
          >
            {o}
          </button>
        );
      })}
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
  const rawText = rawFieldText(value);

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
  } else if (field.kind === 'multiselect') {
    control = <div className="flex-1 min-w-0"><MultiSelectInput field={field} value={asText} onChange={onChange} /></div>;
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
    control = <div className="flex-1 min-w-0"><TextLikeInput field={field} value={rawText} onChange={onChange} /></div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest flex items-center gap-1.5">
        {field.label}
        {(field.normal || field.normalOption) && (
          fieldDefAbnormal(field, rawText) ? (
            <span className="px-1 py-px rounded bg-amber-100 border border-amber-300 text-amber-700 text-[8px] font-black normal-case tracking-normal">
              alterado{field.normal ? ` (normal: ${field.normal})` : ''}
            </span>
          ) : field.normal ? (
            <span className="px-1 py-px rounded bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-bold normal-case tracking-normal">
              normal: {field.normal}
            </span>
          ) : null
        )}
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
  onSectionNormal,
  onAddItem,
  onRemoveItem,
  derivations,
  isGenerating,
  filledCount,
  preview,
}: StructuredTabProps) {
  const derivBySection = derivations.reduce<Record<string, Derivation[]>>((acc, d) => {
    (acc[d.sectionId] = acc[d.sectionId] || []).push(d);
    return acc;
  }, {});

  /** Grade de campos usando um mapeador de id de armazenamento (identidade ou instância). */
  const renderGrid = (fields: StructuredFieldDef[], keyFor: (fieldId: string) => string) => (
    <div className="grid grid-cols-2 gap-2.5">
      {fields.filter((field) => {
        if (!field.showIf) return true;
        const cur = fieldValueToText(values[keyFor(field.showIf.field)]);
        return field.showIf.equals != null ? cur === field.showIf.equals : !!cur;
      }).map((field) => (
        <div key={field.id} className={classNames(field.kind === 'triplet' || field.kind === 'calc' || field.kind === 'multiselect' || field.fullWidth ? 'col-span-2' : '')}>
          <FieldRenderer
            field={field}
            value={values[keyFor(field.id)]}
            onChange={(v) => onChange(keyFor(field.id), v)}
            onOpenCalc={(cid, _fid, label) => onOpenCalc(cid, keyFor(field.id), label)}
          />
        </div>
      ))}
    </div>
  );

  /** Lista de itens repetíveis (seção-lista pura OU grupo de lesões aninhado). */
  const renderRepeatList = (container: RepeatContainer) => {
    const count = itemCount(values, container.containerId);
    return (
      <div className="p-3 space-y-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-ink-100 bg-ink-50/40 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">{container.itemLabel || 'Item'} {i + 1}</span>
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveItem(container.containerId, i)}
                  className="w-5 h-5 rounded-md text-ink-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                  title="Remover"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {renderGrid(container.fields, (fid) => itemFieldId(container.containerId, i, fid))}
            {derivations
              .filter((d) => d.id.includes(`${container.containerId}@${i}`))
              .map((d) => (
                <div key={d.id} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-2.5 py-1.5">
                  <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wide">{d.label}</span>
                  <span className={classNames('text-[11px] font-black', d.alert ? 'text-red-600' : 'text-emerald-800')}>{d.text}</span>
                </div>
              ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onAddItem(container.containerId)}
          className="w-full h-9 rounded-xl border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
        >
          <Plus size={13} /> {container.addLabel || `Adicionar ${container.itemLabel || 'item'}`}
        </button>
      </div>
    );
  };
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
        {schema.sections.map((section) => {
          const isNormal = section.normalable && effectiveSectionState(section, values) === 'normal';
          const autoAltered = section.normalable && isAutoAltered(section, values);
          return (
          <div key={section.id} className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm">
            <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-ink-100">
              <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">{section.label}</span>
              <div className="flex items-center gap-1.5">
                {autoAltered && (
                  <span className="px-1.5 py-px rounded bg-amber-100 border border-amber-300 text-amber-700 text-[8px] font-black uppercase tracking-wide" title="Alterado automaticamente por valor fora da faixa">auto</span>
                )}
                {section.normalable ? (
                  <div className="flex items-center rounded-lg border border-ink-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onChange(normalKey(section.id), 'normal')}
                      className={classNames('px-2 py-1 text-[9px] font-black uppercase tracking-wide transition-colors', isNormal ? 'bg-emerald-500 text-white' : 'bg-white text-ink-500 hover:bg-ink-50')}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(normalKey(section.id), 'altered')}
                      className={classNames('px-2 py-1 text-[9px] font-black uppercase tracking-wide transition-colors', !isNormal ? 'bg-amber-500 text-white' : 'bg-white text-ink-500 hover:bg-ink-50')}
                    >
                      Alterado
                    </button>
                  </div>
                ) : !section.repeatable ? (
                  <button
                    type="button"
                    onClick={() => onSectionNormal(section.id)}
                    title="Preencher campos vazios como normais"
                    className="h-6 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1 active:scale-95"
                  >
                    <CheckCircle2 size={10} />
                    Normal
                  </button>
                ) : null}
                {section.calcId && !isNormal && (
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
            </div>

            {isNormal ? (
              <>
                <div className="px-3.5 py-2.5 text-[11px] font-semibold text-emerald-700/80 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" /> Sem alterações{section.normalText ? ` — ${section.normalText}` : ''}.
                </div>
                {/* Biometria que se registra mesmo na normalidade (dimensões, volume, índices). */}
                {section.fields.some((f) => f.alwaysShow) && (
                  <div className="px-3 pb-1">
                    <div className="mb-1.5 flex items-center gap-1 text-[8px] font-black text-ink-400 uppercase tracking-widest">
                      <Ruler size={9} /> Medidas do exame
                    </div>
                    {renderGrid(section.fields.filter((f) => f.alwaysShow), (fid) => fid)}
                  </div>
                )}
              </>
            ) : section.repeatable ? (
              // Seção-lista pura (nódulos/lesões como a seção inteira).
              renderRepeatList(sectionRepeatContainers(section)[0])
            ) : (
              // Seção com campos fixos + (opcional) grupo de lesões repetível aninhado.
              <>
                {section.fields.length > 0 && <div className="p-3 pb-1">{renderGrid(section.fields, (fid) => fid)}</div>}
                {sectionRepeatContainers(section)
                  .filter((c) => c.nested)
                  .map((c) => (
                    <div key={c.containerId} className="mt-1 mx-3 mb-1 rounded-xl border border-ink-100 bg-ink-50/30">
                      <div className="px-3 pt-2 flex items-center gap-1.5 text-[9px] font-black text-ink-500 uppercase tracking-widest">
                        <Plus size={10} className="text-brand-500" /> {c.itemLabel ? `${c.itemLabel}s` : 'Lesões'}
                      </div>
                      {renderRepeatList(c)}
                    </div>
                  ))}
              </>
            )}

            {/* Cálculos automáticos de campos FIXOS da seção (itens têm o seu inline).
                Vale também em 'Normal': a biometria registrada segue calculando. */}
            {!section.repeatable && derivBySection[section.id]?.filter((d) => !d.id.includes('@')).length > 0 && (
              <div className="mx-3 mb-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 px-3 py-2 space-y-1">
                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-700 uppercase tracking-widest">
                  <Zap size={9} /> Cálculo automático
                </div>
                {derivBySection[section.id].filter((d) => !d.id.includes('@')).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-emerald-800/80">{d.label}</span>
                    <span className={classNames('text-[11px] font-black tabular-nums', d.alert ? 'text-red-600' : 'text-emerald-800')}>{d.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {preview ? (
        <div className="p-3 pb-4 bg-ink-50/60 border-t border-ink-100 shrink-0">
          <p className="text-center text-[10px] text-ink-500 font-semibold flex items-center justify-center gap-1.5">
            <LayoutGrid size={11} className="text-brand-500" /> Pré-visualização do formulário estruturado desta máscara — preenchível no Copiloto de cada exame.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
