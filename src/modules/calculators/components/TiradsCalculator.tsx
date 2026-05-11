import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Maximize, Activity } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';

interface Lesion {
  id: string;
  location: string;
  d1: number | '';
  d2: number | '';
  d3: number | '';
  composition: number | null;
  echogenicity: number | null;
  shape: number | null;
  margin: number | null;
  echogenicFoci: number[];
  totalPoints: number | null;
  classification: string | null;
  recommendation: string | null;
}

const COMPOSITION = [
  { label: 'Cística ou quase completamente cística', points: 0 },
  { label: 'Espongiforme', points: 0 },
  { label: 'Mista (sólida e cística)', points: 1 },
  { label: 'Sólida ou quase completamente sólida', points: 2 },
];

const ECHOGENICITY = [
  { label: 'Anecóico', points: 0 },
  { label: 'Hiperecóico ou Isoecóico', points: 1 },
  { label: 'Hipoecóico', points: 2 },
  { label: 'Muito Hipoecóico', points: 3 },
];

const SHAPE = [
  { label: 'Mais largo que alto', points: 0 },
  { label: 'Mais alto que largo', points: 3 },
];

const MARGIN = [
  { label: 'Lisa', points: 0 },
  { label: 'Mal definida', points: 0 },
  { label: 'Lobulada ou Irregular', points: 2 },
  { label: 'Extratireoideana', points: 3 },
];

const ECHOGENIC_FOCI = [
  { label: 'Nenhum ou artefato em cauda de cometa', points: 0 },
  { label: 'Macrocalcificações', points: 1 },
  { label: 'Calcificações periféricas (em casca de ovo)', points: 2 },
  { label: 'Focos ecogênicos puntiformes', points: 3 },
];

