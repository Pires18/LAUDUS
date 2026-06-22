/**
 * Camada de acesso a dados — Firebase Firestore.
 *
 * Substitui completamente o antigo db.ts (Dexie/IndexedDB).
 * Todas as operações são user-scoped por padrão: users/{uid}/collection.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  QueryConstraint,
  limit,
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { AppSettings, SupportTicket, SupportMessage } from '../types';
import { DEFAULT_MASTER_PROMPT, DEFAULT_GLOBAL_INSTRUCTIONS, DEFAULT_STRUCTURE_PROMPT, DEFAULT_RIGID_RULES } from '../modules/ai/prompts/general';
import { ADMIN_UID, ADMIN_EMAIL } from '../config/constants';
import { logger } from '../utils/logger';
import { encryptPassword, decryptPassword } from '../utils/crypto';

async function decryptDicomPasswords<T extends { dicomPassword?: string; dicomBackupPassword?: string }>(
  settings: T
): Promise<T> {
  const uid = auth.currentUser?.uid;
  if (!uid) return settings;
  const [pw, bkpw] = await Promise.all([
    settings.dicomPassword ? decryptPassword(settings.dicomPassword, uid) : Promise.resolve(''),
    settings.dicomBackupPassword ? decryptPassword(settings.dicomBackupPassword, uid) : Promise.resolve(''),
  ]);
  return { ...settings, dicomPassword: pw, dicomBackupPassword: bkpw };
}

async function encryptDicomPasswords<T extends { dicomPassword?: string; dicomBackupPassword?: string }>(
  settings: T
): Promise<T> {
  const uid = auth.currentUser?.uid;
  if (!uid) return settings;
  const [pw, bkpw] = await Promise.all([
    settings.dicomPassword ? encryptPassword(settings.dicomPassword, uid) : Promise.resolve(''),
    settings.dicomBackupPassword ? encryptPassword(settings.dicomBackupPassword, uid) : Promise.resolve(''),
  ]);
  return { ...settings, dicomPassword: pw, dicomBackupPassword: bkpw };
}

// Cache global para evitar múltiplas queries do UID do administrador
let cachedAdminUid: string | null = null;

// ─── Helpers ───

function getUserPath(collectionName: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado. Realize o login novamente.');
  return `users/${uid}/${collectionName}`;
}

/**
 * Sanitiza objetos para o Firestore (remove undefined e limpa estruturas)
 */
function sanitize<T>(data: T): T {
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  
  const obj = data as Record<string, unknown>;
  if (obj.constructor?.name === 'FieldValueImpl' || ((obj as Record<string, unknown>)._methodName && obj.constructor?.name?.includes('FieldValue'))) {
    return data;
  }

  const result = (Array.isArray(data) ? [] : {}) as Record<string, unknown>;
  for (const key in obj) {
    if (obj[key] === undefined) continue;
    result[key] = sanitize(obj[key]);
  }
  return result as T;
}

export function getCollectionRef(collectionName: string) {
  return collection(firestore, getUserPath(collectionName));
}

export function getGlobalCollectionRef(collectionName: string) {
  return collection(firestore, collectionName);
}

export function getDocRef(collectionName: string, docId: string) {
  return doc(firestore, getUserPath(collectionName), docId);
}

export function getGlobalDocRef(collectionName: string, docId: string) {
  return doc(firestore, collectionName, docId);
}

/**
 * Gera um ID único do Firestore sem realizar escrita.
 */
export function genId(collectionName: string = '_temp'): string {
  return doc(collection(firestore, collectionName)).id;
}

/**
 * Gera um ID numérico curto (ex: 100234)
 */
export function generateNumericId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Gera um ID estruturado e legível, ex: PAC-A1B2C3
 */
