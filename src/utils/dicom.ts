import { Patient, DicomDevice } from '../types';
import { logger } from './logger';
import { getWorklistEndpoint, getActivePacsUrl, getProxyEndpoint, getDicomAuthParams } from '../store/db';
import { getIdToken } from '../lib/authToken';

/**
 * Aparelhos visíveis para uma clínica: os dela (clinicId igual) + os
 * compartilhados (sem clinicId). Sem clínica informada, mostra todos.
 */
export function getDevicesForClinic(devices: DicomDevice[] | undefined, clinicId?: string | null): DicomDevice[] {
  if (!devices) return [];
  if (!clinicId) return devices;
  return devices.filter((d) => !d.clinicId || d.clinicId === clinicId);
}

/**
 * Escolhe o aparelho a usar quando nenhum foi selecionado explicitamente,
 * já restrito aos aparelhos visíveis para a clínica. Prioridade: aparelho
 * principal DAQUELA clínica > aparelho principal compartilhado/global >
 * primeiro aparelho já associado à clínica > primeiro da lista.
 */
export function pickDefaultDicomDevice(
  devices: DicomDevice[] | undefined,
  clinicId?: string | null,
  defaultByClinic?: Record<string, string>,
  globalDefaultId?: string
): DicomDevice | undefined {
  const pool = getDevicesForClinic(devices, clinicId);
  if (pool.length === 0) return undefined;
  const clinicDefaultId = clinicId ? defaultByClinic?.[clinicId] : undefined;
  return (
    pool.find((d) => d.id === clinicDefaultId) ||
    pool.find((d) => d.id === globalDefaultId) ||
    (clinicId ? pool.find((d) => d.clinicId === clinicId) : undefined) ||
    pool[0]
  );
}

/**
 * Envia um exame para a Worklist do Orthanc (Primário e Backup)
 */
export async function syncExamToOrthancWorklist(
  examId: string,
  examType: string,
  patient: Pick<Patient, 'id' | 'name' | 'birthDate' | 'gender'>,
  settings: any,
  deviceId?: string,
  examDate?: number,
  clinicId?: string
): Promise<{ success: boolean; primarySuccess?: boolean; backupSuccess?: boolean; error?: string }> {
  try {
    // Formata o nome para DICOM (Mantendo ordem natural em maiúsculas sem acentos)
    const dicomName = patient.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const dicomBirthDate = patient.birthDate ? patient.birthDate.replace(/[^0-9]/g, '') : '';
    
    const now = new Date();
    // A data do .wl é a data em que o APARELHO vai realizar o exame — ele só
    // lista entradas de HOJE na consulta MWL. examDate editado para o passado
    // (correção da data do laudo) não pode vazar pra cá, senão o exame "some"
    // do aparelho com toast de sucesso. Futuro é permitido (agendamento).
    const stepDateObj = examDate && examDate > now.getTime() ? new Date(examDate) : now;

    const stepDate = stepDateObj.getFullYear() + 
      String(stepDateObj.getMonth() + 1).padStart(2, '0') + 
      String(stepDateObj.getDate()).padStart(2, '0');
    const stepTime = String(now.getHours()).padStart(2, '0') + 
      String(now.getMinutes()).padStart(2, '0') + 
      String(now.getSeconds()).padStart(2, '0');

    // VR LO (Scheduled Procedure Step Description) tem limite de 64 caracteres \u2014
    // nomes de exame combinado ("A + B") podem ultrapassar; truncar \u00e9 obrigat\u00f3rio.
    const stepDescription = examType
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
      .slice(0, 64);

    const legacyFallback = { aeTitle: settings.dicomModalityAETitle || 'MINDRAYMX7', modality: settings.dicomModalityType || 'US' };
    const targetDevice = deviceId
      ? settings.dicomDevices?.find((d: any) => d.id === deviceId) || legacyFallback
      : pickDefaultDicomDevice(settings.dicomDevices, clinicId, settings.dicomDefaultDeviceIdByClinic, settings.dicomDefaultDeviceId) || legacyFallback;

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
            // ScheduledStationAETitle precisa ser o AE Title do APARELHO
            // selecionado (é o que o aparelho casa contra a própria identidade
            // ao consultar a Worklist) — nunca o dicomOrthancAETitle (esse é a
            // identidade do PACS/Orthanc em si, usado pro aparelho DISCAR, não
            // pra filtrar worklist). Usar o do Orthanc aqui fazia todo exame
            // gravar a mesma AE Title no .wl, não importa o aparelho escolhido.
            aeTitle: targetDevice.aeTitle,
            stepDate,
            stepTime,
            stepDescription,
            outputDir: settings.dicomWorklistFolder,
            localAgentUrl: settings.dicomLocalAgentUrl,
            tenantId: settings.dicomTenantId,
            agentSecret: settings.dicomAgentSecret
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
            // Mesmo motivo do envio primário acima — ScheduledStationAETitle
            // é do aparelho, não do Orthanc de backup.
            aeTitle: targetDevice.aeTitle,
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

export interface ExternalDicomUploadResult {
  fileName: string;
  success: boolean;
  error?: string;
  studyInstanceUid?: string;
  patientName?: string;
  patientIdTag?: string;
  studyDescription?: string;
}

/** Acima disso o envio é considerado "pesado" — menos concorrência e aviso de limite do Vercel. */
export const DICOM_LARGE_FILE_BYTES = 15 * 1024 * 1024;

/** Se o Agente Local está configurado com URL pública HTTPS, o upload vai direto
 * pra ele (bypassa o limite de payload do servidor serverless da Vercel, ~4,5MB). */
export function hasDirectDicomAgent(settings: any): boolean {
  return !!(settings?.dicomLocalAgentUrl && /^https:\/\//i.test(settings.dicomLocalAgentUrl));
}

/** POST via XHR (não fetch) para conseguir progresso real de upload — o fetch
 * não expõe evento de progresso do corpo enviado em navegadores hoje. */
function xhrUpload(
  url: string,
  body: ArrayBuffer,
  contentType: string,
  timeoutMs: number,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {}); }
        catch { resolve({}); }
      } else {
        reject(new Error(`PACS recusou (HTTP ${xhr.status})${xhr.responseText ? ': ' + xhr.responseText.slice(0, 150) : ''}`));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede durante o envio — conexão instável ou agente fora do ar.'));
    xhr.ontimeout = () => reject(new Error(`Tempo esgotado após ${Math.round(timeoutMs / 1000)}s — arquivo grande e/ou conexão lenta. Tente novamente.`));
    xhr.send(body);
  });
}

