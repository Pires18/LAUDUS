import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/app';
import {
  BrainCircuit, ShieldAlert,
  RotateCcw, Zap, Save,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, ShieldCheck,
  FlaskConical, Play, FileText, History,
  Terminal, Code, Copy, Check, Cpu, Key, Eye, EyeOff,
  Activity, BarChart3, Database, Coins, Clock, Sparkles,
  ChevronDown, ChevronUp, Wifi, WifiOff, TrendingUp,
  GitCompare, Download, Search, Filter, SlidersHorizontal,
  Brain, CheckSquare, XCircle, User, ChevronRight, Trash2
} from 'lucide-react';

import { classNames } from '../../utils/format';
import { resolveGeminiModel } from '../ai/engine';
import { logger } from '../../utils/logger';
import { generateReport, generateReportStream, callMetricsHistory, type CallMetrics, getAnthropicBaseUrl, auditReportQuality } from '../ai/engine';
import { EXAM_AREAS, ExamArea, ReportTemplate, Patient } from '../../types';
import {
  DEFAULT_MASTER_PROMPT,
  DEFAULT_STRUCTURE_PROMPT,
  DEFAULT_GLOBAL_INSTRUCTIONS,
  DEFAULT_RIGID_RULES,
  DEFAULT_REFINEMENT_GOLDEN_RULES,
  DEFAULT_COPILOT_OVERRIDE,
  DEFAULT_AREA_PROMPTS,
} from '../ai/prompts';
import { useCollection } from '../../hooks/useFirestore';
import { updateItem } from '../../store/db';

type TabId = 'prompts' | 'templates' | 'engine' | 'training' | 'status';

// ─── Token estimator helper ───────────────────────────────────────────────────
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
  extraActions?: React.ReactNode;
  readOnly?: boolean;
}

