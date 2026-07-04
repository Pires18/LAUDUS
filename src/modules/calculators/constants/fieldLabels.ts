/**
 * Rótulos legíveis para as métricas emitidas pelas calculadoras clínicas.
 *
 * As chaves correspondem EXATAMENTE às propriedades retornadas por cada
 * componente em `onChange(...)`. Chaves não mapeadas caem no fallback
 * (a própria chave), então mantenha esta lista alinhada com os componentes.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Volume / dimensões genéricas
  structureName: 'Estrutura', volume: 'Volume (cm³)', unit: 'Unidade',
  d1: 'D1', d2: 'D2', d3: 'D3',
  // Idade gestacional (DUM/USG)
  method: 'Método', referenceDate: 'Data do exame',
  dumDate: 'DUM', prevUsgDate: 'Data USG anterior',
  prevUsgWeeks: 'IG USG (sem)', prevUsgDays: 'IG USG (dias)',
  currentGa: 'IG Atual', edd: 'DPP', ga: 'IG Estimada',
  // Biometria fetal
  gaWeeks: 'IG (semanas)', gaDays: 'IG (dias)', sex: 'Sexo',
  bpd: 'DBP (mm)', hc: 'CC (mm)', ac: 'CA (mm)', fl: 'CF (mm)', hl: 'Úmero (mm)',
  efw: 'PFE (g)', percentile: 'Percentil OMS (%)', pDescription: 'Classificação',
  bpdPercentile: 'DBP p%', hcPercentile: 'CC p%', acPercentile: 'CA p%',
  flPercentile: 'CF p%', hlPercentile: 'Úmero p%',
  // Doppler
  auPi: 'IP Art. Umbilical', acmPi: 'IP ACM', utaPi: 'IP Uterinas (média)', dvPi: 'PIV Ducto Venoso',
  auFlow: 'Fluxo diastólico (AU)', dvWave: 'Onda A (Ducto Venoso)', efwPercentile: 'PFE Percentil',
  rcp: 'RCP (ACM/AU)', rcpP: 'RCP p%',
  stage: 'Estadio Barcelona', stageDesc: 'Estadiamento', rec: 'Conduta sugerida',
  auP: 'AU p%', acmP: 'ACM p%', utaP: 'UtA p%', dvP: 'DV p%',
  // Vascular / hemodinâmica
  psv: 'Vel. Sistólica (cm/s)', edv: 'Vel. Diastólica (cm/s)', tamv: 'TAMV (cm/s)',
  ri: 'IR (Resistência)', pi: 'IP (Pulsatilidade)', sd: 'Rel. S/D',
  // IMT carótidas
  age: 'Idade (anos)', imtRight: 'EIM Direita (mm)', imtLeft: 'EIM Esquerda (mm)',
  maxImt: 'EIM Máxima (mm)', classification: 'Classificação',
  // Próstata
  weight: 'Peso Estimado (g)',
  // Líquido amniótico
  result: 'Resultado (mm)', q1: 'Q1 (mm)', q2: 'Q2 (mm)', q3: 'Q3 (mm)', q4: 'Q4 (mm)',
  // Índice da Veia Cava Inferior
  maxDia: 'VCI Expir. (mm)', minDia: 'VCI Inspir. (mm)', index: 'Índice Colapsabilidade (%)',
  // Derrame pleural (Balik)
  depth: 'Espessura lâmina (mm)',
  // Valores de referência de órgãos
  selected: 'Órgão', measure: 'Medida', status: 'Situação',
  // CCN / DMSG
  crl: 'CCN (mm)', msd: 'DMSG (mm)',
};

/**
 * Verdadeiro quando a métrica deve aparecer na grade de "Métricas Detalhadas":
 * ignora campos internos (prefixo `_`), objetos/arrays e valores vazios.
 */
export function isDisplayableMetric(key: string, value: unknown): boolean {
  return (
    !key.startsWith('_') &&
    typeof value !== 'object' &&
    value !== '' &&
    value !== null &&
    value !== undefined
  );
}
