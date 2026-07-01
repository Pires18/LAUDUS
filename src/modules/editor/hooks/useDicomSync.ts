import { useState, useRef, useEffect, useCallback } from 'react';
import { getProxyEndpoint, getActivePacsUrl } from '../../../store/db';
import { ExamRequest, Patient } from '../../../types';
import { getStudyInstanceUID } from '../../../utils/dicom';
import { logger } from '../../../utils/logger';

interface UseDicomSyncProps {
  exam: ExamRequest | undefined;
  patient: Patient | null;
  settings: any;
  activePacsServer: 'primary' | 'backup' | 'both';
  changeSelectedStudy: (id: string | null) => void;
  dicomRefreshKey: number;
  showIntegratedViewer: boolean;
  showDicomImages: boolean;
  isManualCheck?: boolean;
}

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
      logger.warn('[PACS] Erro na query:', err);
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

  const studyUid = getStudyInstanceUID(exam.id);
  
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

  // Aborta as buscas por PatientID para evitar lentidão
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

const scoreStudies = (candidates: any[], examTime: number, modality?: string): any[] => {
  const refDate = new Date(examTime);
  const refDay = `${refDate.getFullYear()}${String(refDate.getMonth() + 1).padStart(2, '0')}${String(refDate.getDate()).padStart(2, '0')}`;

  const scored = candidates.map((c) => {
    const studyDate = c.MainDicomTags?.StudyDate || ''; // YYYYMMDD
    const studyTime = c.MainDicomTags?.StudyTime || '000000'; // HHMMSS
    const studyModality = (c.MainDicomTags?.ModalitiesInStudy || c.MainDicomTags?.Modality || '').toUpperCase();

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

    // Same-day studies get a strong boost (treated as within 1 minute)
    const isSameDay = studyDate === refDay;
    const adjustedDiff = isSameDay ? Math.min(diffMs, 60_000) : diffMs;

    // Modality match: if exam area implies US, prefer US modality
    const modalityBonus = modality && studyModality.includes(modality) ? -30_000 : 0;

    return { study: c, score: adjustedDiff + modalityBonus };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.map(item => item.study);
};

export function useDicomSync({
  exam,
  patient,
  settings,
  activePacsServer,
  changeSelectedStudy,
  dicomRefreshKey,
  showIntegratedViewer,
  showDicomImages,
  isManualCheck = false
}: UseDicomSyncProps) {
  const [pacsConnected, setPacsConnected] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [pacsBackupConnected, setPacsBackupConnected] = useState<'loading' | 'connected' | 'disconnected' | 'disabled'>('loading');
  const [candidateStudies, setCandidateStudies] = useState<any[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);

  // New: explicit PACS status, active server, and last error
  const [dicomStatus, setDicomStatus] = useState<'idle' | 'searching' | 'found' | 'not-found' | 'error' | 'connecting-backup'>('idle');
  const [activeServer, setActiveServer] = useState<'primary' | 'backup' | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  // Cache: store the last found study result with TTL (5 minutes)
  const studyCacheRef = useRef<{ studyId: string; serverSource: 'primary' | 'backup'; studyUID?: string; timestamp: number } | null>(null);
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  const selectedStudyIdRef = useRef<string | null>(null);
  // Último estudo cujas instâncias já foram carregadas — evita refetch redundante
  // a cada polling e permite detectar troca manual de estudo pelo usuário.
  const lastFetchedStudyIdRef = useRef<string | null>(null);
  const internalChangeSelectedStudy = useCallback((id: string | null) => {
    setSelectedStudyId(id);
    selectedStudyIdRef.current = id;
    changeSelectedStudy(id);
  }, [changeSelectedStudy]);

  const [hasDicomImages, setHasDicomImages] = useState(false);
  const [dicomInstances, setDicomInstances] = useState<any[]>([]);
  const [dicomLoading, setDicomLoading] = useState(false);
  const [dicomError, setDicomError] = useState<string | null>(null);
  const dicomLoadingRef = useRef(false);

  // Refs for polling
  const showIntegratedViewerRef = useRef(showIntegratedViewer);
  const showDicomImagesRef = useRef(showDicomImages);
  const hasDicomImagesRef = useRef(hasDicomImages);
  
  useEffect(() => { showIntegratedViewerRef.current = showIntegratedViewer; }, [showIntegratedViewer]);
  useEffect(() => { showDicomImagesRef.current = showDicomImages; }, [showDicomImages]);
  useEffect(() => { hasDicomImagesRef.current = hasDicomImages; }, [hasDicomImages]);

  const fetchInstancesForStudy = useCallback(async (studyId: string, serverSource: 'primary' | 'backup', studyInstanceUID?: string) => {
    const isBackupStudy = serverSource === 'backup';
    // Resolve a base igual ao "Testar PACS" (getActivePacsUrl): na nuvem usa a URL
    // pública Tailscale quando configurada, evitando apontar para um IP local inacessível.
    const currentUrl = getActivePacsUrl(settings, isBackupStudy);
    const currentAuth = isBackupStudy 
      ? `&username=${encodeURIComponent(settings.dicomBackupUsername || '')}&password=${encodeURIComponent(settings.dicomBackupPassword || '')}` 
      : `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
    const proxyPath = getProxyEndpoint(settings, isBackupStudy);
    
    try {
      let instances = [];
      if (studyInstanceUID) {
        const findUrl = `${currentUrl.replace(/\/$/, '')}/tools/find`;
        const instancesRes = await fetch(`${proxyPath}?url=${encodeURIComponent(findUrl)}${currentAuth}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Level: 'Instance',
            Expand: true,
            Query: { StudyInstanceUID: studyInstanceUID }
          })
        });
        if (!instancesRes.ok) throw new Error();
        instances = await instancesRes.json();
      } else {
        const instancesUrl = `${currentUrl.replace(/\/$/, '')}/studies/${studyId}/instances`;
        const instancesRes = await fetch(`${proxyPath}?url=${encodeURIComponent(instancesUrl)}${currentAuth}`);
        if (!instancesRes.ok) throw new Error();
        instances = await instancesRes.json();
      }
      
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
      logger.warn('[PACS] Falha ao obter instâncias', e);
    }
  }, [
    settings.dicomViewerUrl,
    settings.dicomBackupViewerUrl,
    settings.dicomTailscalePublicUrl,
    settings.dicomBackupTailscalePublicUrl,
    settings.dicomUsername,
    settings.dicomBackupUsername,
    settings.dicomPassword,
    settings.dicomBackupPassword
  ]);

  // Troca manual de estudo: quando o usuário seleciona outro estudo do paciente,
  // carrega imediatamente as imagens daquele estudo (sem esperar o polling).
  useEffect(() => {
    if (!selectedStudyId) return;
    if (selectedStudyId === lastFetchedStudyIdRef.current) return;
    const study = candidateStudies.find((c) => c.ID === selectedStudyId);
    if (!study) return;

    let active = true;
    lastFetchedStudyIdRef.current = selectedStudyId;
    setActiveServer(study.serverSource as 'primary' | 'backup');
    studyCacheRef.current = {
      studyId: study.ID,
      serverSource: study.serverSource,
      studyUID: study.MainDicomTags?.StudyInstanceUID,
      timestamp: Date.now(),
    };

    (async () => {
      setDicomLoading(true);
      setDicomError(null);
      // Limpa as imagens do estudo anterior para feedback visual imediato.
      setDicomInstances([]);
      setHasDicomImages(false);
      try {
        await fetchInstancesForStudy(study.ID, study.serverSource, study.MainDicomTags?.StudyInstanceUID);
        if (active) setDicomStatus('found');
      } catch (e) {
        if (active) {
          setDicomStatus('error');
          setDicomError('Falha ao carregar imagens do estudo selecionado.');
        }
      } finally {
        if (active) setDicomLoading(false);
      }
    })();

    return () => { active = false; };
  }, [selectedStudyId, candidateStudies, fetchInstancesForStudy]);

  useEffect(() => {
    let active = true;

    if (!exam || !exam.id || settings.dicomSyncEnabled === false) {
      setHasDicomImages(false);
      setDicomInstances([]);
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
        const baseUrl = getActivePacsUrl(settings, false);
        const authParams = `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;

        // Backup é considerado configurado se houver URL local OU URL pública Tailscale.
        // A base é resolvida via getActivePacsUrl (igual ao "Testar PACS"), garantindo que
        // o editor consulte o backup mesmo quando só a URL pública estiver preenchida.
        const backupConfigured = !!(settings.dicomBackupViewerUrl || settings.dicomBackupTailscalePublicUrl);
        const backupUrl = backupConfigured ? getActivePacsUrl(settings, true) : '';
        const backupAuth = backupConfigured ? `&username=${encodeURIComponent(settings.dicomBackupUsername || '')}&password=${encodeURIComponent(settings.dicomBackupPassword || '')}` : '';

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
          let errorMsg: string | null = null;
          try {
            const res = await fetchWithTimeout(`${proxyPath}?url=${encodeURIComponent(pingUrl)}${serverAuth}`);
            pingOk = res.ok;
            if (!res.ok) {
              errorMsg = res.status === 401 || res.status === 403
                ? 'Autenticação PACS falhou. Verifique usuário/senha.'
                : `Servidor ${source === 'backup' ? 'backup' : 'primário'} retornou erro ${res.status}.`;
            }
          } catch (err: any) {
            pingOk = false;
            errorMsg = err?.name === 'AbortError'
              ? `Timeout ao conectar ao PACS ${source === 'backup' ? 'backup' : 'primário'}.`
              : `Sem conexão com o PACS ${source === 'backup' ? 'backup' : 'primário'}.`;
          }

          if (active) {
            if (source === 'primary') setPacsConnected(pingOk ? 'connected' : 'disconnected');
            if (source === 'backup') setPacsBackupConnected(pingOk ? 'connected' : 'disconnected');
            if (!pingOk && errorMsg && source === 'primary') setLastErrorMessage(errorMsg);
          }

          if (!pingOk) return { source, candidates: [], pingOk: false };

          const candidates = await locateStudies(serverBaseUrl, serverAuth, exam, patient, source, settings);
          return { source, candidates, pingOk: true };
        };

        const queryPrimary = activePacsServer !== 'backup';
        // Backup é sempre consultado quando configurado (mesmo no modo "Principal"):
        // se o primário estiver caído, ele cobre as imagens automaticamente, sem
        // depender do seletor — evita travar a visualização quando o Mac cai.
        const queryBackup = !!backupUrl;

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
          if (active) {
            setDicomStatus('not-found');
            if (isManual) {
              setDicomInstances([]);
              setHasDicomImages(false);
              setDicomError(`Estudo não localizado nos servidores ativos.`);
            }
          }
          return;
        }

        let activeStudy = null;
        const currentSelectedId = selectedStudyIdRef.current;
        if (currentSelectedId) {
          activeStudy = mergedCandidates.find(c => c.ID === currentSelectedId);
        }
        if (!activeStudy && mergedCandidates.length > 0) {
          const refTime = exam.scheduledAt || exam.examDate || exam.createdAt;
          const sorted = scoreStudies(mergedCandidates, refTime, settings.dicomModalityType || 'US');
          activeStudy = sorted[0];
          if (active) {
            internalChangeSelectedStudy(activeStudy.ID);
          }
        }

        if (activeStudy) {
          // Update active server indicator
          if (active) {
            setActiveServer(activeStudy.serverSource as 'primary' | 'backup');
            setDicomStatus('found');
          }

          // Update cache
          studyCacheRef.current = {
            studyId: activeStudy.ID,
            serverSource: activeStudy.serverSource,
            studyUID: activeStudy.MainDicomTags?.StudyInstanceUID,
            timestamp: Date.now()
          };

          lastFetchedStudyIdRef.current = activeStudy.ID;
          await fetchInstancesForStudy(activeStudy.ID, activeStudy.serverSource, activeStudy.MainDicomTags?.StudyInstanceUID);
        }
      } catch (e: any) {
        logger.warn('[PACS] Erro ao checar imagens no Orthanc', e);
        if (active) {
          setDicomStatus('error');
          const errMsg = e.message || 'Erro de conexão com o servidor PACS.';
          setLastErrorMessage(errMsg);
          if (isManual) {
            setDicomError(errMsg);
          }
        }
      } finally {
        dicomLoadingRef.current = false;
        if (active && isManual) {
          setDicomLoading(false);
        }
      }
    };

    checkImages(true);

    let tickCount = 0;
    const intervalId = setInterval(() => {
      tickCount++;
      const viewerOpen = showIntegratedViewerRef.current || showDicomImagesRef.current;
      const alreadyHasImages = hasDicomImagesRef.current;

      // Use cache: if images already found and within TTL, skip searching
      const cache = studyCacheRef.current;
      const cacheValid = cache && (Date.now() - cache.timestamp < CACHE_TTL_MS);

      // Stop polling if images already loaded and cache is valid
      if (alreadyHasImages && cacheValid) return;

      if (!alreadyHasImages && (viewerOpen || tickCount % 6 === 0)) {
        setDicomStatus('searching');
        setLastErrorMessage(null);
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
    settings.dicomTailscalePublicUrl,
    settings.dicomUsername,
    settings.dicomPassword,
    settings.dicomBackupViewerUrl,
    settings.dicomBackupTailscalePublicUrl,
    settings.dicomBackupUsername,
    settings.dicomBackupPassword,
    dicomRefreshKey,
    activePacsServer,
    internalChangeSelectedStudy,
    fetchInstancesForStudy,
    exam?.createdAt
  ]);

  return {
    pacsConnected,
    pacsBackupConnected,
    candidateStudies,
    selectedStudyId,
    setSelectedStudyId: internalChangeSelectedStudy,
    hasDicomImages,
    dicomInstances,
    dicomLoading,
    dicomError,
    // New exports
    dicomStatus,
    activeServer,
    lastErrorMessage
  };
}
