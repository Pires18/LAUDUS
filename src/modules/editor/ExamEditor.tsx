import { useEffect, useState, useCallback, useRef } from 'react';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { updateItem, getItem } from '../../store/db';
import { useApp } from '../../store/app';
import { ExamStatus, EXAM_AREAS, Patient, ReportTemplate, Clinic, ExamRequest } from '../../types';
import { LaudCopilot } from './LaudCopilot';
import { RichEditor, RichEditorRef } from './RichEditor';
import { buildPrompt } from '../ai/gemini';
import { copyReportToClipboard } from '../export/docxExport';
import { deleteField } from 'firebase/firestore';
import { Loader2, AlertCircle, Eye, X, Copy, UserCog, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '../../utils/format';
import { PrintLayout } from '../export/PrintLayout';
import { CalculatorModal } from '../calculators/CalculatorModal';

// Refactored Hooks
import { useExamActions } from './hooks/useExamActions';
import { useGoogleDocs } from './hooks/useGoogleDocs';

// Refactored Components
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { getInitialReportContent } from '../templates/utils';
import { ExamHistoryModal } from './components/ExamHistoryModal';

interface Props {
  examId: string;
}

export function ExamEditor({ examId }: Props) {
  const { setView, settings, showToast } = useApp();
  const currentRole = settings.currentRole || 'medico';

  // Firestore realtime listeners
  const { data: exam } = useDocument<import('../../types').ExamRequest>('exams', examId);
  const { data: patient } = useDocument<Patient>('patients', exam?.patientId || '');
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const { data: clinics } = useCollection<Clinic>('clinics');

  // Load related data
  useEffect(() => {
    if (!exam) return;
    if (exam.templateId) {
      getItem<ReportTemplate>('templates', exam.templateId).then((t) => setTemplate(t));
    }
    if (exam.clinicId) {
      getItem<Clinic>('clinics', exam.clinicId).then((c) => setClinic(c));
    }
  }, [exam?.templateId, exam?.clinicId]);

  const [reportContent, setReportContent] = useState(exam?.reportContent || '');
  const [initialized, setInitialized] = useState(false);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showEditMetadata, setShowEditMetadata] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false); 
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCalculators, setShowCalculators] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  
  // Metadata Edit State
  const [editData, setEditData] = useState({
    patientName: '',
    birthDate: '',
    requestingPhysician: '',
    clinicalIndication: '',
    clinicId: ''
  });
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const editorRef = useRef<RichEditorRef>(null);
  const reportContentRef = useRef(reportContent);
  reportContentRef.current = reportContent;

  // Sync initial content when data loads
  useEffect(() => {
    if (exam && template && !initialized) {
      if (exam.reportContent && exam.reportContent.trim() !== '') {
        setReportContent(exam.reportContent || '');
      } else {
        const initial = getInitialReportContent(template);
        setReportContent(initial);
        updateItem('exams', examId, { reportContent: initial });
      }
      setInitialized(true);
    }
  }, [exam, template, initialized, examId]);

  // Actions Hook
  const {
    isGenerating,
    saveState,
    debouncedSave,
    handleRefine,
    updateStatus
  } = useExamActions({
    examId,
    settings,
    showToast,
    onReportChange: (html) => setReportContent(html),
    patient,
    template,
    clinicalIndication: exam?.clinicalIndication,
    requestingPhysician: exam?.requestingPhysician
  });

  const [isCopilotGenerating, setIsCopilotGenerating] = useState(false);

  // Google Docs Hook
  const { createGoogleDoc, deleteGoogleDoc } = useGoogleDocs({
    examId,
    patient,
    exam,
    clinic,
    settings,
    showToast
  });

  // Status Change logic
  const handleStatusChange = async (newStatus: ExamStatus) => {
    if (newStatus === 'finalizado' && clinic?.googleDocsTemplateId && exam && patient) {
      const needsNewDoc = !exam.googleDocId || exam.status !== 'finalizado';
      if (needsNewDoc) {
        showToast('Criando Google Doc e finalizando...', 'info');
        try {
          await createGoogleDoc(reportContentRef.current);
          showToast('Exame finalizado e Google Doc criado!', 'success');
          return;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro ao gerar Google Doc. Exame não finalizado.';
          showToast(msg, 'error');
          return;
        }
      }
    }
    await updateStatus(newStatus);
  };

  const handleCopy = async () => {
    if (!exam || !patient || !reportContent) return;
    try {
      await copyReportToClipboard(reportContent, patient, exam, settings);
      showToast('Laudo copiado para o clipboard', 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      showToast('Erro ao copiar: ' + message, 'error');
    }
  };

  const handleReset = useCallback(async () => {
    if (!template) return;
    if (window.confirm('Deseja reiniciar o laudo para o padrão da máscara? Isso apagará as alterações atuais.')) {
      const initial = getInitialReportContent(template);
      setReportContent(initial);
      await updateItem('exams', examId, { reportContent: initial });
      showToast('Laudo reiniciado para o padrão da máscara', 'success');
    }
  }, [template, examId, showToast]);

  const handleSaveMetadata = async () => {
    if (!exam || !patient) return;
    try {
      setLoadingMetadata(true);
      await updateItem('patients', exam.patientId, {
        name: editData.patientName,
        birthDate: editData.birthDate
      });
      await updateItem('exams', examId, {
        requestingPhysician: editData.requestingPhysician,
        clinicalIndication: editData.clinicalIndication,
        clinicId: editData.clinicId
      });
      setShowEditMetadata(false);
      showToast('Dados atualizados com sucesso!');
    } catch (err) {
      showToast('Erro ao atualizar dados', 'error');
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyboard(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleRefine(reportContent);
      }
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReset();
      }
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        debouncedSave(reportContent);
        showToast('Laudo salvo!', 'success');
      }
      if (isMod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        handleStatusChange('finalizado');
      }
    }
    function handleAIRefine(e: Event) {
      handleRefine((e as CustomEvent).detail);
    }
    window.addEventListener('keydown', handleKeyboard);
    window.addEventListener('ai-refine-trigger', handleAIRefine);
    return () => {
      window.removeEventListener('keydown', handleKeyboard);
      window.removeEventListener('ai-refine-trigger', handleAIRefine);
    };
  }, [handleRefine, reportContent, handleCopy, handleReset, debouncedSave, showToast, handleStatusChange]);

  return (
    <>
      {!exam || !patient || !template ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 size={24} className="animate-spin-slow text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-ink-500">Carregando exame...</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full relative">
          {/* AI Progress Bar */}
          {isGenerating && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-100 z-50 overflow-hidden">
              <div className="h-full bg-brand-500 w-1/3 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
          )}

          <EditorHeader 
            exam={exam}
            patient={patient}
            clinic={clinic}
            onBack={() => setView({ name: 'worklist' })}
            onStatusChange={(status) => {
              if (currentRole === 'recepcao') {
                showToast('Acesso restrito: Secretárias não finalizam laudos.', 'error');
                return;
              }
              handleStatusChange(status);
            }}
            onUnlock={() => {
              if (currentRole === 'recepcao') {
                showToast('Acesso restrito: Secretárias não desbloqueiam laudos.', 'error');
                return;
              }
              setShowUnlockModal(true);
            }}
            onEditMetadata={() => {
              if (currentRole === 'recepcao') {
                showToast('Acesso restrito: Secretárias não alteram dados de exame.', 'error');
                return;
              }
              setEditData({
                patientName: patient.name,
                birthDate: patient.birthDate || '',
                requestingPhysician: exam.requestingPhysician || '',
                clinicalIndication: exam.clinicalIndication || '',
                clinicId: exam.clinicId || ''
              });
              setShowEditMetadata(true);
            }}
          />

          {/* AVISO API KEY */}
          {!settings.geminiApiKey && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
              <AlertCircle size={12} />
              <span>API Key não configurada — geração em <strong>modo demo</strong>.</span>
              <button className="underline ml-1 font-medium" onClick={() => setView({ name: 'settings' })}>Configurar</button>
            </div>
          )}

          <div className="flex-1 flex min-h-0 relative overflow-hidden bg-ink-50/20">
            {/* Main Workspace */}
            <div className="flex-1 flex flex-col min-w-0 mr-0">
              {/* Section Progress Bar */}
              <div className="h-1 bg-ink-100/50 w-full shrink-0 relative overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '65%' }} // Mock progress for UI adequacy
                   className="h-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                 />
              </div>

              <EditorToolbar 
                isGenerating={isGenerating}
                hasReport={!!reportContent}
                status={exam.status}
                onRefine={() => {
                  if (currentRole === 'recepcao') {
                    showToast('Acesso restrito: Secretárias não utilizam Laud.IA.', 'error');
                    return;
                  }
                  handleRefine(reportContent);
                }}
                onShowPrompt={() => setShowPromptPreview(true)}
                onReset={() => {
                  if (currentRole === 'recepcao') {
                    showToast('Acesso restrito: Secretárias não alteram o laudo.', 'error');
                    return;
                  }
                  handleReset();
                }}
                onShowHistory={() => setShowHistoryModal(true)}
                saveState={saveState}
                geminiModel={settings.geminiModel || 'gemini-1.5-flash'}
              />

          <div className="flex-1 overflow-hidden relative flex flex-col">
            <AnimatePresence>
              {isGenerating && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] bg-white/40 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="relative group">
                    <div className="absolute inset-0 bg-brand-500 rounded-2xl blur-3xl opacity-20 animate-pulse" />
                    <div className="relative bg-white/90 backdrop-blur-xl px-10 py-8 rounded-[3rem] shadow-2xl border border-brand-100 flex flex-col items-center gap-5">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-brand-600 text-white flex items-center justify-center shadow-xl shadow-brand-200">
                        <Sparkles size={32} className="animate-spin-slow" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] ml-1">Processamento LAUD.IA</p>
                        <p className="text-xl font-black text-ink-900 tracking-tight">Otimizando Inteligência Clínica</p>
                        <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest pt-1">Aguarde a finalização dos tópicos...</p>
                      </div>
                      <div className="w-48 h-1.5 bg-ink-50 rounded-full overflow-hidden">
                        <motion.div 
                          animate={{ x: [-100, 200] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                          className="w-1/3 h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {exam.googleDocId && exam.status === 'finalizado' ? (
              <div className="flex-1 w-full mx-auto p-4 flex flex-col relative overflow-auto bg-white">
                <iframe
                  src={`https://docs.google.com/document/d/${exam.googleDocId}/edit?embedded=true`}
                  className="w-full h-full border border-ink-200 rounded-lg shadow-sm"
                  title="Google Docs Editor"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden p-4 lg:p-6 flex flex-col bg-ink-50/10">
                <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col relative min-h-0">
                  {exam.status === 'finalizado' && (
                    <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] pointer-events-none rounded-xl" />
                  )}
                  <div className="bg-white rounded-[2rem] shadow-premium border border-ink-100 overflow-hidden flex-1 flex flex-col min-h-0">
                    <RichEditor 
                      ref={editorRef} 
                      content={reportContent} 
                      onChange={(html) => {
                        if (initialized) {
                          setReportContent(html);
                          debouncedSave(html);
                        }
                      }} 
                      editable={exam.status !== 'finalizado' && currentRole !== 'recepcao'} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Copilot (Non-Docked, Minimizable widget) */}
        <AnimatePresence>
          {showCopilot && exam.status !== 'finalizado' && currentRole !== 'recepcao' && (
            <motion.aside 
              initial={{ opacity: 0, scale: 0.94, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-0 w-full h-full rounded-none sm:inset-auto sm:bottom-24 sm:right-6 lg:right-10 sm:w-[420px] sm:h-[72vh] sm:max-h-[660px] bg-white sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 flex flex-col z-[120] overflow-hidden"
            >
              {/* Premium Header with Mesh-style Gradient */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600/30 via-brand-800/10 to-transparent pointer-events-none" />
                <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse pointer-events-none" />
                
                <div className="relative flex items-center gap-3 z-10">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-xl">
                    <Sparkles size={16} className="text-brand-400 fill-brand-400/25 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-black text-xs uppercase tracking-widest block leading-none">Laud.IA Copiloto</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter pt-0.5 block">Assistente de Co-autoria</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowCopilot(false)}
                  className="relative z-10 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95 shadow-inner"
                  title="Minimizar Copiloto"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <LaudCopilot
                  reportContent={reportContent}
                  onUpdate={(newContent) => {
                    setReportContent(newContent);
                    debouncedSave(newContent);
                  }}
                  isGenerating={isCopilotGenerating}
                  setIsGenerating={setIsCopilotGenerating}
                  exam={exam}
                  template={template}
                  patient={patient}
                  chatHistory={exam.chatHistory || []}
                  onChatUpdate={(newHistory) => {
                    updateItem('exams', examId, { chatHistory: newHistory });
                  }}
                  onShowCalculators={() => setShowCalculators(true)}
                  prompt={copilotPrompt}
                  onChangePrompt={setCopilotPrompt}
                  isDocked={false}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* FAB Toggle Copilot */}
        {exam.status !== 'finalizado' && (
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className={classNames(
              "fixed bottom-24 md:bottom-8 right-6 md:right-8 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl z-[80] transition-all transform hover:scale-105 active:scale-95 border-2",
              showCopilot 
                ? "bg-white text-ink-900 border-ink-100" 
                : "bg-brand-600 text-white border-brand-500 shadow-brand-500/30"
            )}
          >
            {showCopilot ? <X size={24} /> : <Sparkles size={24} />}
            {!showCopilot && (
               <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Modal de Justificativa de Desbloqueio */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 animate-in fade-in duration-200">
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
                onClick={() => { setShowUnlockModal(false); setUnlockReason(''); }}
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
                      await deleteGoogleDoc(exam.googleDocId);
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
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
                    showToast(`Erro ao excluir Doc: ${msg}`, 'error');
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowPromptPreview(false)}>
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
                  patient,
                  settings,
                  clinicalIndication: exam?.clinicalIndication,
                  requestingPhysician: exam?.requestingPhysician,
                })}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-ink-50/50 shrink-0">
              <span className="text-[10px] text-ink-400">
                Temperatura: {settings.aiTemperature ?? 0.3} · Modelo: {settings.geminiModel}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(buildPrompt({
                    template,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                    requestingPhysician: exam?.requestingPhysician,
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

      {/* Modal de Edição de Metadados */}
      {showEditMetadata && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                <UserCog size={18} className="text-brand-500" />
                Editar Dados do Exame
              </h3>
              <button onClick={() => setShowEditMetadata(false)} className="p-1 hover:bg-ink-100 rounded-lg text-ink-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1.5 block ml-1">Nome do Paciente</label>
                <input 
                  className="input" 
                  value={editData.patientName} 
                  onChange={e => setEditData({...editData, patientName: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-1.5 block ml-1">Data de Nascimento</label>
                  <input 
                    type="date"
                    className="input" 
                    value={editData.birthDate} 
                    onChange={e => setEditData({...editData, birthDate: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-1.5 block ml-1">Médico Solicitante</label>
                  <input 
                    className="input" 
                    value={editData.requestingPhysician} 
                    onChange={e => setEditData({...editData, requestingPhysician: e.target.value})} 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1.5 block ml-1">Indicação Clínica</label>
                <textarea 
                  className="input min-h-[80px] py-3 resize-none" 
                  value={editData.clinicalIndication} 
                  onChange={e => setEditData({...editData, clinicalIndication: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-ink-400 mb-1.5 block ml-1">Clínica</label>
                <select 
                  className="input" 
                  value={editData.clinicId} 
                  onChange={e => setEditData({...editData, clinicId: e.target.value})}
                >
                  <option value="">Selecione uma clínica</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-ink-400 mt-1 ml-1 italic">
                  * Alterar a clínica afeta o template e a pasta de exportação do Google Docs.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-3 bg-ink-50">
              <button className="btn-ghost" onClick={() => setShowEditMetadata(false)}>Cancelar</button>
              <button 
                className="btn-primary px-8"
                disabled={loadingMetadata}
                onClick={handleSaveMetadata}
              >
                {loadingMetadata ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && exam && template && patient && (
        <ExamHistoryModal 
          patientId={patient.id}
          templateId={template.id}
          currentExamId={exam.id}
          currentContent={reportContent}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Keyboard Shortcuts Bar */}
      <div className="hidden lg:flex items-center gap-5 px-4 py-1.5 bg-ink-900 text-ink-400 text-[10px] font-mono shrink-0">
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘G</kbd> Gerar IA</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘⇧C</kbd> Copiar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘K</kbd> Busca</span>
      </div>

      <AnimatePresence>
        {showCalculators && (
          <CalculatorModal 
            area={exam.area} 
            onClose={() => setShowCalculators(false)} 
            onSendToCopilot={(res) => {
              setCopilotPrompt(res);
              setShowCalculators(false);
              if (!showCopilot) setShowCopilot(true);
            }}
          />
        )}
      </AnimatePresence>

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
      )}
    </>
  );
}
