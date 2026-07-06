import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { HeartPulse, AlertTriangle, Pill, Info, ArrowRight } from 'lucide-react';
import { CalculatorInput, CategorySelector } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import {
  computePreeclampsiaRisk, DEFAULT_PE_THRESHOLDS,
  type RacialOrigin, type Conception, type PeMaternalFactors, type PeBiomarkers,
} from '../fmf/preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL } from '../fmf/preeclampsiaData';
import { momPlausible, formatOneInN } from '../fmf/qc';
import { mapMedianMmHg, utaPiMedian, plgfMedian, toMoM, type Analyzer, type PeMedianCovariates } from '../fmf/medians';

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

  const validated = PROVISIONAL_PE_COEFFICIENTS.validated;

  const bmi = useMemo(() => {
    const w = Number(weightKg), h = Number(heightCm) / 100;
    return w && h ? w / (h * h) : null;
  }, [weightKg, heightCm]);

  // MoM automático dos biomarcadores (MAP, UtA-PI, PlGF) — medianas Tan 2018
  // ajustadas por IG + covariáveis, com intercepto por analisador.
  const gaDays = gaWeeks ? Number(gaWeeks) * 7 : undefined;
  const covariates = useMemo<PeMedianCovariates | null>(() => {
    if (!gaDays || !Number(weightKg) || !Number(heightCm) || !Number(age)) return null;
    return {
      gaDays, weightKg: Number(weightKg), heightCm: Number(heightCm), ageYears: Number(age),
      racialOrigin, smoker, chronicHypertension,
      diabetes: diabetes === 'type1' ? 'type1' : diabetes === 'type2' ? 'type2noinsulin' : 'none',
      ivf: conception === 'ivf',
      parity,
    };
  }, [gaDays, weightKg, heightCm, age, racialOrigin, smoker, chronicHypertension, diabetes, conception, parity]);

  const mapMoM = useMemo(() => (mapMmHg && covariates ? toMoM(Number(mapMmHg), mapMedianMmHg(covariates)) : undefined), [mapMmHg, covariates]);
  const utaPiMoM = useMemo(() => (utaPiRaw && covariates ? toMoM(Number(utaPiRaw), utaPiMedian(covariates)) : undefined), [utaPiRaw, covariates]);
  const plgfMoM = useMemo(() => (plgfRaw && covariates ? toMoM(Number(plgfRaw), plgfMedian(covariates, analyzer)) : undefined), [plgfRaw, covariates, analyzer]);

  const qcWarnings = useMemo(() => {
    const w: string[] = [];
    if ((mapMmHg || utaPiRaw || plgfRaw) && !covariates) w.push('Informe idade, peso, altura e IG para calcular o MoM dos biomarcadores.');
    if (!momPlausible(mapMoM)) w.push('MAP em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(utaPiMoM)) w.push('IP uterinas em MoM fora da faixa plausível (0,2–5,0).');
    if (!momPlausible(plgfMoM)) w.push('PlGF em MoM fora da faixa plausível (0,2–5,0).');
    if (parity === 'parousPE' && previousPeGaWeeks && (Number(previousPeGaWeeks) < 20 || Number(previousPeGaWeeks) > 42)) {
      w.push('IG do parto na PE prévia fora de 20–42 semanas.');
    }
    return w;
  }, [mapMmHg, utaPiRaw, plgfRaw, covariates, mapMoM, utaPiMoM, plgfMoM, parity, previousPeGaWeeks]);

  const canCompute = !!(Number(age) && Number(weightKg) && Number(heightCm));

  const result = useMemo(() => {
    if (!canCompute) return null;
    const factors: PeMaternalFactors = {
      ageYears: Number(age), weightKg: Number(weightKg), heightCm: Number(heightCm), racialOrigin, conception,
      chronicHypertension, diabetesType1: diabetes === 'type1', diabetesType2: diabetes === 'type2',
      sleOrAps, familyHistoryPE, nulliparous: parity === 'nulliparous', previousPE: parity === 'parousPE',
      previousPeGaWeeks: previousPeGaWeeks ? Number(previousPeGaWeeks) : undefined,
    };
    const biomarkers: PeBiomarkers = { mapMoM, utaPiMoM, plgfMoM };
    return computePreeclampsiaRisk(factors, biomarkers, PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL);
  }, [canCompute, age, weightKg, heightCm, racialOrigin, conception, parity, previousPeGaWeeks, diabetes, chronicHypertension, sleOrAps, familyHistoryPE, mapMoM, utaPiMoM, plgfMoM]);

  useEffect(() => {
    if (!result) {
      // Preserva todos os campos digitados mesmo sem resultado (evita perda ao fechar).
      onChange({
        age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks,
        diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
        mapMmHg, utaPiRaw, plgfRaw, _summary: null,
      });
      return;
    }
    const fmt = formatOneInN;
    const disclaimer = validated ? '' : '⚠️ EM VALIDAÇÃO (não usar clinicamente) — ';
    const conduta = result.aspirinRecommended
      ? 'Risco elevado de PE pré-termo — considerar AAS 150 mg/noite (11–14 até 36 sem).'
      : 'Risco não elevado para PE pré-termo pelo rastreamento.';
    const underflowNote = result.biomarkerLikelihoodUnderflow
      ? ' ⚠️ Biomarcadores informados fora de faixa plausível — risco calculado apenas com fatores maternos (basal).'
      : '';

    onChange({
      age, weightKg, heightCm, gaWeeks, racialOrigin, conception, parity, previousPeGaWeeks,
      diabetes, chronicHypertension, sleOrAps, familyHistoryPE, smoker, analyzer,
      mapMmHg, mapMoM: mapMoM ? Number(mapMoM.toFixed(3)) : '',
      utaPiRaw, utaPiMoM: utaPiMoM ? Number(utaPiMoM.toFixed(3)) : '',
      plgfRaw, plgfMoM: plgfMoM ? Number(plgfMoM.toFixed(3)) : '',
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
  // mapMmHg/utaPiRaw/plgfRaw são valores "crus" que só entram no payload do
  // onChange (ou alimentam covariates indiretamente) e NÃO garantem troca de
  // referência de `result` quando mudam sozinhos — precisam estar aqui,
  // senão o _summary/dados salvos podem ficar desatualizados se forem o
  // último campo editado pelo médico.
  }, [result, mapMoM, utaPiMoM, plgfMoM, gaWeeks, smoker, analyzer, mapMmHg, utaPiRaw, plgfRaw]);

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

      {!validated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800 font-bold leading-relaxed">
            EM VALIDAÇÃO — fatores maternos por Wright 2015; parte de biomarcadores ainda aproximada.
            Não usar para decisão clínica. Não é a calculadora oficial da FMF.
          </div>
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

      <div className="space-y-3">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Biomarcadores (opcional)</label>
        <CategorySelector label="Analisador (para o MoM do PlGF)" options={ANALYZER_OPTIONS} current={analyzer} onSelect={(v: Analyzer) => setAnalyzer(v)} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <CalculatorInput type="number" label="MAP" placeholder="mmHg" value={mapMmHg} onChange={setMapMmHg} suffix="mmHg" />
            {mapMoM !== undefined && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-1 mt-1 block">= {mapMoM.toFixed(2)} MoM</span>}
          </div>
          <div>
            <CalculatorInput type="number" label="IP Uterinas" placeholder="valor" value={utaPiRaw} onChange={setUtaPiRaw} suffix="PI" />
            {utaPiMoM !== undefined && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-1 mt-1 block">= {utaPiMoM.toFixed(2)} MoM</span>}
          </div>
          <div>
            <CalculatorInput type="number" label="PlGF" placeholder="pg/mL" value={plgfRaw} onChange={setPlgfRaw} suffix="pg/mL" />
            {plgfMoM !== undefined && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-1 mt-1 block">= {plgfMoM.toFixed(2)} MoM</span>}
          </div>
        </div>
        <p className="text-[9px] text-ink-400 font-medium ml-1">
          MoM calculado automaticamente pela IG e covariáveis (medianas Tan 2018). Insira MAP em mmHg, IP uterinas (média) e PlGF em pg/mL do analisador selecionado.
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
