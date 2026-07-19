import { CALCULATORS, CalculatorDef } from '../../calculators/registry';
import { ExamArea } from '../../../types';

/**
 * Calculadoras disponíveis para uma área (derivado do próprio registry,
 * fonte única — evita duplicar a lista). Usado pela aba Estruturado para
 * oferecer os atalhos de cálculo corretos por exame.
 */
export function calculatorsForArea(
  area: ExamArea | string | Array<ExamArea | string>
): CalculatorDef[] {
  const areas = Array.isArray(area) ? area : [area];
  return CALCULATORS.filter((c) => areas.some((a) => c.areas.includes(a as ExamArea)));
}

/** Metadados leves de uma calculadora (nome/descrição) para exibição. */
export function calculatorMeta(calcId?: string): CalculatorDef | undefined {
  if (!calcId) return undefined;
  return CALCULATORS.find((c) => c.id === calcId);
}
