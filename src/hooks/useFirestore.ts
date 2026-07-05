import { useState, useEffect, useRef } from 'react';
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
import { useApp } from '../store/app';
import { resolveOwnerUid } from '../store/clinicAccess';
import { ReportTemplate } from '../types';

// ─── Helper: user-scoped collection path ───
// `explicitClinicId` só importa para `collectionName === 'clinics'` (ver
// resolveOwnerUid): identifica QUAL clínica está sendo lida/editada, para
// redirecionar à subárvore do dono quando é uma clínica compartilhada com o
// usuário atual (não a lista de clínicas — essa nunca redireciona).
function userPath(collectionName: string, explicitClinicId?: string): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  const ownerUid = resolveOwnerUid(collectionName, uid, explicitClinicId);
  return `users/${ownerUid}/${collectionName}`;
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

  // Curadoria pessoal de máscaras: quais padrão do sistema o usuário ativou.
  // `undefined` = legado (mescla todas as do admin); array = mescla só as ativadas.
  const enabledSystemMaskIds = useApp((s) => s.settings.enabledSystemMaskIds);
  // Clínica ativa + mapa de memberships: o PATH físico (users/{uid}/...) muda
  // quando a clínica selecionada pertence a outro dono (equipe multiusuário) —
  // sem isto na dependência, trocar de clínica não resubscreve ao dono certo.
  const selectedClinicId = useApp((s) => s.selectedClinicId);
  const clinicOwnerKey = useApp((s) => JSON.stringify(s.clinicOwnerMap));

  // Serialize constraints for dependency array
  const constraintKey = JSON.stringify(constraints.map((c) => c.toString()));
  // Chave estável do conjunto de máscaras ativadas (re-subscreve/mescla ao mudar).
  const enabledMaskKey =
    enabledSystemMaskIds === undefined ? '∅' : [...enabledSystemMaskIds].sort().join(',');

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
        // Curadoria pessoal: se o usuário tem uma lista explícita de máscaras
        // ativadas (array), mescla APENAS essas do admin. Se `undefined` (legado),
        // mantém o comportamento antigo (mescla todas) até a migração rodar.
        const enabledSet =
          enabledSystemMaskIds !== undefined ? new Set(enabledSystemMaskIds) : null;
        const combined = [...userDocs];
        adminDocs.forEach((aDoc: T) => {
          if (enabledSet && !enabledSet.has(aDoc.id)) return;
          if (!combined.some((uDoc) => uDoc.id === aDoc.id)) {
            combined.push({
              ...aDoc,
              isSystem: true // Marca como máscara oficial do sistema (vinculada)
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
  }, [collectionName, constraintKey, enabled, isGlobal, auth.currentUser?.uid, adminUid, enabledMaskKey, selectedClinicId, clinicOwnerKey]);

  return { data, loading, error };
}

// ─── useSystemTemplates: todas as máscaras PADRÃO DO SISTEMA (do admin) ───
// Independe da curadoria pessoal do usuário — é a fonte do "Catálogo do Sistema",
// onde o usuário escolhe quais ativar. Para o próprio admin, retorna vazio (ele
// gerencia as máscaras diretamente em useCollection('templates')).
export function useSystemTemplates(): { data: ReportTemplate[]; loading: boolean } {
  const [data, setData] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState<string | null>(localCachedAdminUid);

  useEffect(() => {
    if (!auth.currentUser) return;
    resolveAdminUid().then((uid) => {
      if (uid) {
        localCachedAdminUid = uid;
        setAdminUid(uid);
      }
    });
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.email === ADMIN_EMAIL) {
      setData([]);
      setLoading(false);
      return;
    }
    if (!adminUid) return;

    setLoading(true);
    const adminColRef = collection(firestore, `users/${adminUid}/templates`);
    const unsubscribe = onSnapshot(
      query(adminColRef),
      (snapshot) => {
        setData(
          snapshot.docs.map((d) => ({ ...d.data(), id: d.id, isSystem: true } as ReportTemplate))
        );
        setLoading(false);
      },
      (err) => {
        logger.warn('[Firestore] Erro ao carregar catálogo de máscaras do sistema:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [auth.currentUser?.uid, adminUid]);

  return { data, loading };
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
  // Ver comentário equivalente em useCollection: o mapa de memberships pode
  // chegar depois do 1º render (listener assíncrono) — precisa resubscrever
  // quando ele mudar, senão a leitura fica presa no owner errado/atrasado.
  const clinicOwnerKey = useApp((s) => JSON.stringify(s.clinicOwnerMap));

  useEffect(() => {
    if (!documentId || !auth.currentUser) {
      setLoading(false);
      return;
    }

    const path = isGlobal ? collectionName : userPath(collectionName, documentId);
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
  }, [collectionName, documentId, isGlobal, auth.currentUser?.uid, clinicOwnerKey]);

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
  // Mapa de memberships pode chegar depois do 1º render (listener assíncrono)
  // — sem isto, uma clínica compartilhada já selecionada no queryKey não
  // resubscreve para o dono certo assim que o mapa carrega.
  const clinicOwnerKey = useApp((s) => JSON.stringify(s.clinicOwnerMap));

  // Ao mudar a query (ex.: trocar de clínica), reinicia a paginação na 1ª página.
  // Usa atualização funcional com bail-out p/ não re-subscrever à toa quando já
  // está na 1ª página (evita ciclos extras de carregamento ao entrar na tela).
  useEffect(() => {
    setCurrentLimit((prev) => (prev === initialLimit ? prev : initialLimit));
  }, [constraintKey, initialLimit]);

  // Mostra o esqueleto de carregamento apenas no PRIMEIRO load. Em
  // re-subscrições (troca de clínica, limite, settle do uid) mantém os dados
  // atuais visíveis para não "piscar".
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !auth.currentUser) {
      setLoading(false);
      return;
    }

    if (!loadedRef.current) setLoading(true);
    const path = isGlobal ? collectionName : userPath(collectionName);
    const colRef = collection(firestore, path);
    const q = query(colRef, ...constraints, limit(currentLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
        setData(docs);
        setHasMore(docs.length === currentLimit);
        loadedRef.current = true;
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
  }, [collectionName, constraintKey, enabled, isGlobal, auth.currentUser?.uid, currentLimit, clinicOwnerKey]);

  const loadMore = () => {
    if (hasMore) {
      setCurrentLimit((prev) => prev + initialLimit);
    }
  };

  return { data, loading, error, loadMore, hasMore };
}

// ─── Re-export query helpers for use in components ───
export { where, orderBy, limit } from 'firebase/firestore';
