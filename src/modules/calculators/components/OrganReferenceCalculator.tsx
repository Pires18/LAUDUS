import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { BookOpen, Info } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classifyOrganMeasurement } from '../classifiers';

type Organ = 'liver' | 'spleen' | 'kidney' | 'gallbladder' | 'prostate';

const REFS: Record<Organ, { label: string; short: string; desc: string; normal: string; alert: string; unit: string }> = {
  liver: {
    label: 'Fígado (Lobo Direito)', short: 'Fígado',
    desc: 'Medida longitudinal na linha hemiclavicular.',
    normal: 'Até 15.0 cm', alert: '> 15.5 cm (Hepatomegalia)', unit: 'cm',
  },
  spleen: {
    label: 'Baço (Eixo Longitudinal)', short: 'Baço',
    desc: 'Maior distância entre os polos superior e inferior.',
    normal: 'Até 12.0 cm', alert: '> 13.0 cm (Esplenomegalia)', unit: 'cm',
  },
  kidney: {
    label: 'Rim Adulto', short: 'Rim',
    desc: 'Eixo longitudinal bipolar.',
    normal: '9.0 - 12.0 cm', alert: '< 8.0 cm (Atrofia) ou > 13.0 cm', unit: 'cm',
  },
  gallbladder: {
    label: 'Vesícula Biliar (Parede)', short: 'Vesícula',
    desc: 'Espessura da parede anterior (paciente em jejum).',
    normal: 'Até 3.0 mm', alert: '> 3.5 mm (Parede espessada)', unit: 'mm',
  },
  prostate: {
    label: 'Próstata (Volume)', short: 'Próstata',
    desc: 'Volume calculado (C × L × A × 0.523).',
    normal: 'Até 25 - 30 cm³', alert: '> 30 cm³ (Aumento prostático)', unit: 'cm³',
  },
};

export function OrganReferenceCalculator({ value, onChange }: CalculatorProps) {
  const [selected, setSelected] = useState<Organ>('liver');
  const [measure, setMeasure] = useState('');

  const ref = REFS[selected];
  const val = Number(measure);

  const status: 'normal' | 'alert' | 'none' = measure
    ? classifyOrganMeasurement(selected, val)
    : 'none';

  useEffect(() => {
    const statusLabel = status === 'alert' ? 'AUMENTADO/ALTERADO' : status === 'normal' ? 'Normal' : null;
    onChange({
      selected: ref.label,
      measure,
      status,
      _summary: measure && statusLabel
        ? `Ref: ${ref.label} = ${measure}${ref.unit} (${statusLabel})`
        : null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, measure]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
          <BookOpen size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Valores de Referência</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Guia rápido de dimensões normais</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Órgão</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REFS) as Organ[]).map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { setSelected(o); setMeasure(''); }}
              className={classNames(
                'px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all',
                selected === o ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-white text-ink-500 border-ink-100 hover:border-ink-200'
              )}
            >
              {REFS[o].short}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 flex items-start justify-between gap-4">
        <div>
          <h4 className="font-black text-indigo-900 text-sm">{ref.label}</h4>
          <p className="text-[10px] text-indigo-600 font-medium mt-1">{ref.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Normalidade</span>
          <span className="text-xs font-bold text-indigo-900">{ref.normal}</span>
        </div>
      </div>

      <CalculatorInput
        type="number"
        label="Sua Medida"
        placeholder="0.0"
        value={measure}
        onChange={setMeasure}
        suffix={ref.unit}
      />

      {status !== 'none' ? (
        <ResultCard
          label={ref.label}
          value={status === 'normal' ? 'Normal' : 'Aumentado / Alterado'}
          recommendation={status === 'alert' ? ref.alert : `Dentro dos limites de normalidade (${ref.normal}).`}
          variant={status === 'normal' ? 'emerald' : 'red'}
        />
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira a medida para comparar</p>
        </div>
      )}

      <div className="p-3 bg-amber-50 rounded-xl flex gap-3 items-start border border-amber-100">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
          <strong>Atenção:</strong> valores de referência podem variar conforme a literatura (CBR, AIUM, ACR). Use sempre o julgamento clínico associado aos achados.
        </div>
      </div>
    </div>
  );
}
