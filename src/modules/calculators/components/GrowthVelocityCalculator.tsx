import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { TrendingDown, LineChart, Activity } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { computeGrowthVelocity, type FetalSex, type GrowthVelocityResult } from '../constants/fetalReferences';

const fmt = (n: number, dec = 2) => n.toFixed(dec).replace('.', ',');
const gaLabel = (w: number) => {
  const wk = Math.floor(w);
  const d = Math.round((w - wk) * 7);
  return `${wk}s${d}d`;
};

/**
 * Velocidade de crescimento fetal entre dois exames (perinatal.org.uk — Hugh & Gardosi, 2022).
 * Compara o Δz-score de EPF/semana (limiar patológico < −0,13) e a projeção no mesmo percentil.
 */
export function GrowthVelocityCalculator({ value, onChange }: CalculatorProps) {
  const [prevEfw, setPrevEfw] = useState(value?.prevEfw || '');
  const [prevGaW, setPrevGaW] = useState(value?.prevGaW || '');
  const [prevGaD, setPrevGaD] = useState(value?.prevGaD || '0');
  const [curEfw, setCurEfw] = useState(value?.curEfw || '');
  const [curGaW, setCurGaW] = useState(value?.curGaW || '');
  const [curGaD, setCurGaD] = useState(value?.curGaD || '0');
  const [sex, setSex] = useState<FetalSex>(value?.sex || 'unknown');

  const [result, setResult] = useState<GrowthVelocityResult | null>(value?.result || null);

  useEffect(() => {
    const ga1 = prevGaW !== '' ? Number(prevGaW) + Number(prevGaD || 0) / 7 : NaN;
    const ga2 = curGaW !== '' ? Number(curGaW) + Number(curGaD || 0) / 7 : NaN;
    const e1 = Number(prevEfw), e2 = Number(curEfw);

    let r: GrowthVelocityResult | null = null;
    if (e1 > 0 && e2 > 0 && Number.isFinite(ga1) && Number.isFinite(ga2)) {
      r = computeGrowthVelocity({ efw1: e1, ga1Weeks: ga1, efw2: e2, ga2Weeks: ga2, sex });
    }
    setResult(r);

    let summary: string | null = null;
    if (r) {
      const cls = r.classification === 'deceleration'
        ? 'Desaceleração significativa da velocidade de crescimento (< −0,13 z/semana) — intensificar vigilância e Doppler; avaliação em medicina fetal'
        : r.classification === 'acceleration'
          ? 'Aceleração do crescimento (> +9,3% vs. projeção) — investigar macrossomia/diabetes'
          : 'Velocidade de crescimento adequada (sem desaceleração significativa)';
      summary = `Velocidade de crescimento (Hugh & Gardosi, 2022): Δz de ${fmt(r.zVelocityPerWeek)}/semana em ${fmt(r.intervalWeeks, 1)} semanas `
        + `(EPF ${Math.round(e1)} g p${r.percentile1} → ${Math.round(e2)} g p${r.percentile2}; projeção ${Math.round(r.projectedEfw2)} g, ${fmt(r.pctVsProjected, 1)}%). `
        + `${cls}.${r.reliable ? '' : ' (Intervalo < 2 semanas — interpretar com cautela.)'}`;
    }

    onChange({ prevEfw, prevGaW, prevGaD, curEfw, curGaW, curGaD, sex, result: r, _summary: summary });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevEfw, prevGaW, prevGaD, curEfw, curGaW, curGaD, sex]);

  const variant = result?.classification === 'deceleration' ? 'red'
    : result?.classification === 'acceleration' ? 'amber' : 'emerald';
  const clsLabel = result?.classification === 'deceleration' ? 'Desaceleração significativa'
    : result?.classification === 'acceleration' ? 'Crescimento acelerado' : 'Velocidade adequada';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
            <LineChart size={24} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Velocidade de Crescimento</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Hugh &amp; Gardosi (2022) · perinatal.org.uk</p>
          </div>
        </div>
        <div className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-200">
          Δz / semana
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Exame anterior */}
        <div className="bg-ink-50/60 p-6 rounded-2xl border-2 border-ink-100/60 space-y-4">
          <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block">Exame anterior</label>
          <CalculatorInput label="EPF (g)" type="number" placeholder="0" value={prevEfw} onChange={setPrevEfw} suffix="g" />
          <div className="flex gap-3">
            <CalculatorInput label="IG (sem)" type="number" placeholder="Sem" value={prevGaW} onChange={setPrevGaW} suffix="s" />
            <CalculatorInput label="Dias" type="number" placeholder="0" value={prevGaD} onChange={setPrevGaD} suffix="d" />
          </div>
        </div>
        {/* Exame atual */}
        <div className="bg-indigo-50/50 p-6 rounded-2xl border-2 border-indigo-100/50 space-y-4">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">Exame atual</label>
          <CalculatorInput label="EPF (g)" type="number" placeholder="0" value={curEfw} onChange={setCurEfw} suffix="g" />
          <div className="flex gap-3">
            <CalculatorInput label="IG (sem)" type="number" placeholder="Sem" value={curGaW} onChange={setCurGaW} suffix="s" />
            <CalculatorInput label="Dias" type="number" placeholder="0" value={curGaD} onChange={setCurGaD} suffix="d" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border-2 border-ink-100/60">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1 mb-2 block">Sexo fetal (curva OMS)</label>
        <select className="input text-xs h-[42px] font-bold text-ink-900 bg-white w-full" value={sex} onChange={e => setSex(e.target.value as FetalSex)}>
          <option value="unknown">Indeterminado</option>
          <option value="male">Masculino</option>
          <option value="female">Feminino</option>
        </select>
      </div>

      {result ? (
        <div className="flex flex-col gap-4">
          <ResultCard
            label="Velocidade (Δz-score de EPF por semana)"
            value={`${fmt(result.zVelocityPerWeek)} /sem`}
            recommendation={`${clsLabel}. Limiar patológico: < −0,13 z/semana (Hugh & Gardosi, 2022) — associado a maior risco perinatal mesmo com EPF ≥ P10.`}
            variant={variant}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResultCard label="EPF projetada (mesmo percentil)" value={`${Math.round(result.projectedEfw2)} g`} variant="brand" />
            <ResultCard label="Desvio vs. projeção" value={`${fmt(result.pctVsProjected, 1)}%`} variant={result.pctVsProjected <= -8 ? 'red' : result.pctVsProjected >= 9.3 ? 'amber' : 'emerald'} />
            <ResultCard label="Queda de percentil" value={`${result.percentile1} → ${result.percentile2}`} variant={result.centileDrop > 0 ? 'amber' : 'emerald'} />
          </div>
          {!result.reliable && (
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider text-center">Intervalo &lt; 2 semanas — velocidade pouco confiável.</p>
          )}
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
            <Activity size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira os dois exames para calcular a velocidade</p>
        </div>
      )}

      <div className="text-[9px] text-center text-ink-300 font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-2"><TrendingDown size={10} /> Z-score de EPF pela curva OMS/Kiserud (2017)</div>
        <div>Projeção no mesmo percentil · limiar −0,13 z/semana</div>
      </div>
    </div>
  );
}
