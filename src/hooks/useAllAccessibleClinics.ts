import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { useCollection } from './useFirestore';
import { useApp } from '../store/app';
import { Clinic } from '../types';
import { logger } from '../utils/logger';

export interface AccessibleClinic extends Clinic {
  /** Presente quando a clínica é de outro dono (convite de equipe). */
  shared?: boolean;
  role?: 'editor' | 'viewer';
  ownerId?: string;
}

/**
 * Todas as clínicas que o usuário atual pode acessar: as próprias +
 * as compartilhadas com ele via `clinic_memberships`. Usado pelo seletor de
 * clínica (Sidebar, ClinicSessionModal) — a lista de clínicas PRÓPRIAS
 * (`useCollection('clinics')`) nunca é redirecionada pelo owner-resolution
 * (ver clinicAccess.ts); as compartilhadas são buscadas à parte (leitura
 * pontual, não em tempo real — metadados de clínica mudam raramente).
 */
export function useAllAccessibleClinics(): { data: AccessibleClinic[]; loading: boolean } {
  const { data: ownClinics, loading: ownLoading } = useCollection<Clinic>('clinics');
  const clinicOwnerMap = useApp((s) => s.clinicOwnerMap);
  const [sharedClinics, setSharedClinics] = useState<AccessibleClinic[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  const membershipKey = JSON.stringify(
    Object.entries(clinicOwnerMap).sort(([a], [b]) => a.localeCompare(b))
  );

  useEffect(() => {
    const entries = Object.entries(clinicOwnerMap);
    if (entries.length === 0) {
      setSharedClinics([]);
      return;
    }
    let cancelled = false;
    setSharedLoading(true);
    Promise.all(
      entries.map(async ([clinicId, info]) => {
        try {
          const snap = await getDoc(doc(firestore, 'users', info.ownerId, 'clinics', clinicId));
          if (!snap.exists()) return null;
          return { ...(snap.data() as Clinic), id: clinicId, shared: true, role: info.role, ownerId: info.ownerId } as AccessibleClinic;
        } catch (err) {
          logger.warn(`[useAllAccessibleClinics] Falha ao ler clínica compartilhada ${clinicId}:`, err);
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setSharedClinics(results.filter((c): c is AccessibleClinic => c !== null));
      setSharedLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipKey]);

  return { data: [...ownClinics, ...sharedClinics], loading: ownLoading || sharedLoading };
}
