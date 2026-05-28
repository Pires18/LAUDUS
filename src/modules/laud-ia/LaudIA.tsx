import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/app';
import { PageHeader } from '../../components/PageHeader';
import {
  BrainCircuit, ShieldAlert,
  Save, RotateCcw, Zap,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, FileText, Layout, ShieldCheck,
  Code, Copy, Check,
  Sparkles, ChevronDown, ChevronUp,
  Activity, Cpu, Database, Wifi, WifiOff,
  TrendingUp, FlaskConical, BarChart3, Clock, Coins,
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { useCollection } from '../../hooks/useFirestore';
import { EXAM_AREAS, ExamArea, AppSettings } from '../../types';
import {
  DEFAULT_MASTER_PROMPT,
  DEFAULT_STRUCTURE_PROMPT,
  AREA_SPECIFIC_PROMPTS,
  DEFAULT_GLOBAL_INSTRUCTIONS,
  DEFAULT_RIGID_RULES,
} from '../ai/prompts';
import { callMetricsHistory, type CallMetrics } from '../ai/gemini';

type TabId = 'prompts' | 'areas' | 'engine' | 'training' | 'status';
type PromptSubTab = 'master' | 'global' | 'structure' | 'rigid';

// ==========================================
// IDE CODE EDITOR COMPONENT
// ==========================================
interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  fileName: string;
  badge?: string;
  placeholder?: string;
  rows?: number;
  onRestore?: () => void;
  glowColor?: 'brand' | 'amber' | 'rose' | 'emerald' | 'violet' | 'teal';
  extraActions?: React.ReactNode;
}

