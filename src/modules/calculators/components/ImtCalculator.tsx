import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Info } from 'lucide-react';
import { classNames } from '../../../utils/format';

// ELSA-Brasil IMT Reference (Freire et al. 2015, Lotufo et al. 2016)
// Thresholds: p75 and p90 by age and sex
const IMT_REF: Record<string, Record<string, { p75: number; p90: number }>> = {
  male: {
    '35-44': { p75: 0.72, p90: 0.82 },
    '45-54': { p75: 0.80, p90: 0.93 },
    '55-64': { p75: 0.90, p90: 1.03 },
    '65+':   { p75: 0.98, p90: 1.12 },
  },
  female: {
    '35-44': { p75: 0.65, p90: 0.74 },
    '45-54': { p75: 0.73, p90: 0.84 },
    '55-64': { p75: 0.82, p90: 0.95 },
    '65+':   { p75: 0.90, p90: 1.04 },
  }
};

function getAgeGroup(age: number): string {
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

export function ImtCalculator({ value, onChange }: CalculatorProps) {
  const [age, setAge] = useState(value?.age || '');
  const [sex, setSex] = useState<'male' | 'female'>(value?.sex || 'male');
  const [imtRight, setImtRight] = useState(value?.imtRight || '');
  const [imtLeft, setImtLeft] = useState(value?.imtLeft || '');

  useEffect(() => {
    let classification = '';
    let maxImt: number | null = null;
    let ref: { p75: number; p90: number } | null = null;

    if (age && (imtRight || imtLeft)) {
      const r = Number(imtRight) || 0;
      const l = Number(imtLeft) || 0;
      maxImt = Math.max(r, l);

      const ageGroup = getAgeGroup(Number(age));
      ref = IMT_REF[sex]?.[ageGroup] || null;

      if (ref) {
        if (maxImt <= ref.p75) classification = 'Normal (≤ p75)';
        else if (maxImt <= ref.p90) classification = 'Espessamento moderado (p75-p90)';
        else classification = 'Espessamento acentuado (> p90) — Risco cardiovascular elevado';
      }
    }

    const summary = maxImt
      ? `IMT Carótidas (ELSA-Brasil): Dir: ${imtRight || '-'}mm | Esq: ${imtLeft || '-'}mm | Máx: ${maxImt.toFixed(2)}mm. ${classification}. Ref: ${sex === 'male' ? 'Masc' : 'Fem'}, ${age} anos (p75: ${ref?.p75 || '?'} / p90: ${ref?.p90 || '?'}).`
      : null;

    onChange({ age, sex, imtRight, imtLeft, maxImt, classification, ref, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age, sex, imtRight, imtLeft]);

  const ref = value?.ref;

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5"><Activity size={14} className="text-violet-600" /><h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">IMT Carótidas (ELSA-Brasil)</h3></div>
        <span className="text-[8px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">ELSA-BR</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">Idade (anos)</label>
            <input type="number" className="input text-center text-xs h-8" value={age} onChange={e => setAge(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">Sexo</label>
            <div className="flex gap-1">
              <button onClick={() => setSex('male')} className={classNames("flex-1 py-1 text-[10px] font-bold rounded border transition-all", sex === 'male' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-ink-500 border-ink-200')}>Masc</button>
              <button onClick={() => setSex('female')} className={classNames("flex-1 py-1 text-[10px] font-bold rounded border transition-all", sex === 'female' ? 'bg-pink-500 text-white border-pink-600' : 'bg-white text-ink-500 border-ink-200')}>Fem</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">IMT Direita (mm)</label><input type="number" step="0.01" className="input text-center text-xs h-8" value={imtRight} onChange={e => setImtRight(e.target.value)} /></div>
          <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">IMT Esquerda (mm)</label><input type="number" step="0.01" className="input text-center text-xs h-8" value={imtLeft} onChange={e => setImtLeft(e.target.value)} /></div>
        </div>

        {value?.maxImt ? (
          <div className="space-y-2">
            <div className={classNames("rounded-lg p-2 border flex items-center justify-between",
              value.maxImt <= (ref?.p75 || 0.7) ? "bg-emerald-50 border-emerald-200" :
              value.maxImt <= (ref?.p90 || 0.9) ? "bg-amber-50 border-amber-200" :
              "bg-red-50 border-red-200"
            )}>
              <div><span className="text-[8px] font-bold uppercase block mb-0.5 opacity-60">IMT Máximo</span><span className="text-lg font-black leading-none">{value.maxImt.toFixed(2)} mm</span></div>
              <div className="text-right"><span className="text-[8px] font-bold uppercase block mb-0.5 opacity-60">Classificação</span><span className="text-[10px] font-bold">{value.classification}</span></div>
            </div>
            {ref && (
              <div className="text-[8px] text-ink-400 text-center italic">
                Referência ELSA-Brasil ({sex === 'male' ? 'Masc' : 'Fem'}, {getAgeGroup(Number(age))} anos): p75 = {ref.p75}mm | p90 = {ref.p90}mm
              </div>
            )}
          </div>
        ) : (
          <div className="bg-ink-50 rounded-md p-2 flex items-center gap-2 border border-dashed border-ink-200">
            <Info size={12} className="text-ink-400" /><span className="text-[10px] text-ink-400">Insira idade, sexo e medidas de IMT.</span>
          </div>
        )}
      </div>
    </div>
  );
}
