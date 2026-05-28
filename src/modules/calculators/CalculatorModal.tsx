import { useState } from 'react';
import { X, Calculator, Filter, ArrowLeft, Activity, Zap, Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import { CALCULATORS } from './registry';

import { ExamArea } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { CalculatorReference } from './components/CalculatorUI';

interface Props {
  area?: ExamArea;
  onClose: () => void;
  onSendToCopilot: (result: string) => void;
  examDateMs?: number;
}

export function CalculatorModal({ area, onClose, onSendToCopilot, examDateMs }: Props) {
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredCalculators = CALCULATORS.filter(calc => 
    showAll || !area || calc.areas.includes(area)
  );

  const selectedCalc = CALCULATORS.find(c => c.id === selectedCalcId);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4 lg:p-10">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/65 backdrop-blur-md" 
      />
      
      <motion.div 
        initial={{ scale: 0.94, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative bg-white/95 backdrop-blur-xl w-full max-w-6xl h-full sm:h-[90vh] lg:h-full lg:max-h-[850px] rounded-none sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 shadow-slate-950/20"
      >
        {/* Header with Premium Mesh Gradient */}
        <div className="relative h-20 sm:h-28 shrink-0 overflow-hidden bg-slate-900 border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/30 via-brand-900/20 to-transparent" />
          <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(37,99,235,0.15),transparent_50%)] animate-pulse" />
          
          <div className="relative h-full flex items-center justify-between px-4 sm:px-10">
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl shrink-0">
                 <Calculator className="w-5 h-5 sm:w-8 sm:h-8 text-brand-400" />
              </div>
              <div>
                 <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                    <h2 className="text-base sm:text-2xl font-black text-white tracking-tight uppercase italic">Calculadoras</h2>
                    <span className="bg-brand-500/20 text-brand-300 text-[8px] sm:text-[10px] font-black px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-lg border border-brand-500/30 uppercase tracking-widest">v2.0</span>
                 </div>
                 <p className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Módulos de Suporte à Decisão Diagnóstica</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95 shadow-inner"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          {!selectedCalcId ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              {/* Filter Bar */}
              <div className="px-4 sm:px-10 py-3 sm:py-5 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                     <Filter size={14} className="text-brand-600" />
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Filtragem:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                     <span className={classNames(
                       "px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2",
                       !showAll ? "bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20" : "bg-slate-100 text-slate-400 border-slate-100"
                     )} onClick={() => setShowAll(false)}>
                        Sugestões ({area || 'Geral'})
                     </span>
                     <span className={classNames(
                       "px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2",
                       showAll ? "bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20" : "bg-slate-100 text-slate-400 border-slate-100"
                     )} onClick={() => setShowAll(true)}>
                        Todas
                     </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <Sparkles size={14} className="text-amber-500 animate-pulse" /> 
                   Destaque Técnico
                </div>
              </div>
              
              {/* Grid of Calculators */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 custom-scrollbar">
                {filteredCalculators.map(calc => (
                  <motion.button
                    whileHover={{ y: -5 }}
                    key={calc.id}
                    onClick={() => setSelectedCalcId(calc.id)}
                    className="group flex flex-col text-left p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 bg-white hover:border-brand-500 hover:shadow-xl hover:shadow-brand-500/5 transition-all relative overflow-hidden shadow-sm"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-brand-600 group-hover:text-white transition-all shadow-inner border border-slate-100">
                      <AreaIcon area={showAll ? calc.areas[0] : (area || calc.areas[0])} size={24} />
                    </div>
                    <h4 className="font-black text-slate-800 text-base sm:text-lg mb-1.5 sm:mb-2 group-hover:text-brand-700 transition-colors uppercase tracking-tight">{calc.name}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold line-clamp-3">{calc.description}</p>
                    {showAll && area && !calc.areas.includes(area) && (
                      <span className="mt-2 text-[8px] font-black text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 w-fit">
                        Outra área
                      </span>
                    )}
                    
                    <div className="mt-auto pt-4 sm:pt-6 flex items-center justify-between">
                       <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Abrir Módulo</span>
                       <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-all">
                          <ArrowLeft size={16} className="rotate-180" />
                       </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              {/* Back Bar */}
              <div className="px-4 sm:px-10 py-3 sm:py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                <button 
                  onClick={() => { setSelectedCalcId(null); setCalcResult(null); }}
                  className="flex items-center gap-2 text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-[0.2em] group"
                >
                  <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                  Voltar
                </button>
                <div className="flex items-center gap-2 sm:gap-3 max-w-[60%] sm:max-w-none">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                   <span className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-widest truncate">{selectedCalc?.name}</span>
                </div>
                <div className="w-10 sm:w-24" />
              </div>
              
              {/* Editor Workspace (Stackable on Mobile) */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar">
                  <div className="max-w-3xl mx-auto bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-10">
                    {selectedCalc && (
                      <>
                        <selectedCalc.component 
                          value={calcResult || {}} 
                          onChange={(val: any) => setCalcResult(val)} 
                          examDateMs={examDateMs}
                        />
                        {selectedCalc.reference && (
                          <CalculatorReference 
                            text={selectedCalc.reference.text} 
                            link={selectedCalc.reference.link} 
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Live Preview Panel (Glassmorphic look) */}
                <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-slate-100 bg-white flex flex-col shrink-0">
                   <div className="p-4 sm:p-8 border-b border-slate-100 bg-slate-50/40">
                      <div className="flex items-center gap-3 mb-1 sm:mb-2">
                         <Activity size={16} className="text-brand-600 animate-pulse" />
                         <h4 className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-widest">Resumo da Análise</h4>
                      </div>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-tight">Resultado sincronizado em tempo real</p>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6 custom-scrollbar bg-slate-50/20 max-h-[300px] lg:max-h-none">
                      <AnimatePresence mode="wait">
                        {calcResult?._summary ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                          >
                             <div className="p-4 sm:p-6 rounded-[1.2rem] sm:rounded-[1.8rem] bg-brand-50/50 border border-brand-100 shadow-inner">
                                <p className="text-xs sm:text-sm font-bold text-brand-900 leading-relaxed whitespace-pre-wrap">
                                  {calcResult._summary}
                                </p>
                             </div>
                             
                             <div className="space-y-2 sm:space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Métricas Detalhadas:</p>
                                <div className="space-y-1.5 sm:space-y-2">
                                   {Object.entries(calcResult).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                                     <div key={k} className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tight">{k}</span>
                                        <span className="text-[10px] sm:text-[11px] font-black text-slate-700">{String(v)}</span>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </motion.div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 opacity-45 py-8 sm:py-20">
                             <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner border border-slate-200">
                                <Zap className="w-6 h-6 sm:w-8 sm:h-8" />
                             </div>
                             <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase leading-relaxed max-w-[220px] mx-auto">Preencha os dados do módulo para gerar a conclusão técnica.</p>
                          </div>
                        )}
                      </AnimatePresence>
                   </div>

                   <div className="p-4 sm:p-8 border-t border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const cleanData = { ...calcResult };
                          Object.keys(cleanData).forEach(key => {
                            if (key.startsWith('_')) delete cleanData[key];
                          });

                          const finalMessage = `[RESULTADO TÉCNICO: ${selectedCalc?.name}]\n\n` +
                            (calcResult?._summary ? `CONCLUSÃO: ${calcResult._summary}\n\n` : '') +
                            `MÉTRICAS COLETADAS:\n${Object.entries(cleanData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

                          navigator.clipboard.writeText(finalMessage);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        disabled={!calcResult || (!calcResult._summary && Object.keys(calcResult).length === 0)}
                        className="flex-1 h-14 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 font-black text-[10px] sm:text-[11px] uppercase tracking-[0.2em] disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2 sm:gap-3 group active:scale-95 shadow-sm"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 animate-in zoom-in duration-200" />
                            <span className="text-emerald-700 font-black">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-hover:scale-110 transition-transform" />
                            <span>Copiar Resultado</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
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
                        className="flex-1 h-14 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] bg-gradient-to-r from-brand-600 to-brand-700 text-white font-black text-[10px] sm:text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-brand-500/25 hover:from-brand-700 hover:to-brand-800 disabled:opacity-30 disabled:grayscale disabled:shadow-none transition-all flex items-center justify-center gap-2 sm:gap-3 group active:scale-95"
                      >
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform fill-white" />
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
