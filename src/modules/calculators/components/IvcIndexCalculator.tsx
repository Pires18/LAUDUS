import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Droplets } from 'lucide-react';
import { classNames } from '../../../utils/format';

export function IvcIndexCalculator({ value, onChange }: CalculatorProps) {
  const [maxDia, setMaxDia] = useState(value?.maxDia || ''); // Inspiratory/Expiratory max
  const [minDia, setMinDia] = useState(value?.minDia || '');

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
      if (idx > 50) status = 'Colapsabilidade > 50% (Sugere volemia baixa/normal)';
      else status = 'Colapsabilidade < 50% (Sugere congestão/volemia alta)';
    }

    onChange({
      maxDia, minDia, index: idx,
      _summary: idx !== null ? `Índice de Colapsabilidade da VCI: ${idx.toFixed(1)}% (${status})` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDia, minDia]);

  return (
    <div className="bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-ink-50 p-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-cyan-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-widest">VCI (Volemia)</h3>
        </div>
        <span className="text-[8px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 uppercase">Status Volêmico</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-ink-400 uppercase mb-1.5 block">Diâmetro Máx (Exp)</label>
            <div className="relative">
              <input 
                type="number" 
                className="input h-10 text-center font-black" 
                placeholder="0.0"
                value={maxDia}
                onChange={e => setMaxDia(e.target.value)}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-ink-300">CM</span>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-ink-400 uppercase mb-1.5 block">Diâmetro Mín (Insp)</label>
            <div className="relative">
              <input 
                type="number" 
                className="input h-10 text-center font-black" 
                placeholder="0.0"
                value={minDia}
                onChange={e => setMinDia(e.target.value)}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-ink-300">CM</span>
            </div>
          </div>
        </div>

        {index !== null && (
          <div className={classNames(
            "rounded-2xl p-5 text-center border-2 shadow-lg transition-all",
            index > 50 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"
          )}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70 block mb-1">Índice de Colapsabilidade</span>
            <span className="text-4xl font-black block">{index.toFixed(1)}%</span>
            <span className="text-[10px] font-bold mt-2 block px-4 py-1 rounded-full bg-white/50 inline-block border border-current opacity-70">
              {index > 50 ? 'Sugerindo Resposta a Volume' : 'VCI Plétórica / Congestão'}
            </span>
          </div>
        )}

        <div className="p-3 bg-cyan-50 rounded-lg flex gap-3 items-start border border-cyan-100">
          <Droplets size={16} className="text-cyan-600 shrink-0 mt-0.5" />
          <div className="text-[10px] text-cyan-800 leading-relaxed font-medium">
            A avaliação da Veia Cava Inferior (VCI) é uma ferramenta útil para estimar a Pressão de Átrio Direito (PAD) e o status volêmico em pacientes críticos.
          </div>
        </div>
      </div>
    </div>
  );
}
