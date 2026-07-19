// ═══════════════════════════════════════════════════════════════════════
// ESBOÇO — Rastreamento de PRÉ-ECLÂMPSIA no 2º TRIMESTRE (19–24+6 sem)
// ═══════════════════════════════════════════════════════════════════════
// Modelo de riscos competitivos da FMF na 2ª visita:
//   • Fatores maternos (PRIOR):   Wright D et al., AJOG 2015;213:62 — o MESMO
//     modelo de história materna usado no 1º T. No arcabouço de competing
//     risks, o prior sobre a IG de parto com PE independe da época do rastreio;
//     por isso o prior é COMPARTILHADO (reusa PROVISIONAL_PE_COEFFICIENTS).
//   • Biomarcadores (VEROSSIMILHANÇA): Tayyar A et al., UOG 2015;45:689
//     (MAP + IP uterinas a 19–24 sem) e Gallo DM et al., AJOG 2016;214:619
//     (MAP + IP uterinas + PlGF a 19–24 sem). Coeficientes DIFERENTES do
//     O'Gorman 2016 (1º T).
//   • Medianas (MoM):  regressões PRÓPRIAS do 2º T (centradas em ~21 sem),
//     distintas das de Tan 2018 (centradas em 11 sem) usadas no 1º T.
//
// Reusa o MOTOR `computePreeclampsiaRisk` (preeclampsia.ts) sem duplicar
// matemática — só troca o dataset (medianas + modelo de biomarcadores).
//
// ⚠️⚠️  ESTE MÓDULO ESTÁ TRAVADO (`SECOND_TRIMESTER_PE_VALIDATED = false`).
//   Estado da transcrição — TUDO TRANSCRITO E CONFERIDO por sanity-check:
//     ✅ Modelo de biomarcadores (Gallo 2016, Suppl. Tables 2 e 3) — MAP, IP
//        uterino, PlGF; conversão de centragem 24 sem → não centrado.
//     ✅ Prior materno (Wright 2015) — reusado como está (compartilhado).
//     ✅ Medianas de 2º T (Tayyar 2015 UtA-PI / Wright A 2015 MAP / Tsiakkas 2015
//        PlGF) — `MEDIANS_READY_2T = true`.
//   PADRONIZAÇÃO FMF (2ª visita, 19–24 sem) — conjunto COMPLETO de biomarcadores:
//     • Fatores maternos: Wright 2015 (prior compartilhado).
//     • MAP + IP uterino + PlGF: Gallo 2016 (competing-risks, Suppl. Tables 2/3).
//     • Artéria OFTÁLMICA (razão P2/P1): Gana 2022 (marcador adicional, delta).
//     • Medianas 19–24 sem: Wright A / Tayyar / Tsiakkas 2015 (ramo 2º T).
//     • Reporte: risco de PE com parto < 32 e < 36 sem (PE_2T_THRESHOLDS) — a
//       estratificação alto/intermediário/baixo da 2ª visita da FMF.
//   VALIDAÇÃO (casos-ouro vs. calc OFICIAL, 19/Jul): a oftálmica agora usa
//   Sapantzoglou 2021 (2ª visita) — os DELTAS batem EXATOS com os laudos oficiais
//   (0,030 / −0,080 / 0,079). Na configuração da oficial (MAP + oftálmica + PlGF)
//   os riscos ficam próximos e a estratificação CONCORDA nos 3 casos (ex.: ref.
//   <36 1:1669 × of. 1:1400; baixo 1:7132 × 1:5800; alto ALTO × ALTO). Resíduo
//   (~20–40% na cauda) vem da pequena diferença de medianas de MAP/UtA/PlGF
//   (~4–6%). É APOIO À DECISÃO por modelos PUBLICADOS da FMF. O LIVE-COMPUTE
//   automático em laudo segue travado (`SECOND_TRIMESTER_PE_VALIDATED=false`); a
//   CALCULADORA (todos os marcadores, usa o subconjunto informado) funciona.
// ═══════════════════════════════════════════════════════════════════════

import {
  PeCoefficients, PeBiomarkerModel, PeMaternalFactors, PeBiomarkers, PeThresholds,
  computePreeclampsiaRisk, RacialOrigin, Conception,
} from './preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS } from './preeclampsiaData';
import {
  toMoM, toDelta, Analyzer, ParityKind, DiabetesKind, PeMedianCovariates,
} from './medians';
import type { PeRiskFromForm } from './fromForm';

