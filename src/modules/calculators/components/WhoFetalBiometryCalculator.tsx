import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Ruler, BarChart3, Sparkles, AlertTriangle } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import { calcHadlockEfw, type WHODimension } from '../constants/fetalReferences';
import {
  BIOMETRY_REFERENCES,
  DEFAULT_BIOMETRY_REFERENCE,
  getPercentileBy,
  efwMedianBy,
  intergrowthEfw,
  type BiometryReference,
} from '../constants/biometryReferences';

type Sex = 'male' | 'female' | 'unknown';
/** Fórmula usada para ESTIMAR o peso (distinta da curva de percentil). */
type EfwFormula = 'hadlock4' | 'intergrowth';

const REF_ORDER: BiometryReference[] = ['hadlock', 'intergrowth', 'who'];

/** Chip de percentil sob cada medida. */
function PctChip({ p, refShort }: { p: number | null; refShort: string }) {
  if (p === null) return null;
  const out = p < 10 || p > 90;
  return (
    <div
      className={classNames(
        'text-[9px] font-black py-1 px-3 rounded-xl border-2 text-center transition-all animate-in fade-in slide-in-from-top-1 duration-200 uppercase tracking-wider',
        out ? 'bg-amber-50/50 border-amber-100 text-amber-700' : 'bg-emerald-50/50 border-emerald-100 text-emerald-700'
      )}
      title={`Percentil pela curva ${refShort}`}
    >
      p{p}% · {refShort}
    </div>
  );
}

