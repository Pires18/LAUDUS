import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Calendar, Clock, Ruler } from 'lucide-react';
import { CalculatorInput, ResultCard } from './CalculatorUI';
import { classNames } from '../../../utils/format';
import {
  gaFromLMP,
  gaFromPriorUsg,
  gaFromBiometry,
  pickBiometryDatingParam,
  BIOMETRY_DATING_LABEL,
  BiometryDatingParam,
} from '../formulas';

type Method = 'usg' | 'dum' | 'bio';

const METHODS: { id: Method; label: string; desc: string }[] = [
  { id: 'usg', label: 'Pela USG', desc: 'Ultrassom prévio (padrão-ouro se 1º T)' },
  { id: 'dum', label: 'Pela DUM', desc: 'Data da última menstruação' },
  { id: 'bio', label: 'Pela biometria', desc: 'CCN (1ºT) · DBP (2ºT) · CC (3ºT)' },
];

const BIO_PARAMS: { id: BiometryDatingParam; label: string; hint: string }[] = [
  { id: 'ccn', label: 'CCN', hint: '1º trimestre (11+0–13+6 · 45–84 mm)' },
  { id: 'dbp', label: 'DBP', hint: '2º trimestre' },
  { id: 'cc', label: 'CC', hint: '3º trimestre' },
];

