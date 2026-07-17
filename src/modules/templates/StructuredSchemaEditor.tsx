import { useMemo, useState } from 'react';
import {
  ReportTemplate,
  StructuredSection,
  StructuredFieldDef,
  StructuredFieldKind,
  StructuredScoreKey,
} from '../../types';
import { deriveStructuredSchema } from '../editor/structured/deriveSchema';
import { findStandardSchema } from '../editor/structured/standardSchemas';
import { calculatorsForArea } from '../editor/structured/calcMap';
import { CALCULATORS } from '../calculators/registry';
import {
  newSection,
  newField,
  uniqueFieldId,
  uniqueSectionId,
  normalizeFieldId,
  validateStructuredSchema,
} from '../editor/structured/schemaEditing';
import { StructuredPreview } from '../editor/components/StructuredPreview';
import { classNames } from '../../utils/format';
import {
  Wand2, ListPlus, RotateCcw, Plus, X, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown, Settings2, Calculator, LayoutGrid, AlertTriangle, Repeat2, Eye, Ruler,
} from 'lucide-react';

/**
 * Editor COMPLETO do formulário estruturado de uma máscara (aba "Estruturado"
 * do editor de máscaras). Dois modos:
 * - AUTOMÁTICO (padrão): o esquema é derivado do analysisTemplate + biblioteca
 *   da área — nada é persistido; só exibe a pré-visualização.
 * - PERSONALIZADO: `template.structuredSchema` persistido na máscara e usado
 *   como está no Copiloto. Aqui se cria/edita/reordena seções e campos, liga
 *   calculadoras, escores, seções repetíveis e Normal/Alterado.
 */

const KIND_OPTIONS: { value: StructuredFieldKind; label: string }[] = [
  { value: 'measure', label: 'Medida' },
  { value: 'triplet', label: 'Dimensões (C×L×A)' },
  { value: 'text', label: 'Texto' },
  { value: 'select', label: 'Seleção' },
  { value: 'multiselect', label: 'Multi-seleção' },
  { value: 'calc', label: 'Calculadora' },
];

const SCORE_OPTIONS: { value: NonNullable<StructuredSection['score']> | ''; label: string }[] = [
  { value: '', label: '— sem escore —' },
  { value: 'tirads', label: 'ACR TI-RADS (tireoide)' },
  { value: 'birads', label: 'BI-RADS (mama)' },
  { value: 'orads', label: 'O-RADS (anexos)' },
  { value: 'bosniak', label: 'Bosniak (cisto renal)' },
];

const SCOREKEY_OPTIONS: { value: StructuredScoreKey | ''; label: string }[] = [
  { value: '', label: '— não pontua —' },
  { value: 'composition', label: 'Composição' },
  { value: 'echogenicity', label: 'Ecogenicidade' },
  { value: 'shape', label: 'Forma' },
  { value: 'margin', label: 'Margem' },
  { value: 'foci', label: 'Focos ecogênicos' },
];

const UNIT_SUGGESTIONS = ['mm', 'cm', 'cm³', 'cm/s', 'm/s', 'mL', 'bpm', 'g', '%', '°', 'mm²', 'ng/mL'];

/** Ids canônicos exibidos como dica — ativam cálculo automático no liveCompute. */
const CANONICAL_HINT =
  'dbp, dof, cc, ca, cf (biometria/PFE) · ccn, dmsg, dum (IG/DPP) · ip_au, ip_acm, psv_acm, rcp, ip_uta (Doppler) · ila, mbv, colo, nt · prostata_dims, vrpm · emi_d/emi_e, itb_d/itb_e · alfa_d/beta_d';

