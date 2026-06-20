import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Maximize, Activity, Sparkles, Check } from 'lucide-react';
import { genId } from '../../../store/db';
import { classNames } from '../../../utils/format';
import { CategorySelector, ResultCard, CalculatorInput } from './CalculatorUI';

interface Lesion {
  id: string;
  location: string;
  d1: number | '';
  d2: number | '';
  d3: number | '';
  composition: string | number | null;
  echogenicity: string | number | null;
  shape: string | number | null;
  margin: string | number | null;
  /** ACR TI-RADS: múltiplos focos podem coexistir — array de pontos selecionados */
  echogenicFoci: number[];
  totalPoints: number | null;
  classification: string | null;
  recommendation: string | null;
}

const COMPOSITION = [
  { label: 'Cística', value: 'cistica', points: 0, description: 'Completamente cística ou quase cística' },
  { label: 'Espongiforme', value: 'espongiforme', points: 0, description: 'Aspecto em esponja (≥ 50% pequenos cistos)' },
  { label: 'Mista (cística + sólida)', value: 'mista', points: 1, description: 'Porções sólidas e císticas' },
  { label: 'Sólida', value: 'solida', points: 2, description: 'Completamente ou quase completamente sólida' },
];

const ECHOGENICITY = [
  { label: 'Anecóico', value: 'anecoico', points: 0 },
  { label: 'Hiperecóico / Isoecóico', value: 'hiperecoico', points: 1 },
  { label: 'Hipoecóico', value: 'hipoecoico', points: 2 },
  { label: 'Muito Hipoecóico', value: 'muito_hipoecoico', points: 3, description: 'Mais hipoecóico que a musculatura adjacente' },
];

const SHAPE = [
  { label: 'Mais largo que alto (oval/redondo)', value: 'mais_largo', points: 0 },
  { label: 'Mais alto que largo (taller-than-wide)', value: 'mais_alto', points: 3 },
];

const MARGIN = [
  { label: 'Lisa', value: 'lisa', points: 0 },
  { label: 'Mal definida', value: 'mal_definida', points: 0 },
  { label: 'Lobulada / Irregular', value: 'irregular', points: 2 },
  { label: 'Extensão extratireoideana', value: 'extratireoideana', points: 3 },
];

// ACR TI-RADS: focos ecogênicos são ADITIVOS — vários podem coexistir
const ECHOGENIC_FOCI = [
  { label: 'Nenhum / Artefato cauda de cometa', points: 0, description: 'Sem focos ou só cauda de cometa (benigno)' },
  { label: 'Macrocalcificações', points: 1, description: 'Calcificações > 1mm com sombra acústica' },
  { label: 'Calcificações periféricas', points: 2, description: 'Calcificações em casca de ovo ou anel' },
  { label: 'Focos ecogênicos puntiformes', points: 3, description: 'Pontos brilhantes < 1mm, suspeitos de microcalcificações' },
];

