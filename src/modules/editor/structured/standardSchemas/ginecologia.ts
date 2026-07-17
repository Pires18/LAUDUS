import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — GINECOLOGIA (5 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions de cada máscara
 * (scripts/laudia-deploy-unified.REFINED.json), seguindo IOTA/O-RADS (ACR 2022),
 * MUSA (adenomiose), IETA (endométrio), FIGO (miomas) e IDEA (endometriose).
 *
 * - ids CANÔNICOS do liveCompute: `endometrio_esp` + `menopausa` (limiar
 *   pós-menopausa > 4 mm), `ovd_dims`/`ovd_afc` e `ove_dims`/`ove_afc` (SOP:
 *   CFA ≥ 20 ou volume > 10 cm³), `utero_dims` (volume por elipsoide).
 * - Biometria de rotina fica no card 'Normal' (`alwaysShow`) — volume uterino,
 *   espessura endometrial, volume ovariano/CFA seguem sendo medidos e calculados.
 * - Lesões (miomas FIGO, formações O-RADS, pólipos, endometriomas, focos de DIE)
 *   ficam em grupos aninhados, revelados sob 'Alterado'.
 */

/** Seção de ACHADOS: Normal (ausente) por padrão; 'Alterado' revela a lista. */
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

// ─── Blocos de campos reutilizáveis ───

/** Mioma classificado por FIGO (0–8) com volume ao vivo. */
const MIOMA_FIGO: StructuredFieldDef[] = [
  { id: 'figo', label: 'Tipo (FIGO)', kind: 'select', calcId: 'figo-myoma', options: [
    '0 — submucoso pediculado', '1 — submucoso < 50% intramural', '2 — submucoso ≥ 50% intramural',
    '3 — intramural em contato com o endométrio', '4 — intramural',
    '5 — subseroso ≥ 50% intramural', '6 — subseroso < 50% intramural', '7 — subseroso pediculado',
    '8 — outro (cervical / parasita)',
  ] },
  { id: 'loc', label: 'Localização', kind: 'select', options: ['parede anterior', 'parede posterior', 'fúndico', 'lateral direita', 'lateral esquerda', 'ístmico', 'cervical'] },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'degeneracao', label: 'Degeneração', kind: 'select', options: ['ausente', 'hialina', 'cística', 'calcificação', 'necrose'] },
];

/** Formação anexial com descritores IOTA → sugestão O-RADS automática. */
const FORMACAO_ORADS: StructuredFieldDef[] = [
  { id: 'lado', label: 'Lado', kind: 'select', options: ['ovário direito', 'ovário esquerdo', 'extra-ovariana'] },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  // descritores lidos pelo oradsSuggest (ids fixos)
  { id: 'tipo', label: 'Tipo', kind: 'select', options: ['unilocular', 'unilocular sólida', 'multilocular', 'multilocular sólida', 'sólida'] },
  { id: 'conteudo', label: 'Conteúdo', kind: 'select', options: ['anecoico', 'de vidro fosco', 'hemorrágico', 'espesso/heterogêneo'] },
  { id: 'septos', label: 'Septos / projeções', kind: 'select', options: ['ausentes', 'septos finos', 'septos espessos', 'projeções papilares'] },
  { id: 'vascularizacao', label: 'Fluxo (color score IOTA)', kind: 'select', options: ['1 – ausente', '2 – mínimo', '3 – moderado', '4 – marcante'] },
  { id: 'orads', label: 'Categoria O-RADS', kind: 'select', calcId: 'orads-us-2022', options: ['O-RADS 1', 'O-RADS 2', 'O-RADS 3', 'O-RADS 4', 'O-RADS 5'], hint: 'sugestão automática pelos descritores' },
];

/** Nódulo de endometriose profunda (mapa cirúrgico — IDEA/#Enzian). */
const FOCO_DIE: StructuredFieldDef[] = [
  { id: 'sitio', label: 'Sítio', kind: 'select', options: [
    'ligamento uterossacro direito', 'ligamento uterossacro esquerdo', 'torus uterino',
    'septo retovaginal', 'fórnice vaginal posterior', 'retossigmoide', 'bexiga',
    'ureter direito', 'ureter esquerdo', 'parede abdominal', 'outro',
  ] },
  { id: 'dims', label: 'Dimensões (L × T × AP)', kind: 'triplet', unit: 'mm', calcId: 'volume-elipsoide' },
  { id: 'distancia_anal', label: 'Distância da margem anal', kind: 'measure', unit: 'cm', hint: 'obrigatório em lesão intestinal', showIf: { field: 'sitio', equals: 'retossigmoide' } },
  { id: 'infiltracao', label: 'Camada infiltrada', kind: 'select', options: ['serosa', 'muscular própria', 'submucosa', 'indeterminada'] },
];

