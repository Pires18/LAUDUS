import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
  DocumentData,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';

// ─── Helper: user-scoped collection path ───
function userPath(collectionName: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  return `users/${uid}/${collectionName}`;
}

// ─── useCollection: realtime listener for a collection ───
interface UseCollectionOptions {
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

export function useCollection<T extends { id: string }>(
  collectionName: string,
  options: UseCollectionOptions = {}
): { data: T[]; loading: boolean; error: string | null } {
  const { constraints = [], enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize constraints for dependency array
  const constraintKey = JSON.stringify(constraints.map((c) => c.toString()));

  useEffect(() => {
    if (!enabled || !auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(firestore, userPath(collectionName));
    const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as T[];
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[Firestore] Error listening to ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionName, constraintKey, enabled, auth.currentUser?.uid]);

  return { data, loading, error };
}

// ─── useDocument: realtime listener for a single document ───
export function useDocument<T extends { id: string }>(
  collectionName: string,
  documentId: string | undefined
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    const docRef = doc(firestore, userPath(collectionName), documentId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[Firestore] Error listening to ${collectionName}/${documentId}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionName, documentId, auth.currentUser?.uid]);

  return { data, loading, error };
}

// ─── CRUD operations ───

export async function addDocument<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const colRef = collection(firestore, userPath(collectionName));
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
}

export async function setDocument<T extends Record<string, unknown>>(
  collectionName: string,
  documentId: string,
  data: T,
  merge = true
): Promise<void> {
  const docRef = doc(firestore, userPath(collectionName), documentId);
  await setDoc(docRef, { ...data, updatedAt: Date.now() }, { merge });
}

export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, unknown>
): Promise<void> {
  const docRef = doc(firestore, userPath(collectionName), documentId);
  await updateDoc(docRef, { ...data, updatedAt: Date.now() });
}

export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<void> {
  const docRef = doc(firestore, userPath(collectionName), documentId);
  await deleteDoc(docRef);
}

export async function getDocument<T extends { id: string }>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  const docRef = doc(firestore, userPath(collectionName), documentId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T;
}

/**
 * Gera um ID único usando o Firestore doc().id
 */
export function genId(collectionName = '_ids'): string {
  const colRef = collection(firestore, collectionName);
  return doc(colRef).id;
}

// ─── Re-export query helpers for use in components ───
export { where, orderBy, query, collection, doc } from 'firebase/firestore';
