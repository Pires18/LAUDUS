import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Maximize2 } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';

export function VolumeCalculator({ value, onChange }: CalculatorProps) {
  const [structureName, setStructureName] = useState<string>(value?.structureName ?? '');
  const [d1, setD1] = useState<number | ''>(value?.d1 ?? '');
  const [d2, setD2] = useState<number | ''>(value?.d2 ?? '');
  const [d3, setD3] = useState<number | ''>(value?.d3 ?? '');
  const [unit, setUnit] = useState<string>(value?.unit ?? 'cm');

  useEffect(() => {
    let volumeCm3 = 0;
    if (typeof d1 === 'number' && typeof d2 === 'number' && typeof d3 === 'number' && d1 > 0 && d2 > 0 && d3 > 0) {
      const rawVolume = d1 * d2 * d3 * 0.523;
      // Se unidade for mm, converter mm³ → cm³ (÷ 1000). Se cm, já está em cm³.
      volumeCm3 = unit === 'mm' ? rawVolume / 1000 : rawVolume;
    }

    const name = structureName.trim() || 'Estrutura';
    const displayVol = volumeCm3 ? volumeCm3.toFixed(2) : null;

    onChange({
      structureName, d1, d2, d3, unit,
      volume: displayVol ? parseFloat(displayVol) : null,
      _summary: displayVol
        ? `[Volume Calculado] ${name}: ${d1} × ${d2} × ${d3} ${unit} (Vol. Aprox.: ${displayVol} cm³ / mL).`
        : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureName, d1, d2, d3, unit]);

  const volume = value?.volume;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
          <Ruler size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Cálculo Volumétrico</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Fórmula do Elipsóide (D1 × D2 × D3 × 0.523)</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <CalculatorInput
          label="Identificação da Estrutura"
          placeholder="Ex: Próstata, Nódulo, Tireoide..."
          value={structureName}
          onChange={setStructureName}
        />

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Unidade de Medida</label>
          <div className="flex gap-2">
            {['cm', 'mm'].map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                  unit === u ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-100' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-ink-400 font-medium ml-1">
            Resultado sempre exibido em cm³ (mL).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Maximize2 size={16} className="text-brand-500" />
          <span className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Dimensões do Elipsóide</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CalculatorInput type="number" label={`D1 — Long (${unit})`} placeholder="0.0" value={d1} onChange={(v: any) => setD1(v ? Number(v) : '')} suffix={unit} />
          <CalculatorInput type="number" label={`D2 — Trans (${unit})`} placeholder="0.0" value={d2} onChange={(v: any) => setD2(v ? Number(v) : '')} suffix={unit} />
          <CalculatorInput type="number" label={`D3 — AP (${unit})`} placeholder="0.0" value={d3} onChange={(v: any) => setD3(v ? Number(v) : '')} suffix={unit} />
        </div>
      </div>

      {volume ? (
        <ResultCard
          label={`Volume Estimado — ${structureName.trim() || 'Estrutura'}`}
          value={`${volume.toFixed(2)} cm³ (mL)`}
          variant="brand"
        />
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-[2.5rem] text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Aguardando medidas para cálculo</p>
        </div>
      )}
    </div>
  );
}
