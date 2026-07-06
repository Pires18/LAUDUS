import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { Dna, AlertTriangle, Info } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import { computeTrisomyRisk, probToOneInN, ntExpectedMedianMm, type MarkerState, type Trisomy } from '../fmf/trisomy';
import { ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS } from '../fmf/trisomyData';
import { momPlausible, crlToGaWeeks, crlInWindow, formatGa, CRL_MIN_MM, CRL_MAX_MM } from '../fmf/qc';

const MARKER_OPTIONS: { label: string; value: MarkerState }[] = [
  { label: 'Não avaliado', value: 'notAssessed' },
  { label: 'Normal', value: 'normal' },
  { label: 'Alterado', value: 'abnormal' },
];

/** Faixa de risco a partir do "1 : N" (cutoff de rastreamento). */
function riskBand(oneInN: number): { label: string; variant: 'red' | 'amber' | 'emerald' } {
  if (oneInN <= 100) return { label: 'Alto risco', variant: 'red' };
  if (oneInN <= 1000) return { label: 'Risco intermediário', variant: 'amber' };
  return { label: 'Baixo risco', variant: 'emerald' };
}

/** Conduta sugerida pela faixa de risco do T21 (triagem). */
function triage(oneInN: number): string {
  if (oneInN <= 100) return 'Alto risco: aconselhamento para teste diagnóstico (biópsia de vilo/amniocentese).';
  if (oneInN <= 1000) return 'Risco intermediário: considerar NIPT (cfDNA) ou marcadores adicionais.';
  return 'Baixo risco: seguimento habitual do pré-natal.';
}

const TRISOMY_LABEL: Record<Trisomy, string> = { t21: 'Trissomia 21', t18: 'Trissomia 18', t13: 'Trissomia 13' };

