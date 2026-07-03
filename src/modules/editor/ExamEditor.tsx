import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDocument } from '../../hooks/useFirestore';
import { updateItem, getItem, getActivePacsUrl, getProxyEndpoint, logPatientAccess } from '../../store/db';
import { useApp } from '../../store/app';
import { ExamStatus, Patient, ReportTemplate, Clinic, ExamRequest } from '../../types';
import { LaudCopilot } from './LaudCopilot';
import { RichEditor, RichEditorRef } from './RichEditor';
import { buildPrompt } from '../ai/engine';
import { copyReportToClipboard } from '../export/docxExport';
import { deleteField } from 'firebase/firestore';
import { Loader2, AlertCircle, Eye, X, Copy, UserCog, Sparkles, BookOpen, Search, ChevronLeft, ChevronRight, ChevronDown, Zap, FileText, Star } from 'lucide-react';
import { addToExcellenceCorpus } from '../ai/training/excellenceCorpus';
import { ReportQualityPanel } from './components/ReportQualityPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '../../utils/format';
import { logger } from '../../utils/logger';
import { PrintLayout } from '../export/PrintLayout';
import { CalculatorModal } from '../calculators/CalculatorModal';
import { DicomImagesModal } from './components/DicomImagesModal';
import { PatientForm } from '../patients/PatientForm';
import { PrintImagesLayout } from '../export/PrintImagesLayout';
import { DicomThumbnail } from './components/DicomThumbnail';

// Refactored Hooks
import { useExamActions } from './hooks/useExamActions';
import { useGoogleDocs } from './hooks/useGoogleDocs';
import { useDicomSync } from './hooks/useDicomSync';
import { useCopilotSuggestions } from './hooks/useCopilotSuggestions';
import { getStudyInstanceUID } from '../../utils/dicom';

import { useAdmin } from '../../hooks/useAdmin';
// Refactored Components
import { DicomViewerSidebar } from './components/DicomViewerSidebar';
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { getInitialReportContent, sectionTogglesFromSettings } from '../templates/utils';
import { useConfirm } from '../../hooks/useConfirm';
import { ExamHistoryModal } from './components/ExamHistoryModal';
import { AnamnesisConsentModal } from './components/AnamnesisConsentModal';
import { ReportVersionsModal } from './components/ReportVersionsModal';




