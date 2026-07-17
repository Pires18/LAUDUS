import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';
import { TIRADS_OPTIONS } from '../scoring';

/**
 * Seção de ACHADOS: Normal (nenhum achado) por padrão; quando 'Alterado', revela
 * a lista repetível de lesões/nódulos com calculadoras/escore aninhados.
 */
function achados(
  id: string,
  label: string,
  itemLabel: string,
  fields: StructuredFieldDef[],
  opts: { normalText: string; score?: StructuredSection['score']; addLabel?: string }
): StructuredSection {
  return {
    id,
    label,
    normalable: true,
    normalText: opts.normalText,
    fields: [],
    repeatGroup: { id: 'item', itemLabel, addLabel: opts.addLabel, score: opts.score, fields },
  };
}

/**
 * MODELOS PADRÃO — PEQUENAS PARTES (10 máscaras do sistema).
 *
 * Curados a partir do analysisTemplate + aiInstructions de cada máscara
 * (scripts/laudia-deploy-unified.REFINED.json), com:
 * - ids CANÔNICOS que o liveCompute usa (lobo_d_dims/lobo_e_dims → volume
 *   tireoidiano total; nódulos com score 'tirads' + descritores scoreKey);
 * - calculadoras da área (volume-elipsoide, tirads-2017, organ-refs);
 * - regras dos prompts como hints (ACR TI-RADS, critérios de suspeição
 *   linfonodal, varicocele, hérnia à Valsalva).
 */

// ─── Nódulo tireoidiano com descritores ACR TI-RADS (score inline + calc) ───
const NODULO_TIRADS: StructuredFieldDef[] = [
  { id: 'loc', label: 'Localização', kind: 'select', options: ['lobo direito — terço superior', 'lobo direito — terço médio', 'lobo direito — terço inferior', 'lobo esquerdo — terço superior', 'lobo esquerdo — terço médio', 'lobo esquerdo — terço inferior', 'istmo'] },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'composicao', label: 'Composição', kind: 'select', options: TIRADS_OPTIONS.composition, scoreKey: 'composition' },
  { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', options: TIRADS_OPTIONS.echogenicity, scoreKey: 'echogenicity' },
  { id: 'forma', label: 'Forma', kind: 'select', options: TIRADS_OPTIONS.shape, scoreKey: 'shape' },
  { id: 'margem', label: 'Margem', kind: 'select', options: TIRADS_OPTIONS.margin, scoreKey: 'margin' },
  { id: 'focos', label: 'Focos ecogênicos', kind: 'multiselect', options: TIRADS_OPTIONS.foci, scoreKey: 'foci' },
  { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['não avaliada', 'ausente', 'periférica', 'central', 'mista'] },
  // o escore inline já sai dos descritores acima; este campo abre a calculadora
  // completa (mesma conduta por tamanho) e recebe o resultado de volta
  { id: 'tirads_cat', label: 'Categoria ACR TI-RADS', kind: 'select', calcId: 'tirads-2017', options: ['TR1', 'TR2', 'TR3', 'TR4', 'TR5'], hint: 'a sugestão automática não substitui o julgamento' },
];

// ─── Linfonodo cervical com critérios de suspeição ───
const LINFONODO_CERVICAL: StructuredFieldDef[] = [
  { id: 'nivel', label: 'Nível / cadeia', kind: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'inguinal', 'axilar'] },
  { id: 'lado', label: 'Lado', kind: 'select', options: ['direito', 'esquerdo'] },
  { id: 'eixos', label: 'Maior × menor eixo', kind: 'text', placeholder: 'ex: 1,4 × 0,6 cm' },
  { id: 'forma', label: 'Forma (índice L:T)', kind: 'select', options: ['oval (L:T ≥ 2) — habitual', 'arredondado (L:T < 2) — suspeito'] },
  { id: 'hilo', label: 'Hilo ecogênico', kind: 'select', options: ['presente/central', 'ausente/deslocado'] },
  { id: 'cortex', label: 'Córtex', kind: 'select', options: ['fino/simétrico', 'espessado', 'lobulado/nodular'] },
  { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['hilar (habitual)', 'periférica/capsular', 'caótica', 'ausente'] },
];

