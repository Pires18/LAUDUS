import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, Activity, Info, BarChart3, Sparkles } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';

const BIOMETRY_LIMITS: Record<number, { bpd: [number, number], hc: [number, number], ac: [number, number], fl: [number, number] }> = {
  14: { bpd: [28, 2.0], hc: [98, 8.0], ac: [82, 9.0], fl: [15, 1.5] },
  15: { bpd: [31, 2.1], hc: [111, 9.0], ac: [93, 10.0], fl: [18, 1.7] },
  16: { bpd: [34, 2.2], hc: [124, 10.0], ac: [105, 11.0], fl: [21, 1.9] },
  17: { bpd: [37, 2.3], hc: [137, 11.0], ac: [117, 12.0], fl: [24, 2.1] },
  18: { bpd: [40, 2.4], hc: [150, 12.0], ac: [129, 13.0], fl: [27, 2.3] },
  19: { bpd: [43, 2.5], hc: [162, 13.0], ac: [141, 14.0], fl: [30, 2.5] },
  20: { bpd: [46, 2.6], hc: [175, 14.0], ac: [152, 15.0], fl: [33, 2.7] },
  21: { bpd: [49, 2.7], hc: [187, 15.0], ac: [164, 16.0], fl: [36, 2.9] },
  22: { bpd: [52, 2.8], hc: [199, 16.0], ac: [175, 17.0], fl: [39, 3.1] },
  23: { bpd: [55, 2.9], hc: [210, 17.0], ac: [186, 18.0], fl: [41, 3.3] },
  24: { bpd: [58, 3.0], hc: [222, 18.0], ac: [197, 19.0], fl: [44, 3.5] },
  25: { bpd: [61, 3.1], hc: [232, 19.0], ac: [208, 20.0], fl: [46, 3.7] },
  26: { bpd: [64, 3.2], hc: [242, 20.0], ac: [218, 21.0], fl: [49, 3.9] },
  27: { bpd: [67, 3.3], hc: [252, 21.0], ac: [228, 22.0], fl: [51, 4.1] },
  28: { bpd: [70, 3.4], hc: [262, 22.0], ac: [238, 23.0], fl: [53, 4.3] },
  29: { bpd: [73, 3.5], hc: [271, 23.0], ac: [248, 24.0], fl: [55, 4.5] },
  30: { bpd: [75, 3.6], hc: [280, 24.0], ac: [258, 25.0], fl: [58, 4.6] },
  31: { bpd: [78, 3.7], hc: [289, 25.0], ac: [268, 26.0], fl: [60, 4.7] },
  32: { bpd: [80, 3.8], hc: [297, 26.0], ac: [278, 27.0], fl: [62, 4.8] },
  33: { bpd: [83, 3.9], hc: [305, 27.0], ac: [287, 28.0], fl: [64, 4.9] },
  34: { bpd: [85, 4.0], hc: [313, 28.0], ac: [297, 29.0], fl: [66, 5.0] },
  35: { bpd: [87, 4.1], hc: [320, 29.0], ac: [306, 30.0], fl: [68, 5.1] },
  36: { bpd: [89, 4.2], hc: [327, 30.0], ac: [315, 31.0], fl: [70, 5.2] },
  37: { bpd: [91, 4.3], hc: [333, 31.0], ac: [324, 32.0], fl: [71, 5.3] },
  38: { bpd: [93, 4.4], hc: [339, 32.0], ac: [332, 33.0], fl: [73, 5.4] },
  39: { bpd: [94, 4.5], hc: [344, 33.0], ac: [340, 34.0], fl: [74, 5.5] },
  40: { bpd: [96, 4.6], hc: [349, 34.0], ac: [348, 35.0], fl: [76, 5.6] },
  41: { bpd: [97, 4.7], hc: [353, 35.0], ac: [355, 36.0], fl: [77, 5.7] },
  42: { bpd: [98, 4.8], hc: [357, 36.0], ac: [362, 37.0], fl: [78, 5.8] }
};

function getBiometryRef(ga: number): { bpd: [number, number], hc: [number, number], ac: [number, number], fl: [number, number] } {
  const keys = Object.keys(BIOMETRY_LIMITS).map(Number).sort((a,b)=>a-b);
  if (ga <= keys[0]) return BIOMETRY_LIMITS[keys[0]];
  if (ga >= keys[keys.length-1]) return BIOMETRY_LIMITS[keys[keys.length-1]];
  const lo = keys.filter(k=>k<=ga).pop()!;
  const hi = keys.filter(k=>k>ga).shift()!;
  const f = (ga-lo)/(hi-lo);
  
  const interp = (lVal: [number, number], hVal: [number, number]): [number, number] => {
    return [
      lVal[0] + (hVal[0] - lVal[0]) * f,
      lVal[1] + (hVal[1] - lVal[1]) * f
    ];
  };

  return {
    bpd: interp(BIOMETRY_LIMITS[lo].bpd, BIOMETRY_LIMITS[hi].bpd),
    hc: interp(BIOMETRY_LIMITS[lo].hc, BIOMETRY_LIMITS[hi].hc),
    ac: interp(BIOMETRY_LIMITS[lo].ac, BIOMETRY_LIMITS[hi].ac),
    fl: interp(BIOMETRY_LIMITS[lo].fl, BIOMETRY_LIMITS[hi].fl)
  };
}