const getPoints = (opts: any[], currentVal: any): number => {
  if (currentVal === null || currentVal === undefined || currentVal === '') return -1;
  const match = opts.find(o => o.value === currentVal || o.points === currentVal);
  return match ? (match.points ?? 0) : -1;
};

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

      const compPts = getPoints(COMPOSITION, lesion.composition);
      if (compPts !== -1) total += compPts; else complete = false;

      const echoPts = getPoints(ECHOGENICITY, lesion.echogenicity);
      if (echoPts !== -1) total += echoPts; else complete = false;

      const shapePts = getPoints(SHAPE, lesion.shape);
      if (shapePts !== -1) total += shapePts; else complete = false;

      const marginPts = getPoints(MARGIN, lesion.margin);
      if (marginPts !== -1) total += marginPts; else complete = false;

      // Soma TODOS os focos ecogênicos selecionados (aditivo per ACR 2017)
      lesion.echogenicFoci.forEach(p => { total += p; });

      let tr = '';
      let rec = '';
      if (complete) {
        if (total === 0)              { tr = 'TR1'; rec = 'Benigno. PAAF não recomendada.'; }
        else if (total <= 2)          { tr = 'TR2'; rec = 'Não suspeito. PAAF não recomendada.'; }
        else if (total === 3)         { tr = 'TR3'; rec = 'Levemente suspeito. PAAF se ≥ 2,5 cm. Seguimento se ≥ 1,5 cm.'; }
        else if (total >= 4 && total <= 6) { tr = 'TR4'; rec = 'Moderadamente suspeito. PAAF se ≥ 1,5 cm. Seguimento se ≥ 1,0 cm.'; }
        else if (total >= 7)          { tr = 'TR5'; rec = 'Altamente suspeito. PAAF se ≥ 1,0 cm. Seguimento se ≥ 0,5 cm.'; }
      }

      return {
        ...lesion,
        totalPoints: complete ? total : null,
        classification: complete ? tr : null,
        recommendation: complete ? rec : null
      };
    });

    const summaries = updatedLesions.map(l => {
      if (!l.classification) return null;
      const dims = (l.d1 && l.d2 && l.d3) ? ` (${l.d1}×${l.d2}×${l.d3}mm)` : '';
      return `${l.location}${dims}: ${l.classification} (${l.totalPoints} pts). ${l.recommendation}`;
    }).filter(Boolean);

    onChange({
      lesions: updatedLesions,
      _summary: summaries.length > 0 ? `[TI-RADS Calculado]\n${summaries.join('\n')}` : null
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

  /** Toggle de foco ecogênico — multi-select com regra de exclusão para "Nenhum" */
  function toggleEchogenicFocus(lesion: Lesion, points: number) {
    let newFoci: number[];
    if (points === 0) {
      // "Nenhum / Cauda de cometa" é exclusivo
      newFoci = lesion.echogenicFoci.includes(0) ? [] : [0];
    } else {
      // Selecionar qualquer outro remove "Nenhum" (0)
      const withoutNone = lesion.echogenicFoci.filter(p => p !== 0);
      if (withoutNone.includes(points)) {
        newFoci = withoutNone.filter(p => p !== points);
      } else {
        newFoci = [...withoutNone, points];
      }
    }
    updateLesion(lesion.id, { echogenicFoci: newFoci });
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
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Padrão ACR 2017 (American College of Radiology)</p>
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
          <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
            <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
              <MapPin size={32} />
            </div>
            <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Nenhum nódulo registrado</p>
          </div>
        )}

        {lesions.map((lesion) => (
          <div key={lesion.id} className="bg-white rounded-2xl border-2 border-ink-100 overflow-hidden shadow-sm transition-all hover:border-ink-200">
            {/* HEADER */}
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
                  {lesion.classification
                    ? <span className="font-black text-xs">{lesion.classification}</span>
                    : <Activity size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-ink-900 uppercase tracking-tight">{lesion.location}</div>
                  <div className="text-[10px] text-ink-400 font-bold uppercase tracking-widest flex items-center gap-3 mt-0.5">
                    {lesion.d1 && lesion.d2 && lesion.d3 ? (
                      <span className="flex items-center gap-1"><Maximize size={10} /> {lesion.d1}×{lesion.d2}×{lesion.d3}mm</span>
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

            {/* CONTENT */}
            {expandedId === lesion.id && (
              <div className="p-8 pt-0 border-t border-ink-50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-4 pt-6">
                  <CalculatorInput
                    label="Localização / Nome"
                    placeholder="Ex: Lobo Direito, Istmo..."
                    value={lesion.location}
                    onChange={(val: string) => updateLesion(lesion.id, { location: val })}
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Dimensões (mm)</label>
                    <div className="flex items-center gap-3">
                      <CalculatorInput type="number" placeholder="Long" value={lesion.d1} onChange={(v: any) => updateLesion(lesion.id, { d1: v ? Number(v) : '' })} suffix="mm" />
                      <CalculatorInput type="number" placeholder="Trans" value={lesion.d2} onChange={(v: any) => updateLesion(lesion.id, { d2: v ? Number(v) : '' })} suffix="mm" />
                      <CalculatorInput type="number" placeholder="AP" value={lesion.d3} onChange={(v: any) => updateLesion(lesion.id, { d3: v ? Number(v) : '' })} suffix="mm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <CategorySelector label="1. Composição" options={COMPOSITION} current={lesion.composition} onSelect={(val: any) => updateLesion(lesion.id, { composition: val })} />
                  <CategorySelector label="2. Ecogenicidade" options={ECHOGENICITY} current={lesion.echogenicity} onSelect={(val: any) => updateLesion(lesion.id, { echogenicity: val })} />
                  <CategorySelector label="3. Forma" options={SHAPE} current={lesion.shape} onSelect={(val: any) => updateLesion(lesion.id, { shape: val })} columns={1} />
                  <CategorySelector label="4. Margem" options={MARGIN} current={lesion.margin} onSelect={(val: any) => updateLesion(lesion.id, { margin: val })} />

                  {/* 5. Focos Ecogênicos — MULTI-SELECT per ACR TI-RADS 2017 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1 h-3 bg-brand-500 rounded-full" />
                      <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">5. Focos Ecogênicos</label>
                    </div>
                    <p className="text-[9px] text-ink-400 font-semibold ml-3 -mt-1">
                      Selecione <strong>todos</strong> os tipos presentes — pontos são somados (ACR 2017).
                    </p>
                    <div className="flex flex-col gap-2">
                      {ECHOGENIC_FOCI.map((o) => {
                        const isSelected = lesion.echogenicFoci.includes(o.points);
                        return (
                          <button
                            key={o.label}
                            type="button"
                            onClick={() => toggleEchogenicFocus(lesion, o.points)}
                            className={classNames(
                              "flex items-start text-left p-3 rounded-2xl border-2 transition-all gap-3",
                              isSelected
                                ? "border-brand-500 bg-brand-50 shadow-sm"
                                : "border-ink-100 bg-white hover:border-ink-200 hover:bg-ink-50/50"
                            )}
                          >
                            <div className={classNames(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                              isSelected ? "border-brand-500 bg-brand-500" : "border-ink-300 bg-white"
                            )}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={classNames(
                                "text-[11px] font-bold leading-tight block",
                                isSelected ? "text-brand-900" : "text-ink-700"
                              )}>
                                {o.label}
                              </span>
                              {o.description && (
                                <span className="text-[9px] text-ink-400 leading-tight mt-0.5 block">{o.description}</span>
                              )}
                            </div>
                            <span className={classNames(
                              "text-[10px] font-black px-1.5 py-0.5 rounded-lg shrink-0",
                              isSelected ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500"
                            )}>
                              +{o.points}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {lesion.echogenicFoci.length > 0 && (
                      <div className="ml-3 text-[9px] font-black text-brand-600 uppercase tracking-wider">
                        Total focos: +{lesion.echogenicFoci.reduce((a, b) => a + b, 0)} ptos
                      </div>
                    )}
                  </div>
                </div>

                {lesion.classification && (
                  <ResultCard
                    label="Classificação ACR TI-RADS"
                    value={lesion.classification}
                    points={lesion.totalPoints || 0}
                    recommendation={lesion.recommendation || ''}
                    variant={
                      lesion.totalPoints && lesion.totalPoints >= 7 ? 'red'
                      : lesion.totalPoints && lesion.totalPoints >= 4 ? 'amber'
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