export function TiradsCalculator({ value, onChange }: CalculatorProps) {
  const [lesions, setLesions] = useState<Lesion[]>(() => {
    if (Array.isArray(value?.lesions)) return value.lesions;
    // Migração: se formato antigo existir, converte para primeira lesão
    if (value?.composition !== undefined) {
      return [{
        id: 'L1',
        location: 'Nódulo 1',
        d1: '', d2: '', d3: '',
        composition: value.composition,
        echogenicity: value.echogenicity,
        shape: value.shape,
        margin: value.margin,
        echogenicFoci: value.echogenicFoci || [],
        totalPoints: value.totalPoints,
        classification: value.classification,
        recommendation: value.recommendation
      }];
    }
    return [];
  });
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const updatedLesions = lesions.map(lesion => {
      let total = 0;
      let complete = true;

      if (lesion.composition !== null) total += lesion.composition; else complete = false;
      if (lesion.echogenicity !== null) total += lesion.echogenicity; else complete = false;
      if (lesion.shape !== null) total += lesion.shape; else complete = false;
      if (lesion.margin !== null) total += lesion.margin; else complete = false;

      lesion.echogenicFoci.forEach(p => { total += p; });

      let tr = '';
      let rec = '';
      if (complete) {
        if (total === 0) { tr = 'TR1'; rec = 'Benigno. PAAF não recomendada.'; }
        else if (total <= 2) { tr = 'TR2'; rec = 'Não suspeito. PAAF não recomendada.'; }
        else if (total === 3) { tr = 'TR3'; rec = 'Levemente suspeito. PAAF se ≥ 2.5 cm. Seguir se ≥ 1.5 cm.'; }
        else if (total >= 4 && total <= 6) { tr = 'TR4'; rec = 'Moderadamente suspeito. PAAF se ≥ 1.5 cm. Seguir se ≥ 1.0 cm.'; }
        else if (total >= 7) { tr = 'TR5'; rec = 'Altamente suspeito. PAAF se ≥ 1.0 cm. Seguir se ≥ 0.5 cm.'; }
      }

      return {
        ...lesion,
        totalPoints: complete ? total : null,
        classification: complete ? tr : null,
        recommendation: complete ? rec : null
      };
    });

    const summaries = updatedLesions.map((l, idx) => {
      if (!l.classification) return null;
      const dims = (l.d1 && l.d2 && l.d3) ? ` (${l.d1}x${l.d2}x${l.d3}mm)` : '';
      return `${l.location}${dims}: ${l.classification} (${l.totalPoints} pts). ${l.recommendation}`;
    }).filter(Boolean);

    onChange({
      lesions: updatedLesions,
      _summary: summaries.length > 0 ? `Achados TI-RADS:\n${summaries.join('\n')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesions]);

  function addLesion() {
    const newId = genId();
    setLesions([...lesions, {
      id: newId,
      location: `Nódulo ${lesions.length + 1}`,
      d1: '', d2: '', d3: '',
      composition: null,
      echogenicity: null,
      shape: null,
      margin: null,
      echogenicFoci: [],
      totalPoints: null,
      classification: null,
      recommendation: null
    }]);
    setExpandedId(newId);
  }

  function removeLesion(id: string) {
    setLesions(lesions.filter(l => l.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function updateLesion(id: string, patch: Partial<Lesion>) {
    setLesions(lesions.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-brand-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">ACR TI-RADS</h3>
        </div>
        <button 
          onClick={addLesion}
          className="btn-primary text-[10px] py-1 px-2 flex items-center gap-1"
        >
          <Plus size={12} /> Nódulo
        </button>
      </div>

      <div className="divide-y divide-ink-100">
        {lesions.length === 0 && (
          <div className="p-4 text-center text-ink-400 text-[10px]">
            Nenhum nódulo adicionado.
          </div>
        )}
        {lesions.map((lesion) => (
          <div key={lesion.id} className="bg-white">
            {/* LESION HEADER */}
            <div 
              className={classNames(
                "flex items-center justify-between p-2 cursor-pointer transition-colors hover:bg-ink-50",
                expandedId === lesion.id ? "bg-brand-50/30" : ""
              )}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-2 flex-1">
                <MapPin size={12} className="text-ink-400" />
                <div>
                  <div className="text-[11px] font-bold text-ink-900">{lesion.location || 'Sem localização'}</div>
                  <div className="text-[9px] text-ink-500 flex items-center gap-2">
                    {lesion.d1 && lesion.d2 && lesion.d3 ? (
                      <span className="flex items-center gap-0.5"><Maximize size={8} /> {lesion.d1}x{lesion.d2}x{lesion.d3}mm</span>
                    ) : null}
                    {lesion.classification && (
                      <span className="chip bg-brand-100 text-brand-700 py-0 px-1">{lesion.classification} ({lesion.totalPoints} pts)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); removeLesion(lesion.id); }}
                  className="p-1.5 text-ink-300 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                {expandedId === lesion.id ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
              </div>
            </div>

            {/* LESION CONTENT */}
            {expandedId === lesion.id && (
              <div className="p-3 border-t border-ink-100 bg-ink-50/30 space-y-3 animate-in slide-in-from-top-1 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase tracking-widest block mb-1">Localização</label>
                    <input 
                      className="input text-[11px] py-1 h-8" 
                      placeholder="Ex: Lóbulo Direito" 
                      value={lesion.location} 
                      onChange={e => updateLesion(lesion.id, { location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase tracking-widest block mb-1">Medidas (mm)</label>
                    <div className="flex items-center gap-1.5">
                      <input type="number" className="input text-center text-[11px] py-1 h-8" placeholder="C" value={lesion.d1} onChange={e => updateLesion(lesion.id, { d1: e.target.value ? Number(e.target.value) : '' })} />
                      <input type="number" className="input text-center text-[11px] py-1 h-8" placeholder="L" value={lesion.d2} onChange={e => updateLesion(lesion.id, { d2: e.target.value ? Number(e.target.value) : '' })} />
                      <input type="number" className="input text-center text-[11px] py-1 h-8" placeholder="A" value={lesion.d3} onChange={e => updateLesion(lesion.id, { d3: e.target.value ? Number(e.target.value) : '' })} />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-ink-100 w-full" />

                <div className="space-y-3">
                  <CategorySelector label="1. Composição" options={COMPOSITION} current={lesion.composition} onSelect={(pts: number) => updateLesion(lesion.id, { composition: pts })} />
                  <CategorySelector label="2. Ecogenicidade" options={ECHOGENICITY} current={lesion.echogenicity} onSelect={(pts: number) => updateLesion(lesion.id, { echogenicity: pts })} />
                  <CategorySelector label="3. Forma" options={SHAPE} current={lesion.shape} onSelect={(pts: number) => updateLesion(lesion.id, { shape: pts })} />
                  <CategorySelector label="4. Margem" options={MARGIN} current={lesion.margin} onSelect={(pts: number) => updateLesion(lesion.id, { margin: pts })} />
                  
                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase tracking-widest block mb-1.5">5. Focos Ecogênicos</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ECHOGENIC_FOCI.map(o => {
                        const checked = lesion.echogenicFoci.includes(o.points);
                        return (
                          <label key={o.label} className={classNames("flex items-start gap-1.5 p-1.5 border rounded-md cursor-pointer transition-all", checked ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-white")}>
                            <input type="checkbox" checked={checked} className="mt-0.5 accent-brand-600 scale-75" onChange={() => {
                              let next = [...lesion.echogenicFoci];
                              if (o.points === 0) next = [0];
                              else {
                                next = next.filter(v => v !== 0);
                                if (checked) next = next.filter(v => v !== o.points);
                                else next.push(o.points);
                              }
                              updateLesion(lesion.id, { echogenicFoci: next });
                            }} />
                            <span className="text-[10px] leading-tight">{o.label} <span className="text-ink-400">({o.points})</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {lesion.classification && (
                  <div className="bg-brand-50 border border-brand-200 rounded-lg p-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[8px] text-brand-600 font-bold uppercase tracking-wider">Resultado</div>
                      <div className="text-sm font-black text-brand-900">{lesion.classification} ({lesion.totalPoints} pts)</div>
                    </div>
                    <div className="text-right flex-1">
                      <div className="text-[8px] text-brand-600 font-bold uppercase tracking-wider">Recomendação</div>
                      <div className="text-[10px] text-brand-800 font-medium line-clamp-2">{lesion.recommendation}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategorySelector({ label, options, current, onSelect }: any) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase tracking-widest block mb-1">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {options.map((o: any) => (
          <label key={o.label} className={classNames("flex items-start gap-1.5 p-1.5 border rounded-md cursor-pointer transition-all", current === o.points ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-white")}>
            <input type="radio" checked={current === o.points} onChange={() => onSelect(o.points)} className="mt-0.5 accent-brand-600 scale-75" />
            <span className="text-[10px] leading-tight">{o.label} <span className="text-ink-400">({o.points})</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}
