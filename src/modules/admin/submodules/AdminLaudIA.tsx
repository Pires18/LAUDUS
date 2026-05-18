import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../store/app';
import { 
  BrainCircuit, ShieldAlert, 
  RotateCcw, Zap,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, ShieldCheck,
  FlaskConical, Play, FileText, History,
  Terminal, Code, Copy, Check, Cpu, Key, Eye, EyeOff
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { EXAM_AREAS, ExamArea, ReportTemplate } from '../../../types';
import { generateReport } from '../../ai/gemini';
import { 
  DEFAULT_MASTER_PROMPT, 
  DEFAULT_GLOBAL_INSTRUCTIONS, 
  DEFAULT_STRUCTURE_PROMPT, 
  DEFAULT_RIGID_RULES,
  AREA_SPECIFIC_PROMPTS,
} from '../../ai/prompts';

type TabId = 'prompts' | 'areas' | 'engine' | 'training';

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
  glowColor?: 'brand' | 'amber' | 'rose' | 'emerald' | 'violet';
}

function CognitiveCodeEditor({
  value = '',
  onChange,
  fileName,
  badge = 'CONFIG FILE',
  placeholder = 'Digite as instruções aqui...',
  rows = 12,
  onRestore,
  glowColor = 'brand'
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
// MAIN ADMIN LAUD.IA CENTER
// ==========================================
export function AdminLaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [selectedArea, setSelectedArea] = useState<ExamArea>(EXAM_AREAS[0].id);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);



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

  async function testConnection() {
    if (!localSettings.geminiApiKey) {
      showToast('Insira a API Key primeiro', 'error');
      return;
    }
    setTestStatus('testing');
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(localSettings.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.0-flash-exp' });
      const result = await model.generateContent('Responda apenas: OK');
      const text = result.response.text();
      if (text) {
        setTestStatus('success');
        showToast('Conexão validada com sucesso!', 'success');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      showToast('Falha na conexão com a API', 'error');
    }
  }



  const sidebarItems = [
    { id: 'prompts', label: 'Doutrina & Prompts', icon: ShieldAlert },
    { id: 'areas', label: 'Especialidades', icon: LayoutList },
    { id: 'engine', label: 'Motor & API', icon: Sliders },
    { id: 'training', label: 'Aprendizado IA', icon: GraduationCap },
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
              {localSettings.geminiModel || 'gemini-2.0-flash-exp'}
            </span>
          </div>
          <h3 className="text-xl font-black text-ink-900">IA Command Center</h3>
          <p className="text-xs text-ink-500 mt-1 max-w-xl font-medium">
            Gestão de alto nível, sintonia fina de temperatura cognitiva e publicação dos prompts médicos oficiais do motor de inteligência artificial LAUD.IA.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
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
                <div className="flex items-center justify-between border-b border-ink-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 shadow-inner">
                      <BrainCircuit size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-ink-900 uppercase tracking-wider">Prompt Mestre (Master Directive)</h4>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.15em] mt-0.5">Doutrina e Personalidade Base da Inteligência Artificial</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                      PRIMARY DEFENSE
                    </span>
                  </div>
                </div>

                <CognitiveCodeEditor
                  value={localSettings.aiMasterPrompt || ''}
                  onChange={(val) => setLocalSettings({ ...localSettings, aiMasterPrompt: val })}
                  fileName="master_prompt.md"
                  badge="CENTRAL DIRECTIVE"
                  glowColor="brand"
                  placeholder="Defina o papel principal, tom e escopo da IA..."
                  onRestore={() => {
                    setLocalSettings({...localSettings, aiMasterPrompt: DEFAULT_MASTER_PROMPT});
                    showToast('Prompt Mestre restaurado para o padrão', 'info');
                  }}
                />
              </div>

              {/* Sub-Directives Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Reasoning Instructions */}
                <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-6 md:p-8 flex flex-col space-y-6">
                  <div className="flex items-center justify-between border-b border-ink-50 pb-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-ink-900 flex items-center gap-2">
                      <Zap size={16} className="text-amber-500 animate-pulse" /> Instruções de Raciocínio
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest">
                      LOGIC FLOW
                    </span>
                  </div>
                  <div className="flex-1">
                    <CognitiveCodeEditor
                      value={localSettings.aiGlobalInstructions || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiGlobalInstructions: val })}
                      fileName="reasoning_rules.txt"
                      badge="COGNITIVE SHIELD"
                      glowColor="amber"
                      placeholder="Instruções de estruturação lógica de raciocínio..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiGlobalInstructions: DEFAULT_GLOBAL_INSTRUCTIONS});
                        showToast('Instruções de Raciocínio restauradas', 'info');
                      }}
                    />
                  </div>
                </div>

                {/* Rigid Compliance Rules */}
                <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-6 md:p-8 flex flex-col space-y-6">
                  <div className="flex items-center justify-between border-b border-ink-50 pb-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-ink-900 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-rose-500" /> Regras Inquebráveis
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest">
                      STRICT COMPLIANCE
                    </span>
                  </div>
                  <div className="flex-1">
                    <CognitiveCodeEditor
                      value={localSettings.aiRigidRules || ''}
                      onChange={(val) => setLocalSettings({ ...localSettings, aiRigidRules: val })}
                      fileName="rigid_rules.txt"
                      badge="COMPLIANCE SHIELD"
                      glowColor="rose"
                      placeholder="Regras estritas médico-legais e limitações da IA..."
                      onRestore={() => {
                        setLocalSettings({...localSettings, aiRigidRules: DEFAULT_RIGID_RULES});
                        showToast('Regras Inquebráveis restauradas', 'info');
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AREAS */}
          {activeTab === 'areas' && (
            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-ink-100 shadow-xl p-8 lg:p-10 space-y-8 animate-fade-in">
              <div className="border-b border-ink-50 pb-6 space-y-6">
                <div>
                  <h4 className="text-lg font-black text-ink-900 uppercase tracking-wider">Diretrizes por Especialidade</h4>
                  <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider mt-0.5">Mapeamento de comportamentos e terminologias específicas do LAUD.IA</p>
                </div>

                {/* Specialty Pill Selector */}
                <div className="flex flex-wrap gap-2 pt-2 pb-2">
                  {EXAM_AREAS.map((area) => {
                    const isSelected = selectedArea === area.id;
                    return (
                      <button
                        key={area.id}
                        onClick={() => setSelectedArea(area.id)}
                        className={classNames(
                          "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          isSelected 
                            ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/10 scale-[1.02]" 
                            : "bg-white text-ink-600 border-ink-100 hover:border-brand-300"
                        )}
                      >
                        {area.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specialty Protocol Editor Container */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-wider border border-violet-100">
                      SPECIFIC DIRECTIVE
                    </span>
                    <h5 className="text-sm font-black text-ink-900 mt-2">
                      Protocolo Ativo: {EXAM_AREAS.find(a => a.id === selectedArea)?.label}
                    </h5>
                  </div>
                </div>

                <div className="w-full">
                  <CognitiveCodeEditor
                    value={localSettings.aiAreaPrompts?.[selectedArea] || ''}
                    onChange={(val) => {
                      const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: val };
                      setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                    }}
                    fileName={`${selectedArea}_protocol.md`}
                    badge={`CLINICAL MODULE: ${selectedArea.toUpperCase()}`}
                    glowColor="violet"
                    placeholder={`Digite as diretrizes clínicas para a especialidade ${selectedArea}...`}
                    onRestore={() => {
                      const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: AREA_SPECIFIC_PROMPTS[selectedArea] };
                      setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                      showToast(`Protocolo de ${selectedArea} restaurado`, 'info');
                    }}
                  />
                </div>
              </div>
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
                  {/* Google Gemini API Key Section */}
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

                  {/* Gemini Intelligence Engine Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-ink-500 uppercase tracking-widest block flex items-center gap-2">
                      <Cpu size={14} className="text-indigo-500" /> Modelo de Inteligência Artificial
                    </label>
                    <select 
                      value={localSettings.geminiModel} 
                      onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                      className="w-full rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 h-14 px-6 font-black text-xs uppercase tracking-wider cursor-pointer bg-white"
                    >
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Fastest / Advanced)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Optimized Diagnostic Core)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Medical Reasoning / Heavy)</option>
                    </select>
                  </div>
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

      </div>
    </div>
  );
}
