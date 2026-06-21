import { useState, useEffect } from 'react';
import { X, Calculator, Filter, ArrowLeft, Activity, Zap, Sparkles, Copy, CheckCircle2, Send, Search } from 'lucide-react';
import { logger } from '../../utils/logger';
import { CALCULATORS } from './registry';

const FIELD_LABELS: Record<string, string> = {
  // Volume
  structureName: 'Estrutura', volume: 'Volume (cm³)', unit: 'Unidade',
  d1: 'D1', d2: 'D2', d3: 'D3',
  // IG
  method: 'Método', referenceDate: 'Data do exame',
  dumDate: 'DUM', prevUsgDate: 'Data USG anterior',
  prevUsgWeeks: 'IG USG (sem)', prevUsgDays: 'IG USG (dias)',
  currentGa: 'IG Atual', edd: 'DDP',
  // Biometria fetal
  gaWeeks: 'IG (semanas)', gaDays: 'IG (dias)', sex: 'Sexo',
  bpd: 'DBP (mm)', hc: 'CC (mm)', ac: 'CA (mm)', fl: 'CF (mm)', hl: 'Úmero (mm)',
  efw: 'PFE (g)', percentile: 'Percentil OMS (%)', pDescription: 'Classificação',
  bpdPercentile: 'DBP p%', hcPercentile: 'CC p%', acPercentile: 'CA p%',
  flPercentile: 'CF p%', hlPercentile: 'Úmero p%',
  // Doppler
  auPi: 'IP Art. Umbilical', acmPi: 'IP ACM', utaPi: 'IP Uterinas (média)', dvPi: 'PIV Ducto Venoso',
  auFlow: 'Fluxo diastólico (AU)', dvWave: 'Onda A (Ducto Venoso)', efwPercentile: 'PFE Percentil',
  rcp: 'RCP (ACM/AU)', rcpP: 'RCP p%',
  stage: 'Estadio Barcelona', stageDesc: 'Estadiamento', rec: 'Conduta sugerida',
  auP: 'AU p%', acmP: 'ACM p%', utaP: 'UtA p%', dvP: 'DV p%',
  // Vascular
  psv: 'Vel. Sistólica (cm/s)', edv: 'Vel. Diastólica (cm/s)', tamv: 'TAMV (cm/s)',
  ri: 'IR (Resistência)', pi: 'IP (Pulsatilidade)', sd: 'Rel. S/D',
  // IMT
  age: 'Idade (anos)', imtRight: 'EIM Direita (mm)', imtLeft: 'EIM Esquerda (mm)',
  maxImt: 'EIM Máxima (mm)', classification: 'Classificação',
  // Próstata
  weight: 'Peso Estimado (g)',
  // Líquido amniótico
  result: 'Resultado (mm)', q1: 'Q1 (mm)', q2: 'Q2 (mm)', q3: 'Q3 (mm)', q4: 'Q4 (mm)',
  // IVC
  ivcimax: 'VCI Inspir. (mm)', ivcmax: 'VCI Expir. (mm)', ivci: 'Índice Colapsabilidade (%)',
  // Pleural
  thickness: 'Espessura lâmina (mm)',
  // CRL / MSD
  crl: 'CCN (mm)', msd: 'DMSG (mm)',
};

import { ExamArea } from '../../types';
import { classNames } from '../../utils/format';
import { AreaIcon } from '../../components/AreaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { CalculatorReference } from './components/CalculatorUI';
import { useApp } from '../../store/app';
import { useSubscription } from '../../hooks/useSubscription';

interface Props {
  area?: ExamArea;
  onClose: () => void;
  onSendToCopilot: (result: string) => void;
  onAppendToForm?: (text: string) => void;
  onInsertToReport?: (html: string) => void;
  examDateMs?: number;
  calculatorData?: Record<string, any>;
  onSaveCalculatorData?: (data: Record<string, any>) => void;
  initialCalcId?: string;
}

