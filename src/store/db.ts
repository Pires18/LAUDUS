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
  limit,
  onSnapshot,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { AppSettings, SupportTicket, SupportMessage } from '../types';

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
      geminiModel: 'gemini-2.5-flash', 
      aiProvider: 'gemini', 
      anthropicModel: 'claude-3-5-sonnet-latest',
      dicomSyncEnabled: true,
      dicomWorklistFolder: isWindows 
        ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\' 
        : '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase/',
      dicomModalityAETitle: 'MINDRAYMX7',
      dicomModalityType: 'US',
      dicomOrthancAETitle: isWindows ? 'ORTHANCBACKUP' : 'ORTHANCPACS',
      dicomViewerUrl: isWindows ? 'http://localhost:8043' : 'https://servidor-mac.tail861dda.ts.net:8443/',
      dicomViewerType: 'stone',
      dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}',
      dicomPreset: isWindows ? 'notebook' : 'macmini',
      dicomUsername: 'admin',
      dicomPassword: '123456789',
      dicomLocalAgentUrl: isWindows 
        ? 'http://localhost:5173' 
        : 'https://servidor-mac.tail861dda.ts.net',
      dicomBackupViewerUrl: '',
      dicomBackupUsername: '',
      dicomBackupPassword: '',
      soundNotifications: true,
      autoSave: true,
      signatureImageUrl: ''
    };
    let data = snap.exists() ? (snap.data() as AppSettings) : defaultSettings;

    // Realiza a migração automática de caminhos antigos para o novo local no SSD do usuário
    let migrated = false;
    if (data.dicomWorklistFolder && data.dicomWorklistFolder.includes('/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase')) {
      data.dicomWorklistFolder = data.dicomWorklistFolder.replace(
        '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase',
        '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase'
      );
      migrated = true;
    }

    if (data.dicomViewerUrl === 'https://servidor-mac.tail861dda.ts.net/') {
      data.dicomViewerUrl = 'https://servidor-mac.tail861dda.ts.net:8443/';
      migrated = true;
    }

    if (
      data.dicomLocalAgentUrl && 
      data.dicomLocalAgentUrl.includes('servidor-mac.tail861dda.ts.net') && 
      data.dicomLocalAgentUrl !== 'https://servidor-mac.tail861dda.ts.net'
    ) {
      data.dicomLocalAgentUrl = 'https://servidor-mac.tail861dda.ts.net';
      migrated = true;
    }

    if (migrated && snap.exists()) {
      saveSettings(data).catch(err => console.warn('[DB] Falha ao persistir migração de settings:', err));
    }

    // Se o preset não for customizado (notebook, macmini ou não definido), resolve dinamicamente com base no OS
    if (data.dicomPreset !== 'custom') {
      data.dicomPreset = isWindows ? 'notebook' : 'macmini';
      data.dicomWorklistFolder = isWindows 
        ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\' 
        : '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase/';
      data.dicomViewerUrl = isWindows ? 'http://localhost:8043' : 'https://servidor-mac.tail861dda.ts.net:8443/';
      data.dicomOrthancAETitle = isWindows ? 'ORTHANCBACKUP' : 'ORTHANCPACS';
      data.dicomLocalAgentUrl = isWindows 
        ? 'http://localhost:5173' 
        : 'https://servidor-mac.tail861dda.ts.net';
    }
    
    // Fallback de segurança para buscar prompts oficiais do administrador
    if (auth.currentUser?.email !== 'matheuskpires@gmail.com') {
      const adminSettings = await getAdminSettings();
      if (adminSettings) {
        return {
          ...defaultSettings,
          ...adminSettings,
          ...data, // Configurações locais do médico (CRM, RQE, nome) prevalecem
          // Mas os prompts do sistema e do LAUD.IA publicados pelo administrador são herdados
          aiMasterPrompt: data.aiMasterPrompt || adminSettings.aiMasterPrompt,
          aiGlobalInstructions: data.aiGlobalInstructions || adminSettings.aiGlobalInstructions,
          aiStructurePrompt: data.aiStructurePrompt || adminSettings.aiStructurePrompt,
          aiRigidRules: data.aiRigidRules || adminSettings.aiRigidRules,
          aiAreaPrompts: { ...adminSettings.aiAreaPrompts, ...data.aiAreaPrompts },
          geminiApiKey: data.geminiApiKey || adminSettings.geminiApiKey || '',
          anthropicApiKey: data.anthropicApiKey || adminSettings.anthropicApiKey || '',
        };
      }
    }
    return { ...defaultSettings, ...data };
  } catch (err) {
    console.warn('[DB] Erro ao carregar settings:', err);
  }
  const isWindows = typeof window !== 'undefined' && /Win/i.test(navigator.userAgent);
  return { 
    geminiModel: 'gemini-2.5-flash', 
    aiProvider: 'gemini', 
    anthropicModel: 'claude-3-5-sonnet-latest',
    dicomSyncEnabled: true,
    dicomWorklistFolder: isWindows 
      ? 'C:\\OrthancServer\\db\\WorklistsDatabase\\' 
      : '/Volumes/MATHEUS SSD/OrthancServer/db/WorklistsDatabase/',
    dicomModalityAETitle: 'MINDRAYMX7',
    dicomModalityType: 'US',
    dicomOrthancAETitle: isWindows ? 'ORTHANCBACKUP' : 'ORTHANCPACS',
    dicomViewerUrl: isWindows ? 'http://localhost:8043' : 'https://servidor-mac.tail861dda.ts.net:8443/',
    dicomViewerType: 'stone',
    dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}',
    dicomPreset: isWindows ? 'notebook' : 'macmini',
    dicomUsername: 'admin',
    dicomPassword: '123456789',
    dicomLocalAgentUrl: isWindows 
      ? 'http://localhost:5173' 
      : 'https://servidor-mac.tail861dda.ts.net',
    dicomBackupViewerUrl: '',
    dicomBackupUsername: '',
    dicomBackupPassword: '',
    soundNotifications: true,
    autoSave: true,
    signatureImageUrl: ''
  };
}

