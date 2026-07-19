import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { Dna, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { CalculatorInput } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import {
  ntExpectedMedianMm, fhrExpectedBpm,
  type MarkerState, type Trisomy, type TrisomyFactorBreakdown,
} from '../fmf/trisomy';
import { trisomyRiskFromForm } from '../fmf/fromForm';
import { PROVISIONAL_TRISOMY_PARAMS } from '../fmf/trisomyData';
import { momPlausible, crlToGaWeeks, crlInWindow, formatGa, formatOneInN, CRL_MIN_MM, CRL_MAX_MM } from '../fmf/qc';

const MARKER_OPTIONS: { label: string; value: MarkerState }[] = [
  { label: 'Não avaliado', value: 'notAssessed' },
  { label: 'Normal', value: 'normal' },
  { label: 'Alterado', value: 'abnormal' },
];

const FACTOR_LABEL: Record<keyof TrisomyFactorBreakdown, string> = {
  nt: 'TN', biochem: 'Bioquímica', fhr: 'FCF', nasalBone: 'Osso Nasal',
  ductusVenosus: 'Ducto Venoso', tricuspid: 'Regurg. Tricúspide',
};

/** Faixa de risco a partir do "1 : N" (cutoff de rastreamento). */
function riskBand(oneInN: number): { label: string; variant: 'red' | 'amber' | 'emerald' } {
  if (oneInN <= 100) return { label: 'Alto risco', variant: 'red' };
  if (oneInN <= 1000) return { label: 'Risco intermediário', variant: 'amber' };
  return { label: 'Baixo risco', variant: 'emerald' };
}

/** Conduta sugerida pela faixa de risco (mesmo protocolo vale p/ T21/18/13). */
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

/** Cartão "jornada de risco": basal (idade) → corrigido (após TN/bioquímica/marcadores). */
function RiskJourneyCard({
  trisomyLabel, priorOneInN, finalOneInN, factors,
}: {
  trisomyLabel: string;
  priorOneInN: number;
  finalOneInN: number;
  factors: TrisomyFactorBreakdown;
}) {
  const band = riskBand(finalOneInN);
  const chips = (Object.keys(factors) as (keyof TrisomyFactorBreakdown)[])
    .filter((k) => factors[k] !== undefined)
    .map((k) => ({ key: k, label: FACTOR_LABEL[k], lr: factors[k]! }));

  const styles = {
    red: 'bg-red-50 border-red-200 text-red-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[band.variant];

  return (
    <div className={classNames('rounded-2xl border-2 p-5 space-y-4 shadow-sm', styles)}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-black uppercase tracking-widest">{trisomyLabel}</span>
        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-white/70">
          {band.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 text-center py-2">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Basal (idade/IG)</span>
          <span className="text-lg font-black opacity-80">{formatOneInN(priorOneInN)}</span>
        </div>
        <ArrowRight size={20} className="opacity-40 shrink-0" />
        <div className="flex-1 text-center py-2 bg-white/50 rounded-xl">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Corrigido (final)</span>
          <span className="text-2xl font-black">{formatOneInN(finalOneInN)}</span>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-current/10">
          {chips.map((c) => (
            <span key={c.key} className="text-[9px] font-black px-2.5 py-1.5 rounded-lg bg-white/70 border border-current/10">
              {c.label} {c.lr >= 1 ? `×${c.lr.toFixed(1)}` : `÷${(1 / c.lr).toFixed(1)}`}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] font-bold leading-relaxed pt-1">{triage(finalOneInN)}</p>
    </div>
  );
}

export function TrisomyRiskCalculator({ value, onChange }: CalculatorProps) {
  const [age, setAge] = useState(value?.age || '');
  const [crlMm, setCrlMm] = useState(value?.crlMm || '');
  const [ntMm, setNtMm] = useState(value?.ntMm || '');
  const [bhcgMoM, setBhcgMoM] = useState(value?.bhcgMoM || '');
  const [pappaMoM, setPappaMoM] = useState(value?.pappaMoM || '');
  const [fhrBpm, setFhrBpm] = useState(value?.fhrBpm || '');
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

  // ── Cálculo único (basal + corrigido) — via fonte ÚNICA `trisomyRiskFromForm`
  //    (mesma matemática do cálculo ao vivo da aba Estruturado). ──────────
  const risk = useMemo(() => {
    if (!hasResult) return null;
    return trisomyRiskFromForm({
      ageYears: ageNum,
      ntMm: ntMm ? Number(ntMm) : null,
      crlMm: crlMm ? Number(crlMm) : null,
      gestDays: gaWeeks ? Math.round(gaWeeks * 7) : null,
      freeBhcgMoM: bhcgMoM ? Number(bhcgMoM) : null,
      pappaMoM: pappaMoM ? Number(pappaMoM) : null,
      fhrBpm: fhrBpm ? Number(fhrBpm) : null,
      nasalBone, ductusVenosus, tricuspid,
    });
  }, [hasResult, ageNum, ntMm, crlMm, gaWeeks, bhcgMoM, pappaMoM, fhrBpm, nasalBone, ductusVenosus, tricuspid]);

  useEffect(() => {
    if (!risk) {
      // Preserva todos os campos digitados mesmo sem resultado (evita perda ao fechar).
      onChange({ age, crlMm, ntMm, bhcgMoM, pappaMoM, fhrBpm, nasalBone, ductusVenosus, tricuspid, _summary: null });
      return;
    }
    const fmt = formatOneInN;
    const disclaimer = validated ? 'Apoio à decisão (não é a calc oficial da FMF). ' : '⚠️ EM VALIDAÇÃO (não usar clinicamente) — ';
    const gaStr = gaWeeks ? ` IG (CCN): ${formatGa(gaWeeks)}.` : '';
    const ntStr = ntMm && ntMoM ? `, TN ${ntMm}mm (${ntMoM.toFixed(2)} MoM)` : '';
    const floorStr = risk.reassuranceFloored.t21
      ? ' (risco no piso de tranquilização — não reduz abaixo de 1/20 do basal, convenção FMF)'
      : '';
    const summary =
      `${disclaimer}Risco combinado 1º trimestre — ` +
      `T21: basal ${fmt(risk.priorOneInN.t21)} → corrigido ${fmt(risk.oneInN.t21)} (${riskBand(risk.oneInN.t21).label})${floorStr}; ` +
      `T18: basal ${fmt(risk.priorOneInN.t18)} → corrigido ${fmt(risk.oneInN.t18)}; ` +
      `T13: basal ${fmt(risk.priorOneInN.t13)} → corrigido ${fmt(risk.oneInN.t13)}. ` +
      `Idade ${ageNum}a${ntStr}` +
      (bhcgMoM ? `, β-hCG ${bhcgMoM} MoM` : '') +
      (pappaMoM ? `, PAPP-A ${pappaMoM} MoM` : '') + `.${gaStr} ${triage(risk.oneInN.t21)}`;

    onChange({
      age, crlMm, igSemanas: gaWeeks ? formatGa(gaWeeks) : '',
      ntMm, ntMoM: ntMoM ? Number(ntMoM.toFixed(3)) : '',
      bhcgMoM, pappaMoM, fhrBpm, nasalBone, ductusVenosus, tricuspid,
      riscoBasalT21: fmt(risk.priorOneInN.t21), riscoT21: fmt(risk.oneInN.t21),
      riscoBasalT18: fmt(risk.priorOneInN.t18), riscoT18: fmt(risk.oneInN.t18),
      riscoBasalT13: fmt(risk.priorOneInN.t13), riscoT13: fmt(risk.oneInN.t13),
      _summary: summary,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk, gaWeeks, ntMm, ntMoM]);

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

      {!validated ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 font-bold leading-relaxed">
            EM VALIDAÇÃO — coeficientes provisórios (baseados em modelos publicados, ainda não conferidos).
            Não usar para decisão clínica. Não é a calculadora oficial da FMF.
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-ink-50 border border-ink-200 text-[11px] text-ink-500 font-bold leading-relaxed">
          Apoio à decisão clínica — não é a calculadora oficial da FMF. O risco final deve ser sempre
          integrado ao julgamento clínico.
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
          <div>
            <CalculatorInput type="number" label="FCF (batimentos)" placeholder="bpm" value={fhrBpm} onChange={setFhrBpm} suffix="bpm" />
            {gaWeeks && fhrBpm && (
              <span className="text-[9px] font-black text-fuchsia-600 uppercase tracking-widest ml-1 mt-1 block">
                Δ {(Number(fhrBpm) - fhrExpectedBpm(Math.round(gaWeeks * 7), PROVISIONAL_TRISOMY_PARAMS.fhr)).toFixed(0)} bpm vs esperado
              </span>
            )}
          </div>
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

      {risk ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-3 bg-brand-500 rounded-full" />
            <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">Basal → Corrigido, por trissomia</label>
          </div>
          {(['t21', 't18', 't13'] as Trisomy[]).map((t) => (
            <RiskJourneyCard
              key={t}
              trisomyLabel={TRISOMY_LABEL[t]}
              priorOneInN={risk.priorOneInN[t]}
              finalOneInN={risk.oneInN[t]}
              factors={risk.factors[t]}
            />
          ))}
          <p className="text-[9px] text-ink-400 text-center font-medium pt-1">
            Basal = risco a priori por idade materna, corrigido para a idade gestacional do rastreamento (~12 sem).
            Corrigido = basal combinado com TN, bioquímica e marcadores ecográficos avaliados.
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
