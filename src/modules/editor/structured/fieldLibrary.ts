import { StructuredSection, StructuredFieldDef } from '../../../types';
import { TIRADS_OPTIONS } from './scoring';

/**
 * Biblioteca de ENRIQUECIMENTO: casa o rótulo de um compartimento (parseado da
 * máscara) com um conjunto curado de campos tipados / escores. Assim cada
 * máscara mantém SUAS seções (fidelidade por exame) e ganha tipagem onde houver.
 *
 * `canonical: true` → mantém os ids dos campos (usados pelo cálculo inline em
 * liveCompute; compartimentos únicos por máscara). Caso contrário, os ids são
 * prefixados pelo id da seção (evita colisão quando o rótulo se repete).
 */
interface Enricher {
  areas?: string[];
  match: RegExp;
  canonical?: boolean;
  apply?: Partial<Pick<StructuredSection, 'normalable' | 'normalText' | 'repeatable' | 'itemLabel' | 'score' | 'calcId'>>;
  fields: StructuredFieldDef[];
}

const NASCET = ['normal (<50%)', 'estenose 50–69%', 'estenose ≥70%', 'suboclusão', 'oclusão total'];
const ARTERIAL_FLOW = ['trifásico', 'bifásico', 'monofásico', 'ausente'];
const ARTERIAL_STENOSIS = ['sem estenose', 'estenose <50%', 'estenose 50–70%', 'estenose >70%', 'oclusão'];
const VENOUS_COMPRESS = ['compressível (pérvia)', 'parcialmente compressível', 'incompressível (TVP)'];
const VERT_FLOW = ['anterógrado', 'invertido (roubo)', 'ausente'];
const CEAP = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const SFU = ['ausente', 'SFU I', 'SFU II', 'SFU III', 'SFU IV'];
const SEMIQ = ['0 (ausente)', '1 (leve)', '2 (moderado)', '3 (acentuado)'];
const BIRADS_CAT = ['BI-RADS 1', 'BI-RADS 2', 'BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 4C', 'BI-RADS 5', 'BI-RADS 6'];

const NODULO_TIRADS: StructuredFieldDef[] = [
  { id: 'loc', label: 'Localização', kind: 'text', placeholder: 'lobo / terço' },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'composicao', label: 'Composição', kind: 'select', options: TIRADS_OPTIONS.composition, scoreKey: 'composition' },
  { id: 'ecogenicidade', label: 'Ecogenicidade', kind: 'select', options: TIRADS_OPTIONS.echogenicity, scoreKey: 'echogenicity' },
  { id: 'forma', label: 'Forma', kind: 'select', options: TIRADS_OPTIONS.shape, scoreKey: 'shape' },
  { id: 'margem', label: 'Margem', kind: 'select', options: TIRADS_OPTIONS.margin, scoreKey: 'margin' },
  { id: 'focos', label: 'Focos ecogênicos', kind: 'multiselect', options: TIRADS_OPTIONS.foci, scoreKey: 'foci' },
];

const LESAO_BIRADS: StructuredFieldDef[] = [
  { id: 'mama', label: 'Mama', kind: 'select', options: ['direita', 'esquerda'] },
  { id: 'loc', label: 'Localização (h / dist. papila)', kind: 'text' },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'forma', label: 'Forma', kind: 'select', options: ['oval', 'redonda', 'irregular'] },
  { id: 'orientacao', label: 'Orientação', kind: 'select', options: ['paralela', 'não paralela (mais alta que larga)'] },
  { id: 'margem', label: 'Margem', kind: 'select', options: ['circunscrita', 'indistinta', 'angular', 'microlobulada', 'espiculada'] },
  { id: 'eco', label: 'Padrão ecogênico', kind: 'select', options: ['anecoico', 'hipoecoico', 'isoecoico', 'hiperecoico', 'heterogêneo', 'complexo cístico-sólido'] },
  { id: 'acusticas', label: 'Características acústicas', kind: 'select', options: ['nenhuma', 'reforço acústico posterior', 'sombra acústica', 'padrão combinado'] },
  { id: 'birads', label: 'Categoria BI-RADS', kind: 'select', options: BIRADS_CAT },
];

const FORMACAO_ORADS: StructuredFieldDef[] = [
  { id: 'lado', label: 'Lado', kind: 'select', options: ['ovário direito', 'ovário esquerdo', 'extra-ovariana'] },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'tipo', label: 'Tipo', kind: 'select', options: ['unilocular', 'unilocular sólida', 'multilocular', 'multilocular sólida', 'sólida'] },
  { id: 'conteudo', label: 'Conteúdo', kind: 'select', options: ['anecoico', 'de vidro fosco', 'hemorrágico', 'espesso/heterogêneo'] },
  { id: 'septos', label: 'Septos / projeções', kind: 'select', options: ['ausentes', 'septos finos', 'septos espessos', 'projeções papilares'] },
  { id: 'vascularizacao', label: 'Fluxo (color score)', kind: 'select', options: ['1 – ausente', '2 – mínimo', '3 – moderado', '4 – marcante'] },
  { id: 'orads', label: 'Categoria O-RADS', kind: 'select', options: ['O-RADS 1', 'O-RADS 2', 'O-RADS 3', 'O-RADS 4', 'O-RADS 5'] },
];

const CISTO_BOSNIAK: StructuredFieldDef[] = [
  { id: 'lado', label: 'Lado / localização', kind: 'text' },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'septos', label: 'Septos', kind: 'select', options: ['ausentes', 'poucos finos', 'múltiplos finos', 'espessos/irregulares'] },
  { id: 'parede', label: 'Parede', kind: 'select', options: ['fina', 'espessa/irregular'] },
  { id: 'calcificacao', label: 'Calcificação', kind: 'select', options: ['ausente', 'fina', 'grosseira'] },
  { id: 'solido', label: 'Componente sólido', kind: 'select', options: ['ausente', 'presente'] },
];

