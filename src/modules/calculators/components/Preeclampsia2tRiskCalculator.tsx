import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { HeartPulse, AlertTriangle, Pill, Info, ArrowRight } from 'lucide-react';
import { CalculatorInput, CategorySelector } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import { DEFAULT_PE_THRESHOLDS, type RacialOrigin, type Conception } from '../fmf/preeclampsia';
import {
  computePe2tRisk,
  SECOND_TRIMESTER_PE_GA_MIN_WEEKS,
  SECOND_TRIMESTER_PE_GA_MAX_WEEKS,
  type Pe2tFormInput,
} from '../fmf/preeclampsia2t';
import { momPlausible, formatOneInN } from '../fmf/qc';
import { type Analyzer } from '../fmf/medians';

type Parity = 'nulliparous' | 'parousNoPE' | 'parousPE';
type Diabetes = 'none' | 'type1' | 'type2';

// PlGF no 2º T (Tsiakkas 2015): DELFIA (ref) e Roche/Cobas. Kryptor não modelado.
const ANALYZER_OPTIONS = [
  { label: 'Roche Cobas', value: 'cobas' },
  { label: 'DELFIA', value: 'delfia' },
];
const RACIAL_OPTIONS = [
  { label: 'Branca', value: 'white' },
  { label: 'Afro-caribenha', value: 'afroCaribbean' },
  { label: 'Sul-asiática', value: 'southAsian' },
  { label: 'Leste-asiática', value: 'eastAsian' },
  { label: 'Mista', value: 'mixed' },
];
const CONCEPTION_OPTIONS = [
  { label: 'Espontânea', value: 'spontaneous' },
  { label: 'Indução de ovulação', value: 'ovulationInduction' },
  { label: 'FIV', value: 'ivf' },
];
const PARITY_OPTIONS = [
  { label: 'Nulípara', value: 'nulliparous' },
  { label: 'Parosa, sem PE', value: 'parousNoPE' },
  { label: 'Parosa, com PE prévia', value: 'parousPE' },
];
const DIABETES_OPTIONS = [
  { label: 'Não', value: 'none' },
  { label: 'Tipo 1', value: 'type1' },
  { label: 'Tipo 2', value: 'type2' },
];

