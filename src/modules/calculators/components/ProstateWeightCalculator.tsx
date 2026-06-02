import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Info } from 'lucide-react';
import { classNames } from '../../../utils/format';

export function ProstateWeightCalculator({ value, onChange }: CalculatorProps) {
  const [d1, setD1] = useState(value?.d1 || '');
  const [d2, setD2] = useState(value?.d2 || '');
  const [d3, setD3] = useState(value?.d3 || '');

  useEffect(() => {
    let volume: number | null = null;
    let weight: number | null = null;
    let classification = '';

    if (d1 && d2 && d3) {
      // Volume = π/6 × D1 × D2 × D3 (Ellipsoid formula, equivalent to 0.523)
      volume = 0.523 * Number(d1) * Number(d2) * Number(d3) / 1000; // result in cm³ (cc)
      // Weight ≈ Volume × 1.05 (density of prostate tissue g/cm³)
      weight = volume * 1.05;

      if (volume <= 20) classification = 'Normal (até 20cc)';
      else if (volume <= 30) classification = 'Aumento leve (20-30cc)';
      else if (volume <= 50) classification = 'Aumento moderado (30-50cc)';
      else if (volume <= 80) classification = 'Aumento acentuado (50-80cc)';
      else classification = 'Aumento muito acentuado (> 80cc)';
    }

    const summary = volume
      ? `Próstata: ${Number(d1).toFixed(0)}x${Number(d2).toFixed(0)}x${Number(d3).toFixed(0)}mm. Volume: ${volume.toFixed(1)}cc. Peso: ${weight!.toFixed(1)}g. ${classification}.`
      : null;

    onChange({ d1, d2, d3, volume, weight, classification, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d1, d2, d3]);

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Ruler size={14} className="text-teal-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Peso Prostático</h3>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">Tranv. (mm)</label><input type="number" className="input text-center text-xs h-8" value={d1} onChange={e => setD1(e.target.value)} /></div>
          <div><label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">AP (mm)</label><input type="number" className="input text-center text-xs h-8" value={d2} onChange={e => setD2(e.target.value)} /></div>
          <div><label className="text-[9px] font-bold text-ink-400 uppercase text-center block mb-0.5">Long. (mm)</label><input type="number" className="input text-center text-xs h-8" value={d3} onChange={e => setD3(e.target.value)} /></div>
        </div>
        {value?.volume ? (
          <div className="space-y-2">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 flex items-center justify-between">
              <div><span className="text-[8px] font-bold text-teal-600 uppercase block mb-0.5">Volume</span><span className="text-lg font-black text-teal-900 leading-none">{value.volume.toFixed(1)} cc</span></div>
              <div className="text-right"><span className="text-[8px] font-bold text-teal-600 uppercase block mb-0.5">Peso Est.</span><span className="text-lg font-black text-teal-900 leading-none">{value.weight.toFixed(1)} g</span></div>
            </div>
            <div className={classNames("text-[10px] font-bold text-center py-1 rounded",
              value.volume <= 20 ? "bg-emerald-50 text-emerald-700" :
              value.volume <= 30 ? "bg-blue-50 text-blue-700" :
              value.volume <= 50 ? "bg-amber-50 text-amber-700" :
              "bg-red-50 text-red-700"
            )}>{value.classification}</div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-md p-2 flex items-center gap-2 border border-dashed border-ink-200">
            <Info size={12} className="text-ink-400" /><span className="text-[10px] text-ink-400">Insira os 3 diâmetros prostáticos.</span>
          </div>
        )}
      </div>
    </div>
  );
}
