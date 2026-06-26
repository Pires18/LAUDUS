import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { logger } from '../../../utils/logger';

// ═══════════════════════════════════════════════════════════════
// REGISTRO E VERSIONAMENTO DE PROMPTS
// ═══════════════════════════════════════════════════════════════
// Para evoluir os prompts com método científico, cada versão da Camada 1
// é registrada com hash e rótulo. Permite saber qual versão gerou cada
// laudo (auditoria), comparar versões no harness e fazer rollback.
//
// Caminho: global_config/prompt_versions/versions/{id}.

export type PromptStatus = 'draft' | 'canary' | 'active' | 'archived';

export interface PromptVersion {
  id: string;
  /** Rótulo legível, ex: "v2.2.0-conclusao-enxuta". */
  label: string;
  /** Hash estável do conteúdo (muda se qualquer constante mudar). */
  hash: string;
  status: PromptStatus;
  /** % de tráfego no modo canário (0-100), válido quando status='canary'. */
  canaryPercent?: number;
  // Snapshot das constantes da Camada 1 (auditoria e rollback).
  master: string;
  global: string;
  structure: string;
  rules: string;
  notes?: string;
  createdAt: number;
}

/**
 * Hash estável (djb2) de um conjunto de strings. Determinístico: a mesma
 * entrada sempre produz o mesmo hash, entre execuções e dispositivos.
 */
export function computePromptHash(parts: string[]): string {
  const content = parts.join('');
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h) ^ content.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function versionsRef() {
  return collection(firestore, 'global_config', 'prompt_versions', 'versions');
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** Registra uma nova versão de prompt (status inicial: draft). */
export async function registerPromptVersion(params: {
  label: string;
  master: string;
  global: string;
  structure: string;
  rules: string;
  notes?: string;
}): Promise<PromptVersion> {
  const hash = computePromptHash([params.master, params.global, params.structure, params.rules]);
  const id = doc(versionsRef()).id;
  const version: PromptVersion = {
    id,
    label: params.label,
    hash,
    status: 'draft',
    master: params.master,
    global: params.global,
    structure: params.structure,
    rules: params.rules,
    notes: params.notes,
    createdAt: Date.now(),
  };
  await setDoc(doc(versionsRef(), id), stripUndefined(version));
  logger.info(`[PromptRegistry] Versão registrada: ${params.label} (${hash}).`);
  return version;
}

/** Lista versões registradas, mais recentes primeiro. */
export async function listPromptVersions(): Promise<PromptVersion[]> {
  try {
    const snap = await getDocs(query(versionsRef(), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => d.data() as PromptVersion);
  } catch (err) {
    logger.warn('[PromptRegistry] Falha ao listar versões:', err);
    return [];
  }
}

/** Atualiza o status de uma versão (draft → canary → active → archived). */
export async function setPromptVersionStatus(
  id: string,
  status: PromptStatus,
  canaryPercent?: number
): Promise<void> {
  await setDoc(
    doc(versionsRef(), id),
    stripUndefined({ status, canaryPercent }),
    { merge: true }
  );
}
