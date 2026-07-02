import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Info } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';

export function MsdCalculator({ value, onChange }: CalculatorProps) {
  const [d1, setD1] = useState(value?.d1 || '');
  const [d2, setD2] = useState(value?.d2 || '');
  const [d3, setD3] = useState(value?.d3 || '');

  useEffect(() => {
    let msd = null;
    let ga = null;

    if (d1 && d2 && d3) {
      msd = (Number(d1) + Number(d2) + Number(d3)) / 3;
      // Fórmula: IG (dias) = DMSG (mm) + 30
      const totalDays = Math.round(msd + 30);
      const weeks = Math.floor(totalDays / 7);
      const days = totalDays % 7;
      ga = `${weeks}s ${days}d`;
    }

    const summary = msd
      ? `Diâmetro médio do saco gestacional: ${msd.toFixed(1)}mm — IG estimada: ${ga}.`
      : null;

    onChange({
      d1, d2, d3, msd, ga,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d1, d2, d3]);

  const outOfRange = value?.msd && (value.msd < 5 || value.msd > 25);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
          <Ruler size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">DMSG (Saco Gestacional)</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Diâmetro Médio e IG Estimada</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Diâmetros do Saco Gestacional</label>
        <div className="grid grid-cols-3 gap-4">
          <CalculatorInput type="number" placeholder="D1" value={d1} onChange={setD1} suffix="mm" />
          <CalculatorInput type="number" placeholder="D2" value={d2} onChange={setD2} suffix="mm" />
          <CalculatorInput type="number" placeholder="D3" value={d3} onChange={setD3} suffix="mm" />
        </div>
      </div>

      {outOfRange && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-700 font-medium leading-tight">
            {value.msd < 5
              ? 'DMSG < 5mm: abaixo do intervalo de validação. Confirmar com USG transvaginal.'
              : 'DMSG > 25mm: embrião já deve ser visível. Prefira datação pelo CCN.'}
          </span>
        </div>
      )}

      {value?.msd ? (
        <div className="flex flex-col gap-4">
          <ResultCard label="Diâmetro Médio (DMSG)" value={`${value.msd.toFixed(1)} mm`} variant="brand" />
          <ResultCard label="Idade Gestacional Estimada" value={value.ga} variant="emerald" />
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira os 3 diâmetros (5–25mm)</p>
        </div>
      )}
    </div>
  );
}
