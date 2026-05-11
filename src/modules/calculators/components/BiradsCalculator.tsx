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
  shape: string | null;
  orientation: string | null;
  margin: string | null;
  echoPattern: string | null;
  posteriorFeatures: string | null;
  calcifications: string | null;
  classification: string | null;
  recommendation: string | null;
}

const SHAPE = [
  { label: 'Oval' },
  { label: 'Redondo' },
  { label: 'Irregular' },
];

const ORIENTATION = [
  { label: 'Paralelo' },
  { label: 'Não-paralelo' },
];

const MARGIN = [
  { label: 'Circunscrita' },
  { label: 'Indistinta' },
  { label: 'Angular' },
  { label: 'Microlobulada' },
  { label: 'Espiculada' },
];

const ECHO_PATTERN = [
  { label: 'Anecóico' },
  { label: 'Hiperecóico' },
  { label: 'Isoecóico' },
  { label: 'Hipoecóico' },
  { label: 'Complexo Cístico e Sólido' },
  { label: 'Heterogêneo' },
];

const POSTERIOR = [
  { label: 'Sem características' },
  { label: 'Reforço' },
  { label: 'Sombreamento' },
  { label: 'Padrão Combinado' },
];

export function BiradsCalculator({ value, onChange }: CalculatorProps) {
  const [lesions, setLesions] = useState<Lesion[]>(() => {
    return Array.isArray(value?.lesions) ? value.lesions : [];
  });
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const updatedLesions = lesions.map(l => {
      let cat = '0';
      let rec = 'Avaliação Incompleta';

      const isMalignant = l.shape === 'Irregular' || l.margin === 'Espiculada' || l.orientation === 'Não-paralelo';
      const isSuspicious = l.margin && ['Indistinta', 'Angular', 'Microlobulada'].includes(l.margin) || 
                           l.echoPattern === 'Complexo Cístico e Sólido' || 
                           l.echoPattern === 'Hipoecóico';

      if (l.shape && l.margin && l.orientation && l.echoPattern) {
        if (l.echoPattern === 'Anecóico' && l.margin === 'Circunscrita' && l.shape === 'Oval') {
          cat = '2';
          rec = 'Benigno. Achados clássicos de cisto simples.';
        } else if (l.shape === 'Oval' && l.margin === 'Circunscrita' && l.orientation === 'Paralelo') {
          cat = '3';
          rec = 'Provavelmente benigno. Risco < 2%. Sugere-se controle em 6 meses.';
        } else if (isMalignant) {
          cat = '5';
          rec = 'Altamente suspeito (> 95% risco). Biópsia recomendada.';
        } else if (isSuspicious) {
          cat = '4';
          rec = 'Suspeito (2% a 95% risco). Biópsia recomendada.';
        } else {
          cat = '4A';
          rec = 'Baixa suspeita (2% a 10% risco). Biópsia recomendada.';
        }
      }

      return { ...l, classification: cat !== '0' ? `BI-RADS ${cat}` : null, recommendation: cat !== '0' ? rec : null };
    });

    const summaries = updatedLesions.map(l => {
      if (!l.classification) return null;
      const dims = (l.d1 && l.d2 && l.d3) ? ` (${l.d1}x${l.d2}x${l.d3}mm)` : '';
      return `${l.location}${dims}: ${l.classification}. ${l.recommendation}`;
    }).filter(Boolean);

    onChange({
      lesions: updatedLesions,
      _summary: summaries.length > 0 ? `Achados BI-RADS (Mama):\n${summaries.join('\n')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesions]);

  function addLesion() {
    const id = genId();
    setLesions([...lesions, {
      id, location: `Nódulo M${lesions.length + 1}`, d1: '', d2: '', d3: '',
      shape: null, orientation: null, margin: null, echoPattern: null,
      posteriorFeatures: null, calcifications: null, classification: null, recommendation: null
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
          <Activity size={14} className="text-rose-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">BI-RADS (Mama)</h3>
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
              className={classNames("flex items-center justify-between p-2 cursor-pointer hover:bg-ink-50", expandedId === lesion.id ? "bg-rose-50/20" : "")}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-rose-500" />
                <div>
                  <div className="text-[11px] font-bold text-ink-900">{lesion.location}</div>
                  <div className="text-[9px] text-ink-500">{lesion.classification || 'Aguardando dados...'}</div>
                </div>
              </div>
              {expandedId === lesion.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {expandedId === lesion.id && (
              <div className="p-3 bg-ink-50/20 space-y-4 border-t border-ink-100">
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-[11px] h-8" placeholder="Localização" value={lesion.location} onChange={e => updateLesion(lesion.id, { location: e.target.value })} />
                  <div className="flex gap-1">
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="C" value={lesion.d1} onChange={e => updateLesion(lesion.id, { d1: e.target.value ? Number(e.target.value) : '' })} />
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="L" value={lesion.d2} onChange={e => updateLesion(lesion.id, { d2: e.target.value ? Number(e.target.value) : '' })} />
                    <input type="number" className="input text-xs text-center p-1 h-8" placeholder="A" value={lesion.d3} onChange={e => updateLesion(lesion.id, { d3: e.target.value ? Number(e.target.value) : '' })} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Selector label="Forma" options={SHAPE} current={lesion.shape} onSelect={(v: string) => updateLesion(lesion.id, { shape: v })} />
                  <Selector label="Orientação" options={ORIENTATION} current={lesion.orientation} onSelect={(v: string) => updateLesion(lesion.id, { orientation: v })} />
                  <Selector label="Margem" options={MARGIN} current={lesion.margin} onSelect={(v: string) => updateLesion(lesion.id, { margin: v })} />
                  <Selector label="Padrão de Eco" options={ECHO_PATTERN} current={lesion.echoPattern} onSelect={(v: string) => updateLesion(lesion.id, { echoPattern: v })} />
                  <Selector label="Características Posteriores" options={POSTERIOR} current={lesion.posteriorFeatures} onSelect={(v: string) => updateLesion(lesion.id, { posteriorFeatures: v })} />
                </div>

                {lesion.classification && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="text-[11px] font-bold text-rose-700">{lesion.classification}</div>
                    <div className="text-[9px] text-rose-600 leading-tight mt-0.5">{lesion.recommendation}</div>
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
            className={classNames("px-2 py-1 text-[9px] rounded border transition-all", current === o.label ? "bg-rose-500 text-white border-rose-600 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:border-ink-300")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
