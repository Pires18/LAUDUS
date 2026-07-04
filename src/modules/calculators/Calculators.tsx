import React, { useState, useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { CALCULATORS } from './registry';
import {
  Calculator, Search, RotateCcw, LayoutList, ChevronRight, X, Activity, CheckCircle2, Copy, LayoutGrid
} from 'lucide-react';
import { EXAM_AREAS, ExamArea } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { CalculatorReference } from './components/CalculatorUI';
import { FIELD_LABELS, isDisplayableMetric } from './constants/fieldLabels';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../../hooks/useSubscription';
import { FeatureLocked } from '../../components/FeatureLocked';

export function Calculators() {
  const { hasCalculators } = useSubscription();
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

  if (!hasCalculators) {
    return (
      <FeatureLocked
        title="Calculadoras Clínicas"
        addonLabel="Calculadoras Clínicas"
        description="Ative-o na sua assinatura para liberar biometria fetal, volumes, doppler e mais de 20 calculadores especializados."
      />
    );
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <Calculator size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Calculadoras Clínicas</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Biblioteca de módulos integrados para cálculos especializados.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── PILL TAB BAR ─── */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
          <button
            onClick={() => setAreaFilter('todas')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
              areaFilter === 'todas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <LayoutGrid size={13} />
            Todas
          </button>
          {EXAM_AREAS.map((area) => {
            const isActive = areaFilter === area.id;
            return (
              <button
                key={area.id}
                onClick={() => setAreaFilter(area.id as ExamArea)}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
                )}
              >
                <AreaIcon area={area.id} size={13} />
                {area.label}
              </button>
            );
          })}
        </div>

        {/* ─── SEARCH & FILTER SUMMARY ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar calculadora por nome..."
              className="w-full h-9 pl-9 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 rounded-xl focus:ring-2 focus:ring-brand-400/10 outline-none transition-all text-sm text-ink-800 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={13} />
              </button>
            )}
          </div>
          {(search || areaFilter !== 'todas') && (
            <button
              onClick={() => { setSearch(''); setAreaFilter('todas'); }}
              className="h-9 px-3 rounded-xl border border-ink-200 text-ink-500 hover:bg-ink-50 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <RotateCcw size={12} />
              Limpar Filtros
            </button>
          )}
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
                  className="group flex flex-col p-6 bg-white/70 backdrop-blur-2xl rounded-2xl border border-ink-200 hover:border-brand-300 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.2)] transition-all text-left relative overflow-hidden h-full shadow-sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/40 to-transparent pointer-events-none" />
                  
                  <div className="absolute top-5 right-5 p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                    <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                      <ChevronRight size={20} className="translate-x-0.5" />
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col gap-5 mb-4 w-full">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-ink-100/80 to-ink-50/80 text-brand-600 flex items-center justify-center group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white transition-all duration-500 shadow-sm border border-white group-hover:shadow-xl group-hover:shadow-brand-500/20">
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
            className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-brand-900/10 w-full max-w-5xl my-4 max-h-[90dvh] overflow-hidden flex flex-col border border-ink-200"
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
              <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 sm:p-8">
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
              
              {calcResult && (calcResult._summary || Object.entries(calcResult).some(([k, v]) => isDisplayableMetric(k, v))) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 sm:p-8 bg-gradient-to-br from-brand-50 to-white rounded-2xl border border-brand-100 shadow-lg shadow-brand-500/5 space-y-6"
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

                  {Object.entries(calcResult).some(([k, v]) => isDisplayableMetric(k, v)) && (
                     <div className="space-y-3">
                        <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest pl-2">Métricas Detalhadas</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {Object.entries(calcResult).filter(([k, v]) => isDisplayableMetric(k, v)).map(([k, v]) => (
                             <div key={k} className="flex flex-col gap-1 px-5 py-4 bg-white rounded-2xl border border-ink-100 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{FIELD_LABELS[k] || k}</span>
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
              {calcResult && (calcResult._summary || Object.entries(calcResult).some(([k, v]) => isDisplayableMetric(k, v))) && (
                <button 
                  className={classNames(
                    "px-8 py-3.5 rounded-2xl text-[11px] font-black transition-all uppercase tracking-widest flex items-center gap-2.5 active:scale-95 shadow-xl",
                    copied 
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30" 
                      : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30"
                  )}
                  disabled={copied}
                  onClick={() => {
                    const metricsText = Object.entries(calcResult)
                      .filter(([k, v]) => isDisplayableMetric(k, v))
                      .map(([k, v]) => `- ${FIELD_LABELS[k] || k}: ${v}`)
                      .join('\n');

                    const finalMessage = `[RESULTADO TÉCNICO: ${activeCalc?.name}]\n\n` +
                      (calcResult?._summary ? `CONCLUSÃO: ${calcResult._summary}\n\n` : '') +
                      `MÉTRICAS COLETADAS:\n${metricsText}`;

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
