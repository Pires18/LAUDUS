import { useEffect, useState, useCallback, useRef } from 'react';
import { useDocument, useCollection } from '../../hooks/useFirestore';
import { updateItem, getItem, getActivePacsUrl, getProxyEndpoint } from '../../store/db';
import { useApp } from '../../store/app';
import { ExamStatus, EXAM_AREAS, Patient, ReportTemplate, Clinic, ExamRequest } from '../../types';
import { LaudCopilot } from './LaudCopilot';
import { RichEditor, RichEditorRef } from './RichEditor';
import { buildPrompt } from '../ai/gemini';
import { copyReportToClipboard } from '../export/docxExport';
import { deleteField } from 'firebase/firestore';
import { Loader2, AlertCircle, AlertTriangle, Eye, X, Copy, UserCog, Sparkles, BookOpen, Search, ChevronLeft, ChevronRight, Printer, RefreshCw, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '../../utils/format';
import { PrintLayout } from '../export/PrintLayout';
import { CalculatorModal } from '../calculators/CalculatorModal';
import { DicomImagesModal } from './components/DicomImagesModal';
import { PatientForm } from '../patients/PatientForm';
import { PrintImagesLayout } from '../export/PrintImagesLayout';
import { DicomThumbnail } from './components/DicomThumbnail';

// Refactored Hooks
import { useExamActions } from './hooks/useExamActions';
import { useGoogleDocs } from './hooks/useGoogleDocs';

// Refactored Components
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { getInitialReportContent } from '../templates/utils';
import { ExamHistoryModal } from './components/ExamHistoryModal';
import { AnamnesisConsentModal } from './components/AnamnesisConsentModal';
import { ReportVersionsModal } from './components/ReportVersionsModal';

const locateStudies = async (
  baseUrl: string,
  authParams: string,
  exam: ExamRequest,
  patient: Patient | null,
  serverSource: 'primary' | 'backup',
  settings: any
): Promise<any[]> => {
  const findUrl = `${baseUrl.replace(/\/$/, '')}/tools/find`;
  
  const queryOrthanc = async (query: any) => {
    try {
      const proxyPath = getProxyEndpoint(settings, serverSource === 'backup');
      const res = await fetch(
        `${proxyPath}?url=${encodeURIComponent(findUrl)}${authParams}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Level: 'Study',
            Expand: true,
            Query: query
          })
        }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[locateStudy Query Error]', err);
      return [];
    }
  };

  const candidatesMap = new Map<string, any>();

  const processResults = (list: any[]) => {
    let found = false;
    for (const item of (list || [])) {
      if (item) {
        if (typeof item === 'string') {
          candidatesMap.set(item, { ID: item, MainDicomTags: {}, serverSource });
          found = true;
        } else {
          const id = item.ID || item.id;
          if (id) {
            candidatesMap.set(id, { ...item, ID: id, serverSource });
            found = true;
          }
        }
      }
    }
    return found;
  };

  const studyUid = `1.2.276.0.7230010.3.1.2.${exam.id}`;
  
  // Phase 1: Exact unique matches (StudyInstanceUID & AccessionNumber)
  const exactQueries = [
    queryOrthanc({ StudyInstanceUID: studyUid }),
    queryOrthanc({ AccessionNumber: exam.id })
  ];
  if (exam.friendlyId) {
    exactQueries.push(queryOrthanc({ AccessionNumber: exam.friendlyId }));
  }

  const exactResults = await Promise.all(exactQueries);
  let hasExact = false;
  for (const list of exactResults) {
    if (processResults(list)) hasExact = true;
  }

  // Se já encontrou um estudo pelos identificadores exatos,
  // aborta as buscas por PatientID para evitar lentidão excessiva no servidor Orthanc.
  if (hasExact) {
    return Array.from(candidatesMap.values());
  }

  // Phase 2: Patient ID Fallback
  const patientIds = new Set<string>();
  if (exam.patientId) patientIds.add(exam.patientId);
  if (patient?.id) patientIds.add(patient.id);
  patientIds.add(exam.id);

  const patientQueries = Array.from(patientIds).map(pid => queryOrthanc({ PatientID: pid }));
  const patientResults = await Promise.all(patientQueries);
  
  for (const list of patientResults) {
    processResults(list);
  }

  return Array.from(candidatesMap.values());
};

const scoreStudies = (candidates: any[], examTime: number): any[] => {
  const scored = candidates.map((c) => {
    const studyDate = c.MainDicomTags?.StudyDate || ''; // YYYYMMDD
    const studyTime = c.MainDicomTags?.StudyTime || '000000'; // HHMMSS
    
    let diffMs = Infinity;
    if (studyDate.length === 8) {
      const year = parseInt(studyDate.substring(0, 4), 10);
      const month = parseInt(studyDate.substring(4, 6), 10) - 1;
      const day = parseInt(studyDate.substring(6, 8), 10);
      
      let hour = 0, minute = 0, second = 0;
      if (studyTime.length >= 6) {
        hour = parseInt(studyTime.substring(0, 2), 10);
        minute = parseInt(studyTime.substring(2, 4), 10);
        second = parseInt(studyTime.substring(4, 6), 10);
      }
      
      const sDate = new Date(year, month, day, hour, minute, second);
      diffMs = Math.abs(sDate.getTime() - examTime);
    }
    return { study: c, diffMs };
  });

  // Sort by time difference ascending
  scored.sort((a, b) => a.diffMs - b.diffMs);
  return scored.map(item => item.study);
};

const preloadImages = (urls: string[]): Promise<void> => {
  return new Promise((resolve) => {
    if (urls.length === 0) {
      resolve();
      return;
    }
    let loadedCount = 0;
    const total = urls.length;
    
    const checkResolve = () => {
      loadedCount++;
      if (loadedCount === total) {
        resolve();
      }
    };

    urls.forEach(url => {
      const img = new Image();
      img.onload = checkResolve;
      img.onerror = checkResolve; // Resolve anyway on error to avoid hanging
      img.src = url;
    });
  });
};

interface Props {
  examId: string;
}

export function ExamEditor({ examId }: Props) {
  const { setView, settings, showToast } = useApp();
  const currentRole = settings.currentRole || 'medico';

  // Firestore realtime listeners
  const { data: exam } = useDocument<ExamRequest>('exams', examId);
  const { data: dbPatient } = useDocument<Patient>('patients', exam?.patientId === 'ANONIMO' ? '' : (exam?.patientId || ''));
  const patient = exam?.patientId === 'ANONIMO' 
    ? ({ id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O', createdAt: Date.now(), updatedAt: Date.now() } as Patient)
    : dbPatient;
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
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showCalculators, setShowCalculators] = useState(false);
  const [showAnamnesisConsent, setShowAnamnesisConsent] = useState(false);
  const [showDicomImages, setShowDicomImages] = useState(false);
  const [selectedInstancesForPrint, setSelectedInstancesForPrint] = useState<any[]>([]);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [showSnippets, setShowSnippets] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [pacsConnected, setPacsConnected] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [pacsBackupConnected, setPacsBackupConnected] = useState<'loading' | 'connected' | 'disconnected' | 'disabled'>('loading');
  const [candidateStudies, setCandidateStudies] = useState<any[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const selectedStudyIdRef = useRef<string | null>(null);
  const [activePacsServer, setActivePacsServer] = useState<'primary' | 'backup' | 'both'>(() => {
    return (localStorage.getItem('laudus_active_pacs_server') as 'primary' | 'backup' | 'both') || 'both';
  });
  const changeSelectedStudy = useCallback((id: string | null) => {
    setSelectedStudyId(id);
    selectedStudyIdRef.current = id;
  }, []);
  const [showStudySelector, setShowStudySelector] = useState(false);

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
  const [dicomLoading, setDicomLoading] = useState(false);
  const [dicomError, setDicomError] = useState<string | null>(null);
  const [dicomRefreshKey, setDicomRefreshKey] = useState(0);
  const getExternalViewerUrl = useCallback(() => {
    if (!candidateStudies || candidateStudies.length === 0) return null;
    const activeStudy = candidateStudies.find(c => c.ID === selectedStudyId) || candidateStudies[0];
    if (!activeStudy) return null;

    const isBackup = activeStudy.serverSource === 'backup';
    const currentBaseUrl = isBackup 
      ? getActivePacsUrl(settings, true)
      : getActivePacsUrl(settings, false);
    const studyUid = activeStudy.MainDicomTags?.StudyInstanceUID || `1.2.276.0.7230010.3.1.2.${exam?.id}`;

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
  const dicomLoadingRef = useRef(false);
  // Refs para showIntegratedViewer e showDicomImages — permite que o polling
  // leia os valores mais recentes SEM precisar recriar o intervalo a cada render.
  const showIntegratedViewerRef = useRef(showIntegratedViewer);
  const showDicomImagesRef = useRef(showDicomImages);
  useEffect(() => { showIntegratedViewerRef.current = showIntegratedViewer; }, [showIntegratedViewer]);
  useEffect(() => { showDicomImagesRef.current = showDicomImages; }, [showDicomImages]);

  // Reseta o índice SOMENTE quando muda o estudo selecionado (não quando o array é recriado pelo polling)
  const lastStudyIdForIndexRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedStudyId !== lastStudyIdForIndexRef.current) {
      lastStudyIdForIndexRef.current = selectedStudyId;
      setActiveImageIndex(0);
    }
  }, [selectedStudyId]);

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

  const fetchInstancesForStudy = useCallback(async (studyId: string, serverSource: 'primary' | 'backup') => {
    const isBackupStudy = serverSource === 'backup';
    const currentUrl = isBackupStudy ? (settings.dicomBackupViewerUrl || 'http://localhost:8042') : (settings.dicomViewerUrl || 'http://localhost:8042');
    const currentAuth = isBackupStudy 
      ? `&username=${encodeURIComponent(settings.dicomBackupUsername || '')}&password=${encodeURIComponent(settings.dicomBackupPassword || '')}` 
      : `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
    const instancesUrl = `${currentUrl.replace(/\/$/, '')}/studies/${studyId}/instances`;
    const proxyPath = getProxyEndpoint(settings, isBackupStudy);
    
    try {
      const instancesRes = await fetch(`${proxyPath}?url=${encodeURIComponent(instancesUrl)}${currentAuth}`);
      if (!instancesRes.ok) throw new Error();
      const instances = await instancesRes.json();
      
      const sorted = (instances || []).sort((a: any, b: any) => {
        const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
        const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
        return numA - numB;
      });

      const taggedInstances = sorted.map((inst: any) => ({
        ...inst,
        serverSource
      }));

      setDicomInstances(prev => {
        if (prev.length === taggedInstances.length && prev.every((inst, i) => inst.ID === taggedInstances[i]?.ID)) {
          return prev;
        }
        return taggedInstances;
      });
      setHasDicomImages(taggedInstances.length > 0);
      setDicomError(null);
    } catch (e) {
      console.warn('[PACS Instances] Falha ao obter instâncias', e);
    }
  }, [settings]);

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

    const checkImages = async (isManual = false) => {
      if (!isManual && dicomLoadingRef.current) return;
      dicomLoadingRef.current = true;
      if (isManual) {
        setDicomLoading(true);
        setDicomError(null);
      }
      try {
        const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
        const authParams = `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
        
        const backupUrl = settings.dicomBackupViewerUrl;
        const backupAuth = backupUrl ? `&username=${encodeURIComponent(settings.dicomBackupUsername || '')}&password=${encodeURIComponent(settings.dicomBackupPassword || '')}` : '';

        const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs = 2500) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return res;
          } catch (err) {
            clearTimeout(id);
            throw err;
          }
        };

        const processServer = async (source: 'primary' | 'backup', serverBaseUrl: string, serverAuth: string) => {
          const proxyPath = getProxyEndpoint(settings, source === 'backup');
          const pingUrl = `${serverBaseUrl.replace(/\/$/, '')}/system`;
          let pingOk = false;
          try {
            const res = await fetchWithTimeout(`${proxyPath}?url=${encodeURIComponent(pingUrl)}${serverAuth}`);
            pingOk = res.ok;
          } catch {
            pingOk = false;
          }

          if (active) {
            if (source === 'primary') setPacsConnected(pingOk ? 'connected' : 'disconnected');
            if (source === 'backup') setPacsBackupConnected(pingOk ? 'connected' : 'disconnected');
          }

          if (!pingOk) return { source, candidates: [], pingOk: false };

          const candidates = await locateStudies(serverBaseUrl, serverAuth, exam, patient, source, settings);
          return { source, candidates, pingOk: true };
        };

        const queryPrimary = activePacsServer !== 'backup';
        const queryBackup = activePacsServer !== 'primary' && !!backupUrl;

        if (active) {
          if (!queryPrimary) setPacsConnected('disconnected');
          if (!queryBackup) setPacsBackupConnected(backupUrl ? 'disconnected' : 'disabled');
        }

        const primaryPromise = queryPrimary 
          ? processServer('primary', baseUrl, authParams) 
          : Promise.resolve({ source: 'primary' as const, candidates: [], pingOk: false });
          
        const backupPromise = queryBackup 
          ? processServer('backup', backupUrl, backupAuth) 
          : Promise.resolve({ source: 'backup' as const, candidates: [], pingOk: false });

        const [primaryRes, backupRes] = await Promise.allSettled([primaryPromise, backupPromise]);

        let mergedCandidates: any[] = [];
        if (primaryRes.status === 'fulfilled' && primaryRes.value.candidates) {
          mergedCandidates = [...mergedCandidates, ...primaryRes.value.candidates];
        }
        if (backupRes.status === 'fulfilled' && backupRes.value.candidates) {
          for (const c of backupRes.value.candidates) {
            if (!mergedCandidates.some(mc => mc.ID === c.ID)) {
              mergedCandidates.push(c);
            }
          }
        }

        if (active) {
          setCandidateStudies(mergedCandidates);
        }

        if (mergedCandidates.length === 0) {
          if (isManual && active) {
            setDicomInstances([]);
            setHasDicomImages(false);
            setDicomError(`Estudo não localizado nos servidores ativos.`);
          }
          return;
        }

        let activeStudy = null;
        const currentSelectedId = selectedStudyIdRef.current;
        if (currentSelectedId) {
          activeStudy = mergedCandidates.find(c => c.ID === currentSelectedId);
        }
        if (!activeStudy && mergedCandidates.length > 0) {
          const sorted = scoreStudies(mergedCandidates, exam.createdAt);
          activeStudy = sorted[0];
          if (active) {
            changeSelectedStudy(activeStudy.ID);
          }
        }

        if (activeStudy) {
          await fetchInstancesForStudy(activeStudy.ID, activeStudy.serverSource);
        }
      } catch (e: any) {
        console.warn('[PACS Check] Erro ao checar imagens no Orthanc:', e);
        if (active && isManual) {
          setDicomError(e.message || 'Erro de conexão com o servidor local Orthanc.');
        }
      } finally {
        dicomLoadingRef.current = false;
        if (active && isManual) {
          setDicomLoading(false);
        }
      }
    };

    // Initial check (manual to show initial loaders/errors if any)
    checkImages(true);

    // Fix 7: Adaptive polling — 5s when viewer/modal open, 30s in background
    // Uses refs (showIntegratedViewerRef, showDicomImagesRef) to read latest state
    // without recreating the interval on every state change.
    let tickCount = 0;
    const intervalId = setInterval(() => {
      tickCount++;
      const viewerOpen = showIntegratedViewerRef.current || showDicomImagesRef.current;
      // 5s always runs; background skips 5 out of 6 ticks (effectively 30s)
      if (viewerOpen || tickCount % 6 === 0) {
        checkImages(false);
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [
    exam?.id,
    patient?.id,
    settings.dicomSyncEnabled,
    settings.dicomViewerUrl,
    settings.dicomUsername,
    settings.dicomPassword,
    settings.dicomBackupViewerUrl,
    settings.dicomBackupUsername,
    settings.dicomBackupPassword,
    dicomRefreshKey,
    activePacsServer
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

  // Fix 13: auto-close copilot when exam is finalized
  useEffect(() => {
    if (exam?.status === 'finalizado' && showCopilot) {
      setShowCopilot(false);
    }
  }, [exam?.status, showCopilot]);

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



  // Grid types: '1x2' = 1 coluna × 2 linhas (2 imagens), '2x4' = 2 colunas × 4 linhas (8 imagens)
  const [selectedGridType, setSelectedGridType] = useState<string>('2x4');
  const [isPrintingImages, setIsPrintingImages] = useState(false);

  const handlePrintImages = async (instances: any[], gridType: string = '2x4') => {
    if (instances.length === 0) return;
    setIsPrintingImages(true);
    showToast('Preparando imagens para a impressão...', 'info');

    try {
      const primaryBaseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
      const backupBaseUrl = settings.dicomBackupViewerUrl || primaryBaseUrl;

      // Fix 15: use correct server credentials (backup vs primary) per instance
      const urls = instances.map(instance => {
        const isBackup = instance.serverSource === 'backup';
        const serverUrl = isBackup ? backupBaseUrl : primaryBaseUrl;
        const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
        const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
        const proxyPath = getProxyEndpoint(settings, isBackup);
        return `${proxyPath}?url=${encodeURIComponent(`${serverUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      });

      // Preload all image URLs into browser cache
      await preloadImages(urls);

      setSelectedInstancesForPrint(instances);
      setSelectedGridType(gridType);
      
      document.body.classList.add('print-mode-images');
      
      // Tiny delay to let DOM render the images loaded from cache
      setTimeout(() => {
        window.print();
        document.body.classList.remove('print-mode-images');
        setIsPrintingImages(false);
        // Delay resetting instances to avoid tearing during viewport restore
        setTimeout(() => {
          setSelectedInstancesForPrint([]);
        }, 500);
      }, 150);
    } catch (err) {
      console.error('[PACS Print Preload Error]', err);
      showToast('Erro ao carregar imagens para a impressão.', 'error');
      setIsPrintingImages(false);
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
            onEditPatient={() => setShowEditPatient(true)}
          />

          {/* AVISO API KEY */}
          {(((settings.aiProvider === 'anthropic' || !settings.aiProvider) && !settings.anthropicApiKey) || 
            ((settings.aiProvider === 'gemini') && !settings.geminiApiKey)) && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[11px] text-amber-800 flex items-center gap-2 shrink-0">
              <AlertCircle size={12} />
              <span>API Key do {settings.aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} não configurada — geração em <strong>modo demo</strong>.</span>
              <button className="underline ml-1 font-medium" onClick={() => setView({ name: 'settings' })}>Configurar</button>
            </div>
          )}

          <div className="flex-1 flex min-h-0 relative overflow-hidden bg-ink-50/20">
            {/* Integrated Dicom Image Viewer Sidebar */}
            {showIntegratedViewer && (
               <div className="absolute lg:relative z-30 lg:z-20 w-full lg:w-[460px] xl:w-[540px] border-r border-slate-850 bg-slate-950 text-slate-100 flex flex-col shrink-0 min-h-0 animate-fade-in inset-y-0 left-0">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    {dicomLoading && (
                      <Loader2 size={12} className="animate-spin text-emerald-500" />
                    )}
                    <div className="flex items-center gap-3">
                      {settings.dicomBackupViewerUrl ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={activePacsServer}
                            onChange={(e) => {
                              const val = e.target.value as 'primary' | 'backup' | 'both';
                              setActivePacsServer(val);
                              localStorage.setItem('laudus_active_pacs_server', val);
                              setDicomRefreshKey(prev => prev + 1);
                            }}
                            className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg px-2 py-1 focus:outline-none cursor-pointer hover:border-slate-700 transition-colors"
                          >
                            <option value="both">Ambos PACS</option>
                            <option value="primary">PACS Principal</option>
                            <option value="backup">PACS Backup</option>
                          </select>
                          <div className="flex items-center gap-1.5 ml-1">
                            {activePacsServer !== 'backup' && (
                              <div 
                                className={classNames(
                                  "w-1.5 h-1.5 rounded-full",
                                  pacsConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" : pacsConnected === 'disconnected' ? "bg-rose-500" : "bg-slate-500 animate-pulse"
                                )} 
                                title={`PACS Principal: ${pacsConnected}`} 
                              />
                            )}
                            {activePacsServer !== 'primary' && (
                              <div 
                                className={classNames(
                                  "w-1.5 h-1.5 rounded-full",
                                  pacsBackupConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" : pacsBackupConnected === 'disconnected' ? "bg-rose-500" : "bg-slate-500 animate-pulse"
                                )} 
                                title={`PACS Backup: ${pacsBackupConnected}`} 
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div 
                            className={classNames(
                              "w-2 h-2 rounded-full",
                              pacsConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : pacsConnected === 'disconnected' ? "bg-rose-500" : "bg-slate-500 animate-pulse"
                            )} 
                            title={`PACS Principal: ${pacsConnected === 'connected' ? 'Online' : pacsConnected === 'disconnected' ? 'Offline' : 'Carregando'}`} 
                          />
                          <span className="font-black text-[9px] uppercase tracking-widest text-slate-450">
                            PACS Principal
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidateStudies.length > 1 && (
                      <button
                        onClick={() => setShowStudySelector(!showStudySelector)}
                        className={classNames(
                          "h-8 px-2.5 rounded-xl flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all border",
                          showStudySelector
                            ? "bg-brand-600 text-white border-brand-500"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                        )}
                        title="Vários estudos localizados para este paciente"
                      >
                        <SlidersHorizontal size={12} />
                        <span>Estudos ({candidateStudies.length})</span>
                      </button>
                    )}
                    <button
                      onClick={() => setDicomRefreshKey(prev => prev + 1)}
                      disabled={dicomLoading}
                      className={classNames(
                        "p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95 border border-transparent hover:border-slate-700",
                        dicomLoading && "animate-spin"
                      )}
                      title="Atualizar Imagens"
                    >
                      <RefreshCw size={14} />
                    </button>
                    {(() => {
                      const extUrl = getExternalViewerUrl();
                      if (!extUrl) return null;
                      return (
                        <a
                          href={extUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all border border-slate-750 hover:border-slate-700 active:scale-95 shadow-sm select-none"
                          title="Abrir no Visualizador Orthanc Externo (Stone Viewer, etc.)"
                        >
                          <ExternalLink size={12} className="text-brand-400" />
                          <span>Viewer</span>
                        </a>
                      );
                    })()}
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

                {/* Candidate Studies Dropdown Selector Panel */}
                {showStudySelector && candidateStudies.length > 0 && (
                  <div className="bg-slate-900 border-b border-slate-850 p-4 space-y-2 shrink-0 animate-slide-down">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Selecione o Estudo DICOM correspondente:</span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                      {candidateStudies.map((study) => {
                        const date = study.MainDicomTags?.StudyDate || '';
                        const time = study.MainDicomTags?.StudyTime || '';
                        const desc = study.MainDicomTags?.StudyDescription || study.RequestedProcedureDescription || 'Sem descrição';
                        const formattedDate = date ? `${date.substring(6, 8)}/${date.substring(4, 6)}/${date.substring(0, 4)}` : 'Data ignorada';
                        const formattedTime = time ? `${time.substring(0, 2)}:${time.substring(2, 4)}` : '';
                        const isCurrent = study.ID === selectedStudyId;

                        return (
                          <button
                            key={study.ID}
                            onClick={() => {
                              changeSelectedStudy(study.ID);
                              setShowStudySelector(false);
                              fetchInstancesForStudy(study.ID, study.serverSource);
                            }}
                            className={classNames(
                              "w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-3",
                              isCurrent
                                ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                                : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                            )}
                          >
                            <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold truncate text-[11px]">{desc}</p>
                                <p className="text-[9px] opacity-75 mt-0.5">{formattedDate} {formattedTime} • ID: {study.MainDicomTags?.PatientID || '—'}</p>
                              </div>
                              <span className={classNames(
                                "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 select-none",
                                study.serverSource === 'backup' 
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              )}>
                                {study.serverSource === 'backup' ? 'Backup' : 'Principal'}
                              </span>
                            </div>
                            {isCurrent && (
                              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Main Preview Area */}
                <div className="p-4 flex flex-col items-center justify-center shrink-0 border-b border-slate-800 bg-slate-900/50">
                  {(() => {
                    const activeInstance = dicomInstances[activeImageIndex];
                    const activeStudy = candidateStudies.find(c => c.ID === selectedStudyId);
                    const activeServerSource = activeStudy?.serverSource || 'primary';
                    if (!activeInstance) {
                      return (
                        <div className="relative aspect-square w-full bg-black rounded-2xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center text-slate-650 p-6 text-center">
                          <Eye size={32} className="opacity-25 mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sem Imagem Selecionada</span>
                        </div>
                      );
                    }
                    const isBackup = activeServerSource === 'backup';
                    const currentBaseUrl = isBackup
                      ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
                      : (settings.dicomViewerUrl || 'http://localhost:8042');
                    const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
                    const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
                    const proxyPath = getProxyEndpoint(settings, isBackup);
                    const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
                    const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

                    return (
                      <div className="w-full flex flex-col gap-3">
                        <div 
                          onClick={() => setShowFullScreenImage(true)}
                          className="relative aspect-square w-full bg-black rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner cursor-zoom-in"
                        >
                          <DicomThumbnail 
                            src={previewUrl} 
                            alt={`Instance ${instanceNum}`}
                            className="hover:scale-[1.02]"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg z-20"
                            title="Anterior"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/85 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg z-20"
                            title="Próxima"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[9px] font-black tracking-widest text-slate-300 uppercase shadow-md animate-fade-in z-20">
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

                {/* Thumbnails Grid List or Error State */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {dicomLoading && dicomInstances.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
                      <Loader2 size={24} className="animate-spin text-brand-500 mb-3" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Buscando Exames no PACS...</span>
                    </div>
                  ) : dicomError && dicomInstances.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 flex flex-col items-center text-center gap-2.5 my-4">
                      <AlertTriangle className="text-amber-500" size={24} />
                      <p className="text-[10px] text-amber-200/80 font-medium leading-relaxed">
                        {dicomError}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDicomRefreshKey(prev => prev + 1)}
                        className="h-7 px-3 rounded-lg bg-amber-700 hover:bg-amber-600 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  ) : dicomInstances.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center px-4">
                      <AlertCircle className="text-slate-500 mb-3" size={24} />
                      <span className="text-[10px] font-black uppercase tracking-wider block text-slate-300">Nenhum Estudo Selecionado</span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1">Verifique o identificador do paciente ou clique em "Estudos" acima para selecionar manualmente.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {dicomInstances.map((instance, idx) => {
                        const isActive = idx === activeImageIndex;
                        const isBackup = instance.serverSource === 'backup';
                        const currentBaseUrl = isBackup
                          ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
                          : (settings.dicomViewerUrl || 'http://localhost:8042');
                        const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
                        const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
                        const proxyPath = getProxyEndpoint(settings, isBackup);
                        const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
                        
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
                            <DicomThumbnail src={previewUrl} alt={`Instance ${idx + 1}`} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
                        const initialContent = getInitialReportContent(template);
                        const cleanCurrent = reportContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                        const cleanInitial = initialContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
                        return cleanCurrent === '' || cleanCurrent === cleanInitial;
                      })()
                    : true
                }
                status={exam.status}
                hasGoogleDoc={!!exam.googleDocId}
                onCopy={handleCopy}
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
              className="fixed inset-x-0 top-0 w-full h-dvh rounded-none lg:inset-auto lg:bottom-24 lg:right-10 lg:w-[420px] lg:h-[72vh] lg:max-h-[660px] bg-white lg:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 flex flex-col z-[120] overflow-hidden"
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

        {/* FAB Toggle Copilot — oculto e fechado ao finalizar */}
        {exam.status !== 'finalizado' ? (
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

      {/* Edit Patient Modal */}
      <AnimatePresence>
        {showEditPatient && patient && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEditPatient(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-3xl shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <UserCog size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Editar Paciente</h2>
                    <p className="text-xs font-semibold text-slate-500">Atualize os dados cadastrais e clínicos do paciente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditPatient(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <PatientForm
                  initial={patient}
                  onCancel={() => setShowEditPatient(false)}
                  onSubmit={async (data) => {
                    await updateItem('patients', patient.id, data);
                    setShowEditPatient(false);
                    showToast('Dados do paciente atualizados com sucesso', 'success');
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            area={exam.area} 
            examDateMs={exam.createdAt}
            onClose={() => setShowCalculators(false)} 
            onSendToCopilot={(text) => {
              setCopilotPrompt((prev) => (prev ? `${prev}\n\n${text}` : text));
              setShowCalculators(false);
              if (!showCopilot) setShowCopilot(true);
            }}
            calculatorData={exam.calculatorData}
            onSaveCalculatorData={async (data) => {
              // Fix 17: only write to Firestore — useDocument hook propagates reactively, no direct mutation
              await updateItem('exams', exam.id, { calculatorData: data });
            }}
            onAppendToForm={(text) => {
              const currentForm = exam.customFormValue || '';
              const newForm = currentForm ? currentForm + '\n\n' + text : text;
              updateItem('exams', exam.id, { customFormValue: newForm });
              showToast('Inserido no Formulário com sucesso!', 'success');
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
            const currentBaseUrl = isBackup
              ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
              : (settings.dicomViewerUrl || 'http://localhost:8042');
            const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
            const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
            const proxyPath = getProxyEndpoint(settings, isBackup);
            const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

            return (
              <div className="relative max-w-full max-h-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <DicomThumbnail 
                  src={previewUrl} 
                  alt={`Instance ${instanceNum}`}
                  className="max-w-[95vw] max-h-[85vh] rounded-lg shadow-2xl border border-white/5"
                  containerClassName="bg-transparent"
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
    </>
  );
}
