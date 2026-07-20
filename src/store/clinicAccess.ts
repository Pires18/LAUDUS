/**
 * Resolução de "de quem é a subárvore Firestore que devo ler/escrever" para
 * dados de clínica (patients/exams/appointments/clinics) quando o usuário
 * atual pode estar operando dentro de uma clínica de OUTRO dono (via
 * clinic_memberships — equipe multiusuário).
 *
 * Módulo à parte (sem depender de `store/app.ts`) para evitar import
 * circular: `app.ts` já importa `store/db.ts`, e `db.ts` precisa consultar
 * esta resolução — se ela morasse dentro do próprio store Zustand, `db.ts`
 * teria que importar `app.ts` de volta. `app.ts` empurra os valores para cá
 * (mirror) toda vez que mudam; `db.ts`/`useFirestore.ts` só leem.
 */

export interface ClinicOwnerInfo {
  ownerId: string;
  role: 'editor' | 'viewer' | 'recepcao';
}

let clinicOwnerMap: Record<string, ClinicOwnerInfo> = {};
let activeSelectedClinicId: string | null = null;

export function setClinicOwnerMapMirror(map: Record<string, ClinicOwnerInfo>): void {
  clinicOwnerMap = map;
}

export function setSelectedClinicIdMirror(id: string | null): void {
  activeSelectedClinicId = id;
}

export function getClinicOwnerInfo(clinicId: string | null | undefined): ClinicOwnerInfo | null {
  if (!clinicId) return null;
  return clinicOwnerMap[clinicId] || null;
}

const CLINIC_SCOPED_COLLECTIONS = new Set(['patients', 'exams', 'appointments', 'clinical_records']);

/**
 * Resolve o uid da subárvore a usar para um `collectionName`.
 * - `patients`/`exams`/`appointments`: usa `explicitClinicId` (ex.: clinicId
 *   do doc sendo criado) ou, na ausência, a clínica ativa selecionada — se ela
 *   pertence a outro dono (membership), redireciona para o dono.
 * - `clinics` com `explicitClinicId` (leitura/edição de UMA clínica específica,
 *   não a lista): idem, resolve pelo id específico.
 * - Qualquer outro caso (lista de clínicas, settings, templates, ai_usage):
 *   sempre a própria subárvore — nunca redireciona.
 */
export function resolveOwnerUid(
  collectionName: string,
  ownUid: string,
  explicitClinicId?: string | null
): string {
  if (collectionName === 'clinics') {
    if (!explicitClinicId) return ownUid; // lista de clínicas: sempre a própria
    return getClinicOwnerInfo(explicitClinicId)?.ownerId || ownUid;
  }
  if (CLINIC_SCOPED_COLLECTIONS.has(collectionName)) {
    const clinicId = explicitClinicId ?? activeSelectedClinicId;
    if (clinicId) return getClinicOwnerInfo(clinicId)?.ownerId || ownUid;
  }
  return ownUid;
}