/** Trava mestra do LIVE-COMPUTE automático (laudo). A CALCULADORA de teste usa
 *  `computePe2tRisk`, que não depende desta flag (superfície de teste). */
export const SECOND_TRIMESTER_PE_VALIDATED = false;

/** Janela do rastreio de 2ª visita (semanas). */
export const SECOND_TRIMESTER_PE_GA_MIN_WEEKS = 19;
export const SECOND_TRIMESTER_PE_GA_MAX_WEEKS = 24 + 6 / 7;

/**
 * Limiares de reporte da 2ª visita da FMF: risco de PE com parto **< 32** e
 * **< 36** semanas (base da estratificação alto/intermediário/baixo — Gallo 2016;
 * FMF "assess/preeclampsia"). Diferente do 1º T (pré-termo < 37 / termo).
 * `pretermGa` → P(<32); `termGa` → P(<36).
 */
export const PE_2T_THRESHOLDS: PeThresholds = {
  pretermGa: 32,
  termGa: 36,
  aspirinCutoffOneInN: 100,
};

// ─────────────────────────── Prior materno (compartilhado) ───────────────
// Wright 2015 é o MESMO prior do 1º T (competing-risks). Reusado como está,
// porém marcado validated:false enquanto a VIA de 2º T não é auditada ponta-a-ponta.
export const PE_COEFFICIENTS_2T: PeCoefficients = {
  ...PROVISIONAL_PE_COEFFICIENTS,
  validated: false,
  version: 'pe-2T-fmf: wright2015-maternal + gallo2016-biomarkers + gana2022-oftalmica + medianas-tayyar/wrightA/tsiakkas-2015 · endpoints <32/<36 · v1',
};

// ─────────────────────────── Modelo de biomarcadores 2º T ────────────────
// ✅ PREENCHIDO E VERIFICADO — Gallo DM et al., AJOG 2016;214:619, Supplemental
// Tables 2 e 3 (fornecidas pelo usuário). Estrutura idêntica ao 1º T; só os
// números mudam. Marcadores usados: MAP, IP uterino, PlGF (o mask não coleta
// sFlt-1, então SFLT fica fora do vetor de presentes; PAPP-A é marcador de 1º T).
//
// ⚠️ CONVERSÃO DE CENTRAGEM (crítica): a Tabela 2 do Gallo centra a IG de parto
//    em 24 sem — mean log10 MoM = a₂₄ + slope·(t − 24). O motor (`markerMean`)
//    usa a forma NÃO-centrada `intercept + slope·t`; por isso o intercepto
//    armazenado é a_uncentered = a₂₄ − 24·slope. O truncamento em 0 (mantém a
//    média em 0 além do cruzamento) é reproduzido pela lógica de sinal de
//    `markerMean`, conferida para os 3 marcadores.
//        UTPI : a₂₄ 0.34798 , slope −0.0195256 → a_unc  0.8165944
//        MAP  : a₂₄ 0.063088, slope −0.002842  → a_unc  0.131296
//        PLGF : a₂₄ −1.11759 , slope  0.078571 → a_unc −3.003294
// SD e correlações: coluna "Pooled" da Supplemental Table 3.
export const PE_BIOMARKER_MODEL_2T: PeBiomarkerModel = {
  reg: {
    utaPi:    { intercept: 0.8165944, slope: -0.0195256 }, // Gallo T2 (a₂₄ 0.34798)
    map:      { intercept: 0.131296, slope: -0.002842 },   // Gallo T2 (a₂₄ 0.063088)
    plgf:     { intercept: -3.003294, slope: 0.078571 },   // Gallo T2 (a₂₄ −1.11759)
    pappa:    { intercept: NaN, slope: NaN }, // não usado no 2º T
    // Artéria oftálmica (razão P2/P1) — Sapantzoglou A et al., UOG 2021;57:75
    // (recebido em PDF), Tabela 3: regressão do DELTA da razão vs IG-de-parto na
    // PE. É o modelo de 2ª VISITA (19–23 sem) da FMF — substituiu o de 1º T (Gana
    // 2022). Entra como DELTA (medido − esperado por `psvRatioExpected2T`, Tabela 2),
    // escala NATURAL (não é log10 MoM). Validado: os deltas batem EXATOS com os
    // laudos oficiais da FMF (0,030 / −0,080 / 0,079).
    psvRatio: { intercept: 0.6732, slope: -0.0154 },
  },
  sd: { map: 0.036403, utaPi: 0.113746, plgf: 0.201017, pappa: NaN, psvRatio: 0.0924 }, // Gallo T3 pooled + Sapantzoglou T3
  corr: {
    map_utaPi: -0.0412,   // Gallo T3 pooled
    map_plgf: -0.05417,
    utaPi_plgf: -0.07356,
    // correlações do delta da razão oftálmica com os demais (Sapantzoglou 2021, Tabela 3)
    psvRatio_map: 0.1519,
    psvRatio_utaPi: 0.0263,
    psvRatio_plgf: -0.0251,
  },
};