// ─── Seções compartilhadas ───

const UTERO = (): StructuredSection => ({
  id: 'utero',
  label: 'Útero',
  normalable: true,
  normalText: 'tópico, contornos regulares, miométrio de ecotextura homogênea, sem nódulos miomatosos ou sinais de adenomiose',
  fields: [
    // id canônico p/ volume por elipsoide; medida de rotina → fica no card Normal
    { id: 'utero_dims', label: 'Dimensões (L × AP × T)', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '≤ 90 cm³ (menacme)', alwaysShow: true, hint: 'volume uterino por elipsoide' },
    { id: 'utero_pos', label: 'Posição', kind: 'select', options: ['anteversoflexão', 'retroversoflexão', 'medioversão'], alwaysShow: true },
    { id: 'miometrio', label: 'Miométrio', kind: 'select', options: ['homogêneo', 'heterogêneo (adenomiose — MUSA)', 'com nódulos miomatosos'] },
    { id: 'musa', label: 'Sinais MUSA de adenomiose', kind: 'multiselect', options: ['ilhas endometriais', 'cistos miometriais', 'sombras em leque', 'linhas/brotos subendometriais', 'zona juncional irregular', 'útero globoso', 'assimetria de paredes'], showIf: { field: 'miometrio', equals: 'heterogêneo (adenomiose — MUSA)' } },
    { id: 'utero_obs', label: 'Outros achados', kind: 'text', fullWidth: true, placeholder: 'malformação, cicatriz de cesárea (istmocele)…' },
  ],
  // Miomas só aparecem quando o útero está 'Alterado'.
  repeatGroup: { id: 'miomas', itemLabel: 'Mioma', addLabel: 'Adicionar mioma', fields: MIOMA_FIGO },
});

const ENDOMETRIO = (): StructuredSection => ({
  id: 'endometrio',
  label: 'Endométrio',
  normalable: true,
  normalText: 'eco endometrial homogêneo e regular, compatível com a fase do ciclo / status menopausal; cavidade sem imagens focais',
  fields: [
    // ids canônicos: liveCompute alerta espessamento conforme o estado hormonal
    { id: 'endometrio_esp', label: 'Espessura', kind: 'measure', unit: 'mm', normal: '≤ 5 mm (pós-menopausa sem TH)', alwaysShow: true, hint: 'menacme: varia com a fase do ciclo · com TH o limiar sobe (auto)' },
    // a terapia hormonal MUDA o limiar: sem TH ≤ 5 mm · cíclica ≤ 8 · contínua ≤ 6
    { id: 'menopausa', label: 'Estado hormonal', kind: 'select', options: ['menacme', 'pós-menopausa sem TH', 'pós-menopausa com TH cíclica', 'pós-menopausa com TH contínua'], alwaysShow: true, hint: 'define o limiar de espessura (auto)' },
    { id: 'endometrio_asp', label: 'Aspecto (IETA)', kind: 'select', options: ['trilaminar', 'homogêneo hiperecogênico', 'heterogêneo', 'com imagem focal'] },
    { id: 'cavidade', label: 'Cavidade / conteúdo', kind: 'text', fullWidth: true, placeholder: 'líquido, sinéquia, DIU (posição / distância do fundo)' },
  ],
  repeatGroup: {
    id: 'focais',
    itemLabel: 'Lesão',
    addLabel: 'Adicionar lesão endometrial',
    fields: [
      { id: 'tipo', label: 'Tipo', kind: 'select', options: ['pólipo', 'espessamento focal', 'restos ovulares', 'suspeita de neoplasia'] },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'mm', calcId: 'volume-elipsoide' },
      { id: 'pediculo', label: 'Pedículo vascular (Doppler)', kind: 'select', options: ['não avaliado', 'ausente', 'único (sugere pólipo)', 'múltiplos/caótico'] },
    ],
  },
});

