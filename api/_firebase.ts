import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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

function getCredentials() {
  loadDotEnv();
  return {
    projectId:   process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'laudus',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

// Single initialization promise prevents race conditions when getDb() and
// getAdminAuth() are called in parallel within the same serverless invocation.
let _initPromise: Promise<void> | null = null;
let _db: any   = null;
let _auth: any = null;

async function ensureInit() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    if (!getApps().length) {
      const { projectId, clientEmail, privateKey } = getCredentials();
      if (clientEmail && privateKey) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      } else {
        console.error('[FIREBASE] Credenciais ausentes — PROJECT_ID:', projectId, 'EMAIL:', !!clientEmail, 'KEY:', !!privateKey);
        initializeApp({ projectId });
      }
    }
  })();
  return _initPromise;
}

export async function getDb() {
  if (_db) return _db;
  await ensureInit();
  const { getFirestore } = await import('firebase-admin/firestore');
  _db = getFirestore();
  return _db;
}

export async function getAdminAuth() {
  if (_auth) return _auth;
  await ensureInit();
  const { getAuth } = await import('firebase-admin/auth');
  _auth = getAuth();
  return _auth;
}
