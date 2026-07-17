import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';
import { TIRADS_OPTIONS } from '../scoring';

/**
 * MODELOS PADRÃO — PROCEDIMENTOS (10 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions. Todo procedimento guiado tem a
 * mesma espinha: ALVO (com o léxico da área de origem) → indicação → técnica →
 * material → controle pós → intercorrências.
 *
 * - PAAF TIREOIDE herda os descritores ACR TI-RADS e o escore ao vivo
 *   (`TIRADS_OPTIONS` de scoring.ts — mesma fonte da máscara de tireoide);
 * - PAAF MAMA herda o léxico BI-RADS do US ([[reference_birads_v2025]]:
 *   'lobulada' é forma do v2025 e 'microlobulada' PERMANECE margem distinta no
 *   US — a fusão em 'indistinta' é mamográfica);
 * - os procedimentos fetais herdam a datação canônica (`dum` → IG/DPP auto).
 *
 * ⚠️ O id de campo simples é GLOBAL no formulário — ids escopados por seção.
 */

const BIRADS_CAT = ['BI-RADS 1', 'BI-RADS 2', 'BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 4C', 'BI-RADS 5', 'BI-RADS 6'];
const TIRADS_CAT = ['TR1', 'TR2', 'TR3', 'TR4', 'TR5'];
const AGULHA_PAAF = ['22G', '23G', '25G', '27G'];
const AGULHA_CORE = ['14G', '16G', '18G', '20G'];

/** Seção de ACHADOS: Normal por padrão; 'Alterado' revela a lista repetível. */
function achados(
  id: string,
  label: string,
  itemLabel: string,
  fields: StructuredFieldDef[],
  opts: { normalText: string; addLabel?: string }
): StructuredSection {
  return {
    id,
    label,
    normalable: true,
    normalText: opts.normalText,
    fields: [],
    repeatGroup: { id: 'item', itemLabel, addLabel: opts.addLabel, fields },
  };
}

const compartimento = (
  id: string,
  label: string,
  normalText: string,
  extra: StructuredFieldDef[] = []
): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [...extra, { id: `desc_${id}`, label: 'Achados', kind: 'text', fullWidth: true }],
});

// ─────────────────────────── Blocos compartilhados ───────────────────────────

/** Indicação clínica — não é normalável: todo procedimento tem uma. */
const INDICACAO = (placeholder: string): StructuredSection => ({
  id: 'indicacao',
  label: 'Indicação Clínica',
  fields: [
    { id: 'indicacao_txt', label: 'Indicação', kind: 'text', fullWidth: true, alwaysShow: true, placeholder },
    { id: 'consentimento', label: 'Consentimento informado', kind: 'select', options: ['obtido', 'não obtido'], alwaysShow: true },
    { id: 'antiagregacao', label: 'Antiagregação / anticoagulação', kind: 'text', alwaysShow: true, placeholder: 'suspensa há X dias / em uso / não aplicável' },
  ],
});

/** Técnica do procedimento — o registro que sustenta a rastreabilidade. */
const TECNICA = (opts: { agulhas: string[]; passagensLabel?: string }): StructuredSection => ({
  id: 'tecnica',
  label: 'Técnica e Procedimento',
  fields: [
    { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)', 'não realizadas'], alwaysShow: true },
    { id: 'anestesia', label: 'Anestesia local', kind: 'text', alwaysShow: true, placeholder: 'lidocaína 2% sem vasoconstritor, X ml' },
    { id: 'agulha', label: 'Agulha', kind: 'select', options: opts.agulhas, alwaysShow: true },
    { id: 'via', label: 'Via de acesso', kind: 'text', alwaysShow: true, placeholder: 'ex: anterior, transversal, guiada em tempo real' },
    { id: 'passagens', label: opts.passagensLabel || 'Número de passagens', kind: 'measure', alwaysShow: true },
    { id: 'tecnica_desc', label: 'Descrição do procedimento', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'punção guiada por US em tempo real, com visualização da ponta da agulha' },
  ],
});

