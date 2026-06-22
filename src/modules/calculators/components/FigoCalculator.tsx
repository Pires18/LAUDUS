import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Activity, Zap } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';

interface Myoma {
  id: string;
  location: string;
  d1: number | '';
  d2: number | '';
  d3: number | '';
  type1: string | null;
  type2: string | null; // For hybrids like 2-5
  vascularity: number; // 1-4
  echogenicity: string | null;
  classification: string | null;
  description: string | null;
}

const FIGO_TYPES = [
  { id: '0', label: 'T0', desc: 'Pediculado Intracavitário' },
  { id: '1', label: 'T1', desc: 'Submucoso < 50% intramural' },
  { id: '2', label: 'T2', desc: 'Submucoso ≥ 50% intramural' },
  { id: '3', label: 'T3', desc: 'Contata endométrio, 100% intramural' },
  { id: '4', label: 'T4', desc: 'Intramural' },
  { id: '5', label: 'T5', desc: 'Subseroso ≥ 50% intramural' },
  { id: '6', label: 'T6', desc: 'Subseroso < 50% intramural' },
  { id: '7', label: 'T7', desc: 'Subseroso Pediculado' },
  { id: '8', label: 'T8', desc: 'Outros (Cervical, Parasitário)' },
];

const LOCATIONS = [
  { label: 'Parede Anterior' },
  { label: 'Parede Posterior' },
  { label: 'Fundo Uterino' },
  { label: 'Lateral Direita' },
  { label: 'Lateral Esquerda' },
  { label: 'Cervical' },
];

const ECHOGENICITY = [
  { label: 'Hipoecogênico' },
  { label: 'Isoecogênico' },
  { label: 'Hiperecogênico' },
  { label: 'Heterogêneo' },
];

