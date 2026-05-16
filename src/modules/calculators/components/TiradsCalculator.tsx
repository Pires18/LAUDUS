import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Maximize, Activity, Sparkles } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';
import { CategorySelector, ResultCard, CalculatorInput } from './CalculatorUI';

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
  { label: 'Cística', points: 0, description: 'Completamente cística' },
  { label: 'Espongiforme', points: 0, description: 'Aspecto de esponja' },
  { label: 'Mista', points: 1, description: 'Sólida e cística' },
  { label: 'Sólida', points: 2, description: 'Completamente sólida' },
];

const ECHOGENICITY = [
  { label: 'Anecóico', points: 0 },
  { label: 'Hiperecóico / Isoecóico', points: 1 },
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
  { label: 'Lobulada / Irregular', points: 2 },
  { label: 'Extratireoideana', points: 3 },
];

const ECHOGENIC_FOCI = [
  { label: 'Nenhum / Cauda de cometa', points: 0 },
  { label: 'Macrocalcificações', points: 1 },
  { label: 'Calcificações periféricas', points: 2 },
  { label: 'Focos puntiformes', points: 3 },
];

export function TiradsCalculator({ value, onChange }: CalculatorProps) {
  const [lesions, setLesions] = useState<Lesion[]>(() => {
    if (Array.isArray(value?.lesions)) return value.lesions;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Escalonamento TI-RADS</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Padrão ACR (American College of Radiology)</p>
          </div>
        </div>
        <button 
          onClick={addLesion}
          className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
        >
          <Plus size={14} /> Novo Nódulo
        </button>
      </div>

      <div className="space-y-4">
        {lesions.length === 0 && (
          <div className="py-12 border-2 border-dashed border-ink-100 rounded-[2.5rem] text-center space-y-3">
            <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
               <MapPin size={32} />
            </div>
            <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Nenhum achado registrado até o momento</p>
          </div>
        )}
        {lesions.map((lesion) => (
          <div key={lesion.id} className="bg-white rounded-[2.5rem] border-2 border-ink-100 overflow-hidden shadow-sm transition-all hover:border-ink-200">
            {/* LESION HEADER */}
            <div 
              className={classNames(
                "flex items-center justify-between p-6 cursor-pointer transition-all",
                expandedId === lesion.id ? "bg-brand-50/20" : "hover:bg-ink-50/50"
              )}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={classNames(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all",
                  lesion.classification ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-400"
                )}>
                  {lesion.classification ? <span className="font-black text-xs">{lesion.classification}</span> : <Activity size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-ink-900 uppercase tracking-tight">{lesion.location}</div>
                  <div className="text-[10px] text-ink-400 font-bold uppercase tracking-widest flex items-center gap-3 mt-0.5">
                    {lesion.d1 && lesion.d2 && lesion.d3 ? (
                      <span className="flex items-center gap-1"><Maximize size={10} /> {lesion.d1}x{lesion.d2}x{lesion.d3}mm</span>
                    ) : <span>Sem medidas</span>}
                    {lesion.totalPoints !== null && (
                      <span className="text-brand-600">• {lesion.totalPoints} Pontos</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); removeLesion(lesion.id); }}
                  className="w-10 h-10 rounded-xl bg-ink-50 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                >
                  <Trash2 size={18} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-ink-400">
                  {expandedId === lesion.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {/* LESION CONTENT */}
            {expandedId === lesion.id && (
              <div className="p-8 pt-0 border-t border-ink-50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
                  <CalculatorInput 
                    label="Localização / Nome" 
                    placeholder="Ex: Lóbulo Direito" 
                    value={lesion.location} 
                    onChange={(val: string) => updateLesion(lesion.id, { location: val })} 
                  />
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Dimensões (Eixos)</label>
                     <div className="flex items-center gap-3">
                        <CalculatorInput type="number" placeholder="Long" value={lesion.d1} onChange={(v: any) => updateLesion(lesion.id, { d1: v ? Number(v) : '' })} suffix="mm" />
                        <CalculatorInput type="number" placeholder="Trans" value={lesion.d2} onChange={(v: any) => updateLesion(lesion.id, { d2: v ? Number(v) : '' })} suffix="mm" />
                        <CalculatorInput type="number" placeholder="AP" value={lesion.d3} onChange={(v: any) => updateLesion(lesion.id, { d3: v ? Number(v) : '' })} suffix="mm" />
                     </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <CategorySelector label="1. Composição" options={COMPOSITION} current={lesion.composition} onSelect={(pts: number) => updateLesion(lesion.id, { composition: pts })} />
                  <CategorySelector label="2. Ecogenicidade" options={ECHOGENICITY} current={lesion.echogenicity} onSelect={(pts: number) => updateLesion(lesion.id, { echogenicity: pts })} />
                  <CategorySelector label="3. Forma" options={SHAPE} current={lesion.shape} onSelect={(pts: number) => updateLesion(lesion.id, { shape: pts })} />
                  <CategorySelector label="4. Margem" options={MARGIN} current={lesion.margin} onSelect={(pts: number) => updateLesion(lesion.id, { margin: pts })} />
                  <CategorySelector label="5. Focos Ecogênicos" options={ECHOGENIC_FOCI} current={lesion.echogenicFoci.length > 0 ? lesion.echogenicFoci[0] : null} onSelect={(pts: number) => {
                    // Simplificado para UI: seleciona apenas um, ou implementa multi-select custom
                    updateLesion(lesion.id, { echogenicFoci: [pts] });
                  }} />
                </div>

                {lesion.classification && (
                  <ResultCard 
                    label="Classificação ACR TI-RADS" 
                    value={lesion.classification} 
                    points={lesion.totalPoints || 0}
                    recommendation={lesion.recommendation || ''}
                    variant={lesion.totalPoints && lesion.totalPoints >= 7 ? 'red' : lesion.totalPoints && lesion.totalPoints >= 4 ? 'amber' : 'emerald'}
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
