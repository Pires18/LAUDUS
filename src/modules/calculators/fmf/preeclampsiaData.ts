// ═══════════════════════════════════════════════════════════════════════
// DADOS CLÍNICOS — Rastreamento de pré-eclâmpsia (1º trimestre)
// ═══════════════════════════════════════════════════════════════════════
// Fatores maternos: Wright D et al., AJOG 2015;213:62.e1-10 (Tabela 2) — EXATO.
//   Referência: branca, nulípara, espontânea, 69 kg, 164 cm.
// Biomarcadores (Bayes): O'Gorman N et al., AJOG 2016;214:103.e1-e12
//   (Tabelas 2 e 3) — EXATO. Médias do log10 MoM vs IG do parto + covariância.
// Artéria oftálmica (PSV ratio): Gana N et al., UOG 2022;59:731-736
//   (doi 10.1002/uog.24914), Tabela 3 — EXATO. Intercepto/slope/SD do delta
//   de PSV ratio vs IG do parto + correlações com log10(MoM) dos demais
//   marcadores. A equação para o valor ESPERADO do PSV ratio bruto (usada
//   para computar o delta = medido − esperado) está na Tabela 2 do mesmo
//   paper e vive em `medians.ts` (`psvRatioExpected`).
//
// ═══ AUDITORIA (jul/2026) ═══════════════════════════════════════════════
// Todos os coeficientes abaixo (fatores maternos + modelo de biomarcadores)
// foram conferidos DÍGITO A DÍGITO contra as Tabelas 2 do Wright 2015 e as
// Tabelas 2/3 do O'Gorman 2016 — zero divergências. A lógica de truncamento
// da média em 0 (O'Gorman: "the mean was taken as zero" além do ponto onde
// cruzaria zero) e o uso de covariância COMUM entre PE/não-PE (O'Gorman:
// "a common covariance matrix was assumed") foram verificados linha a linha
// contra a descrição textual do método — implementados corretamente.
//
// O que ISSO NÃO substitui: comparação caso-a-caso contra a calculadora
// oficial da FMF (bloqueada por indisponibilidade da extensão do navegador
// nesta sessão). Por isso `validated` permanece `false`.
//
// ⚠️  Lacunas conhecidas e NÃO estimadas (sem fonte primária exata):
//   • Sub-modelo "parosa sem PE prévia" (polinômio fracionário de intervalo
//     entre gestações — Wright 2015). Hoje tratada como referência (0),
//     quando o modelo real daria um efeito PROTETOR (μ maior) — nosso risco
//     tende a ser um pouco CONSERVADOR (superestimado) para esse subgrupo.
//   • Conduta AAS 150 mg: ASPRE — Rolnik DL et al., NEJM 2017 (cutoff 1:100
//     já aplicado; texto de recomendação não conferido linha a linha).
// ═══════════════════════════════════════════════════════════════════════

import type { PeCoefficients, PeBiomarkerModel } from './preeclampsia';

export const PROVISIONAL_PE_COEFFICIENTS: PeCoefficients = {
  validated: false, // 🚫 conferir com casos-ouro antes de liberar
  version: 'pe-wright2015-maternal + ogorman2016-biomarkers-v2',

  intercept: 54.36,  // Wright 2015
  sigma: 6.8833,     // Wright 2015 (IC95% 6.67–7.10)

  agePerYearOver35: -0.207,
  heightPerCmOver164: 0.117,
  racial: { white: 0, afroCaribbean: -2.68, southAsian: -1.13, eastAsian: 0, mixed: 0 },
  conception: { spontaneous: 0, ovulationInduction: 0, ivf: -1.63 },
  chronicHypertension: -7.29,
  sleOrAps: -3.05,
  parousPrevPE: -8.17,
  parousPrevPeGaQuadCoef: 0.027,
  weightPerKgOver69_noHtn: -0.069,
  diabetes_noHtn: -3.39,
  familyHistoryPE_noHtn: -1.72,
};

/**
 * Modelo de biomarcadores (O'Gorman 2016, AJOG 214:103) — EXATO.
 * reg: média do log10(MoM) = intercepto + inclinação × (IG do parto, semanas).
 * sd/corr: pooled (Tabela 3).
 */
export const PE_BIOMARKER_MODEL: PeBiomarkerModel = {
  reg: {
    utaPi: { intercept: 0.54453, slope: -0.013143 },
    map: { intercept: 0.095640, slope: -0.0018240 },
    pappa: { intercept: -0.62165, slope: 0.014692 },
    plgf: { intercept: -0.93687, slope: 0.021930 },
    // Gana 2022, Tabela 3 — "Intercept e slope definem a média de PE para
    // IG de parto <41+3 semanas" (delta bruto do PSV ratio, não log10 MoM).
    psvRatio: { intercept: 0.446837, slope: -0.01079 },
  },
  sd: {
    utaPi: 0.12894,
    map: 0.03724,
    plgf: 0.17723,
    pappa: 0.23539,
    psvRatio: 0.09541, // Gana 2022, Tabela 3
  },
  corr: {
    utaPi_map: -0.05133,
    utaPi_pappa: -0.15992,
    utaPi_plgf: -0.15084,
    map_pappa: -0.00497,
    map_plgf: -0.02791,
    pappa_plgf: 0.31983,
    // Gana 2022, Tabela 3 — correlações entre o delta do PSV ratio e o
    // log10(MoM) dos demais marcadores.
    psvRatio_map: 0.14969,
    psvRatio_utaPi: -0.00997,
    psvRatio_plgf: -0.1285,
    psvRatio_pappa: -0.03545,
  },
};
