import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// CJS (Vercel): `require` exists globally. ESM (Vite SSR): must use createRequire.
declare const require: any;
const _require: (id: string) => any =
  typeof require !== 'undefined' ? require : createRequire(import.meta.url);

// Vite SSR does not inject non-VITE_ vars into process.env — load .env manually.
// On Vercel the file won't exist, so this is a no-op there.
function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  try {
    for (const raw of readFileSync(envPath, 'utf-8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      val = val.replace(/\\n/g, '\n');
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* ignore */ }
}

loadDotEnv();

let _initialized = false;

function initApp() {
  if (_initialized) return;
  const { initializeApp, getApps, cert } = _require('firebase-admin/app');
  if (!getApps().length) {
    const projectId   = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'laudus';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      console.error('[FIREBASE] Credenciais ausentes:', { projectId, hasEmail: !!clientEmail, hasKey: !!privateKey });
      initializeApp({ projectId });
    }
  }
  _initialized = true;
}

export function getDb() {
  initApp();
  const { getFirestore } = _require('firebase-admin/firestore');
  return getFirestore();
}

export function getAdminAuth() {
  initApp();
  const { getAuth } = _require('firebase-admin/auth');
  return getAuth();
}
