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
import { Loader2, AlertCircle, Eye, X, Copy, UserCog, Sparkles, BookOpen, Search, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '../../utils/format';
import { PrintLayout } from '../export/PrintLayout';
import { CalculatorModal } from '../calculators/CalculatorModal';
import { DicomImagesModal } from './components/DicomImagesModal';
import { PrintImagesLayout } from '../export/PrintImagesLayout';

// Refactored Hooks
import { useExamActions } from './hooks/useExamActions';
import { useGoogleDocs } from './hooks/useGoogleDocs';

// Refactored Components
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { getInitialReportContent } from '../templates/utils';
import { ExamHistoryModal } from './components/ExamHistoryModal';
import { AnamnesisConsentModal } from './components/AnamnesisConsentModal';

interface Props {
  examId: string;
}

export function ExamEditor({ examId }: Props) {
  const { setView, settings, showToast } = useApp();
  const currentRole = settings.currentRole || 'medico';

  // Firestore realtime listeners
  const { data: exam } = useDocument<ExamRequest>('exams', examId);
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

  const [showCopilot, setShowCopilot] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCalculators, setShowCalculators] = useState(false);
  const [showAnamnesisConsent, setShowAnamnesisConsent] = useState(false);
  const [showDicomImages, setShowDicomImages] = useState(false);
  const [selectedInstancesForPrint, setSelectedInstancesForPrint] = useState<any[]>([]);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');

  // Estado LOCAL do histórico do copiloto — evita spam de escritas no Firestore
  // durante o streaming (sem isso, cada chunk geraria uma escrita no Firestore).
  // O Firestore é atualizado de forma debounced a cada 1500ms sem novas mudanças.
  const [localChatHistory, setLocalChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const chatHistoryInitialized = useRef(false);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasDicomImages, setHasDicomImages] = useState(false);
  const [dicomInstances, setDicomInstances] = useState<any[]>([]);
  const [showIntegratedViewer, setShowIntegratedViewer] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [dicomInstances]);

  const handlePrevImage = useCallback(() => {
    if (dicomInstances.length === 0) return;
    setActiveImageIndex((prev) => (prev === 0 ? dicomInstances.length - 1 : prev - 1));
  }, [dicomInstances.length]);

  const handleNextImage = useCallback(() => {
    if (dicomInstances.length === 0) return;
    setActiveImageIndex((prev) => (prev === dicomInstances.length - 1 ? 0 : prev + 1));
  }, [dicomInstances.length]);

  // Keyboard navigation for Full Screen Lightbox
  useEffect(() => {
    if (!showFullScreenImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'Escape') {
        setShowFullScreenImage(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFullScreenImage, handlePrevImage, handleNextImage]);

  useEffect(() => {
    let active = true;

    if (!exam || !exam.id) {
      setHasDicomImages(false);
      setDicomInstances([]);
      setShowIntegratedViewer(false);
      return;
    }

    if (settings.dicomSyncEnabled === false) {
      setHasDicomImages(false);
      setDicomInstances([]);
      setShowIntegratedViewer(false);
      return;
    }

    const checkImages = async () => {
      try {
        const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
        const studyUid = `1.2.276.0.7230010.3.1.2.${exam.id}`;
        const authParams = `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
        const findUrl = `${baseUrl.replace(/\/$/, '')}/tools/find`;
        
        const res = await fetch(
          `/api/orthanc-proxy?url=${encodeURIComponent(findUrl)}${authParams}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              Level: 'Study',
              Query: {
                StudyInstanceUID: studyUid
              }
            })
          }
        );

        if (!res.ok) {
          console.warn('[PACS Check] Erro na resposta do proxy:', res.status);
          if (active) {
            setHasDicomImages(false);
            setDicomInstances([]);
          }
          return;
        }

        const studies = await res.json();
        if (studies && studies.length > 0) {
          const studyId = studies[0];
          const instancesUrl = `${baseUrl.replace(/\/$/, '')}/studies/${studyId}/instances`;
          const instancesRes = await fetch(`/api/orthanc-proxy?url=${encodeURIComponent(instancesUrl)}${authParams}`);
          
          if (instancesRes.ok) {
            const instances = await instancesRes.json();
            const sorted = (instances || []).sort((a: any, b: any) => {
              const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
              const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
              return numA - numB;
            });
            if (active) {
              setDicomInstances(sorted);
              setHasDicomImages(sorted.length > 0);
            }
          } else {
            if (active) {
              setHasDicomImages(false);
              setDicomInstances([]);
            }
          }
        } else {
          if (active) {
            setHasDicomImages(false);
            setDicomInstances([]);
          }
        }
      } catch (e) {
        console.warn('[PACS Check] Erro ao checar imagens no Orthanc:', e);
        if (active) {
          setHasDicomImages(false);
          setDicomInstances([]);
        }
      }
    };

    checkImages();

    return () => {
      active = false;
    };
  }, [
    exam?.id,
    settings.dicomSyncEnabled,
    settings.dicomViewerUrl,
    settings.dicomUsername,
    settings.dicomPassword
  ]);
  


  const editorRef = useRef<RichEditorRef>(null);
  const reportContentRef = useRef(reportContent);
  reportContentRef.current = reportContent;

  // Inicializa o histórico local do copiloto UMA vez quando o exam carrega
  useEffect(() => {
    if (exam && !chatHistoryInitialized.current) {
      chatHistoryInitialized.current = true;
      setLocalChatHistory(
        (exam.chatHistory || []) as Array<{ role: 'user' | 'assistant'; content: string }>
      );
    }
  }, [exam]);

  // Limpa o timer de salvamento do chat ao desmontar
  useEffect(() => {
    return () => {
      if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
    };
  }, []);

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
    requestingPhysician: exam?.requestingPhysician,
    anamnesis: exam?.anamnesis,
    examDateMs: exam?.createdAt
  });

  const [isCopilotGenerating, setIsCopilotGenerating] = useState(false);

  /**
   * Atualização do histórico do copiloto com escrita debounced no Firestore.
   * Durante streaming, React re-renderiza imediatamente via estado local,
   * mas Firestore só é escrito 1500ms após o último chunk — evita spam.
   */
  const handleChatUpdate = useCallback(
    (newHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      setLocalChatHistory(newHistory);
      if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
      chatSaveTimerRef.current = setTimeout(() => {
        updateItem('exams', examId, { chatHistory: newHistory });
      }, 1500);
    },
    [examId]
  );

  // Google Docs Hook
  const { createGoogleDoc, deleteGoogleDoc } = useGoogleDocs({
    examId,
    patient,
    exam,
    clinic,
    settings,
    showToast
  });

  // Status Change — useCallback evita re-registro do keyboard listener a cada render
  const handleStatusChange = useCallback(async (newStatus: ExamStatus) => {
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
  }, [clinic?.googleDocsTemplateId, exam, patient, createGoogleDoc, showToast, updateStatus]);

  const handleCopy = useCallback(async () => {
    if (!exam || !patient || !reportContent) return;
    try {
      await copyReportToClipboard(reportContent, patient, exam, settings);
      showToast('Laudo copiado para o clipboard', 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      showToast('Erro ao copiar: ' + message, 'error');
    }
  }, [exam, patient, reportContent, settings, showToast]);

  const handleReset = useCallback(async () => {
    if (!template) return;
    if (window.confirm('Deseja reiniciar o laudo para o padrão da máscara? Isso apagará as alterações atuais.')) {
      const initial = getInitialReportContent(template);
      setReportContent(initial);
      await updateItem('exams', examId, { reportContent: initial });
      showToast('Laudo reiniciado para o padrão da máscara', 'success');
    }
  }, [template, examId, showToast]);



  const [selectedGridType, setSelectedGridType] = useState<string>('2x3');

  const handlePrintImages = (instances: any[], gridType: string = '2x3') => {
    setSelectedInstancesForPrint(instances);
    setSelectedGridType(gridType);
    document.body.classList.add('print-mode-images');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-mode-images');
    }, 200);
  };

  const originalTitleRef = useRef<string | null>(null);

  useEffect(() => {
    const handleBeforePrint = () => {
      if (exam && patient) {
        originalTitleRef.current = document.title;
        const dateStr = new Date(exam.createdAt).toLocaleDateString('pt-BR').replace(/\//g, '-');
        const patientName = patient.name.trim();
        const examName = exam.examType.trim();
        const clinicName = (clinic?.name || settings.clinicName || 'LAUDUS').trim();
        document.title = `${dateStr} - ${patientName} - ${examName} - ${clinicName}`;
      }
    };

    const handleAfterPrint = () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [exam, patient, clinic, settings]);

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
            onOpenAnamnesisConsent={() => setShowAnamnesisConsent(true)}
            hasDicomImages={hasDicomImages}
            onToggleViewer={() => setShowIntegratedViewer(prev => !prev)}
            viewerOpen={showIntegratedViewer}
          />

          {/* AVISO API KEY */}
          {((settings.aiProvider === 'anthropic' && !settings.anthropicApiKey) || 
            ((settings.aiProvider === 'gemini' || !settings.aiProvider) && !settings.geminiApiKey)) && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
              <AlertCircle size={12} />
              <span>API Key do {settings.aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} não configurada — geração em <strong>modo demo</strong>.</span>
              <button className="underline ml-1 font-medium" onClick={() => setView({ name: 'settings' })}>Configurar</button>
            </div>
          )}

          <div className="flex-1 flex min-h-0 relative overflow-hidden bg-ink-50/20">
            {/* Integrated Dicom Image Viewer Sidebar */}
            {showIntegratedViewer && hasDicomImages && dicomInstances.length > 0 && (
              <div className="w-[380px] md:w-[460px] xl:w-[540px] border-r border-slate-800 bg-slate-950 text-slate-100 flex flex-col shrink-0 min-h-0 animate-fade-in relative z-20">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-black text-xs uppercase tracking-widest text-slate-200">PACS Integrado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDicomImages(true)}
                      className="h-8 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all shadow-md border border-brand-500/20"
                      title="Gerar/Imprimir PDF das Imagens"
                    >
                      <Printer size={12} />
                      <span>PDF</span>
                    </button>
                    <button 
                      onClick={() => setShowIntegratedViewer(false)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95"
                      title="Fechar Visualizador"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Main Preview Area */}
                <div className="p-4 flex flex-col items-center justify-center shrink-0 border-b border-slate-800 bg-slate-900/50">
                  {(() => {
                    const activeInstance = dicomInstances[activeImageIndex];
                    if (!activeInstance) return null;
                    const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
                    const previewUrl = `/api/orthanc-proxy?url=${encodeURIComponent(`${baseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
                    const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

                    return (
                      <div className="w-full flex flex-col gap-3">
                        <div 
                          onClick={() => setShowFullScreenImage(true)}
                          className="relative aspect-square w-full bg-black rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner cursor-zoom-in"
                        >
                          <img 
                            src={previewUrl} 
                            alt={`Instance ${instanceNum}`}
                            className="max-w-full max-h-full object-contain hover:scale-[1.02] transition-transform duration-300"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg"
                            title="Anterior"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg"
                            title="Próxima"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[9px] font-black tracking-widest text-slate-300 uppercase shadow-md animate-fade-in">
                            FOTO {activeImageIndex + 1} / {dicomInstances.length}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                          <span>Instância: {instanceNum}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Thumbnails Grid List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <div className="grid grid-cols-3 gap-2">
                    {dicomInstances.map((instance, idx) => {
                      const isActive = idx === activeImageIndex;
                      const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
                      const previewUrl = `/api/orthanc-proxy?url=${encodeURIComponent(`${baseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
                      
                      return (
                        <button
                          key={instance.ID}
                          onClick={() => setActiveImageIndex(idx)}
                          className={classNames(
                            "relative aspect-square bg-black border rounded-xl overflow-hidden flex items-center justify-center transition-all group active:scale-95 shadow-md",
                            isActive 
                              ? "border-emerald-500 ring-2 ring-emerald-500/25 scale-[0.98]" 
                              : "border-slate-800 hover:border-slate-600 hover:scale-[1.02]"
                          )}
                        >
                          <img src={previewUrl} className="max-w-full max-h-full object-contain" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

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
                isTemplateMask={/\(…\)/.test(reportContent)}
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
                onToggleSnippets={() => { setShowSnippets(s => !s); setSnippetSearch(''); }}
                snippetsOpen={showSnippets}
                snippetCount={settings.snippets?.length ?? 0}
                saveState={saveState}
                geminiModel={
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-2.5-flash')
                }
              />

              {/* ── Snippet Picker Panel ── */}
              {showSnippets && (
                <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-3 space-y-2 shrink-0 animate-fade-in">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <BookOpen size={13} className="text-amber-600" />
                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Frases Prontas</span>
                      <span className="text-[9px] text-amber-500">— clique para inserir no cursor</span>
                    </div>
                    <button onClick={() => setShowSnippets(false)} className="p-1 rounded-lg hover:bg-amber-100 text-amber-500">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400" />
                    <input
                      value={snippetSearch}
                      onChange={e => setSnippetSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-amber-200 bg-white text-[11px] focus:ring-amber-400 focus:border-amber-400 placeholder-amber-300"
                      placeholder="Buscar frase..."
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
                    {(settings.snippets || [])
                      .filter(s => {
                        if (snippetSearch.trim()) {
                          const q = snippetSearch.toLowerCase();
                          return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
                        }
                        // Show area-filtered first, then all
                        return true;
                      })
                      .sort((a, b) => {
                        const examArea = exam?.area || '';
                        const aMatch = a.area === examArea ? -1 : 0;
                        const bMatch = b.area === examArea ? -1 : 0;
                        return aMatch - bMatch;
                      })
                      .map(snippet => (
                        <button
                          key={snippet.id}
                          onClick={() => {
                            editorRef.current?.insertContent(snippet.content);
                            showToast(`"${snippet.title}" inserido`, 'success');
                          }}
                          title={snippet.content}
                          className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-[10px] font-bold text-amber-800 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all active:scale-95 shadow-sm"
                        >
                          {snippet.title}
                        </button>
                      ))
                    }
                    {(settings.snippets || []).filter(s => {
                      if (!snippetSearch.trim()) return true;
                      const q = snippetSearch.toLowerCase();
                      return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-[10px] text-amber-400 italic">Nenhuma frase encontrada.</p>
                    )}
                  </div>
                </div>
              )}

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
                  chatHistory={localChatHistory}
                  onChatUpdate={handleChatUpdate}
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
                <p className="text-xs text-ink-500 mt-0.5">Prompt exato enviado ao modelo {
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-2.5-flash')
                }</p>
              </div>
              <button onClick={() => setShowPromptPreview(false)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed bg-ink-50 p-4 rounded-xl border border-ink-200">
                {(() => {
                  const { systemContext, userMessage } = buildPrompt({
                    template,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                    requestingPhysician: exam?.requestingPhysician,
                    anamnesis: exam?.anamnesis,
                  });
                  return `══ SYSTEM CONTEXT ══\n${systemContext}\n\n══ USER MESSAGE ══\n${userMessage}`;
                })()}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-ink-50/50 shrink-0">
              <span className="text-[10px] text-ink-400">
                Temperatura: {settings.aiTemperature ?? 0.3} · Modelo: {
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-2.5-flash')
                }
              </span>
              <button
                onClick={() => {
                  const { systemContext, userMessage } = buildPrompt({
                    template,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                    requestingPhysician: exam?.requestingPhysician,
                    anamnesis: exam?.anamnesis,
                  });
                  navigator.clipboard.writeText(`══ SYSTEM CONTEXT ══\n${systemContext}\n\n══ USER MESSAGE ══\n${userMessage}`);
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



      {showHistoryModal && exam && patient && (
        <ExamHistoryModal
          patient={patient}
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
            examDateMs={exam.createdAt}
            onClose={() => setShowCalculators(false)} 
            onSendToCopilot={(res) => {
              setCopilotPrompt(res);
              setShowCalculators(false);
              if (!showCopilot) setShowCopilot(true);
            }}
          />
        )}
      </AnimatePresence>

      {showAnamnesisConsent && exam && patient && (
        <AnamnesisConsentModal
          open={showAnamnesisConsent}
          onClose={() => setShowAnamnesisConsent(false)}
          exam={exam}
          patient={patient}
          template={template}
          clinic={clinic}
          settings={settings}
        />
      )}

      <PrintLayout
        patient={patient}
        clinic={clinic}
        settings={settings}
        examType={exam.examType}
        reportContent={reportContentRef.current}
        physicianName={exam.requestingPhysician}
        examDate={exam.createdAt}
      />

      {showDicomImages && exam && (
        <DicomImagesModal
          open={showDicomImages}
          onClose={() => setShowDicomImages(false)}
          exam={exam}
          settings={settings}
          onPrint={(instances, gridType) => {
            handlePrintImages(instances, gridType);
          }}
        />
      )}

      {selectedInstancesForPrint.length > 0 && exam && patient && (
        <PrintImagesLayout
          patient={patient}
          clinic={clinic}
          settings={settings}
          examType={exam.examType}
          examDate={exam.createdAt}
          selectedInstances={selectedInstancesForPrint}
          gridType={selectedGridType}
        />
      )}

      {showFullScreenImage && dicomInstances[activeImageIndex] && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setShowFullScreenImage(false)}
        >
          {/* Close Button */}
          <button 
            onClick={() => setShowFullScreenImage(false)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10 z-[210]"
            title="Fechar Tela Cheia"
          >
            <X size={24} />
          </button>

          {/* Navigation Buttons */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-2xl z-[210] cursor-pointer"
            title="Anterior (Seta Esquerda)"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-2xl z-[210] cursor-pointer"
            title="Próxima (Seta Direita)"
          >
            <ChevronRight size={32} />
          </button>

          {(() => {
            const activeInstance = dicomInstances[activeImageIndex];
            const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
            const previewUrl = `/api/orthanc-proxy?url=${encodeURIComponent(`${baseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
            const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

            return (
              <div className="relative max-w-full max-h-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={previewUrl} 
                  alt={`Instance ${instanceNum}`}
                  className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/5"
                />
                <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-black tracking-widest text-white uppercase select-none">
                  FOTO {activeImageIndex + 1} DE {dicomInstances.length} (INSTÂNCIA {instanceNum})
                </div>
              </div>
            );
          })()}
        </div>
      )}
        </div>
      )}
    </>
  );
}
