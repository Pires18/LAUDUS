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
  type: string | null;
  solidComponent: boolean;
  colorScore: number;
  innerWall: string | null; // smooth, irregular
  ascites: boolean;
  classification: string | null;
  recommendation: string | null;
}

const LESION_TYPES = [
  { label: 'Cisto Unilocular Simples' },
  { label: 'Cisto Multilocular' },
  { label: 'Lesão Sólida' },
  { label: 'Cisto com Componente Sólido' },
];

export function OradsCalculator({ value, onChange }: CalculatorProps) {
  const [lesions, setLesions] = useState<Lesion[]>(() => {
    return Array.isArray(value?.lesions) ? value.lesions : [];
  });
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const updatedLesions = lesions.map(l => {
      let cat = '0';
      let rec = 'Avaliação Incompleta';
      const maxDim = Math.max(Number(l.d1 || 0), Number(l.d2 || 0), Number(l.d3 || 0));

      if (l.ascites) {
        cat = '5';
        rec = 'Alto risco (≥50%). Presença de ascite ou nódulos peritoneais.';
      } else if (l.type === 'Lesão Sólida') {
        if (l.colorScore === 4 || l.innerWall === 'Irregular') {
          cat = '5';
          rec = 'Alto risco (≥50%). Lesão sólida suspeita.';
        } else {
          cat = '4';
          rec = 'Risco intermediário (10-50%).';
        }
      } else if (l.type === 'Cisto com Componente Sólido') {
        cat = '4';
        rec = 'Risco intermediário (10-50%).';
      } else if (l.type === 'Cisto Multilocular') {
        if (maxDim >= 100 || l.colorScore === 4) {
          cat = '4';
          rec = 'Risco intermediário (10-50%). Cisto multilocular grande ou vascularizado.';
        } else {
          cat = '3';
          rec = 'Baixo risco (1-10%).';
        }
      } else if (l.type === 'Cisto Unilocular Simples') {
        if (maxDim >= 100) {
          cat = '3';
          rec = 'Baixo risco (1-10%). Cisto unilocular ≥ 10cm.';
        } else {
          cat = '2';
          rec = 'Quase certamente benigno (<1%). Cisto unilocular < 10cm.';
        }
      }

      return { ...l, classification: cat !== '0' ? `O-RADS ${cat}` : null, recommendation: cat !== '0' ? rec : null };
    });

    const summaries = updatedLesions.map(l => {
      if (!l.classification) return null;
      const dims = (l.d1 && l.d2 && l.d3) ? ` (${l.d1}x${l.d2}x${l.d3}mm)` : '';
      return `${l.location}${dims}: ${l.classification}. ${l.recommendation}`;
    }).filter(Boolean);

    onChange({
      lesions: updatedLesions,
      _summary: summaries.length > 0 ? `Achados O-RADS (Ovário):\n${summaries.join('\n')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesions]);

  function addLesion() {
    const id = genId();
    setLesions([...lesions, {
      id, location: `Lesão Anexial ${lesions.length + 1}`, d1: '', d2: '', d3: '',
      type: null, solidComponent: false, colorScore: 1, innerWall: 'Liso', ascites: false,
      classification: null, recommendation: null
    }]);
    setExpandedId(id);
  }

  function updateLesion(id: string, patch: Partial<Lesion>) {
    setLesions(lesions.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-violet-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">O-RADS (Anexos)</h3>
        </div>
        <button onClick={addLesion} className="btn-primary text-[10px] py-1 px-2 flex items-center gap-1">
          <Plus size={12} /> Lesão
        </button>
      </div>

      <div className="divide-y divide-ink-100">
        {lesions.length === 0 && <div className="p-4 text-center text-ink-400 text-[10px]">Clique em "Lesão" para começar.</div>}
        {lesions.map(lesion => (
          <div key={lesion.id}>
            <div 
              className={classNames("flex items-center justify-between p-2 cursor-pointer hover:bg-ink-50", expandedId === lesion.id ? "bg-violet-50/20" : "")}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-violet-500" />
                <div>
                  <div className="text-[11px] font-bold text-ink-900">{lesion.location}</div>
                  <div className="text-[9px] text-ink-500">{lesion.classification || 'Aguardando dados...'}</div>
                </div>
              </div>
              {expandedId === lesion.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {expandedId === lesion.id && (
              <div className="p-3 bg-ink-50/20 space-y-3 border-t border-ink-100">
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-[11px] h-8" placeholder="Localização" value={lesion.location} onChange={e => updateLesion(lesion.id, { location: e.target.value })} />
                  <div className="flex gap-1">
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="C" value={lesion.d1} onChange={e => updateLesion(lesion.id, { d1: e.target.value ? Number(e.target.value) : '' })} />
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="L" value={lesion.d2} onChange={e => updateLesion(lesion.id, { d2: e.target.value ? Number(e.target.value) : '' })} />
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="A" value={lesion.d3} onChange={e => updateLesion(lesion.id, { d3: e.target.value ? Number(e.target.value) : '' })} />
                  </div>
                </div>

                <Selector label="Tipo de Lesão" options={LESION_TYPES} current={lesion.type} onSelect={(v: string) => updateLesion(lesion.id, { type: v })} />
                
                <div className="grid grid-cols-2 gap-3">
                  <Selector label="Parede Interna" options={[{label: 'Liso'}, {label: 'Irregular'}]} current={lesion.innerWall} onSelect={(v: string) => updateLesion(lesion.id, { innerWall: v })} />
                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Color Score</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(score => (
                        <button
                          key={score}
                          onClick={() => updateLesion(lesion.id, { colorScore: score })}
                          className={classNames("flex-1 py-1 text-[10px] rounded border transition-all", lesion.colorScore === score ? "bg-violet-600 text-white border-violet-700 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:border-ink-300")}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-1">
                  <input type="checkbox" checked={lesion.ascites} onChange={e => updateLesion(lesion.id, { ascites: e.target.checked })} className="accent-violet-600" />
                  <span className="text-[10px] text-ink-700">Ascite ou nódulos peritoneais</span>
                </label>

                {lesion.classification && (
                  <div className="p-2 bg-violet-50 border border-violet-200 rounded-lg">
                    <div className="text-[11px] font-bold text-violet-700">{lesion.classification}</div>
                    <div className="text-[9px] text-violet-600 leading-tight mt-0.5">{lesion.recommendation}</div>
                  </div>
                )}
                
                <button onClick={() => setLesions(lesions.filter(l => l.id !== lesion.id))} className="text-[9px] text-red-500 flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Remover Lesão
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Selector({ label, options, current, onSelect }: { label: string, options: any[], current: string | null, onSelect: (v: string) => void }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((o: any) => (
          <button
            key={o.label}
            onClick={() => onSelect(o.label)}
            className={classNames("px-2 py-1 text-[9px] rounded border transition-all", current === o.label ? "bg-violet-600 text-white border-violet-700 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:border-ink-300")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
