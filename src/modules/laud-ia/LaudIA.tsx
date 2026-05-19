import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { PageHeader } from '../../components/PageHeader';
import { 
  BrainCircuit, ShieldAlert, 
  Settings2, Save, RotateCcw, Zap,
  GraduationCap, CheckCircle2, AlertCircle, Loader2,
  Sliders, LayoutList, FileText, Layout, ShieldCheck
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { EXAM_AREAS, ExamArea, AppSettings } from '../../types';
import { 
  DEFAULT_MASTER_PROMPT, 
  DEFAULT_STRUCTURE_PROMPT, 
  AREA_SPECIFIC_PROMPTS,
} from '../ai/prompts';

type TabId = 'prompts' | 'areas' | 'engine' | 'training';

export function LaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<TabId>('prompts');
  const [selectedArea, setSelectedArea] = useState<ExamArea>(EXAM_AREAS[0].id);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [adminSettings, setAdminSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    import('../../store/db').then(({ getAdminSettings }) => {
      getAdminSettings().then(admin => {
        setAdminSettings(admin);
      });
    });
  }, []);

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
      const model = genAI.getGenerativeModel({ model: localSettings.geminiModel || 'gemini-2.5-flash' });
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

  const sidebarItems = [
    { id: 'prompts', label: 'Doutrina & Prompts', icon: ShieldAlert },
    { id: 'areas', label: 'Especialidades', icon: LayoutList },
    { id: 'engine', label: 'Motor & API', icon: Sliders },
    { id: 'training', label: 'Aprendizado IA', icon: GraduationCap },
  ] as const;

  return (
    <div className="module-container">
      <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Configurações LAUD.IA" 
        subtitle="Gerencie o comportamento e a inteligência do sistema de laudos."
        icon={BrainCircuit}
        actions={
          <div className="flex items-center gap-3">
            <button onClick={() => setLocalSettings(settings)} className="btn-ghost text-ink-400">
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
                "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
                activeTab === item.id 
                  ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100" 
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <div className={classNames("p-1.5 rounded-lg", activeTab === item.id ? "bg-brand-100 text-brand-600" : "bg-ink-50 text-ink-400")}>
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
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-2",
                  activeTab === item.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-600 border-ink-100"
                )}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </div>

          {/* TAB: PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="space-y-8 animate-fade-in">
              {/* Top Doctrine Context Information */}
              <div className="p-5 bg-gradient-to-r from-brand-50 to-indigo-50/50 border border-brand-100/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest block">Sincronização de Doutrinas</span>
                  <p className="text-[11px] text-slate-600 font-bold leading-relaxed max-w-2xl">
                    Por padrão, você herda os prompts oficiais publicados pelo Administrador. Você pode personalizar qualquer diretriz a qualquer momento. Para voltar a seguir o administrador, basta clicar no botão de restauração.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Admin Sync Ativo
                  </div>
                </div>
              </div>

              {/* Master Prompt */}
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                      <BrainCircuit size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-ink-900">Prompt Mestre</h4>
                        {(!localSettings.aiMasterPrompt || localSettings.aiMasterPrompt.trim() === (adminSettings?.aiMasterPrompt || DEFAULT_MASTER_PROMPT).trim()) ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider border border-emerald-100/60 flex items-center gap-1">
                            <CheckCircle2 size={9} className="text-emerald-500" /> Herdado do Admin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-wider border border-indigo-100/60 flex items-center gap-1 animate-pulse">
                            <Zap size={9} className="text-indigo-500 fill-indigo-500/10" /> Customizado por Você
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-500 uppercase font-bold tracking-widest mt-0.5">Base de Personalidade da IA</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setLocalSettings({...localSettings, aiMasterPrompt: adminSettings?.aiMasterPrompt || DEFAULT_MASTER_PROMPT});
                      showToast('Prompt Mestre sincronizado com o Administrador', 'info');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-brand-100 uppercase tracking-widest active:scale-95 shadow-sm bg-white"
                    title="Restaurar para a diretriz do Administrador"
                  >
                    <RotateCcw size={12} />
                    Restaurar do Admin
                  </button>
                </div>
                <div className="p-6">
                  <textarea
                    value={localSettings.aiMasterPrompt}
                    onChange={(e) => setLocalSettings({ ...localSettings, aiMasterPrompt: e.target.value })}
                    rows={12}
                    className="w-full rounded-2xl border-ink-200 font-mono text-sm focus:ring-brand-500 focus:border-brand-500 bg-ink-900 text-brand-50 p-6 leading-relaxed shadow-inner"
                    placeholder="Defina o papel principal da IA..."
                  />
                </div>
              </div>


              {/* Structure Prompt */}
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-ink-400 flex items-center gap-2">
                        <Layout size={14} className="text-indigo-500" /> Estrutura Obrigatória (Skeleton)
                      </h4>
                      {(!localSettings.aiStructurePrompt || localSettings.aiStructurePrompt.trim() === (adminSettings?.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT).trim()) ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[7px] font-black uppercase tracking-wider border border-emerald-100/50">
                          Herdado
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[7px] font-black uppercase tracking-wider border border-indigo-100/50">
                          Customizado
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setLocalSettings({...localSettings, aiStructurePrompt: adminSettings?.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT});
                      showToast('Estrutura de Laudo sincronizada com o Administrador', 'info');
                    }} 
                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-100/60 bg-white"
                    title="Sincronizar com Administrador"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
                <textarea
                  value={localSettings.aiStructurePrompt}
                  onChange={(e) => setLocalSettings({ ...localSettings, aiStructurePrompt: e.target.value })}
                  rows={8}
                  className="w-full border-none focus:ring-0 font-mono text-xs p-6 bg-ink-50/30 rounded-b-3xl focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB: AREAS */}
          {activeTab === 'areas' && (
            <div className="flex flex-col lg:flex-row bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden min-h-[600px] animate-fade-in">
              <div className="w-full lg:w-72 bg-ink-50/50 border-r border-ink-100 p-4 space-y-1">
                <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Áreas Médicas</p>
                {EXAM_AREAS.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => setSelectedArea(area.id)}
                    className={classNames(
                      "w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                      selectedArea === area.id 
                        ? "bg-brand-600 text-white shadow-md" 
                        : "text-ink-600 hover:bg-ink-100"
                    )}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 p-8 space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-black text-ink-900">Protocolos: {EXAM_AREAS.find(a => a.id === selectedArea)?.label}</h4>
                      {(!localSettings.aiAreaPrompts?.[selectedArea] || localSettings.aiAreaPrompts?.[selectedArea]?.trim() === (adminSettings?.aiAreaPrompts?.[selectedArea] || AREA_SPECIFIC_PROMPTS[selectedArea]).trim()) ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-wider border border-emerald-100/60 flex items-center gap-1">
                          <CheckCircle2 size={9} className="text-emerald-500" /> Herdado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-wider border border-indigo-100/60 flex items-center gap-1">
                          <Zap size={9} className="text-indigo-500 fill-indigo-500/10" /> Customizado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-500">Diretrizes específicas para análise e conclusão desta área.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: adminSettings?.aiAreaPrompts?.[selectedArea] || AREA_SPECIFIC_PROMPTS[selectedArea] };
                      setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                      showToast(`Protocolo de ${selectedArea} restaurado para o padrão do administrador`, 'info');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black text-brand-600 hover:bg-brand-50 rounded-xl transition-all border border-brand-100 uppercase tracking-widest active:scale-95 shadow-sm bg-white"
                  >
                    <RotateCcw size={12} />
                    Sincronizar Admin
                  </button>
                </div>
                <textarea
                  value={localSettings.aiAreaPrompts?.[selectedArea] || ''}
                  onChange={(e) => {
                    const updated = { ...localSettings.aiAreaPrompts, [selectedArea]: e.target.value };
                    setLocalSettings({ ...localSettings, aiAreaPrompts: updated });
                  }}
                  rows={18}
                  className="w-full rounded-2xl border-ink-100 font-mono text-sm p-6 bg-ink-50/30 focus:ring-brand-500 focus:border-brand-500 leading-relaxed shadow-inner"
                  placeholder={`Instruções clínicas para ${selectedArea}...`}
                />
              </div>
            </div>
          )}

          {/* TAB: ENGINE */}
          {activeTab === 'engine' && (
            <div className="max-w-3xl space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-3">
                  <Sliders size={24} className="text-brand-600" /> Configurações do Motor
                </h4>
                
                <div className="space-y-8">
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
                      <button
                        onClick={testConnection}
                        disabled={testStatus === 'testing'}
                        className={classNames(
                          "w-14 h-14 flex items-center justify-center rounded-xl transition-all border",
                          testStatus === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          testStatus === 'error' ? "bg-red-50 text-red-600 border-red-200" :
                          "bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100"
                        )}
                      >
                         {testStatus === 'testing' ? <Loader2 size={20} className="animate-spin" /> :
                          testStatus === 'success' ? <CheckCircle2 size={20} /> :
                          testStatus === 'error' ? <AlertCircle size={20} /> : <Zap size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label text-ink-600 uppercase tracking-widest text-[10px] mb-2">Modelo Principal</label>
                    <select 
                      value={localSettings.geminiModel} 
                      onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                      className="input h-14"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Última Geração - Recomendado)</option>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>

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
                      onChange={(e) => setLocalSettings({ ...localSettings, aiTemperature: parseFloat(e.target.value) })}
                      className="w-full h-3 bg-ink-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                     />
                     <div className="flex justify-between text-[10px] text-ink-400 font-bold uppercase mt-3 tracking-widest">
                      <span>Literal / Preciso</span>
                      <span>Criativo / Fluído</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRAINING */}
          {activeTab === 'training' && (
            <div className="max-w-3xl space-y-6 animate-fade-in">
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
                    onClick={() => setLocalSettings({ ...localSettings, aiTrainingEnabled: !localSettings.aiTrainingEnabled })}
                    className={classNames(
                      "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      localSettings.aiTrainingEnabled ? 'bg-indigo-600' : 'bg-ink-200'
                    )}
                  >
                    <span className={classNames(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      localSettings.aiTrainingEnabled ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>

                <div className={classNames("space-y-8 transition-opacity duration-300", !localSettings.aiTrainingEnabled && "opacity-40 pointer-events-none")}>
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm text-indigo-900 leading-relaxed">
                    <strong>Como funciona:</strong> Ao habilitar esta função, o LAUD.IA enviará seus últimos exames finalizados da mesma especialidade como contexto. Isso garante que a IA utilize o seu vocabulário, estilo de pontuação e estrutura preferida.
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
                    <p className="text-xs text-ink-400 italic">Recomendado: 3 a 5 exames para o melhor equilíbrio entre fidelidade e velocidade.</p>
                  </div>
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