function PatientHistoryPanel({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-emerald-100 bg-emerald-50/20 shrink-0">
      <button
        onClick={() => setOpen(s => !s)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <UserCog size={13} className="text-emerald-600" />
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Histórico do Paciente</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <ChevronDown size={13} className={classNames("text-emerald-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-2 animate-in fade-in duration-150 border-t border-emerald-100/30">
          {patient.history && (
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-500 tracking-wider mb-1">Histórico Clínico</p>
              <p className="text-xs text-ink-700 leading-relaxed bg-white border border-emerald-100 rounded-xl p-3 whitespace-pre-wrap">{patient.history}</p>
            </div>
          )}
          {patient.notes && (
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-500 tracking-wider mb-1">Observações</p>
              <p className="text-xs text-ink-600 leading-relaxed bg-white border border-emerald-100 rounded-xl p-3 whitespace-pre-wrap">{patient.notes}</p>
            </div>
          )}
          {patient.insurance && (
            <p className="text-[10px] text-emerald-600 font-semibold">Convênio: {patient.insurance}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  examId: string;
}

export function ExamEditor({ examId }: Props) {
  const { isAdmin, role: currentRole } = useAdmin();
  const { setView, settings, showToast } = useApp();
  const confirm = useConfirm();

  // Firestore realtime listeners
  const { data: exam } = useDocument<ExamRequest>('exams', examId);
  const { data: dbPatient } = useDocument<Patient>('patients', exam?.patientId === 'ANONIMO' ? '' : (exam?.patientId || ''));
  const patient = exam?.patientId === 'ANONIMO' 
    ? ({ id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O', createdAt: Date.now(), updatedAt: Date.now() } as Patient)
    : dbPatient;
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);

  // Trilha de acesso LGPD: registra a abertura do laudo (exceto avulso/anônimo).
  useEffect(() => {
    if (exam?.id && exam.patientId !== 'ANONIMO') {
      logPatientAccess('exam', exam.id, `${exam.examType || 'Laudo'}${patient?.name ? ' — ' + patient.name : ''}`);
    }
  }, [exam?.id]);

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
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showCalculators, setShowCalculators] = useState(false);
  const [calcModalInitialId, setCalcModalInitialId] = useState<string | null>(null);
  const [showAnamnesisConsent, setShowAnamnesisConsent] = useState(false);
  const [showDicomImages, setShowDicomImages] = useState(false);
  const [selectedInstancesForPrint, setSelectedInstancesForPrint] = useState<any[]>([]);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [showSnippets, setShowSnippets] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [activePacsServer, setActivePacsServer] = useState<'primary' | 'backup' | 'both'>(() => {
    return (localStorage.getItem('laudus_active_pacs_server') as 'primary' | 'backup' | 'both') || 'both';
  });
  const [showStudySelector, setShowStudySelector] = useState(false);

  // Estado LOCAL do histórico do copiloto — evita spam de escritas no Firestore
  // durante o streaming (sem isso, cada chunk geraria uma escrita no Firestore).
  // O Firestore é atualizado de forma debounced a cada 1500ms sem novas mudanças.
  const [localChatHistory, setLocalChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const chatHistoryInitialized = useRef(false);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showIntegratedViewer, setShowIntegratedViewer] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [dicomRefreshKey, setDicomRefreshKey] = useState(0);

  const noopChangeStudy = useCallback((id: string | null) => {}, []);

  const {
    pacsConnected,
    pacsBackupConnected,
    candidateStudies,
    selectedStudyId,
    setSelectedStudyId,
    hasDicomImages,
    dicomInstances,
    dicomLoading,
    dicomError,
    dicomStatus,
    activeServer,
    lastErrorMessage
  } = useDicomSync({
    exam: exam || undefined,
    patient,
    settings,
    activePacsServer,
    changeSelectedStudy: noopChangeStudy,
    dicomRefreshKey,
    showIntegratedViewer,
    showDicomImages,
    isManualCheck: false
  });

  // Ao trocar de estudo PACS, volta para a primeira imagem do novo estudo.
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedStudyId]);

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex(prev => (prev < dicomInstances.length - 1 ? prev + 1 : prev));
  }, [dicomInstances.length]);

  // Keyboard navigation for DICOM viewer
  useEffect(() => {
    if (!showIntegratedViewer && !showFullScreenImage) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevImage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntegratedViewer, showFullScreenImage, handlePrevImage, handleNextImage]);
  const getExternalViewerUrl = useCallback(() => {
    if (!candidateStudies || candidateStudies.length === 0) return null;
    const activeStudy = candidateStudies.find(c => c.ID === selectedStudyId) || candidateStudies[0];
    if (!activeStudy) return null;

    const isBackup = activeStudy.serverSource === 'backup';
    const currentBaseUrl = isBackup 
      ? getActivePacsUrl(settings, true)
      : getActivePacsUrl(settings, false);
    const studyUid = activeStudy.MainDicomTags?.StudyInstanceUID || getStudyInstanceUID(exam?.id || '');

    const viewerType = settings.dicomViewerType || 'stone';
    if (viewerType === 'stone') {
      return `${currentBaseUrl.replace(/\/$/, '')}/stone-webviewer/index.html?study=${studyUid}`;
    } else if (viewerType === 'oe2') {
      return `${currentBaseUrl.replace(/\/$/, '')}/ui/app/retrieve-and-view.html?StudyInstanceUID=${studyUid}`;
    } else if (viewerType === 'ohif') {
      return `${currentBaseUrl.replace(/\/$/, '')}/viewer?StudyInstanceUIDs=${studyUid}`;
    } else if (viewerType === 'custom' && settings.dicomViewerUrlPattern) {
      return settings.dicomViewerUrlPattern
        .replace('{{baseUrl}}', currentBaseUrl.replace(/\/$/, ''))
        .replace('{{StudyInstanceUID}}', studyUid)
        .replace('{{examId}}', exam?.id || '');
    }
    return `${currentBaseUrl.replace(/\/$/, '')}/stone-webviewer/index.html?study=${studyUid}`;
  }, [candidateStudies, selectedStudyId, settings, exam?.id]);

  const externalViewerUrl = useMemo(() => getExternalViewerUrl(), [getExternalViewerUrl]);

  


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
        const initial = getInitialReportContent(template, sectionTogglesFromSettings(settings));
        setReportContent(initial);
        updateItem('exams', examId, { reportContent: initial });
      }
      setInitialized(true);
    }
  }, [exam, template, initialized, examId]);

  // Fix 13: auto-close copilot when exam is finalized
  useEffect(() => {
    if (exam?.status === 'finalizado' && showCopilot) {
      setShowCopilot(false);
    }
  }, [exam?.status, showCopilot]);

  // Actions Hook
  const {
    isGenerating,
    isReasoning,
    saveState,
    debouncedSave,
    handleRefine,
    updateStatus
  } = useExamActions({
    examId,
    settings,
    showToast,
    onReportChange: (html) => {
      setReportContent(html);
    },
    patient,
    template,
    clinicalIndication: exam?.clinicalIndication,
    requestingPhysician: exam?.requestingPhysician,
    anamnesis: exam?.anamnesis,
    examDateMs: exam?.createdAt
  });

  const { suggestions: copilotSuggestions, generateSuggestions, clearSuggestions } = useCopilotSuggestions(settings);

  // After report generation completes, quietly generate contextual Copilot suggestions
  const prevIsGenerating = useRef(false);
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating && reportContent && template?.area) {
      clearSuggestions();
      generateSuggestions(reportContent, template.area);
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating]);

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
    await updateStatus(newStatus, reportContentRef.current);
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

  // Corpus de Excelência (Fase 3): marca o laudo atual como exemplar.
  const [markingExcellent, setMarkingExcellent] = useState(false);
  const handleMarkExcellent = useCallback(async () => {
    if (!exam || !template || !reportContent) return;
    setMarkingExcellent(true);
    try {
      await addToExcellenceCorpus({
        area: template.area,
        examType: template.name,
        motor: settings.selectedMotor === 'pro' ? 'pro' : 'lite',
        reportHtml: reportContent,
        clinicalIndication: exam.clinicalIndication,
        anamnesis: (exam as any).anamnesis,
        patient,
        qualityTags: ['estrutura', 'fraseologia'],
        sourceExamId: examId,
        settings,
      });
      showToast('Laudo adicionado ao Corpus de Excelência ⭐', 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao adicionar ao corpus';
      showToast(message, 'error');
    } finally {
      setMarkingExcellent(false);
    }
  }, [exam, template, patient, reportContent, settings, examId, showToast]);

  const handleReset = useCallback(async () => {
    if (!template) return;
    const ok = await confirm({
      title: 'Reiniciar Laudo',
      message: 'Deseja reiniciar o laudo para o padrão da máscara? Isso apagará as alterações atuais.',
      confirmLabel: 'Reiniciar',
      variant: 'warning',
    });
    if (ok) {
      const initial = getInitialReportContent(template, sectionTogglesFromSettings(settings));
      setReportContent(initial);
      await updateItem('exams', examId, { reportContent: initial });
      showToast('Laudo reiniciado para o padrão da máscara', 'success');
    }
  }, [template, examId, showToast, confirm]);



  // Grid types: '1x2' = 1 coluna × 2 linhas (2 imagens), '2x4' = 2 colunas × 4 linhas (8 imagens)
  const [selectedGridType, setSelectedGridType] = useState<string>('2x4');
  const [isPrintingImages, setIsPrintingImages] = useState(false);
  const [printProgress, setPrintProgress] = useState<string>('');
  const [printLocalUrls, setPrintLocalUrls] = useState<Record<string, string>>({});

  const handlePrintImages = async (instances: any[], gridType: string = '2x4') => {
    if (instances.length === 0) return;
    setIsPrintingImages(true);
    setPrintProgress(`Otimizando imagens (0/${instances.length})...`);
    showToast('Preparando imagens para a impressão...', 'info');

    const localUrlsMap: Record<string, string> = {};
    const primaryBaseUrl = getActivePacsUrl(settings, false);
    const backupBaseUrl = getActivePacsUrl(settings, true);

    try {
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        setPrintProgress(`Otimizando imagens (${i + 1}/${instances.length})...`);
        const isBackup = instance.serverSource === 'backup';
        const serverUrl = isBackup ? backupBaseUrl : primaryBaseUrl;
        const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
        const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
        const proxyPath = getProxyEndpoint(settings, isBackup);
        const url = `${proxyPath}?url=${encodeURIComponent(`${serverUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

        // Fetch the image as blob
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        localUrlsMap[instance.ID] = blobUrl;
      }

      setPrintLocalUrls(localUrlsMap);
      setSelectedInstancesForPrint(instances);
      setSelectedGridType(gridType);
      
      document.body.classList.add('print-mode-images');
      
      // Tiny delay to let DOM render the images loaded from local blob URLs
      setTimeout(() => {
        window.print();
        document.body.classList.remove('print-mode-images');
        setIsPrintingImages(false);
        setPrintProgress('');
        
        // Delay resetting instances and revoking object URLs to avoid tearing during viewport restore
        setTimeout(() => {
          setSelectedInstancesForPrint([]);
          // Revoke local object URLs to free up memory
          Object.values(localUrlsMap).forEach(url => {
            URL.revokeObjectURL(url);
          });
          setPrintLocalUrls({});
        }, 500);
      }, 300);
    } catch (err) {
      logger.error('[PACS Print Preload Error]', err);
      showToast('Erro ao carregar imagens para a impressão.', 'error');
      setIsPrintingImages(false);
      setPrintProgress('');
      // Clean up any successfully created blobs in case of partial success / error
      Object.values(localUrlsMap).forEach(url => {
        URL.revokeObjectURL(url);
      });
      setPrintLocalUrls({});
    }
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
        debouncedSave(reportContent, true);
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

  // Timeout to prevent infinite loading
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoadTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {(!exam || !patient || (!template && !loadTimeout)) ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 size={24} className="animate-spin-slow text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-ink-500">
              Carregando exame...
            </p>
            {loadTimeout && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-xs max-w-xs text-left shadow-sm border border-red-100">
                <p className="font-bold mb-1">Diagnóstico de Falha:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {!exam && <li>O exame não foi encontrado.</li>}
                  {!patient && <li>O paciente do exame não foi encontrado.</li>}
                  {!template && <li>A máscara do exame não foi encontrada (ou você não tem permissão).</li>}
                </ul>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md font-medium transition-colors w-full"
                >
                  Recarregar Página
                </button>
              </div>
            )}
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
            dicomStatus={dicomStatus}
            activeServer={activeServer}
            lastErrorMessage={lastErrorMessage}
            googleDocUrl={exam.googleDocUrl || null}
            saveState={saveState}
          />

          {/* Corpus de Excelência — disponível ao finalizar com treino ativo */}
          {settings.aiTrainingEnabled && exam.status === 'finalizado' && currentRole !== 'recepcao' && (
            <div className="bg-amber-50/60 border-b border-amber-100 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
              <Star size={12} className="text-amber-500" />
              <span>Laudo exemplar? Adicione ao Corpus de Excelência para a IA aprender seu padrão (anonimizado).</span>
              <button
                className="underline ml-1 font-medium disabled:opacity-50 inline-flex items-center gap-1"
                onClick={handleMarkExcellent}
                disabled={markingExcellent}
              >
                {markingExcellent ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
                Marcar como Excelente
              </button>
            </div>
          )}

          {/* AVISO API KEY — apenas para Gemini (Anthropic é gerenciado server-side) */}
          {settings.aiProvider === 'gemini' && !settings.geminiApiKey && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
              <AlertCircle size={12} />
              <span>API Key do Gemini não configurada — geração em <strong>modo demo</strong>.</span>
              <button className="underline ml-1 font-medium" onClick={() => setView({ name: 'settings' })}>Configurar</button>
            </div>
          )}

          <div className="flex-1 flex min-h-0 relative overflow-hidden bg-ink-50/20">
            {/* Integrated Dicom Image Viewer Sidebar */}
            {showIntegratedViewer && (
              <DicomViewerSidebar
                dicomInstances={dicomInstances}
                activeImageIndex={activeImageIndex}
                setActiveImageIndex={setActiveImageIndex}
                handlePrevImage={handlePrevImage}
                handleNextImage={handleNextImage}
                selectedStudyId={selectedStudyId}
                setSelectedStudyId={setSelectedStudyId}
                candidateStudies={candidateStudies}
                settings={settings}
                dicomLoading={dicomLoading}
                dicomError={dicomError}
                setDicomRefreshKey={setDicomRefreshKey}
                setShowFullScreenImage={setShowFullScreenImage}
                onClose={() => setShowIntegratedViewer(false)}
                showStudySelector={showStudySelector}
                setShowStudySelector={setShowStudySelector}
                pacsConnected={pacsConnected}
                pacsBackupConnected={pacsBackupConnected}
                activePacsServer={activePacsServer}
                setActivePacsServer={setActivePacsServer}
                externalViewerUrl={externalViewerUrl}
                setShowDicomImages={setShowDicomImages}
              />
            )}

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col min-w-0 mr-0">
              {/* Section Progress Bar — real state vinculada ao isGenerating */}
              <div className="h-1 bg-ink-100/50 w-full shrink-0 relative overflow-hidden">
                {isGenerating && (
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                )}
              </div>

              <EditorToolbar
                isGenerating={isGenerating}
                hasReport={!!reportContent}
                isTemplateMask={
                  template
                    ? (() => {
                        const initialContent = getInitialReportContent(template, sectionTogglesFromSettings(settings));
                        const cleanCurrent = reportContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                        const cleanInitial = initialContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                        return cleanCurrent === '' || cleanCurrent === cleanInitial;
                      })()
                    : true
                }
                status={exam.status}
                examArea={exam.area || template?.area}
                hasGoogleDoc={!!exam.googleDocId}
                onCopy={handleCopy}
                onShowCalculators={(calcId) => { setCalcModalInitialId(calcId || null); setShowCalculators(true); }}
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
                onShowVersions={() => setShowVersionsModal(true)}
                onToggleSnippets={() => { setShowSnippets(s => !s); setSnippetSearch(''); }}
                snippetsOpen={showSnippets}
                snippetCount={settings.snippets?.length ?? 0}
                saveState={saveState}
                geminiModel={
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-3.5-flash')
                }
              />

              {/* ── Avaliação de Qualidade (auditoria + anti-alucinação) ── */}
              {!isGenerating && currentRole !== 'recepcao' && (() => {
                const initialContent = template ? getInitialReportContent(template, sectionTogglesFromSettings(settings)) : '';
                const cleanCurrent = reportContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                const cleanInitial = initialContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                const isMask = cleanCurrent === '' || cleanCurrent === cleanInitial;
                if (isMask) return null;
                return (
                  <ReportQualityPanel
                    html={reportContent}
                    area={exam.area || template?.area}
                    anamnesis={(exam as any).anamnesis}
                    clinicalIndication={exam.clinicalIndication}
                  />
                );
              })()}

              {/* ── LAUD.IA Cascade Status Hint ── */}
              {isAdmin && template && !template.aiInstructions?.trim() && currentRole !== 'recepcao' && (
                <div className="border-b border-violet-100 bg-violet-50/50 px-4 py-2 shrink-0 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-violet-400 shrink-0" />
                    <span className="text-[10px] text-violet-600 font-semibold">
                      <span className="font-black text-violet-700">LAUD.IA:</span> Cascata ativa com{' '}
                      {settings.aiAreaPrompts?.[template.area as import('../../types').ExamArea]
                        ? <span className="text-emerald-600 font-black">Camada 1 + Área customizada</span>
                        : <span className="text-blue-600 font-black">Camada 1 + Área padrão V2.0</span>
                      }. Sem instruções específicas para este exame (Camada 3 vazia).
                    </span>
                  </div>
                  <button
                    onClick={() => setView({ name: 'laud-ia' })}
                    className="text-[10px] font-black text-violet-600 hover:text-violet-800 uppercase tracking-widest whitespace-nowrap flex items-center gap-1 transition-colors"
                    title="Abrir LAUD.IA para configurar o prompt deste exame"
                  >
                    <Sparkles size={10} />
                    Configurar →
                  </button>
                </div>
              )}

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

              {/* ── Anamnese Panel ── */}
              <div className="border-b border-indigo-100 bg-indigo-50/20 shrink-0">
                <button
                  onClick={() => setShowCustomForm(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-indigo-650" />
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Anamnese</span>
                    {exam.anamnesis && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>
                  <ChevronDown size={13} className={classNames("text-indigo-500 transition-transform", showCustomForm && "rotate-180")} />
                </button>
                {showCustomForm && (
                  <div className="px-4 pb-4 space-y-4 animate-in fade-in duration-150 border-t border-indigo-100/30 pt-3">
                    {/* Anamnesis Field */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Anamnese / Queixas Clínicas</label>
                      <textarea
                        value={exam.anamnesis || ''}
                        onChange={(e) => updateItem('exams', exam.id, { anamnesis: e.target.value })}
                        disabled={exam.status === 'finalizado' || currentRole === 'recepcao'}
                        rows={4}
                        className="w-full text-xs font-semibold text-ink-700 bg-white border border-indigo-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed placeholder-ink-400"
                        placeholder="Escreva os sintomas, queixas clínicas ou histórico clínico rápido do paciente..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Histórico Clínico do Paciente (C2) ── */}
              {patient && (patient.history || patient.notes || patient.insurance) && (
                <PatientHistoryPanel patient={patient} />
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
                        <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] ml-1">
                          {isReasoning ? 'Raciocínio Clínico LAUD.IA' : 'Processamento LAUD.IA'}
                        </p>
                        <p className="text-xl font-black text-ink-900 tracking-tight">
                          {isReasoning ? 'Analisando Estruturas e Medidas' : 'Otimizando Inteligência Clínica'}
                        </p>
                        <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest pt-1">
                          {isReasoning ? 'A IA está realizando a auto-auditoria clínica...' : 'Aguarde a finalização dos tópicos...'}
                        </p>
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
                      isGenerating={isGenerating}
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
              className="fixed inset-x-0 top-0 w-full h-dvh rounded-none lg:inset-auto lg:bottom-24 lg:right-10 lg:w-[420px] lg:h-[72vh] lg:max-h-[660px] bg-white lg:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-ink-100 flex flex-col z-[300] overflow-hidden"
            >
              {/* Premium Header with Mesh-style Gradient */}
              <div className="px-6 py-4 border-b border-ink-100 bg-ink-900 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600/30 via-brand-800/10 to-transparent pointer-events-none" />
                <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse pointer-events-none" />
                
                <div className="relative flex items-center gap-3 z-10">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-xl">
                    <Sparkles size={16} className="text-brand-400 fill-brand-400/25 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-black text-xs uppercase tracking-widest block leading-none">Laud.IA Copiloto</span>
                    <span className="text-[9px] text-ink-400 font-bold uppercase tracking-tighter pt-0.5 block">Assistente de Co-autoria</span>
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
                  onShowCalculators={(id) => {
                    setCalcModalInitialId(id || null);
                    setShowCalculators(true);
                  }}
                  prompt={copilotPrompt}
                  onChangePrompt={setCopilotPrompt}
                  isDocked={false}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Suggestion chips from B6 proactive AI — appear above FAB after generation */}
        <AnimatePresence>
          {!showCopilot && copilotSuggestions.length > 0 && exam.status !== 'finalizado' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-44 md:bottom-28 right-6 md:right-8 z-[79] flex flex-col gap-1.5 items-end"
            >
              {copilotSuggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCopilotPrompt(sug.text);
                    setShowCopilot(true);
                  }}
                  className="max-w-[220px] px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-brand-200 text-brand-800 rounded-full text-[11px] font-semibold shadow-md hover:bg-brand-50 hover:border-brand-400 transition-all active:scale-95 text-right"
                >
                  {sug.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Toggle Copilot — oculto e fechado ao finalizar */}
        {exam.status !== 'finalizado' ? (
          <button
            onClick={() => { setShowCopilot(!showCopilot); if (!showCopilot) clearSuggestions(); }}
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
        ) : null}
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
      {isAdmin && showPromptPreview && template && patient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowPromptPreview(false)}>
          <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-ink-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Eye size={16} className="text-brand-500" /> Prompt Preview</h3>
                <p className="text-xs text-ink-500 mt-0.5">Prompt exato enviado ao modelo {
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-3.5-flash')
                }</p>
              </div>
              <button onClick={() => setShowPromptPreview(false)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed bg-ink-50 p-4 rounded-xl border border-ink-200">
                {(() => {
                  const { universalContext, areaContext, userMessage } = buildPrompt({
                    template,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                    requestingPhysician: exam?.requestingPhysician,
                    anamnesis: exam?.anamnesis,
                  });
                  const systemContext = universalContext + (areaContext ? '\n\n' + areaContext : '');
                  return `══ SYSTEM CONTEXT ══\n${systemContext}\n\n══ USER MESSAGE ══\n${userMessage}`;
                })()}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-ink-50/50 shrink-0">
              <span className="text-[10px] text-ink-400">
                Temperatura: {settings.aiTemperature ?? 0.3} · Modelo: {
                  settings.aiProvider === 'anthropic'
                    ? (settings.anthropicModel || 'claude-3-5-sonnet-latest')
                    : (settings.geminiModel || 'gemini-3.5-flash')
                }
              </span>
              <button
                onClick={() => {
                  const { universalContext, areaContext, userMessage } = buildPrompt({
                    template,
                    patient,
                    settings,
                    clinicalIndication: exam?.clinicalIndication,
                    requestingPhysician: exam?.requestingPhysician,
                    anamnesis: exam?.anamnesis,
                  });
                  const systemContext = universalContext + (areaContext ? '\n\n' + areaContext : '');
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



      {showVersionsModal && exam && (
        <ReportVersionsModal
          exam={exam}
          currentContent={reportContent}
          onRestore={(content) => {
            setReportContent(content);
            updateItem('exams', exam.id, { reportContent: content });
          }}
          onClose={() => setShowVersionsModal(false)}
          showToast={showToast}
        />
      )}

      {/* Keyboard Shortcuts Bar */}
      <div className="hidden lg:flex items-center gap-5 px-4 py-1.5 bg-ink-900 text-ink-400 text-[10px] font-mono shrink-0">
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘G</kbd> Gerar IA</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘⇧C</kbd> Copiar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘S</kbd> Salvar</span>
        <span><kbd className="px-1 py-0.5 rounded bg-ink-800 text-ink-300 mr-1">⌘↵</kbd> Finalizar</span>
      </div>

      <AnimatePresence>
          {showCalculators && (
          <CalculatorModal
            initialCalcId={calcModalInitialId || undefined}
            area={exam.area}
            examDateMs={exam.createdAt}
            onClose={() => setShowCalculators(false)}
            onSendToCopilot={(text) => {
              setCopilotPrompt((prev) => (prev ? `${prev}\n\n${text}` : text));
              setShowCalculators(false);
              if (!showCopilot) setShowCopilot(true);
            }}
            onInsertToReport={(html) => {
              editorRef.current?.insertContent(html);
              setShowCalculators(false);
            }}
            calculatorData={exam.calculatorData}
            onSaveCalculatorData={async (data) => {
              await updateItem('exams', exam.id, { calculatorData: data });
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
          instances={dicomInstances}
          loading={dicomLoading}
          error={dicomError}
          onRefresh={() => setDicomRefreshKey(prev => prev + 1)}
          onPrint={(instances, gridType) => {
            handlePrintImages(instances, gridType);
          }}
          activePacsServer={activePacsServer}
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
          localUrls={printLocalUrls}
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
            const activeStudy = candidateStudies.find(c => c.ID === selectedStudyId);
            const activeServerSource = activeStudy?.serverSource || 'primary';
            const isBackup = activeServerSource === 'backup';
            const currentBaseUrl = getActivePacsUrl(settings, isBackup);
            const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
            const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
            const proxyPath = getProxyEndpoint(settings, isBackup);
            const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

            return (
              <div 
                className="relative max-w-full max-h-full flex flex-col items-center gap-4" 
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    handlePrevImage();
                  } else if (e.deltaY > 0) {
                    handleNextImage();
                  }
                }}
              >
                <DicomThumbnail 
                  src={previewUrl} 
                  alt={`Instance ${instanceNum}`}
                  className="max-w-[95vw] max-h-[85vh] rounded-lg shadow-2xl border border-white/5"
                  containerClassName="bg-transparent"
                  priority={true}
                />
                <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-black tracking-widest text-white uppercase select-none z-10">
                  FOTO {activeImageIndex + 1} DE {dicomInstances.length} (INSTÂNCIA {instanceNum})
                </div>
              </div>
            );
          })()}
        </div>
      )}
        </div>
      )}
      {isPrintingImages && (
        <div className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in text-white font-sans select-none">
          <Loader2 size={40} className="animate-spin text-emerald-500" />
          <div className="text-center space-y-1.5">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-100">Otimizando imagens para impressão</h3>
            <p className="text-xs text-emerald-400 font-black tracking-widest">{printProgress}</p>
          </div>
        </div>
      )}
    </>
  );
}
