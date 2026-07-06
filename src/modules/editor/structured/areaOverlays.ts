import { StructuredSection } from '../../../types';

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
      { id: 'ip_au', label: 'IP Art. Umbilical', kind: 'measure', calcId: 'doppler-fetal' },
      { id: 'ip_acm', label: 'IP ACM', kind: 'measure', calcId: 'doppler-fetal' },
      { id: 'rcp', label: 'RCP (ACM/AU)', kind: 'measure', hint: 'calculado: IP ACM / IP AU' },
      { id: 'ip_uta', label: 'IP Uterinas (média)', kind: 'measure', calcId: 'doppler-fetal' },
      { id: 'ducto_venoso', label: 'Ducto Venoso', kind: 'text', placeholder: 'onda A positiva' },
    ],
  },
  {
    id: 'liquido-amniotico',
    label: 'Líquido Amniótico',
    calcId: 'amniotic-fluid',
    fields: [
      { id: 'ila', label: 'ILA', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid' },
      { id: 'mbv', label: 'MBV (maior bolsão)', kind: 'measure', unit: 'mm', calcId: 'amniotic-fluid' },
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
    label: 'Morfologia',
    fields: [
      { id: 'morfologia', label: 'Avaliação morfológica', kind: 'text', placeholder: 'sem anomalias detectáveis nesta idade gestacional' },
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
    id: 'anexos',
    label: 'Formação Anexial (O-RADS)',
    calcId: 'orads-us-2022',
    fields: [{ id: 'orads', label: 'Classificação O-RADS', kind: 'calc', calcId: 'orads-us-2022' }],
  },
  {
    id: 'douglas',
    label: 'Fundo de Saco de Douglas',
    fields: [{ id: 'douglas', label: 'Douglas', kind: 'select', options: ['livre', 'líquido livre em pequena quantidade', 'coleção'] }],
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

const MAMA_STD: StructuredSection[] = [
  {
    id: 'composicao',
    label: 'Composição do Parênquima',
    fields: [{ id: 'acr', label: 'Densidade (ACR)', kind: 'select', options: ACR_COMPOSITION }],
  },
  {
    id: 'mama-d',
    label: 'Mama Direita',
    calcId: 'birads-us-2013',
    fields: [
      { id: 'md_loc', label: 'Localização (h / dist. papila)', kind: 'text', placeholder: 'ex: 10h, 3 cm da papila' },
      { id: 'md_dims', label: 'Dimensões do nódulo', kind: 'triplet', unit: 'cm' },
      { id: 'md_morf', label: 'Morfologia', kind: 'text', placeholder: 'forma, orientação, margens, ecogenicidade' },
      { id: 'md_birads', label: 'BI-RADS', kind: 'calc', calcId: 'birads-us-2013' },
    ],
  },
  {
    id: 'mama-e',
    label: 'Mama Esquerda',
    calcId: 'birads-us-2013',
    fields: [
      { id: 'me_loc', label: 'Localização (h / dist. papila)', kind: 'text', placeholder: 'ex: 2h, 4 cm da papila' },
      { id: 'me_dims', label: 'Dimensões do nódulo', kind: 'triplet', unit: 'cm' },
      { id: 'me_morf', label: 'Morfologia', kind: 'text', placeholder: 'forma, orientação, margens, ecogenicidade' },
      { id: 'me_birads', label: 'BI-RADS', kind: 'calc', calcId: 'birads-us-2013' },
    ],
  },
  {
    id: 'axilas',
    label: 'Regiões Axilares',
    fields: [{ id: 'axilas', label: 'Linfonodos axilares', kind: 'text', placeholder: 'sem linfonodomegalias suspeitas' }],
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
  { id: 'parenquima', label: 'Parênquima', fields: [{ id: 'parenquima', label: 'Ecotextura', kind: 'text', placeholder: 'homogêneo, ecogenicidade normal' }] },
  {
    id: 'nodulo',
    label: 'Nódulo (ACR TI-RADS)',
    calcId: 'tirads-2017',
    fields: [
      { id: 'nodulo_loc', label: 'Localização', kind: 'text', placeholder: 'lobo/terço' },
      { id: 'nodulo_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' },
      { id: 'nodulo_tirads', label: 'Classificação TI-RADS', kind: 'calc', calcId: 'tirads-2017' },
    ],
  },
  { id: 'linfonodos', label: 'Linfonodos Cervicais', fields: [{ id: 'linfonodos', label: 'Cadeias', kind: 'text', placeholder: 'sem linfonodomegalias suspeitas' }] },
];

const PP_CERVICAL: StructuredSection[] = [
  { id: 'parotidas', label: 'Glândulas Parótidas', fields: [{ id: 'parotidas', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas, sem nódulos' }] },
  { id: 'submandibulares', label: 'Glândulas Submandibulares', fields: [{ id: 'submandibulares', label: 'Aspecto', kind: 'text', placeholder: 'homogêneas' }] },
  { id: 'tireoide-rastreio', label: 'Tireoide (rastreamento)', fields: [{ id: 'tireoide_rastreio', label: 'Aspecto', kind: 'text', placeholder: 'tópica, sem nódulos' }] },
  {
    id: 'linfonodos',
    label: 'Cadeias Linfonodais (I–VII)',
    fields: [
      { id: 'linfonodos_asp', label: 'Aspecto', kind: 'select', options: ['sem linfonodomegalias', 'linfonodos reativos', 'linfonodo suspeito'] },
      { id: 'linfonodo_maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' },
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
  { id: 'figado', label: 'Fígado', fields: [
    { id: 'figado', label: 'Parênquima / dimensões', kind: 'text', placeholder: 'dimensões normais, ecotextura homogênea' },
    { id: 'porta', label: 'Veia porta', kind: 'text', placeholder: 'calibre normal, fluxo hepatopeta' },
  ] },
  { id: 'vias-biliares', label: 'Vias Biliares / Vesícula', fields: [
    { id: 'coledoco', label: 'Colédoco', kind: 'measure', unit: 'mm' },
    { id: 'vesicula', label: 'Vesícula biliar', kind: 'text', placeholder: 'paredes finas, sem cálculos' },
  ] },
  { id: 'pancreas', label: 'Pâncreas', fields: [{ id: 'pancreas', label: 'Aspecto', kind: 'text', placeholder: 'dimensões e ecotextura normais' }] },
  { id: 'baco', label: 'Baço', fields: [{ id: 'baco', label: 'Maior eixo', kind: 'measure', unit: 'cm' }] },
  { id: 'rins', label: 'Rins', fields: [{ id: 'rins', label: 'Aspecto', kind: 'text', placeholder: 'dimensões normais, sem hidronefrose/cálculos' }] },
  { id: 'aorta', label: 'Aorta / VCI', fields: [
    { id: 'aorta', label: 'Calibre da aorta', kind: 'measure', unit: 'cm' },
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

export function getAreaOverlay(area: string, examName?: string): StructuredSection[] | null {
  if (area === 'medicina-fetal') return FETAL_SECTIONS;
  if (area === 'vascular') return vascularOverlay(examName);
  if (area === 'ginecologia') return gynecoOverlay(examName);
  if (area === 'mastologia') return mastologiaOverlay(examName);
  if (area === 'pequenas-partes') return pequenasPartesOverlay(examName);
  if (area === 'medicina-interna') return medicinaInternaOverlay(examName);
  return null;
}

export function hasAreaOverlay(area: string): boolean {
  return ['medicina-fetal', 'vascular', 'ginecologia', 'mastologia', 'pequenas-partes', 'medicina-interna'].includes(area);
}
