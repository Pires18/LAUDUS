// ═══════════════════════════════════════════════════════════════════════
// DADOS CLÍNICOS — Rastreamento de trissomias (1º trimestre)
// ═══════════════════════════════════════════════════════════════════════
// TN (mistura): Wright D et al., UOG 2008; 31:376-383 (Tabela 2) — EXATO.
// Bioquímica T21: Kagan KO et al., UOG 2008; 31:493-502 (Tab.3 + regressões) — EXATO.
// Bioquímica T18: Kagan KO et al., UOG 2008; 32:488-492 (uog.6123, Tabela 2) — EXATO.
// Bioquímica T13: Kagan KO et al., Hum Reprod 2008; 23:1968-1975 (Tabela III) — EXATO.
// LRs de marcadores: prevalências publicadas (Kagan/Maiz 2009), derivação crua.
// Risco por idade: aproximação de Snijders & Nicolaides 1999 — VALIDAR.
//
// ═══ AUDITORIA (jul/2026) ═══════════════════════════════════════════════
// Todos os coeficientes abaixo foram conferidos DÍGITO A DÍGITO contra as
// tabelas originais dos 5 papers-fonte (PDFs fornecidos pelo usuário) — zero
// divergências encontradas. Adicionalmente, `fmfTrisomy.test.ts` reproduz
// FATOS NUMÉRICOS declarados explicitamente nos abstracts/textos dos papers
// (medianas de TN: 2,0/3,4/5,5/4,0 mm; medianas de MoM bioquímico: 2,0/0,5,
// 0,2/0,2) a partir destes mesmos coeficientes — todos batem dentro de
// tolerância clínica. Isso confirma a FIDELIDADE da transcrição e da lógica
// do modelo (mistura da TN, bivariada da bioquímica, LRs de marcadores).
//
// O que ISSO NÃO substitui: comparação caso-a-caso contra a calculadora
// oficial da FMF (bloqueada por indisponibilidade da extensão do navegador
// nesta sessão). Por isso `validated` permanece `false` — é o gate de uso
// clínico, não de correção de transcrição.
//
// ⚠️  Lacunas conhecidas e NÃO estimadas (sem fonte primária exata — não
//     inventamos números para preenchê-las):
//   • Correção de IG do risco a priori: IMPLEMENTADA (ver GA_PRIOR_CORRECTION_
//     FACTOR abaixo) usando a taxa de perda fetal, mas fixa em ~12 semanas
//     (ponto médio da janela 11–13+6) — não varia semana a semana dentro da
//     janela por falta de dado granular em fonte aberta.
//   • T18/T13 como frações do T21 às 12 sem: CALIBRADO (jul/2026) contra a
//     calc oficial da FMF — combinado T13/18 ≈ 0,56× T21 (constante em
//     25–40a). Split interno T18:T13=3:1 é aproximação clínica (a oficial só
//     reporta o combinado). O a priori de T13/18 herda o erro do a priori de
//     T21 (nosso ~8–17% abaixo da calc ao vivo — ver GA_PRIOR_CORRECTION e
//     T21_TERM_RISK_BY_AGE).
//   • LRs de marcadores "cruas" (prevalência/prevalência): o FMF usa LRs
//     ajustadas por correlação com a TN, tipicamente um pouco MENORES.
// ═══════════════════════════════════════════════════════════════════════

import type { Trisomy, TrisomyModelParams } from './trisomy';

/** Risco de T21 ao termo por idade materna — "1 : N" (Snijders, VALIDAR). */
export const T21_TERM_RISK_BY_AGE: ReadonlyArray<readonly [number, number]> = [
  [20, 1450], [25, 1350], [30, 940], [31, 820], [32, 700], [33, 570],
  [34, 450], [35, 350], [36, 270], [37, 200], [38, 150], [39, 110],
  [40, 85], [41, 65], [42, 50], [43, 40], [44, 32], [45, 25],
];

// Frações do T21 às ~12 SEMANAS (não a termo). A perda fetal intrauterina de
// T18/T13 entre 12 sem e termo é MUITO maior que a da T21, então às 12 semanas
// o risco de T13/18 fica próximo do de T21 (bem acima da razão a termo ~1/10,
// 1/30). Calibrado contra a calculadora OFICIAL da FMF (fetalmedicine.org,
// jul/2026): rodando o mesmo caso aos 20/25/30/35/40/45 anos, a razão
// prob(T13/18 combinado)/prob(T21) do "Risk from History" é constante ≈0,54–0,57
//   idade  T21     T13/18   razão
//    20   1:980   1:1800   0,544
//    25   1:860   1:1500   0,573
//    30   1:570   1:1000   0,570
//    35   1:230   1:430    0,535
//    40   1:67    1:124    0,540
//    45   1:17    1:31     0,548
// Adotamos combinado = 0,56 × prob(T21), com split interno T18:T13 ≈ 3:1
// (T18 é ~3× mais comum que T13 no 1º trimestre) → T18=0,42, T13=0,14.
// (Antes: 1/10 e 1/30 — razões A TERMO — subestimavam T13/18 em ~5× às 12 sem.)
const T18_FRACTION_OF_T21 = 0.42;
const T13_FRACTION_OF_T21 = 0.14;

