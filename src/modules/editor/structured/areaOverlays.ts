import { StructuredSection, StructuredFieldDef } from '../../../types';
import { TIRADS_OPTIONS } from './scoring';

/**
 * Overlays curados por área — sobrepõem o parser genérico da máscara com
 * campos tipados, unidades e calculadoras ligadas, onde os placeholders da
 * máscara são ambíguos (ex.: biometria fetal com muitos "(...)").
 *
 * Cresce a cada etapa do rollout. Etapa 1 = Medicina Fetal (piloto).
 * Áreas sem overlay caem no parser genérico (deriveSchema).
 */

const FETAL_SECTIONS: StructuredSection[] = [
  {
    id: 'datacao',
    label: 'Datação',
    calcId: 'gestational-age',
    fields: [
      { id: 'dum', label: 'DUM', kind: 'text', placeholder: 'ex: 10/01/2025' },
      { id: 'ig', label: 'IG / DPP', kind: 'calc', calcId: 'gestational-age', hint: 'DUM ou USG anterior' },
      { id: 'ccn', label: 'CCN', kind: 'measure', unit: 'mm', calcId: 'crl-ccn', hint: '1º trimestre' },
      { id: 'dmsg', label: 'DMSG', kind: 'measure', unit: 'mm', calcId: 'msd-dmsg', hint: 'saco gestacional' },
    ],
  },
  {
    id: 'biometria',
    label: 'Biometria Fetal',
    calcId: 'who-fetal-biometry',
    fields: [
      { id: 'dbp', label: 'DBP', kind: 'measure', unit: 'mm' },
      { id: 'dof', label: 'DOF', kind: 'measure', unit: 'mm' },
      { id: 'cc', label: 'CC', kind: 'measure', unit: 'mm' },
      { id: 'ca', label: 'CA', kind: 'measure', unit: 'mm' },
      { id: 'cf', label: 'CF', kind: 'measure', unit: 'mm' },
      { id: 'pfe', label: 'PFE / Percentil', kind: 'calc', calcId: 'who-fetal-biometry', hint: 'Hadlock IV + percentil OMS' },
    ],
  },
  {
    id: 'vitalidade',
    label: 'Vitalidade',
    fields: [
      { id: 'bcf', label: 'BCF', kind: 'measure', unit: 'bpm' },
      { id: 'movimentos', label: 'Movimentos / Tônus', kind: 'text', placeholder: 'presentes' },
    ],
  },
  {
    id: 'doppler',
    label: 'Doppler Obstétrico',
    calcId: 'doppler-fetal',
    fields: [
      { id: 'ip_au', label: 'IP Art. Umbilical', kind: 'measure', calcId: 'doppler-fetal', hint: 'alterado se > p95' },
      { id: 'ip_acm', label: 'IP ACM', kind: 'measure', calcId: 'doppler-fetal', hint: 'redistribuição se < p5' },
      { id: 'rcp', label: 'RCP (ACM/AU)', kind: 'measure', hint: 'auto pelo IP ACM/AU; reduzida se < 1' },
      { id: 'ip_uta', label: 'IP Uterinas (média)', kind: 'measure', calcId: 'doppler-fetal', hint: 'risco se > p95 / notch bilateral' },
      { id: 'ducto_venoso', label: 'Ducto Venoso', kind: 'text', placeholder: 'onda A positiva' },
    ],
  },
  {
    id: 'liquido-amniotico',
    label: 'Líquido Amniótico',
    calcId: 'amniotic-fluid',
    fields: [
      { id: 'ila', label: 'ILA', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid', hint: 'normal 8–18 cm' },
      { id: 'mbv', label: 'MBV (maior bolsão)', kind: 'measure', unit: 'mm', calcId: 'amniotic-fluid', hint: 'normal 20–80 mm' },
    ],
  },
  {
    id: 'placenta',
    label: 'Placenta',
    fields: [
      { id: 'placenta_loc', label: 'Localização', kind: 'select', options: ['anterior', 'posterior', 'fúndica', 'lateral direita', 'lateral esquerda', 'prévia'] },
      { id: 'placenta_grau', label: 'Grau (Grannum)', kind: 'select', options: ['0', 'I', 'II', 'III'] },
    ],
  },
  {
    id: 'apresentacao',
    label: 'Estática Fetal',
    fields: [
      { id: 'apresentacao', label: 'Apresentação', kind: 'select', options: ['cefálica', 'pélvica', 'córmica', 'não se aplica'] },
      { id: 'situacao', label: 'Situação', kind: 'select', options: ['longitudinal', 'transversa', 'oblíqua'] },
    ],
  },
  {
    id: 'morfologia',
    label: 'Morfologia Fetal',
    normalable: true,
    normalText: 'anatomia fetal sem malformações detectáveis à idade gestacional',
    fields: [
      { id: 'snc', label: 'SNC (crânio/encéfalo)', kind: 'text', placeholder: 'alteração', fullWidth: true },
      { id: 'face', label: 'Face / perfil', kind: 'text', placeholder: 'alteração' },
      { id: 'coracao', label: 'Coração (4 câmaras/vias)', kind: 'text', placeholder: 'alteração' },
      { id: 'torax', label: 'Tórax / pulmões', kind: 'text', placeholder: 'alteração' },
      { id: 'abdome_fetal', label: 'Parede / abdome', kind: 'text', placeholder: 'alteração' },
      { id: 'rins_fetais', label: 'Rins / trato urinário', kind: 'text', placeholder: 'alteração' },
      { id: 'esqueleto', label: 'Coluna / esqueleto', kind: 'text', placeholder: 'alteração' },
      { id: 'marcadores', label: 'Marcadores de aneuploidia', kind: 'text', placeholder: 'TN, osso nasal, etc.', fullWidth: true },
    ],
  },
];

// ── VASCULAR (Etapa 2) — heterogêneo: overlay resolvido por tipo de exame ──

const NASCET = ['normal (<50%)', 'estenose 50–69%', 'estenose ≥70%', 'suboclusão', 'oclusão total'];
const CEAP = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const VERT_FLOW = ['anterógrado', 'invertido (roubo subclávio)', 'ausente'];
const COMPRESS = ['compressível (normal)', 'parcialmente compressível', 'incompressível (TVP)'];

const VASC_CAROTID: StructuredSection[] = [
  {
    id: 'emi',
    label: 'Espessura Médio-Intimal',
    calcId: 'imt-elsa-br',
    fields: [
      { id: 'emi_d', label: 'EMI Direita', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br' },
      { id: 'emi_e', label: 'EMI Esquerda', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br' },
    ],
  },
  {
    id: 'carotida-d',
    label: 'Sistema Carotídeo Direito',
    fields: [
      { id: 'vps_acc_d', label: 'VPS ACC', kind: 'measure', unit: 'cm/s' },
      { id: 'vps_aci_d', label: 'VPS ACI', kind: 'measure', unit: 'cm/s' },
      { id: 'vdf_aci_d', label: 'VDF ACI', kind: 'measure', unit: 'cm/s' },
      { id: 'placa_d', label: 'Placas', kind: 'text', placeholder: 'ausentes / descrever' },
      { id: 'estenose_d', label: 'Estenose (NASCET)', kind: 'select', options: NASCET },
    ],
  },
  {
    id: 'carotida-e',
    label: 'Sistema Carotídeo Esquerdo',
    fields: [
      { id: 'vps_acc_e', label: 'VPS ACC', kind: 'measure', unit: 'cm/s' },
      { id: 'vps_aci_e', label: 'VPS ACI', kind: 'measure', unit: 'cm/s' },
      { id: 'vdf_aci_e', label: 'VDF ACI', kind: 'measure', unit: 'cm/s' },
      { id: 'placa_e', label: 'Placas', kind: 'text', placeholder: 'ausentes / descrever' },
      { id: 'estenose_e', label: 'Estenose (NASCET)', kind: 'select', options: NASCET },
    ],
  },
  {
    id: 'vertebrais',
    label: 'Artérias Vertebrais',
    normalable: true,
    normalText: 'fluxo anterógrado e simétrico bilateralmente',
    fields: [
      { id: 'vert_d', label: 'Fluxo Vertebral Direito', kind: 'select', options: VERT_FLOW },
      { id: 'vert_e', label: 'Fluxo Vertebral Esquerdo', kind: 'select', options: VERT_FLOW },
    ],
  },
];

const VASC_VENOUS: StructuredSection[] = [
  {
    id: 'profundo-d',
    label: 'Sistema Venoso Profundo Direito',
    fields: [
      { id: 'compress_fem_d', label: 'V. Femoral', kind: 'select', options: COMPRESS },
      { id: 'compress_popl_d', label: 'V. Poplítea', kind: 'select', options: COMPRESS },
      { id: 'trombo_d', label: 'Trombo / extensão', kind: 'text', placeholder: 'ausente / descrever segmento' },
    ],
  },
  {
    id: 'superficial-d',
    label: 'Sistema Superficial Direito',
    fields: [
      { id: 'refluxo_d', label: 'Refluxo safeno', kind: 'select', options: ['ausente', 'presente'] },
      { id: 'ceap_d', label: 'Classificação CEAP', kind: 'select', options: CEAP },
    ],
  },
  {
    id: 'profundo-e',
    label: 'Sistema Venoso Profundo Esquerdo',
    fields: [
      { id: 'compress_fem_e', label: 'V. Femoral', kind: 'select', options: COMPRESS },
      { id: 'compress_popl_e', label: 'V. Poplítea', kind: 'select', options: COMPRESS },
      { id: 'trombo_e', label: 'Trombo / extensão', kind: 'text', placeholder: 'ausente / descrever segmento' },
    ],
  },
  {
    id: 'superficial-e',
    label: 'Sistema Superficial Esquerdo',
    fields: [
      { id: 'refluxo_e', label: 'Refluxo safeno', kind: 'select', options: ['ausente', 'presente'] },
      { id: 'ceap_e', label: 'Classificação CEAP', kind: 'select', options: CEAP },
    ],
  },
  {
    id: 'cartografia',
    label: 'Cartografia Venosa',
    calcId: 'venous-cartography',
    fields: [{ id: 'cartografia', label: 'Mapeamento', kind: 'calc', calcId: 'venous-cartography' }],
  },
];

const VASC_AORTA: StructuredSection[] = [
  {
    id: 'aorta',
    label: 'Aorta',
    fields: [
      { id: 'aorta_calibre', label: 'Maior calibre', kind: 'measure', unit: 'cm' },
      { id: 'aorta_aneurisma', label: 'Aneurisma / dissecção', kind: 'text', placeholder: 'ausente / descrever' },
    ],
  },
  {
    id: 'iliacas',
    label: 'Artérias Ilíacas',
    fields: [
      { id: 'iliaca_d', label: 'Ilíaca Direita', kind: 'measure', unit: 'mm' },
      { id: 'iliaca_e', label: 'Ilíaca Esquerda', kind: 'measure', unit: 'mm' },
    ],
  },
];

const ARTERIAL_STENOSIS = ['sem estenose', 'estenose <50%', 'estenose 50–70%', 'estenose >70%', 'oclusão'];

const VASC_ARTERIAL: StructuredSection[] = [
  {
    id: 'itb',
    label: 'Índice Tornozelo-Braquial',
    fields: [
      { id: 'itb_d', label: 'ITB Direito', kind: 'measure' },
      { id: 'itb_e', label: 'ITB Esquerdo', kind: 'measure' },
    ],
  },
  {
    id: 'eixos',
    label: 'Eixos Arteriais',
    fields: [
      { id: 'eixo_d', label: 'Eixo Direito', kind: 'text', placeholder: 'fluxo trifásico / descrever' },
      { id: 'eixo_e', label: 'Eixo Esquerdo', kind: 'text', placeholder: 'fluxo trifásico / descrever' },
      { id: 'estenose_arterial', label: 'Estenose mais significativa', kind: 'select', options: ARTERIAL_STENOSIS },
    ],
  },
];

const VASC_GENERIC: StructuredSection[] = [
  {
    id: 'doppler',
    label: 'Índices Hemodinâmicos',
    calcId: 'vascular-ratios',
    fields: [
      { id: 'vps', label: 'VPS', kind: 'measure', unit: 'cm/s', calcId: 'vascular-ratios' },
      { id: 'vdf', label: 'VDF', kind: 'measure', unit: 'cm/s', calcId: 'vascular-ratios' },
      { id: 'ir', label: 'IR', kind: 'measure' },
      { id: 'ip', label: 'IP', kind: 'measure' },
    ],
  },
  {
    id: 'volemia',
    label: 'Status Volêmico (VCI)',
    calcId: 'ivc-index',
    fields: [{ id: 'ivc', label: 'Índice de colapsabilidade', kind: 'calc', calcId: 'ivc-index' }],
  },
];

function vascularOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/car[oó]tida|vertebra/.test(n)) return VASC_CAROTID;
  if (/venoso/.test(n)) return VASC_VENOUS;
  if (/aort|il[íi]ac/.test(n)) return VASC_AORTA;
  if (/arterial\s+membro/.test(n)) return VASC_ARTERIAL;
  return VASC_GENERIC;
}

// ── GINECOLOGIA (Etapa 3) ──

const UTERO_POS = ['anteversoflexão', 'retroversoflexão', 'medioversão', 'retroflexão'];

const GYN_PELVIC: StructuredSection[] = [
  {
    id: 'utero',
    label: 'Útero',
    fields: [
      { id: 'utero_pos', label: 'Posição', kind: 'select', options: UTERO_POS },
      { id: 'utero_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' },
      { id: 'miometrio', label: 'Miométrio', kind: 'text', placeholder: 'homogêneo / descrever' },
      { id: 'mioma_figo', label: 'Mioma (FIGO)', kind: 'calc', calcId: 'figo-myoma' },
    ],
  },
  {
    id: 'endometrio',
    label: 'Endométrio',
    fields: [
      { id: 'endometrio_esp', label: 'Espessura', kind: 'measure', unit: 'mm' },
      { id: 'endometrio_asp', label: 'Aspecto', kind: 'text', placeholder: 'homogêneo, linha média centrada' },
    ],
  },
  {
    id: 'colo',
    label: 'Colo Uterino',
    fields: [{ id: 'colo', label: 'Colo', kind: 'text', placeholder: 'sem alterações' }],
  },
  {
    id: 'ovario-d',
    label: 'Ovário Direito',
    calcId: 'volume-elipsoide',
    fields: [
      { id: 'ovd_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'ovd_form', label: 'Formação / folículos', kind: 'text', placeholder: 'padrão folicular normal' },
    ],
  },
  {
    id: 'ovario-e',
    label: 'Ovário Esquerdo',
    calcId: 'volume-elipsoide',
    fields: [
      { id: 'ove_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'ove_form', label: 'Formação / folículos', kind: 'text', placeholder: 'padrão folicular normal' },
    ],
  },
  {
    id: 'formacoes',
    label: 'Formações Anexiais (O-RADS)',
    repeatable: true,
    itemLabel: 'Formação',
    score: 'orads',
    fields: [
      { id: 'lado', label: 'Lado', kind: 'select', options: ['ovário direito', 'ovário esquerdo', 'extra-ovariana'] },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'tipo', label: 'Tipo', kind: 'select', options: ['unilocular', 'unilocular sólida', 'multilocular', 'multilocular sólida', 'sólida'] },
      { id: 'conteudo', label: 'Conteúdo', kind: 'select', options: ['anecoico', 'de vidro fosco', 'hemorrágico', 'espesso/heterogêneo'] },
      { id: 'septos', label: 'Septos / projeções', kind: 'select', options: ['ausentes', 'septos finos', 'septos espessos', 'projeções papilares'] },
      { id: 'vascularizacao', label: 'Fluxo (color score)', kind: 'select', options: ['1 – ausente', '2 – mínimo', '3 – moderado', '4 – marcante'] },
      { id: 'orads', label: 'Categoria O-RADS', kind: 'select', options: ['O-RADS 1', 'O-RADS 2', 'O-RADS 3', 'O-RADS 4', 'O-RADS 5'] },
    ],
  },
  {
    id: 'douglas',
    label: 'Fundo de Saco de Douglas',
    normalable: true,
    normalText: 'livre',
    fields: [{ id: 'douglas', label: 'Conteúdo', kind: 'select', options: ['líquido livre em pequena quantidade', 'líquido livre moderado/volumoso', 'coleção organizada'] }],
  },
];

const GYN_ENDO: StructuredSection[] = [
  { id: 'utero-endo', label: 'Útero e Endométrio', fields: [{ id: 'utero_endo', label: 'Útero / adenomiose', kind: 'text', placeholder: 'descrever' }] },
  {
    id: 'ovarios',
    label: 'Ovários',
    calcId: 'orads-us-2022',
    fields: [
      { id: 'endometrioma', label: 'Endometrioma', kind: 'text', placeholder: 'ausente / lado e dimensões' },
      { id: 'orads', label: 'O-RADS (se formação)', kind: 'calc', calcId: 'orads-us-2022' },
    ],
  },
  { id: 'anterior', label: 'Compartimento Anterior', fields: [{ id: 'comp_anterior', label: 'Bexiga / ureteres', kind: 'text', placeholder: 'sem focos' }] },
  { id: 'posterior', label: 'Compartimento Posterior', fields: [{ id: 'comp_posterior', label: 'Retossigmoide / retovaginal', kind: 'text', placeholder: 'sem focos' }] },
  { id: 'parametrios', label: 'Paramétrios / Ligamentos', fields: [{ id: 'parametrios', label: 'Ligamentos uterossacros', kind: 'text', placeholder: 'sem espessamento' }] },
  { id: 'douglas', label: 'Fundo de Saco', fields: [{ id: 'douglas_obl', label: 'Obliteração', kind: 'select', options: ['livre', 'obliteração parcial', 'obliteração completa'] }] },
];

function gynecoOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/endometriose/.test(n)) return GYN_ENDO;
  return GYN_PELVIC;
}