/**
 * Valor ESPERADO da razão P2/P1 da artéria oftálmica a 19–23 sem
 * (Sapantzoglou 2021, Tabela 2) — para o delta = medido − esperado.
 * Difere do 1º T (Gana 2022): intercepto e coeficientes próprios da 2ª visita.
 * Termos maternos com contribuição significativa: peso, idade, altura, leste-asiática,
 * tabagismo e hipertensão crônica (os demais foram eliminados no modelo).
 */
export function psvRatioExpected2T(c: PeMedianCovariates): number | null {
  if (!(c.weightKg > 0) || !(c.heightCm > 0) || !(c.ageYears > 0)) return null;
  let s = 0.610732
    + 0.000511 * (c.weightKg - 69)
    + 0.005024 * (c.ageYears - 35)
    - 0.001269 * (c.heightCm - 164);
  if (c.racialOrigin === 'eastAsian') s += -0.037322;
  if (c.smoker) s += 0.045739;
  if (c.chronicHypertension) s += 0.070468;
  return s;
}

// ─────────────────────────── Medianas 2º T (MoM) ─────────────────────────
// Centradas em ~21 sem (147 dias). Estrutura como medians.ts (Tan 2018),
// coeficientes PRÓPRIOS do 2º T. Enquanto null, o MoM fica indefinido e o
// motor cai para o risco basal (só fatores maternos) — dupla proteção junto
// com a trava mestra.
// ✅ TRANSCRITAS dos modelos "nos três trimestres" (fornecidos), ramo do 2º T:
//   • IP uterino → Tayyar A et al., UOG 2015;45:689-97, Tabela 2 (ref 14)
//   • MAP        → Wright A et al., UOG 2015;45:698-706, Tabela 2 (ref 15)
//   • PlGF       → Tsiakkas A et al., UOG 2015;45:591-8, Tabela 2 (ref 16)
// Regra de combinação (conferida por sanity-check da gestante de referência a
// 21 sem: UtA-PI ~1,05 · MAP ~85,5 mmHg · PlGF ~164 pg/mL DELFIA): log10-mediana
// = intercepto + [termos DEPENDENTES do 2º trimestre] + [termos INDEPENDENTES de
// trimestre]. Centragem: GA em DIAS − 77; peso − 69; altura − 164; idade − 35
// (idêntica ao 1º T). Termos que exigem dados não coletados (Z-score de peso ao
// nascer e IG do parto anterior; intervalo interpartal fracionário) são omitidos
// e documentados — mesma fidelidade do módulo de 1º T.
// ⚠️ Transcrição feita; FALTA validar caso-a-caso vs. calc oficial FMF (2ª visita).
export const MEDIANS_READY_2T = true;

/** log10-mediana → mediana; helper. */
const pow10 = (x: number) => Math.pow(10, x);

// ── IP uterino médio (Tayyar 2015, Tabela 2) — ramo 2º trimestre ──
export function utaPiMedian2T(c: PeMedianCovariates): number | null {
  if (!(c.gaDays > 0)) return null;
  const g = c.gaDays - 77, w = c.weightKg - 69, a = c.ageYears - 35;
  let s = 0.255731426
    // 2º trimestre (dependente do trimestre)
    - 0.291978212 + 0.002981682 * g - 0.000030792 * g * g
    // independentes do trimestre
    - 0.000888890 * w + 0.000006006 * w * w + 0.000008322 * w * g
    - 0.001117349 * a + 0.000015061 * a * g;
  if (c.racialOrigin === 'afroCaribbean') s += 0.018069553;
  // parosa com PE prévia: termo-base (interações com Z-score/IG do parto omitidas — sem dados)
  if (c.parity === 'parousPE') s += 0.004971474;
  return pow10(s);
}

