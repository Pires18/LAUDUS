import { useState } from 'react';
import { X, Calculator, Filter, ArrowLeft, Activity, Zap, Sparkles, Copy, CheckCircle2, Send, ClipboardPaste, Wand2, Loader2 } from 'lucide-react';
import { CALCULATORS } from './registry';

import { ExamArea } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { CalculatorReference } from './components/CalculatorUI';
import { extractCalculatorData } from '../ai/engine';
import { useApp } from '../../store/app';

interface Props {
  area?: ExamArea;
  onClose: () => void;
  onSendToCopilot: (result: string) => void;
  onAppendToForm?: (text: string) => void;
  examDateMs?: number;
  reportContent?: string;
  calculatorData?: Record<string, any>;
  onSaveCalculatorData?: (data: Record<string, any>) => void;
}

  export function CalculatorModal({ area, onClose, onSendToCopilot, onAppendToForm, examDateMs, reportContent, calculatorData = {}, onSaveCalculatorData }: Props) {
  const settings = useApp((state) => state.settings);
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  
  // O result atual da calculadora selecionada. 
  // Na montagem inicial, já carregamos do calculatorData.
  const [calcResult, setCalcResult] = useState<any>(null);
  
  const [showAll, setShowAll] = useState(false);
  const [copiedTechnical, setCopiedTechnical] = useState(false);
  const [copiedForm, setCopiedForm] = useState(false);
  const [sentCopilot, setSentCopilot] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'result'>('params');
  const [isExtracting, setIsExtracting] = useState(false);
  const [updateKey, setUpdateKey] = useState(0);

  const filteredCalculators = CALCULATORS.filter(calc =>
    showAll || !area || calc.areas.includes(area)
  );

  const selectedCalc = CALCULATORS.find(c => c.id === selectedCalcId);

  const handleSelectCalc = (id: string | null) => {
    setSelectedCalcId(id);
    setCalcResult(id ? (calculatorData[id] || null) : null);
    setActiveTab('params');
    setCopiedTechnical(false);
    setCopiedForm(false);
    setSentCopilot(false);
  };

  const handleCalcChange = (val: any) => {
    setCalcResult(val);
    if (selectedCalcId && onSaveCalculatorData) {
      onSaveCalculatorData({ ...calculatorData, [selectedCalcId]: val });
    }
  };

  const hasResult = !!calcResult?._summary;

  /** Formato técnico: prefixo para o Copiloto processar como resultado de calculadora */
  const buildTechnicalMessage = () => {
    return calcResult?._summary || '';
  };

  /** Formato limpo para colar no formulário / clipboard simples */
  const buildFormMessage = () => {
    return calcResult?._summary || '';
  };

  const handleCopyForm = async () => {
    const text = buildFormMessage();
    if (onAppendToForm) {
      onAppendToForm(text);
      setCopiedForm(true);
      setTimeout(() => setCopiedForm(false), 2500);
    } else {
      await navigator.clipboard.writeText(text);
      setCopiedForm(true);
      setTimeout(() => setCopiedForm(false), 2500);
    }
  };

  const handleCopyTechnical = async () => {
    await navigator.clipboard.writeText(buildTechnicalMessage());
    setCopiedTechnical(true);
    setTimeout(() => setCopiedTechnical(false), 2500);
  };

  const handleSendCopilot = async () => {
    await navigator.clipboard.writeText(buildTechnicalMessage()).catch(() => {});
    setSentCopilot(true);
    onSendToCopilot(buildTechnicalMessage());
    setTimeout(() => onClose(), 600);
  };

  const handleAutoFill = async () => {
    if (!reportContent || !selectedCalc) return;
    
    setIsExtracting(true);
    try {
      const data = await extractCalculatorData(
        reportContent,
        selectedCalc,
        settings
      );
      // Mantém os dados antigos se o retorno for inválido, senão substitui
      if (data && typeof data === 'object') {
        const newData = { ...calcResult, ...data };
        setCalcResult(newData);
        if (selectedCalcId && onSaveCalculatorData) {
          onSaveCalculatorData({ ...calculatorData, [selectedCalcId]: newData });
        }
        setUpdateKey(prev => prev + 1); // Força o remount do componente para ler o novo value
      }
    } catch (err) {
      console.error(err);
      alert('Não foi possível extrair dados do laudo.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-md lg:hidden z-[125]"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="fixed inset-x-0 top-0 w-full h-dvh rounded-none lg:inset-auto lg:bottom-24 lg:right-10 lg:w-[420px] lg:h-[72vh] lg:max-h-[660px] bg-white lg:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 flex flex-col z-[130] overflow-hidden"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="relative h-16 shrink-0 overflow-hidden bg-slate-900 border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/30 via-brand-900/20 to-transparent" />
          <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(37,99,235,0.15),transparent_50%)] animate-pulse" />

          <div className="relative h-full flex items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl shrink-0">
                <Calculator className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white tracking-tight uppercase">Módulos Clínicos</h2>
                </div>
                <p className="text-[9px] text-slate-300 font-medium tracking-[0.1em] opacity-80">Assistência Computacional e Rastreamento</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95 shadow-inner"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          {/* ── Lista de Calculadoras ───────────────────────────── */}
          {!selectedCalcId ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-brand-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={classNames(
                        'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-2',
                        !showAll ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20' : 'bg-slate-100 text-slate-400 border-slate-100'
                      )}
                      onClick={() => setShowAll(false)}
                    >
                      {area || 'Geral'}
                    </span>
                    <span
                      className={classNames(
                        'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-2',
                        showAll ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20' : 'bg-slate-100 text-slate-400 border-slate-100'
                      )}
                      onClick={() => setShowAll(true)}
                    >
                      Todas
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {filteredCalculators.map(calc => (
                  <motion.button
                    whileHover={{ y: -2 }}
                    key={calc.id}
                    onClick={() => handleSelectCalc(calc.id)}
                    className="group flex flex-col text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-brand-500 hover:shadow-md hover:shadow-brand-500/5 transition-all relative overflow-hidden shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all shadow-inner border border-slate-100 shrink-0">
                        <AreaIcon area={showAll ? calc.areas[0] : (area || calc.areas[0])} size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 text-xs mb-1 group-hover:text-brand-700 transition-colors uppercase tracking-tight">{calc.name}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold line-clamp-2">{calc.description}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Calculadora Aberta ──────────────────────────────── */
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              {/* Back Bar */}
              <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleSelectCalc(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest truncate">{selectedCalc?.name}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-slate-50 border-b border-slate-100 p-1.5 shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={classNames(
                    'flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2',
                    activeTab === 'params' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Calculator size={14} className={activeTab === 'params' ? 'text-brand-600' : ''} />
                  Parâmetros
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('result')}
                  className={classNames(
                    'flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 relative',
                    activeTab === 'result' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Activity size={14} className={activeTab === 'result' ? 'text-brand-600' : ''} />
                  Conclusão
                  {hasResult && activeTab !== 'result' && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Workspace */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Params */}
                <div className={classNames(
                  'flex-1 overflow-y-auto p-4 custom-scrollbar',
                  activeTab === 'params' ? 'block' : 'hidden'
                )}>
                  {/* AI Auto-fill Button */}
                  {selectedCalc && reportContent && reportContent.trim().length > 50 && (
                    <button
                      type="button"
                      onClick={handleAutoFill}
                      disabled={isExtracting}
                      className="w-full mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-brand-50 border border-indigo-100/50 flex items-center justify-center gap-3 text-brand-700 font-bold text-xs uppercase tracking-wider hover:shadow-md hover:from-indigo-100 hover:to-brand-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 size={16} className="animate-spin text-brand-500" />
                          <span>Analisando Laudo...</span>
                        </>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                          <Wand2 size={16} className="text-brand-500" />
                          <span>✨ Autopreencher com IA</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    {selectedCalc && (
                      <>
                        <selectedCalc.component
                          key={updateKey}
                          value={calcResult || {}}
                          onChange={handleCalcChange}
                          examDateMs={examDateMs}
                        />
                        {selectedCalc.reference && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <CalculatorReference
                              text={selectedCalc.reference.text}
                              link={selectedCalc.reference.link}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Result Panel */}
                <div className={classNames(
                  'w-full flex-1 flex flex-col shrink-0 min-h-0 bg-slate-50',
                  activeTab === 'result' ? 'flex' : 'hidden'
                )}>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <AnimatePresence mode="wait">
                      {hasResult ? (
                        <motion.div
                          key="result"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-4"
                        >
                          {/* Summary Card */}
                          {calcResult._summary && (
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 shadow-lg shadow-brand-500/20">
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
                              <div className="relative z-10">
                                <span className="text-[9px] font-black text-brand-200 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                  <Sparkles size={10} className="animate-pulse" />
                                  Conclusão Clínica
                                </span>
                                <p className="text-xs font-bold text-white leading-relaxed whitespace-pre-wrap">
                                  {calcResult._summary}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Metrics Grid */}
                          {Object.keys(calcResult).filter(k => !k.startsWith('_') && typeof calcResult[k] !== 'object' && calcResult[k] !== '').length > 0 && (
                            <div className="space-y-2 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Métricas Detalhadas</p>
                              <div className="grid grid-cols-1 gap-1.5">
                                {Object.entries(calcResult)
                                  .filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object' && v !== '')
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{k}</span>
                                      <span className="text-[10px] font-black text-slate-800 tabular-nums">{String(v)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40 py-10"
                        >
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner border border-slate-200">
                            <Zap className="w-6 h-6" />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed max-w-[180px]">
                            Preencha os dados do módulo para gerar a conclusão técnica.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Action Buttons ─────────────────────────────── */}
                  <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-2.5 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                    {/* Row 1: Copiar para Formulário + Copiar Técnico */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyForm}
                        disabled={!hasResult}
                        className={classNames(
                          'h-10 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm',
                          copiedForm
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        )}
                        title="Copia resultado em texto simples para colar no formulário"
                      >
                        {copiedForm ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-600 animate-in zoom-in" />
                            Inserido!
                          </>
                        ) : (
                          <>
                            <ClipboardPaste size={12} className="group-hover:scale-110 transition-transform" />
                            {onAppendToForm ? "Formulário" : "Copiar"}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyTechnical}
                        disabled={!hasResult}
                        className={classNames(
                          'h-10 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm',
                          copiedTechnical
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        )}
                        title="Copia resultado em formato técnico estruturado"
                      >
                        {copiedTechnical ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Técnico
                          </>
                        )}
                      </button>
                    </div>

                    {/* Row 2: Enviar ao Copiloto (destaque principal) */}
                    <button
                      type="button"
                      onClick={handleSendCopilot}
                      disabled={!hasResult || sentCopilot}
                      className={classNames(
                        'w-full h-12 rounded-[1.2rem] font-black text-[10px] uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg',
                        sentCopilot
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white shadow-brand-500/25'
                      )}
                    >
                      {sentCopilot ? (
                        <>
                          <CheckCircle2 size={16} className="animate-in zoom-in duration-200" />
                          Enviado ao Copiloto!
                        </>
                      ) : (
                        <>
                          <Send size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          Enviar ao Copiloto
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
