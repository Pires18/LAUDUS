import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, AlertTriangle, ShieldCheck, ChevronRight, ChevronLeft, BarChart3, Baby } from 'lucide-react';
import { classNames } from '../../../utils/format';
import {
  UA_REF, MCA_REF, UTA_REF, DV_REF, DOPPLER_GA_MIN, DOPPLER_GA_MAX,
  getRef, getCprRef, getWhoPercentile, zToPercentile, calcHadlockEfw,
  type WHODimension,
} from '../constants/fetalReferences';

type Step = 'ga' | 'biometry' | 'doppler' | 'result';
type Sex = 'male' | 'female' | 'unknown';

export function BarcelonaFetalGrowthCalculator({ value, onChange }: CalculatorProps) {
  const [step, setStep] = useState<Step>('ga');
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [sex, setSex] = useState<Sex>(value?.sex || 'unknown');
  const [bpd, setBpd] = useState(value?.bpd || '');
  const [hc, setHc] = useState(value?.hc || '');
  const [ac, setAc] = useState(value?.ac || '');
  const [fl, setFl] = useState(value?.fl || '');
  const [hl, setHl] = useState(value?.hl || '');
  
  const [auPi, setAuPi] = useState(value?.auPi || '');
  const [acmPi, setAcmPi] = useState(value?.acmPi || '');
  const [utaPi, setUtaPi] = useState(value?.utaPi || '');
  const [dvPi, setDvPi] = useState(value?.dvPi || '');
  const [auFlow, setAuFlow] = useState<'normal'|'aedf'|'redf'>(value?.auFlow || 'normal');
  const [dvWave, setDvWave] = useState<'not_evaluated'|'normal'|'rav'>(value?.dvWave || 'not_evaluated');

  const gaDecimal = useMemo(() => Number(gaWeeks||0)+(Number(gaDays||0)/7), [gaWeeks, gaDays]);

  // Calculations
  const calc = useMemo(() => {
    let efw: number|null = null;
    let efwP: number|null = null;
    let auP: number|null = null;
    let acmP: number|null = null;
    let utaP: number|null = null;
    let dvP: number|null = null;
    let rcp: number|null = null;
    let rcpP: number|null = null;

    let bpdP: number|null = null;
    let hcP: number|null = null;
    let acP: number|null = null;
    let flP: number|null = null;
    let hlP: number|null = null;

    if (gaDecimal > 0) {
      if (bpd) bpdP = getWhoPercentile('BPD', gaDecimal, Number(bpd));
      if (hc) hcP = getWhoPercentile('HC', gaDecimal, Number(hc));
      if (ac) acP = getWhoPercentile('AC', gaDecimal, Number(ac));
      if (fl) flP = getWhoPercentile('FL', gaDecimal, Number(fl));
      if (hl) hlP = getWhoPercentile('HL', gaDecimal, Number(hl));
    }

    // Hadlock IV EFW
    if (bpd && hc && ac && fl) {
      efw = Math.round(calcHadlockEfw(Number(bpd), Number(hc), Number(ac), Number(fl)));
    }
    // WHO EFW Percentile
    if (efw && gaDecimal > 0) {
      let efwDim: WHODimension = 'EFW';
      if (sex === 'male') efwDim = 'EFW_M';
      if (sex === 'female') efwDim = 'EFW_F';
      efwP = getWhoPercentile(efwDim, gaDecimal, efw);
    }

    // Doppler percentiles
    if (auPi && gaDecimal >= DOPPLER_GA_MIN && gaDecimal <= DOPPLER_GA_MAX) {
      const [m,s] = getRef(UA_REF, gaDecimal);
      auP = zToPercentile((Number(auPi)-m)/s);
    }
    if (acmPi && gaDecimal >= DOPPLER_GA_MIN && gaDecimal <= DOPPLER_GA_MAX) {
      const [m,s] = getRef(MCA_REF, gaDecimal);
      acmP = zToPercentile((Number(acmPi)-m)/s);
    }
    if (utaPi && gaDecimal >= DOPPLER_GA_MIN && gaDecimal <= DOPPLER_GA_MAX) {
      const [m,s] = getRef(UTA_REF, gaDecimal);
      utaP = zToPercentile((Number(utaPi)-m)/s);
    }
    if (dvPi && gaDecimal >= DOPPLER_GA_MIN && gaDecimal <= DOPPLER_GA_MAX) {
      const [m,s] = getRef(DV_REF, gaDecimal);
      dvP = zToPercentile((Number(dvPi)-m)/s);
    }
    if (auPi && acmPi && gaDecimal >= DOPPLER_GA_MIN && gaDecimal <= DOPPLER_GA_MAX) {
      rcp = Number(acmPi)/Number(auPi);
      const [m,s] = getCprRef(gaDecimal);
      rcpP = zToPercentile((rcp-m)/s);
    } else if (auPi && acmPi) {
      rcp = Number(acmPi)/Number(auPi);
    }

    // Staging (Gratacós 2014)
    let stage = 0;
    if (dvWave === 'rav') stage = 4;
    else if (auFlow === 'redf' || (dvP !== null && dvP > 95)) stage = 3;
    else if (auFlow === 'aedf') stage = 2;
    else if ((efwP !== null && efwP < 3) || (auP !== null && auP > 95) || (acmP !== null && acmP < 5) || (rcpP !== null && rcpP < 5)) stage = 1;

    return { efw, efwP, auP, acmP, utaP, dvP, rcp, rcpP, stage, bpdP, hcP, acP, flP, hlP };
  }, [bpd,hc,ac,fl,hl,auPi,acmPi,utaPi,dvPi,auFlow,dvWave,gaWeeks,gaDays,gaDecimal]);

  useEffect(() => {
    const sexLabel = sex === 'male' ? 'Masculino' : sex === 'female' ? 'Feminino' : 'Indeterminado';
    const stageLabels = ['Normal','Estágio I','Estágio II','Estágio III','Estágio IV'];
    const lines = [`IG: ${gaWeeks||'?'}s ${gaDays||0}d | Sexo: ${sexLabel}`];
    
    if (calc.efw) lines.push(`Peso Estimado (Hadlock IV): ${calc.efw}g (OMS p${calc.efwP})`);
    if (calc.bpdP !== null) lines.push(`DBP: ${bpd}mm (OMS p${calc.bpdP})`);
    if (calc.hcP !== null) lines.push(`CC: ${hc}mm (OMS p${calc.hcP})`);
    if (calc.acP !== null) lines.push(`CA: ${ac}mm (OMS p${calc.acP})`);
    if (calc.flP !== null) lines.push(`CF: ${fl}mm (OMS p${calc.flP})`);
    if (calc.hlP !== null) lines.push(`Úmero: ${hl}mm (OMS p${calc.hlP})`);
    
    if (calc.rcp) lines.push(`RCP: ${calc.rcp.toFixed(2)}${calc.rcpP !== null ? ` (p${calc.rcpP})` : ''}`);
    if (calc.auP!==null) lines.push(`AU PI: ${auPi} (p${calc.auP})`);
    if (calc.acmP!==null) lines.push(`ACM PI: ${acmPi} (p${calc.acmP})`);
    if (calc.utaP!==null) lines.push(`UtA PI: ${utaPi} (p${calc.utaP})`);
    if (calc.dvP!==null) lines.push(`DV PIV: ${dvPi} (p${calc.dvP})`);
    if (auFlow !== 'normal') lines.push(`Diástole AU: ${auFlow === 'aedf' ? 'Zero (AEDF)' : 'Reversa (REDF)'}`);
    if (dvWave === 'rav') lines.push(`DV: Onda "a" reversa`);
    lines.push(`Classificação Fetal Growth: ${stageLabels[calc.stage]}`);

    onChange({
      gaWeeks, gaDays, sex, bpd, hc, ac, fl, hl, auPi, acmPi, utaPi, dvPi, auFlow, dvWave,
      ...calc,
      _summary: calc.efw || calc.rcp ? `Crescimento fetal (OMS + Doppler): ${lines.join('; ')}.` : null
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaWeeks,gaDays,sex,bpd,hc,ac,fl,hl,auPi,acmPi,utaPi,dvPi,auFlow,dvWave,calc]);

  // Classes estáticas (Tailwind não gera classes montadas por interpolação).
  const stageCardClasses = [
    'bg-emerald-50 border-emerald-200',
    'bg-blue-50 border-blue-200',
    'bg-amber-50 border-amber-200',
    'bg-orange-50 border-orange-200',
    'bg-red-50 border-red-200',
  ];
  const stageNames = ['Crescimento Normal','Estágio I','Estágio II','Estágio III','Estágio IV'];
  const stageDescs = [
    'Biometria e Doppler dentro dos padrões de normalidade. Seguimento habitual.',
    'Insuficiência placentária leve. AU PI > p95, RCP < p5, ACM < p5 ou Peso < p3. Monitoramento semanal. Parto ≥ 37s.',
    'Insuficiência placentária grave. AU com diástole zero (AEDF). Monitoramento 2-3x/semana. Parto ≥ 28-30s.',
    'Risco de acidose fetal. AU com diástole reversa (REDF) ou DV PI > p95. Internação. Parto em 48h se > 26s.',
    'Morte fetal iminente. DV onda "a" reversa. Parto IMEDIATO se viabilidade fetal.'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="font-black text-ink-900 uppercase tracking-widest text-sm">Crescimento Fetal</h3>
          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">Biometria OMS + Doppler Barcelona</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-ink-50 p-1.5 rounded-2xl border border-ink-100">
        {(['ga','biometry','doppler','result'] as Step[]).map((s, i) => (
          <StepDot key={s} active={step===s} num={i+1} label={['Datação','Biometria','Doppler','Laudo'][i]} onClick={() => setStep(s)} />
        ))}
      </div>

      <div>
        {step === 'ga' && (
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1.5">Idade Gestacional</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input type="number" className="input text-center text-lg font-black h-12" placeholder="Sem" value={gaWeeks} onChange={e => setGaWeeks(e.target.value)} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-ink-400">SEM</span>
                </div>
                <div className="relative">
                  <input type="number" min={0} max={6} className="input text-center text-lg font-black h-12" placeholder="Dias" value={gaDays} onChange={e => setGaDays(e.target.value)} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-ink-400">DIAS</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1.5">Sexo Fetal</label>
              <div className="flex gap-1">
                {([['male','Masculino','text-blue-600 bg-blue-50 border-blue-200'],['female','Feminino','text-pink-600 bg-pink-50 border-pink-200'],['unknown','Indeterminado','text-ink-500 bg-ink-50 border-ink-200']] as const).map(([id,l,c]) => (
                  <button key={id} onClick={() => setSex(id as Sex)} className={classNames("flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all flex items-center justify-center gap-1", sex===id ? c+' shadow-sm ring-1 ring-offset-1' : 'bg-white text-ink-400 border-ink-100')}>
                    <Baby size={12}/> {l}
                  </button>
                ))}
              </div>
            </div>
            <Btn onClick={() => setStep('biometry')} label="Próximo: Biometria (OMS)" icon={<ChevronRight size={14}/>} />
          </div>
        )}

        {step === 'biometry' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MI label="DBP (mm)" value={bpd} onChange={setBpd} />
                {calc.bpdP !== null && (
                  <span className={classNames("text-[8px] font-black block text-center mt-1 uppercase tracking-wider py-0.5 rounded border border-current/10", calc.bpdP < 10 || calc.bpdP > 90 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}>
                    OMS p{calc.bpdP}%
                  </span>
                )}
              </div>
              <div>
                <MI label="CC (mm)" value={hc} onChange={setHc} />
                {calc.hcP !== null && (
                  <span className={classNames("text-[8px] font-black block text-center mt-1 uppercase tracking-wider py-0.5 rounded border border-current/10", calc.hcP < 10 || calc.hcP > 90 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}>
                    OMS p{calc.hcP}%
                  </span>
                )}
              </div>
              <div>
                <MI label="CA (mm)" value={ac} onChange={setAc} />
                {calc.acP !== null && (
                  <span className={classNames("text-[8px] font-black block text-center mt-1 uppercase tracking-wider py-0.5 rounded border border-current/10", calc.acP < 10 || calc.acP > 90 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}>
                    OMS p{calc.acP}%
                  </span>
                )}
              </div>
              <div>
                <MI label="CF (mm)" value={fl} onChange={setFl} />
                {calc.flP !== null && (
                  <span className={classNames("text-[8px] font-black block text-center mt-1 uppercase tracking-wider py-0.5 rounded border border-current/10", calc.flP < 10 || calc.flP > 90 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}>
                    OMS p{calc.flP}%
                  </span>
                )}
              </div>
              <div className="col-span-2">
                <MI label="Úmero (mm)" value={hl} onChange={setHl} />
                {calc.hlP !== null && (
                  <span className={classNames("text-[8px] font-black block text-center mt-1 uppercase tracking-wider py-0.5 rounded border border-current/10", calc.hlP < 10 || calc.hlP > 90 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}>
                    OMS p{calc.hlP}%
                  </span>
                )}
              </div>
            </div>
            {calc.efw && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex justify-between items-center">
                <div><span className="text-[8px] font-bold text-indigo-500 uppercase block">Peso (Hadlock IV)</span><span className="text-xl font-black text-indigo-900">{calc.efw}g</span></div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-indigo-500 uppercase block">Percentil (OMS)</span>
                  <span className={classNames("text-xl font-black", calc.efwP!==null && calc.efwP<10 ? "text-red-600" : calc.efwP!==null && calc.efwP>90 ? "text-amber-600" : "text-indigo-900")}>{calc.efwP}%</span>
                  <span className="text-[8px] block font-bold">{calc.efwP!==null && calc.efwP<10?'PIG':calc.efwP!==null && calc.efwP>90?'GIG':'AIG'}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep('ga')} className="btn-secondary h-10 px-4"><ChevronLeft size={14}/></button>
              <Btn onClick={() => setStep('doppler')} label="Próximo: Doppler" icon={<ChevronRight size={14}/>} />
            </div>
          </div>
        )}

        {step === 'doppler' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DI label="AU PI" value={auPi} onChange={setAuPi} percentile={calc.auP} />
              <DI label="ACM PI" value={acmPi} onChange={setAcmPi} percentile={calc.acmP} />
              <DI label="UtA PI (Médio)" value={utaPi} onChange={setUtaPi} percentile={calc.utaP} />
              <DI label="DV PIV" value={dvPi} onChange={setDvPi} percentile={calc.dvP} />
            </div>
            {calc.rcp !== null && (
              <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-bold text-cyan-500 uppercase block">RCP (ACM/AU)</span>
                  <span className="text-sm font-black text-cyan-900">{calc.rcp.toFixed(2)}</span>
                  {calc.rcpP !== null && <span className="text-[8px] font-bold text-cyan-600 ml-1">(p{calc.rcpP})</span>}
                </div>
                <span className={classNames("text-[9px] font-bold px-2 py-0.5 rounded", (calc.rcpP !== null && calc.rcpP < 5) || (calc.rcpP === null && calc.rcp < 1) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>
                  {((calc.rcpP !== null && calc.rcpP < 5) || (calc.rcpP === null && calc.rcp < 1)) ? 'ALTERADA' : 'NORMAL'}
                </span>
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-ink-100">
              <label className="text-[9px] font-bold text-ink-500 uppercase block text-center">Achados Qualitativos Críticos</label>
              <div className="grid grid-cols-2 gap-2">
                <TG label="Diástole AU" opts={[{id:'normal',l:'Pres.'},{id:'aedf',l:'Zero'},{id:'redf',l:'Rev.'}]} val={auFlow} set={setAuFlow}/>
                <TG label="DV Onda 'a'" opts={[{id:'not_evaluated',l:'N/A'},{id:'normal',l:'Pos.'},{id:'rav',l:'Rev.'}]} val={dvWave} set={setDvWave}/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('biometry')} className="btn-secondary h-10 px-4"><ChevronLeft size={14}/></button>
              <Btn onClick={() => setStep('result')} label="Ver Resultado" icon={<BarChart3 size={14}/>} />
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-3">
            <div className={classNames("rounded-xl p-4 border shadow-sm", stageCardClasses[calc.stage])}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[8px] font-bold uppercase tracking-widest block opacity-60">Estadiamento de Crescimento</span>
                  <div className="text-2xl font-black">{stageNames[calc.stage]}</div>
                </div>
                {calc.efwP !== null && <div className="bg-white/60 px-2 py-1 rounded text-center"><span className="text-[7px] font-bold block">PESO (OMS)</span><span className="text-sm font-bold">{calc.efw}g (p{calc.efwP})</span></div>}
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg text-[10px] font-medium text-ink-900 border border-black/5 flex gap-2">
                {calc.stage>=1?<AlertTriangle size={16} className="text-amber-500 shrink-0"/>:<ShieldCheck size={16} className="text-emerald-500 shrink-0"/>}
                <div>{stageDescs[calc.stage]}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <RB label="IG" val={`${gaWeeks||'?'}s ${gaDays||0}d`}/>
              <RB label="Peso (OMS)" val={calc.efwP!==null?`p${calc.efwP}`:'-'}/>
              <RB label="AU PI" val={auPi?`${auPi} (p${calc.auP||'?'})`:'-'}/>
              <RB label="ACM PI" val={acmPi?`${acmPi} (p${calc.acmP||'?'})`:'-'}/>
              <RB label="UtA PI" val={utaPi?`${utaPi} (p${calc.utaP||'?'})`:'-'}/>
              <RB label="DV PIV" val={dvPi?`${dvPi} (p${calc.dvP||'?'})`:'-'}/>
              <RB label="RCP" val={calc.rcp?`${calc.rcp.toFixed(2)} ${calc.rcpP!==null?`(p${calc.rcpP})`:''}`:'-'}/>
              <RB label="Diástole AU" val={auFlow==='normal'?'Presente':auFlow==='aedf'?'Zero (AEDF)':'Reversa (REDF)'}/>
            </div>
            <div className="text-[7px] text-center text-ink-400 italic pt-1">Ref: OMS / Kiserud 2017 (Biometria/Peso), Hadlock (Peso g), Gratacós 2014 (Staging Doppler)</div>
            <button onClick={() => setStep('ga')} className="w-full text-blue-600 font-bold text-[10px] uppercase hover:underline">⟲ Reiniciar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, num, label, onClick }: { active:boolean, num:number, label:string, onClick:()=>void }) {
  return (
    <button onClick={onClick} className={classNames("flex-1 flex flex-col items-center gap-0.5 py-1 rounded-md transition-all",active?"bg-blue-600 text-white shadow-sm":"text-ink-400 hover:bg-ink-100")}>
      <span className={classNames("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",active?"bg-white/20":"bg-ink-100")}>{num}</span>
      <span className="text-[7px] font-bold uppercase tracking-tight">{label}</span>
    </button>
  );
}
function MI({ label, value, onChange }: { label:string, value:any, onChange:(v:string)=>void }) {
  return (<div><label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label><input type="number" className="input text-center text-xs h-9" value={value} onChange={e=>onChange(e.target.value)}/></div>);
}
function DI({ label, value, onChange, percentile }: { label:string, value:any, onChange:(v:string)=>void, percentile:number|null }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label>
      <input type="number" step="0.01" className="input text-center text-xs h-9" value={value} onChange={e=>onChange(e.target.value)}/>
      {percentile!==null && <span className={classNames("text-[8px] font-bold block text-center mt-0.5",percentile>95||percentile<5?"text-red-600":"text-emerald-600")}>Percentil {percentile}</span>}
    </div>
  );
}
function TG({ label, opts, val, set }: { label:string, opts:{id:string,l:string}[], val:string, set:(v:any)=>void }) {
  return (<div><span className="text-[8px] font-bold text-ink-400 uppercase block mb-1">{label}</span><div className="flex gap-0.5">{opts.map(o=><button key={o.id} onClick={()=>set(o.id)} className={classNames("flex-1 py-1 text-[8px] font-bold rounded border transition-all",val===o.id?"bg-blue-600 text-white border-transparent":"bg-white text-ink-500 border-ink-100")}>{o.l}</button>)}</div></div>);
}
function Btn({ onClick, label, icon }: { onClick:()=>void, label:string, icon:any }) {
  return <button onClick={onClick} className="flex-1 btn-primary h-10 flex items-center justify-center gap-1.5 text-[11px]">{label}{icon}</button>;
}
function RB({ label, val }: { label:string, val:string }) {
  return <div className="p-1.5 bg-ink-50 rounded border border-ink-100 flex justify-between"><span className="text-ink-500">{label}</span><span className="font-bold">{val}</span></div>;
}