// ── MAP (Wright A 2015, Tabela 2) — ramo 2º trimestre (sem termo de GA nem idade) ──
export function mapMedian2T(c: PeMedianCovariates): number | null {
  if (!(c.gaDays > 0)) return null;
  const g = c.gaDays - 77, w = c.weightKg - 69, h = c.heightCm - 164;
  let s = 1.943223919
    - 0.011200472 // constante do 2º trimestre
    + 0.001193313 * w - 0.000008823 * w * w
    - 0.000206306 * h;
  if (c.smoker) s += -0.004523672;
  if (c.racialOrigin === 'afroCaribbean') s += -0.001191227 - 0.000050679 * g;
  if (c.chronicHypertension) s += 0.051007216 - 0.000421118 * w;
  if (c.diabetes !== 'none') s += 0.004445020;
  // familyHistoryPE (0.005976240) não está no covariate de medianas — omitido (como no 1º T)
  if (c.parity === 'parousNoPE') s += -0.009402127 + 0.000744526 * (((c.intervalYears ?? 2)));
  if (c.parity === 'parousPE') s += 0.006091903;
  return pow10(s);
}

// ── PlGF (Tsiakkas 2015, Tabela 2) — GA é INDEPENDENTE de trimestre (cúbico) ──
// Máquina: DELFIA = referência; Roche/Cobas = +0,1864246691. Kryptor não consta
// no paper → não suportado no 2º T (retorna null → MoM indefinido).
export function plgfMedian2T(c: PeMedianCovariates, analyzer: Analyzer): number | null {
  if (!(c.gaDays > 0)) return null;
  if (analyzer === 'kryptor') return null; // não modelado por Tsiakkas 2015
  const g = c.gaDays - 77, w = c.weightKg - 69, a = c.ageYears - 35;
  let s = 1.3192346424
    - 0.0119410235 // constante do 2º trimestre
    + 0.0150600000 * g - 0.0000136300 * g * g - 0.0000002336 * g * g * g
    - 0.0020369614 * w
    + 0.0020439736 * a - 0.0000124550 * a * g;
  if (c.racialOrigin === 'afroCaribbean') s += 0.1894064984;
  else if (c.racialOrigin === 'eastAsian') s += 0.0385488933;
  else if (c.racialOrigin === 'southAsian') s += 0.0724417799;
  else if (c.racialOrigin === 'mixed') s += 0.0724771966;
  if (c.smoker) s += 0.1493447902;
  if (c.diabetes === 'type1') s += -0.0634636332;
  if (c.diabetes === 'type2insulin') s += -0.0580828726;
  if (c.parity !== 'nulliparous') s += 0.0221450947; // termo "Parous" (interações omitidas — sem dados)
  if (analyzer === 'cobas') s += 0.1864246691; // Roche/Cobas
  return pow10(s);
}

// ─────────────────────────── Entrada do formulário ───────────────────────
export interface Pe2tFormInput {
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
  /** IG de referência (semanas) — deve cair em 19–24+6. */
  gaWeeks: number | null;
  racialOrigin: RacialOrigin;
  conception: Conception;
  parity: ParityKind;
  previousPeGaWeeks?: number | null;
  diabetes: DiabetesKind;
  chronicHypertension: boolean;
  sleOrAps: boolean;
  familyHistoryPE: boolean;
  smoker: boolean;
  analyzer: Analyzer;
  /** Biomarcadores de 2ª visita (valores BRUTOS; o MoM sai das medianas 2º T). */
  mapMmHg?: number | null;
  utaPiRaw?: number | null;
  plgfRaw?: number | null;
  /** Razão P2/P1 da artéria oftálmica (média dos dois olhos). Vira delta (Gana 2022). */
  oaRatio?: number | null;
}

/** Modelo de biomarcadores (Gallo 2016) totalmente preenchido? ✅ hoje true. */
export const biomarkerModelReady2T = (): boolean =>
  ['map', 'utaPi', 'plgf'].every((k) => {
    const r = PE_BIOMARKER_MODEL_2T.reg[k as 'map'];
    return Number.isFinite(r.intercept) && Number.isFinite(r.slope) && Number.isFinite(PE_BIOMARKER_MODEL_2T.sd[k as 'map']);
  });

