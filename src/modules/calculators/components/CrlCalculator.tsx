import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Info } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { crlToGestationalAge } from '../formulas';

export function CrlCalculator({ value, onChange, examDateMs }: CalculatorProps) {
  const [crl, setCrl] = useState(value?.crl || '');

  useEffect(() => {
    let ga = null;
    let edd = null;

    const crlGa = crl ? crlToGestationalAge(Number(crl)) : null;
    if (crlGa) {
      const totalDays = crlGa.totalDays;
      ga = crlGa.label;

      // Cálculo da DDP: usa examDateMs se disponível, senão a data atual
      const today = examDateMs ? new Date(examDateMs) : new Date();
      today.setHours(12, 0, 0, 0);
      const eddDate = new Date(today.getTime() + (280 - totalDays) * 24 * 60 * 60 * 1000);

      const d = eddDate.getDate().toString().padStart(2, '0');
      const m = (eddDate.getMonth() + 1).toString().padStart(2, '0');
      const y = eddDate.getFullYear();
      edd = `${d}/${m}/${y}`;
    }

    const summary = ga
      ? `CCN: ${crl}mm — IG estimada (Hadlock): ${ga}. DDP: ${edd}.`
      : null;

    onChange({
      crl, ga, edd,
      _summary: summary
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crl, examDateMs]);

  const outOfRange = crl && (Number(crl) < 10 || Number(crl) > 84);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-sm">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Idade Gestacional (CCN)</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Datação de 1º Trimestre — Hadlock 1992</p>
        </div>
      </div>

      <CalculatorInput
        type="number"
        label="CCN (Comprimento Cabeça-Nádegas)"
        placeholder="0.0"
        value={crl}
        onChange={setCrl}
        suffix="mm"
      />

      {outOfRange && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-700 font-medium leading-tight">
            {Number(crl) < 10
              ? 'CCN < 10mm: fora do intervalo de validação da fórmula de Hadlock (10–84mm). Resultado estimado.'
              : 'CCN > 84mm: prefira datação por biometria (DBP/CC) nesta fase gestacional.'}
          </span>
        </div>
      )}

      {value?.ga ? (
        <div className="flex flex-col gap-4">
          <ResultCard label="Idade Gestacional" value={value.ga} variant="brand" />
          <ResultCard label="Data Provável do Parto (DDP)" value={value.edd} variant="emerald" />
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira o CCN (10–84mm)</p>
        </div>
      )}
    </div>
  );
}
