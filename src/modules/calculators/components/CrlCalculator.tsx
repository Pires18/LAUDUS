import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Info, Zap } from 'lucide-react';

export function CrlCalculator({ value, onChange, examDateMs }: CalculatorProps) {
  const [crl, setCrl] = useState(value?.crl || '');

  useEffect(() => {
    let ga = null;
    let edd = null;

    if (crl) {
      const c_mm = Number(crl);
      const c_cm = c_mm / 10;
      
      // Hadlock et al. 1992 - 4th degree polynomial (Standard Fetalmed/Radiology)
      // ln(MA) = 1.684969 + 0.315646(CRL) - 0.049306(CRL^2) + 0.004057(CRL^3) - 0.000120456(CRL^4)
      const lnMA = 1.684969 
                 + (0.315646 * c_cm) 
                 - (0.049306 * Math.pow(c_cm, 2)) 
                 + (0.004057 * Math.pow(c_cm, 3)) 
                 - (0.000120456 * Math.pow(c_cm, 4));
      
      const weeksFloat = Math.exp(lnMA);
      const totalDays = Math.round(weeksFloat * 7);
      
      const weeks = Math.floor(totalDays / 7);
      const days = totalDays % 7;
      ga = `${weeks}s ${days}d`;

      // DDP Calculation: use examDateMs if available, otherwise fallback to today
      const today = examDateMs ? new Date(examDateMs) : new Date();
      today.setHours(12, 0, 0, 0);
      const eddDate = new Date(today.getTime() + (280 - totalDays) * 24 * 60 * 60 * 1000);
      
      const d = eddDate.getDate().toString().padStart(2, '0');
      const m = (eddDate.getMonth() + 1).toString().padStart(2, '0');
      const y = eddDate.getFullYear();
      edd = `${d}/${m}/${y}`;
    }

    const summary = ga 
      ? `[CCN / IG Calculada]\nCCN: ${crl}mm\nIG estimada (Hadlock): ${ga}\nDDP: ${edd}`
      : null;

    onChange({
      crl, ga, edd,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crl, examDateMs]);

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center gap-1.5">
        <Activity size={14} className="text-cyan-600" />
        <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">IG pelo CCN (Hadlock 1992)</h3>
      </div>

      <div className="p-3 space-y-4">
        <div>
          <label className="text-[9px] font-bold text-ink-400 uppercase block mb-1">CCN (Comprimento Cabeça-Nádegas) em mm</label>
          <div className="relative">
            <input 
              type="number" 
              className="input text-center font-black text-xl h-12 border-cyan-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all" 
              placeholder="mm"
              value={crl} 
              onChange={e => setCrl(e.target.value)} 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-cyan-500 bg-cyan-50 px-1.5 py-0.5 rounded">mm</div>
          </div>
        </div>

        {crl && (Number(crl) < 10 || Number(crl) > 84) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
            <Info size={14} className="text-amber-500 shrink-0" />
            <span className="text-[9px] text-amber-700 font-medium leading-tight">
              {Number(crl) < 10
                ? 'CCN < 10mm: fora do intervalo de validação da fórmula de Hadlock (10–84mm). Resultado estimado.'
                : 'CCN > 84mm: prefira datação por biometria (DBP/CC) nesta fase gestacional.'}
            </span>
          </div>
        )}

        {value?.ga ? (
          <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-200 rounded-xl p-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[8px] font-bold text-cyan-600 uppercase block tracking-widest mb-1">Idade Gestacional</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-cyan-900 leading-none">{value.ga}</span>
                  <Zap size={12} className="text-amber-400 fill-amber-400" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold text-cyan-600 uppercase block tracking-widest mb-1">DDP (Estimada)</span>
                <span className="text-sm font-bold text-cyan-800 leading-none">{value.edd}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-cyan-100/50 text-[8px] text-cyan-500 font-medium italic">
              Referência: Hadlock et al. 1992 (Radiology 182:501-505)
            </div>
          </div>
        ) : (
          <div className="bg-ink-50 rounded-lg p-3 flex items-center gap-3 border border-dashed border-ink-200">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
              <Info size={14} className="text-ink-400" />
            </div>
            <span className="text-[10px] text-ink-500 leading-tight">
              Insira o valor do CCN (10–84mm) para obter a datação fetal precisa.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