export function generateStandardId(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

// ─── Settings (singleton document) ───

const SETTINGS_DOC_ID = 'app';

export async function getSettings(): Promise<AppSettings> {
  try {
    const docRef = doc(firestore, getUserPath('settings'), SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    const isWindows = typeof window !== 'undefined' && /Win/i.test(navigator.userAgent);
    
    let defaultSettings: AppSettings = {
      geminiModel: 'gemini-3.5-flash',
      aiProvider: 'anthropic',
      anthropicModel: 'claude-sonnet-4-6',
      dicomSyncEnabled: true,
      dicomWorklistFolder: isWindows
        ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
        : '',
      dicomModalityAETitle: 'MINDRAYMX7',
      dicomModalityType: 'US',
      dicomOrthancAETitle: '',
      dicomViewerUrl: '',
      dicomTailscalePublicUrl: '',
      dicomViewerType: 'stone',
      dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study={{StudyInstanceUID}}',
      dicomPreset: 'macmini',
      dicomUsername: '',
      dicomPassword: '',
      dicomLocalAgentUrl: '',
      dicomBackupSyncEnabled: false,
      dicomBackupViewerUrl: '',
      dicomBackupTailscalePublicUrl: '',
      dicomBackupOrthancAETitle: '',
      dicomBackupUsername: '',
      dicomBackupPassword: '',
      dicomBackupLocalAgentUrl: '',
      // Em não-Windows deixar vazio: o generate_wl.py aplica o fallback por SO.
      // Um path Windows hardcoded aqui faz o Python no Mac/Linux criar arquivos-lixo
      // com barras invertidas literais no diretório atual (corrompe o repositório git).
      dicomBackupWorklistFolder: isWindows
        ? 'C:\\OrthancServer\\db\\WorklistsDatabaseBackup\\'
        : '',
      soundNotifications: true,
      autoSave: true,
      signatureImageUrl: ''
    };
    let data = snap.exists() ? (snap.data() as AppSettings) : defaultSettings;

    // ── Versioned settings migrations ───────────────────────────────────────
    // Add new entries at the END. Never change existing version numbers.
    const SETTINGS_MIGRATIONS: Array<{ version: number; name: string; apply: (s: AppSettings) => void }> = [
      {
        version: 1,
        name: 'worklist-path-to-ssd',
        apply: (s) => {
          if (s.dicomWorklistFolder?.includes('/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase')) {
            s.dicomWorklistFolder = s.dicomWorklistFolder.replace(
              '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase',
              '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase'
            );
          }
        }
      },
      {
        version: 2,
        name: 'dicom-viewer-url-pattern-uid',
        apply: (s) => {
          if (s.dicomViewerUrlPattern?.includes('1.2.276.0.7230010.3.1.2.{{examId}}')) {
            s.dicomViewerUrlPattern = s.dicomViewerUrlPattern.replace('1.2.276.0.7230010.3.1.2.{{examId}}', '{{StudyInstanceUID}}');
          }
        }
      },
      {
        version: 3,
        name: 'dicom-viewer-url-add-port',
        apply: (s) => {
          if (s.dicomViewerUrl === 'https://servidor-mac.tail861dda.ts.net/') {
            s.dicomViewerUrl = 'https://servidor-mac.tail861dda.ts.net:8443/';
          }
        }
      },
      {
        version: 4,
        name: 'dicom-local-agent-url-normalize',
        apply: (s) => {
          if (s.dicomLocalAgentUrl?.includes('servidor-mac.tail861dda.ts.net') && s.dicomLocalAgentUrl !== 'https://servidor-mac.tail861dda.ts.net') {
            s.dicomLocalAgentUrl = 'https://servidor-mac.tail861dda.ts.net';
          }
        }
      },
      {
        version: 5,
        name: 'anthropic-model-upgrade-to-sonnet-4-6',
        apply: (s) => {
          if (s.anthropicModel === 'claude-3-5-sonnet-latest' || s.anthropicModel === 'claude-3-7-sonnet-latest' || s.anthropicModel === 'claude-3-5-haiku-latest') {
            s.anthropicModel = 'claude-sonnet-4-6';
          }
        }
      },
      {
        version: 6,
        name: 'fix-backup-worklist-folder-windows-path-on-mac',
        // O default antigo do backup era um path Windows hardcoded
        // ('C:\ORTHANCSERVER\DB\WORKLISTSDATABASE\') que, rodado no Mac/Linux,
        // fazia o Python criar arquivos-lixo com barras invertidas literais no
        // diretório atual (corrompeu o repositório git). Limpa o valor ruim para
        // que o generate_wl.py volte a aplicar o fallback correto por SO.
        apply: (s) => {
          const bad = s.dicomBackupWorklistFolder?.toUpperCase().replace(/\\/g, '');
          if (bad === 'C:ORTHANCSERVERDBWORKLISTSDATABASE') {
            const isWin = typeof window !== 'undefined' && /Win/i.test(navigator.userAgent);
            s.dicomBackupWorklistFolder = isWin ? 'C:\\OrthancServer\\db\\WorklistsDatabaseBackup\\' : '';
          }
        }
      },
    ];

    const currentVersion: number = (data as any)._settingsMigrationVersion ?? 0;
    const pendingMigrations = SETTINGS_MIGRATIONS.filter(m => m.version > currentVersion);
    if (pendingMigrations.length > 0 && snap.exists()) {
      for (const migration of pendingMigrations) {
        try {
          migration.apply(data);
          logger.info(`[DB] Migration ${migration.version} (${migration.name}) aplicada`);
        } catch (err) {
          logger.warn(`[DB] Falha na migration ${migration.version} (${migration.name}):`, err);
        }
      }
      const latestVersion = pendingMigrations[pendingMigrations.length - 1].version;
      (data as any)._settingsMigrationVersion = latestVersion;
      saveSettings(data).catch(err => logger.warn('[DB] Falha ao persistir migrations:', err));
    }

    // Se o preset for modificado localmente, a configuração persistirá sem ser sobrescrita.
    
    // Fallback de segurança para buscar prompts oficiais do administrador
    const isCurrentUserAdmin = auth.currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
    console.log('[DB] Resolvendo settings. Usuário:', auth.currentUser?.email, 'isAdmin:', isCurrentUserAdmin);

    if (!isCurrentUserAdmin) {
      console.log('[DB] Buscando configurações globais do administrador...');
      const adminSettings = await getAdminSettings();
      if (adminSettings) {
        console.log('[DB] Configurações globais do administrador carregadas com sucesso. Mesclando com configurações locais...');
        const merged = {
          ...defaultSettings,
          ...data, // Configurações locais do médico (Motor, PACS, CRM, RQE, etc) prevalecem
          
          // Prompts do sistema, doutrina e LAUD.IA publicados pelo administrador sobrepõem as locais:
          aiMasterPrompt: adminSettings.aiMasterPrompt || defaultSettings.aiMasterPrompt || DEFAULT_MASTER_PROMPT,
          aiGlobalInstructions: adminSettings.aiGlobalInstructions || defaultSettings.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS,
          aiStructurePrompt: adminSettings.aiStructurePrompt || defaultSettings.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT,
          aiRigidRules: adminSettings.aiRigidRules || defaultSettings.aiRigidRules || DEFAULT_RIGID_RULES,
          normalDoctrine: adminSettings.normalDoctrine || defaultSettings.normalDoctrine,
          aiAreaPrompts: adminSettings.aiAreaPrompts || defaultSettings.aiAreaPrompts,
          
          // Chaves de API, provedor, modelo e temperaturas herdados do administrador:
          aiProvider: adminSettings.aiProvider || data.aiProvider || defaultSettings.aiProvider,
          geminiModel: adminSettings.geminiModel || data.geminiModel || defaultSettings.geminiModel,
          anthropicModel: adminSettings.anthropicModel || data.anthropicModel || defaultSettings.anthropicModel,
          geminiApiKey: adminSettings.geminiApiKey || data.geminiApiKey || '',
          anthropicApiKey: adminSettings.anthropicApiKey || data.anthropicApiKey || '',
          aiTemperatureByMode: adminSettings.aiTemperatureByMode || data.aiTemperatureByMode || {},
          aiTemperature: adminSettings.aiTemperature ?? data.aiTemperature ?? defaultSettings.aiTemperature,
        };

        if (merged.anthropicModel === 'claude-3-5-sonnet-latest' || merged.anthropicModel === 'claude-3-7-sonnet-latest' || merged.anthropicModel === 'claude-3-5-haiku-latest') {
          merged.anthropicModel = 'claude-sonnet-4-6';
        }
        return decryptDicomPasswords(merged);
      } else {
        console.warn('[DB] getAdminSettings retornou null. O médico não pôde herdar as chaves e prompts do admin.');
      }
    }
    const finalData = { ...defaultSettings, ...data };
    finalData.aiMasterPrompt = finalData.aiMasterPrompt || DEFAULT_MASTER_PROMPT;
    finalData.aiGlobalInstructions = finalData.aiGlobalInstructions || DEFAULT_GLOBAL_INSTRUCTIONS;
    finalData.aiStructurePrompt = finalData.aiStructurePrompt || DEFAULT_STRUCTURE_PROMPT;
    finalData.aiRigidRules = finalData.aiRigidRules || DEFAULT_RIGID_RULES;

    if (finalData.anthropicModel === 'claude-3-5-sonnet-latest' || finalData.anthropicModel === 'claude-3-7-sonnet-latest' || finalData.anthropicModel === 'claude-3-5-haiku-latest') {
      finalData.anthropicModel = 'claude-sonnet-4-6';
    }

    // Se for o administrador do sistema (detectado por e-mail ou role), publica as configurações na coleção global
    if (isCurrentUserAdmin || finalData.currentRole === 'admin') {
      console.log('[DB] Usuário é administrador. Publicando/sincronizando configurações na coleção global (global_config/admin_settings)...');
      const globalDocRef = doc(firestore, 'global_config', 'admin_settings');
      setDoc(globalDocRef, sanitize({
        ...finalData,
        adminUid: auth.currentUser?.uid,
        adminEmail: auth.currentUser?.email || '',
        updatedAt: Date.now()
      }), { merge: true })
        .then(() => console.log('[DB] Sincronização global concluída.'))
        .catch(err => console.error('[DB] Erro ao sincronizar global settings do admin:', err));
    }

    return decryptDicomPasswords(finalData);
  } catch (err) {
    logger.warn('[DB] Erro ao carregar settings:', err);
  }
  const isWindows = typeof window !== 'undefined' && /Win/i.test(navigator.userAgent);
  return {
    geminiModel: 'gemini-3.5-flash',
    aiProvider: 'anthropic',
    anthropicModel: 'claude-sonnet-4-6',
    dicomSyncEnabled: true,
    dicomWorklistFolder: isWindows
      ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\'
      : '',
    dicomModalityAETitle: 'MINDRAYMX7',
    dicomModalityType: 'US',
    dicomOrthancAETitle: '',
    dicomViewerUrl: '',
    dicomTailscalePublicUrl: '',
    dicomViewerType: 'stone',
    dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study={{StudyInstanceUID}}',
    dicomPreset: 'macmini',
    dicomUsername: '',
    dicomPassword: '',
    dicomLocalAgentUrl: '',
    dicomBackupSyncEnabled: false,
    dicomBackupViewerUrl: '',
    dicomBackupTailscalePublicUrl: '',
    dicomBackupOrthancAETitle: '',
    dicomBackupUsername: '',
    dicomBackupPassword: '',
    dicomBackupLocalAgentUrl: '',
    // Ver nota acima: path Windows hardcoded corrompe o repo quando rodado no Mac/Linux.
    dicomBackupWorklistFolder: isWindows
      ? 'C:\\OrthancServer\\db\\WorklistsDatabaseBackup\\'
      : '',
    soundNotifications: true,
    autoSave: true,
    signatureImageUrl: ''
  };
}

export async function resolveAdminUid(): Promise<string | null> {
  if (cachedAdminUid) return cachedAdminUid;
  if (ADMIN_UID) {
    cachedAdminUid = ADMIN_UID;
    return cachedAdminUid;
  }
  
  // Tenta carregar o UID a partir do documento global compartilhado
  try {
    const globalDocRef = doc(firestore, 'global_config', 'admin_settings');
    const globalSnap = await getDoc(globalDocRef);
    if (globalSnap.exists()) {
      const globalData = globalSnap.data();
      if (globalData && globalData.adminUid) {
        console.log('[DB] UID do administrador resolvido do global_config:', globalData.adminUid);
        cachedAdminUid = globalData.adminUid;
        return cachedAdminUid;
      }
    }
  } catch (err) {
    console.warn('[DB] Erro ao buscar UID do admin em global_config:', err);
  }

  const adminEmail = (ADMIN_EMAIL || 'matheuskpires@gmail.com').trim().toLowerCase();
  console.log('[DB] Buscando UID do admin via query de email na coleção users para:', adminEmail);
  try {
    const q = query(
      collection(firestore, 'users'),
      where('email', '==', adminEmail),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      cachedAdminUid = snap.docs[0].id;
      console.log('[DB] UID do administrador resolvido por email na coleção users:', cachedAdminUid);
      return cachedAdminUid;
    }
  } catch (err) {
    console.warn('[DB] Falha ao buscar UID do administrador por email (provável restrição de regras do Firestore):', err);
  }
  
  console.log('[DB] Buscando UID do admin via query de role na coleção users...');
  try {
    const q = query(
      collection(firestore, 'users'),
      where('role', '==', 'admin'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      cachedAdminUid = snap.docs[0].id;
      console.log('[DB] UID do administrador resolvido por role na coleção users:', cachedAdminUid);
      return cachedAdminUid;
    }
  } catch (err) {
    console.warn('[DB] Falha ao buscar UID do administrador por role (provável restrição de regras do Firestore):', err);
  }
  
  return null;
}

export async function getAdminSettings(): Promise<AppSettings | null> {
  console.log('[DB] getAdminSettings iniciada...');
  try {
    // 1. Tenta carregar primeiro do global_config para evitar queries bloqueadas na coleção de users
    const globalDocRef = doc(firestore, 'global_config', 'admin_settings');
    const globalSnap = await getDoc(globalDocRef);
    if (globalSnap.exists()) {
      const globalData = globalSnap.data() as AppSettings & { adminUid?: string };
      console.log('[DB] Documento global_config/admin_settings encontrado com sucesso. Chaves configuradas:', {
        hasGeminiKey: !!globalData.geminiApiKey,
        hasAnthropicKey: !!globalData.anthropicApiKey
      });
      if (globalData.adminUid) {
        cachedAdminUid = globalData.adminUid;
      }
      if (globalData.anthropicModel === 'claude-3-5-sonnet-latest' || globalData.anthropicModel === 'claude-3-7-sonnet-latest' || globalData.anthropicModel === 'claude-3-5-haiku-latest') {
        globalData.anthropicModel = 'claude-sonnet-4-6';
      }
      return globalData;
    } else {
      console.warn('[DB] Documento global_config/admin_settings NÃO existe no Firestore.');
    }

    // 2. Fallback para carregar do documento de usuário se o global ainda não existir
    console.log('[DB] Tentando carregar settings diretamente do documento do usuário administrador como fallback...');
    const adminUid = await resolveAdminUid();
    if (adminUid) {
      const adminDocRef = doc(firestore, `users/${adminUid}/settings`, SETTINGS_DOC_ID);
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists()) {
        const adminData = adminSnap.data() as AppSettings;
        console.log('[DB] Settings carregadas do fallback (documento do admin). Chaves:', {
          hasGeminiKey: !!adminData.geminiApiKey,
          hasAnthropicKey: !!adminData.anthropicApiKey
        });
        if (adminData.anthropicModel === 'claude-3-5-sonnet-latest' || adminData.anthropicModel === 'claude-3-7-sonnet-latest' || adminData.anthropicModel === 'claude-3-5-haiku-latest') {
          adminData.anthropicModel = 'claude-sonnet-4-6';
        }
        return adminData;
      } else {
        console.warn(`[DB] Documento de settings do admin (users/${adminUid}/settings/app) não existe.`);
      }
    } else {
      console.warn('[DB] Não foi possível resolver o adminUid para o fallback.');
    }
  } catch (e: any) {
    console.error('[DB] Erro crítico ao carregar settings do administrador:', e);
  }
  return null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const encrypted = await encryptDicomPasswords(settings);
  const docRef = doc(firestore, getUserPath('settings'), SETTINGS_DOC_ID);
  await setDoc(docRef, sanitize(encrypted), { merge: true });

  // Se for o administrador do sistema (detectado por e-mail ou role), publica as configurações na coleção global
  const isCurrentUserAdmin = auth.currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
  if (isCurrentUserAdmin || settings.currentRole === 'admin') {
    console.log('[DB] Usuário é admin no saveSettings. Sincronizando com global_config/admin_settings...');
    const globalDocRef = doc(firestore, 'global_config', 'admin_settings');
    try {
      await setDoc(globalDocRef, sanitize({
        ...encrypted,
        adminUid: auth.currentUser?.uid,
        adminEmail: auth.currentUser?.email || '',
        updatedAt: Date.now()
      }), { merge: true });
      console.log('[DB] Sincronização global de settings efetuada no salvamento.');
    } catch (err) {
      console.error('[DB] Falha crítica ao salvar global settings no Firestore:', err);
      throw err;
    }
  }
}

// ─── Generic CRUD ───

export async function addItem<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const colRef = getCollectionRef(collectionName);
  const now = Date.now();
  const ref = await addDoc(colRef, sanitize({
    ...data,
    createdAt: now,
    updatedAt: now,
  }));
  return ref.id;
}

export async function addItemWithId<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  const docRef = getDocRef(collectionName, id);
  const now = Date.now();

  // Versionamento Automático de Templates (Fase 3)
  if (collectionName === 'templates') {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const oldData = snap.data();
        const versionsRef = collection(docRef, 'versions');
        await addDoc(versionsRef, {
          ...oldData,
          versionSavedAt: now,
        });
      }
    } catch (err) {
      logger.warn('[DB] Erro ao salvar versão do template no setDoc:', err);
    }
  }

  await setDoc(docRef, sanitize({
    ...data,
    createdAt: now,
    updatedAt: now,
  }), { merge: true });
}