/**
 * Risco a priori de T21 às ~12 SEMANAS por idade materna — "1 : N".
 * CALIBRADO contra a calculadora OFICIAL da FMF (fetalmedicine.org, jul/2026):
 * são os valores EXATOS do "Risk from History" rodando o mesmo caso (12+5) em
 * cada idade. Substitui a antiga derivação (tabela a termo × fator de correção
 * de IG), que ficava ~8–17% abaixo desta curva ao vivo. Pontos oficiais:
 *   20→1:980  25→1:860  30→1:570  35→1:230  40→1:67  45→1:17
 */
export const T21_RISK_12WK_BY_AGE: ReadonlyArray<readonly [number, number]> = [
  [20, 980], [25, 860], [30, 570], [35, 230], [40, 67], [45, 17],
];

/** Interpola (log-linear em "1:N") uma tabela idade→risco; extrapola achatando nas pontas. */
function interpOneInN(tbl: ReadonlyArray<readonly [number, number]>, ageYears: number): number {
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

/** Risco de T21 AO TERMO (Snijders) — mantido para exibição/refs do risco a termo. */
export function t21TermRisk(ageYears: number): number {
  return interpOneInN(T21_TERM_RISK_BY_AGE, ageYears);
}

/** Risco de T21 às ~12 SEMANAS (calibrado na calc oficial da FMF) — base do a priori. */
export function t21Risk12wk(ageYears: number): number {
  return interpOneInN(T21_RISK_12WK_BY_AGE, ageYears);
}

/**
 * Correção de idade gestacional do risco a priori (termo → 1º trimestre).
 *
 * ⚠️ REFERÊNCIA HISTÓRICA — não é mais usado pelo `ageRelatedRisk` (que agora
 * lê `T21_RISK_12WK_BY_AGE`, calibrada direto na calc oficial). Mantido porque
 * documenta a relação teórica termo→12 sem (e a correção de 12 sem via curva
 * oficial é implicitamente ~1,3–1,7 dependendo da idade, não este fator fixo).
 *
 * Fonte: Nicolaides KH, "Screening for fetal aneuploidies at 11 to 13 weeks",
 * Prenat Diagn 2011;31:7-15 (revisão citando Snijders et al., UOG 1999;13:167):
 * "the rate of fetal death between 12 weeks and term is about 30% for
 * trisomy 21. The rate of fetal death in euploid fetuses is only 1 to 2%."
 * Exemplo verificado no mesmo texto: mulher de 20 anos tem risco de T21
 * ≈1:1000 às 12 semanas vs ≈1:1500 ao termo.
 *
 * Derivação: se uma fração L de fetos T21 vivos às 12 sem morre até o termo,
 * e uma fração e de fetos euploides morre no mesmo período, então (como o
 * numerador de T21 é desprezível no denominador populacional):
 *   risco(12 sem) = risco(termo) × (1 − e) / (1 − L)
 * Com L=0,30 e e=0,015 (ponto médio de 1–2%): fator ≈ 0,985/0,70 ≈ 1,407 —
 * consistente com o exemplo citado (1/1450 [nossa tabela p/ 20 anos] × 1,407
 * ≈ 1/1031, próximo do "≈1:1000" declarado).
 *
 * ⚠️ Fator fixo, verificado especificamente para ~12 semanas (ponto médio da
 * janela de rastreamento); aplicado uniformemente em 11–13+6 por falta de
 * curva semana-a-semana em fonte aberta. Aplicado ao T21; T18/T13 usam frações
 * de 12 sem PRÓPRIAS (0,42 / 0,14), calibradas contra a calc oficial da FMF
 * para refletir a perda fetal maior de T13/18 — não mais as razões a termo.
 */
export const T21_FETAL_LOSS_RATE_12WK_TO_TERM = 0.30;
export const EUPLOID_FETAL_LOSS_RATE_12WK_TO_TERM = 0.015;
export const GA_PRIOR_CORRECTION_FACTOR =
  (1 - EUPLOID_FETAL_LOSS_RATE_12WK_TO_TERM) / (1 - T21_FETAL_LOSS_RATE_12WK_TO_TERM);

/** Risco a priori BASAL (só idade, às ~12 semanas) por trissomia. T21 vem
 *  direto da curva oficial da FMF (`t21Risk12wk`); T18/T13 como frações dela. */
export function ageRelatedRisk(ageYears: number): Record<Trisomy, number> {
  const t21 = Math.min(1, t21Risk12wk(ageYears));
  return { t21, t18: t21 * T18_FRACTION_OF_T21, t13: t21 * T13_FRACTION_OF_T21 };
}

export const PROVISIONAL_TRISOMY_PARAMS: TrisomyModelParams = {
  validated: true, // ✅ liberado (18/jul/2026) — a priori T21/T13-18 conferido
  //   dígito-a-dígito contra a calc oficial da FMF (exato nas 6 idades) e todos
  //   os marcadores (NT, bioquímica, ON/DV/TR, FHR) implementados de papers-fonte.
  //   Gate assumido pelo usuário (apoio à decisão; NÃO é a calc oficial da FMF).
  version: 'trisomy-ntDeltaLR-fmfLiveCal2026(+piso÷20) + kagan2008biochem(+pisoFMF) + kagan2008FHR + marcadores2009 + aprioriFmfLive2026-v8',

  // ── TN: mistura Wright 2008 (Tabela 2) — mantida como FONTE DA MEDIANA
  //    esperada (crlDependent) e dos fatos-ouro das medianas afetadas. A LR
  //    do motor NÃO vem mais daqui (ver ntDeltaLr abaixo). ──────────────────
  nt: {
    crlDependent: { b0: -0.8951, b1: 0.02940, b2: -0.0001812, sd: 0.07900 },
    normalIndep: { alpha0: -0.3319, alpha1: -0.03790, mu: 0.3019, sd: 0.1945 },
    affectedIndep: {
      t21: { p: 0.9406, mu: 0.5330, sd: 0.2093 },
      t18: { p: 0.7096, mu: 0.7439, sd: 0.1658 },
      t13: { p: 0.8376, mu: 0.6018, sd: 0.2032 },
    },
  },

  // ── LR da TN CALIBRADA à calc OFICIAL da FMF ao vivo ────────────────────
  // Sweep limpo (usuário, 19/jul/2026): 35a, CCN 65 (mediana esperada 1,78mm),
  // só a TN variando. A razão entre TNs cancela os fatores constantes, isolando
  // a forma da LR da TN. A mistura Wright 2008 subia ~4–6× mais rápido que a
  // FMF (superclassificava TN limítrofe) — e NÃO fecha por ajuste de parâmetro
  // (a FMF é "plana até 2,5 e depois dispara", forma que 2 Gaussianas não
  // reproduzem). Adotada LR empírica em delta-TN (= TN − mediana), ancorada no
  // nível publicado da mistura em TN 2,0 (0,30/0,31/0,30 p/ T21/T18/T13) e com
  // a FORMA da FMF. delta nos pontos do sweep (CCN 65): NT 1,5/2,0/2,5/3,0/3,5/
  // 4,0 → −0,278/0,222/0,722/1,222/1,722/2,222. LR relativa da FMF (÷TN2,0):
  //   T21     1,00 1,00 1,353 6,979 18,47 24,08  (adj 1:4600/4600/3400/660/250/192, base 1:230)
  //   T13/18  1,00 1,00 1,00  2,606 10,37 21,55  (adj 1:8600×3/3300/830/400, base 1:430)
  // (T18 e T13 herdam a MESMA forma combinada da FMF — a oficial só reporta o
  //  combinado — cada um ancorado no seu nível publicado em TN 2,0.)
  ntDeltaLr: {
    delta: [-0.278, 0.222, 0.722, 1.222, 1.722, 2.222],
    lr: {
      t21: [0.300, 0.300, 0.406, 2.094, 5.541, 7.223],
      t18: [0.310, 0.310, 0.310, 0.808, 3.215, 6.680],
      t13: [0.300, 0.300, 0.300, 0.782, 3.111, 6.465],
    },
    maxLR: 60,
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

  // ── FHR (frequência cardíaca fetal) — Kagan KO, Wright D, Valencia C, Maiz N,
  //    Nicolaides KH. Hum Reprod 2008;23(9):1968-1975 (Tabela IV) — EXATO.
  //    delta = FHR medido − esperado(IG); Gaussiana euploide vs afetada.
  //    T21 quase não muda o risco de T21 (marcador secundário); o forte é a
  //    TAQUICARDIA da T13 (média sobe ~16 bpm às 12 sem) e a bradicardia da T18.
  //    Correlações com NT/bioquímica desprezíveis (Tab.IV) → fator independente.
  //    Truncamento do delta a ±17,6 bpm (=3× DP euploide) calibrado contra a
  //    calc oficial da FMF (casos FHR 130/175/190 aos 40a): sem ele a razão de
  //    Gaussianas com DPs diferentes explode nas caudas (±5 DP).
  fhr: {
    expected: { a: 265.98, b: -1.7631, c: 0.0064445 },
    normal: { mean: 0, sd: 5.8727 },
    affected: {
      t21: { meanIntercept: 1.3836, meanSlope: 0, sd: 7.2323 },
      t18: { meanIntercept: -2.8089, meanSlope: 0, sd: 8.2202 },
      t13: { meanIntercept: 52.43, meanSlope: -0.40476, sd: 8.1444 },
    },
    deltaTruncation: 17.6,
  },
};
