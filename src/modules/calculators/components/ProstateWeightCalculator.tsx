import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';

export function ProstateWeightCalculator({ value, onChange }: CalculatorProps) {
  const [d1, setD1] = useState(value?.d1 || ''); // Transverso
  const [d2, setD2] = useState(value?.d2 || ''); // Anteroposterior
  const [d3, setD3] = useState(value?.d3 || ''); // Longitudinal

  useEffect(() => {
    let volume: number | null = null;
    let weight: number | null = null;
    let classification = '';

    if (d1 && d2 && d3) {
      // Volume do elipsoide = 0.523 × D1 × D2 × D3 (mm³ → cm³)
      volume = 0.523 * Number(d1) * Number(d2) * Number(d3) / 1000;
      // Peso ≈ Volume × 1.05 (densidade do tecido prostático g/cm³)
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

  const variant = !value?.volume ? 'brand'
    : value.volume <= 20 ? 'emerald'
    : value.volume <= 50 ? 'amber'
    : 'red';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
          <Ruler size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Peso Prostático</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Volume do Elipsoide (D1 × D2 × D3 × 0.523)</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Diâmetros Prostáticos</label>
        <div className="grid grid-cols-3 gap-4">
          <CalculatorInput type="number" label="Transv." placeholder="0" value={d1} onChange={setD1} suffix="mm" />
          <CalculatorInput type="number" label="AP" placeholder="0" value={d2} onChange={setD2} suffix="mm" />
          <CalculatorInput type="number" label="Long." placeholder="0" value={d3} onChange={setD3} suffix="mm" />
        </div>
      </div>

      {value?.volume ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <ResultCard label="Volume" value={`${value.volume.toFixed(1)} cc`} variant="brand" />
            <ResultCard label="Peso Estimado" value={`${value.weight.toFixed(1)} g`} variant="brand" />
          </div>
          <ResultCard label="Classificação" value={value.classification} variant={variant} />
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira os 3 diâmetros prostáticos</p>
        </div>
      )}
    </div>
  );
}