// ── MASTOLOGIA (Etapa 3) ──

const ACR_COMPOSITION = ['ACR A (adiposa)', 'ACR B (fibroglandular esparsa)', 'ACR C (heterogeneamente densa)', 'ACR D (densa)'];
const LN_ASPECT = ['normal', 'reativo/benigno', 'suspeito'];

const BIRADS_CAT = ['BI-RADS 1', 'BI-RADS 2', 'BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 4C', 'BI-RADS 5', 'BI-RADS 6'];
const MAMA_SHAPE = ['oval', 'redonda', 'irregular'];
const MAMA_ORIENT = ['paralela', 'não paralela (mais alta que larga)'];
const MAMA_MARGIN = ['circunscrita', 'indistinta', 'angular', 'microlobulada', 'espiculada'];
const MAMA_ECHO = ['anecoico', 'hipoecoico', 'isoecoico', 'hiperecoico', 'heterogêneo', 'complexo cístico-sólido'];
const MAMA_ACOUSTIC = ['nenhuma', 'reforço acústico posterior', 'sombra acústica', 'padrão combinado'];

const MAMA_STD: StructuredSection[] = [
  {
    id: 'composicao',
    label: 'Composição do Parênquima',
    fields: [{ id: 'acr', label: 'Densidade (ACR)', kind: 'select', options: ACR_COMPOSITION }],
  },
  {
    id: 'lesoes',
    label: 'Nódulos / Lesões (BI-RADS)',
    repeatable: true,
    itemLabel: 'Lesão',
    score: 'birads',
    fields: [
      { id: 'mama', label: 'Mama', kind: 'select', options: ['direita', 'esquerda'] },
      { id: 'loc', label: 'Localização (h / dist. papila)', kind: 'text', placeholder: 'ex: 10h, 3 cm da papila' },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'forma', label: 'Forma', kind: 'select', options: MAMA_SHAPE },
      { id: 'orientacao', label: 'Orientação', kind: 'select', options: MAMA_ORIENT },
      { id: 'margem', label: 'Margem', kind: 'select', options: MAMA_MARGIN },
      { id: 'eco', label: 'Padrão ecogênico', kind: 'select', options: MAMA_ECHO },
      { id: 'acusticas', label: 'Características acústicas', kind: 'select', options: MAMA_ACOUSTIC },
      { id: 'birads', label: 'Categoria BI-RADS', kind: 'select', options: BIRADS_CAT },
    ],
  },
  {
    id: 'axilas',
    label: 'Regiões Axilares',
    normalable: true,
    normalText: 'linfonodos axilares de aspecto habitual',
    fields: [
      { id: 'axila_lado', label: 'Axila', kind: 'select', options: ['direita', 'esquerda', 'bilateral'] },
      { id: 'axila_maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' },
      { id: 'axila_cortical', label: 'Cortical', kind: 'measure', unit: 'mm' },
      { id: 'axila_susp', label: 'Achados suspeitos', kind: 'text', placeholder: 'perda do hilo, cortical > 3 mm...' },
    ],
  },
];

