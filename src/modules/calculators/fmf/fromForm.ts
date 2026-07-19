// ═══════════════════════════════════════════════════════════════════════
// FONTE ÚNICA: valores do formulário → risco FMF (trissomias / pré-eclâmpsia)
// ═══════════════════════════════════════════════════════════════════════
// Mesma matemática usada em DOIS lugares, sem duplicar:
//   1. Componentes de calculadora (modal) — TrisomyRiskCalculator / PreeclampsiaRiskCalculator.
//   2. Aba ESTRUTURADO — cálculo AO VIVO (`liveCompute.ts`) enquanto o médico
//      preenche o formulário, sem precisar abrir o modal.
// Garante que o chip inline e o modal deem EXATAMENTE o mesmo número.
// ═══════════════════════════════════════════════════════════════════════

import {
  computeTrisomyRisk, type MarkerState, type TrisomyRisk,
} from './trisomy';
import { PROVISIONAL_TRISOMY_PARAMS, ageRelatedRisk } from './trisomyData';
import {
  computePreeclampsiaRisk, type PeRisk, type PeMaternalFactors, type PeBiomarkers,
  type RacialOrigin, type Conception,
} from './preeclampsia';
import { PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL } from './preeclampsiaData';
import {
  mapMedianMmHg, utaPiMedian, plgfMedian, psvRatioExpected, toMoM, toDelta,
  type Analyzer, type PeMedianCovariates, type ParityKind, type DiabetesKind,
} from './medians';
import { crlToGaWeeks } from './qc';

// ─────────────────────────────── Trissomias ─────────────────────────────

export interface TrisomyFormInput {
  ageYears: number | null;
  crlMm?: number | null;
  ntMm?: number | null;
  fhrBpm?: number | null;
  freeBhcgMoM?: number | null;
  pappaMoM?: number | null;
  nasalBone?: MarkerState;
  ductusVenosus?: MarkerState;
  tricuspid?: MarkerState;
  /** Se ausente, deriva do CCN (Hadlock). */
  gestDays?: number | null;
}

const markerAssessed = (m?: MarkerState) => !!m && m !== 'notAssessed';

/** Há alguma evidência de rastreio além da idade? (usado p/ decidir se o chip
 *  inline aparece — só idade dá o basal, mas não vale mostrar no formulário). */
export function trisomyHasEvidence(inp: TrisomyFormInput): boolean {
  return (
    !!(inp.ntMm && inp.crlMm) ||
    inp.freeBhcgMoM != null || inp.pappaMoM != null || inp.fhrBpm != null ||
    markerAssessed(inp.nasalBone) || markerAssessed(inp.ductusVenosus) || markerAssessed(inp.tricuspid)
  );
}

/**
 * Risco combinado de trissomias a partir do formulário. Retorna `null` só
 * quando a idade é inválida (o basal por idade já é um resultado válido — o
 * gate de "tem evidência de rastreio" fica no chamador, ver `trisomyHasEvidence`).
 */
export function trisomyRiskFromForm(inp: TrisomyFormInput): TrisomyRisk | null {
  const age = inp.ageYears;
  if (!(age != null && age >= 15 && age <= 55)) return null;
  const crl = inp.crlMm;
  let gestDays: number | undefined = inp.gestDays ?? undefined;
  if (gestDays == null && typeof crl === 'number' && crl > 0) {
    const gw = crlToGaWeeks(crl);
    if (gw != null) gestDays = Math.round(gw * 7);
  }
  return computeTrisomyRisk({
    priorRisk: ageRelatedRisk(age),
    ntMm: inp.ntMm ?? undefined,
    crlMm: inp.crlMm ?? undefined,
    gestDays,
    freeBhcgMoM: inp.freeBhcgMoM ?? undefined,
    pappaMoM: inp.pappaMoM ?? undefined,
    fhrBpm: inp.fhrBpm ?? undefined,
    nasalBone: inp.nasalBone,
    ductusVenosus: inp.ductusVenosus,
    tricuspid: inp.tricuspid,
  }, PROVISIONAL_TRISOMY_PARAMS);
}

// ─────────────────────────────── Pré-eclâmpsia ──────────────────────────

export interface PeFormInput {
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
  gaWeeks?: number | null;
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
  /** Valores EFETIVOS (já agregados quando há medidas detalhadas). */
  mapMmHg?: number | null;
  utaPiRaw?: number | null;
  /** PlGF BRUTO (pg/mL) — o MoM é calculado pela mediana do analisador. */
  plgfRaw?: number | null;
  /** Razão P2/P1 da artéria oftálmica (não é MoM; vira delta). */
  psvRatio?: number | null;
}

export interface PeRiskFromForm {
  risk: PeRisk;
  mapMoM?: number;
  utaPiMoM?: number;
  plgfMoM?: number;
  psvRatioDelta?: number;
}

/**
 * Risco de pré-eclâmpsia a partir do formulário. Converte MAP/UtA-PI/PlGF em MoM
 * (medianas Tan 2018 por analisador) e a razão oftálmica em delta (Gana 2022),
 * exatamente como o componente. `null` sem idade/peso/altura.
 */
export function peRiskFromForm(inp: PeFormInput): PeRiskFromForm | null {
  if (!(inp.ageYears && inp.weightKg && inp.heightCm)) return null;
  const gaDays = inp.gaWeeks ? inp.gaWeeks * 7 : undefined;
  const cov: PeMedianCovariates | null = gaDays
    ? {
      gaDays, weightKg: inp.weightKg, heightCm: inp.heightCm, ageYears: inp.ageYears,
      racialOrigin: inp.racialOrigin, smoker: inp.smoker, chronicHypertension: inp.chronicHypertension,
      diabetes: inp.diabetes, ivf: inp.conception === 'ivf', parity: inp.parity,
    }
    : null;

  const mapMoM = inp.mapMmHg && cov ? toMoM(inp.mapMmHg, mapMedianMmHg(cov)) : undefined;
  const utaPiMoM = inp.utaPiRaw && cov ? toMoM(inp.utaPiRaw, utaPiMedian(cov)) : undefined;
  const plgfMoM = inp.plgfRaw && cov ? toMoM(inp.plgfRaw, plgfMedian(cov, inp.analyzer)) : undefined;
  const psvRatioDelta = inp.psvRatio && cov ? toDelta(inp.psvRatio, psvRatioExpected(cov)) : undefined;

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
    mapMoM: mapMoM ?? undefined, utaPiMoM: utaPiMoM ?? undefined,
    plgfMoM: plgfMoM ?? undefined, psvRatioDelta: psvRatioDelta ?? undefined,
  };
  const risk = computePreeclampsiaRisk(factors, biomarkers, PROVISIONAL_PE_COEFFICIENTS, PE_BIOMARKER_MODEL);
  return {
    risk,
    mapMoM: mapMoM ?? undefined, utaPiMoM: utaPiMoM ?? undefined,
    plgfMoM: plgfMoM ?? undefined, psvRatioDelta: psvRatioDelta ?? undefined,
  };
}
