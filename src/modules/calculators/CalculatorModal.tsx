import { useState } from 'react';
import { X, Calculator, Send, Filter, ArrowLeft, Activity, Info, Zap, CheckCircle2, Sparkles } from 'lucide-react';
import { CALCULATORS } from './registry';
import { Modal } from '../../components/Modal';
import { ExamArea, EXAM_AREAS } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  area?: ExamArea;
  onClose: () => void;
  onSendToCopilot: (result: string) => void;
}

export function CalculatorModal({ area, onClose, onSendToCopilot }: Props) {
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);

  const filteredCalculators = CALCULATORS.filter(calc => 
    showAll || !area || calc.areas.includes(area)
  );

  const selectedCalc = CALCULATORS.find(c => c.id === selectedCalcId);
  const currentAreaMeta = EXAM_AREAS.find(a => a.id === area);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 lg:p-10">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-6xl h-full max-h-[900px] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20"
      >
        {/* Header with Mesh Gradient */}
        <div className="relative h-28 shrink-0 overflow-hidden bg-ink-900">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-transparent" />
          <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.1),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(37,99,235,0.1),transparent_50%)] animate-pulse" />
          
          <div className="relative h-full flex items-center justify-between px-10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl">
                 <Calculator size={32} className="text-brand-400" />
              </div>
              <div>
                 <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Calculadoras Clínicas</h2>
                    <span className="bg-brand-500/20 text-brand-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-brand-500/30 uppercase tracking-widest">v2.0</span>
                 </div>
                 <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.3em]">Módulos de Suporte à Decisão Diagnóstica</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          {!selectedCalcId ? (
            <div className="flex-1 flex flex-col min-h-0 bg-ink-50/20">
              {/* Filter Bar */}
              <div className="px-10 py-5 bg-white border-b border-ink-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                     <Filter size={16} className="text-brand-600" />
                     <span className="text-[11px] font-black text-ink-900 uppercase tracking-widest">Filtragem Ativa:</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={classNames(
                       "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2",
                       !showAll ? "bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/20" : "bg-ink-100 text-ink-400 border-ink-100"
                     )} onClick={() => setShowAll(false)}>
                        Sugestões ({area || 'Geral'})
                     </span>
                     <span className={classNames(
                       "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2",
                       showAll ? "bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/20" : "bg-ink-100 text-ink-400 border-ink-100"
                     )} onClick={() => setShowAll(true)}>
                        Todas as Ferramentas
                     </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-ink-300 uppercase tracking-widest">
                   <Sparkles size={14} className="text-amber-500" /> 
                   Destaque Técnico
                </div>
              </div>
              
              {/* List */}
              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar">
                {filteredCalculators.map(calc => (
                  <motion.button
                    whileHover={{ y: -5 }}
                    key={calc.id}
                    onClick={() => setSelectedCalcId(calc.id)}
                    className="group flex flex-col text-left p-8 rounded-[2.5rem] border-2 border-white bg-white hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/10 transition-all relative overflow-hidden shadow-sm"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-ink-50 text-ink-400 flex items-center justify-center mb-6 group-hover:bg-brand-500 group-hover:text-white transition-all shadow-inner">
                      <AreaIcon area={area || calc.areas[0]} size={28} />
                    </div>
                    <h4 className="font-black text-ink-900 text-lg mb-2 group-hover:text-brand-700 transition-colors uppercase tracking-tight">{calc.name}</h4>
                    <p className="text-xs text-ink-500 leading-relaxed font-medium line-clamp-3">{calc.description}</p>
                    
                    <div className="mt-auto pt-6 flex items-center justify-between">
                       <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Abrir Módulo</span>
                       <div className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center text-ink-300 group-hover:bg-brand-500 group-hover:text-white transition-all">
                          <ArrowLeft size={16} className="rotate-180" />
                       </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-ink-50/10">
              {/* Back Bar */}
              <div className="px-10 py-5 bg-white border-b border-ink-100 flex items-center justify-between shrink-0">
                <button 
                  onClick={() => { setSelectedCalcId(null); setCalcResult(null); }}
                  className="flex items-center gap-2 text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-[0.2em] group"
                >
                  <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  Voltar para Lista
                </button>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   <span className="text-[11px] font-black text-ink-900 uppercase tracking-widest">{selectedCalc?.name}</span>
                </div>
                <div className="w-24" />
              </div>
              
              {/* Editor Workspace */}
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                  <div className="max-w-3xl mx-auto bg-white rounded-[3rem] border-2 border-ink-100 shadow-sm p-10">
                    {selectedCalc && (
                      <selectedCalc.component 
                        value={{}} 
                        onChange={(val: any) => setCalcResult(val)} 
                      />
                    )}
                  </div>
                </div>

                {/* Live Preview Panel */}
                <div className="w-[400px] border-l border-ink-100 bg-white flex flex-col shrink-0">
                   <div className="p-8 border-b border-ink-100 bg-ink-50/30">
                      <div className="flex items-center gap-3 mb-2">
                         <Activity size={18} className="text-brand-600" />
                         <h4 className="text-[11px] font-black text-ink-900 uppercase tracking-widest">Resumo da Análise</h4>
                      </div>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tight">Resultado sincronizado em tempo real</p>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      <AnimatePresence mode="wait">
                        {calcResult?._summary ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                          >
                             <div className="p-6 rounded-[2rem] bg-brand-50 border-2 border-brand-100 shadow-inner">
                                <p className="text-sm font-bold text-brand-900 leading-relaxed whitespace-pre-wrap">
                                  {calcResult._summary}
                                </p>
                             </div>
                             
                             <div className="space-y-3">
                                <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest ml-1">Métricas Detalhadas:</p>
                                <div className="space-y-2">
                                   {Object.entries(calcResult).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                                     <div key={k} className="flex items-center justify-between px-4 py-2 bg-ink-50 rounded-xl border border-ink-100">
                                        <span className="text-[10px] font-bold text-ink-500 uppercase">{k}</span>
                                        <span className="text-[11px] font-black text-ink-900">{String(v)}</span>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </motion.div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                             <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center text-ink-300">
                                <Zap size={32} />
                             </div>
                             <p className="text-[11px] font-bold text-ink-400 uppercase leading-relaxed max-w-[200px]">Preencha os dados do módulo para gerar a conclusão técnica.</p>
                          </div>
                        )}
                      </AnimatePresence>
                   </div>

                   <div className="p-8 border-t border-ink-100 bg-ink-50/30">
                      <button
                        onClick={() => {
                          const cleanData = { ...calcResult };
                          Object.keys(cleanData).forEach(key => {
                            if (key.startsWith('_')) delete cleanData[key];
                          });

                          const finalMessage = `[RESULTADO TÉCNICO: ${selectedCalc?.name}]\n\n` +
                            (calcResult?._summary ? `CONCLUSÃO: ${calcResult._summary}\n\n` : '') +
                            `MÉTRICAS COLETADAS:\n${Object.entries(cleanData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
                            
                          onSendToCopilot(finalMessage);
                          onClose();
                        }}
                        disabled={!calcResult || (!calcResult._summary && Object.keys(calcResult).length === 0)}
                        className="w-full h-16 rounded-[1.5rem] bg-brand-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-brand-500/30 hover:bg-brand-700 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-3 group active:scale-95"
                      >
                        <Zap size={20} className="group-hover:scale-110 transition-transform fill-white" />
                        Usar no Copiloto
                      </button>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