const MASTO_LN: StructuredSection[] = [
  {
    id: 'axila-d',
    label: 'Axila Direita',
    fields: [
      { id: 'axd_aspecto', label: 'Aspecto', kind: 'select', options: LN_ASPECT },
      { id: 'axd_maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' },
      { id: 'axd_cortical', label: 'Cortical', kind: 'measure', unit: 'mm' },
    ],
  },
  {
    id: 'axila-e',
    label: 'Axila Esquerda',
    fields: [
      { id: 'axe_aspecto', label: 'Aspecto', kind: 'select', options: LN_ASPECT },
      { id: 'axe_maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' },
      { id: 'axe_cortical', label: 'Cortical', kind: 'measure', unit: 'mm' },
    ],
  },
];

function mastologiaOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/linfonodo/.test(n)) return MASTO_LN;
  return MAMA_STD;
}

// ── PEQUENAS PARTES (Etapa 4) ──

const PP_THYROID: StructuredSection[] = [
  {
    id: 'lobo-d',
    label: 'Lobo Direito',
    calcId: 'volume-elipsoide',
    fields: [{ id: 'lobo_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }],
  },
  {
    id: 'lobo-e',
    label: 'Lobo Esquerdo',
    calcId: 'volume-elipsoide',
    fields: [{ id: 'lobo_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }],
  },
  { id: 'istmo', label: 'Istmo', fields: [{ id: 'istmo', label: 'Espessura', kind: 'measure', unit: 'mm' }] },
  {
    id: 'parenquima', label: 'Parênquima', normalable: true, normalText: 'ecotextura homogênea, ecogenicidade normal',
    fields: [
      { id: 'parenquima_eco', label: 'Ecotextura', kind: 'select', options: ['homogênea', 'heterogênea', 'micronodular difusa'] },
      { id: 'parenquima_vasc', label: 'Vascularização', kind: 'select', options: ['normal', 'aumentada (tireoidite)', 'reduzida'] },
    ],
  },
  {
    id: 'nodulos',
    label: 'Nódulos (ACR TI-RADS)',
    repeatable: true,
    itemLabel: 'Nódulo',
    score: 'tirads',
    fields: [
      { id: 'loc', label: 'Localização', kind: 'text', placeholder: 'lobo / terço' },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'composicao', label: 'Composição', kind: 'select', options: TIRADS_OPTIONS.composition, scoreKey: 'composition' },
      { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', options: TIRADS_OPTIONS.echogenicity, scoreKey: 'echogenicity' },
      { id: 'forma', label: 'Forma', kind: 'select', options: TIRADS_OPTIONS.shape, scoreKey: 'shape' },
      { id: 'margem', label: 'Margem', kind: 'select', options: TIRADS_OPTIONS.margin, scoreKey: 'margin' },
      { id: 'focos', label: 'Focos ecogênicos', kind: 'select', options: TIRADS_OPTIONS.foci, scoreKey: 'foci' },
    ],
  },
  {
    id: 'linfonodos', label: 'Linfonodos Cervicais', normalable: true, normalText: 'cadeias sem linfonodomegalias suspeitas',
    fields: [
      { id: 'ln_nivel', label: 'Nível / cadeia', kind: 'text', placeholder: 'ex: nível III direito' },
      { id: 'ln_carac', label: 'Características suspeitas', kind: 'text', placeholder: 'perda do hilo, microcalcificações...' },
    ],
  },
];

const PP_CERVICAL: StructuredSection[] = [
  { id: 'parotidas', label: 'Glândulas Parótidas', fields: [{ id: 'parotidas', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas, sem nódulos' }] },
  { id: 'submandibulares', label: 'Glândulas Submandibulares', fields: [{ id: 'submandibulares', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas' }] },
  { id: 'tireoide-rastreio', label: 'Tireoide (rastreamento)', fields: [{ id: 'tireoide_rastreio', label: 'Aspecto', kind: 'text', placeholder: 'tópica, sem nódulos' }] },
  {
    id: 'linfonodos',
    label: 'Cadeias Linfonodais (I–VII)',
    normalable: true,
    normalText: 'sem linfonodomegalias suspeitas',
    fields: [
      { id: 'linfonodos_asp', label: 'Aspecto', kind: 'select', options: ['linfonodos reativos', 'linfonodo suspeito'] },
      { id: 'linfonodo_maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' },
      { id: 'linfonodo_nivel', label: 'Nível / lado', kind: 'text', placeholder: 'ex: nível II direito' },
    ],
  },
];

const PP_SCROTUM: StructuredSection[] = [
  {
    id: 'testiculo-d',
    label: 'Testículo Direito',
    calcId: 'volume-elipsoide',
    fields: [
      { id: 'test_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'test_d_eco', label: 'Ecotextura', kind: 'text', placeholder: 'homogênea, sem nódulos' },
    ],
  },
  {
    id: 'testiculo-e',
    label: 'Testículo Esquerdo',
    calcId: 'volume-elipsoide',
    fields: [
      { id: 'test_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'test_e_eco', label: 'Ecotextura', kind: 'text', placeholder: 'homogênea, sem nódulos' },
    ],
  },
  { id: 'epididimos', label: 'Epidídimos', fields: [{ id: 'epididimos', label: 'Aspecto', kind: 'text', placeholder: 'normais' }] },
  {
    id: 'anexos-escroto',
    label: 'Túnicas / Doppler',
    fields: [
      { id: 'hidrocele', label: 'Hidrocele', kind: 'select', options: ['ausente', 'presente'] },
      { id: 'varicocele', label: 'Varicocele', kind: 'text', placeholder: 'ausente / grau e refluxo' },
      { id: 'fluxo', label: 'Fluxo testicular', kind: 'select', options: ['simétrico/preservado', 'aumentado', 'ausente'] },
    ],
  },
];

const PP_SALIVARY: StructuredSection[] = [
  { id: 'parotidas', label: 'Parótidas', fields: [{ id: 'parotidas', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas' }] },
  { id: 'submandibulares', label: 'Submandibulares', fields: [{ id: 'submandibulares', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas' }] },
  { id: 'sublinguais', label: 'Sublinguais', fields: [{ id: 'sublinguais', label: 'Aspecto', kind: 'text', placeholder: 'normais' }] },
  { id: 'ductos', label: 'Ductos Salivares', fields: [{ id: 'ductos', label: 'Ductos', kind: 'text', placeholder: 'não dilatados, sem cálculos' }] },
  { id: 'linfonodos', label: 'Linfonodos Regionais', fields: [{ id: 'linfonodos', label: 'Aspecto', kind: 'text', placeholder: 'sem alterações' }] },
];

const PP_GENERIC: StructuredSection[] = [
  {
    id: 'lesao',
    label: 'Lesão / Achado Focal',
    calcId: 'volume-elipsoide',
    fields: [
      { id: 'lesao_loc', label: 'Localização / plano', kind: 'text', placeholder: 'subcutâneo / muscular' },
      { id: 'lesao_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'lesao_carac', label: 'Características', kind: 'text', placeholder: 'ecogenicidade, margens, vascularização' },
    ],
  },
  {
    id: 'hernia',
    label: 'Hérnia / Valsalva',
    fields: [
      { id: 'hernia', label: 'Hérnia', kind: 'text', placeholder: 'ausente / conteúdo e colo' },
      { id: 'valsalva', label: 'Valsalva', kind: 'select', options: ['sem abaulamento', 'abaulamento à manobra'] },
    ],
  },
  { id: 'linfonodos', label: 'Linfonodos Regionais', fields: [{ id: 'linfonodos', label: 'Aspecto', kind: 'text', placeholder: 'sem alterações' }] },
];

function pequenasPartesOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/tireoide/.test(n)) return PP_THYROID;
  if (/cervical/.test(n)) return PP_CERVICAL;
  if (/escrotal|bolsa/.test(n)) return PP_SCROTUM;
  if (/salivar/.test(n)) return PP_SALIVARY;
  return PP_GENERIC;
}

// ── MEDICINA INTERNA / ABDOME (Etapa 4) ──

const MI_ABDOME: StructuredSection[] = [
  { id: 'figado', label: 'Fígado', normalable: true, normalText: 'dimensões normais, ecotextura homogênea, sem lesões focais', fields: [
    { id: 'esteatose', label: 'Esteatose', kind: 'select', options: ['ausente', 'leve (grau I)', 'moderada (grau II)', 'acentuada (grau III)'] },
    { id: 'contornos', label: 'Contornos', kind: 'select', options: ['regulares', 'irregulares/nodulares'] },
    { id: 'lesao_focal', label: 'Lesão focal', kind: 'text', placeholder: 'localização, dimensões, aspecto', fullWidth: true },
    { id: 'porta', label: 'Veia porta', kind: 'text', placeholder: 'calibre normal, fluxo hepatopeta' },
  ] },
  { id: 'vias-biliares', label: 'Vias Biliares / Vesícula', normalable: true, normalText: 'vesícula de paredes finas sem cálculos; vias não dilatadas', fields: [
    { id: 'vesicula', label: 'Vesícula', kind: 'select', options: ['cálculo(s)', 'lama biliar', 'pólipo', 'espessamento parietal', 'colecistectomizado'] },
    { id: 'calculo_maior', label: 'Maior cálculo', kind: 'measure', unit: 'mm' },
    { id: 'coledoco', label: 'Colédoco', kind: 'measure', unit: 'mm' },
  ] },
  { id: 'pancreas', label: 'Pâncreas', normalable: true, normalText: 'dimensões e ecotextura normais', fields: [
    { id: 'pancreas', label: 'Aspecto', kind: 'text', placeholder: 'descrever alteração' },
    { id: 'wirsung', label: 'Ducto de Wirsung', kind: 'measure', unit: 'mm' },
  ] },
  { id: 'baco', label: 'Baço', normalable: true, normalText: 'dimensões normais, homogêneo', fields: [
    { id: 'baco_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm' },
    { id: 'baco_desc', label: 'Achados', kind: 'text', placeholder: 'lesão focal / esplenomegalia' },
  ] },
  { id: 'rins', label: 'Rins', normalable: true, normalText: 'dimensões normais, sem hidronefrose ou cálculos', fields: [
    { id: 'litiase', label: 'Litíase', kind: 'text', placeholder: 'lado, localização, maior cálculo' },
    { id: 'hidronefrose', label: 'Dilatação (SFU)', kind: 'select', options: ['ausente', 'SFU I', 'SFU II', 'SFU III', 'SFU IV'] },
    { id: 'cisto', label: 'Cistos / lesões', kind: 'text', placeholder: 'Bosniak se aplicável', fullWidth: true },
  ] },
  { id: 'aorta', label: 'Aorta / VCI', normalable: true, normalText: 'aorta de calibre normal', fields: [
    { id: 'aorta', label: 'Calibre da aorta', kind: 'measure', unit: 'cm', hint: 'aneurisma se ≥ 3,0 cm' },
    { id: 'vci', label: 'VCI (colapsabilidade)', kind: 'calc', calcId: 'ivc-index' },
  ] },
  { id: 'referencias', label: 'Valores de Referência', calcId: 'organ-refs', fields: [
    { id: 'referencias', label: 'Consultar tabela', kind: 'calc', calcId: 'organ-refs' },
  ] },
];

const MI_PROSTATE: StructuredSection[] = [
  { id: 'bexiga', label: 'Bexiga', fields: [{ id: 'bexiga', label: 'Fase pré-miccional', kind: 'text', placeholder: 'repleta, paredes finas' }] },
  {
    id: 'prostata',
    label: 'Próstata',
    calcId: 'prostate-weight',
    fields: [
      { id: 'prostata_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'prostate-weight' },
      { id: 'prostata_peso', label: 'Volume / peso', kind: 'calc', calcId: 'prostate-weight' },
      { id: 'lobo_mediano', label: 'Lobo mediano', kind: 'text', placeholder: 'ausente / protrusão' },
    ],
  },
  { id: 'vesiculas', label: 'Vesículas Seminais', fields: [{ id: 'vesiculas', label: 'Aspecto', kind: 'text', placeholder: 'simétricas, sem alterações' }] },
  { id: 'vrpm', label: 'Resíduo Pós-miccional', fields: [{ id: 'vrpm', label: 'VRPM', kind: 'measure', unit: 'ml' }] },
];

const MI_KIDNEY: StructuredSection[] = [
  { id: 'rim-d', label: 'Rim Direito', fields: [
    { id: 'rim_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' },
    { id: 'rim_d_par', label: 'Parênquima / SPC', kind: 'text', placeholder: 'espessura preservada, sem dilatação' },
  ] },
  { id: 'rim-e', label: 'Rim Esquerdo', fields: [
    { id: 'rim_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' },
    { id: 'rim_e_par', label: 'Parênquima / SPC', kind: 'text', placeholder: 'espessura preservada, sem dilatação' },
  ] },
  { id: 'ureteres', label: 'Ureteres', fields: [{ id: 'ureteres', label: 'Aspecto', kind: 'text', placeholder: 'não dilatados' }] },
  { id: 'bexiga', label: 'Bexiga', fields: [{ id: 'bexiga', label: 'Aspecto', kind: 'text', placeholder: 'paredes finas, conteúdo anecoico' }] },
  { id: 'vrpm', label: 'Resíduo Pós-miccional', fields: [{ id: 'vrpm', label: 'VRPM', kind: 'measure', unit: 'ml' }] },
];

function medicinaInternaOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/pr[óo]stata/.test(n)) return MI_PROSTATE;
  if (/rins|urin[áa]ri/.test(n)) return MI_KIDNEY;
  return MI_ABDOME;
}

// ── MUSCULOESQUELÉTICO (Etapa 5) — genérico (serve às articulações) ──

const TENDON_STATE = ['íntegro', 'tendinopatia', 'ruptura parcial', 'ruptura completa'];
const EFFUSION = ['ausente', 'pequeno', 'moderado', 'volumoso'];
const SEMIQ = ['0 (ausente)', '1 (leve)', '2 (moderado)', '3 (acentuado)'];

const MSK_GENERIC: StructuredSection[] = [
  { id: 'regiao', label: 'Região / Articulação Avaliada', fields: [{ id: 'regiao', label: 'Local', kind: 'text', placeholder: 'ex: ombro direito' }] },
  {
    id: 'tendoes',
    label: 'Tendões',
    fields: [
      { id: 'tendao', label: 'Tendão avaliado', kind: 'text', placeholder: 'ex: supraespinal' },
      { id: 'tendao_estado', label: 'Integridade', kind: 'select', options: TENDON_STATE },
    ],
  },
  {
    id: 'articulacao',
    label: 'Articulação',
    fields: [
      { id: 'derrame', label: 'Derrame articular', kind: 'select', options: EFFUSION },
      { id: 'sinovite', label: 'Sinovite (modo B)', kind: 'select', options: ['ausente', 'presente'] },
    ],
  },
  { id: 'bursa', label: 'Bursas', normalable: true, normalText: 'sem bursopatia', fields: [{ id: 'bursa', label: 'Achados', kind: 'text', placeholder: 'bursa distendida, conteúdo' }] },
  { id: 'nervo', label: 'Nervos Periféricos', normalable: true, normalText: 'sem sinais compressivos', fields: [{ id: 'nervo', label: 'Achados', kind: 'text', placeholder: 'ex: mediano no túnel do carpo' }] },
  {
    id: 'colecoes',
    label: 'Cistos / Coleções',
    repeatable: true,
    itemLabel: 'Achado',
    fields: [
      { id: 'loc', label: 'Localização', kind: 'text', placeholder: 'plano/região' },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'carac', label: 'Características', kind: 'text', placeholder: 'conteúdo, margens, Doppler' },
    ],
  },
  { id: 'power-doppler', label: 'Power Doppler', normalable: true, normalText: 'sem hiperemia', fields: [{ id: 'power_doppler', label: 'Grau (0–3)', kind: 'select', options: SEMIQ }] },
];

// ── REUMATOLÓGICO (Etapa 5) — escores EULAR-OMERACT ──

const REUMATO_PERIPH: StructuredSection[] = [
  {
    id: 'articulacoes',
    label: 'Articulações (GSUS / PDUS)',
    repeatable: true,
    itemLabel: 'Articulação',
    fields: [
      { id: 'nome', label: 'Articulação', kind: 'text', placeholder: 'ex: MCF 2 direita' },
      { id: 'gsus', label: 'Sinovite GSUS (0–3)', kind: 'select', options: SEMIQ },
      { id: 'pdus', label: 'Power Doppler (0–3)', kind: 'select', options: SEMIQ },
      { id: 'derrame', label: 'Derrame', kind: 'select', options: EFFUSION },
      { id: 'erosao', label: 'Erosão', kind: 'select', options: ['ausente', 'presente'] },
    ],
  },
  { id: 'enteses', label: 'Ênteses e Tendões', normalable: true, normalText: 'sem entesopatia ou tenossinovite', fields: [{ id: 'enteses', label: 'Achados', kind: 'text', placeholder: 'espessamento, PD, erosão na inserção' }] },
];

const REUMATO_SI: StructuredSection[] = [
  { id: 'si-d', label: 'Sacroilíaca Direita', fields: [
    { id: 'si_d_pdus', label: 'Power Doppler (0–3)', kind: 'select', options: SEMIQ },
    { id: 'si_d_desc', label: 'Achados', kind: 'text', placeholder: 'irregularidade/erosão' },
  ] },
  { id: 'si-e', label: 'Sacroilíaca Esquerda', fields: [
    { id: 'si_e_pdus', label: 'Power Doppler (0–3)', kind: 'select', options: SEMIQ },
    { id: 'si_e_desc', label: 'Achados', kind: 'text', placeholder: 'irregularidade/erosão' },
  ] },
  { id: 'enteses', label: 'Ênteses Pélvicas', fields: [{ id: 'enteses', label: 'Inserções', kind: 'text', placeholder: 'sem entesopatia' }] },
];

const REUMATO_PDUS28: StructuredSection[] = [
  { id: 'protocolo', label: 'Protocolo PDUS-28', fields: [{ id: 'protocolo', label: 'Articulações do protocolo', kind: 'text', placeholder: 'listar as avaliadas' }] },
  { id: 'gsus', label: 'Sinovite GSUS (0–3) por região', fields: [{ id: 'gsus_regioes', label: 'GSUS por região', kind: 'text', placeholder: 'ex: MCF2 D: 2; punho E: 1' }] },
  { id: 'pdus', label: 'Power Doppler (0–3) por região', fields: [{ id: 'pdus_regioes', label: 'PDUS por região', kind: 'text', placeholder: 'ex: MCF2 D: 1' }] },
  { id: 'gloess', label: 'Escore Combinado', fields: [{ id: 'gloess', label: 'GLOESS', kind: 'measure' }] },
  { id: 'atividade', label: 'Articulações com Atividade (PD ≥1)', fields: [{ id: 'atividade', label: 'Quais', kind: 'text', placeholder: 'listar' }] },
  { id: 'erosoes', label: 'Erosões', fields: [{ id: 'erosoes', label: 'Erosões', kind: 'text', placeholder: 'ausentes / descrever' }] },
];

function reumatoOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/sacroil/.test(n)) return REUMATO_SI;
  if (/pdus|escore/.test(n)) return REUMATO_PDUS28;
  return REUMATO_PERIPH;
}

// ── PEDIATRIA (Etapa 6) ──

const GRAF_TYPES = ['I (normal)', 'IIa', 'IIb', 'IIc', 'D (descentrando)', 'III', 'IV'];
const SFU = ['ausente', 'SFU I', 'SFU II', 'SFU III', 'SFU IV'];
const TEST_FLOW = ['presente/simétrico', 'reduzido', 'ausente (suspeita de torção)'];

const PED_TRANSFONT: StructuredSection[] = [
  { id: 'parenquima', label: 'Parênquima Supratentorial', normalable: true, normalText: 'ecogenicidade normal, sem hemorragia (Papile)', fields: [
    { id: 'hemorragia', label: 'Hemorragia (Papile)', kind: 'select', options: ['grau I', 'grau II', 'grau III', 'grau IV'] },
    { id: 'parenquima', label: 'Outros achados', kind: 'text', placeholder: 'leucomalácia, edema...' },
  ] },
  { id: 'ventriculos', label: 'Sistema Ventricular', normalable: true, normalText: 'simétrico, não dilatado', fields: [
    { id: 'atrio_ventricular', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', hint: 'ventriculomegalia se > 10 mm' },
    { id: 'ventriculos_asp', label: 'Aspecto', kind: 'text', placeholder: 'dilatação, assimetria' },
  ] },
  { id: 'linha-media', label: 'Linha Média / Núcleos', normalable: true, normalText: 'centrada; núcleos da base e tálamos normais', fields: [{ id: 'linha_media', label: 'Achados', kind: 'text', placeholder: 'desvio, cistos, calcificações' }] },
  { id: 'fossa-posterior', label: 'Fossa Posterior', normalable: true, normalText: 'cerebelo e cisterna magna normais', fields: [{ id: 'fossa_posterior', label: 'Achados', kind: 'text', placeholder: 'malformação, hemorragia' }] },
  { id: 'doppler', label: 'Dopplerfluxometria', fields: [{ id: 'ir', label: 'IR (ACA)', kind: 'measure', hint: 'normal ~0,65–0,85' }] },
];

const PED_SPINE: StructuredSection[] = [
  { id: 'cone', label: 'Cone Medular', fields: [{ id: 'nivel_cone', label: 'Nível do cone', kind: 'text', placeholder: 'ex: L1-L2' }] },
  { id: 'filum', label: 'Filum / Raízes', fields: [{ id: 'filum', label: 'Aspecto', kind: 'text', placeholder: 'filum fino, raízes livres' }] },
  { id: 'canal', label: 'Canal Espinhal', fields: [{ id: 'canal', label: 'Arcos posteriores', kind: 'text', placeholder: 'íntegros' }] },
  { id: 'partes-moles', label: 'Partes Moles / Pele', fields: [{ id: 'partes_moles', label: 'Aspecto', kind: 'text', placeholder: 'sem disrafismo/coleção' }] },
];

const PED_HIP: StructuredSection[] = [
  { id: 'quadril-d', label: 'Quadril Direito (Graf)', fields: [
    { id: 'alfa_d', label: 'Ângulo α', kind: 'measure', unit: '°' },
    { id: 'beta_d', label: 'Ângulo β', kind: 'measure', unit: '°' },
    { id: 'graf_d', label: 'Tipo de Graf', kind: 'select', options: GRAF_TYPES },
  ] },
  { id: 'quadril-e', label: 'Quadril Esquerdo (Graf)', fields: [
    { id: 'alfa_e', label: 'Ângulo α', kind: 'measure', unit: '°' },
    { id: 'beta_e', label: 'Ângulo β', kind: 'measure', unit: '°' },
    { id: 'graf_e', label: 'Tipo de Graf', kind: 'select', options: GRAF_TYPES },
  ] },
  { id: 'estabilidade', label: 'Estabilidade (manobras)', fields: [{ id: 'estabilidade', label: 'Estabilidade', kind: 'select', options: ['estável', 'frouxidão', 'instável/luxável'] }] },
];

const PED_SCROTUM: StructuredSection[] = [
  { id: 'testiculo-d', label: 'Testículo Direito', calcId: 'volume-elipsoide', fields: [
    { id: 'test_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'test_d_fluxo', label: 'Fluxo', kind: 'select', options: TEST_FLOW },
  ] },
  { id: 'testiculo-e', label: 'Testículo Esquerdo', calcId: 'volume-elipsoide', fields: [
    { id: 'test_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'test_e_fluxo', label: 'Fluxo', kind: 'select', options: TEST_FLOW },
  ] },
  { id: 'epididimos', label: 'Epidídimos / Apêndices', fields: [{ id: 'epididimos', label: 'Aspecto', kind: 'text', placeholder: 'normais; apêndices sem torção' }] },
];

const PED_ABDOME: StructuredSection[] = [
  { id: 'figado', label: 'Fígado / Baço', fields: [{ id: 'figado', label: 'Aspecto', kind: 'text', placeholder: 'dimensões e ecotextura normais' }] },
  { id: 'vias-vesicula', label: 'Vias Biliares / Vesícula / Pâncreas', fields: [{ id: 'vias_vesicula', label: 'Aspecto', kind: 'text', placeholder: 'sem alterações' }] },
  { id: 'rins', label: 'Rins', fields: [{ id: 'rins', label: 'Aspecto', kind: 'text', placeholder: 'dimensões adequadas à idade, sem dilatação' }] },
  { id: 'adrenais', label: 'Adrenais', fields: [{ id: 'adrenais', label: 'Aspecto', kind: 'text', placeholder: 'sem alterações' }] },
  { id: 'bexiga', label: 'Bexiga', fields: [{ id: 'bexiga', label: 'Aspecto', kind: 'text', placeholder: 'paredes finas' }] },
];

const PED_KIDNEY: StructuredSection[] = [
  { id: 'rim-d', label: 'Rim Direito', fields: [
    { id: 'rim_d_dims', label: 'Comprimento', kind: 'measure', unit: 'cm' },
    { id: 'rim_d_dilat', label: 'Dilatação (SFU)', kind: 'select', options: SFU },
  ] },
  { id: 'rim-e', label: 'Rim Esquerdo', fields: [
    { id: 'rim_e_dims', label: 'Comprimento', kind: 'measure', unit: 'cm' },
    { id: 'rim_e_dilat', label: 'Dilatação (SFU)', kind: 'select', options: SFU },
  ] },
  { id: 'ureteres', label: 'Ureteres', fields: [{ id: 'ureteres', label: 'Aspecto', kind: 'text', placeholder: 'não dilatados' }] },
  { id: 'bexiga', label: 'Bexiga', fields: [{ id: 'bexiga', label: 'Aspecto', kind: 'text', placeholder: 'paredes finas, conteúdo anecoico' }] },
];

function pediatriaOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/transfontanelar/.test(n)) return PED_TRANSFONT;
  if (/coluna/.test(n)) return PED_SPINE;
  if (/quadril/.test(n)) return PED_HIP;
  if (/escroto/.test(n)) return PED_SCROTUM;
  if (/rins|urin[áa]ri/.test(n)) return PED_KIDNEY;
  return PED_ABDOME;
}

// ── PROCEDIMENTOS (Etapa 6) ──

const PROC_CONTROLE = ['sem intercorrências', 'hematoma local', 'sangramento', 'outro'];

const PROC_TARGET_FIELDS: StructuredFieldDef[] = [
  { id: 'alvo_loc', label: 'Alvo / localização', kind: 'text', placeholder: 'estrutura e localização' },
  { id: 'alvo_dims', label: 'Dimensões do alvo', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
];
const PROC_TAIL: StructuredSection[] = [
  { id: 'tecnica', label: 'Técnica', fields: [{ id: 'tecnica', label: 'Agulha / via / passagens', kind: 'text', placeholder: 'ex: agulha 22G, via anterior, 3 passagens' }] },
  { id: 'material', label: 'Material Coletado', fields: [{ id: 'material', label: 'Amostra', kind: 'text', placeholder: 'nº fragmentos / aspirado enviado' }] },
  { id: 'controle', label: 'Controle Pós-procedimento', fields: [
    { id: 'controle_pos', label: 'Status', kind: 'select', options: PROC_CONTROLE },
    { id: 'controle_obs', label: 'Observações', kind: 'text', placeholder: 'orientações/curativo' },
  ] },
];

const PROC_GENERIC: StructuredSection[] = [
  { id: 'alvo', label: 'Lesão / Estrutura-alvo', calcId: 'volume-elipsoide', fields: PROC_TARGET_FIELDS },
  ...PROC_TAIL,
];

const PROC_THYROID: StructuredSection[] = [
  {
    id: 'alvo', label: 'Nódulo-alvo (ACR TI-RADS)', score: 'tirads',
    fields: [
      { id: 'alvo_loc', label: 'Localização', kind: 'text', placeholder: 'lobo/terço' },
      { id: 'alvo_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'composicao', label: 'Composição', kind: 'select', options: TIRADS_OPTIONS.composition, scoreKey: 'composition' },
      { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', options: TIRADS_OPTIONS.echogenicity, scoreKey: 'echogenicity' },
      { id: 'forma', label: 'Forma', kind: 'select', options: TIRADS_OPTIONS.shape, scoreKey: 'shape' },
      { id: 'margem', label: 'Margem', kind: 'select', options: TIRADS_OPTIONS.margin, scoreKey: 'margin' },
      { id: 'focos', label: 'Focos ecogênicos', kind: 'select', options: TIRADS_OPTIONS.foci, scoreKey: 'foci' },
    ],
  },
  ...PROC_TAIL,
];

const PROC_BREAST: StructuredSection[] = [
  { id: 'alvo', label: 'Lesão-alvo (BI-RADS)', calcId: 'birads-us-2013', fields: [
    { id: 'alvo_loc', label: 'Localização (h / dist. papila)', kind: 'text', placeholder: 'ex: 10h, 3 cm da papila' },
    { id: 'alvo_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' },
    { id: 'birads', label: 'BI-RADS', kind: 'calc', calcId: 'birads-us-2013' },
  ] },
  ...PROC_TAIL,
];

const PROC_OBSTETRIC: StructuredSection[] = [
  { id: 'pre', label: 'Avaliação Pré-procedimento', fields: [
    { id: 'placenta', label: 'Placenta', kind: 'text', placeholder: 'localização' },
    { id: 'la', label: 'Líquido amniótico', kind: 'text', placeholder: 'normal' },
    { id: 'vitalidade', label: 'Vitalidade fetal', kind: 'text', placeholder: 'BCF presente' },
  ] },
  { id: 'tecnica', label: 'Descrição do Procedimento', fields: [
    { id: 'tecnica', label: 'Técnica de punção', kind: 'text', placeholder: 'via/agulha' },
    { id: 'amostra', label: 'Amostra coletada', kind: 'text', placeholder: 'volume/aspecto' },
  ] },
  { id: 'controle', label: 'Avaliação Pós / Intercorrências', fields: [
    { id: 'controle_pos', label: 'Status', kind: 'select', options: PROC_CONTROLE },
    { id: 'intercorrencias', label: 'Intercorrências', kind: 'text', placeholder: 'ausentes' },
  ] },
];

function procedimentosOverlay(examName?: string): StructuredSection[] {
  const n = (examName || '').toLowerCase();
  if (/paaf\s+tireoide|tireoide/.test(n)) return PROC_THYROID;
  if (/paaf\s+mama|mama/.test(n)) return PROC_BREAST;
  if (/amnio|vilo\s+cori/.test(n)) return PROC_OBSTETRIC;
  return PROC_GENERIC;
}

export function getAreaOverlay(area: string, examName?: string): StructuredSection[] | null {
  if (area === 'medicina-fetal') return FETAL_SECTIONS;
  if (area === 'vascular') return vascularOverlay(examName);
  if (area === 'ginecologia') return gynecoOverlay(examName);
  if (area === 'mastologia') return mastologiaOverlay(examName);
  if (area === 'pequenas-partes') return pequenasPartesOverlay(examName);
  if (area === 'medicina-interna') return medicinaInternaOverlay(examName);
  if (area === 'musculoesqueletico') return MSK_GENERIC;
  if (area === 'reumatologico') return reumatoOverlay(examName);
  if (area === 'pediatria') return pediatriaOverlay(examName);
  if (area === 'procedimentos') return procedimentosOverlay(examName);
  return null;
}

export function hasAreaOverlay(area: string): boolean {
  return [
    'medicina-fetal', 'vascular', 'ginecologia', 'mastologia',
    'pequenas-partes', 'medicina-interna', 'musculoesqueletico', 'reumatologico',
    'pediatria', 'procedimentos',
  ].includes(area);
}
