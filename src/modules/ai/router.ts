import { Motor } from './motorProfiles';

// ═══════════════════════════════════════════════════════════════
// ROTEADOR INTELIGENTE DE MOTOR (Lite/Pro)
// ═══════════════════════════════════════════════════════════════
// Classifica a complexidade clínica do caso ANTES da geração e sugere
// o motor adequado. Princípio inviolável: SEGURANÇA NUNCA É OTIMIZADA
// POR CUSTO. Qualquer red flag na clínica força o Pro, ignorando a
// escolha do usuário.
//
// Esta é uma heurística determinística (sem IA, sem rede) — rápida,
// barata e auditável. Serve como guard-rail e como sugestão na UI.

export interface RouterInput {
  area: string;
  examType?: string;
  clinicalIndication?: string;
  anamnesis?: string;
  /** Motor escolhido pelo usuário (pode ser sobrescrito por segurança). */
  userMotor?: Motor;
}

export interface RouterDecision {
  /** Motor recomendado após avaliação. */
  recommendedMotor: Motor;
  /** Complexidade estimada (1 = rotina, 5 = alta). */
  complexity: 1 | 2 | 3 | 4 | 5;
  /** True se o Pro foi FORÇADO por red flag (sobrescreve userMotor). */
  forcedPro: boolean;
  /** Termos de red flag detectados (para transparência na UI). */
  redFlags: string[];
  /** Justificativa legível da decisão. */
  reason: string;
}

// Red flags clínicos — presença força o Motor Pro. Lista conservadora,
// focada em urgências e contextos de alto risco que exigem profundidade.
const RED_FLAG_TERMS: string[] = [
  // Urgências vasculares / hemorrágicas
  'aneurisma', 'dissecção', 'dissecao', 'trombo', 'tvp', 'isquemia', 'hemoperitoneo',
  'hemorrag', 'pulsátil', 'pulsatil', 'sangramento',
  // Oncológico / massas suspeitas
  'massa', 'nódulo suspeito', 'nodulo suspeito', 'neoplasia', 'tumor', 'metástase',
  'metastase', 'carcinoma', 'espiculad', 'oncológic', 'oncologic',
  // Obstétrico / ginecológico agudo
  'ectópica', 'ectopica', 'torção', 'torcao', 'aborto', 'óbito fetal', 'obito fetal',
  'centralização', 'centralizacao', 'oligoâmnio', 'oligoamnio', 'descolamento',
  // Fetal crítico (Doppler / placentação de alto risco)
  'diástole zero', 'diastole zero', 'diástole reversa', 'diastole reversa',
  'aedv', 'redv', 'onda a reversa', 'hidropsia', 'hidropisia',
  'vasa prévia', 'vasa previa', 'acretismo', 'placenta prévia', 'placenta previa',
  // Infeccioso / agudo
  'abscesso', 'séptic', 'septic', 'febre', 'piosalpinge',
  // Sinais de gravidade genéricos
  'dor aguda', 'dor intensa', 'urgência', 'urgencia', 'emergência', 'emergencia',
];

// Áreas que, por natureza, tendem a exigir profundidade (peso na complexidade).
const HIGH_COMPLEXITY_AREAS = new Set(['medicina-fetal', 'vascular', 'mastologia']);

function normalize(text?: string): string {
  return (text || '').toLowerCase();
}

/** Detecta red flags no texto clínico combinado. */
function detectRedFlags(haystack: string): string[] {
  const found = new Set<string>();
  for (const term of RED_FLAG_TERMS) {
    if (haystack.includes(term)) found.add(term);
  }
  return [...found];
}

/**
 * Decide o motor adequado para o caso. Determinístico e sem efeitos
 * colaterais. A decisão final respeita o usuário, EXCETO quando há red
 * flag — nesse caso o Pro é forçado.
 */
export function routeMotor(input: RouterInput): RouterDecision {
  const haystack = `${normalize(input.clinicalIndication)} ${normalize(input.anamnesis)} ${normalize(input.examType)}`;
  const redFlags = detectRedFlags(haystack);

  // Pontuação de complexidade (1-5).
  let score = 1;
  if (HIGH_COMPLEXITY_AREAS.has(input.area)) score += 1;
  const clinicalLength = normalize(input.clinicalIndication).length + normalize(input.anamnesis).length;
  if (clinicalLength > 160) score += 1; // anamnese rica = caso mais elaborado
  if (redFlags.length >= 1) score += 2;
  if (redFlags.length >= 3) score += 1;
  const complexity = Math.max(1, Math.min(5, score)) as RouterDecision['complexity'];

  // Segurança força o Pro.
  if (redFlags.length > 0) {
    return {
      recommendedMotor: 'pro',
      complexity,
      forcedPro: true,
      redFlags,
      reason: `Pro FORÇADO por segurança: ${redFlags.length} sinal(is) de alerta clínico detectado(s) (${redFlags.slice(0, 4).join(', ')}). Segurança nunca é otimizada por custo.`,
    };
  }

  // Sem red flag: respeita a escolha do usuário; sugere Pro se complexo.
  const suggested: Motor = complexity >= 4 ? 'pro' : 'lite';
  const recommendedMotor: Motor = input.userMotor || suggested;

  return {
    recommendedMotor,
    complexity,
    forcedPro: false,
    redFlags,
    reason:
      input.userMotor
        ? `Sem red flags. Motor do usuário (${input.userMotor}) respeitado. Complexidade estimada: ${complexity}/5.`
        : `Sem red flags. Sugerido ${suggested} pela complexidade ${complexity}/5.`,
  };
}
