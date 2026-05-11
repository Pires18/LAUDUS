import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler } from 'lucide-react';

export function VolumeCalculator({ value, onChange }: CalculatorProps) {
  const [d1, setD1] = useState<number | ''>(value?.d1 ?? '');
  const [d2, setD2] = useState<number | ''>(value?.d2 ?? '');
  const [d3, setD3] = useState<number | ''>(value?.d3 ?? '');
  const [unit, setUnit] = useState<string>(value?.unit ?? 'cm');

  useEffect(() => {
    let volume = 0;
    if (typeof d1 === 'number' && typeof d2 === 'number' && typeof d3 === 'number') {
      volume = d1 * d2 * d3 * 0.523;
    }
    
    onChange({
      d1, d2, d3, unit,
      volume: volume ? parseFloat(volume.toFixed(1)) : null,
      _summary: volume ? `Dimensões: ${d1} x ${d2} x ${d3} ${unit}. Volume estimado: ${volume.toFixed(1)} ${unit}³` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d1, d2, d3, unit]);

  const volume = value?.volume;

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Ruler size={14} className="text-brand-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Volume (Elipsoide)</h3>
      </div>
      
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-0.5">
            <label className="text-[9px] font-bold text-ink-400 uppercase tracking-widest text-center block">D1</label>
            <input 
              type="number" step="0.1" placeholder="D1" 
              className="input text-center font-bold text-sm border-ink-200 focus:border-brand-500 py-1 h-9"
              value={d1} onChange={e => setD1(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <span className="text-ink-300 mt-4 text-xs">×</span>
          <div className="flex-1 space-y-0.5">
            <label className="text-[9px] font-bold text-ink-400 uppercase tracking-widest text-center block">D2</label>
            <input 
              type="number" step="0.1" placeholder="D2" 
              className="input text-center font-bold text-sm border-ink-200 focus:border-brand-500 py-1 h-9"
              value={d2} onChange={e => setD2(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <span className="text-ink-300 mt-4 text-xs">×</span>
          <div className="flex-1 space-y-0.5">
            <label className="text-[9px] font-bold text-ink-400 uppercase tracking-widest text-center block">D3</label>
            <input 
              type="number" step="0.1" placeholder="D3" 
              className="input text-center font-bold text-sm border-ink-200 focus:border-brand-500 py-1 h-9"
              value={d3} onChange={e => setD3(e.target.value ? Number(e.target.value) : '')}
            />
          </div>
          <div className="w-16 space-y-0.5">
            <label className="text-[9px] font-bold text-ink-400 uppercase tracking-widest text-center block">UNID.</label>
            <select className="input text-center font-bold text-xs border-ink-200 focus:border-brand-500 py-1 h-9" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="cm">cm</option>
              <option value="mm">mm</option>
            </select>
          </div>
        </div>
        
        {volume ? (
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-2 text-center">
            <span className="text-[8px] uppercase font-bold text-brand-600 block mb-0.5 tracking-widest">Volume Estimado</span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-xl font-black text-brand-900">{volume.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-brand-600">{unit}³</span>
            </div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-lg p-2 text-center text-[10px] text-ink-400 border border-dashed border-ink-200">
            Preencha os 3 diâmetros.
          </div>
        )}
      </div>
    </div>
  );
}
