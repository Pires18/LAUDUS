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
  // FMF — Cromossomopatia
  crlMm: 'CCN (mm)', igSemanas: 'IG (CCN)',
  ntMm: 'TN (mm)', ntMoM: 'TN (MoM)', bhcgMoM: 'β-hCG livre (MoM)', pappaMoM: 'PAPP-A (MoM)',
  riscoT21: 'Risco T21', riscoT18: 'Risco T18', riscoT13: 'Risco T13',
  // FMF — Pré-eclâmpsia
  weightKg: 'Peso (kg)', heightCm: 'Altura (cm)', previousPeGaWeeks: 'IG PE prévia (sem)',
  mapMmHg: 'MAP (mmHg)', mapMoM: 'MAP (MoM)', utaPiRaw: 'IP Uterinas', utaPiMoM: 'IP Uterinas (MoM)',
  plgfRaw: 'PlGF (pg/mL)', plgfMoM: 'PlGF (MoM)',
  riscoPePretermo: 'Risco PE pré-termo', riscoPeTermo: 'Risco PE a termo',
};

/**
 * Chaves internas que NÃO devem virar "chips" de métrica: são códigos crus
 * (enums em inglês), índices ou prosa já contida na conclusão. Exibi-las
 * poluiria o card do Copiloto, a grade de métricas e o texto enviado à IA.
 */
export const HIDDEN_METRIC_KEYS = new Set<string>([
  'method',        // mbv/ila/balik/dum/usg (código cru)
  'auFlow',        // normal/aedf/redf (código cru; já descrito na conclusão)
  'dvWave',        // not_evaluated/normal/rav (código cru)
  'stage',         // índice numérico do estadiamento
  'stageDesc',     // redundante com a conclusão
  'rec',           // conduta em prosa longa — pertence à conclusão
  'pDescription',  // classificação em prosa (PIG/AIG/GIG) — já na conclusão
  'status',        // normal/alert (código cru)
  'selected',      // rótulo do órgão — redundante com a conclusão
  'sex',           // male/female/unknown (enum não localizado)
  'referenceDate', // data-base interna do cálculo
  // FMF — entradas categóricas/booleanas cruas (já refletidas na conclusão):
  'racialOrigin', 'conception', 'parity', 'diabetes', 'analyzer',
  'nasalBone', 'ductusVenosus', 'tricuspid',
  'chronicHypertension', 'sleOrAps', 'familyHistoryPE', 'smoker',
]);

/**
 * Verdadeiro quando a métrica deve aparecer na grade de "Métricas Detalhadas":
 * ignora campos internos (prefixo `_`), chaves ocultas, objetos/arrays e vazios.
 */
export function isDisplayableMetric(key: string, value: unknown): boolean {
  return (
    !key.startsWith('_') &&
    !HIDDEN_METRIC_KEYS.has(key) &&
    typeof value !== 'object' &&
    value !== '' &&
    value !== null &&
    value !== undefined
  );
}