function CognitiveCodeEditor({
  value = '',
  onChange,
  fileName,
  badge = 'CONFIG FILE',
  placeholder = 'Digite as instruções aqui...',
  rows = 12,
  onRestore,
  glowColor = 'brand',
  extraActions,
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
      "bg-zinc-950 rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col shadow-2xl",
      glowStyles[glowColor]
    )}>
      {/* Header bar */}
      <div className="bg-zinc-900/90 px-6 py-4 flex items-center justify-between border-b border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Windows Dots */}
          <div className="flex gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/85 hover:bg-rose-600 transition-colors cursor-pointer" />
            <span className="w-3 h-3 rounded-full bg-amber-500/85 hover:bg-amber-600 transition-colors cursor-pointer" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/85 hover:bg-emerald-600 transition-colors cursor-pointer" />
          </div>

          {/* Active File Tab */}
          <div className="bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800/80 flex items-center gap-2">
            <Code size={13} className="text-zinc-400" />
            <span className="text-xs font-mono font-semibold text-zinc-200">{fileName}</span>
          </div>

          <span className="px-2.5 py-0.5 rounded-lg bg-zinc-800/80 text-[9px] font-black tracking-widest text-zinc-400 uppercase">
            {badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {extraActions}
          {!readOnly && onRestore && (
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95"
              title="Restaurar padrão oficial do sistema"
            >
              <RotateCcw size={12} />
              Restaurar Padrão
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-xl transition-all"
            title="Copiar código"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Editor Body — altura dinâmica */}
      <div
        className="flex font-mono text-xs relative bg-zinc-950"
        style={{ minHeight: '300px', maxHeight: '70vh' }}
      >
        {/* Line Numbers Sidebar */}
        <div
          ref={lineRef}
          className="w-12 py-4 select-none text-right pr-3 text-zinc-600 bg-zinc-950 border-r border-zinc-900 overflow-y-hidden font-mono"
        >
          {lineNumbers.map((n) => (
            <div key={n} className="h-6 leading-6 text-[10px] pr-0.5">{String(n).padStart(2, '0')}</div>
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
          className="flex-1 py-4 px-5 bg-transparent border-0 focus:ring-0 focus:outline-none text-zinc-300 font-mono text-xs leading-6 resize-y overflow-y-auto selection:bg-brand-500/20 selection:text-white"
          placeholder={placeholder}
          style={{ lineHeight: '24px', minHeight: '300px', maxHeight: '70vh' }}
        />
      </div>

      {/* Footer Status Bar com contador de tokens */}
      <div className="bg-zinc-900/60 px-6 py-2.5 flex items-center justify-between border-t border-zinc-900 text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>Markdown / Prompt</span>
        </div>
        <div className="flex items-center gap-4">
          <TokenBadge value={value} />
          <span>LINES: {value.split('\n').length}</span>
          <span>CHARS: {value.length.toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TELEMETRY DASHBOARD COMPONENT
// ==========================================
function TelemetryDashboard({
  modeFilter = 'all',
  conversionRate = 5.5,
}: {
  modeFilter?: string;
  conversionRate?: number;
}) {
  const [metrics, setMetrics] = useState<CallMetrics[]>([]);
  const [expandedMetricIndex, setExpandedMetricIndex] = useState<number | null>(null);

  useEffect(() => {
    setMetrics([...callMetricsHistory]);
    const interval = setInterval(() => {
      setMetrics([...callMetricsHistory]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredMetrics = modeFilter === 'all' ? metrics : metrics.filter(m => m.mode === modeFilter);

  // Export CSV
  const handleExportCsv = () => {
    const rows = [
      ['Modo','Provider','Modelo','Area','Tokens In','Tokens Out','Latência (ms)','Custo USD','Custo BRL','Sucesso','Timestamp'],
      ...filteredMetrics.map(m => {
        const PRICING_REF: Record<string, { input: number; output: number }> = {
          'claude-3-5-sonnet-latest':    { input: 3.0, output: 15.0 },
          'claude-3-7-sonnet-latest':    { input: 3.0, output: 15.0 },
          'claude-opus-4-5':             { input: 15.0, output: 75.0 },
          'gemini-3.5-flash':            { input: 0.075, output: 0.30 },
          'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.60 },
          'gemini-2.5-pro-preview-06-05':   { input: 1.25, output: 10.0 },
        };
        const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
        const costUsd = ((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output);
        const costBrl = costUsd * conversionRate;
        return [
          m.mode, m.provider, m.modelName || '', m.area,
          m.estimatedInputTokens, m.estimatedOutputTokens,
          m.latencyMs, costUsd.toFixed(6), costBrl.toFixed(4),
          m.success ? 'sim' : 'não',
          new Date(m.timestamp).toLocaleString('pt-BR')
        ];
      })
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laudia_telemetria_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (filteredMetrics.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 text-center w-full">
        <BarChart3 size={32} className="text-ink-300 mx-auto mb-3" />
        <p className="font-black text-ink-500 text-sm">{modeFilter === 'all' ? 'Nenhuma chamada de IA registrada ainda.' : `Nenhuma chamada de modo "${modeFilter}" registrada.`}</p>
        <p className="text-xs text-ink-400 mt-1">As métricas aparecerão aqui após gerar o primeiro laudo.</p>
      </div>
    );
  }

  const totalTokensIn = filteredMetrics.reduce((s, m) => s + m.estimatedInputTokens, 0);
  const totalTokensOut = filteredMetrics.reduce((s, m) => s + m.estimatedOutputTokens, 0);
  const avgLatency = filteredMetrics.length > 0 ? Math.round(filteredMetrics.reduce((s, m) => s + m.latencyMs, 0) / filteredMetrics.length) : 0;
  const successRate = filteredMetrics.length > 0 ? Math.round((filteredMetrics.filter(m => m.success).length / filteredMetrics.length) * 100) : 0;

  // Custo total estimado em BRL
  const PRICING_REF: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 },
    'claude-3-7-sonnet-latest': { input: 3.0, output: 15.0 },
    'claude-opus-4-5': { input: 15.0, output: 75.0 },
    'gemini-3.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.60 },
    'gemini-2.5-pro-preview-06-05': { input: 1.25, output: 10.0 },
  };
  const totalCostUsd = filteredMetrics.reduce((s, m) => {
    const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
    return s + ((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output);
  }, 0);
  const totalCostBrl = totalCostUsd * conversionRate;

  const modeColors: Record<string, string> = {
    generation: 'bg-brand-100 text-brand-700',
    refine: 'bg-amber-100 text-amber-700',
    copilot: 'bg-violet-100 text-violet-700',
    template: 'bg-teal-100 text-teal-700',
  };
  const modeLabels: Record<string, string> = {
    generation: 'Geração',
    refine: 'Refinamento',
    copilot: 'Copiloto',
    template: 'Template',
  };

  return (
    <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden w-full">
      <div className="p-6 border-b border-ink-100 bg-ink-50/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <BarChart3 size={20} />
          </div>
          <div>
            <h5 className="font-black text-ink-900">Telemetria de Chamadas</h5>
            <p className="text-[10px] text-ink-500 uppercase font-bold tracking-widest mt-0.5">
              {filteredMetrics.length} chamada{filteredMetrics.length !== 1 ? 's' : ''} {modeFilter !== 'all' ? `• modo: ${modeLabels[modeFilter] || modeFilter}` : '• todos os modos'}
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300"
          title="Exportar CSV"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-5 gap-px bg-ink-100">
        {[
          { label: 'Tokens In', value: totalTokensIn.toLocaleString('pt-BR'), icon: Database, color: 'brand' },
          { label: 'Tokens Out', value: totalTokensOut.toLocaleString('pt-BR'), icon: Coins, color: 'emerald' },
          { label: 'Latência Média', value: `${(avgLatency / 1000).toFixed(1)}s`, icon: Clock, color: 'amber' },
          { label: 'Taxa de Sucesso', value: `${successRate}%`, icon: CheckCircle2, color: successRate >= 90 ? 'emerald' : 'rose' },
          { label: 'Custo Total (BRL)', value: `R$ ${totalCostBrl.toFixed(4)}`, icon: TrendingUp, color: 'violet' },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-5 text-center">
            <stat.icon size={18} className={`text-${stat.color}-500 mx-auto mb-2`} />
            <span className={`text-xl font-black text-${stat.color}-700 block`}>{stat.value}</span>
            <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Log das últimas chamadas */}
      <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
        {filteredMetrics.slice(0, 15).map((m, i) => {
          const p = m.modelName ? (PRICING_REF[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
          const costBrl = (((m.estimatedInputTokens / 1e6) * p.input) + ((m.estimatedOutputTokens / 1e6) * p.output)) * conversionRate;
          return (
            <div key={i} className="flex flex-col gap-2">
              <div className={classNames(
                'flex items-center gap-3 p-3 rounded-2xl border text-xs',
                m.success ? 'bg-ink-50/60 border-ink-100' : 'bg-rose-50 border-rose-100'
              )}>
                <div className={classNames('px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0', modeColors[m.mode] || 'bg-ink-100 text-ink-600')}>
                  {modeLabels[m.mode] || m.mode}
                </div>
                <span className="text-[10px] font-mono text-ink-600 shrink-0">{m.area || '—'}</span>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span className="text-ink-500 shrink-0">↑ {m.estimatedInputTokens.toLocaleString('pt-BR')} tok</span>
                  <span className="text-ink-500 shrink-0">↓ {m.estimatedOutputTokens.toLocaleString('pt-BR')} tok</span>
                  <span className="text-ink-500 shrink-0">{(m.latencyMs / 1000).toFixed(1)}s</span>
                  {costBrl > 0 && <span className="text-violet-600 shrink-0 font-bold">R$ {costBrl.toFixed(4)}</span>}
                </div>
                <span className={classNames('text-[9px] font-black uppercase tracking-widest shrink-0 px-2 py-0.5 rounded-lg',
                  m.provider === 'gemini' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                )}>{m.provider}</span>
                {m.scratchpad && (
                  <button
                    onClick={() => setExpandedMetricIndex(expandedMetricIndex === i ? null : i)}
                    className="px-2 py-1 bg-white border border-ink-200 rounded text-ink-600 text-[10px] font-bold hover:bg-ink-50 transition-all shrink-0"
                  >
                    {expandedMetricIndex === i ? 'Ocultar Raciocínio' : 'Auditar Raciocínio'}
                  </button>
                )}
                {m.success
                  ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  : <AlertCircle size={14} className="text-rose-500 shrink-0" />}
              </div>
              {expandedMetricIndex === i && m.scratchpad && (
                <div className="p-4 bg-ink-900 text-ink-300 font-mono text-[10px] rounded-xl overflow-x-auto shadow-inner border border-ink-800">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ink-800">
                    <BrainCircuit size={14} className="text-brand-500" />
                    <span className="font-black text-ink-400 uppercase tracking-widest">Memória Transitória (<span className="text-brand-500">Scratchpad</span>)</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{m.scratchpad}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// MAIN ADMIN LAUD.IA CENTER
// ==========================================
export function SharedLaudIA({ readOnly = false }: { readOnly?: boolean }) {
  const { settings, updateSettings, showToast } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);
  const [activePromptSubTab, setActivePromptSubTab] = useState<'master' | 'global' | 'structure' | 'rigid' | 'refinement' | 'copilot'>('master');

  // ── Versionamento de prompts (localStorage, 5 versões por bloco)
  const getPromptVersionKey = (block: string) => `laudia_prompt_versions_${block}`;
  const savePromptVersion = useCallback((block: string, value: string) => {
    try {
      const key = getPromptVersionKey(block);
      const existing: Array<{ value: string; timestamp: number }> = JSON.parse(localStorage.getItem(key) || '[]');
      // Evita duplicata da versão mais recente
      if (existing.length > 0 && existing[0].value === value) return;
      const updated = [{ value, timestamp: Date.now() }, ...existing].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  }, []);
  const getPromptVersions = useCallback((block: string): Array<{ value: string; timestamp: number }> => {
    try {
      return JSON.parse(localStorage.getItem(getPromptVersionKey(block)) || '[]');
    } catch { return []; }
  }, []);

  // ── Diff visual: estado para o par original/novo ao melhorar com IA
  interface PromptDiff { original: string; improved: string; block: string; }
  const [pendingDiff, setPendingDiff] = useState<PromptDiff | null>(null);

  // ── Telemetria: filtro por modo e conversão BRL
  const [telemetryModeFilter, setTelemetryModeFilter] = useState<string>('all');
  const conversionRate = localSettings.aiConversionRateBRL ?? 5.5;

  const { data: templates } = useCollection<ReportTemplate>('templates');
  const { data: exams } = useCollection<any>('exams');
  const finalizedCount = exams.filter(e => e.status === 'finalizado').length;
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<ExamArea | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editingTemplatePrompt, setEditingTemplatePrompt] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);


  const [templateSubTab, setTemplateSubTab] = useState<'exams' | 'area'>('exams');
  const [editingAreaPrompt, setEditingAreaPrompt] = useState<string>('');
  
  // Playground States
  const [playgroundNotes, setPlaygroundNotes] = useState<string>(
    "Vesícula biliar normodistendida, apresentando cálculo móvel de 1,2 cm em seu interior, sem espessamento de paredes. Restante do abdome superior sem alterações."
  );
  const [isPlayinggroundTesting, setIsPlaygroundTesting] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState('');
  const [playgroundScratchpad, setPlaygroundScratchpad] = useState('');
  const [playgroundScore, setPlaygroundScore] = useState<any>(null);
  const [showPlayground, setShowPlayground] = useState(false);

  // Sync selected template prompt when selection changes or templates load
  useEffect(() => {
    if (templates.length > 0) {
      const filtered = selectedAreaFilter
        ? templates.filter(t => t.area === selectedAreaFilter)
        : templates;
      
      const currentExists = filtered.some(t => t.id === selectedTemplateId);
      if (!currentExists && filtered.length > 0) {
        setSelectedTemplateId(filtered[0].id);
      } else if (selectedTemplateId) {
        const template = templates.find(t => t.id === selectedTemplateId);
        setEditingTemplatePrompt(template?.aiInstructions || '');
      }
    }
  }, [selectedTemplateId, templates, selectedAreaFilter]);

  useEffect(() => {
    if (selectedAreaFilter) {
      setEditingAreaPrompt(localSettings.aiAreaPrompts?.[selectedAreaFilter] || DEFAULT_AREA_PROMPTS[selectedAreaFilter] || '');
    } else {
      setEditingAreaPrompt('');
    }
  }, [selectedAreaFilter, localSettings.aiAreaPrompts]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template?.name.toLowerCase().includes('tireoide')) {
        setPlaygroundNotes("Nódulo hipoecoico, sólido, contornos regulares, no terço médio do lobo direito, medindo 1,5 x 1,2 x 1,0 cm, sem microcalcificações.");
      } else if (template?.name.toLowerCase().includes('mama')) {
        setPlaygroundNotes("Nódulo sólido, espiculado, mais alto do que largo, medindo 1,8 cm no quadrante superior externo da mama esquerda. Linfonodos axilares normais.");
      } else if (template?.name.toLowerCase().includes('obstetr') || template?.name.toLowerCase().includes('fetal')) {
        setPlaygroundNotes("Feto único, cefálico. DUM de 20 semanas atrás. Medidas: DBP 50mm, CC 180mm, CA 150mm, Femur 32mm. Doppler da artéria umbilical com IP 0.95 e ACM com IP 1.45.");
      } else {
        setPlaygroundNotes("Vesícula biliar normodistendida, com cálculo móvel de 1,2 cm, sem espessamento parietal. Rins, pâncreas e baço normais.");
      }
    }
  }, [selectedTemplateId, templates]);

  async function handleSaveAreaPrompt() {
    if (!selectedAreaFilter) return;
    setIsSavingTemplate(true);
    try {
      const updatedAreaPrompts = {
        ...(localSettings.aiAreaPrompts || {}),
        [selectedAreaFilter]: editingAreaPrompt,
      };
      const nextSettings = {
        ...localSettings,
        aiAreaPrompts: updatedAreaPrompts,
      };
      setLocalSettings(nextSettings);
      await updateSettings(nextSettings);
      showToast('Diretriz da área salva com sucesso! ✓', 'success');
    } catch {
      showToast('Erro ao salvar diretriz da área', 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleRunPlaygroundTest() {
    if (!selectedTemplateId) {
      showToast('Selecione um exame para testar.', 'error');
      return;
    }
    
    setIsPlaygroundTesting(true);
    setPlaygroundResult('');
    setPlaygroundScratchpad('');
    setPlaygroundScore(null);
    
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) throw new Error('Template não encontrado');
      
      const tempTemplate = {
        ...template,
        aiInstructions: editingTemplatePrompt,
      };
      
      const tempAreaPrompts = {
        ...(localSettings.aiAreaPrompts || {}),
      };
      if (selectedAreaFilter) {
        tempAreaPrompts[selectedAreaFilter] = editingAreaPrompt;
      }
      const tempSettings = {
        ...localSettings,
        aiAreaPrompts: tempAreaPrompts,
      };
      
      const dummyPatient: Patient = {
        id: 'dummy',
        name: 'Paciente Teste',
        birthDate: '1985-05-15', // 41 anos
        gender: 'F',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: 'Paciente feminina, 41 anos, sem histórico oncológico.'
      };
      
      const testResult = await generateReport({
        template: tempTemplate,
        patient: dummyPatient,
        clinicalIndication: playgroundNotes || 'Indicação clínica de teste',
        settings: tempSettings,
        examDateMs: Date.now(),
      });
      
      setPlaygroundResult(testResult);
      
      // Obter scratchpad da métrica que acabou de ser salva
      if (callMetricsHistory.length > 0) {
        const lastMetric = callMetricsHistory[0];
        if (lastMetric.scratchpad) {
          setPlaygroundScratchpad(lastMetric.scratchpad);
        }
      }
      
      // Rodar auditoria
      const scoreData = auditReportQuality(testResult, template.area);
      setPlaygroundScore(scoreData);
      showToast('Laudo simulado com sucesso!', 'success');
    } catch (err) {
      logger.error('Erro ao simular laudo:', err);
      showToast('Erro ao simular laudo: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsPlaygroundTesting(false);
    }
  }

  function handleInjectDirective(snippet: string) {
    setEditingTemplatePrompt(prev => prev ? `${prev}\n\n${snippet}` : snippet);
    showToast('Diretriz de padronização adicionada! ✓', 'success');
  }

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      showToast('Configurações da IA salvas com sucesso', 'success');
    } catch {
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTemplatePrompt() {
    if (!selectedTemplateId) return;
    setIsSavingTemplate(true);
    try {
      await updateItem('templates', selectedTemplateId, {
        aiInstructions: editingTemplatePrompt,
      });
      showToast('Prompt do exame salvo com sucesso! ✓', 'success');
    } catch {
      showToast('Erro ao salvar prompt do exame', 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  }

  // ── Restore/Clear helpers para versionamento V2.0 ─────────────────────────

  function handleRestoreAreaPromptDefault() {
    if (!selectedAreaFilter) return;
    if (!window.confirm('Restaurar a diretriz desta área para o padrão V2.0 do sistema? Sua versão customizada será perdida.')) return;
    setEditingAreaPrompt(DEFAULT_AREA_PROMPTS[selectedAreaFilter] || '');
    const updatedAreaPrompts = { ...(localSettings.aiAreaPrompts || {}) };
    delete (updatedAreaPrompts as Record<string, string>)[selectedAreaFilter];
    const nextSettings = { ...localSettings, aiAreaPrompts: updatedAreaPrompts };
    setLocalSettings(nextSettings);
    updateSettings(nextSettings)
      .then(() => showToast('Diretriz restaurada para o padrão V2.0 do sistema.', 'success'))
      .catch(() => showToast('Erro ao restaurar diretriz.', 'error'));
  }

  function handleClearExamPrompt() {
    if (!selectedTemplateId) return;
    if (!window.confirm('Limpar as instruções específicas deste exame? O exame passará a herdar apenas a Diretriz de Área e a Doutrina Universal.')) return;
    const backupKey = `laudia_backup_exam_${selectedTemplateId}`;
    if (editingTemplatePrompt.trim()) {
      localStorage.setItem(backupKey, editingTemplatePrompt);
    }
    setEditingTemplatePrompt('');
    updateItem('templates', selectedTemplateId, { aiInstructions: '' })
      .then(() => showToast('Instruções limpas. Backup salvo localmente (recuperável).', 'info'))
      .catch(() => showToast('Erro ao limpar prompt do exame.', 'error'));
  }

  function handleRestoreExamPromptFromBackup() {
    if (!selectedTemplateId) return;
    const backupKey = `laudia_backup_exam_${selectedTemplateId}`;
    const backup = localStorage.getItem(backupKey);
    if (!backup) {
      showToast('Nenhum backup local encontrado para este exame.', 'info');
      return;
    }
    setEditingTemplatePrompt(backup);
    showToast('Rascunho anterior restaurado. Clique em Salvar para confirmar.', 'success');
  }


  async function testConnection() {
    const provider = localSettings.aiProvider || 'anthropic';
    const apiKey = (provider === 'anthropic'
      ? (localSettings.anthropicApiKey || settings?.anthropicApiKey)
      : (localSettings.geminiApiKey || settings?.geminiApiKey))?.trim();

    if (provider === 'gemini') {
      if (!apiKey) {
        showToast('Insira a API Key do Gemini primeiro', 'error');
        return;
      }
      setTestStatus('testing');
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: resolveGeminiModel(localSettings.geminiModel) });
        const result = await model.generateContent('Responda apenas: OK');
        const text = result.response.text();
        if (text) {
          setTestStatus('success');
          showToast('Conexão validada com sucesso com o Gemini!', 'success');
        }
      } catch (err: unknown) {
        setTestStatus('error');
        const msg = err instanceof Error ? err.message : String(err);
        showToast('Falha na conexão: ' + msg, 'error');

        // Diagnóstico: listar modelos disponíveis
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          // O SDK do JS não tem listModels() direto na instância em versões mais antigas,
          // mas vamos tentar usar a REST API via fetch para listar modelos e mostrar no console
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const data = await response.json();
          if (data && data.models) {
            const modelNames = data.models.map((m: any) => m.name.replace('models/', '')).filter((n: string) => n.includes('gemini'));
            logger.info('Modelos Gemini disponíveis para esta chave:', modelNames);
            showToast('Modelos suportados pela sua chave: ' + modelNames.slice(0, 5).join(', ') + '...', 'info');
          }
        } catch (diagErr) {
          logger.error('Erro no diagnóstico:', diagErr);
        }
      }
    } else {
      if (!apiKey) {
        showToast('Insira a API Key do Anthropic primeiro', 'error');
        return;
      }
      setTestStatus('testing');
      try {
        const response = await fetch(`${getAnthropicBaseUrl()}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15, output-128k-2025-02-19',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: localSettings.anthropicModel || 'claude-3-5-sonnet-latest',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 1
          })
        });
        if (response.status === 200 || response.status === 400 || response.status === 401) {
          if (response.status === 401) {
            setTestStatus('error');
            showToast('Chave Anthropic Inválida', 'error');
          } else {
            setTestStatus('success');
            showToast('Conexão validada com a Anthropic!', 'success');
          }
        } else {
          setTestStatus('error');
          showToast('Erro ao contatar API da Anthropic', 'error');
        }
      } catch (err: unknown) {
        setTestStatus('error');
        const msg = err instanceof Error ? err.message : 'Erro de rede';
        showToast(`Falha na conexão: ${msg}`, 'error');
      }
    }
  }

  const renderPlayground = () => {
    return (
      <div className="bg-zinc-950 rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden mt-8">
        <button
          type="button"
          onClick={() => setShowPlayground(!showPlayground)}
          className="w-full px-8 py-5 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all border-b border-zinc-900"
        >
          <div className="flex items-center gap-3">
            <FlaskConical className="text-violet-500 animate-pulse" size={22} />
            <div>
              <h5 className="text-xs font-black text-zinc-100 uppercase tracking-wider">🔬 Playground de Teste Rápido (Simulação)</h5>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Teste e refine suas diretrizes simulando a IA em tempo real</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] rounded-xl font-black uppercase tracking-widest border border-zinc-800">
            {showPlayground ? 'Recolher' : 'Expandir Playground'}
          </span>
        </button>

        {showPlayground && (
          <div className="p-5 sm:p-8 space-y-6 text-zinc-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Pane: Notes Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Notas Clínicas do Médico (Input do Teste)</label>
                  {/* Select template dropdown for testing when in Area sub-tab */}
                  {templateSubTab === 'area' && selectedAreaFilter && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">Exame de Teste:</span>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-xl text-[10px] px-2 py-1 focus:ring-1 focus:ring-violet-500/30 font-bold"
                      >
                        <option value="">Selecione um exame...</option>
                        {templates
                          .filter(t => t.area === selectedAreaFilter)
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
                <textarea
                  value={playgroundNotes}
                  onChange={(e) => setPlaygroundNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-zinc-850 bg-zinc-900/40 text-zinc-200 text-xs p-4 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-550 placeholder-zinc-700 resize-none font-semibold leading-relaxed"
                  placeholder="Digite notas médicas de teste. Ex: fígado ok, vesícula com cálculo de 12mm móvel..."
                />
                
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="text-[10px] text-zinc-500 font-mono font-semibold">
                    Paciente Simulado: F, 41 anos
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleRunPlaygroundTest}
                    disabled={isPlayinggroundTesting || !selectedTemplateId}
                    className="px-5 py-3 bg-violet-600 hover:bg-violet-750 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-violet-900/10 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isPlayinggroundTesting ? (
                      <><Loader2 size={13} className="animate-spin" /> Simulando...</>
                    ) : (
                      <><Play size={13} /> Simular Laudo</>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Pane: Quality Score & Feedback */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-4 flex flex-col justify-between min-h-[180px]">
                {isPlayinggroundTesting ? (
                  <div className="flex flex-col items-center justify-center py-8 text-zinc-500 font-mono text-[11px] h-full my-auto">
                    <Loader2 size={28} className="animate-spin text-violet-500 mb-3" />
                    <span>Chamando inteligência artificial em segundo plano...</span>
                  </div>
                ) : playgroundResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Resultado da Auditoria</span>
                      {playgroundScore && (
                        <span className={classNames(
                          "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm",
                          playgroundScore.score >= 90 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" :
                          playgroundScore.score >= 75 ? "bg-amber-950/60 text-amber-400 border border-amber-900/50" :
                          "bg-rose-950/60 text-rose-400 border border-rose-900/50"
                        )}>
                          Nota: {playgroundScore.score}/100
                        </span>
                      )}
                    </div>
                    
                    {playgroundScore && playgroundScore.issues.length > 0 ? (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {playgroundScore.issues.map((issue: any, index: number) => (
                          <div key={index} className={classNames(
                            "flex items-start gap-2.5 p-2.5 rounded-xl text-xs font-semibold border",
                            issue.severity === 'error' ? "bg-rose-950/30 text-rose-350 border-rose-900/20" : "bg-amber-950/30 text-amber-350 border-amber-900/20"
                          )}>
                            <AlertCircle size={14} className="mt-0.5 shrink-0 text-current" />
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 rounded-xl text-xs font-semibold">
                        <CheckCircle2 size={15} className="shrink-0 animate-fade-in" />
                        <span>Nenhum erro de conformidade ou placeholder órfão detectado!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-zinc-500 font-mono text-[11px] text-center h-full my-auto">
                    <Sparkles size={24} className="text-zinc-800 mb-2" />
                    <span>Simulação inativa. Digite notas clínicas e clique em <strong>Simular Laudo</strong> para testar as diretrizes locais da IA.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Split Display of HTML Report vs Scratchpad thought */}
            {playgroundResult && !isPlayinggroundTesting && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-zinc-900">
                {/* Left: Rendered report */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Laudo Final (Visualização HTML)</span>
                  <div className="bg-white text-zinc-900 rounded-3xl border border-zinc-850 p-6 shadow-inner max-h-[350px] overflow-y-auto prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: playgroundResult }} />
                  </div>
                </div>

                {/* Right: Thought log */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Raciocínio Clínico Realizado (Scratchpad)</span>
                  <div className="bg-zinc-900/60 text-zinc-400 font-mono text-[10px] rounded-3xl border border-zinc-850 p-6 shadow-inner max-h-[350px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {playgroundScratchpad || "Nenhum bloco de pensamento foi capturado na resposta."}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };



  const sidebarItems = [
    {
      id: 'prompts' as const,
      label: 'Doutrina & Prompts',
      icon: ShieldAlert,
      desc: 'Motor cognitivo',
      color: 'indigo',
      count: 6,
    },
    {
      id: 'templates' as const,
      label: 'Prompts por Exame',
      icon: LayoutList,
      desc: 'Diretrizes específicas',
      color: 'emerald',
      count: templates.length,
    },
    {
      id: 'engine' as const,
      label: 'Motor & API',
      icon: Cpu,
      desc: 'Modelos e conexão',
      color: 'brand',
      count: null,
    },
    {
      id: 'training' as const,
      label: 'Aprendizado',
      icon: GraduationCap,
      desc: 'Contexto e estilo',
      color: 'amber',
      count: finalizedCount,
    },
    {
      id: 'status' as const,
      label: 'Telemetria',
      icon: BarChart3,
      desc: 'Uso e custos',
      color: 'violet',
      count: callMetricsHistory.length,
    },
  ];

  const providerName = localSettings.aiProvider === 'anthropic'
    ? (localSettings.anthropicModel || 'claude-3-5-sonnet-latest').replace('claude-', 'Claude ').replace('-latest', '').replace('-sonnet', ' Sonnet').replace('-opus', ' Opus')
    : (localSettings.geminiModel || 'gemini-3.5-flash').replace('gemini-', 'Gemini ').replace('-preview', '').replace('-flash', ' Flash').replace('-pro', ' Pro');

  const providerIcon = localSettings.aiProvider === 'anthropic' ? '🤖' : '✨';
  const hasApiKey = localSettings.aiProvider === 'anthropic'
    ? !!localSettings.anthropicApiKey
    : !!localSettings.geminiApiKey;

  return (
    <div className="animate-fade-in pb-16" style={{ minHeight: '100vh' }}>

      {/* ═══════════════════════════════════════════════════════════════
          HERO HEADER — Premium light dashboard card
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative mb-8 rounded-[2rem] overflow-hidden border border-ink-200 shadow-sm">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-50 via-white to-ink-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.04)_0%,transparent_60%)]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        <div className="relative p-7 md:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

            {/* Left — Identity */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/10">
                  <BrainCircuit size={30} className="text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-600 text-[9px] font-black uppercase tracking-widest">
                    LAUD.IA v2.0
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-600 text-[9px] font-black uppercase tracking-widest animate-pulse">
                    ● ONLINE
                  </span>
                  {!hasApiKey && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/20 text-amber-600 text-[9px] font-black uppercase tracking-widest">
                      ⚠ API KEY
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-ink-900 tracking-tight">Comando LAUD.IA</h2>
                <p className="text-xs text-ink-500 mt-1 font-medium">
                  {providerIcon} Provedor ativo: <span className="text-indigo-600 font-bold">{providerName}</span>
                  <span className="mx-2 text-ink-300">·</span>
                  <span className="text-ink-500">{templates.length} máscaras configuradas</span>
                  <span className="mx-2 text-ink-300">·</span>
                  <span className="text-ink-500">{callMetricsHistory.length} chamadas nesta sessão</span>
                </p>
              </div>
            </div>

            {/* Right — Actions */}
            {!readOnly && (
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <button
                  onClick={() => {
                    if (window.confirm('Restaurar os 4 prompts principais para o padrão de fábrica?')) {
                      setLocalSettings({
                        ...localSettings,
                        aiMasterPrompt: DEFAULT_MASTER_PROMPT,
                        aiGlobalInstructions: DEFAULT_GLOBAL_INSTRUCTIONS,
                        aiStructurePrompt: DEFAULT_STRUCTURE_PROMPT,
                        aiRigidRules: DEFAULT_RIGID_RULES,
                      });
                      showToast('Reset de Fábrica concluído. Clique em Publicar para salvar.', 'success');
                    }
                  }}
                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 hover:border-rose-350 hover:bg-rose-100/50 transition-all flex items-center gap-2"
                >
                  <RotateCcw size={12} />
                  Factory Reset
                </button>

                <button
                  onClick={() => {
                    setLocalSettings(settings);
                    showToast('Alterações descartadas', 'info');
                  }}
                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-600 hover:text-ink-800 bg-ink-100 border border-ink-200 hover:border-ink-350 hover:bg-ink-200/50 transition-all flex items-center gap-2"
                >
                  <XCircle size={12} />
                  Descartar
                </button>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Publicar Configurações
                </button>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="mt-8 pt-6 border-t border-ink-200 grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Máscaras', value: templates.length, icon: FileText, color: 'emerald' },
              { label: 'Laudos Finalizados', value: finalizedCount, icon: CheckCircle2, color: 'brand' },
              { label: 'Blocos de Prompt', value: 6, icon: Code, color: 'indigo' },
              { label: 'Chamadas IA (sessão)', value: callMetricsHistory.length, icon: Activity, color: 'violet' },
              {
                label: 'Custo Sessão (BRL)',
                value: (() => {
                  const PRICING_QUICK: Record<string, { input: number; output: number }> = {
                    'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 },
                    'claude-3-7-sonnet-latest': { input: 3.0, output: 15.0 },
                    'gemini-3.5-flash': { input: 0.075, output: 0.30 },
                    'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.60 },
                  };
                  const total = callMetricsHistory.reduce((s, m) => {
                    const p = m.modelName ? (PRICING_QUICK[m.modelName] || { input: 0, output: 0 }) : { input: 0, output: 0 };
                    return s + ((m.estimatedInputTokens / 1e6) * p.input + (m.estimatedOutputTokens / 1e6) * p.output) * (localSettings.aiConversionRateBRL ?? 5.5);
                  }, 0);
                  return total > 0 ? `R$ ${total.toFixed(3)}` : 'R$ 0,000';
                })(),
                icon: Coins,
                color: 'amber',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-ink-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={`w-8 h-8 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center shrink-0`}>
                  <stat.icon size={14} className={`text-${stat.color}-600`} />
                </div>
                <div>
                  <div className="text-ink-900 font-black text-sm leading-none">{stat.value}</div>
                  <div className="text-ink-500 text-[9px] font-bold uppercase tracking-widest mt-0.5">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB NAVIGATION — Card-based, visual and descriptive
      ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {sidebarItems.map((item) => {
          const isActive = activeTab === item.id;
          const colorMap: Record<string, string> = {
            indigo: isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/30' : 'bg-white border-ink-100 text-ink-500 hover:border-indigo-200 hover:bg-indigo-50/50',
            emerald: isActive ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/30' : 'bg-white border-ink-100 text-ink-500 hover:border-emerald-200 hover:bg-emerald-50/50',
            brand: isActive ? 'bg-brand-600 border-brand-500 text-white shadow-brand-500/30' : 'bg-white border-ink-100 text-ink-500 hover:border-brand-200 hover:bg-brand-50/50',
            amber: isActive ? 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30' : 'bg-white border-ink-100 text-ink-500 hover:border-amber-200 hover:bg-amber-50/50',
            violet: isActive ? 'bg-violet-600 border-violet-500 text-white shadow-violet-500/30' : 'bg-white border-ink-100 text-ink-500 hover:border-violet-200 hover:bg-violet-50/50',
          };
          const iconColorMap: Record<string, string> = {
            indigo: isActive ? 'text-white' : 'text-indigo-500',
            emerald: isActive ? 'text-white' : 'text-emerald-500',
            brand: isActive ? 'text-white' : 'text-brand-500',
            amber: isActive ? 'text-white' : 'text-amber-500',
            violet: isActive ? 'text-white' : 'text-violet-500',
          };
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={classNames(
                'relative p-4 rounded-2xl border text-left transition-all duration-300 shadow-sm',
                isActive ? 'shadow-lg scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01]',
                colorMap[item.color]
              )}
            >
              {item.count !== null && item.count > 0 && (
                <div className={classNames(
                  'absolute top-2.5 right-2.5 min-w-[18px] h-[18px] rounded-full text-[8px] font-black flex items-center justify-center px-1',
                  isActive ? 'bg-white/25 text-white' : 'bg-ink-100 text-ink-500'
                )}>
                  {item.count}
                </div>
              )}
              <item.icon size={20} className={classNames('mb-2.5', iconColorMap[item.color])} />
              <div className={classNames('text-[11px] font-black uppercase tracking-wide leading-tight', isActive ? 'text-white' : 'text-ink-700')}>
                {item.label}
              </div>
              <div className={classNames('text-[9px] mt-0.5', isActive ? 'text-white/70' : 'text-ink-400')}>
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="w-full space-y-8">

        {/* TAB: PROMPTS */}
        {activeTab === 'prompts' && (() => {
          const PROMPT_BLOCKS = [
            {
              id: 'master' as const,
              label: 'Prompt Mestre',
              subtitle: 'Doutrina Central',
              icon: BrainCircuit,
              color: 'indigo',
              accentBg: 'bg-indigo-50',
              accentText: 'text-indigo-700',
              accentBorder: 'border-indigo-200',
              glowColor: 'brand' as const,
              badge: 'CENTRAL MASTER DIRECTIVE',
              fileName: 'master_prompt.md',
              desc: 'Define a personalidade, as leis absolutas e o padrão numérico. É a "constituição" do sistema.',
              settingsKey: 'aiMasterPrompt' as keyof typeof localSettings,
              defaultVal: DEFAULT_MASTER_PROMPT,
              mustHave: ['Lei da Não-Invenção (NÃO INVENÇÃO — LEI ABSOLUTA)', 'Cascata Tripartite (ANÁLISE → CONCLUSÃO → RECOMENDAÇÕES)', 'Lei da Conclusão Enxuta', 'Padrão numérico pt-BR (vírgula decimal)'],
              neverRemove: ['Seção "NÃO INVENÇÃO"', 'Seção "CASCATA TRIPARTITE"', 'Padrão numérico'],
              safeToAdjust: ['Vocabulário da persona', 'Siglas de sociedades médicas (CBR, ISUOG)', 'Acréscimo de permissões de autocálculo'],
            },
            {
              id: 'global' as const,
              label: 'Instruções Globais',
              subtitle: 'Raciocínio Clínico',
              icon: Brain,
              color: 'emerald',
              accentBg: 'bg-emerald-50',
              accentText: 'text-emerald-700',
              accentBorder: 'border-emerald-200',
              glowColor: 'emerald' as const,
              badge: 'GLOBAL REASONING SYSTEM',
              fileName: 'global_instructions.md',
              desc: 'As 7 Fases de Raciocínio Clínico que a IA executa no <scratchpad> antes de gerar o laudo.',
              settingsKey: 'aiGlobalInstructions' as keyof typeof localSettings,
              defaultVal: DEFAULT_GLOBAL_INSTRUCTIONS,
              mustHave: ['7 Fases (Ancoragem, Mapeamento, Normalidade, Autocálculos, Expansão, Cascata, Self-Audit)', 'Tag <scratchpad> como obrigatória', 'Fórmula do elipsoide (Fase 4) com conversão mm→cm'],
              neverRemove: ['Fase 4 — Fórmula do elipsoide', 'Fase 7 — Self-Audit', 'Obrigatoriedade do <scratchpad>'],
              safeToAdjust: ['Fase 3: adicionar variantes anatômicas', 'Fase 4: acréscimo de fórmulas (Hadlock)', 'Fase 5: expandir mapeamento de jargões'],
            },
            {
              id: 'structure' as const,
              label: 'Skeleton',
              subtitle: 'Arquitetura Obrigatória',
              icon: Code,
              color: 'amber',
              accentBg: 'bg-amber-50',
              accentText: 'text-amber-700',
              accentBorder: 'border-amber-200',
              glowColor: 'amber' as const,
              badge: 'SKELETON CODE SPECIFICATION',
              fileName: 'structure_prompt.md',
              desc: 'Define as tags HTML permitidas e a ordem obrigatória das seções do laudo (TÉCNICA → ANÁLISE → CONCLUSÃO → RECOMENDAÇÕES → OBSERVAÇÕES).',
              settingsKey: 'aiStructurePrompt' as keyof typeof localSettings,
              defaultVal: DEFAULT_STRUCTURE_PROMPT,
              mustHave: ['Lista de tags HTML permitidas (h1, h2, h3, p, strong, em, br, ul, li, table)', 'Ordem obrigatória das seções (TÉCNICA/ANÁLISE/CONCLUSÃO/RECOMENDAÇÕES/OBSERVAÇÕES)', 'Proibição de Markdown (**, __, ##, ```)', 'Obrigatoriedade do <scratchpad> antes do HTML'],
              neverRemove: ['Proibição de Markdown', '<scratchpad> antes do HTML', 'Seção OBSERVAÇÕES METODOLÓGICAS'],
              safeToAdjust: ['Acréscimo de exemplos de exames na seção de exemplos', 'Adicionar seções opcionais (ex: <h2>BIOMETRIA FETAL</h2>)'],
            },
            {
              id: 'rigid' as const,
              label: 'Regras Rígidas',
              subtitle: 'Compliance & Segurança',
              icon: ShieldAlert,
              color: 'rose',
              accentBg: 'bg-rose-50',
              accentText: 'text-rose-700',
              accentBorder: 'border-rose-200',
              glowColor: 'rose' as const,
              badge: 'LAUD.IA SECURITY GUARDIAN',
              fileName: 'rigid_rules.md',
              desc: 'Leis de segurança médico-legal que ANULAM qualquer outra instrução. R1 (anti-invenção), R2 (histopatologia), R6 (urgências), R7 (OBSERVAÇÕES obrigatórias).',
              settingsKey: 'aiRigidRules' as keyof typeof localSettings,
              defaultVal: DEFAULT_RIGID_RULES,
              mustHave: ['R1 — Proibição de invenção numérica', 'R2 — Blindagem histopatológica', 'R6 — Override de urgência / Red Flags', 'R7 — OBSERVAÇÕES METODOLÓGICAS obrigatórias'],
              neverRemove: ['R1 — Anti-invenção (risco clínico grave)', 'R2 — Blindagem histopatológica (risco legal)', 'R7 — OBSERVAÇÕES obrigatórias'],
              safeToAdjust: ['R6: adicionar novos red flags específicos', 'Acréscimo de novas regras de compliance da clínica (R9, R10, etc.)'],
            },
            {
              id: 'refinement' as const,
              label: 'Refinamento',
              subtitle: 'Regras de Ouro',
              icon: Sparkles,
              color: 'violet',
              accentBg: 'bg-violet-50',
              accentText: 'text-violet-700',
              accentBorder: 'border-violet-200',
              glowColor: 'violet' as const,
              badge: 'REFINEMENT GOLDEN RULES v16',
              fileName: 'refinement_golden_rules.md',
              desc: 'Regras do modo de edição (Refine): preservação de dados clínicos, laudo completo nunca truncado, eliminação de placeholders (exceto Fetal/Vascular).',
              settingsKey: 'aiRefinementGoldenRules' as keyof typeof localSettings,
              defaultVal: DEFAULT_REFINEMENT_GOLDEN_RULES,
              mustHave: ['Laudo completo e perfeito (sem "...")', 'Lei da preservação de dados clínicos (INQUEBRÁVEL)', 'Eliminação de placeholders (exceto Fetal/Vascular)', 'Integridade da Cascata Tripartite'],
              neverRemove: ['Lei da preservação de dados clínicos', 'Proibição de truncar o laudo'],
              safeToAdjust: ['Acréscimo de regras específicas de preservação', 'Ajuste da fraseologia de eliminação de placeholders'],
            },
            {
              id: 'copilot' as const,
              label: 'Copiloto',
              subtitle: 'Override de Protocolo',
              icon: FlaskConical,
              color: 'teal',
              accentBg: 'bg-teal-50',
              accentText: 'text-teal-700',
              accentBorder: 'border-teal-200',
              glowColor: 'teal' as const,
              badge: 'COPILOT MODE OVERRIDE v16',
              fileName: 'copilot_override.md',
              desc: 'Formato de saída do Copiloto: === CONVERSA === (1 frase técnica) + === PROPOSTA === (HTML completo). O parser do sistema depende exatamente desta estrutura.',
              settingsKey: 'aiCopilotOverride' as keyof typeof localSettings,
              defaultVal: DEFAULT_COPILOT_OVERRIDE,
              mustHave: ['Formato "=== CONVERSA ===" (1 frase técnica, máx 15 palavras)', 'Formato "=== PROPOSTA ===" (HTML completo)', 'Integração de resultados de calculadoras clínicas'],
              neverRemove: ['"=== CONVERSA ===" e "=== PROPOSTA ===" (o parser depende disso)', 'Integração de resultados de calculadoras'],
              safeToAdjust: ['Instrução de detalhamento da frase de CONVERSA', 'Acréscimo de tipos de calculadoras suportadas'],
            },
          ];

          const activeBlock = PROMPT_BLOCKS.find(b => b.id === activePromptSubTab) || PROMPT_BLOCKS[0];
          const activeValue = (localSettings[activeBlock.settingsKey] as string) || activeBlock.defaultVal;
          const versions = getPromptVersions(activeBlock.id);

          return (
            <div className="animate-fade-in-up">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <BrainCircuit size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-ink-900">Diretrizes Operacionais do LAUD.IA</h3>
                  <p className="text-xs text-ink-400">Doutrina, Raciocínio, Skeleton e Compliance Médico-Legal</p>
                </div>
                {!readOnly && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const currentValue = (localSettings[activeBlock.settingsKey] as string) || '';
                        savePromptVersion(activeBlock.id, currentValue);
                        setIsSaving(true);
                        try {
                          await updateSettings(localSettings);
                          showToast(`✓ Bloco "${activeBlock.label}" salvo!`, 'success');
                        } catch { showToast('Erro ao salvar bloco', 'error'); }
                        finally { setIsSaving(false); }
                      }}
                      disabled={isSaving}
                      className="h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Salvar Bloco
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                      Publicar Tudo
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
                {/* ── Left sidebar: block navigator */}
                <div className="space-y-2">
                  {PROMPT_BLOCKS.map(block => {
                    const isActive = activePromptSubTab === block.id;
                    const currentVal = (localSettings[block.settingsKey] as string) || '';
                    const isEmpty = !currentVal.trim() || currentVal === block.defaultVal;
                    return (
                      <button
                        key={block.id}
                        onClick={() => setActivePromptSubTab(block.id)}
                        className={classNames(
                          'w-full text-left p-4 rounded-2xl border transition-all duration-200 group',
                          isActive
                            ? `${block.accentBg} ${block.accentBorder} border shadow-sm`
                            : 'bg-white border-ink-100 hover:border-ink-200 hover:bg-ink-50/50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={classNames(
                            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                            isActive ? `${block.accentBg} ${block.accentText}` : 'bg-ink-100 text-ink-400 group-hover:bg-ink-200'
                          )}>
                            <block.icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={classNames(
                                'text-[11px] font-black uppercase tracking-wide',
                                isActive ? block.accentText : 'text-ink-700'
                              )}>
                                {block.label}
                              </span>
                              {!isEmpty && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Customizado" />
                              )}
                            </div>
                            <div className={classNames(
                              'text-[9px] mt-0.5 truncate',
                              isActive ? `${block.accentText} opacity-70` : 'text-ink-400'
                            )}>
                              {block.subtitle}
                            </div>
                          </div>
                          {isActive && <ChevronRight size={12} className={block.accentText} />}
                        </div>
                        {isActive && (
                          <p className={classNames('text-[10px] mt-2.5 leading-relaxed', block.accentText, 'opacity-80')}>
                            {block.desc}
                          </p>
                        )}
                      </button>
                    );
                  })}

                  {/* Version history panel */}
                  {versions.length > 0 && (
                    <div className="bg-ink-50 border border-ink-200 rounded-2xl p-3 mt-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <History size={12} className="text-ink-400" />
                        <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Histórico</span>
                        <span className="ml-auto text-[9px] text-ink-400">{versions.length} versões</span>
                      </div>
                      <div className="space-y-1.5">
                        {versions.map((v, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (window.confirm(`Restaurar versão de ${new Date(v.timestamp).toLocaleString('pt-BR')}?`)) {
                                savePromptVersion(activeBlock.id, activeValue);
                                setLocalSettings(prev => ({ ...prev, [activeBlock.settingsKey]: v.value }));
                                showToast('Versão restaurada!', 'success');
                              }
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-ink-200 hover:border-brand-300 hover:bg-brand-50 text-left transition-all group"
                          >
                            <RotateCcw size={10} className="text-ink-300 group-hover:text-brand-500 shrink-0" />
                            <div>
                              <div className="text-[9px] font-bold text-ink-600">{new Date(v.timestamp).toLocaleString('pt-BR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="text-[8px] text-ink-400 truncate w-36">{v.value.substring(0, 50)}…</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right panel: editor */}
                <div className="space-y-4">
                   {/* Contextual Documentation Panel */}
                   <div className={classNames('rounded-2xl border overflow-hidden', activeBlock.accentBorder)}>
                     {/* Panel header */}
                     <div className={classNames('px-4 py-3 flex items-center gap-2.5', activeBlock.accentBg)}>
                       <activeBlock.icon size={15} className={classNames('shrink-0', activeBlock.accentText)} />
                       <div className="flex-1">
                         <span className={classNames('text-[11px] font-black uppercase tracking-widest', activeBlock.accentText)}>{activeBlock.label}</span>
                         <span className="text-[10px] text-ink-400 ml-2">— {activeBlock.subtitle}</span>
                       </div>
                       <span className={classNames('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border', activeBlock.accentText, activeBlock.accentBorder)}>{activeBlock.badge}</span>
                     </div>
                     {/* Panel body */}
                     <div className="bg-white p-4 space-y-4">
                       <p className="text-[11px] text-ink-600 leading-relaxed">{activeBlock.desc}</p>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                         {/* Must have */}
                         <div className="space-y-1.5">
                           <div className="flex items-center gap-1.5 mb-2">
                             <CheckCircle2 size={12} className="text-emerald-600" />
                             <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Deve conter</span>
                           </div>
                           {activeBlock.mustHave?.map((item, i) => (
                             <div key={i} className="flex items-start gap-1.5">
                               <span className="text-emerald-500 text-[10px] mt-0.5 shrink-0">✓</span>
                               <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                             </div>
                           ))}
                         </div>
                         {/* Never remove */}
                         <div className="space-y-1.5">
                           <div className="flex items-center gap-1.5 mb-2">
                             <AlertCircle size={12} className="text-rose-600" />
                             <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">NUNCA remover</span>
                           </div>
                           {activeBlock.neverRemove?.map((item, i) => (
                             <div key={i} className="flex items-start gap-1.5">
                               <span className="text-rose-500 text-[10px] mt-0.5 shrink-0">⚠</span>
                               <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                             </div>
                           ))}
                         </div>
                         {/* Safe to adjust */}
                         <div className="space-y-1.5">
                           <div className="flex items-center gap-1.5 mb-2">
                             <Zap size={12} className="text-brand-600" />
                             <span className="text-[9px] font-black text-brand-700 uppercase tracking-widest">Seguro ajustar</span>
                           </div>
                           {activeBlock.safeToAdjust?.map((item, i) => (
                             <div key={i} className="flex items-start gap-1.5">
                               <span className="text-brand-400 text-[10px] mt-0.5 shrink-0">→</span>
                               <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>

                  <CognitiveCodeEditor
                    readOnly={readOnly}
                    value={activeValue}
                    onChange={(val) => setLocalSettings({ ...localSettings, [activeBlock.settingsKey]: val })}
                    fileName={activeBlock.fileName}
                    badge={activeBlock.badge}
                    glowColor={activeBlock.glowColor}
                    placeholder={`Defina as diretrizes de ${activeBlock.label}...`}
                    onRestore={() => {
                      savePromptVersion(activeBlock.id, activeValue);
                      setLocalSettings({ ...localSettings, [activeBlock.settingsKey]: activeBlock.defaultVal });
                      showToast(`${activeBlock.label} restaurado para o padrão (versão anterior salva)`, 'info');
                    }}
                  />
                </div>
              </div>

              {/* Diff Visual Modal */}
              {pendingDiff && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                  <div className="bg-zinc-950 rounded-3xl border border-zinc-700 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                          <GitCompare size={18} className="text-violet-400" />
                        </div>
                        <div>
                          <h4 className="font-black text-white">Diff Visual — Melhoria por IA</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bloco: {pendingDiff.block} · Revise e aceite ou rejeite</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const keyMap: Record<string, keyof typeof localSettings> = {
                              master: 'aiMasterPrompt', global: 'aiGlobalInstructions',
                              structure: 'aiStructurePrompt', rigid: 'aiRigidRules',
                              refinement: 'aiRefinementGoldenRules', copilot: 'aiCopilotOverride',
                            };
                            const k = keyMap[pendingDiff.block];
                            if (k) { savePromptVersion(pendingDiff.block, pendingDiff.original); setLocalSettings(prev => ({ ...prev, [k]: pendingDiff.improved })); }
                            setPendingDiff(null);
                            showToast('✓ Melhoria aceita! Versão anterior salva no histórico.', 'success');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <CheckSquare size={14} /> Aceitar
                        </button>
                        <button onClick={() => setPendingDiff(null)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto grid grid-cols-2">
                      <div className="border-r border-zinc-800">
                        <div className="px-4 py-2.5 bg-rose-950/30 border-b border-zinc-800 flex items-center gap-2">
                          <XCircle size={11} className="text-rose-400" />
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Original</span>
                        </div>
                        <pre className="p-5 text-[11px] text-rose-300/80 font-mono whitespace-pre-wrap leading-relaxed">{pendingDiff.original}</pre>
                      </div>
                      <div>
                        <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-zinc-800 flex items-center gap-2">
                          <CheckSquare size={11} className="text-emerald-400" />
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Melhorado pela IA</span>
                        </div>
                        <pre className="p-5 text-[11px] text-emerald-300/80 font-mono whitespace-pre-wrap leading-relaxed">{pendingDiff.improved}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB: TEMPLATES (Prompts por Exame) */}
        {activeTab === 'templates' && (() => {
          const selectedArea = EXAM_AREAS.find(a => a.id === selectedAreaFilter);
          const areaTemplates = selectedAreaFilter
            ? templates.filter(t => t.area === selectedAreaFilter)
            : [];
          const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
          const hasCustomAreaPrompt = selectedAreaFilter
            ? !!(localSettings.aiAreaPrompts?.[selectedAreaFilter as ExamArea]?.trim())
            : false;

          // Area color map
          const areaColors: Record<string, { bg: string; text: string; border: string; dot: string; icon: string }> = {
            'medicina-interna':   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500',   icon: '🫀' },
            'medicina-fetal':     { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200',   dot: 'bg-pink-500',   icon: '🤰' },
            'ginecologia':        { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500',   icon: '🌸' },
            'vascular':           { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    icon: '🩸' },
            'musculoesqueletico': { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  icon: '🦴' },
            'mastologia':         { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', icon: '🎗️' },
            'pequenas-partes':    { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   dot: 'bg-teal-500',   icon: '🔬' },
            'pediatria':          { bg: 'bg-lime-50',   text: 'text-lime-700',   border: 'border-lime-200',   dot: 'bg-lime-500',   icon: '👶' },
            'reumatologico':      { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', icon: '🦾' },
            'procedimentos':      { bg: 'bg-ink-50',  text: 'text-ink-700',  border: 'border-ink-200',  dot: 'bg-ink-500',  icon: '💉' },
          };
          const ac = selectedAreaFilter ? (areaColors[selectedAreaFilter] || areaColors['medicina-interna']) : null;

          return (
          <div className="animate-fade-in space-y-0">

            {/* ── Section Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <LayoutList size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-ink-900">Prompts por Exame</h3>
                <p className="text-xs text-ink-400">Diretriz de Área (Camada 2) + Instruções do Exame (Camada 3)</p>
              </div>
              {!readOnly && selectedTemplateId && templateSubTab === 'exams' && (
                <button
                  onClick={handleSaveTemplatePrompt}
                  disabled={isSavingTemplate}
                  className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-2"
                >
                  {isSavingTemplate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Salvar Exame
                </button>
              )}
              {!readOnly && selectedAreaFilter && templateSubTab === 'area' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestoreAreaPromptDefault}
                    className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 shadow-sm transition-all flex items-center gap-1.5"
                    title="Restaurar para o padrão V2.0 do sistema"
                  >
                    <RotateCcw size={11} />
                    Restaurar V2.0
                  </button>
                  <button
                    onClick={handleSaveAreaPrompt}
                    disabled={isSavingTemplate}
                    className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-all flex items-center gap-2"
                  >
                    {isSavingTemplate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Salvar Área
                  </button>
                </div>
              )}
            </div>

            {/* ── Cascata Visual Banner */}
            <div className="mb-5 bg-gradient-to-r from-ink-900 via-indigo-950 to-ink-900 rounded-2xl p-4 flex items-center gap-0 overflow-hidden relative">
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }} />
              <div className="relative flex items-center gap-0 w-full">
                {/* Layer 1 */}
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
                  <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Camada 1</div>
                  <div className="text-[11px] font-black text-indigo-100 mt-0.5">Doutrina Universal</div>
                  <div className="text-[9px] text-indigo-400 mt-0.5">6 blocos — always on</div>
                </div>
                <div className="px-1 text-indigo-500 font-black text-lg shrink-0">→</div>
                {/* Layer 2 */}
                <div className={classNames(
                  'flex-1 text-center px-3 py-2 rounded-xl border transition-all duration-200',
                  selectedAreaFilter && ac
                    ? `${ac.bg.replace('bg-', 'bg-').replace('-50', '-500/20')} ${ac.border.replace('border-', 'border-').replace('-200', '-500/40')}`
                    : 'bg-emerald-600/20 border-emerald-500/30'
                )}>
                  <div className="text-[8px] font-black text-emerald-300 uppercase tracking-widest">Camada 2</div>
                  <div className="text-[11px] font-black text-emerald-100 mt-0.5">
                    {selectedArea ? `${selectedArea.label}` : 'Diretriz de Área'}
                  </div>
                  <div className="text-[9px] text-emerald-400 mt-0.5">
                    {hasCustomAreaPrompt ? '✓ Customizada' : 'Padrão do sistema'}
                  </div>
                </div>
                <div className="px-1 text-indigo-500 font-black text-lg shrink-0">→</div>
                {/* Layer 3 */}
                <div className={classNames(
                  'flex-1 text-center px-3 py-2 rounded-xl border transition-all duration-200',
                  selectedTemplate
                    ? 'bg-violet-600/20 border-violet-500/40'
                    : 'bg-violet-600/10 border-violet-500/20 opacity-50'
                )}>
                  <div className="text-[8px] font-black text-violet-300 uppercase tracking-widest">Camada 3</div>
                  <div className="text-[11px] font-black text-violet-100 mt-0.5">
                    {selectedTemplate ? selectedTemplate.name : 'Prompt do Exame'}
                  </div>
                  <div className="text-[9px] text-violet-400 mt-0.5">
                    {selectedTemplate
                      ? (selectedTemplate.aiInstructions?.trim() ? '✓ Com instruções' : 'Sem instruções')
                      : 'Selecione um exame'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Main layout: Sidebar + Content */}
            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6 items-start">

              {/* ════ LEFT SIDEBAR — Áreas + Exames ════ */}
              <div className="space-y-3">
                {/* Sub-tab selector */}
                <div className="flex gap-1 p-1 bg-ink-100 border border-ink-200/50 rounded-2xl">
                  <button
                    onClick={() => setTemplateSubTab('area')}
                    className={classNames(
                      "flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      templateSubTab === 'area'
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-ink-500 hover:text-ink-700"
                    )}
                  >
                    Por Área
                  </button>
                  <button
                    onClick={() => setTemplateSubTab('exams')}
                    className={classNames(
                      "flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      templateSubTab === 'exams'
                        ? "bg-white text-violet-700 shadow-sm"
                        : "text-ink-500 hover:text-ink-700"
                    )}
                  >
                    Por Exame
                  </button>
                </div>

                {/* Area cards */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest px-1">Especialidades</p>
                  {EXAM_AREAS.map(area => {
                    const count = templates.filter(t => t.area === area.id).length;
                    const isActive = selectedAreaFilter === area.id;
                    const hasCustom = !!(localSettings.aiAreaPrompts?.[area.id as ExamArea]?.trim());
                    const colors = areaColors[area.id] || areaColors['medicina-interna'];
                    return (
                      <button
                        key={area.id}
                        onClick={() => {
                          setSelectedAreaFilter(area.id as ExamArea);
                          const firstTemplate = templates.filter(t => t.area === area.id)[0];
                          if (firstTemplate) setSelectedTemplateId(firstTemplate.id);
                          else setSelectedTemplateId('');
                        }}
                        className={classNames(
                          'w-full text-left px-3.5 py-3 rounded-2xl border transition-all duration-200 group',
                          isActive
                            ? `${colors.bg} ${colors.border} border shadow-sm`
                            : 'bg-white border-ink-100 hover:border-ink-200 hover:bg-ink-50/50'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base shrink-0">{colors.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={classNames(
                                'text-[11px] font-black truncate',
                                isActive ? colors.text : 'text-ink-700'
                              )}>{area.label}</span>
                              {hasCustom && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Diretriz customizada" />
                              )}
                            </div>
                            <div className={classNames(
                              'text-[9px] mt-0.5',
                              isActive ? `${colors.text} opacity-70` : 'text-ink-400'
                            )}>
                              {count} {count === 1 ? 'exame' : 'exames'}
                            </div>
                          </div>
                          {isActive && <ChevronRight size={12} className={colors.text} />}
                        </div>

                        {/* Exam list when area active and in 'exams' mode */}
                        {isActive && templateSubTab === 'exams' && count > 0 && (
                          <div className="mt-2.5 space-y-1 border-t border-current/10 pt-2.5">
                            {templates.filter(t => t.area === area.id).map(t => {
                              const isExamActive = selectedTemplateId === t.id;
                              const hasInstructions = !!(t.aiInstructions?.trim());
                              return (
                                <button
                                  key={t.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedTemplateId(t.id); }}
                                  className={classNames(
                                    'w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2',
                                    isExamActive
                                      ? 'bg-white shadow-sm text-ink-900'
                                      : `${colors.text} opacity-70 hover:opacity-100`
                                  )}
                                >
                                  <span className="shrink-0">{isExamActive ? '▶' : '○'}</span>
                                  <span className="flex-1 truncate">{t.name}</span>
                                  {hasInstructions && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" title="Com instruções" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* All templates count */}
                <div className="px-3 py-2 bg-ink-50 rounded-2xl border border-ink-100 text-center">
                  <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total de exames: </span>
                  <span className="text-[10px] font-black text-ink-700">{templates.length}</span>
                </div>
              </div>

              {/* ════ RIGHT CONTENT ════ */}
              {selectedAreaFilter && ac ? (
                <div className="space-y-5 min-w-0">

                  {/* ── Sub-tab: ÁREA */}
                  {templateSubTab === 'area' && (
                    <div className="space-y-4 animate-fade-in-up">
                      {/* Context doc panel */}
                      <div className={classNames('rounded-2xl border overflow-hidden', ac.border)}>
                        <div className={classNames('px-4 py-3 flex items-center gap-2.5', ac.bg)}>
                          <span className="text-base">{areaColors[selectedAreaFilter]?.icon}</span>
                          <div className="flex-1">
                            <span className={classNames('text-[11px] font-black uppercase tracking-widest', ac.text)}>{selectedArea?.label}</span>
                            <span className="text-[10px] text-ink-400 ml-2">— Camada 2</span>
                          </div>
                          <span className={classNames(
                            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border',
                            ac.text, ac.border
                          )}>AREA LEVEL DIRECTIVE</span>
                        </div>
                        <div className="bg-white p-4 space-y-3">
                          <p className="text-[11px] text-ink-600 leading-relaxed">
                            Estas diretrizes são herdadas por <strong>todos os exames de {selectedArea?.label}</strong>.
                            Defina aqui as regras, classificações e padrões comuns à especialidade.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Deve conter</span>
                              </div>
                              {['Classificações da especialidade (BI-RADS, TI-RADS, O-RADS...)', 'Padrões de normalidade da área', 'Fórmulas e valores de referência'].map((item, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 text-[10px] mt-0.5 shrink-0">✓</span>
                                  <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <AlertCircle size={12} className="text-rose-600" />
                                <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">NUNCA colocar</span>
                              </div>
                              {['Instruções específicas de exame único', 'Fraseologias de TÉCNICA (ficam na máscara)', 'Recomendações únicas de 1 exame'].map((item, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-rose-500 text-[10px] mt-0.5 shrink-0">⚠</span>
                                  <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Zap size={12} className="text-brand-600" />
                                <span className="text-[9px] font-black text-brand-700 uppercase tracking-widest">Exemplos</span>
                              </div>
                              {['Legenda EULAR para PDUS (reumatologia)', 'Critérios Rotterdam (SOP/ginecologia)', 'NASCET para estenoses (vascular)'].map((item, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-brand-400 text-[10px] mt-0.5 shrink-0">→</span>
                                  <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className={classNames('flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold', ac.bg, ac.border, ac.text)}>
                            <span>ℹ</span>
                            <span>
                              {hasCustomAreaPrompt
                                ? '✓ Diretriz customizada ativa — o padrão do sistema foi substituído.'
                                : 'Usando diretriz padrão do sistema. Edite abaixo para customizar.'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Area code editor */}
                      <CognitiveCodeEditor
                        readOnly={readOnly}
                        value={editingAreaPrompt}
                        onChange={(v) => setEditingAreaPrompt(v)}
                        fileName={`${selectedAreaFilter.replace(/\s+/g, '_')}_area_directive.md`}
                        badge="AREA LEVEL DIRECTIVE — CAMADA 2"
                        glowColor="brand"
                        placeholder={`Digite as diretrizes clínicas gerais para todos os exames de ${selectedArea?.label}...\n\nExemplo:\n1. CLASSIFICAÇÃO DE ...\n2. VALORES DE REFERÊNCIA ...\n3. RECOMENDAÇÕES PADRÃO ...`}
                        onRestore={hasCustomAreaPrompt ? handleRestoreAreaPromptDefault : undefined}
                      />

                      {/* Exams in area quick nav */}
                      {areaTemplates.length > 0 && (
                        <div className="bg-white border border-ink-100 rounded-2xl p-4 space-y-2">
                          <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">
                            {areaTemplates.length} exame(s) herdando esta diretriz
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {areaTemplates.map(t => (
                              <button
                                key={t.id}
                                onClick={() => { setTemplateSubTab('exams'); setSelectedTemplateId(t.id); }}
                                className={classNames(
                                  'px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all hover:shadow-sm',
                                  ac.bg, ac.border, ac.text
                                )}
                              >
                                {t.name}
                                {t.aiInstructions?.trim() && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Sub-tab: EXAMES */}
                  {templateSubTab === 'exams' && (
                    <div className="space-y-4 animate-fade-in-up">
                      {selectedTemplateId && selectedTemplate ? (
                        <>
                          {/* Context doc panel */}
                          <div className="rounded-2xl border border-violet-200 overflow-hidden">
                            <div className="px-4 py-3 flex items-center gap-2.5 bg-violet-50">
                              <FileText size={14} className="text-violet-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-black text-violet-700 uppercase tracking-widest">{selectedTemplate.name}</span>
                                <span className="text-[10px] text-ink-400 ml-2">— Camada 3 · Prompt Específico</span>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border text-violet-700 border-violet-200 shrink-0">EXAM DIRECTIVE</span>
                            </div>
                            <div className="bg-white p-4 space-y-3">
                              <p className="text-[11px] text-ink-600 leading-relaxed">
                                Instruções que se aplicam <strong>exclusivamente</strong> a este exame. Defina aqui: fraseologia de RECOMENDAÇÕES, placeholders de biometria, critérios de classificação únicos e conduta específica.
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Deve conter</span>
                                  </div>
                                  {[
                                    'Fraseologia padrão de RECOMENDAÇÕES do exame',
                                    'Classificação sistematizada específica (se aplicável)',
                                    'Conduta em casos normais e alterados',
                                  ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="text-emerald-500 text-[10px] mt-0.5 shrink-0">✓</span>
                                      <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <AlertCircle size={12} className="text-rose-600" />
                                    <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">NUNCA duplicar</span>
                                  </div>
                                  {[
                                    'Regras já definidas na Diretriz de Área',
                                    'Regras da Doutrina Universal (Blocos 1–4)',
                                    'Fórmulas gerais (volume, peso — já no Bloco 2)',
                                  ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="text-rose-500 text-[10px] mt-0.5 shrink-0">⚠</span>
                                      <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Zap size={12} className="text-violet-600" />
                                    <span className="text-[9px] font-black text-violet-700 uppercase tracking-widest">Injetar diretiva</span>
                                  </div>
                                  {[
                                    { label: 'Elipsoide (volume)', text: '- Calcule o volume pelo elipsoide: D1 × D2 × D3 × 0,523. Converta mm→cm antes.' },
                                    { label: 'TI-RADS ACR 2017', text: '- Classifique nódulos tireoidianos pelo TI-RADS ACR 2017 (composição, eco, formato, margem, focos ecogênicos). Declare pontuação e categoria TR1–TR5.' },
                                    { label: 'BI-RADS ACR 2013', text: '- Classifique lesões mamárias pelo BI-RADS ACR 2013 (forma, orientação, margem, ecotextura, achados acústicos). Atribua categoria 0–6.' },
                                    { label: 'O-RADS 2022', text: '- Classifique cistos/massas ovarianas pelo O-RADS (ACR 2022). Declare categoria 1–5 e conduta associada.' },
                                    { label: 'Urgência (R6)', text: '- Em achado de urgência, inicie RECOMENDAÇÕES com: <p>• <strong>ALERTA [CATEGORIA]:</strong> encaminhamento imediato — [especialidade] — devido a [motivo].</p>' },
                                    { label: 'Qualitativo (sem medidas)', text: '- Para estruturas sem dados fornecidos, use normalidade qualitativa: "de aspecto anatômico preservado", "sem alterações ecográficas". Nunca invente medidas.' },
                                  ].map((item) => (
                                    <button
                                      key={item.label}
                                      type="button"
                                      onClick={() => handleInjectDirective(item.text)}
                                      className="w-full text-left px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-[9px] font-bold transition-all flex items-center justify-between group active:scale-95"
                                    >
                                      <span>{item.label}</span>
                                      <Zap size={9} className="text-violet-400 group-hover:text-violet-600 shrink-0 ml-1" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action buttons row — V1.0 versioning */}
                          {!readOnly && (
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Exam prompt: restore backup */}
                              <button
                                onClick={handleRestoreExamPromptFromBackup}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black rounded-xl border uppercase tracking-widest active:scale-95 shadow-sm bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all"
                                title="Recuperar o último backup local do prompt deste exame"
                              >
                                <RotateCcw size={12} />
                                Recuperar Rascunho
                              </button>
                              <button
                                onClick={handleClearExamPrompt}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black rounded-xl border uppercase tracking-widest active:scale-95 shadow-sm bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-all"
                                title="Limpar instruções específicas deste exame (backup salvo localmente)"
                              >
                                <Trash2 size={12} />
                                Limpar Exame
                              </button>

                              {/* Status badge */}
                              <div className="ml-auto">
                                {editingTemplatePrompt.trim() ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                                    Com instruções (Camada 3 ativa)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-ink-50 text-ink-400 border border-ink-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-ink-300 inline-block" />
                                    Herdando da Área
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Exam prompt editor */}
                          <CognitiveCodeEditor
                            readOnly={readOnly}
                            value={editingTemplatePrompt}
                            onChange={(v) => setEditingTemplatePrompt(v)}
                            fileName={`${(selectedTemplate.name || '').toLowerCase().replace(/\s+/g, '_')}_exam_directive.md`}
                            badge="EXAM SPECIFIC DIRECTIVE — CAMADA 3"
                            glowColor="violet"
                            placeholder={`Digite as instruções específicas para o exame "${selectedTemplate.name}"...\n\nExemplo:\n1. FRASEOLOGIA DE RECOMENDAÇÕES\n   • Exame normal: "..."\n   • Achado X: "..."\n\n2. CLASSIFICAÇÃO ESPECÍFICA\n   ...`}
                          />

                          {/* Playground */}
                          {renderPlayground()}
                        </>
                      ) : (
                        <div className="p-10 text-center border-2 border-dashed border-ink-200 rounded-3xl">
                          <LayoutList size={36} className="text-ink-300 mx-auto mb-3" />
                          <p className="text-sm font-bold text-ink-400">
                            {areaTemplates.length > 0
                              ? 'Selecione um exame na sidebar para editar seu prompt.'
                              : `Nenhum exame cadastrado em ${selectedArea?.label}.`}
                          </p>
                          <p className="text-xs text-ink-300 mt-1">Gerencie as máscaras na aba Modelos.</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-10 text-center border-2 border-dashed border-ink-200 rounded-3xl">
                  <LayoutList size={36} className="text-ink-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-ink-400">Selecione uma especialidade na sidebar para começar.</p>
                  <p className="text-xs text-ink-300 mt-1">Cada especialidade possui uma Diretriz de Área (Camada 2) e prompts por exame (Camada 3).</p>
                </div>
              )}

            </div>
          </div>
          );
        })()}

        {/* ═══ TAB: ENGINE ═══ */}
        {activeTab === 'engine' && (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Cpu size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-ink-900">Motor & Conexão de API</h3>
                <p className="text-xs text-ink-400">Configure o provedor de IA, modelos e temperatura cognitiva por modo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left column: Provider + API + Model */}
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-6 space-y-5">
                <h4 className="text-sm font-black text-ink-900 flex items-center gap-2">
                  <Key size={16} className="text-brand-600" /> Provedor e API Key
                </h4>

                <div>
                  <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Provedor de Inteligência Artificial</label>
                  <select
                    value={localSettings.aiProvider || 'gemini'}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiProvider: e.target.value as 'gemini' | 'anthropic' })}
                    className="input h-14"
                  >
                    <option value="gemini">Google Gemini (Modelos 2.5+)</option>
                    <option value="anthropic">Anthropic Claude (Modelos Claude 3.5 / 3.7 / 4)</option>
                  </select>
                </div>

                {(localSettings.aiProvider === 'gemini' || !localSettings.aiProvider) ? (
                  <>
                    <div>
                      <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Gemini API Key</label>
                      <div className="flex gap-3">
                        <input
                          type="password"
                          value={localSettings.geminiApiKey || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                          placeholder="AIzaSy..."
                          className="input flex-1 font-mono text-sm h-14"
                        />
                        <button onClick={testConnection}
                          disabled={testStatus === 'testing'}
                          className={classNames(
                            'w-14 h-14 flex items-center justify-center rounded-xl transition-all border',
                            testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              testStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                                'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                          )}
                        >
                          {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin" /> :
                            testStatus === 'success' ? <CheckCircle2 size={20} /> :
                              testStatus === 'error' ? <AlertCircle size={20} /> : <Zap size={20} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-ink-400 mt-2 ml-1">Obtenha em <span className="font-bold text-brand-600">aistudio.google.com/apikey</span></p>
                    </div>
                    <div>
                      <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Modelo Gemini Principal</label>
                      <select
                        value={localSettings.geminiModel || 'gemini-3.5-flash'}
                        onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                        className="input h-14"
                      >
                        <optgroup label="Gemini 2.5 (Novo)">
                          <option value="gemini-2.5-flash">GEMINI 2.5 FLASH — Rápido e Preciso (Recomendado)</option>
                          <option value="gemini-2.5-pro">GEMINI 2.5 PRO — Máxima Inteligência</option>
                        </optgroup>
                        <optgroup label="Gemini 3.x (Legacy)">
                          <option value="gemini-3.5-flash">GEMINI 3.5 FLASH (Legacy)</option>
                          <option value="gemini-3.1-pro-preview">GEMINI 3.1 PRO (Legacy)</option>
                        </optgroup>
                      </select>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { model: 'gemini-2.5-flash', label: '2.5 FLASH', desc: 'Velocidade + Precisão', color: 'brand' },
                          { model: 'gemini-2.5-pro', label: '2.5 PRO', desc: 'Raciocínio Clínico', color: 'violet' },
                        ].map(m => (
                          <button
                            key={m.model}
                            onClick={() => setLocalSettings({ ...localSettings, geminiModel: m.model })}
                            className={classNames(
                              'p-3 rounded-2xl border text-left transition-all',
                              (localSettings.geminiModel || 'gemini-2.5-flash') === m.model
                                ? 'bg-brand-50 border-brand-300 text-brand-800'
                                : 'bg-ink-50 border-ink-100 text-ink-600 hover:border-brand-200'
                            )}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest block">{m.label}</span>
                            <span className="text-[9px] text-ink-500 mt-0.5 block">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Anthropic Claude API Key</label>
                      <div className="flex gap-3">
                        <input
                          type="password"
                          value={localSettings.anthropicApiKey || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, anthropicApiKey: e.target.value })}
                          placeholder="sk-ant-..."
                          className="input flex-1 font-mono text-sm h-14"
                        />
                        <button onClick={testConnection}
                          disabled={testStatus === 'testing'}
                          className={classNames(
                            'w-14 h-14 flex items-center justify-center rounded-xl transition-all border',
                            testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              testStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                                'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                          )}
                        >
                          {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin" /> :
                            testStatus === 'success' ? <CheckCircle2 size={20} /> :
                              testStatus === 'error' ? <AlertCircle size={20} /> : <Zap size={20} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-ink-400 mt-2 ml-1">Obtenha em <span className="font-bold text-brand-600">console.anthropic.com</span></p>
                    </div>
                     <div>
                      <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Modelo Claude Principal</label>
                      <select
                        value={localSettings.anthropicModel || 'claude-3-5-sonnet-latest'}
                        onChange={(e) => setLocalSettings({ ...localSettings, anthropicModel: e.target.value })}
                        className="input h-14"
                      >
                        <optgroup label="Claude 4 (Novo)">
                          <option value="claude-opus-4-5">Claude Opus 4.5 — Ultra Intelligence</option>
                        </optgroup>
                        <optgroup label="Claude 3.7">
                          <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet — Extended Thinking</option>
                        </optgroup>
                        <optgroup label="Claude 3.5">
                          <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet — Alta Qualidade (Recomendado)</option>
                          <option value="claude-3-haiku-20240307">Claude 3 Haiku — Mais Rápido e Barato</option>
                        </optgroup>
                      </select>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { model: 'claude-3-5-sonnet-latest', label: '3.5 Sonnet', desc: 'Recomendado', color: 'brand' },
                          { model: 'claude-3-7-sonnet-latest', label: '3.7 Sonnet', desc: 'Thinking', color: 'amber' },
                          { model: 'claude-opus-4-5', label: 'Opus 4.5', desc: 'Ultra', color: 'violet' },
                        ].map(m => (
                          <button
                            key={m.model}
                            onClick={() => setLocalSettings({ ...localSettings, anthropicModel: m.model })}
                            className={classNames(
                              'p-3 rounded-2xl border text-left transition-all',
                              (localSettings.anthropicModel || 'claude-3-5-sonnet-latest') === m.model
                                ? 'bg-brand-50 border-brand-300 text-brand-800'
                                : 'bg-ink-50 border-ink-100 text-ink-600 hover:border-brand-200'
                            )}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest block">{m.label}</span>
                            <span className="text-[9px] text-ink-500 mt-0.5 block">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              </div>
              {/* Right column: Temperature by mode */}
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <SlidersHorizontal size={16} className="text-brand-600" />
                  <div>
                    <h4 className="text-sm font-black text-ink-900">Temperatura por Modo</h4>
                    <p className="text-[10px] text-ink-400">Cada modo usa uma temperatura distinta, otimizada para seu objetivo clínico.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {([
                      {
                        key: 'generation' as const,
                        label: 'Geração Inicial',
                        desc: 'Quanto de criatividade narrativa na geração do primeiro laudo',
                        default: 0.35,
                        color: 'brand',
                        presets: [{ v: 0.2, l: 'Literal' }, { v: 0.35, l: 'Padrão' }, { v: 0.5, l: 'Criativo' }],
                      },
                      {
                        key: 'refine' as const,
                        label: 'Refinamento',
                        desc: 'Temperatura do refinamento cirúrgico — manter baixo para maior fidelidade',
                        default: 0.10,
                        color: 'amber',
                        presets: [{ v: 0.05, l: 'Cirúrgico' }, { v: 0.10, l: 'Padrão' }, { v: 0.20, l: 'Flexível' }],
                      },
                      {
                        key: 'copilot' as const,
                        label: 'Copiloto',
                        desc: 'Temperatura das propostas do Copiloto — balanceia criatividade e precisão',
                        default: 0.20,
                        color: 'violet',
                        presets: [{ v: 0.10, l: 'Preciso' }, { v: 0.20, l: 'Padrão' }, { v: 0.35, l: 'Criativo' }],
                      },
                      {
                        key: 'template' as const,
                        label: 'Templates',
                        desc: 'Temperatura na geração de máscaras — consistente e estruturado',
                        default: 0.20,
                        color: 'teal',
                        presets: [{ v: 0.10, l: 'Estruturado' }, { v: 0.20, l: 'Padrão' }, { v: 0.35, l: 'Flexível' }],
                      },
                    ]).map(mode => {
                      const byMode = localSettings.aiTemperatureByMode || {};
                      const currentVal = byMode[mode.key] ?? mode.default;
                      return (
                        <div key={mode.key} className="p-4 bg-ink-50/50 border border-ink-100 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-sm font-black text-ink-900">{mode.label}</span>
                              <p className="text-[10px] text-ink-400 mt-0.5">{mode.desc}</p>
                            </div>
                            <div className={`text-2xl font-black text-${mode.color}-600`}>{currentVal.toFixed(2)}</div>
                          </div>
                          <input
                            type="range" min="0" max="1" step="0.05"
                            value={currentVal}
                            onChange={e => setLocalSettings(prev => ({
                              ...prev,
                              aiTemperatureByMode: {
                                ...(prev.aiTemperatureByMode || {}),
                                [mode.key]: parseFloat(e.target.value),
                              },
                            }))}
                            className={`w-full h-3 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-${mode.color}-600`}
                          />
                          <div className="flex gap-2 mt-3">
                            {mode.presets.map(preset => (
                              <button
                                key={preset.v}
                                onClick={() => setLocalSettings(prev => ({
                                  ...prev,
                                  aiTemperatureByMode: {
                                    ...(prev.aiTemperatureByMode || {}),
                                    [mode.key]: preset.v,
                                  },
                                }))}
                                className={classNames(
                                  'flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border',
                                  currentVal === preset.v
                                    ? `bg-${mode.color}-50 border-${mode.color}-300 text-${mode.color}-700`
                                    : 'bg-white border-ink-100 text-ink-500 hover:border-ink-300'
                                )}
                              >
                                {preset.l} ({preset.v})
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auto Refine Toggle */}
                <div className="p-4 bg-ink-50/50 border border-ink-100 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-ink-900">Refinador Automático</div>
                    <p className="text-[10px] text-ink-400 mt-0.5 leading-relaxed max-w-xs">
                      Ciclo extra de higienização cirúrgica após propostas do Copiloto, garantindo conformidade com a máscara.
                    </p>
                  </div>
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, aiAutoRefineEnabled: !localSettings.aiAutoRefineEnabled })}
                    className={classNames(
                      'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      localSettings.aiAutoRefineEnabled ? 'bg-brand-600' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames(
                      'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      localSettings.aiAutoRefineEnabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: TRAINING ═══ */}
        {activeTab === 'training' && (
          <div className="max-w-3xl space-y-6 animate-fade-in">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <GraduationCap size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-ink-900">Aprendizado por Estilo</h3>
                <p className="text-xs text-ink-400">A IA aprende com seus laudos finalizados para mimetizar seu estilo</p>
              </div>
            </div>
            {/* Toggle Card */}
            <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-5 sm:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <GraduationCap size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-ink-900">Aprendizado por Estilo</h4>
                    <p className="text-sm text-ink-500">A IA aprende com seus laudos finalizados.</p>
                  </div>
                </div>
                <button
                  onClick={() => setLocalSettings({ ...localSettings, aiTrainingEnabled: !localSettings.aiTrainingEnabled })}
                  className={classNames(
                    'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    localSettings.aiTrainingEnabled ? 'bg-indigo-600' : 'bg-ink-200'
                  )}
                >
                  <span className={classNames(
                    'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    localSettings.aiTrainingEnabled ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              <div className={classNames('space-y-8 transition-opacity duration-300', !localSettings.aiTrainingEnabled && 'opacity-40 pointer-events-none')}>
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm text-indigo-900 leading-relaxed">
                  <strong>Como funciona:</strong> Ao habilitar esta função, o LAUD.IA enviará seus últimos exames finalizados da mesma especialidade como contexto. Isso garante que a IA utilize o seu vocabulário, estilo de pontuação e estrutura preferida.
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: Database, label: 'Laudos no Banco', value: finalizedCount.toString(), sub: 'Finalizados', color: 'indigo' },
                    { icon: TrendingUp, label: 'Mimetismo Ativo', value: localSettings.aiTrainingContextSize || 3, sub: 'exames p/ geração', color: 'violet' },
                    { icon: FlaskConical, label: 'Qualidade Est.', value: localSettings.aiTrainingContextSize && localSettings.aiTrainingContextSize >= 5 ? 'Alta' : localSettings.aiTrainingContextSize && localSettings.aiTrainingContextSize >= 3 ? 'Média' : 'Baixa', sub: 'calibração', color: 'emerald' },
                  ].map((stat) => (
                    <div key={stat.label} className={`p-4 bg-${stat.color}-50 border border-${stat.color}-100 rounded-2xl text-center`}>
                      <stat.icon size={20} className={`text-${stat.color}-600 mx-auto mb-2`} />
                      <span className={`text-xl font-black text-${stat.color}-900 block`}>{stat.value}</span>
                      <span className={`text-[9px] font-black text-${stat.color}-600 uppercase tracking-widest block`}>{stat.label}</span>
                      <span className={`text-[9px] text-${stat.color}-400 block mt-0.5`}>{stat.sub}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4">
                  <label className="block text-sm font-bold text-ink-700 flex items-center gap-2">
                    Quantidade de Exames Contextuais
                    <span className="text-indigo-600 font-black text-lg">{localSettings.aiTrainingContextSize || 3}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={localSettings.aiTrainingContextSize || 3}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiTrainingContextSize: parseInt(e.target.value) })}
                    className="w-full h-3 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-ink-400 font-bold uppercase tracking-widest">
                    <span>1 — Rápido</span>
                    <span className="text-indigo-600">3-5 Ideal</span>
                    <span>10 — Lento</span>
                  </div>
                  <p className="text-xs text-ink-400 italic">Recomendado: 3 a 5 exames para o melhor equilíbrio entre fidelidade e velocidade.</p>
                </div>

                {/* Impacto Qualitativo */}
                <div className="pt-4 border-t border-ink-100">
                  <h5 className="text-[10px] font-black text-ink-600 uppercase tracking-widest mb-3">O que a IA aprende com seus laudos</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Estilo de Escrita', desc: 'Tom, pontuação e fraseologia típica do médico' },
                      { label: 'Vocabulário CBR', desc: 'Termos preferenciais para cada órgão e achado' },
                      { label: 'Nível de Detalhe', desc: 'Densidade descritiva da análise morfológica' },
                      { label: 'Padrão de Conduta', desc: 'Verbos e estrutura das recomendações N1-N4' },
                    ].map(item => (
                      <div key={item.label} className="p-4 bg-ink-50 border border-ink-100 rounded-2xl">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span className="text-[10px] font-black text-ink-800">{item.label}</span>
                        </div>
                        <p className="text-[10px] text-ink-500 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STATUS */}
        {activeTab === 'status' && (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-ink-900">Telemetria & Custos</h3>
                <p className="text-xs text-ink-400">Monitoramento de chamadas de IA, tokens e custos em BRL desta sessão</p>
              </div>
            </div>
            {/* Controles de Telemetria */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-2xl px-4 py-2.5 shadow-sm">
                <Filter size={14} className="text-ink-400" />
                <span className="text-xs font-bold text-ink-600">Filtrar:</span>
                {['all', 'generation', 'refine', 'copilot', 'template'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTelemetryModeFilter(mode)}
                    className={classNames(
                      'px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      telemetryModeFilter === mode
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                    )}
                  >
                    {mode === 'all' ? 'Todos' : mode === 'generation' ? 'Geração' : mode === 'refine' ? 'Refine' : mode === 'copilot' ? 'Copiloto' : 'Template'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-2xl px-4 py-2.5 shadow-sm">
                <TrendingUp size={14} className="text-violet-500" />
                <span className="text-xs font-bold text-ink-600">Taxa BRL:</span>
                <input
                  type="number"
                  min={1} max={20} step={0.1}
                  value={localSettings.aiConversionRateBRL ?? 5.5}
                  onChange={e => setLocalSettings(prev => ({ ...prev, aiConversionRateBRL: parseFloat(e.target.value) || 5.5 }))}
                  className="w-16 text-xs font-mono border border-ink-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-400 outline-none"
                />
                <span className="text-xs text-ink-400">USD/BRL</span>
              </div>
            </div>

            {/* Telemetria */}
            <TelemetryDashboard modeFilter={telemetryModeFilter} conversionRate={conversionRate} />

            {/* Connection Status */}
            <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-5 sm:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Activity size={28} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-ink-900">Status da IA</h4>
                  <p className="text-sm text-ink-500">Diagnóstico de conexão e configuração do motor.</p>
                </div>
              </div>

              {/* Provider Status */}
              <div className="space-y-4 mb-8">
                <h5 className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Provedor Ativo</h5>
                {[
                  {
                    name: 'Google Gemini',
                    provider: 'gemini',
                    icon: Cpu,
                    color: 'brand',
                    hasKey: !!localSettings.geminiApiKey,
                    model: localSettings.geminiModel || 'gemini-3.5-flash',
                    isActive: (localSettings.aiProvider || 'anthropic') === 'gemini',
                  },
                  {
                    name: 'Anthropic Claude',
                    provider: 'anthropic',
                    icon: BrainCircuit,
                    color: 'violet',
                    hasKey: !!localSettings.anthropicApiKey,
                    model: localSettings.anthropicModel || 'claude-3-5-sonnet-latest',
                    isActive: localSettings.aiProvider === 'anthropic',
                  },
                ].map((prov) => (
                  <div
                    key={prov.provider}
                    className={classNames(
                      'p-5 rounded-2xl border flex items-center justify-between transition-all',
                      prov.isActive
                        ? 'bg-brand-50/50 border-brand-200/50'
                        : 'bg-ink-50/30 border-ink-100'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={classNames(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        prov.isActive ? 'bg-brand-100 text-brand-600' : 'bg-ink-100 text-ink-400'
                      )}>
                        <prov.icon size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-ink-900">{prov.name}</span>
                          {prov.isActive && (
                            <span className="px-2 py-0.5 bg-brand-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Ativo</span>
                          )}
                        </div>
                        <span className="text-[10px] text-ink-500 font-mono">{prov.model}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {prov.hasKey ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <Wifi size={12} className="text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-700 uppercase">Configurado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl">
                          <WifiOff size={12} className="text-red-500" />
                          <span className="text-[10px] font-black text-red-600 uppercase">Sem API Key</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Test */}
              <div className="pt-6 border-t border-ink-100">
                <h5 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-4">Teste de Conectividade</h5>
                <div className="flex items-center gap-4">
                  {!readOnly && (
                    <>
                      <button
                        onClick={testConnection}
                        disabled={testStatus === 'testing'}
                        className={classNames(
                          'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all border bg-white',
                          testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            testStatus === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              testStatus === 'testing' ? 'bg-brand-50 text-brand-600 border-brand-200' :
                                'bg-ink-50 text-ink-700 border-ink-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                        )}
                      >
                        {testStatus === 'testing' ? (
                          <><Loader2 size={16} className="animate-spin" /> Testando Conexão...</>
                        ) : testStatus === 'success' ? (
                          <><CheckCircle2 size={16} /> Conexão OK!</>
                        ) : testStatus === 'error' ? (
                          <><AlertCircle size={16} /> Falha na Conexão</>
                        ) : (
                          <><Zap size={16} /> Testar Agora</>
                        )}
                      </button>
                      {testStatus !== 'idle' && (
                        <button
                          onClick={() => setTestStatus('idle')}
                          className="text-sm text-ink-400 hover:text-ink-600 font-bold"
                        >
                          Resetar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Config Summary */}
            <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-5 sm:p-8">
              <h5 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-6">Resumo de Configuração</h5>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Motor', value: (localSettings.aiProvider || 'anthropic') === 'gemini' ? 'Google Gemini' : 'Anthropic Claude', icon: Cpu },
                  { label: 'Modelo', value: (localSettings.aiProvider || 'anthropic') === 'gemini' ? (localSettings.geminiModel || 'gemini-3.5-flash') : (localSettings.anthropicModel || 'claude-3-5-sonnet-latest'), icon: BrainCircuit },
                  { label: 'Temperatura', value: `${localSettings.aiTemperature ?? 0.3} — ${(localSettings.aiTemperature ?? 0.3) <= 0.2 ? 'Clínico' : (localSettings.aiTemperature ?? 0.3) <= 0.5 ? 'Balanceado' : 'Criativo'}`, icon: Sliders },
                  { label: 'Treinamento', value: localSettings.aiTrainingEnabled ? `Ativo (${localSettings.aiTrainingContextSize || 3} exames)` : 'Desativado', icon: GraduationCap },
                ].map(item => (
                  <div key={item.label} className="p-4 bg-ink-50 rounded-2xl border border-ink-100">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon size={14} className="text-ink-400" />
                      <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-ink-800 leading-tight">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Versão */}
            <div className="bg-gradient-to-r from-brand-50 to-indigo-50/50 border border-brand-100/50 rounded-2xl p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Laud.IA Core</span>
                <p className="text-[11px] text-ink-600 font-bold leading-relaxed">
                  Motor cognitivo radiológico v2.0 — Cascata Tripartite + Regras Rígidas + Temperatura Adaptativa + Retry Automático + Telemetria.
                </p>
              </div>
              <div className="px-4 py-2 bg-white border border-brand-200 rounded-xl text-[10px] font-black text-brand-700 shadow-sm">
                v2.0 PROD
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
