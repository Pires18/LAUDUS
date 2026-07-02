import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Info } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { CalculatorInput } from './CalculatorUI';

export function VascularRatiosCalculator({ value, onChange }: CalculatorProps) {
  const [psv, setPsv] = useState(value?.psv || '');
  const [edv, setEdv] = useState(value?.edv || '');
  const [tamv, setTamv] = useState(value?.tamv || '');

  const [ri, setRi] = useState<number | null>(null);
  const [pi, setPi] = useState<number | null>(null);
  const [sd, setSd] = useState<number | null>(null);

  useEffect(() => {
    const s = Number(psv);
    const d = Number(edv);
    const m = Number(tamv);

    let calculatedRi: number | null = null;
    let calculatedPi: number | null = null;
    let calculatedSd: number | null = null;

    if (s && d) {
      calculatedRi = (s - d) / s;
      calculatedSd = s / d;
    }
    if (s && d && m) {
      calculatedPi = (s - d) / m;
    }

    setRi(calculatedRi);
    setPi(calculatedPi);
    setSd(calculatedSd);

    const summaryParts = [];
    if (psv) summaryParts.push(`Vp: ${psv} cm/s`);
    if (edv) summaryParts.push(`Vd: ${edv} cm/s`);
    if (calculatedRi !== null) summaryParts.push(`IR: ${calculatedRi.toFixed(2)}`);
    if (calculatedPi !== null) summaryParts.push(`IP: ${calculatedPi.toFixed(2)}`);
    if (calculatedSd !== null) summaryParts.push(`Relação S/D: ${calculatedSd.toFixed(2)}`);

    onChange({
      psv, edv, tamv,
      ri: calculatedRi,
      pi: calculatedPi,
      sd: calculatedSd,
      _summary: summaryParts.length > 0 ? `Índices Doppler: ${summaryParts.join(' | ')}.` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psv, edv, tamv]);

  const hasResult = ri !== null || pi !== null || sd !== null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Índices Hemodinâmicos</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">IR · IP · Relação S/D (Doppler Universal)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CalculatorInput type="number" label="Pico Sistólico (Vp)" placeholder="0.0" value={psv} onChange={setPsv} suffix="cm/s" />
        <CalculatorInput type="number" label="Diastólico Final (Vd)" placeholder="0.0" value={edv} onChange={setEdv} suffix="cm/s" />
        <CalculatorInput type="number" label="Velocidade Média (Vm)" placeholder="0.0" value={tamv} onChange={setTamv} suffix="cm/s" />
      </div>

      {hasResult ? (
        <div className="grid grid-cols-3 gap-4">
          <MetricBox label="IR" sub="(S-D)/S" value={ri} variant="emerald" />
          <MetricBox label="IP" sub="(S-D)/Vm" value={pi} variant="blue" />
          <MetricBox label="S/D" sub="Sist/Diast" value={sd} variant="amber" />
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira as velocidades para calcular</p>
        </div>
      )}

      <div className="p-3 bg-ink-50 rounded-xl flex gap-3 items-start border border-ink-100">
        <Info size={16} className="text-ink-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-ink-600 leading-relaxed font-medium">
          O <strong>Índice de Resistência (Pourcelot)</strong> e o <strong>Índice de Pulsatilidade (Gosling)</strong> são parâmetros universais para avaliação da resistência vascular distal.
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, sub, value, variant }: { label: string; sub: string; value: number | null; variant: 'emerald' | 'blue' | 'amber' }) {
  const styles = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }[variant];
  return (
    <div className={classNames('rounded-2xl border-2 p-5 text-center shadow-sm', styles)}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block">{label}</span>
      <span className="text-2xl font-black block my-1">{value !== null ? value.toFixed(2) : '--'}</span>
      <span className="text-[9px] font-bold uppercase opacity-50 block">{sub}</span>
    </div>
  );
}
