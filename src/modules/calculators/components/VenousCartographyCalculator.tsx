import { useState, useEffect } from 'react';
import { CalculatorProps } from '../registry';
import { Activity, Plus, Trash2, Printer } from 'lucide-react';
import { classNames } from '../../../utils/format';

interface Ceap {
  c: string; e: string; a: string; p: string;
}

interface Perforator {
  id: string;
  name: string;
  location: string;
  caliber: string;
}

interface VeinState {
  status: 'present' | 'safenectomy' | 'ablation' | 'none';
  ostium: 'normal' | 'reflux' | 'none';
  refluxPattern: 'absent' | 'total' | 'segmental' | 'tributary' | 'none';
  calibers: Record<string, string>;
}

interface LegState {
  ceap: Ceap;
  deepSystem: {
    status: 'normal' | 'reflux' | 'thrombosis_acute' | 'thrombosis_chronic' | 'none';
    details: string;
  };
  gsv: VeinState;
  ssv: VeinState;
  aasv: VeinState;
  pasv: VeinState;
  perforators: Perforator[];
  observations: string;
}

const defaultVein = (): VeinState => ({
  status: 'present',
  ostium: 'none',
  refluxPattern: 'none',
  calibers: {},
});

const defaultLegState = (): LegState => ({
  ceap: { c: 'none', e: 'none', a: 'none', p: 'none' },
  deepSystem: { status: 'none', details: '' },
  gsv: defaultVein(),
  ssv: defaultVein(),
  aasv: defaultVein(),
  pasv: defaultVein(),
  perforators: [],
  observations: '',
});

const CEAP_C = ['C0', 'C1', 'C2', 'C3', 'C4a', 'C4b', 'C4c', 'C5', 'C6'];
const CEAP_E = ['Ep', 'Es', 'Ec', 'En'];
const CEAP_A = ['As', 'Ap', 'Ad', 'An'];
const CEAP_P = ['Pr', 'Po', 'Pr,o', 'Pn'];