export function FigoCalculator({ value, onChange }: CalculatorProps) {
  const [myomas, setMyomas] = useState<Myoma[]>(() => {
    return Array.isArray(value?.myomas) ? value.myomas : [];
  });
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const updatedMyomas = myomas.map(m => {
      let cls = '';
      let dsc = '';

      if (m.type1 && m.type2 && m.type1 !== m.type2) {
        cls = `FIGO ${m.type1}-${m.type2} (Híbrido)`;
        const d1 = FIGO_TYPES.find(t => t.id === m.type1)?.desc;
        const d2 = FIGO_TYPES.find(t => t.id === m.type2)?.desc;
        dsc = `Componente ${d1} e ${d2}`;
      } else if (m.type1) {
        cls = `FIGO ${m.type1}`;
        dsc = FIGO_TYPES.find(t => t.id === m.type1)?.desc || '';
      }

      return { ...m, classification: cls, description: dsc };
    });

    const summaries = updatedMyomas.map(m => {
      if (!m.classification) return null;
      const dims = (m.d1 && m.d2 && m.d3) ? ` (${m.d1}x${m.d2}x${m.d3}mm)` : '';
      const vasc = m.vascularity > 1 ? `. Vascularização Score ${m.vascularity}` : '';
      return `Mioma em ${m.location}${dims}: ${m.classification} (${m.description})${vasc}.`;
    }).filter(Boolean);

    onChange({
      myomas: updatedMyomas,
      _summary: summaries.length > 0 ? `FIGO (Leiomiomas): ${summaries.join(' | ')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myomas]);

  function addMyoma() {
    const id = genId();
    setMyomas([...myomas, {
      id, location: 'Parede Anterior', d1: '', d2: '', d3: '',
      type1: null, type2: null, vascularity: 1, echogenicity: 'Hipoecogênico',
      classification: null, description: null
    }]);
    setExpandedId(id);
  }

  function updateMyoma(id: string, patch: Partial<Myoma>) {
    setMyomas(myomas.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-emerald-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">FIGO (Miomas)</h3>
        </div>
        <button onClick={addMyoma} className="btn-primary text-[10px] py-1 px-2 flex items-center gap-1">
          <Plus size={12} /> Mioma
        </button>
      </div>

      <div className="divide-y divide-ink-100">
        {myomas.length === 0 && <div className="p-4 text-center text-ink-400 text-[10px]">Nenhum mioma adicionado.</div>}
        {myomas.map(myoma => (
          <div key={myoma.id}>
            <div 
              className={classNames("flex items-center justify-between p-2 cursor-pointer hover:bg-ink-50", expandedId === myoma.id ? "bg-emerald-50/20" : "")}
              onClick={() => setExpandedId(expandedId === myoma.id ? null : myoma.id)}
            >
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-emerald-500" />
                <div>
                  <div className="text-[11px] font-bold text-ink-900">{myoma.location}</div>
                  <div className="text-[9px] text-ink-500">
                    {myoma.classification || 'Pendente'}
                    {myoma.vascularity > 1 && ` • Vasc ${myoma.vascularity}`}
                  </div>
                </div>
              </div>
              {expandedId === myoma.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {expandedId === myoma.id && (
              <div className="p-3 bg-ink-50/20 space-y-4 border-t border-ink-100">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">Localização</label>
                    <select className="input text-[11px] h-8 py-0" value={myoma.location} onChange={e => updateMyoma(myoma.id, { location: e.target.value })}>
                      {LOCATIONS.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">Medidas (mm)</label>
                    <div className="flex gap-1">
                      <input type="number" className="input text-[10px] text-center p-1 h-8" placeholder="C" value={myoma.d1} onChange={e => updateMyoma(myoma.id, { d1: e.target.value ? Number(e.target.value) : '' })} />
                      <input type="number" className="input text-[10px] text-center p-1 h-8" placeholder="L" value={myoma.d2} onChange={e => updateMyoma(myoma.id, { d2: e.target.value ? Number(e.target.value) : '' })} />
                      <input type="number" className="input text-[10px] text-center p-1 h-8" placeholder="A" value={myoma.d3} onChange={e => updateMyoma(myoma.id, { d3: e.target.value ? Number(e.target.value) : '' })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Selector label="Ecogenicidade" options={ECHOGENICITY} current={myoma.echogenicity} onSelect={(v: string) => updateMyoma(myoma.id, { echogenicity: v })} />
                  
                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Tipo FIGO (Selecione 1 ou 2 para Híbridos)</label>
                    <div className="grid grid-cols-5 gap-1">
                      {FIGO_TYPES.map(type => {
                        const isSelected = myoma.type1 === type.id || myoma.type2 === type.id;
                        return (
                          <button
                            key={type.id}
                            onClick={() => {
                              if (myoma.type1 === type.id) updateMyoma(myoma.id, { type1: myoma.type2, type2: null });
                              else if (myoma.type2 === type.id) updateMyoma(myoma.id, { type2: null });
                              else if (!myoma.type1) updateMyoma(myoma.id, { type1: type.id });
                              else updateMyoma(myoma.id, { type2: type.id });
                            }}
                            className={classNames(
                              "py-1.5 text-[10px] rounded border transition-all font-bold",
                              isSelected ? "bg-emerald-600 text-white border-emerald-700 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                            )}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* LEGENDA DE AUXÍLIO */}
                    <div className="mt-2 p-2 bg-ink-50 rounded-md border border-ink-100">
                      <div className="text-[8px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">Legenda Auxiliar</div>
                      <div className="grid grid-cols-1 gap-1 max-h-[100px] overflow-y-auto pr-1">
                        {FIGO_TYPES.map(t => (
                          <div key={t.id} className="flex gap-1.5 text-[9px] leading-tight text-ink-600">
                            <span className="font-bold text-emerald-600 w-4 shrink-0">{t.label}:</span>
                            <span>{t.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Vascularização (Doppler)</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(v => (
                        <button
                          key={v}
                          onClick={() => updateMyoma(myoma.id, { vascularity: v })}
                          className={classNames(
                            "flex-1 py-1 text-[10px] rounded border font-bold transition-all",
                            myoma.vascularity === v ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-ink-600 border-ink-200"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {myoma.classification && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mb-0.5">
                      <Zap size={12} /> {myoma.classification}
                    </div>
                    <div className="text-[9px] text-emerald-600 leading-tight">{myoma.description}</div>
                  </div>
                )}
                
                <button onClick={() => setMyomas(myomas.filter(m => m.id !== myoma.id))} className="text-[9px] text-red-500 flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Remover Mioma
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
            className={classNames("px-2 py-1 text-[9px] rounded border transition-all", current === o.label ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:border-ink-300")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
