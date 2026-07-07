import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../store/app';
import {
  BrainCircuit, ShieldAlert,
  RotateCcw, Zap, Save,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  LayoutList, ShieldCheck,
  FlaskConical, Play, FileText, History,
  Code, Copy, Check, Cpu, Key,
  Activity, BarChart3, Database, Coins, Clock, Sparkles,
  Wifi, WifiOff, TrendingUp,
  GitCompare, Download, Filter, SlidersHorizontal,
  Brain, CheckSquare, XCircle, ChevronRight, Trash2, ChevronDown
} from 'lucide-react';

import { classNames } from '../../utils/format';
import { useConfirm } from '../../hooks/useConfirm';
import { resolveGeminiModel } from '../ai/engine';
import { logger } from '../../utils/logger';
import { generateReport, callMetricsHistory, type CallMetrics, auditReportQuality } from '../ai/engine';
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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { updateItem, getAiUsageStats } from '../../store/db';
import { TrainingDashboard } from './TrainingDashboard';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { CognitiveCodeEditor } from './components/CognitiveCodeEditor';

type TabId = 'prompts' | 'templates' | 'engine' | 'training' | 'status';

// ─── Token estimator helper ───────────────────────────────────────────────────
// ==========================================
// TELEMETRY DASHBOARD COMPONENT
// ==========================================
// ==========================================
// MAIN ADMIN LAUD.IA CENTER
// ==========================================
export function SharedLaudIA({ readOnly = false }: { readOnly?: boolean }) {
  const { settings, updateSettings, showToast } = useApp();
  const confirm = useConfirm();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [activePromptSubTab, setActivePromptSubTab] = useState<'master' | 'global' | 'structure' | 'rigid' | 'refinement' | 'copilot'>('master');

  const [motorConfig, setMotorConfig] = useState<{
    lite: { model: string; tokensPerReport: number; costPerThousandTokens: number };
    pro:  { model: string; tokensPerReport: number; costPerThousandTokens: number };
  }>({
    lite: { model: 'gemini-3.5-flash',      tokensPerReport: 2000, costPerThousandTokens: 0.075 },
    pro:  { model: 'gemini-3.1-pro-preview', tokensPerReport: 4000, costPerThousandTokens: 1.25  },
  });
  const [loadingMotorConfig, setLoadingMotorConfig] = useState(true);

  useEffect(() => {
    const fetchMotorConfig = async () => {
      try {
        const docRef = doc(firestore, 'global_config', 'motor_config');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setMotorConfig({
            lite: {
              model: data.lite?.model || 'gemini-3.5-flash',
              tokensPerReport: data.lite?.tokensPerReport ?? 2000,
              costPerThousandTokens: data.lite?.costPerThousandTokens ?? 0.075,
            },
            pro: {
              model: data.pro?.model || 'gemini-3.1-pro-preview',
              tokensPerReport: data.pro?.tokensPerReport ?? 4000,
              costPerThousandTokens: data.pro?.costPerThousandTokens ?? 1.25,
            },
          });
        }
      } catch (err) {
        logger.error('Erro ao buscar motorConfig:', err);
      } finally {
        setLoadingMotorConfig(false);
      }
    };
    fetchMotorConfig();
  }, []);

  // ── Versionamento de prompts
  const getPromptVersionKey = (block: string) => `laudia_prompt_versions_${block}`;
  const savePromptVersion = useCallback((block: string, value: string) => {
    try {
      const key = getPromptVersionKey(block);
      const existing: Array<{ value: string; timestamp: number }> = JSON.parse(localStorage.getItem(key) || '[]');
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

  interface PromptDiff { original: string; improved: string; block: string; }
  const [pendingDiff, setPendingDiff] = useState<PromptDiff | null>(null);

  const [telemetryModeFilter, setTelemetryModeFilter] = useState<string>('all');
  const conversionRate = localSettings.aiConversionRateBRL ?? 5.5;

  // ── Historical AI Usage ──
  const _nowDate = new Date();
  const _defaultFrom = new Date(_nowDate.getFullYear(), _nowDate.getMonth(), 1).toISOString().slice(0, 10);
  const _defaultTo = _nowDate.toISOString().slice(0, 10);
  const [histFrom, setHistFrom] = useState(_defaultFrom);
  const [histTo, setHistTo] = useState(_defaultTo);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchHistoricalStats = useCallback(async () => {
    setHistLoading(true);
    try {
      const startMs = new Date(histFrom + 'T00:00:00').getTime();
      const endMs = new Date(histTo + 'T23:59:59').getTime();
      const logs = await getAiUsageStats(startMs, endMs);
      setHistoricalLogs(logs);
    } catch (err) {
      logger.error('Erro ao buscar histórico IA:', err);
    } finally {
      setHistLoading(false);
    }
  }, [histFrom, histTo]);

  const { data: templates } = useCollection<ReportTemplate>('templates');
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
      const nextSettings = { ...localSettings, aiAreaPrompts: updatedAreaPrompts };
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
      const tempTemplate = { ...template, aiInstructions: editingTemplatePrompt };
      const tempAreaPrompts = { ...(localSettings.aiAreaPrompts || {}) };
      if (selectedAreaFilter) tempAreaPrompts[selectedAreaFilter] = editingAreaPrompt;
      const tempSettings = { ...localSettings, aiAreaPrompts: tempAreaPrompts };
      const dummyPatient: Patient = {
        id: 'dummy',
        name: 'Paciente Teste',
        birthDate: '1985-05-15',
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
      if (callMetricsHistory.length > 0) {
        const lastMetric = callMetricsHistory[0];
        if (lastMetric.scratchpad) setPlaygroundScratchpad(lastMetric.scratchpad);
      }
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
      
      const docRef = doc(firestore, 'global_config', 'motor_config');
      await setDoc(docRef, motorConfig);
      
      showToast('Configurações da IA salvas com sucesso', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar configurações: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTemplatePrompt() {
    if (!selectedTemplateId) return;
    setIsSavingTemplate(true);
    try {
      await updateItem('templates', selectedTemplateId, { aiInstructions: editingTemplatePrompt });
      showToast('Prompt do exame salvo com sucesso! ✓', 'success');
    } catch {
      showToast('Erro ao salvar prompt do exame', 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleRestoreAreaPromptDefault() {
    if (!selectedAreaFilter) return;
    const ok = await confirm({
      title: 'Restaurar Diretriz',
      message: 'Restaurar a diretriz desta área para o padrão V2.0 do sistema?',
      confirmLabel: 'Restaurar',
      variant: 'warning',
    });
    if (!ok) return;
    setEditingAreaPrompt(DEFAULT_AREA_PROMPTS[selectedAreaFilter] || '');
    const updatedAreaPrompts = { ...(localSettings.aiAreaPrompts || {}) };
    delete (updatedAreaPrompts as Record<string, string>)[selectedAreaFilter];
    const nextSettings = { ...localSettings, aiAreaPrompts: updatedAreaPrompts };
    setLocalSettings(nextSettings);
    updateSettings(nextSettings)
      .then(() => showToast('Diretriz restaurada para o padrão V2.0.', 'success'))
      .catch(() => showToast('Erro ao restaurar diretriz.', 'error'));
  }

  async function handleClearExamPrompt() {
    if (!selectedTemplateId) return;
    const ok = await confirm({
      title: 'Limpar Instruções',
      message: 'Limpar as instruções específicas deste exame?',
      confirmLabel: 'Limpar',
      variant: 'warning',
    });
    if (!ok) return;
    const backupKey = `laudia_backup_exam_${selectedTemplateId}`;
    if (editingTemplatePrompt.trim()) localStorage.setItem(backupKey, editingTemplatePrompt);
    setEditingTemplatePrompt('');
    updateItem('templates', selectedTemplateId, { aiInstructions: '' })
      .then(() => showToast('Instruções limpas. Backup salvo localmente.', 'info'))
      .catch(() => showToast('Erro ao limpar prompt do exame.', 'error'));
  }

  function handleRestoreExamPromptFromBackup() {
    if (!selectedTemplateId) return;
    const backup = localStorage.getItem(`laudia_backup_exam_${selectedTemplateId}`);
    if (!backup) {
      showToast('Nenhum backup local encontrado para este exame.', 'info');
      return;
    }
    setEditingTemplatePrompt(backup);
    showToast('Rascunho anterior restaurado. Clique em Salvar para confirmar.', 'success');
  }

  async function testConnection() {
    const apiKey = (localSettings.geminiApiKey || settings?.geminiApiKey)?.trim();
    if (!apiKey) { showToast('Insira a API Key do Gemini primeiro', 'error'); return; }
    setTestStatus('testing');
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      const result = await model.generateContent('Responda apenas: OK');
      if (result.response.text()) {
        setTestStatus('success');
        showToast('Conexão com Gemini validada com sucesso!', 'success');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      showToast('Falha na conexão: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // ── Playground renderer ───────────────────────────────────────────────
  const renderPlayground = () => (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden mt-6">
      <button
        type="button"
        onClick={() => setShowPlayground(!showPlayground)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-900/40 transition-all"
      >
        <div className="flex items-center gap-2.5">
          <FlaskConical className="text-violet-500" size={18} />
          <div>
            <span className="text-xs font-black text-zinc-100 uppercase tracking-wider">Playground de Teste</span>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Simule a IA com as diretrizes atuais</p>
          </div>
        </div>
        <ChevronDown size={16} className={classNames("text-zinc-400 transition-transform", showPlayground ? "rotate-180" : "")} />
      </button>

      {showPlayground && (
        <div className="p-5 space-y-5 border-t border-zinc-900 text-zinc-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Notes Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Notas Clínicas (Input)</label>
                {templateSubTab === 'area' && selectedAreaFilter && (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-xl text-[10px] px-2 py-1 focus:ring-1 focus:ring-violet-500/30 font-bold"
                  >
                    <option value="">Exame de teste...</option>
                    {templates.filter(t => t.area === selectedAreaFilter).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                value={playgroundNotes}
                onChange={(e) => setPlaygroundNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 text-xs p-3 focus:ring-2 focus:ring-violet-500/30 placeholder-zinc-700 resize-none font-medium leading-relaxed"
                placeholder="Digite notas médicas de teste..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">Paciente Simulado: F, 41a</span>
                <button
                  type="button"
                  onClick={handleRunPlaygroundTest}
                  disabled={isPlayinggroundTesting || !selectedTemplateId}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {isPlayinggroundTesting ? (
                    <><Loader2 size={12} className="animate-spin" /> Simulando...</>
                  ) : (
                    <><Play size={12} /> Simular Laudo</>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Score */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-center min-h-[140px]">
              {isPlayinggroundTesting ? (
                <div className="flex flex-col items-center justify-center py-6 text-zinc-500 font-mono text-[11px]">
                  <Loader2 size={24} className="animate-spin text-violet-500 mb-2" />
                  <span>Chamando IA...</span>
                </div>
              ) : playgroundResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Auditoria</span>
                    {playgroundScore && (
                      <span className={classNames(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                        playgroundScore.score >= 90 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" :
                        playgroundScore.score >= 75 ? "bg-amber-950/60 text-amber-400 border border-amber-900/50" :
                        "bg-rose-950/60 text-rose-400 border border-rose-900/50"
                      )}>
                        Nota: {playgroundScore.score}/100
                      </span>
                    )}
                  </div>
                  {playgroundScore && playgroundScore.issues.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {playgroundScore.issues.map((issue: any, index: number) => (
                        <div key={index} className={classNames(
                          "flex items-start gap-2 p-2 rounded-lg text-[10px] font-medium border",
                          issue.severity === 'error' ? "bg-rose-950/30 text-rose-300 border-rose-900/20" : "bg-amber-950/30 text-amber-300 border-amber-900/20"
                        )}>
                          <AlertCircle size={12} className="mt-0.5 shrink-0" />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 rounded-xl text-xs font-semibold">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>Sem erros de conformidade detectados!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-zinc-600 font-mono text-[11px] text-center">
                  <Sparkles size={20} className="text-zinc-800 mb-2" />
                  <span>Simule o laudo para ver os resultados.</span>
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {playgroundResult && !isPlayinggroundTesting && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-zinc-900">
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Laudo Gerado</span>
                <div className="bg-white text-zinc-900 rounded-2xl border border-zinc-200 p-5 shadow-inner max-h-[300px] overflow-y-auto prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: playgroundResult }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Raciocínio (Scratchpad)</span>
                <div className="bg-zinc-900/60 text-zinc-400 font-mono text-[10px] rounded-2xl border border-zinc-800 p-5 max-h-[300px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {playgroundScratchpad || "Nenhum bloco de pensamento foi capturado."}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Tab definitions ───────────────────────────────────────────────────
  const TABS = [
    { id: 'prompts' as const, label: 'Doutrina', icon: ShieldAlert, color: 'indigo' },
    { id: 'templates' as const, label: 'Por Exame', icon: LayoutList, color: 'emerald' },
    { id: 'engine' as const, label: 'Motor & API', icon: Cpu, color: 'brand' },
    { id: 'training' as const, label: 'Aprendizado', icon: GraduationCap, color: 'amber' },
    { id: 'status' as const, label: 'Telemetria', icon: BarChart3, color: 'violet' },
  ];

  const providerName = `Google Gemini · Lite: ${motorConfig.lite.model.replace('gemini-', '').replace('-preview', '')} · Pro: ${motorConfig.pro.model.replace('gemini-', '').replace('-preview', '')}`;
  const hasApiKey = !!localSettings.geminiApiKey;

  return (
    <div className="animate-fade-in pb-24" style={{ minHeight: '100vh' }}>

      {/* ─── COMPACT HEADER ─── */}
      <div className="relative mb-6 rounded-2xl overflow-hidden border border-ink-200 shadow-sm bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.05)_0%,transparent_60%)]" />
        <div className="relative px-6 py-5 flex items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <BrainCircuit size={24} className="text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-ink-900 tracking-tight">LAUD.IA</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-600 text-[9px] font-black uppercase tracking-widest">v2.1</span>
                {localSettings.aiTrainingEnabled && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-600 text-[9px] font-black uppercase tracking-widest">⬤ Training</span>
                )}
                {!hasApiKey && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/20 text-amber-600 text-[9px] font-black uppercase tracking-widest">⚠ API KEY</span>
                )}
              </div>
              <p className="text-xs text-ink-500 mt-0.5 font-medium truncate">
                ✨ {providerName}
                <span className="mx-1.5 text-ink-300">·</span>
                {templates.length} exames
                <span className="mx-1.5 text-ink-300">·</span>
                {callMetricsHistory.length} chamadas
              </p>
            </div>
          </div>

          {/* Actions — only on non-readOnly */}
          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setLocalSettings(settings);
                  showToast('Alterações descartadas', 'info');
                }}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5"
              >
                <XCircle size={11} />
                <span className="hidden sm:inline">Descartar</span>
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {isSaving ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                Publicar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── TAB BAR ─── */}
      <div className="flex items-center gap-1.5 mb-6 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const colorMap: Record<string, string> = {
            indigo: 'bg-indigo-600 text-white shadow-indigo-500/20',
            emerald: 'bg-emerald-600 text-white shadow-emerald-500/20',
            brand: 'bg-brand-600 text-white shadow-brand-500/20',
            amber: 'bg-amber-500 text-white shadow-amber-500/20',
            violet: 'bg-violet-600 text-white shadow-violet-500/20',
          };
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                isActive ? `${colorMap[tab.color]} shadow-md` : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── CONTENT ─── */}
      <div className="w-full space-y-6">

        {/* ══════════════════════════════════
            TAB: PROMPTS — Doutrina & Diretrizes
        ══════════════════════════════════ */}
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
              badge: 'MASTER DIRECTIVE',
              fileName: 'master_prompt.md',
              desc: 'Define a personalidade, leis absolutas e padrão numérico — a "constituição" do sistema.',
              settingsKey: 'aiMasterPrompt' as keyof typeof localSettings,
              defaultVal: DEFAULT_MASTER_PROMPT,
              mustHave: ['Lei da Não-Invenção', 'Cascata Tripartite', 'Lei da Conclusão Enxuta', 'Padrão numérico pt-BR'],
              neverRemove: ['Seção "NÃO INVENÇÃO"', 'Seção "CASCATA TRIPARTITE"', 'Padrão numérico'],
              safeToAdjust: ['Vocabulário da persona', 'Siglas de sociedades médicas', 'Permissões de autocálculo'],
            },
            {
              id: 'global' as const,
              label: 'Raciocínio Clínico',
              subtitle: 'Instruções Globais',
              icon: Brain,
              color: 'emerald',
              accentBg: 'bg-emerald-50',
              accentText: 'text-emerald-700',
              accentBorder: 'border-emerald-200',
              glowColor: 'emerald' as const,
              badge: 'GLOBAL REASONING',
              fileName: 'global_instructions.md',
              desc: '7 Fases de Raciocínio Clínico executadas no scratchpad antes de gerar o laudo.',
              settingsKey: 'aiGlobalInstructions' as keyof typeof localSettings,
              defaultVal: DEFAULT_GLOBAL_INSTRUCTIONS,
              mustHave: ['7 Fases (Ancoragem → Self-Audit)', 'Tag <scratchpad> obrigatória', 'Fórmula do elipsoide (Fase 4)'],
              neverRemove: ['Fase 4 — Fórmula do elipsoide', 'Fase 7 — Self-Audit', 'Obrigatoriedade do <scratchpad>'],
              safeToAdjust: ['Fase 3: variantes anatômicas', 'Fase 4: fórmulas adicionais', 'Fase 5: mapeamento de jargões'],
            },
            {
              id: 'structure' as const,
              label: 'Skeleton',
              subtitle: 'Arquitetura HTML',
              icon: Code,
              color: 'amber',
              accentBg: 'bg-amber-50',
              accentText: 'text-amber-700',
              accentBorder: 'border-amber-200',
              glowColor: 'amber' as const,
              badge: 'SKELETON SPEC',
              fileName: 'structure_prompt.md',
              desc: 'Tags HTML permitidas e ordem obrigatória das seções do laudo.',
              settingsKey: 'aiStructurePrompt' as keyof typeof localSettings,
              defaultVal: DEFAULT_STRUCTURE_PROMPT,
              mustHave: ['Tags HTML permitidas', 'Ordem das seções (TÉCNICA → OBSERVAÇÕES)', 'Proibição de Markdown'],
              neverRemove: ['Proibição de Markdown', '<scratchpad> antes do HTML'],
              safeToAdjust: ['Exemplos de exames', 'Seções opcionais'],
            },
            {
              id: 'rigid' as const,
              label: 'Regras Rígidas',
              subtitle: 'Compliance Médico-Legal',
              icon: ShieldAlert,
              color: 'rose',
              accentBg: 'bg-rose-50',
              accentText: 'text-rose-700',
              accentBorder: 'border-rose-200',
              glowColor: 'rose' as const,
              badge: 'SECURITY GUARDIAN',
              fileName: 'rigid_rules.md',
              desc: 'Leis de segurança médico-legal que anulam qualquer outra instrução (R1–R7).',
              settingsKey: 'aiRigidRules' as keyof typeof localSettings,
              defaultVal: DEFAULT_RIGID_RULES,
              mustHave: ['R1 — Anti-invenção', 'R2 — Blindagem histopatológica', 'R6 — Override urgência', 'R7 — OBSERVAÇÕES obrigatórias'],
              neverRemove: ['R1 (risco clínico)', 'R2 (risco legal)', 'R7 (OBSERVAÇÕES)'],
              safeToAdjust: ['R6: novos red flags', 'Novas regras de compliance (R9, R10...)'],
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
              badge: 'REFINEMENT v16',
              fileName: 'refinement_golden_rules.md',
              desc: 'Regras do modo Refine: preservação de dados clínicos, laudo nunca truncado.',
              settingsKey: 'aiRefinementGoldenRules' as keyof typeof localSettings,
              defaultVal: DEFAULT_REFINEMENT_GOLDEN_RULES,
              mustHave: ['Laudo completo (sem "...")', 'Preservação de dados clínicos (INQUEBRÁVEL)', 'Eliminação de placeholders'],
              neverRemove: ['Preservação de dados clínicos', 'Proibição de truncar'],
              safeToAdjust: ['Regras específicas de preservação', 'Fraseologia de placeholders'],
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
              badge: 'COPILOT v16',
              fileName: 'copilot_override.md',
              desc: 'Formato de saída do Copiloto: === CONVERSA === + === PROPOSTA ===.',
              settingsKey: 'aiCopilotOverride' as keyof typeof localSettings,
              defaultVal: DEFAULT_COPILOT_OVERRIDE,
              mustHave: ['"=== CONVERSA ===" (1 frase)', '"=== PROPOSTA ===" (HTML completo)', 'Integração de calculadoras'],
              neverRemove: ['"=== CONVERSA ===" e "=== PROPOSTA ===" (o parser depende disso)'],
              safeToAdjust: ['Instrução da CONVERSA', 'Tipos de calculadoras suportadas'],
              // Marcadores literais que o parser do Copiloto exige — diferente de
              // `neverRemove` (só texto explicativo), isto é checado de verdade
              // antes de salvar (best-effort, avisa mas não bloqueia).
              requiredMarkers: ['=== CONVERSA ===', '=== PROPOSTA ==='],
            },
          ];

          const activeBlock = PROMPT_BLOCKS.find(b => b.id === activePromptSubTab) || PROMPT_BLOCKS[0];
          const activeValue = (localSettings[activeBlock.settingsKey] as string) || activeBlock.defaultVal;
          const versions = getPromptVersions(activeBlock.id);

          return (
            <div className="animate-fade-in-up">
              {/* Pill sub-tab navigator */}
              <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
                {PROMPT_BLOCKS.map(block => {
                  const isActive = activePromptSubTab === block.id;
                  const colorActiveMap: Record<string, string> = {
                    indigo: 'bg-indigo-600 text-white',
                    emerald: 'bg-emerald-600 text-white',
                    amber: 'bg-amber-500 text-white',
                    rose: 'bg-rose-600 text-white',
                    violet: 'bg-violet-600 text-white',
                    teal: 'bg-teal-600 text-white',
                  };
                  return (
                    <button
                      key={block.id}
                      onClick={() => setActivePromptSubTab(block.id)}
                      className={classNames(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap flex-shrink-0 border',
                        isActive
                          ? `${colorActiveMap[block.color]} border-transparent shadow-sm`
                          : 'text-ink-500 bg-white border-ink-200 hover:border-ink-300 hover:text-ink-700'
                      )}
                    >
                      <block.icon size={11} />
                      {block.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                {/* Left: Version history + context doc */}
                <div className="space-y-3">
                  {/* Context doc panel */}
                  <div className={classNames('rounded-2xl border overflow-hidden', activeBlock.accentBorder)}>
                    <div className={classNames('px-4 py-3 flex items-center gap-2', activeBlock.accentBg)}>
                      <activeBlock.icon size={14} className={classNames('shrink-0', activeBlock.accentText)} />
                      <span className={classNames('text-[11px] font-black uppercase tracking-widest', activeBlock.accentText)}>{activeBlock.label}</span>
                    </div>
                    <div className="bg-white p-4 space-y-3">
                      <p className="text-[11px] text-ink-600 leading-relaxed">{activeBlock.desc}</p>
                      {/* Must have */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          <CheckCircle2 size={11} className="text-emerald-600" />
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          <AlertCircle size={11} className="text-rose-600" />
                          <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">NUNCA remover</span>
                        </div>
                        {activeBlock.neverRemove?.map((item, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-rose-500 text-[10px] mt-0.5 shrink-0">⚠</span>
                            <span className="text-[10px] text-ink-600 leading-snug">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Version history */}
                  {versions.length > 0 && (
                    <div className="bg-ink-50 border border-ink-200 rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <History size={11} className="text-ink-400" />
                        <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Histórico</span>
                        <span className="ml-auto text-[9px] text-ink-400">{versions.length} versões</span>
                      </div>
                      <div className="space-y-1">
                        {versions.map((v, i) => (
                          <button
                            key={i}
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Restaurar Versão',
                                message: `Restaurar versão de ${new Date(v.timestamp).toLocaleString('pt-BR')}?`,
                                confirmLabel: 'Restaurar',
                                variant: 'warning',
                              });
                              if (ok) {
                                savePromptVersion(activeBlock.id, activeValue);
                                setLocalSettings(prev => ({ ...prev, [activeBlock.settingsKey]: v.value }));
                                showToast('Versão restaurada!', 'success');
                              }
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-ink-200 hover:border-brand-300 hover:bg-brand-50 text-left transition-all group"
                          >
                            <RotateCcw size={9} className="text-ink-300 group-hover:text-brand-500 shrink-0" />
                            <div>
                              <div className="text-[9px] font-bold text-ink-600">{new Date(v.timestamp).toLocaleString('pt-BR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="text-[8px] text-ink-400 truncate w-36">{v.value.substring(0, 50)}…</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save block button (context-specific) */}
                  {!readOnly && (
                    <button
                      onClick={async () => {
                        const currentValue = (localSettings[activeBlock.settingsKey] as string) || '';
                        // Marcadores parser-críticos (hoje só o Copiloto) — aviso
                        // best-effort, não bloqueia (o admin pode ter um motivo
                        // legítimo, ex.: reescrevendo o bloco em etapas).
                        const missingMarkers = (activeBlock.requiredMarkers || []).filter(m => !currentValue.includes(m));
                        if (missingMarkers.length > 0) {
                          const proceed = await confirm({
                            title: 'Marcador obrigatório ausente',
                            message: `Este bloco não contém ${missingMarkers.map(m => `"${m}"`).join(' e ')}, que o parser do Copiloto espera encontrar (ver "Nunca Remover" acima). Salvar mesmo assim pode quebrar o Copiloto na próxima geração.`,
                            variant: 'warning',
                            confirmLabel: 'Salvar mesmo assim',
                          });
                          if (!proceed) return;
                        }
                        savePromptVersion(activeBlock.id, currentValue);
                        setIsSaving(true);
                        try {
                          // Salva SÓ o bloco ativo (merge parcial contra o que já
                          // está persistido) — não o localSettings inteiro, que
                          // incluiria rascunhos não-salvos de OUTRAS abas deste
                          // mesmo painel (A5, achado da auditoria).
                          await updateSettings({ [activeBlock.settingsKey]: currentValue } as Partial<typeof localSettings>);
                          showToast(`✓ "${activeBlock.label}" salvo!`, 'success');
                        } catch { showToast('Erro ao salvar bloco', 'error'); }
                        finally { setIsSaving(false); }
                      }}
                      disabled={isSaving}
                      className="w-full h-9 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Salvar Bloco
                    </button>
                  )}
                </div>

                {/* Right: Editor */}
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
                    showToast(`${activeBlock.label} restaurado para o padrão`, 'info');
                  }}
                />
              </div>

              {/* Diff Visual Modal */}
              {pendingDiff && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                  <div className="bg-zinc-950 rounded-3xl border border-zinc-700 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
                          <GitCompare size={16} className="text-violet-400" />
                        </div>
                        <div>
                          <h4 className="font-black text-white text-sm">Diff Visual — Melhoria por IA</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bloco: {pendingDiff.block}</p>
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
                            showToast('✓ Melhoria aceita!', 'success');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <CheckSquare size={13} /> Aceitar
                        </button>
                        <button onClick={() => setPendingDiff(null)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                          <XCircle size={13} /> Rejeitar
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto grid grid-cols-2">
                      <div className="border-r border-zinc-800">
                        <div className="px-4 py-2 bg-rose-950/30 border-b border-zinc-800 flex items-center gap-2">
                          <XCircle size={10} className="text-rose-400" />
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Original</span>
                        </div>
                        <pre className="p-5 text-[11px] text-rose-300/80 font-mono whitespace-pre-wrap leading-relaxed">{pendingDiff.original}</pre>
                      </div>
                      <div>
                        <div className="px-4 py-2 bg-emerald-950/30 border-b border-zinc-800 flex items-center gap-2">
                          <CheckSquare size={10} className="text-emerald-400" />
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

        {/* ══════════════════════════════════
            TAB: TEMPLATES
        ══════════════════════════════════ */}
        {activeTab === 'templates' && (() => {
          const selectedArea = EXAM_AREAS.find(a => a.id === selectedAreaFilter);
          const areaTemplates = selectedAreaFilter ? templates.filter(t => t.area === selectedAreaFilter) : [];
          const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
          const hasCustomAreaPrompt = selectedAreaFilter ? !!(localSettings.aiAreaPrompts?.[selectedAreaFilter as ExamArea]?.trim()) : false;

          const areaColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
            'medicina-interna':   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: '🫀' },
            'medicina-fetal':     { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200',   icon: '🤰' },
            'ginecologia':        { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200',   icon: '🌸' },
            'vascular':           { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    icon: '🩸' },
            'musculoesqueletico': { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  icon: '🦴' },
            'mastologia':         { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: '🎗️' },
            'pequenas-partes':    { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   icon: '🔬' },
            'pediatria':          { bg: 'bg-lime-50',   text: 'text-lime-700',   border: 'border-lime-200',   icon: '👶' },
            'reumatologico':      { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '🦾' },
            'procedimentos':      { bg: 'bg-ink-50',    text: 'text-ink-700',    border: 'border-ink-200',    icon: '💉' },
          };
          const ac = selectedAreaFilter ? (areaColors[selectedAreaFilter] || areaColors['medicina-interna']) : null;

          return (
            <div className="animate-fade-in">
              {/* Cascata visual - compact */}
              <div className="mb-5 bg-ink-900 rounded-xl p-3 flex items-center gap-2 overflow-hidden">
                <div className="flex-1 text-center px-2 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
                  <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Camada 1</div>
                  <div className="text-[10px] font-black text-indigo-100">Doutrina Universal</div>
                </div>
                <div className="text-indigo-500 font-black shrink-0">→</div>
                <div className={classNames('flex-1 text-center px-2 py-1.5 rounded-lg border transition-all',
                  selectedAreaFilter && ac ? `bg-emerald-500/20 border-emerald-500/40` : 'bg-emerald-600/10 border-emerald-500/20 opacity-60'
                )}>
                  <div className="text-[8px] font-black text-emerald-300 uppercase tracking-widest">Camada 2</div>
                  <div className="text-[10px] font-black text-emerald-100">{selectedArea ? selectedArea.label : 'Área'}</div>
                </div>
                <div className="text-indigo-500 font-black shrink-0">→</div>
                <div className={classNames('flex-1 text-center px-2 py-1.5 rounded-lg border',
                  selectedTemplate ? 'bg-violet-600/20 border-violet-500/40' : 'bg-violet-600/10 border-violet-500/20 opacity-40'
                )}>
                  <div className="text-[8px] font-black text-violet-300 uppercase tracking-widest">Camada 3</div>
                  <div className="text-[10px] font-black text-violet-100">{selectedTemplate ? selectedTemplate.name : 'Exame'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-5 items-start">
                {/* LEFT: Area list */}
                <div className="space-y-2.5">
                  {/* Sub-tab pills */}
                  <div className="flex gap-1 p-1 bg-ink-100 border border-ink-200/50 rounded-xl">
                    {(['area', 'exams'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setTemplateSubTab(t)}
                        className={classNames(
                          "flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                          templateSubTab === t ? "bg-white text-ink-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
                        )}
                      >
                        {t === 'area' ? 'Por Área' : 'Por Exame'}
                      </button>
                    ))}
                  </div>

                  {/* Area list */}
                  <div className="space-y-1">
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
                            const first = templates.filter(t => t.area === area.id)[0];
                            setSelectedTemplateId(first ? first.id : '');
                          }}
                          className={classNames(
                            'w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 group',
                            isActive ? `${colors.bg} ${colors.border}` : 'bg-white border-ink-100 hover:border-ink-200'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm shrink-0">{colors.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={classNames('text-[11px] font-black truncate', isActive ? colors.text : 'text-ink-700')}>
                                  {area.label}
                                </span>
                                {hasCustom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Customizada" />}
                              </div>
                              <div className={classNames('text-[9px]', isActive ? `${colors.text} opacity-70` : 'text-ink-400')}>
                                {count} {count === 1 ? 'exame' : 'exames'}
                              </div>
                            </div>
                            {isActive && <ChevronRight size={11} className={colors.text} />}
                          </div>

                          {/* Exam sub-list */}
                          {isActive && templateSubTab === 'exams' && count > 0 && (
                            <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2">
                              {templates.filter(t => t.area === area.id).map(t => {
                                const isExamActive = selectedTemplateId === t.id;
                                const hasInstructions = !!(t.aiInstructions?.trim());
                                return (
                                  <button
                                    key={t.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedTemplateId(t.id); }}
                                    className={classNames(
                                      'w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2',
                                      isExamActive ? 'bg-white shadow-sm text-ink-900' : `${colors.text} opacity-70 hover:opacity-100`
                                    )}
                                  >
                                    <span className="shrink-0">{isExamActive ? '▶' : '○'}</span>
                                    <span className="flex-1 truncate">{t.name}</span>
                                    {hasInstructions && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-ink-50 rounded-xl border border-ink-100 text-center">
                    <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total: </span>
                    <span className="text-[10px] font-black text-ink-700">{templates.length} exames</span>
                  </div>
                </div>

                {/* RIGHT: Content */}
                {selectedAreaFilter && ac ? (
                  <div className="space-y-4 min-w-0">

                    {/* ── Sub-tab: ÁREA */}
                    {templateSubTab === 'area' && (
                      <div className="space-y-4 animate-fade-in-up">
                        <div className={classNames('rounded-2xl border overflow-hidden', ac.border)}>
                          <div className={classNames('px-4 py-3 flex items-center justify-between gap-2', ac.bg)}>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{areaColors[selectedAreaFilter]?.icon}</span>
                              <div>
                                <span className={classNames('text-[11px] font-black uppercase tracking-widest', ac.text)}>{selectedArea?.label}</span>
                                <span className="text-[10px] text-ink-400 ml-2">— Camada 2</span>
                              </div>
                            </div>
                            {!readOnly && (
                              <div className="flex items-center gap-1.5">
                                {hasCustomAreaPrompt && (
                                  <button
                                    onClick={handleRestoreAreaPromptDefault}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all"
                                  >
                                    <RotateCcw size={9} />
                                    V2.0
                                  </button>
                                )}
                                <button
                                  onClick={handleSaveAreaPrompt}
                                  disabled={isSavingTemplate}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest bg-brand-600 hover:bg-brand-700 text-white transition-all disabled:opacity-50"
                                >
                                  {isSavingTemplate ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                                  Salvar
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="bg-white p-4">
                            <p className="text-[11px] text-ink-600 leading-relaxed mb-3">
                              Diretrizes herdadas por <strong>todos os exames de {selectedArea?.label}</strong>.
                              {hasCustomAreaPrompt ? ' ✓ Customizada.' : ' Usando padrão do sistema.'}
                            </p>
                            {areaTemplates.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {areaTemplates.map(t => (
                                  <button
                                    key={t.id}
                                    onClick={() => { setTemplateSubTab('exams'); setSelectedTemplateId(t.id); }}
                                    className={classNames('px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all hover:shadow-sm', ac.bg, ac.border, ac.text)}
                                  >
                                    {t.name}
                                    {t.aiInstructions?.trim() && <span className="ml-1 w-1 h-1 rounded-full bg-violet-400 inline-block" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <CognitiveCodeEditor
                          readOnly={readOnly}
                          value={editingAreaPrompt}
                          onChange={(v) => setEditingAreaPrompt(v)}
                          fileName={`${selectedAreaFilter.replace(/\s+/g, '_')}_area_directive.md`}
                          badge="AREA LEVEL — CAMADA 2"
                          glowColor="brand"
                          placeholder={`Diretrizes gerais para todos os exames de ${selectedArea?.label}...`}
                          onRestore={hasCustomAreaPrompt ? handleRestoreAreaPromptDefault : undefined}
                        />
                      </div>
                    )}

                    {/* ── Sub-tab: EXAMES */}
                    {templateSubTab === 'exams' && (
                      <div className="space-y-4 animate-fade-in-up">
                        {selectedTemplateId && selectedTemplate ? (
                          <>
                            {/* Exam header with actions */}
                            <div className="rounded-2xl border border-violet-200 overflow-hidden">
                              <div className="px-4 py-3 flex items-center justify-between gap-2 bg-violet-50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={13} className="text-violet-600 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-black text-violet-700 uppercase tracking-widest truncate block">{selectedTemplate.name}</span>
                                    <span className="text-[9px] text-ink-400">Camada 3 · Prompt Específico</span>
                                  </div>
                                </div>
                                {!readOnly && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={handleRestoreExamPromptFromBackup}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all"
                                      title="Recuperar backup"
                                    >
                                      <RotateCcw size={9} />
                                      Backup
                                    </button>
                                    <button
                                      onClick={handleClearExamPrompt}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-all"
                                      title="Limpar instruções"
                                    >
                                      <Trash2 size={9} />
                                      Limpar
                                    </button>
                                    <button
                                      onClick={handleSaveTemplatePrompt}
                                      disabled={isSavingTemplate}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50"
                                    >
                                      {isSavingTemplate ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
                                      Salvar
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="bg-white p-4">
                                <p className="text-[11px] text-ink-600 leading-relaxed mb-3">
                                  Instruções <strong>exclusivas</strong> deste exame: fraseologia de RECOMENDAÇÕES, biometria, classificações específicas.
                                </p>
                                {/* Quick inject directives */}
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Zap size={11} className="text-violet-600" />
                                    <span className="text-[9px] font-black text-violet-700 uppercase tracking-widest">Injetar diretiva rápida</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      { label: 'Elipsoide', text: '- Calcule o volume pelo elipsoide: D1 × D2 × D3 × 0,523. Converta mm→cm antes.' },
                                      { label: 'TI-RADS', text: '- Classifique nódulos tireoidianos pelo TI-RADS ACR 2017. Declare pontuação e categoria TR1–TR5.' },
                                      { label: 'BI-RADS', text: '- Classifique lesões mamárias pelo BI-RADS ACR 2013. Atribua categoria 0–6.' },
                                      { label: 'O-RADS', text: '- Classifique cistos/massas ovarianas pelo O-RADS ACR 2022. Declare categoria 1–5.' },
                                      { label: 'Urgência R6', text: '- Em achado de urgência, inicie RECOMENDAÇÕES com: <p>• <strong>ALERTA [CATEGORIA]:</strong> encaminhamento imediato.</p>' },
                                    ].map((item) => (
                                      <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => handleInjectDirective(item.text)}
                                        className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 active:scale-95"
                                      >
                                        {item.label}
                                        <Zap size={8} className="text-violet-400" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <CognitiveCodeEditor
                              readOnly={readOnly}
                              value={editingTemplatePrompt}
                              onChange={(v) => setEditingTemplatePrompt(v)}
                              fileName={`${(selectedTemplate.name || '').toLowerCase().replace(/\s+/g, '_')}_exam_directive.md`}
                              badge="EXAM DIRECTIVE — CAMADA 3"
                              glowColor="violet"
                              placeholder={`Instruções específicas para "${selectedTemplate.name}"...`}
                            />

                            {/* Playground */}
                            {renderPlayground()}
                          </>
                        ) : (
                          <div className="p-10 text-center border-2 border-dashed border-ink-200 rounded-3xl">
                            <LayoutList size={32} className="text-ink-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-ink-400">
                              {areaTemplates.length > 0 ? 'Selecione um exame na sidebar.' : `Nenhum exame em ${selectedArea?.label}.`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-10 text-center border-2 border-dashed border-ink-200 rounded-3xl">
                    <LayoutList size={32} className="text-ink-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-ink-400">Selecione uma especialidade para começar.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════
            TAB: ENGINE
        ══════════════════════════════════ */}
        {activeTab === 'engine' && (
          <div className="max-w-4xl space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Left: API Keys */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
                <h4 className="text-sm font-black text-ink-900 flex items-center gap-2">
                  <Key size={15} className="text-brand-600" /> Chaves de API Globais
                </h4>
                
                <div>
                  <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Gemini API Key</label>
                  <input
                    type="password"
                    disabled={readOnly}
                    value={localSettings.geminiApiKey || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="input font-mono text-sm h-12"
                  />
                  <p className="text-[10px] text-ink-400 mt-1.5 ml-1">Obtenha em <span className="font-bold text-brand-600">aistudio.google.com/apikey</span></p>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={testConnection}
                      disabled={testStatus === 'testing'}
                      className={classNames('flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border',
                        testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        testStatus === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        testStatus === 'testing' ? 'bg-brand-50 text-brand-600 border-brand-200' :
                        'bg-ink-50 text-ink-700 border-ink-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                      )}
                    >
                      {testStatus === 'testing' ? (<><Loader2 size={12} className="animate-spin" /> Testando...</>) :
                       testStatus === 'success' ? (<><CheckCircle2 size={12} /> Conexão OK!</>) :
                       testStatus === 'error' ? (<><AlertCircle size={12} /> Falha</>) :
                       (<><Zap size={12} /> Testar Conexão</>)}
                    </button>
                    {testStatus !== 'idle' && (
                      <button 
                        type="button"
                        onClick={() => setTestStatus('idle')} 
                        className="text-xs text-ink-400 hover:text-ink-600 font-bold"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                  <span className="font-black">Motor Único: Google Gemini</span><br/>
                  <span className="text-[10px] text-blue-600">Lite = gemini-3.5-flash · Pro = gemini-3.1-pro-preview</span>
                </div>
              </div>

              {/* Right: Auto Refine and Fast Mode */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
                <h4 className="text-sm font-black text-ink-900 flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-brand-600" /> Parâmetros Adicionais
                </h4>

                {/* Auto Refine */}
                <div className="p-3 bg-ink-50/50 border border-ink-100 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-ink-900">Refinador Automático</div>
                    <p className="text-[9px] text-ink-400 mt-0.5">Ciclo extra de higienização após propostas do Copiloto.</p>
                  </div>
                  <button
                    disabled={readOnly}
                    onClick={() => setLocalSettings({ ...localSettings, aiAutoRefineEnabled: !localSettings.aiAutoRefineEnabled })}
                    className={classNames('relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                      localSettings.aiAutoRefineEnabled ? 'bg-brand-600' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                      localSettings.aiAutoRefineEnabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>

                {/* Fast Mode */}
                <div className="p-3 bg-ink-50/50 border border-ink-100 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-ink-900">Modo Rápido (Sem Raciocínio)</div>
                    <p className="text-[9px] text-ink-400 mt-0.5">Ignora a auto-auditoria/scratchpad do modelo para obter laudos mais rapidamente.</p>
                  </div>
                  <button
                    disabled={readOnly}
                    onClick={() => setLocalSettings({ ...localSettings, aiFastMode: !localSettings.aiFastMode })}
                    className={classNames('relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                      localSettings.aiFastMode ? 'bg-brand-600' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                      localSettings.aiFastMode ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              </div>

              {/* Tiers de Motores */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-6 col-span-1 xl:col-span-2">
                <h4 className="text-sm font-black text-ink-900 flex items-center gap-2">
                  <Cpu size={15} className="text-brand-600" /> Tiers de Motores de IA (Lite e Pro)
                </h4>
                {loadingMotorConfig ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 size={18} className="animate-spin text-brand-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['lite', 'pro'] as const).map((tier) => {
                      const cfg = motorConfig[tier];
                      const isLite = tier === 'lite';
                      return (
                        <div key={tier} className={`p-4 rounded-xl border space-y-4 ${isLite ? 'border-indigo-200 bg-indigo-50/20' : 'border-brand-200 bg-brand-50/20'}`}>
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-ink-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isLite ? 'bg-indigo-500' : 'bg-brand-500'}`} />
                              Motor {isLite ? 'Lite' : 'Pro'} · Google Gemini
                            </h5>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-lg bg-white border border-ink-100 text-ink-500">
                              {cfg.model}
                            </span>
                          </div>
                          <div>
                            <label className="label text-[10px] uppercase font-bold text-ink-500">Modelo Gemini</label>
                            <select
                              disabled={readOnly}
                              value={cfg.model}
                              onChange={(e) => setMotorConfig({ ...motorConfig, [tier]: { ...cfg, model: e.target.value } })}
                              className="input h-10 text-xs"
                            >
                              <option value="gemini-3.5-flash">gemini-3.5-flash (rápido, econômico)</option>
                              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (alta qualidade)</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] uppercase font-bold text-ink-500">Tokens/Laudo (est.)</label>
                              <input
                                type="number"
                                disabled={readOnly}
                                value={cfg.tokensPerReport}
                                onChange={(e) => setMotorConfig({ ...motorConfig, [tier]: { ...cfg, tokensPerReport: parseInt(e.target.value, 10) || 0 } })}
                                className="input h-10 text-xs"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] uppercase font-bold text-ink-500">Custo/1k Tok (USD)</label>
                              <input
                                type="number"
                                step="0.001"
                                disabled={readOnly}
                                value={cfg.costPerThousandTokens}
                                onChange={(e) => setMotorConfig({ ...motorConfig, [tier]: { ...cfg, costPerThousandTokens: parseFloat(e.target.value) || 0 } })}
                                className="input h-10 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: TRAINING
        ══════════════════════════════════ */}
        {activeTab === 'training' && (
          <div className="animate-fade-in">
            <TrainingDashboard
              readOnly={readOnly}
              trainingEnabled={!!localSettings.aiTrainingEnabled}
              onToggleTraining={() => setLocalSettings({ ...localSettings, aiTrainingEnabled: !localSettings.aiTrainingEnabled })}
              contextSize={localSettings.aiTrainingContextSize || 3}
              onContextSizeChange={(n) => setLocalSettings({ ...localSettings, aiTrainingContextSize: n })}
            />
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: STATUS / TELEMETRIA
        ══════════════════════════════════ */}
        {activeTab === 'status' && (
          <div className="max-w-4xl space-y-5 animate-fade-in">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-xl px-3 py-2 shadow-sm">
                <Filter size={13} className="text-ink-400" />
                <span className="text-xs font-bold text-ink-600">Filtrar:</span>
                {['all', 'generation', 'refine', 'copilot', 'template'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTelemetryModeFilter(mode)}
                    className={classNames(
                      'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                      telemetryModeFilter === mode ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                    )}
                  >
                    {mode === 'all' ? 'Todos' : mode === 'generation' ? 'Geração' : mode === 'refine' ? 'Refine' : mode === 'copilot' ? 'Copiloto' : 'Template'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-xl px-3 py-2 shadow-sm">
                <TrendingUp size={13} className="text-violet-500" />
                <span className="text-xs font-bold text-ink-600">BRL:</span>
                <input
                  type="number" min={1} max={20} step={0.1}
                  value={localSettings.aiConversionRateBRL ?? 5.5}
                  onChange={e => setLocalSettings(prev => ({ ...prev, aiConversionRateBRL: parseFloat(e.target.value) || 5.5 }))}
                  className="w-14 text-xs font-mono border border-ink-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-brand-400 outline-none"
                />
              </div>
            </div>

            {/* ── Histórico do Sistema ── */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <h4 className="text-sm font-black text-ink-900 flex items-center gap-2 mb-4">
                <Database size={15} className="text-violet-600" /> Histórico do Sistema
              </h4>
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-ink-500 tracking-widest">De</label>
                  <input
                    type="date"
                    value={histFrom}
                    onChange={e => setHistFrom(e.target.value)}
                    className="h-8 px-3 border border-ink-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-400 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-ink-500 tracking-widest">Até</label>
                  <input
                    type="date"
                    value={histTo}
                    onChange={e => setHistTo(e.target.value)}
                    className="h-8 px-3 border border-ink-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-brand-400 outline-none"
                  />
                </div>
                <button
                  onClick={fetchHistoricalStats}
                  disabled={histLoading}
                  className="flex items-center gap-1.5 h-8 px-4 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all"
                >
                  {histLoading ? <Loader2 size={11} className="animate-spin" /> : null}
                  Buscar
                </button>
              </div>

              {historicalLogs.length > 0 && (() => {
                const htotalCalls = historicalLogs.length;
                const htotalIn = historicalLogs.reduce((s, l) => s + (l.inputTokens || 0), 0);
                const htotalOut = historicalLogs.reduce((s, l) => s + (l.outputTokens || 0), 0);
                const htotalUsd = historicalLogs.reduce((s, l) => s + (l.costUsd || 0), 0);
                const htotalBrl = htotalUsd * conversionRate;

                // Group by model
                const byModel: Record<string, { calls: number; tokIn: number; tokOut: number; usd: number }> = {};
                historicalLogs.forEach(l => {
                  const m = l.model || 'unknown';
                  if (!byModel[m]) byModel[m] = { calls: 0, tokIn: 0, tokOut: 0, usd: 0 };
                  byModel[m].calls++;
                  byModel[m].tokIn += l.inputTokens || 0;
                  byModel[m].tokOut += l.outputTokens || 0;
                  byModel[m].usd += l.costUsd || 0;
                });

                const liteLogs = historicalLogs.filter(l => (l.model || '').toLowerCase().includes('flash'));
                const proLogs = historicalLogs.filter(l => (l.model || '').toLowerCase().includes('pro'));

                return (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { label: 'Chamadas', v: htotalCalls.toLocaleString('pt-BR') },
                        { label: 'Tokens IN', v: htotalIn.toLocaleString('pt-BR') },
                        { label: 'Tokens OUT', v: htotalOut.toLocaleString('pt-BR') },
                        { label: 'Custo USD', v: `$${htotalUsd.toFixed(4)}` },
                        { label: 'Custo BRL', v: `R$ ${htotalBrl.toFixed(2)}` },
                      ].map(c => (
                        <div key={c.label} className="bg-ink-50 rounded-xl p-3 text-center">
                          <div className="text-[9px] font-black uppercase text-ink-500 tracking-widest mb-0.5">{c.label}</div>
                          <div className="text-sm font-black text-ink-900">{c.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Per model table */}
                    <div className="overflow-x-auto rounded-xl border border-ink-100">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-ink-50/50 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                            <th className="px-4 py-2.5">Modelo</th>
                            <th className="px-4 py-2.5 text-right">Chamadas</th>
                            <th className="px-4 py-2.5 text-right">Tokens IN</th>
                            <th className="px-4 py-2.5 text-right">Tokens OUT</th>
                            <th className="px-4 py-2.5 text-right">USD</th>
                            <th className="px-4 py-2.5 text-right">BRL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-50">
                          {Object.entries(byModel).map(([model, d]) => (
                            <tr key={model} className="hover:bg-ink-50/30">
                              <td className="px-4 py-2.5 font-mono text-[10px] text-zinc-700">{model}</td>
                              <td className="px-4 py-2.5 text-right font-bold">{d.calls}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-ink-600">{d.tokIn.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-ink-600">{d.tokOut.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-2.5 text-right font-mono">${d.usd.toFixed(4)}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-emerald-700">R$ {(d.usd * conversionRate).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Lite vs Pro breakdown */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/50">
                        <div className="text-[9px] font-black uppercase text-indigo-700 tracking-widest mb-1">Lite (Flash)</div>
                        <div className="text-xs font-bold text-ink-900">{liteLogs.length} chamadas</div>
                        <div className="text-[10px] text-ink-500">R$ {(liteLogs.reduce((s, l) => s + (l.costUsd || 0), 0) * conversionRate).toFixed(2)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-200/50">
                        <div className="text-[9px] font-black uppercase text-violet-700 tracking-widest mb-1">Pro</div>
                        <div className="text-xs font-bold text-ink-900">{proLogs.length} chamadas</div>
                        <div className="text-[10px] text-ink-500">R$ {(proLogs.reduce((s, l) => s + (l.costUsd || 0), 0) * conversionRate).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {!histLoading && historicalLogs.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">Nenhum dado encontrado. Clique em "Buscar" para carregar o histórico.</p>
              )}
            </div>

            <TelemetryDashboard modeFilter={telemetryModeFilter} conversionRate={conversionRate} />

            {/* Connection Status */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <h4 className="text-sm font-black text-ink-900 flex items-center gap-2 mb-4">
                <Activity size={15} className="text-brand-600" /> Status da IA
              </h4>
              <div className="space-y-2.5 mb-5">
                {/* Main provider status */}
                <div className="p-4 rounded-xl border bg-brand-50/50 border-brand-200/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-ink-900">Google Gemini</span>
                        <span className="px-1.5 py-0.5 bg-brand-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">Motor Único</span>
                      </div>
                      <span className="text-[10px] text-ink-500">Lite: {motorConfig.lite.model} · Pro: {motorConfig.pro.model}</span>
                    </div>
                  </div>
                  {localSettings.geminiApiKey ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <Wifi size={11} className="text-emerald-600" />
                      <span className="text-[9px] font-black text-emerald-700 uppercase">OK</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 border border-red-200 rounded-lg">
                      <WifiOff size={11} className="text-red-500" />
                      <span className="text-[9px] font-black text-red-600 uppercase">Sem Key</span>
                    </div>
                  )}
                </div>
                {/* Motor tiers */}
                <div className="grid grid-cols-2 gap-2">
                  {(['lite', 'pro'] as const).map((tier) => (
                    <div key={tier} className={`p-3 rounded-xl border flex items-center gap-2.5 ${tier === 'lite' ? 'bg-indigo-50/50 border-indigo-200/50' : 'bg-violet-50/50 border-violet-200/50'}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${tier === 'lite' ? 'bg-indigo-500' : 'bg-violet-500'}`} />
                      <div className="min-w-0">
                        <div className={`text-[10px] font-black uppercase tracking-widest ${tier === 'lite' ? 'text-indigo-700' : 'text-violet-700'}`}>
                          Motor {tier === 'lite' ? 'Lite' : 'Pro'}
                        </div>
                        <div className="text-[9px] font-mono text-ink-500 truncate">{motorConfig[tier].model}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-3 pt-4 border-t border-ink-100">
                  <button
                    onClick={testConnection}
                    disabled={testStatus === 'testing'}
                    className={classNames('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border',
                      testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      testStatus === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      testStatus === 'testing' ? 'bg-brand-50 text-brand-600 border-brand-200' :
                      'bg-ink-50 text-ink-700 border-ink-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                    )}
                  >
                    {testStatus === 'testing' ? (<><Loader2 size={14} className="animate-spin" /> Testando...</>) :
                     testStatus === 'success' ? (<><CheckCircle2 size={14} /> Conexão OK!</>) :
                     testStatus === 'error' ? (<><AlertCircle size={14} /> Falha</>) :
                     (<><Zap size={14} /> Testar Conexão</>)}
                  </button>
                  {testStatus !== 'idle' && (
                    <button onClick={() => setTestStatus('idle')} className="text-sm text-ink-400 hover:text-ink-600 font-bold">
                      Resetar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Config Summary */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <h5 className="text-[10px] font-black text-ink-500 uppercase tracking-widest mb-4">Resumo de Configuração</h5>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Provedor', value: 'Google Gemini', icon: Cpu },
                  { label: 'Motor Lite', value: motorConfig.lite.model, icon: BrainCircuit },
                  { label: 'Motor Pro', value: motorConfig.pro.model, icon: Sparkles },
                  { label: 'Treinamento', value: localSettings.aiTrainingEnabled ? `Ativo (${localSettings.aiTrainingContextSize || 3} exames)` : 'Desativado', icon: GraduationCap },
                  { label: 'API Key', value: localSettings.geminiApiKey ? 'Configurada' : 'Não configurada', icon: Key },
                  { label: 'Laud.IA Core', value: 'v2.0 PROD', icon: ShieldCheck },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-ink-50 rounded-xl border border-ink-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon size={12} className="text-ink-400" />
                      <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-ink-800 leading-tight truncate block">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── Factory Reset (floating, minimal, always accessible) ─── */}
      {!readOnly && (
        <div className="fixed bottom-20 right-4 z-10 sm:bottom-6">
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Reset de Fábrica',
                message: 'Restaurar os 4 prompts principais para o padrão de fábrica?',
                confirmLabel: 'Restaurar',
                variant: 'danger',
              });
              if (ok) {
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 bg-white border border-rose-200 hover:border-rose-350 hover:bg-rose-50 shadow-lg transition-all"
            title="Reset de Fábrica — Restaura os 4 prompts principais ao padrão"
          >
            <RotateCcw size={11} />
            <span className="hidden sm:inline">Factory Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