/**
 * Envia um único arquivo DICOM (exame feito em local externo, sem aparelho
 * conectado) direto pro Orthanc via `POST /instances` — mesmo proxy usado
 * para autorizar aparelhos. Depois lê `GET /studies/{id}` pra pegar o
 * StudyInstanceUID e os dados do paciente gravados no arquivo (o Orthanc já
 * extrai as tags DICOM; não precisamos parsear o arquivo no navegador).
 *
 * `onProgress` reporta bytes enviados em tempo real — importante pra arquivos
 * grandes (cine loop de US, séries de CT/MR), onde um simples spinner deixa
 * o usuário sem noção se o envio travou ou só está demorando.
 */
export async function uploadExternalDicomFile(
  file: File,
  settings: any,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<ExternalDicomUploadResult> {
  const baseUrl = getActivePacsUrl(settings, false).replace(/\/$/, '');
  const auth = getDicomAuthParams(settings, false);
  const proxyPath = getProxyEndpoint(settings, false);

  try {
    const buffer = await file.arrayBuffer();
    const uploadTarget = `${baseUrl}/instances`;
    const uploadUrl = `${proxyPath}?url=${encodeURIComponent(uploadTarget)}${auth}`;
    // Timeout escalado pelo tamanho (30s base + ~1s por MB, teto de 6min) — fixo
    // e curto demais derrubava arquivo grande antes de terminar; longo demais
    // deixava um erro real (agente caído) parecendo só "lento".
    const timeoutMs = Math.min(360_000, 30_000 + Math.round(file.size / (1024 * 1024)) * 1000);
    const uploadJson = await xhrUpload(uploadUrl, buffer, 'application/dicom', timeoutMs, onProgress);
    const orthancStudyId = uploadJson.ParentStudy || uploadJson.ID;
    if (!orthancStudyId) throw new Error('Orthanc aceitou o arquivo, mas não retornou o ID do estudo.');

    const studyTarget = `${baseUrl}/studies/${orthancStudyId}`;
    const studyUrl = `${proxyPath}?url=${encodeURIComponent(studyTarget)}${auth}`;
    const studyRes = await fetch(studyUrl);
    if (!studyRes.ok) throw new Error(`Arquivo enviado, mas falhou ao ler os dados do estudo (HTTP ${studyRes.status}).`);
    const studyJson = await studyRes.json();
    const studyInstanceUid = studyJson.MainDicomTags?.StudyInstanceUID;
    if (!studyInstanceUid) throw new Error('Estudo enviado, mas sem StudyInstanceUID nas tags.');

    return {
      fileName: file.name,
      success: true,
      studyInstanceUid,
      patientName: studyJson.PatientMainDicomTags?.PatientName,
      patientIdTag: studyJson.PatientMainDicomTags?.PatientID,
      studyDescription: studyJson.MainDicomTags?.StudyDescription,
    };
  } catch (err: any) {
    return { fileName: file.name, success: false, error: err.message || 'Falha no upload.' };
  }
}

export interface DicomInstancePreloadResult {
  /** instanceId -> URL de blob local, pronta pra usar em <img src>. */
  urls: Record<string, string>;
  /** instanceIds que não carregaram mesmo após todas as tentativas. */
  failedIds: string[];
}

/**
 * Reduz um blob de imagem pro tamanho/qualidade pedidos (via canvas), gerando
 * um JPEG bem mais leve — usado no PDF, onde a imagem sai bem menor na página
 * (ex: 8 por folha no grid 2x4) e não precisa da resolução nativa do preview.
 * Se o navegador não conseguir otimizar por algum motivo, devolve o blob
 * original intacto — otimização é um bônus, nunca pode virar motivo de falha.
 */
async function optimizeImageBlob(blob: Blob, maxWidth: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    // Já está menor que o alvo — não vale a pena reencodar (perderia qualidade à toa).
    if (scale >= 1) return blob;
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return optimized || blob;
  } finally {
    bitmap.close?.();
  }
}

