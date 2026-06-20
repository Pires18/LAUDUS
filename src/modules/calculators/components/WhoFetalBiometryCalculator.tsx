import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, BarChart3, Sparkles } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import { WHO_COEFFICIENTS } from '../constants/whoCoefficients';

type WHODimension = keyof typeof WHO_COEFFICIENTS;
type Sex = 'male' | 'female' | 'unknown';

function getWhoPercentile(dimension: WHODimension, gaWeeks: number, value: number): number | null {
  if (gaWeeks < 14 || gaWeeks > 40 || value <= 0) return null;
  
  const coeffs = WHO_COEFFICIENTS[dimension];
  if (!coeffs) return null;

  // Evaluate polynomials for all quantiles
  const evaluated = coeffs.map(c => {
    const poly = c.b0 + c.b1*gaWeeks + c.b2*Math.pow(gaWeeks, 2) + c.b3*Math.pow(gaWeeks, 3) + c.b4*Math.pow(gaWeeks, 4);
    return { q: c.q, val: Math.exp(poly) };
  });

  // Find exact match or interpolate on log scale
  if (value <= evaluated[0].val) return 1; // < p1
  if (value >= evaluated[evaluated.length - 1].val) return 99; // > p99

  for (let i = 0; i < evaluated.length - 1; i++) {
    const q1 = evaluated[i];
    const q2 = evaluated[i+1];
    
    if (value >= q1.val && value <= q2.val) {
      if (value === q1.val) return Math.round(q1.q * 100);
      if (value === q2.val) return Math.round(q2.q * 100);
      
      // Logarithmic interpolation
      const frac = (Math.log(value) - Math.log(q1.val)) / (Math.log(q2.val) - Math.log(q1.val));
      const p = (q1.q + frac * (q2.q - q1.q)) * 100;
      return Math.max(1, Math.min(99, Math.round(p)));
    }
  }
  
  return null;
}

