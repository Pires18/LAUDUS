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

// Cache global para evitar múltiplas queries do UID do administrador
let cachedAdminUid: string | null = null;

// ─── useCollection: realtime listener for a collection ───
interface UseCollectionOptions {
  constraints?: QueryConstraint[];
  enabled?: boolean;
  isGlobal?: boolean;
}

export function useCollection<T extends { id: string }>(
  collectionName: string,
  options: UseCollectionOptions = {}
): { data: T[]; loading: boolean; error: string | null } {
  const { constraints = [], enabled = true, isGlobal = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(cachedAdminUid);

  // Serialize constraints for dependency array
  const constraintKey = JSON.stringify(constraints.map((c) => c.toString()));

  // Resolve o UID do administrador matheuskpires@gmail.com
  useEffect(() => {
    if (!enabled || !auth.currentUser || cachedAdminUid) return;

    if (auth.currentUser.email === 'matheuskpires@gmail.com') {
      cachedAdminUid = auth.currentUser.uid;
      setAdminUid(cachedAdminUid);
      return;
    }

    import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
      const usersCol = collection(firestore, 'users');
      const q = query(usersCol, where('email', '==', 'matheuskpires@gmail.com'));
      getDocs(q).then((snap) => {
        if (!snap.empty) {
          cachedAdminUid = snap.docs[0].id;
          setAdminUid(cachedAdminUid);
        }
      });
    }).catch((err) => console.warn('[useFirestore] Erro ao obter UID do admin:', err));
  }, [enabled, auth.currentUser?.uid]);

  useEffect(() => {
    if (!enabled || !auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = isGlobal ? collectionName : userPath(collectionName);
    const colRef = collection(firestore, path);
    const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);

    let unsubscribeAdmin: (() => void) | null = null;
    let userDocs: T[] = [];
    let adminDocs: T[] = [];

    const updateCombinedData = () => {
      if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== 'matheuskpires@gmail.com') {
        const combined = [...userDocs];
        adminDocs.forEach((aDoc: any) => {
          if (!combined.some((uDoc) => uDoc.id === aDoc.id)) {
            combined.push({
              ...aDoc,
              isSystem: true // Marca como máscara oficial do sistema
            });
          }
        });
        setData(combined);
      } else {
        setData(userDocs);
      }
      setLoading(false);
      setError(null);
    };

    const unsubscribeUser = onSnapshot(
      q,
      (snapshot) => {
        userDocs = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as T[];
        updateCombinedData();
      },
      (err) => {
        console.error(`[Firestore] Error listening to ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Se for templates e o usuário atual não for o admin, escuta também a coleção do admin em tempo real
    if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== 'matheuskpires@gmail.com' && adminUid) {
      const adminPath = `users/${adminUid}/templates`;
      const adminColRef = collection(firestore, adminPath);
      // Carrega apenas os modelos globais/padrões do admin (sem clinicId específico)
      const adminQ = query(adminColRef);

      import('firebase/firestore').then(({ onSnapshot: snapListener }) => {
        unsubscribeAdmin = snapListener(
          adminQ,
          (snapshot) => {
            adminDocs = snapshot.docs.map((d) => ({
              ...d.data(),
              id: d.id,
            })) as T[];
            updateCombinedData();
          },
          (err) => {
            console.warn(`[Firestore] Erro ao carregar máscaras padrão do sistema:`, err);
          }
        );
      });
    }

    return () => {
      unsubscribeUser();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, [collectionName, constraintKey, enabled, isGlobal, auth.currentUser?.uid, adminUid]);

  return { data, loading, error };
}

// ─── useDocument: realtime listener for a single document ───
export function useDocument<T extends { id: string }>(
  collectionName: string,
  documentId: string | undefined,
  isGlobal: boolean = false
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    const path = isGlobal ? collectionName : userPath(collectionName);
    const docRef = doc(firestore, path, documentId);
    let unsubscribeAdmin: (() => void) | null = null;

    const unsubscribeUser = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id } as T);
          setLoading(false);
          setError(null);
        } else {
          // Se for templates e não achar no escopo do usuário, tenta carregar do administrador
          if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== 'matheuskpires@gmail.com') {
            if (cachedAdminUid) {
              const adminDocRef = doc(firestore, `users/${cachedAdminUid}/templates`, documentId);
              import('firebase/firestore').then(({ onSnapshot: snapListener }) => {
                unsubscribeAdmin = snapListener(
                  adminDocRef,
                  (adminSnap) => {
                    if (adminSnap.exists()) {
                      setData({ ...adminSnap.data(), id: adminSnap.id, isSystem: true } as any);
                    } else {
                      setData(null);
                    }
                    setLoading(false);
                    setError(null);
                  },
                  (err) => {
                    console.warn(`[useDocument] Erro ao assinar fallback do admin:`, err);
                    setData(null);
                    setLoading(false);
                  }
                );
              });
            } else {
              // Busca dinamicamente o UID do admin
              import('firebase/firestore').then(({ collection, query, where, getDocs, onSnapshot: snapListener }) => {
                const usersCol = collection(firestore, 'users');
                const q = query(usersCol, where('email', '==', 'matheuskpires@gmail.com'));
                getDocs(q).then((snap) => {
                  if (!snap.empty) {
                    cachedAdminUid = snap.docs[0].id;
                    const adminDocRef = doc(firestore, `users/${cachedAdminUid}/templates`, documentId);
                    unsubscribeAdmin = snapListener(
                      adminDocRef,
                      (adminSnap) => {
                        if (adminSnap.exists()) {
                          setData({ ...adminSnap.data(), id: adminSnap.id, isSystem: true } as any);
                        } else {
                          setData(null);
                        }
                        setLoading(false);
                        setError(null);
                      },
                      (err) => {
                        console.warn(`[useDocument] Erro ao assinar fallback do admin:`, err);
                        setData(null);
                        setLoading(false);
                      }
                    );
                  } else {
                    setData(null);
                    setLoading(false);
                  }
                });
              });
            }
          } else {
            setData(null);
            setLoading(false);
            setError(null);
          }
        }
      },
      (err) => {
        console.error(`[Firestore] Error listening to ${collectionName}/${documentId}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeUser();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, [collectionName, documentId, isGlobal, auth.currentUser?.uid]);

  return { data, loading, error };
}

// ─── Re-export query helpers for use in components ───
export { where, orderBy, query } from 'firebase/firestore';
