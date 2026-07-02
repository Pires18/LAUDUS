import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Activity } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';
import { CategorySelector, ResultCard, CalculatorInput } from './CalculatorUI';

interface Lesion {
  id: string;
  location: string;
  d1: number | '';
  d2: number | '';
  d3: number | '';
  type: string | null;
  colorScore: number;
  innerWall: string | null;
  ascites: boolean;
  classification: string | null;
  recommendation: string | null;
}

const LESION_TYPES = [
  { label: 'Cisto Unilocular Simples', value: 'Cisto Unilocular Simples' },
  { label: 'Cisto Multilocular', value: 'Cisto Multilocular' },
  { label: 'Lesão Sólida', value: 'Lesão Sólida' },
  { label: 'Cisto com Componente Sólido', value: 'Cisto com Componente Sólido' },
];

const INNER_WALL = [
  { label: 'Liso', value: 'Liso' },
  { label: 'Irregular', value: 'Irregular' },
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
      _summary: summaries.length > 0 ? `O-RADS (Ovário): ${summaries.join(' | ')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesions]);

  function addLesion() {
    const id = genId();
    setLesions([...lesions, {
      id, location: `Lesão Anexial ${lesions.length + 1}`, d1: '', d2: '', d3: '',
      type: null, colorScore: 1, innerWall: 'Liso', ascites: false,
      classification: null, recommendation: null
    }]);
    setExpandedId(id);
  }

  function updateLesion(id: string, patch: Partial<Lesion>) {
    setLesions(lesions.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-sm">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">O-RADS (Anexos)</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">ACR O-RADS US 2022 — Estratificação de Risco</p>
          </div>
        </div>
        <button
          onClick={addLesion}
          className="px-5 py-2.5 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-100 flex items-center gap-2"
        >
          <Plus size={14} /> Nova Lesão
        </button>
      </div>

      <div className="space-y-4">
        {lesions.length === 0 && (
          <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
            <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
              <MapPin size={32} />
            </div>
            <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Nenhuma lesão anexial registrada</p>
          </div>
        )}

        {lesions.map((lesion) => (
          <div key={lesion.id} className="bg-white rounded-2xl border-2 border-ink-100 overflow-hidden shadow-sm transition-all hover:border-violet-200">
            <div
              className={classNames(
                "flex items-center justify-between p-6 cursor-pointer transition-all",
                expandedId === lesion.id ? "bg-violet-50/20" : "hover:bg-ink-50/50"
              )}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={classNames(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all",
                  lesion.classification ? "bg-violet-500 text-white" : "bg-ink-100 text-ink-400"
                )}>
                  {lesion.classification
                    ? <span className="font-black text-[10px] text-center leading-tight px-1">{lesion.classification.replace('O-RADS ', 'OR')}</span>
                    : <Activity size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-ink-900 uppercase tracking-tight">{lesion.location}</div>
                  <div className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">
                    {lesion.classification || 'Aguardando dados...'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setLesions(lesions.filter(l => l.id !== lesion.id)); }}
                  className="w-10 h-10 rounded-xl bg-ink-50 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                >
                  <Trash2 size={18} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-ink-400">
                  {expandedId === lesion.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {expandedId === lesion.id && (
              <div className="p-8 pt-0 border-t border-ink-50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-4 pt-6">
                  <CalculatorInput
                    label="Localização"
                    placeholder="Ex: Ovário direito..."
                    value={lesion.location}
                    onChange={(val: string) => updateLesion(lesion.id, { location: val })}
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Medidas (mm)</label>
                    <div className="flex items-center gap-3">
                      <CalculatorInput type="number" placeholder="C" value={lesion.d1} onChange={(v: any) => updateLesion(lesion.id, { d1: v ? Number(v) : '' })} suffix="mm" />
                      <CalculatorInput type="number" placeholder="L" value={lesion.d2} onChange={(v: any) => updateLesion(lesion.id, { d2: v ? Number(v) : '' })} suffix="mm" />
                      <CalculatorInput type="number" placeholder="A" value={lesion.d3} onChange={(v: any) => updateLesion(lesion.id, { d3: v ? Number(v) : '' })} suffix="mm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <CategorySelector label="1. Tipo de Lesão" options={LESION_TYPES} current={lesion.type} onSelect={(v: string) => updateLesion(lesion.id, { type: v })} columns={1} />
                  <CategorySelector label="2. Parede Interna" options={INNER_WALL} current={lesion.innerWall} onSelect={(v: string) => updateLesion(lesion.id, { innerWall: v })} />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1 h-3 bg-brand-500 rounded-full" />
                      <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">3. Color Score (Doppler)</label>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map(score => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => updateLesion(lesion.id, { colorScore: score })}
                          className={classNames(
                            "h-12 rounded-2xl text-sm font-black border-2 transition-all",
                            lesion.colorScore === score ? "bg-violet-600 text-white border-violet-500 shadow-sm" : "bg-white text-ink-500 border-ink-100 hover:border-ink-200"
                          )}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl border-2 border-ink-100 hover:border-ink-200 transition-all">
                    <input type="checkbox" checked={lesion.ascites} onChange={e => updateLesion(lesion.id, { ascites: e.target.checked })} className="w-5 h-5 accent-violet-600" />
                    <span className="text-[11px] font-bold text-ink-700 uppercase tracking-wider">Ascite ou nódulos peritoneais</span>
                  </label>
                </div>

                {lesion.classification && (
                  <ResultCard
                    label="Classificação ACR O-RADS"
                    value={lesion.classification}
                    recommendation={lesion.recommendation || ''}
                    variant={
                      lesion.classification.includes('5') ? 'red'
                      : lesion.classification.includes('4') ? 'amber'
                      : 'emerald'
                    }
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