export async function addItemGlobalWithId<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  const docRef = getGlobalDocRef(collectionName, id);
  const now = Date.now();
  await setDoc(docRef, sanitize({
    ...data,
    createdAt: now,
    updatedAt: now,
  }), { merge: true });
}

export async function updateItem(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = getDocRef(collectionName, id);

  // Versionamento Automático de Templates (Fase 3)
  if (collectionName === 'templates') {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const oldData = snap.data();
        const versionsRef = collection(docRef, 'versions');
        await addDoc(versionsRef, {
          ...oldData,
          versionSavedAt: Date.now(),
        });
      }
    } catch (err) {
      logger.warn('[DB] Erro ao salvar versão do template:', err);
    }
  }

  await updateDoc(docRef, {
    ...sanitize(data),
    updatedAt: Date.now()
  });
}

export async function updateGlobalItem(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = getGlobalDocRef(collectionName, id);
  await updateDoc(docRef, {
    ...sanitize(data),
    updatedAt: Date.now()
  });
}

export async function deleteItem(
  collectionName: string,
  id: string
): Promise<void> {
  const docRef = getDocRef(collectionName, id);
  await deleteDoc(docRef);
}

export async function deleteGlobalItem(
  collectionName: string,
  id: string
): Promise<void> {
  const docRef = getGlobalDocRef(collectionName, id);
  await deleteDoc(docRef);
}

