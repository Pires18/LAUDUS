import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { classNames } from '../../../utils/format';
import {
  UA_REF, MCA_REF, UTA_REF, DV_REF, DOPPLER_GA_MIN, DOPPLER_GA_MAX,
  getRef, getCprRef, zToPercentile as zToP,
} from '../constants/fetalReferences';

export function DopplerCalculator({ value, onChange }: CalculatorProps) {
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [auPi, setAuPi] = useState(value?.auPi || '');
  const [acmPi, setAcmPi] = useState(value?.acmPi || '');
  const [utaPi, setUtaPi] = useState(value?.utaPi || '');
  const [dvPi, setDvPi] = useState(value?.dvPi || '');
  const [auFlow, setAuFlow] = useState<'normal'|'aedf'|'redf'>(value?.auFlow || 'normal');
  const [dvWave, setDvWave] = useState<'not_evaluated'|'normal'|'rav'>(value?.dvWave || 'not_evaluated');
  const [efwPercentile, setEfwPercentile] = useState(value?.efwPercentile || '');

  const gaDecimal = Number(gaWeeks||0)+(Number(gaDays||0)/7);

  const calc = useMemo(() => {
    let rcp: number|null = null;
    let rcpP: number|null = null;
    let auP: number|null = null, acmP: number|null = null, utaP: number|null = null, dvP: number|null = null;

    if (auPi && gaDecimal>=DOPPLER_GA_MIN && gaDecimal<=DOPPLER_GA_MAX) { const [m,s]=getRef(UA_REF,gaDecimal); auP=zToP((Number(auPi)-m)/s); }
    if (acmPi && gaDecimal>=DOPPLER_GA_MIN && gaDecimal<=DOPPLER_GA_MAX) { const [m,s]=getRef(MCA_REF,gaDecimal); acmP=zToP((Number(acmPi)-m)/s); }
    if (utaPi && gaDecimal>=DOPPLER_GA_MIN && gaDecimal<=DOPPLER_GA_MAX) { const [m,s]=getRef(UTA_REF,gaDecimal); utaP=zToP((Number(utaPi)-m)/s); }
    if (dvPi && gaDecimal>=DOPPLER_GA_MIN && gaDecimal<=DOPPLER_GA_MAX) { const [m,s]=getRef(DV_REF,gaDecimal); dvP=zToP((Number(dvPi)-m)/s); }
    
    if (auPi && acmPi && gaDecimal>=DOPPLER_GA_MIN && gaDecimal<=DOPPLER_GA_MAX) { 
      rcp = Number(acmPi)/Number(auPi);
      const [m,s] = getCprRef(gaDecimal);
      rcpP = zToP((rcp-m)/s);
    } else if (auPi && acmPi) {
      rcp = Number(acmPi)/Number(auPi);
    }

    // Estadiamento Gratacós (Barcelona 2014) — pode ser determinado SEM RCP
    let stage=0, stageDesc='Normal', rec='Seguimento habitual conforme protocolo.';
    if (dvWave==='rav') {
      stage=4; stageDesc='ESTÁGIO IV';
      rec='Onda "a" reversa no DV. Morte fetal iminente — parto imediato se viabilidade.';
    } else if (auFlow==='redf' || (dvP !== null && dvP > 95)) {
      stage=3; stageDesc='ESTÁGIO III';
      rec='Diástole reversa na AU (REDF) ou DV > p95. Risco de acidose. Internação. Parto em 24-48h.';
    } else if (auFlow==='aedf') {
      stage=2; stageDesc='ESTÁGIO II';
      rec='Diástole zero na AU (AEDF). Insuf. placentária grave. Monitoramento 2-3×/semana.';
    } else if (
      (efwPercentile && Number(efwPercentile)<3) ||
      (auP!==null && auP>95) ||
      (rcpP!==null && rcpP<5) ||
      (acmP!==null && acmP<5)
    ) {
      stage=1; stageDesc='ESTÁGIO I';
      rec='Insuf. placentária leve (AU >p95, RCP <p5, ACM <p5 ou PFE <p3). Monitoramento semanal. Parto ≥ 37s.';
    }

    return { rcp, rcpP, auP, acmP, utaP, dvP, stage, stageDesc, rec };
  }, [auPi,acmPi,utaPi,dvPi,auFlow,dvWave,efwPercentile,gaDecimal]);

  // Determina se há dados suficientes para exibir resultado
  const hasData = !!(auPi || acmPi || utaPi || efwPercentile || auFlow !== 'normal' || dvWave !== 'not_evaluated');

  useEffect(() => {
    const parts: string[] = [];
    if (gaWeeks) parts.push(`IG: ${gaWeeks}s ${gaDays||0}d`);
    if (calc.auP !== null) parts.push(`AU PI: ${auPi} (p${calc.auP})`);
    if (calc.acmP !== null) parts.push(`ACM PI: ${acmPi} (p${calc.acmP})`);
    if (calc.utaP !== null) parts.push(`UtA PI: ${utaPi} (p${calc.utaP})`);
    if (calc.dvP !== null) parts.push(`DV PIV: ${dvPi} (p${calc.dvP})`);
    if (calc.rcp !== null) parts.push(`RCP: ${calc.rcp.toFixed(2)}${calc.rcpP !== null ? ` (p${calc.rcpP})` : ''}${calc.rcpP !== null && calc.rcpP < 5 ? ' (ALTERADA)' : ' (normal)'}`);
    if (auFlow !== 'normal') parts.push(`Diástole AU: ${auFlow === 'aedf' ? 'Zero (AEDF)' : 'Reversa (REDF)'}`);
    if (dvWave === 'rav') parts.push("DV: Onda 'a' Reversa");

    const summary = parts.length > 0
      ? `Doppler Barcelona (Gratacós): ${parts.join('. ')}. ${calc.stageDesc}.`
      : null;

    onChange({ gaWeeks, gaDays, auPi, acmPi, utaPi, dvPi, auFlow, dvWave, efwPercentile, ...calc, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaWeeks,gaDays,auPi,acmPi,utaPi,dvPi,auFlow,dvWave,efwPercentile,calc]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Doppler Fetal (Percentis)</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Estadiamento FGR — Barcelona (Gratacós)</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">IG (Sem)</label>
            <input type="number" className="input text-xs h-8" value={gaWeeks} onChange={e=>setGaWeeks(e.target.value)}/>
          </div>
          <div>
            <label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">Dias</label>
            <input type="number" min={0} max={6} className="input text-xs h-8" value={gaDays} onChange={e=>setGaDays(e.target.value)}/>
          </div>
          <div>
            <label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">PFE (p%)</label>
            <input type="number" className="input text-xs h-8" placeholder="ex: 8" value={efwPercentile} onChange={e=>setEfwPercentile(e.target.value)}/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DI label="AU PI" value={auPi} onChange={setAuPi} p={calc.auP} abnormal={calc.auP !== null && calc.auP > 95}/>
          <DI label="ACM PI" value={acmPi} onChange={setAcmPi} p={calc.acmP} abnormal={calc.acmP !== null && calc.acmP < 5}/>
          <DI label="UtA PI (médio)" value={utaPi} onChange={setUtaPi} p={calc.utaP} abnormal={calc.utaP !== null && calc.utaP > 95}/>
          <DI label="DV PIV" value={dvPi} onChange={setDvPi} p={calc.dvP} abnormal={calc.dvP !== null && calc.dvP > 95}/>
        </div>

        {calc.rcp !== null && (
          <div className={classNames(
            "flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-black",
            (calc.rcpP !== null && calc.rcpP < 5) || (calc.rcpP === null && calc.rcp < 1.0) ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          )}>
            <span className="text-[9px] font-bold uppercase">RCP (ACM/AU)</span>
            <span>{calc.rcp.toFixed(2)} — {(calc.rcpP !== null && calc.rcpP < 5) || (calc.rcpP === null && calc.rcp < 1.0) ? '⚠ ALTERADA' : 'Normal'}</span>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-ink-100">
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1 text-center">Fluxo Diastólico AU</label>
            <div className="flex gap-1">
              {[
                {id:'normal',l:'Presente',c:'bg-blue-600'},
                {id:'aedf',l:'Zero (AEDF)',c:'bg-orange-500'},
                {id:'redf',l:'Reverso (REDF)',c:'bg-red-600'}
              ].map(o=>
                <button key={o.id} onClick={()=>setAuFlow(o.id as any)}
                  className={classNames("flex-1 py-1.5 text-[8px] font-bold rounded border transition-all uppercase",
                    auFlow===o.id?`${o.c} text-white border-transparent shadow-sm`:"bg-white text-ink-500 border-ink-100"
                  )}>
                  {o.l}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1 text-center">Onda 'a' — Ducto Venoso</label>
            <div className="flex gap-1">
              {[
                {id:'not_evaluated',l:'Não Avaliada',c:'bg-ink-600'},
                {id:'normal',l:'Normal/Positiva',c:'bg-blue-600'},
                {id:'rav',l:'Reversa (RAV)',c:'bg-red-800'}
              ].map(o=>
                <button key={o.id} onClick={()=>setDvWave(o.id as any)}
                  className={classNames("flex-1 py-1.5 text-[8px] font-bold rounded border transition-all uppercase",
                    dvWave===o.id?`${o.c} text-white border-transparent shadow-sm`:"bg-white text-ink-500 border-ink-100"
                  )}>
                  {o.l}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resultado de estadiamento — mostra com qualquer dado relevante */}
        {hasData && (
          <div className={classNames(
            "rounded-xl p-3 border shadow-md",
            calc.stage===0 ? "bg-emerald-50 border-emerald-200"
            : calc.stage===1 ? "bg-blue-50 border-blue-200"
            : calc.stage===2 ? "bg-amber-50 border-amber-200"
            : calc.stage===3 ? "bg-orange-50 border-orange-200"
            : "bg-red-50 border-red-200"
          )}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-widest block mb-0.5 opacity-60">Estadiamento Barcelona (Gratacós)</span>
                <div className="text-lg font-black">{calc.stageDesc}</div>
              </div>
              {calc.rcp !== null && (
                <div className="text-right">
                  <span className="text-[8px] font-bold text-ink-500 uppercase block">RCP</span>
                  <span className="text-sm font-black">{calc.rcp.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="bg-white/80 p-2 rounded-lg text-[10px] font-medium flex gap-2">
              {calc.stage>=1
                ? <AlertTriangle size={14} className="shrink-0 text-amber-500"/>
                : <ShieldCheck size={14} className="shrink-0 text-emerald-500"/>}
              {calc.rec}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DI({ label, value, onChange, p, abnormal }: {
  label: string;
  value: any;
  onChange: (v:string)=>void;
  p: number|null;
  abnormal: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label>
      <input type="number" step="0.01" className="input text-center text-xs h-8 focus:border-blue-500" value={value} onChange={e=>onChange(e.target.value)}/>
      {p!==null && (
        <span className={classNames("text-[8px] font-bold block text-center mt-0.5", abnormal ? "text-red-600" : "text-emerald-600")}>
          p{p}{abnormal ? ' ⚠' : ''}
        </span>
      )}
    </div>
  );
}
