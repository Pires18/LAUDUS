import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const _require = createRequire(import.meta.url);

// Vite SSR (ssrLoadModule) does not inject non-VITE_ env vars into process.env.
// Load .env manually so FIREBASE_* credentials are available to API handlers.
function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const raw of lines) {
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
  } catch {
    // silently ignore
  }
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
      console.error('[FIREBASE] Credenciais ausentes. PROJECT_ID:', projectId, '| CLIENT_EMAIL:', !!clientEmail, '| PRIVATE_KEY:', !!privateKey);
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
