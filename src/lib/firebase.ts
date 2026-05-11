import { initializeApp } from 'firebase/app';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

/**
 * Configuração Firebase — substitua pelos valores do seu projeto.
 * Obtenha em: https://console.firebase.google.com → Project Settings → General → Your apps
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const app = initializeApp(firebaseConfig);
export const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const storage = getStorage(app);

// Google Auth provider com escopos para Drive e Docs
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/documents');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Habilita persistência offline multi-tab (IndexedDB cache do Firestore)
enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Persistência offline indisponível: múltiplas tabs abertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Persistência offline não suportada neste navegador.');
  }
});
