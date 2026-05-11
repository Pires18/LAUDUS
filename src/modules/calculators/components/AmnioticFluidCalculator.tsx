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
        if (result < 2) classification = 'Oligoâmnio (MBV < 2cm)';
        else if (result <= 8) classification = 'Volume normal (2-8cm)';
        else classification = 'Polidrâmnio (MBV > 8cm)';
      }
    } else {
      // ILA = Índice de Líquido Amniótico (4 quadrants)
      if (q1 && q2 && q3 && q4) {
        result = Number(q1) + Number(q2) + Number(q3) + Number(q4);
        if (result < 5) classification = 'Oligoâmnio (ILA < 5cm)';
        else if (result <= 8) classification = 'Líquido reduzido (5-8cm)';
        else if (result <= 18) classification = 'Volume normal (8-18cm)';
        else if (result <= 24) classification = 'Líquido aumentado (18-24cm)';
        else classification = 'Polidrâmnio (ILA > 24cm)';
      }
    }

    const summary = result !== null
      ? `Líquido Amniótico (${method === 'mbv' ? 'MBV' : 'ILA'}): ${result.toFixed(1)}cm. ${classification}.`
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
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Droplets size={14} className="text-sky-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Líquido Amniótico</h3>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex gap-1">
          <button onClick={() => setMethod('mbv')} className={classNames("flex-1 py-1 text-[10px] font-bold rounded border transition-all", method === 'mbv' ? 'bg-sky-600 text-white border-sky-700' : 'bg-white text-ink-600 border-ink-200')}>MBV (Maior Bolsão)</button>
          <button onClick={() => setMethod('ila')} className={classNames("flex-1 py-1 text-[10px] font-bold rounded border transition-all", method === 'ila' ? 'bg-sky-600 text-white border-sky-700' : 'bg-white text-ink-600 border-ink-200')}>ILA (4 Quadrantes)</button>
        </div>

        {method === 'mbv' ? (
          <div className="space-y-2">
            {pockets.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-ink-400 w-16 shrink-0">Bolsão {i + 1}</span>
                <input type="number" step="0.1" className="input text-center text-xs h-8 flex-1" placeholder="cm" value={p.depth} onChange={e => updatePocket(p.id, e.target.value)} />
                {pockets.length > 1 && <button onClick={() => removePocket(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>}
              </div>
            ))}
            <button onClick={addPocket} className="text-[9px] text-sky-600 font-bold flex items-center gap-1 hover:underline">
              <Plus size={12} /> Adicionar bolsão
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">QSD (cm)</label><input type="number" step="0.1" className="input text-center text-xs h-8" value={q1} onChange={e => setQ1(e.target.value)} /></div>
            <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">QSE (cm)</label><input type="number" step="0.1" className="input text-center text-xs h-8" value={q2} onChange={e => setQ2(e.target.value)} /></div>
            <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">QID (cm)</label><input type="number" step="0.1" className="input text-center text-xs h-8" value={q3} onChange={e => setQ3(e.target.value)} /></div>
            <div><label className="text-[9px] font-bold text-ink-400 uppercase block mb-0.5">QIE (cm)</label><input type="number" step="0.1" className="input text-center text-xs h-8" value={q4} onChange={e => setQ4(e.target.value)} /></div>
          </div>
        )}

        {value?.result !== null && value?.result !== undefined ? (
          <div className={classNames("rounded-lg p-2 border flex items-center justify-between",
            value.classification?.includes('Oligo') ? "bg-red-50 border-red-200" :
            value.classification?.includes('Poli') ? "bg-amber-50 border-amber-200" :
            "bg-emerald-50 border-emerald-200"
          )}>
            <div><span className="text-[8px] font-bold uppercase block mb-0.5 opacity-60">{method === 'mbv' ? 'MBV' : 'ILA'}</span><span className="text-lg font-black leading-none">{value.result.toFixed(1)} cm</span></div>
            <div className="text-right max-w-[55%]"><span className="text-[10px] font-bold leading-tight">{value.classification}</span></div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-md p-2 flex items-center gap-2 border border-dashed border-ink-200">
            <Info size={12} className="text-ink-400" /><span className="text-[10px] text-ink-400">Insira as medidas do líquido amniótico.</span>
          </div>
        )}
      </div>
    </div>
  );
}