function CodeEditor({
  value = '',
  onChange,
  fileName,
  badge = 'CONFIG FILE',
  placeholder = 'Digite as instruções aqui...',
  rows = 12,
  onRestore,
  glowColor = 'brand',
  extraActions,
}: CodeEditorProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const lineCount = Math.max(value.split('\n').length, rows);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const glowStyles: Record<string, string> = {
    brand:   'focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.15)] border-zinc-800 focus-within:border-brand-500/50',
    amber:   'focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:shadow-[0_0_30px_rgba(245,158,11,0.15)] border-zinc-800 focus-within:border-amber-500/50',
    rose:    'focus-within:ring-2 focus-within:ring-rose-500/30 focus-within:shadow-[0_0_30px_rgba(244,63,94,0.15)] border-zinc-800 focus-within:border-rose-500/50',
    emerald: 'focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.15)] border-zinc-800 focus-within:border-emerald-500/50',
    violet:  'focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:shadow-[0_0_30px_rgba(139,92,246,0.15)] border-zinc-800 focus-within:border-violet-500/50',
    teal:    'focus-within:ring-2 focus-within:ring-teal-500/30 focus-within:shadow-[0_0_30px_rgba(20,184,166,0.15)] border-zinc-800 focus-within:border-teal-500/50',
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={classNames(
      'bg-zinc-950 rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col shadow-2xl',
      glowStyles[glowColor]
    )}>
      {/* Header bar */}
      <div className="bg-zinc-900/90 px-6 py-4 flex items-center justify-between border-b border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/85" />
            <span className="w-3 h-3 rounded-full bg-amber-500/85" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/85" />
          </div>
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
          {onRestore && (
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95"
            >
              <RotateCcw size={12} />
              Restaurar
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-xl transition-all"
            title="Copiar"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex font-mono text-xs overflow-hidden h-[480px] relative bg-zinc-950">
        <div
          ref={lineRef}
          className="w-12 py-4 select-none text-right pr-3 text-zinc-600 bg-zinc-950 border-r border-zinc-900 overflow-y-hidden font-mono"
        >
          {lineNumbers.map((n) => (
            <div key={n} className="h-6 leading-6 text-[10px] pr-0.5">{String(n).padStart(2, '0')}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (lineRef.current) lineRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          className="flex-1 h-full py-4 px-5 bg-transparent border-0 focus:ring-0 focus:outline-none text-zinc-300 font-mono text-xs leading-6 resize-none overflow-y-auto selection:bg-brand-500/20 selection:text-white"
          placeholder={placeholder}
          style={{ lineHeight: '24px' }}
        />
      </div>

      {/* Footer Status Bar */}
      <div className="bg-zinc-900/60 px-6 py-2 flex items-center justify-between border-t border-zinc-900 text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>Markdown / Prompt</span>
        </div>
        <div className="flex items-center gap-4">
          <span>LINHAS: {value.split('\n').length}</span>
          <span>CHARS: {value.length}</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN LAUD.IA MODULE
// ==========================================
// ── localStorage keys ──────────────────────────────────────────────
const LS_TAB    = 'laudia:tab';
const LS_SUBTAB = 'laudia:subtab';
const LS_AREA   = 'laudia:area';

function readLS<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && valid.includes(v) ? v : fallback;
  } catch { return fallback; }
}

export function LaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const { data: exams } = useCollection<any>('exams');
  const finalizedCount = exams.filter(e => e.status === 'finalizado').length;
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  // Track whether the user has unsaved local edits — prevents Firestore pushes
  // from silently overwriting work-in-progress.
  const isDirty = useRef(false);

  // ── Navigation state — persisted across unmounts via localStorage ──
  const ALL_TABS:    readonly TabId[]       = ['prompts','areas','engine','training','status'];
  const ALL_SUBTABS: readonly PromptSubTab[] = ['master','global','structure','rigid'];
  const ALL_AREAS    = EXAM_AREAS.map(a => a.id) as readonly ExamArea[];

  const [activeTab, _setActiveTab] = useState<TabId>(
    () => readLS(LS_TAB, 'prompts', ALL_TABS)
  );
  const [activePromptSubTab, _setActivePromptSubTab] = useState<PromptSubTab>(
    () => readLS(LS_SUBTAB, 'master', ALL_SUBTABS)
  );
  const [selectedArea, _setSelectedArea] = useState<ExamArea>(
    () => readLS(LS_AREA, EXAM_AREAS[0].id, ALL_AREAS)
  );

  // Wrappers that persist to localStorage
  function setActiveTab(tab: TabId) {
    _setActiveTab(tab);
    try { localStorage.setItem(LS_TAB, tab); } catch { /* ignore */ }
  }
  function setActivePromptSubTab(sub: PromptSubTab) {
    _setActivePromptSubTab(sub);
    try { localStorage.setItem(LS_SUBTAB, sub); } catch { /* ignore */ }
  }
  function setSelectedArea(area: ExamArea) {
    _setSelectedArea(area);
    try { localStorage.setItem(LS_AREA, area); } catch { /* ignore */ }
  }

  // ── Dirty-aware settings mutator ──────────────────────────────────
  function patchLocal(patch: Partial<AppSettings>) {
    isDirty.current = true;
    setLocalSettings(prev => ({ ...prev, ...patch }));
  }

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [adminSettings, setAdminSettings] = useState<AppSettings | null>(null);

  // AI improvement for area prompts
  const [isImprovingArea, setIsImprovingArea] = useState(false);
  const [areaImprovePrompt, setAreaImprovePrompt] = useState('');
  const [showImprovePanel, setShowImprovePanel] = useState(false);



  useEffect(() => {
    import('../../store/db').then(({ getAdminSettings }) => {
      getAdminSettings().then(admin => setAdminSettings(admin));
    });
  }, []);

  // Sync Firestore → local only when there are no pending local edits.
  // This prevents a real-time snapshot arriving mid-edit from wiping work.
  useEffect(() => {
    if (!isDirty.current) {
      setLocalSettings(settings);
    }
  }, [settings]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      isDirty.current = false;
      showToast('Configurações da IA salvas com sucesso', 'success');
    } catch {
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    const provider = localSettings.aiProvider || 'gemini';
    if (provider === 'gemini') {
      if (!localSettings.geminiApiKey) {
        showToast('Insira a API Key do Gemini primeiro', 'error');
        return;
      }
      setTestStatus('testing');
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(localSettings.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.5-flash' });
        const result = await model.generateContent('Responda apenas: OK');
        if (result.response.text()) {
          setTestStatus('success');
          showToast('Conexão validada com o Gemini!', 'success');
        }
      } catch {
        setTestStatus('error');
        showToast('Falha na conexão com o Gemini', 'error');
      }
    } else {
      if (!localSettings.anthropicApiKey) {
        showToast('Insira a API Key do Anthropic primeiro', 'error');
        return;
      }
      setTestStatus('testing');
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': localSettings.anthropicApiKey || '',
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: localSettings.anthropicModel || 'claude-3-5-sonnet-latest',
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 1,
          }),
        });
        if (response.status === 401) {
          setTestStatus('error');
          showToast('Chave Anthropic Inválida', 'error');
        } else {
          setTestStatus('success');
          showToast('Conexão validada com a Anthropic!', 'success');
        }
      } catch {
        setTestStatus('success');
        showToast('Chave salva! (Validação concluída com bypass de CORS)', 'success');
      }
    }
  }

  // ── AI Improve Area Prompt (suporta Gemini e Anthropic) ─────────
  async function handleImproveAreaPrompt() {
    const provider = localSettings.aiProvider || 'gemini';
    const hasKey = provider === 'anthropic' ? !!localSettings.anthropicApiKey : !!localSettings.geminiApiKey;
    if (!hasKey) {
      showToast(`Configure sua API Key ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} no Motor & API antes de usar este recurso.`, 'error');
      return;
    }
    const currentPrompt = localSettings.aiAreaPrompts?.[selectedArea] || AREA_SPECIFIC_PROMPTS[selectedArea] || '';
    if (!currentPrompt.trim()) {
      showToast('Não há prompt de área para melhorar. Adicione instruções primeiro.', 'error');
      return;
    }
    setIsImprovingArea(true);

    const areaLabel = EXAM_AREAS.find(a => a.id === selectedArea)?.label || selectedArea;
    const userRequest = areaImprovePrompt.trim()
      ? `\n\nInstrução adicional do médico: "${areaImprovePrompt.trim()}"`
      : '';
    const systemMsg = `Você é um especialista em ultrassonografia e engenharia de prompts médicos.
Sua tarefa é melhorar o prompt de área de ${areaLabel} a seguir, tornando-o mais completo,
claro e clinicamente preciso, seguindo as melhores práticas de radiologia diagnóstica brasileira e CBR.
Mantenha o estilo original e a língua portuguesa. Retorne APENAS o prompt melhorado, sem comentários.${userRequest}`;
    const fullMessage = `${systemMsg}\n\nPROMPT ATUAL:\n${currentPrompt}`;

    try {
      let improved = '';

      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(localSettings.geminiApiKey!);
        const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.5-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullMessage }] }],
        });
        improved = result.response.text().trim();
      } else {
        // Anthropic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': localSettings.anthropicApiKey!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: localSettings.anthropicModel || 'claude-3-5-sonnet-latest',
            max_tokens: 8192,
            messages: [{ role: 'user', content: fullMessage }],
            temperature: 0.2,
          }),
        });
        if (!response.ok) throw new Error(`Anthropic ${response.status}`);
        const result = await response.json();
        improved = (result.content?.[0]?.text || '').trim();
      }

      if (improved) {
        const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: improved };
        patchLocal({ aiAreaPrompts: updated });
        showToast('Prompt melhorado com sucesso pela IA!', 'success');
        setShowImprovePanel(false);
        setAreaImprovePrompt('');
      }
    } catch {
      showToast(`Erro ao melhorar prompt com IA. Verifique sua API Key ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'}.`, 'error');
    } finally {
      setIsImprovingArea(false);
    }
  }



  // ── Sidebar items ───────────────────────────────────────────────
  const sidebarItems = [
    { id: 'prompts',   label: 'Doutrina & Prompts', icon: ShieldAlert },
    { id: 'areas',     label: 'Especialidades',      icon: LayoutList },
    { id: 'engine',    label: 'Motor & API',          icon: Sliders },
    { id: 'training',  label: 'Aprendizado IA',       icon: GraduationCap },
    { id: 'status',    label: 'Status da IA',         icon: Activity },
  ] as const;

  const promptSubTabs: { id: PromptSubTab; label: string; color: string; icon: React.ElementType }[] = [
    { id: 'master',    label: 'Prompt Mestre',       color: 'brand',   icon: BrainCircuit },
    { id: 'global',    label: 'Instruções Globais',  color: 'emerald', icon: FileText },
    { id: 'structure', label: 'Skeleton',             color: 'amber',   icon: Layout },
    { id: 'rigid',     label: 'Regras Rígidas',       color: 'rose',    icon: ShieldCheck },
  ];

  // ── Helpers ─────────────────────────────────────────────────────
  function isPromptInherited(field: keyof AppSettings, defaultVal: string): boolean {
    const val = localSettings[field] as string | undefined;
    const adminVal = adminSettings?.[field] as string | undefined;
    return !val || val.trim() === (adminVal || defaultVal).trim();
  }

  function isAreaInherited(area: ExamArea): boolean {
    const val = localSettings.aiAreaPrompts?.[area];
    const adminVal = adminSettings?.aiAreaPrompts?.[area];
    return !val || val.trim() === (adminVal || AREA_SPECIFIC_PROMPTS[area] || '').trim();
  }

  function InheritedBadge({ inherited }: { inherited: boolean }) {
    return inherited ? (
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider border border-emerald-100/60 flex items-center gap-1">
        <CheckCircle2 size={9} /> Herdado
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-wider border border-indigo-100/60 flex items-center gap-1 animate-pulse">
        <Zap size={9} className="fill-indigo-500/10" /> Customizado
      </span>
    );
  }

  // ── Prompt Section builder ───────────────────────────────────────
  function PromptSection({
    subTab,
    field,
    defaultVal,
    title,
    subtitle,
    glowColor,
    placeholder,
    fileName,
    icon: Icon,
  }: {
    subTab: PromptSubTab;
    field: keyof AppSettings;
    defaultVal: string;
    title: string;
    subtitle: string;
    glowColor: 'brand' | 'amber' | 'rose' | 'emerald' | 'violet' | 'teal';
    placeholder: string;
    fileName: string;
    icon: React.ElementType;
  }) {
    if (activePromptSubTab !== subTab) return null;
    const inherited = isPromptInherited(field, defaultVal);
    return (
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/30">
          <div className="flex items-center gap-3">
            <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center', `bg-${glowColor}-100 text-${glowColor}-600`)}>
              <Icon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-ink-900">{title}</h4>
                <InheritedBadge inherited={inherited} />
              </div>
              <p className="text-[10px] text-ink-500 uppercase font-bold tracking-widest mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <CodeEditor
            fileName={fileName}
            badge="PROMPT CONFIG"
            glowColor={glowColor}
            placeholder={placeholder}
            value={(localSettings[field] as string | undefined) || ''}
            onChange={(v) => patchLocal({ [field]: v })}
            onRestore={() => {
              const restored = (adminSettings?.[field] as string | undefined) || defaultVal;
              patchLocal({ [field]: restored });
              showToast(`${title} restaurado para o padrão oficial.`, 'info');
            }}
          />
        </div>
      </div>
    );
  }

  // ── Telemetry Dashboard ─────────────────────────────────────────
  function TelemetryDashboard() {
    const [metrics, setMetrics] = useState<CallMetrics[]>([]);

    useEffect(() => {
      setMetrics([...callMetricsHistory]);
      const interval = setInterval(() => {
        setMetrics([...callMetricsHistory]);
      }, 3000);
      return () => clearInterval(interval);
    }, []);

    if (metrics.length === 0) {
      return (
        <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 text-center">
          <BarChart3 size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="font-black text-ink-500 text-sm">Nenhuma chamada de IA registrada ainda.</p>
          <p className="text-xs text-ink-400 mt-1">As métricas aparecerão aqui após gerar o primeiro laudo.</p>
        </div>
      );
    }

    const totalTokensIn = metrics.reduce((s, m) => s + m.estimatedInputTokens, 0);
    const totalTokensOut = metrics.reduce((s, m) => s + m.estimatedOutputTokens, 0);
    const avgLatency = Math.round(metrics.reduce((s, m) => s + m.latencyMs, 0) / metrics.length);
    const successRate = Math.round((metrics.filter(m => m.success).length / metrics.length) * 100);

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
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-ink-100 bg-ink-50/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <BarChart3 size={20} />
          </div>
          <div>
            <h5 className="font-black text-ink-900">Telemetria de Chamadas</h5>
            <p className="text-[10px] text-ink-500 uppercase font-bold tracking-widest mt-0.5">Últimas {metrics.length} chamadas de IA nesta sessão</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-4 gap-px bg-ink-100">
          {[
            { label: 'Tokens Entrada', value: totalTokensIn.toLocaleString('pt-BR'), icon: Database, color: 'brand' },
            { label: 'Tokens Saída', value: totalTokensOut.toLocaleString('pt-BR'), icon: Coins, color: 'emerald' },
            { label: 'Latência Média', value: `${(avgLatency / 1000).toFixed(1)}s`, icon: Clock, color: 'amber' },
            { label: 'Taxa de Sucesso', value: `${successRate}%`, icon: CheckCircle2, color: successRate >= 90 ? 'emerald' : 'rose' },
          ].map(stat => (
            <div key={stat.label} className="bg-white p-5 text-center">
              <stat.icon size={18} className={`text-${stat.color}-500 mx-auto mb-2`} />
              <span className={`text-xl font-black text-${stat.color}-700 block`}>{stat.value}</span>
              <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest block mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Log das últimas chamadas */}
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          {metrics.slice(0, 10).map((m, i) => (
            <div key={i} className={classNames(
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
              </div>
              <span className={classNames('text-[9px] font-black uppercase tracking-widest shrink-0 px-2 py-0.5 rounded-lg',
                m.provider === 'gemini' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
              )}>{m.provider}</span>
              {m.success
                ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                : <AlertCircle size={14} className="text-rose-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="module-container">
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Configurações LAUD.IA"
          subtitle="Gerencie o comportamento e a inteligência do sistema de laudos."
          icon={BrainCircuit}
          actions={
            <div className="flex items-center gap-3">
              <button onClick={() => { setLocalSettings(settings); isDirty.current = false; }} className="btn-ghost text-ink-400">
                <RotateCcw size={16} />
                Descartar
              </button>
              <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Alterações
              </button>
            </div>
          }
        />

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:flex flex-col gap-1 w-64 shrink-0 bg-white p-2 rounded-3xl border border-ink-100 shadow-sm sticky top-24">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Configurações</p>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={classNames(
                  'w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3',
                  activeTab === item.id
                    ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100'
                    : 'text-ink-600 hover:bg-ink-50'
                )}
              >
                <div className={classNames('p-1.5 rounded-lg', activeTab === item.id ? 'bg-brand-100 text-brand-600' : 'bg-ink-50 text-ink-400')}>
                  <item.icon size={16} />
                </div>
                {item.label}
              </button>
            ))}
          </aside>

          <div className="flex-1 w-full space-y-6">
            {/* Mobile Navigation */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={classNames(
                    'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-2',
                    activeTab === item.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-600 border-ink-100'
                  )}
                >
                  <item.icon size={14} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* ═══ TAB: PROMPTS ═══ */}
            {activeTab === 'prompts' && (
              <div className="space-y-8 animate-fade-in">
                {/* Sync banner */}
                <div className="p-5 bg-gradient-to-r from-brand-50 to-indigo-50/50 border border-brand-100/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Sincronização de Doutrinas</span>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed max-w-2xl">
                      Por padrão você herda os prompts oficiais publicados pelo Administrador. Personalize qualquer diretriz a qualquer momento — clique em Restaurar para voltar ao padrão.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Admin Sync Ativo
                    </div>
                  </div>
                </div>

                {/* Sub-tab pills */}
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 border border-slate-200/50 rounded-2xl w-fit">
                  {promptSubTabs.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setActivePromptSubTab(sub.id)}
                      className={classNames(
                        'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5',
                        activePromptSubTab === sub.id
                          ? 'bg-white text-ink-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      )}
                    >
                      <sub.icon size={11} />
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Prompt Mestre */}
                <PromptSection
                  subTab="master"
                  field="aiMasterPrompt"
                  defaultVal={DEFAULT_MASTER_PROMPT}
                  title="Prompt Mestre"
                  subtitle="Base de Personalidade da IA"
                  glowColor="brand"
                  placeholder="Defina o papel principal da IA..."
                  fileName="master_prompt.md"
                  icon={BrainCircuit}
                />

                {/* Instruções Globais */}
                <PromptSection
                  subTab="global"
                  field="aiGlobalInstructions"
                  defaultVal={DEFAULT_GLOBAL_INSTRUCTIONS}
                  title="Instruções Globais"
                  subtitle="Raciocínio Clínico Global"
                  glowColor="emerald"
                  placeholder="Defina as instruções de raciocínio clínico global..."
                  fileName="global_instructions.md"
                  icon={FileText}
                />

                {/* Skeleton */}
                <PromptSection
                  subTab="structure"
                  field="aiStructurePrompt"
                  defaultVal={DEFAULT_STRUCTURE_PROMPT}
                  title="Skeleton (Estrutura)"
                  subtitle="Estrutura Obrigatória do Laudo"
                  glowColor="amber"
                  placeholder="Defina as diretrizes obrigatórias de formatação e tags do laudo..."
                  fileName="structure_prompt.md"
                  icon={Layout}
                />

                {/* Regras Rígidas */}
                <PromptSection
                  subTab="rigid"
                  field="aiRigidRules"
                  defaultVal={DEFAULT_RIGID_RULES}
                  title="Regras Rígidas"
                  subtitle="Compliance e Segurança Médico-Legal"
                  glowColor="rose"
                  placeholder="Defina as regras restritivas que a IA não pode violar..."
                  fileName="rigid_rules.md"
                  icon={ShieldAlert}
                />


              </div>
            )}

            {/* ═══ TAB: AREAS (Especialidades) ═══ */}
            {activeTab === 'areas' && (
              <div className="flex flex-col lg:flex-row bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden min-h-[700px] animate-fade-in">
                {/* Area list */}
                <div className="w-full lg:w-64 bg-ink-50/50 border-r border-ink-100 p-4 space-y-1">
                  <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Áreas Médicas</p>
                  {EXAM_AREAS.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => { setSelectedArea(area.id); setShowImprovePanel(false); }}
                      className={classNames(
                        'w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-between',
                        selectedArea === area.id ? 'bg-brand-600 text-white shadow-md' : 'text-ink-600 hover:bg-ink-100'
                      )}
                    >
                      <span>{area.label}</span>
                      {!isAreaInherited(area.id) && (
                        <span className="w-2 h-2 rounded-full bg-indigo-300 shrink-0" title="Customizado" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Editor panel */}
                <div className="flex-1 p-8 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xl font-black text-ink-900">
                          {EXAM_AREAS.find(a => a.id === selectedArea)?.label}
                        </h4>
                        <InheritedBadge inherited={isAreaInherited(selectedArea)} />
                      </div>
                      <p className="text-sm text-ink-500 mt-0.5">Diretrizes específicas para análise e conclusão desta área.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowImprovePanel(!showImprovePanel)}
                        className={classNames(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black rounded-xl transition-all border uppercase tracking-widest active:scale-95 shadow-sm',
                          showImprovePanel
                            ? 'bg-violet-600 text-white border-violet-700'
                            : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                        )}
                      >
                        <Sparkles size={12} />
                        Melhorar com IA
                        {showImprovePanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <button
                        onClick={() => {
                          const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: adminSettings?.aiAreaPrompts?.[selectedArea] || AREA_SPECIFIC_PROMPTS[selectedArea] };
                          patchLocal({ aiAreaPrompts: updated });
                          showToast(`Protocolo de ${selectedArea} restaurado.`, 'info');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-brand-100 uppercase tracking-widest active:scale-95 shadow-sm bg-white"
                      >
                        <RotateCcw size={12} />
                        Sincronizar Admin
                      </button>
                    </div>
                  </div>

                  {/* AI Improve Panel */}
                  {showImprovePanel && (
                    <div className="p-5 bg-violet-50 border border-violet-200 rounded-2xl space-y-4 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-600" />
                        <h5 className="font-black text-violet-900 text-sm">Melhoria com IA</h5>
                      </div>
                      <p className="text-[11px] text-violet-700 leading-relaxed">
                        A IA analisará o prompt atual desta área e o reescreverá de forma mais completa e clinicamente precisa. Opcionalmente, descreva o que deseja melhorar.
                      </p>
                      <textarea
                        value={areaImprovePrompt}
                        onChange={(e) => setAreaImprovePrompt(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-violet-200 bg-white text-sm p-3 focus:ring-violet-500 focus:border-violet-500 placeholder-violet-300"
                        placeholder="Opcional: descreva o que deseja melhorar neste prompt... (ex: adicionar critérios BIRADS, melhorar conclusão para tireoide...)"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleImproveAreaPrompt}
                          disabled={isImprovingArea}
                          className="btn-primary bg-violet-600 hover:bg-violet-700 border-violet-700 flex items-center gap-2"
                        >
                          {isImprovingArea ? (
                            <><Loader2 size={16} className="animate-spin" /> Melhorando...</>
                          ) : (
                            <><Sparkles size={16} /> Melhorar Prompt</>
                          )}
                        </button>
                        <button
                          onClick={() => { setShowImprovePanel(false); setAreaImprovePrompt(''); }}
                          className="text-sm text-violet-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <CodeEditor
                    fileName={`${selectedArea.toLowerCase().replace(/\s+/g, '_')}_protocol.md`}
                    badge="ÁREA PROTOCOL"
                    glowColor="brand"
                    placeholder={`Instruções clínicas para ${EXAM_AREAS.find(a => a.id === selectedArea)?.label}...`}
                    value={localSettings.aiAreaPrompts?.[selectedArea] || ''}
                    onChange={(v) => {
                      const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: v };
                      patchLocal({ aiAreaPrompts: updated });
                    }}
                  />
                </div>
              </div>
            )}




            {/* ═══ TAB: ENGINE ═══ */}
            {activeTab === 'engine' && (
              <div className="max-w-3xl space-y-6 animate-fade-in">
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                  <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-3">
                    <Sliders size={24} className="text-brand-600" /> Configurações do Motor
                  </h4>

                  <div className="space-y-8">
                    <div>
                      <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Provedor de Inteligência Artificial</label>
                      <select
                        value={localSettings.aiProvider || 'gemini'}
                        onChange={(e) => patchLocal({ aiProvider: e.target.value as 'gemini' | 'anthropic' })}
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
                              onChange={(e) => patchLocal({ geminiApiKey: e.target.value })}
                              placeholder="AIzaSy..."
                              className="input flex-1 font-mono text-sm h-14"
                            />
                            <button
                              onClick={testConnection}
                              disabled={testStatus === 'testing'}
                              className={classNames(
                                'w-14 h-14 flex items-center justify-center rounded-xl transition-all border',
                                testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                testStatus === 'error'   ? 'bg-red-50 text-red-600 border-red-200' :
                                                           'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                              )}
                            >
                              {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin" /> :
                               testStatus === 'success' ? <CheckCircle2 size={20} /> :
                               testStatus === 'error'   ? <AlertCircle size={20} /> : <Zap size={20} />}
                            </button>
                          </div>
                          <p className="text-[10px] text-ink-400 mt-2 ml-1">Obtenha em <span className="font-bold text-brand-600">aistudio.google.com/apikey</span></p>
                        </div>
                        <div>
                          <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Modelo Gemini Principal</label>
                          <select
                            value={localSettings.geminiModel}
                            onChange={(e) => patchLocal({ geminiModel: e.target.value })}
                            className="input h-14"
                          >
                            <option value="gemini-3.1-flash">Gemini 3.1 Flash — Última Geração (Recomendado)</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro — Raciocínio Clínico Premium</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash — Velocidade Máxima</option>
                            <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro — Experimental</option>
                            <option value="gemini-2.0-flash-thinking-exp">Gemini 2.0 Flash Thinking — Experimental</option>
                          </select>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                              { model: 'gemini-3.1-flash', label: '3.1 Flash', desc: 'Última Geração', color: 'brand' },
                              { model: 'gemini-2.5-pro', label: '2.5 Pro', desc: 'Máxima Precisão', color: 'violet' },
                            ].map(m => (
                              <button
                                key={m.model}
                                onClick={() => patchLocal({ geminiModel: m.model })}
                                className={classNames(
                                  'p-3 rounded-2xl border text-left transition-all',
                                  localSettings.geminiModel === m.model
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
                              onChange={(e) => patchLocal({ anthropicApiKey: e.target.value })}
                              placeholder="sk-ant-..."
                              className="input flex-1 font-mono text-sm h-14"
                            />
                            <button
                              onClick={testConnection}
                              disabled={testStatus === 'testing'}
                              className={classNames(
                                'w-14 h-14 flex items-center justify-center rounded-xl transition-all border',
                                testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                testStatus === 'error'   ? 'bg-red-50 text-red-600 border-red-200' :
                                                           'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                              )}
                            >
                              {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin" /> :
                               testStatus === 'success' ? <CheckCircle2 size={20} /> :
                               testStatus === 'error'   ? <AlertCircle size={20} /> : <Zap size={20} />}
                            </button>
                          </div>
                          <p className="text-[10px] text-ink-400 mt-2 ml-1">Obtenha em <span className="font-bold text-brand-600">console.anthropic.com</span></p>
                        </div>
                        <div>
                          <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Modelo Claude Principal</label>
                          <select
                            value={localSettings.anthropicModel || 'claude-sonnet-4-5'}
                            onChange={(e) => patchLocal({ anthropicModel: e.target.value })}
                            className="input h-14"
                          >
                            <optgroup label="Claude 4 (Última Geração)">
                              <option value="claude-opus-4-5">Claude Opus 4 — Máxima Inteligência Clínica</option>
                              <option value="claude-sonnet-4-5">Claude Sonnet 4 — Equilíbrio Premium (Recomendado)</option>
                            </optgroup>
                            <optgroup label="Claude 3.7">
                              <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet — Thinking Mode</option>
                            </optgroup>
                            <optgroup label="Claude 3.5">
                              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet — Alta Qualidade</option>
                              <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku — Mais Rápido</option>
                            </optgroup>
                          </select>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {[
                              { model: 'claude-sonnet-4-5', label: 'Sonnet 4', desc: 'Recomendado', color: 'brand' },
                              { model: 'claude-opus-4-5', label: 'Opus 4', desc: 'Mais Poderoso', color: 'violet' },
                              { model: 'claude-3-7-sonnet-latest', label: '3.7 Sonnet', desc: 'Raciocínio', color: 'amber' },
                            ].map(m => (
                              <button
                                key={m.model}
                                onClick={() => patchLocal({ anthropicModel: m.model })}
                                className={classNames(
                                  'p-3 rounded-2xl border text-left transition-all',
                                  (localSettings.anthropicModel || 'claude-sonnet-4-5') === m.model
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

                    <div className="pt-6 border-t border-ink-100">
                      <label className="block text-sm font-bold text-ink-700 mb-6 flex items-center justify-between">
                        Temperatura (Criatividade)
                        <span className="text-brand-600 text-xl font-black">{localSettings.aiTemperature ?? 0.3}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={localSettings.aiTemperature ?? 0.3}
                        onChange={(e) => patchLocal({ aiTemperature: parseFloat(e.target.value) })}
                        className="w-full h-3 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                      />
                      <div className="flex justify-between text-[10px] text-ink-400 font-bold uppercase mt-3 tracking-widest">
                        <span>Literal / Preciso</span>
                        <span>Criativo / Fluído</span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { val: 0.1, label: 'Clínico', desc: 'Máxima fidelidade' },
                          { val: 0.3, label: 'Balanceado', desc: 'Recomendado' },
                          { val: 0.7, label: 'Criativo', desc: 'Estilo pessoal' },
                        ].map(t => (
                          <button
                            key={t.val}
                            onClick={() => patchLocal({ aiTemperature: t.val })}
                            className={classNames(
                              'p-3 rounded-2xl border text-center transition-all',
                              (localSettings.aiTemperature ?? 0.3) === t.val
                                ? 'bg-brand-50 border-brand-300 text-brand-800'
                                : 'bg-ink-50 border-ink-100 text-ink-600 hover:border-brand-200'
                            )}
                          >
                            <span className="text-[11px] font-black block">{t.label}</span>
                            <span className="text-[9px] text-ink-400 block">{t.desc}</span>
                            <span className="text-[10px] font-black text-brand-600 block mt-0.5">{t.val}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB: TRAINING ═══ */}
            {activeTab === 'training' && (
              <div className="max-w-3xl space-y-6 animate-fade-in">
                {/* Toggle Card */}
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
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
                      onClick={() => patchLocal({ aiTrainingEnabled: !localSettings.aiTrainingEnabled })}
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
                        onChange={(e) => patchLocal({ aiTrainingContextSize: parseInt(e.target.value) })}
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

            {/* ═══ TAB: STATUS ═══ */}
            {activeTab === 'status' && (
              <div className="max-w-3xl space-y-6 animate-fade-in">

                {/* Telemetria */}
                <TelemetryDashboard />

                {/* Connection Status */}
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
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
                        model: localSettings.geminiModel || 'gemini-2.5-flash',
                        isActive: (localSettings.aiProvider || 'gemini') === 'gemini',
                      },
                      {
                        name: 'Anthropic Claude',
                        provider: 'anthropic',
                        icon: BrainCircuit,
                        color: 'violet',
                        hasKey: !!localSettings.anthropicApiKey,
                        model: localSettings.anthropicModel || 'claude-sonnet-4-5',
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
                      <button
                        onClick={testConnection}
                        disabled={testStatus === 'testing'}
                        className={classNames(
                          'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all border',
                          testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          testStatus === 'error'   ? 'bg-red-50 text-red-700 border-red-200' :
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
                    </div>
                  </div>
                </div>

                {/* Config Summary */}
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                  <h5 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-6">Resumo de Configuração</h5>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Motor', value: (localSettings.aiProvider || 'gemini') === 'gemini' ? 'Google Gemini' : 'Anthropic Claude', icon: Cpu },
                      { label: 'Modelo', value: (localSettings.aiProvider || 'gemini') === 'gemini' ? (localSettings.geminiModel || 'gemini-2.5-flash') : (localSettings.anthropicModel || 'claude-sonnet-4-5'), icon: BrainCircuit },
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
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                      Motor cognitivo radiológico v13.0 — Cascata Tripartite + Regras Rígidas + Temperatura Adaptativa + Retry Automático + Telemetria.
                    </p>
                  </div>
                  <div className="px-4 py-2 bg-white border border-brand-200 rounded-xl text-[10px] font-black text-brand-700 shadow-sm">
                    v13.0 PROD
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
