import { useState, useCallback, useRef, useEffect } from 'react';
import { updateItem, getRecentFinalizedReports, getPatientPreviousExams, saveVersionSnapshot, deleteWorklistEntry } from '../../../store/db';
import { ExamStatus, ReportTemplate, Patient, AppSettings } from '../../../types';
import { generateReportStream, generateMockReport, auditReportQuality } from '../../ai/engine';
import { routeMotor } from '../../ai/router';
import { verifyReport } from '../../ai/verification';
import { classifyCorrection } from '../../ai/training/feedback';
import { recordCorrectionSignal, recordQualityRecord } from '../../ai/training/feedbackStore';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import { getCombinedInitialReportContent, combinedExamType, sectionTogglesFromSettings } from '../../templates/utils';
import { logger } from '../../../utils/logger';

interface UseExamActionsProps {
  examId: string;
  settings: AppSettings;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onReportChange: (html: string) => void;
  patient: Patient | null;
  template: ReportTemplate | null;
  /** Exame combinado: todas as máscaras (1ª = primária). Ausente = [template]. */
  templates?: ReportTemplate[];
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
  templates,
  clinicalIndication,
  requestingPhysician,
  anamnesis,
  examDateMs
}: UseExamActionsProps) {
  // Máscaras efetivas do exame (combinado ou simples) e suas áreas distintas.
  const tpls = templates && templates.length > 0 ? templates : template ? [template] : [];
  const examAreas = [...new Set(tpls.map((t) => t.area))];
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string | null>(null);
  // Loop de feedback (Fase 3): captura da geração inicial e contagem de refinamentos.
  const initialGeneratedRef = useRef<string | null>(null);
  const refinementCountRef = useRef(0);
  const lastMotorRef = useRef<'lite' | 'pro'>('lite');
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
          logger.error('[useExamActions] Erro ao salvar', err);
          showToast('Erro ao salvar', 'error');
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 3000);
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
      // Fix 3: include updatedAt so Firestore ordering stays consistent
      if (latestContentRef.current !== null) {
        updateItem('exams', examId, {
          reportContent: latestContentRef.current,
          updatedAt: Date.now()
        }).catch((err) => logger.error('[useExamActions] Erro ao salvar no unmount:', err));
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
    setIsReasoning(true);

    // Roteador inteligente (Fase 2): red flag clínico força o Motor Pro,
    // ignorando a escolha do usuário (segurança nunca otimizada por custo).
    const decision = routeMotor({
      area: template.area,
      examType: template.name,
      clinicalIndication,
      anamnesis,
      userMotor: settings.selectedMotor,
    });
    lastMotorRef.current = decision.recommendedMotor;
    const effectiveSettings: AppSettings =
      decision.recommendedMotor !== settings.selectedMotor
        ? { ...settings, selectedMotor: decision.recommendedMotor }
        : settings;
    if (decision.forcedPro && settings.selectedMotor !== 'pro') {
      showToast('Motor Pro ativado automaticamente: sinal clínico de alerta detectado.', 'info');
    }

    try {
      const [previousExams, patientPreviousExams] = await Promise.all([
        settings.aiTrainingEnabled
          ? getRecentFinalizedReports(template.id, settings.aiTrainingContextSize || 3)
          : Promise.resolve([]),
        getPatientPreviousExams(patient.id, template.area, examId, 2)
      ]);

      const hasKey = true; // Sempre tenta usar a API (chaves de fallback integradas no servidor)
      let html: string;

      if (hasKey) {
        // Detecta se é a primeira geração (máscara ainda limpa/não editada)
        // Nesse caso, usa buildPrompt (GERAÇÃO INICIAL) para melhor qualidade
        const initialContent = getCombinedInitialReportContent(tpls, sectionTogglesFromSettings(settings));
        const cleanCurrent = currentReport.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
        const cleanInitial = initialContent.replace(/\s+/g, '').replace(/<[^>]*>/g, '');
        const isFirstGeneration = !customPrompt && (cleanCurrent === '' || cleanCurrent === cleanInitial);

        if (isFirstGeneration) {
          // Salva a máscara limpa como versão inicial
          await saveVersionSnapshot(examId, currentReport, 'generation');
          // Modo: GERAÇÃO INICIAL — gera do zero a partir da máscara como referência
          html = await generateReportStream({
            examId,
            template,
            templates: tpls,
            patient,
            settings: effectiveSettings,
            clinicalIndication,
            requestingPhysician,
            anamnesis,
            previousExams,
            patientPreviousExams,
            examDateMs,
          }, (chunk, rawText) => {
            const hasClosedScratch = rawText ? rawText.includes('</scratchpad>') : true;
            const hasOpenScratch = rawText ? rawText.includes('<scratchpad>') : false;
            setIsReasoning(hasOpenScratch && !hasClosedScratch);
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
            examId,
            currentReport,
            template,
            templates: tpls,
            patient,
            settings: effectiveSettings,
            clinicalIndication,
            requestingPhysician,
            anamnesis,
            previousExams,
            patientPreviousExams,
            customPrompt,
            examDateMs,
          }, (chunk, rawText) => {
            const hasClosedScratch = rawText ? rawText.includes('</scratchpad>') : true;
            const hasOpenScratch = rawText ? rawText.includes('<scratchpad>') : false;
            setIsReasoning(hasOpenScratch && !hasClosedScratch);
            if (chunk.trim()) {
              onReportChange(chunk);
            }
          });
          showToast('Laudo refinado com sucesso! ✓', 'success');
        }

        // Sanitização obrigatória do HTML antes de salvar (prevenção XSS)
        html = sanitizeHtml(html);

        // FASE 4 — Auto-refino por score: se a 1ª geração apresenta falhas
        // estruturais (auditReportQuality) e o auto-refino está habilitado,
        // executa UM único passe de refinamento estrutural. Best-effort e
        // sem loop: só substitui se o refino não piorou o score.
        if (
          isFirstGeneration &&
          (settings.aiAutoRefineEnabled ?? false) &&
          html && html.trim().length > 10
        ) {
          const audit = auditReportQuality(html, examAreas);
          const hasErrors = audit.issues.some((i) => i.severity === 'error');
          if (hasErrors || audit.score < 70) {
            try {
              const refined = await generateReportStream({
                examId,
                currentReport: html,
                template,
                templates: tpls,
                patient,
                settings: effectiveSettings,
                clinicalIndication,
                requestingPhysician,
                anamnesis,
                previousExams,
                patientPreviousExams,
                examDateMs,
              }, (chunk, rawText) => {
                const hasClosedScratch = rawText ? rawText.includes('</scratchpad>') : true;
                const hasOpenScratch = rawText ? rawText.includes('<scratchpad>') : false;
                setIsReasoning(hasOpenScratch && !hasClosedScratch);
                if (chunk.trim()) onReportChange(chunk);
              });
              const refinedClean = sanitizeHtml(refined);
              if (
                refinedClean && refinedClean.trim().length > 10 &&
                auditReportQuality(refinedClean, examAreas).score >= audit.score
              ) {
                html = refinedClean;
                showToast('Auto-refino de qualidade aplicado ✓', 'info');
              }
            } catch (e) {
              logger.warn('[useExamActions] Auto-refino falhou (mantendo geração original):', e);
            }
          }
        }

        // Proteção contra laudos em branco
        if (html && html.trim().length > 10) {
          // Loop de feedback: snapshot da 1ª geração (base do diff no finalize).
          if (isFirstGeneration) {
            initialGeneratedRef.current = html;
            refinementCountRef.current = 0;
          } else {
            refinementCountRef.current += 1;
          }
          onReportChange(html);
          await updateItem('exams', examId, { reportContent: html });
        } else {
          showToast('Falha na geração: resposta vazia da IA. Restaurando anterior...', 'error');
          onReportChange(currentReport);
        }
      } else {
        html = generateMockReport({ template, templates: tpls, patient, settings });
        showToast('API Key não configurada — modo demonstração ativo', 'info');
        onReportChange(html);
        await updateItem('exams', examId, { reportContent: html });
      }
    } catch (e: unknown) {
      logger.error('[useExamActions] Erro na geração/refinamento:', e);
      const rawMsg = e instanceof Error ? e.message : String(e) || 'Erro ao processar laudo com IA';
      const message = rawMsg.includes('404') || rawMsg.includes('not found') || rawMsg.includes('models/')
        ? `Modelo de IA não encontrado. Verifique o nome do modelo em Configurações. (${rawMsg.substring(0, 60)})`
        : rawMsg.includes('403') || rawMsg.includes('unauthorized') || rawMsg.includes('Unauthorized')
          ? 'API Key inválida ou sem permissão. Verifique em Configurações.'
          : rawMsg.includes('API Key') || rawMsg.includes('api key')
            ? `Chave de API não configurada. Acesse Configurações para adicionar. (Detalhe: ${rawMsg})`
            : rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED')
              ? 'Limite de requisições da API atingido. Aguarde alguns segundos.'
              : rawMsg;
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
      setIsReasoning(false);
    }
  }, [template, patient, settings, clinicalIndication, requestingPhysician, anamnesis, examId, examDateMs, onReportChange, showToast]);

  const updateStatus = useCallback(async (status: ExamStatus, finalReport?: string) => {
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
          logger.warn('[useExamActions] Falha silenciosa ao remover worklist do PACS:', err);
        });

        // Loop de feedback (Fase 3/4): captura do delta geração→final + qualidade.
        // Best-effort, totalmente assíncrono — nunca bloqueia a finalização.
        // A NOTA de qualidade é registrada em TODA finalização (não depende de
        // ter gerado nesta sessão) para o dashboard de aprendizado se popular.
        if (finalReport && template) {
          captureFinalizationFeedback(finalReport);
        }
      }
    } catch (err) {
      showToast('Erro ao atualizar status', 'error');
    }
  }, [examId, settings, showToast, template, anamnesis, clinicalIndication]);

  /** Persiste nota de qualidade (sempre) + sinal de correção (se houve geração). */
  const captureFinalizationFeedback = useCallback((finalReport: string) => {
    if (!template) return;
    try {
      const motor = lastMotorRef.current;
      const audit = auditReportQuality(finalReport, examAreas);
      const verification = verifyReport(finalReport, {
        area: template.area,
        anamnesis,
        clinicalIndication,
      });

      // Sinal de correção só quando temos a geração inicial (para o diff).
      const initial = initialGeneratedRef.current;
      let critical = false;
      if (initial) {
        const signal = classifyCorrection(initial, finalReport, {
          area: template.area,
          examType: combinedExamType(tpls),
          motor,
        });
        critical = signal.critical;
        void recordCorrectionSignal(signal);
      }

      // NOTA de qualidade: registrada em toda finalização.
      void recordQualityRecord({
        area: template.area,
        examType: combinedExamType(tpls),
        motor,
        auditScore: audit.score,
        refinementCount: refinementCountRef.current,
        safetyPassed: verification.passed && !critical,
        latencyMs: 0,
        timestamp: Date.now(),
      });
    } catch (err) {
      logger.warn('[useExamActions] Falha ao capturar feedback de finalização:', err);
    }
  }, [template, anamnesis, clinicalIndication]);

  return {
    isGenerating,
    isReasoning,
    saveState,
    debouncedSave,
    handleRefine,
    updateStatus
  };
}
