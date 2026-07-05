// ═══════════════════════════════════════════════════════════════════════
// DADOS CLÍNICOS — Rastreamento de pré-eclâmpsia (1º trimestre)
// ═══════════════════════════════════════════════════════════════════════
// Fatores maternos: coeficientes EXATOS de Wright D, Syngelaki A, Akolekar R,
// Poon LC, Nicolaides KH. "Competing risks model in screening for preeclampsia
// by maternal characteristics and medical history." AJOG 2015;213:62.e1-10
// (Tabela 2). Referência: branca, nulípara, espontânea, 69 kg, 164 cm.
//
// ⚠️  AINDA `validated: false` — CONFERIR com o usuário e completar:
//   • Sub-modelo de "parosa sem PE prévia" (polinômio fracionário de intervalo).
//   • Biomarcadores (MAP/UtA-PI/PlGF): coeficientes de Tan MY et al., UOG 2018
//     (doi 10.1002/uog.19112) — ainda APROXIMADOS abaixo.
//   • Medianas Roche Cobas de MAP/UtA-PI/PlGF (fabricante/laboratório).
//   • Conduta AAS 150 mg: ASPRE — Rolnik DL et al., NEJM 2017.
// ═══════════════════════════════════════════════════════════════════════

import type { PeCoefficients } from './preeclampsia';

export const PROVISIONAL_PE_COEFFICIENTS: PeCoefficients = {
  validated: false, // 🚫 não registrar a calculadora enquanto for false
  version: 'pe-wright2015-maternal + biomarcadores-provisorios-v1',

  intercept: 54.36,  // Wright 2015
  sigma: 6.8833,     // Wright 2015 (IC95% 6.67–7.10)

  // ── Fatores maternos (Wright 2015, Tabela 2) ──────────────────────────
  agePerYearOver35: -0.207,
  heightPerCmOver164: 0.117,
  racial: {
    white: 0,
    afroCaribbean: -2.68,
    southAsian: -1.13,
    eastAsian: 0,   // não significativo → referência
    mixed: 0,       // não significativo → referência
  },
  conception: {
    spontaneous: 0,
    ovulationInduction: 0, // não significativo → referência
    ivf: -1.63,
  },
  chronicHypertension: -7.29,
  sleOrAps: -3.05,
  parousPrevPE: -8.17,
  parousPrevPeGaQuadCoef: 0.027, // × (IG_prévia − 24)²

  // Só valem SEM HAS crônica:
  weightPerKgOver69_noHtn: -0.069,
  diabetes_noHtn: -3.39,
  familyHistoryPE_noHtn: -1.72,

  // ── Biomarcadores — APROXIMADO (VALIDAR: Tan 2018 + medianas Cobas) ─────
  // O modelo FMF real combina os biomarcadores por Bayes (distribuições de
  // log10 MoM cujas médias dependem da IG do parto), não por deslocamento
  // linear de μ como aqui. Parâmetros de fontes abertas para a validação:
  //   • SD log10 MoM (não-afetada): MAP 0.035 ; UtA-PI 0.12 ; PlGF ~0.15 (conferir).
  //   • Mediana UtA-PI: ln(mediana) = 1.39 − 0.012·GA + 0.0000198·GA²  (GA em dias).
  //   • Medianas de MAP/PlGF (Roche Cobas): pendentes do laboratório.
  betaMapLog10: -30,   // MAP alto ⇒ μ menor
  betaUtaPiLog10: -12, // UtA-PI alto ⇒ μ menor
  betaPlgfLog10: 10,   // PlGF alto ⇒ μ maior (protetor)
};
