import { ClinicalRecordType, VitalSigns } from '../../../types';

/** IMC (kg/m²) a partir de peso em kg e altura em cm. Null se dados inválidos. */
export function computeBMI(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/** Classificação OMS do IMC (adultos). */
export function classifyBMI(bmi: number): string {
  if (bmi < 18.5) return 'Baixo peso';
  if (bmi < 25) return 'Eutrófico';
  if (bmi < 30) return 'Sobrepeso';
  if (bmi < 35) return 'Obesidade grau I';
  if (bmi < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

export const RECORD_TYPE_META: Record<ClinicalRecordType, { label: string; addLabel: string }> = {
  'nota': { label: 'Nota Clínica', addLabel: 'Nota' },
  'exame-fisico': { label: 'Exame Físico', addLabel: 'Exame Físico' },
  'laboratorio': { label: 'Laboratório', addLabel: 'Laboratório' },
};

/** Itens de sinais vitais preenchidos, prontos para exibição em chips. */
export function vitalsToChips(vitals?: VitalSigns): { label: string; value: string }[] {
  if (!vitals) return [];
  const chips: { label: string; value: string }[] = [];
  if (vitals.paSys != null && vitals.paDia != null) chips.push({ label: 'PA', value: `${vitals.paSys}/${vitals.paDia} mmHg` });
  if (vitals.fc != null) chips.push({ label: 'FC', value: `${vitals.fc} bpm` });
  if (vitals.fr != null) chips.push({ label: 'FR', value: `${vitals.fr} irpm` });
  if (vitals.temp != null) chips.push({ label: 'Temp', value: `${vitals.temp} °C` });
  if (vitals.spo2 != null) chips.push({ label: 'SpO₂', value: `${vitals.spo2}%` });
  if (vitals.weightKg != null) chips.push({ label: 'Peso', value: `${vitals.weightKg} kg` });
  if (vitals.heightCm != null) chips.push({ label: 'Altura', value: `${vitals.heightCm} cm` });
  const bmi = computeBMI(vitals.weightKg, vitals.heightCm);
  if (bmi != null) chips.push({ label: 'IMC', value: `${bmi.toFixed(1)} (${classifyBMI(bmi)})` });
  return chips;
}