/**
 * Baixa o preview de uma lista de instâncias DICOM como blobs locais, com
 * timeout + novas tentativas por imagem — usado tanto no painel lateral
 * quanto na geração do PDF, pra só exibir/imprimir o estudo quando ele
 * estiver completo, em vez de imagens aparecendo aos poucos com risco de
 * quebrar/faltar por causa de uma rede instável ou um servidor lento.
 */
export async function preloadDicomInstances(
  instances: any[],
  settings: any,
  options: {
    concurrency?: number;
    timeoutMs?: number;
    maxAttempts?: number;
    onProgress?: (done: number, total: number, failed: number) => void;
    /** Se definido, reduz cada imagem (canvas → JPEG) pro tamanho do PDF final —
     * mais leve pra montar/imprimir com muitas fotos por página. */
    optimize?: { maxWidth: number; quality?: number };
    /** Cancela os downloads em andamento (ex.: usuário trocou de estudo) —
     * instância cancelada não conta como falha nem entra em `failedIds`. */
    signal?: AbortSignal;
    /** Blobs já baixados (instanceId -> object URL): a instância é lida deste
     * blob local em vez da rede — ex.: PDF reusando os previews do painel. */
    sourceUrls?: Record<string, string>;
  } = {}
): Promise<DicomInstancePreloadResult> {
  const { concurrency = 6, timeoutMs = 16000, maxAttempts = 3, onProgress, optimize, signal, sourceUrls } = options;
  const urls: Record<string, string> = {};
  const failedIds: string[] = [];
  if (!instances || instances.length === 0) return { urls, failedIds };

  const primaryBaseUrl = getActivePacsUrl(settings, false);
  const backupBaseUrl = getActivePacsUrl(settings, true);
  let done = 0;
  let cursor = 0;

  // Auth/rota inválidas ou instância inexistente: repetir não muda o resultado,
  // só segura o worker por até ~50s à toa.
  const isPermanentHttpError = (status: number) => [400, 401, 403, 404].includes(status);

  const fetchOne = async (instance: any) => {
    const isBackup = instance.serverSource === 'backup';
    const serverUrl = isBackup ? backupBaseUrl : primaryBaseUrl;
    const proxyPath = getProxyEndpoint(settings, isBackup);
    const localSource = sourceUrls?.[instance.ID];
    const target = `${serverUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`;
    const url = localSource ?? `${proxyPath}?url=${encodeURIComponent(target)}${getDicomAuthParams(settings, isBackup)}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) return;
      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      signal?.addEventListener('abort', onExternalAbort, { once: true });
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          if (isPermanentHttpError(res.status)) {
            failedIds.push(instance.ID);
            logger.warn(`[PACS] Imagem ${instance.ID} recusada (HTTP ${res.status}) — sem nova tentativa.`);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        let blob = await res.blob();
        if (optimize) {
          blob = await optimizeImageBlob(blob, optimize.maxWidth, optimize.quality ?? 0.85).catch((err) => {
            logger.warn(`[PACS] Falha ao otimizar imagem ${instance.ID} — usando original:`, err);
            return blob;
          });
        }
        urls[instance.ID] = URL.createObjectURL(blob);
        return;
      } catch (err) {
        if (signal?.aborted) return;
        if (attempt === maxAttempts) {
          failedIds.push(instance.ID);
          logger.warn(`[PACS] Imagem ${instance.ID} falhou após ${maxAttempts} tentativas:`, err);
        } else {
          // Backoff simples entre tentativas — evita bater de novo instantaneamente
          // num servidor/rede que acabou de engasgar.
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onExternalAbort);
      }
    }
  };

  const worker = async () => {
    while (cursor < instances.length && !signal?.aborted) {
      const idx = cursor++;
      await fetchOne(instances[idx]);
      done++;
      onProgress?.(done, instances.length, failedIds.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, instances.length) }, worker));
  return { urls, failedIds };
}
