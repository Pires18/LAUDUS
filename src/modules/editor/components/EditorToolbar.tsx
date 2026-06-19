import { useState } from 'react';
import { Sparkles, Loader2, Eye, CheckCircle2, Cloud, RotateCcw, History, BookOpen, Clock, Copy, Calculator, ChevronDown, Brain, Cpu, AlertCircle } from 'lucide-react';
import { classNames } from '../../../utils/format';

// Quick calculator shortcuts by exam area
const AREA_CALC_SHORTCUTS: Record<string, Array<{ label: string; calcId: string }>> = {
  'medicina-fetal': [
    { label: 'IG / DPP', calcId: 'ig-dpp' },
    { label: 'Biometria WHO', calcId: 'biometria-fetal' },
    { label: 'Doppler Fetal', calcId: 'doppler-fetal' },
  ],
  'ginecologia': [
    { label: 'Volume Ovariano', calcId: 'volume-ovariano' },
    { label: 'O-RADS', calcId: 'orads' },
    { label: 'MUSA', calcId: 'musa' },
  ],
  'vascular': [
    { label: 'Índice Tornozelo-Braquial', calcId: 'itb' },
    { label: 'Velocidade Doppler', calcId: 'doppler-vascular' },
    { label: 'IMT Carótida', calcId: 'imt' },
  ],
  'mama': [
    { label: 'BI-RADS', calcId: 'birads' },
    { label: 'Volume Nódulo', calcId: 'volume-nodulo' },
  ],
  'tireoide': [
    { label: 'TI-RADS', calcId: 'tirads' },
    { label: 'Volume Tireóide', calcId: 'volume-tireoide' },
  ],
  'abdome': [
    { label: 'Volume Vesical', calcId: 'volume-vesical' },
    { label: 'Ascite', calcId: 'ascite' },
  ],
};

interface EditorToolbarProps {
  isGenerating: boolean;
  hasReport: boolean;
  /** Se o conteúdo atual é apenas a máscara (contém placeholders) → modo Geração Inicial */
  isTemplateMask: boolean;
  status: string;
  examArea?: string;
  onRefine: () => void;
  onShowPrompt: () => void;
  onReset: () => void;
  onShowHistory: () => void;
  onShowVersions: () => void;
  onToggleSnippets: () => void;
  snippetsOpen: boolean;
  snippetCount: number;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  geminiModel: string;
  hasGoogleDoc?: boolean;
  onCopy?: () => void;
  onShowCalculators?: (calcId?: string) => void;
}