export function WhoFetalBiometryCalculator({ value, onChange }: CalculatorProps) {
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [sex, setSex] = useState<Sex>(value?.sex || 'unknown');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [ac, setAc] = useState(value?.ac || '');
  const [fl, setFl] = useState(value?.fl || '');
  const [hl, setHl] = useState(value?.hl || '');

  const [bpdPercentile, setBpdPercentile] = useState<number | null>(value?.bpdPercentile || null);
  const [hcPercentile, setHcPercentile] = useState<number | null>(value?.hcPercentile || null);
  const [acPercentile, setAcPercentile] = useState<number | null>(value?.acPercentile || null);
  const [flPercentile, setFlPercentile] = useState<number | null>(value?.flPercentile || null);
  const [hlPercentile, setHlPercentile] = useState<number | null>(value?.hlPercentile || null);

  useEffect(() => {
    let efw = null;
    let percentile = null;
    let pDescription = '';

    if (bpd && hc && ac && fl) {
      const b = Number(bpd) / 10;
      const h = Number(hc) / 10;
      const a = Number(ac) / 10;
      const f = Number(fl) / 10;

      // Hadlock IV para o PESO (em gramas)
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
    let hlP = null;

    if (gaWeeks !== '') {
      const weeksDecimal = Number(gaWeeks) + (Number(gaDays || 0) / 7);

      if (bpd) bpdP = getWhoPercentile('BPD', weeksDecimal, Number(bpd));
      if (hc) hcP = getWhoPercentile('HC', weeksDecimal, Number(hc));
      if (ac) acP = getWhoPercentile('AC', weeksDecimal, Number(ac));
      if (fl) flP = getWhoPercentile('FL', weeksDecimal, Number(fl));
      if (hl) hlP = getWhoPercentile('HL', weeksDecimal, Number(hl));
    }

    setBpdPercentile(bpdP);
    setHcPercentile(hcP);
    setAcPercentile(acP);
    setFlPercentile(flP);
    setHlPercentile(hlP);

    if (efw && gaWeeks !== '') {
      const weeksDecimal = Number(gaWeeks) + (Number(gaDays || 0) / 7);
      
      let efwDim: WHODimension = 'EFW';
      if (sex === 'male') efwDim = 'EFW_M';
      if (sex === 'female') efwDim = 'EFW_F';
      
      // WHO para o PERCENTIL do peso
      percentile = getWhoPercentile(efwDim, weeksDecimal, efw);
      
      if (percentile !== null) {
        if (percentile < 10) pDescription = 'Pequeno para a Idade Gestacional (PIG)';
        else if (percentile > 90) pDescription = 'Grande para a Idade Gestacional (GIG)';
        else pDescription = 'Adequado para a Idade Gestacional (AIG)';
      }
    }

    const parts = [];
    if (efw) parts.push(`Peso Est. (Hadlock IV): ${Math.round(efw)}g (OMS p${percentile !== null ? `${percentile}%` : 'N/A'})`);
    if (bpdP !== null) parts.push(`DBP: ${bpd}mm (OMS p${bpdP}%)`);
    if (hcP !== null) parts.push(`CC: ${hc}mm (OMS p${hcP}%)`);
    if (acP !== null) parts.push(`CA: ${ac}mm (OMS p${acP}%)`);
    if (flP !== null) parts.push(`CF: ${fl}mm (OMS p${flP}%)`);
    if (hlP !== null) parts.push(`Úmero: ${hl}mm (OMS p${hlP}%)`);

    const summary = parts.length > 0
      ? `[Biometria Fetal Calculada (OMS)]\n- ${parts.join('\n- ')}`
      : null;

    onChange({
      gaWeeks, gaDays, sex, bpd, hc, ac, fl, hl,
      efw: efw ? Math.round(efw) : null,
      percentile,
      pDescription,
      bpdPercentile: bpdP,
      hcPercentile: hcP,
      acPercentile: acP,
      flPercentile: flP,
      hlPercentile: hlP,
      _summary: summary
    });
  }, [gaWeeks, gaDays, sex, bpd, hc, ac, fl, hl]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-sm">
            <BarChart3 size={24} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Biometria Fetal</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Padrão O.M.S. (World Health Organization)</p>
          </div>
        </div>
        <div className="bg-cyan-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-cyan-200">
           Curva WHO
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-cyan-50/50 p-6 rounded-2xl border-2 border-cyan-100/50">
           <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ml-1 mb-3 block">IG de Referência e Sexo</label>
           <div className="flex gap-4">
              <CalculatorInput type="number" placeholder="Sem" value={gaWeeks} onChange={setGaWeeks} suffix="s" />
              <CalculatorInput type="number" placeholder="Dias" value={gaDays} onChange={setGaDays} suffix="d" />
              <div className="flex-1">
                <select className="input text-xs h-[42px] font-bold text-ink-900 bg-white" value={sex} onChange={e=>setSex(e.target.value as Sex)}>
                  <option value="unknown">Indeterminado</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
           <div className="space-y-2">
              <CalculatorInput label="Úmero (mm)" placeholder="0.0" value={hl} onChange={setHl} />
              {hlPercentile !== null && (
                <div className={classNames(
                  "text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider",
                  hlPercentile < 10 || hlPercentile > 90 
                    ? "bg-amber-50/50 border-amber-100 text-amber-700 font-extrabold" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-700 font-extrabold"
                )}>
                  p{hlPercentile}%
                </div>
              )}
           </div>
        </div>
      </div>

      {value?.efw ? (
        <div className="flex flex-col gap-4">
          <ResultCard 
            label="Peso Fetal Estimado (Hadlock IV)" 
            value={`${value.efw}g`} 
            variant="brand"
          />
          {value.percentile !== null && (
            <ResultCard 
              label="Percentil WHO / Crescimento" 
              value={`${value.percentile}%`} 
              recommendation={value.pDescription}
              variant={value.percentile < 10 || value.percentile > 90 ? 'red' : 'emerald'}
            />
          )}
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
             <Ruler size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira a biometria para análise</p>
        </div>
      )}

      <div className="text-[9px] text-center text-ink-300 font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1">
         <div className="flex items-center gap-2"><Sparkles size={10} /> Padrão Global de Crescimento (O.M.S.)</div>
         <div>Peso base calculado via Hadlock IV</div>
      </div>
    </div>
  );
}
