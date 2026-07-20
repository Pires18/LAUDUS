import { useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { useApp } from '../store/app';
import { logger } from '../utils/logger';
import { ClinicOwnerInfo } from '../store/clinicAccess';

/**
 * Escuta `clinic_memberships` (coleção global) filtrando por `memberUid ==
 * uid atual` — monta o mapa clinicId → {ownerId, role} usado por toda a
 * camada de dados (useFirestore.ts/db.ts) para redirecionar leituras/escritas
 * de patients/exams/appointments/clinics para a subárvore do dono da clínica
 * quando o usuário atual é só um membro convidado, não o dono.
 *
 * Monta uma vez por sessão autenticada (ver App.tsx).
 */
export function useClinicMemberships(): void {
  const setClinicOwnerMap = useApp((s) => s.setClinicOwnerMap);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setClinicOwnerMap({});
      return;
    }

    const q = query(collection(firestore, 'clinic_memberships'), where('memberUid', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const map: Record<string, ClinicOwnerInfo> = {};
        snapshot.forEach((d) => {
          const data = d.data() as { clinicId?: string; ownerId?: string; role?: 'editor' | 'viewer' | 'recepcao' };
          if (data.clinicId && data.ownerId) {
            map[data.clinicId] = { ownerId: data.ownerId, role: data.role || 'viewer' };
          }
        });
        setClinicOwnerMap(map);
      },
      (err) => {
        logger.warn('[useClinicMemberships] Erro ao escutar clinic_memberships:', err);
        setClinicOwnerMap({});
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid, setClinicOwnerMap]);
}