function MarkerSelector({ label, current, onSelect }: { label: string; current: MarkerState; onSelect: (v: MarkerState) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-1 h-3 bg-brand-500 rounded-full" />
        <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">{label}</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MARKER_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={classNames(
              'h-11 rounded-2xl text-[11px] font-black uppercase tracking-wider border-2 transition-all',
              current === o.value
                ? o.value === 'abnormal' ? 'bg-red-500 text-white border-red-400 shadow-sm'
                  : o.value === 'normal' ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                  : 'bg-ink-500 text-white border-ink-400 shadow-sm'
                : 'bg-white text-ink-400 border-ink-100 hover:border-ink-200',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrisomyRiskCalculator({ value, onChange }: CalculatorProps) {
  const [age, setAge] = useState(value?.age || '');
  const [crlMm, setCrlMm] = useState(value?.crlMm || '');
  const [ntMm, setNtMm] = useState(value?.ntMm || '');
  const [bhcgMoM, setBhcgMoM] = useState(value?.bhcgMoM || '');
  const [pappaMoM, setPappaMoM] = useState(value?.pappaMoM || '');
  const [nasalBone, setNasalBone] = useState<MarkerState>(value?.nasalBone || 'notAssessed');
  const [ductusVenosus, setDuctusVenosus] = useState<MarkerState>(value?.ductusVenosus || 'notAssessed');
  const [tricuspid, setTricuspid] = useState<MarkerState>(value?.tricuspid || 'notAssessed');

  const validated = PROVISIONAL_TRISOMY_PARAMS.validated;
  const ageNum = Number(age);
  const hasResult = ageNum >= 15 && ageNum <= 55;

  const gaWeeks = crlMm ? crlToGaWeeks(Number(crlMm)) : null;

  // MoM informativo da TN (medida / mediana esperada do modelo de mistura).
  const ntMoM = useMemo(() => {
    if (!ntMm || !crlMm) return undefined;
    const median = ntExpectedMedianMm(Number(crlMm), PROVISIONAL_TRISOMY_PARAMS.nt);
    return median > 0 ? Number(ntMm) / median : undefined;
  }, [ntMm, crlMm]);

  // ── Controle de qualidade ────────────────────────────────────────────
  const qcWarnings = useMemo(() => {
    const w: string[] = [];
    if (crlMm && !crlInWindow(Number(crlMm))) {
      w.push(`CCN ${crlMm}mm fora da janela do rastreamento (${CRL_MIN_MM}–${CRL_MAX_MM}mm / 11–13+6 sem).`);
    }
    if (ntMm && !crlMm) w.push('Informe o CCN para calcular o MoM da TN.');
    if (!momPlausible(ntMoM)) w.push('TN em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(bhcgMoM ? Number(bhcgMoM) : undefined)) w.push('β-hCG em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(pappaMoM ? Number(pappaMoM) : undefined)) w.push('PAPP-A em MoM fora da faixa plausível (0,2–5,0).');
    return w;
  }, [crlMm, ntMm, ntMoM, bhcgMoM, pappaMoM]);

  // ── Cálculo único (a priori + posterior) ─────────────────────────────
  const result = useMemo(() => {
    if (!hasResult) return null;
    const prior = ageRelatedRisk(ageNum);
    const risk = computeTrisomyRisk(
      {
        priorRisk: prior,
        ntMm: ntMm ? Number(ntMm) : undefined,
        crlMm: crlMm ? Number(crlMm) : undefined,
        gestDays: gaWeeks ? Math.round(gaWeeks * 7) : undefined,
        freeBhcgMoM: bhcgMoM ? Number(bhcgMoM) : undefined,
        pappaMoM: pappaMoM ? Number(pappaMoM) : undefined,
        nasalBone, ductusVenosus, tricuspid,
      },
      PROVISIONAL_TRISOMY_PARAMS,
    );
    return { risk, priorT21OneInN: probToOneInN(prior.t21) };
  }, [hasResult, ageNum, ntMm, crlMm, gaWeeks, bhcgMoM, pappaMoM, nasalBone, ductusVenosus, tricuspid]);

  useEffect(() => {
    if (!result) {
      // Preserva todos os campos digitados mesmo sem resultado (evita perda ao fechar).
      onChange({ age, crlMm, ntMm, bhcgMoM, pappaMoM, nasalBone, ductusVenosus, tricuspid, _summary: null });
      return;
    }
    const { risk } = result;
    const fmt = (n: number) => (isFinite(n) ? `1:${n}` : '—');
    const disclaimer = validated ? '' : '⚠️ EM VALIDAÇÃO (não usar clinicamente) — ';
    const gaStr = gaWeeks ? ` IG (CCN): ${formatGa(gaWeeks)}.` : '';
    const ntStr = ntMm && ntMoM ? `, TN ${ntMm}mm (${ntMoM.toFixed(2)} MoM)` : '';
    const summary =
      `${disclaimer}Risco combinado 1º trimestre — ` +
      `T21 ${fmt(risk.oneInN.t21)} (${riskBand(risk.oneInN.t21).label}); ` +
      `T18 ${fmt(risk.oneInN.t18)}; T13 ${fmt(risk.oneInN.t13)}. ` +
      `Idade ${ageNum}a${ntStr}` +
      (bhcgMoM ? `, β-hCG ${bhcgMoM} MoM` : '') +
      (pappaMoM ? `, PAPP-A ${pappaMoM} MoM` : '') + `.${gaStr} ${triage(risk.oneInN.t21)}`;

    onChange({
      age, crlMm, igSemanas: gaWeeks ? formatGa(gaWeeks) : '',
      ntMm, ntMoM: ntMoM ? Number(ntMoM.toFixed(3)) : '',
      bhcgMoM, pappaMoM, nasalBone, ductusVenosus, tricuspid,
      riscoT21: fmt(risk.oneInN.t21),
      riscoT18: fmt(risk.oneInN.t18),
      riscoT13: fmt(risk.oneInN.t13),
      _summary: summary,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, gaWeeks, ntMm, ntMoM]);

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center shadow-sm">
          <Dna size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Risco de Cromossomopatia</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Rastreamento combinado de 1º trimestre (T21/18/13)</p>
        </div>
      </div>

      {!validated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 font-bold leading-relaxed">
            EM VALIDAÇÃO — coeficientes provisórios (baseados em modelos publicados, ainda não conferidos).
            Não usar para decisão clínica. Não é a calculadora oficial da FMF.
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Datação & Medidas</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <CalculatorInput type="number" label="Idade" placeholder="anos" value={age} onChange={setAge} suffix="a" />
          <CalculatorInput type="number" label="CCN" placeholder="mm" value={crlMm} onChange={setCrlMm} suffix="mm" />
          <div>
            <CalculatorInput type="number" label="TN (mm)" placeholder="mm" value={ntMm} onChange={setNtMm} suffix="mm" />
            {ntMoM !== undefined && (
              <span className="text-[9px] font-black text-fuchsia-600 uppercase tracking-widest ml-1 mt-1 block">
                = {ntMoM.toFixed(2)} MoM
              </span>
            )}
          </div>
          <CalculatorInput type="number" label="β-hCG livre" placeholder="MoM" value={bhcgMoM} onChange={setBhcgMoM} suffix="MoM" />
          <CalculatorInput type="number" label="PAPP-A" placeholder="MoM" value={pappaMoM} onChange={setPappaMoM} suffix="MoM" />
          {gaWeeks && (
            <div className="flex flex-col justify-end pb-1">
              <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">IG (CCN)</span>
              <span className={classNames('text-sm font-black', crlInWindow(Number(crlMm)) ? 'text-ink-800' : 'text-amber-600')}>
                {formatGa(gaWeeks)}
              </span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-ink-400 font-medium ml-1">
          TN em MoM é calculada pelo CCN. β-hCG/PAPP-A em MoM vêm do laudo laboratorial (analisador Cobas).
        </p>
      </div>

      {qcWarnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
          {qcWarnings.map((w, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[10px] text-amber-800 font-semibold leading-tight">{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <MarkerSelector label="Osso Nasal (alterado = ausente)" current={nasalBone} onSelect={setNasalBone} />
        <MarkerSelector label="Ducto Venoso (alterado = onda A reversa)" current={ductusVenosus} onSelect={setDuctusVenosus} />
        <MarkerSelector label="Regurgitação Tricúspide (alterado = presente)" current={tricuspid} onSelect={setTricuspid} />
      </div>

      {result ? (
        <div className="flex flex-col gap-3">
          {(['t21', 't18', 't13'] as Trisomy[]).map((t) => {
            const n = result.risk.oneInN[t];
            const band = riskBand(n);
            return (
              <ResultCard
                key={t}
                label={TRISOMY_LABEL[t]}
                value={isFinite(n) ? `1 : ${n}` : '—'}
                recommendation={t === 't21' ? triage(n) : undefined}
                variant={t === 't21' ? band.variant : 'brand'}
              />
            );
          })}
          <p className="text-[10px] text-ink-400 text-center font-medium">
            T21 — risco a priori (só idade): 1 : {result.priorT21OneInN} → ajustado: 1 : {result.risk.oneInN.t21}
          </p>
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Insira a idade materna (15–55 anos)</p>
        </div>
      )}
    </div>
  );
}
