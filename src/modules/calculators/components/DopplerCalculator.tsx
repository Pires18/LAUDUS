import { useState, useEffect, useMemo } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { classNames } from '../../../utils/format';

// Arduini & Rizzo 1990 UA PI
const UA_REF: Record<number,[number,number]> = {
  20:[1.54,0.37],22:[1.41,0.32],24:[1.30,0.28],26:[1.20,0.25],28:[1.12,0.23],30:[1.05,0.21],
  32:[0.99,0.19],34:[0.94,0.18],36:[0.90,0.17],38:[0.87,0.17],40:[0.85,0.16]
};
const MCA_REF: Record<number,[number,number]> = {
  20:[1.60,0.30],22:[1.65,0.32],24:[1.71,0.33],26:[1.77,0.34],28:[1.82,0.35],30:[1.84,0.36],
  32:[1.83,0.36],34:[1.79,0.35],36:[1.71,0.34],38:[1.60,0.32],40:[1.45,0.29]
};
const UTA_REF: Record<number,[number,number]> = {
  20:[1.20,0.32],22:[1.12,0.30],24:[1.04,0.28],26:[0.98,0.26],28:[0.92,0.25],30:[0.87,0.24],
  32:[0.83,0.23],34:[0.79,0.22],36:[0.76,0.21],38:[0.73,0.20],40:[0.71,0.20]
};

function erf(x: number) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const s=x<0?-1:1; x=Math.abs(x);
  const t=1/(1+p*x);
  return s*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
}
function zToP(z: number) { return Math.max(1,Math.min(99,Math.round(50*(1+erf(z/Math.sqrt(2)))))); }
function getRef(table: Record<number,[number,number]>, ga: number): [number,number] {
  const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
  if (ga<=keys[0]) return table[keys[0]];
  if (ga>=keys[keys.length-1]) return table[keys[keys.length-1]];
  const lo=keys.filter(k=>k<=ga).pop()!;
  const hi=keys.filter(k=>k>ga).shift()!;
  const f=(ga-lo)/(hi-lo);
  return [table[lo][0]+(table[hi][0]-table[lo][0])*f, table[lo][1]+(table[hi][1]-table[lo][1])*f];
}

