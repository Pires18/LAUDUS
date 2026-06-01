import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Calendar, Clock } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';

export function GestationalAgeCalculator({ value, onChange, examDateMs }: CalculatorProps) {
  const [method, setMethod] = useState<'dum' | 'usg'>(value?.method || 'dum');
  const [referenceDate, setReferenceDate] = useState<string>(() => {
    if (value?.referenceDate) return value.referenceDate;
    const d = examDateMs ? new Date(examDateMs) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
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
    const today = new Date(referenceDate + 'T00:00:00');
    if (isNaN(today.getTime())) return;

    if (method === 'dum' && dumDate) {
      const d = new Date(dumDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const diffMs = today.getTime() - d.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
          const weeks = Math.floor(diffDays / 7);
          const days = diffDays % 7;
          currentGa = `${weeks}s ${days}d`;
          
          const eddDate = new Date(d);
          eddDate.setDate(eddDate.getDate() + 280);
          eddStr = formatDate(eddDate);
        }
      }
    } else if (method === 'usg' && prevUsgDate && prevUsgWeeks !== '') {
      const d = new Date(prevUsgDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const initialDays = (Number(prevUsgWeeks) * 7) + Number(prevUsgDays || 0);
        const diffMs = today.getTime() - d.getTime();
        const daysSinceUsg = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const totalDays = initialDays + daysSinceUsg;
        
        if (totalDays >= 0) {
          const weeks = Math.floor(totalDays / 7);
          const days = totalDays % 7;
          currentGa = `${weeks}s ${days}d`;
          
          const eddDate = new Date(d);
          eddDate.setDate(eddDate.getDate() - initialDays + 280);
          eddStr = formatDate(eddDate);
        }
      }
    }

    const summary = currentGa 
      ? `[Idade Gestacional Calculada]\nIG: ${currentGa} (Base: ${method === 'dum' ? 'DUM' : 'USG Anterior'})\nDDP: ${eddStr || '---'}`
      : null;

    onChange({
      referenceDate, method, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays,
      currentGa,
      edd: eddStr,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, referenceDate, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
          <Calendar size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Cronometria Gestacional</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Cálculo de IG e Data Provável do Parto (DDP)</p>
        </div>
      </div>

      <CalculatorInput 
        type="date" 
        label="Data do Exame Atual (Base para Cálculo)" 
        value={referenceDate} 
        onChange={setReferenceDate} 
      />
      
      <div className="space-y-4">
          <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Método de Referência</label>
        <div className="flex gap-3">
          {[
            { id: 'dum', label: 'Pela DUM', desc: 'Data da Última Menstruação' },
            { id: 'usg', label: 'Pela USG', desc: 'Ultrassom Prévio / Datador' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id as any)}
              className={classNames(
                "flex-1 p-4 rounded-[1.5rem] border-2 transition-all text-left",
                method === m.id 
                  ? "bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-100" 
                  : "bg-white text-ink-400 border-ink-100 hover:bg-ink-50"
              )}
            >
              <div className="text-xs font-black uppercase tracking-widest mb-1">{m.label}</div>
              <div className={classNames("text-[9px] font-bold opacity-60", method === m.id ? "text-white" : "text-ink-400")}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {method === 'dum' ? (
          <div className="col-span-full">
            <CalculatorInput 
              type="date" 
              label="Data da DUM" 
              value={dumDate} 
              onChange={setDumDate} 
            />
          </div>
        ) : (
          <>
            <CalculatorInput 
              type="date" 
              label="Data da USG Anterior" 
              value={prevUsgDate} 
              onChange={setPrevUsgDate} 
            />
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">IG no Exame Prévio</label>
               <div className="flex gap-3">
                  <CalculatorInput type="number" placeholder="Semanas" value={prevUsgWeeks} onChange={setPrevUsgWeeks} suffix="sem" />
                  <CalculatorInput type="number" placeholder="Dias" value={prevUsgDays} onChange={setPrevUsgDays} suffix="d" />
               </div>
            </div>
          </>
        )}
      </div>

      {value?.currentGa ? (
        <div className="flex flex-col gap-4">
          <ResultCard 
            label="Idade Gestacional Atual" 
            value={value.currentGa} 
            variant="brand"
          />
          <ResultCard 
            label="Data Provável do Parto" 
            value={value.edd} 
            variant="emerald"
          />
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-[2.5rem] text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200 animate-pulse">
             <Clock size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Aguardando dados cronológicos</p>
        </div>
      )}
    </div>
  );
}
