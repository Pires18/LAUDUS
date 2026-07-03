import { useState, useRef } from 'react';
import { Check, Code, Copy, RotateCcw } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { logger } from '../../../utils/logger';

// Editor de código/prompt cognitivo — extraído de SharedLaudIA (autocontido).
function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function TokenBadge({ value }: { value: string }) {
  const tokens = estimatePromptTokens(value);
  const color = tokens < 2000 ? 'text-emerald-400' : tokens < 4000 ? 'text-amber-400' : 'text-rose-400';
  const bgColor = tokens < 2000 ? 'bg-emerald-500/10' : tokens < 4000 ? 'bg-amber-500/10' : 'bg-rose-500/10';
  const barWidth = Math.min(100, (tokens / 6000) * 100);
  const barColor = tokens < 2000 ? 'bg-emerald-500' : tokens < 4000 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className={classNames("text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg", bgColor, color)}>
        ~{tokens.toLocaleString('pt-BR')} tokens
      </div>
      <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={classNames("h-full rounded-full transition-all", barColor)} style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  );
}

// ==========================================
// HIGH-FIDELITY IDE CODE EDITOR COMPONENT
// ==========================================
interface CognitiveCodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  fileName: string;
  badge?: string;
  placeholder?: string;
  rows?: number;
  onRestore?: () => void;
  glowColor?: 'brand' | 'amber' | 'rose' | 'emerald' | 'violet' | 'teal';
  readOnly?: boolean;
}

export function CognitiveCodeEditor({
  value = '',
  onChange,
  fileName,
  badge = 'CONFIG FILE',
  placeholder = 'Digite as instruções aqui...',
  rows = 12,
  onRestore,
  glowColor = 'brand',
  readOnly = false,
}: CognitiveCodeEditorProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const lineCount = Math.max(value.split('\n').length, rows);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const glowStyles = {
    brand: 'focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.15)] border-zinc-800 focus-within:border-brand-500/50',
    amber: 'focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:shadow-[0_0_30px_rgba(245,158,11,0.15)] border-zinc-800 focus-within:border-amber-500/50',
    rose: 'focus-within:ring-2 focus-within:ring-rose-500/30 focus-within:shadow-[0_0_30px_rgba(244,63,94,0.15)] border-zinc-800 focus-within:border-rose-500/50',
    emerald: 'focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.15)] border-zinc-800 focus-within:border-emerald-500/50',
    violet: 'focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:shadow-[0_0_30px_rgba(139,92,246,0.15)] border-zinc-800 focus-within:border-violet-500/50',
    teal: 'focus-within:ring-2 focus-within:ring-teal-500/30 focus-within:shadow-[0_0_30px_rgba(20,184,166,0.15)] border-zinc-800 focus-within:border-teal-500/50',
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Erro ao copiar para clipboard:', err);
    }
  };

  return (
    <div className={classNames(
      "bg-zinc-950 rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col shadow-xl",
      glowStyles[glowColor]
    )}>
      {/* Header bar */}
      <div className="bg-zinc-900/90 px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Dots */}
          <div className="flex gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/85" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/85" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/85" />
          </div>
          {/* File tab */}
          <div className="bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800/80 flex items-center gap-1.5">
            <Code size={12} className="text-zinc-400" />
            <span className="text-xs font-mono font-semibold text-zinc-200">{fileName}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-[9px] font-black tracking-widest text-zinc-400 uppercase hidden sm:inline">
            {badge}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && onRestore && (
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95"
              title="Restaurar padrão oficial do sistema"
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline">Restaurar</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-all"
            title="Copiar código"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div
        className="flex font-mono text-xs relative bg-zinc-950"
        style={{ minHeight: '280px', maxHeight: '65vh' }}
      >
        {/* Line Numbers */}
        <div
          ref={lineRef}
          className="w-10 py-4 select-none text-right pr-2 text-zinc-600 bg-zinc-950 border-r border-zinc-900 overflow-y-hidden font-mono shrink-0"
        >
          {lineNumbers.map((n) => (
            <div key={n} className="h-6 leading-6 text-[10px]">{String(n).padStart(2, '0')}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea readOnly={readOnly} disabled={readOnly}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (lineRef.current) {
              lineRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          className="flex-1 py-4 px-4 bg-transparent border-0 focus:ring-0 focus:outline-none text-zinc-300 font-mono text-xs leading-6 resize-y overflow-y-auto selection:bg-brand-500/20 selection:text-white"
          placeholder={placeholder}
          style={{ lineHeight: '24px', minHeight: '280px', maxHeight: '65vh' }}
        />
      </div>

      {/* Footer Status Bar */}
      <div className="bg-zinc-900/60 px-4 py-2 flex items-center justify-between border-t border-zinc-900 text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span className="hidden sm:inline">Markdown / Prompt</span>
        </div>
        <div className="flex items-center gap-3">
          <TokenBadge value={value} />
          <span className="hidden md:inline">L: {value.split('\n').length}</span>
        </div>
      </div>
    </div>
  );
}

