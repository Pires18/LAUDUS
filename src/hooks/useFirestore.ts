import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  limit,
  QueryConstraint,
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { ADMIN_UID, ADMIN_EMAIL } from '../config/constants';
import { logger } from '../utils/logger';
import { resolveAdminUid } from '../store/db';

// ─── Helper: user-scoped collection path ───
function userPath(collectionName: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  return `users/${uid}/${collectionName}`;
}

// Cache local para a hook, inicialmente nulo
let localCachedAdminUid: string | null = null;

// ─── useCollection: realtime listener for a collection ───
interface UseCollectionOptions {
  constraints?: QueryConstraint[];
  enabled?: boolean;
  isGlobal?: boolean;
  /**
   * Discriminador estável da query. Necessário porque QueryConstraint.toString()
   * retorna sempre "[object Object]" — sem isto, trocar where('clinicId','==',A)
   * por where('clinicId','==',B) NÃO re-subscreve (a worklist não recarrega ao
   * trocar de clínica). Passe um valor que mude junto com os filtros (ex.: o id
   * da clínica selecionada).
   */
  queryKey?: string;
}

export function useCollection<T extends { id: string }>(
  collectionName: string,
  options: UseCollectionOptions = {}
): { data: T[]; loading: boolean; error: string | null } {
  const { constraints = [], enabled = true, isGlobal = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(localCachedAdminUid);

  // Serialize constraints for dependency array
  const constraintKey = JSON.stringify(constraints.map((c) => c.toString()));

  useEffect(() => {
    if (!enabled || !auth.currentUser) return;

    resolveAdminUid().then(uid => {
      if (uid) {
        localCachedAdminUid = uid;
        setAdminUid(uid);
      }
    });
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
      if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== ADMIN_EMAIL) {
        const combined = [...userDocs];
        adminDocs.forEach((aDoc: T) => {
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
        logger.error(`Firestore: erro ao ouvir ${collectionName}`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Se for templates e o usuário atual não for o admin, escuta também a coleção do admin em tempo real
    if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== ADMIN_EMAIL && adminUid) {
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
            logger.warn(`[Firestore] Erro ao carregar máscaras padrão do sistema:`, err);
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
          // Se for templates e não achar no escopo do usuário, tenta carregar do administrador
          if (collectionName === 'templates' && !isGlobal && auth.currentUser?.email !== ADMIN_EMAIL) {
            resolveAdminUid().then(adminUid => {
              if (adminUid) {
                const adminDocRef = doc(firestore, `users/${adminUid}/templates`, documentId);
                import('firebase/firestore').then(({ onSnapshot: snapListener }) => {
                  unsubscribeAdmin = snapListener(
                    adminDocRef,
                    (adminSnap) => {
                      if (adminSnap.exists()) {
                        setData({ ...adminSnap.data(), id: adminSnap.id, isSystem: true } as unknown as T);
                      } else {
                        setData(null);
                      }
                      setLoading(false);
                      setError(null);
                    },
                    (err) => {
                      logger.warn(`[useDocument] Erro ao assinar fallback do admin:`, err);
                      setData(null);
                      setLoading(false);
                    }
                  );
                });
              } else {
                setData(null);
                setLoading(false);
                setError(null);
              }
            });
          } else {
            setData(null);
            setLoading(false);
            setError(null);
          }
        }
      },
      (err) => {
        logger.error(`Firestore: erro ao ouvir ${collectionName}/${documentId}`, err);
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

// ─── usePaginatedCollection: realtime listener with infinite scroll ───
export function usePaginatedCollection<T extends { id: string }>(
  collectionName: string,
  options: UseCollectionOptions & { initialLimit?: number } = {}
) {
  const { constraints = [], enabled = true, isGlobal = false, initialLimit = 50, queryKey } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLimit, setCurrentLimit] = useState(initialLimit);
  const [hasMore, setHasMore] = useState(true);

  // Serialize constraints for dependency array. QueryConstraint.toString() é
  // inútil ("[object Object]"), então o queryKey do chamador é o que torna a
  // chave sensível a filtros por valor (ex.: troca de clínica).
  const constraintKey = JSON.stringify(constraints.map((c) => c.toString())) + '|' + (queryKey ?? '');

  // Ao mudar a query (ex.: trocar de clínica), reinicia a paginação na 1ª página.
  useEffect(() => {
    setCurrentLimit(initialLimit);
  }, [constraintKey, initialLimit]);

  useEffect(() => {
    if (!enabled || !auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = isGlobal ? collectionName : userPath(collectionName);
    const colRef = collection(firestore, path);
    const q = query(colRef, ...constraints, limit(currentLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
        setData(docs);
        setHasMore(docs.length === currentLimit);
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error(`Firestore: erro ao ouvir paginado ${collectionName}`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, constraintKey, enabled, isGlobal, auth.currentUser?.uid, currentLimit]);

  const loadMore = () => {
    if (hasMore) {
      setCurrentLimit((prev) => prev + initialLimit);
    }
  };

  return { data, loading, error, loadMore, hasMore };
}

// ─── Re-export query helpers for use in components ───
export { where, orderBy, limit } from 'firebase/firestore';