export function CalculatorModal({ area, onClose, onSendToCopilot, onAppendToForm, onInsertToReport, examDateMs, calculatorData = {}, onSaveCalculatorData, initialCalcId }: Props) {
  const { setView } = useApp();
  const { hasCalculators } = useSubscription();
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(initialCalcId || null);
  
  // O result atual da calculadora selecionada. 
  // Na montagem inicial, já carregamos do calculatorData.
  const [calcResult, setCalcResult] = useState<any>(
    initialCalcId ? (calculatorData[initialCalcId] || null) : null
  );

  useEffect(() => {
    if (initialCalcId) {
      setSelectedCalcId(initialCalcId);
      setCalcResult(calculatorData[initialCalcId] || null);
      setActiveTab('params');
    }
  }, [initialCalcId]);
  
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedForm, setCopiedForm] = useState(false);
  const [sentCopilot, setSentCopilot] = useState(false);
  const [insertedReport, setInsertedReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'result'>('params');
  const [updateKey, setUpdateKey] = useState(0);

  const filteredCalculators = CALCULATORS.filter(calc =>
    (showAll || !area || calc.areas.includes(area)) &&
    (!search || calc.name.toLowerCase().includes(search.toLowerCase()) || calc.description.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedCalc = CALCULATORS.find(c => c.id === selectedCalcId);

  const handleSelectCalc = (id: string | null) => {
    setSelectedCalcId(id);
    setCalcResult(id ? (calculatorData[id] || null) : null);
    setActiveTab('params');
    setCopiedForm(false);
    setSentCopilot(false);
  };

  const handleCalcChange = (val: any) => {
    setCalcResult(val);
    if (selectedCalcId && onSaveCalculatorData) {
      onSaveCalculatorData({ ...calculatorData, [selectedCalcId]: val });
    }
    if (val?._summary && !calcResult?._summary) {
      setActiveTab('result');
    }
  };

  const hasResult = !!calcResult?._summary;

  /** Formato técnico: prefixo para o Copiloto processar como resultado de calculadora */
  const buildTechnicalMessage = () => {
    if (!calcResult || !selectedCalc) return '';
    const metricsText = Object.entries(calcResult)
      .filter(([k, v]) =>
        !k.startsWith('_') &&
        typeof v !== 'object' &&
        v !== '' &&
        v !== null &&
        v !== undefined
      )
      .map(([k, v]) => `- ${FIELD_LABELS[k] || k}: ${v}`)
      .join('\n');
    return `[RESULTADO TÉCNICO: ${selectedCalc.name} | ID: ${selectedCalcId}]\n\nCONCLUSÃO:\n${calcResult._summary || ''}\n\nMÉTRICAS COLETADAS:\n${metricsText}`;
  };

  /** Formato limpo para colar no formulário / clipboard simples */
  const buildFormMessage = () => {
    return calcResult?._summary || '';
  };

  const handleCopyResult = async () => {
    const text = buildFormMessage();
    await navigator.clipboard.writeText(text);
    setCopiedForm(true);
    setTimeout(() => setCopiedForm(false), 2500);
  };

  const handleSendCopilot = async () => {
    await navigator.clipboard.writeText(buildTechnicalMessage()).catch(() => {});
    setSentCopilot(true);
    onSendToCopilot(buildTechnicalMessage());
    setTimeout(() => onClose(), 600);
  };

  const handleInsertToReport = () => {
    if (!onInsertToReport || !calcResult?._summary) return;
    const html = `<p><strong>${selectedCalc?.name || 'Calculadora'}:</strong> ${calcResult._summary}</p>`;
    onInsertToReport(html);
    setInsertedReport(true);
    setTimeout(() => { setInsertedReport(false); onClose(); }, 800);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-ink-900/65 backdrop-blur-md lg:hidden z-[410]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="fixed inset-x-0 top-0 w-full h-dvh rounded-none lg:inset-auto lg:bottom-24 lg:right-10 lg:w-[420px] lg:h-[72vh] lg:max-h-[660px] bg-white lg:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-ink-100 flex flex-col z-[420] overflow-hidden"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="relative h-16 shrink-0 overflow-hidden bg-ink-900 border-b border-ink-800">
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
                <p className="text-[9px] text-ink-300 font-medium tracking-[0.1em] opacity-80">Assistência Computacional e Rastreamento</p>
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
          {!hasCalculators ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/10 animate-bounce">
                <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-ink-800 uppercase tracking-wide">Recurso Não Incluso</h3>
                <p className="text-xs text-ink-500 font-medium max-w-[280px] leading-relaxed">
                  O módulo de Calculadoras Clínicas (Módulos de Assistência e Rastreamento) não está ativo em seu plano.
                </p>
              </div>
              <button
                onClick={() => {
                  setView({ name: 'settings', activeTab: 'assinatura' });
                  onClose();
                }}
                className="w-full max-w-[240px] h-11 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md shadow-brand-500/25 active:scale-95 transition-all"
              >
                Ativar Módulo de Calculadoras
              </button>
            </div>
          ) : !selectedCalcId ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
              {/* Filtros e busca */}
              <div className="px-4 py-3 bg-white border-b border-ink-100 flex flex-col gap-2.5 shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar calculadora..."
                    className="w-full h-8 pl-8 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 rounded-xl text-xs font-medium text-ink-800 placeholder-ink-400 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={11} className="text-ink-400" />
                  <button
                    onClick={() => setShowAll(false)}
                    className={classNames(
                      'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border',
                      !showAll ? 'bg-brand-600 text-white border-brand-500' : 'bg-ink-50 text-ink-500 border-ink-200 hover:bg-ink-100'
                    )}
                  >
                    {area ? area.replace(/-/g, ' ') : 'Geral'}
                  </button>
                  <button
                    onClick={() => setShowAll(true)}
                    className={classNames(
                      'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border',
                      showAll ? 'bg-brand-600 text-white border-brand-500' : 'bg-ink-50 text-ink-500 border-ink-200 hover:bg-ink-100'
                    )}
                  >
                    Todas
                  </button>
                  <span className="ml-auto text-[9px] text-ink-400 font-bold">{filteredCalculators.length} módulo{filteredCalculators.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
                {filteredCalculators.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-xs font-bold text-ink-400">Nenhuma calculadora encontrada.</p>
                  </div>
                ) : filteredCalculators.map(calc => (
                  <motion.button
                    whileHover={{ x: 2 }}
                    key={calc.id}
                    onClick={() => handleSelectCalc(calc.id)}
                    className="group flex items-center gap-3 text-left px-3 py-3 rounded-xl border border-ink-100 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-ink-50 text-ink-400 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all border border-ink-100 shrink-0">
                      <AreaIcon area={showAll ? calc.areas[0] : (area || calc.areas[0])} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-ink-800 text-xs group-hover:text-brand-700 transition-colors truncate">{calc.name}</h4>
                      <p className="text-[10px] text-ink-400 font-medium line-clamp-1 mt-0.5">{calc.description}</p>
                    </div>
                    <div className="text-ink-300 group-hover:text-brand-400 transition-colors shrink-0">
                      <ArrowLeft size={14} className="rotate-180" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Calculadora Aberta ──────────────────────────────── */
            <div className="flex-1 flex flex-col min-h-0 bg-ink-50/50">
              {/* Back Bar */}
              <div className="px-4 py-3 bg-white border-b border-ink-100 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleSelectCalc(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  <span className="text-[11px] font-black text-ink-800 uppercase tracking-widest truncate">{selectedCalc?.name}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-ink-50 border-b border-ink-100 p-1.5 shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={classNames(
                    'flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2',
                    activeTab === 'params' ? 'bg-white text-ink-800 shadow-sm border border-ink-100' : 'text-ink-400 hover:text-ink-600'
                  )}
                >
                  <Calculator size={14} className={activeTab === 'params' ? 'text-brand-600' : ''} />
                  Parâmetros
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('result')}
                  className={classNames(
                    'flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 relative',
                    activeTab === 'result' ? 'bg-white text-ink-800 shadow-sm border border-ink-100' : 'text-ink-400 hover:text-ink-600'
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
                  <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
                    {selectedCalc && (
                      <>
                        <selectedCalc.component
                          key={updateKey}
                          value={calcResult || {}}
                          onChange={handleCalcChange}
                          examDateMs={examDateMs}
                        />
                        {selectedCalc.reference && (
                          <div className="mt-4 pt-4 border-t border-ink-100">
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
                  'w-full flex-1 flex flex-col shrink-0 min-h-0 bg-ink-50',
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
                            <div className="space-y-2 bg-white rounded-2xl p-4 border border-ink-100 shadow-sm">
                              <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Métricas Detalhadas</p>
                              <div className="grid grid-cols-1 gap-1.5">
                                {Object.entries(calcResult)
                                  .filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object' && v !== '' && v !== null && v !== undefined)
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between py-1.5 border-b border-ink-50 last:border-0">
                                      <span className="text-[10px] font-bold text-ink-400">{FIELD_LABELS[k] || k}</span>
                                      <span className="text-[10px] font-black text-ink-800 tabular-nums">{String(v)}</span>
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
                          <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-400 shadow-inner border border-ink-200">
                            <Zap className="w-6 h-6" />
                          </div>
                          <p className="text-[10px] font-black text-ink-400 uppercase leading-relaxed max-w-[180px]">
                            Preencha os dados do módulo para gerar a conclusão técnica.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Action Buttons ─────────────────────────────── */}
                  <div className="p-4 pb-8 sm:pb-4 border-t border-ink-100 bg-white shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyResult}
                        disabled={!hasResult}
                        className={classNames(
                          'h-11 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm',
                          copiedForm
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 hover:border-ink-300'
                        )}
                      >
                        {copiedForm ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600 animate-in zoom-in" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            Copiar Resultado
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSendCopilot}
                        disabled={!hasResult || sentCopilot}
                        className={classNames(
                          'h-11 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md',
                          sentCopilot
                            ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white shadow-brand-500/25'
                        )}
                      >
                        {sentCopilot ? (
                          <>
                            <CheckCircle2 size={13} className="animate-in zoom-in duration-200" />
                            Enviado!
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            Enviar ao Copiloto
                          </>
                        )}
                      </button>
                    </div>

                    {onInsertToReport && (
                      <button
                        type="button"
                        onClick={handleInsertToReport}
                        disabled={!hasResult || insertedReport}
                        className={classNames(
                          'w-full mt-2 h-10 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm',
                          insertedReport
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 hover:border-teal-300'
                        )}
                      >
                        {insertedReport ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600 animate-in zoom-in" />
                            Inserido no laudo!
                          </>
                        ) : (
                          <>
                            <Zap size={13} />
                            Inserir no Laudo
                          </>
                        )}
                      </button>
                    )}
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