export async function getItem<T>(
  collectionName: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const docRef = getDocRef(collectionName, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as T & { id: string };
  }

  // Fallback de segurança para buscar templates oficiais do administrador/sistema
  if (collectionName === 'templates' && auth.currentUser?.email !== ADMIN_EMAIL) {
    try {
      const adminUid = await resolveAdminUid();

      // 2. Tenta carregar o template na coleção do administrador
      if (adminUid) {
        const adminDocRef = doc(firestore, `users/${adminUid}/templates`, id);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          return { id: adminSnap.id, ...adminSnap.data(), isSystem: true } as unknown as T & { id: string };
        }
      }
    } catch (e) {
      logger.warn('[DB] Erro no fallback de template do administrador:', e);
    }
  }

  return null;
}

export async function getAll<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<(T & { id: string })[]> {
  const colRef = getCollectionRef(collectionName);
  const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
}

export async function countWhere(
  collectionName: string,
  field: string,
  value: unknown
): Promise<number> {
  const colRef = getCollectionRef(collectionName);
  const q = query(colRef, where(field, '==', value));
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Batch write — otimizado para grandes volumes de dados.
 */
export async function batchAdd<T extends Record<string, unknown>>(
  collectionName: string,
  items: (T & { id: string })[]
): Promise<void> {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestore);
    for (const item of chunk) {
      const { id, ...data } = item;
      const docId = id ? String(id) : genId(collectionName);
      const docRef = getDocRef(collectionName, docId);
      batch.set(docRef, sanitize(data));
    }
    await batch.commit();
  }
}

