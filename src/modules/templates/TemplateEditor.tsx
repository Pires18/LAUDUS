import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { updateItem } from '../../store/db';
import { ReportTemplate, EXAM_AREAS, Clinic } from '../../types';
import { FileText, Wand2, Loader2, Save, ArrowLeft, BrainCircuit, Building2 } from 'lucide-react';
import { RichEditor } from '../editor/RichEditor';
import { generateTemplateStructure } from '../ai/generateTemplate';

interface Props {
  templateId?: string;
}

export function TemplateEditor({ templateId }: Props) {
  const { setView, showToast, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'info' | 'structure' | 'ai'>('info');
  const [draft, setDraft] = useState<ReportTemplate | null>(null);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);

  const { data: template, loading } = useDocument<ReportTemplate>('templates', templateId);
  const { data: clinics } = useCollection<Clinic>('clinics');

  useEffect(() => {
    if (template) setDraft(template);
  }, [template]);

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
    { id: 'ai', label: 'Configuração de IA' },
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
                    Clínica Específica
                  </label>
                  <select
                    className="input"
                    value={draft.clinicId || ''}
                    onChange={(e) => u('clinicId', e.target.value || undefined)}
                  >
                    <option value="">Global (Disponível para todas)</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-ink-400 mt-1">
                    Selecione uma clínica se esta máscara for exclusiva dela.
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
              label="Texto Padrão: Recomendações / Notas (Opcional)"
              value={draft.recommendationsTemplate}
              onChange={(val) => u('recommendationsTemplate', val)}
              placeholder="Ex: Sugere-se correlação clínica..."
            />
          </div>
        )}


        {activeTab === 'ai' && (
          <div className="max-w-4xl space-y-4">
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-2">Instruções Customizadas para IA</h3>
              <p className="text-sm text-ink-500 mb-4">
                Adicione instruções específicas que a IA ({settings.geminiModel}) deve seguir apenas para esta máscara.
                Isso sobrescreve ou complementa as instruções globais.
              </p>
              <textarea
                className="input min-h-[200px] font-mono text-sm"
                value={draft.aiInstructions || ''}
                onChange={(e) => u('aiInstructions', e.target.value)}
                placeholder="Ex: Não mencione ovários se eles não forem visualizados. Use sempre termos técnicos específicos da área fetal..."
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
