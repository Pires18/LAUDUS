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
  { label: 'Oval', value: 'Oval' },
  { label: 'Redondo', value: 'Redondo' },
  { label: 'Irregular', value: 'Irregular' },
];

const ORIENTATION = [
  { label: 'Paralelo (mais largo que alto)', value: 'Paralelo' },
  { label: 'Não-paralelo (mais alto que largo)', value: 'Não-paralelo' },
];

const MARGIN = [
  { label: 'Circunscrita', value: 'Circunscrita', description: 'Bem delimitada em toda circunferência' },
  { label: 'Indistinta', value: 'Indistinta', description: 'Não há transição clara com o tecido adjacente' },
  { label: 'Angular', value: 'Angular', description: 'Parte ou toda a margem com ângulos agudos' },
  { label: 'Microlobulada', value: 'Microlobulada', description: 'Contorno com curtas lobulações' },
  { label: 'Espiculada', value: 'Espiculada', description: 'Projeções radiais a partir da margem' },
];

const ECHO_PATTERN = [
  { label: 'Anecóico', value: 'Anecóico', description: 'Sem ecos internos (cisto simples)' },
  { label: 'Hiperecóico', value: 'Hiperecóico', description: 'Mais ecogênico que o tecido adiposo' },
  { label: 'Isoecóico', value: 'Isoecóico', description: 'Mesma ecogenicidade do tecido adiposo' },
  { label: 'Hipoecóico', value: 'Hipoecóico', description: 'Menos ecogênico que o tecido adiposo' },
  { label: 'Complexo Cístico/Sólido', value: 'Complexo Cístico e Sólido', description: 'Porções sólidas e císticas' },
  { label: 'Heterogêneo', value: 'Heterogêneo', description: 'Ecotextura mista sem padrão definido' },
];

const POSTERIOR = [
  { label: 'Sem alteração posterior', value: 'Sem alteração' },
  { label: 'Reforço acústico posterior', value: 'Reforço', description: 'Típico de cistos' },
  { label: 'Sombra acústica posterior', value: 'Sombra Acústica', description: 'Suspei to — cicatriz, calcificação' },
  { label: 'Padrão combinado', value: 'Combinado' },
];

const CALCIFICATIONS = [
  { label: 'Ausentes', value: 'Ausentes' },
  { label: 'Macrocalcificações', value: 'Macrocalcificações', description: 'Calcificações grosseiras > 0,5mm' },
  { label: 'Microcalcificações', value: 'Microcalcificações', description: 'Focos puntiformes < 0,5mm — suspeitos' },
  { label: 'Periféricas (distrofia)', value: 'Periféricas', description: 'Calcificações na parede da lesão' },
];

/**
 * Classificação BI-RADS US 2013 por contagem de features suspeitas.
 * Referência: ACR BI-RADS® Atlas 5th Edition (2013).
 */
