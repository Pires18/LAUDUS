import { useCallback } from 'react';
import { Patient, ExamRequest, Clinic, AppSettings } from '../../../types';
import { logger } from '../../../utils/logger';
import { syncGoogleDoc, cleanupGoogleDoc } from '../utils/googleDocSync';

interface UseGoogleDocsProps {
  examId: string;
  patient: Patient | null;
  exam: ExamRequest | null;
  clinic: Clinic | null;
  settings: AppSettings;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useGoogleDocs({
  examId,
  patient,
  exam,
  clinic,
  settings,
  showToast
}: UseGoogleDocsProps) {

  const createGoogleDoc = useCallback(async (reportContent: string) => {
    if (!clinic || !exam || !patient) {
      throw new Error('Configurações incompletas para gerar o documento.');
    }

    try {
      return await syncGoogleDoc(examId, reportContent, patient, exam, clinic, settings);
    } catch (err: unknown) {
      logger.error('[useGoogleDocs] Erro ao criar Doc:', err);
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar com Google Docs';
      showToast(message, 'error');
      throw err;
    }
  }, [clinic, exam, patient, examId, settings, showToast]);

  const deleteGoogleDoc = useCallback(async (docId: string) => {
    try {
      await cleanupGoogleDoc(examId, docId);
    } catch (err) {
      showToast('Erro ao remover documento do Drive', 'error');
      throw err;
    }
  }, [examId, showToast]);

  return {
    createGoogleDoc,
    deleteGoogleDoc
  };
}