const COLO = (): StructuredSection => ({
  id: 'colo',
  label: 'Colo Uterino',
  normalable: true,
  normalText: 'morfologia e ecotextura preservadas, sem cistos de Naboth volumosos, pólipos ou lesões suspeitas',
  fields: [
    { id: 'colo_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'cisto de Naboth, pólipo endocervical, lesão suspeita (dimensões)' },
  ],
});

const OVARIO = (side: 'direito' | 'esquerdo'): StructuredSection => {
  const s = side === 'direito' ? 'd' : 'e';
  return {
    id: `ovario-${side}`,
    label: `Ovário ${side === 'direito' ? 'Direito' : 'Esquerdo'}`,
    normalable: true,
    normalText: 'tópico, dimensões e volume normais, com folículos de permeio, sem lesões focais (O-RADS 1)',
    fields: [
      // ids canônicos: volume + CFA alimentam a morfologia de SOP no liveCompute
      { id: `ov${s}_dims`, label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '< 10 cm³', alwaysShow: true, hint: 'volume ovariano por elipsoide' },
      { id: `ov${s}_afc`, label: 'Folículos antrais (CFA)', kind: 'measure', normal: '< 12 por ovário', alwaysShow: true, hint: 'SOP se ≥ 20 ou volume > 10 cm³ (auto)' },
      { id: `ov${s}_desc`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'folículo dominante, corpo lúteo, mobilidade' },
    ],
  };
};

const ANEXOS = (): StructuredSection =>
  achados('anexos', 'Formações Anexiais', 'Formação', FORMACAO_ORADS, {
    normalText: 'anexos sem formações focais (O-RADS 1)',
    score: 'orads',
    addLabel: 'Adicionar formação',
  });

const DOUGLAS = (): StructuredSection => ({
  id: 'douglas',
  label: 'Fundo de Saco de Douglas',
  normalable: true,
  normalText: 'ausência de líquido livre em quantidade significativa ou coleções',
  fields: [
    { id: 'douglas_liq', label: 'Líquido livre', kind: 'select', options: ['pequena quantidade (fisiológico)', 'moderada', 'volumosa', 'coleção organizada'] },
    { id: 'douglas_desc', label: 'Detalhe', kind: 'text', fullWidth: true },
  ],
});

const BEXIGA_VIA_ABD = (): StructuredSection => ({
  id: 'bexiga',
  label: 'Bexiga (janela acústica)',
  normalable: true,
  normalText: 'repleção adequada, paredes finas e regulares, conteúdo anecoico',
  fields: [
    { id: 'bexiga_repl', label: 'Repleção', kind: 'select', options: ['adequada', 'insatisfatória (limita o exame)'], alwaysShow: true },
    { id: 'bexiga_desc', label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const DOPPLER_GIN = (): StructuredSection => ({
  id: 'estudo-doppler',
  label: 'Estudo Doppler',
  normalable: true,
  normalText: 'fluxo ovariano preservado bilateralmente, sem vascularização anômala em lesões focais',
  fields: [
    { id: 'fluxo_ov', label: 'Fluxo ovariano', kind: 'select', options: ['preservado bilateralmente', 'reduzido à direita', 'reduzido à esquerda', 'ausente (torção?)'], alwaysShow: true },
    { id: 'ip_uta_gin', label: 'IP artérias uterinas (média)', kind: 'measure', alwaysShow: true, hint: 'índice de resistência do leito uterino' },
    { id: 'doppler_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'vascularização de lesão focal, sinal do redemoinho' },
  ],
});

/** Nota da via abdominal (limitação metodológica do próprio prompt). */
const VIA_ABDOMINAL = (): StructuredSection => ({
  id: 'via-abdominal',
  label: 'Técnica (via abdominal)',
  normalable: true,
  normalText: 'exame realizado por via suprapúbica com bexiga repleta; a via endovaginal é preferível para detalhamento endometrial e ovariano',
  fields: [
    { id: 'via_limitacao', label: 'Limitação', kind: 'text', fullWidth: true, placeholder: 'meteorismo, obesidade, bexiga com repleção insuficiente' },
  ],
});

// ─── Modelos por exame ───

const PELVICA_TV = (doppler: boolean): StructuredSection[] => [
  UTERO(), ENDOMETRIO(), COLO(),
  OVARIO('direito'), OVARIO('esquerdo'), ANEXOS(), DOUGLAS(),
  ...(doppler ? [DOPPLER_GIN()] : []),
];

const PELVICA_ABD = (doppler: boolean): StructuredSection[] => [
  VIA_ABDOMINAL(), BEXIGA_VIA_ABD(),
  UTERO(), ENDOMETRIO(), COLO(),
  OVARIO('direito'), OVARIO('esquerdo'), ANEXOS(), DOUGLAS(),
  ...(doppler ? [DOPPLER_GIN()] : []),
];

const ENDOMETRIOSE = (): StructuredSection[] => [
  {
    id: 'utero-endometrio',
    label: 'Útero e Endométrio',
    normalable: true,
    normalText: 'morfologia preservada, miométrio homogêneo, sem sinais de adenomiose (MUSA); endométrio regular',
    fields: [
      { id: 'utero_dims', label: 'Dimensões uterinas', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '≤ 90 cm³', alwaysShow: true },
      { id: 'adenomiose', label: 'Adenomiose (MUSA)', kind: 'select', options: ['ausente', 'focal', 'difusa', 'adenomioma'] },
      { id: 'musa_sinais', label: 'Sinais MUSA', kind: 'multiselect', options: ['ilhas endometriais', 'cistos miometriais', 'sombras em leque', 'brotos subendometriais', 'zona juncional irregular', 'útero globoso'], showIf: { field: 'adenomiose' } },
      { id: 'zj', label: 'Zona juncional (máxima)', kind: 'measure', unit: 'mm', hint: 'espessada se > 12 mm' },
    ],
  },
  {
    id: 'ovarios-endometriose',
    label: 'Ovários',
    normalable: true,
    normalText: 'tópicos e móveis, sem endometriomas; ausência de "kissing ovaries"',
    fields: [
      { id: 'kissing', label: '"Kissing ovaries"', kind: 'select', options: ['ausente', 'presente (aderência)'] },
      { id: 'mobilidade', label: 'Mobilidade', kind: 'select', options: ['preservada', 'reduzida/fixo à direita', 'reduzida/fixo à esquerda', 'reduzida bilateral'] },
    ],
    repeatGroup: {
      id: 'endometriomas',
      itemLabel: 'Endometrioma',
      addLabel: 'Adicionar endometrioma',
      fields: [
        { id: 'lado', label: 'Lado', kind: 'select', options: ['ovário direito', 'ovário esquerdo'] },
        { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
        { id: 'conteudo', label: 'Conteúdo', kind: 'select', options: ['vidro fosco homogêneo (típico)', 'com septos', 'com componente sólido (atípico)'] },
      ],
    },
  },
  {
    id: 'compartimento-anterior',
    label: 'Compartimento Anterior',
    normalable: true,
    normalText: 'bexiga sem nódulos parietais; sinal do deslizamento anterior preservado; ureteres distais sem dilatação',
    fields: [
      { id: 'sliding_ant', label: 'Sinal do deslizamento anterior', kind: 'select', options: ['preservado (negativo)', 'ausente (aderência)'], alwaysShow: true },
      { id: 'bexiga_nodulo', label: 'Nódulo vesical', kind: 'select', options: ['ausente', 'presente'] },
      { id: 'ureteres', label: 'Ureteres distais', kind: 'select', options: ['sem dilatação', 'dilatação à direita', 'dilatação à esquerda'] },
    ],
  },
  {
    id: 'compartimento-posterior',
    label: 'Compartimento Posterior',
    normalable: true,
    normalText: 'sinal do deslizamento posterior preservado; Douglas livre; uterossacros ≤ 3 mm; septo retovaginal e retossigmoide sem nódulos',
    fields: [
      { id: 'sliding_post', label: 'Sinal do deslizamento posterior', kind: 'select', options: ['preservado (negativo)', 'ausente (Douglas obliterado)'], alwaysShow: true },
      { id: 'uterossacro_d', label: 'Uterossacro direito', kind: 'measure', unit: 'mm', normal: '≤ 3 mm', alwaysShow: true },
      { id: 'uterossacro_e', label: 'Uterossacro esquerdo', kind: 'measure', unit: 'mm', normal: '≤ 3 mm', alwaysShow: true },
      { id: 'retossigmoide', label: 'Retossigmoide', kind: 'select', options: ['sem nódulos', 'nódulo (descrever no mapa)'] },
    ],
  },
  {
    id: 'parametrios',
    label: 'Paramétrios',
    normalable: true,
    normalText: 'sem nódulos ou aderências adjacentes aos ureteres e vasos ilíacos',
    fields: [
      { id: 'parametrio_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  achados('focos-die', 'Focos de Endometriose Profunda (mapa)', 'Foco', FOCO_DIE, {
    normalText: 'sem focos de endometriose profunda identificados',
    addLabel: 'Adicionar foco',
  }),
  DOUGLAS(),
];

export const GINECOLOGIA_SCHEMAS: StandardSchemaDef[] = [
  // ENDOMETRIOSE e as variantes COM DOPPLER antes das genéricas
  { name: 'PÉLVICA — ENDOMETRIOSE', match: /endometriose/, sections: ENDOMETRIOSE },
  { name: 'PÉLVICA TRANSVAGINAL COM DOPPLER', match: /transvaginal com doppler/, sections: () => PELVICA_TV(true) },
  { name: 'PÉLVICA TRANSVAGINAL', match: /transvaginal/, sections: () => PELVICA_TV(false) },
  { name: 'PÉLVICA ABDOMINAL COM DOPPLER', match: /abdominal com doppler/, sections: () => PELVICA_ABD(true) },
  { name: 'PÉLVICA ABDOMINAL', match: /abdominal/, sections: () => PELVICA_ABD(false) },
];