// ─── Seções compartilhadas ───

const GLANDULA_TIREOIDE = (doppler: boolean): StructuredSection => ({
  id: 'glandula-tireoide',
  label: 'Glândula Tireoide',
  normalable: true,
  normalText: 'tópica, contornos regulares, ecotextura homogênea e ecogenicidade preservada',
  fields: [
    { id: 'contornos', label: 'Contornos', kind: 'select', options: ['regulares', 'lobulados', 'irregulares'] },
    { id: 'ecotextura', label: 'Ecotextura', kind: 'select', options: ['homogênea', 'difusamente heterogênea', 'micronodular difusa (tireoidite)'] },
    { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', options: ['preservada', 'difusamente hipoecoica'] },
    ...(doppler ? [{ id: 'vascularizacao', label: 'Vascularização (Doppler)', kind: 'select' as const, options: ['habitual', 'aumentada difusamente (tireoidite)', 'reduzida'] }] : []),
  ],
});

// Lobos e istmo — ids canônicos: liveCompute soma o volume tireoidiano total.
const LOBO_TIREOIDE = (side: 'direito' | 'esquerdo'): StructuredSection => {
  const s = side === 'direito' ? 'd' : 'e';
  return {
    id: `lobo-${side}`,
    label: `Lobo ${side === 'direito' ? 'Direito' : 'Esquerdo'}`,
    fields: [
      { id: `lobo_${s}_dims`, label: 'Dimensões (L × AP × T)', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '≤ 20 cm³ ♂ / 15 cm³ ♀ (total)', hint: 'volume por lobo (soma automática)' },
    ],
  };
};

const ISTMO = (): StructuredSection => ({
  id: 'istmo',
  label: 'Istmo',
  fields: [
    { id: 'istmo', label: 'Espessura', kind: 'measure', unit: 'cm', normal: '≤ 0,4 cm', hint: 'espessado se > 0,4 cm' },
  ],
});

// Achados nodulares: Normal (sem nódulos) por padrão; Alterado revela a lista TI-RADS.
const NODULOS_TIREOIDE = (): StructuredSection =>
  achados('nodulos', 'Achados Nodulares', 'Nódulo', NODULO_TIRADS, {
    normalText: 'sem nódulos ou cistos ao rastreio',
    score: 'tirads',
    addLabel: 'Adicionar nódulo',
  });

// Cadeias linfonodais: Normal (habituais) por padrão; Alterado revela linfonodos suspeitos.
const CADEIAS_LINFONODAIS = (label = 'Cadeias Linfonodais'): StructuredSection =>
  achados('linfonodos', label, 'Linfonodo', LINFONODO_CERVICAL, {
    normalText: 'linfonodos de aspecto habitual, sem critérios de suspeição',
    addLabel: 'Adicionar linfonodo',
  });

const PELE_TCS = (): StructuredSection => ({
  id: 'pele-tcs',
  label: 'Pele e Tecido Celular Subcutâneo',
  normalable: true,
  normalText: 'espessura e ecotextura preservadas, sem coleções ou trajetos fistulosos',
  fields: [
    { id: 'pele_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'edema, trabeculação, coleção, lesão focal' },
  ],
});

const ESTRUTURAS_ADJACENTES = (): StructuredSection => ({
  id: 'estruturas-adjacentes',
  label: 'Estruturas Adjacentes',
  normalable: true,
  normalText: 'planos musculares, traqueia, glândulas salivares e feixes vasculares cervicais sem particularidades',
  fields: [
    { id: 'adjacentes_desc', label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

// ─── Bolsa escrotal ───

const TESTICULO = (side: 'direito' | 'esquerdo'): StructuredSection => {
  const s = side === 'direito' ? 'd' : 'e';
  return {
    id: `testiculo-${side}`,
    label: `Testículo ${side === 'direito' ? 'Direito' : 'Esquerdo'}`,
    normalable: true,
    normalText: 'tópico, contornos regulares, ecotextura homogênea, sem lesões focais ou microlitíase',
    fields: [
      { id: `test_${s}_dims`, label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '12–20 cm³', alwaysShow: true, hint: 'volume por elipsoide' },
      { id: `test_${s}_eco`, label: 'Ecotextura', kind: 'select', options: ['homogênea', 'heterogênea', 'microlitíase (focos puntiformes)'] },
      { id: `test_${s}_lesao`, label: 'Lesão focal', kind: 'text', fullWidth: true, placeholder: 'localização, dimensões, ecogenicidade, vascularização' },
    ],
  };
};

const EPIDIDIMOS = (): StructuredSection => ({
  id: 'epididimos',
  label: 'Epidídimos',
  normalable: true,
  normalText: 'cabeças, corpos e caudas de dimensões e ecotextura preservadas, sem espessamento ou coleções',
  fields: [
    { id: 'epididimo_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'epididimite, cisto, espermatocele (lado, dimensões)' },
  ],
});

const TUNICAS_HIDROCELE = (): StructuredSection => ({
  id: 'tunicas',
  label: 'Túnicas Vaginais',
  normalable: true,
  normalText: 'sem hidrocele ou coleção significativa entre os folhetos',
  fields: [
    { id: 'hidrocele', label: 'Hidrocele', kind: 'select', options: ['ausente', 'pequena', 'moderada', 'volumosa'] },
    { id: 'liquido_lado', label: 'Lado / conteúdo', kind: 'text', placeholder: 'anecoico (hidrocele) / ecos (hemato/piocele)' },
  ],
});

const FUNICULOS_VARICOCELE = (doppler: boolean): StructuredSection => ({
  id: 'funiculos',
  label: 'Funículos Espermáticos',
  normalable: true,
  normalText: 'sem varicocele; veias do plexo pampiniforme de calibre normal',
  fields: [
    { id: 'variz_calibre', label: 'Maior veia do plexo (repouso)', kind: 'measure', unit: 'mm', normal: '< 3 mm', alwaysShow: true, hint: 'varicocele se ≥ 3,0 mm' },
    ...(doppler ? [{ id: 'refluxo_valsalva', label: 'Refluxo à Valsalva', kind: 'select' as const, options: ['ausente', 'presente'], hint: 'define varicocele clínica' }] : []),
    { id: 'variz_lado', label: 'Lado / grau', kind: 'text' },
  ],
});

const DOPPLER_ESCROTAL = (): StructuredSection => ({
  id: 'doppler-escrotal',
  label: 'Dopplerfluxometria',
  normalable: true,
  normalText: 'fluxo testicular simétrico e preservado bilateralmente',
  fields: [
    { id: 'fluxo_d', label: 'Fluxo testículo direito', kind: 'select', options: ['presente/simétrico', 'aumentado (orquite)', 'reduzido/ausente (torção?)'] },
    { id: 'fluxo_e', label: 'Fluxo testículo esquerdo', kind: 'select', options: ['presente/simétrico', 'aumentado (orquite)', 'reduzido/ausente (torção?)'] },
    { id: 'ir_test', label: 'IR arterial testicular', kind: 'measure', normal: '0,5–0,7', alwaysShow: true },
    { id: 'whirlpool', label: 'Sinal do redemoinho (cordão)', kind: 'select', options: ['ausente', 'presente (torção)'] },
  ],
});

// ─── Glândulas salivares ───

const GLANDULA_SALIVAR = (nome: string, id: string): StructuredSection => ({
  id,
  label: nome,
  normalable: true,
  normalText: 'dimensões, contornos e ecotextura homogêneos, sem nódulos, cistos ou sialólitos',
  fields: [
    { id: `${id}_lado`, label: 'Lado acometido', kind: 'select', options: ['—', 'direita', 'esquerda', 'bilateral'] },
    { id: `${id}_achado`, label: 'Achado', kind: 'select', options: ['nenhum', 'nódulo/massa', 'sialadenite', 'cisto', 'lesão heterogênea (Sjögren)'] },
    { id: `${id}_desc`, label: 'Detalhe / dimensões', kind: 'text', fullWidth: true },
  ],
});

const DUCTOS_SALIVARES = (): StructuredSection => ({
  id: 'ductos-salivares',
  label: 'Ductos Salivares (Stensen / Wharton)',
  normalable: true,
  normalText: 'não dilatados, sem cálculos',
  fields: [
    { id: 'ducto_dilat', label: 'Dilatação ductal', kind: 'select', options: ['ausente', 'presente'] },
    { id: 'sialolito', label: 'Sialólito (maior)', kind: 'measure', unit: 'mm', hint: 'sombra acústica posterior' },
    { id: 'ducto_desc', label: 'Localização', kind: 'text' },
  ],
});

// ─── Partes moles / regiões / parede ───

const LESAO_PARTES_MOLES = (): StructuredSection =>
  achados('lesoes', 'Lesões / Massas', 'Lesão', [
    { id: 'loc', label: 'Localização', kind: 'text', placeholder: 'região anatômica' },
    { id: 'dims', label: 'Dimensões (L × AP × T)', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'plano', label: 'Plano / profundidade', kind: 'select', options: ['intradérmica', 'subcutânea', 'subfascial', 'intramuscular', 'intermuscular'] },
    { id: 'eco', label: 'Ecogenicidade', kind: 'select', options: ['anecoica', 'hipoecoica', 'isoecoica', 'hiperecoica', 'mista/complexa'] },
    { id: 'forma', label: 'Forma / margens', kind: 'select', options: ['oval, circunscrita', 'lobulada', 'irregular / infiltrativa'] },
    { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['ausente', 'periférica', 'central', 'difusa/caótica'] },
  ], { normalText: 'sem lesões ou massas', addLabel: 'Adicionar lesão' });

const PLANOS_MUSCULARES = (): StructuredSection => ({
  id: 'planos-musculares',
  label: 'Planos Musculares e Fáscias',
  normalable: true,
  normalText: 'íntegros, ecotextura fibrilar preservada, sem rupturas ou coleções',
  fields: [
    { id: 'musculo_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'contusão, estiramento, ruptura (parcial/completa), hematoma, hérnia muscular' },
  ],
});

const ESTRUTURAS_VASCULARES = (): StructuredSection => ({
  id: 'estruturas-vasculares',
  label: 'Estruturas Vasculares',
  normalable: true,
  normalText: 'veias compressíveis e pérvias; fluxo arterial e venoso preservado ao Doppler',
  fields: [
    { id: 'vasc_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'trombo, pseudoaneurisma, malformação vascular' },
  ],
});

const LINFONODOS_REGIONAIS = (): StructuredSection => ({
  id: 'linfonodos-regionais',
  label: 'Linfonodos Regionais',
  normalable: true,
  normalText: 'de aspecto habitual, morfologia ovalada, hilo ecogênico preservado',
  fields: [
    { id: 'linf_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'cadeia, maior/menor eixo, hilo, córtex, vascularização' },
  ],
});

// Região inguinal por lado (bilateral).
const REGIAO_INGUINAL = (side: 'direita' | 'esquerda'): StructuredSection => {
  const s = side === 'direita' ? 'd' : 'e';
  return {
    id: `inguinal-${side}`,
    label: `Região Inguinal ${side === 'direita' ? 'Direita' : 'Esquerda'}`,
    normalable: true,
    normalText: 'planos íntegros; sem herniação em repouso ou à Valsalva; vasos femorais normais; linfonodos habituais',
    fields: [
      { id: `hernia_${s}`, label: 'Hérnia', kind: 'select', options: ['ausente', 'inguinal indireta', 'inguinal direta', 'femoral'] },
      { id: `hernia_${s}_valsalva`, label: 'Comportamento à Valsalva', kind: 'select', options: ['sem protrusão', 'protrusão redutível', 'não redutível'] },
      { id: `hernia_${s}_conteudo`, label: 'Conteúdo / colo', kind: 'text', placeholder: 'gordura, alça; medida do colo herniário' },
      { id: `inguinal_${s}_linf`, label: 'Linfonodos / outros achados', kind: 'text', fullWidth: true },
    ],
  };
};

// ─── Modelos por exame ───

const TIREOIDE = (doppler: boolean): StructuredSection[] => [
  GLANDULA_TIREOIDE(doppler),
  LOBO_TIREOIDE('direito'), LOBO_TIREOIDE('esquerdo'), ISTMO(),
  NODULOS_TIREOIDE(),
  CADEIAS_LINFONODAIS(),
  ESTRUTURAS_ADJACENTES(),
];

const CERVICAL = (doppler: boolean): StructuredSection[] => [
  PELE_TCS(),
  GLANDULA_SALIVAR('Glândulas Salivares (parótidas e submandibulares)', 'salivares'),
  {
    id: 'tireoide-rastreio',
    label: 'Tireoide (rastreamento)',
    normalable: true,
    normalText: 'tópica, dimensões e ecotextura preservadas, sem nódulos ao rastreio',
    fields: [{ id: 'tireoide_rastreio_desc', label: 'Achados', kind: 'text', fullWidth: true }],
  },
  CADEIAS_LINFONODAIS('Cadeias Linfonodais Cervicais (níveis I–VII)'),
  {
    id: 'vasos-cervicais',
    label: 'Estruturas Vasculares (modo B)',
    normalable: true,
    normalText: 'carótidas comuns e jugulares internas com trajeto e calibre preservados',
    fields: [{ id: 'vasos_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'placa, trombo' }],
  },
  {
    id: 'planos-musculares-cervical',
    label: 'Planos Musculares',
    normalable: true,
    normalText: 'esternocleidomastoideos e demais planos simétricos, sem alterações',
    fields: [{ id: 'planos_cervical_desc', label: 'Achados', kind: 'text', fullWidth: true }],
  },
  ...(doppler
    ? [{
        id: 'estudo-doppler',
        label: 'Estudo Doppler',
        normalable: true,
        normalText: 'vascularização hilar preservada nos linfonodos, sem hiperfluxo patológico',
        fields: [{ id: 'doppler_desc', label: 'Padrão vascular', kind: 'select' as const, options: ['hilar (habitual)', 'periférico/caótico', 'hiperfluxo'] }],
      } as StructuredSection]
    : []),
];

const BOLSA_ESCROTAL = (doppler: boolean): StructuredSection[] => [
  {
    id: 'parede-escrotal',
    label: 'Parede Escrotal',
    normalable: true,
    normalText: 'pele e planos subcutâneos com espessura e ecogenicidade normais',
    fields: [{ id: 'parede_desc', label: 'Achados', kind: 'text', fullWidth: true }],
  },
  TESTICULO('direito'), TESTICULO('esquerdo'),
  EPIDIDIMOS(), TUNICAS_HIDROCELE(), FUNICULOS_VARICOCELE(doppler),
  ...(doppler ? [DOPPLER_ESCROTAL()] : []),
];

const GLANDULAS_SALIVARES = (): StructuredSection[] => [
  GLANDULA_SALIVAR('Glândulas Parótidas', 'parotidas'),
  GLANDULA_SALIVAR('Glândulas Submandibulares', 'submandibulares'),
  GLANDULA_SALIVAR('Glândulas Sublinguais', 'sublinguais'),
  DUCTOS_SALIVARES(),
  achados('lesoes-salivares', 'Nódulos / Massas', 'Lesão', [
    { id: 'glandula', label: 'Glândula', kind: 'select', options: ['parótida D', 'parótida E', 'submandibular D', 'submandibular E', 'sublingual'] },
    { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'margens', label: 'Margens', kind: 'select', options: ['circunscritas', 'mal definidas/infiltrativas'] },
    { id: 'eco', label: 'Ecogenicidade', kind: 'select', options: ['anecoica (cisto)', 'hipoecoica sólida', 'heterogênea'] },
    { id: 'vasc', label: 'Vascularização', kind: 'select', options: ['ausente', 'periférica', 'central/aumentada'] },
  ], { normalText: 'sem nódulos ou massas', addLabel: 'Adicionar lesão' }),
  LINFONODOS_REGIONAIS(),
];

const PARTES_MOLES = (): StructuredSection[] => [
  PELE_TCS(), LESAO_PARTES_MOLES(), PLANOS_MUSCULARES(),
  ESTRUTURAS_VASCULARES(), LINFONODOS_REGIONAIS(),
];

const REGIOES_INGUINAIS = (): StructuredSection[] => [
  REGIAO_INGUINAL('direita'), REGIAO_INGUINAL('esquerda'),
];

const PAREDE_ABDOMINAL = (): StructuredSection[] => [
  PELE_TCS(),
  {
    id: 'planos-aponeuroticos',
    label: 'Planos Musculoaponeuróticos e Fáscias',
    normalable: true,
    normalText: 'íntegros, sem soluções de continuidade',
    fields: [{ id: 'planos_desc', label: 'Achados', kind: 'text', fullWidth: true }],
  },
  {
    id: 'linha-alba',
    label: 'Linha Alba / Diástase dos Retos',
    normalable: true,
    normalText: 'íntegra; distância inter-retos preservada, sem diástase significativa',
    fields: [
      { id: 'diastase_supra', label: 'Distância inter-retos supraumbilical', kind: 'measure', unit: 'mm', normal: '≤ 20 mm', alwaysShow: true, hint: 'diástase se > 20 mm' },
      { id: 'diastase_infra', label: 'Distância inter-retos infraumbilical', kind: 'measure', unit: 'mm', normal: '≤ 20 mm', alwaysShow: true },
    ],
  },
  achados('hernias', 'Hérnias da Parede', 'Hérnia', [
    { id: 'tipo', label: 'Tipo', kind: 'select', options: ['umbilical', 'epigástrica', 'incisional', 'inguinal', 'femoral', 'Spiegel'] },
    { id: 'colo', label: 'Colo do defeito', kind: 'measure', unit: 'mm' },
    { id: 'conteudo', label: 'Conteúdo', kind: 'select', options: ['gordura pré-peritoneal', 'alça intestinal', 'misto'] },
    { id: 'redutibilidade', label: 'Redutibilidade (Valsalva)', kind: 'select', options: ['redutível', 'não redutível', 'encarcerada'] },
  ], { normalText: 'sem hérnias em repouso ou à Valsalva', addLabel: 'Adicionar hérnia' }),
  {
    id: 'avaliacao-dinamica',
    label: 'Avaliação Dinâmica (Valsalva)',
    normalable: true,
    normalText: 'ausência de protrusões ou defeitos fasciais durante o esforço',
    fields: [{ id: 'dinamica_desc', label: 'Achados', kind: 'text', fullWidth: true }],
  },
];

export const PEQUENAS_PARTES_SCHEMAS: StandardSchemaDef[] = [
  // COM DOPPLER antes das genéricas (a 1ª regex que casar vence)
  { name: 'TIREOIDE COM DOPPLER', match: /tireoide com doppler/, sections: () => TIREOIDE(true) },
  { name: 'TIREOIDE', match: /tireoide/, sections: () => TIREOIDE(false) },
  { name: 'CERVICAL COM DOPPLER', match: /cervical com doppler/, sections: () => CERVICAL(true) },
  { name: 'CERVICAL', match: /cervical/, sections: () => CERVICAL(false) },
  { name: 'BOLSA ESCROTAL COM DOPPLER', match: /(bolsa )?escrotal com doppler/, sections: () => BOLSA_ESCROTAL(true) },
  { name: 'BOLSA ESCROTAL', match: /(bolsa )?escrotal/, sections: () => BOLSA_ESCROTAL(false) },
  { name: 'GLÂNDULAS SALIVARES', match: /salivar/, sections: GLANDULAS_SALIVARES },
  { name: 'REGIÕES INGUINAIS', match: /inguina/, sections: REGIOES_INGUINAIS },
  { name: 'PAREDE ABDOMINAL', match: /parede abdominal/, sections: PAREDE_ABDOMINAL },
  { name: 'PARTES MOLES', match: /partes moles/, sections: PARTES_MOLES },
];
