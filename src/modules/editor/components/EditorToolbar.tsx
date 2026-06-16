import { Sparkles, Loader2, Eye, CheckCircle2, Cloud, RotateCcw, History, BookOpen, Clock, Copy } from 'lucide-react';
import { classNames } from '../../../utils/format';

interface EditorToolbarProps {
  isGenerating: boolean;
  hasReport: boolean;
  /** Se o conteúdo atual é apenas a máscara (contém placeholders) → modo Geração Inicial */
  isTemplateMask: boolean;
  status: string;
  onRefine: () => void;
  onShowPrompt: () => void;
  onReset: () => void;
  onShowHistory: () => void;
  onShowVersions: () => void;
  onToggleSnippets: () => void;
  snippetsOpen: boolean;
  snippetCount: number;
  saveState: 'idle' | 'saving' | 'saved';
  geminiModel: string;
  hasGoogleDoc?: boolean;
  onCopy?: () => void;
}

export function EditorToolbar({
  isGenerating,
  hasReport,
  isTemplateMask,
  status,
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
  onCopy
}: EditorToolbarProps) {
  const refineLabel = isTemplateMask ? 'Gerar com Laud.IA' : 'Refinar com Laud.IA';

  return (
    <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0 flex-wrap">
      <button
        onClick={onRefine}
        disabled={isGenerating || status === 'finalizado' || hasGoogleDoc}
        title={hasGoogleDoc ? 'Refinamento desativado para laudos gerados no Google Docs' : ''}
        className={classNames(
          "h-10 px-6 rounded-2xl text-xs font-black uppercase tracking-widest gap-2 shadow-sm transition-all flex items-center justify-center relative overflow-hidden border",
          isGenerating
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 hover:shadow-md active:scale-95"
        )}
      >
        {isGenerating ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : (
          <Sparkles size={16} className="text-brand-300 fill-brand-300 animate-pulse" />
        )}
        {refineLabel}
      </button>

      <button
        onClick={onShowPrompt}
        className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-lg border shadow-sm transition-all flex items-center gap-1.5"
        title="Ver prompt enviado à IA"
      >
        <Eye size={14} /> <span className="hidden sm:inline">Prompt</span>
      </button>

      <button
        onClick={onCopy}
        className="btn-secondary text-xs py-1.5 px-2.5 sm:px-3 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-lg border shadow-sm transition-all flex items-center gap-1.5"
        title="Copiar texto do laudo (Ctrl+Shift+C)"
      >
        <Copy size={14} /> <span className="hidden sm:inline">Copiar Laudo</span>
      </button>

      <button
        onClick={onReset}
        disabled={status === 'finalizado'}
        className={classNames(
          "btn-secondary text-xs py-1.5 px-2.5 sm:px-3 rounded-lg border shadow-sm transition-all flex items-center gap-1.5",
          status === 'finalizado' 
            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400" 
            : "bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
        )}
        title="Reiniciar laudo para o padrão da máscara (Ctrl+Shift+R)"
      >
        <RotateCcw size={14} /> <span className="hidden sm:inline">Reiniciar Máscara</span>
      </button>



      <button
        onClick={onShowHistory}
        className="flex items-center gap-1.5 text-xs py-1.5 px-2.5 sm:px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition-all shadow-sm active:scale-95"
        title="Ver histórico de laudos anteriores do paciente"
      >
        <History size={14} /> <span className="hidden md:inline">Histórico Clínico</span>
      </button>

      <button
        onClick={onShowVersions}
        className="flex items-center gap-1.5 text-xs py-1.5 px-2.5 sm:px-3 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 font-bold hover:bg-teal-100 transition-all shadow-sm active:scale-95"
        title="Ver histórico de versões/alterações do laudo"
      >
        <Clock size={14} /> <span className="hidden md:inline">Versões do Laudo</span>
      </button>


      {snippetCount > 0 && (
        <button
          onClick={onToggleSnippets}
          className={classNames(
            'btn-secondary text-xs py-1.5 px-2.5 relative transition-all',
            snippetsOpen
              ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
          )}
          title="Frases prontas"
        >
          <BookOpen size={14} />
          <span className="hidden sm:inline">Frases</span>
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
            {snippetCount > 9 ? '9+' : snippetCount}
          </span>
        </button>
      )}

      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 ml-auto font-medium">
        {saveState === 'saving' && (
          <>
            <Loader2 size={11} className="animate-spin-slow text-brand-500" />
            <span className="text-brand-600">Salvando...</span>
          </>
        )}
        {saveState === 'saved' && (
          <>
            <CheckCircle2 size={11} className="text-emerald-500" />
            <span className="text-emerald-600">Salvo</span>
          </>
        )}
        {saveState === 'idle' && (
          <>
            <Cloud size={11} className="text-slate-400" />
            <span>Auto-save</span>
          </>
        )}
      </div>

      <span className="hidden sm:inline text-[11px] font-medium text-slate-400">{geminiModel}</span>
    </div>
  );
}
