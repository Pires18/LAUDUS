import { getGoogleAccessToken } from './googleAuth';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════
// GOOGLE PICKER — seleção de template/pasta com escopo drive.file
// ═══════════════════════════════════════════════════════════════
// Com o escopo mínimo `drive.file`, o app só acessa arquivos que ele criou
// OU que o usuário selecionou explicitamente pelo Picker. Este módulo abre o
// seletor oficial do Google e devolve o id do item escolhido — o simples ato
// de selecionar concede ao app acesso permanente àquele arquivo/pasta.
//
// Pré-requisito de infra: a "Google Picker API" precisa estar habilitada no
// projeto Google Cloud (antigravity-laudus).

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || '';
// Número do projeto GCP (== messagingSenderId) — exigido pelo Picker (appId).
const APP_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';

let gapiScriptPromise: Promise<void> | null = null;
let pickerLoadPromise: Promise<void> | null = null;

/** Carrega o script gapi (uma vez) e o módulo 'picker'. */
async function loadPicker(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise;

  pickerLoadPromise = (async () => {
    if (!gapiScriptPromise) {
      gapiScriptPromise = new Promise<void>((resolve, reject) => {
        if ((window as any).gapi) return resolve();
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Falha ao carregar a API do Google (api.js).'));
        document.head.appendChild(script);
      });
    }
    await gapiScriptPromise;

    await new Promise<void>((resolve, reject) => {
      (window as any).gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Falha ao carregar o módulo Google Picker.')),
      });
    });
  })();

  return pickerLoadPromise;
}

export interface PickedItem {
  id: string;
  name: string;
  url?: string;
}

type PickerKind = 'document' | 'folder';

/** Abre o Picker e resolve com o item selecionado (ou null se cancelado). */
async function openPicker(kind: PickerKind): Promise<PickedItem | null> {
  if (!API_KEY || !APP_ID) {
    throw new Error('Configuração do Google Picker ausente (API key / App ID).');
  }

  await loadPicker();
  const token = await getGoogleAccessToken();
  const google = (window as any).google;
  if (!google?.picker) {
    throw new Error('Google Picker indisponível. Verifique se a Picker API está habilitada.');
  }

  return new Promise<PickedItem | null>((resolve, reject) => {
    try {
      const view =
        kind === 'folder'
          ? new google.picker.DocsView(google.picker.ViewId.FOLDERS)
              .setSelectFolderEnabled(true)
              .setMimeTypes('application/vnd.google-apps.folder')
          : new google.picker.DocsView(google.picker.ViewId.DOCUMENTS)
              .setMimeTypes('application/vnd.google-apps.document');

      const picker = new google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .setCallback((data: any) => {
          const action = data[google.picker.Response.ACTION];
          if (action === google.picker.Action.PICKED) {
            const doc = data[google.picker.Response.DOCUMENTS]?.[0];
            resolve(
              doc
                ? { id: doc[google.picker.Document.ID], name: doc[google.picker.Document.NAME], url: doc[google.picker.Document.URL] }
                : null
            );
          } else if (action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      logger.error('[Picker] Erro ao abrir o seletor:', err);
      reject(err instanceof Error ? err : new Error('Erro ao abrir o Google Picker.'));
    }
  });
}

/** Seleciona um Google Doc (template de laudo). */
export function pickGoogleDoc(): Promise<PickedItem | null> {
  return openPicker('document');
}

/** Seleciona uma pasta do Google Drive (destino dos laudos). */
export function pickGoogleFolder(): Promise<PickedItem | null> {
  return openPicker('folder');
}
