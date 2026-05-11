import { useState } from 'react';
import { FormField, FormFieldType } from '../../types';
import { Plus, Trash2, X, ChevronUp, ChevronDown, GripVertical, Settings2, GripHorizontal } from 'lucide-react';
import { classNames } from '../../utils/format';
import { genId } from '../../store/db';
import { CALCULATORS } from '../calculators/registry';

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string; group: string }[] = [
  { value: 'separator', label: 'Separador (Título de Seção)', group: 'Layout' },
  { value: 'text', label: 'Texto Curto', group: 'Texto' },
  { value: 'textarea', label: 'Texto Longo', group: 'Texto' },
  { value: 'number', label: 'Número', group: 'Numérico' },
  { value: 'measurement', label: 'Medida (Valor + Unidade)', group: 'Numérico' },
  { value: 'select', label: 'Seleção Única (Dropdown)', group: 'Múltipla Escolha' },
  { value: 'multiselect', label: 'Seleção Múltipla', group: 'Múltipla Escolha' },
  { value: 'radio', label: 'Botões de Rádio', group: 'Múltipla Escolha' },
  { value: 'checkbox', label: 'Caixa de Seleção (Sim/Não)', group: 'Múltipla Escolha' },
  { value: 'date', label: 'Data', group: 'Outros' },
  { value: 'calculator', label: 'Calculadora Integrada', group: 'Módulos Avançados' },
];

