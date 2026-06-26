import { collection, doc, setDoc, getDocs, query, orderBy, limit as fsLimit } from 'firebase/firestore';
import { firestore, auth } from '../../../lib/firebase';
import { logger } from '../../../utils/logger';
import { CorrectionSignal } from './feedback';
import { QualityRecord } from './qualityMetrics';

// ═══════════════════════════════════════════════════════════════
// PERSISTÊNCIA DO LOOP DE FEEDBACK
// ═══════════════════════════════════════════════════════════════
// Grava sinais de correção e registros de qualidade no Firestore para
// alimentar a calibração pessoal (feedback.ts) e o Dashboard Training
// (qualityMetrics.ts). Escritas best-effort: falhas nunca interrompem o
// fluxo clínico do usuário.
//
// Caminhos: users/{uid}/correction_patterns/{id}, users/{uid}/quality_records/{id}.

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** Persiste um sinal de correção (geração→final). Best-effort. */
export async function recordCorrectionSignal(signal: CorrectionSignal): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const ref = collection(firestore, `users/${uid}/correction_patterns`);
    const id = doc(ref).id;
    await setDoc(doc(ref, id), stripUndefined({ ...signal, id, createdAt: Date.now() }));
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao gravar sinal de correção:', err);
  }
}

/** Persiste um registro de qualidade de laudo. Best-effort. */
export async function recordQualityRecord(record: QualityRecord): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const ref = collection(firestore, `users/${uid}/quality_records`);
    const id = doc(ref).id;
    await setDoc(doc(ref, id), stripUndefined({ ...record, id }));
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao gravar registro de qualidade:', err);
  }
}

/** Lista sinais de correção para agregação de padrões. */
export async function listCorrectionSignals(max = 500): Promise<CorrectionSignal[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const ref = collection(firestore, `users/${uid}/correction_patterns`);
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc'), fsLimit(max)));
    return snap.docs.map((d) => d.data() as CorrectionSignal);
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao listar sinais de correção:', err);
    return [];
  }
}

/** Lista registros de qualidade para o Dashboard Training. */
export async function listQualityRecords(max = 1000): Promise<QualityRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const ref = collection(firestore, `users/${uid}/quality_records`);
    const snap = await getDocs(query(ref, orderBy('timestamp', 'desc'), fsLimit(max)));
    return snap.docs.map((d) => d.data() as QualityRecord);
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao listar registros de qualidade:', err);
    return [];
  }
}
