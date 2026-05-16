import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  QueryConstraint,
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

// ─── Re-export query helpers for use in components ───
export { where, orderBy, query } from 'firebase/firestore';
