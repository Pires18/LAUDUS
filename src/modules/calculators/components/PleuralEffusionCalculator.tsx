import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Droplets, Info, AlertCircle } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { balikPleuralVolume } from '../formulas';

export function PleuralEffusionCalculator({ value, onChange }: CalculatorProps) {
  const [depth, setDepth] = useState(value?.depth || ''); // mm

  const [volume, setVolume] = useState<number | null>(null);

  useEffect(() => {
    const vol = balikPleuralVolume(Number(depth));

    setVolume(vol);

    onChange({
      method: 'balik', depth, volume: vol,
      _summary: vol ? `Derrame Pleural (Fórmula de Balik): Lâmina de ${depth}mm → Volume estimado de ${vol}ml.` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
          <Droplets size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Derrame Pleural (Balik)</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Estimativa Volumétrica Fisiológica</p>
        </div>
      </div>

      <CalculatorInput
        type="number"
        label="Espessura da Lâmina Líquida"
        placeholder="0"
        value={depth}
        onChange={setDepth}
        suffix="mm"
      />

      {volume !== null ? (
        <ResultCard
          label="Volume Estimado (Balik)"
          value={`${volume} mL`}
          variant="brand"
        />
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira a espessura da lâmina</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="p-3 bg-blue-50/50 rounded-xl flex gap-3 items-start border border-blue-100">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[10px] text-blue-800 leading-relaxed font-medium">
            A <strong>Fórmula de Balik</strong> (Volume = 20 × Lâmina em mm) é validada para pacientes em decúbito dorsal com inclinação de 15°.
          </div>
        </div>

        <div className="p-3 bg-amber-50/50 rounded-xl flex gap-3 items-start border border-amber-100">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
            A medida deve ser feita no final da expiração, na base pulmonar, com o transdutor perpendicular à parede torácica.
          </div>
        </div>
      </div>
    </div>
  );
}