const ENRICHERS: Enricher[] = [
  // ── MEDICINA FETAL ──
  // Biometria (2º/3º trim) e datação
  { areas: ['medicina-fetal'], match: /biometria|fetometria/i, canonical: true, fields: [
    { id: 'dbp', label: 'DBP', kind: 'measure', unit: 'mm' }, { id: 'dof', label: 'DOF', kind: 'measure', unit: 'mm' },
    { id: 'cc', label: 'CC', kind: 'measure', unit: 'mm' }, { id: 'ca', label: 'CA', kind: 'measure', unit: 'mm' },
    { id: 'cf', label: 'CF', kind: 'measure', unit: 'mm' }, { id: 'pfe', label: 'PFE / Percentil', kind: 'calc', calcId: 'who-fetal-biometry' },
    { id: 'sexo_fetal', label: 'Sexo (curva OMS)', kind: 'select', options: ['indeterminado', 'masculino', 'feminino'] },
  ] },
  { areas: ['medicina-fetal'], match: /peso fetal estimado 1/i, fields: [{ id: 'pfe1', label: 'PFE Feto 1', kind: 'measure', unit: 'g' }] },
  { areas: ['medicina-fetal'], match: /peso fetal estimado 2/i, fields: [{ id: 'pfe2', label: 'PFE Feto 2', kind: 'measure', unit: 'g' }] },
  { areas: ['medicina-fetal'], match: /idade gestacional de refer|data[çc][ãa]o|^refer[êe]ncia/i, canonical: true, fields: [
    { id: 'dum', label: 'DUM', kind: 'text', placeholder: 'dd/mm/aaaa' },
  ] },
  // 1º trimestre (saco, embrião, CCN)
  { areas: ['medicina-fetal'], match: /saco gestacional/i, canonical: true, fields: [{ id: 'dmsg', label: 'DMSG', kind: 'measure', unit: 'mm', calcId: 'msd-dmsg' }] },
  { areas: ['medicina-fetal'], match: /embri[ãa]o|cabe[çc]a.?n[áa]dega|\bccn\b/i, canonical: true, fields: [{ id: 'ccn', label: 'CCN', kind: 'measure', unit: 'mm', calcId: 'gestational-age' }] },
  // Vitalidade / vasos Doppler específicos (mapeia cada vaso ao seu IP)
  { areas: ['medicina-fetal'], match: /batimentos|\bbcf\b|\bbce\b|frequ[êe]ncia card/i, canonical: true, fields: [{ id: 'bcf', label: 'BCF / FC', kind: 'measure', unit: 'bpm' }] },
  { areas: ['medicina-fetal'], match: /art[ée]ria umbilical/i, canonical: true, fields: [{ id: 'ip_au', label: 'IP Umbilical', kind: 'measure', hint: 'alterado se > p95' }] },
  { areas: ['medicina-fetal'], match: /art[ée]ria cerebral m[ée]dia/i, canonical: true, fields: [
    { id: 'ip_acm', label: 'IP ACM', kind: 'measure', hint: 'redistribuição se < p5' },
    { id: 'psv_acm', label: 'PSV ACM', kind: 'measure', unit: 'cm/s', hint: 'anemia se > 1,5 MoM (auto)' },
  ] },
  { areas: ['medicina-fetal'], match: /c[ée]rebro.?placent|\brcp\b/i, canonical: true, fields: [{ id: 'rcp', label: 'RCP (ACM/AU)', kind: 'measure', hint: 'auto; reduzida se < 1' }] },
  { areas: ['medicina-fetal'], match: /art[ée]rias uterinas/i, canonical: true, fields: [{ id: 'ip_uta', label: 'IP Uterinas (média)', kind: 'measure', hint: 'risco se > p95 / notch' }] },
  { areas: ['medicina-fetal'], match: /art[ée]rias? oft[áa]lmic/i, canonical: true, fields: [
    { id: 'oft_p1', label: 'PSV 1º pico (P1)', kind: 'measure', unit: 'cm/s', hint: 'média dos dois olhos' },
    { id: 'oft_p2', label: 'PSV 2º pico (P2)', kind: 'measure', unit: 'cm/s', hint: 'razão P2/P1 ≥ 0,65 = risco de PE (auto)' },
  ] },
  // Marcadores de 1º trimestre
  { areas: ['medicina-fetal'], match: /transluc[êe]ncia nucal|\btn\b/i, canonical: true, fields: [{ id: 'nt', label: 'TN', kind: 'measure', unit: 'mm', hint: 'alterada se > 3,5 mm' }] },
  { areas: ['medicina-fetal'], match: /osso nasal/i, fields: [{ id: 'on', label: 'Osso nasal', kind: 'select', options: ['presente', 'ausente', 'hipoplásico'] }] },
  { areas: ['medicina-fetal'], match: /ducto venoso/i, fields: [
    { id: 'dv', label: 'Onda A', kind: 'select', options: ['positiva', 'ausente', 'reversa'] },
    { id: 'ip_dv', label: 'IP DV', kind: 'measure', hint: '>P95 = pré-carga aumentada (auto)' },
  ] },
  { areas: ['medicina-fetal'], match: /valva tric[úu]spide|regurgita/i, fields: [{ id: 'tricuspide', label: 'Regurgitação', kind: 'select', options: ['ausente', 'presente'] }] },
  // Líquido / cervicometria
  { areas: ['medicina-fetal'], match: /l[íi]quido amni/i, canonical: true, fields: [
    { id: 'ila', label: 'ILA', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid', hint: 'normal 8–18 cm' },
    { id: 'mbv', label: 'MBV', kind: 'measure', unit: 'mm', calcId: 'amniotic-fluid' },
  ] },
  { areas: ['medicina-fetal'], match: /comprimento do colo|cervicometria|colo uterino|colo do [úu]tero/i, canonical: true, fields: [
    { id: 'colo', label: 'Comprimento do colo', kind: 'measure', unit: 'mm', hint: 'colo curto se < 25 mm' },
  ] },
  { areas: ['medicina-fetal'], match: /funiliza[çc][ãa]o|funnel|orif[íi]cio cervical/i, fields: [{ id: 'funneling', label: 'Afunilamento', kind: 'select', options: ['ausente', 'presente'] }] },
  // Estática / vitalidade grosseira / anexos fetais
  { areas: ['medicina-fetal'], match: /apresenta[çc][ãa]o/i, fields: [{ id: 'apresentacao', label: 'Apresentação', kind: 'select', options: ['cefálica', 'pélvica', 'córmica'] }] },
  { areas: ['medicina-fetal'], match: /movimentos fetais/i, fields: [{ id: 'movimentos', label: 'Movimentos', kind: 'select', options: ['presentes', 'ausentes'] }] },
  { areas: ['medicina-fetal'], match: /cord[ãa]o umbilical/i, fields: [{ id: 'cordao', label: 'Vasos', kind: 'select', options: ['3 vasos (2 artérias + 1 veia)', '2 vasos (artéria única)'] }] },
  { areas: ['medicina-fetal'], match: /placenta/i, apply: { normalable: true, normalText: 'localização normal, grau compatível com a IG' }, fields: [
    { id: 'loc', label: 'Localização', kind: 'select', options: ['anterior', 'posterior', 'fúndica', 'lateral', 'prévia'] },
    { id: 'grau', label: 'Grau (Grannum)', kind: 'select', options: ['0', 'I', 'II', 'III'] },
  ] },
  // Ecocardiograma fetal
  { areas: ['medicina-fetal'], match: /^situs/i, fields: [{ id: 'situs', label: 'Situs', kind: 'select', options: ['solitus', 'inversus', 'ambíguo'] }] },
  { areas: ['medicina-fetal'], match: /4 c[âa]maras|quatro c[âa]maras/i, fields: [{ id: 'quatro_camaras', label: 'Corte 4 câmaras', kind: 'select', options: ['normal', 'alterado'] }, { id: 'quatro_desc', label: 'Descrição', kind: 'text' }] },
  { areas: ['medicina-fetal'], match: /vias de sa[íi]da/i, fields: [{ id: 'vias_saida', label: 'Vias de saída', kind: 'select', options: ['cruzamento normal', 'alteradas'] }] },
  { areas: ['medicina-fetal'], match: /arcos a[óo]rtico|3 vasos e traqueia|3vt/i, fields: [{ id: 'arcos', label: 'Achados', kind: 'text', placeholder: 'arcos/3VT' }] },
  { areas: ['medicina-fetal'], match: /fun[çc][ãa]o ventricular/i, fields: [{ id: 'funcao_vent', label: 'Função ventricular', kind: 'select', options: ['normal', 'disfunção'] }] },
  // Neurossonografia
  { areas: ['medicina-fetal'], match: /sistema ventricular/i, fields: [{ id: 'atrio_vent', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', hint: 'ventriculomegalia se > 10 mm' }] },

  // ── VASCULAR ──
  { areas: ['vascular'], match: /carot[íi]deo direito|car[óo]tidas? direita/i, canonical: true, fields: [
    { id: 'vps_acc_d', label: 'VPS ACC', kind: 'measure', unit: 'cm/s' }, { id: 'vps_aci_d', label: 'VPS ACI', kind: 'measure', unit: 'cm/s' },
    { id: 'vdf_aci_d', label: 'VDF ACI', kind: 'measure', unit: 'cm/s' }, { id: 'estenose_d', label: 'Estenose (NASCET)', kind: 'select', options: NASCET },
  ] },
  { areas: ['vascular'], match: /carot[íi]deo esquerdo|car[óo]tidas? esquerda/i, canonical: true, fields: [
    { id: 'vps_acc_e', label: 'VPS ACC', kind: 'measure', unit: 'cm/s' }, { id: 'vps_aci_e', label: 'VPS ACI', kind: 'measure', unit: 'cm/s' },
    { id: 'vdf_aci_e', label: 'VDF ACI', kind: 'measure', unit: 'cm/s' }, { id: 'estenose_e', label: 'Estenose (NASCET)', kind: 'select', options: NASCET },
  ] },
  { areas: ['vascular'], match: /m[ée]dio.?intimal|\beim\b|\bemi\b/i, canonical: true, fields: [
    { id: 'emi_d', label: 'EMI Direita', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br' },
    { id: 'emi_e', label: 'EMI Esquerda', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br' },
  ] },
  { areas: ['vascular'], match: /art[ée]ria renal direita/i, canonical: true, fields: [
    { id: 'vps_renal_d', label: 'VPS a. renal D', kind: 'measure', unit: 'cm/s', hint: 'estenose se > 180' }, { id: 'vps_aorta', label: 'VPS aorta', kind: 'measure', unit: 'cm/s', hint: 'para RAR' },
  ] },
  { areas: ['vascular'], match: /art[ée]ria renal esquerda/i, canonical: true, fields: [{ id: 'vps_renal_e', label: 'VPS a. renal E', kind: 'measure', unit: 'cm/s', hint: 'estenose se > 180' }] },
  { areas: ['vascular'], match: /intraparenq.*direit/i, canonical: true, fields: [{ id: 'ir_d', label: 'IR intraparenq. D', kind: 'measure', hint: 'elevado se > 0,7' }] },
  { areas: ['vascular'], match: /intraparenq.*esquerd/i, canonical: true, fields: [{ id: 'ir_e', label: 'IR intraparenq. E', kind: 'measure', hint: 'elevado se > 0,7' }] },
  { areas: ['vascular'], match: /[íi]ndices intraparenq|intraparenquimatos/i, canonical: true, fields: [{ id: 'ir_d', label: 'IR intraparenq.', kind: 'measure', hint: 'elevado se > 0,7' }] },
  { areas: ['vascular'], match: /^rim (direito|esquerdo)/i, fields: [{ id: 'comprimento', label: 'Comprimento', kind: 'measure', unit: 'cm' }] },
  { areas: ['vascular'], match: /tornozelo.?braquial|\bitb\b/i, canonical: true, fields: [
    { id: 'itb_d', label: 'ITB Direito', kind: 'measure' }, { id: 'itb_e', label: 'ITB Esquerdo', kind: 'measure' },
  ] },
  { areas: ['vascular'], match: /aorta/i, canonical: true, fields: [
    { id: 'aorta', label: 'Maior calibre', kind: 'measure', unit: 'cm', hint: 'aneurisma se ≥ 3,0 cm' },
    { id: 'aorta_desc', label: 'Morfologia', kind: 'text', placeholder: 'fusiforme/sacular, trombo, dissecção' },
  ] },
  // Vertebrais / subclávias
  { areas: ['vascular'], match: /vertebra/i, apply: { normalable: true, normalText: 'fluxo anterógrado e simétrico' }, fields: [
    { id: 'vert_d', label: 'Fluxo Vertebral D', kind: 'select', options: VERT_FLOW }, { id: 'vert_e', label: 'Fluxo Vertebral E', kind: 'select', options: VERT_FLOW },
  ] },
  { areas: ['vascular'], match: /subcl[áa]via/i, apply: { normalable: true, normalText: 'sem estenose ou roubo' }, fields: [{ id: 'subclavia', label: 'Achado', kind: 'select', options: ['normal', 'estenose', 'roubo subclávio'] }] },
  // Oftálmicas / retina
  { areas: ['vascular'], match: /oft[áa]lmica|central da retina|ciliares/i, fields: [{ id: 'ir', label: 'IR', kind: 'measure' }, { id: 'ip', label: 'IP', kind: 'measure' }] },
  // Ilíacas / endoprótese
  { areas: ['vascular'], match: /il[íi]aca/i, fields: [{ id: 'calibre', label: 'Calibre', kind: 'measure', unit: 'mm' }, { id: 'estenose', label: 'Estenose', kind: 'select', options: ARTERIAL_STENOSIS }] },
  { areas: ['vascular'], match: /endopr[óo]tese|endoleak/i, apply: { normalable: true, normalText: 'sem endoleak, bem posicionada' }, fields: [{ id: 'endoleak', label: 'Endoleak', kind: 'select', options: ['ausente', 'tipo I', 'tipo II', 'tipo III', 'tipo IV'] }] },
  // Eixos arteriais periféricos (fluxo tri/bi/monofásico + estenose)
  { areas: ['vascular'], match: /eixo|femoropopl[íi]teo|infrapatelar|aortoil[íi]aco|art[ée]ria braquial|radial|ulnar|subcl[áa]vio.?axilar/i, fields: [
    { id: 'fluxo', label: 'Padrão de fluxo', kind: 'select', options: ARTERIAL_FLOW }, { id: 'estenose', label: 'Estenose', kind: 'select', options: ARTERIAL_STENOSIS },
  ] },
  { areas: ['vascular'], match: /arcos palmares|allen/i, fields: [{ id: 'allen', label: 'Teste de Allen', kind: 'select', options: ['patente', 'incompleto'] }] },
  // Venoso: profundo (compressibilidade/TVP), superficial (refluxo/CEAP), perfurantes
  { areas: ['vascular'], match: /venoso profundo/i, apply: { normalable: true, normalText: 'compressível, sem trombos, fásico com a respiração' }, fields: [
    { id: 'compress', label: 'Compressibilidade', kind: 'select', options: VENOUS_COMPRESS }, { id: 'trombo', label: 'Trombo / segmento', kind: 'text', placeholder: 'femoral, poplítea...' },
  ] },
  { areas: ['vascular'], match: /venoso superficial|safen/i, apply: { normalable: true, normalText: 'sem refluxo (< 0,5 s)' }, fields: [
    { id: 'refluxo', label: 'Refluxo', kind: 'select', options: ['ausente', 'presente'] }, { id: 'ceap', label: 'CEAP', kind: 'select', options: CEAP }, { id: 'calibre', label: 'Calibre safena', kind: 'measure', unit: 'mm' },
  ] },
  { areas: ['vascular'], match: /perfurantes?/i, apply: { normalable: true, normalText: 'competentes' }, fields: [{ id: 'perfurante', label: 'Insuficientes', kind: 'text', placeholder: 'localização e calibre' }] },
  { areas: ['vascular'], match: /braquiocef[áa]lica|cava superior/i, fields: [{ id: 'fluxo', label: 'Fluxo (indireto)', kind: 'select', options: ['normal (fásico)', 'alterado (contínuo)'] }] },

  // ── MASTOLOGIA ──
  { areas: ['mastologia'], match: /composi[çc][ãa]o|par[êe]nquima/i, fields: [
    { id: 'acr', label: 'Densidade (ACR)', kind: 'select', options: ['ACR A (adiposa)', 'ACR B', 'ACR C', 'ACR D (densa)'] },
  ] },
  { areas: ['mastologia'], match: /mama (direita|esquerda)|n[óo]dul|les[ãa]o|achados? ultrass/i, apply: { repeatable: true, itemLabel: 'Lesão', score: 'birads' }, fields: LESAO_BIRADS },
  { areas: ['mastologia'], match: /axila|linfonodo/i, apply: { normalable: true, normalText: 'linfonodos axilares de aspecto habitual' }, fields: [
    { id: 'lado', label: 'Axila', kind: 'select', options: ['direita', 'esquerda', 'bilateral'] },
    { id: 'maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' }, { id: 'cortical', label: 'Cortical', kind: 'measure', unit: 'mm' },
  ] },
  { areas: ['mastologia'], match: /ductos mam/i, apply: { normalable: true, normalText: 'sem ectasia ou conteúdo anômalo' }, fields: [{ id: 'ectasia', label: 'Ectasia ductal', kind: 'select', options: ['ausente', 'presente'] }, { id: 'desc', label: 'Conteúdo', kind: 'text' }] },
  { areas: ['mastologia'], match: /pele|are[óo]lo|papilar|subcut[âa]neo|planos profundos/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['mastologia'], match: /estudo doppler|dopplerfluxometria/i, apply: { normalable: true, normalText: 'sem vascularização anômala' }, fields: [{ id: 'vasc', label: 'Vascularização', kind: 'select', options: ['ausente/habitual', 'aumentada intranodular'] }] },

  // ── GINECOLOGIA ──
  { areas: ['ginecologia'], match: /^[úu]tero$|corpo uterino/i, canonical: true, fields: [
    { id: 'utero_pos', label: 'Posição', kind: 'select', options: ['anteversoflexão', 'retroversoflexão', 'medioversão'] },
    { id: 'utero_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'miometrio', label: 'Miométrio', kind: 'select', options: ['homogêneo', 'heterogêneo (adenomiose)', 'com miomas'] },
  ] },
  { areas: ['ginecologia'], match: /endom[ée]trio/i, canonical: true, fields: [
    { id: 'endometrio_esp', label: 'Espessura', kind: 'measure', unit: 'mm' },
    { id: 'menopausa', label: 'Estado', kind: 'select', options: ['menacme', 'pós-menopausa'] },
    { id: 'endometrio_asp', label: 'Aspecto', kind: 'text', placeholder: 'homogêneo, linha média centrada' },
  ] },
  { areas: ['ginecologia'], match: /ov[áa]rio direito/i, canonical: true, fields: [
    { id: 'ovd_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'ovd_afc', label: 'Folículos antrais (CFA)', kind: 'measure', hint: 'SOP se ≥ 20 ou vol > 10 cm³' },
  ] },
  { areas: ['ginecologia'], match: /ov[áa]rio esquerdo/i, canonical: true, fields: [
    { id: 'ove_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'ove_afc', label: 'Folículos antrais (CFA)', kind: 'measure', hint: 'SOP se ≥ 20 ou vol > 10 cm³' },
  ] },
  { areas: ['ginecologia'], match: /anexo|forma[çc][ãa]o anexial/i, apply: { repeatable: true, itemLabel: 'Formação', score: 'orads' }, fields: FORMACAO_ORADS },
  { areas: ['ginecologia'], match: /douglas|fundo de saco/i, apply: { normalable: true, normalText: 'livre' }, fields: [
    { id: 'douglas', label: 'Conteúdo', kind: 'select', options: ['líquido livre pequena qtde', 'líquido moderado/volumoso', 'coleção'] },
  ] },
  { areas: ['ginecologia'], match: /colo uterino/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'colo_desc', label: 'Achados', kind: 'text', placeholder: 'cisto de Naboth, pólipo, comprimento' }] },
  { areas: ['ginecologia'], match: /estudo doppler|dopplerfluxometria/i, apply: { normalable: true, normalText: 'índices arteriais dentro da normalidade' }, fields: [{ id: 'ip_uta_gin', label: 'IP a. uterinas', kind: 'measure' }, { id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['ginecologia'], match: /^ov[áa]rios$/i, apply: { normalable: true, normalText: 'tópicos, sem endometriomas' }, fields: [{ id: 'endometrioma', label: 'Endometrioma', kind: 'text', placeholder: 'lado e dimensões' }] },
  { areas: ['ginecologia'], match: /compartimento (anterior|posterior)|param[ée]trio|retovaginal|uterossacr|retossigmoide/i, apply: { normalable: true, normalText: 'sem focos de endometriose profunda' }, fields: [{ id: 'die', label: 'Foco de DIE', kind: 'select', options: ['ausente', 'presente'] }, { id: 'desc', label: 'Detalhe', kind: 'text' }] },

  // ── PEQUENAS PARTES ──
  { areas: ['pequenas-partes'], match: /lobo direito/i, canonical: true, fields: [{ id: 'lobo_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }] },
  { areas: ['pequenas-partes'], match: /lobo esquerdo/i, canonical: true, fields: [{ id: 'lobo_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }] },
  { areas: ['pequenas-partes'], match: /^istmo/i, canonical: true, fields: [{ id: 'istmo', label: 'Espessura', kind: 'measure', unit: 'mm' }] },
  { areas: ['pequenas-partes'], match: /n[óo]dul/i, apply: { repeatable: true, itemLabel: 'Nódulo', score: 'tirads' }, fields: NODULO_TIRADS },
  { areas: ['pequenas-partes'], match: /test[íi]culo direito/i, canonical: true, fields: [{ id: 'test_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }, { id: 'test_d_eco', label: 'Ecotextura', kind: 'text', placeholder: 'homogênea' }] },
  { areas: ['pequenas-partes'], match: /test[íi]culo esquerdo/i, canonical: true, fields: [{ id: 'test_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }, { id: 'test_e_eco', label: 'Ecotextura', kind: 'text', placeholder: 'homogênea' }] },
  { areas: ['pequenas-partes'], match: /linfonod/i, apply: { normalable: true, normalText: 'sem linfonodomegalias suspeitas' }, fields: [{ id: 'maior', label: 'Maior linfonodo', kind: 'measure', unit: 'mm' }, { id: 'nivel', label: 'Nível / lado', kind: 'text' }, { id: 'susp', label: 'Aspecto suspeito', kind: 'text' }] },
  // Tireoide: glândula/parênquima
  { areas: ['pequenas-partes'], match: /gl[âa]ndula tireoide|^tireoide$|^par[êe]nquima/i, apply: { normalable: true, normalText: 'ecotextura homogênea, vascularização normal' }, fields: [
    { id: 'eco', label: 'Ecotextura', kind: 'select', options: ['homogênea', 'heterogênea', 'micronodular difusa'] }, { id: 'vasc', label: 'Vascularização', kind: 'select', options: ['normal', 'aumentada (tireoidite)', 'reduzida'] },
  ] },
  // Escroto: epidídimos, túnicas/hidrocele, funículos/varicocele, Doppler
  { areas: ['pequenas-partes'], match: /epid[íi]dimo/i, apply: { normalable: true, normalText: 'normais, sem espessamento ou cistos' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text', placeholder: 'epididimite, cisto, espermatocele' }] },
  { areas: ['pequenas-partes'], match: /t[úu]nica|l[íi]quido intravaginal|hidrocele|parede escrotal/i, fields: [{ id: 'hidrocele', label: 'Hidrocele', kind: 'select', options: ['ausente', 'pequena', 'moderada', 'volumosa'] }] },
  { areas: ['pequenas-partes'], match: /fun[íi]culo|varicocele|cord[ãa]o esperm/i, fields: [{ id: 'varicocele', label: 'Varicocele', kind: 'text', placeholder: 'ausente / grau e refluxo à Valsalva' }] },
  { areas: ['pequenas-partes'], match: /dopplerfluxometria|estudo doppler/i, fields: [{ id: 'fluxo', label: 'Fluxo', kind: 'select', options: ['simétrico/preservado', 'aumentado', 'reduzido/ausente (torção?)'] }] },
  // Glândulas salivares
  { areas: ['pequenas-partes'], match: /par[óo]tida|submandibular|sublingual|salivar/i, apply: { normalable: true, normalText: 'homogêneas, sem nódulos ou dilatação ductal' }, fields: [{ id: 'achado', label: 'Achado', kind: 'select', options: ['nódulo', 'sialadenite', 'sialolitíase', 'cisto'] }, { id: 'desc', label: 'Detalhe / dimensões', kind: 'text' }] },
  { areas: ['pequenas-partes'], match: /ducto(s)? salivar/i, apply: { normalable: true, normalText: 'não dilatados, sem cálculos' }, fields: [{ id: 'calculo', label: 'Cálculo (maior)', kind: 'measure', unit: 'mm' }] },
  // Partes moles / inguinais / parede (pele, planos, hérnia)
  { areas: ['pequenas-partes'], match: /canal inguinal|canal femoral|regi[ãa]o inguinal/i, apply: { normalable: true, normalText: 'sem hérnia à manobra de Valsalva' }, fields: [{ id: 'hernia', label: 'Hérnia', kind: 'select', options: ['ausente', 'inguinal indireta', 'inguinal direta', 'femoral'] }, { id: 'conteudo', label: 'Conteúdo / redutibilidade', kind: 'text' }] },
  { areas: ['pequenas-partes'], match: /pele e tecido|subcut[âa]neo|planos musc|f[áa]scia|partes moles|estruturas vasculares/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'lesao', label: 'Lesão / achado', kind: 'text', placeholder: 'localização, dimensões, aspecto' }] },

  // ── MEDICINA INTERNA ──
  { areas: ['medicina-interna'], match: /f[íi]gado/i, apply: { normalable: true, normalText: 'dimensões normais, ecotextura homogênea, sem lesões focais' }, fields: [
    { id: 'esteatose', label: 'Esteatose', kind: 'select', options: ['ausente', 'leve (I)', 'moderada (II)', 'acentuada (III)'] },
    { id: 'figado_lesao', label: 'Lesão focal', kind: 'text', fullWidth: true },
  ] },
  { areas: ['medicina-interna'], match: /vias biliares|ves[íi]cula biliar/i, apply: { normalable: true, normalText: 'paredes finas sem cálculos; vias não dilatadas' }, fields: [
    { id: 'vesicula', label: 'Vesícula', kind: 'select', options: ['cálculo(s)', 'lama biliar', 'pólipo', 'espessamento', 'colecistectomizado'] },
    { id: 'coledoco', label: 'Colédoco', kind: 'measure', unit: 'mm' },
  ] },
  { areas: ['medicina-interna'], match: /p[âa]ncreas/i, apply: { normalable: true, normalText: 'dimensões e ecotextura normais, Wirsung não dilatado' }, fields: [{ id: 'pancreas', label: 'Achados', kind: 'text', placeholder: 'lesão, dilatação' }, { id: 'wirsung', label: 'Wirsung', kind: 'measure', unit: 'mm' }] },
  { areas: ['medicina-interna'], match: /^ba[çc]o/i, canonical: true, apply: { normalable: true, normalText: 'dimensões normais, homogêneo' }, fields: [{ id: 'baco_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm' }] },
  { areas: ['medicina-interna'], match: /aorta/i, canonical: true, apply: { normalable: true, normalText: 'calibre normal; VCI de aspecto habitual' }, fields: [{ id: 'aorta', label: 'Calibre aorta', kind: 'measure', unit: 'cm', hint: 'aneurisma se ≥ 3,0 cm' }, { id: 'vci', label: 'VCI', kind: 'calc', calcId: 'ivc-index' }] },
  { areas: ['medicina-interna'], match: /^bexiga|bexiga urin[áa]ria|bexiga e vias/i, apply: { normalable: true, normalText: 'paredes finas, conteúdo anecoico' }, fields: [{ id: 'espessamento', label: 'Parede', kind: 'select', options: ['normal', 'espessamento difuso', 'espessamento focal', 'trabeculação'] }, { id: 'desc', label: 'Conteúdo / lesões', kind: 'text' }] },
  { areas: ['medicina-interna'], match: /ureter/i, apply: { normalable: true, normalText: 'não dilatados' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text', placeholder: 'dilatação, cálculo' }] },
  { areas: ['medicina-interna'], match: /cavidade (abdominal|peritoneal|p[ée]lvica)|l[íi]quido livre|asc[íi]te|peritone/i, apply: { normalable: true, normalText: 'sem líquido livre ou coleções' }, fields: [{ id: 'liquido', label: 'Líquido livre', kind: 'select', options: ['ausente', 'pequena quantidade', 'moderada', 'volumosa'] }] },
  { areas: ['medicina-interna'], match: /ves[íi]cula(s)? seminal|ves[íi]culas seminais/i, apply: { normalable: true, normalText: 'simétricas, sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['medicina-interna'], match: /veia porta|sistema porta/i, fields: [{ id: 'porta_fluxo', label: 'Fluxo portal', kind: 'select', options: ['hepatopeta normal', 'lentificado', 'hepatofugal', 'trombose'] }, { id: 'porta_cal', label: 'Calibre', kind: 'measure', unit: 'mm' }] },
  { areas: ['medicina-interna'], match: /veias hep[áa]ticas|art[ée]ria hep[áa]tica|art[ée]rias renais|an[áa]lise vascular/i, apply: { normalable: true, normalText: 'fluxo e índices normais' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text', placeholder: 'padrão de onda, IR' }] },
  { areas: ['medicina-interna'], match: /pr[óo]stata/i, canonical: true, fields: [
    { id: 'prostata_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'prostate-weight' },
    { id: 'psa', label: 'PSA total', kind: 'measure', unit: 'ng/mL' }, { id: 'lobo_mediano', label: 'Lobo mediano', kind: 'text' },
  ] },
  { areas: ['medicina-interna'], match: /rim direito/i, canonical: true, apply: { normalable: true, normalText: 'dimensões normais, sem dilatação ou cálculos' }, fields: [
    { id: 'rim_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' }, { id: 'rim_d_dilat', label: 'Dilatação (SFU)', kind: 'select', options: SFU },
  ] },
  { areas: ['medicina-interna'], match: /rim esquerdo/i, canonical: true, apply: { normalable: true, normalText: 'dimensões normais, sem dilatação ou cálculos' }, fields: [
    { id: 'rim_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm' }, { id: 'rim_e_dilat', label: 'Dilatação (SFU)', kind: 'select', options: SFU },
  ] },
  { areas: ['medicina-interna'], match: /res[íi]duo|vrpm|p[óo]s.?miccional/i, canonical: true, fields: [{ id: 'vrpm', label: 'VRPM', kind: 'measure', unit: 'ml' }] },

  // ── MUSCULOESQUELÉTICO (descritivo, escopado) ──
  { areas: ['musculoesqueletico'], match: /tend[ãa]o|tend[õo]es|manguito/i, fields: [{ id: 'estado', label: 'Integridade', kind: 'select', options: ['íntegro', 'tendinopatia', 'ruptura parcial', 'ruptura completa'] }, { id: 'desc', label: 'Detalhe', kind: 'text' }] },
  { areas: ['musculoesqueletico', 'reumatologico'], match: /articula[çc][ãa]o|derrame|recesso|articular/i, fields: [{ id: 'derrame', label: 'Derrame', kind: 'select', options: ['ausente', 'pequeno', 'moderado', 'volumoso'] }, { id: 'sinovite', label: 'Sinovite/PD', kind: 'select', options: ['ausente', 'GS1', 'GS2', 'GS3'] }] },
  { areas: ['musculoesqueletico'], match: /bursa/i, apply: { normalable: true, normalText: 'sem bursopatia' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['musculoesqueletico'], match: /nervo|t[úu]nel do carpo/i, apply: { normalable: true, normalText: 'sem sinais compressivos' }, fields: [{ id: 'csa', label: 'Área seccional (CSA)', kind: 'measure', unit: 'mm²' }, { id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['musculoesqueletico'], match: /menisc/i, apply: { normalable: true, normalText: 'íntegros à avaliação periférica' }, fields: [{ id: 'menisco', label: 'Menisco', kind: 'select', options: ['íntegro', 'degeneração', 'extrusão', 'rotura'] }] },
  { areas: ['musculoesqueletico'], match: /superf[íi]cies? [óo]sseas|contornos [óo]sseos|osteoartros/i, apply: { normalable: true, normalText: 'contornos ósseos regulares' }, fields: [{ id: 'osso', label: 'Achado ósseo', kind: 'select', options: ['regulares', 'osteófitos', 'erosão', 'irregularidade cortical'] }] },
  { areas: ['musculoesqueletico'], match: /trofismo|musculatura|m[úu]sculo|f[áa]scia/i, apply: { normalable: true, normalText: 'trofismo e ecotextura preservados' }, fields: [{ id: 'musculo', label: 'Músculo', kind: 'select', options: ['preservado', 'atrofia', 'lesão/edema', 'hérnia muscular'] }, { id: 'desc', label: 'Detalhe', kind: 'text' }] },
  // Catch-all de região/compartimento (contém tendões/ligamentos por região)
  { areas: ['musculoesqueletico'], match: /compartimento|regi[ãa]o (dorsal|volar|medial|lateral|anterior|posterior|plantar)|faces? radial|dedos|ligament/i, apply: { normalable: true, normalText: 'estruturas avaliadas sem alterações' }, fields: [{ id: 'achado', label: 'Achado', kind: 'select', options: ['sem alterações', 'tendinopatia', 'ruptura', 'derrame/bursite', 'lesão ligamentar', 'outro'] }, { id: 'desc', label: 'Descrição', kind: 'text', fullWidth: true }] },
  { areas: ['musculoesqueletico'], match: /pele e tecido|tecidos moles|vasculonervosas|manobras din[âa]micas/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  // ── REUMATOLÓGICO ──
  { areas: ['reumatologico'], match: /hipertrofia sinovial|escala de cinza|\bgsus\b/i, fields: [{ id: 'gsus', label: 'GSUS (0–3)', kind: 'select', options: SEMIQ }] },
  { areas: ['reumatologico'], match: /power doppler|\bpdus\b/i, fields: [{ id: 'pdus', label: 'PDUS (0–3)', kind: 'select', options: SEMIQ }] },
  { areas: ['reumatologico'], match: /[êe]ntese/i, apply: { normalable: true, normalText: 'sem entesopatia' }, fields: [{ id: 'entese', label: 'Ênteses', kind: 'select', options: ['normal', 'espessamento', 'erosão', 'PD positivo', 'entesófito'] }] },
  { areas: ['reumatologico'], match: /eros[õo]es|superf[íi]cies [óo]sseas/i, apply: { normalable: true, normalText: 'sem erosões' }, fields: [{ id: 'erosao', label: 'Erosões', kind: 'select', options: ['ausentes', 'presentes'] }] },
  { areas: ['reumatologico'], match: /protocolo|articula[çc][õo]es com atividade/i, fields: [{ id: 'desc', label: 'Articulações', kind: 'text' }] },

  // ── PEDIATRIA ──
  { areas: ['pediatria'], match: /quadril direito|graf.*direit/i, canonical: true, fields: [{ id: 'alfa_d', label: 'Ângulo α', kind: 'measure', unit: '°' }, { id: 'beta_d', label: 'Ângulo β', kind: 'measure', unit: '°' }] },
  { areas: ['pediatria'], match: /quadril esquerdo|graf.*esquerd/i, canonical: true, fields: [{ id: 'alfa_e', label: 'Ângulo α', kind: 'measure', unit: '°' }, { id: 'beta_e', label: 'Ângulo β', kind: 'measure', unit: '°' }] },
  { areas: ['pediatria'], match: /piloro/i, canonical: true, apply: { normalable: true, normalText: 'sem sinais de estenose hipertrófica' }, fields: [{ id: 'piloro_musculo', label: 'Espessura muscular', kind: 'measure', unit: 'mm', hint: 'EHP se ≥ 4 mm' }, { id: 'piloro_canal', label: 'Canal', kind: 'measure', unit: 'mm', hint: 'EHP se ≥ 17 mm' }] },
  { areas: ['pediatria'], match: /ap[êe]ndice|fossa il[íi]aca/i, canonical: true, apply: { normalable: true, normalText: 'apêndice não visualizado / sem sinais de apendicite' }, fields: [{ id: 'apendice_diam', label: 'Diâmetro', kind: 'measure', unit: 'mm', hint: '> 6 mm' }] },
  // Transfontanelar
  { areas: ['pediatria'], match: /par[êe]nquima|hemorrag/i, apply: { normalable: true, normalText: 'ecogenicidade normal, sem hemorragia' }, fields: [{ id: 'hemorragia', label: 'Hemorragia (Papile)', kind: 'select', options: ['ausente', 'grau I', 'grau II', 'grau III', 'grau IV'] }, { id: 'desc', label: 'Outros achados', kind: 'text' }] },
  { areas: ['pediatria'], match: /sistema ventricular|ventr[íi]culo/i, apply: { normalable: true, normalText: 'simétrico, não dilatado' }, fields: [{ id: 'atrio_vent', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', hint: 'ventriculomegalia > 10 mm' }] },
  { areas: ['pediatria'], match: /linha m[ée]dia|n[úu]cleos|fossa posterior|espa[çc]os extra|cavum/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  // Coluna
  { areas: ['pediatria'], match: /cone medular/i, apply: { normalable: true, normalText: 'topografia normal (acima de L2-L3)' }, fields: [{ id: 'nivel', label: 'Nível do cone', kind: 'text', placeholder: 'ex: L1-L2' }] },
  { areas: ['pediatria'], match: /filum|canal espinhal|arcos posteriores|disrafismo/i, apply: { normalable: true, normalText: 'sem sinais de disrafismo' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  // Abdome/rins pediátricos
  { areas: ['pediatria'], match: /f[íi]gado|ba[çc]o/i, apply: { normalable: true, normalText: 'dimensões e ecotextura normais para a idade' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['pediatria'], match: /vias biliares|ves[íi]cula|p[âa]ncreas|adrenais/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  { areas: ['pediatria'], match: /rim (direito|esquerdo)/i, canonical: true, apply: { normalable: true, normalText: 'comprimento adequado à idade, sem dilatação' }, fields: [{ id: 'rim_dims', label: 'Comprimento', kind: 'measure', unit: 'cm' }, { id: 'rim_dilat', label: 'Dilatação (SFU)', kind: 'select', options: SFU }] },
  { areas: ['pediatria'], match: /sistema coletor|hidronefrose/i, fields: [{ id: 'sfu', label: 'Dilatação (SFU)', kind: 'select', options: SFU }] },
  { areas: ['pediatria'], match: /ureter|bexiga|sistema urin/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text' }] },
  // Escroto agudo pediátrico
  { areas: ['pediatria'], match: /test[íi]culo direito/i, canonical: true, fields: [{ id: 'test_d_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }, { id: 'test_d_fluxo', label: 'Fluxo', kind: 'select', options: ['presente/simétrico', 'reduzido', 'ausente (torção?)'] }] },
  { areas: ['pediatria'], match: /test[íi]culo esquerdo/i, canonical: true, fields: [{ id: 'test_e_dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }, { id: 'test_e_fluxo', label: 'Fluxo', kind: 'select', options: ['presente/simétrico', 'reduzido', 'ausente (torção?)'] }] },
  { areas: ['pediatria'], match: /epid[íi]dimo|ap[êe]ndices testicul|t[úu]nica|parede escrotal|estudo doppler/i, apply: { normalable: true, normalText: 'sem alterações' }, fields: [{ id: 'desc', label: 'Achados', kind: 'text', placeholder: 'apêndice, hidrocele, fluxo' }] },
  { areas: ['pediatria'], match: /estabilidade/i, fields: [{ id: 'estabilidade', label: 'Estabilidade', kind: 'select', options: ['estável', 'frouxidão', 'instável/luxável'] }] },

  // ── PROCEDIMENTOS ──
  { areas: ['procedimentos'], match: /alvo|les[ãa]o|n[óo]dul/i, fields: [{ id: 'loc', label: 'Localização', kind: 'text' }, { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' }] },
  { areas: ['procedimentos'], match: /indica[çc][ãa]o/i, fields: [{ id: 'indicacao', label: 'Indicação clínica', kind: 'text', fullWidth: true }] },
  { areas: ['procedimentos'], match: /t[ée]cnica|descri[çc][ãa]o do procedimento|s[íi]tio de pun/i, fields: [{ id: 'tecnica', label: 'Técnica (agulha / via / passagens)', kind: 'text', fullWidth: true }] },
  { areas: ['procedimentos'], match: /material|amostra/i, fields: [{ id: 'material', label: 'Material coletado', kind: 'text', fullWidth: true }] },
  { areas: ['procedimentos'], match: /complica[çc][õo]es/i, apply: { normalable: true, normalText: 'sem complicações imediatas' }, fields: [{ id: 'complicacao', label: 'Complicação', kind: 'select', options: ['nenhuma', 'hematoma', 'sangramento', 'pneumotórax', 'outra'] }] },
  { areas: ['procedimentos'], match: /controle|p[óo]s.?procedimento|intercorr|avalia[çc][ãa]o p[óo]s/i, apply: { normalable: true, normalText: 'sem intercorrências' }, fields: [{ id: 'controle', label: 'Status', kind: 'select', options: ['sem intercorrências', 'hematoma', 'sangramento', 'outro'] }, { id: 'obs', label: 'Observações', kind: 'text' }] },
  { areas: ['procedimentos'], match: /avalia[çc][ãa]o pr[ée]|placenta|l[íi]quido amni|vitalidade|feto/i, apply: { normalable: true, normalText: 'avaliação pré-procedimento sem alterações' }, fields: [{ id: 'pre', label: 'Achados', kind: 'text' }] },

  // ── CISTO RENAL (Bosniak) — abdome/rim ──
  { areas: ['medicina-interna'], match: /cisto renal|bosniak/i, apply: { repeatable: true, itemLabel: 'Cisto', score: 'bosniak' }, fields: CISTO_BOSNIAK },
];

/**
 * Enriquece a lista de seções parseadas de uma máscara. Deduplica enrichers
 * canônicos (ids fixos): se o mesmo enricher casar em mais de um compartimento,
 * só o primeiro recebe os ids canônicos — os demais ficam com o parser genérico,
 * evitando colisão de ids (ex.: "IG de referência" vs "IG biométrica").
 */
export function enrichSections(area: string, sections: StructuredSection[]): StructuredSection[] {
  const usedIds = new Set<string>(); // ids canônicos já consumidos
  return sections.map((section) => {
    const e = ENRICHERS.find((en) => (!en.areas || en.areas.includes(area)) && en.match.test(section.label));
    if (!e) return section;
    const keepIds = e.apply?.repeatable || e.canonical;
    let fields = e.fields.map((f) => (keepIds ? f : { ...f, id: `${section.id}_${f.id}` }));
    if (e.canonical) {
      fields = fields.filter((f) => !usedIds.has(f.id)); // evita colisão de id canônico
      if (fields.length === 0) return section; // nada novo a acrescentar → mantém genérico
      fields.forEach((f) => usedIds.add(f.id));
    }
    return { ...section, ...e.apply, fields };
  });
}
