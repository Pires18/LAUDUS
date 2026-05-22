import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { updateItem } from '../../store/db';
import { ReportTemplate, EXAM_AREAS, Clinic } from '../../types';
import { FileText, Wand2, Loader2, Save, ArrowLeft, BrainCircuit, Building2, ClipboardList, Sparkles } from 'lucide-react';
import { RichEditor } from '../editor/RichEditor';
import { generateTemplateStructure, generateTemplateField } from '../ai/generateTemplate';
import { auth } from '../../lib/firebase';
import { parseAnamnesis, serializeAnamnesis } from '../editor/components/AnamnesisConsentModal';

interface Props {
  templateId?: string;
}

export function TemplateEditor({ templateId }: Props) {
  const { setView, showToast, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'info' | 'structure' | 'copilot'>('info');
  const [draft, setDraft] = useState<ReportTemplate | null>(null);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [isGeneratingCustomForm, setIsGeneratingCustomForm] = useState(false);
  const [isGeneratingAnamnesis, setIsGeneratingAnamnesis] = useState(false);
  const [isGeneratingConsent, setIsGeneratingConsent] = useState(false);
  const [viewModeAnamnesis, setViewModeAnamnesis] = useState<'form' | 'text'>('form');

  const { data: template, loading } = useDocument<ReportTemplate>('templates', templateId);
  const { data: clinics } = useCollection<Clinic>('clinics');

  useEffect(() => {
    if (template) setDraft(template);
  }, [template]);

  useEffect(() => {
    if (draft?.anamnesisTemplate) {
      const fields = parseAnamnesis(draft.anamnesisTemplate);
      const hasStructured = fields.some(f => f.isStructured);
      setViewModeAnamnesis(hasStructured ? 'form' : 'text');
    }
  }, [draft?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-center py-12 text-ink-500">
        Máscara não encontrada.
      </div>
    );
  }

  async function handleSave() {
    if (!draft || !templateId) return;
    try {
      const { id, ...data } = draft;
      await updateItem('templates', templateId, data);
      showToast('Máscara salva', 'success');
      setView({ name: 'templates' });
    } catch {
      showToast('Erro ao salvar máscara', 'error');
    }
  }

  function u<K extends keyof ReportTemplate>(key: K, value: ReportTemplate[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  const tabs = [
    { id: 'info', label: 'Informações Básicas' },
    { id: 'structure', label: 'Estrutura do Laudo' },
    { id: 'copilot', label: 'Formulário & Fichas' },
  ] as const;

  return (
    <div className="module-container">
      <div className="max-w-6xl mx-auto w-full animate-fade-in space-y-6">
        <div className="shrink-0">
        <button
          onClick={() => setView({ name: 'templates' })}
          className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1 mb-3"
        >
          <ArrowLeft size={14} /> Voltar
        </button>

        <PageHeader
          title={draft.name}
          subtitle="Edição de Máscara"
          actions={
            <button className="btn-primary" onClick={handleSave}>
              <Save size={15} /> Salvar Máscara
            </button>
          }
        />

        <div className="flex bg-ink-50 p-1.5 rounded-2xl w-fit mt-4 overflow-x-auto border border-ink-100 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap flex-1 text-center ${
                activeTab === tab.id
                  ? 'bg-white text-brand-600 shadow-sm border border-ink-100'
                  : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-8 space-y-8">
        {activeTab === 'info' && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            <div className="card p-5 space-y-4 col-span-2">
              <div>
                <label className="label">Área *</label>
                <select
                  className="input"
                  value={draft.area}
                  onChange={(e) => {
                    const area = e.target.value as ReportTemplate['area'];
                    u('area', area);
                  }}
                >
                  {EXAM_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Exame (Nome da Máscara) *</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => u('name', e.target.value)}
                  placeholder="Ex: Abdome Total, Mama, etc."
                />
              </div>
              <div>
                <label className="label">Descrição (Opcional)</label>
                <input
                  className="input"
                  value={draft.description || ''}
                  onChange={(e) => u('description', e.target.value)}
                  placeholder="Breve descrição da utilidade desta máscara..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Building2 size={12} className="text-ink-400" />
                    Vínculo de Clínica
                  </label>
                  <select
                    className="input"
                    value={draft.clinicId || ''}
                    onChange={(e) => u('clinicId', e.target.value || undefined)}
                  >
                    {auth.currentUser?.email === 'matheuskpires@gmail.com' ? (
                      <option value="">⭐ Padrão do Sistema (Todos os Médicos)</option>
                    ) : (
                      <option value="">🌐 Todas as minhas Clínicas (Padrão)</option>
                    )}
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>🏢 {c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-ink-400 mt-1">
                    {auth.currentUser?.email === 'matheuskpires@gmail.com'
                      ? "Defina se esta máscara estará disponível globalmente no sistema como padrão oficial."
                      : "Defina se esta máscara estará disponível para todas as suas clínicas cadastradas ou restrita a uma delas."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="max-w-4xl space-y-8 pb-12">
            <div className="card p-5 border-none shadow-medium bg-gradient-to-br from-white to-ink-50/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-900 leading-tight">Geração Assistida por IA</h3>
                    <p className="text-xs text-ink-500">Crie a estrutura da máscara automaticamente</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if ((draft.title || draft.analysisTemplate) && !confirm('Isso substituirá o texto atual. Deseja continuar?')) return;
                    setIsGeneratingStructure(true);
                    try {
                      const result = await generateTemplateStructure(draft.area, draft.name, settings);
                      u('title', result.title);
                      u('technique', result.technique);
                      u('analysisTemplate', result.analysisTemplate);
                      u('conclusionTemplate', result.conclusionTemplate);
                      u('recommendationsTemplate', result.recommendationsTemplate);
                      if (result.observationsTemplate) {
                        u('observationsTemplate', result.observationsTemplate);
                      }
                      if (result.classificationTemplate) {
                        u('classificationTemplate', result.classificationTemplate);
                      }
                      showToast('Estrutura gerada!', 'success');
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro ao gerar estrutura';
                      showToast(message, 'error');
                    } finally {
                      setIsGeneratingStructure(false);
                    }
                  }}
                  className="btn bg-brand-600 text-white border-none hover:bg-brand-700 shadow-md h-10"
                >
                  {isGeneratingStructure ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Gerar Estrutura
                </button>
              </div>
            </div>

            <div className="card p-6 space-y-4 shadow-sm border border-ink-100">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-2">
                <FileText size={12} className="text-brand-500" /> Título do Laudo
              </label>
              <input
                className="input font-black text-lg text-ink-900 border-ink-200 focus:border-brand-500"
                value={draft.title}
                onChange={(e) => u('title', e.target.value)}
                placeholder="Ex: ULTRASSONOGRAFIA OBSTÉTRICA"
              />
            </div>

            <TemplateTextBlock
              label="Texto Padrão: Técnica"
              value={draft.technique}
              onChange={(val) => u('technique', val)}
              placeholder="Ex: Exame realizado com transdutor convexo de 3,5 MHz..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Análise"
              value={draft.analysisTemplate}
              onChange={(val) => u('analysisTemplate', val)}
              placeholder="Descreva a análise padrão para quando os achados forem normais..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Conclusão"
              value={draft.conclusionTemplate}
              onChange={(val) => u('conclusionTemplate', val)}
              placeholder="Ex: Exame ultrassonográfico sem alterações significativas."
            />

            <TemplateTextBlock
              label="Texto Padrão: Classificação (Opcional)"
              value={draft.classificationTemplate || ''}
              onChange={(val) => u('classificationTemplate', val)}
              placeholder="Ex: BI-RADS: (...) — Categoria (...)"
            />

            <TemplateTextBlock
              label="Texto Padrão: Observações (Opcional)"
              value={draft.observationsTemplate || ''}
              onChange={(val) => u('observationsTemplate', val)}
              placeholder="Ex: Observações e notas adicionais clínicas..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Recomendações / Notas (Opcional)"
              value={draft.recommendationsTemplate}
              onChange={(val) => u('recommendationsTemplate', val)}
              placeholder="Ex: Sugere-se correlação clínica..."
            />
          </div>
        )}


        {activeTab === 'copilot' && (
          <div className="max-w-4xl space-y-6">
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <ClipboardList size={16} className="text-brand-500" />
                  Formulário do Copiloto (Caixa de Texto)
                </h3>
                <button
                  onClick={async () => {
                    if (draft.customForm && !confirm('Isso substituirá o texto atual. Deseja continuar?')) return;
                    setIsGeneratingCustomForm(true);
                    try {
                      const result = await generateTemplateField(draft.area, draft.name, 'customForm', settings);
                      u('customForm', result);
                      showToast('Formulário gerado!', 'success');
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro ao gerar formulário';
                      showToast(message, 'error');
                    } finally {
                      setIsGeneratingCustomForm(false);
                    }
                  }}
                  disabled={isGeneratingCustomForm}
                  className="btn btn-secondary h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  {isGeneratingCustomForm ? (
                    <Loader2 size={12} className="animate-spin text-brand-600" />
                  ) : (
                    <Sparkles size={12} className="text-brand-500" />
                  )}
                  Gerar com LAUD.IA
                </button>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Defina a estrutura padrão de texto que o médico preencherá na aba "Formulário" do Copiloto para este exame.
              </p>
              <textarea
                className="input min-h-[180px] font-mono text-xs p-4 bg-slate-50 border border-slate-200 focus:bg-white transition-all rounded-xl"
                value={draft.customForm || ''}
                onChange={(e) => u('customForm', e.target.value)}
                placeholder={"Ex:\nFígado: [Aspecto habitual]\nRins: [Normais, sem dilatação]\nBexiga: [Cheia, com paredes finas]"}
              />
            </div>

            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <FileText size={16} className="text-brand-500" />
                    Anamnese Padrão do Exame
                  </h3>
                  
                  {(() => {
                    const fields = parseAnamnesis(draft.anamnesisTemplate || '');
                    const hasStructured = fields.some(f => f.isStructured);
                    if (!hasStructured) return null;
                    return (
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setViewModeAnamnesis('form')}
                          className={`px-2 py-1 font-bold rounded-md transition-all ${
                            viewModeAnamnesis === 'form'
                              ? 'bg-white text-brand-650 shadow-sm border border-slate-200/50'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Formulário
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewModeAnamnesis('text')}
                          className={`px-2 py-1 font-bold rounded-md transition-all ${
                            viewModeAnamnesis === 'text'
                              ? 'bg-white text-brand-650 shadow-sm border border-slate-200/50'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Texto Livre
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (draft.anamnesisTemplate && !confirm('Isso substituirá o texto atual. Deseja continuar?')) return;
                    setIsGeneratingAnamnesis(true);
                    try {
                      const result = await generateTemplateField(draft.area, draft.name, 'anamnesis', settings);
                      u('anamnesisTemplate', result);
                      showToast('Anamnese gerada!', 'success');
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro ao gerar anamnese';
                      showToast(message, 'error');
                    } finally {
                      setIsGeneratingAnamnesis(false);
                    }
                  }}
                  disabled={isGeneratingAnamnesis}
                  className="btn btn-secondary h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  {isGeneratingAnamnesis ? (
                    <Loader2 size={12} className="animate-spin text-brand-600" />
                  ) : (
                    <Sparkles size={12} className="text-brand-500" />
                  )}
                  Gerar com LAUD.IA
                </button>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Texto padrão de anamnese que será associado ao exame e ficará disponível para preenchimento ou consulta.
              </p>

              {(() => {
                const fields = parseAnamnesis(draft.anamnesisTemplate || '');
                const hasStructured = fields.some(f => f.isStructured);
                
                if (viewModeAnamnesis === 'form' && hasStructured) {
                  const unstructuredLines = fields.filter(f => !f.isStructured).map(f => f.value).join('\n').trim();
                  
                  const handleFieldChange = (idx: number, newVal: string) => {
                    const updated = [...fields];
                    updated[idx].value = newVal;
                    u('anamnesisTemplate', serializeAnamnesis(updated));
                  };
                  
                  const handleUnstructuredChange = (newUnstructured: string) => {
                    const structuredPart = fields
                      .filter(f => f.isStructured)
                      .map(f => `${f.label}: [${f.value}]`)
                      .join('\n');
                    const newText = structuredPart ? structuredPart + '\n' + newUnstructured : newUnstructured;
                    u('anamnesisTemplate', newText);
                  };

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        {fields.map((field, idx) => {
                          if (!field.isStructured) return null;
                          return (
                            <div key={idx} className="flex flex-col space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                {field.label}
                              </label>
                              <input
                                type="text"
                                value={field.value}
                                onChange={(e) => handleFieldChange(idx, e.target.value)}
                                className="h-10 px-3 bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none transition-all text-slate-850 shadow-sm"
                                placeholder={`Definir valor padrão para ${field.label.toLowerCase()}...`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Observações Adicionais / Texto Fixo
                        </label>
                        <textarea
                          value={unstructuredLines}
                          onChange={(e) => handleUnstructuredChange(e.target.value)}
                          placeholder="Anotações adicionais da anamnese..."
                          className="w-full min-h-[80px] p-4 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl outline-none transition-all text-xs font-semibold leading-relaxed resize-none text-slate-850"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <textarea
                    className="input min-h-[120px] text-xs p-4 bg-slate-50 border border-slate-200 focus:bg-white transition-all rounded-xl font-semibold text-slate-850 leading-relaxed"
                    value={draft.anamnesisTemplate || ''}
                    onChange={(e) => u('anamnesisTemplate', e.target.value)}
                    placeholder="Ex: Paciente refere dor abdominal no quadrante superior direito há 3 dias. Nega cirurgias prévias."
                  />
                );
              })()}
            </div>

            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <FileText size={16} className="text-indigo-500" />
                  Termo de Consentimento Padrão
                </h3>
                <button
                  onClick={async () => {
                    if (draft.consentTemplate && !confirm('Isso substituirá o texto atual. Deseja continuar?')) return;
                    setIsGeneratingConsent(true);
                    try {
                      const result = await generateTemplateField(draft.area, draft.name, 'consent', settings);
                      u('consentTemplate', result);
                      showToast('Termo de consentimento gerado!', 'success');
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Erro ao gerar termo';
                      showToast(message, 'error');
                    } finally {
                      setIsGeneratingConsent(false);
                    }
                  }}
                  disabled={isGeneratingConsent}
                  className="btn btn-secondary h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  {isGeneratingConsent ? (
                    <Loader2 size={12} className="animate-spin text-brand-600" />
                  ) : (
                    <Sparkles size={12} className="text-brand-500" />
                  )}
                  Gerar com LAUD.IA
                </button>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Termo de consentimento informado para este exame específico.
              </p>
              <textarea
                className="input min-h-[180px] text-xs p-4 bg-slate-50 border border-slate-200 focus:bg-white transition-all rounded-xl"
                value={draft.consentTemplate || ''}
                onChange={(e) => u('consentTemplate', e.target.value)}
                placeholder="Ex: Eu, [Nome do Paciente], autorizo a realização do exame..."
              />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function TemplateTextBlock({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-2">
        <FileText size={12} className="text-brand-500" /> {label}
      </label>
      <div className="min-h-[200px]">
        <RichEditor
          content={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
