import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Activity } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';
import { CategorySelector, ResultCard, CalculatorInput } from './CalculatorUI';

interface Myoma {
  id: string;
  location: string;
  d1: number | '';
  d2: number | '';
  d3: number | '';
  type1: string | null;
  type2: string | null; // Para híbridos (ex: 2-5)
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
  { label: 'Parede Anterior', value: 'Parede Anterior' },
  { label: 'Parede Posterior', value: 'Parede Posterior' },
  { label: 'Fundo Uterino', value: 'Fundo Uterino' },
  { label: 'Lateral Direita', value: 'Lateral Direita' },
  { label: 'Lateral Esquerda', value: 'Lateral Esquerda' },
  { label: 'Cervical', value: 'Cervical' },
];

const ECHOGENICITY = [
  { label: 'Hipoecogênico', value: 'Hipoecogênico' },
  { label: 'Isoecogênico', value: 'Isoecogênico' },
  { label: 'Hiperecogênico', value: 'Hiperecogênico' },
  { label: 'Heterogêneo', value: 'Heterogêneo' },
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

  function toggleFigoType(myoma: Myoma, typeId: string) {
    if (myoma.type1 === typeId) updateMyoma(myoma.id, { type1: myoma.type2, type2: null });
    else if (myoma.type2 === typeId) updateMyoma(myoma.id, { type2: null });
    else if (!myoma.type1) updateMyoma(myoma.id, { type1: typeId });
    else if (!myoma.type2) updateMyoma(myoma.id, { type2: typeId });
    else updateMyoma(myoma.id, { type1: typeId, type2: null });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Classificação FIGO</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Leiomiomas Uterinos (PALM-COEIN 0–8)</p>
          </div>
        </div>
        <button
          onClick={addMyoma}
          className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
        >
          <Plus size={14} /> Novo Mioma
        </button>
      </div>

      <div className="space-y-4">
        {myomas.length === 0 && (
          <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
            <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
              <MapPin size={32} />
            </div>
            <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Nenhum mioma registrado</p>
          </div>
        )}

        {myomas.map((myoma) => (
          <div key={myoma.id} className="bg-white rounded-2xl border-2 border-ink-100 overflow-hidden shadow-sm transition-all hover:border-emerald-200">
            <div
              className={classNames(
                "flex items-center justify-between p-6 cursor-pointer transition-all",
                expandedId === myoma.id ? "bg-emerald-50/20" : "hover:bg-ink-50/50"
              )}
              onClick={() => setExpandedId(expandedId === myoma.id ? null : myoma.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={classNames(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all",
                  myoma.classification ? "bg-emerald-500 text-white" : "bg-ink-100 text-ink-400"
                )}>
                  {myoma.type1
                    ? <span className="font-black text-xs">{myoma.type1}{myoma.type2 ? `-${myoma.type2}` : ''}</span>
                    : <Activity size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-ink-900 uppercase tracking-tight">{myoma.location}</div>
                  <div className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">
                    {myoma.classification || 'Pendente'}
                    {myoma.vascularity > 1 && ` • Vasc ${myoma.vascularity}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setMyomas(myomas.filter(m => m.id !== myoma.id)); }}
                  className="w-10 h-10 rounded-xl bg-ink-50 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                >
                  <Trash2 size={18} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-ink-400">
                  {expandedId === myoma.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {expandedId === myoma.id && (
              <div className="p-8 pt-0 border-t border-ink-50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-1.5 pt-6">
                  <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Medidas (mm)</label>
                  <div className="flex items-center gap-3">
                    <CalculatorInput type="number" placeholder="C" value={myoma.d1} onChange={(v: any) => updateMyoma(myoma.id, { d1: v ? Number(v) : '' })} suffix="mm" />
                    <CalculatorInput type="number" placeholder="L" value={myoma.d2} onChange={(v: any) => updateMyoma(myoma.id, { d2: v ? Number(v) : '' })} suffix="mm" />
                    <CalculatorInput type="number" placeholder="A" value={myoma.d3} onChange={(v: any) => updateMyoma(myoma.id, { d3: v ? Number(v) : '' })} suffix="mm" />
                  </div>
                </div>

                <CategorySelector label="Localização" options={LOCATIONS} current={myoma.location} onSelect={(v: string) => updateMyoma(myoma.id, { location: v })} />
                <CategorySelector label="Ecogenicidade" options={ECHOGENICITY} current={myoma.echogenicity} onSelect={(v: string) => updateMyoma(myoma.id, { echogenicity: v })} />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1 h-3 bg-brand-500 rounded-full" />
                    <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Tipo FIGO</label>
                  </div>
                  <p className="text-[9px] text-ink-400 font-semibold ml-3 -mt-1">Selecione 1 tipo — ou 2 para miomas híbridos (ex: 2-5).</p>
                  <div className="grid grid-cols-5 gap-2">
                    {FIGO_TYPES.map(type => {
                      const isSelected = myoma.type1 === type.id || myoma.type2 === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => toggleFigoType(myoma, type.id)}
                          title={type.desc}
                          className={classNames(
                            "h-11 rounded-xl text-xs font-black border-2 transition-all",
                            isSelected ? "bg-emerald-600 text-white border-emerald-500 shadow-sm" : "bg-white text-ink-500 border-ink-100 hover:border-ink-200"
                          )}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 p-3 bg-ink-50 rounded-xl border border-ink-100">
                    <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-2">Legenda Auxiliar</div>
                    <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                      {FIGO_TYPES.map(t => (
                        <div key={t.id} className="flex gap-2 text-[10px] leading-tight text-ink-600">
                          <span className="font-black text-emerald-600 w-6 shrink-0">{t.label}:</span>
                          <span>{t.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1 h-3 bg-brand-500 rounded-full" />
                    <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Vascularização (Doppler)</label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => updateMyoma(myoma.id, { vascularity: v })}
                        className={classNames(
                          "h-12 rounded-2xl text-sm font-black border-2 transition-all",
                          myoma.vascularity === v ? "bg-emerald-600 text-white border-emerald-500 shadow-sm" : "bg-white text-ink-500 border-ink-100 hover:border-ink-200"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {myoma.classification && (
                  <ResultCard
                    label="Classificação FIGO"
                    value={myoma.classification}
                    recommendation={myoma.description || ''}
                    variant="emerald"
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