export function DopplerCalculator({ value, onChange }: CalculatorProps) {
  const [gaWeeks, setGaWeeks] = useState(value?.gaWeeks || '');
  const [gaDays, setGaDays] = useState(value?.gaDays || '0');
  const [auPi, setAuPi] = useState(value?.auPi || '');
  const [acmPi, setAcmPi] = useState(value?.acmPi || '');
  const [utaPi, setUtaPi] = useState(value?.utaPi || '');
  const [dvPi, setDvPi] = useState(value?.dvPi || '');
  const [auFlow, setAuFlow] = useState<'normal'|'aedf'|'redf'>(value?.auFlow || 'normal');
  const [dvWave, setDvWave] = useState<'normal'|'rav'>(value?.dvWave || 'normal');
  const [efwPercentile, setEfwPercentile] = useState(value?.efwPercentile || '');

  const ga = Math.round(Number(gaWeeks||0)+(Number(gaDays||0)/7));

  const calc = useMemo(() => {
    let rcp: number|null = null;
    let auP: number|null = null, acmP: number|null = null, utaP: number|null = null;
    if (auPi && ga>=20 && ga<=40) { const [m,s]=getRef(UA_REF,ga); auP=zToP((Number(auPi)-m)/s); }
    if (acmPi && ga>=20 && ga<=40) { const [m,s]=getRef(MCA_REF,ga); acmP=zToP((Number(acmPi)-m)/s); }
    if (utaPi && ga>=20 && ga<=40) { const [m,s]=getRef(UTA_REF,ga); utaP=zToP((Number(utaPi)-m)/s); }
    if (auPi && acmPi) rcp = Number(acmPi)/Number(auPi);

    let stage=0, stageDesc='Normal', rec='Seguimento habitual.';
    if (dvWave==='rav') { stage=4; stageDesc='ESTÁGIO IV'; rec='Morte fetal iminente. Parto imediato.'; }
    else if (auFlow==='redf') { stage=3; stageDesc='ESTÁGIO III'; rec='Acidose fetal. Internação. Parto 24-48h.'; }
    else if (auFlow==='aedf') { stage=2; stageDesc='ESTÁGIO II'; rec='Insuf. placentária grave. Monitor 2-3x/sem.'; }
    else if ((efwPercentile && Number(efwPercentile)<3) || (auP!==null && auP>95) || (rcp!==null && rcp<1.0)) { stage=1; stageDesc='ESTÁGIO I'; rec='Insuf. placentária leve. Monitor semanal.'; }
    return { rcp, auP, acmP, utaP, stage, stageDesc, rec };
  }, [auPi,acmPi,utaPi,dvPi,auFlow,dvWave,efwPercentile,ga]);

  useEffect(() => {
    const summary = calc.rcp ? `Doppler Barcelona: AU p${calc.auP||'?'}, ACM p${calc.acmP||'?'}, RCP ${calc.rcp.toFixed(2)}. ${calc.stageDesc}.` : null;
    onChange({ gaWeeks, gaDays, auPi, acmPi, utaPi, dvPi, auFlow, dvWave, efwPercentile, ...calc, _summary: summary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaWeeks,gaDays,auPi,acmPi,utaPi,dvPi,auFlow,dvWave,efwPercentile,calc]);

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5"><Activity size={14} className="text-blue-600"/><h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Doppler Barcelona (Gratacós)</h3></div>
        <div className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">FGR Staging</div>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">IG (Sem)</label><input type="number" className="input text-xs h-8" value={gaWeeks} onChange={e=>setGaWeeks(e.target.value)}/></div>
          <div><label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">Dias</label><input type="number" className="input text-xs h-8" value={gaDays} onChange={e=>setGaDays(e.target.value)}/></div>
          <div><label className="text-[8px] font-bold text-ink-500 uppercase block mb-1">Peso (p%)</label><input type="number" className="input text-xs h-8" value={efwPercentile} onChange={e=>setEfwPercentile(e.target.value)}/></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DI label="AU PI" value={auPi} onChange={setAuPi} p={calc.auP}/>
          <DI label="ACM PI" value={acmPi} onChange={setAcmPi} p={calc.acmP}/>
          <DI label="UtA PI (Médio)" value={utaPi} onChange={setUtaPi} p={calc.utaP}/>
          <DI label="DV PIV" value={dvPi} onChange={setDvPi} p={null}/>
        </div>
        <div className="space-y-2 pt-2 border-t border-ink-100">
          <div><label className="text-[9px] font-bold text-ink-500 uppercase block mb-1 text-center">Fluxo Diastólico AU</label>
            <div className="flex gap-1">
              {[{id:'normal',l:'Presente',c:'bg-blue-600'},{id:'aedf',l:'Zero (AEDF)',c:'bg-orange-500'},{id:'redf',l:'Reverso (REDF)',c:'bg-red-600'}].map(o=>
                <button key={o.id} onClick={()=>setAuFlow(o.id as any)} className={classNames("flex-1 py-1.5 text-[8px] font-bold rounded border transition-all uppercase",auFlow===o.id?`${o.c} text-white border-transparent shadow-sm`:"bg-white text-ink-500 border-ink-100")}>{o.l}</button>
              )}
            </div>
          </div>
          <div><label className="text-[9px] font-bold text-ink-500 uppercase block mb-1 text-center">Onda 'a' Ducto Venoso</label>
            <div className="flex gap-1">
              {[{id:'normal',l:'Normal/Positiva',c:'bg-blue-600'},{id:'rav',l:'Reversa (RAV)',c:'bg-red-800'}].map(o=>
                <button key={o.id} onClick={()=>setDvWave(o.id as any)} className={classNames("flex-1 py-1.5 text-[8px] font-bold rounded border transition-all uppercase",dvWave===o.id?`${o.c} text-white border-transparent shadow-sm`:"bg-white text-ink-500 border-ink-100")}>{o.l}</button>
              )}
            </div>
          </div>
        </div>
        {calc.rcp !== null && (
          <div className={classNames("rounded-xl p-3 border shadow-md",calc.stage===0?"bg-emerald-50 border-emerald-200":calc.stage<=2?"bg-amber-50 border-amber-200":"bg-red-50 border-red-200")}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-widest block mb-0.5 opacity-60">Estágio Gratacós</span>
                <div className="text-lg font-black">{calc.stageDesc}</div>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold text-ink-500 uppercase block">RCP</span>
                <span className="text-sm font-black">{calc.rcp.toFixed(2)}</span>
              </div>
            </div>
            <div className="bg-white/80 p-2 rounded-lg text-[10px] font-medium flex gap-2">
              {calc.stage>=1?<AlertTriangle size={14} className="shrink-0 text-amber-500"/>:<ShieldCheck size={14} className="shrink-0 text-emerald-500"/>}
              {calc.rec}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DI({ label, value, onChange, p }: { label:string, value:any, onChange:(v:string)=>void, p:number|null }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-ink-500 uppercase block mb-1">{label}</label>
      <input type="number" step="0.01" className="input text-center text-xs h-8 focus:border-blue-500" value={value} onChange={e=>onChange(e.target.value)}/>
      {p!==null && <span className={classNames("text-[8px] font-bold block text-center mt-0.5",p>95||p<5?"text-red-600":"text-emerald-600")}>p{p}</span>}
    </div>
  );
}