interface FieldBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  function addField() {
    const newField: FormField = { id: genId(), type: 'text', label: 'Novo campo' };
    onChange([...fields, newField]);
  }

  function updateField(idx: number, patch: Partial<FormField>) {
    onChange(fields.map((f, i) => i === idx ? { ...f, ...patch } : f));
  }

  function removeField(idx: number) {
    onChange(fields.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const arr = [...fields];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr);
  }

  return (
    <div className="card p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4 border-b border-ink-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-ink-900">Campos do Formulário</h3>
          <p className="text-xs text-ink-500 mt-1">
            Construa o formulário de preenchimento que aparecerá ao lado do laudo.
          </p>
        </div>
        <button onClick={addField} className="btn-primary text-sm shrink-0">
          <Plus size={16} /> Adicionar Campo
        </button>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto px-1 pb-4">
        {fields.length === 0 && (
          <div className="text-center py-12 bg-ink-50 rounded-xl border-2 border-dashed border-ink-200 text-ink-400">
            Nenhum campo. Comece adicionando o primeiro!
          </div>
        )}
        {fields.map((field, idx) => (
          <FieldRow
            key={field.id}
            field={field}
            isFirst={idx === 0}
            isLast={idx === fields.length - 1}
            onChange={(patch) => updateField(idx, patch)}
            onRemove={() => removeField(idx)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldRowProps {
  field: FormField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FieldRow({ field, isFirst, isLast, onChange, onRemove, onMoveUp, onMoveDown }: FieldRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOptions = ['select', 'multiselect', 'radio'].includes(field.type);
  const isSeparator = field.type === 'separator';

  return (
    <div className={classNames(
      'border rounded-xl transition-all shadow-sm overflow-hidden',
      isSeparator ? 'border-brand-300 bg-brand-50/50' : 'border-ink-200 bg-white hover:border-ink-300'
    )}>
      {/* HEADER DA LINHA */}
      <div className={classNames("flex items-center p-3 gap-3", isSeparator ? "bg-brand-100/30" : "")}>
        {/* Controles de Ordenação */}
        <div className="flex flex-col gap-1 items-center bg-ink-50 rounded-md p-1 border border-ink-100">
          <button onClick={onMoveUp} disabled={isFirst} className="text-ink-400 hover:text-brand-600 disabled:opacity-20 transition-colors"><ChevronUp size={14} strokeWidth={3} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-ink-400 hover:text-brand-600 disabled:opacity-20 transition-colors"><ChevronDown size={14} strokeWidth={3} /></button>
        </div>

        {/* Input Principal */}
        <div className="flex-1 flex items-center gap-3">
          {isSeparator && <div className="text-[10px] uppercase font-bold text-brand-600 tracking-wider bg-brand-100 px-2 py-1 rounded">Seção</div>}
          <input
            className={classNames(
              "flex-1 bg-transparent border-b border-dashed focus:border-solid px-1 py-1 transition-all outline-none",
              isSeparator ? "text-brand-900 font-bold border-brand-300 focus:border-brand-500 text-sm" : "text-ink-900 font-medium border-ink-200 focus:border-brand-500 text-sm"
            )}
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder={isSeparator ? "Nome da Seção (Ex: Medidas do Feto)" : "Nome do Campo (Ex: Ovário Direito)"}
          />
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-ink-400 bg-ink-100 px-2 py-1 rounded hidden sm:inline-block truncate max-w-[120px]">
            {FIELD_TYPE_OPTIONS.find(o => o.value === field.type)?.label}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className={classNames(
              "p-2 rounded-lg transition-colors flex items-center gap-1",
              expanded ? "bg-brand-100 text-brand-700" : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            )}
            title="Configurações Avançadas"
          >
            <Settings2 size={16} />
          </button>
          <button onClick={onRemove} className="p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Excluir">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ÁREA EXPANDIDA (CONFIGURAÇÕES) */}
      {expanded && (
        <div className="p-4 border-t border-ink-100 bg-ink-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo do Campo</label>
              <select
                className="input text-sm"
                value={field.type}
                onChange={e => onChange({ type: e.target.value as FormFieldType })}
              >
                {/* Agrupamento por categorias */}
                <optgroup label="Layout">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Layout').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Texto">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Texto').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Numérico">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Numérico').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Múltipla Escolha">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Múltipla Escolha').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Outros">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Outros').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label="Módulos Avançados">
                  {FIELD_TYPE_OPTIONS.filter(o => o.group === 'Módulos Avançados').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
            </div>

            {field.type === 'calculator' && (
              <div>
                <label className="label text-brand-600">Calculadora a Embutir</label>
                <select className="input text-sm border-brand-300" value={field.calculatorId ?? ''} onChange={e => onChange({ calculatorId: e.target.value })}>
                  <option value="">— selecione a calculadora —</option>
                  {CALCULATORS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            
            {field.type === 'measurement' && (
              <div>
                <label className="label">Unidade de Medida</label>
                <input className="input text-sm" value={field.unit ?? ''} onChange={e => onChange({ unit: e.target.value })} placeholder="Ex: mm, cm, ml, g" />
              </div>
            )}
            
            {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
              <div>
                <label className="label">Placeholder (Dica no campo vazio)</label>
                <input className="input text-sm" value={field.placeholder ?? ''} onChange={e => onChange({ placeholder: e.target.value })} placeholder="Ex: Digite o aspecto visual..." />
              </div>
            )}
          </div>

          {hasOptions && (
            <div className="mt-4 pt-4 border-t border-ink-200">
              <OptionsEditor
                options={field.options ?? []}
                onChange={opts => onChange({ options: opts })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: { value: string; label: string }[]; onChange: (o: { value: string; label: string }[]) => void }) {
  return (
    <div>
      <label className="label mb-2 flex items-center justify-between">
        <span>Opções de Escolha</span>
        <button
          onClick={() => onChange([...options, { value: '', label: '' }])}
          className="text-[11px] font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded flex items-center gap-1 transition-colors"
          type="button"
        >
          <Plus size={12} strokeWidth={3} /> Adicionar Opção
        </button>
      </label>
      
      {options.length === 0 ? (
        <div className="text-xs text-ink-400 bg-white border border-ink-200 rounded p-3 text-center">
          Nenhuma opção adicionada. Clique em "Adicionar Opção".
        </div>
      ) : (
        <div className="space-y-2 bg-white p-3 rounded-lg border border-ink-200">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2 items-center group">
              <GripHorizontal size={14} className="text-ink-300 group-hover:text-ink-500 cursor-ns-resize" />
              <input
                className="flex-1 text-sm border-b border-ink-200 focus:border-brand-500 outline-none px-1 py-1"
                placeholder="Rótulo da opção (Ex: Normal)"
                value={o.label}
                onChange={e => {
                  const next = [...options];
                  next[i] = { ...o, label: e.target.value, value: o.value || e.target.value.toLowerCase().replace(/\s+/g, '-') };
                  onChange(next);
                }}
              />
              <button
                onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                className="text-ink-300 hover:bg-red-50 hover:text-red-600 p-1 rounded transition-colors"
                title="Remover opção"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
