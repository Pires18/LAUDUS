import { Patient } from '../types';
import { logger } from './logger';
import { getWorklistEndpoint } from '../store/db';
import { getIdToken } from '../lib/authToken';

/**
 * Envia um exame para a Worklist do Orthanc (Primário e Backup)
 */
export async function syncExamToOrthancWorklist(
  examId: string,
  examType: string,
  patient: Pick<Patient, 'id' | 'name' | 'birthDate' | 'gender'>,
  settings: any,
  deviceId?: string,
  examDate?: number
): Promise<{ success: boolean; primarySuccess?: boolean; backupSuccess?: boolean; error?: string }> {
  try {
    // Formata o nome para DICOM (Mantendo ordem natural em maiúsculas sem acentos)
    const dicomName = patient.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const dicomBirthDate = patient.birthDate ? patient.birthDate.replace(/[^0-9]/g, '') : '';
    
    const now = new Date();
    const stepDateObj = examDate ? new Date(examDate) : now;
    
    const stepDate = stepDateObj.getFullYear() + 
      String(stepDateObj.getMonth() + 1).padStart(2, '0') + 
      String(stepDateObj.getDate()).padStart(2, '0');
    const stepTime = String(now.getHours()).padStart(2, '0') + 
      String(now.getMinutes()).padStart(2, '0') + 
      String(now.getSeconds()).padStart(2, '0');

    const stepDescription = examType.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    const targetDevice = deviceId 
      ? settings.dicomDevices?.find((d: any) => d.id === deviceId) || { aeTitle: settings.dicomModalityAETitle || 'MINDRAYMX7', modality: settings.dicomModalityType || 'US' }
      : settings.dicomDevices?.[0] || { aeTitle: settings.dicomModalityAETitle || 'MINDRAYMX7', modality: settings.dicomModalityType || 'US' };

    // Envia ao primário e ao backup EM PARALELO — assim um servidor lento ou caído
    // (ex.: agente do Mac fora do ar) não atrasa o envio ao outro.
    let primarySuccess = false;
    let primaryAttempted = false;
    let primaryError = '';
    let backupSuccess = true;
    let backupAttempted = false;

    const sendPrimary = async () => {
      if (settings.dicomSyncEnabled === false || patient.id === 'ANONIMO') {
        primarySuccess = true; // Skip gracefully if anon or disabled
        return;
      }
      primaryAttempted = true;
      // Same-origin '/api/worklist': no local o Vite grava o .wl nesta máquina;
      // no Vercel a função serverless encaminha server-side ao agente público
      // (localAgentUrl do corpo) — mesmo canal confiável usado pelas imagens.
      const url = getWorklistEndpoint(settings, false);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getIdToken()}`,
            ...(settings.dicomAgentSecret ? { 'x-agent-secret': settings.dicomAgentSecret } : {})
          },
          body: JSON.stringify({
            examId,
            patientName: dicomName,
            patientId: patient.id,
            patientBirthDate: dicomBirthDate,
            patientSex: patient.gender || 'F',
            modality: targetDevice.modality,
            aeTitle: settings.dicomOrthancAETitle || targetDevice.aeTitle,
            stepDate,
            stepTime,
            stepDescription,
            outputDir: settings.dicomWorklistFolder,
            localAgentUrl: settings.dicomLocalAgentUrl
          })
        });
        const result = await res.json();
        primarySuccess = result.success;
        if (!result.success) primaryError = result.error;
      } catch (err: any) {
        logger.warn('[Orthanc Sync] Falha ao enviar para o worklist local:', err);
        primaryError = err.message || 'Erro de conexão';
      }
    };

    const sendBackup = async () => {
      if (!settings.dicomBackupSyncEnabled || patient.id === 'ANONIMO') return;
      backupAttempted = true;
      try {
        const urlBackup = getWorklistEndpoint(settings, true);
        const backupRes = await fetch(urlBackup, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getIdToken()}`,
            ...(settings.dicomBackupAgentSecret ? { 'x-agent-secret': settings.dicomBackupAgentSecret } : {})
          },
          body: JSON.stringify({
            examId,
            patientName: dicomName,
            patientId: patient.id,
            patientBirthDate: dicomBirthDate,
            patientSex: patient.gender || 'F',
            modality: targetDevice.modality,
            aeTitle: settings.dicomBackupOrthancAETitle || targetDevice.aeTitle,
            stepDate,
            stepTime,
            stepDescription,
            outputDir: settings.dicomBackupWorklistFolder,
            localAgentUrl: settings.dicomBackupLocalAgentUrl
          })
        });
        const backupResult = await backupRes.json();
        if (!backupResult.success) backupSuccess = false;
      } catch (err) {
        logger.warn('[Orthanc Backup Sync] Falha ao enviar:', err);
        backupSuccess = false;
      }
    };

    await Promise.all([sendPrimary(), sendBackup()]);

    // Sucesso geral: basta UM destino habilitado ter gravado. Assim, se o primário
    // (ex.: agente do Mac) estiver fora do ar mas o backup gravar, a worklist ainda
    // é considerada enviada — o aparelho de US lê do backup. (primarySuccess já vem
    // true quando o envio ao primário é pulado por anon/desabilitado.)
    const overallSuccess = primarySuccess || (backupAttempted && backupSuccess);

    return {
      success: overallSuccess,
      primarySuccess,
      backupSuccess,
      error: overallSuccess
        ? undefined
        : (primaryError || (primaryAttempted ? 'Falha ao enviar a worklist ao servidor.' : 'Nenhum servidor de worklist habilitado.'))
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Converte um ID alfanumérico do Firestore (base62) em uma string numérica (base 10) determinística e sem colisões.
 */
export function getNumericUidFromFirestoreId(id: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let value = BigInt(0);
  for (let i = 0; i < id.length; i++) {
    const char = id[i];
    const index = chars.indexOf(char);
    if (index === -1) {
      value = value * BigInt(62) + BigInt(char.charCodeAt(0) % 62);
    } else {
      value = value * BigInt(62) + BigInt(index);
    }
  }
  return value.toString();
}

/**
 * Retorna o StudyInstanceUID numérico válido com base no ID do exame do Firestore.
 */
export function getStudyInstanceUID(examId: string): string {
  if (!examId) return '';
  return `1.2.276.0.7230010.3.1.2.${getNumericUidFromFirestoreId(examId)}`;
}
