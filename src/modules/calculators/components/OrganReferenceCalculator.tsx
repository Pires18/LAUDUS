import { useState } from 'react';
import { CalculatorProps } from '../registry';
import { BookOpen, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { classNames } from '../../../utils/format';

type Organ = 'liver' | 'spleen' | 'kidney' | 'gallbladder' | 'prostate';

const REFS: Record<Organ, any> = {
  liver: {
    label: 'Fígado (Lobo Direito)',
    desc: 'Medida longitudinal na linha hemiclavicular.',
    normal: 'Até 15.0 cm',
    alert: '> 15.5 cm (Hepatomegalia)',
    unit: 'cm'
  },
  spleen: {
    label: 'Baço (Eixo Longitudinal)',
    desc: 'Maior distância entre os polos superior e inferior.',
    normal: 'Até 12.0 cm',
    alert: '> 13.0 cm (Esplenomegalia)',
    unit: 'cm'
  },
  kidney: {
    label: 'Rim Adulto',
    desc: 'Eixo longitudinal bipolar.',
    normal: '9.0 - 12.0 cm',
    alert: '< 8.0 cm (Atrofia) ou > 13.0 cm',
    unit: 'cm'
  },
  gallbladder: {
    label: 'Vesícula Biliar (Parede)',
    desc: 'Espessura da parede anterior (paciente em jejum).',
    normal: 'Até 3.0 mm',
    alert: '> 3.5 mm (Edema/Parede Espessada)',
    unit: 'mm'
  },
  prostate: {
    label: 'Próstata (Volume)',
    desc: 'Volume calculado (C x L x A x 0.52).',
    normal: 'Até 25 - 30 g (ou cm³)',
    alert: '> 30 g (Aumento Prostático)',
    unit: 'g'
  }
};

export function OrganReferenceCalculator({ value, onChange }: CalculatorProps) {
  const [selected, setSelected] = useState<Organ>('liver');
  const [measure, setMeasure] = useState('');

  const ref = REFS[selected];
  const val = Number(measure);
  
  let status: 'normal' | 'alert' | 'none' = 'none';
  if (measure) {
    if (selected === 'liver') status = val > 15.5 ? 'alert' : 'normal';
    if (selected === 'spleen') status = val > 13.0 ? 'alert' : 'normal';
    if (selected === 'kidney') status = (val < 8 || val > 13) ? 'alert' : 'normal';
    if (selected === 'gallbladder') status = val > 3.0 ? 'alert' : 'normal';
    if (selected === 'prostate') status = val > 30 ? 'alert' : 'normal';
  }

  return (
    <div className="bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-ink-50 p-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-widest">Valores de Referência</h3>
        </div>
        <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">Guia de Bolso</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {(Object.keys(REFS) as Organ[]).map(o => (
            <button
              key={o}
              onClick={() => { setSelected(o); setMeasure(''); }}
              className={classNames(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all",
                selected === o ? "bg-indigo-600 text-white border-transparent shadow-sm" : "bg-white text-ink-500 border-ink-200 hover:border-indigo-300"
              )}
            >
              {REFS[o].label.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-indigo-900 text-sm">{ref.label}</h4>
              <p className="text-[10px] text-indigo-600 font-medium mt-0.5">{ref.desc}</p>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Normalidade</span>
              <span className="text-xs font-bold text-indigo-900">{ref.normal}</span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="text-[9px] font-black text-ink-400 uppercase mb-1 block">Sua Medida</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="input h-12 text-xl font-black" 
                  placeholder="0.0"
                  value={measure}
                  onChange={e => {
                    setMeasure(e.target.value);
                    onChange({ selected: ref.label, measure: e.target.value, _summary: e.target.value ? `Ref: ${ref.label} = ${e.target.value}${ref.unit}` : null });
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-ink-300 text-sm">{ref.unit}</span>
              </div>
            </div>

            <div className="shrink-0 w-24">
              {status === 'normal' && (
                <div className="text-emerald-600 flex flex-col items-center gap-1 animate-in zoom-in-50">
                  <CheckCircle2 size={32} />
                  <span className="text-[10px] font-black uppercase">Normal</span>
                </div>
              )}
              {status === 'alert' && (
                <div className="text-red-600 flex flex-col items-center gap-1 animate-in zoom-in-50">
                  <AlertCircle size={32} />
                  <span className="text-[10px] font-black uppercase">Aumentado</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg flex gap-3 items-start border border-amber-100">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[9px] text-amber-800 leading-relaxed font-medium">
            <strong>Atenção:</strong> Valores de referência podem variar conforme a literatura (CBR, AIUM, ACR). Use sempre o julgamento clínico associado aos achados.
          </div>
        </div>
      </div>
    </div>
  );
}
