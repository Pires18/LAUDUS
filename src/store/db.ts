/**
 * Camada de acesso a dados — Firebase Firestore.
 *
 * Substitui completamente o antigo db.ts (Dexie/IndexedDB).
 * Todas as operações são user-scoped: users/{uid}/collection.
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
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { AppSettings } from '../types';

// ─── Helpers ───

function getUserPath(collectionName: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  return `users/${uid}/${collectionName}`;
}

export function getCollectionRef(collectionName: string) {
  return collection(firestore, getUserPath(collectionName));
}

export function getDocRef(collectionName: string, docId: string) {
  return doc(firestore, getUserPath(collectionName), docId);
}

/**
 * Gera um ID único usando Firestore.
 */
export function genId(): string {
  const ref = doc(collection(firestore, '_ids'));
  return ref.id;
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
    if (snap.exists()) {
      return snap.data() as AppSettings;
    }
  } catch (err) {
    console.warn('[DB] Erro ao carregar settings:', err);
  }
  return { geminiModel: 'gemini-2.5-flash' };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const docRef = doc(firestore, getUserPath('settings'), SETTINGS_DOC_ID);
  await setDoc(docRef, settings, { merge: true });
}

// ─── Generic CRUD ───

export async function addItem<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const colRef = getCollectionRef(collectionName);
  const ref = await addDoc(colRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function addItemWithId<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  const docRef = getDocRef(collectionName, id);
  await setDoc(docRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateItem(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = getDocRef(collectionName, id);
  await updateDoc(docRef, { ...data, updatedAt: Date.now() });
}

export async function deleteItem(
  collectionName: string,
  id: string
): Promise<void> {
  const docRef = getDocRef(collectionName, id);
  await deleteDoc(docRef);
}

export async function getItem<T>(
  collectionName: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const docRef = getDocRef(collectionName, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T & { id: string };
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
 * Batch write — útil para migração.
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
      // Tratar caso onde registro local não tem ID definido
      const docId = id ? String(id) : genId();
      const docRef = getDocRef(collectionName, docId);
      
      // Remover propriedades 'undefined' que causam erro no Firestore
      const sanitizedData = JSON.parse(JSON.stringify(data));
      batch.set(docRef, sanitizedData);
    }
    await batch.commit();
  }
}

// Re-export for components
export { where, orderBy, query } from 'firebase/firestore';
