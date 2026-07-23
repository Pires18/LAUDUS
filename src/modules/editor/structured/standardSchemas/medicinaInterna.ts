import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * Seção de ACHADOS: Normal (nenhum achado) por padrão; quando 'Alterado', revela
 * a lista repetível de lesões com suas calculadoras/escore. É o lugar correto
 * para inserir lesões e cálculos — só aparecem sob a alteração.
 */
function achados(
  id: string,
  label: string,
  itemLabel: string,
  fields: StructuredFieldDef[],
  opts: { normalText: string; score?: StructuredSection['score']; addLabel?: string } = { normalText: 'ausentes' }
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
 * MODELOS PADRÃO — MEDICINA INTERNA (7 máscaras do sistema).
 *
 * Cada modelo foi curado a partir do analysisTemplate + aiInstructions da
 * própria máscara (scripts/laudia-deploy-unified.REFINED.json), com:
 * - seções espelhando os compartimentos do laudo, em ordem;
 * - ids CANÔNICOS onde o liveCompute deriva cálculo ao vivo
 *   (baco_eixo, vrpm, prostata_dims/psa, vps_renal_d/e + vps_aorta → RAR,
 *   ir_d/ir_e → resistividade, rim_d_dims/rim_e_dims → volume);
 * - calculadoras da área ligadas (volume-elipsoide, prostate-weight, ivc-index);
 * - regras clínicas dos prompts como hints (limiares CBR/SBU/AASLD).
 *
 * Regra Bosniak: as máscaras de ABDOME e RINS (sem Doppler) PROÍBEM Bosniak no
 * US → cistos classificados como simples/minimamente complexo/complexo.
 * RINS COM DOPPLER usa Bosniak v2019 adaptado (regra do próprio prompt) →
 * seção repetível com score 'bosniak'.
 */

// ─── Seções compartilhadas (fábricas → instâncias novas a cada uso) ───

const FIGADO = (): StructuredSection => ({
  id: 'figado',
  label: 'Fígado',
  normalable: true,
  normalText: 'dimensões normais, contornos regulares, bordas afiladas, ecotextura homogênea, sem esteatose ou lesões focais',
  fields: [
    { id: 'figado_lobo_d', label: 'Lobo direito (longitudinal)', kind: 'measure', unit: 'cm', normal: '≤ 15–16 cm', alwaysShow: true, hint: 'hepatomegalia se > 16 cm (linha médio-clavicular)' },
    { id: 'esteatose', label: 'Esteatose', kind: 'select', options: ['ausente', 'grau I (leve)', 'grau II (moderada)', 'grau III (acentuada)'], hint: 'graduação qualitativa ao US; quantificação objetiva requer índice hepatorrenal ou elastografia (CAP)' },
    { id: 'figado_contornos', label: 'Contornos', kind: 'select', options: ['regulares', 'lobulados', 'irregulares/nodulares (hepatopatia crônica)'] },
    { id: 'figado_obs', label: 'Outros achados', kind: 'text', fullWidth: true, placeholder: 'hepatopatia crônica, hipertrofia do caudado, ecotextura grosseira…' },
  ],
  // Lesões focais aparecem quando o fígado está 'Alterado' (com volume ao vivo).
  repeatGroup: {
    id: 'lesoes',
    itemLabel: 'Lesão',
    addLabel: 'Adicionar lesão focal',
    fields: [
      { id: 'segmento', label: 'Segmento (Couinaud)', kind: 'select', options: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'indeterminado'] },
      { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
      { id: 'aspecto', label: 'Aspecto', kind: 'select', options: ['cisto simples', 'hemangioma típico', 'nódulo sólido hipoecoico', 'nódulo sólido hiperecoico', 'nódulo sólido heterogêneo', 'lesão complexa'] },
      { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['não avaliada', 'ausente', 'periférica', 'central/intralesional'] },
    ],
  },
});

const VIAS_BILIARES = (): StructuredSection => ({
  id: 'vias-biliares',
  label: 'Vias Biliares',
  normalable: true,
  normalText: 'ductos intra-hepáticos não dilatados; colédoco de calibre normal, sem cálculos ou espessamento parietal',
  fields: [
    { id: 'coledoco', label: 'Colédoco', kind: 'measure', unit: 'mm', normal: '≤ 6 mm', alwaysShow: true, hint: '≤ 8 mm (> 70 a) · ≤ 10 mm (pós-colecistectomia)' },
    { id: 'intra_hepaticas', label: 'Ductos intra-hepáticos', kind: 'select', options: ['não dilatados', 'dilatados (sinal do cano duplo)'] },
    { id: 'vias_achados', label: 'Conteúdo / achados', kind: 'text', placeholder: 'cálculo, aerobilia, espessamento (colangite)' },
  ],
});

const VESICULA = (): StructuredSection => ({
  id: 'vesicula',
  label: 'Vesícula Biliar',
  normalable: true,
  normalText: 'normodistendida, paredes finas e regulares, conteúdo anecoico, sem cálculos ou pólipos',
  fields: [
    { id: 'vesicula_achados', label: 'Achados', kind: 'multiselect', options: ['cálculo(s)', 'lama biliar', 'pólipo(s)', 'espessamento parietal', 'Murphy US positivo', 'colecistectomizado'] },
    { id: 'vesicula_parede', label: 'Espessura da parede', kind: 'measure', unit: 'mm', normal: '< 3 mm', hint: 'espessada se ≥ 3 mm' },
    { id: 'vesicula_detalhe', label: 'Detalhe (maior cálculo, mobilidade, sombra)', kind: 'text', fullWidth: true },
  ],
});

const PANCREAS = (): StructuredSection => ({
  id: 'pancreas',
  label: 'Pâncreas',
  normalable: true,
  normalText: 'dimensões, contornos e ecogenicidade preservados; Wirsung não dilatado',
  fields: [
    { id: 'wirsung', label: 'Ducto de Wirsung', kind: 'measure', unit: 'mm', normal: '≤ 2 mm', hint: 'dilatado se ≥ 3 mm (investigar causa)' },
    { id: 'pancreas_visualizacao', label: 'Visualização', kind: 'select', options: ['adequada', 'parcialmente prejudicada por interposição gasosa'] },
    { id: 'pancreas_achados', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'lesão focal, dilatação ductal, alteração de ecotextura' },
  ],
});

const BACO = (): StructuredSection => ({
  id: 'baco',
  label: 'Baço',
  normalable: true,
  normalText: 'eixo longitudinal normal (≤ 12 cm), ecotextura homogênea, sem lesões focais',
  fields: [
    // id canônico: liveCompute classifica esplenomegalia (> 12 cm)
    { id: 'baco_eixo', label: 'Maior eixo longitudinal', kind: 'measure', unit: 'cm', normal: '≤ 12 cm', alwaysShow: true, hint: 'esplenomegalia se > 12 cm' },
    { id: 'baco_achados', label: 'Achados', kind: 'text', placeholder: 'lesão focal, baço acessório' },
  ],
});

/** Rins resumidos num compartimento único (máscaras de ABDOME SUPERIOR). */
const RINS_RESUMO = (): StructuredSection => ({
  id: 'rins',
  label: 'Rins',
  normalable: true,
  normalText: 'tópicos, dimensões normais (9–12 cm), corticais preservadas, sem litíase, hidronefrose ou lesões',
  fields: [
    { id: 'rim_d_eixo', label: 'Rim direito (maior eixo)', kind: 'measure', unit: 'cm', normal: '9–12 cm', alwaysShow: true },
    { id: 'rim_e_eixo', label: 'Rim esquerdo (maior eixo)', kind: 'measure', unit: 'cm', normal: '9–12 cm', alwaysShow: true },
    { id: 'rins_achados', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'litíase, cisto, hidronefrose (lado, medida, grau G1–G4)' },
  ],
});

// Hidronefrose do ADULTO — graduação por diâmetro AP da pelve renal (plano
// transverso), alinhada à Camada 2. (SFU I–IV é sistema pediátrico; usado só
// na área de pediatria.)
const HIDRONEFROSE = ['ausente', 'G1 — pelviectasia (5–9 mm)', 'G2 — leve (10–14 mm)', 'G3 — moderada (15–20 mm)', 'G4 — grave (> 20 mm)'];

/**
 * Cistos/lesões focais de UM rim — ficam ANINHADOS na seção do rim (grupo
 * revelado sob 'Alterado'), não numa seção solta. O lado é estrutural (a seção
 * do rim), então a lesão só descreve a localização DENTRO do rim.
 * - variante descritiva: Bosniak PROIBIDO no US (abdome/rins sem Doppler);
 * - variante Bosniak v2019 adaptada: só em RINS COM DOPPLER (regra do prompt).
 */
const LESAO_RENAL = (bosniak: boolean): StructuredFieldDef[] =>
  bosniak
    ? [
        { id: 'polo', label: 'Localização', kind: 'select', options: ['polo superior', 'terço médio', 'polo inferior', 'seio renal'] },
        { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
        { id: 'septos', label: 'Septos', kind: 'select', options: ['ausentes', 'poucos finos', 'múltiplos finos', 'espessos/irregulares'] },
        { id: 'parede', label: 'Parede', kind: 'select', options: ['fina', 'espessa/irregular'] },
        { id: 'calcificacao', label: 'Calcificação', kind: 'select', options: ['ausente', 'fina', 'grosseira'] },
        { id: 'solido', label: 'Componente sólido/fluxo ao Doppler', kind: 'select', options: ['ausente', 'presente'] },
      ]
    : [
        { id: 'polo', label: 'Localização', kind: 'select', options: ['polo superior', 'terço médio', 'polo inferior', 'seio renal'] },
        { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
        { id: 'classificacao', label: 'Classificação (US)', kind: 'select', options: ['cisto simples', 'cisto minimamente complexo', 'cisto complexo (investigação seccional)'], hint: 'não usar Bosniak em laudo de US' },
        { id: 'detalhe', label: 'Detalhe (septos, debris, calcificação)', kind: 'text', fullWidth: true },
      ];

/** Rim dedicado por lado (ABDOME TOTAL e RINS E VIAS URINÁRIAS). */
const RIM = (side: 'direito' | 'esquerdo', opts: { bosniak?: boolean } = {}): StructuredSection => {
  const s = side === 'direito' ? 'd' : 'e';
  return {
    id: `rim-${side}`,
    label: `Rim ${side === 'direito' ? 'Direito' : 'Esquerdo'}`,
    normalable: true,
    normalText: 'tópico, dimensões normais, relação corticomedular preservada, sem litíase, cistos ou dilatação',
    fields: [
      // ids canônicos: volume via calculadora + convenção da fieldLibrary
      { id: `rim_${s}_dims`, label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', normal: '9–12 cm (eixo)', alwaysShow: true, hint: 'volume renal por elipsoide' },
      { id: `rim_${s}_parenquima`, label: 'Espessura parenquimatosa', kind: 'measure', unit: 'mm', normal: '> 15 mm', alwaysShow: true, hint: 'cortical > 10 mm' },
      { id: `rim_${s}_dilat`, label: 'Dilatação pielocalicinal (G1–G4)', kind: 'select', options: HIDRONEFROSE, hint: 'graduação por diâmetro AP da pelve (plano transverso)' },
      { id: `rim_${s}_achados`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'ecogenicidade cortical, nefropatia (G1–G5), massa' },
    ],
    // cistos/lesões do rim: aninhados, aparecem sob 'Alterado'
    repeatGroup: { id: 'lesao', itemLabel: 'Cisto / lesão', addLabel: 'Adicionar cisto/lesão', score: opts.bosniak ? 'bosniak' : undefined, fields: LESAO_RENAL(!!opts.bosniak) },
  };
};

const LITIASE = (): StructuredSection =>
  achados('litiase', 'Litíase', 'Cálculo', [
    { id: 'local', label: 'Localização', kind: 'select', options: ['rim direito — cálice superior', 'rim direito — cálice médio', 'rim direito — cálice inferior', 'rim direito — pelve', 'rim esquerdo — cálice superior', 'rim esquerdo — cálice médio', 'rim esquerdo — cálice inferior', 'rim esquerdo — pelve', 'ureter proximal direito', 'ureter proximal esquerdo', 'ureter distal / JUV direita', 'ureter distal / JUV esquerda', 'bexiga'] },
    { id: 'maior', label: 'Maior dimensão', kind: 'measure', unit: 'mm' },
    { id: 'sombra', label: 'Sombra acústica', kind: 'select', options: ['presente', 'ausente'] },
    { id: 'repercussao', label: 'Repercussão', kind: 'select', options: ['sem dilatação a montante', 'ureterectasia', 'hidronefrose associada'] },
  ], { normalText: 'ausente', addLabel: 'Adicionar cálculo' });

const GRANDES_VASOS = (): StructuredSection => ({
  id: 'grandes-vasos',
  label: 'Aorta Abdominal e VCI',
  normalable: true,
  normalText: 'aorta de calibre normal; VCI de aspecto habitual',
  fields: [
    { id: 'aorta', label: 'Aorta (maior diâmetro AP)', kind: 'measure', unit: 'cm', normal: '< 2,5 cm', alwaysShow: true, hint: 'ectasia ≥ 2,5 cm · aneurisma ≥ 3,0 cm' },
    // a estrutura que o índice de colapsabilidade consome, no próprio card
    { id: 'vci_max', label: 'VCI expiratória (máx.)', kind: 'measure', unit: 'mm' },
    { id: 'vci_min', label: 'VCI inspiratória (mín.)', kind: 'measure', unit: 'mm' },
    { id: 'vci', label: 'Índice de colapsabilidade', kind: 'calc', calcId: 'ivc-index', hint: '(máx − mín)/máx · < 50% sugere congestão · automático' },
  ],
});

const RETROPERITONIO = (): StructuredSection => ({
  id: 'retroperitonio',
  label: 'Retroperitônio e Cavidade',
  normalable: true,
  normalText: 'sem linfonodomegalias, coleções ou líquido livre',
  fields: [
    { id: 'liquido_livre', label: 'Líquido livre', kind: 'select', options: ['ausente', 'mínimo', 'moderado', 'acentuado'] },
    { id: 'linfonodos', label: 'Linfonodos', kind: 'text', placeholder: 'maior eixo curto ≥ 10 mm = anormal; localização' },
    { id: 'colecoes', label: 'Coleções', kind: 'text', placeholder: 'localização, volume, aspecto (simples/debris/multiloculada)' },
  ],
});

const BEXIGA = (opts?: { jatos?: boolean; capacidade?: boolean }): StructuredSection => ({
  id: 'bexiga',
  label: 'Bexiga',
  normalable: true,
  normalText: 'boa repleção, paredes finas e regulares, conteúdo anecoico',
  fields: [
    { id: 'bexiga_parede', label: 'Espessura da parede', kind: 'measure', unit: 'mm', normal: '≤ 3 mm', hint: 'repleta · > 5 mm = espessamento' },
    { id: 'bexiga_achados', label: 'Achados', kind: 'multiselect', options: ['debris', 'cálculo', 'trabeculação', 'divertículo', 'lesão vegetante', 'ureterocele'] },
    ...(opts?.capacidade ? [{ id: 'bexiga_capacidade', label: 'Capacidade estimada', kind: 'measure' as const, unit: 'mL' }] : []),
    ...(opts?.jatos ? [{ id: 'jatos_ureterais', label: 'Jatos ureterais (Doppler)', kind: 'select' as const, options: ['presentes e simétricos', 'ausente à direita', 'ausente à esquerda'], hint: 'ausência unilateral = suspeita de obstrução' }] : []),
    { id: 'bexiga_detalhe', label: 'Detalhe', kind: 'text', fullWidth: true },
  ],
});

const VRPM = (): StructuredSection => ({
  id: 'vrpm',
  label: 'Resíduo Pós-Miccional',
  fields: [
    // id canônico: liveCompute classifica (normal / significativo > 50 / acentuado > 100)
    { id: 'vrpm', label: 'VRPM', kind: 'measure', unit: 'ml', normal: '< 50 mL', hint: '100–300 significativo · > 300 retenção' },
  ],
});

const DOPPLER_HEPATICO = (): StructuredSection => ({
  id: 'doppler-hepatico',
  label: 'Doppler Hepático e Portal',
  normalable: true,
  normalText: 'veia porta pérvia, hepatopetal, velocidade normal; artéria hepática com IR normal; veias hepáticas trifásicas',
  fields: [
    { id: 'porta_cal', label: 'Calibre da veia porta', kind: 'measure', unit: 'mm', normal: '≤ 13 mm', alwaysShow: true, hint: 'hipertensão portal se dilatada' },
    { id: 'porta_vel', label: 'Velocidade portal', kind: 'measure', unit: 'cm/s', normal: '15–40 cm/s', alwaysShow: true, hint: 'hipertensão portal se < 12 cm/s ou fluxo hepatofugal' },
    { id: 'porta_fluxo', label: 'Fluxo portal', kind: 'select', options: ['hepatopetal (normal)', 'lentificado', 'hepatofugal', 'trombose'] },
    { id: 'ir_hepatica', label: 'IR artéria hepática', kind: 'measure', normal: '0,55–0,80', alwaysShow: true, hint: 'tardus-parvus = estenose' },
    { id: 'veias_hepaticas', label: 'Veias hepáticas (padrão)', kind: 'select', options: ['trifásico (normal)', 'bifásico', 'monofásico'], hint: 'mono/bifásico = hepatopatia crônica' },
    { id: 'colaterais', label: 'Colaterais portossistêmicas', kind: 'select', options: ['ausentes', 'presentes'] },
  ],
});

const DOPPLER_RENAL = (): StructuredSection => ({
  id: 'doppler-renal',
  label: 'Doppler Renal',
  normalable: true,
  normalText: 'artérias renais pérvias, sem estenose hemodinamicamente significativa; resistividade intraparenquimatosa normal; veias pérvias',
  fields: [
    // ids canônicos: liveCompute deriva RAR por lado e IR intraparenquimatoso
    { id: 'vps_renal_d', label: 'VPS a. renal direita', kind: 'measure', unit: 'cm/s', normal: '< 180 cm/s', alwaysShow: true, hint: 'estenose se > 180 cm/s' },
    { id: 'vps_renal_e', label: 'VPS a. renal esquerda', kind: 'measure', unit: 'cm/s', normal: '< 180 cm/s', alwaysShow: true, hint: 'estenose se > 180 cm/s' },
    { id: 'vps_aorta', label: 'VPS aorta (p/ RAR)', kind: 'measure', unit: 'cm/s', hint: 'RAR ≥ 3,5 = estenose ≥ 60% (auto)' },
    { id: 'ir_d', label: 'IR intraparenquimatoso D', kind: 'measure', normal: '0,55–0,70', alwaysShow: true },
    { id: 'ir_e', label: 'IR intraparenquimatoso E', kind: 'measure', normal: '0,55–0,70', alwaysShow: true },
    { id: 'veias_renais', label: 'Veias renais', kind: 'select', options: ['pérvias, fluxo fásico', 'alteradas (descrever)'] },
  ],
});

// ─── Modelos por exame ───

const ABDOME_SUPERIOR = (): StructuredSection[] => [
  FIGADO(), VIAS_BILIARES(), VESICULA(), PANCREAS(), BACO(),
  RINS_RESUMO(), GRANDES_VASOS(), RETROPERITONIO(),
];

const ABDOME_TOTAL = (): StructuredSection[] => [
  FIGADO(), VIAS_BILIARES(), VESICULA(), PANCREAS(), BACO(),
  RIM('direito'), RIM('esquerdo'),
  GRANDES_VASOS(), BEXIGA(), RETROPERITONIO(),
];

const PROSTATA_ABDOMINAL = (): StructuredSection[] => [
  {
    ...BEXIGA({ capacidade: false }),
    id: 'bexiga-pre',
    label: 'Bexiga (fase pré-miccional)',
    fields: [
      { id: 'bexiga_parede', label: 'Espessura da parede', kind: 'measure', unit: 'mm', hint: 'normal ≤ 3 mm (repleta) · > 5 mm = cistopatia' },
      { id: 'trabeculacao', label: 'Trabeculação', kind: 'select', options: ['ausente', 'leve', 'moderada', 'acentuada'] },
      { id: 'bexiga_achados', label: 'Achados', kind: 'multiselect', options: ['debris', 'cálculo', 'divertículo', 'lesão vegetante', 'ureterocele'] },
    ],
  },
  {
    id: 'prostata',
    label: 'Próstata',
    fields: [
      // ids canônicos: volume+peso+classificação e densidade do PSA ao vivo
      { id: 'prostata_dims', label: 'Dimensões (L × T × AP)', kind: 'triplet', unit: 'cm', calcId: 'prostate-weight', normal: '< 30 cm³', hint: 'volume/peso automáticos' },
      { id: 'psa', label: 'PSA total', kind: 'measure', unit: 'ng/mL', normal: '< 4 ng/mL', hint: 'densidade PSA > 0,15 = elevada (auto)' },
      { id: 'prostata_ecotextura', label: 'Ecotextura', kind: 'select', options: ['homogênea', 'heterogênea (zona de transição)', 'heterogênea com calcificações'] },
      { id: 'prostata_contornos', label: 'Contornos', kind: 'select', options: ['regulares', 'globosos', 'lobulados'] },
    ],
  },
  {
    id: 'lobo-mediano',
    label: 'Lobo Mediano (IPP)',
    normalable: true,
    normalText: 'sem protrusão significativa para o assoalho vesical',
    fields: [
      { id: 'ipp', label: 'Protrusão intravesical', kind: 'measure', unit: 'mm', normal: '< 5 mm', hint: 'grau I < 5 · II 5–10 · III > 10 mm' },
    ],
  },
  {
    id: 'vesiculas-seminais',
    label: 'Vesículas Seminais',
    normalable: true,
    normalText: 'tópicas, simétricas, morfologia e ecotextura preservadas',
    fields: [{ id: 'seminais_achados', label: 'Achados', kind: 'text', fullWidth: true }],
  },
  VRPM(),
];

const RINS_VIAS = (): StructuredSection[] => [
  RIM('direito'), RIM('esquerdo'), LITIASE(),
  {
    id: 'ureteres',
    label: 'Ureteres',
    normalable: true,
    normalText: 'não dilatados nos segmentos avaliados',
    fields: [{ id: 'ureteres_achados', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'dilatação (calibre ≥ 5 mm), segmento, causa' }],
  },
  BEXIGA({ capacidade: true }),
  VRPM(),
];

const RINS_VIAS_DOPPLER = (): StructuredSection[] => [
  RIM('direito', { bosniak: true }), RIM('esquerdo', { bosniak: true }), LITIASE(),
  DOPPLER_RENAL(),
  BEXIGA({ jatos: true }),
  VRPM(),
];

// ───────────────────────── Elastografia Hepática ─────────────────────────
// Ids canônicos lidos pelo liveCompute: `elasto_kpa` + `elasto_etiologia`
// (estágio METAVIR) e `elasto_cap` (esteatose). Cutoffs orientadores.
const ELASTOGRAFIA_HEPATICA = (): StructuredSection[] => [
  {
    id: 'elasto-metodo',
    label: 'Método e Qualidade Técnica',
    fields: [
      { id: 'elasto_metodo', label: 'Método', kind: 'select', options: ['TE / FibroScan', '2D-SWE', 'pSWE / ARFI'], alwaysShow: true, hint: 'os cutoffs de fibrose são orientadores e dependentes do método/aparelho' },
      { id: 'elasto_etiologia', label: 'Etiologia (define os cutoffs)', kind: 'select', options: ['viral (HBV/HCV)', 'DHGNA / NASH', 'alcoólica', 'colestática (CBP/CEP)', 'indeterminada'], alwaysShow: true, hint: 'os limiares METAVIR mudam por etiologia (auto)' },
      { id: 'elasto_iqr', label: 'IQR/mediana', kind: 'measure', unit: '%', normal: '≤ 30%', alwaysShow: true, hint: 'exame confiável se IQR/mediana ≤ 30%' },
      { id: 'elasto_sucesso', label: 'Taxa de sucesso', kind: 'measure', unit: '%', normal: '≥ 60%', hint: '≥ 10 medidas válidas · jejum ≥ 3 h' },
    ],
  },
  {
    id: 'elasto-fibrose',
    label: 'Rigidez Hepática (Fibrose)',
    fields: [
      { id: 'elasto_kpa', label: 'Rigidez mediana', kind: 'measure', unit: 'kPa', alwaysShow: true, hint: 'estágio METAVIR (F0–F4) automático conforme a etiologia' },
      { id: 'elasto_desc', label: 'Interpretação / limitações', kind: 'text', fullWidth: true, placeholder: 'confrontar com transaminases, congestão cardíaca, colestase, ascite, obesidade' },
    ],
  },
  {
    id: 'elasto-esteatose',
    label: 'Esteatose (CAP)',
    normalable: true,
    normalText: 'CAP não realizado / sem esteatose significativa',
    fields: [
      { id: 'elasto_cap', label: 'CAP', kind: 'measure', unit: 'dB/m', alwaysShow: true, hint: 'S0 < 248 · S1 248–267 · S2 268–279 · S3 ≥ 280 (auto; FibroScan)' },
    ],
  },
];

export const MEDICINA_INTERNA_SCHEMAS: StandardSchemaDef[] = [
  { name: 'ELASTOGRAFIA HEPÁTICA', match: /elastografia hep/, sections: ELASTOGRAFIA_HEPATICA },
  // mais específicos (COM DOPPLER) primeiro — o resolver usa a 1ª regex que casar
  {
    name: 'ABDOME SUPERIOR COM DOPPLER',
    match: /abdome superior com doppler/,
    sections: () => [...ABDOME_SUPERIOR(), DOPPLER_HEPATICO()],
  },
  { name: 'ABDOME SUPERIOR', match: /abdome superior/, sections: ABDOME_SUPERIOR },
  {
    name: 'ABDOME TOTAL COM DOPPLER',
    match: /abdome total com doppler/,
    sections: () => [...ABDOME_TOTAL(), DOPPLER_HEPATICO(), DOPPLER_RENAL()],
  },
  { name: 'ABDOME TOTAL', match: /abdome total/, sections: ABDOME_TOTAL },
  { name: 'PRÓSTATA VIA ABDOMINAL', match: /prostata/, sections: PROSTATA_ABDOMINAL },
  {
    name: 'RINS E VIAS URINÁRIAS COM DOPPLER',
    match: /rins.*com doppler/,
    sections: RINS_VIAS_DOPPLER,
  },
  { name: 'RINS E VIAS URINÁRIAS', match: /rins e vias/, sections: RINS_VIAS },
];
