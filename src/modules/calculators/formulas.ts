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

/** Índice de líquido amniótico (ILA/AFI): soma dos 4 quadrantes; classifica. */
export function amnioticILA(q1: number, q2: number, q3: number, q4: number): AmnioticResult | null {
  if (!(q1 && q2 && q3 && q4)) return null;
  const result = Number(q1) + Number(q2) + Number(q3) + Number(q4);
  let classification: string;
  if (result < 50) classification = 'Oligoâmnio (ILA < 50mm)';
  else if (result <= 80) classification = 'Líquido reduzido (50-80mm)';
  else if (result <= 180) classification = 'Volume normal (80-180mm)';
  else if (result <= 240) classification = 'Líquido aumentado (180-240mm)';
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