export async function getAdminSettings(): Promise<AppSettings | null> {
  try {
    if (!cachedAdminUid) {
      const usersCol = collection(firestore, 'users');
      const q = query(usersCol, where('email', '==', 'matheuskpires@gmail.com'));
      const snapAdmin = await getDocs(q);
      if (!snapAdmin.empty) {
        cachedAdminUid = snapAdmin.docs[0].id;
      }
    }
    if (cachedAdminUid) {
      const adminDocRef = doc(firestore, `users/${cachedAdminUid}/settings`, SETTINGS_DOC_ID);
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists()) {
        return adminSnap.data() as AppSettings;
      }
    }
  } catch (e) {
    console.warn('[DB] Erro ao carregar settings do administrador:', e);
  }
  return null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const docRef = doc(firestore, getUserPath('settings'), SETTINGS_DOC_ID);
  await setDoc(docRef, sanitize(settings), { merge: true });
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
  if (collectionName === 'templates' && auth.currentUser?.email !== 'matheuskpires@gmail.com') {
    try {
      // 1. Resolve o UID do administrador matheuskpires@gmail.com se não estiver em cache
      if (!cachedAdminUid) {
        const usersCol = collection(firestore, 'users');
        const q = query(usersCol, where('email', '==', 'matheuskpires@gmail.com'));
        const snapAdmin = await getDocs(q);
        if (!snapAdmin.empty) {
          cachedAdminUid = snapAdmin.docs[0].id;
        }
      }

      // 2. Tenta carregar o template na coleção do administrador
      if (cachedAdminUid) {
        const adminDocRef = doc(firestore, `users/${cachedAdminUid}/templates`, id);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          return { id: adminSnap.id, ...adminSnap.data(), isSystem: true } as any;
        }
      }
    } catch (e) {
      console.warn('[DB] Erro no fallback de template do administrador:', e);
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
export { where, orderBy, query } from 'firebase/firestore';

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
export async function getRecentFinalizedReports(templateIdOrArea: string, limitCount: number = 3): Promise<string[]> {
  try {
    const isArea = EXAM_AREAS_SET.has(templateIdOrArea);

    // Fetch all finalized exams for this user.
    // Filtering by status == 'finalizado' is simple equality and doesn't require composite indexes.
    const q = query(
      getCollectionRef('exams'),
      where('status', '==', 'finalizado')
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    let filtered: any[] = [];

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
        const template = await getItem<any>('templates', templateIdOrArea);
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
      .filter(Boolean);
  } catch (err) {
    console.error('Erro ao buscar laudos recentes:', err);
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
    console.error('[DB] Erro ao salvar snapshot de versão do laudo:', err);
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
    console.error('[DB] Erro ao gravar log de auditoria:', err);
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
 * Valida um código de licença e ativa a assinatura para o usuário logado.
 */
export async function validateAndActivateLicense(
  code: string,
  uid: string,
  email: string,
  displayName: string
): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();
  const licenseRef = doc(firestore, 'plans', `LICENSE_${normalizedCode}`);
  const licenseSnap = await getDoc(licenseRef);

  if (!licenseSnap.exists()) {
    throw new Error('Código de licença não encontrado ou inválido.');
  }

  const licenseData = licenseSnap.data();
  if (!licenseData.active || licenseData.usedByUid) {
    throw new Error('Esta licença já foi utilizada ou está inativa.');
  }

  // Busca os dados do plano associado
  const planRef = doc(firestore, 'plans', licenseData.planId);
  const planSnap = await getDoc(planRef);
  const planName = planSnap.exists() ? planSnap.data().name : licenseData.planName || 'Plano Personalizado';

  const durationMonths = licenseData.durationMonths || 12;
  const now = Date.now();
  const expiresAt = durationMonths === 9999 ? null : now + durationMonths * 30 * 24 * 60 * 60 * 1000;

  const batch = writeBatch(firestore);

  // 1. Atualiza o status da licença
  batch.update(licenseRef, {
    usedByUid: uid,
    usedByEmail: email,
    usedAt: now,
    expiresAt: expiresAt,
    active: false, // Marca como consumida
    updatedAt: now
  });

  // 2. Atualiza ou cria o documento do usuário
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);

  const userPayload: Record<string, any> = {
    name: displayName || userSnap.data()?.name || email.split('@')[0],
    email: email,
    role: userSnap.data()?.role || 'medico',
    active: true,
    licenseCode: normalizedCode,
    licensePlanId: licenseData.planId,
    licensePlanName: planName,
    licenseExpiresAt: expiresAt,
    updatedAt: now
  };

  if (!userSnap.exists()) {
    userPayload.createdAt = now;
  }

  batch.set(userRef, userPayload, { merge: true });

  // Commit das escritas atômicas
  await batch.commit();

  // 3. Grava log de auditoria
  await addAuditLog({
    action: 'ATIVAR_LICENCA',
    details: `Licença ${normalizedCode} ativada para o e-mail ${email}. Plano: ${planName} (${durationMonths} meses).`,
    module: 'LICENSE_MGR',
    userId: uid,
    userName: displayName || email
  });
}

/**
 * Helper para verificar o status de expiração da licença do usuário.
 */
export async function checkUserLicenseStatus(uid: string): Promise<{
  active: boolean;
  expired: boolean;
  licenseExpiresAt?: number;
  licensePlanName?: string;
} | null> {
  try {
    const userRef = doc(firestore, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return null;

    const data = snap.data();
    if (data.email === 'matheuskpires@gmail.com') {
      // Super Admin bypass
      return { active: true, expired: false };
    }

    if (data.active === false) {
      return { active: false, expired: false };
    }

    if (data.licenseExpiresAt && data.licenseExpiresAt < Date.now()) {
      return {
        active: false,
        expired: true,
        licenseExpiresAt: data.licenseExpiresAt,
        licensePlanName: data.licensePlanName
      };
    }

    return {
      active: true,
      expired: false,
      licenseExpiresAt: data.licenseExpiresAt,
      licensePlanName: data.licensePlanName
    };
  } catch (err) {
    console.error('[License] Erro ao validar licença do usuário:', err);
    return null;
  }
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

