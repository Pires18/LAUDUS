import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface PickerOptions {
  viewId: string; // 'DOCS' ou 'FOLDERS'
  onSelect: (id: string, name: string) => void;
  onCancel?: () => void;
}

/**
 * Componente invisível que gerencia a abertura do Google Picker.
 * Exige a inclusão de <script src="https://apis.google.com/js/api.js"></script> no index.html
 */
export function useGooglePicker() {
  const { getGoogleAccessToken } = useAuth();
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  useEffect(() => {
    // Carrega a API do Picker nativamente se disponível globalmente
    if (window.gapi) {
      window.gapi.load('picker', { callback: () => setPickerApiLoaded(true) });
    } else {
      console.warn('Google API (gapi) não carregada no window.');
    }
  }, []);

  const openPicker = async (options: PickerOptions) => {
    if (!pickerApiLoaded || !window.gapi || !window.google) {
      console.error('Picker API não carregada');
      return;
    }

    try {
      const token = await getGoogleAccessToken();
      if (!token) throw new Error('Falha ao obter token');

      const view = options.viewId === 'DOCS' 
        ? new window.google.picker.DocsView().setMimeTypes('application/vnd.google-apps.document')
        : new window.google.picker.DocsView().setMimeTypes('application/vnd.google-apps.folder').setSelectFolderEnabled(true);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(import.meta.env.VITE_FIREBASE_API_KEY) // Firebase API key funciona aqui
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            options.onSelect(doc.id, doc.name);
          } else if (data.action === window.google.picker.Action.CANCEL) {
            if (options.onCancel) options.onCancel();
          }
        })
        .build();
        
      picker.setVisible(true);
    } catch (err) {
      console.error('Erro ao abrir Picker:', err);
    }
  };

  return { openPicker, isReady: pickerApiLoaded };
}
