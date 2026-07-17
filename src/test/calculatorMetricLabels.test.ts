import { describe, it, expect } from 'vitest';
import {
  FIELD_LABELS,
  HIDDEN_METRIC_KEYS,
  isDisplayableMetric,
} from '../modules/calculators/constants/fieldLabels';

/**
 * A grade de "Métricas Detalhadas" e o texto enviado à IA saem do MESMO filtro
 * (`isDisplayableMetric` + `FIELD_LABELS[k] || k`). Chave não mapeada não quebra
 * nada — ela apenas vaza crua ("bioParam: ccn") para a tela E para o prompt.
 * Estes testes travam o contrato das calculadoras fetais, que emitem enums.
 */

/** Resultado das calculadoras fetais, como emitido pelos componentes. */
const GA_RESULT = {
  referenceDate: '2026-07-16', method: 'bio', dumDate: '', prevUsgDate: '',
  prevUsgWeeks: '', prevUsgDays: '', ccn: '65', bpd: '', hc: '',
  bioParam: 'ccn', currentGa: '12s 6d', edd: '22/01/2027',
  sourceLabel: 'CCN (1º trimestre)', comparison: [], _summary: 'Idade gestacional: 12s 6d.',
};

const BIOMETRY_RESULT = {
  reference: 'hadlock', efwFormula: 'hadlock', gaWeeks: '32', gaDays: '0',
  sex: 'unknown', bpd: '84', hc: '295', ac: '274', fl: '59', hl: '',
  efw: 1800, percentile: 50, pDescription: 'AIG', efwMedian: 1795,
  referenceLabel: 'Hadlock 1991', referenceValidated: true, fellBack: false,
  bpdPercentile: 50, hcPercentile: 50, acPercentile: 50, flPercentile: 50,
  hlPercentile: null, _summary: 'Peso fetal estimado 1.800 g.',
};

describe('métricas das calculadoras — nenhuma chave crua vaza', () => {
  it('toda métrica exibível das calculadoras fetais tem rótulo em português', () => {
    for (const result of [GA_RESULT, BIOMETRY_RESULT]) {
      for (const [k, v] of Object.entries(result)) {
        if (!isDisplayableMetric(k, v)) continue;
        expect(FIELD_LABELS[k], `chave "${k}" sem rótulo — vazaria crua na UI e no prompt`)
          .toBeTruthy();
      }
    }
  });

  it('enums crus e flags internas ficam ocultos', () => {
    // 'ccn'/'hadlock'/true não significam nada para o médico nem para a IA
    for (const k of ['bioParam', 'reference', 'efwFormula', 'referenceValidated', 'fellBack']) {
      expect(HIDDEN_METRIC_KEYS.has(k), k).toBe(true);
      expect(isDisplayableMetric(k, 'hadlock'), k).toBe(false);
    }
  });

  it('prosa já contida na conclusão não vira métrica', () => {
    expect(isDisplayableMetric('sourceLabel', 'CCN (1º trimestre)')).toBe(false);
    expect(isDisplayableMetric('pDescription', 'AIG')).toBe(false);
  });

  it('a curva usada CONTINUA visível — o laudo precisa registrá-la', () => {
    // contrapartida de esconder `reference`: sem isto o percentil ficaria sem
    // referência, e Hadlock × INTERGROWTH divergem (ver hadlockBiometry.test.ts)
    expect(isDisplayableMetric('referenceLabel', 'Hadlock 1991')).toBe(true);
    expect(FIELD_LABELS.referenceLabel).toBe('Curva de referência');
  });

  it('o rótulo do percentil não cita curva alguma (é selecionável)', () => {
    expect(FIELD_LABELS.percentile).toBe('Percentil (%)');
    for (const curve of ['OMS', 'Hadlock', 'INTERGROWTH']) {
      expect(FIELD_LABELS.percentile).not.toContain(curve);
    }
  });

  it('métricas clínicas reais permanecem visíveis', () => {
    for (const k of ['currentGa', 'edd', 'ccn', 'efw', 'percentile'] as const) {
      expect(isDisplayableMetric(k, '1'), k).toBe(true);
      expect(FIELD_LABELS[k], k).toBeTruthy();
    }
  });
});