/** Material coletado / enviado. */
const MATERIAL = (): StructuredSection => ({
  id: 'material',
  label: 'Material Coletado e Encaminhamento',
  fields: [
    { id: 'material_aspecto', label: 'Aspecto', kind: 'select', options: ['citológico satisfatório', 'hemático', 'coloide', 'purulento', 'seroso', 'escasso/insuficiente'], alwaysShow: true },
    { id: 'material_volume', label: 'Volume aspirado', kind: 'measure', unit: 'ml', alwaysShow: true },
    { id: 'material_envio', label: 'Encaminhado para', kind: 'multiselect', options: ['citologia', 'histopatologia', 'cultura + antibiograma', 'bioquímica', 'citometria de fluxo', 'cariótipo / biologia molecular'], alwaysShow: true },
    { id: 'material_desc', label: 'Observações', kind: 'text', fullWidth: true },
  ],
});

/** Controle pós-procedimento + intercorrências. */
const CONTROLE = (normalText: string): StructuredSection =>
  compartimento('controle', 'Controle Pós-Procedimento Imediato', normalText, [
    { id: 'hemostasia', label: 'Hemostasia', kind: 'select', options: ['adequada (compressão local)', 'inadequada'], alwaysShow: true },
  ]);

const INTERCORRENCIAS = (): StructuredSection =>
  compartimento('intercorrencias', 'Intercorrências', 'procedimento sem intercorrências; paciente encaminhado em boas condições clínicas', [
    { id: 'intercorrencia', label: 'Intercorrência', kind: 'multiselect', options: ['nenhuma', 'dor', 'sangramento / hematoma', 'reação vagal', 'infecção', 'lesão de estrutura adjacente', 'pneumotórax'] },
  ]);

// ─────────────────────────────── PAAF TIREOIDE ───────────────────────────────