function classifyBirads(l: Lesion): { cat: string; rec: string } {
  if (!l.shape || !l.margin || !l.orientation || !l.echoPattern) {
    return { cat: '0', rec: 'Avaliação Incompleta — preencha todos os campos.' };
  }

  // Cisto simples = BI-RADS 2 (benigno definitivo)
  if (
    l.echoPattern === 'Anecóico' &&
    l.margin === 'Circunscrita' &&
    (l.shape === 'Oval' || l.shape === 'Redondo') &&
    l.orientation === 'Paralelo'
  ) {
    return { cat: '2', rec: 'Benigno. Cisto simples clássico. Nenhum acompanhamento necessário.' };
  }

  // Contagem de features suspeitas per ACR BI-RADS 2013
  let suspiciousCount = 0;
  const suspiciousFeatures: string[] = [];

  if (l.shape === 'Irregular') {
    suspiciousCount++;
    suspiciousFeatures.push('forma irregular');
  }
  if (l.orientation === 'Não-paralelo') {
    suspiciousCount++;
    suspiciousFeatures.push('orientação não-paralela');
  }
  if (l.margin && ['Indistinta', 'Angular', 'Microlobulada', 'Espiculada'].includes(l.margin)) {
    suspiciousCount++;
    suspiciousFeatures.push(`margem ${l.margin.toLowerCase()}`);
  }
  if (l.echoPattern === 'Hipoecóico') {
    suspiciousCount++;
    suspiciousFeatures.push('padrão hipoecóico');
  }
  if (l.posteriorFeatures === 'Sombra Acústica') {
    suspiciousCount++;
    suspiciousFeatures.push('sombra acústica posterior');
  }
  if (l.calcifications === 'Microcalcificações') {
    suspiciousCount++;
    suspiciousFeatures.push('microcalcificações');
  }

  // BI-RADS 5: ≥ 4 features suspeitas OU combinação clássica de malignidade
  const isClassicMalignant =
    l.shape === 'Irregular' &&
    l.margin === 'Espiculada' &&
    l.orientation === 'Não-paralelo';

  if (isClassicMalignant || suspiciousCount >= 4) {
    return {
      cat: '5',
      rec: `Altamente suspeito (> 95% risco). Biópsia obrigatória independente do tamanho. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }

  // BI-RADS 4C: 3 features suspeitas (50-95%)
  if (suspiciousCount === 3) {
    return {
      cat: '4C',
      rec: `Suspeita alta (50-95% risco). Biópsia obrigatória. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }

  // BI-RADS 4B: 2 features suspeitas (10-50%)
  if (suspiciousCount === 2) {
    return {
      cat: '4B',
      rec: `Suspeita moderada (10-50% risco). Biópsia recomendada. Features: ${suspiciousFeatures.join(', ')}.`,
    };
  }

  // BI-RADS 4A: 1 feature suspeita (2-10%)
  if (suspiciousCount === 1) {
    return {
      cat: '4A',
      rec: `Suspeita baixa (2-10% risco). Biópsia recomendada. Feature: ${suspiciousFeatures.join(', ')}.`,
    };
  }

  // BI-RADS 3: provavelmente benigno — oval + paralelo + circunscrita (< 2%)
  if (
    (l.shape === 'Oval' || l.shape === 'Redondo') &&
    l.orientation === 'Paralelo' &&
    l.margin === 'Circunscrita'
  ) {
    return {
      cat: '3',
      rec: 'Provavelmente benigno (< 2% risco). Provável fibroadenoma. Controle por imagem em 6, 12 e 24 meses.',
    };
  }

  // Default: BI-RADS 3
  return {
    cat: '3',
    rec: 'Provavelmente benigno (< 2% risco). Controle por imagem em 6-12 meses.',
  };
}

export function BiradsCalculator({ value, onChange }: CalculatorProps) {
  const [lesions, setLesions] = useState<Lesion[]>(() => {
    return Array.isArray(value?.lesions) ? value.lesions : [];
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const updatedLesions = lesions.map(l => {
      const { cat, rec } = classifyBirads(l);
      return {
        ...l,
        classification: cat !== '0' ? `BI-RADS ${cat}` : null,
        recommendation: cat !== '0' ? rec : null,
      };
    });

    const summaries = updatedLesions.map(l => {
      if (!l.classification) return null;
      const dims = (l.d1 && l.d2 && l.d3) ? ` (${l.d1}×${l.d2}×${l.d3}mm)` : '';
      return `${l.location}${dims}: ${l.classification}. ${l.recommendation}`;
    }).filter(Boolean);

    onChange({
      lesions: updatedLesions,
      _summary: summaries.length > 0 ? `BI-RADS: ${summaries.join(' | ')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesions]);

  function addLesion() {
    const id = genId();
    setLesions([...lesions, {
      id, location: `Nódulo M${lesions.length + 1}`, d1: '', d2: '', d3: '',
      shape: null, orientation: null, margin: null, echoPattern: null,
      posteriorFeatures: null, calcifications: 'Ausentes', classification: null, recommendation: null
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
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Léxico BI-RADS Mama</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">ACR BI-RADS® US Atlas 2013 — Contagem de Features Suspeitas</p>
          </div>
        </div>
        <button
          onClick={addLesion}
          className="px-5 py-2.5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center gap-2"
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
            <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Nenhuma lesão mamária registrada</p>
          </div>
        )}

        {lesions.map((lesion) => (
          <div key={lesion.id} className="bg-white rounded-2xl border-2 border-ink-100 overflow-hidden shadow-sm transition-all hover:border-rose-200">
            {/* HEADER */}
            <div
              className={classNames(
                "flex items-center justify-between p-6 cursor-pointer transition-all",
                expandedId === lesion.id ? "bg-rose-50/20" : "hover:bg-ink-50/50"
              )}
              onClick={() => setExpandedId(expandedId === lesion.id ? null : lesion.id)}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={classNames(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all",
                  lesion.classification ? "bg-rose-500 text-white" : "bg-ink-100 text-ink-400"
                )}>
                  {lesion.classification
                    ? <span className="font-black text-[9px] text-center leading-tight px-1">{lesion.classification.replace('BI-RADS ', '')}</span>
                    : <Sparkles size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-ink-900 uppercase tracking-tight">{lesion.location}</div>
                  <div className="text-[10px] text-ink-400 font-bold uppercase tracking-widest flex items-center gap-3 mt-0.5">
                    {lesion.d1 && lesion.d2 && lesion.d3 ? (
                      <span className="flex items-center gap-1"><Maximize size={10} /> {lesion.d1}×{lesion.d2}×{lesion.d3}mm</span>
                    ) : <span>Sem medidas</span>}
                    {lesion.classification && (
                      <span className="text-rose-600">• {lesion.classification}</span>
                    )}
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

            {/* CONTENT */}
            {expandedId === lesion.id && (
              <div className="p-8 pt-0 border-t border-ink-50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-4 pt-6">
                  <CalculatorInput
                    label="Localização da Lesão"
                    placeholder="Ex: QSE D, QID E..."
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
                  <CategorySelector label="1. Forma" options={SHAPE} current={lesion.shape} onSelect={(v: string) => updateLesion(lesion.id, { shape: v })} />
                  <CategorySelector label="2. Orientação" options={ORIENTATION} current={lesion.orientation} onSelect={(v: string) => updateLesion(lesion.id, { orientation: v })} columns={1} />
                  <CategorySelector label="3. Margem" options={MARGIN} current={lesion.margin} onSelect={(v: string) => updateLesion(lesion.id, { margin: v })} />
                  <CategorySelector label="4. Padrão de Eco" options={ECHO_PATTERN} current={lesion.echoPattern} onSelect={(v: string) => updateLesion(lesion.id, { echoPattern: v })} />
                  <CategorySelector label="5. Características Posteriores" options={POSTERIOR} current={lesion.posteriorFeatures} onSelect={(v: string) => updateLesion(lesion.id, { posteriorFeatures: v })} />
                  <CategorySelector label="6. Calcificações" options={CALCIFICATIONS} current={lesion.calcifications} onSelect={(v: string) => updateLesion(lesion.id, { calcifications: v })} />
                </div>

                {lesion.classification && (
                  <ResultCard
                    label="Classificação ACR BI-RADS"
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
