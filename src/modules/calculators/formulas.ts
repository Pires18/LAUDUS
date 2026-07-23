// ═══════════════════════════════════════════════════════════════
// FÓRMULAS CLÍNICAS PURAS — fonte única, testável (sem React)
// ═══════════════════════════════════════════════════════════════
// Extraído dos componentes de calculadora para permitir cobertura de testes
// unitários. Cada função é determinística e reproduz EXATAMENTE a matemática
// que os componentes usam. Não altera comportamento clínico.

/** Constante do elipsoide (π/6 ≈ 0,5236, arredondada para 0,523 como no app). */
export const ELLIPSOID_K = 0.523;

/**
 * Volume do elipsoide em cm³ (mL). Entrada em cm ou mm.
 * mm³ é convertido para cm³ (÷1000).
 */
export function ellipsoidVolume(d1: number, d2: number, d3: number, unit: 'cm' | 'mm' = 'cm'): number | null {
  if (!(d1 > 0 && d2 > 0 && d3 > 0)) return null;
  const raw = d1 * d2 * d3 * ELLIPSOID_K;
  return unit === 'mm' ? raw / 1000 : raw;
}

export interface ProstateResult {
  volume: number; // cc
  weight: number; // g
  classification: string;
}

/** Volume (cc) e peso (g) da próstata a partir de 3 diâmetros em mm. */
export function prostateVolumeWeight(d1: number, d2: number, d3: number): ProstateResult | null {
  if (!(d1 && d2 && d3)) return null;
  const volume = (ELLIPSOID_K * d1 * d2 * d3) / 1000;
  const weight = volume * 1.05;
  let classification: string;
  if (volume <= 20) classification = 'Normal (até 20cc)';
  else if (volume <= 30) classification = 'Aumento leve (20-30cc)';
  else if (volume <= 50) classification = 'Aumento moderado (30-50cc)';
  else if (volume <= 80) classification = 'Aumento acentuado (50-80cc)';
  else classification = 'Aumento muito acentuado (> 80cc)';
  return { volume, weight, classification };
}

/** Diâmetro médio do saco gestacional (mm). */
export function meanSacDiameter(d1: number, d2: number, d3: number): number | null {
  if (!(d1 && d2 && d3)) return null;
  return (d1 + d2 + d3) / 3;
}

/** Idade gestacional a partir do DMSG: dias = round(DMSG + 30). */
export function gaFromMsd(msd: number): { weeks: number; days: number; label: string } {
  const totalDays = Math.round(msd + 30);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days, label: `${weeks}s ${days}d` };
}

/**
 * Idade gestacional a partir do CCN (comprimento cabeça-nádega, em mm) —
 * polinômio de Hadlock et al. 1992:
 *   ln(IG_semanas) = 1.684969 + 0.315646·c − 0.049306·c² + 0.004057·c³
 *                    − 0.000120456·c⁴   (c = CCN em cm)
 */
