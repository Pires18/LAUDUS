// ═══════════════════════════════════════════════════════════════════════
// MOTOR — Rastreamento de pré-eclâmpsia (1º trimestre), riscos competitivos
// ═══════════════════════════════════════════════════════════════════════
// Modelo FMF (Wright/Nicolaides/Tan):
//
//   μ  = intercepto + Σ(contribuições maternas, em semanas) + Σ(biomarcadores)
//        → μ é a média da Gaussiana da "idade gestacional no parto com PE"
//   risco(PE antes de X sem) = Φ( (X − μ) / σ )
//
// Contribuições NEGATIVAS deslocam a Gaussiana para a esquerda (PE mais
// precoce) → aumentam o risco de PE pré-termo.
//
// FATORES MATERNOS: coeficientes exatos de Wright D et al., AJOG 2015
// (competing risks model; Tabela 2). Grupo de referência: raça branca,
// nulípara, concepção espontânea, peso 69 kg, altura 164 cm.
//
// ⚠️  SEGURANÇA CLÍNICA (ver `preeclampsiaData.ts`, validated:false):
//   • Fatores maternos: transcritos de Wright 2015 — CONFERIR com o usuário.
//   • Parte de biomarcadores (MAP/UtA-PI/PlGF): ainda APROXIMADA — coeficientes
//     de Tan 2018 e medianas Roche Cobas pendentes de validação.
//   • Sub-modelo de "parosa sem PE prévia" (polinômio fracionário de intervalo)
//     ainda SIMPLIFICADO (tratado como referência) — VALIDAR.
//   • Apoio à decisão baseado em modelos publicados — NÃO é a calculadora
//     oficial da Fetal Medicine Foundation.
// ═══════════════════════════════════════════════════════════════════════

export type RacialOrigin = 'white' | 'afroCaribbean' | 'southAsian' | 'eastAsian' | 'mixed';
export type Conception = 'spontaneous' | 'ovulationInduction' | 'ivf';

export interface PeMaternalFactors {
  ageYears: number;
  weightKg: number;
  heightCm: number;
  racialOrigin: RacialOrigin;
  conception: Conception;
  chronicHypertension: boolean;
  diabetesType1: boolean;
  diabetesType2: boolean;
  sleOrAps: boolean;          // LES / SAAF
  familyHistoryPE: boolean;   // mãe com PE
  nulliparous: boolean;       // referência do modelo
  previousPE: boolean;        // se parosa
  /** IG (semanas) do parto na gestação com PE prévia (para o termo quadrático). */
  previousPeGaWeeks?: number;
}

export interface PeBiomarkers {
  mapMoM?: number;    // pressão arterial média
  utaPiMoM?: number;  // IP médio das uterinas
  plgfMoM?: number;   // PlGF
}

export interface PeCoefficients {
  /** Trava de segurança: só liberar em produção quando validado. */
  validated: boolean;
  version: string;

  /** μ base (semanas) do grupo de referência e DP fixo da Gaussiana. */
  intercept: number;
  sigma: number;

  // ── Contribuições maternas (semanas), SINALIZADAS. Negativo ⇒ risco maior.
  // Wright 2015, Tabela 2.
  agePerYearOver35: number;        // −0.207 (só idade > 35)
  heightPerCmOver164: number;      // +0.117
  racial: Record<RacialOrigin, number>;
  conception: Record<Conception, number>;
  chronicHypertension: number;     // −7.29
  sleOrAps: number;                // −3.05
  parousPrevPE: number;            // −8.17
  parousPrevPeGaQuadCoef: number;  // +0.027 × (IG_prévia − 24)²

  // Fatores que só valem em mulheres SEM HAS crônica (interação):
  weightPerKgOver69_noHtn: number; // −0.069
  diabetes_noHtn: number;          // −3.39
  familyHistoryPE_noHtn: number;   // −1.72

  // ── Biomarcadores: contribuição = beta × log10(MoM). APROXIMADO (VALIDAR).
  betaMapLog10: number;    // < 0 (MAP alto ⇒ μ menor)
  betaUtaPiLog10: number;  // < 0
  betaPlgfLog10: number;   // > 0 (PlGF alto ⇒ μ maior, protetor)
}

