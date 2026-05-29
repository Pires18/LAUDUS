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
