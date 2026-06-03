import { useState, useCallback, useRef, useEffect } from 'react';
import { updateItem, getRecentFinalizedReports, saveVersionSnapshot, deleteWorklistEntry } from '../../../store/db';
import { ExamStatus, ReportTemplate, Patient, AppSettings } from '../../../types';
import { generateReportStream, generateMockReport } from '../../ai/gemini';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import { getInitialReportContent } from '../../templates/utils';

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
  examDateMs?: number;
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
  anamnesis,
  examDateMs
}: UseExamActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string | null>(null);
  const debouncedSave = useCallback(
    (reportContent: string, force: boolean = false) => {
      latestContentRef.current = reportContent;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      if (settings.autoSave === false && !force) {
        return;
      }

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
          showToast('Erro ao salvar', 'error');
          setSaveState('idle');
        } finally {
          latestContentRef.current = null;
        }
      }, 800);
    },
    [examId, showToast, settings.autoSave]
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
        // Detecta se é a primeira geração (máscara ainda limpa/não editada)
        // Nesse caso, usa buildPrompt (GERAÇÃO INICIAL) para melhor qualidade
        const initialContent = getInitialReportContent(template);
        const cleanCurrent = currentReport.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
        const cleanInitial = initialContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
        const isFirstGeneration = !customPrompt && (cleanCurrent === '' || cleanCurrent === cleanInitial);

        if (isFirstGeneration) {
          // Salva a máscara limpa como versão inicial
          await saveVersionSnapshot(examId, currentReport, 'generation');
          // Modo: GERAÇÃO INICIAL — gera do zero a partir da máscara como referência
          html = await generateReportStream({
            template,
            patient,
            settings,
            clinicalIndication,
            requestingPhysician,
            anamnesis,
            previousExams,
            examDateMs,
          }, (chunk) => {
            if (chunk.trim()) {
              onReportChange(chunk);
            }
          });
          showToast('Laudo gerado com IA! ✓', 'success');
        } else {
          // Salva o laudo atual antes de refinar
          await saveVersionSnapshot(examId, currentReport, 'refine');
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
            examDateMs,
          }, (chunk) => {
            if (chunk.trim()) {
              onReportChange(chunk);
            }
          });
          showToast('Laudo refinado com sucesso! ✓', 'success');
        }

        // Sanitização obrigatória do HTML antes de salvar (prevenção XSS)
        html = sanitizeHtml(html);
        
        // Proteção contra laudos em branco
        if (html && html.trim().length > 10) {
          onReportChange(html);
          await updateItem('exams', examId, { reportContent: html });
        } else {
          showToast('Falha na geração: resposta vazia da IA. Restaurando anterior...', 'error');
          onReportChange(currentReport);
        }
      } else {
        html = generateMockReport({ template, patient, settings });
        showToast('API Key não configurada — modo demonstração ativo', 'info');
        onReportChange(html);
        await updateItem('exams', examId, { reportContent: html });
      }
    } catch (e: unknown) {
      console.error('[useExamActions] Erro na geração/refinamento:', e);
      const rawMsg = e instanceof Error ? e.message : String(e) || 'Erro ao processar laudo com IA';
      const message = rawMsg.includes('404') || rawMsg.includes('not found') || rawMsg.includes('models/')
        ? `Modelo de IA não encontrado. Verifique o nome do modelo em Configurações. (${rawMsg.substring(0, 60)})`
        : rawMsg.includes('403') || rawMsg.includes('unauthorized') || rawMsg.includes('Unauthorized')
          ? 'API Key inválida ou sem permissão. Verifique em Configurações.'
          : rawMsg.includes('API Key') || rawMsg.includes('api key')
            ? 'Chave de API não configurada. Acesse Configurações para adicionar.'
            : rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED')
              ? 'Limite de requisições da API atingido. Aguarde alguns segundos.'
              : rawMsg;
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [template, patient, settings, clinicalIndication, requestingPhysician, anamnesis, examId, examDateMs, onReportChange, showToast]);

  const updateStatus = useCallback(async (status: ExamStatus) => {
    try {
      await updateItem('exams', examId, {
        status,
        finalizedAt: status === 'finalizado' ? Date.now() : undefined,
      });
      showToast(`Status atualizado para: ${status}`, 'success');

      // Ao finalizar, remove automaticamente o arquivo .wl da Worklist do Orthanc.
      // Isso garante que o aparelho de imagem (US) não liste mais o exame como pendente.
      if (status === 'finalizado') {
        deleteWorklistEntry(examId, settings).catch((err) => {
          console.warn('[useExamActions] Falha silenciosa ao remover worklist do PACS:', err);
        });
      }
    } catch (err) {
      showToast('Erro ao atualizar status', 'error');
    }
  }, [examId, settings, showToast]);

  return {
    isGenerating,
    saveState,
    debouncedSave,
    handleRefine,
    updateStatus
  };
}