// Re-export for components
export { where, orderBy, query, limit, deleteField } from 'firebase/firestore';

const EXAM_AREAS_SET = new Set([
  'medicina-interna',
  'ginecologia',
  'medicina-fetal',
  'pequenas-partes',
  'musculoesqueletico',
  'vascular',
  'reumatologico',
  'pediatria',
  'procedimentos',
  'mastologia'
]);

/**
 * Busca os últimos laudos finalizados do mesmo template ou especialidade (área) para contexto da IA.
 * Garante o escopo multi-tenant do usuário autenticado.
 */
interface ExamDoc {
  id: string;
  area?: string;
  templateId?: string;
  reportContent?: string;
  status?: string;
  finalizedAt?: number;
  createdAt?: number;
}

export async function getRecentFinalizedReports(templateIdOrArea: string, limitCount: number = 3): Promise<string[]> {
  try {
    const isArea = EXAM_AREAS_SET.has(templateIdOrArea);

    const q = query(
      getCollectionRef('exams'),
      where('status', '==', 'finalizado')
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamDoc));

    let filtered: ExamDoc[] = [];

    if (isArea) {
      // If templateIdOrArea is an area, filter by area.
      filtered = docs.filter(d => d.area === templateIdOrArea);
      filtered.sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0));
    } else {
      // First, try filtering by the specific templateId.
      filtered = docs.filter(d => d.templateId === templateIdOrArea);
      filtered.sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0));

      // If we don't have enough matches for this template, fallback to the same area/specialty
      if (filtered.length < limitCount) {
        // Find the area of the active template
        const template = await getItem<{ area?: string }>('templates', templateIdOrArea);
        const area = template?.area;
        if (area) {
          const areaFallback = docs.filter(d => d.area === area && d.templateId !== templateIdOrArea);
          areaFallback.sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0));
          filtered = [...filtered, ...areaFallback];
        }
      }
    }

    return filtered
      .slice(0, limitCount)
      .map(doc => doc.reportContent)
      .filter((c): c is string => Boolean(c));
  } catch (err) {
    logger.error('Erro ao buscar laudos recentes', err);
    return [];
  }
}

