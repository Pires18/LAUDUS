export interface GestationalAgeResult {
  weeks: number;
  days: number;
  label: string;
  edd: Date;
}

export function calcGaFromDum(dumDate: Date, referenceDate: Date): GestationalAgeResult | null {
  const diffMs = referenceDate.getTime() - dumDate.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays < 0) return null;
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const edd = new Date(dumDate);
  edd.setDate(edd.getDate() + 280);
  return { weeks, days, label: `${weeks}s ${days}d`, edd };
}

export function calcGaFromPreviousUsg(
  prevUsgDate: Date,
  prevWeeks: number,
  prevDays: number,
  referenceDate: Date
): GestationalAgeResult | null {
  const initialDays = prevWeeks * 7 + prevDays;
  const diffMs = referenceDate.getTime() - prevUsgDate.getTime();
  const daysSince = Math.round(diffMs / 86_400_000);
  const totalDays = initialDays + daysSince;
  if (totalDays < 0) return null;
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const edd = new Date(prevUsgDate);
  edd.setDate(edd.getDate() - initialDays + 280);
  return { weeks, days, label: `${weeks}s ${days}d`, edd };
}

export function calcEllipsoidVolume(d1: number, d2: number, d3: number): number {
  return (Math.PI / 6) * d1 * d2 * d3;
}

export function classifyBirads(score: number): string {
  if (score === 0) return 'BI-RADS 0 — Avaliação incompleta';
  if (score === 1) return 'BI-RADS 1 — Negativo';
  if (score === 2) return 'BI-RADS 2 — Benigno';
  if (score === 3) return 'BI-RADS 3 — Provavelmente benigno (seguimento em 6 meses)';
  if (score === 4) return 'BI-RADS 4 — Suspeito (biópsia recomendada)';
  if (score === 5) return 'BI-RADS 5 — Altamente suspeito de malignidade';
  if (score === 6) return 'BI-RADS 6 — Malignidade conhecida';
  return 'BI-RADS inválido';
}

export function classifyTirads(score: number): { category: string; recommendation: string } {
  if (score === 0) return { category: 'TR1 — Normal', recommendation: 'Sem nódulo; nenhuma biópsia' };
  if (score <= 2) return { category: 'TR2 — Benigno', recommendation: 'Sem biópsia' };
  if (score <= 4) return { category: 'TR3 — Baixo risco', recommendation: 'Seguimento ou biópsia se ≥ 2.5 cm' };
  if (score <= 6) return { category: 'TR4 — Risco intermediário', recommendation: 'Biópsia se ≥ 1.5 cm' };
  return { category: 'TR5 — Alta suspeição', recommendation: 'Biópsia se ≥ 1.0 cm' };
}
