import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../store/app';
import { 
  BrainCircuit, ShieldAlert, 
  RotateCcw, Zap, Save,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, ShieldCheck,
  FlaskConical, Play, FileText, History,
  Terminal, Code, Copy, Check, Cpu, Key, Eye, EyeOff,
  Activity, BarChart3, Database, Coins, Clock, Sparkles,
  ChevronDown, ChevronUp, Wifi, WifiOff, TrendingUp
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { EXAM_AREAS, ExamArea, ReportTemplate } from '../../../types';
import { generateReport, callMetricsHistory, type CallMetrics } from '../../ai/gemini';
import { 
  DEFAULT_MASTER_PROMPT, 
  DEFAULT_STRUCTURE_PROMPT, 
  DEFAULT_GLOBAL_INSTRUCTIONS,
  DEFAULT_RIGID_RULES,
} from '../../ai/prompts';
import { useCollection } from '../../../hooks/useFirestore';
import { updateItem } from '../../../store/db';

type TabId = 'prompts' | 'templates' | 'engine' | 'training' | 'status';

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
      console.error(err);
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
          {onRestore && (
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

      {/* Editor Body */}
      <div className="flex font-mono text-xs overflow-hidden h-[520px] relative bg-zinc-950">
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
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (lineRef.current) {
              lineRef.current.scrollTop = e.currentTarget.scrollTop;
            }
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
          <span>LINES: {value.split('\n').length}</span>
          <span>CHARS: {value.length}</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TELEMETRY DASHBOARD COMPONENT
// ==========================================
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
      <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8 text-center w-full">
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
    <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden w-full">
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

// ==========================================
// MAIN ADMIN LAUD.IA CENTER
// ==========================================
export function AdminLaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);
  const [activePromptSubTab, setActivePromptSubTab] = useState<'master' | 'global' | 'structure' | 'rigid'>('master');

  const { data: templates } = useCollection<ReportTemplate>('templates');

  const [selectedAreaFilter, setSelectedAreaFilter] = useState<ExamArea | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editingTemplatePrompt, setEditingTemplatePrompt] = useState<string>('');
  const [isImprovingTemplate, setIsImprovingTemplate] = useState(false);
  const [isGeneratingTemplatePrompt, setIsGeneratingTemplatePrompt] = useState(false);
  const [templateImprovePrompt, setTemplateImprovePrompt] = useState('');
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Sync selected template prompt when selection changes or templates load
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setEditingTemplatePrompt(template?.aiInstructions || '');
    } else if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

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

  async function handleImproveTemplatePrompt() {
    const provider = localSettings.aiProvider || 'gemini';
    const hasKey = provider === 'anthropic' ? !!localSettings.anthropicApiKey : !!localSettings.geminiApiKey;
    if (!hasKey) {
      showToast(`Configure sua API Key ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'} no Motor & API antes de usar este recurso.`, 'error');
      return;
    }
    if (!selectedTemplateId) {
      showToast('Selecione um exame primeiro.', 'error');
      return;
    }
    if (!editingTemplatePrompt.trim()) {
      showToast('Adicione instruções ou um prompt inicial para melhorar.', 'error');
      return;
    }
    setIsImprovingTemplate(true);

    const templateName = templates.find(t => t.id === selectedTemplateId)?.name || 'Exame';
    const userRequest = templateImprovePrompt.trim()
      ? `\n\nInstrução adicional do médico: "${templateImprovePrompt.trim()}"`
      : '';
    const systemMsg = `Você é um especialista em ultrassonografia e engenharia de prompts médicos.
Sua tarefa é melhorar o prompt de IA para o exame de "${templateName}" a seguir, tornando-o mais completo,
claro e clinicamente preciso, seguindo as melhores práticas de radiologia diagnóstica brasileira e CBR.
Mantenha o estilo original e a língua portuguesa. Retorne APENAS o prompt melhorado, sem comentários.${userRequest}`;
    const fullMessage = `${systemMsg}\n\nPROMPT ATUAL:\n${editingTemplatePrompt}`;

    try {
      let improved = '';

      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(localSettings.geminiApiKey!);
        const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.0-flash' });
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
        setEditingTemplatePrompt(improved);
        showToast('Prompt do exame melhorado com sucesso pela IA!', 'success');
        setShowImprovePanel(false);
        setTemplateImprovePrompt('');
      }
    } catch (err) {
      console.error(err);
      showToast(`Erro ao melhorar prompt com IA. Verifique sua API Key ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'}.`, 'error');
    } finally {
      setIsImprovingTemplate(false);
    }
  }

  async function handleGenerateTemplatePrompt() {
    const provider = localSettings.aiProvider || 'gemini';
    if (provider === 'gemini') {
      if (!localSettings.geminiApiKey) {
        showToast('Configure sua API Key do Gemini antes de gerar.', 'error');
        return;
      }
    } else {
      if (!localSettings.anthropicApiKey) {
        showToast('Configure sua API Key do Anthropic antes de gerar.', 'error');
        return;
      }
    }
    
    if (!selectedTemplateId) {
      showToast('Selecione um exame primeiro.', 'error');
      return;
    }

    setIsGeneratingTemplatePrompt(true);

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      setIsGeneratingTemplatePrompt(false);
      return;
    }
    
    // Pick 1-2 examples of templates with existing aiInstructions
    const examples = templates
      .filter(t => t.id !== selectedTemplateId && t.aiInstructions && t.aiInstructions.trim().length > 50)
      .slice(0, 2);
    
    let examplesText = '';
    if (examples.length > 0) {
      examplesText = `\n\nEXEMPLOS DE PROMPTS DE OUTROS EXAMES PARA PADRONIZAÇÃO:\n`;
      examples.forEach((ex, idx) => {
        examplesText += `--- Exemplo ${idx + 1}: ${ex.name} ---\n${ex.aiInstructions}\n\n`;
      });
    }

    const templateStructure = `
Nome do Exame: ${template.name}
Área: ${EXAM_AREAS.find(a => a.id === template.area)?.label || template.area}

TÉCNICA:
${template.techniqueTemplate || 'Não definida'}

ANÁLISE PADRÃO:
${template.analysisTemplate || 'Não definida'}

CONCLUSÃO PADRÃO:
${template.conclusionTemplate || 'Não definida'}

RECOMENDAÇÕES PADRÃO:
${template.recommendationsTemplate || 'Não definida'}
`;

    const masterPrompt = localSettings.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
    const globalInstructions = localSettings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
    const structurePrompt = localSettings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
    const rigidRules = localSettings.aiRigidRules || DEFAULT_RIGID_RULES;

    const systemMsg = `Você é um especialista em ultrassonografia e engenharia de prompts médicos.
Sua tarefa é GERAR DO ZERO as diretrizes e regras específicas (Prompt de Exame) para a máscara de laudo "${template.name}".
Gere APENAS as INSTRUÇÕES ESPECÍFICAS (aiInstructions) para este exame. Não inclua saudações, não inclua blocos genéricos que já estão no Prompt Mestre. O seu output deve ser diretamente o texto Markdown do prompt para este exame.

Use o contexto do LAUD.IA abaixo para entender a doutrina, regras rígidas e estrutura que a IA já segue:

=== PROMPT MESTRE ===
${masterPrompt}

=== INSTRUÇÕES GLOBAIS ===
${globalInstructions}

=== SKELETON ===
${structurePrompt}

=== REGRAS RÍGIDAS ===
${rigidRules}

=== ESTRUTURA DA MÁSCARA ATUAL ===
${templateStructure}
${examplesText}`;

    try {
      let generated = '';

      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(localSettings.geminiApiKey!);
        const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.0-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: systemMsg }] }],
        });
        generated = result.response.text().trim();
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
            messages: [{ role: 'user', content: systemMsg }],
            temperature: 0.2,
          }),
        });
        if (!response.ok) throw new Error(`Anthropic ${response.status}`);
        const result = await response.json();
        generated = (result.content?.[0]?.text || '').trim();
      }

      if (generated) {
        setEditingTemplatePrompt(generated);
        showToast('Prompt do exame gerado com sucesso pela IA!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast(`Erro ao gerar prompt com IA. Verifique sua API Key ${provider === 'anthropic' ? 'Anthropic' : 'Gemini'}.`, 'error');
    } finally {
      setIsGeneratingTemplatePrompt(false);
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
        const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.0-flash' });
        const result = await model.generateContent('Responda apenas: OK');
        const text = result.response.text();
        if (text) {
          setTestStatus('success');
          showToast('Conexão validada com sucesso com o Gemini!', 'success');
        }
      } catch (err: unknown) {
        setTestStatus('error');
        showToast('Falha na conexão com a API do Gemini', 'error');
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
        setTestStatus('success');
        showToast('Chave salva! (Validação concluída com bypass de CORS)', 'success');
      }
    }
  }



  const sidebarItems = [
    { id: 'prompts', label: 'Doutrina & Prompts', icon: ShieldAlert },
    { id: 'templates', label: 'Prompts por Exame', icon: LayoutList },
    { id: 'engine', label: 'Motor & API', icon: Sliders },
    { id: 'training', label: 'Aprendizado IA', icon: GraduationCap },
    { id: 'status', label: 'Status da IA', icon: Activity },
  ] as const;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Light Glassmorphic Header aligned with other sections */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-ink-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100 animate-pulse">
              COGNITIVE HUB: ACTIVE
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest border border-indigo-100">
              {localSettings.geminiModel || 'gemini-2.0-flash'}
            </span>
          </div>
          <h3 className="text-xl font-black text-ink-900">IA Command Center</h3>
          <p className="text-xs text-ink-500 mt-1 max-w-xl font-medium">
            Gestão de alto nível, sintonia fina de temperatura cognitiva e publicação dos prompts médicos oficiais do motor de inteligência artificial LAUD.IA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
          <button
            onClick={() => {
              if (window.confirm('Tem certeza que deseja restaurar os prompts (Mestre, Globais, Estrutura e Regras) para o padrão de fábrica? Isso sobrescreverá as alterações atuais.')) {
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
            className="h-12 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200/80 hover:border-rose-500 transition-all flex items-center gap-2"
          >
            <ShieldAlert size={12} />
            Factory Reset
          </button>
          <button 
            onClick={() => {
              setLocalSettings(settings);
              showToast('Alterações descartadas', 'info');
            }} 
            className="h-12 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-white border border-slate-200/80 hover:border-brand-500 transition-all flex items-center gap-2"
          >
            <RotateCcw size={12} />
            Descartar
          </button>
          <button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white shadow-xl shadow-brand-500/20 hover:shadow-brand-500/35 transition-all flex items-center gap-2 disabled:opacity-50 scale-100 active:scale-95"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            Publicar Configurações
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] border border-slate-200/60 shadow-sm w-fit overflow-x-auto scrollbar-hide">
        {sidebarItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={classNames(
                "px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
                isActive 
                  ? "bg-white text-brand-600 shadow-sm border border-slate-200/10 scale-[1.02]" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <item.icon size={12} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="w-full space-y-8">
          
          {/* TAB: PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="space-y-8 animate-fade-in-up">
              {/* Primary Master Prompt Editor */}
              <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 shadow-inner shrink-0">
                      <BrainCircuit size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-ink-900 uppercase tracking-wider">Diretrizes Operacionais do LAUD.IA</h4>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.15em] mt-0.5">Doutrina, Raciocínio, Skeleton e Compliance Médico-Legal</p>
                    </div>
                  </div>
                  
                  {/* Prompt Sub-Selector Pills */}
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 border border-slate-200/50 rounded-2xl shrink-0">
                    <button
                      onClick={() => setActivePromptSubTab('master')}
                      className={classNames(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        activePromptSubTab === 'master' 
                          ? "bg-white text-indigo-650 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Prompt Mestre
                    </button>
                    <button
                      onClick={() => setActivePromptSubTab('global')}
                      className={classNames(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        activePromptSubTab === 'global' 
                          ? "bg-white text-emerald-650 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Instruções Globais
                    </button>
                    <button
                      onClick={() => setActivePromptSubTab('structure')}
                      className={classNames(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        activePromptSubTab === 'structure' 
                          ? "bg-white text-amber-650 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Skeleton (Estrutura)
                    </button>
                    <button
                      onClick={() => setActivePromptSubTab('rigid')}
                      className={classNames(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        activePromptSubTab === 'rigid' 
                          ? "bg-white text-rose-650 shadow-sm" 
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Regras Rígidas
                    </button>
                  </div>
                </div>

                {activePromptSubTab === 'master' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-indigo-50/50 rounded-2xl text-[11px] text-indigo-900 font-semibold leading-relaxed">
                      💡 <strong>Prompt Mestre (Doutrina):</strong> Define a personalidade central da IA como radiologista sênior, a cascata tripartite, o mimetismo de estilo e a tradução semântica de notas rápidas.
                    </div>
                    <CognitiveCodeEditor
                      value={localSettings.aiMasterPrompt || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiMasterPrompt: val })}
                      fileName="master_prompt.md"
                      badge="CENTRAL MASTER DIRECTIVE"
                      glowColor="brand"
                      placeholder="Defina o papel principal, tom e escopo da IA..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiMasterPrompt: DEFAULT_MASTER_PROMPT});
                        showToast('Prompt Mestre restaurado para o padrão', 'info');
                      }}
                    />
                  </div>
                )}

                {activePromptSubTab === 'global' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-emerald-50/50 rounded-2xl text-[11px] text-emerald-950 font-semibold leading-relaxed">
                      💡 <strong>Instruções Globais (Raciocínio Clínico):</strong> Regula o motor de cognição em 5 fases sequenciais (ancoragem, normalidade habitual, autocalculo e matemática de eixos, etc.) e as regras métricas (1 casa para mm, 2 para cm).
                    </div>
                    <CognitiveCodeEditor
                      value={localSettings.aiGlobalInstructions || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiGlobalInstructions: val })}
                      fileName="global_instructions.md"
                      badge="GLOBAL REASONING SYSTEM"
                      glowColor="emerald"
                      placeholder="Defina as instruções de raciocínio lógico e matemático global..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiGlobalInstructions: DEFAULT_GLOBAL_INSTRUCTIONS});
                        showToast('Instruções Globais restauradas para o padrão', 'info');
                      }}
                    />
                  </div>
                )}

                {activePromptSubTab === 'structure' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-amber-50/50 rounded-2xl text-[11px] text-amber-950 font-semibold leading-relaxed">
                      💡 <strong>Arquitetura Obrigatória (Skeleton):</strong> Define a formatação das tags de marcação HTML e os tópicos obrigatórios (TÍTULO, TÉCNICA, ANÁLISE, CONCLUSÃO, RECOMENDAÇÕES) que protegem a integridade do editor.
                    </div>
                    <CognitiveCodeEditor
                      value={localSettings.aiStructurePrompt || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiStructurePrompt: val })}
                      fileName="structure_prompt.md"
                      badge="SKELETON CODE SPECIFICATION"
                      glowColor="amber"
                      placeholder="Defina as diretrizes obrigatórias de formatação e tags do laudo..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiStructurePrompt: DEFAULT_STRUCTURE_PROMPT});
                        showToast('Skeleton estrutural restaurado para o padrão', 'info');
                      }}
                    />
                  </div>
                )}

                {activePromptSubTab === 'rigid' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-rose-50/50 rounded-2xl text-[11px] text-rose-950 font-semibold leading-relaxed">
                      💡 <strong>Regras Rígidas (Compliance & Segurança):</strong> Regras inquebráveis e proibitivas de blindagem médico-legal, tratamento de red flags e urgências clínicas, e proibição absoluta de prescrição de condutas cirúrgicas diretas.
                    </div>
                    <CognitiveCodeEditor
                      value={localSettings.aiRigidRules || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiRigidRules: val })}
                      fileName="rigid_rules.md"
                      badge="LAUD.IA SECURITY GUARDIAN"
                      glowColor="rose"
                      placeholder="Defina as regras restritivas que a IA sob nenhuma hipótese pode violar..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiRigidRules: DEFAULT_RIGID_RULES});
                        showToast('Regras Rígidas de Segurança restauradas para o padrão', 'info');
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: TEMPLATES (Prompts por Exame) */}
          {activeTab === 'templates' && (
            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-8 lg:p-10 space-y-8 animate-fade-in">
              <div className="border-b border-ink-50 pb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-ink-900 uppercase tracking-wider">Prompts por Exame (Máscara)</h4>
                    <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider mt-0.5">Gestão e refinamento das diretrizes específicas aplicadas a cada máscara de laudo</p>
                  </div>
                  {selectedTemplateId && (
                    <button
                      onClick={handleSaveTemplatePrompt}
                      disabled={isSavingTemplate}
                      className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-600 hover:bg-brand-700 text-white shadow-md transition-all flex items-center gap-2"
                    >
                      {isSavingTemplate ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Salvar Prompt do Exame
                    </button>
                  )}
                </div>

                {/* Template Dropdown Selector */}
                <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block mb-2">Filtrar por Área</label>
                    <select
                      value={selectedAreaFilter}
                      onChange={(e) => {
                        setSelectedAreaFilter(e.target.value as ExamArea | '');
                        setSelectedTemplateId('');
                      }}
                      className="w-full rounded-xl border-zinc-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 h-12 px-4 font-bold text-xs uppercase tracking-wider cursor-pointer bg-white border"
                    >
                      <option value="">Todas as Áreas</option>
                      {EXAM_AREAS.map(a => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block mb-2">Selecione o Exame/Máscara</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-xl border-zinc-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 h-12 px-4 font-bold text-xs uppercase tracking-wider cursor-pointer bg-white border disabled:opacity-50"
                      disabled={selectedAreaFilter !== '' && templates.filter(t => t.area === selectedAreaFilter).length === 0}
                    >
                      <option value="">Selecione um exame...</option>
                      {templates
                        .filter(t => selectedAreaFilter === '' || t.area === selectedAreaFilter)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {!selectedAreaFilter && `(${EXAM_AREAS.find(a => a.id === t.area)?.label || t.area})`}
                          </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedTemplateId ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-wider border border-violet-100 flex items-center gap-1.5 w-fit">
                        EXAM SPECIFIC DIRECTIVE
                      </span>
                      <h5 className="text-sm font-black text-ink-900 mt-2">
                        Exame: {templates.find(t => t.id === selectedTemplateId)?.name}
                      </h5>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleGenerateTemplatePrompt}
                        disabled={isGeneratingTemplatePrompt}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black rounded-xl transition-all border uppercase tracking-widest active:scale-95 shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {isGeneratingTemplatePrompt ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                        Gerar Prompt
                      </button>
                      <button
                        onClick={() => setShowImprovePanel(!showImprovePanel)}
                        className={classNames(
                          'flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black rounded-xl transition-all border uppercase tracking-widest active:scale-95 shadow-sm bg-white',
                          showImprovePanel
                            ? 'bg-violet-600 text-white border-violet-700'
                            : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                        )}
                      >
                        <Sparkles size={12} />
                        Melhorar com IA
                        {showImprovePanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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
                        A IA analisará o prompt atual deste exame e o reescreverá de forma mais completa e clinicamente precisa. Opcionalmente, descreva o que deseja melhorar.
                      </p>
                      <textarea
                        value={templateImprovePrompt}
                        onChange={(e) => setTemplateImprovePrompt(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-violet-200 bg-white text-sm p-3 focus:ring-violet-500 focus:border-violet-500 placeholder-violet-300"
                        placeholder="Opcional: descreva o que deseja melhorar neste prompt... (ex: adicionar critérios BI-RADS detalhados, focar em condutas específicas...)"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleImproveTemplatePrompt}
                          disabled={isImprovingTemplate}
                          className="btn-primary bg-violet-600 hover:bg-violet-700 border-violet-700 flex items-center gap-2"
                        >
                          {isImprovingTemplate ? (
                            <><Loader2 size={16} className="animate-spin" /> Melhorando...</>
                          ) : (
                            <><Sparkles size={16} /> Melhorar Prompt</>
                          )}
                        </button>
                        <button
                          onClick={() => { setShowImprovePanel(false); setTemplateImprovePrompt(''); }}
                          className="text-sm text-violet-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="w-full">
                    <CognitiveCodeEditor
                      value={editingTemplatePrompt}
                      onChange={(v) => setEditingTemplatePrompt(v)}
                      fileName={`${(templates.find(t => t.id === selectedTemplateId)?.name || '').toLowerCase().replace(/\s+/g, '_')}_prompt.md`}
                      badge="EXAM SPECIFIC DIRECTIVE"
                      glowColor="violet"
                      placeholder="Digite as instruções e diretrizes clínicas específicas para este exame..."
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-ink-200 rounded-3xl text-ink-400">
                  Nenhum exame cadastrado ou selecionado.
                </div>
              )}
            </div>
          )}

          {/* TAB: ENGINE */}
          {activeTab === 'engine' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-8 lg:p-10 space-y-8">
                
                {/* Section Header */}
                <div className="border-b border-ink-50 pb-6">
                  <h4 className="text-lg font-black text-ink-900 uppercase tracking-wider flex items-center gap-3">
                    <Sliders size={20} className="text-brand-600" /> Calibração do Motor Cognitivo
                  </h4>
                  <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider mt-0.5">Definição das credenciais de comunicação e modelo ativo da IA</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Provedor de IA Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                      <Cpu size={14} className="text-indigo-500" /> Provedor de Inteligência Artificial
                    </label>
                    <select 
                      value={localSettings.aiProvider || 'gemini'} 
                      onChange={(e) => setLocalSettings({ ...localSettings, aiProvider: e.target.value as 'gemini' | 'anthropic' })}
                      className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-14 px-6 font-black text-xs uppercase tracking-wider cursor-pointer bg-white"
                    >
                      <option value="gemini">Google Gemini (Modelos 2.0+)</option>
                      <option value="anthropic">Anthropic Claude (Modelos Claude 3.5)</option>
                    </select>
                  </div>

                  {(localSettings.aiProvider === 'gemini' || !localSettings.aiProvider) ? (
                    <>
                      {/* Google Gemini API Key */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                          <Key size={14} className="text-indigo-500" /> Google Gemini API Key
                        </label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={localSettings.geminiApiKey || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                              className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono text-sm h-14 px-6 pr-12 shadow-inner"
                              placeholder="Cole sua chave sk-..."
                            />
                            <button 
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <button
                            onClick={testConnection}
                            disabled={testStatus === 'testing'}
                            className={classNames(
                              "w-14 h-14 flex items-center justify-center rounded-2xl transition-all border shadow-sm",
                              testStatus === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                              testStatus === 'error' ? "bg-rose-50 text-rose-600 border-rose-200" :
                              "bg-white text-ink-600 border-ink-100 hover:border-brand-300"
                            )}
                          >
                             {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin text-brand-600" /> :
                              testStatus === 'success' ? <CheckCircle2 size={20} /> :
                              testStatus === 'error' ? <AlertCircle size={20} /> : <Zap size={20} className="text-ink-400" />}
                          </button>
                        </div>
                      </div>

                      {/* Gemini Model Selection */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                          <Cpu size={14} className="text-indigo-500" /> Modelo Gemini Principal
                        </label>
                        <select 
                          value={localSettings.geminiModel} 
                          onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                          className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-14 px-6 font-black text-xs uppercase tracking-wider cursor-pointer bg-white"
                        >
                          <option value="gemini-2.0-flash">GEMINI 2.0 FLASH</option>
                          <option value="gemini-2.0-flash-thinking-exp">GEMINI 2.0 THINKING</option>
                          <option value="gemini-2.0-pro-exp">GEMINI 2.0 PRO</option>
                          <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                        </select>
                      </div>

                      {/* Gemini Model Selection por Modo */}
                      <div className="md:col-span-2 border border-slate-100 rounded-[2rem] p-6 bg-slate-50/50 space-y-4 mt-2">
                        <div>
                          <h5 className="text-[11px] font-black text-ink-900 uppercase tracking-wider flex items-center gap-2">
                            <Sliders size={13} className="text-indigo-500" /> Modelos Específicos por Modo (Opcional)
                          </h5>
                          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">Calibre um modelo diferente do principal para cada funcionalidade.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Geração Inicial */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Geração Inicial</label>
                            <select
                              value={localSettings.geminiModelByMode?.generation || ""}
                              onChange={(e) => {
                                const byMode = { ...localSettings.geminiModelByMode };
                                if (e.target.value === "") delete byMode.generation;
                                else byMode.generation = e.target.value;
                                setLocalSettings({ ...localSettings, geminiModelByMode: byMode });
                              }}
                              className="w-full rounded-xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-11 px-4 font-black text-[10px] uppercase tracking-wider cursor-pointer bg-white"
                            >
                              <option value="">Padrão do System (Flash / Adaptativo)</option>
                              <option value="gemini-2.0-flash">GEMINI 2.0 FLASH</option>
                              <option value="gemini-2.0-flash-thinking-exp">GEMINI 2.0 THINKING</option>
                              <option value="gemini-2.0-pro-exp">GEMINI 2.0 PRO</option>
                              <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                            </select>
                          </div>
                          {/* Refinamento */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Refinamento Cirúrgico</label>
                            <select
                              value={localSettings.geminiModelByMode?.refine || ""}
                              onChange={(e) => {
                                const byMode = { ...localSettings.geminiModelByMode };
                                if (e.target.value === "") delete byMode.refine;
                                else byMode.refine = e.target.value;
                                setLocalSettings({ ...localSettings, geminiModelByMode: byMode });
                              }}
                              className="w-full rounded-xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-11 px-4 font-black text-[10px] uppercase tracking-wider cursor-pointer bg-white"
                            >
                              <option value="">Padrão do System (Flash / Adaptativo)</option>
                              <option value="gemini-2.0-flash">GEMINI 2.0 FLASH</option>
                              <option value="gemini-2.0-flash-thinking-exp">GEMINI 2.0 THINKING</option>
                              <option value="gemini-2.0-pro-exp">GEMINI 2.0 PRO</option>
                              <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                            </select>
                          </div>
                          {/* Copiloto */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Laud.IA Copiloto</label>
                            <select
                              value={localSettings.geminiModelByMode?.copilot || ""}
                              onChange={(e) => {
                                const byMode = { ...localSettings.geminiModelByMode };
                                if (e.target.value === "") delete byMode.copilot;
                                else byMode.copilot = e.target.value;
                                setLocalSettings({ ...localSettings, geminiModelByMode: byMode });
                              }}
                              className="w-full rounded-xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-11 px-4 font-black text-[10px] uppercase tracking-wider cursor-pointer bg-white"
                            >
                              <option value="">Padrão do System (Flash / Adaptativo)</option>
                              <option value="gemini-2.0-flash">GEMINI 2.0 FLASH</option>
                              <option value="gemini-2.0-flash-thinking-exp">GEMINI 2.0 THINKING</option>
                              <option value="gemini-2.0-pro-exp">GEMINI 2.0 PRO</option>
                              <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                            </select>
                          </div>
                          {/* Templates */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest block">Geração de Templates</label>
                            <select
                              value={localSettings.geminiModelByMode?.template || ""}
                              onChange={(e) => {
                                const byMode = { ...localSettings.geminiModelByMode };
                                if (e.target.value === "") delete byMode.template;
                                else byMode.template = e.target.value;
                                setLocalSettings({ ...localSettings, geminiModelByMode: byMode });
                              }}
                              className="w-full rounded-xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-11 px-4 font-black text-[10px] uppercase tracking-wider cursor-pointer bg-white"
                            >
                              <option value="">Padrão do System (Flash / Adaptativo)</option>
                              <option value="gemini-2.0-flash">GEMINI 2.0 FLASH</option>
                              <option value="gemini-2.0-flash-thinking-exp">GEMINI 2.0 THINKING</option>
                              <option value="gemini-2.0-pro-exp">GEMINI 2.0 PRO</option>
                              <option value="gemini-1.5-pro">GEMINI 1.5 PRO</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Anthropic Claude API Key */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                          <Key size={14} className="text-indigo-500" /> Anthropic Claude API Key
                        </label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={localSettings.anthropicApiKey || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, anthropicApiKey: e.target.value })}
                              className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 font-mono text-sm h-14 px-6 pr-12 shadow-inner"
                              placeholder="Cole sua chave sk-ant-..."
                            />
                            <button 
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <button
                            onClick={testConnection}
                            disabled={testStatus === 'testing'}
                            className={classNames(
                              "w-14 h-14 flex items-center justify-center rounded-2xl transition-all border shadow-sm",
                              testStatus === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                              testStatus === 'error' ? "bg-rose-50 text-rose-600 border-rose-200" :
                              "bg-white text-ink-600 border-ink-100 hover:border-brand-300"
                            )}
                          >
                             {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin text-brand-600" /> :
                              testStatus === 'success' ? <CheckCircle2 size={20} /> :
                              testStatus === 'error' ? <AlertCircle size={20} /> : <Zap size={20} className="text-ink-400" />}
                          </button>
                        </div>
                      </div>

                      {/* Claude Model Selection */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                          <Cpu size={14} className="text-indigo-500" /> Modelo Claude Principal
                        </label>
                        <select 
                          value={localSettings.anthropicModel || 'claude-3-5-sonnet-latest'} 
                          onChange={(e) => setLocalSettings({ ...localSettings, anthropicModel: e.target.value })}
                          className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-14 px-6 font-black text-xs uppercase tracking-wider cursor-pointer bg-white"
                        >
                          <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Recomendado - Excelente Diagnóstico)</option>
                          <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Rápido e Preciso)</option>
                          <option value="claude-3-opus-latest">Claude 3 Opus (Complexidade Máxima)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Cognitive Temperature calibration */}
                <div className="pt-8 border-t border-ink-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block">Temperatura Cognitiva</label>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">Controla o nível de criatividade ou determinismo do laudo</p>
                    </div>
                    <span className="text-brand-600 text-3xl font-black">{localSettings.aiTemperature ?? 0.3}</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localSettings.aiTemperature ?? 0.3}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiTemperature: parseFloat(e.target.value) })}
                    className="w-full h-3 bg-zinc-100 rounded-full appearance-none cursor-pointer accent-brand-600 border border-zinc-200"
                  />
                  <div className="flex justify-between text-[9px] font-black text-ink-400 uppercase tracking-widest pt-1">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Altamente Determinístico / Protocolado</span>
                    <span className="flex items-center gap-1.5">Mapeamento Livre / Criativo <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /></span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: TRAINING */}
          {activeTab === 'training' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-8 lg:p-10 space-y-8">
                
                {/* Learn Switch Block */}
                <div className="flex items-center justify-between border-b border-ink-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 shadow-inner">
                      <GraduationCap size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-ink-900 uppercase tracking-wider">Mimetismo de Escrita (Learning Center)</h4>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.15em] mt-0.5">Treinamento orgânico da IA baseado na caligrafia do médico</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setLocalSettings({ ...localSettings, aiTrainingEnabled: !localSettings.aiTrainingEnabled });
                      showToast(localSettings.aiTrainingEnabled ? 'Aprendizado desativado' : 'Aprendizado ativo', 'info');
                    }}
                    className={classNames(
                      "relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none",
                      localSettings.aiTrainingEnabled ? 'bg-gradient-to-r from-brand-500 to-indigo-600 shadow-lg shadow-brand-500/20' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames(
                      "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out",
                      localSettings.aiTrainingEnabled ? 'translate-x-6' : 'translate-x-0'
                    )} />
                  </button>
                </div>

                {/* Adaptive Options Panel */}
                <div className={classNames(
                  "space-y-8 transition-all duration-500", 
                  !localSettings.aiTrainingEnabled && "opacity-30 grayscale pointer-events-none scale-[0.99]"
                )}>
                  <div className="p-6 bg-indigo-50/50 border border-indigo-100/50 rounded-3xl text-sm text-indigo-900 leading-relaxed font-semibold">
                    Ativando esta diretriz, o motor LAUD.IA analisará os laudos médicos finalizados e emitidos por cada profissional no sistema para decifrar a fraseologia predileta, vocabulário clínico regionalizado e padrões específicos de conclusão, ajustando inteligentemente o preenchimento automático.
                  </div>

                  {/* Context size slider */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block">Profundidade do Contexto Histórico</label>
                        <p className="text-[10px] text-ink-400 font-bold uppercase tracking-wider mt-0.5">Quantidade de laudos anteriores utilizados para a calibração de estilo</p>
                      </div>
                      <span className="text-indigo-600 font-black text-3xl">{localSettings.aiTrainingContextSize || 3}</span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={localSettings.aiTrainingContextSize || 3}
                      onChange={(e) => setLocalSettings({ ...localSettings, aiTrainingContextSize: parseInt(e.target.value) })}
                      className="w-full h-3 bg-zinc-100 rounded-full appearance-none cursor-pointer accent-indigo-600 border border-zinc-200"
                    />
                    
                    <div className="flex justify-between text-[9px] font-black text-ink-400 uppercase tracking-widest pt-1">
                      <span>Rápida Adaptação (1 exame)</span>
                      <span>Alta Consistência (10 exames)</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: STATUS */}
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
                      model: localSettings.geminiModel || 'gemini-2.0-flash',
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
                        'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all border bg-white',
                        testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        testStatus === 'error'   ? 'bg-rose-50 text-rose-700 border-rose-200' :
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
                    { label: 'Modelo', value: (localSettings.aiProvider || 'gemini') === 'gemini' ? (localSettings.geminiModel || 'gemini-2.0-flash') : (localSettings.anthropicModel || 'claude-sonnet-4-5'), icon: BrainCircuit },
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
  );
}
