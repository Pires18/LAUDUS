import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Info } from 'lucide-react';
import { classNames } from '../../../utils/format';

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
      _summary: summaryParts.length > 0 ? `Índices Doppler:\n${summaryParts.join(' | ')}` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psv, edv, tamv]);

  return (
    <div className="bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-ink-50 p-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-emerald-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-widest">Índices Hemodinâmicos</h3>
        </div>
        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Doppler Geral</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Pico Sistólico (Vp)</label>
            <input 
              type="number" 
              className="input text-center text-sm font-black h-10" 
              placeholder="cm/s"
              value={psv} 
              onChange={e => setPsv(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Diastólico Final (Vd)</label>
            <input 
              type="number" 
              className="input text-center text-sm font-black h-10" 
              placeholder="cm/s"
              value={edv} 
              onChange={e => setEdv(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">Velocidade Média (Vm)</label>
            <input 
              type="number" 
              className="input text-center text-sm font-black h-10" 
              placeholder="cm/s"
              value={tamv} 
              onChange={e => setTamv(e.target.value)} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ResultCard label="IR (S-D)/S" value={ri?.toFixed(2)} sub="Índice de Resistência" color="emerald" />
          <ResultCard label="IP (S-D)/Vm" value={pi?.toFixed(2)} sub="Índice de Pulsatilidade" color="blue" />
          <ResultCard label="S/D" value={sd?.toFixed(2)} sub="Relação Sist/Diast" color="amber" />
        </div>

        <div className="p-3 bg-ink-50 rounded-lg flex gap-3 items-start border border-ink-100">
          <Info size={16} className="text-ink-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-ink-600 leading-relaxed">
            O <strong>Índice de Resistência (Pourcelot)</strong> e o <strong>Índice de Pulsatilidade (Gosling)</strong> são parâmetros universais para avaliação da resistência vascular distal.
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, sub, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
  };
  return (
    <div className={classNames("p-3 rounded-xl border text-center", colors[color] || 'bg-ink-50 border-ink-100 text-ink-900')}>
      <span className="text-[8px] font-black uppercase opacity-60 block tracking-wider">{label}</span>
      <span className="text-xl font-black block my-0.5">{value || '--'}</span>
      <span className="text-[8px] font-bold opacity-50 block uppercase">{sub}</span>
    </div>
  );
}