/**
 * Busca o histórico de laudos anteriores do paciente (RAG Clínico).
 * Retorna laudos do mesmo paciente, na mesma especialidade (area).
 */
export async function getPatientPreviousExams(patientId: string, area: string, currentExamId: string, limitCount: number = 2): Promise<string[]> {
  if (!patientId || patientId === 'ANONIMO') return [];
  try {
    const q = query(
      getCollectionRef('exams'),
      where('patientId', '==', patientId),
      where('status', '==', 'finalizado')
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamDoc));

    const filtered = docs.filter(d => d.area === area && d.id !== currentExamId);
    
    // Ordena do mais recente para o mais antigo
    filtered.sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0));

    return filtered
      .slice(0, limitCount)
      .map(doc => {
        const dateStr = new Date(doc.finalizedAt ?? doc.createdAt ?? 0).toLocaleDateString('pt-BR');
        return `[EXAME DE ${dateStr}]\n${doc.reportContent}`;
      })
      .filter(Boolean);
  } catch (err) {
    logger.error('Erro ao buscar histórico clínico do paciente', err);
    return [];
  }
}

/**
 * Salva um snapshot do conteúdo do laudo no histórico de versões (reportVersions) do exame.
 */
export async function saveVersionSnapshot(
  examId: string,
  content: string,
  trigger: 'generation' | 'refine' | 'copilot' | 'manual'
): Promise<void> {
  if (!content || !content.trim()) return;
  try {
    const docRef = getDocRef('exams', examId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const versions = data.reportVersions || [];
    
    // Evita duplicar se for idêntico ao último snapshot
    if (versions.length > 0 && versions[versions.length - 1].content === content) return;

    const newVersion = {
      timestamp: Date.now(),
      content,
      trigger
    };
    
    await updateDoc(docRef, {
      reportVersions: [...versions, newVersion],
      updatedAt: Date.now()
    });
  } catch (err) {
    logger.error('[DB] Erro ao salvar snapshot de versão do laudo', err);
  }
}

/**
 * Adiciona um registro de auditoria no sistema (Coleção Global).
 */
export async function addAuditLog(log: {
  action: string;
  details: string;
  module: string;
  userId?: string;
  userName?: string;
}): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const colRef = collection(firestore, 'audit_logs');
    
    await addDoc(colRef, sanitize({
      ...log,
      userId: log.userId || currentUser?.uid || 'system',
      userName: log.userName || currentUser?.displayName || currentUser?.email || 'Sistema',
      timestamp: Date.now()
    }));
  } catch (err) {
    logger.error('[DB] Erro ao gravar log de auditoria', err);
  }
}