export function EditorToolbar({
  isGenerating,
  hasReport,
  isTemplateMask,
  status,
  examArea,
  onRefine,
  onShowPrompt,
  onReset,
  onShowHistory,
  onShowVersions,
  onToggleSnippets,
  snippetsOpen,
  snippetCount,
  saveState,
  geminiModel,
  hasGoogleDoc,
  onCopy,
  onShowCalculators
}: EditorToolbarProps) {
  const refineLabel = isTemplateMask ? 'Gerar com Laud.IA' : 'Refinar';
  const [showCalcMenu, setShowCalcMenu] = useState(false);

  const calcShortcuts = examArea ? (AREA_CALC_SHORTCUTS[examArea] || []) : [];

  return (
    <div className="px-4 py-2 border-b border-ink-200 bg-white flex items-center gap-2 shrink-0 flex-wrap">

      {/* ── Zone 1: IA Actions ── */}
      <div className="flex items-center gap-1.5">
        {/* Main AI action button */}
        <button
          onClick={onRefine}
          disabled={isGenerating || status === 'finalizado' || hasGoogleDoc}
          title={hasGoogleDoc ? 'Refinamento desativado para laudos gerados no Google Docs' : refineLabel}
          className={classNames(
            "h-9 px-5 rounded-xl text-xs font-black uppercase tracking-widest gap-2 shadow-sm transition-all flex items-center justify-center relative overflow-hidden border",
            isGenerating
              ? "bg-ink-100 text-ink-400 border-ink-200 cursor-not-allowed"
              : status === 'finalizado' || hasGoogleDoc
              ? "bg-ink-100 text-ink-400 border-ink-200 opacity-60 cursor-not-allowed"
              : "bg-ink-900 text-white border-ink-800 hover:bg-ink-800 hover:shadow-md active:scale-95"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin text-ink-400" />
              <span className="hidden sm:inline">Gerando...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} className="text-brand-300 fill-brand-300 animate-pulse" />
              <span className="hidden sm:inline">{refineLabel}</span>
            </>
          )}
          {/* Progress shimmer during generation */}
          {isGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
          )}
        </button>

        {/* Prompt preview */}
        <button
          onClick={onShowPrompt}
          className="h-9 px-2.5 bg-white border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 rounded-lg border shadow-sm transition-all flex items-center gap-1.5 text-xs"
          title="Ver prompt enviado à IA"
        >
          <Eye size={13} />
          <span className="hidden lg:inline text-[11px] font-medium">Prompt</span>
        </button>
      </div>

      <div className="w-px h-5 bg-ink-200 shrink-0" />

      {/* ── Zone 2: Utilities ── */}
      <div className="flex items-center gap-1.5">
        {/* Calculators dropdown */}
        {onShowCalculators && (
          <div className="relative">
            <button
              onClick={() => calcShortcuts.length > 0 ? setShowCalcMenu(v => !v) : onShowCalculators()}
              className="h-9 px-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm text-xs font-bold active:scale-95"
              title="Calculadoras Clínicas"
            >
              <Calculator size={13} />
              <span className="hidden md:inline text-[11px]">Calc.</span>
              {calcShortcuts.length > 0 && (
                <ChevronDown size={11} className={classNames("transition-transform", showCalcMenu && "rotate-180")} />
              )}
            </button>

            {showCalcMenu && calcShortcuts.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-ink-200 rounded-xl shadow-lg z-50 min-w-[160px] overflow-hidden">
                <div className="px-3 py-1.5 border-b border-ink-100">
                  <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Calculadoras Rápidas</span>
                </div>
                {calcShortcuts.map(calc => (
                  <button
                    key={calc.calcId}
                    onClick={() => { onShowCalculators(calc.calcId); setShowCalcMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    {calc.label}
                  </button>
                ))}
                <div className="border-t border-ink-100">
                  <button
                    onClick={() => { onShowCalculators(); setShowCalcMenu(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    Ver todas as calculadoras →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <button
          onClick={onShowHistory}
          className="h-9 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-1.5 text-xs active:scale-95"
          title="Histórico clínico do paciente"
        >
          <History size={13} />
          <span className="hidden lg:inline text-[11px]">Histórico</span>
        </button>

        {/* Versions */}
        <button
          onClick={onShowVersions}
          className="h-9 px-2.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 font-bold hover:bg-teal-100 transition-all shadow-sm flex items-center gap-1.5 text-xs active:scale-95"
          title="Versões do laudo"
        >
          <Clock size={13} />
          <span className="hidden lg:inline text-[11px]">Versões</span>
        </button>

        {/* Snippets */}
        {snippetCount > 0 && (
          <button
            onClick={onToggleSnippets}
            className={classNames(
              'h-9 px-2.5 rounded-lg border shadow-sm transition-all flex items-center gap-1.5 text-xs font-bold relative active:scale-95',
              snippetsOpen
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
            )}
            title="Frases prontas"
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline text-[11px]">Frases</span>
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
              {snippetCount > 9 ? '9+' : snippetCount}
            </span>
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-ink-200 shrink-0" />

      {/* ── Zone 3: Export & Danger ── */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onCopy}
          className="h-9 px-2.5 bg-white border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-ink-300 rounded-lg border shadow-sm transition-all flex items-center gap-1.5 text-xs active:scale-95"
          title="Copiar laudo (Ctrl+Shift+C)"
        >
          <Copy size={13} />
          <span className="hidden md:inline text-[11px] font-medium">Copiar</span>
        </button>

        <button
          onClick={onReset}
          disabled={status === 'finalizado'}
          className={classNames(
            "h-9 px-2.5 rounded-lg border shadow-sm transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95",
            status === 'finalizado'
              ? "opacity-50 cursor-not-allowed bg-ink-50 border-ink-200 text-ink-400"
              : "bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
          )}
          title="Reiniciar laudo para o padrão da máscara (Ctrl+Shift+R)"
        >
          <RotateCcw size={13} />
          <span className="hidden md:inline text-[11px]">Reiniciar</span>
        </button>
      </div>

      {/* ── Right: Model + Save State ── */}
      <div className="text-[11px] text-ink-500 flex items-center gap-2 ml-auto">
        {saveState === 'saving' && (
          <>
            <Loader2 size={11} className="animate-spin-slow text-brand-500" />
            <span className="text-brand-600 hidden sm:inline">Salvando...</span>
          </>
        )}
        {saveState === 'saved' && (
          <>
            <CheckCircle2 size={11} className="text-emerald-500" />
            <span className="text-emerald-600 hidden sm:inline">Salvo</span>
          </>
        )}
        {saveState === 'idle' && (
          <>
            <Cloud size={11} className="text-ink-400" />
            <span className="hidden sm:inline">Auto-save</span>
          </>
        )}
        {saveState === 'error' && (
          <>
            <AlertCircle size={11} className="text-red-500" />
            <span className="text-red-500 hidden sm:inline">Erro ao salvar</span>
          </>
        )}

        {/* AI Model badge */}
        {geminiModel && (
          <div className="hidden sm:flex items-center gap-1 bg-ink-50 border border-ink-200 px-2 py-0.5 rounded-lg">
            <Brain size={10} className="text-brand-500" />
            <span className="text-[10px] font-medium text-ink-500 max-w-[80px] truncate">{geminiModel}</span>
          </div>
        )}
      </div>

      {/* Overlay to close calc menu */}
      {showCalcMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowCalcMenu(false)} />
      )}
    </div>
  );
}

