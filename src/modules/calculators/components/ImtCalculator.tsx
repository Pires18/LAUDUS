import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { IMT_REF, imtAgeGroup, imtClassification } from '../formulas';

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

      ref = IMT_REF[sex]?.[imtAgeGroup(Number(age))] || null;
      classification = imtClassification(Number(age), sex, maxImt) || '';
    }

    const summary = maxImt
      ? `IMT Carótidas (ELSA-Brasil): Dir: ${imtRight || '-'}mm | Esq: ${imtLeft || '-'}mm | Máx: ${maxImt.toFixed(2)}mm. ${classification}. Ref: ${sex === 'male' ? 'Masc' : 'Fem'}, ${age} anos (p75: ${ref?.p75 || '?'} / p90: ${ref?.p90 || '?'}).`
      : null;

    onChange({ age, sex, imtRight, imtLeft, maxImt, classification, ref, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [age, sex, imtRight, imtLeft]);

  const ref = value?.ref;
  const variant = !value?.maxImt ? 'brand'
    : value.maxImt <= (ref?.p75 ?? 0.7) ? 'emerald'
    : value.maxImt <= (ref?.p90 ?? 0.9) ? 'amber'
    : 'red';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-sm">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">IMT Carótidas</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Espessura Médio-Intimal — ELSA-Brasil</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CalculatorInput type="number" label="Idade" placeholder="0" value={age} onChange={setAge} suffix="anos" />
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Sexo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSex('male')}
              className={classNames('flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all', sex === 'male' ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50')}
            >
              Masc
            </button>
            <button
              type="button"
              onClick={() => setSex('female')}
              className={classNames('flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all', sex === 'female' ? 'bg-pink-500 text-white border-pink-400 shadow-sm' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50')}
            >
              Fem
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CalculatorInput type="number" label="EIM Direita" placeholder="0.00" value={imtRight} onChange={setImtRight} suffix="mm" />
        <CalculatorInput type="number" label="EIM Esquerda" placeholder="0.00" value={imtLeft} onChange={setImtLeft} suffix="mm" />
      </div>

      {value?.maxImt ? (
        <div className="flex flex-col gap-3">
          <ResultCard
            label="EIM Máxima"
            value={`${value.maxImt.toFixed(2)} mm`}
            recommendation={value.classification}
            variant={variant}
          />
          {ref && (
            <p className="text-[10px] text-ink-400 text-center font-medium">
              Referência ELSA-Brasil ({sex === 'male' ? 'Masc' : 'Fem'}, {imtAgeGroup(Number(age))} anos): p75 = {ref.p75}mm | p90 = {ref.p90}mm
            </p>
          )}
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira idade, sexo e medidas de EIM</p>
        </div>
      )}
    </div>
  );
}
