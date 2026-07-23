import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — VASCULAR (9 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions de cada máscara e das diretrizes
 * da área (SRU 2003 / NASCET, ESC-ESVS 2023, CEAP 2020, ELSA-Brasil).
 *
 * IDS CANÔNICOS — o motor (`liveCompute`) deriva ao vivo a partir destes ids;
 * trocá-los silencia os chips:
 * - `vps_aci_{d,e}` / `vdf_aci_{d,e}` / `vps_acc_{d,e}` → grau de estenose (SRU);
 * - `itb_{d,e}`                                        → classificação do ITB;
 * - `vps_renal_{d,e}` + `vps_aorta`                    → RAR (≥ 3,5 = estenose);
 * - `ir_{d,e}`                                         → IR intraparenquimatoso RENAL.
 *
 * ⚠️ `ir_d`/`ir_e` são RESERVADOS ao rim: o chip que eles disparam diz
 * "IR intraparenq.". Em carótidas/oftálmicas use ids próprios (`ir_ao_d`…),
 * porque o id de campo simples é GLOBAL no formulário — dois campos `ir` em
 * seções diferentes gravariam no mesmo valor.
 */

const NASCET = ['normal (<50%)', 'estenose 50–69%', 'estenose ≥70%', 'suboclusão', 'oclusão total'];
const ARTERIAL_FLOW = ['trifásico', 'bifásico', 'monofásico', 'ausente'];
const ARTERIAL_STENOSIS = ['sem estenose', 'estenose <50%', 'estenose 50–70%', 'estenose >70%', 'oclusão'];
const VENOUS_COMPRESS = ['compressível (pérvia)', 'parcialmente compressível', 'incompressível (TVP)'];
const VERT_FLOW = ['anterógrado', 'invertido (roubo)', 'ausente'];
const CEAP = ['C0', 'C1', 'C2', 'C3', 'C4a', 'C4b', 'C5', 'C6'];
const PLACA_ECO = ['hipoecoica (mole)', 'isoecoica', 'mista', 'calcificada', 'com sombra acústica'];
const PLACA_SUP = ['regular', 'irregular', 'ulcerada'];

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

// ─────────────────────────── CARÓTIDAS E VERTEBRAIS ───────────────────────────

/**
 * EMI medida na parede posterior da ACC distal (1 cm antes do bulbo).
 * Fica no card Normal: é reportada em todo exame, não só quando alterada.
 */
const EMI = (): StructuredSection => ({
  id: 'emi',
  label: 'Espessura Médio-Intimal (EMI)',
  fields: [
    { id: 'emi_d', label: 'EMI Direita', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br', alwaysShow: true, normal: '< 0,9 mm', hint: 'ACC distal, parede posterior, 1 cm antes do bulbo' },
    { id: 'emi_e', label: 'EMI Esquerda', kind: 'measure', unit: 'mm', calcId: 'imt-elsa-br', alwaysShow: true, normal: '< 0,9 mm', hint: '0,9–1,2 mm = espessamento · > 1,2 mm = placa' },
    { id: 'emi_idade', label: 'Idade (percentil ELSA-Brasil)', kind: 'measure', unit: 'anos', alwaysShow: true, hint: 'o percentil depende de idade e sexo' },
    // o percentil ELSA depende do sexo — sem ele a calculadora chuta 'masculino'
    { id: 'emi_sexo', label: 'Sexo (percentil ELSA-Brasil)', kind: 'select', options: ['masculino', 'feminino'], alwaysShow: true },
  ],
});

/** Placa carotídea — descritores de risco embólico (ecogenicidade/superfície). */
const PLACA: StructuredFieldDef[] = [
  { id: 'sitio', label: 'Sítio', kind: 'select', options: ['ACC', 'bulbo', 'ACI', 'ACE'] },
  { id: 'extensao', label: 'Extensão', kind: 'measure', unit: 'mm' },
  { id: 'espessura', label: 'Espessura', kind: 'measure', unit: 'mm' },
  { id: 'eco', label: 'Ecogenicidade', kind: 'select', options: PLACA_ECO },
  { id: 'superficie', label: 'Superfície', kind: 'select', options: PLACA_SUP, hint: 'ulcerada = alto risco embólico' },
];

/**
 * Sistema carotídeo de um lado. As velocidades ficam no card Normal
 * (`alwaysShow`) — sem elas não há grau de estenose; as placas entram como
 * grupo aninhado revelado sob 'Alterado'.
 */
const CAROTIDA = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `carotida-${side}`,
  label,
  normalable: true,
  normalText:
    'artérias carótida comum, interna e externa pérvias, com lúmens livres de placas ateromatosas significativas; ao Doppler, fluxo de padrão e sentido fisiológicos, com preenchimento adequado ao mapeamento a cores',
  fields: [
    { id: `vps_acc_${side}`, label: 'VPS ACC', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: '60–90 cm/s' },
    { id: `vps_aci_${side}`, label: 'VPS ACI', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: '50–80 cm/s', hint: '≥ 125 = estenose ≥ 50% · ≥ 230 = ≥ 70% (auto)' },
    { id: `vdf_aci_${side}`, label: 'VDF ACI', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: '< 40 cm/s', hint: '≥ 100 = estenose grave' },
    { id: `vps_ace_${side}`, label: 'VPS ACE', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: '60–90 cm/s' },
    { id: `estenose_${side}`, label: 'Estenose (NASCET/SRU)', kind: 'select', options: NASCET, hint: 'a sugestão automática pela VPS não substitui o julgamento' },
  ],
  repeatGroup: { id: 'placa', itemLabel: 'Placa', addLabel: 'Adicionar placa', fields: PLACA },
});

