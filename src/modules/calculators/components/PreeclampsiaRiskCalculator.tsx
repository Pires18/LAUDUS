import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { HeartPulse, AlertTriangle, Pill, Info, ArrowRight } from 'lucide-react';
import { CalculatorInput, CategorySelector } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import {
  DEFAULT_PE_THRESHOLDS,
  type RacialOrigin, type Conception,
} from '../fmf/preeclampsia';
import { peRiskFromForm } from '../fmf/fromForm';
import { PROVISIONAL_PE_COEFFICIENTS } from '../fmf/preeclampsiaData';
import { momPlausible, psvRatioPlausible, formatOneInN } from '../fmf/qc';
import { type Analyzer } from '../fmf/medians';

type Parity = 'nulliparous' | 'parousNoPE' | 'parousPE';
type Diabetes = 'none' | 'type1' | 'type2';

const ANALYZER_OPTIONS = [
  { label: 'Roche Cobas', value: 'cobas' },
  { label: 'DELFIA', value: 'delfia' },
  { label: 'Kryptor', value: 'kryptor' },
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

export function PreeclampsiaRiskCalculator({ value, onChange }: CalculatorProps) {
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
  const [analyzer, setAnalyzer] = useState<Analyzer>(value?.analyzer || 'cobas');
  const [mapMmHg, setMapMmHg] = useState(value?.mapMmHg || '');
  const [utaPiRaw, setUtaPiRaw] = useState(value?.utaPiRaw || '');
  const [plgfRaw, setPlgfRaw] = useState(value?.plgfRaw || '');
  const [psvRatioRaw, setPsvRatioRaw] = useState(value?.psvRatioRaw || '');

  // Medidas detalhadas (protocolo FMF) — a MAP, a IP uterina média e a razão do
  // PSV oftálmico são calculadas destes campos; caem de volta nos valores únicos
  // acima (semente/entrada rápida) quando os detalhados estão vazios.
  // PA: 2 aferições × 2 braços (sistólica/diastólica).
  const [pa1rs, setPa1rs] = useState(value?.pa1rs || ''); const [pa1rd, setPa1rd] = useState(value?.pa1rd || '');
  const [pa1ls, setPa1ls] = useState(value?.pa1ls || ''); const [pa1ld, setPa1ld] = useState(value?.pa1ld || '');
  const [pa2rs, setPa2rs] = useState(value?.pa2rs || ''); const [pa2rd, setPa2rd] = useState(value?.pa2rd || '');
  const [pa2ls, setPa2ls] = useState(value?.pa2ls || ''); const [pa2ld, setPa2ld] = useState(value?.pa2ld || '');
  // IP das artérias uterinas: direita + esquerda → média.
  const [utaR, setUtaR] = useState(value?.utaR || ''); const [utaL, setUtaL] = useState(value?.utaL || '');
  // Artérias oftálmicas bilaterais: 1º e 2º pico sistólico por olho → razão média.
  const [oftRp1, setOftRp1] = useState(value?.oftRp1 || ''); const [oftRp2, setOftRp2] = useState(value?.oftRp2 || '');
  const [oftLp1, setOftLp1] = useState(value?.oftLp1 || ''); const [oftLp2, setOftLp2] = useState(value?.oftLp2 || '');

  const validated = PROVISIONAL_PE_COEFFICIENTS.validated;

  // ── Cálculos automáticos das medidas detalhadas ──
  /** MAP = média, sobre as aferições completas, de (sistólica + 2·diastólica)/3. */
  const map4 = useMemo(() => {
    const readings: Array<[string, string]> = [[pa1rs, pa1rd], [pa1ls, pa1ld], [pa2rs, pa2rd], [pa2ls, pa2ld]];
    const maps = readings
      .map(([s, d]) => { const S = Number(s), D = Number(d); return S > 0 && D > 0 && D <= S ? (S + 2 * D) / 3 : null; })
      .filter((x): x is number => x != null);
    return maps.length ? maps.reduce((a, b) => a + b, 0) / maps.length : null;
  }, [pa1rs, pa1rd, pa1ls, pa1ld, pa2rs, pa2rd, pa2ls, pa2ld]);

  /** IP uterina média (direita/esquerda). */
  const utaMean = useMemo(() => {
    const vals = [utaR, utaL].map(Number).filter((x) => x > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [utaR, utaL]);

  /** Razão do PSV oftálmico (2º/1º pico) média dos dois olhos (Gana 2022). */
  const psvRatioBil = useMemo(() => {
    const ratios: Array<[string, string]> = [[oftRp1, oftRp2], [oftLp1, oftLp2]];
    const rs = ratios
      .map(([p1, p2]) => { const P1 = Number(p1), P2 = Number(p2); return P1 > 0 && P2 > 0 ? P2 / P1 : null; })
      .filter((x): x is number => x != null);
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  }, [oftRp1, oftRp2, oftLp1, oftLp2]);

  // Valores efetivos: detalhado (se houver) senão o único (semente/rápido).
  const effMap = map4 != null ? map4.toFixed(1) : mapMmHg;
  const effUta = utaMean != null ? utaMean.toFixed(2) : utaPiRaw;
  const effPsv = psvRatioBil != null ? psvRatioBil.toFixed(3) : psvRatioRaw;

  const bmi = useMemo(() => {
    const w = Number(weightKg), h = Number(heightCm) / 100;
    return w && h ? w / (h * h) : null;
  }, [weightKg, heightCm]);

  // Cálculo via fonte ÚNICA `peRiskFromForm` (mesma matemática do cálculo ao
  // vivo da aba Estruturado) — converte MAP/UtA/PlGF em MoM (Tan 2018) e a
  // razão oftálmica em delta (Gana 2022), depois roda o Bayes de riscos
  // competitivos. O PlGF entra BRUTO (pg/mL); os detalhados (PA/UtA/PSV) já
  // vêm agregados em effMap/effUta/effPsv.
  const gaWeeksNum = gaWeeks ? Number(gaWeeks) : null;
  const canCompute = !!(Number(age) && Number(weightKg) && Number(heightCm));
  const hasCovariates = !!(gaWeeksNum && Number(weightKg) && Number(heightCm) && Number(age));

  const computed = useMemo(() => {
    if (!canCompute) return null;
    return peRiskFromForm({
      ageYears: Number(age), weightKg: Number(weightKg), heightCm: Number(heightCm),
      gaWeeks: gaWeeksNum,
      racialOrigin, conception, parity,
      previousPeGaWeeks: previousPeGaWeeks ? Number(previousPeGaWeeks) : null,
      diabetes: diabetes === 'type1' ? 'type1' : diabetes === 'type2' ? 'type2noinsulin' : 'none',
      chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
      mapMmHg: effMap ? Number(effMap) : null,
      utaPiRaw: effUta ? Number(effUta) : null,
      plgfRaw: plgfRaw ? Number(plgfRaw) : null,
      psvRatio: effPsv ? Number(effPsv) : null,
    });
  }, [canCompute, age, weightKg, heightCm, gaWeeksNum, racialOrigin, conception, parity, previousPeGaWeeks, diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer, effMap, effUta, plgfRaw, effPsv]);

  const result = computed?.risk ?? null;
  const mapMoM = computed?.mapMoM;
  const utaPiMoM = computed?.utaPiMoM;
  const plgfMoM = computed?.plgfMoM;
  const psvRatioDelta = computed?.psvRatioDelta;

  const qcWarnings = useMemo(() => {
    const w: string[] = [];
    if ((effMap || effUta || plgfRaw || effPsv) && !hasCovariates) w.push('Informe idade, peso, altura e IG para calcular o MoM/delta dos biomarcadores.');
    if (!momPlausible(mapMoM)) w.push('MAP em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(utaPiMoM)) w.push('IP uterinas em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(plgfMoM)) w.push('PlGF em MoM fora da faixa plausível (0,2–5,0).');
    if (effPsv && !psvRatioPlausible(Number(effPsv))) w.push('PSV ratio (artéria oftálmica) fora da faixa plausível (0,2–2,0).');
    if (parity === 'parousPE' && previousPeGaWeeks && (Number(previousPeGaWeeks) < 20 || Number(previousPeGaWeeks) > 42)) {
      w.push('IG do parto na PE prévia fora de 20–42 semanas.');
    }
    return w;
  }, [effMap, effUta, plgfRaw, effPsv, hasCovariates, mapMoM, utaPiMoM, plgfMoM, parity, previousPeGaWeeks]);

  useEffect(() => {
    if (!result) {
      // Preserva todos os campos digitados mesmo sem resultado (evita perda ao fechar).
      onChange({
        age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks,
        diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
        mapMmHg, utaPiRaw, plgfRaw, psvRatioRaw,
        pa1rs, pa1rd, pa1ls, pa1ld, pa2rs, pa2rd, pa2ls, pa2ld, utaR, utaL, oftRp1, oftRp2, oftLp1, oftLp2,
        _summary: null,
      });
      return;
    }
    const fmt = formatOneInN;
    const disclaimer = validated ? 'Apoio à decisão (não é a calc oficial da FMF). ' : '⚠️ EM VALIDAÇÃO (não usar clinicamente) — ';
    const conduta = result.aspirinRecommended
      ? 'Risco elevado de PE pré-termo — considerar AAS 150 mg/noite (11–14 até 36 sem).'
      : 'Risco não elevado para PE pré-termo pelo rastreamento.';
    const underflowNote = result.biomarkerLikelihoodUnderflow
      ? ' ⚠️ Biomarcadores informados fora de faixa plausível — risco calculado apenas com fatores maternos (basal).'
      : '';

    onChange({
      age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks,
      diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
      pa1rs, pa1rd, pa1ls, pa1ld, pa2rs, pa2rd, pa2ls, pa2ld, utaR, utaL, oftRp1, oftRp2, oftLp1, oftLp2,
      mapMmHg: effMap, mapMoM: mapMoM ? Number(mapMoM.toFixed(3)) : '',
      utaPiRaw: effUta, utaPiMoM: utaPiMoM ? Number(utaPiMoM.toFixed(3)) : '',
      plgfRaw, plgfMoM: plgfMoM ? Number(plgfMoM.toFixed(3)) : '',
      psvRatioRaw: effPsv, psvRatioDelta: psvRatioDelta !== undefined ? Number(psvRatioDelta.toFixed(3)) : '',
      riscoBasalPePretermo: fmt(result.basalPretermPE.oneInN),
      riscoBasalPeTermo: fmt(result.basalTermPE.oneInN),
      riscoPePretermo: fmt(result.pretermPE.oneInN),
      riscoPeTermo: fmt(result.termPE.oneInN),
      biomarkerLikelihoodUnderflow: result.biomarkerLikelihoodUnderflow,
      _summary:
        `${disclaimer}Risco de pré-eclâmpsia (1º trimestre) — basal: pré-termo ${fmt(result.basalPretermPE.oneInN)}, ` +
        `a termo ${fmt(result.basalTermPE.oneInN)}; corrigido: pré-termo (<37s) ${fmt(result.pretermPE.oneInN)}, ` +
        `a termo ${fmt(result.termPE.oneInN)}. ${conduta}${underflowNote}`,
    });
  // `result` já reage a age/weightKg/heightCm/racialOrigin/conception/parity/
  // previousPeGaWeeks/diabetes/chronicHypertension/sleOrAps/familyHistoryPE
  // (estão no array de deps do próprio useMemo). gaWeeks/smoker/analyzer/
  // mapMmHg/utaPiRaw/plgfRaw/psvRatioRaw são valores "crus" que só entram no
  // payload do onChange (ou alimentam covariates indiretamente) e NÃO
  // garantem troca de referência de `result` quando mudam sozinhos —
  // precisam estar aqui, senão o _summary/dados salvos podem ficar
  // desatualizados se forem o último campo editado pelo médico.
  }, [result, mapMoM, utaPiMoM, plgfMoM, psvRatioDelta, gaWeeks, smoker, analyzer, effMap, effUta, plgfRaw, effPsv,
      pa1rs, pa1rd, pa1ls, pa1ld, pa2rs, pa2rd, pa2ls, pa2ld, utaR, utaL, oftRp1, oftRp2, oftLp1, oftLp2, mapMmHg, utaPiRaw, psvRatioRaw]);

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm">
          <HeartPulse size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Risco de Pré-eclâmpsia</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Rastreamento de 1º trimestre — riscos competitivos</p>
        </div>
      </div>

      {!validated ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 font-bold leading-relaxed">
            EM VALIDAÇÃO — fatores maternos por Wright 2015; biomarcadores por O'Gorman 2016 e artéria
            oftálmica por Gana 2022; parte ainda aproximada. Não usar para decisão clínica. Não é a
            calculadora oficial da FMF.
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-ink-50 border border-ink-200 text-[11px] text-ink-500 font-bold leading-relaxed">
          Apoio à decisão clínica — não é a calculadora oficial da FMF. O risco final deve ser sempre
          integrado ao julgamento clínico.
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Características</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CalculatorInput type="number" label="Idade" placeholder="anos" value={age} onChange={setAge} suffix="a" />
          <CalculatorInput type="number" label="Peso" placeholder="kg" value={weightKg} onChange={setWeightKg} suffix="kg" />
          <CalculatorInput type="number" label="Altura" placeholder="cm" value={heightCm} onChange={setHeightCm} suffix="cm" />
          <CalculatorInput type="number" label="IG" placeholder="sem" value={gaWeeks} onChange={setGaWeeks} suffix="sem" />
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
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Biomarcadores (opcional)</label>

        {/* Pressão arterial — 4 medidas (2 aferições × 2 braços) → MAP automática */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/40 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Pressão arterial — 4 medidas (protocolo FMF)</span>
            {map4 != null && (
              <span className="text-[10px] font-black text-rose-700">MAP {map4.toFixed(1)} mmHg{mapMoM !== undefined ? ` · ${mapMoM.toFixed(2)} MoM` : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-1.5 items-center">
            <span />
            <span className="text-[8px] font-black text-ink-400 uppercase text-center">Sist. D</span>
            <span className="text-[8px] font-black text-ink-400 uppercase text-center">Diast. D</span>
            <span className="text-[8px] font-black text-ink-400 uppercase text-center">Sist. E</span>
            <span className="text-[8px] font-black text-ink-400 uppercase text-center">Diast. E</span>
            <span className="text-[9px] font-black text-ink-500">1ª</span>
            <CalculatorInput type="number" placeholder="—" value={pa1rs} onChange={setPa1rs} />
            <CalculatorInput type="number" placeholder="—" value={pa1rd} onChange={setPa1rd} />
            <CalculatorInput type="number" placeholder="—" value={pa1ls} onChange={setPa1ls} />
            <CalculatorInput type="number" placeholder="—" value={pa1ld} onChange={setPa1ld} />
            <span className="text-[9px] font-black text-ink-500">2ª</span>
            <CalculatorInput type="number" placeholder="—" value={pa2rs} onChange={setPa2rs} />
            <CalculatorInput type="number" placeholder="—" value={pa2rd} onChange={setPa2rd} />
            <CalculatorInput type="number" placeholder="—" value={pa2ls} onChange={setPa2ls} />
            <CalculatorInput type="number" placeholder="—" value={pa2ld} onChange={setPa2ld} />
          </div>
          <p className="text-[8px] text-ink-400 font-medium">MAP = média de (sistólica + 2·diastólica)/3 das aferições completas. Ou informe a MAP direta abaixo.</p>
          <CalculatorInput type="number" label="MAP direta (alternativa)" placeholder="mmHg" value={mapMmHg} onChange={setMapMmHg} suffix="mmHg" />
        </div>

        {/* IP das artérias uterinas — bilateral → média */}
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

        {/* Artérias oftálmicas — bilateral, 1º/2º pico por olho → razão média */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50/40 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Artérias oftálmicas (bilateral) — PSV ratio</span>
            {psvRatioBil != null && (
              <span className="text-[10px] font-black text-rose-700">razão {psvRatioBil.toFixed(2)}{psvRatioDelta !== undefined ? ` · Δ ${psvRatioDelta >= 0 ? '+' : ''}${psvRatioDelta.toFixed(3)}` : ''}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CalculatorInput type="number" label="P1 (1º pico) D" placeholder="cm/s" value={oftRp1} onChange={setOftRp1} suffix="cm/s" />
            <CalculatorInput type="number" label="P2 (2º pico) D" placeholder="cm/s" value={oftRp2} onChange={setOftRp2} suffix="cm/s" />
            <CalculatorInput type="number" label="P1 (1º pico) E" placeholder="cm/s" value={oftLp1} onChange={setOftLp1} suffix="cm/s" />
            <CalculatorInput type="number" label="P2 (2º pico) E" placeholder="cm/s" value={oftLp2} onChange={setOftLp2} suffix="cm/s" />
          </div>
          <p className="text-[8px] text-ink-400 font-medium">Razão = média de (2º/1º pico) dos dois olhos (Gana et al., UOG 2022;59:731). Ou informe a razão direta:</p>
          <CalculatorInput type="number" label="PSV ratio direto (alternativa)" placeholder="razão" value={psvRatioRaw} onChange={setPsvRatioRaw} suffix="razão" />
        </div>

        {/* PlGF (bioquímica) */}
        <div className="space-y-1.5">
          <CategorySelector label="Analisador (para o MoM do PlGF)" options={ANALYZER_OPTIONS} current={analyzer} onSelect={(v: Analyzer) => setAnalyzer(v)} />
          <div>
            <CalculatorInput type="number" label="PlGF" placeholder="pg/mL" value={plgfRaw} onChange={setPlgfRaw} suffix="pg/mL" />
            {plgfMoM !== undefined && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-1 mt-1 block">= {plgfMoM.toFixed(2)} MoM</span>}
          </div>
        </div>
        <p className="text-[9px] text-ink-400 font-medium ml-1">
          MoM automático pela IG e covariáveis (medianas Tan 2018). As medidas detalhadas calculam MAP, IP uterina média e razão do PSV oftálmico; se preenchidas, têm prioridade sobre os campos diretos.
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
                risco abaixo é calculado apenas com fatores maternos (basal), ignorando os biomarcadores.
                Confira os valores digitados.
              </div>
            </div>
          )}
          <PeJourneyCard
            label="PE Pré-termo (< 37 semanas)"
            basalOneInN={result.basalPretermPE.oneInN}
            finalOneInN={result.pretermPE.oneInN}
            recommendation={
              result.aspirinRecommended
                ? `Acima do cutoff (1:${DEFAULT_PE_THRESHOLDS.aspirinCutoffOneInN}) — considerar AAS 150 mg/noite (11–14 até 36 sem).`
                : 'Abaixo do cutoff de rastreamento.'
            }
            variant={result.aspirinRecommended ? 'red' : 'emerald'}
          />
          <PeJourneyCard
            label="PE a Termo"
            basalOneInN={result.basalTermPE.oneInN}
            finalOneInN={result.termPE.oneInN}
            variant="brand"
          />
          {result.aspirinRecommended && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex gap-3 items-center">
              <Pill size={18} className="text-rose-600 shrink-0" />
              <span className="text-[11px] font-bold text-rose-800 leading-relaxed">
                Profilaxia com AAS 150 mg à noite reduz PE pré-termo (ASPRE) — decisão sempre clínica.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-10 border-2 border-dashed border-ink-100 rounded-2xl text-center">
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Preencha idade, peso e altura</p>
        </div>
      )}
    </div>
  );
}