export function GestationalAgeCalculator({ value, onChange, examDateMs }: CalculatorProps) {
  const [method, setMethod] = useState<Method>(value?.method || 'usg');
  const [referenceDate, setReferenceDate] = useState<string>(() => {
    if (value?.referenceDate) return value.referenceDate;
    const d = examDateMs ? new Date(examDateMs) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dumDate, setDumDate] = useState(value?.dumDate || '');
  const [prevUsgDate, setPrevUsgDate] = useState(value?.prevUsgDate || '');
  const [prevUsgWeeks, setPrevUsgWeeks] = useState(value?.prevUsgWeeks || '');
  const [prevUsgDays, setPrevUsgDays] = useState(value?.prevUsgDays || '');
  // Biometria (mm) — o parâmetro é escolhido pelo trimestre, com override manual.
  const [ccn, setCcn] = useState(value?.ccn || '');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [bioParam, setBioParam] = useState<BiometryDatingParam | ''>(value?.bioParam || '');

  function formatDate(date: Date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  useEffect(() => {
    const today = new Date(referenceDate + 'T00:00:00');
    if (isNaN(today.getTime())) return;

    const bio = { ccn: Number(ccn) || null, dbp: Number(bpd) || null, cc: Number(hc) || null };
    const autoParam = pickBiometryDatingParam(bio);
    const usedParam: BiometryDatingParam | null = (bioParam || autoParam) as BiometryDatingParam | null;

    let currentGa: string | null = null;
    let eddStr: string | null = null;
    let sourceLabel = '';

    if (method === 'dum' && dumDate) {
      const r = gaFromLMP(new Date(dumDate + 'T00:00:00'), today);
      if (r) { currentGa = r.label; eddStr = formatDate(r.edd); sourceLabel = 'DUM'; }
    } else if (method === 'usg' && prevUsgDate && prevUsgWeeks !== '') {
      const r = gaFromPriorUsg(new Date(prevUsgDate + 'T00:00:00'), Number(prevUsgWeeks), Number(prevUsgDays || 0), today);
      if (r) { currentGa = r.label; eddStr = formatDate(r.edd); sourceLabel = 'USG anterior'; }
    } else if (method === 'bio' && usedParam && bio[usedParam]) {
      const r = gaFromBiometry(usedParam, bio[usedParam]!);
      if (r) {
        currentGa = r.label;
        const edd = new Date(today);
        edd.setDate(edd.getDate() + (280 - r.totalDays));
        eddStr = formatDate(edd);
        sourceLabel = BIOMETRY_DATING_LABEL[usedParam];
      }
    }

    // Concordância entre os métodos disponíveis (apoia a escolha da datação).
    const others: string[] = [];
    if (method !== 'dum' && dumDate) {
      const r = gaFromLMP(new Date(dumDate + 'T00:00:00'), today);
      if (r) others.push(`DUM: ${r.label}`);
    }
    if (method !== 'usg' && prevUsgDate && prevUsgWeeks !== '') {
      const r = gaFromPriorUsg(new Date(prevUsgDate + 'T00:00:00'), Number(prevUsgWeeks), Number(prevUsgDays || 0), today);
      if (r) others.push(`USG anterior: ${r.label}`);
    }
    if (method !== 'bio' && usedParam && bio[usedParam]) {
      const r = gaFromBiometry(usedParam, bio[usedParam]!);
      if (r) others.push(`${usedParam.toUpperCase()}: ${r.label}`);
    }

    const summary = currentGa
      ? `Idade gestacional: ${currentGa} (por ${sourceLabel}). DPP: ${eddStr || '---'}.` +
        (others.length ? ` Comparação — ${others.join('; ')}.` : '')
      : null;

    onChange({
      referenceDate, method, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays,
      ccn, bpd, hc, bioParam: usedParam || '',
      currentGa, edd: eddStr, sourceLabel, comparison: others,
      _summary: summary,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, referenceDate, dumDate, prevUsgDate, prevUsgWeeks, prevUsgDays, ccn, bpd, hc, bioParam]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
          <Calendar size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Cronometria Gestacional</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">IG de referência, DPP e concordância entre métodos</p>
        </div>
      </div>

      <CalculatorInput
        type="date"
        label="Data do Exame Atual (Base para Cálculo)"
        value={referenceDate}
        onChange={setReferenceDate}
      />

      <div className="space-y-4">
        <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Método de Referência</label>
        <div className="flex gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={classNames(
                'flex-1 p-4 rounded-2xl border-2 transition-all text-left',
                method === m.id
                  ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-100'
                  : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
              )}
            >
              <div className="text-xs font-black uppercase tracking-widest mb-1">{m.label}</div>
              <div className={classNames('text-[9px] font-bold opacity-60 leading-tight', method === m.id ? 'text-white' : 'text-ink-400')}>{m.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-400 font-medium ml-1">
          Hierarquia recomendada (ISUOG/ACOG): USG de 1º trimestre (CCN 45–84 mm) &gt; DUM confiável &gt; biometria do exame atual.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {method === 'dum' && (
          <CalculatorInput type="date" label="Data da DUM" value={dumDate} onChange={setDumDate} />
        )}

        {method === 'usg' && (
          <>
            <CalculatorInput type="date" label="Data da USG Anterior" value={prevUsgDate} onChange={setPrevUsgDate} />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">IG no Exame Prévio</label>
              <div className="flex gap-3">
                <CalculatorInput type="number" placeholder="Semanas" value={prevUsgWeeks} onChange={setPrevUsgWeeks} suffix="sem" />
                <CalculatorInput type="number" placeholder="Dias" value={prevUsgDays} onChange={setPrevUsgDays} suffix="d" />
              </div>
            </div>
          </>
        )}

        {method === 'bio' && (
          <>
            <div className="flex items-center gap-2 text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">
              <Ruler size={12} /> Biometria do exame (mm)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CalculatorInput type="number" label="CCN" value={ccn} onChange={setCcn} suffix="mm" />
              <CalculatorInput type="number" label="DBP" value={bpd} onChange={setBpd} suffix="mm" />
              <CalculatorInput type="number" label="CC" value={hc} onChange={setHc} suffix="mm" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Parâmetro de datação</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBioParam('')}
                  className={classNames(
                    'px-3 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all',
                    bioParam === '' ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
                  )}
                >
                  Automático
                </button>
                {BIO_PARAMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setBioParam(p.id)}
                    title={p.hint}
                    className={classNames(
                      'flex-1 px-3 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-wide transition-all',
                      bioParam === p.id ? 'bg-brand-600 text-white border-brand-500' : 'bg-white text-ink-400 border-ink-100 hover:bg-ink-50'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ink-400 font-medium ml-1">
                Automático escolhe pelo trimestre: CCN (1º) · DBP (2º) · CC (3º). Fórmulas: Hadlock 1992 (CCN) e Hadlock 1984 (DBP/CC).
              </p>
            </div>
          </>
        )}
      </div>

      {value?.currentGa ? (
        <div className="flex flex-col gap-4">
          <ResultCard label={`Idade Gestacional Atual${value.sourceLabel ? ` (${value.sourceLabel})` : ''}`} value={value.currentGa} variant="brand" />
          <ResultCard label="Data Provável do Parto" value={value.edd} variant="emerald" />
          {value.comparison?.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-ink-50/60 px-4 py-3 space-y-1">
              <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Comparação entre métodos</div>
              {value.comparison.map((c: string) => (
                <div key={c} className="text-[11px] font-bold text-ink-600">{c}</div>
              ))}
              <p className="text-[9px] text-ink-400 font-medium pt-1">
                Divergência relevante → revisar a datação antes de laudar percentis e riscos.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 border-2 border-dashed border-ink-100 rounded-2xl text-center space-y-3">
          <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto text-ink-200 animate-pulse">
            <Clock size={32} />
          </div>
          <p className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Aguardando dados cronológicos</p>
        </div>
      )}
    </div>
  );
}
