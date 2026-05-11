import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Activity, Info, BarChart3 } from 'lucide-react';
import { classNames } from '../../../utils/format';

export function FetalBiometryCalculator({ value, onChange }: CalculatorProps) {
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [ac, setAc] = useState(value?.ac || '');
  const [fl, setFl] = useState(value?.fl || '');

  // Error Function (erf) approximation for Z-score to Percentile
  function erf(x: number) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  function getPercentile(z: number) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
  }

  useEffect(() => {
    let efw = null;
    let percentile = null;
    let pDescription = '';

    if (bpd && hc && ac && fl) {
      const b = Number(bpd) / 10; // mm to cm
      const h = Number(hc) / 10;
      const a = Number(ac) / 10;
      const f = Number(fl) / 10;

      // Hadlock IV Formula: Log10(EFW) = 1.3596 + 0.0064*HC + 0.0424*AC + 0.174*FL + 0.00061*BPD*AC - 0.00386*AC*FL
      const logEFW = 1.3596 
                   + (0.0064 * h) 
                   + (0.0424 * a) 
                   + (0.174 * f) 
                   + (0.00061 * b * a) 
                   - (0.00386 * a * f);
      
      efw = Math.pow(10, logEFW);
    }

    if (efw && gaWeeks !== '') {
      const weeksDecimal = Number(gaWeeks) + (Number(gaDays || 0) / 7);
      
      // Hadlock 1991 Weight Growth Curve: ln(Mean Weight) = 0.578 + 0.332*GA - 0.00354*GA^2
      const lnMean = 0.578 + (0.332 * weeksDecimal) - (0.00354 * Math.pow(weeksDecimal, 2));
      const meanEFW = Math.exp(lnMean);
      const sd = 0.127 * meanEFW; // Coefficient of Variation = 12.7%
      
      const zScore = (efw - meanEFW) / sd;
      percentile = Math.round(getPercentile(zScore) * 100);
      
      if (percentile < 10) pDescription = 'Pequeno para a Idade Gestacional (PIG)';
      else if (percentile > 90) pDescription = 'Grande para a Idade Gestacional (GIG)';
      else pDescription = 'Adequado para a Idade Gestacional (AIG)';
    }

    const summary = efw 
      ? `Biometria Fetal: Peso Est. (Hadlock IV): ${Math.round(efw)}g. Percentil: ${percentile !== null ? `${percentile}% (${pDescription})` : 'N/A'}.`
      : null;

    onChange({
      gaWeeks, gaDays, bpd, hc, ac, fl,
      efw: efw ? Math.round(efw) : null,
      percentile,
      pDescription,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaWeeks, gaDays, bpd, hc, ac, fl]);

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={14} className="text-indigo-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Biometria Fetal</h3>
        </div>
        <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
          Hadlock IV
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* IG de Referência */}
        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
          <label className="text-[8px] font-bold text-indigo-500 uppercase block mb-1">Idade Gestacional de Referência</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input type="number" className="input text-xs h-8 text-center" placeholder="Semanas" value={gaWeeks} onChange={e => setGaWeeks(e.target.value)} />
            </div>
            <div className="flex-1">
              <input type="number" className="input text-xs h-8 text-center" placeholder="Dias" value={gaDays} onChange={e => setGaDays(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Medidas */}
        <div className="grid grid-cols-2 gap-3">
          <MetricInput label="DBP (mm)" value={bpd} onChange={setBpd} />
          <MetricInput label="CC (mm)" value={hc} onChange={setHc} />
          <MetricInput label="CA (mm)" value={ac} onChange={setAc} />
          <MetricInput label="CF (mm)" value={fl} onChange={setFl} />
        </div>

        {/* Resultado */}
        {value?.efw ? (
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-3 text-white shadow-md">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Peso Fetal Estimado</span>
                  <div className="text-2xl font-black">{value.efw} <span className="text-sm font-normal">g</span></div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Percentil</span>
                  <div className="text-xl font-black">{value.percentile}%</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/20 text-[10px] font-medium flex items-center gap-1.5">
                <Activity size={10} /> {value.pDescription}
              </div>
            </div>
            <div className="text-[8px] text-center text-ink-400 italic">
              Referências: Hadlock IV (EFW) & Hadlock 1991 (Percentil)
            </div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-lg p-3 flex items-center gap-3 border border-dashed border-ink-200">
            <Info size={14} className="text-ink-400" />
            <span className="text-[10px] text-ink-500 leading-tight">
              Insira a IG e as biometrias (DBP, CC, CA, CF) para calcular o peso e percentil.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string, value: any, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label>
      <input 
        type="number" 
        className="input text-center text-xs h-8 focus:border-indigo-500" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
      />
    </div>
  );
}
