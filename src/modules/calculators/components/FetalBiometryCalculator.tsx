import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Activity, Info, BarChart3, Sparkles } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
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
      const b = Number(bpd) / 10;
      const h = Number(hc) / 10;
      const a = Number(ac) / 10;
      const f = Number(fl) / 10;

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
      const lnMean = 0.578 + (0.332 * weeksDecimal) - (0.00354 * Math.pow(weeksDecimal, 2));
      const meanEFW = Math.exp(lnMean);
      const sd = 0.127 * meanEFW;
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
  }, [gaWeeks, gaDays, bpd, hc, ac, fl]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
            <BarChart3 size={24} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Biometria Fetal</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Hadlock IV • Curva de Hadlock 1991</p>
          </div>
        </div>
        <div className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-200">
           Expert Mode
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-indigo-50/50 p-6 rounded-[2rem] border-2 border-indigo-100/50">
           <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 mb-3 block">IG de Referência (Cronologia)</label>
           <div className="flex gap-4">
              <CalculatorInput type="number" placeholder="Semanas" value={gaWeeks} onChange={setGaWeeks} suffix="sem" />
              <CalculatorInput type="number" placeholder="Dias" value={gaDays} onChange={setGaDays} suffix="d" />
           </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <CalculatorInput label="DBP (mm)" placeholder="0.0" value={bpd} onChange={setBpd} />
           <CalculatorInput label="CC (mm)" placeholder="0.0" value={hc} onChange={setHc} />
           <CalculatorInput label="CA (mm)" placeholder="0.0" value={ac} onChange={setAc} />
           <CalculatorInput label="CF (mm)" placeholder="0.0" value={fl} onChange={setFl} />
        </div>
      </div>

      {value?.efw ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResultCard 
            label="Peso Fetal Estimado" 
            value={`${value.efw}g`} 
            variant="brand"
          />
          <ResultCard 
            label="Percentil / Crescimento" 
            value={`${value.percentile}%`} 
            recommendation={value.pDescription}
            variant={value.percentile < 10 || value.percentile > 90 ? 'red' : 'emerald'}
          />
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-[2.5rem] text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
             <Ruler size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira a biometria para análise</p>
        </div>
      )}

      <div className="text-[9px] text-center text-ink-300 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
         <Sparkles size={10} /> Parâmetro ouro em medicina fetal (Hadlock)
      </div>
    </div>
  );
}
