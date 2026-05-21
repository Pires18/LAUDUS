import { useState, useCallback, useRef, useEffect } from 'react';
import { updateItem, getRecentFinalizedReports } from '../../../store/db';
import { ExamStatus, ReportTemplate, Patient, AppSettings } from '../../../types';
import { generateReportStream, generateMockReport } from '../../ai/gemini';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';

interface UseExamActionsProps {
  examId: string;
  settings: AppSettings;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onReportChange: (html: string) => void;
  patient: Patient | null;
  template: ReportTemplate | null;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
}

export function useExamActions({
  examId,
  settings,
  showToast,
  onReportChange,
  patient,
  template,
  clinicalIndication,
  requestingPhysician,
  anamnesis
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

  /**
   * Geração / Refinamento inteligente — modo único unificado.
   * Auto-detecta o modo baseado no conteúdo atual:
   *  • Conteúdo com placeholders (…) e sem customPrompt → GERAÇÃO INICIAL (buildPrompt)
   *  • Conteúdo real já preenchido ou customPrompt específico → REFINAMENTO (buildRefinePrompt)
   * Em ambos os casos usa streaming para UX responsiva.
   * Aplica sanitizeHtml no output final antes de salvar (segurança + XSS).
   */
  const handleRefine = useCallback(async (currentReport: string, customPrompt?: string) => {
    if (!template || !patient) return;

    setIsGenerating(true);
    try {
      const previousExams = settings.aiTrainingEnabled
        ? await getRecentFinalizedReports(template.id, settings.aiTrainingContextSize || 3)
        : [];

      const hasKey = settings.aiProvider === 'anthropic' ? !!settings.anthropicApiKey : !!settings.geminiApiKey;
      let html: string;

      if (hasKey) {
        // Detecta se é a primeira geração (máscara com placeholders ainda intactos)
        // Nesse caso, usa buildPrompt (GERAÇÃO INICIAL) para melhor qualidade
        const isFirstGeneration = !customPrompt && /\(…\)/.test(currentReport);

        if (isFirstGeneration) {
          // Modo: GERAÇÃO INICIAL — gera do zero a partir da máscara como referência
          html = await generateReportStream({
            template,
            patient,
            settings,
            clinicalIndication,
            requestingPhysician,
            anamnesis,
            previousExams,
          }, (chunk) => {
            onReportChange(chunk);
          });
          showToast('Laudo gerado com IA! ✓', 'success');
        } else {
          // Modo: REFINAMENTO — edição cirúrgica do laudo já existente (R10)
          html = await generateReportStream({
            currentReport,
            template,
            patient,
            settings,
            clinicalIndication,
            requestingPhysician,
            anamnesis,
            previousExams,
            customPrompt,
          }, (chunk) => {
            onReportChange(chunk);
          });
          showToast('Laudo refinado com sucesso! ✓', 'success');
        }

        // Sanitização obrigatória do HTML antes de salvar (prevenção XSS)
        html = sanitizeHtml(html);
      } else {
        html = generateMockReport({ template, patient, settings });
        showToast('API Key não configurada — modo demonstração ativo', 'info');
      }

      onReportChange(html);
      await updateItem('exams', examId, { reportContent: html });
    } catch (e: unknown) {
      console.error('[useExamActions] Erro na geração/refinamento:', e);
      const message = e instanceof Error ? e.message : 'Erro ao processar laudo com IA';
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, patient, settings, clinicalIndication, requestingPhysician, anamnesis, examId, onReportChange, showToast]);

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
    handleRefine,
    updateStatus
  };
}