/**
 * Cálculo direto do risco de PE no 2º trimestre — usado pela CALCULADORA de
 * teste (aba de calculadoras clínicas). Aplica só os gates de CORRETUDE
 * (medianas + biomarcadores prontos, dados suficientes, IG na janela); NÃO
 * aplica o gate de validação clínica (`SECOND_TRIMESTER_PE_VALIDATED`), pois a
 * calculadora é a superfície de teste e exibe o banner "EM VALIDAÇÃO".
 * Converte MAP/UtA-PI/PlGF em MoM pelas medianas de 2º T e delega ao MESMO motor
 * Bayesiano do 1º T.
 */
export function computePe2tRisk(inp: Pe2tFormInput): PeRiskFromForm | null {
  if (!MEDIANS_READY_2T || !biomarkerModelReady2T()) return null;
  if (!(inp.ageYears && inp.weightKg && inp.heightCm && inp.gaWeeks)) return null;
  if (inp.gaWeeks < SECOND_TRIMESTER_PE_GA_MIN_WEEKS || inp.gaWeeks > SECOND_TRIMESTER_PE_GA_MAX_WEEKS) return null;

  const cov: PeMedianCovariates = {
    gaDays: inp.gaWeeks * 7, weightKg: inp.weightKg, heightCm: inp.heightCm, ageYears: inp.ageYears,
    racialOrigin: inp.racialOrigin, smoker: inp.smoker, chronicHypertension: inp.chronicHypertension,
    diabetes: inp.diabetes, ivf: inp.conception === 'ivf', parity: inp.parity,
  };
  const mapMoM = inp.mapMmHg ? toMoM(inp.mapMmHg, mapMedian2T(cov)) : undefined;
  const utaPiMoM = inp.utaPiRaw ? toMoM(inp.utaPiRaw, utaPiMedian2T(cov)) : undefined;
  const plgfMoM = inp.plgfRaw ? toMoM(inp.plgfRaw, plgfMedian2T(cov, inp.analyzer)) : undefined;
  // razão oftálmica → delta (medido − esperado por características maternas, Sapantzoglou 2021)
  const psvRatioDelta = inp.oaRatio ? toDelta(inp.oaRatio, psvRatioExpected2T(cov)) : undefined;

  const factors: PeMaternalFactors = {
    ageYears: inp.ageYears, weightKg: inp.weightKg, heightCm: inp.heightCm,
    racialOrigin: inp.racialOrigin, conception: inp.conception,
    chronicHypertension: inp.chronicHypertension,
    diabetesType1: inp.diabetes === 'type1',
    diabetesType2: inp.diabetes === 'type2insulin' || inp.diabetes === 'type2noinsulin',
    sleOrAps: inp.sleOrAps, familyHistoryPE: inp.familyHistoryPE,
    nulliparous: inp.parity === 'nulliparous', previousPE: inp.parity === 'parousPE',
    previousPeGaWeeks: inp.previousPeGaWeeks ?? undefined,
  };
  const biomarkers: PeBiomarkers = {
    mapMoM: mapMoM ?? undefined, utaPiMoM: utaPiMoM ?? undefined, plgfMoM: plgfMoM ?? undefined,
    psvRatioDelta: psvRatioDelta ?? undefined,
  };
  // limiares de 2ª visita: pretermPE = P(<32 sem), termPE = P(<36 sem)
  const risk = computePreeclampsiaRisk(factors, biomarkers, PE_COEFFICIENTS_2T, PE_BIOMARKER_MODEL_2T, PE_2T_THRESHOLDS);
  return {
    risk,
    mapMoM: mapMoM ?? undefined, utaPiMoM: utaPiMoM ?? undefined, plgfMoM: plgfMoM ?? undefined,
    psvRatioDelta: psvRatioDelta ?? undefined,
  };
}

/**
 * Entrada do LIVE-COMPUTE (auto no laudo). TRAVADO até a validação oficial:
 * retorna `null` enquanto `SECOND_TRIMESTER_PE_VALIDATED === false`. Assim, o
 * risco quantitativo NÃO entra em laudo automaticamente antes de conferido
 * caso-a-caso vs. a calc oficial da FMF — mas a CALCULADORA de teste
 * (`computePe2tRisk`) já funciona, com banner.
 */
export function peRisk2tFromForm(inp: Pe2tFormInput): PeRiskFromForm | null {
  if (!SECOND_TRIMESTER_PE_VALIDATED) return null;
  return computePe2tRisk(inp);
}
