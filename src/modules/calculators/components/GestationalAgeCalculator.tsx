import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Calendar, Info } from 'lucide-react';

export function GestationalAgeCalculator({ value, onChange }: CalculatorProps) {
  const [method, setMethod] = useState<'dum' | 'usg'>(value?.method || 'dum');
  const [dumDate, setDumDate] = useState(value?.dumDate || '');
  const [prevUsgDate, setPrevUsgDate] = useState(value?.prevUsgDate || '');
  const [prevUsgWeeks, setPrevUsgWeeks] = useState(value?.prevUsgWeeks || '');
  const [prevUsgDays, setPrevUsgDays] = useState(value?.prevUsgDays || '');

  function formatDate(date: Date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  useEffect(() => {
    let currentGa = null;
    let eddStr = null; 
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (method === 'dum' && dumDate) {
      const d = new Date(dumDate + 'T12:00:00'); // Midday to avoid TZ issues
      if (!isNaN(d.getTime())) {
        const diffMs = today.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
          const weeks = Math.floor(diffDays / 7);
          const days = diffDays % 7;
          currentGa = `${weeks}s ${days}d`;
          
          const eddDate = new Date(d.getTime() + 280 * 24 * 60 * 60 * 1000);
          eddStr = formatDate(eddDate);
        }
      }
    } else if (method === 'usg' && prevUsgDate && prevUsgWeeks !== '') {
      const d = new Date(prevUsgDate + 'T12:00:00');
      if (!isNaN(d.getTime())) {
        const initialDays = (Number(prevUsgWeeks) * 7) + Number(prevUsgDays || 0);
        const diffMs = today.getTime() - d.getTime();
        const daysSinceUsg = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const totalDays = initialDays + daysSinceUsg;
        
        if (totalDays >= 0) {
          const weeks = Math.floor(totalDays / 7);
          const days = totalDays % 7;
          currentGa = `${weeks}s ${days}d`;
          
          const conceptionDate = new Date(d.getTime() - initialDays * 24 * 60 * 60 * 1000);
          const eddDate = new Date(conceptionDate.getTime() + 280 * 24 * 60 * 60 * 1000);
          eddStr = formatDate(eddDate);
        }
      }
    }

    const summary = currentGa 
      ? `Idade Gestacional: ${currentGa} (Base: ${method === 'dum' ? 'DUM' : 'USG Anterior'}). DDP: ${eddStr || '---'}.`
      : null;

    onChange({
      method, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays,
      currentGa,
      edd: eddStr,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays]);

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Calendar size={14} className="text-blue-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Idade Gestacional</h3>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex gap-1">
          <button 
            onClick={() => setMethod('dum')}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${method === 'dum' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
          >
            Pela DUM
          </button>
          <button 
            onClick={() => setMethod('usg')}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${method === 'usg' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
          >
            Pela USG Anterior
          </button>
        </div>

        {method === 'dum' ? (
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Data da DUM</label>
            <input 
              type="date" 
              className="input text-xs h-8 py-1" 
              value={dumDate} 
              onChange={e => setDumDate(e.target.value)} 
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Data da USG Anterior</label>
              <input 
                type="date" 
                className="input text-xs h-8 py-1" 
                value={prevUsgDate} 
                onChange={e => setPrevUsgDate(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Semanas</label>
                <input 
                  type="number" 
                  className="input text-xs h-8 py-1 text-center" 
                  placeholder="Ex: 12"
                  value={prevUsgWeeks} 
                  onChange={e => setPrevUsgWeeks(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Dias</label>
                <input 
                  type="number" 
                  className="input text-xs h-8 py-1 text-center" 
                  placeholder="0-6"
                  value={prevUsgDays} 
                  onChange={e => setPrevUsgDays(e.target.value)} 
                />
              </div>
            </div>
          </div>
        )}

        {value?.currentGa ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
            <div>
              <span className="text-[8px] font-bold text-blue-600 uppercase block tracking-widest mb-0.5">IG Atual</span>
              <span className="text-lg font-black text-blue-900 leading-none">{value.currentGa}</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-bold text-blue-600 uppercase block tracking-widest mb-0.5">DDP (Provável)</span>
              <span className="text-[11px] font-bold text-blue-800 leading-none">
                {value.edd}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-md p-2 flex items-center gap-2 border border-dashed border-ink-200">
            <Info size={12} className="text-ink-400" />
            <span className="text-[10px] text-ink-400">Insira os dados para calcular a IG atual.</span>
          </div>
        )}
      </div>
    </div>
  );
}
