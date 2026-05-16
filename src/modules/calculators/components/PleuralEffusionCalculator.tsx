import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Droplets, Info, AlertCircle } from 'lucide-react';
import { classNames } from '../../../utils/format';

export function PleuralEffusionCalculator({ value, onChange }: CalculatorProps) {
  const [method, setMethod] = useState<'balik' | 'simple'>(value?.method || 'balik');
  const [depth, setDepth] = useState(value?.depth || ''); // mm
  
  // Balik method: Vol (ml) = 20 * depth (mm)
  // Simple: depth in cm * something? Usually Balik is the most accepted for supine.

  const [volume, setVolume] = useState<number | null>(null);

  useEffect(() => {
    const d = Number(depth);
    let vol: number | null = null;
    
    if (d) {
      vol = 20 * d;
    }

    setVolume(vol);

    onChange({
      method, depth, volume: vol,
      _summary: vol ? `Derrame Pleural (Fórmula de Balik): Lâmina de ${depth}mm → Volume estimado de ${vol}ml.` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, depth]);

  return (
    <div className="bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-ink-50 p-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-blue-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-widest">Derrame Pleural</h3>
        </div>
        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Volumetria</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[9px] font-bold text-ink-500 uppercase block mb-2 text-center">Espessura da Lâmina Líquida</label>
          <div className="flex justify-center">
            <div className="relative w-32">
              <input 
                type="number" 
                className="input text-center text-2xl font-black h-16" 
                placeholder="0"
                value={depth} 
                onChange={e => setDepth(e.target.value)} 
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-ink-400">MM</span>
            </div>
          </div>
        </div>

        {volume !== null && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 text-center shadow-lg shadow-blue-100 border border-blue-500">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block mb-1">Volume Estimado (Balik)</span>
            <span className="text-4xl font-black block">{volume} <small className="text-lg opacity-60">ml</small></span>
          </div>
        )}

        <div className="space-y-2">
          <div className="p-3 bg-blue-50 rounded-lg flex gap-3 items-start border border-blue-100">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-blue-800 leading-relaxed font-medium">
              A <strong>Fórmula de Balik</strong> (Volume = 20 × Lâmina em mm) é validada para pacientes em decúbito dorsal com inclinação de 15°.
            </div>
          </div>
          
          <div className="p-3 bg-amber-50 rounded-lg flex gap-3 items-start border border-amber-100">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
              A medida deve ser feita no final da expiração, na base pulmonar, com o transdutor perpendicular à parede torácica.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