/**
 * Gerencia mensagens globais do sistema (Broadcast).
 */
export async function setBroadcast(message: string | null, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
  const docRef = doc(firestore, 'system', 'broadcast');
  await setDoc(docRef, {
    message,
    type,
    updatedAt: Date.now(),
    active: !!message
  });
}

export function onBroadcastChange(callback: (broadcast: { message: string; type: string; active: boolean } | null) => void) {
  const docRef = doc(firestore, 'system', 'broadcast');
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as any);
    } else {
      callback(null);
    }
  });
}

/**
 * Gestão de Chamados de Suporte.
 */
export async function createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'messages'>) {
  const colRef = collection(firestore, 'support_tickets');
  const now = Date.now();
  await addDoc(colRef, sanitize({
    ...ticket,
    messages: [],
    createdAt: now,
    updatedAt: now,
    status: 'open'
  }));
}

export async function addSupportMessage(ticketId: string, message: Omit<SupportMessage, 'id' | 'timestamp'>) {
  const docRef = doc(firestore, 'support_tickets', ticketId);
  const now = Date.now();
  
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as SupportTicket;
    const newMessage = { ...message, id: genId(), timestamp: now };
    await updateDoc(docRef, {
      messages: [...(data.messages || []), newMessage],
      updatedAt: now
    });
  }
}

export function onSupportTicketsChange(userId: string | null, callback: (tickets: SupportTicket[]) => void) {
  const colRef = collection(firestore, 'support_tickets');
  const q = userId 
    ? query(colRef, where('userId', '==', userId), orderBy('updatedAt', 'desc'))
    : query(colRef, orderBy('updatedAt', 'desc'));
    
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket)));
  });
}

/**
 * Remove permanentemente todo o histórico de chamados de suporte do Firestore.
 */
export async function clearAllSupportTickets(): Promise<void> {
  const colRef = collection(firestore, 'support_tickets');
  const snap = await getDocs(colRef);
  const batch = writeBatch(firestore);
  snap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}

/**
 * Retorna a URL correta do PACS baseada no ambiente atual (Vercel vs Local)
 */
export function getActivePacsUrl(settings: AppSettings, isBackup = false): string {
  const isVercel = typeof window !== 'undefined' && (window.location.hostname.includes('laud.us') || window.location.hostname.includes('vercel.app'));
  
  if (isBackup) {
    return (isVercel && settings.dicomBackupTailscalePublicUrl) 
      ? settings.dicomBackupTailscalePublicUrl 
      : (settings.dicomBackupViewerUrl || 'http://localhost:8042');
  }
  
  return (isVercel && settings.dicomTailscalePublicUrl) 
    ? settings.dicomTailscalePublicUrl 
    : (settings.dicomViewerUrl || 'http://localhost:8042');
}


