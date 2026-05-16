import { useState, useCallback, useRef, useEffect } from 'react';
import { updateItem, getRecentFinalizedReports } from '../../../store/db';
import { ExamStatus, ReportTemplate, Patient, AppSettings } from '../../../types';
import { generateReportStream, generateMockReport, generateReport } from '../../ai/gemini';

interface UseExamActionsProps {
  examId: string;
  settings: AppSettings;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onReportChange: (html: string) => void;
  patient: Patient | null;
  template: ReportTemplate | null;
  clinicalIndication?: string;
}

export function useExamActions({
  examId,
  settings,
  showToast,
  onReportChange,
  patient,
  template,
  clinicalIndication
}: UseExamActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string | null>(null);
  const debouncedSave = useCallback(
    (reportContent: string) => {
      latestContentRef.current = reportContent;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState('saving');
      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateItem('exams', examId, {
            reportContent: latestContentRef.current,
          });
          
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        } catch (err) {
          console.error('[useExamActions] Erro ao salvar:', err);
          showToast('Erro ao salvar automaticamente', 'error');
          setSaveState('idle');
        } finally {
          latestContentRef.current = null;
        }
      }, 800);
    },
    [examId, showToast]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (latestContentRef.current !== null) {
        updateItem('exams', examId, {
          reportContent: latestContentRef.current,
          updatedAt: Date.now()
        }).catch(console.error);
      }
    };
  }, [examId]);

  const handleInitialGenerate = useCallback(async () => {
    if (!template || !patient) return;
    setIsGenerating(true);
    try {
      const previousExams = settings.aiTrainingEnabled 
        ? await getRecentFinalizedReports(template.id, settings.aiTrainingContextSize || 3)
        : [];
      const html = await generateReport({
        template,
        patient,
        settings,
        clinicalIndication,
        previousExams
      });
      onReportChange(html);
      await updateItem('exams', examId, { reportContent: html });
      showToast('Laudo inicial gerado com base no seu histórico!', 'success');
    } catch (err) {
      console.error('[useExamActions] Erro ao gerar laudo:', err);
      showToast('Erro ao gerar laudo inicial', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, patient, settings, clinicalIndication, examId, onReportChange, showToast]);

  const handleRefine = useCallback(async (currentReport: string) => {
    if (!template || !patient) return;
    
    setIsGenerating(true);
    try {
      const previousExams = settings.aiTrainingEnabled 
        ? await getRecentFinalizedReports(template.id, settings.aiTrainingContextSize || 3)
        : [];
      let html: string;
      if (settings.geminiApiKey) {
        html = await generateReportStream({
          currentReport,
          template,
          patient,
          settings,
          clinicalIndication,
          previousExams
        }, (chunk) => {
          onReportChange(chunk);
        });
      } else {
        html = generateMockReport({
          template,
          patient,
          settings,
        });
        showToast('API Key não configurada — laudo refinado em modo demo', 'info');
      }
      onReportChange(html);
      await updateItem('exams', examId, { reportContent: html });
      showToast('Laudo refinado seguindo seu estilo padrão!', 'success');
    } catch (e: unknown) {
      console.error('[useExamActions] Erro no refinamento IA:', e);
      const message = e instanceof Error ? e.message : 'Erro ao refinar laudo';
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, patient, settings, examId, onReportChange, showToast]);

  const updateStatus = useCallback(async (status: ExamStatus) => {
    try {
      await updateItem('exams', examId, {
        status,
        finalizedAt: status === 'finalizado' ? Date.now() : undefined,
      });
      showToast(`Status atualizado para: ${status}`, 'success');
    } catch (err) {
      showToast('Erro ao atualizar status', 'error');
    }
  }, [examId, showToast]);

  return {
    isGenerating,
    saveState,
    debouncedSave,
    handleInitialGenerate,
    handleRefine,
    updateStatus
  };
}
