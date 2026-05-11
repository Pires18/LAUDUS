import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { PageHeader } from '../../components/PageHeader';
import { Save, BrainCircuit, Sparkles, Settings2, Zap, Shield, FileText, TestTube, CheckCircle2, AlertCircle, Loader2, Copy, ExternalLink } from 'lucide-react';
import { EXAM_AREAS, ExamArea } from '../../types';
import { EXAM_CATALOG } from '../../data/exams';
import { classNames } from '../../utils/format';

export function LaudIA() {
  const { settings, updateSettings, showToast } = useApp();
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedArea, setSelectedArea] = useState<ExamArea>(EXAM_AREAS[0].id);
  const [selectedExamArea, setSelectedExamArea] = useState<ExamArea>(EXAM_AREAS[0].id);
  const [selectedExam, setSelectedExam] = useState<string>(EXAM_CATALOG[EXAM_AREAS[0].id][0] || '');
  const [activeSection, setActiveSection] = useState<'engine' | 'area' | 'exam' | 'advanced'>('engine');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function u<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function uArea(areaId: ExamArea, text: string) {
    setDraft((d) => ({
      ...d,
      aiAreaPrompts: {
        ...(d.aiAreaPrompts || {}),
        [areaId]: text,
      },
    }));
  }

  function uExam(examName: string, text: string) {
    setDraft((d) => ({
      ...d,
      aiExamPrompts: {
        ...(d.aiExamPrompts || {}),
        [examName]: text,
      },
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(draft);
      showToast('Configurações de IA salvas', 'success');
    } catch {
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    if (!draft.geminiApiKey) {
      showToast('Insira a API Key primeiro', 'error');
      return;
    }
    setTestStatus('testing');
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(draft.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: draft.geminiModel || 'gemini-2.5-flash' });
      const result = await model.generateContent('Responda apenas: OK');
      const text = result.response.text();
      if (text) {
        setTestStatus('success');
        showToast('Conexão com Gemini validada!', 'success');
      }
    } catch (err: any) {
      setTestStatus('error');
      showToast(`Erro: ${err?.message || 'Falha na conexão'}`, 'error');
    }
  }

  const sections = [
    { id: 'engine', label: 'Prompt Mestre & Motor', icon: <BrainCircuit size={16} /> },
    { id: 'area', label: 'Prompts por Área', icon: <Settings2 size={16} /> },
    { id: 'exam', label: 'Prompts por Exame', icon: <FileText size={16} /> },
    { id: 'advanced', label: 'Configurações Avançadas', icon: <Zap size={16} /> },
  ] as const;

  const filledAreas = EXAM_AREAS.filter(a => draft.aiAreaPrompts?.[a.id]);

  return (
    <div className="max-w-5xl mx-auto py-8">
      <PageHeader
        title="LAUD.IA"
        subtitle="Motor de Inteligência Artificial para Geração de Laudos"
        actions={
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-ink-200 mt-6 mb-6 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id as typeof activeSection)}
            className={classNames(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeSection === s.id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-300'
            )}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {/* Section 1: Engine */}
        {activeSection === 'engine' && (
          <div className="space-y-6">
            {/* API Key */}
            <div className="card p-6 border-brand-200 shadow-soft">
              <div className="flex items-center gap-3 mb-6 border-b border-ink-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Credenciais do Motor</h3>
                  <p className="text-sm text-ink-500">Chave de API e seleção do modelo de linguagem</p>
                </div>
              </div>

              <div className="grid gap-6 max-w-2xl">
                <div>
                  <label className="label text-ink-800">API Key do Google Gemini</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="input font-mono text-sm flex-1"
                      value={draft.geminiApiKey || ''}
                      onChange={(e) => u('geminiApiKey', e.target.value)}
                      placeholder="AIzaSy..."
                    />
                    <button
                      type="button"
                      onClick={testConnection}
                      disabled={testStatus === 'testing'}
                      className={classNames(
                        'px-4 rounded-lg font-bold text-xs flex items-center gap-2 border transition-all',
                        testStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        testStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                      )}
                    >
                      {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> :
                       testStatus === 'success' ? <CheckCircle2 size={14} /> :
                       testStatus === 'error' ? <AlertCircle size={14} /> :
                       <TestTube size={14} />}
                      {testStatus === 'testing' ? 'Testando...' : testStatus === 'success' ? 'Conectado!' : testStatus === 'error' ? 'Falhou' : 'Testar'}
                    </button>
                  </div>
                  <p className="text-xs text-ink-500 mt-2">
                    Obtenha a sua chave no{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline font-medium inline-flex items-center gap-1">
                      Google AI Studio <ExternalLink size={10} />
                    </a>
                  </p>
                </div>

                <div>
                  <label className="label text-ink-800">Modelo de Linguagem (LLM)</label>
                  <select className="input" value={draft.geminiModel} onChange={(e) => u('geminiModel', e.target.value)}>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado — Rápido e Otimizado)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Avançado — Raciocínio Clínico Complexo)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Legado)</option>
                  </select>
                  <p className="text-xs text-ink-500 mt-2">
                    O Flash atende 95% dos casos de rotina. Use o Pro para laudos que exigem análise complexa.
                  </p>
                </div>
              </div>
            </div>

            {/* Master Prompt */}
            <div className="card p-6 border-brand-200 shadow-soft mt-6">
              <div className="flex items-center gap-3 mb-6 border-b border-ink-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Prompt Mestre</h3>
                  <p className="text-sm text-ink-500">A instrução global que guia todo o comportamento do assistente.</p>
                </div>
              </div>
              <textarea
                className="input min-h-[250px] font-mono text-sm leading-relaxed"
                placeholder="Você é um assistente médico especializado em redação de laudos ultrassonográficos..."
                value={draft.aiMasterPrompt || ''}
                onChange={(e) => u('aiMasterPrompt', e.target.value)}
              />
              <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-700">
                <strong>Dica:</strong> Se deixado em branco, o sistema usará um prompt mestre padrão otimizado. Use para ditar tom de voz global ou formato estrutural primário.
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <div className="text-2xl font-black text-brand-600">{filledAreas.length}</div>
                <div className="text-[11px] text-ink-500 font-medium">Áreas Configuradas</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-black text-brand-600">{EXAM_AREAS.length}</div>
                <div className="text-[11px] text-ink-500 font-medium">Áreas Disponíveis</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-black text-emerald-600">{draft.geminiApiKey ? '✓' : '✗'}</div>
                <div className="text-[11px] text-ink-500 font-medium">API Key</div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Behavior by Area */}
        {activeSection === 'area' && (
          <div className="card shadow-soft overflow-hidden">
            <div className="p-6 border-b border-ink-100 bg-ink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Comportamento da IA por Área</h3>
                  <p className="text-sm text-ink-500">
                    Defina regras, jargões e padrões que a IA deve obedecer em cada especialidade.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row">
              {/* Area Sidebar */}
              <div className="w-full md:w-64 border-r border-ink-100 bg-ink-50/30 p-3 flex flex-col gap-1 max-h-[500px] overflow-y-auto">
                {EXAM_AREAS.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedArea(area.id)}
                    className={classNames(
                      'text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between',
                      selectedArea === area.id
                        ? 'bg-white shadow-sm border border-ink-200 font-semibold text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100 font-medium border border-transparent'
                    )}
                  >
                    <span>{area.label}</span>
                    {draft.aiAreaPrompts?.[area.id] && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" title="Possui regras ativas" />
                    )}
                  </button>
                ))}
              </div>

              {/* Area Content */}
              <div className="flex-1 p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-ink-900 flex items-center gap-2">
                    <FileText size={16} className="text-brand-500" />
                    Regras para {EXAM_AREAS.find((a) => a.id === selectedArea)?.label}
                  </h4>
                  <p className="text-xs text-ink-500 mt-1">
                    Exemplos: "Conclua listando achados em tópicos." ou "Classifique miomas conforme FIGO." ou "Use nomenclatura CBR/SBUS."
                  </p>
                </div>

                <textarea
                  className="input min-h-[250px] font-mono text-sm leading-relaxed"
                  placeholder="Insira as instruções específicas para esta área..."
                  value={draft.aiAreaPrompts?.[selectedArea] || ''}
                  onChange={(e) => uArea(selectedArea, e.target.value)}
                />

                <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-700">
                  <strong>Dica:</strong> Essas regras são injetadas automaticamente no prompt quando um exame dessa área é gerado. Elas complementam as instruções da máscara.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Prompts by Exam */}
        {activeSection === 'exam' && (
          <div className="card shadow-soft overflow-hidden">
            <div className="p-6 border-b border-ink-100 bg-ink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Comportamento da IA por Exame</h3>
                  <p className="text-sm text-ink-500">
                    Defina regras e restrições milimétricas para exames específicos.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row">
              {/* Sidebar */}
              <div className="w-full md:w-64 border-r border-ink-100 bg-ink-50/30 p-3 flex flex-col gap-1 max-h-[500px] overflow-y-auto">
                <div className="mb-2">
                  <label className="text-xs font-semibold text-ink-500 px-2 uppercase tracking-wide">Área Médica</label>
                  <select
                    className="input text-sm mt-1 mb-3"
                    value={selectedExamArea}
                    onChange={(e) => {
                      const newArea = e.target.value as ExamArea;
                      setSelectedExamArea(newArea);
                      setSelectedExam(EXAM_CATALOG[newArea]?.[0] || '');
                    }}
                  >
                    {EXAM_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>

                <div className="text-xs font-semibold text-ink-500 px-2 uppercase tracking-wide mb-1">Exames</div>
                {(EXAM_CATALOG[selectedExamArea] || []).map((exam) => (
                  <button
                    key={exam}
                    type="button"
                    onClick={() => setSelectedExam(exam)}
                    className={classNames(
                      'text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between',
                      selectedExam === exam
                        ? 'bg-white shadow-sm border border-ink-200 font-semibold text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100 font-medium border border-transparent'
                    )}
                  >
                    <span className="truncate">{exam}</span>
                    {draft.aiExamPrompts?.[exam] && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" title="Possui regras ativas" />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 p-6">
                <div className="mb-4">
                  <h4 className="font-semibold text-ink-900 flex items-center gap-2">
                    <FileText size={16} className="text-brand-500" />
                    Regras para: {selectedExam || 'Selecione um exame'}
                  </h4>
                  <p className="text-xs text-ink-500 mt-1">
                    Exemplos: "Para este exame de Próstata, sempre inclua a tabela de peso e a classificação PI-RADS se fornecido."
                  </p>
                </div>

                <textarea
                  className="input min-h-[250px] font-mono text-sm leading-relaxed"
                  placeholder="Insira as instruções cirúrgicas para este exame específico..."
                  value={draft.aiExamPrompts?.[selectedExam] || ''}
                  onChange={(e) => uExam(selectedExam, e.target.value)}
                  disabled={!selectedExam}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Advanced */}
        {activeSection === 'advanced' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6 border-b border-ink-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-ink-900">Parâmetros de Geração</h3>
                  <p className="text-sm text-ink-500">Controle fino do comportamento do modelo de IA</p>
                </div>
              </div>

              <div className="grid gap-6 max-w-2xl">
                <div>
                  <label className="label text-ink-800">Temperatura (Criatividade)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      className="flex-1 accent-brand-600"
                      value={draft.aiTemperature ?? 0.3}
                      onChange={(e) => u('aiTemperature' as any, Number(e.target.value))}
                    />
                    <span className="text-sm font-mono font-bold text-ink-700 w-10 text-center">{draft.aiTemperature ?? 0.3}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    0.0 = Determinístico (sempre igual) | 1.0 = Criativo (mais variação). Recomendado: 0.2-0.4 para laudos.
                  </p>
                </div>

                <div>
                  <label className="label text-ink-800">Instrução Global Adicional</label>
                  <textarea
                    className="input min-h-[150px] font-mono text-sm leading-relaxed"
                    value={(draft as any).aiGlobalInstructions || ''}
                    onChange={(e) => u('aiGlobalInstructions' as any, e.target.value)}
                    placeholder="Instruções que serão aplicadas a TODOS os laudos, independente da área ou máscara..."
                  />
                  <p className="text-xs text-ink-500 mt-1">
                    Ex: "Sempre use a nomenclatura padrão CBR." ou "Não use abreviaturas sem definição prévia."
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6 shadow-soft border-amber-200">
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} className="text-amber-600" />
                <h3 className="font-semibold text-ink-900">Segurança e Privacidade</h3>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800 space-y-2">
                <p>• Os dados enviados ao Gemini são processados via API e <strong>não são armazenados pelo Google</strong> para treinamento.</p>
                <p>• A chave de API é armazenada localmente no Firestore da sua conta e <strong>nunca é compartilhada</strong>.</p>
                <p>• Recomendamos <strong>não incluir dados pessoais</strong> do paciente (nome, CPF) no formulário de achados enviado à IA.</p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
