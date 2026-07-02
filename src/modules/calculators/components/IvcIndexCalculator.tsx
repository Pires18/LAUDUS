import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Droplets } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';

export function IvcIndexCalculator({ value, onChange }: CalculatorProps) {
  const [maxDia, setMaxDia] = useState(value?.maxDia || ''); // Diâmetro expiratório (máximo)
  const [minDia, setMinDia] = useState(value?.minDia || ''); // Diâmetro inspiratório (mínimo)

  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    const max = Number(maxDia);
    const min = Number(minDia);

    let idx: number | null = null;
    if (max && min && max > 0) {
      idx = ((max - min) / max) * 100;
    }

    setIndex(idx);

    let status = '';
    if (idx !== null) {
      if (idx > 50) status = 'Colapsabilidade > 50% (sugere volemia baixa/normal)';
      else status = 'Colapsabilidade < 50% (sugere congestão/volemia alta)';
    }

    onChange({
      maxDia, minDia, index: idx,
      _summary: idx !== null ? `Índice de Colapsabilidade da VCI: ${idx.toFixed(1)}% (${status})` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDia, minDia]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-sm">
          <Droplets size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Índice da Veia Cava (VCI)</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Colapsabilidade e Status Volêmico</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CalculatorInput
          type="number"
          label="Diâmetro Máx (Expiração)"
          placeholder="0.0"
          value={maxDia}
          onChange={setMaxDia}
          suffix="cm"
        />
        <CalculatorInput
          type="number"
          label="Diâmetro Mín (Inspiração)"
          placeholder="0.0"
          value={minDia}
          onChange={setMinDia}
          suffix="cm"
        />
      </div>

      {index !== null ? (
        <ResultCard
          label="Índice de Colapsabilidade"
          value={`${index.toFixed(1)}%`}
          recommendation={index > 50 ? 'Sugere resposta a volume (volemia baixa/normal).' : 'VCI plétórica — sugere congestão / volemia alta.'}
          variant={index > 50 ? 'emerald' : 'red'}
        />
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira os diâmetros da VCI</p>
        </div>
      )}
    </div>
  );
}
