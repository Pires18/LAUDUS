import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { updateItem } from '../../store/db';
import { ReportTemplate, EXAM_AREAS, FormField, Clinic } from '../../types';
import { EXAM_CATALOG } from '../../data/exams';
import { ArrowLeft, Save, Copy, Loader2, Building2, FileText, Wand2 } from 'lucide-react';
import { FieldBuilder } from './FieldBuilder';
import { generateFormFieldsFromTemplate } from '../ai/generateFormFields';

interface Props {
  templateId?: string;
}

export function TemplateEditor({ templateId }: Props) {
  const { setView, showToast, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'info' | 'structure' | 'fields' | 'ai'>('info');
  const [draft, setDraft] = useState<ReportTemplate | null>(null);
  const [isGeneratingFields, setIsGeneratingFields] = useState(false);

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
      await updateItem('templates', templateId, draft as any);
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
    { id: 'fields', label: 'Campos do Formulário', badge: draft.formFields.length },
    { id: 'ai', label: 'Configuração de IA' },
  ] as const;

  return (
    <div className="flex flex-col h-full max-h-[100vh]">
      <div className="shrink-0 mb-4">
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

        <div className="flex border-b border-ink-200 mt-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-300'
              }`}
            >
              {tab.label}
              {'badge' in tab && tab.badge !== undefined && (
                <span className="ml-2 bg-ink-100 text-ink-600 py-0.5 px-2 rounded-full text-[10px]">
                  {(tab as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
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
                    u('name', EXAM_CATALOG[area]?.[0] || '');
                  }}
                >
                  {EXAM_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Exame (Nome da Máscara) *</label>
                <select
                  className="input"
                  value={draft.name}
                  onChange={(e) => u('name', e.target.value)}
                >
                  {(EXAM_CATALOG[draft.area] || []).map(exam => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
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
          <div className="space-y-6 max-w-4xl">
            <div className="bg-brand-50 border border-brand-200 p-4 rounded-xl text-sm text-brand-800">
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Copy size={16} /> Como funciona a Estrutura?
              </h4>
              <p>
                A IA usará esta estrutura como base para organizar o laudo final. Escreva os blocos de texto
                padrão em texto simples. A formatação (negrito, itálico, etc.) será aplicada automaticamente
                no editor de laudos após a geração pela IA.
              </p>
            </div>

            <div className="card p-5">
              <label className="label">Título do Laudo</label>
              <input
                className="input font-semibold"
                value={draft.title}
                onChange={(e) => u('title', e.target.value)}
                placeholder="Ex: ULTRASSONOGRAFIA OBSTÉTRICA"
              />
            </div>

            <TemplateTextBlock
              label="Texto Padrão: Técnica"
              value={draft.technique}
              onChange={(val) => u('technique', val)}
              rows={6}
              placeholder="Ex: Exame realizado com transdutor convexo de 3,5 MHz..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Análise"
              value={draft.analysisTemplate}
              onChange={(val) => u('analysisTemplate', val)}
              rows={12}
              placeholder="Descreva a análise padrão para quando os achados forem normais..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Conclusão"
              value={draft.conclusionTemplate}
              onChange={(val) => u('conclusionTemplate', val)}
              rows={6}
              placeholder="Ex: Exame ultrassonográfico sem alterações significativas."
            />

            <TemplateTextBlock
              label="Texto Padrão: Recomendações / Notas (Opcional)"
              value={draft.recommendationsTemplate}
              onChange={(val) => u('recommendationsTemplate', val)}
              rows={6}
              placeholder="Ex: Sugere-se correlação clínica..."
            />
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Campos do Formulário</h3>
                <p className="text-xs text-ink-500 mt-0.5">Defina os campos que o médico preencherá durante o exame.</p>
              </div>
              <button
                type="button"
                disabled={isGeneratingFields}
                onClick={async () => {
                  if (!draft) return;
                  if (draft.formFields.length > 0 && !confirm('Isso substituirá os campos atuais. Deseja continuar?')) return;
                  setIsGeneratingFields(true);
                  try {
                    const fields = await generateFormFieldsFromTemplate(draft, settings);
                    u('formFields', fields);
                    showToast(`${fields.length} campos gerados automaticamente pela IA!`, 'success');
                  } catch (err: any) {
                    console.error(err);
                    showToast(err?.message || 'Erro ao gerar campos', 'error');
                  } finally {
                    setIsGeneratingFields(false);
                  }
                }}
                className="btn bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-md"
              >
                {isGeneratingFields ? (
                  <><Loader2 size={15} className="animate-spin" /> Gerando com IA...</>
                ) : (
                  <><Wand2 size={15} /> Gerar Formulário com IA</>
                )}
              </button>
            </div>
            <FieldBuilder
              fields={draft.formFields}
              onChange={(fields: FormField[]) => u('formFields', fields)}
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
  );
}

function TemplateTextBlock({ label, value, onChange, rows = 6, placeholder }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  // Strip HTML tags for display if content was previously saved as rich text
  function stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const textValue = value?.startsWith('<') ? stripHtml(value) : (value || '');

  return (
    <div className="card p-5">
      <label className="label text-brand-600 mb-2 flex items-center gap-2">
        <FileText size={14} /> {label}
      </label>
      <textarea
        className="input font-mono text-sm leading-relaxed w-full"
        rows={rows}
        value={textValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