export function FetalBiometryCalculator({ value, onChange }: CalculatorProps) {
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [ac, setAc] = useState(value?.ac || '');
  const [fl, setFl] = useState(value?.fl || '');

  const [bpdPercentile, setBpdPercentile] = useState<number | null>(value?.bpdPercentile || null);
  const [hcPercentile, setHcPercentile] = useState<number | null>(value?.hcPercentile || null);
  const [acPercentile, setAcPercentile] = useState<number | null>(value?.acPercentile || null);
  const [flPercentile, setFlPercentile] = useState<number | null>(value?.flPercentile || null);

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

    let bpdP = null;
    let hcP = null;
    let acP = null;
    let flP = null;

    if (gaWeeks !== '') {
      const weeksDecimal = Number(gaWeeks) + (Number(gaDays || 0) / 7);
      const refs = getBiometryRef(weeksDecimal);

      if (bpd && refs) {
        const z = (Number(bpd) - refs.bpd[0]) / refs.bpd[1];
        bpdP = Math.max(1, Math.min(99, Math.round(getPercentile(z) * 100)));
      }
      if (hc && refs) {
        const z = (Number(hc) - refs.hc[0]) / refs.hc[1];
        hcP = Math.max(1, Math.min(99, Math.round(getPercentile(z) * 100)));
      }
      if (ac && refs) {
        const z = (Number(ac) - refs.ac[0]) / refs.ac[1];
        acP = Math.max(1, Math.min(99, Math.round(getPercentile(z) * 100)));
      }
      if (fl && refs) {
        const z = (Number(fl) - refs.fl[0]) / refs.fl[1];
        flP = Math.max(1, Math.min(99, Math.round(getPercentile(z) * 100)));
      }
    }

    setBpdPercentile(bpdP);
    setHcPercentile(hcP);
    setAcPercentile(acP);
    setFlPercentile(flP);

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

    const parts = [];
    if (efw) parts.push(`Peso Est. (Hadlock IV): ${Math.round(efw)}g (p${percentile !== null ? `${percentile}%` : 'N/A'})`);
    if (bpdP !== null) parts.push(`DBP p${bpdP}%`);
    if (hcP !== null) parts.push(`CC p${hcP}%`);
    if (acP !== null) parts.push(`CA p${acP}%`);
    if (flP !== null) parts.push(`CF p${flP}%`);

    const summary = parts.length > 0
      ? `Biometria Fetal: ${parts.join(', ')}.`
      : null;

    onChange({
      gaWeeks, gaDays, bpd, hc, ac, fl,
      efw: efw ? Math.round(efw) : null,
      percentile,
      pDescription,
      bpdPercentile: bpdP,
      hcPercentile: hcP,
      acPercentile: acP,
      flPercentile: flP,
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
           <div className="space-y-2">
              <CalculatorInput label="DBP (mm)" placeholder="0.0" value={bpd} onChange={setBpd} />
              {bpdPercentile !== null && (
                <div className={classNames(
                  "text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider",
                  bpdPercentile < 10 || bpdPercentile > 90 
                    ? "bg-amber-50/50 border-amber-100 text-amber-700 font-extrabold" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-700 font-extrabold"
                )}>
                  p{bpdPercentile}%
                </div>
              )}
           </div>
           <div className="space-y-2">
              <CalculatorInput label="CC (mm)" placeholder="0.0" value={hc} onChange={setHc} />
              {hcPercentile !== null && (
                <div className={classNames(
                  "text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider",
                  hcPercentile < 10 || hcPercentile > 90 
                    ? "bg-amber-50/50 border-amber-100 text-amber-700 font-extrabold" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-700 font-extrabold"
                )}>
                  p{hcPercentile}%
                </div>
              )}
           </div>
           <div className="space-y-2">
              <CalculatorInput label="CA (mm)" placeholder="0.0" value={ac} onChange={setAc} />
              {acPercentile !== null && (
                <div className={classNames(
                  "text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider",
                  acPercentile < 10 || acPercentile > 90 
                    ? "bg-amber-50/50 border-amber-100 text-amber-700 font-extrabold" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-700 font-extrabold"
                )}>
                  p{acPercentile}%
                </div>
              )}
           </div>
           <div className="space-y-2">
              <CalculatorInput label="CF (mm)" placeholder="0.0" value={fl} onChange={setFl} />
              {flPercentile !== null && (
                <div className={classNames(
                  "text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider",
                  flPercentile < 10 || flPercentile > 90 
                    ? "bg-amber-50/50 border-amber-100 text-amber-700 font-extrabold" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-700 font-extrabold"
                )}>
                  p{flPercentile}%
                </div>
              )}
           </div>
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