export function crlToGestationalAge(
  crlMm: number
): { totalDays: number; weeks: number; days: number; label: string } | null {
  if (!(crlMm > 0)) return null;
  const c = crlMm / 10;
  const lnMA =
    1.684969 +
    0.315646 * c -
    0.049306 * Math.pow(c, 2) +
    0.004057 * Math.pow(c, 3) -
    0.000120456 * Math.pow(c, 4);
  const totalDays = Math.round(Math.exp(lnMA) * 7);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { totalDays, weeks, days, label: `${weeks}s ${days}d` };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface GaResult {
  totalDays: number;
  weeks: number;
  days: number;
  label: string;
  edd: Date; // Data provável do parto
}

function buildGa(totalDays: number, edd: Date): GaResult {
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { totalDays, weeks, days, label: `${weeks}s ${days}d`, edd };
}

/** IG pela DUM (última menstruação): IG = ref − DUM; DPP = DUM + 280 dias. */
export function gaFromLMP(lmp: Date, ref: Date): GaResult | null {
  if (isNaN(lmp.getTime()) || isNaN(ref.getTime())) return null;
  const diffDays = Math.round((ref.getTime() - lmp.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return null;
  const edd = new Date(lmp);
  edd.setDate(edd.getDate() + 280);
  return buildGa(diffDays, edd);
}

/**
 * IG por USG anterior: parte da IG conhecida naquele exame e soma os dias
 * decorridos. DPP = data do USG − diasIniciais + 280.
 */
export function gaFromPriorUsg(usgDate: Date, usgWeeks: number, usgDays: number, ref: Date): GaResult | null {
  if (isNaN(usgDate.getTime()) || isNaN(ref.getTime())) return null;
  const initialDays = usgWeeks * 7 + (usgDays || 0);
  const daysSince = Math.round((ref.getTime() - usgDate.getTime()) / MS_PER_DAY);
  const totalDays = initialDays + daysSince;
  if (totalDays < 0) return null;
  const edd = new Date(usgDate);
  edd.setDate(edd.getDate() - initialDays + 280);
  return buildGa(totalDays, edd);
}

/**
 * IG pelo DBP (diâmetro biparietal, mm) — Hadlock et al. 1984 (Radiology 152:497):
 *   IG(sem) = 9,54 + 1,482·b + 0,1676·b²   (b = DBP em cm)
 * Parâmetro de escolha no 2º trimestre (acurácia cai no 3º por moldagem cefálica).
 */
export function gaFromBpd(bpdMm: number): { totalDays: number; weeks: number; days: number; label: string } | null {
  if (!(bpdMm > 0)) return null;
  const b = bpdMm / 10;
  const weeksDec = 9.54 + 1.482 * b + 0.1676 * Math.pow(b, 2);
  if (!isFinite(weeksDec) || weeksDec <= 0) return null;
  const totalDays = Math.round(weeksDec * 7);
  return { totalDays, weeks: Math.floor(totalDays / 7), days: totalDays % 7, label: `${Math.floor(totalDays / 7)}s ${totalDays % 7}d` };
}

/**
 * IG pela CC (circunferência cefálica, mm) — Hadlock et al. 1984:
 *   IG(sem) = 8,96 + 0,540·h + 0,0003·h³   (h = CC em cm)
 * Parâmetro de escolha no 3º trimestre (menos afetado pela moldagem que o DBP).
 */
export function gaFromHc(hcMm: number): { totalDays: number; weeks: number; days: number; label: string } | null {
  if (!(hcMm > 0)) return null;
  const h = hcMm / 10;
  const weeksDec = 8.96 + 0.54 * h + 0.0003 * Math.pow(h, 3);
  if (!isFinite(weeksDec) || weeksDec <= 0) return null;
  const totalDays = Math.round(weeksDec * 7);
  return { totalDays, weeks: Math.floor(totalDays / 7), days: totalDays % 7, label: `${Math.floor(totalDays / 7)}s ${totalDays % 7}d` };
}

/** Parâmetro biométrico usado para datar, por trimestre. */
export type BiometryDatingParam = 'ccn' | 'dbp' | 'cc';

export const BIOMETRY_DATING_LABEL: Record<BiometryDatingParam, string> = {
  ccn: 'CCN (1º trimestre)',
  dbp: 'DBP (2º trimestre)',
  cc: 'CC (3º trimestre)',
};

/** IG por biometria: CCN (1ºT), DBP (2ºT) ou CC (3ºT). Medidas em mm. */
export function gaFromBiometry(
  param: BiometryDatingParam,
  valueMm: number
): { totalDays: number; weeks: number; days: number; label: string } | null {
  if (param === 'ccn') {
    const r = crlToGestationalAge(valueMm);
    return r ? { totalDays: r.totalDays, weeks: r.weeks, days: r.days, label: r.label } : null;
  }
  if (param === 'dbp') return gaFromBpd(valueMm);
  return gaFromHc(valueMm);
}

/**
 * Escolhe o parâmetro biométrico de datação pelo trimestre: CCN no 1º,
 * DBP no 2º e CC no 3º. Sem IG conhecida, infere pelos dados disponíveis
 * (CCN presente → 1ºT; senão datar pela CC exige IG — cai no DBP).
 */
export function pickBiometryDatingParam(
  available: { ccn?: number | null; dbp?: number | null; cc?: number | null },
  knownWeeks?: number | null
): BiometryDatingParam | null {
  const has = (v?: number | null) => v != null && v > 0;
  if (knownWeeks != null) {
    if (knownWeeks < 14) return has(available.ccn) ? 'ccn' : has(available.dbp) ? 'dbp' : null;
    if (knownWeeks < 28) return has(available.dbp) ? 'dbp' : has(available.cc) ? 'cc' : null;
    return has(available.cc) ? 'cc' : has(available.dbp) ? 'dbp' : null;
  }
  // Sem IG prévia: CCN indica 1º trimestre; senão estima pelo DBP e refina.
  if (has(available.ccn)) return 'ccn';
  if (has(available.dbp)) {
    const est = gaFromBpd(available.dbp!);
    // ≥ 28 semanas pelo DBP → a CC é o parâmetro preferido, se houver.
    if (est && est.totalDays / 7 >= 28 && has(available.cc)) return 'cc';
    return 'dbp';
  }
  return has(available.cc) ? 'cc' : null;
}

/** Interpreta rótulos de IG: "12s3d", "12+3", "12 3", "12s", "12". */
export function parseIgLabel(raw: string): { weeks: number; days: number } | null {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*(?:s(?:em)?|w|\+)?\s*(\d{1,2})?\s*d?/);
  if (!m) return null;
  const weeks = Number(m[1]);
  const days = m[2] != null ? Number(m[2]) : 0;
  if (!isFinite(weeks) || weeks < 0 || weeks > 45) return null;
  if (!isFinite(days) || days < 0 || days > 6) return null;
  return { weeks, days };
}

export type DatingMethod = 'dum' | 'usg' | 'biometria';

export interface ReferenceGaInput {
  /** Método escolhido no laudo. Ausente → hierarquia USG > DUM > biometria. */
  method?: DatingMethod | null;
  dum?: Date | null;
  usgDate?: Date | null;
  usgWeeks?: number | null;
  usgDays?: number | null;
  biometry?: { ccn?: number | null; dbp?: number | null; cc?: number | null };
  examDate: Date;
}

export interface ReferenceGaResult {
  totalDays: number;
  weeks: number;
  days: number;
  label: string;
  /** DPP — indisponível quando a datação vem da biometria isolada. */
  edd?: Date;
  method: DatingMethod;
  /** Rótulo da fonte para exibição (ex.: 'DUM', 'USG anterior', 'CCN'). */
  sourceLabel: string;
}

/**
 * IG DE REFERÊNCIA do exame — fonte única de verdade para os percentis
 * (biometria/OMS, Doppler, MoM) e para os cálculos de risco.
 *
 * Hierarquia quando o método não é declarado (ISUOG/ACOG/FMF): USG anterior
 * (idealmente CCN de 11+0–13+6) > DUM confiável > biometria do exame atual.
 * Com o método declarado, respeita a escolha e só cai no próximo se faltarem dados.
 */
export function resolveReferenceGa(input: ReferenceGaInput): ReferenceGaResult | null {
  const { examDate } = input;
  if (!examDate || isNaN(examDate.getTime())) return null;

  const byUsg = (): ReferenceGaResult | null => {
    if (!input.usgDate || input.usgWeeks == null) return null;
    const r = gaFromPriorUsg(input.usgDate, input.usgWeeks, input.usgDays || 0, examDate);
    return r ? { ...r, method: 'usg', sourceLabel: 'USG anterior' } : null;
  };
  const byDum = (): ReferenceGaResult | null => {
    if (!input.dum) return null;
    const r = gaFromLMP(input.dum, examDate);
    return r ? { ...r, method: 'dum', sourceLabel: 'DUM' } : null;
  };
  const byBiometry = (): ReferenceGaResult | null => {
    const bio = input.biometry || {};
    const param = pickBiometryDatingParam(bio);
    if (!param) return null;
    const value = bio[param];
    const r = gaFromBiometry(param, value!);
    if (!r) return null;
    // DPP a partir da IG biométrica: parto estimado 280 dias após a "DUM equivalente".
    const edd = new Date(examDate);
    edd.setDate(edd.getDate() + (280 - r.totalDays));
    return { ...r, edd, method: 'biometria', sourceLabel: param.toUpperCase() };
  };

  const order: Array<() => ReferenceGaResult | null> =
    input.method === 'dum' ? [byDum, byUsg, byBiometry]
      : input.method === 'usg' ? [byUsg, byDum, byBiometry]
      : input.method === 'biometria' ? [byBiometry, byUsg, byDum]
      : [byUsg, byDum, byBiometry];

  for (const fn of order) {
    const r = fn();
    if (r) return r;
  }
  return null;
}

/** Volume de derrame pleural pela fórmula de Balik: V(ml) = 20 × espessura(mm). */
export function balikPleuralVolume(depthMm: number): number | null {
  return depthMm > 0 ? 20 * depthMm : null;
}

export interface AmnioticResult {
  result: number; // mm
  classification: string;
}

/** Maior bolsão vertical (MBV/MVP): maior das profundidades; classifica. */
export function amnioticMBV(depths: number[]): AmnioticResult | null {
  const valid = depths.filter((d) => d > 0);
  if (valid.length === 0) return null;
  const result = Math.max(...valid);
  let classification: string;
  if (result < 20) classification = 'Oligoâmnio (MBV < 20mm)';
  else if (result <= 80) classification = 'Volume normal (20-80mm)';
  else classification = 'Polidrâmnio (MBV > 80mm)';
  return { result, classification };
}

/** Índice de líquido amniótico (ILA/AFI): soma dos 4 quadrantes; classifica.
 *  Faixas casadas com o liveCompute e o prompt de área: 80–240 mm = normal
 *  (8–24 cm, padrão clínico), < 50 oligoâmnio, > 240 polidrâmnio. */
export function amnioticILA(q1: number, q2: number, q3: number, q4: number): AmnioticResult | null {
  if (!(q1 && q2 && q3 && q4)) return null;
  const result = Number(q1) + Number(q2) + Number(q3) + Number(q4);
  let classification: string;
  if (result < 50) classification = 'Oligoâmnio (ILA < 50mm)';
  else if (result <= 80) classification = 'Líquido reduzido (50-80mm)';
  else if (result <= 240) classification = 'Volume normal (80-240mm)';
  else classification = 'Polidrâmnio (ILA > 240mm)';
  return { result, classification };
}

// Referência IMT ELSA-Brasil (Freire et al. 2015; Lotufo et al. 2016).
export const IMT_REF: Record<'male' | 'female', Record<string, { p75: number; p90: number }>> = {
  male: {
    '35-44': { p75: 0.72, p90: 0.82 },
    '45-54': { p75: 0.80, p90: 0.93 },
    '55-64': { p75: 0.90, p90: 1.03 },
    '65+': { p75: 0.98, p90: 1.12 },
  },
  female: {
    '35-44': { p75: 0.65, p90: 0.74 },
    '45-54': { p75: 0.73, p90: 0.84 },
    '55-64': { p75: 0.82, p90: 0.95 },
    '65+': { p75: 0.90, p90: 1.04 },
  },
};

export function imtAgeGroup(age: number): string {
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

/** Classifica o IMT máximo (mm) por faixa etária/sexo. */
export function imtClassification(age: number, sex: 'male' | 'female', maxImt: number): string | null {
  const ref = IMT_REF[sex]?.[imtAgeGroup(age)];
  if (!ref) return null;
  if (maxImt <= ref.p75) return 'Normal (≤ p75)';
  if (maxImt <= ref.p90) return 'Espessamento moderado (p75-p90)';
  return 'Espessamento acentuado (> p90) — Risco cardiovascular elevado';
}

/** Índice de colapsabilidade da VCI (%): (máx − mín) / máx × 100. */
export function ivcCollapsibilityIndex(maxDia: number, minDia: number): number | null {
  if (!(maxDia && minDia && maxDia > 0)) return null;
  return ((maxDia - minDia) / maxDia) * 100;
}

export interface DopplerIndices {
  ri: number | null;
  pi: number | null;
  sd: number | null;
}

/**
 * Índices Doppler a partir de VPS (s), VDF (d) e Vmed (m):
 *  IR = (s − d)/s ; S/D = s/d ; IP = (s − d)/m (se m informado).
 */
export function dopplerIndices(psv: number, edv: number, tamv?: number): DopplerIndices {
  const s = Number(psv);
  const d = Number(edv);
  const m = Number(tamv);
  const out: DopplerIndices = { ri: null, pi: null, sd: null };
  if (s && d) {
    out.ri = (s - d) / s;
    out.sd = s / d;
  }
  if (s && d && m) {
    out.pi = (s - d) / m;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// ELASTOGRAFIA
// ─────────────────────────────────────────────────────────────────────

export type LiverEtiologia = 'viral' | 'nafld' | 'alcool' | 'colestatica';

/**
 * Cutoffs ORIENTADORES de rigidez hepática (kPa) por etiologia — consolidados
 * de EFSUMB/EASL/Baveno VII (TE/FibroScan; 2D-SWE é próximo, aparelho-dependente).
 * São guias: dependem de método, aparelho, jejum e transaminases.
 */
const FIBROSIS_CUTOFFS: Record<LiverEtiologia, { f2: number; f3: number; f4: number }> = {
  viral: { f2: 7.0, f3: 9.5, f4: 12.0 },       // HCV/HBV
  nafld: { f2: 8.0, f3: 10.0, f4: 14.0 },      // DHGNA/NASH (Baveno: > 12 cACLD)
  alcool: { f2: 7.0, f3: 11.0, f4: 19.0 },     // hepatopatia alcoólica
  colestatica: { f2: 7.1, f3: 9.6, f4: 17.0 }, // CBP/CEP
};

/** Estágio METAVIR aproximado a partir do kPa e da etiologia. */
export function liverFibrosisStage(
  kpa: number,
  etiologia: LiverEtiologia
): { stage: string; alert: boolean } | null {
  if (!(kpa > 0)) return null;
  const c = FIBROSIS_CUTOFFS[etiologia];
  if (!c) return null;
  if (kpa >= c.f4) return { stage: 'F4 — cirrose provável', alert: true };
  if (kpa >= c.f3) return { stage: 'F3 — fibrose avançada', alert: true };
  if (kpa >= c.f2) return { stage: 'F2 — fibrose significativa', alert: true };
  return { stage: 'F0–F1 — fibrose ausente/leve', alert: false };
}

/** Grau de esteatose pelo CAP (dB/m, FibroScan; Karlas 2017). */
export function liverSteatosisCAP(cap: number): string | null {
  if (!(cap > 0)) return null;
  if (cap >= 280) return 'S3 — esteatose acentuada (≥ 280)';
  if (cap >= 268) return 'S2 — esteatose moderada (268–279)';
  if (cap >= 248) return 'S1 — esteatose leve (248–267)';
  return 'S0 — sem esteatose significativa (< 248)';
}
