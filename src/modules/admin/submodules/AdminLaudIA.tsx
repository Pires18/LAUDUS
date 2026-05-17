import { useState, useEffect } from 'react';
import { useApp } from '../../../store/app';
import { 
  BrainCircuit, ShieldAlert, 
  RotateCcw, Zap,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, ShieldCheck,
  FlaskConical, Play, FileText, History
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

type TabId = 'prompts' | 'areas' | 'sandbox' | 'engine' | 'training';

export function AdminLaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [selectedArea, setSelectedArea] = useState<ExamArea>(EXAM_AREAS[0].id);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Sandbox States
  const [sampleInput, setSampleInput] = useState('PACIENTE: JOÃO DA SILVA\nEXAME: USG ABDOME TOTAL\nACHADOS: Fígado de dimensões normais, contornos regulares. Vesícula biliar com paredes finas, sem cálculos. Rins normais.');
  const [sandboxResult, setSandboxResult] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

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
        showToast('Conexão validada!', 'success');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      showToast('Falha na conexão', 'error');
    }
  }

  async function handleSimulate() {
    if (!localSettings.geminiApiKey) {
      showToast('Configure a API Key antes de simular', 'error');
      return;
    }
    setIsSimulating(true);
    setSandboxResult('');
    try {
      const mockTemplate: ReportTemplate = {
        id: 'sandbox-test',
        name: 'Simulação Admin',
        area: 'medicina-interna',
        title: 'LAUDO DE SIMULAÇÃO',
        technique: 'Exame realizado com técnica convencional.',
        analysisTemplate: '{{ACHADOS}}',
        conclusionTemplate: 'Achados sugestivos de normalidade.',
        recommendationsTemplate: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await generateReport({
        template: mockTemplate,
        patient: { 
          id: '1', 
          name: 'Paciente Sandbox', 
          gender: 'M', 
          createdAt: Date.now(), 
          updatedAt: Date.now() 
        },
        settings: localSettings,
        clinicalIndication: sampleInput
      });
      setSandboxResult(result);
      showToast('Simulação concluída!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro na simulação', 'error');
    } finally {
      setIsSimulating(false);
    }
  }

  const sidebarItems = [
    { id: 'prompts', label: 'Doutrina & Prompts', icon: ShieldAlert },
    { id: 'areas', label: 'Especialidades', icon: LayoutList },
    { id: 'sandbox', label: 'IA Sandbox (Laboratório)', icon: FlaskConical },
    { id: 'engine', label: 'Motor & API', icon: Sliders },
    { id: 'training', label: 'Aprendizado IA', icon: GraduationCap },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">IA Command Center</h3>
          <p className="text-sm text-ink-500">Gestão de alto nível do motor cognitivo LAUD.IA.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLocalSettings(settings)} className="btn-ghost text-ink-400">
            <RotateCcw size={16} />
            Descartar
          </button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary shadow-lg shadow-brand-500/20">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Publicar Configurações
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <aside className="w-full lg:w-64 shrink-0 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={classNames(
                "w-full px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3",
                activeTab === item.id 
                  ? "bg-ink-900 text-white shadow-xl scale-[1.02]" 
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* TAB: PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/20">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                      <BrainCircuit size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-ink-900 uppercase text-xs tracking-widest">Prompt Mestre</h4>
                      <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.2em] mt-1">Doutrina Central do Sistema</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setLocalSettings({...localSettings, aiMasterPrompt: DEFAULT_MASTER_PROMPT})}
                    className="p-2.5 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                    title="Restaurar Padrão"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
                <div className="p-6">
                  <textarea
                    value={localSettings.aiMasterPrompt}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiMasterPrompt: e.target.value })}
                    rows={12}
                    className="w-full rounded-3xl border-none font-mono text-xs focus:ring-0 bg-ink-900 text-brand-50 p-8 leading-relaxed shadow-inner"
                    placeholder="Defina o papel principal da IA..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" /> Instruções de Raciocínio
                    </h4>
                    <button onClick={() => setLocalSettings({...localSettings, aiGlobalInstructions: DEFAULT_GLOBAL_INSTRUCTIONS})} className="text-ink-300 hover:text-brand-600">
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <textarea
                    value={localSettings.aiGlobalInstructions}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiGlobalInstructions: e.target.value })}
                    rows={10}
                    className="flex-1 w-full border-none focus:ring-0 font-mono text-[11px] p-8 bg-white"
                  />
                </div>

                <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-red-500" /> Regras Inquebráveis
                    </h4>
                    <button onClick={() => setLocalSettings({...localSettings, aiRigidRules: DEFAULT_RIGID_RULES})} className="text-ink-300 hover:text-brand-600">
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <textarea
                    value={localSettings.aiRigidRules}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiRigidRules: e.target.value })}
                    rows={10}
                    className="flex-1 w-full border-none focus:ring-0 font-mono text-[11px] p-8 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SANDBOX */}
          {activeTab === 'sandbox' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm p-8">
                   <h4 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <FileText size={18} className="text-brand-600" /> Entrada de Dados (Simulação)
                   </h4>
                   <textarea
                    value={sampleInput}
                    onChange={e => setSampleInput(e.target.value)}
                    rows={8}
                    className="input p-6 text-sm font-medium leading-relaxed mb-6"
                    placeholder="Cole aqui um texto bruto para testar a IA..."
                   />
                   <button 
                    onClick={handleSimulate}
                    disabled={isSimulating}
                    className="w-full btn-primary h-14 uppercase text-xs tracking-widest shadow-lg shadow-brand-500/30"
                   >
                     {isSimulating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                     Executar Simulação de Laudo
                   </button>
                </div>

                <div className="bg-ink-900 rounded-[2.5rem] p-8 text-white">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                    <History size={16} /> Dica de Laboratório
                   </h4>
                   <p className="text-sm text-white/80 leading-relaxed italic">
                     "Use este sandbox para validar se suas alterações no Prompt Mestre estão seguindo as Regras Inquebráveis antes de publicar para todos os médicos."
                   </p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
                <div className="p-6 border-b border-ink-100 bg-ink-50/20 flex justify-between items-center">
                  <h4 className="text-sm font-black text-ink-900 uppercase tracking-widest">Resultado da IA</h4>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="w-2 h-2 rounded-full bg-emerald-300" />
                    <div className="w-2 h-2 rounded-full bg-emerald-100" />
                  </div>
                </div>
                <div className="flex-1 p-8 prose prose-sm max-w-none overflow-y-auto">
                  {sandboxResult ? (
                    <div dangerouslySetInnerHTML={{ __html: sandboxResult }} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-ink-300 space-y-4 py-20">
                      <FlaskConical size={64} className="opacity-20" />
                      <p className="font-bold">Aguardando execução do laboratório...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: AREAS */}
          {activeTab === 'areas' && (
            <div className="flex flex-col lg:flex-row bg-white rounded-[2.5rem] border border-ink-100 shadow-sm overflow-hidden min-h-[600px] animate-fade-in">
              <div className="w-full lg:w-72 bg-ink-50/30 border-r border-ink-100 p-6 space-y-1">
                <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-4 px-2">Especialidades</p>
                {EXAM_AREAS.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => setSelectedArea(area.id)}
                    className={classNames(
                      "w-full text-left px-5 py-4 rounded-2xl text-xs font-bold transition-all flex items-center gap-3",
                      selectedArea === area.id 
                        ? "bg-brand-600 text-white shadow-lg" 
                        : "text-ink-600 hover:bg-ink-100"
                    )}
                  >
                    <div className={classNames("w-1.5 h-1.5 rounded-full", selectedArea === area.id ? "bg-white" : "bg-ink-200")} />
                    {area.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-black text-ink-900">Protocolo: {EXAM_AREAS.find(a => a.id === selectedArea)?.label}</h4>
                    <p className="text-sm text-ink-500">Diretrizes cognitivas específicas para esta área de atuação.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: AREA_SPECIFIC_PROMPTS[selectedArea] };
                      setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                    }}
                    className="p-3 text-brand-600 hover:bg-brand-50 rounded-2xl border border-brand-100 transition-all"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
                <textarea
                  value={localSettings.aiAreaPrompts?.[selectedArea] || ''}
                  onChange={(e) => {
                    const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: e.target.value };
                    setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                  }}
                  rows={18}
                  className="w-full rounded-[2rem] border-none font-mono text-sm p-10 bg-ink-50/20 focus:ring-2 focus:ring-brand-500 leading-relaxed shadow-inner"
                  placeholder={`Instruções clínicas para ${selectedArea}...`}
                />
              </div>
            </div>
          )}

          {/* TAB: ENGINE */}
          {activeTab === 'engine' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm p-10">
                <div className="space-y-8">
                  <div>
                    <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-3 font-black">Google Gemini API Key</label>
                    <div className="flex gap-4">
                      <input
                        type="password"
                        value={localSettings.geminiApiKey || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                        className="input flex-1 font-mono text-sm h-16 px-6"
                        placeholder="sk-..."
                      />
                      <button
                        onClick={testConnection}
                        disabled={testStatus === 'testing'}
                        className={classNames(
                          "w-16 h-16 flex items-center justify-center rounded-2xl transition-all border shadow-sm",
                          testStatus === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          testStatus === 'error' ? "bg-red-50 text-red-600 border-red-200" :
                          "bg-white text-ink-600 border-ink-100 hover:border-brand-300"
                        )}
                      >
                         {testStatus === 'testing' ? <Loader2 size={24} className="animate-spin" /> :
                          testStatus === 'success' ? <CheckCircle2 size={24} /> :
                          testStatus === 'error' ? <AlertCircle size={24} /> : <Zap size={24} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-3 font-black">Modelo de Inteligência</label>
                    <select 
                      value={localSettings.geminiModel} 
                      onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                      className="input h-16 px-6 font-bold"
                    >
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Fastest)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Advanced)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
                    </select>
                  </div>

                  <div className="pt-8 border-t border-ink-50">
                     <label className="block text-sm font-black text-ink-900 mb-8 flex items-center justify-between uppercase tracking-widest">
                      Temperatura Cognitiva
                      <span className="text-brand-600 text-3xl font-black">{localSettings.aiTemperature ?? 0.3}</span>
                     </label>
                     <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={localSettings.aiTemperature ?? 0.3}
                      onChange={(e) => setLocalSettings({ ...localSettings, aiTemperature: parseFloat(e.target.value) })}
                      className="w-full h-4 bg-ink-50 rounded-full appearance-none cursor-pointer accent-brand-600 border border-ink-100"
                     />
                     <div className="flex justify-between mt-4 text-[10px] font-black text-ink-400 uppercase tracking-widest">
                       <span>Determinístico</span>
                       <span>Criativo</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRAINING */}
          {activeTab === 'training' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm p-10">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                      <GraduationCap size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-ink-900">Learning Center</h4>
                      <p className="text-sm text-ink-500 font-medium">A IA mimetiza o estilo de escrita dos médicos seniores.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, aiTrainingEnabled: !localSettings.aiTrainingEnabled })}
                    className={classNames(
                      "relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      localSettings.aiTrainingEnabled ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames(
                      "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      localSettings.aiTrainingEnabled ? 'translate-x-6' : 'translate-x-0'
                    )} />
                  </button>
                </div>

                <div className={classNames("space-y-10 transition-all duration-500", !localSettings.aiTrainingEnabled && "opacity-30 grayscale pointer-events-none scale-[0.98]")}>
                  <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] text-sm text-indigo-900 leading-relaxed font-medium">
                    Esta funcionalidade permite que a IA analise os laudos finalizados de cada médico para aprender vocabulário específico, 
                    fraseologia preferida e padrões de conduta clínica, resultando em laudos cada vez mais personalizados.
                  </div>

                  <div className="space-y-6 pt-4">
                    <label className="block text-sm font-black text-ink-900 uppercase tracking-widest flex items-center justify-between">
                      Profundidade do Contexto (Laudos de Referência)
                      <span className="text-indigo-600 font-black text-3xl">{localSettings.aiTrainingContextSize || 3}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={localSettings.aiTrainingContextSize || 3}
                      onChange={(e) => setLocalSettings({ ...localSettings, aiTrainingContextSize: parseInt(e.target.value) })}
                      className="w-full h-4 bg-ink-50 rounded-full appearance-none cursor-pointer accent-indigo-600 border border-ink-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