/**
 * Retorna a URL base do proxy a ser utilizada.
 * No Vercel, tenta usar o Agente Local (se for HTTPS) para contornar bloqueios de rede.
 */
export function getProxyEndpoint(settings: AppSettings, isBackup = false): string {
  const isVercel = typeof window !== 'undefined' && (window.location.hostname.includes('laud.us') || window.location.hostname.includes('vercel.app'));
  if (isVercel) {
    const agent = isBackup ? settings.dicomBackupLocalAgentUrl : settings.dicomLocalAgentUrl;
    // Só usa o agente local se for HTTPS para evitar Mixed Content Block no navegador
    if (agent && agent.startsWith('https')) {
      return `${agent.replace(/\/$/, '')}/api/orthanc-proxy`;
    }
  }
  return '/api/orthanc-proxy';
}

/**
 * Remove o arquivo `.wl` de uma entrada da Worklist DICOM do Orthanc.
 *
 * Chamado em dois cenários:
 *   1. Exame **finalizado** no editor ou na worklist — remove do PACS para que o
 *      aparelho de ultrassom não liste mais o exame como pendente.
 *   2. Exame **excluído** — limpeza completa do registro.
 *
 * Suporta servidor primário e de backup em paralelo (fire-and-forget).
 * Erros de rede são silenciados via console.warn para não bloquear o fluxo principal.
 *
 * @param examId   ID do exame no Firestore (usado como nome do arquivo .wl)
 * @param settings Configurações do app (URLs, pastas, agent URLs)
 */
export async function deleteWorklistEntry(examId: string, settings: AppSettings): Promise<void> {
  if (settings.dicomSyncEnabled === false) return;

  // Na nuvem (laud.us/vercel) com agente configurado vai direto ao agente remoto;
  // localmente usa '/api/worklist' same-origin (Vite/servidor local desta máquina).
  const isVercel = typeof window !== 'undefined' &&
    (window.location.hostname.includes('laud.us') || window.location.hostname.includes('vercel.app'));

  // ── Primário ──
  const primaryAgentUrl = (isVercel && settings.dicomLocalAgentUrl)
    ? `${settings.dicomLocalAgentUrl.replace(/\/$/, '')}/api/worklist`
    : '/api/worklist';

  const primaryPromise = fetch(primaryAgentUrl, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examId,
      outputDir: settings.dicomWorklistFolder,
      localAgentUrl: settings.dicomLocalAgentUrl
    })
  }).catch((err) => {
    logger.warn('[Orthanc Worklist] Falha ao remover entrada primária:', err);
  });

  // ── Backup (se configurado) ──
  let backupPromise: Promise<void | Response> = Promise.resolve();
  if (settings.dicomBackupSyncEnabled) {
    const backupAgentUrl = (isVercel && settings.dicomBackupLocalAgentUrl)
      ? `${settings.dicomBackupLocalAgentUrl.replace(/\/$/, '')}/api/worklist`
      : '/api/worklist';

    backupPromise = fetch(backupAgentUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId,
        outputDir: settings.dicomBackupWorklistFolder,
        localAgentUrl: settings.dicomBackupLocalAgentUrl
      })
    }).catch((err) => {
      logger.warn('[Orthanc Worklist Backup] Falha ao remover entrada de backup:', err);
    });
  }

  // Aguarda ambos para que a função possa ser corretamente awaited pelo chamador
  await Promise.allSettled([primaryPromise, backupPromise]);
}


// ─── AI Token Usage Tracking ───

export interface AiUsageLog {
  id?: string;
  examId?: string;
  timestamp: number;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  area: string;
  promptHash?: string;
}

export async function logAiUsage(data: Omit<AiUsageLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const colRef = getCollectionRef('ai_usage');
    await addDoc(colRef, sanitize({
      ...data,
      timestamp: Date.now()
    }));
  } catch (err) {
    logger.error('[DB] Erro ao gravar uso de IA', err);
  }
}

export async function getAiUsageStats(startDateMs: number, endDateMs: number): Promise<AiUsageLog[]> {
  try {
    const colRef = getCollectionRef('ai_usage');
    const q = query(
      colRef,
      where('timestamp', '>=', startDateMs),
      where('timestamp', '<=', endDateMs)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AiUsageLog));
  } catch (err) {
    logger.error('[DB] Erro ao buscar estatísticas de IA', err);
    return [];
  }
}