export interface PeThresholds {
  pretermGa: number;           // define PE pré-termo (padrão 37)
  termGa: number;              // define PE a termo (padrão 42)
  aspirinCutoffOneInN: number; // risco pré-termo p/ indicar AAS (padrão 1:100)
}

export const DEFAULT_PE_THRESHOLDS: PeThresholds = {
  pretermGa: 37,
  termGa: 42,
  aspirinCutoffOneInN: 100,
};

export interface PeRisk {
  mu: number;
  pretermPE: { prob: number; oneInN: number };
  termPE: { prob: number; oneInN: number };
  aspirinRecommended: boolean;
}

// ───────────────────────────── Estatística ──────────────────────────────

/** Aproximação da função erro (Abramowitz & Stegun 7.1.26). */
function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return s * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function peRiskBefore(gaTarget: number, mu: number, sigma: number): number {
  return normalCdf((gaTarget - mu) / sigma);
}

// ───────────────────────────── Média materna ────────────────────────────

/** Calcula μ (semanas) a partir dos fatores maternos (Wright 2015). */
export function maternalMeanGa(f: PeMaternalFactors, c: PeCoefficients): number {
  let mu = c.intercept;

  if (f.ageYears > 35) mu += c.agePerYearOver35 * (f.ageYears - 35);
  mu += c.heightPerCmOver164 * (f.heightCm - 164);
  mu += c.racial[f.racialOrigin] ?? 0;
  mu += c.conception[f.conception] ?? 0;

  if (f.chronicHypertension) {
    mu += c.chronicHypertension;
  } else {
    // Peso, diabetes e história familiar só entram SEM HAS crônica.
    if (f.weightKg > 69) mu += c.weightPerKgOver69_noHtn * (f.weightKg - 69);
    if (f.diabetesType1 || f.diabetesType2) mu += c.diabetes_noHtn;
    if (f.familyHistoryPE) mu += c.familyHistoryPE_noHtn;
  }

  if (f.sleOrAps) mu += c.sleOrAps;

  // Paridade: nulípara = referência (0). Parosa com PE prévia = fator forte.
  if (!f.nulliparous && f.previousPE) {
    const prevGa = f.previousPeGaWeeks ?? 32; // default plausível se não informado
    mu += c.parousPrevPE + c.parousPrevPeGaQuadCoef * Math.pow(prevGa - 24, 2);
  }
  // Parosa sem PE prévia: efeito protetor via polinômio de intervalo —
  // SIMPLIFICADO como referência (0). VALIDAR (Wright 2015, Tabela 2).

  return mu;
}

/** Aplica o deslocamento de μ pelos biomarcadores (log10 MoM). APROXIMADO. */
export function applyBiomarkers(mu: number, b: PeBiomarkers, c: PeCoefficients): number {
  let out = mu;
  if (b.mapMoM && b.mapMoM > 0) out += c.betaMapLog10 * Math.log10(b.mapMoM);
  if (b.utaPiMoM && b.utaPiMoM > 0) out += c.betaUtaPiLog10 * Math.log10(b.utaPiMoM);
  if (b.plgfMoM && b.plgfMoM > 0) out += c.betaPlgfLog10 * Math.log10(b.plgfMoM);
  return out;
}

// ───────────────────────────── Orquestração ─────────────────────────────

export function computePreeclampsiaRisk(
  factors: PeMaternalFactors,
  biomarkers: PeBiomarkers,
  coeffs: PeCoefficients,
  thresholds: PeThresholds = DEFAULT_PE_THRESHOLDS,
): PeRisk {
  const mu = applyBiomarkers(maternalMeanGa(factors, coeffs), biomarkers, coeffs);

  const pPreterm = peRiskBefore(thresholds.pretermGa, mu, coeffs.sigma);
  const pTerm = peRiskBefore(thresholds.termGa, mu, coeffs.sigma);
  const oneInN = (p: number) => (p > 0 ? Math.round(1 / p) : Infinity);

  return {
    mu,
    pretermPE: { prob: pPreterm, oneInN: oneInN(pPreterm) },
    termPE: { prob: pTerm, oneInN: oneInN(pTerm) },
    aspirinRecommended: pPreterm >= 1 / thresholds.aspirinCutoffOneInN,
  };
}
