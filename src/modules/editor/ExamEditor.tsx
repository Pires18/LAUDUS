import { useEffect, useState, useCallback, useRef } from 'react';
import { useDocument } from '../../hooks/useFirestore';
import { updateItem, getItem } from '../../store/db';
import { useApp } from '../../store/app';
import { ExamStatus, EXAM_AREAS, Patient, ReportTemplate, Clinic } from '../../types';
import { DynamicForm } from '../forms/DynamicForm';
import { RichEditor, RichEditorRef } from './RichEditor';
import { SnippetLibrary } from './SnippetLibrary';
import { generateReport, generateMockReport, buildPrompt, generateReportStream } from '../ai/gemini';
import { copyReportToClipboard } from '../export/docxExport';
import { deleteField } from 'firebase/firestore';
import {
  ArrowLeft, Sparkles, Download, Copy, CheckCircle2, Loader2,
  AlertCircle, Cloud, PanelLeftClose, PanelLeftOpen, Building2, ExternalLink, Eye, X, MessageSquareText, Printer
} from 'lucide-react';
import { calculateAge, formatDate, classNames } from '../../utils/format';
import { copyFile, deleteFile } from '../../lib/googleDrive';
import { replaceTextInDoc } from '../../lib/googleDocs';
import { PrintLayout } from '../export/PrintLayout';

interface Props {
  examId: string;
}

type SaveState = 'idle' | 'saving' | 'saved';

