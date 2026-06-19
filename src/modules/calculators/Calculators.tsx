import React, { useState, useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { CALCULATORS } from './registry';
import { 
  Calculator, Search, RotateCcw, LayoutList, ChevronRight, X, Activity, Zap, CheckCircle2, Copy
} from 'lucide-react';
import { EXAM_AREAS, ExamArea } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { CalculatorReference } from './components/CalculatorUI';
import { motion, AnimatePresence } from 'framer-motion';

export function Calculators() {
  const [areaFilter, setAreaFilter] = useState<ExamArea | 'todas'>('todas');
  const [search, setSearch] = useState('');
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const activeCalc = useMemo(() => {
    return CALCULATORS.find(c => c.id === selectedCalcId);
  }, [selectedCalcId]);

  const filtered = useMemo(() => {
    return CALCULATORS.filter(calc => {
      const matchesArea = areaFilter === 'todas' || calc.areas.includes(areaFilter);
      const matchesSearch = calc.name.toLowerCase().includes(search.toLowerCase()) || 
                            calc.description.toLowerCase().includes(search.toLowerCase());
      return matchesArea && matchesSearch;
    });
  }, [areaFilter, search]);

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      <PageHeader
        title="Calculadoras Clínicas"
        subtitle="Biblioteca de módulos integrados para cálculos especializados."
        icon={Calculator}
      />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Áreas (Desktop) */}
        <aside className="sidebar-nav">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-5 py-4 flex items-center gap-2">
            <LayoutList size={14} /> Filtros Clínicos
          </p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setAreaFilter('todas')}
              className={classNames(
                "w-full px-5 py-4 rounded-2xl text-sm font-black transition-all flex items-center gap-4 uppercase tracking-widest",
                areaFilter === 'todas' 
                  ? "bg-ink-900 text-white shadow-lg" 
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <LayoutList size={18} />
              Todas
            </button>
            {EXAM_AREAS.map((area) => {
              const isActive = areaFilter === area.id;
              return (
                <button
                  key={area.id}
                  onClick={() => setAreaFilter(area.id as ExamArea)}
                  className={classNames(
                    "w-full px-5 py-4 rounded-2xl text-sm font-black transition-all flex items-center gap-4 uppercase tracking-widest group",
                    isActive 
                      ? "bg-brand-50 text-brand-700 border border-brand-100 shadow-sm" 
                      : "text-ink-600 hover:bg-ink-50"
                  )}
                >
                  <div className={classNames(
                    "p-2 rounded-xl transition-all shadow-inner", 
                    isActive ? area.color : "bg-ink-50 text-ink-400 group-hover:bg-ink-100"
                  )}>
                    <AreaIcon area={area.id} size={18} />
                  </div>
                  <span className="truncate">{area.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* Search and Mobile Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white p-4 rounded-3xl border border-ink-100 shadow-sm">
            <div className="relative flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="Pesquisar calculadora..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-sm"
                />
              </div>
              {(search || areaFilter !== 'todas') && (
                <button 
                  onClick={() => { setSearch(''); setAreaFilter('todas'); }}
                  className="p-3 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-2xl transition-all border border-ink-100 h-14 w-14 flex items-center justify-center shrink-0"
                  title="Limpar Filtros"
                >
                  <RotateCcw size={20} />
                </button>
              )}
            </div>
            
            <div className="lg:hidden flex gap-1.5 overflow-x-auto w-full pb-1 scrollbar-hide">
              <button
                onClick={() => setAreaFilter('todas')}
                className={classNames(
                  "px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap uppercase tracking-wider transition-all border",
                  areaFilter === 'todas'
                    ? "bg-ink-900 border-ink-900 text-white shadow-sm"
                    : "bg-ink-50 border-ink-200 text-ink-500 hover:bg-ink-100"
                )}
              >
                Todas
              </button>
              {EXAM_AREAS.map(area => (
                <button
                  key={area.id}
                  onClick={() => setAreaFilter(area.id as ExamArea)}
                  className={classNames(
                    "px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap flex items-center gap-2 uppercase tracking-wider transition-all border",
                    areaFilter === area.id
                      ? "bg-brand-50 border border-brand-100 text-brand-700 shadow-sm"
                      : "bg-ink-50 border-ink-200 text-ink-500 hover:bg-ink-100"
                  )}
                >
                  <AreaIcon area={area.id} size={12} />
                  {area.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Calculadoras */}
          <motion.div 
            layout 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {filtered.map(calc => (
                <motion.button
                  key={calc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.3, type: 'spring', bounce: 0.4 }}
                  onClick={() => setSelectedCalcId(calc.id)}
                  className="group flex flex-col p-6 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] border border-white hover:border-brand-300 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.2)] transition-all text-left relative overflow-hidden h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/40 to-transparent pointer-events-none" />
                  
                  <div className="absolute top-5 right-5 p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                    <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                      <ChevronRight size={20} className="translate-x-0.5" />
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col gap-5 mb-4 w-full">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-ink-100/80 to-ink-50/80 text-brand-600 flex items-center justify-center group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white transition-all duration-500 shadow-sm border border-white group-hover:shadow-xl group-hover:shadow-brand-500/20">
                      <AreaIcon area={calc.areas[0]} size={28} />
                    </div>
                    <div>
                      <h4 className="font-black text-ink-800 text-[1.1rem] leading-tight group-hover:text-brand-700 transition-colors uppercase tracking-tight">{calc.name}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {calc.areas.map(aId => {
                          const a = EXAM_AREAS.find(x => x.id === aId);
                          return a && (
                            <span key={aId} className="text-[9px] font-black uppercase text-brand-700 tracking-widest bg-brand-50/80 px-2.5 py-1 rounded-lg border border-brand-100/50 backdrop-blur-sm shadow-sm">
                              {a.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="relative z-10 text-[13px] text-ink-500 leading-relaxed font-medium line-clamp-3 mt-auto">
                    {calc.description}
                  </p>
                  
                  {/* Background Decoration */}
                  <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-gradient-to-tl from-brand-400/20 to-violet-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-3xl pointer-events-none" />
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-ink-200" />
              </div>
              <h3 className="text-ink-900 font-black">Nenhuma calculadora encontrada</h3>
              <p className="text-sm text-ink-400">Tente ajustar sua busca ou filtros.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal da Calculadora */}
      <AnimatePresence>
      {selectedCalcId && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-2 sm:p-4 lg:p-8 overflow-y-auto"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
            className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl shadow-brand-900/10 w-full max-w-5xl my-4 max-h-[90dvh] overflow-hidden flex flex-col border border-white"
          >
            <div className="px-6 py-5 sm:px-10 sm:py-6 border-b border-ink-100 bg-white/50 flex items-center justify-between shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-50/50 to-transparent pointer-events-none" />
              <div className="flex items-center gap-4 sm:gap-5 relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0">
                  <Calculator size={24} />
                </div>
                <div>
                  <h3 className="font-black text-ink-800 text-lg sm:text-2xl truncate max-w-[200px] sm:max-w-none tracking-tight">{activeCalc?.name}</h3>
                  <p className="text-[10px] sm:text-xs text-brand-600 font-black uppercase tracking-widest mt-0.5">Módulo de Cálculo Clínico</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedCalcId(null); setCalcResult(null); }} 
                className="p-3 sm:p-3 hover:bg-ink-100 rounded-2xl text-ink-400 hover:text-ink-800 transition-all border border-transparent hover:border-ink-200 relative z-10 bg-white shadow-sm hover:shadow"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 sm:p-10 custom-scrollbar space-y-8 bg-ink-50/50">
              <div className="bg-white rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 sm:p-8">
                {activeCalc && React.createElement(activeCalc.component, {
                  value: calcResult ?? {},
                  onChange: (res: Record<string, unknown>) => setCalcResult(res)
                })}
              </div>
              
              {activeCalc?.reference && (
                <CalculatorReference 
                  text={activeCalc.reference.text} 
                  link={activeCalc.reference.link} 
                />
              )}
              
              {calcResult && (calcResult._summary || Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 sm:p-8 bg-gradient-to-br from-brand-50 to-white rounded-[2.5rem] border border-brand-100 shadow-lg shadow-brand-500/5 space-y-6"
                >
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center">
                       <Activity size={16} />
                     </div>
                     <h4 className="text-xs sm:text-sm font-black text-brand-700 uppercase tracking-widest">Resultado Técnico</h4>
                  </div>
                  
                  {calcResult._summary && (
                     <div className="p-5 rounded-2xl bg-white border border-brand-100/50 shadow-sm">
                        <p className="text-sm sm:text-base font-bold text-ink-800 leading-relaxed whitespace-pre-wrap">{calcResult._summary}</p>
                     </div>
                  )}

                  {Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0 && (
                     <div className="space-y-3">
                        <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest pl-2">Métricas Detalhadas</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {Object.entries(calcResult).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                             <div key={k} className="flex flex-col gap-1 px-5 py-4 bg-white rounded-2xl border border-ink-100 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{k}</span>
                                <span className="text-sm font-bold text-ink-800">{String(v)}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
                </motion.div>
              )}
            </div>

            <div className="px-6 py-5 sm:px-10 sm:py-6 bg-white/80 backdrop-blur-xl border-t border-ink-100 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setSelectedCalcId(null); setCalcResult(null); }}
                className="px-6 py-3.5 rounded-2xl text-[11px] font-black text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-all uppercase tracking-widest"
              >
                Fechar
              </button>
              {calcResult && (calcResult._summary || Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0) && (
                <button 
                  className={classNames(
                    "px-8 py-3.5 rounded-2xl text-[11px] font-black transition-all uppercase tracking-widest flex items-center gap-2.5 active:scale-95 shadow-xl",
                    copied 
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30" 
                      : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30"
                  )}
                  disabled={copied}
                  onClick={() => {
                    const cleanData = { ...calcResult };
                    Object.keys(cleanData).forEach(key => {
                      if (key.startsWith('_')) delete cleanData[key];
                    });

                    const finalMessage = `[RESULTADO TÉCNICO: ${activeCalc?.name}]\n\n` +
                      (calcResult?._summary ? `CONCLUSÃO: ${calcResult._summary}\n\n` : '') +
                      `MÉTRICAS COLETADAS:\n${Object.entries(cleanData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;

                    navigator.clipboard.writeText(finalMessage);
                    setCopied(true);
                    setTimeout(() => {
                      setCopied(false);
                      setSelectedCalcId(null);
                      setCalcResult(null);
                    }, 1500);
                  }}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={16} className="fill-white text-emerald-500 animate-in zoom-in duration-200" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="group-hover:scale-110 transition-transform" />
                      Copiar Resultado
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </div>
  );
}