function CalcSelect({
  value, onChange, areaCalcs, otherCalcs, disabled, compact,
}: {
  value?: string;
  onChange: (calcId: string | undefined) => void;
  areaCalcs: typeof CALCULATORS;
  otherCalcs: typeof CALCULATORS;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <select
      className={classNames('input', compact && 'h-8 text-xs py-0')}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">— sem calculadora —</option>
      {areaCalcs.length > 0 && (
        <optgroup label="Calculadoras desta área">
          {areaCalcs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Outras áreas">
        {otherCalcs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
    </select>
  );
}

/** Textarea de opções (uma por linha) com commit no blur — evita perder linhas em digitação. */
function OptionsEditor({
  options, onCommit, disabled,
}: {
  options: string[];
  onCommit: (opts: string[]) => void;
  disabled?: boolean;
}) {
  const external = options.join('\n');
  const [text, setText] = useState(external);
  const [lastExternal, setLastExternal] = useState(external);
  if (external !== lastExternal) {
    setLastExternal(external);
    setText(external);
  }
  return (
    <textarea
      className="input min-h-[90px] font-mono text-xs leading-relaxed"
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.split('\n').map((s) => s.trim()).filter(Boolean))}
      placeholder={'uma opção por linha\nEx:\nausente\npresente'}
    />
  );
}

function IconBtn({
  onClick, title, danger, disabled, children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={classNames(
        'w-7 h-7 rounded-lg border flex items-center justify-center transition-all active:scale-95 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed',
        danger
          ? 'border-ink-200 text-ink-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
          : 'border-ink-200 text-ink-500 hover:text-ink-800 hover:bg-ink-50'
      )}
    >
      {children}
    </button>
  );
}

interface Props {
  draft: ReportTemplate;
  editable: boolean;
  onChange: (schema: { sections: StructuredSection[] } | null) => void;
}

export function StructuredSchemaEditor({ draft, editable, onChange }: Props) {
  const custom = draft.structuredSchema?.sections;
  const isCustom = Array.isArray(custom);
  const sections = useMemo(() => custom || [], [custom]);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openFields, setOpenFields] = useState<Set<string>>(new Set());

  // Modelo padrão curado deste exame (se existir) — muda o rótulo do modo automático.
  const standard = useMemo(() => findStandardSchema(draft.area, draft.name), [draft.area, draft.name]);
  const areaCalcs = useMemo(() => calculatorsForArea(draft.area), [draft.area]);
  const otherCalcs = useMemo(
    () => CALCULATORS.filter((c) => !c.areas.includes(draft.area)),
    [draft.area]
  );
  const errors = useMemo(
    () => (isCustom ? validateStructuredSchema(sections) : []),
    [isCustom, sections]
  );
  const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);

  const set = (next: StructuredSection[]) => onChange({ sections: next });

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ── ações de modo ──
  const seedFromAuto = () => {
    const auto = deriveStructuredSchema({ ...draft, structuredSchema: undefined }, draft.area);
    const cloned: StructuredSection[] = JSON.parse(JSON.stringify(auto.sections));
    onChange({ sections: cloned });
    setOpenSections(new Set(cloned.map((s) => s.id)));
  };
  const startBlank = () => {
    const s = newSection([]);
    onChange({ sections: [s] });
    setOpenSections(new Set([s.id]));
  };
  const restoreAuto = () => {
    if (window.confirm('Descartar o formulário personalizado desta máscara e voltar ao modo automático?')) {
      onChange(null);
    }
  };

  // ── ações de seção ──
  const updateSection = (idx: number, patch: Partial<StructuredSection>) =>
    set(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const moveSection = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    set(next);
  };

  const removeSection = (idx: number) => {
    const s = sections[idx];
    if (s.fields.length > 0 && !window.confirm(`Excluir a seção "${s.label}" e seus ${s.fields.length} campo(s)?`)) return;
    set(sections.filter((_, i) => i !== idx));
  };

  const addSection = () => {
    const s = newSection(sections);
    set([...sections, s]);
    setOpenSections((prev) => new Set(prev).add(s.id));
  };

  /** Regenera o id da seção a partir do rótulo enquanto ainda for o id placeholder. */
  const commitSectionLabel = (idx: number) => {
    const s = sections[idx];
    if (!/^nova-secao(-\d+)?$/.test(s.id) || !s.label.trim()) return;
    const others = sections.filter((_, i) => i !== idx);
    const newId = uniqueSectionId(s.label, others);
    updateSection(idx, { id: newId });
    // mantém a seção aberta sob o novo id
    setOpenSections((prev) => {
      if (!prev.has(s.id)) return prev;
      const next = new Set(prev);
      next.delete(s.id);
      next.add(newId);
      return next;
    });
  };

  // ── ações de campo ──
  const updateField = (si: number, fi: number, patch: Partial<StructuredFieldDef>) =>
    set(
      sections.map((s, i) =>
        i === si ? { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) } : s
      )
    );

  const moveField = (si: number, fi: number, dir: -1 | 1) => {
    const fields = [...sections[si].fields];
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[fi], fields[j]] = [fields[j], fields[fi]];
    updateSection(si, { fields });
  };

  const removeField = (si: number, fi: number) =>
    updateSection(si, { fields: sections[si].fields.filter((_, j) => j !== fi) });

  const addField = (si: number) => {
    const f = newField(sections, sections[si]);
    updateSection(si, { fields: [...sections[si].fields, f] });
    setOpenFields((prev) => new Set(prev).add(`${sections[si].id}:${f.id}`));
  };

  /** Regenera o id do campo a partir do rótulo enquanto ainda for o placeholder. */
  const commitFieldLabel = (si: number, fi: number) => {
    const s = sections[si];
    const f = s.fields[fi];
    if (!/^novo-campo(-\d+)?$/.test(f.id) || !f.label.trim()) return;
    const rest = sections.map((sec, i) =>
      i === si ? { ...sec, fields: sec.fields.filter((_, j) => j !== fi) } : sec
    );
    const newId = uniqueFieldId(f.label, rest, { ...s, fields: s.fields.filter((_, j) => j !== fi) });
    updateField(si, fi, { id: newId });
    // mantém o painel avançado aberto sob o novo id
    setOpenFields((prev) => {
      const oldKey = `${s.id}:${f.id}`;
      if (!prev.has(oldKey)) return prev;
      const next = new Set(prev);
      next.delete(oldKey);
      next.add(`${s.id}:${newId}`);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────

  const modeCard = isCustom ? (
    <div className="bg-white rounded-2xl border border-ink-100 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <LayoutGrid size={17} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 text-sm uppercase tracking-widest leading-tight flex items-center gap-2">
              Formulário Personalizado
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-black tracking-wide">
                {sections.length} {sections.length === 1 ? 'seção' : 'seções'} · {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'}
              </span>
            </h3>
            <p className="text-[10px] text-ink-400 font-medium mt-0.5">
              Salvo na máscara e usado exatamente assim na aba Estruturado do Copiloto.
            </p>
          </div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={restoreAuto}
            className="h-8 px-3 rounded-xl border border-ink-200 text-ink-500 hover:text-ink-800 hover:bg-ink-50 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 active:scale-95"
          >
            <RotateCcw size={11} /> Restaurar automático
          </button>
        )}
      </div>
      {sections.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
          Sem seções: o formulário estruturado ficará <strong>desativado</strong> para este exame no Copiloto.
          Adicione seções abaixo ou restaure o modo automático.
        </p>
      )}
      {errors.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-red-700 uppercase tracking-widest">
            <AlertTriangle size={11} /> Corrija antes de salvar
          </div>
          {errors.slice(0, 6).map((e, i) => (
            <p key={i} className="text-[11px] text-red-700 font-medium leading-snug">• {e}</p>
          ))}
          {errors.length > 6 && <p className="text-[10px] text-red-500 font-medium">… e mais {errors.length - 6}.</p>}
        </div>
      )}
    </div>
  ) : (
    <div className="bg-white rounded-2xl border border-ink-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <Wand2 size={17} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 text-sm uppercase tracking-widest leading-tight flex items-center gap-2">
            Modo Automático
            {standard && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black tracking-wide">
                Modelo padrão: {standard.name}
              </span>
            )}
          </h3>
          <p className="text-[10px] text-ink-400 font-medium mt-0.5">
            {standard
              ? 'Este exame usa um modelo padrão curado (seções, calculadoras e escores prontos).'
              : 'Campos derivados dos compartimentos da máscara + biblioteca clínica da área.'}
          </p>
        </div>
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">
        {standard
          ? 'O formulário ao lado é o modelo padrão deste exame, já com campos tipados, calculadoras e cálculos ao vivo. Para ajustá-lo (acrescentar, remover ou reordenar seções e campos), personalize — a cópia editável parte do modelo padrão e fica salva na máscara, valendo também no Copiloto.'
          : 'O formulário ao lado é gerado automaticamente a partir do texto de Análise desta máscara. Para ter controle total — criar, editar e reordenar seções e campos, ligar calculadoras, escores (TI-RADS, BI-RADS, O-RADS, Bosniak), seções repetíveis e Normal/Alterado — personalize o formulário. A personalização fica salva na máscara e vale também no Copiloto.'}
      </p>
      {editable && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={seedFromAuto}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Wand2 size={12} /> {standard ? 'Personalizar a partir do modelo padrão' : 'Personalizar a partir do automático'}
          </button>
          <button
            type="button"
            onClick={startBlank}
            className="h-9 px-4 rounded-xl border border-ink-200 text-ink-600 hover:bg-ink-50 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 active:scale-95"
          >
            <ListPlus size={12} /> Começar do zero
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
      <datalist id="structured-unit-suggestions">
        {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
      </datalist>

      {/* ─── COLUNA DE EDIÇÃO ─── */}
      <div className="space-y-4 min-w-0">
        {modeCard}

        {isCustom && sections.map((section, si) => {
          const open = openSections.has(section.id);
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden">
              {/* cabeçalho da seção */}
              <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-ink-100 bg-ink-50/50">
                <button
                  type="button"
                  onClick={() => toggleSet(setOpenSections, section.id)}
                  className="w-6 h-6 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center transition-colors shrink-0"
                  title={open ? 'Recolher' : 'Expandir'}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <input
                  className="flex-1 min-w-0 h-8 px-2 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-brand-400 rounded-lg text-xs font-black text-ink-800 uppercase tracking-widest outline-none transition-all"
                  value={section.label}
                  disabled={!editable}
                  onChange={(e) => updateSection(si, { label: e.target.value })}
                  onBlur={() => commitSectionLabel(si)}
                  placeholder="Nome da seção"
                />
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {section.normalable && <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase">N/A</span>}
                  {section.repeatable && <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[8px] font-black uppercase">Repetível</span>}
                  {section.repeatGroup && <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[8px] font-black uppercase" title={`Grupo de ${section.repeatGroup.itemLabel || 'lesões'} repetível (${section.repeatGroup.fields.length} campos)`}>+ {section.repeatGroup.itemLabel || 'lesões'}</span>}
                  {section.score && <span className="px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[8px] font-black uppercase">{section.score}</span>}
                  {section.calcId && <Calculator size={11} className="text-amber-500" />}
                  <span className="text-[9px] font-bold text-ink-400 ml-1">{section.fields.length} campo(s)</span>
                </div>
                {editable && (
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn onClick={() => moveSection(si, -1)} title="Mover para cima" disabled={si === 0}><ArrowUp size={12} /></IconBtn>
                    <IconBtn onClick={() => moveSection(si, 1)} title="Mover para baixo" disabled={si === sections.length - 1}><ArrowDown size={12} /></IconBtn>
                    <IconBtn onClick={() => removeSection(si)} title="Excluir seção" danger><X size={13} /></IconBtn>
                  </div>
                )}
              </div>

              {open && (
                <div className="p-3.5 space-y-3.5">
                  {/* configurações da seção */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-ink-50/60 border border-ink-100 p-3">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-ink-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-emerald-600"
                        checked={!!section.normalable}
                        disabled={!editable}
                        onChange={(e) => updateSection(si, { normalable: e.target.checked || undefined })}
                      />
                      Toggle Normal / Alterado
                    </label>
                    <label className="flex items-center gap-2 text-[11px] font-bold text-ink-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={!!section.repeatable}
                        disabled={!editable}
                        onChange={(e) => updateSection(si, { repeatable: e.target.checked || undefined })}
                      />
                      <Repeat2 size={12} className="text-blue-500" /> Seção repetível (nódulos, lesões…)
                    </label>
                    {section.normalable && (
                      <div>
                        <label className="label">Texto quando “Normal”</label>
                        <input
                          className="input h-8 text-xs"
                          value={section.normalText || ''}
                          disabled={!editable}
                          onChange={(e) => updateSection(si, { normalText: e.target.value || undefined })}
                          placeholder="ex: paredes finas, sem cálculos"
                        />
                      </div>
                    )}
                    {section.repeatable && (
                      <div>
                        <label className="label">Rótulo de cada item</label>
                        <input
                          className="input h-8 text-xs"
                          value={section.itemLabel || ''}
                          disabled={!editable}
                          onChange={(e) => updateSection(si, { itemLabel: e.target.value || undefined })}
                          placeholder="ex: Nódulo, Lesão, Cisto"
                        />
                      </div>
                    )}
                    <div>
                      <label className="label">Escore automático da seção</label>
                      <select
                        className="input h-8 text-xs py-0"
                        value={section.score || ''}
                        disabled={!editable}
                        onChange={(e) => updateSection(si, { score: (e.target.value || undefined) as StructuredSection['score'] })}
                      >
                        {SCORE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Calculadora da seção (atalho no cabeçalho)</label>
                      <CalcSelect
                        compact
                        value={section.calcId}
                        disabled={!editable}
                        onChange={(calcId) => updateSection(si, { calcId })}
                        areaCalcs={areaCalcs}
                        otherCalcs={otherCalcs}
                      />
                    </div>
                  </div>

                  {/* campos */}
                  <div className="space-y-2">
                    {section.fields.map((field, fi) => {
                      const fkey = `${section.id}:${field.id}`;
                      const fOpen = openFields.has(fkey);
                      return (
                        <div key={fi} className="rounded-xl border border-ink-100 bg-white">
                          <div className="p-2 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                            <input
                              className="flex-1 min-w-[140px] h-8 px-2 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-semibold text-ink-800 outline-none transition-all"
                              value={field.label}
                              disabled={!editable}
                              onChange={(e) => updateField(si, fi, { label: e.target.value })}
                              onBlur={() => commitFieldLabel(si, fi)}
                              placeholder="Rótulo do campo"
                            />
                            <select
                              className="h-8 px-1.5 w-[136px] bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-[11px] font-medium text-ink-700 outline-none shrink-0"
                              value={field.kind}
                              disabled={!editable}
                              onChange={(e) => updateField(si, fi, { kind: e.target.value as StructuredFieldKind })}
                              title="Tipo do campo"
                            >
                              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                            <input
                              className="h-8 w-16 px-1.5 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-[11px] font-medium text-ink-700 outline-none shrink-0"
                              value={field.unit || ''}
                              disabled={!editable}
                              list="structured-unit-suggestions"
                              onChange={(e) => updateField(si, fi, { unit: e.target.value || undefined })}
                              placeholder="unid."
                              title="Unidade (mm, cm, bpm…)"
                            />
                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                              {field.calcId && <Calculator size={11} className="text-amber-500" />}
                              <IconBtn onClick={() => toggleSet(setOpenFields, fkey)} title="Configurações avançadas">
                                <Settings2 size={12} className={fOpen ? 'text-indigo-600' : undefined} />
                              </IconBtn>
                              {editable && (
                                <>
                                  <IconBtn onClick={() => moveField(si, fi, -1)} title="Mover para cima" disabled={fi === 0}><ArrowUp size={12} /></IconBtn>
                                  <IconBtn onClick={() => moveField(si, fi, 1)} title="Mover para baixo" disabled={fi === section.fields.length - 1}><ArrowDown size={12} /></IconBtn>
                                  <IconBtn onClick={() => removeField(si, fi)} title="Excluir campo" danger><X size={13} /></IconBtn>
                                </>
                              )}
                            </div>
                          </div>

                          {fOpen && (
                            <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-ink-100 bg-ink-50/40 rounded-b-xl">
                              <div className="sm:col-span-2 mt-2">
                                <label className="label">Id do campo (avançado)</label>
                                <input
                                  className="input h-8 text-xs font-mono"
                                  value={field.id}
                                  disabled={!editable}
                                  onChange={(e) => updateField(si, fi, { id: normalizeFieldId(e.target.value) })}
                                />
                                <p className="text-[9px] text-ink-400 mt-1 leading-relaxed">
                                  Ids canônicos ativam cálculo automático ao vivo: {CANONICAL_HINT}.
                                </p>
                              </div>
                              <div>
                                <label className="label">Calculadora vinculada</label>
                                <CalcSelect
                                  compact
                                  value={field.calcId}
                                  disabled={!editable}
                                  onChange={(calcId) => updateField(si, fi, { calcId })}
                                  areaCalcs={areaCalcs}
                                  otherCalcs={otherCalcs}
                                />
                              </div>
                              <div>
                                <label className="label">Placeholder</label>
                                <input
                                  className="input h-8 text-xs"
                                  value={field.placeholder || ''}
                                  disabled={!editable}
                                  onChange={(e) => updateField(si, fi, { placeholder: e.target.value || undefined })}
                                  placeholder="texto de exemplo no campo vazio"
                                />
                              </div>
                              <div>
                                <label className="label">Valor de referência normal</label>
                                <input
                                  className="input h-8 text-xs"
                                  value={field.normal || ''}
                                  disabled={!editable}
                                  onChange={(e) => updateField(si, fi, { normal: e.target.value || undefined })}
                                  placeholder="ex: ≤ 6 mm · 9–12 cm"
                                />
                              </div>
                              <div>
                                <label className="label">Dica (exibida abaixo do campo)</label>
                                <input
                                  className="input h-8 text-xs"
                                  value={field.hint || ''}
                                  disabled={!editable}
                                  onChange={(e) => updateField(si, fi, { hint: e.target.value || undefined })}
                                  placeholder="ex: alterado se > p95"
                                />
                              </div>
                              {section.normalable && (
                                <div className="sm:col-span-2">
                                  <label className="flex items-center gap-2 text-[11px] font-bold text-ink-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="accent-emerald-600"
                                      checked={!!field.alwaysShow}
                                      disabled={!editable}
                                      onChange={(e) => updateField(si, fi, { alwaysShow: e.target.checked || undefined })}
                                    />
                                    <Ruler size={12} className="text-emerald-600" />
                                    Exibir mesmo com a seção em “Normal” (medida registrada na normalidade)
                                  </label>
                                </div>
                              )}
                              {(field.kind === 'select' || field.kind === 'multiselect') && (
                                <div className="sm:col-span-2">
                                  <label className="label">Opções (uma por linha)</label>
                                  <OptionsEditor
                                    options={field.options || []}
                                    disabled={!editable}
                                    onCommit={(options) => updateField(si, fi, { options: options.length ? options : undefined })}
                                  />
                                </div>
                              )}
                              {section.score === 'tirads' && field.kind !== 'calc' && (
                                <div>
                                  <label className="label">Descritor do escore TI-RADS</label>
                                  <select
                                    className="input h-8 text-xs py-0"
                                    value={field.scoreKey || ''}
                                    disabled={!editable}
                                    onChange={(e) => updateField(si, fi, { scoreKey: (e.target.value || undefined) as StructuredScoreKey })}
                                  >
                                    {SCOREKEY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </div>
                              )}
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-[11px] font-bold text-ink-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-indigo-600"
                                    checked={!!field.fullWidth}
                                    disabled={!editable}
                                    onChange={(e) => updateField(si, fi, { fullWidth: e.target.checked || undefined })}
                                  />
                                  Ocupar a linha inteira
                                </label>
                              </div>
                              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="label flex items-center gap-1"><Eye size={10} /> Exibir somente se…</label>
                                  <select
                                    className="input h-8 text-xs py-0"
                                    value={field.showIf?.field || ''}
                                    disabled={!editable}
                                    onChange={(e) => {
                                      const dep = e.target.value;
                                      updateField(si, fi, {
                                        showIf: dep ? { field: dep, equals: field.showIf?.equals } : undefined,
                                      });
                                    }}
                                  >
                                    <option value="">— sempre visível —</option>
                                    {section.fields.filter((o) => o.id !== field.id).map((o) => (
                                      <option key={o.id} value={o.id}>{o.label || o.id}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="label">… tiver o valor (opcional)</label>
                                  <input
                                    className="input h-8 text-xs"
                                    value={field.showIf?.equals || ''}
                                    disabled={!editable || !field.showIf?.field}
                                    onChange={(e) =>
                                      updateField(si, fi, {
                                        showIf: field.showIf
                                          ? { field: field.showIf.field, equals: e.target.value || undefined }
                                          : undefined,
                                      })
                                    }
                                    placeholder="vazio = qualquer valor preenchido"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {editable && (
                      <button
                        type="button"
                        onClick={() => addField(si)}
                        className="w-full h-9 rounded-xl border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <Plus size={13} /> Adicionar campo
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isCustom && editable && (
          <button
            type="button"
            onClick={addSection}
            className="w-full h-11 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Plus size={15} /> Adicionar seção
          </button>
        )}
      </div>

      {/* ─── COLUNA DE PREVIEW AO VIVO ─── */}
      <div className="xl:sticky xl:top-4 space-y-2 min-w-0">
        <div className="flex items-center gap-1.5 px-1">
          <Eye size={12} className="text-brand-500" />
          <span className="text-[10px] font-black text-ink-500 uppercase tracking-widest">
            Pré-visualização ao vivo — como o médico verá no Copiloto
          </span>
        </div>
        <StructuredPreview template={draft} />
      </div>
    </div>
  );
}