export function WhoFetalBiometryCalculator({ value, onChange }: CalculatorProps) {
  const [reference, setReference] = useState<BiometryReference>(value?.reference || DEFAULT_BIOMETRY_REFERENCE);
  const [efwFormula, setEfwFormula] = useState<EfwFormula>(value?.efwFormula || 'hadlock4');
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [sex, setSex] = useState<Sex>(value?.sex || 'unknown');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [ac, setAc] = useState(value?.ac || '');
  const [fl, setFl] = useState(value?.fl || '');
  const [hl, setHl] = useState(value?.hl || '');

  const [pcts, setPcts] = useState<Record<string, number | null>>({});
  const [pctSrc, setPctSrc] = useState<Record<string, string>>({});
  const meta = BIOMETRY_REFERENCES[reference];

  useEffect(() => {
    const weeksDecimal = gaWeeks !== '' ? Number(gaWeeks) + Number(gaDays || 0) / 7 : null;

    // 1) PESO ESTIMADO — fórmula escolhida (independe da curva de percentil).
    let efw: number | null = null;
    if (efwFormula === 'intergrowth') {
      if (hc && ac) efw = intergrowthEfw(Number(hc), Number(ac));
    } else if (bpd && hc && ac && fl) {
      efw = calcHadlockEfw(Number(bpd), Number(hc), Number(ac), Number(fl));
    }

    // 2) PERCENTIS — pela referência escolhida (com fallback para OMS nas
    // dimensões que a referência não cobre).
    const next: Record<string, number | null> = {};
    const srcs: Record<string, string> = {};
    const fellBack: string[] = [];
    const measure = (dim: WHODimension, raw: string, key: string) => {
      if (!raw || weeksDecimal === null) { next[key] = null; return; }
      const r = getPercentileBy(reference, dim, weeksDecimal, Number(raw));
      next[key] = r.percentile;
      srcs[key] = BIOMETRY_REFERENCES[r.usedRef].short;
      if (r.fellBack && r.percentile !== null) fellBack.push(key.toUpperCase());
    };
    measure('BPD', bpd, 'bpd');
    measure('HC', hc, 'hc');
    measure('AC', ac, 'ac');
    measure('FL', fl, 'fl');
    measure('HL', hl, 'hl');
    setPcts(next);
    setPctSrc(srcs);

    let percentile: number | null = null;
    let pDescription = '';
    let efwRefUsed: BiometryReference = reference;
    if (efw && weeksDecimal !== null) {
      // Só a OMS tem curva de PFE por sexo; Hadlock/INTERGROWTH são padrões
      // únicos e resolvem a dimensão sexada na própria curva neutra.
      const dim: WHODimension = sex === 'male' ? 'EFW_M' : sex === 'female' ? 'EFW_F' : 'EFW';
      const r = getPercentileBy(reference, dim, weeksDecimal, efw);
      percentile = r.percentile;
      efwRefUsed = r.usedRef;
      if (percentile !== null) {
        if (percentile < 10) pDescription = 'Pequeno para a Idade Gestacional (PIG)';
        else if (percentile > 90) pDescription = 'Grande para a Idade Gestacional (GIG)';
        else pDescription = 'Adequado para a Idade Gestacional (AIG)';
      }
    }

    const median = weeksDecimal !== null ? efwMedianBy(reference, weeksDecimal) : null;
    const refShort = BIOMETRY_REFERENCES[efwRefUsed].short;
    const formulaLabel = efwFormula === 'intergrowth' ? 'INTERGROWTH (CC/CA)' : 'Hadlock IV';

    const parts: string[] = [];
    if (efw) parts.push(`Peso Est. (${formulaLabel}): ${Math.round(efw)} g (${refShort} p${percentile ?? 'N/A'})`);
    if (next.bpd !== null && next.bpd !== undefined) parts.push(`DBP: ${bpd} mm (p${next.bpd})`);
    if (next.hc !== null && next.hc !== undefined) parts.push(`CC: ${hc} mm (p${next.hc})`);
    if (next.ac !== null && next.ac !== undefined) parts.push(`CA: ${ac} mm (p${next.ac})`);
    if (next.fl !== null && next.fl !== undefined) parts.push(`CF: ${fl} mm (p${next.fl})`);
    if (next.hl !== null && next.hl !== undefined) parts.push(`Úmero: ${hl} mm (p${next.hl})`);

    let summary: string | null = null;
    if (parts.length) {
      summary = `Biometria fetal — curva ${meta.label}: ${parts.join('; ')}.`;
      if (median) summary += ` Mediana esperada p/ a IG: ${Math.round(median)} g.`;
      if (fellBack.length) summary += ` Percentis de ${fellBack.join('/')} pela curva OMS (não cobertos por ${meta.short}).`;
      if (!meta.validated) summary += ` [Curva ${meta.short} EM VALIDAÇÃO — conferir antes de laudar.]`;
    }

    onChange({
      reference, efwFormula, gaWeeks, gaDays, sex, bpd, hc, ac, fl, hl,
      efw: efw ? Math.round(efw) : null,
      percentile, pDescription,
      efwMedian: median ? Math.round(median) : null,
      referenceLabel: meta.label,
      referenceValidated: meta.validated,
      fellBack,
      bpdPercentile: next.bpd ?? null,
      hcPercentile: next.hc ?? null,
      acPercentile: next.ac ?? null,
      flPercentile: next.fl ?? null,
      hlPercentile: next.hl ?? null,
      _summary: summary,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, efwFormula, gaWeeks, gaDays, sex, bpd, hc, ac, fl, hl]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-sm">
            <BarChart3 size={24} />
          </div>
          <div>
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Biometria Fetal</h3>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Percentis por curva de referência selecionável</p>
          </div>
        </div>
        <div className="bg-cyan-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-cyan-200 shrink-0">
          {meta.short}
        </div>
      </div>

      {/* ─── Curva de referência ─── */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Curva de Referência (percentis)</label>
        <div className="grid grid-cols-3 gap-3">
          {REF_ORDER.map((id) => {
            const m = BIOMETRY_REFERENCES[id];
            const on = reference === id;
            return (
              <button
                key={id}
                onClick={() => setReference(id)}
                className={classNames(
                  'p-3 rounded-2xl border-2 transition-all text-left relative',
                  on ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-100' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
                )}
              >
                <div className="text-[11px] font-black uppercase tracking-wide">{m.short}</div>
                <div className={classNames('text-[8px] font-bold leading-tight mt-0.5', on ? 'text-white/70' : 'text-ink-400')}>
                  {m.dimensions.includes('BPD') ? 'PFE + biometrias' : 'somente PFE'}
                </div>
                {!m.validated && (
                  <div className={classNames(
                    'mt-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-block',
                    on ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  )}>
                    em validação
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {!meta.validated && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">Curva em validação</p>
              <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                Coeficientes transcritos da fonte publicada e travados por testes, mas ainda sem conferência
                caso-a-caso contra a calculadora oficial. Confira antes de laudar.
              </p>
            </div>
          </div>
        )}
        <p className="text-[9px] text-ink-400 font-medium ml-1 leading-relaxed">{meta.cite}</p>
        {meta.note && <p className="text-[9px] text-ink-400 font-medium ml-1 leading-relaxed">{meta.note}</p>}
      </div>

      {/* ─── Fórmula do peso ─── */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Fórmula do Peso Estimado</label>
        <div className="flex gap-3">
          {([
            { id: 'hadlock4' as const, label: 'Hadlock IV', desc: 'DBP + CC + CA + CF' },
            { id: 'intergrowth' as const, label: 'INTERGROWTH', desc: 'CC + CA (Stirnemann 2017)' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => setEfwFormula(f.id)}
              className={classNames(
                'flex-1 p-3 rounded-2xl border-2 transition-all text-left',
                efwFormula === f.id ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
              )}
            >
              <div className="text-[11px] font-black uppercase tracking-wide">{f.label}</div>
              <div className={classNames('text-[8px] font-bold', efwFormula === f.id ? 'text-white/70' : 'text-ink-400')}>{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-cyan-50/50 p-6 rounded-2xl border-2 border-cyan-100/50">
          <label className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ml-1 mb-3 block">IG de Referência e Sexo</label>
          <div className="flex gap-4">
            <CalculatorInput type="number" placeholder="Sem" value={gaWeeks} onChange={setGaWeeks} suffix="s" />
            <CalculatorInput type="number" placeholder="Dias" value={gaDays} onChange={setGaDays} suffix="d" />
            <div className="flex-1">
              <select className="input text-xs h-[42px] font-bold text-ink-900 bg-white" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="unknown">Indeterminado</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </div>
          </div>
          {reference !== 'who' && (
            <p className="text-[9px] text-cyan-600/70 font-bold mt-2 ml-1">
              {meta.short} não diferencia o PFE por sexo — o sexo só afeta a curva OMS.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <CalculatorInput label="DBP (mm)" placeholder="0.0" value={bpd} onChange={setBpd} />
            <PctChip p={pcts.bpd ?? null} refShort={pctSrc.bpd || BIOMETRY_REFERENCES.who.short} />
          </div>
          <div className="space-y-2">
            <CalculatorInput label="CC (mm)" placeholder="0.0" value={hc} onChange={setHc} />
            <PctChip p={pcts.hc ?? null} refShort={pctSrc.hc || BIOMETRY_REFERENCES.who.short} />
          </div>
          <div className="space-y-2">
            <CalculatorInput label="CA (mm)" placeholder="0.0" value={ac} onChange={setAc} />
            <PctChip p={pcts.ac ?? null} refShort={pctSrc.ac || BIOMETRY_REFERENCES.who.short} />
          </div>
          <div className="space-y-2">
            <CalculatorInput label="CF (mm)" placeholder="0.0" value={fl} onChange={setFl} />
            <PctChip p={pcts.fl ?? null} refShort={pctSrc.fl || BIOMETRY_REFERENCES.who.short} />
          </div>
          <div className="space-y-2">
            <CalculatorInput label="Úmero (mm)" placeholder="0.0" value={hl} onChange={setHl} />
            <PctChip p={pcts.hl ?? null} refShort={pctSrc.hl || BIOMETRY_REFERENCES.who.short} />
          </div>
        </div>
      </div>

      {value?.efw ? (
        <div className="flex flex-col gap-4">
          <ResultCard
            label={`Peso Fetal Estimado (${efwFormula === 'intergrowth' ? 'INTERGROWTH' : 'Hadlock IV'})`}
            value={`${value.efw}g`}
            variant="brand"
          />
          {value.percentile !== null && (
            <ResultCard
              label={`Percentil — curva ${value.referenceLabel}`}
              value={`${value.percentile}%`}
              recommendation={value.pDescription}
              variant={value.percentile < 10 || value.percentile > 90 ? 'red' : 'emerald'}
            />
          )}
          {value.efwMedian && (
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Mediana esperada p/ a IG ({BIOMETRY_REFERENCES[reference].short})</span>
              <span className="text-[13px] font-black text-ink-700">{value.efwMedian} g</span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200">
            <Ruler size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">
            {efwFormula === 'intergrowth' ? 'Insira CC e CA para análise' : 'Insira DBP, CC, CA e CF para análise'}
          </p>
        </div>
      )}

      <div className="text-[9px] text-center text-ink-300 font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-2"><Sparkles size={10} /> Curva {meta.label}</div>
        <div>Peso por {efwFormula === 'intergrowth' ? 'INTERGROWTH (Stirnemann 2017)' : 'Hadlock IV'}</div>
      </div>
    </div>
  );
}
