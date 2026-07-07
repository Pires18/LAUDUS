import { StructuredScoreKey } from '../../../types';

/**
 * Escore ACR TI-RADS inline a partir dos descritores selecionados.
 * Pontos idênticos ao TiradsCalculator (Tessler et al., ACR 2017) — mesma
 * matemática, reaproveitada como função pura para cálculo em tempo real.
 */

const POINTS: Record<StructuredScoreKey, Record<string, number>> = {
  composition: { cística: 0, espongiforme: 0, mista: 1, sólida: 2 },
  echogenicity: { anecoico: 0, 'hiper/isoecoico': 1, hipoecoico: 2, 'muito hipoecoico': 3 },
  shape: { 'mais largo que alto': 0, 'mais alto que largo': 3 },
  margin: { lisa: 0, 'mal definida': 0, 'lobulada/irregular': 2, 'extensão extratireoidiana': 3 },
  foci: { 'nenhum / cauda de cometa': 0, macrocalcificações: 1, 'calcificações periféricas': 2, 'focos puntiformes': 3 },
};

/** Opções de descritor (rótulos = chaves de pontuação) para os overlays. */
export const TIRADS_OPTIONS: Record<StructuredScoreKey, string[]> = {
  composition: ['cística', 'espongiforme', 'mista', 'sólida'],
  echogenicity: ['anecoico', 'hiper/isoecoico', 'hipoecoico', 'muito hipoecoico'],
  shape: ['mais largo que alto', 'mais alto que largo'],
  margin: ['lisa', 'mal definida', 'lobulada/irregular', 'extensão extratireoidiana'],
  foci: ['nenhum / cauda de cometa', 'macrocalcificações', 'calcificações periféricas', 'focos puntiformes'],
};

export interface TiradsResult {
  points: number;
  tr: number;
  label: string;
  conduct: string;
  complete: boolean;
}

function pts(key: StructuredScoreKey, value: string | undefined): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const table = POINTS[key];
  const found = Object.keys(table).find((k) => k.toLowerCase() === v);
  return found ? table[found] : null;
}

/** Categoria TR a partir do total de pontos ACR. */
function categoryFromPoints(points: number): { tr: number; label: string; conduct: string } {
  if (points >= 7) return { tr: 5, label: 'altamente suspeito', conduct: 'PAAF se ≥ 1,0 cm; seguimento se ≥ 0,5 cm' };
  if (points >= 4) return { tr: 4, label: 'moderadamente suspeito', conduct: 'PAAF se ≥ 1,5 cm; seguimento se ≥ 1,0 cm' };
  if (points === 3) return { tr: 3, label: 'levemente suspeito', conduct: 'PAAF se ≥ 2,5 cm; seguimento se ≥ 1,5 cm' };
  if (points === 2) return { tr: 2, label: 'não suspeito', conduct: 'sem indicação de PAAF' };
  return { tr: 1, label: 'benigno', conduct: 'sem indicação de PAAF' };
}

/**
 * Calcula a categoria TI-RADS. Requer os 4 descritores principais
 * (composição, ecogenicidade, forma, margem); focos são aditivos e opcionais.
 */
export function tiradsScore(desc: {
  composition?: string;
  echogenicity?: string;
  shape?: string;
  margin?: string;
  foci?: string;
}): TiradsResult | null {
  const parts: Array<number | null> = [
    pts('composition', desc.composition),
    pts('echogenicity', desc.echogenicity),
    pts('shape', desc.shape),
    pts('margin', desc.margin),
  ];
  const complete = parts.every((p) => p !== null);
  // Focos ecogênicos são ADITIVOS (multiseleção): soma os pontos de cada foco.
  const fociPts = (desc.foci || '')
    .split(',')
    .map((f) => pts('foci', f.trim()) ?? 0)
    .reduce((a, b) => a + b, 0);
  const sum = parts.reduce<number>((a, p) => a + (p ?? 0), 0) + fociPts;
  if (!complete && sum === 0) return null;
  const cat = categoryFromPoints(sum);
  return { points: sum, tr: cat.tr, label: cat.label, conduct: cat.conduct, complete };
}

// ─────────────────────────────────────────────────────────────────────
// Sugestões de categoria (BI-RADS / O-RADS) — regras simplificadas.
// NÃO substituem o julgamento do radiologista; exibidas como "sugestão".
// ─────────────────────────────────────────────────────────────────────

export interface CategorySuggestion {
  label: string;
  suspicious: boolean;
  detail?: string;
}

/** Sugestão BI-RADS (ACR US) a partir dos descritores morfológicos. */
export function biradsSuggest(desc: {
  forma?: string; orientacao?: string; margem?: string; eco?: string; acusticas?: string;
}): CategorySuggestion | null {
  const provided = [desc.forma, desc.orientacao, desc.margem].filter(Boolean).length;
  if (provided < 2) return null;

  const suspicious: string[] = [];
  if (desc.forma === 'irregular') suspicious.push('forma irregular');
  if (desc.orientacao && desc.orientacao.startsWith('não paralela')) suspicious.push('não paralela');
  if (desc.margem && ['angular', 'microlobulada', 'espiculada'].includes(desc.margem)) suspicious.push(`margem ${desc.margem}`);
  if (desc.acusticas === 'sombra acústica') suspicious.push('sombra acústica');

  // Cisto simples (anecoico + reforço, sem achados suspeitos)
  if (desc.eco === 'anecoico' && desc.acusticas === 'reforço acústico posterior' && suspicious.length === 0) {
    return { label: 'BI-RADS 2 (cisto simples)', suspicious: false };
  }
  if (suspicious.length === 0) return { label: 'BI-RADS 3 (provavelmente benigno)', suspicious: false };
  if (suspicious.length >= 3) return { label: 'BI-RADS 4C–5 (alta suspeita)', suspicious: true, detail: suspicious.join(', ') };
  return { label: 'BI-RADS 4 (suspeito)', suspicious: true, detail: suspicious.join(', ') };
}