/** Nódulo-alvo no léxico ACR TI-RADS — escore ao vivo, igual à máscara de tireoide. */
const PAAF_TIREOIDE = (): StructuredSection[] => [
  INDICACAO('nódulo TR4/TR5 acima do limiar de tamanho, crescimento, linfonodo suspeito'),
  {
    id: 'nodulo-alvo',
    label: 'Nódulo Alvo',
    score: 'tirads',
    fields: [
      { id: 'nodulo_local', label: 'Localização', kind: 'select', options: ['lobo direito', 'lobo esquerdo', 'istmo'], alwaysShow: true },
      { id: 'nodulo_terco', label: 'Terço', kind: 'select', options: ['superior', 'médio', 'inferior'], alwaysShow: true },
      { id: 'nodulo_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true },
      // descritores do escore — mesmos valores de TIRADS_OPTIONS
      { id: 'composicao', label: 'Composição', kind: 'select', scoreKey: 'composition', options: TIRADS_OPTIONS.composition, alwaysShow: true },
      { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', scoreKey: 'echogenicity', options: TIRADS_OPTIONS.echogenicity, alwaysShow: true },
      { id: 'forma', label: 'Forma', kind: 'select', scoreKey: 'shape', options: TIRADS_OPTIONS.shape, alwaysShow: true },
      { id: 'margem', label: 'Margem', kind: 'select', scoreKey: 'margin', options: TIRADS_OPTIONS.margin, alwaysShow: true },
      { id: 'focos', label: 'Focos ecogênicos', kind: 'multiselect', scoreKey: 'foci', options: TIRADS_OPTIONS.foci, alwaysShow: true, hint: 'os focos somam pontos entre si' },
      { id: 'tirads_cat', label: 'Classificação ACR TI-RADS', kind: 'select', calcId: 'tirads-2017', options: TIRADS_CAT, alwaysShow: true, hint: 'a sugestão automática não substitui o julgamento' },
    ],
  },
  TECNICA({ agulhas: AGULHA_PAAF, passagensLabel: 'Número de punções' }),
  MATERIAL(),
  compartimento('complicacoes', 'Complicações Imediatas', 'sem complicações imediatas; sem hematoma cervical ou alteração da voz', [
    { id: 'complicacao_tireoide', label: 'Complicação', kind: 'multiselect', options: ['nenhuma', 'hematoma cervical', 'dor local', 'reação vagal', 'disfonia'] },
  ]),
];

// ───────────────────────────────── PAAF MAMA ─────────────────────────────────

const PAAF_MAMA = (): StructuredSection[] => [
  INDICACAO('lesão BI-RADS 4/5, cisto complicado sintomático, linfonodo axilar suspeito'),
  {
    id: 'lesao-alvo',
    label: 'Lesão-Alvo',
    score: 'birads',
    fields: [
      { id: 'mama', label: 'Mama', kind: 'select', options: ['direita', 'esquerda'], alwaysShow: true },
      { id: 'lesao_loc', label: 'Localização (hora / distância da papila)', kind: 'text', alwaysShow: true, placeholder: 'ex: 10h, a 3 cm da papila' },
      { id: 'lesao_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true },
      { id: 'forma', label: 'Forma', kind: 'select', options: ['oval', 'redonda', 'lobulada', 'irregular'], alwaysShow: true, hint: 'lobulada: descritor do v2025' },
      { id: 'orientacao', label: 'Orientação', kind: 'select', options: ['paralela', 'não paralela (mais alta que larga)'], alwaysShow: true },
      { id: 'margem', label: 'Margem', kind: 'select', options: ['circunscrita', 'indistinta', 'angular', 'microlobulada', 'espiculada'], alwaysShow: true, hint: 'no US a microlobulada permanece distinta' },
      { id: 'eco', label: 'Ecotextura', kind: 'select', options: ['anecoico', 'hipoecoico', 'isoecoico', 'hiperecoico', 'heterogêneo', 'complexo cístico-sólido'], alwaysShow: true },
      { id: 'acusticas', label: 'Achados acústicos posteriores', kind: 'select', options: ['nenhuma', 'reforço acústico posterior', 'sombra acústica', 'padrão combinado'], alwaysShow: true },
      { id: 'calcificacoes', label: 'Calcificações associadas', kind: 'select', options: ['ausentes', 'em massa', 'fora de massa'] },
      { id: 'vasc', label: 'Vascularização ao Doppler', kind: 'select', options: ['não avaliada', 'ausente', 'interna', 'periférica / em anel', 'mista'] },
      { id: 'birads', label: 'Classificação da lesão-alvo', kind: 'select', calcId: 'birads-us-2013', options: BIRADS_CAT, alwaysShow: true, hint: 'a sugestão automática não substitui o julgamento' },
    ],
  },
  TECNICA({ agulhas: AGULHA_PAAF, passagensLabel: 'Número de punções' }),
  MATERIAL(),
  CONTROLE('sem hematoma ou coleção no sítio de punção; hemostasia adequada'),
  INTERCORRENCIAS(),
];

// ───────────────────── PUNÇÃO/BIÓPSIA DE LINFONODO ─────────────────────

const PUNCAO_LINFONODO = (): StructuredSection[] => [
  INDICACAO('linfonodo com critérios de suspeição, estadiamento, suspeita de linfoma ou doença granulomatosa'),
  {
    id: 'linfonodo-alvo',
    label: 'Linfonodo Alvo',
    fields: [
      { id: 'ln_cadeia', label: 'Cadeia / nível', kind: 'text', alwaysShow: true, placeholder: 'ex: cervical nível III à direita, axilar nível I' },
      { id: 'ln_eixos', label: 'Maior × menor eixo', kind: 'text', alwaysShow: true, placeholder: 'ex: 2,2 × 1,4 cm' },
      { id: 'ln_cortex', label: 'Espessura cortical', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 3 mm', hint: 'critério mais sensível de suspeição' },
      { id: 'ln_hilo', label: 'Hilo gorduroso', kind: 'select', options: ['preservado/central', 'deslocado', 'ausente'], alwaysShow: true },
      { id: 'ln_forma', label: 'Forma (índice L:T)', kind: 'select', options: ['oval (L:T ≥ 2) — habitual', 'arredondado (L:T < 2) — suspeito'], alwaysShow: true },
      { id: 'ln_vasc', label: 'Vascularização', kind: 'select', options: ['hilar (habitual)', 'periférica/capsular', 'caótica', 'ausente'], alwaysShow: true },
    ],
  },
  TECNICA({ agulhas: [...AGULHA_PAAF, ...AGULHA_CORE], passagensLabel: 'Número de passagens' }),
  MATERIAL(),
  CONTROLE('sem hematoma ou coleção no sítio de punção; hemostasia adequada'),
  INTERCORRENCIAS(),
];

// ───────────────────── PUNÇÃO/DRENAGEM DE CISTO ─────────────────────

const PUNCAO_CISTO = (): StructuredSection[] => [
  INDICACAO('cisto sintomático, cisto complicado, suspeita de infecção'),
  {
    id: 'avaliacao-pre',
    label: 'Avaliação Pré-Procedimento',
    fields: [
      { id: 'cisto_local', label: 'Localização', kind: 'text', alwaysShow: true },
      { id: 'cisto_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true, hint: 'o volume estimado orienta o esperado no aspirado' },
      { id: 'cisto_conteudo', label: 'Conteúdo', kind: 'select', options: ['anecoico simples', 'espesso / debris', 'septado', 'com componente sólido'], alwaysShow: true, hint: 'componente sólido: considerar biópsia em vez de punção' },
      { id: 'cisto_parede', label: 'Parede', kind: 'select', options: ['fina e regular', 'espessa/irregular'], alwaysShow: true },
    ],
  },
  TECNICA({ agulhas: [...AGULHA_PAAF, '20G', '18G'], passagensLabel: 'Número de punções' }),
  {
    id: 'material-coletado',
    label: 'Características do Material Coletado',
    fields: [
      { id: 'aspirado_volume', label: 'Volume aspirado', kind: 'measure', unit: 'ml', alwaysShow: true },
      { id: 'aspirado_aspecto', label: 'Aspecto', kind: 'select', options: ['seroso citrino', 'hemático', 'achocolatado', 'purulento', 'leitoso', 'espesso'], alwaysShow: true },
      { id: 'aspirado_envio', label: 'Encaminhado para', kind: 'multiselect', options: ['citologia', 'cultura + antibiograma', 'bioquímica', 'não enviado'], alwaysShow: true },
    ],
  },
  compartimento('pos-procedimento', 'Achados Pós-Procedimento Imediato', 'colapso completo da cavidade cística, sem coleção residual significativa', [
    { id: 'residual', label: 'Cavidade residual', kind: 'select', options: ['colapso completo', 'residual mínima', 'residual significativa'], alwaysShow: true },
  ]),
  INTERCORRENCIAS(),
];

// ───────────────────────────────── CORE BIOPSY ─────────────────────────────────

const CORE_BIOPSY = (): StructuredSection[] => [
  INDICACAO('lesão sólida com indicação de diagnóstico histopatológico'),
  {
    id: 'lesao-alvo',
    label: 'Lesão Alvo',
    fields: [
      { id: 'alvo_local', label: 'Localização', kind: 'text', alwaysShow: true },
      { id: 'alvo_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true },
      { id: 'alvo_eco', label: 'Ecogenicidade', kind: 'select', options: ['hipoecoica', 'isoecoica', 'hiperecoica', 'heterogênea', 'complexa'], alwaysShow: true },
      { id: 'alvo_vasc', label: 'Vascularização', kind: 'select', options: ['ausente', 'periférica', 'interna', 'exuberante'], alwaysShow: true, hint: 'evitar o trajeto de vasos ao planejar a via' },
      { id: 'alvo_classificacao', label: 'Classificação prévia', kind: 'text', placeholder: 'ex: BI-RADS 4C, TR5' },
    ],
  },
  {
    id: 'tecnica',
    label: 'Técnica e Procedimento',
    fields: [
      { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)', 'não realizadas'], alwaysShow: true },
      { id: 'anestesia', label: 'Anestesia local', kind: 'text', alwaysShow: true, placeholder: 'lidocaína 2% sem vasoconstritor, X ml' },
      { id: 'agulha', label: 'Agulha (calibre)', kind: 'select', options: AGULHA_CORE, alwaysShow: true },
      { id: 'dispositivo', label: 'Dispositivo', kind: 'select', options: ['automático (pistola)', 'semiautomático', 'assistido a vácuo'], alwaysShow: true },
      { id: 'fragmentos', label: 'Número de fragmentos', kind: 'measure', alwaysShow: true },
      { id: 'via', label: 'Via de acesso', kind: 'text', alwaysShow: true },
      { id: 'marcador', label: 'Clipe marcador', kind: 'select', options: ['não colocado', 'colocado'] },
      { id: 'tecnica_desc', label: 'Descrição', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'agulha visualizada atravessando a lesão em tempo real' },
    ],
  },
  {
    id: 'material',
    label: 'Material Coletado e Encaminhamento',
    fields: [
      { id: 'frag_aspecto', label: 'Aspecto dos fragmentos', kind: 'select', options: ['representativos (esbranquiçados/firmes)', 'friáveis', 'hemáticos', 'escassos'], alwaysShow: true },
      { id: 'frag_envio', label: 'Encaminhado para', kind: 'multiselect', options: ['histopatologia', 'imuno-histoquímica', 'cultura + antibiograma', 'biologia molecular'], alwaysShow: true },
    ],
  },
  CONTROLE('sem hematoma significativo no sítio de biópsia; hemostasia adequada por compressão local'),
  INTERCORRENCIAS(),
];

// ───────────────────── Procedimentos fetais (datação canônica) ─────────────────────

/** Datação — `dum` é o id canônico que gera IG/DPP automáticos. */
const DATACAO_PROC = (): StructuredSection => ({
  id: 'datacao',
  label: 'Datação',
  fields: [
    { id: 'dum', label: 'DUM', kind: 'text', placeholder: 'dd/mm/aaaa', alwaysShow: true, hint: 'gera IG e DPP automáticos' },
    { id: 'ig_proc', label: 'IG no dia do procedimento', kind: 'text', alwaysShow: true, placeholder: 'ex: 12s3d' },
  ],
});

const PRE_FETAL = (extra: StructuredFieldDef[] = []): StructuredSection[] => [
  compartimento('placenta', 'Placenta', 'placenta de localização e ecotextura habituais, sem descolamento', [
    { id: 'placenta_local', label: 'Localização', kind: 'select', options: ['anterior', 'posterior', 'fúndica', 'lateral direita', 'lateral esquerda', 'prévia'], alwaysShow: true, hint: 'define a via de punção' },
  ]),
  compartimento('liquido', 'Líquido Amniótico', 'líquido amniótico em quantidade normal', [
    { id: 'ila', label: 'ILA', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid', alwaysShow: true },
    { id: 'mbv', label: 'Maior bolsão vertical', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid', alwaysShow: true },
  ]),
  compartimento('vitalidade', 'Vitalidade Fetal (pré-procedimento)', 'feto vivo, com batimentos cardíacos presentes e movimentação preservada', [
    { id: 'bcf_pre', label: 'BCF', kind: 'measure', unit: 'bpm', alwaysShow: true, normal: '110–160 bpm' },
    ...extra,
  ]),
];

const POS_FETAL = (): StructuredSection[] => [
  compartimento('vitalidade-pos', 'Vitalidade Fetal (pós-procedimento)', 'feto vivo, com batimentos cardíacos presentes e mantidos após o procedimento', [
    { id: 'bcf_pos', label: 'BCF', kind: 'measure', unit: 'bpm', alwaysShow: true, normal: '110–160 bpm' },
  ]),
  compartimento('sitio-puncao', 'Sítio de Punção', 'sítio de punção sem sangramento, hematoma ou descolamento', [
    { id: 'sitio_sangramento', label: 'Sangramento no sítio', kind: 'select', options: ['ausente', 'presente'], alwaysShow: true },
  ]),
  INTERCORRENCIAS(),
];

const BIOPSIA_VILO = (): StructuredSection[] => [
  INDICACAO('rastreio de alto risco para aneuploidia, translucência nucal aumentada, doença monogênica'),
  DATACAO_PROC(),
  ...PRE_FETAL([
    { id: 'ccn', label: 'CCN', kind: 'measure', unit: 'mm', calcId: 'gestational-age', alwaysShow: true, hint: 'a BVC é feita entre 11 e 13+6 semanas' },
  ]),
  {
    id: 'tecnica',
    label: 'Descrição do Procedimento',
    fields: [
      { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)'], alwaysShow: true },
      { id: 'via_bvc', label: 'Técnica de punção', kind: 'select', options: ['transabdominal', 'transcervical'], alwaysShow: true },
      { id: 'agulha_bvc', label: 'Agulha', kind: 'select', options: ['18G', '19G', '20G'], alwaysShow: true },
      { id: 'passagens_bvc', label: 'Número de passagens', kind: 'measure', alwaysShow: true, hint: '> 2 passagens aumenta o risco de perda' },
      { id: 'amostra_bvc', label: 'Amostra coletada', kind: 'text', alwaysShow: true, placeholder: 'ex: 15 mg de vilosidades coriônicas' },
      { id: 'envio_bvc', label: 'Encaminhamento', kind: 'multiselect', options: ['cariótipo', 'QF-PCR', 'array-CGH', 'painel monogênico'], alwaysShow: true },
    ],
  },
  ...POS_FETAL(),
];

const AMNIOCENTESE = (): StructuredSection[] => [
  INDICACAO('rastreio de alto risco para aneuploidia, infecção congênita, isoimunização'),
  DATACAO_PROC(),
  ...PRE_FETAL(),
  {
    id: 'tecnica',
    label: 'Descrição do Procedimento',
    fields: [
      { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)'], alwaysShow: true },
      { id: 'agulha_amnio', label: 'Agulha', kind: 'select', options: ['20G', '22G'], alwaysShow: true },
      { id: 'bolsao_puncao', label: 'Bolsão puncionado', kind: 'text', alwaysShow: true, placeholder: 'ex: bolsão livre em flanco esquerdo, sem interposição placentária' },
      { id: 'passagens_amnio', label: 'Número de passagens', kind: 'measure', alwaysShow: true },
      { id: 'volume_amnio', label: 'Volume aspirado', kind: 'measure', unit: 'ml', alwaysShow: true, hint: 'em geral ~20 ml; descartar o primeiro 1–2 ml (contaminação materna)' },
      { id: 'aspecto_amnio', label: 'Aspecto do líquido', kind: 'select', options: ['claro citrino', 'hemático', 'meconial', 'turvo'], alwaysShow: true },
      { id: 'envio_amnio', label: 'Encaminhamento', kind: 'multiselect', options: ['cariótipo', 'QF-PCR', 'array-CGH', 'PCR para infecção', 'bioquímica'], alwaysShow: true },
    ],
  },
  ...POS_FETAL(),
];

// ───────────────────── DRENAGEM/PUNÇÃO DE COLEÇÃO ─────────────────────

const DRENAGEM_COLECAO = (): StructuredSection[] => [
  INDICACAO('coleção sintomática, suspeita de abscesso, drenagem terapêutica'),
  {
    id: 'avaliacao-pre',
    label: 'Avaliação Pré-Procedimento',
    fields: [
      { id: 'colecao_local', label: 'Localização', kind: 'text', alwaysShow: true },
      { id: 'colecao_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true, hint: 'o volume estimado orienta o esperado no aspirado' },
      { id: 'colecao_conteudo', label: 'Conteúdo', kind: 'select', options: ['anecoico', 'espesso / debris', 'septado', 'com gás (sugere infecção)'], alwaysShow: true },
      { id: 'colecao_parede', label: 'Parede / cápsula', kind: 'select', options: ['ausente', 'fina', 'espessa com hiperemia (abscesso organizado)'], alwaysShow: true },
      { id: 'colecao_via', label: 'Janela de acesso', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'trajeto seguro, evitando alças e vasos' },
    ],
  },
  {
    id: 'tecnica',
    label: 'Descrição do Procedimento',
    fields: [
      { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)'], alwaysShow: true },
      { id: 'anestesia', label: 'Anestesia local', kind: 'text', alwaysShow: true },
      { id: 'metodo_drenagem', label: 'Método', kind: 'select', options: ['punção aspirativa simples', 'drenagem com cateter (Seldinger)', 'drenagem com cateter (trocarte)'], alwaysShow: true },
      { id: 'cateter', label: 'Cateter', kind: 'text', placeholder: 'ex: pigtail 8 Fr', showIf: { field: 'metodo_drenagem', equals: 'drenagem com cateter (Seldinger)' } },
      { id: 'volume_drenado', label: 'Volume drenado', kind: 'measure', unit: 'ml', alwaysShow: true },
      { id: 'aspecto_drenado', label: 'Aspecto', kind: 'select', options: ['seroso', 'hemático', 'purulento', 'entérico', 'bilioso'], alwaysShow: true },
      { id: 'envio_drenado', label: 'Encaminhado para', kind: 'multiselect', options: ['cultura + antibiograma', 'Gram', 'citologia', 'bioquímica', 'BAAR/fungos'], alwaysShow: true },
    ],
  },
  compartimento('controle', 'Controle Pós-Procedimento Imediato', 'redução significativa da coleção, sem sangramento ou coleção residual relevante; cateter bem posicionado quando aplicável', [
    { id: 'residual_colecao', label: 'Coleção residual', kind: 'select', options: ['colapso completo', 'residual mínima', 'residual significativa'], alwaysShow: true },
  ]),
  INTERCORRENCIAS(),
];

// ─────────────────────────────── ACESSO VASCULAR ───────────────────────────────

const ACESSO_VASCULAR = (): StructuredSection[] => [
  INDICACAO('necessidade de acesso venoso central, punção difícil, quimioterapia, hemodiálise'),
  {
    id: 'avaliacao-pre',
    label: 'Avaliação Pré-Procedimento',
    fields: [
      { id: 'vaso_alvo', label: 'Vaso alvo', kind: 'select', options: ['jugular interna direita', 'jugular interna esquerda', 'subclávia direita', 'subclávia esquerda', 'femoral direita', 'femoral esquerda', 'basílica (PICC)', 'braquial (PICC)'], alwaysShow: true },
      { id: 'vaso_calibre', label: 'Calibre do vaso', kind: 'measure', unit: 'mm', alwaysShow: true },
      { id: 'vaso_compress', label: 'Compressibilidade / patência', kind: 'select', options: ['compressível e pérvio', 'trombo parcial', 'trombosado'], alwaysShow: true, hint: 'trombo contraindica a punção daquele vaso' },
      { id: 'vaso_relacao', label: 'Relação com a artéria', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'ex: veia lateral e superficial à artéria carótida' },
    ],
  },
  {
    id: 'tecnica',
    label: 'Descrição do Procedimento',
    fields: [
      { id: 'assepsia', label: 'Assepsia e antissepsia', kind: 'select', options: ['realizadas (clorexidina alcoólica)', 'realizadas (PVPI)'], alwaysShow: true },
      { id: 'anestesia', label: 'Anestesia local', kind: 'text', alwaysShow: true },
      { id: 'guia_us', label: 'Guia ultrassonográfica', kind: 'select', options: ['em tempo real (eixo curto)', 'em tempo real (eixo longo)', 'marcação prévia'], alwaysShow: true },
      { id: 'tentativas', label: 'Número de tentativas', kind: 'measure', alwaysShow: true },
      { id: 'cateter_vasc', label: 'Cateter', kind: 'text', alwaysShow: true, placeholder: 'ex: duplo lúmen 7 Fr, 20 cm' },
      { id: 'tecnica_vasc_desc', label: 'Descrição', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'técnica de Seldinger, fio-guia visualizado no interior do vaso' },
    ],
  },
  compartimento('controle', 'Controle Pós-Procedimento', 'cateter bem posicionado e pérvio; sem hematoma, punção arterial ou pneumotórax', [
    { id: 'posicionamento', label: 'Posicionamento', kind: 'select', options: ['adequado', 'a confirmar por radiografia'], alwaysShow: true, hint: 'acessos torácicos exigem radiografia (pneumotórax/posição da ponta)' },
    { id: 'refluxo_cateter', label: 'Refluxo e infusão', kind: 'select', options: ['presentes', 'ausentes'], alwaysShow: true },
  ]),
  INTERCORRENCIAS(),
];

// ─────────────────────────────── ESCLEROTERAPIA ───────────────────────────────

const ESCLEROTERAPIA = (): StructuredSection[] => [
  INDICACAO('varizes sintomáticas, insuficiência de safena/tributárias, telangiectasias'),
  {
    id: 'alvo',
    label: 'Alvo / Território Tratado',
    fields: [
      { id: 'alvo_territorio', label: 'Território', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'ex: tributária da safena magna, face medial da perna direita' },
      { id: 'alvo_calibre', label: 'Calibre do vaso', kind: 'measure', unit: 'mm', alwaysShow: true },
      { id: 'alvo_refluxo', label: 'Refluxo pré-tratamento', kind: 'measure', unit: 's', alwaysShow: true, normal: '< 0,5 s', hint: 'refluxo > 0,5 s no sistema superficial é patológico' },
      { id: 'ceap', label: 'CEAP (clínico)', kind: 'select', options: ['C0', 'C1', 'C2', 'C3', 'C4a', 'C4b', 'C5', 'C6'], alwaysShow: true },
    ],
  },
  {
    id: 'tecnica',
    label: 'Técnica',
    fields: [
      { id: 'esclerosante', label: 'Agente esclerosante', kind: 'select', options: ['polidocanol', 'oleato de etanolamina', 'glicose hipertônica', 'tetradecil sulfato de sódio'], alwaysShow: true },
      { id: 'concentracao', label: 'Concentração', kind: 'text', alwaysShow: true, placeholder: 'ex: 1%' },
      { id: 'forma_esclero', label: 'Forma', kind: 'select', options: ['espuma (Tessari)', 'líquido'], alwaysShow: true },
      { id: 'volume_esclero', label: 'Volume total', kind: 'measure', unit: 'ml', alwaysShow: true, hint: 'respeitar o limite por sessão do agente escolhido' },
      { id: 'pontos_puncao', label: 'Número de punções', kind: 'measure', alwaysShow: true },
      { id: 'guia_esclero', label: 'Guia', kind: 'select', options: ['ecoguiada em tempo real', 'visual (telangiectasias)'], alwaysShow: true },
    ],
  },
  compartimento('controle-doppler', 'Controle Imediato (Doppler)', 'espasmo e oclusão do vaso tratado, com sistema venoso profundo pérvio e compressível', [
    { id: 'oclusao_alvo', label: 'Vaso tratado', kind: 'select', options: ['ocluído (espasmo/trombo)', 'parcialmente ocluído', 'pérvio'], alwaysShow: true },
    { id: 'profundo_pos', label: 'Sistema venoso profundo', kind: 'select', options: ['pérvio e compressível', 'trombo'], alwaysShow: true, hint: 'a extensão do esclerosante ao sistema profundo é a complicação temida' },
  ]),
  compartimento('intercorrencias', 'Intercorrências', 'procedimento sem intercorrências', [
    { id: 'intercorrencia_esclero', label: 'Intercorrência', kind: 'multiselect', options: ['nenhuma', 'dor', 'hiperpigmentação', 'matting', 'necrose cutânea', 'reação alérgica', 'TVP', 'escotomas / distúrbio visual', 'cefaleia'] },
  ]),
  {
    id: 'orientacoes',
    label: 'Orientações Pós-Procedimento',
    fields: [
      { id: 'meia_compressiva', label: 'Meia compressiva', kind: 'text', alwaysShow: true, placeholder: 'ex: 20–30 mmHg por 7 dias' },
      { id: 'orientacoes_desc', label: 'Orientações', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'deambulação precoce, evitar exposição solar e exercícios intensos' },
    ],
  },
];

// ─────────────────────────────── Registro ───────────────────────────────

export const PROCEDIMENTOS_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'PAAF TIREOIDE', match: /paaf tireoide/, sections: PAAF_TIREOIDE },
  { name: 'PAAF MAMA', match: /paaf mama/, sections: PAAF_MAMA },
  { name: 'PUNÇÃO/BIÓPSIA DE LINFONODO', match: /linfonodo/, sections: PUNCAO_LINFONODO },
  { name: 'PUNÇÃO/DRENAGEM DE CISTO', match: /cisto/, sections: PUNCAO_CISTO },
  { name: 'CORE BIOPSY', match: /core biopsy/, sections: CORE_BIOPSY },
  { name: 'BIÓPSIA DE VILO CORIÔNICO', match: /vilo cori[ôo]nico/, sections: BIOPSIA_VILO },
  { name: 'AMNIOCENTESE', match: /amniocentese/, sections: AMNIOCENTESE },
  { name: 'DRENAGEM/PUNÇÃO DE COLEÇÃO', match: /cole[çc][ãa]o/, sections: DRENAGEM_COLECAO },
  { name: 'ACESSO VASCULAR', match: /acesso vascular/, sections: ACESSO_VASCULAR },
  { name: 'ESCLEROTERAPIA', match: /escleroterapia/, sections: ESCLEROTERAPIA },
];
