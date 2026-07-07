import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { useAdmin } from '../../hooks/useAdmin';
import { PageHeader } from '../../components/PageHeader';
import { updateItem, addItemWithId, genId } from '../../store/db';
import { ReportTemplate, EXAM_AREAS, Clinic } from '../../types';
import { FileText, Loader2, Save, ArrowLeft, BrainCircuit, Building2, ClipboardList, Copy } from 'lucide-react';
import { RichEditor } from '../editor/RichEditor';
import { StructuredPreview } from '../editor/components/StructuredPreview';
import { classNames } from '../../utils/format';
import { auth } from '../../lib/firebase';

interface Props {
  templateId?: string;
}

export function TemplateEditor({ templateId }: Props) {
  const { isAdmin } = useAdmin();
  const { setView, showToast, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'info' | 'structure' | 'copilot' | 'structured' | 'prompt'>('info');
  const [draft, setDraft] = useState<ReportTemplate | null>(null);

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
    // Máscaras do sistema (sem clinicId) são visíveis a TODOS os médicos —
    // salvar com campos essenciais vazios quebra o laudo pra todo mundo que
    // usa essa máscara, sem nenhum aviso até a próxima geração.
    if (!draft.name?.trim()) { showToast('Nome da máscara é obrigatório.', 'error'); return; }
    if (!draft.analysisTemplate?.trim()) { showToast('O template de Análise não pode ficar vazio.', 'error'); return; }
    if (!draft.conclusionTemplate?.trim()) { showToast('O template de Conclusão não pode ficar vazio.', 'error'); return; }
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

  // Máscara vinculada/padrão vista por não-admin: somente leitura. Permite criar
  // uma cópia pessoal e editável a partir dela.
  async function handlePersonalize() {
    if (!draft) return;
    const id = genId();
    const { id: _id, createdAt, updatedAt, isSystem, ...rest } = draft as ReportTemplate & { isSystem?: boolean };
    try {
      await addItemWithId('templates', id, {
        ...rest,
        name: `${draft.name} (Personalizada)`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      showToast('Cópia criada! Agora você pode editá-la.', 'success');
      setView({ name: 'template-editor', templateId: id });
    } catch {
      showToast('Erro ao criar cópia da máscara', 'error');
    }
  }

  const tabs = ([
    { id: 'info', label: 'Informações Básicas' },
    { id: 'structure', label: 'Estrutura do Laudo' },
    { id: 'copilot', label: 'Formulário & Fichas' },
    { id: 'structured', label: 'Estruturado' },
    { id: 'prompt', label: 'Prompt LAUD.IA' },
  ] as const).filter(t => isAdmin || t.id !== 'prompt');

  return (
    <div className="module-container">
      <div className="max-w-6xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setView({ name: 'templates' })}
                className="w-8 h-8 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-500 hover:text-ink-700 flex items-center justify-center transition-all shrink-0 active:scale-95"
                title="Voltar"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">{draft.name}</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">
                  {isAdmin ? 'Edição de Máscara' : 'Visualização de Máscara (Apenas Leitura)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin ? (
                <button
                  onClick={handleSave}
                  className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Save size={11} />
                  Salvar Máscara
                </button>
              ) : (
                <button
                  onClick={handlePersonalize}
                  className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                  title="Criar uma cópia pessoal e editável desta máscara"
                >
                  <Copy size={11} />
                  Criar cópia para editar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── PILL TAB BAR ─── */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

      <div className="pb-8 space-y-8">
        {activeTab === 'info' && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4 col-span-2">
              <div>
                <label className="label">Área *</label>
                <select
                  className="input"
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
                  value={draft.name}
                  onChange={(e) => u('name', e.target.value)}
                  placeholder="Ex: Abdome Total, Mama, etc."
                />
              </div>
              <div>
                <label className="label">Descrição (Opcional)</label>
                <input
                  className="input"
                  disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
          <div className="max-w-4xl space-y-6 pb-12">

            <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-2">
                <FileText size={12} className="text-brand-500" /> Título do Laudo
              </label>
              <input
                className="input font-black text-lg text-ink-900 border-ink-200 focus:border-brand-500"
                disabled={!isAdmin}
                value={draft.title}
                onChange={(e) => u('title', e.target.value)}
                placeholder="Ex: ULTRASSONOGRAFIA OBSTÉTRICA"
              />
            </div>

            <TemplateTextBlock
              label="Texto Padrão: Técnica"
              value={draft.technique}
              onChange={(val) => u('technique', val)}
              editable={isAdmin}
              placeholder="Ex: Exame realizado com transdutor convexo de 3,5 MHz..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Análise"
              value={draft.analysisTemplate}
              onChange={(val) => u('analysisTemplate', val)}
              editable={isAdmin}
              placeholder="Descreva a análise padrão para quando os achados forem normais..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Conclusão"
              value={draft.conclusionTemplate}
              onChange={(val) => u('conclusionTemplate', val)}
              editable={isAdmin}
              placeholder="Ex: Exame ultrassonográfico sem alterações significativas."
            />

            <TemplateTextBlock
              label="Texto Padrão: Classificação (Opcional)"
              value={draft.classificationTemplate || ''}
              onChange={(val) => u('classificationTemplate', val)}
              editable={isAdmin}
              placeholder="Ex: BI-RADS: (...) — Categoria (...)"
            />

            <TemplateTextBlock
              label="Texto Padrão: Observações Metodológicas (Opcional — Gerado automaticamente pela IA se em branco)"
              value={draft.observationsTemplate || ''}
              onChange={(val) => u('observationsTemplate', val)}
              editable={isAdmin}
              placeholder="Ex: Observações metodológicas e notas adicionais de limitação clínica..."
            />

            <TemplateTextBlock
              label="Texto Padrão: Recomendações / Notas (Opcional)"
              value={draft.recommendationsTemplate}
              onChange={(val) => u('recommendationsTemplate', val)}
              editable={isAdmin}
              placeholder="Ex: Sugere-se correlação clínica..."
            />

          </div>
        )}


        {activeTab === 'copilot' && (
          <div className="max-w-4xl space-y-5">
            <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <ClipboardList size={16} className="text-brand-500" />
                  Formulário do Copiloto (Caixa de Texto)
                </h3>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Defina a estrutura padrão de texto que o médico preencherá na aba "Formulário" do Copiloto para este exame.
              </p>
              <textarea
                className="input min-h-[180px] font-mono text-xs p-4 bg-ink-50 border border-ink-200 focus:bg-white transition-all rounded-xl"
                disabled={!isAdmin}
                value={draft.customForm || ''}
                onChange={(e) => u('customForm', e.target.value)}
                placeholder={"Ex:\nFígado: [Aspecto habitual]\nRins: [Normais, sem dilatação]\nBexiga: [Cheia, com paredes finas]"}
              />
            </div>

            <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <FileText size={16} className="text-indigo-500" />
                  Termo de Consentimento Padrão
                </h3>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Termo de consentimento informado para este exame específico.
              </p>
              <textarea
                className="input min-h-[180px] text-xs p-4 bg-ink-50 border border-ink-200 focus:bg-white transition-all rounded-xl"
                disabled={!isAdmin}
                value={draft.consentTemplate || ''}
                onChange={(e) => u('consentTemplate', e.target.value)}
                placeholder="Ex: Eu, [Nome do Paciente], autorizo a realização do exame..."
              />
            </div>
          </div>
        )}

        {activeTab === 'structured' && (
          <div className="max-w-4xl space-y-4">
            <div className="bg-white rounded-2xl border border-ink-100 p-5 shadow-sm">
              <h3 className="font-bold text-ink-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                <ClipboardList size={16} className="text-brand-500" />
                Formulário Estruturado
              </h3>
              <p className="text-xs text-ink-500 leading-relaxed mt-2">
                Campos tipados derivados desta máscara ({EXAM_AREAS.find(a => a.id === draft.area)?.label || draft.area}),
                com escores e cálculos clínicos em tempo real. É o que o médico preenche na aba "Estruturado" do Copiloto de cada exame.
                Esta é uma pré-visualização interativa — os valores aqui não são salvos.
              </p>
            </div>
            <StructuredPreview template={draft} />
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="max-w-4xl space-y-5 pb-12">
            <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-sm uppercase tracking-widest leading-tight">Prompt Específico do Exame</h3>
                  <p className="text-[10px] text-ink-400 font-medium mt-0.5">Diretrizes clínicas exclusivas para este tipo de exame</p>
                </div>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Insira as diretrizes, protocolos, tabelas e regras específicas que o motor de IA deve seguir estritamente ao laudar ou refinar este exame. Este campo é injetado no contexto da IA a cada geração e refinamento.
              </p>
              <textarea
                className="input min-h-[320px] font-mono text-xs p-4 bg-ink-50 border border-ink-200 focus:bg-white transition-all rounded-xl leading-relaxed"
                value={draft.aiInstructions || ''}
                onChange={(e) => u('aiInstructions', e.target.value)}
                placeholder={`Ex: Para a realização deste laudo, siga estritamente:\n\n• Classificação BI-RADS (ACR 5ª edição):\n  - Categoria 0: avaliação incompleta\n  - Categoria 1: normal\n  - Categoria 2: achado benigno\n  ...\n\n• Fraseologia obrigatória para nódulos:\n  Descrever: localização, tamanho, forma, margem, ecogenicidade, sombra acústica, vascularização ao Doppler.`}
              />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function TemplateTextBlock({ label, value, onChange, editable = true, placeholder }: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  editable?: boolean;
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
          editable={editable}
        />
      </div>
    </div>
  );
}
