import { ExamRequest, Patient } from '../types';

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
): Promise<{ success: boolean; backupSuccess?: boolean; error?: string }> {
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

    const isVercel = typeof window !== 'undefined' && (window.location.hostname.includes('laud.us') || window.location.hostname.includes('vercel.app'));
    
    // Principal Sync
    let primarySuccess = false;
    let primaryError = '';
    
    if (settings.dicomSyncEnabled !== false && patient.id !== 'ANONIMO') {
      const url = (isVercel && settings.dicomLocalAgentUrl)
        ? `${settings.dicomLocalAgentUrl.replace(/\/$/, '')}/api/worklist`
        : '/api/worklist';
        
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        console.warn('[Orthanc Sync] Falha ao enviar para o worklist local:', err);
        primaryError = err.message || 'Erro de conexão';
      }
    } else {
      primarySuccess = true; // Skip gracefully if anon or disabled
    }

    // Backup Sync
    let backupSuccess = true;
    if (settings.dicomBackupSyncEnabled && patient.id !== 'ANONIMO') {
      try {
        const urlBackup = (isVercel && settings.dicomBackupLocalAgentUrl)
          ? `${settings.dicomBackupLocalAgentUrl.replace(/\/$/, '')}/api/worklist`
          : '/api/worklist';
          
        const backupRes = await fetch(urlBackup, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        console.warn('[Orthanc Backup Sync] Falha ao enviar:', err);
        backupSuccess = false;
      }
    }

    if (primarySuccess) {
      return { success: true, backupSuccess };
    } else {
      return { success: false, error: primaryError };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
