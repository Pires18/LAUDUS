import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Waves } from 'lucide-react';
import { CalculatorInput, CategorySelector, ResultCard, CalculatorReference } from './CalculatorUI';
import { liverFibrosisStage, liverSteatosisCAP, LiverEtiologia } from '../formulas';

const METODOS = [
  { label: 'TE / FibroScan', value: 'te' },
  { label: '2D-SWE', value: '2dswe' },
  { label: 'pSWE / ARFI', value: 'pswe' },
];

const ETIOLOGIAS: { label: string; value: LiverEtiologia }[] = [
  { label: 'Viral (HBV/HCV)', value: 'viral' },
  { label: 'DHGNA / NASH', value: 'nafld' },
  { label: 'Alcoólica', value: 'alcool' },
  { label: 'Colestática (CBP/CEP)', value: 'colestatica' },
];

/** Elastografia hepática: rigidez (kPa) → METAVIR por etiologia + CAP → esteatose. */
export function ElastographyCalculator({ value, onChange }: CalculatorProps) {
  const [metodo, setMetodo] = useState<string>(value?.metodo || 'te');
  const [etiologia, setEtiologia] = useState<LiverEtiologia | ''>(value?.etiologia || '');
  const [kpa, setKpa] = useState(value?.kpa || '');
  const [cap, setCap] = useState(value?.cap || '');

  useEffect(() => {
    const kpaN = Number(String(kpa).replace(',', '.'));
    const capN = Number(String(cap).replace(',', '.'));
    const fib = kpaN > 0 && etiologia ? liverFibrosisStage(kpaN, etiologia) : null;
    const est = capN > 0 ? liverSteatosisCAP(capN) : null;
    const parts: string[] = [];
    if (fib) parts.push(`Fibrose: ${kpaN.toFixed(1).replace('.', ',')} kPa — ${fib.stage}`);
    else if (kpaN > 0) parts.push(`Rigidez ${kpaN.toFixed(1).replace('.', ',')} kPa (selecione a etiologia)`);
    if (est) parts.push(`Esteatose (CAP ${Math.round(capN)} dB/m): ${est}`);
    const metodoLabel = METODOS.find((m) => m.value === metodo)?.label || metodo;
    const summary = parts.length
      ? `Elastografia hepática — ${parts.join(' · ')}. Método: ${metodoLabel}. Cutoffs orientadores (EFSUMB/EASL).`
      : null;
    onChange({ metodo, etiologia, kpa, cap, fibrose: fib?.stage, esteatose: est, _summary: summary });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodo, etiologia, kpa, cap]);

  const fib = value?.fibrose as string | undefined;
  const variant = !fib ? 'brand' : /F4/.test(fib) ? 'red' : /F2|F3/.test(fib) ? 'amber' : 'emerald';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
          <Waves size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Elastografia Hepática</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Fibrose (METAVIR) + Esteatose (CAP)</p>
        </div>
      </div>

      <CategorySelector label="Método" options={METODOS} current={metodo} onSelect={(v: string) => setMetodo(v)} columns={3} />
      <CategorySelector label="Etiologia (define os cutoffs)" options={ETIOLOGIAS} current={etiologia} onSelect={(v: LiverEtiologia) => setEtiologia(v)} columns={2} />

      <div className="grid grid-cols-2 gap-4">
        <CalculatorInput type="number" label="Rigidez (mediana)" value={kpa} onChange={setKpa} suffix="kPa" placeholder="0" />
        <CalculatorInput type="number" label="CAP (opcional)" value={cap} onChange={setCap} suffix="dB/m" placeholder="0" />
      </div>

      {fib && <ResultCard label="Fibrose (METAVIR)" value={fib} variant={variant} />}
      {value?.esteatose && <ResultCard label="Esteatose (CAP)" value={value.esteatose as string} variant="brand" />}

      <CalculatorReference text="Cutoffs orientadores por etiologia (EFSUMB; EASL/Baveno VII; CAP por Karlas 2017). Dependem do método, aparelho, jejum e transaminases; a elastografia não substitui a biópsia." />
    </div>
  );
}
