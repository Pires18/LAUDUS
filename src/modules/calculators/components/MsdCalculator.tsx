import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Info } from 'lucide-react';

export function MsdCalculator({ value, onChange }: CalculatorProps) {
  const [d1, setD1] = useState(value?.d1 || '');
  const [d2, setD2] = useState(value?.d2 || '');
  const [d3, setD3] = useState(value?.d3 || '');

  useEffect(() => {
    let msd = null;
    let ga = null;

    if (d1 && d2 && d3) {
      msd = (Number(d1) + Number(d2) + Number(d3)) / 3;
      // Formula: GA (days) = MSD (mm) + 30
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

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Ruler size={14} className="text-amber-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">DMSG (Saco Gestacional)</h3>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">D1 (mm)</label>
            <input type="number" className="input text-center text-xs h-8" value={d1} onChange={e => setD1(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">D2 (mm)</label>
            <input type="number" className="input text-center text-xs h-8" value={d2} onChange={e => setD2(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">D3 (mm)</label>
            <input type="number" className="input text-center text-xs h-8" value={d3} onChange={e => setD3(e.target.value)} />
          </div>
        </div>

        {value?.msd && (value.msd < 5 || value.msd > 25) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
            <Info size={13} className="text-amber-500 shrink-0" />
            <span className="text-[9px] text-amber-700 font-medium leading-tight">
              {value.msd < 5
                ? 'DMSG < 5mm: abaixo do intervalo de validação. Confirmar com USG transvaginal.'
                : 'DMSG > 25mm: embrião já deve ser visível. Prefira datação pelo CCN.'}
            </span>
          </div>
        )}

        {value?.msd ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
            <div>
              <span className="text-[8px] font-bold text-amber-600 uppercase block mb-0.5">Média (DMSG)</span>
              <span className="text-lg font-black text-amber-900 leading-none">{value.msd.toFixed(1)}mm</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-bold text-amber-600 uppercase block mb-0.5">IG Estimada</span>
              <span className="text-[11px] font-bold text-amber-800 leading-none">{value.ga}</span>
            </div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-md p-2 text-center text-[10px] text-ink-400 border border-dashed border-ink-200">
            Insira os 3 diâmetros do saco gestacional (5–25mm).
          </div>
        )}
      </div>
    </div>
  );
}
