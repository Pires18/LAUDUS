import { useState } from 'react';
import { X, Calculator, Filter, ArrowLeft, Activity, Zap, Sparkles, Copy, CheckCircle2, Send, ClipboardPaste, BarChart3 } from 'lucide-react';
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
  onAppendToForm?: (text: string) => void;
  examDateMs?: number;
}

export function CalculatorModal({ area, onClose, onSendToCopilot, onAppendToForm, examDateMs }: Props) {
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [copiedTechnical, setCopiedTechnical] = useState(false);
  const [copiedForm, setCopiedForm] = useState(false);
  const [sentCopilot, setSentCopilot] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'result'>('params');

  const filteredCalculators = CALCULATORS.filter(calc =>
    showAll || !area || calc.areas.includes(area)
  );

  const selectedCalc = CALCULATORS.find(c => c.id === selectedCalcId);

  const handleSelectCalc = (id: string | null) => {
    setSelectedCalcId(id);
    setCalcResult(null);
    setActiveTab('params');
    setCopiedTechnical(false);
    setCopiedForm(false);
    setSentCopilot(false);
  };

  const hasResult = calcResult && (calcResult._summary || Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0);

  /** Formato técnico: prefixo para o Copiloto processar como resultado de calculadora */
  const buildTechnicalMessage = () => {
    const cleanData = { ...calcResult };
    Object.keys(cleanData).forEach(key => { if (key.startsWith('_')) delete cleanData[key]; });
    return `[RESULTADO TÉCNICO: ${selectedCalc?.name}]\n\n` +
      (calcResult?._summary ? `CONCLUSÃO: ${calcResult._summary}\n\n` : '') +
      `MÉTRICAS COLETADAS:\n${Object.entries(cleanData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
  };

  /** Formato limpo para colar no formulário / clipboard simples */
  const buildFormMessage = () => {
    const cleanData = { ...calcResult };
    Object.keys(cleanData).forEach(key => { if (key.startsWith('_')) delete cleanData[key]; });
    const lines: string[] = [];
    if (selectedCalc?.name) lines.push(`${selectedCalc.name}:`);
    if (calcResult?._summary) lines.push(calcResult._summary);
    if (Object.keys(cleanData).length > 0) {
      lines.push('');
      Object.entries(cleanData).forEach(([k, v]) => lines.push(`${k}: ${v}`));
    }
    return lines.join('\n');
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
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-white/95 backdrop-blur-xl w-full max-w-6xl h-dvh sm:h-[90vh] lg:h-[90vh] lg:max-h-[820px] rounded-none sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 shadow-slate-950/20"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
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
                  <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight uppercase">Módulos Clínicos</h2>
                  <span className="bg-brand-500/20 text-brand-300 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg border border-brand-500/30 uppercase tracking-widest">v2.5 LAUD.IA</span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-300 font-medium tracking-[0.2em] opacity-80">Assistência Computacional e Rastreamento</p>
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
          {/* ── Lista de Calculadoras ───────────────────────────── */}
          {!selectedCalcId ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              <div className="px-4 sm:px-10 py-3 sm:py-5 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-brand-600" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Filtragem:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={classNames(
                        'px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2',
                        !showAll ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20' : 'bg-slate-100 text-slate-400 border-slate-100'
                      )}
                      onClick={() => setShowAll(false)}
                    >
                      Sugestões ({area || 'Geral'})
                    </span>
                    <span
                      className={classNames(
                        'px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-2',
                        showAll ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/20' : 'bg-slate-100 text-slate-400 border-slate-100'
                      )}
                      onClick={() => setShowAll(true)}
                    >
                      Todas
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Sparkles size={14} className="text-amber-500 animate-pulse" />
                  Destaque Técnico
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 custom-scrollbar">
                {filteredCalculators.map(calc => (
                  <motion.button
                    whileHover={{ y: -5 }}
                    key={calc.id}
                    onClick={() => handleSelectCalc(calc.id)}
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
            /* ── Calculadora Aberta ──────────────────────────────── */
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
              {/* Back Bar */}
              <div className="px-4 sm:px-10 py-3 sm:py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                <button
                  onClick={() => handleSelectCalc(null)}
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

              {/* Mobile Tabs */}
              <div className="flex lg:hidden bg-slate-50 border-b border-slate-100 p-1.5 shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={classNames(
                    'flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2',
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
                    'flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 relative',
                    activeTab === 'result' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Activity size={14} className={activeTab === 'result' ? 'text-brand-600' : ''} />
                  Conclusão
                  {hasResult && activeTab !== 'result' && (
                    <span className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Workspace */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* Left: Params */}
                <div className={classNames(
                  'flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar',
                  activeTab === 'params' ? 'block' : 'hidden lg:block'
                )}>
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

                {/* Right: Result Panel */}
                <div className={classNames(
                  'w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-slate-100 bg-white flex flex-col shrink-0 min-h-0',
                  activeTab === 'result' ? 'flex' : 'hidden lg:flex'
                )}>
                  {/* Result Header */}
                  <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={classNames(
                        'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                        hasResult ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'
                      )}>
                        <BarChart3 size={16} />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Resumo da Análise</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          {hasResult ? 'Resultado disponível' : 'Preencha os parâmetros'}
                        </p>
                      </div>
                      {hasResult && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                    </div>
                  </div>

                  {/* Result Content */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
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
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 shadow-xl shadow-brand-500/20">
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
                              <div className="relative z-10">
                                <span className="text-[9px] font-black text-brand-200 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                                  <Sparkles size={10} className="animate-pulse" />
                                  Conclusão Clínica
                                </span>
                                <p className="text-sm font-bold text-white leading-relaxed whitespace-pre-wrap">
                                  {calcResult._summary}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Metrics Grid */}
                          {Object.keys(calcResult).filter(k => !k.startsWith('_')).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Métricas Detalhadas</p>
                              <div className="grid grid-cols-1 gap-1.5">
                                {Object.entries(calcResult)
                                  .filter(([k]) => !k.startsWith('_'))
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors group">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight group-hover:text-slate-700 transition-colors">{k}</span>
                                      <span className="text-[11px] font-black text-slate-800 tabular-nums">{String(v)}</span>
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
                          className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-16"
                        >
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner border border-slate-200">
                            <Zap className="w-8 h-8" />
                          </div>
                          <p className="text-[11px] font-black text-slate-400 uppercase leading-relaxed max-w-[200px]">
                            Preencha os dados do módulo para gerar a conclusão técnica.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Action Buttons ─────────────────────────────── */}
                  <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-2.5">
                    {/* Row 1: Copiar para Formulário + Copiar Técnico */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Copiar para Formulário (texto limpo para colar no campo) */}
                      <button
                        type="button"
                        onClick={handleCopyForm}
                        disabled={!hasResult}
                        className={classNames(
                          'h-12 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm',
                          copiedForm
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        )}
                        title="Copia resultado em texto simples para colar no formulário"
                      >
                        {copiedForm ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600 animate-in zoom-in" />
                            Inserido!
                          </>
                        ) : (
                          <>
                            <ClipboardPaste size={13} className="group-hover:scale-110 transition-transform" />
                            {onAppendToForm ? "Inserir no Form" : "Copiar para Form"}
                          </>
                        )}
                      </button>

                      {/* Copiar formato técnico */}
                      <button
                        type="button"
                        onClick={handleCopyTechnical}
                        disabled={!hasResult}
                        className={classNames(
                          'h-12 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm',
                          copiedTechnical
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        )}
                        title="Copia resultado em formato técnico estruturado"
                      >
                        {copiedTechnical ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            Copiar Técnico
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
                        'w-full h-14 rounded-[1.2rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl',
                        sentCopilot
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white shadow-brand-500/25'
                      )}
                    >
                      {sentCopilot ? (
                        <>
                          <CheckCircle2 size={18} className="animate-in zoom-in duration-200" />
                          Enviado ao Copiloto!
                        </>
                      ) : (
                        <>
                          <Send size={16} className="group-hover:translate-x-0.5 transition-transform" />
                          Enviar ao Copiloto
                        </>
                      )}
                    </button>

                    {/* Hint */}
                    <p className="text-center text-[9px] font-semibold text-slate-400 opacity-80 uppercase tracking-wider">
                      O Copiloto ajusta a máscara e o formulário preenche campos textuais
                    </p>
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
