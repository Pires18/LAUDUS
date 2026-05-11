import { getGoogleAccessToken } from './googleAuth';

/**
 * Interface para a API do Google Drive (v3).
 * Documentação: https://developers.google.com/drive/api/reference/rest/v3
 */

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';

/**
 * Cria uma cópia de um arquivo existente (ex: um template de laudo).
 */
export async function copyFile(fileId: string, newName: string, folderId?: string): Promise<string> {
  const token = await getGoogleAccessToken();

  const parents = folderId ? [folderId] : undefined;
  
  const response = await fetch(`${DRIVE_API_URL}/${fileId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newName,
      parents: parents,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Drive API Error (copyFile): ${error.error?.message}`);
  }

  const data = await response.json();
  return data.id; // Retorna o ID do novo arquivo
}

/**
 * Cria uma pasta no Google Drive.
 */
export async function createFolder(name: string, parentId?: string): Promise<string> {
  const token = await getGoogleAccessToken();

  const body: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    body.parents = [parentId];
  }

  const response = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Drive API Error (createFolder): ${error.error?.message}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Faz upload de um arquivo gerado localmente (Blob) para o Drive (ex: .docx exportado).
 */
export async function uploadFile(file: Blob, name: string, mimeType: string, folderId?: string): Promise<string> {
  const token = await getGoogleAccessToken();
  
  const metadata = {
    name,
    mimeType,
    parents: folderId ? [folderId] : undefined,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Drive API Error (uploadFile): ${error.error?.message}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Exclui permanentemente um arquivo (ou move para a lixeira se suportado).
 * Na API v3, method DELETE ignora permanentemente, ou podemos usar update com trashed=true.
 * Vamos usar DELETE para remover completamente ou mover para a lixeira dependendo da configuração da conta.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const token = await getGoogleAccessToken();
  
  const response = await fetch(`${DRIVE_API_URL}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Drive API Error (deleteFile): ${error.error?.message}`);
  }
}
