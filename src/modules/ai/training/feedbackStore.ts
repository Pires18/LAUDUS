import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit as fsLimit } from 'firebase/firestore';
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

// ─── Feedback humano (in-the-loop) ───────────────────────────────────────────
// Avaliação explícita do médico (👍/👎) sobre um laudo ou proposta do copiloto.
// Fecha o ciclo de padronização: o sistema aprende o que o médico considera
// correto, além das verificações automáticas.

export type FeedbackRating = 'positive' | 'negative';
export type FeedbackContext = 'report-quality' | 'copilot-proposal' | 'generation';

export interface HumanFeedback {
  id?: string;
  area: string;
  examType: string;
  motor?: 'lite' | 'pro';
  rating: FeedbackRating;
  context: FeedbackContext;
  /** Nota estrutural do laudo/proposta no momento do feedback (0-100). */
  auditScore?: number;
  /** Observação livre do médico (opcional). */
  note?: string;
  createdAt: number;
}

/** Persiste um feedback humano. Best-effort. */
export async function recordHumanFeedback(fb: Omit<HumanFeedback, 'id' | 'createdAt'>): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const ref = collection(firestore, `users/${uid}/human_feedback`);
    const id = doc(ref).id;
    await setDoc(doc(ref, id), stripUndefined({ ...fb, id, createdAt: Date.now() }));
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao gravar feedback humano:', err);
  }
}

/** Lista feedbacks humanos, mais recentes primeiro. */
export async function listHumanFeedback(max = 1000): Promise<HumanFeedback[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const ref = collection(firestore, `users/${uid}/human_feedback`);
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc'), fsLimit(max)));
    return snap.docs.map((d) => d.data() as HumanFeedback);
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao listar feedback humano:', err);
    return [];
  }
}

export interface HumanFeedbackAggregate {
  total: number;
  positive: number;
  negative: number;
  /** % de feedbacks positivos (0-100). */
  satisfactionRate: number;
  /** Áreas com mais feedback negativo (onde padronizar). */
  worstAreas: Array<{ area: string; negative: number; total: number }>;
}

// ─── Calibração pessoal (Camada 0.5) ─────────────────────────────────────────
// Bloco de calibração precomputado (correções + feedback) que é injetado na
// geração. Persistido num doc único para leitura barata por laudo.
// Caminho: users/{uid}/training_config/personal.

/** Salva o bloco de calibração pessoal. Best-effort. */
export async function savePersonalCalibration(block: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(
      doc(firestore, `users/${uid}/training_config/personal`),
      { calibration: block, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao salvar calibração pessoal:', err);
  }
}

/** Lê o bloco de calibração pessoal (ou '' se ausente). */
export async function getPersonalCalibration(): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) return '';
  try {
    const snap = await getDoc(doc(firestore, `users/${uid}/training_config/personal`));
    return snap.exists() ? (snap.data().calibration || '') : '';
  } catch (err) {
    logger.warn('[FeedbackStore] Falha ao ler calibração pessoal:', err);
    return '';
  }
}

export function aggregateHumanFeedback(list: HumanFeedback[]): HumanFeedbackAggregate {
  const total = list.length;
  const positive = list.filter((f) => f.rating === 'positive').length;
  const negative = total - positive;

  const byArea = new Map<string, { negative: number; total: number }>();
  for (const f of list) {
    const e = byArea.get(f.area) || { negative: 0, total: 0 };
    e.total++;
    if (f.rating === 'negative') e.negative++;
    byArea.set(f.area, e);
  }
  const worstAreas = [...byArea.entries()]
    .map(([area, v]) => ({ area, negative: v.negative, total: v.total }))
    .filter((a) => a.negative > 0)
    .sort((a, b) => b.negative - a.negative);

  return {
    total,
    positive,
    negative,
    satisfactionRate: total === 0 ? 0 : Math.round((positive / total) * 100),
    worstAreas,
  };
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