export function ExamEditor({ examId }: Props) {
  const { setView, settings, showToast } = useApp();

  // Firestore realtime listeners
  const { data: exam } = useDocument<import('../../types').ExamRequest>('exams', examId);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);

  // Load related data when exam changes
  useEffect(() => {
    if (!exam) return;
    getItem<Patient>('patients', exam.patientId).then((p) => setPatient(p));
    if (exam.templateId) {
      getItem<ReportTemplate>('templates', exam.templateId).then((t) => setTemplate(t));
    }
    if (exam.clinicId) {
      getItem<Clinic>('clinics', exam.clinicId).then((c) => setClinic(c));
    }
  }, [exam?.patientId, exam?.templateId, exam?.clinicId]);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [reportContent, setReportContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFormPanel, setShowFormPanel] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [initialized, setInitialized] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');

  const editorRef = useRef<RichEditorRef>(null);
  const formDataRef = useRef(formData);
  const reportContentRef = useRef(reportContent);
  formDataRef.current = formData;
  reportContentRef.current = reportContent;

  useEffect(() => {
    if (exam && !initialized) {
      setFormData((exam.formData as Record<string, unknown>) || {});
      setReportContent(exam.reportContent || '');
      setInitialized(true);
    }
  }, [exam?.id, initialized]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (newFormData: Record<string, unknown>, newReportContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState('saving');
      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateItem('exams', examId, {
            formData: newFormData,
            reportContent: newReportContent,
          });
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        } catch {
          showToast('Erro ao salvar automaticamente', 'error');
          setSaveState('idle');
        }
      }, 800);
    },
    [examId, showToast]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyboard(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      // Ctrl+G → Generate with AI
      if (isMod && e.key === 'g') {
        e.preventDefault();
        handleGenerate();
      }
      // Ctrl+Shift+C → Copy report
      if (isMod && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleCopy();
      }
    }
    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);

  function handleFormChange(fieldId: string, value: unknown) {
    const next = { ...formDataRef.current, [fieldId]: value };
    setFormData(next);
    debouncedSave(next, reportContentRef.current);
  }

  function handleReportChange(html: string) {
    setReportContent(html);
    debouncedSave(formDataRef.current, html);
  }

  async function handleStatusChange(status: ExamStatus) {
    if (status === 'finalizado' && clinic?.googleDocsTemplateId && exam && patient && !exam.googleDocId) {
      showToast('Criando Google Doc e finalizando...', 'info');
      try {
        const docName = `${patient.name} - ${exam.examType}`;
        const docId = await copyFile(clinic.googleDocsTemplateId, docName, clinic.googleDriveFolderId);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(reportContentRef.current, 'text/html');
        
        const sections: Record<string, string> = {
          titulo_laudo: '', tecnica_laudo: '', analise_laudo: '', conclusao_laudo: '', recomendacao_laudo: ''
        };
        let currentSection = '';
        for (const node of Array.from(doc.body.children)) {
          if (node.tagName === 'H2') {
            const headerText = node.textContent?.trim().toUpperCase() || '';
            if (headerText.includes('TÉCNICA')) currentSection = 'tecnica_laudo';
            else if (headerText.includes('ANÁLISE')) currentSection = 'analise_laudo';
            else if (headerText.includes('CONCLUSÃO')) currentSection = 'conclusao_laudo';
            else if (headerText.includes('RECOMENDAÇÕES')) currentSection = 'recomendacao_laudo';
            else if (!currentSection && !sections.titulo_laudo) {
              sections.titulo_laudo = headerText;
              currentSection = 'titulo_laudo';
            }
          } else if (currentSection && node.textContent) {
            sections[currentSection] += node.textContent + '\n';
          }
        }
        Object.keys(sections).forEach(k => { sections[k] = sections[k].trim(); });

        const replacements: Record<string, string> = {
          'PACIENTE_NOME': patient.name,
          'PACIENTE_IDADE': calculateAge(patient.birthDate),
          'PACIENTE_CONVENIO': patient.insurance || 'Particular',
          'EXAME_DATA': formatDate(Date.now()),
          'EXAME_TIPO': exam.examType,
          'MEDICO_SOLICITANTE': exam.requestingPhysician || '',
          'data_exame': formatDate(Date.now()),
          'nome_completo': patient.name,
          'data_nascimento': patient.birthDate ? formatDate(patient.birthDate) : '',
          'numero_laudo': exam.id.slice(0, 8).toUpperCase(),
          'dados_medico': (clinic.footerHtml?.replace(/<[^>]*>?/gm, '') || '') || settings.defaultSignature || (settings.physicianName ? `${settings.physicianName}\nCRM: ${settings.physicianCRM || ''}` : ''),
          'titulo_laudo': sections.titulo_laudo,
          'tecnica_laudo': sections.tecnica_laudo,
          'analise_laudo': sections.analise_laudo,
          'conclusao_laudo': sections.conclusao_laudo,
          'recomendacao_laudo': sections.recomendacao_laudo,
        };
        
        await replaceTextInDoc(docId, replacements);
        
        const url = `https://docs.google.com/document/d/${docId}/edit`;
        await updateItem('exams', examId, { 
          status, 
          finalizedAt: Date.now(),
          googleDocId: docId, 
          googleDocUrl: url 
        });
        showToast('Exame finalizado e Google Doc criado!', 'success');
        return;
      } catch (e: any) {
        showToast(e.message || 'Erro ao gerar Google Doc. Exame não finalizado.', 'error');
        return;
      }
    }

    await updateItem('exams', examId, {
      status,
      finalizedAt: status === 'finalizado' ? Date.now() : undefined,
    });
    showToast(`Status: ${status}`, 'success');
  }

  async function handleGenerate() {
    if (!template || !patient || !exam) return;
    setIsGenerating(true);
    try {
      let html: string;
      if (settings.geminiApiKey) {
        html = await generateReportStream({
          template,
          formData: formDataRef.current as Record<string, any>,
          patient,
          settings,
          clinicalIndication: exam.clinicalIndication,
        }, (chunk) => {
          setReportContent(chunk);
        });
      } else {
        html = generateMockReport({
          template,
          formData: formDataRef.current as Record<string, any>,
          patient,
          settings,
          clinicalIndication: exam.clinicalIndication,
        });
        showToast('API Key não configurada — laudo gerado em modo demo', 'info');
      }
      setReportContent(html);
      await updateItem('exams', examId, { reportContent: html });
      showToast('Laudo gerado!', 'success');
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Erro ao gerar laudo';
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!exam || !patient || !reportContent) return;
    try {
      await copyReportToClipboard(reportContent, patient, exam, settings);
      showToast('Laudo copiado para o clipboard', 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      showToast('Erro ao copiar: ' + message, 'error');
    }
  }

  if (!exam || !patient || !template) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin-slow text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-ink-500">Carregando exame...</p>
        </div>
      </div>
    );
  }

  const area = EXAM_AREAS.find((a) => a.id === exam.area);

  return (
    <div className="flex flex-col h-full relative">
      {/* AI Progress Bar */}
      {isGenerating && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-100 z-50 overflow-hidden">
          <div className="h-full bg-brand-500 w-1/3 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
      )}

      {/* ═══ TOPBAR ═══ */}
      <header className="border-b border-ink-100 bg-white px-4 py-2.5 flex items-center gap-3 shrink-0">
        <button
          onClick={() => setView({ name: 'worklist' })}
          className="text-ink-500 hover:text-ink-800 transition-colors p-1.5 rounded-lg hover:bg-ink-100 shrink-0"
          title="Voltar à Worklist"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Info do paciente */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-xs sm:text-sm font-semibold text-ink-900 truncate max-w-[120px] sm:max-w-[200px]">{patient.name}</h1>
            <span className="hidden sm:inline text-ink-300 text-xs">·</span>
            <span className="hidden sm:inline text-xs text-ink-500 truncate max-w-[180px]">{exam.examType}</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-ink-400 truncate">
            {calculateAge(patient.birthDate)}
            <span className="hidden sm:inline">{patient.birthDate && ` · DN ${formatDate(patient.birthDate)}`}</span>
            <span className="hidden sm:inline">{exam.requestingPhysician && ` · Solic. ${exam.requestingPhysician}`}</span>
          </p>
        </div>

        {/* Clinic badge */}
        {clinic && (
          <span className="chip bg-ink-50 text-ink-600 text-[10px] shrink-0">
            <Building2 size={10} />
            {clinic.name}
          </span>
        )}

        {/* Status */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 ml-4">
          {exam.status === 'finalizado' ? (
            <>
              <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm text-xs py-1 px-2.5">
                <CheckCircle2 size={13} /> Finalizado
              </span>
              <button
                onClick={() => setShowUnlockModal(true)}
                className="btn-secondary text-[11px] py-1 px-2 hover:bg-brand-50 hover:text-brand-700"
              >
                Desbloquear
              </button>
            </>
          ) : (
            <>
              <select
                value={exam.status}
                onChange={(e) => handleStatusChange(e.target.value as ExamStatus)}
                className="input w-auto text-xs py-1 px-2"
              >
                <option value="pendente">Pendente</option>
                <option value="em-andamento">Em Andamento</option>
              </select>
              <button
                onClick={() => handleStatusChange('finalizado')}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-none text-white text-[11px] py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={13} />
                Concluir
              </button>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => window.print()} className="btn-ghost text-xs px-2.5 py-1.5" title="Imprimir / Exportar PDF">
            <Printer size={14} />
          </button>
          <button onClick={handleCopy} className="btn-ghost text-xs px-2.5 py-1.5" title="Copiar para clipboard">
            <Copy size={14} />
          </button>
          {exam.googleDocUrl && (
            <a
              href={exam.googleDocUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs px-2.5 py-1.5"
              title="Abrir no Google Docs"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </header>

      {/* ═══ AVISO API KEY ═══ */}
      {!settings.geminiApiKey && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
          <AlertCircle size={12} />
          <span>API Key não configurada — geração em <strong>modo demo</strong>.</span>
          <button className="underline ml-1 font-medium" onClick={() => setView({ name: 'settings' })}>Configurar</button>
        </div>
      )}

      {/* ═══ CONTEÚDO SPLIT ═══ */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile Tab Switcher */}
        <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex bg-white/90 backdrop-blur border border-ink-200 rounded-full shadow-lg p-1 z-50">
          <button
            onClick={() => setActiveTab('form')}
            className={classNames(
              "px-4 py-2 rounded-full text-xs font-bold transition-all",
              activeTab === 'form' ? "bg-brand-600 text-white" : "text-ink-600"
            )}
          >
            Formulário
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={classNames(
              "px-4 py-2 rounded-full text-xs font-bold transition-all",
              activeTab === 'report' ? "bg-brand-600 text-white" : "text-ink-600"
            )}
          >
            Laudo
          </button>
        </div>

        {/* Painel esquerdo: formulário (Apenas visível se NÃO finalizado) */}
        {exam.status !== 'finalizado' && (
          <aside className={classNames(
            "lg:w-[400px] xl:w-[480px] shrink-0 border-r border-ink-100 bg-white flex-col min-h-0 transition-all duration-300",
            activeTab === 'form' ? "flex w-full absolute inset-0 lg:relative z-10" : "hidden lg:flex",
            !showFormPanel && "lg:w-0 overflow-hidden"
          )}>
            <div className="px-4 py-2.5 border-b border-ink-100 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-semibold text-ink-900 uppercase tracking-wide">Achados</h3>
              <button
                onClick={() => setShowFormPanel(false)}
                className="hidden lg:block text-ink-400 hover:text-ink-700 p-1 rounded hover:bg-ink-100 transition-colors"
                title="Recolher"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <DynamicForm fields={template.formFields} values={formData} onChange={handleFormChange} />
            </div>
          </aside>
        )}

        {/* Painel direito: editor de laudo */}
        <div className={classNames(
          "flex-1 flex flex-col min-w-0 min-h-0 bg-ink-50/30",
          activeTab === 'report' ? "flex" : "hidden lg:flex"
        )}>
          {/* Barra IA + save state */}
          <div className="px-4 py-2.5 border-b border-ink-100 bg-white flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || exam.status === 'finalizado'}
              className="btn-primary text-[11px] sm:text-xs py-1.5 px-3 group/gen"
              title="Atalho: Ctrl+G / ⌘G"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin-slow" /> : <Sparkles size={14} />}
              {isGenerating ? 'Gerando...' : reportContent ? 'Regerar' : 'Gerar Laudo'}
              <kbd className="hidden lg:inline-flex ml-1.5 px-1 py-0.5 rounded text-[8px] bg-white/20 font-mono">⌘G</kbd>
            </button>

            {/* Prompt Preview Button */}
            {template && patient && (
              <button
                onClick={() => setShowPromptPreview(true)}
                className="btn-secondary text-xs py-1.5 px-2.5"
                title="Ver prompt enviado à IA"
              >
                <Eye size={14} /> Prompt
              </button>
            )}

            {/* Toggle Snippets Button */}
            {exam.status !== 'finalizado' && (
              <button
                onClick={() => setShowSnippets(!showSnippets)}
                className={classNames(
                  "btn-secondary text-xs py-1.5 px-2.5",
                  showSnippets ? "bg-brand-50 text-brand-700 border-brand-200" : ""
                )}
                title="Frases prontas"
              >
                <MessageSquareText size={14} /> Frases Prontas
              </button>
            )}

            {/* Google Docs Integration - Botão removido, agora é automático ao finalizar */}

            <div className="text-[11px] text-ink-500 flex items-center gap-1.5 ml-auto">
              {saveState === 'saving' && (
                <>
                  <Loader2 size={11} className="animate-spin-slow text-brand-500" />
                  <span className="text-brand-600">Salvando...</span>
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  <span className="text-emerald-600">Salvo</span>
                </>
              )}
              {saveState === 'idle' && (
                <>
                  <Cloud size={11} className="text-ink-400" />
                  <span>Auto-save</span>
                </>
              )}
            </div>

            <span className="text-[11px] text-ink-400">{settings.geminiModel}</span>
          </div>

          {/* Editor TipTap ou Google Docs */}
          <div className="flex-1 overflow-hidden relative bg-ink-50 flex">
            {exam.googleDocId && exam.status === 'finalizado' ? (
              <div className="h-full w-full mx-auto p-4 flex flex-col relative overflow-auto">
                <iframe
                  src={`https://docs.google.com/document/d/${exam.googleDocId}/edit?embedded=true`}
                  className="w-full h-full border border-ink-200 rounded-lg shadow-sm bg-white"
                  title="Google Docs Editor"
                />
              </div>
            ) : (
              <div className="relative h-full flex-1 overflow-auto">
                {exam.status === 'finalizado' && (
                  <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] pointer-events-none" />
                )}
                <RichEditor ref={editorRef} content={reportContent} onChange={handleReportChange} editable={exam.status !== 'finalizado'} />
              </div>
            )}
            
            {showSnippets && exam.status !== 'finalizado' && (
              <SnippetLibrary onInsert={(text) => editorRef.current?.insertContent(text)} />
            )}
          </div>
        </div>
      </div>
      {/* Modal de Justificativa de Desbloqueio */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-ink-100 bg-ink-50/50">
              <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Desbloquear Exame
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-ink-600 mb-4">
                Este laudo foi marcado como <strong>Finalizado</strong>. Para liberar a edição e salvar uma nova versão, informe o motivo da alteração:
              </p>
              <textarea
                className="input min-h-[100px] text-sm resize-none"
                placeholder="Ex: Correção de medida na análise técnica..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-3 bg-ink-50">
              <button 
                className="btn-ghost" 
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason('');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                disabled={unlockReason.trim().length < 5}
                onClick={async () => {
                  try {
                    showToast('Desbloqueando e excluindo documento...', 'info');
                    if (exam.googleDocId) {
                      await deleteFile(exam.googleDocId);
                    }
                    const newHistory = [...(exam.unlockHistory || []), { date: Date.now(), reason: unlockReason.trim() }];
                    await updateItem('exams', examId, { 
                      status: 'em-andamento', 
                      unlockHistory: newHistory,
                      googleDocId: deleteField(),
                      googleDocUrl: deleteField()
                    });
                    setShowUnlockModal(false);
                    setUnlockReason('');
                    showToast('Exame desbloqueado. Doc excluído.', 'success');
                  } catch (e: any) {
                    showToast(`Erro ao excluir Doc: ${e.message}`, 'error');
                  }
                }}
              >
                Desbloquear e Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Preview Modal */}
      {showPromptPreview && template && patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPromptPreview(false)}>
          <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-ink-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Eye size={16} className="text-brand-500" /> Prompt Preview</h3>
                <p className="text-xs text-ink-500 mt-0.5">Prompt exato enviado ao modelo {settings.geminiModel}</p>
              </div>
              <button onClick={() => setShowPromptPreview(false)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed bg-ink-50 p-4 rounded-xl border border-ink-200">
                {buildPrompt({
                  template,
                  formData: formDataRef.current as Record<string, any>,
                  patient,
                  settings,
                  clinicalIndication: exam?.clinicalIndication,
                })}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-ink-50/50 shrink-0">
              <span className="text-[10px] text-ink-400">
                Temperatura: {settings.aiTemperature ?? 0.3} · Modelo: {settings.geminiModel || 'gemini-2.0-flash-exp'}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(buildPrompt({
                    template,
                    formData: formDataRef.current as Record<string, any>,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                  }));
                  showToast('Prompt copiado!', 'success');
                }}
                className="btn-secondary text-xs py-1.5"
              >
                <Copy size={12} /> Copiar Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Bar */}
      <div className="hidden lg:flex items-center gap-5 px-4 py-1.5 bg-ink-900 text-ink-400 text-[10px] font-mono shrink-0">
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘G</kbd> Gerar IA</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘⇧C</kbd> Copiar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘K</kbd> Busca</span>
      </div>

      {/* Print Layout (Hidden on screen, visible on print) */}
      <PrintLayout
        patient={patient}
        clinic={clinic}
        settings={settings}
        examType={exam.examType}
        reportContent={reportContentRef.current}
        physicianName={exam.requestingPhysician}
        examDate={exam.createdAt}
      />
    </div>
  );
}