/** Sugestão O-RADS (US v2022) a partir do tipo/conteúdo/septos/fluxo. */
export function oradsSuggest(desc: {
  tipo?: string; conteudo?: string; septos?: string; vascularizacao?: string;
}): CategorySuggestion | null {
  if (!desc.tipo) return null;
  const color = parseInt((desc.vascularizacao || '').trim()[0] || '', 10) || 0;
  const hasSolid = /sólida/.test(desc.tipo) || desc.septos === 'projeções papilares';
  const thick = desc.septos === 'septos espessos' || desc.septos === 'projeções papilares';

  // Unilocular anecoico/vidro fosco de paredes lisas → benigno
  if (desc.tipo === 'unilocular' && (desc.conteudo === 'anecoico' || desc.conteudo === 'de vidro fosco') && desc.septos === 'ausentes') {
    return { label: 'O-RADS 2 (quase certamente benigno)', suspicious: false };
  }
  if (hasSolid) {
    if (color === 4) return { label: 'O-RADS 5 (alto risco)', suspicious: true, detail: 'componente sólido, fluxo marcante' };
    return { label: 'O-RADS 4 (risco intermediário)', suspicious: true, detail: 'componente sólido/projeções' };
  }
  if (/multilocular/.test(desc.tipo)) {
    if (color === 4 || thick) return { label: 'O-RADS 4 (risco intermediário)', suspicious: true };
    return { label: 'O-RADS 3 (baixo risco)', suspicious: false };
  }
  return { label: 'O-RADS 3 (baixo risco)', suspicious: false };
}

/**
 * Grau de estenose carotídea (critérios de consenso SRU 2003) a partir da
 * VPS/VDF da ACI e da relação ACI/ACC. VPS em cm/s.
 */
export function carotidStenosisNASCET(vpsIca: number, vdfIca?: number, vpsCca?: number): { label: string; severe: boolean } | null {
  if (!(vpsIca > 0)) return null;
  let label: string;
  if (vpsIca < 125) label = 'normal / < 50%';
  else if (vpsIca < 230) label = 'estenose 50–69%';
  else label = 'estenose ≥ 70%';
  const severe = vpsIca >= 230 || (vdfIca != null && vdfIca >= 100);
  const ratio = vpsCca && vpsCca > 0 ? vpsIca / vpsCca : null;
  const ratioTxt = ratio != null ? ` · ACI/ACC ${ratio.toFixed(1).replace('.', ',')}` : '';
  return { label: label + ratioTxt, severe };
}

/** Interpretação do Índice Tornozelo-Braquial (ITB). */
export function itbClassification(itb: number): { label: string; alert: boolean } | null {
  if (!(itb > 0)) return null;
  if (itb > 1.3) return { label: 'incompressível (> 1,3) — calcificação', alert: true };
  if (itb >= 0.9) return { label: 'normal (0,9–1,3)', alert: false };
  if (itb >= 0.7) return { label: 'DAOP leve (0,7–0,9)', alert: true };
  if (itb >= 0.4) return { label: 'DAOP moderada (0,4–0,7)', alert: true };
  return { label: 'DAOP grave (< 0,4)', alert: true };
}

/** Sugestão Bosniak (adaptado ao US) para cisto renal a partir dos descritores. */
export function bosniakSuggest(desc: {
  septos?: string; parede?: string; calcificacao?: string; solido?: string;
}): CategorySuggestion | null {
  const any = desc.septos || desc.parede || desc.calcificacao || desc.solido;
  if (!any) return null;
  if (desc.solido === 'presente') return { label: 'Bosniak IV (provavelmente maligno)', suspicious: true };
  if (desc.parede === 'espessa/irregular' || desc.septos === 'espessos/irregulares') return { label: 'Bosniak III (indeterminado — avaliar cirurgia)', suspicious: true };
  if (desc.septos === 'múltiplos finos' || desc.calcificacao === 'grosseira') return { label: 'Bosniak IIF (seguimento)', suspicious: false };
  if (desc.septos === 'poucos finos' || desc.calcificacao === 'fina') return { label: 'Bosniak II (benigno)', suspicious: false };
  return { label: 'Bosniak I (cisto simples benigno)', suspicious: false };
}

/** Tipo de Graf a partir dos ângulos α (e β) do quadril infantil. */
export function grafType(alpha: number, beta?: number): string | null {
  if (!(alpha > 0)) return null;
  if (alpha >= 60) return 'I (quadril maduro)';
  if (alpha >= 50) return beta && beta > 77 ? 'IIb (imaturo)' : 'IIa/b (imaturo)';
  if (alpha >= 43) return 'IIc / D (descentrando)';
  return 'III–IV (displásico/luxado)';
}