export function VenousCartographyCalculator({ value, onChange }: CalculatorProps) {
  const [activeTab, setActiveTab] = useState<'MID' | 'MIE'>('MID');
  const [mid, setMid] = useState<LegState>(value?.mid || defaultLegState());
  const [mie, setMie] = useState<LegState>(value?.mie || defaultLegState());
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    const formatVeinSummary = (v: VeinState, name: string, calLabels: Record<string, string>) => {
      if (v.status === 'none' && v.ostium === 'none' && v.refluxPattern === 'none' && Object.keys(v.calibers).length === 0) return null;
      
      let txt = `- ${name}:`;
      if (v.status === 'safenectomy') return `${txt} Ausente (Safenectomia).`;
      if (v.status === 'ablation') return `${txt} Fibrosada (Pós-termoablação).`;

      if (v.ostium !== 'none') txt += ` Óstio ${v.ostium === 'normal' ? 'competente' : 'incompetente'}.`;
      if (v.refluxPattern !== 'none') {
        const refMap = { absent: 'Sem refluxo', total: 'Refluxo total', segmental: 'Refluxo segmentar', tributary: 'Refluxo em tributária' };
        txt += ` ${refMap[v.refluxPattern]}.`;
      }
      const cParts = [];
      for (const [key, val] of Object.entries(v.calibers)) {
        if (val) cParts.push(`${calLabels[key] || key} ${val}mm`);
      }
      if (cParts.length > 0) txt += ` Calibres: ${cParts.join(', ')}.`;
      return txt;
    };

    const generateSummary = (legData: LegState, legName: string) => {
      const parts = [];
      
      // CEAP
      const { c, e, a, p } = legData.ceap;
      if (c !== 'none' || e !== 'none' || a !== 'none' || p !== 'none') {
        const ceapArr = [];
        if (c !== 'none') ceapArr.push(c);
        if (e !== 'none') ceapArr.push(e);
        if (a !== 'none') ceapArr.push(a);
        if (p !== 'none') ceapArr.push(p);
        parts.push(`- Classificação CEAP: ${ceapArr.join(', ')}`);
      }

      // Deep System
      if (legData.deepSystem.status !== 'none') {
        const statusMap = {
          normal: 'Pérvio e sem refluxo',
          reflux: 'Refluxo presente',
          thrombosis_acute: 'Trombose aguda',
          thrombosis_chronic: 'Trombose crônica'
        };
        let txt = `- Sistema Profundo: ${statusMap[legData.deepSystem.status]}.`;
        if (legData.deepSystem.details) txt += ` Detalhes: ${legData.deepSystem.details}.`;
        parts.push(txt);
      }

      // Veins
      const gsvTxt = formatVeinSummary(legData.gsv, 'Safena Magna', { jsf: 'JSF', thigh: 'Coxa', knee: 'Joelho', calf: 'Perna' });
      if (gsvTxt) parts.push(gsvTxt);

      const ssvTxt = formatVeinSummary(legData.ssv, 'Safena Parva', { jsp: 'JSP', calf: 'Perna' });
      if (ssvTxt) parts.push(ssvTxt);

      const aasvTxt = formatVeinSummary(legData.aasv, 'Safena Acessória Anterior', { jsf: 'JSF', thigh: 'Coxa' });
      if (aasvTxt) parts.push(aasvTxt);

      const pasvTxt = formatVeinSummary(legData.pasv, 'Safena Acessória Posterior', { jsp: 'JSP', calf: 'Perna' });
      if (pasvTxt) parts.push(pasvTxt);

      // Perforators
      if (legData.perforators.length > 0) {
        const perfStr = legData.perforators.map(perf => {
          let n = perf.name !== 'other' ? perf.name : '';
          let l = perf.location ? ` (${perf.location})` : '';
          return `${n}${l}: ${perf.caliber}mm`;
        }).join(' | ');
        parts.push(`- Perfurantes Incompetentes: ${perfStr}.`);
      }

      if (legData.observations) {
        parts.push(`- Observações: ${legData.observations}`);
      }

      if (parts.length === 0) return null;

      return `\n[${legName}]\n${parts.join('\n')}`;
    };

    const midSummary = generateSummary(mid, 'MEMBRO INFERIOR DIREITO');
    const mieSummary = generateSummary(mie, 'MEMBRO INFERIOR ESQUERDO');

    let finalSummary = null;
    if (midSummary || mieSummary) {
      finalSummary = `CARTOGRAFIA VENOSA - RESUMO ESTRUTURADO:${midSummary || ''}${mieSummary || ''}`;
    }

    onChange({ mid, mie, _summary: finalSummary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, mie]);

  const updateLeg = (leg: 'MID' | 'MIE', updater: (prev: LegState) => LegState) => {
    if (leg === 'MID') setMid(updater);
    else setMie(updater);
  };

  const addPerforator = (leg: 'MID' | 'MIE') => {
    updateLeg(leg, prev => ({
      ...prev,
      perforators: [...prev.perforators, { id: Math.random().toString(), name: 'other', location: '', caliber: '' }]
    }));
  };

  const removePerforator = (leg: 'MID' | 'MIE', id: string) => {
    updateLeg(leg, prev => ({
      ...prev,
      perforators: prev.perforators.filter(p => p.id !== id)
    }));
  };

  const renderVeinUI = (legType: 'MID'|'MIE', legData: LegState, veinKey: 'gsv'|'ssv'|'aasv'|'pasv', title: string, colorClass: string, caliberFields: {id: string, label: string}[], hasOstium: boolean) => {
    const data = legData[veinKey];
    
    return (
      <div className={`border border-ink-200 rounded-md p-3 ${colorClass}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-bold text-ink-900 uppercase">{title}</h4>
          <select 
            className="input text-[9px] h-6 py-0 px-1 bg-white border-ink-300 w-28"
            value={data.status}
            onChange={e => updateLeg(legType, p => ({ ...p, [veinKey]: { ...p[veinKey], status: e.target.value as any } }))}
          >
            <option value="present">Presente</option>
            <option value="safenectomy">Safenectomia</option>
            <option value="ablation">Termoablação</option>
          </select>
        </div>

        {data.status === 'present' && (
          <>
            <div className="flex gap-2 mb-2">
              {hasOstium && (
                <div className="flex-1">
                  <select 
                    className="input text-xs w-full"
                    value={data.ostium}
                    onChange={e => updateLeg(legType, p => ({ ...p, [veinKey]: { ...p[veinKey], ostium: e.target.value as any } }))}
                  >
                    <option value="none">Óstio...</option>
                    <option value="normal">Competente</option>
                    <option value="reflux">Incompetente</option>
                  </select>
                </div>
              )}
              <div className="flex-1">
                <select 
                  className={classNames("input text-xs w-full", data.refluxPattern !== 'none' && data.refluxPattern !== 'absent' ? 'bg-red-50 text-red-700 border-red-300' : '')}
                  value={data.refluxPattern}
                  onChange={e => updateLeg(legType, p => ({ ...p, [veinKey]: { ...p[veinKey], refluxPattern: e.target.value as any } }))}
                >
                  <option value="none">Refluxo...</option>
                  <option value="absent">Ausente</option>
                  <option value="total">Total</option>
                  <option value="segmental">Segmentar</option>
                  <option value="tributary">Tributária</option>
                </select>
              </div>
            </div>

            <div className="bg-white/50 rounded border border-ink-100 p-1.5 flex gap-1 items-center">
              <span className="text-[8px] font-bold text-ink-400 uppercase w-14">Calibre (mm)</span>
              {caliberFields.map(f => (
                <input 
                  key={f.id}
                  type="number" 
                  placeholder={f.label} 
                  className="input text-xs text-center px-1 flex-1 h-7" 
                  value={data.calibers[f.id] || ''} 
                  onChange={e => updateLeg(legType, p => ({ ...p, [veinKey]: { ...p[veinKey], calibers: { ...p[veinKey].calibers, [f.id]: e.target.value } } }))} 
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderLegForm = (legType: 'MID' | 'MIE') => {
    const data = legType === 'MID' ? mid : mie;
    
    return (
      <div className="space-y-4">
        {/* CEAP */}
        <div className="border border-ink-200 rounded-md p-3 bg-ink-50">
          <h4 className="text-[10px] font-bold text-ink-900 uppercase mb-2">Classificação CEAP</h4>
          <div className="grid grid-cols-4 gap-1">
            <select className="input text-[10px] px-1 h-7 text-center" value={data.ceap.c} onChange={e => updateLeg(legType, p => ({ ...p, ceap: { ...p.ceap, c: e.target.value } }))}>
              <option value="none">C...</option>{CEAP_C.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="input text-[10px] px-1 h-7 text-center" value={data.ceap.e} onChange={e => updateLeg(legType, p => ({ ...p, ceap: { ...p.ceap, e: e.target.value } }))}>
              <option value="none">E...</option>{CEAP_E.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="input text-[10px] px-1 h-7 text-center" value={data.ceap.a} onChange={e => updateLeg(legType, p => ({ ...p, ceap: { ...p.ceap, a: e.target.value } }))}>
              <option value="none">A...</option>{CEAP_A.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="input text-[10px] px-1 h-7 text-center" value={data.ceap.p} onChange={e => updateLeg(legType, p => ({ ...p, ceap: { ...p.ceap, p: e.target.value } }))}>
              <option value="none">P...</option>{CEAP_P.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Sistema Profundo */}
        <div className="border border-ink-200 rounded-md p-3">
          <h4 className="text-[10px] font-bold text-ink-900 uppercase mb-2">Sistema Venoso Profundo</h4>
          <select 
            className={classNames("input text-xs w-full mb-2", data.deepSystem.status !== 'normal' && data.deepSystem.status !== 'none' ? 'bg-red-50 text-red-700 border-red-300' : '')}
            value={data.deepSystem.status}
            onChange={e => updateLeg(legType, p => ({ ...p, deepSystem: { ...p.deepSystem, status: e.target.value as any } }))}
          >
            <option value="none">Selecione o status...</option>
            <option value="normal">Pérvio e sem refluxo</option>
            <option value="reflux">Refluxo presente</option>
            <option value="thrombosis_acute">Trombose Aguda (TVP)</option>
            <option value="thrombosis_chronic">Trombose Crônica</option>
          </select>
          {data.deepSystem.status !== 'normal' && data.deepSystem.status !== 'none' && (
            <input 
              type="text" 
              placeholder="Detalhes (veias acometidas...)"
              className="input text-xs w-full"
              value={data.deepSystem.details}
              onChange={e => updateLeg(legType, p => ({ ...p, deepSystem: { ...p.deepSystem, details: e.target.value } }))}
            />
          )}
        </div>

        {/* Superficial Systems */}
        {renderVeinUI(legType, data, 'gsv', 'Veia Safena Magna', 'bg-blue-50/50', [{id: 'jsf', label: 'JSF'}, {id: 'thigh', label: 'Coxa'}, {id: 'knee', label: 'Joel'}, {id: 'calf', label: 'Pern'}], true)}
        {renderVeinUI(legType, data, 'aasv', 'Safena Acessória Anterior', 'bg-blue-50/20', [{id: 'jsf', label: 'JSF/Origem'}, {id: 'thigh', label: 'Coxa'}], false)}
        
        {renderVeinUI(legType, data, 'ssv', 'Veia Safena Parva', 'bg-purple-50/50', [{id: 'jsp', label: 'JSP'}, {id: 'calf', label: 'Perna'}], true)}
        {renderVeinUI(legType, data, 'pasv', 'Safena Acessória Posterior', 'bg-purple-50/20', [{id: 'origin', label: 'Origem'}, {id: 'calf', label: 'Perna'}], false)}

        {/* Perfurantes */}
        <div className="border border-ink-200 rounded-md p-3 bg-amber-50/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold text-ink-900 uppercase">Perfurantes Incompetentes</h4>
            <button onClick={() => addPerforator(legType)} className="p-1 hover:bg-ink-100 rounded text-blue-600"><Plus size={14} /></button>
          </div>
          {data.perforators.length === 0 ? (
            <div className="text-[10px] text-ink-400 italic">Nenhuma perfurante adicionada.</div>
          ) : (
            <div className="space-y-2">
              {data.perforators.map(perf => (
                <div key={perf.id} className="flex gap-1 items-center">
                  <select 
                    className="input text-[10px] w-20 px-1"
                    value={perf.name}
                    onChange={e => updateLeg(legType, p => ({ ...p, perforators: p.perforators.map(x => x.id === perf.id ? { ...x, name: e.target.value } : x) }))}
                  >
                    <option value="other">Outra...</option>
                    <option value="Hunter">Hunter</option>
                    <option value="Dodd">Dodd</option>
                    <option value="Boyd">Boyd</option>
                    <option value="Cockett">Cockett</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Local específico" 
                    className="input text-[10px] flex-1 px-1"
                    value={perf.location}
                    onChange={e => updateLeg(legType, p => ({ ...p, perforators: p.perforators.map(x => x.id === perf.id ? { ...x, location: e.target.value } : x) }))}
                  />
                  <div className="flex items-center w-16">
                    <input 
                      type="number" 
                      placeholder="mm" 
                      className="input text-[10px] w-full text-center px-1"
                      value={perf.caliber}
                      onChange={e => updateLeg(legType, p => ({ ...p, perforators: p.perforators.map(x => x.id === perf.id ? { ...x, caliber: e.target.value } : x) }))}
                    />
                  </div>
                  <button onClick={() => removePerforator(legType, perf.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <textarea 
            placeholder="Observações adicionais (varizes tributárias, flebite, etc)..."
            className="input text-xs w-full min-h-[60px] resize-y"
            value={data.observations}
            onChange={e => updateLeg(legType, p => ({ ...p, observations: e.target.value }))}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-ink-50 px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={14} className="text-blue-600" />
          <h3 className="font-bold text-ink-900 text-[11px] uppercase tracking-wider">Cartografia Venosa (PRO)</h3>
        </div>
        <button 
          onClick={() => setShowPrintModal(true)}
          className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-transparent hover:border-blue-200 flex items-center gap-1 transition-colors"
          title="Ver Resumo Estruturado"
        >
          <Printer size={12} />
          <span>Resumo</span>
        </button>
      </div>

      <div className="border-b border-ink-100 flex">
        <button 
          onClick={() => setActiveTab('MID')}
          className={classNames("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", activeTab === 'MID' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-ink-50 text-ink-400 hover:bg-ink-100')}
        >
          Membro Direito (MID)
        </button>
        <button 
          onClick={() => setActiveTab('MIE')}
          className={classNames("flex-1 py-2 text-[10px] font-bold uppercase transition-colors", activeTab === 'MIE' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-ink-50 text-ink-400 hover:bg-ink-100')}
        >
          Membro Esquerdo (MIE)
        </button>
      </div>

      <div className="p-3">
        {renderLegForm(activeTab)}
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg flex items-center gap-2"><Printer size={18}/> Resumo de Cartografia Venosa</h2>
              <button onClick={() => setShowPrintModal(false)} className="text-ink-400 hover:text-ink-900 text-sm font-bold">FECHAR</button>
            </div>
            <div className="p-6 overflow-y-auto bg-ink-50 font-mono text-sm whitespace-pre-wrap flex-1">
              {value?._summary || 'Nenhum dado preenchido ainda.'}
            </div>
            <div className="p-4 border-t bg-white flex justify-end">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(value?._summary || '');
                }}
                className="btn btn-primary text-sm"
              >
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