function PeJourneyCard({
  label, basalOneInN, finalOneInN, variant, recommendation,
}: {
  label: string;
  basalOneInN: number;
  finalOneInN: number;
  variant: 'red' | 'emerald' | 'brand';
  recommendation?: string;
}) {
  const styles = {
    red: 'bg-rose-50 border-rose-200 text-rose-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    brand: 'bg-brand-50 border-brand-200 text-brand-900',
  }[variant];
  return (
    <div className={classNames('rounded-2xl border-2 p-5 space-y-3 shadow-sm', styles)}>
      <span className="text-[12px] font-black uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center py-2">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Basal (fatores maternos)</span>
          <span className="text-lg font-black opacity-80">{formatOneInN(basalOneInN)}</span>
        </div>
        <ArrowRight size={20} className="opacity-40 shrink-0" />
        <div className="flex-1 text-center py-2 bg-white/50 rounded-xl">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Corrigido (final)</span>
          <span className="text-2xl font-black">{formatOneInN(finalOneInN)}</span>
        </div>
      </div>
      {recommendation && <p className="text-[10px] font-bold leading-relaxed pt-1">{recommendation}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={classNames(
        'h-11 px-3 rounded-2xl text-[11px] font-black uppercase tracking-wider border-2 transition-all',
        checked ? 'bg-brand-600 text-white border-brand-500 shadow-sm' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-200',
      )}
    >
      {label}
    </button>
  );
}

export function Preeclampsia2tRiskCalculator({ value, onChange }: CalculatorProps) {
  const [age, setAge] = useState(value?.age || '');
  const [weightKg, setWeightKg] = useState(value?.weightKg || '');
  const [heightCm, setHeightCm] = useState(value?.heightCm || '');
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [racialOrigin, setRacialOrigin] = useState<RacialOrigin>(value?.racialOrigin || 'white');
  const [conception, setConception] = useState<Conception>(value?.conception || 'spontaneous');
  const [parity, setParity] = useState<Parity>(value?.parity || 'nulliparous');
  const [previousPeGaWeeks, setPreviousPeGaWeeks] = useState(value?.previousPeGaWeeks || '');
  const [diabetes, setDiabetes] = useState<Diabetes>(value?.diabetes || 'none');
  const [chronicHypertension, setChronicHypertension] = useState<boolean>(value?.chronicHypertension || false);
  const [sleOrAps, setSleOrAps] = useState<boolean>(value?.sleOrAps || false);
  const [familyHistoryPE, setFamilyHistoryPE] = useState<boolean>(value?.familyHistoryPE || false);
  const [smoker, setSmoker] = useState<boolean>(value?.smoker || false);
  const [analyzer, setAnalyzer] = useState<Analyzer>(value?.analyzer === 'delfia' ? 'delfia' : 'cobas');
  const [mapMmHg, setMapMmHg] = useState(value?.mapMmHg || '');
  // IP das artérias uterinas: direita + esquerda → média.
  const [utaR, setUtaR] = useState(value?.utaR || '');
  const [utaL, setUtaL] = useState(value?.utaL || '');
  const [plgfRaw, setPlgfRaw] = useState(value?.plgfRaw || '');
  // Artérias oftálmicas bilaterais: 1º e 2º pico por olho → razão P2/P1 média.
  const [oftRp1, setOftRp1] = useState(value?.oftRp1 || ''); const [oftRp2, setOftRp2] = useState(value?.oftRp2 || '');
  const [oftLp1, setOftLp1] = useState(value?.oftLp1 || ''); const [oftLp2, setOftLp2] = useState(value?.oftLp2 || '');
  const [oaRatioDirect, setOaRatioDirect] = useState(value?.oaRatioDirect || '');

  const utaMean = useMemo(() => {
    const vals = [utaR, utaL].map(Number).filter((x) => x > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [utaR, utaL]);
  const effUta = utaMean != null ? utaMean.toFixed(2) : '';

  /** Razão P2/P1 da oftálmica, média dos dois olhos; ou o valor direto. */
  const oaRatioBil = useMemo(() => {
    const ratios: Array<[string, string]> = [[oftRp1, oftRp2], [oftLp1, oftLp2]];
    const rs = ratios
      .map(([p1, p2]) => { const P1 = Number(p1), P2 = Number(p2); return P1 > 0 && P2 > 0 ? P2 / P1 : null; })
      .filter((x): x is number => x != null);
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  }, [oftRp1, oftRp2, oftLp1, oftLp2]);
  const effOa = oaRatioBil != null ? oaRatioBil.toFixed(3) : oaRatioDirect;

  const bmi = useMemo(() => {
    const w = Number(weightKg), h = Number(heightCm) / 100;
    return w && h ? w / (h * h) : null;
  }, [weightKg, heightCm]);

  const gaWeeksNum = gaWeeks ? Number(gaWeeks) : null;
  const canCompute = !!(Number(age) && Number(weightKg) && Number(heightCm) && gaWeeksNum);
  const inWindow = gaWeeksNum != null
    && gaWeeksNum >= SECOND_TRIMESTER_PE_GA_MIN_WEEKS
    && gaWeeksNum <= SECOND_TRIMESTER_PE_GA_MAX_WEEKS;

  const computed = useMemo(() => {
    if (!canCompute || !inWindow) return null;
    const inp: Pe2tFormInput = {
      ageYears: Number(age), weightKg: Number(weightKg), heightCm: Number(heightCm),
      gaWeeks: gaWeeksNum,
      racialOrigin, conception, parity,
      previousPeGaWeeks: previousPeGaWeeks ? Number(previousPeGaWeeks) : null,
      diabetes: diabetes === 'type1' ? 'type1' : diabetes === 'type2' ? 'type2noinsulin' : 'none',
      chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
      mapMmHg: mapMmHg ? Number(mapMmHg) : null,
      utaPiRaw: effUta ? Number(effUta) : null,
      plgfRaw: plgfRaw ? Number(plgfRaw) : null,
      oaRatio: effOa ? Number(effOa) : null,
    };
    return computePe2tRisk(inp);
  }, [canCompute, inWindow, age, weightKg, heightCm, gaWeeksNum, racialOrigin, conception, parity, previousPeGaWeeks, diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer, mapMmHg, effUta, plgfRaw, effOa]);

  const result = computed?.risk ?? null;
  const mapMoM = computed?.mapMoM;
  const utaPiMoM = computed?.utaPiMoM;
  const plgfMoM = computed?.plgfMoM;
  const psvRatioDelta = computed?.psvRatioDelta;

  const qcWarnings = useMemo(() => {
    const w: string[] = [];
    if (gaWeeksNum && !inWindow) w.push('IG fora da janela do rastreio de 2ª visita (19+0 a 24+6 semanas).');
    if ((mapMmHg || effUta || plgfRaw) && !canCompute) w.push('Informe idade, peso, altura e IG para calcular o MoM dos biomarcadores.');
    if (!momPlausible(mapMoM)) w.push('MAP em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(utaPiMoM)) w.push('IP uterinas em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(plgfMoM)) w.push('PlGF em MoM fora da faixa plausível (0,2–5,0).');
    if (parity === 'parousPE' && previousPeGaWeeks && (Number(previousPeGaWeeks) < 20 || Number(previousPeGaWeeks) > 42)) {
      w.push('IG do parto na PE prévia fora de 20–42 semanas.');
    }
    return w;
  }, [gaWeeksNum, inWindow, mapMmHg, effUta, plgfRaw, canCompute, mapMoM, utaPiMoM, plgfMoM, parity, previousPeGaWeeks]);

  useEffect(() => {
    const base = {
      age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks,
      diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
      mapMmHg, utaR, utaL, plgfRaw, oftRp1, oftRp2, oftLp1, oftLp2, oaRatioDirect,
    };
    if (!result) { onChange({ ...base, _summary: null }); return; }
    const fmt = formatOneInN;
    const strat = (oneInN: number) => (oneInN <= 100 ? 'ALTO' : oneInN <= 1000 ? 'INTERMEDIÁRIO' : 'BAIXO');
    const disclaimer = 'Apoio à decisão (modelos publicados da FMF; não é a calc oficial). ';
    const grupo = strat(result.termPE.oneInN);
    const conduta = result.aspirinRecommended
      ? 'Risco elevado — vigilância intensificada; a profilaxia com AAS é mais eficaz iniciada antes de 16 sem.'
      : 'Risco não elevado pelo rastreamento de 2ª visita.';
    const underflowNote = result.biomarkerLikelihoodUnderflow
      ? ' ⚠️ Biomarcadores fora de faixa plausível — risco calculado apenas com fatores maternos (basal).'
      : '';
    onChange({
      ...base,
      mapMoM: mapMoM ? Number(mapMoM.toFixed(3)) : '',
      utaPiRaw: effUta, utaPiMoM: utaPiMoM ? Number(utaPiMoM.toFixed(3)) : '',
      plgfMoM: plgfMoM ? Number(plgfMoM.toFixed(3)) : '',
      oaRatio: effOa, psvRatioDelta: psvRatioDelta !== undefined ? Number(psvRatioDelta.toFixed(3)) : '',
      riscoPe32: fmt(result.pretermPE.oneInN),
      riscoPe36: fmt(result.termPE.oneInN),
      grupoRisco: grupo,
      biomarkerLikelihoodUnderflow: result.biomarkerLikelihoodUnderflow,
      _summary:
        `${disclaimer}Risco de pré-eclâmpsia (rastreio de 2ª visita, 19–24+6 sem) — PE com parto < 32 sem ${fmt(result.pretermPE.oneInN)}, ` +
        `< 36 sem ${fmt(result.termPE.oneInN)} · grupo de risco ${grupo}. ${conduta}${underflowNote}`,
    });
  }, [result, mapMoM, utaPiMoM, plgfMoM, psvRatioDelta, age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks, diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer, mapMmHg, utaR, utaL, effUta, plgfRaw, effOa, oftRp1, oftRp2, oftLp1, oftLp2, oaRatioDirect, onChange]);

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm">
          <HeartPulse size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Risco de Pré-eclâmpsia — 2º trimestre</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Rastreamento de 2ª visita (19–24+6 sem) — MAP + uterinas + oftálmicas + PlGF</p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-ink-50 border border-ink-200 text-[11px] text-ink-500 font-bold leading-relaxed">
        Apoio à decisão por modelos publicados da FMF (2ª visita): fatores maternos Wright 2015; MAP + IP
        uterinas + PlGF por Gallo 2016; artéria oftálmica por Sapantzoglou 2021; medianas Tayyar/Wright A/
        Tsiakkas 2015. Reporte a &lt;32 e &lt;36 sem, com estratificação alto/intermediário/baixo. A
        estratificação concorda com a calc oficial da FMF nos casos-ouro; os riscos absolutos podem diferir
        levemente da calc online. Não é a calculadora oficial da FMF — integre sempre ao julgamento clínico.
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Características</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CalculatorInput type="number" label="Idade" placeholder="anos" value={age} onChange={setAge} suffix="a" />
          <CalculatorInput type="number" label="Peso" placeholder="kg" value={weightKg} onChange={setWeightKg} suffix="kg" />
          <CalculatorInput type="number" label="Altura" placeholder="cm" value={heightCm} onChange={setHeightCm} suffix="cm" />
          <CalculatorInput type="number" label="IG" placeholder="19–24 sem" value={gaWeeks} onChange={setGaWeeks} suffix="sem" />
        </div>
        {bmi && (
          <p className="text-[10px] text-ink-400 font-semibold ml-1">
            IMC: <span className="font-black text-ink-700">{bmi.toFixed(1)} kg/m²</span>
          </p>
        )}
      </div>

      <CategorySelector label="Origem Étnica" options={RACIAL_OPTIONS} current={racialOrigin} onSelect={(v: RacialOrigin) => setRacialOrigin(v)} />
      <CategorySelector label="Concepção" options={CONCEPTION_OPTIONS} current={conception} onSelect={(v: Conception) => setConception(v)} />
      <CategorySelector label="Paridade" options={PARITY_OPTIONS} current={parity} onSelect={(v: Parity) => setParity(v)} columns={1} />
      {parity === 'parousPE' && (
        <CalculatorInput type="number" label="IG do parto na PE prévia (semanas)" placeholder="ex: 34" value={previousPeGaWeeks} onChange={setPreviousPeGaWeeks} suffix="sem" />
      )}
      <CategorySelector label="Diabetes Mellitus" options={DIABETES_OPTIONS} current={diabetes} onSelect={(v: Diabetes) => setDiabetes(v)} />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-brand-500 rounded-full" />
          <label className="text-[10px] font-black text-ink-900 uppercase tracking-widest">História Médica</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="HAS crônica" checked={chronicHypertension} onChange={setChronicHypertension} />
          <Toggle label="LES/SAAF" checked={sleOrAps} onChange={setSleOrAps} />
          <Toggle label="Hist. familiar PE" checked={familyHistoryPE} onChange={setFamilyHistoryPE} />
          <Toggle label="Tabagismo" checked={smoker} onChange={setSmoker} />
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Biomarcadores de 2ª visita (opcional)</label>

        <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/40 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">MAP (pressão arterial média)</span>
            {mapMoM !== undefined && <span className="text-[10px] font-black text-rose-700">{mapMoM.toFixed(2)} MoM</span>}
          </div>
          <CalculatorInput type="number" label="MAP" placeholder="mmHg" value={mapMmHg} onChange={setMapMmHg} suffix="mmHg" />
        </div>

        <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/40 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">IP artérias uterinas (bilateral)</span>
            {utaMean != null && (
              <span className="text-[10px] font-black text-rose-700">média {utaMean.toFixed(2)}{utaPiMoM !== undefined ? ` · ${utaPiMoM.toFixed(2)} MoM` : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CalculatorInput type="number" label="IP uterina D" placeholder="valor" value={utaR} onChange={setUtaR} suffix="PI" />
            <CalculatorInput type="number" label="IP uterina E" placeholder="valor" value={utaL} onChange={setUtaL} suffix="PI" />
          </div>
        </div>

        {/* Artérias oftálmicas — bilateral, 1º/2º pico por olho → razão P2/P1 média (Sapantzoglou 2021) */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/40 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Artérias oftálmicas (bilateral) — razão P2/P1</span>
            {oaRatioBil != null && (
              <span className="text-[10px] font-black text-rose-700">razão {oaRatioBil.toFixed(2)}{psvRatioDelta !== undefined ? ` · Δ ${psvRatioDelta >= 0 ? '+' : ''}${psvRatioDelta.toFixed(3)}` : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CalculatorInput type="number" label="P1 (1º pico) D" placeholder="cm/s" value={oftRp1} onChange={setOftRp1} suffix="cm/s" />
            <CalculatorInput type="number" label="P2 (2º pico) D" placeholder="cm/s" value={oftRp2} onChange={setOftRp2} suffix="cm/s" />
            <CalculatorInput type="number" label="P1 (1º pico) E" placeholder="cm/s" value={oftLp1} onChange={setOftLp1} suffix="cm/s" />
            <CalculatorInput type="number" label="P2 (2º pico) E" placeholder="cm/s" value={oftLp2} onChange={setOftLp2} suffix="cm/s" />
          </div>
          <p className="text-[8px] text-ink-400 font-medium">Razão = média de (2º/1º pico) dos dois olhos (Gana et al., UOG 2022;59:731). Ou informe a razão direta:</p>
          <CalculatorInput type="number" label="Razão P2/P1 direta (alternativa)" placeholder="razão" value={oaRatioDirect} onChange={setOaRatioDirect} suffix="razão" />
        </div>

        <div className="space-y-1.5">
          <CategorySelector label="Analisador (para o MoM do PlGF)" options={ANALYZER_OPTIONS} current={analyzer} onSelect={(v: Analyzer) => setAnalyzer(v)} />
          <div>
            <CalculatorInput type="number" label="PlGF" placeholder="pg/mL" value={plgfRaw} onChange={setPlgfRaw} suffix="pg/mL" />
            {plgfMoM !== undefined && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-1 mt-1 block">= {plgfMoM.toFixed(2)} MoM</span>}
          </div>
        </div>
        <p className="text-[9px] text-ink-400 font-medium ml-1">
          MoM/delta automáticos pela IG e covariáveis — medianas de 2º trimestre (Tayyar/Wright A/Tsiakkas 2015)
          e razão oftálmica (Sapantzoglou 2021). Informe os marcadores disponíveis; cada um refina o risco.
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

      {result ? (
        <div className="flex flex-col gap-3">
          {result.biomarkerLikelihoodUnderflow && (
            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 flex gap-3 items-start">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 font-bold leading-relaxed">
                Os biomarcadores informados estão fora de qualquer faixa plausível — por segurança, o
                risco abaixo é calculado apenas com fatores maternos (basal). Confira os valores.
              </div>
            </div>
          )}
          <PeJourneyCard
            label="PE com parto < 32 semanas"
            basalOneInN={result.basalPretermPE.oneInN}
            finalOneInN={result.pretermPE.oneInN}
            recommendation={
              result.pretermPE.oneInN <= DEFAULT_PE_THRESHOLDS.aspirinCutoffOneInN
                ? `Acima do cutoff (1:${DEFAULT_PE_THRESHOLDS.aspirinCutoffOneInN}) — grupo de risco ALTO.`
                : undefined
            }
            variant={result.pretermPE.oneInN <= 100 ? 'red' : result.pretermPE.oneInN <= 1000 ? 'brand' : 'emerald'}
          />
          <PeJourneyCard
            label="PE com parto < 36 semanas"
            basalOneInN={result.basalTermPE.oneInN}
            finalOneInN={result.termPE.oneInN}
            recommendation={`Estratificação (por < 36 sem): ${result.termPE.oneInN <= 100 ? 'ALTO' : result.termPE.oneInN <= 1000 ? 'INTERMEDIÁRIO' : 'BAIXO'} risco.`}
            variant={result.termPE.oneInN <= 100 ? 'red' : result.termPE.oneInN <= 1000 ? 'brand' : 'emerald'}
          />
          {(result.pretermPE.oneInN <= 100 || result.termPE.oneInN <= 100) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex gap-3 items-center">
              <Pill size={18} className="text-rose-600 shrink-0" />
              <span className="text-[11px] font-bold text-rose-800 leading-relaxed">
                Rastreio de 2ª visita de ALTO risco — vigilância materno-fetal intensificada. A profilaxia com
                AAS é mais eficaz iniciada antes de 16 semanas; a conduta é sempre clínica.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Preencha idade, peso, altura e IG (19–24 sem)</p>
        </div>
      )}
    </div>
  );
}
