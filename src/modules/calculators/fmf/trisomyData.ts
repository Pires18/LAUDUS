// ═══════════════════════════════════════════════════════════════════════
// DADOS CLÍNICOS — Rastreamento de trissomias (1º trimestre)
// ═══════════════════════════════════════════════════════════════════════
// ⚠️  PROVISÓRIO — VALIDAR ANTES DE PRODUÇÃO.
// Os valores abaixo dão ESTRUTURA ao motor e permitem testes, mas os
// coeficientes clínicos precisam ser confirmados contra a literatura antes
// de a calculadora ser registrada/habilitada:
//   • Tabela de risco por idade: Snijders & Nicolaides, Lancet 1998/1999.
//   • Distribuições de log10(MoM) afetada×não-afetada e LRs de marcadores:
//     Kagan KO et al., UOG 2008; Nicolaides KH, Prenat Diagn 2011.
//   • Medianas de β-hCG/PAPP-A: ESPECÍFICAS do analisador (Roche Cobas) —
//     obter do fabricante/laboratório (arquivo `fmfMedians.ts`, a criar).
// ═══════════════════════════════════════════════════════════════════════

import type { Trisomy, TrisomyModelParams } from './trisomy';

/**
 * Risco de T21 ao nascimento (livebirth) por idade materna — "1 : N".
 * Aproximação da tabela clássica de Snijders/Nicolaides. VALIDAR.
 */
export const T21_TERM_RISK_BY_AGE: ReadonlyArray<readonly [number, number]> = [
  [20, 1450], [25, 1350], [30, 940], [31, 820], [32, 700], [33, 570],
  [34, 450], [35, 350], [36, 270], [37, 200], [38, 150], [39, 110],
  [40, 85], [41, 65], [42, 50], [43, 40], [44, 32], [45, 25],
];

/**
 * Frações aproximadas de T18 e T13 em relação a T21 (ao termo). VALIDAR.
 * (T18 ≈ T21/10 ; T13 ≈ T21/30 — ordens de grandeza da literatura.)
 */
const T18_FRACTION_OF_T21 = 1 / 10;
const T13_FRACTION_OF_T21 = 1 / 30;

/** Interpola o risco de T21 ao termo (probabilidade) para a idade informada. */
export function t21TermRisk(ageYears: number): number {
  const tbl = T21_TERM_RISK_BY_AGE;
  const clamp = (n: number) => 1 / n;
  if (ageYears <= tbl[0][0]) return clamp(tbl[0][1]);
  if (ageYears >= tbl[tbl.length - 1][0]) return clamp(tbl[tbl.length - 1][1]);

  for (let i = 0; i < tbl.length - 1; i++) {
    const [a0, n0] = tbl[i];
    const [a1, n1] = tbl[i + 1];
    if (ageYears >= a0 && ageYears <= a1) {
      // Interpolação log-linear no risco (probabilidade).
      const p0 = Math.log(1 / n0);
      const p1 = Math.log(1 / n1);
      const frac = (ageYears - a0) / (a1 - a0);
      return Math.exp(p0 + frac * (p1 - p0));
    }
  }
  return clamp(tbl[tbl.length - 1][1]);
}

/**
 * Risco a priori por trissomia (probabilidade), a partir da idade materna.
 *
 * NOTA: retorna risco AO TERMO. A correção para a idade gestacional do 1º
 * trimestre (risco maior por perdas fetais espontâneas até o termo) é uma
 * etapa de VALIDAÇÃO — deve ser adicionada com os fatores de Snijders 1999.
 */
export function ageRelatedRisk(ageYears: number): Record<Trisomy, number> {
  const t21 = t21TermRisk(ageYears);
  return {
    t21,
    t18: t21 * T18_FRACTION_OF_T21,
    t13: t21 * T13_FRACTION_OF_T21,
  };
}

/**
 * Parâmetros PROVISÓRIOS do modelo — `validated: false` impede uso clínico.
 * Substituir cada bloco pelos valores publicados na fase de validação.
 */
export const PROVISIONAL_TRISOMY_PARAMS: TrisomyModelParams = {
  validated: false, // 🚫 não registrar a calculadora enquanto for false
  version: 'trisomy-cobas-provisorio-v0',

  // log10(MoM) da TN — média ~0 (não-afetada), deslocada para cima nas
  // afetadas. VALORES PROVISÓRIOS (VALIDAR: Kagan 2008 / mixture model).
  nt: {
    unaffected: { mean: 0.0, sd: 0.12 },
    affected: {
      t21: { mean: 0.10, sd: 0.16 },
      t18: { mean: 0.14, sd: 0.18 },
      t13: { mean: 0.14, sd: 0.18 },
    },
  },

  // log10(MoM) de (β-hCG livre, PAPP-A). PROVISÓRIO (VALIDAR: Kagan 2008).
  biochem: {
    unaffected: {
      // SDs de log10 MoM (não-afetada), corrigidas por peso — fontes abertas:
      // β-hCG 0.2605, PAPP-A 0.2336. Média = 0 por definição. ρ ainda provisório.
      bhcg: { mean: 0.0, sd: 0.2605 },
      pappa: { mean: 0.0, sd: 0.2336 },
      rho: 0.20,
    },
    affected: {
      // T21: mediana β-hCG 2.0 MoM → log10 = 0.301 ; PAPP-A 0.5 MoM → −0.301
      //      (medianas de Kagan 2008, UOG). SD/ρ ainda PROVISÓRIOS (VALIDAR).
      t21: { bhcg: { mean: 0.301, sd: 0.28 }, pappa: { mean: -0.301, sd: 0.30 }, rho: 0.24 },
      // T18/T13: ambos ↓ (medianas/SD PROVISÓRIOS — VALIDAR).
      t18: { bhcg: { mean: -0.52, sd: 0.34 }, pappa: { mean: -0.60, sd: 0.36 }, rho: 0.30 },
      t13: { bhcg: { mean: -0.40, sd: 0.34 }, pappa: { mean: -0.60, sd: 0.36 }, rho: 0.30 },
    },
  },

  // LRs discretas dos marcadores ecográficos. PROVISÓRIO (VALIDAR).
  // Faixas de referência (aberto): osso nasal presente ~1/3, ausente ~27–140
  // conforme a fonte (Cicero 2001 vs revisões); combinados PLR 10–15,
  // NLR 0.5–0.8 (Karger, Fetal Diagn Ther 2013). As LRs "ajustadas" do
  // modelo FMF são MENORES por correlação com a TN — usar as ajustadas.
  markers: {
    nasalBone: {
      abnormal: { t21: 27.0, t18: 20.0, t13: 8.0 }, // ausente
      normal: { t21: 0.41, t18: 0.5, t13: 0.7 },    // presente
    },
    ductusVenosus: {
      abnormal: { t21: 5.0, t18: 5.0, t13: 5.0 },   // onda "a" reversa
      normal: { t21: 0.6, t18: 0.6, t13: 0.6 },
    },
    tricuspid: {
      abnormal: { t21: 8.0, t18: 9.0, t13: 6.0 },   // regurgitação presente
      normal: { t21: 0.6, t18: 0.6, t13: 0.6 },
    },
  },
};
