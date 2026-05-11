import { FormField } from '../../types';
import { CALCULATORS } from '../calculators/registry';

interface Props {
  fields: FormField[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (fieldId: string, value: any) => void;
  disabled?: boolean;
}

export function DynamicForm({ fields, values, onChange, disabled = false }: Props) {
  function shouldShow(field: FormField): boolean {
    if (!field.conditionalOn) return true;
    return values[field.conditionalOn.fieldId] === field.conditionalOn.value;
  }

  return (
    <fieldset disabled={disabled} className="space-y-3 group disabled:opacity-70">
      {fields.map(field => {
        if (!shouldShow(field)) return null;

        if (field.type === 'separator') {
          return (
            <div key={field.id} className="pt-5 pb-2 first:pt-0">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-brand-700 whitespace-nowrap">
                  {field.label}
                </h4>
                <div className="h-[2px] bg-brand-100 w-full rounded-full" />
              </div>
            </div>
          );
        }

        const value = values[field.id];
        const set = (v: any) => onChange(field.id, v);

        return (
          <div key={field.id} className="pb-1">
            {field.type !== 'calculator' && (
              <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
            )}

            {field.type === 'text' && (
              <input className="input" placeholder={field.placeholder} value={value ?? ''} onChange={e => set(e.target.value)} />
            )}
            {field.type === 'textarea' && (
              <textarea className="input min-h-[70px] resize-none" rows={3} placeholder={field.placeholder} value={value ?? ''} onChange={e => set(e.target.value)} />
            )}
            {field.type === 'number' && (
              <input type="number" className="input" placeholder={field.placeholder} value={value ?? ''} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} />
            )}
            {field.type === 'date' && (
              <input type="date" className="input" value={value ?? ''} onChange={e => set(e.target.value)} />
            )}
            {field.type === 'select' && (
              <select className="input" value={value ?? ''} onChange={e => set(e.target.value)}>
                <option value="">— selecione —</option>
                {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {field.type === 'radio' && (
              <div className="flex flex-wrap gap-3">
                {field.options?.map(o => (
                  <label key={o.value} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={value === o.value} onChange={() => set(o.value)} className="accent-brand-600" />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
            {field.type === 'multiselect' && (
              <div className="flex flex-wrap gap-2">
                {field.options?.map(o => {
                  const arr: string[] = Array.isArray(value) ? value : [];
                  const checked = arr.includes(o.value);
                  return (
                    <label key={o.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${checked ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        className="accent-brand-600"
                        onChange={() => {
                          const next = checked ? arr.filter(v => v !== o.value) : [...arr, o.value];
                          set(next);
                        }}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            )}
            {field.type === 'checkbox' && (
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} className="accent-brand-600 w-4 h-4" />
                <span className="text-ink-700">Sim</span>
              </label>
            )}
            {field.type === 'measurement' && (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  className="input flex-1"
                  placeholder="valor"
                  value={value?.value ?? ''}
                  onChange={e => set({ value: e.target.value === '' ? '' : Number(e.target.value), unit: value?.unit ?? field.unit })}
                />
                <input
                  className="input w-24"
                  placeholder="un."
                  value={value?.unit ?? field.unit ?? ''}
                  onChange={e => set({ value: value?.value, unit: e.target.value })}
                />
              </div>
            )}
            {field.type === 'calculator' && field.calculatorId && (
              <div className="mt-2 mb-4">
                <CalculatorRenderer 
                  calculatorId={field.calculatorId}
                  value={value}
                  onChange={set}
                />
              </div>
            )}
            
            {field.helpText && <p className="text-xs text-ink-500 mt-1">{field.helpText}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}

// Subcomponente para renderizar a calculadora
function CalculatorRenderer({ calculatorId, value, onChange }: { calculatorId: string, value: any, onChange: (val: any) => void }) {
  const calc = CALCULATORS.find(c => c.id === calculatorId);
  if (!calc) return <div className="text-xs text-red-500">Calculadora não encontrada. {calculatorId}</div>;
  const Component = calc.component;
  return (
    <div className="py-1">
      <Component value={value} onChange={onChange} />
    </div>
  );
}
