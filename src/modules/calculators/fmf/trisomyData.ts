// ═══════════════════════════════════════════════════════════════════════
// DADOS CLÍNICOS — Rastreamento de trissomias (1º trimestre)
// ═══════════════════════════════════════════════════════════════════════
// TN (mistura): Wright D et al., UOG 2008; 31:376-383 (Tabela 2) — EXATO.
// Bioquímica T21: Kagan KO et al., UOG 2008; 31:493-502 (Tab.3 + regressões) — EXATO.
// Risco por idade: aproximação de Snijders & Nicolaides 1999 — VALIDAR.
//
// Bioquímica T18: Kagan uog.6123; T13: Kagan Hum Reprod 2008; 23:1968 — EXATO.
// LRs de marcadores: prevalências publicadas (Kagan/Maiz 2009), crus.
// ⚠️  `validated: false` até conferir com casos-ouro. Correção de IG do risco
//     a priori por idade ainda pendente (Snijders).
// ═══════════════════════════════════════════════════════════════════════

import type { Trisomy, TrisomyModelParams } from './trisomy';

/** Risco de T21 ao termo por idade materna — "1 : N" (Snijders, VALIDAR). */
export const T21_TERM_RISK_BY_AGE: ReadonlyArray<readonly [number, number]> = [
  [20, 1450], [25, 1350], [30, 940], [31, 820], [32, 700], [33, 570],
  [34, 450], [35, 350], [36, 270], [37, 200], [38, 150], [39, 110],
  [40, 85], [41, 65], [42, 50], [43, 40], [44, 32], [45, 25],
];

const T18_FRACTION_OF_T21 = 1 / 10;
const T13_FRACTION_OF_T21 = 1 / 30;

export function t21TermRisk(ageYears: number): number {
  const tbl = T21_TERM_RISK_BY_AGE;
  if (ageYears <= tbl[0][0]) return 1 / tbl[0][1];
  if (ageYears >= tbl[tbl.length - 1][0]) return 1 / tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [a0, n0] = tbl[i];
    const [a1, n1] = tbl[i + 1];
    if (ageYears >= a0 && ageYears <= a1) {
      const p0 = Math.log(1 / n0);
      const p1 = Math.log(1 / n1);
      const frac = (ageYears - a0) / (a1 - a0);
      return Math.exp(p0 + frac * (p1 - p0));
    }
  }
  return 1 / tbl[tbl.length - 1][1];
}

/** Risco a priori por trissomia (ao termo — correção de IG é item de validação). */
export function ageRelatedRisk(ageYears: number): Record<Trisomy, number> {
  const t21 = t21TermRisk(ageYears);
  return { t21, t18: t21 * T18_FRACTION_OF_T21, t13: t21 * T13_FRACTION_OF_T21 };
}

export const PROVISIONAL_TRISOMY_PARAMS: TrisomyModelParams = {
  validated: false, // 🚫 conferir com casos-ouro antes de liberar
  version: 'trisomy-wright2008NT + kagan2008biochem + marcadores2009-T13exato-v5',

  // ── TN: modelo de mistura (Wright 2008, Tabela 2) — EXATO ──────────────
  nt: {
    crlDependent: { b0: -0.8951, b1: 0.02940, b2: -0.0001812, sd: 0.07900 },
    normalIndep: { alpha0: -0.3319, alpha1: -0.03790, mu: 0.3019, sd: 0.1945 },
    affectedIndep: {
      t21: { p: 0.9406, mu: 0.5330, sd: 0.2093 },
      t18: { p: 0.7096, mu: 0.7439, sd: 0.1658 },
      t13: { p: 0.8376, mu: 0.6018, sd: 0.2032 },
    },
  },

  // ── Bioquímica: bivariada log10(MoM) (Kagan 2008) ─────────────────────
  biochem: {
    // Não-afetada (Tabela 3) — EXATO.
    unaffected: { sdBhcg: 0.2544, sdPappa: 0.2203, rho: 0.2143 },
    affected: {
      // T21 — EXATO (Tabela 3 + regressões; médias por (gest_dias − 77)).
      t21: {
        bhcgMeanIntercept: 0.2468, bhcgMeanSlope: 0.004267,
        pappaMeanIntercept: -0.4668, pappaMeanSlope: 0.01642,
        sdBhcg: 0.2699, sdPappa: 0.2359, rho: 0.0821,
      },
      // T18 — EXATO (Kagan uog.6123, Tabela 2; sem dependência de IG).
      t18: {
        bhcgMeanIntercept: -0.6668, bhcgMeanSlope: 0,
        pappaMeanIntercept: -0.7149, pappaMeanSlope: 0,
        sdBhcg: 0.3723, sdPappa: 0.3307, rho: 0.3860,
      },
      // T13 — EXATO (Kagan Hum Reprod 2008; 23:1968, Tabela III; sem slope IG).
      t13: {
        bhcgMeanIntercept: -0.3128, bhcgMeanSlope: 0,
        pappaMeanIntercept: -0.5248, pappaMeanSlope: 0,
        sdBhcg: 0.2416, sdPappa: 0.2362, rho: 0.2393,
      },
    },
  },

  // ── Marcadores — LRs derivadas das PREVALÊNCIAS publicadas (crus, não
  //    ajustadas por correlação com a TN — o FMF usa LRs ajustadas, um pouco
  //    menores; refinar com casos-ouro). "Alterado" = ausente/reverso/presente.
  //    LR alterado = prev_afetada/prev_euploide; LR normal = (1−p_af)/(1−p_eu).
  markers: {
    // Osso nasal AUSENTE — Kagan 2009 (UOG uog.6318): eu 2,6% / T21 59,8% / T18 52,8% / T13 45,0%
    nasalBone: {
      abnormal: { t21: 23.0, t18: 20.31, t13: 17.31 },
      normal: { t21: 0.413, t18: 0.485, t13: 0.565 },
    },
    // Ducto venoso onda-a REVERSA — Maiz 2009 (UOG uog.6330): eu 3,2% / T21 66,4% / T18 58,3% / T13 55,0%
    ductusVenosus: {
      abnormal: { t21: 20.75, t18: 18.22, t13: 17.19 },
      normal: { t21: 0.347, t18: 0.431, t13: 0.465 },
    },
    // Regurgitação tricúspide PRESENTE — Kagan 2009 (UOG 33:18-22): eu 0,9% / T21 55,7% / T18 33,3% / T13 30,0%
    tricuspid: {
      abnormal: { t21: 61.9, t18: 37.0, t13: 33.33 },
      normal: { t21: 0.447, t18: 0.673, t13: 0.706 },
    },
  },
};
