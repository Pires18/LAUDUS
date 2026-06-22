import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Droplets, Info, Plus, Trash2 } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { genId } from '../../../store/db';

interface Pocket {
  id: string;
  label: string;
  depth: number | '';
}

export function AmnioticFluidCalculator({ value, onChange }: CalculatorProps) {
  const [method, setMethod] = useState<'mbv' | 'ila'>(value?.method || 'mbv');
  const [pockets, setPockets] = useState<Pocket[]>(() =>
    Array.isArray(value?.pockets) ? value.pockets : [{ id: genId(), label: 'MBV', depth: '' }]
  );
  // ILA quadrants
  const [q1, setQ1] = useState(value?.q1 || '');
  const [q2, setQ2] = useState(value?.q2 || '');
  const [q3, setQ3] = useState(value?.q3 || '');
  const [q4, setQ4] = useState(value?.q4 || '');

  useEffect(() => {
    let result: number | null = null;
    let classification = '';

    if (method === 'mbv') {
      // MBV = Maior Bolsão Vertical (Single Deepest Pocket)
      const depths = pockets.map(p => Number(p.depth)).filter(d => d > 0);
      if (depths.length > 0) {
        result = Math.max(...depths);
        if (result < 20) classification = 'Oligoâmnio (MBV < 20mm)';
        else if (result <= 80) classification = 'Volume normal (20-80mm)';
        else classification = 'Polidrâmnio (MBV > 80mm)';
      }
    } else {
      // ILA = Índice de Líquido Amniótico (4 quadrants)
      if (q1 && q2 && q3 && q4) {
        result = Number(q1) + Number(q2) + Number(q3) + Number(q4);
        if (result < 50) classification = 'Oligoâmnio (ILA < 50mm)';
        else if (result <= 80) classification = 'Líquido reduzido (50-80mm)';
        else if (result <= 180) classification = 'Volume normal (80-180mm)';
        else if (result <= 240) classification = 'Líquido aumentado (180-240mm)';
        else classification = 'Polidrâmnio (ILA > 240mm)';
      }
    }

    const summary = result !== null
      ? `Líquido Amniótico (${method === 'mbv' ? 'MBV' : 'ILA'}): ${result.toFixed(0)}mm. ${classification}.`
      : null;

    onChange({ method, pockets, q1, q2, q3, q4, result, classification, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, pockets, q1, q2, q3, q4]);

  function addPocket() {
    setPockets([...pockets, { id: genId(), label: `Bolsão ${pockets.length + 1}`, depth: '' }]);
  }

  function updatePocket(id: string, depth: string) {
    setPockets(pockets.map(p => p.id === id ? { ...p, depth: depth ? Number(depth) : '' } : p));
  }

  function removePocket(id: string) {
    if (pockets.length <= 1) return;
    setPockets(pockets.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-sm">
          <Droplets size={20} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Líquido Amniótico</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Estudo Volumétrico Fetal (MBV / ILA)</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setMethod('mbv')} 
            className={classNames(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all active:scale-[0.98]", 
              method === 'mbv' 
                ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-100' 
                : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50/50'
            )}
          >
            MBV (Maior Bolsão)
          </button>
          <button 
            onClick={() => setMethod('ila')} 
            className={classNames(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all active:scale-[0.98]", 
              method === 'ila' 
                ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-100' 
                : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50/50'
            )}
          >
            ILA (4 Quadrantes)
          </button>
        </div>

        {method === 'mbv' ? (
          <div className="space-y-3 p-4 bg-ink-50/20 rounded-2xl border border-ink-100/55">
            {pockets.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-ink-500 uppercase tracking-wider w-16 shrink-0">Bolsão {i + 1}</span>
                <div className="relative flex-1">
                  <input 
                    type="number" 
                    step="0.1" 
                    className="w-full h-11 px-4 pr-10 bg-white border-2 border-ink-100 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 outline-none transition-all text-xs font-bold" 
                    placeholder="Profundidade" 
                    value={p.depth} 
                    onChange={e => updatePocket(p.id, e.target.value)} 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-ink-300 uppercase">mm</span>
                </div>
                {pockets.length > 1 && (
                  <button 
                    onClick={() => removePocket(p.id)} 
                    className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:text-red-600 transition-all flex items-center justify-center shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={addPocket} 
              className="text-[10px] text-sky-600 font-black uppercase tracking-wider flex items-center gap-1.5 hover:text-sky-700 transition-colors pt-1"
            >
              <Plus size={14} /> Adicionar bolsão
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 bg-ink-50/20 rounded-2xl border border-ink-100/55">
            {[
              { label: 'QSD (S. Direito)', val: q1, set: setQ1 },
              { label: 'QSE (S. Esquerdo)', val: q2, set: setQ2 },
              { label: 'QID (I. Direito)', val: q3, set: setQ3 },
              { label: 'QIE (I. Esquerdo)', val: q4, set: setQ4 }
            ].map((q, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-[9px] font-black text-ink-400 uppercase tracking-widest ml-1">{q.label}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1" 
                    className="w-full h-11 px-4 pr-10 bg-white border-2 border-ink-100 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 outline-none transition-all text-xs font-bold text-center" 
                    value={q.val} 
                    onChange={e => q.set(e.target.value)} 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-ink-300 uppercase">mm</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {value?.result !== null && value?.result !== undefined ? (
          <div className={classNames(
            "rounded-2xl p-5 border-2 flex items-center justify-between shadow-sm animate-in zoom-in-95 duration-150",
            value.classification?.includes('Oligo') ? "bg-red-50/80 border-red-200 text-red-900" :
            value.classification?.includes('Poli') ? "bg-amber-50/80 border-amber-200 text-amber-900" :
            "bg-emerald-50/80 border-emerald-200 text-emerald-900"
          )}>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest block mb-0.5 opacity-60">
                Resultado ({method === 'mbv' ? 'MBV' : 'ILA'})
              </span>
              <span className="text-3xl font-black leading-none">
                {value.result.toFixed(0)} <small className="text-sm opacity-70">mm</small>
              </span>
            </div>
            <div className="text-right max-w-[55%]">
              <span className="text-xs font-black uppercase tracking-tight block">
                {value.classification}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-ink-50/40 rounded-2xl p-4 flex items-center gap-3 border-2 border-dashed border-ink-100">
            <Info size={16} className="text-ink-400 shrink-0" />
            <span className="text-[10px] text-ink-500 font-bold uppercase tracking-tight">Insira as medidas do líquido amniótico para processar a volumetria fetal.</span>
          </div>
        )}
      </div>
    </div>
  );
}
