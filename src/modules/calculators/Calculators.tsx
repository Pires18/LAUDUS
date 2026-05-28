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
        <aside className="hidden lg:flex flex-col gap-1 w-64 shrink-0 bg-white p-2 rounded-3xl border border-ink-100 shadow-sm sticky top-24">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Filtrar por Área</p>
          <button
            onClick={() => setAreaFilter('todas')}
            className={classNames(
              "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
              areaFilter === 'todas' 
                ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100" 
                : "text-ink-600 hover:bg-ink-50"
            )}
          >
            <LayoutList size={18} />
            Todas as Áreas
          </button>
          {EXAM_AREAS.map((area) => {
            const isActive = areaFilter === area.id;
            return (
              <button
                key={area.id}
                onClick={() => setAreaFilter(area.id as ExamArea)}
                className={classNames(
                  "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
                  isActive 
                    ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100" 
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <div className={classNames("p-1.5 rounded-lg", isActive ? area.color : "bg-ink-50 text-ink-400")}>
                  <AreaIcon area={area.id} size={16} />
                </div>
                {area.label}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* Search and Mobile Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="Buscar calculadora..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-12 py-3 text-base shadow-sm border-ink-200 focus:border-brand-500 h-14 w-full"
                />
              </div>
              {(search || areaFilter !== 'todas') && (
                <button 
                  onClick={() => { setSearch(''); setAreaFilter('todas'); }}
                  className="p-3 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-ink-100 h-14 w-14 flex items-center justify-center shrink-0"
                  title="Limpar Filtros"
                >
                  <RotateCcw size={20} />
                </button>
              )}
            </div>
            
            <div className="lg:hidden flex gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
              <button
                onClick={() => setAreaFilter('todas')}
                className={classNames(
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border",
                  areaFilter === 'todas' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-600 border-ink-100"
                )}
              >
                Todas
              </button>
              {EXAM_AREAS.map(area => (
                <button
                  key={area.id}
                  onClick={() => setAreaFilter(area.id as ExamArea)}
                  className={classNames(
                    "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-2",
                    areaFilter === area.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-600 border-ink-100"
                  )}
                >
                  <AreaIcon area={area.id} size={14} />
                  {area.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Calculadoras */}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {filtered.map(calc => (
              <button
                key={calc.id}
                onClick={() => setSelectedCalcId(calc.id)}
                className="group flex flex-col p-6 bg-white rounded-[2.5rem] border border-ink-100 hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/10 transition-all text-left relative overflow-hidden h-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-ink-50 text-ink-400 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-all shadow-inner">
                      <AreaIcon area={calc.areas[0]} size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-ink-900 group-hover:text-brand-700 transition-colors">{calc.name}</h4>
                      <div className="flex gap-1 mt-0.5">
                        {calc.areas.map(aId => {
                          const a = EXAM_AREAS.find(x => x.id === aId);
                          return a && (
                            <span key={aId} className="text-[8px] font-black uppercase text-ink-300 tracking-tighter">
                              • {a.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-ink-200 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-ink-500 leading-relaxed font-medium line-clamp-3">
                  {calc.description}
                </p>
                
                {/* Background Decoration */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-brand-50 rounded-full opacity-0 group-hover:opacity-40 transition-all blur-2xl" />
              </button>
            ))}
          </div>

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
      {selectedCalcId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-2 sm:p-4 lg:p-8 animate-in fade-in duration-200 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden transform animate-in zoom-in-95 duration-200 border border-ink-100 flex flex-col">
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-sm sm:text-lg truncate max-w-[200px] sm:max-w-none">{activeCalc?.name}</h3>
                  <p className="text-[9px] sm:text-xs text-ink-400 font-bold uppercase tracking-widest">Módulo de Cálculo Clínico</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedCalcId(null); setCalcResult(null); }} 
                className="p-2 sm:p-3 hover:bg-ink-100 rounded-xl sm:rounded-2xl text-ink-400 hover:text-ink-900 transition-all border border-ink-100"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
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
                <div className="p-4 sm:p-6 bg-brand-50/50 rounded-[1.5rem] sm:rounded-[2rem] border border-brand-100 animate-in slide-in-from-bottom-4 space-y-4">
                  <div className="flex items-center gap-2">
                     <Activity size={16} className="text-brand-600" />
                     <h4 className="text-[10px] sm:text-xs font-black text-brand-600 uppercase tracking-widest">Resultado Técnico</h4>
                  </div>
                  
                  {calcResult._summary && (
                     <div className="p-4 rounded-xl bg-white border border-brand-100/50 shadow-sm">
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{calcResult._summary}</p>
                     </div>
                  )}

                  {Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0 && (
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Métricas Detalhadas:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {Object.entries(calcResult).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                             <div key={k} className="flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-slate-100 shadow-inner">
                                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tight">{k}</span>
                                <span className="text-[10px] sm:text-[11px] font-black text-slate-700">{String(v)}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 sm:px-8 sm:py-6 bg-ink-50/50 border-t border-ink-100 flex justify-end gap-2.5 sm:gap-3 shrink-0">
              <button 
                onClick={() => { setSelectedCalcId(null); setCalcResult(null); }}
                className="px-5 py-3 rounded-xl sm:rounded-2xl text-xs font-black text-ink-600 hover:bg-ink-100 transition-all uppercase tracking-widest"
              >
                Fechar
              </button>
              {calcResult && (calcResult._summary || Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0) && (
                <button 
                  className={classNames(
                    "px-6 py-3 rounded-xl sm:rounded-2xl text-xs font-black transition-all uppercase tracking-widest flex items-center gap-2 active:scale-95 shadow-lg",
                    copied 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" 
                      : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20"
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
                      <CheckCircle2 size={14} className="fill-white text-emerald-600 animate-in zoom-in duration-200" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="group-hover:scale-110 transition-transform" />
                      Copiar Resultado
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