const VERTEBRAIS = (): StructuredSection => ({
  id: 'vertebrais',
  label: 'Artérias Vertebrais',
  normalable: true,
  normalText:
    'artérias vertebrais pérvias bilateralmente, de calibre e trajeto preservados, com fluxo anterógrado de padrão espectral fisiológico (baixa resistência), sem sinais de fenômeno de roubo da subclávia',
  fields: [
    { id: 'vert_d', label: 'Fluxo Vertebral D', kind: 'select', options: VERT_FLOW },
    { id: 'vert_e', label: 'Fluxo Vertebral E', kind: 'select', options: VERT_FLOW },
    { id: 'vert_vps_d', label: 'VPS Vertebral D', kind: 'measure', unit: 'cm/s', normal: '30–60 cm/s' },
    { id: 'vert_vps_e', label: 'VPS Vertebral E', kind: 'measure', unit: 'cm/s', normal: '30–60 cm/s' },
    { id: 'vert_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'tardus-parvus (estenose subclávia proximal), dissecção, hipoplasia' },
  ],
});

const SUBCLAVIAS = (): StructuredSection => ({
  id: 'subclavias',
  label: 'Artérias Subclávias',
  normalable: true,
  normalText: 'artérias subclávias pérvias, com fluxo trifásico e sem gradiente significativo entre os membros',
  fields: [
    { id: 'subclavia_d', label: 'Subclávia D', kind: 'select', options: ['normal', 'estenose', 'roubo subclávio'] },
    { id: 'subclavia_e', label: 'Subclávia E', kind: 'select', options: ['normal', 'estenose', 'roubo subclávio'] },
    { id: 'subclavia_desc', label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const CAROTIDAS_E_VERTEBRAIS = (): StructuredSection[] => [
  EMI(),
  CAROTIDA('d', 'Sistema Carotídeo Direito'),
  CAROTIDA('e', 'Sistema Carotídeo Esquerdo'),
  VERTEBRAIS(),
  SUBCLAVIAS(),
];

// ────────────────────────────── ARTÉRIAS OFTÁLMICAS ──────────────────────────────

/**
 * Vaso orbitário. `ir`/`ip` NÃO podem ser genéricos: o id é global no
 * formulário e os dois olhos colidiriam no mesmo valor.
 */
const VASO_ORBITA = (
  id: string,
  label: string,
  opts: { vpsNormal: string; irNormal: string; normalText: string }
): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText: opts.normalText,
  fields: [
    { id: `vps_${id}`, label: 'VPS', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: opts.vpsNormal },
    { id: `vdf_${id}`, label: 'VDF', kind: 'measure', unit: 'cm/s', alwaysShow: true },
    { id: `ir_${id}`, label: 'IR', kind: 'measure', calcId: 'vascular-ratios', alwaysShow: true, normal: opts.irNormal },
    { id: `ip_${id}`, label: 'IP', kind: 'measure', calcId: 'vascular-ratios', alwaysShow: true },
    { id: `desc_${id}`, label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const ARTERIAS_OFTALMICAS = (): StructuredSection[] => [
  VASO_ORBITA('ao-d', 'Artéria Oftálmica Direita', {
    vpsNormal: '31–45 cm/s', irNormal: '0,65–0,80',
    normalText: 'artéria oftálmica direita pérvia, com fluxo anterógrado e espectro de resistência habitual',
  }),
  VASO_ORBITA('ao-e', 'Artéria Oftálmica Esquerda', {
    vpsNormal: '31–45 cm/s', irNormal: '0,65–0,80',
    normalText: 'artéria oftálmica esquerda pérvia, com fluxo anterógrado e espectro de resistência habitual',
  }),
  VASO_ORBITA('acr-d', 'Artéria Central da Retina Direita', {
    vpsNormal: '10–20 cm/s', irNormal: '0,65–0,75',
    normalText: 'artéria central da retina direita com fluxo presente e espectro habitual',
  }),
  VASO_ORBITA('acr-e', 'Artéria Central da Retina Esquerda', {
    vpsNormal: '10–20 cm/s', irNormal: '0,65–0,75',
    normalText: 'artéria central da retina esquerda com fluxo presente e espectro habitual',
  }),
  VASO_ORBITA('acp', 'Artérias Ciliares Posteriores', {
    vpsNormal: '10–16 cm/s', irNormal: '0,55–0,70',
    normalText: 'artérias ciliares posteriores com fluxo presente e espectro habitual bilateralmente',
  }),
  {
    id: 'veias-oftalmicas',
    label: 'Veias Oftálmicas Superiores',
    normalable: true,
    normalText: 'veias oftálmicas superiores com fluxo contínuo de baixa velocidade e sentido habitual bilateralmente',
    fields: [
      { id: 'veia_oft', label: 'Fluxo', kind: 'select', options: ['contínuo habitual', 'arterializado', 'invertido', 'ausente'], hint: 'arterializado/invertido: suspeitar fístula carótido-cavernosa' },
      { id: 'veia_oft_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'oclusao',
    label: 'Sinais de Oclusão / Emergência',
    normalable: true,
    normalText: 'sem sinais de oclusão arterial ou descolamento de retina',
    fields: [
      { id: 'oclusao_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'ausência de fluxo na ACR (OACR) / na AO / membrana ondulante com fluxo (descolamento)' },
    ],
  },
];

// ─────────────────────────────── AORTO-ILÍACO ───────────────────────────────

/**
 * Aorta infrarrenal. `aorta` é o id canônico do maior calibre; medida
 * outer-to-outer, que é o padrão da medida do AAA.
 */
const AORTA_ABDOMINAL = (): StructuredSection => ({
  id: 'aorta',
  label: 'Aorta Abdominal (Infrarrenal)',
  normalable: true,
  normalText: 'aorta abdominal infrarrenal de calibre e trajeto normais, sem dilatação aneurismática, trombo mural ou dissecção',
  fields: [
    { id: 'aorta', label: 'Maior calibre (AP × transverso, externo)', kind: 'measure', unit: 'cm', alwaysShow: true, normal: '< 2,5 cm', hint: 'outer-to-outer · ectasia 2,5–2,9 · aneurisma ≥ 3,0 cm · ≥ 5,5 = R6 (limite superior menor na ♀)' },
    { id: 'aorta_desc', label: 'Morfologia', kind: 'text', fullWidth: true, placeholder: 'fusiforme/sacular, trombo mural (espessura), dissecção, hematoma periaórtico' },
    { id: 'aorta_trombo', label: 'Trombo mural', kind: 'measure', unit: 'mm', hint: 'espessura máxima; relatar lúmen real vs. total' },
  ],
});

/** Segmento arterial genérico com padrão de fluxo + estenose. */
const SEGMENTO_ARTERIAL = (
  id: string,
  label: string,
  normalText: string,
  extra: StructuredFieldDef[] = []
): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [
    { id: `fluxo_${id}`, label: 'Padrão de fluxo', kind: 'select', options: ARTERIAL_FLOW, alwaysShow: true },
    { id: `estenose_${id}`, label: 'Estenose', kind: 'select', options: ARTERIAL_STENOSIS },
    { id: `vps_${id}`, label: 'VPS', kind: 'measure', unit: 'cm/s', hint: 'estenose 50–74% = VPS 2–4× o segmento proximal; > 75% = > 4×' },
    ...extra,
    { id: `desc_${id}`, label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const AORTO_ILIACO = (): StructuredSection[] => [
  AORTA_ABDOMINAL(),
  SEGMENTO_ARTERIAL('aic', 'Artérias Ilíacas Comuns', 'artérias ilíacas comuns pérvias, de calibre normal, com fluxo trifásico bilateralmente', [
    { id: 'aic_calibre', label: 'Maior calibre', kind: 'measure', unit: 'cm', normal: '< 1,5 cm', hint: 'aneurisma ilíaco ≥ 1,5 cm' },
  ]),
  SEGMENTO_ARTERIAL('aie', 'Artérias Ilíacas Externas', 'artérias ilíacas externas pérvias, com fluxo trifásico bilateralmente'),
  SEGMENTO_ARTERIAL('aii', 'Artérias Ilíacas Internas', 'artérias ilíacas internas pérvias bilateralmente'),
  {
    id: 'endoprotese',
    label: 'Avaliação de Endoprótese',
    normalable: true,
    normalText: 'não aplicável / endoprótese bem posicionada, pérvia, sem endoleak',
    fields: [
      { id: 'endoleak', label: 'Endoleak', kind: 'select', options: ['ausente', 'tipo I', 'tipo II', 'tipo III', 'tipo IV', 'tipo V (endotensão)'] },
      { id: 'endoprotese_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'posicionamento, patência dos ramos, diâmetro do saco aneurismático' },
    ],
  },
];

// ─────────────────────────────── AORTA TORÁCICA ───────────────────────────────

const SEGMENTO_AORTA_TX = (id: string, label: string, normalRef: string, normalText: string): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [
    { id: `calibre_${id}`, label: 'Calibre', kind: 'measure', unit: 'cm', alwaysShow: true, normal: normalRef },
    { id: `desc_${id}`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'dilatação, flap intimal, trombo, placa' },
  ],
});

const AORTA_TORACICA = (): StructuredSection[] => [
  SEGMENTO_AORTA_TX('aorta-asc', 'Aorta Ascendente', '< 3,8 cm', 'aorta ascendente de calibre normal, sem dilatação aneurismática ou flap intimal'),
  SEGMENTO_AORTA_TX('arco', 'Arco Aórtico', '< 3,8 cm', 'arco aórtico de calibre normal, com emergência habitual dos troncos supra-aórticos'),
  SEGMENTO_AORTA_TX('aorta-desc', 'Aorta Torácica Descendente', '< 2,8 cm', 'aorta torácica descendente de calibre normal, sem dilatação ou dissecção'),
  {
    id: 'raiz',
    label: 'Raiz Aórtica e Valva (quando acessível)',
    normalable: true,
    normalText: 'raiz aórtica de calibre normal; valva aórtica de aspecto habitual',
    fields: [
      { id: 'raiz_calibre', label: 'Raiz aórtica', kind: 'measure', unit: 'cm', alwaysShow: true, normal: '< 4,0 cm (♂) · < 3,6 cm (♀)', hint: 'Marfan: > 4,5 cm → cirurgia preventiva' },
      { id: 'valva', label: 'Valva aórtica', kind: 'select', options: ['trivalvular habitual', 'bivalvular', 'espessada/calcificada'] },
      { id: 'raiz_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'dissecao',
    label: 'Sinais de Dissecção',
    normalable: true,
    normalText: 'sem flap intimal identificável nas janelas acessíveis',
    fields: [
      { id: 'flap', label: 'Flap intimal', kind: 'select', options: ['ausente', 'presente'] },
      { id: 'debakey', label: 'Classificação', kind: 'select', options: ['DeBakey I (tipo A)', 'DeBakey II (tipo A)', 'DeBakey III (tipo B)'], showIf: { field: 'flap', equals: 'presente' } },
      { id: 'dissecao_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'lúmen verdadeiro vs. falso, extensão' },
    ],
  },
  {
    id: 'pericardio-pleura',
    label: 'Pericárdio e Pleura',
    normalable: true,
    normalText: 'sem derrame pericárdico ou pleural',
    fields: [
      { id: 'pericardio_pleura', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'derrame pericárdico (tamponamento), derrame pleural' },
    ],
  },
];

// ───────────────────────── ARTERIAL MEMBRO INFERIOR/SUPERIOR ─────────────────────────

/**
 * ITB por lado — ids canônicos `itb_d`/`itb_e`, que disparam a classificação
 * automática. Fica no card Normal: o índice é reportado sempre.
 */
const ITB = (): StructuredSection => ({
  id: 'itb',
  label: 'Índice Tornozelo-Braquial (ITB)',
  fields: [
    // cortes ESC/AHA — iguais aos de `itbClassification` e aos do prompt da área
    { id: 'itb_d', label: 'ITB Direito', kind: 'measure', alwaysShow: true, normal: '1,00–1,40', hint: 'maior pressão do tornozelo ÷ maior pressão braquial · 0,91–0,99 limítrofe · > 1,40 incompressível' },
    { id: 'itb_e', label: 'ITB Esquerdo', kind: 'measure', alwaysShow: true, normal: '1,00–1,40', hint: '≤ 0,40 = isquemia crítica' },
    { id: 'rutherford', label: 'Rutherford (clínico)', kind: 'select', options: ['0 — assintomático', '1 — claudicação leve', '2 — claudicação moderada', '3 — claudicação grave', '4 — dor de repouso', '5 — perda tecidual menor', '6 — perda tecidual maior'], hint: '4–6 = isquemia crítica' },
  ],
});

const ARTERIAL_MMII = (): StructuredSection[] => [
  SEGMENTO_ARTERIAL('aortoiliaco', 'Eixo Aortoilíaco', 'eixo aortoilíaco pérvio, com fluxo trifásico e sem estenoses hemodinamicamente significativas'),
  SEGMENTO_ARTERIAL('fp-d', 'Eixo Femoropoplíteo Direito', 'artérias femoral comum, femoral superficial e poplítea direitas pérvias, com fluxo trifásico e sem estenoses significativas'),
  SEGMENTO_ARTERIAL('infra-d', 'Eixo Infrapatelar Direito', 'artérias tibial anterior, tibial posterior e fibular direitas pérvias, com fluxo preservado'),
  SEGMENTO_ARTERIAL('fp-e', 'Eixo Femoropoplíteo Esquerdo', 'artérias femoral comum, femoral superficial e poplítea esquerdas pérvias, com fluxo trifásico e sem estenoses significativas'),
  SEGMENTO_ARTERIAL('infra-e', 'Eixo Infrapatelar Esquerdo', 'artérias tibial anterior, tibial posterior e fibular esquerdas pérvias, com fluxo preservado'),
  ITB(),
];

const ARTERIAL_MMSS = (): StructuredSection[] => [
  SEGMENTO_ARTERIAL('sa', 'Eixo Subclávio-Axilar', 'artérias subclávia e axilar pérvias bilateralmente, com fluxo trifásico e sem sinais de roubo', [
    { id: 'roubo', label: 'Roubo da subclávia', kind: 'select', options: ['ausente', 'parcial (AV bifásica)', 'total (AV retrógrada)'] },
  ]),
  SEGMENTO_ARTERIAL('braquial', 'Artéria Braquial', 'artérias braquiais pérvias, com fluxo trifásico bilateralmente'),
  SEGMENTO_ARTERIAL('radial-ulnar', 'Artérias Radial e Ulnar', 'artérias radial e ulnar pérvias, com fluxo trifásico bilateralmente'),
  {
    id: 'arcos-palmares',
    label: 'Arcos Palmares (Teste de Allen)',
    normalable: true,
    normalText: 'arcos palmares patentes, com teste de Allen normal bilateralmente',
    fields: [
      { id: 'allen', label: 'Teste de Allen', kind: 'select', options: ['patente', 'incompleto'], alwaysShow: true },
      { id: 'allen_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'manobras',
    label: 'Manobras Dinâmicas',
    normalable: true,
    normalText: 'sem alteração do fluxo às manobras de hiperabdução (sem sinais de síndrome do desfiladeiro torácico)',
    fields: [
      { id: 'manobras_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'hiperabdução, Adson, gradiente pressórico entre MMSS (> 20 mmHg = significativo)' },
    ],
  },
  {
    id: 'fav',
    label: 'Fístula Arteriovenosa / Acesso (quando aplicável)',
    normalable: true,
    normalText: 'não aplicável',
    fields: [
      { id: 'fav_fluxo', label: 'Fluxo da FAV', kind: 'measure', unit: 'ml/min' },
      { id: 'fav_calibre', label: 'Calibre da veia eferente', kind: 'measure', unit: 'mm', normal: '≥ 6 mm (maturada)' },
      { id: 'fav_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'estenose venosa (VPS > 2× adjacente), pseudoaneurisma (yin-yang), trombose' },
    ],
  },
];

// ────────────────────────── VENOSO MEMBRO INFERIOR/SUPERIOR ──────────────────────────

/** Trombo — localização define o risco de TEP (proximal vs. distal). */
const TROMBO: StructuredFieldDef[] = [
  { id: 'segmento', label: 'Segmento', kind: 'select', options: ['ilíaca externa', 'femoral comum', 'femoral', 'poplítea', 'tibial anterior', 'tibial posterior', 'fibular', 'muscular (gastrocnêmio/sóleo)'] },
  { id: 'topografia', label: 'Topografia', kind: 'select', options: ['proximal (risco de TEP significativo)', 'distal', 'muscular'] },
  { id: 'oclusivo', label: 'Caráter', kind: 'select', options: ['oclusivo', 'não oclusivo (flutuante)'], hint: 'flutuante = maior risco de TEP' },
  { id: 'idade_trombo', label: 'Aspecto', kind: 'select', options: ['anecoico (recente/agudo)', 'iso/hiperecoico (organizado/crônico)'] },
  { id: 'extensao_trombo', label: 'Extensão', kind: 'measure', unit: 'cm' },
];

const VENOSO_PROFUNDO = (id: string, label: string, normalText: string): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [
    { id: `compress_${id}`, label: 'Compressibilidade', kind: 'select', options: VENOUS_COMPRESS, alwaysShow: true, hint: 'incompressibilidade = critério diagnóstico primário de TVP' },
  ],
  repeatGroup: { id: 'trombo', itemLabel: 'Trombo', addLabel: 'Adicionar trombo', fields: TROMBO },
});

/** Refluxo/varizes — CEAP 2020. Safena com calibre no card Normal. */
const VENOSO_SUPERFICIAL = (id: string, label: string, normalText: string, safenas: boolean): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [
    { id: `refluxo_${id}`, label: 'Refluxo', kind: 'select', options: ['ausente', 'presente'], alwaysShow: true, hint: 'patológico se > 0,5 s no superficial (> 1,0 s no profundo)' },
    { id: `refluxo_tempo_${id}`, label: 'Tempo de refluxo', kind: 'measure', unit: 's', showIf: { field: `refluxo_${id}`, equals: 'presente' } },
    ...(safenas
      ? [
          { id: `magna_${id}`, label: 'Calibre safena magna', kind: 'measure' as const, unit: 'mm', alwaysShow: true },
          { id: `parva_${id}`, label: 'Calibre safena parva', kind: 'measure' as const, unit: 'mm', alwaysShow: true },
        ]
      : []),
    { id: `ceap_${id}`, label: 'CEAP (clínico)', kind: 'select', options: CEAP },
    { id: `varizes_${id}`, label: 'Varizes / achados', kind: 'text', fullWidth: true, placeholder: 'topografia e calibre das varizes, tributárias insuficientes' },
    ...(safenas
      ? [{ id: `cartografia_${id}`, label: 'Cartografia venosa', kind: 'calc' as const, calcId: 'venous-cartography', fullWidth: true, hint: 'mapeamento de safenas, tributárias e perfurantes para planejamento cirúrgico' }]
      : []),
  ],
});

const PERFURANTES = (id: string, label: string): StructuredSection =>
  achados(id, label, 'Perfurante', [
    { id: 'local', label: 'Localização', kind: 'text', placeholder: 'ex: terço médio da perna, face medial' },
    { id: 'calibre', label: 'Calibre', kind: 'measure', unit: 'mm', hint: 'insuficiente se ≥ 3,5 mm com refluxo > 0,5 s' },
    { id: 'refluxo_perf', label: 'Tempo de refluxo', kind: 'measure', unit: 's' },
  ], { normalText: 'veias perfurantes competentes, sem refluxo significativo', addLabel: 'Adicionar perfurante' });

const VENOSO_MMII = (): StructuredSection[] => [
  VENOSO_PROFUNDO('vp-d', 'Sistema Venoso Profundo Direito', 'veias femoral comum, femoral, poplítea e tibiais direitas compressíveis e pérvias, com fluxo fásico e resposta adequada à compressão distal, sem trombos e sem refluxo patológico (> 1,0 s)'),
  VENOSO_SUPERFICIAL('vs-d', 'Sistema Venoso Superficial Direito', 'veias safena magna e parva direitas de calibre preservado, sem refluxo significativo (> 0,5 s) ou varizes', true),
  PERFURANTES('perf-d', 'Veias Perfurantes Direitas'),
  VENOSO_PROFUNDO('vp-e', 'Sistema Venoso Profundo Esquerdo', 'veias femoral comum, femoral, poplítea e tibiais esquerdas compressíveis e pérvias, com fluxo fásico, sem trombos e sem refluxo patológico (> 1,0 s)'),
  VENOSO_SUPERFICIAL('vs-e', 'Sistema Venoso Superficial Esquerdo', 'veias safena magna e parva esquerdas de calibre preservado, sem refluxo significativo (> 0,5 s) ou varizes', true),
  PERFURANTES('perf-e', 'Veias Perfurantes Esquerdas'),
];

const VENOSO_MMSS = (): StructuredSection[] => [
  VENOSO_PROFUNDO('vp-d', 'Sistema Venoso Profundo Direito', 'veias subclávia, axilar, braquiais, radiais e ulnares direitas compressíveis e pérvias, com fluxo fásico, sem trombos'),
  {
    id: 'braquiocefalica-d',
    label: 'Veia Braquiocefálica e Cava Superior Direitas (avaliação indireta)',
    normalable: true,
    normalText: 'fluxo fásico com a respiração e com transmissão cardíaca preservada, sugerindo patência dos segmentos centrais',
    fields: [
      { id: 'central_d', label: 'Fluxo (indireto)', kind: 'select', options: ['normal (fásico)', 'alterado (contínuo)'], alwaysShow: true, hint: 'fluxo contínuo = obstrução central provável' },
      { id: 'central_d_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  VENOSO_SUPERFICIAL('vs-d', 'Sistema Venoso Superficial Direito', 'veias cefálica e basílica direitas pérvias e compressíveis, sem trombos', false),
  VENOSO_PROFUNDO('vp-e', 'Sistema Venoso Profundo Esquerdo', 'veias subclávia, axilar, braquiais, radiais e ulnares esquerdas compressíveis e pérvias, com fluxo fásico, sem trombos'),
  {
    id: 'braquiocefalica-e',
    label: 'Veia Braquiocefálica e Cava Superior Esquerdas (avaliação indireta)',
    normalable: true,
    normalText: 'fluxo fásico com a respiração e com transmissão cardíaca preservada, sugerindo patência dos segmentos centrais',
    fields: [
      { id: 'central_e', label: 'Fluxo (indireto)', kind: 'select', options: ['normal (fásico)', 'alterado (contínuo)'], alwaysShow: true, hint: 'fluxo contínuo = obstrução central provável' },
      { id: 'central_e_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  VENOSO_SUPERFICIAL('vs-e', 'Sistema Venoso Superficial Esquerdo', 'veias cefálica e basílica esquerdas pérvias e compressíveis, sem trombos', false),
];

// ─────────────────────────────── ARTÉRIAS RENAIS ───────────────────────────────

/** Rim: comprimento no card Normal (assimetria sugere estenose crônica). */
const RIM = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `rim-${side === 'd' ? 'direito' : 'esquerdo'}`,
  label,
  normalable: true,
  normalText: 'rim de dimensões, contornos e espessura parenquimatosa normais, com relação córtico-medular preservada',
  fields: [
    { id: `comprimento_${side}`, label: 'Comprimento', kind: 'measure', unit: 'cm', alwaysShow: true, normal: '9–12 cm', hint: 'assimetria > 1,5 cm sugere nefropatia isquêmica' },
    { id: `parenquima_${side}`, label: 'Espessura parenquimatosa', kind: 'measure', unit: 'cm', alwaysShow: true, normal: '≥ 1,3 cm' },
    { id: `rim_desc_${side}`, label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

/**
 * Artéria renal. O RAR sai de `vps_renal_{d,e}` ÷ `vps_aorta` — por isso a VPS
 * da aorta fica no card Normal da seção Aorta, e não é opcional.
 */
const ARTERIA_RENAL = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `arteria-renal-${side === 'd' ? 'direita' : 'esquerda'}`,
  label,
  normalable: true,
  normalText: 'artéria renal pérvia em toda a extensão avaliável, com fluxo de padrão e velocidades normais, sem sinais de estenose',
  fields: [
    { id: `vps_renal_${side}`, label: 'VPS a. renal', kind: 'measure', unit: 'cm/s', alwaysShow: true, normal: '< 180 cm/s', hint: '> 180 cm/s ou RAR ≥ 3,5 = estenose ≥ 60% (auto)' },
    { id: `renal_desc_${side}`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'estenose ostial/tronco, artéria polar acessória, displasia fibromuscular' },
  ],
});

/**
 * Índices intraparenquimatosos. `ir_{d,e}` são os ids canônicos do IR renal;
 * o tardus-parvus (TA > 70 ms / IA < 3 m/s²) é indireto de estenose proximal.
 */
const INDICES_INTRA = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `indices-intraparenquimatosos-${side === 'd' ? 'direitos' : 'esquerdos'}`,
  label,
  fields: [
    { id: `ir_${side}`, label: 'IR intraparenquimatoso', kind: 'measure', calcId: 'vascular-ratios', alwaysShow: true, normal: '< 0,70', hint: '> 0,70 = elevado (nefropatia parenquimatosa)' },
    { id: `ta_${side}`, label: 'Tempo de aceleração', kind: 'measure', unit: 'ms', alwaysShow: true, normal: '< 70 ms', hint: '> 70 ms = tardus-parvus (estenose proximal)' },
    { id: `intra_desc_${side}`, label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const ARTERIAS_RENAIS = (): StructuredSection[] => [
  RIM('d', 'Rim Direito'),
  ARTERIA_RENAL('d', 'Artéria Renal Direita'),
  INDICES_INTRA('d', 'Índices Intraparenquimatosos Direitos'),
  RIM('e', 'Rim Esquerdo'),
  ARTERIA_RENAL('e', 'Artéria Renal Esquerda'),
  INDICES_INTRA('e', 'Índices Intraparenquimatosos Esquerdos'),
  {
    id: 'aorta',
    label: 'Aorta',
    normalable: true,
    normalText: 'aorta abdominal de calibre normal, sem placas obstrutivas no plano das artérias renais',
    fields: [
      { id: 'vps_aorta', label: 'VPS aorta (justarrenal)', kind: 'measure', unit: 'cm/s', alwaysShow: true, hint: 'denominador do RAR — sem ela não há razão aorto-renal' },
      { id: 'aorta', label: 'Maior calibre', kind: 'measure', unit: 'cm', alwaysShow: true, normal: '< 2,5 cm', hint: 'ectasia 2,5–2,9 · aneurisma ≥ 3,0 cm' },
      { id: 'aorta_desc', label: 'Morfologia', kind: 'text', fullWidth: true, placeholder: 'placas, aneurisma, trombo' },
    ],
  },
];

// ─────────────────────────────── Registro ───────────────────────────────

export const VASCULAR_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'CARÓTIDAS E VERTEBRAIS', match: /car[óo]tidas?( e vertebrais)?/, sections: CAROTIDAS_E_VERTEBRAIS },
  { name: 'ARTÉRIAS OFTÁLMICAS', match: /oft[áa]lmicas?/, sections: ARTERIAS_OFTALMICAS },
  { name: 'ARTÉRIAS RENAIS', match: /art[ée]rias? renais/, sections: ARTERIAS_RENAIS },
  { name: 'AORTA TORÁCICA', match: /aorta tor[áa]cica/, sections: AORTA_TORACICA },
  { name: 'AORTO-ILÍACO', match: /aorto.?il[íi]aco/, sections: AORTO_ILIACO },
  { name: 'ARTERIAL MEMBRO INFERIOR', match: /arterial (membro|mm)\s?inf/, sections: ARTERIAL_MMII },
  { name: 'ARTERIAL MEMBRO SUPERIOR', match: /arterial (membro|mm)\s?sup/, sections: ARTERIAL_MMSS },
  { name: 'VENOSO MEMBRO INFERIOR', match: /venoso (membro|mm)\s?inf/, sections: VENOSO_MMII },
  { name: 'VENOSO MEMBRO SUPERIOR', match: /venoso (membro|mm)\s?sup/, sections: VENOSO_MMSS },
];
