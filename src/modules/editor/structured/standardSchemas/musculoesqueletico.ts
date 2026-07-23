import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — MUSCULOESQUELÉTICO (9 máscaras do sistema).
 *
 * Curados do analysisTemplate de cada máscara + a "Tabela Mestra de Referência
 * — MSK" do prompt da área (`areaPrompts.ts` § 15): os chips `normal:` daqui
 * repetem exatamente aqueles valores, para o formulário e o laudo gerado pela
 * IA não divergirem sobre o mesmo número.
 *
 * ⚠️ O id de campo simples é GLOBAL no formulário — `esp` num tendão e `esp`
 * noutro gravariam no mesmo valor. Todo id é escopado pela seção/estrutura.
 */

const TENDAO_ESTADO = ['íntegro', 'tendinose', 'ruptura parcial (< 50%)', 'ruptura parcial (≥ 50%)', 'ruptura completa'];
const SEMIQ = ['0 (ausente)', '1 (leve)', '2 (moderado)', '3 (acentuado)'];

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

/** Compartimento normal/alterado com campos próprios + descritivo. */
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

/**
 * Tendão com espessura no card Normal — a medida se lauda mesmo íntegro, e é o
 * que sustenta o diagnóstico de tendinose. `ref` vem da tabela mestra do prompt.
 */
const tendao = (id: string, label: string, ref?: string, hint?: string): StructuredFieldDef[] => [
  { id: `${id}_estado`, label: `${label} — integridade`, kind: 'select', options: TENDAO_ESTADO, alwaysShow: true },
  { id: `${id}_esp`, label: `${label} — espessura`, kind: 'measure', unit: 'mm', alwaysShow: true, normal: ref, hint },
];

/** Lesão focal genérica (coleção, cisto, nódulo) com volume automático. */
const LESAO_MSK: StructuredFieldDef[] = [
  { id: 'tipo', label: 'Tipo', kind: 'select', options: ['coleção', 'cisto', 'nódulo sólido', 'hematoma', 'corpo estranho', 'gânglio', 'outro'] },
  { id: 'local', label: 'Localização', kind: 'text' },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['ausente', 'periférica', 'interna', 'exuberante'] },
  { id: 'desc_lesao', label: 'Descrição', kind: 'text', fullWidth: true },
];

/** Nervo periférico — a CSA é o critério de compressão. */
const nervo = (id: string, label: string, normalText: string, ref?: string, hint?: string): StructuredSection =>
  compartimento(id, label, normalText, [
    { id: `csa_${id}`, label: 'Área seccional (CSA)', kind: 'measure', unit: 'mm²', alwaysShow: true, normal: ref, hint },
  ]);

// ─────────────────────────────────── OMBRO ───────────────────────────────────

const OMBRO = (): StructuredSection[] => [
  compartimento('biceps', 'Tendão da Cabeça Longa do Bíceps', 'tendão da cabeça longa do bíceps tópico no sulco intertubercular, de espessura e ecotextura normais, sem derrame na bainha',
    tendao('biceps', 'CLB', '4–6 mm (sulco intertubercular)', '> 7 mm = tendinose · luxação medial: avaliar subescapular').concat([
      { id: 'biceps_luxacao', label: 'Posição no sulco', kind: 'select', options: ['tópico', 'subluxado', 'luxado medialmente'], hint: 'luxação medial quase sempre acompanha lesão do subescapular' },
    ])),
  compartimento('subescapular', 'Tendão do Subescapular', 'tendão do subescapular íntegro, de espessura e ecotextura normais', tendao('subesc', 'Subescapular')),
  compartimento('supraespinal', 'Tendão do Supraespinal', 'tendão do supraespinal íntegro, de espessura e ecotextura normais, com footprint preservado',
    tendao('supra', 'Supraespinal', '5–7 mm (footprint)', '< 4 mm = suspeita de rotura').concat([
      { id: 'supra_gap', label: 'Extensão da lesão (gap)', kind: 'measure', unit: 'mm', showIf: { field: 'supra_estado', equals: 'ruptura completa' } },
    ])),
  compartimento('infraespinal', 'Tendões do Infraespinal e Redondo Menor', 'tendões do infraespinal e redondo menor íntegros, de espessura e ecotextura normais', tendao('infra', 'Infraespinal')),
  compartimento('trofismo', 'Trofismo Muscular', 'trofismo e ecotextura musculares preservados', [
    { id: 'trofismo_musc', label: 'Trofismo', kind: 'select', options: ['preservado', 'atrofia leve', 'atrofia moderada', 'atrofia acentuada', 'infiltração gordurosa'], alwaysShow: true, hint: 'atrofia do supra/infraespinal sugere lesão crônica' },
  ]),
  compartimento('bursa', 'Bursa Subacromial-Subdeltoídea', 'bursa subacromial-subdeltoídea de espessura normal, sem derrame ou espessamento sinovial', [
    { id: 'bursa_esp', label: 'Espessura', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 2 mm', hint: '≥ 2 mm = bursite' },
  ]),
  compartimento('acromioclavicular', 'Articulação Acromioclavicular', 'articulação acromioclavicular de aspecto habitual, sem derrame, osteófitos ou alargamento', [
    { id: 'ac_achado', label: 'Achado', kind: 'multiselect', options: ['normal', 'osteoartrose', 'derrame', 'cisto sinovial', 'alargamento (luxação)'] },
  ]),
  compartimento('recesso-posterior', 'Recesso Posterior (Glenoumeral)', 'recesso posterior sem derrame articular ou proliferação sinovial', [
    { id: 'recesso_derrame', label: 'Derrame', kind: 'measure', unit: 'mm' },
    { id: 'recesso_pd', label: 'Power Doppler sinovial', kind: 'select', options: SEMIQ },
  ]),
  compartimento('contornos-osseos', 'Contornos Ósseos', 'contornos ósseos regulares, sem entesófitos ou irregularidades corticais', [
    { id: 'osso_ombro', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'entesófito', 'irregularidade cortical', 'erosão', 'Hill-Sachs', 'calcificação (HADD)'] },
  ]),
  compartimento('manobras', 'Manobras Dinâmicas', 'sem sinais de impacto subacromial às manobras dinâmicas', [
    { id: 'espaco_subacromial', label: 'Espaço subacromial', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≥ 7 mm', hint: '< 5 mm = impacto crítico' },
    { id: 'impacto', label: 'Impacto dinâmico', kind: 'select', options: ['ausente', 'presente'] },
  ]),
];

// ────────────────────────────────── COTOVELO ──────────────────────────────────

const COTOVELO = (): StructuredSection[] => [
  compartimento('anterior', 'Compartimento Anterior', 'tendão distal do bíceps e braquial íntegros; recesso anterior sem derrame',
    tendao('biceps_distal', 'Bíceps distal').concat([
      { id: 'recesso_anterior', label: 'Derrame no recesso anterior', kind: 'measure', unit: 'mm' },
    ])),
  compartimento('medial', 'Compartimento Medial', 'tendão flexor-pronador comum íntegro; ligamento colateral medial preservado; nervo ulnar tópico',
    tendao('flexor_pronador', 'Flexor-pronador comum', undefined, 'epicondilite medial ("cotovelo do golfista")').concat([
      { id: 'lcm_cotovelo', label: 'Ligamento colateral medial', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'] },
      { id: 'csa_ulnar', label: 'Nervo ulnar — CSA (túnel cubital)', kind: 'measure', unit: 'mm²', alwaysShow: true, normal: '≤ 8 mm²', hint: '≥ 10 mm² = compressão (média normal ~7 mm² no epicôndilo medial) — auto' },
      { id: 'ulnar_luxacao', label: 'Nervo ulnar à flexão', kind: 'select', options: ['estável', 'subluxa', 'luxa'] },
    ])),
  compartimento('lateral', 'Compartimento Lateral', 'tendão extensor comum íntegro; ligamento colateral lateral preservado',
    tendao('extensor_comum', 'Extensor comum', undefined, 'epicondilite lateral ("cotovelo do tenista")').concat([
      { id: 'lcl_cotovelo', label: 'Ligamento colateral lateral', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'] },
    ])),
  compartimento('posterior', 'Compartimento Posterior', 'tendão tricipital íntegro; bursa olecraniana sem derrame; recesso posterior livre',
    tendao('triceps', 'Tríceps').concat([
      { id: 'bursa_olecraniana', label: 'Bursa olecraniana', kind: 'select', options: ['normal', 'bursite', 'bursite com PD (suspeita séptica)'], hint: 'bursite séptica = emergência (drenagem + ATB)' },
    ])),
  compartimento('osseas-cotovelo', 'Superfícies Ósseas', 'superfícies ósseas de contornos regulares', [
    { id: 'osso_cotovelo', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'osteófitos', 'erosão', 'corpo livre intra-articular', 'entesófito'] },
  ]),
  compartimento('doppler-cotovelo', 'Estudo Doppler', 'sem hiperemia ao estudo Doppler', [
    { id: 'pd_cotovelo', label: 'Power Doppler', kind: 'select', options: SEMIQ, alwaysShow: true },
  ]),
];

// ──────────────────────────────── PUNHO / MÃO ────────────────────────────────

const PUNHO = (): StructuredSection[] => [
  compartimento('dorsal', 'Compartimento Dorsal (Extensores)', 'compartimentos extensores I a VI com tendões íntegros e sem tenossinovite', [
    { id: 'ext_compartimento', label: 'Compartimento acometido', kind: 'multiselect', options: ['I (APL/ECP)', 'II', 'III (EPL)', 'IV', 'V', 'VI (EUC)'] },
    { id: 'ext_achado', label: 'Achado', kind: 'select', options: ['normal', 'tenossinovite', 'tendinose', 'ruptura'], hint: 'I: De Quervain · VI: instabilidade do EUC' },
  ]),
  compartimento('volar', 'Compartimento Volar (Flexores e Nervos)', 'tendões flexores íntegros, sem tenossinovite; nervo mediano de área seccional normal', [
    { id: 'flex_achado', label: 'Tendões flexores', kind: 'select', options: ['íntegros', 'tenossinovite', 'tendinose', 'ruptura'], alwaysShow: true },
    { id: 'csa_mediano', label: 'Nervo mediano — CSA (pisiforme)', kind: 'measure', unit: 'mm²', alwaysShow: true, normal: '≤ 9 mm²', hint: '≥ 10 mm² = STC · 10–13 leve · > 13 moderado/grave' },
  ]),
  compartimento('radial-ulnar', 'Faces Radial e Ulnar', 'faces radial e ulnar sem alterações; fibrocartilagem triangular de aspecto preservado', [
    { id: 'guyon', label: 'Túnel de Guyon', kind: 'select', options: ['normal', 'compressão do nervo ulnar', 'cisto/gânglio'] },
  ]),
  compartimento('articular-punho', 'Avaliação Articular e Óssea', 'articulações radiocárpica e mediocárpica sem derrame, sinovite ou erosões', [
    { id: 'derrame_punho', label: 'Derrame articular', kind: 'select', options: ['ausente', 'pequeno', 'moderado', 'volumoso'] },
    { id: 'gsus_punho', label: 'Sinovite (GSUS 0–3)', kind: 'select', options: SEMIQ },
    { id: 'pdus_punho', label: 'Power Doppler (PDUS 0–3)', kind: 'select', options: SEMIQ, hint: 'PD ≥ 1 = atividade inflamatória' },
    { id: 'erosao_punho', label: 'Erosões', kind: 'select', options: ['ausentes', 'presentes'] },
  ]),
  achados('moles-punho', 'Tecidos Moles e Estruturas Adjacentes', 'Lesão', LESAO_MSK, {
    normalText: 'tecidos moles adjacentes sem coleções, cistos sinoviais ou massas',
    addLabel: 'Adicionar lesão',
  }),
];

const MAO_E_PUNHO = (): StructuredSection[] => [
  compartimento('pele-tcs', 'Pele e Tecido Celular Subcutâneo', 'pele e tecido celular subcutâneo de espessura e ecotextura normais'),
  compartimento('dorsal', 'Compartimento Dorsal (Extensores)', 'compartimentos extensores I a VI com tendões íntegros e sem tenossinovite', [
    { id: 'ext_compartimento', label: 'Compartimento acometido', kind: 'multiselect', options: ['I (APL/ECP)', 'II', 'III (EPL)', 'IV', 'V', 'VI (EUC)'] },
    { id: 'ext_achado', label: 'Achado', kind: 'select', options: ['normal', 'tenossinovite', 'tendinose', 'ruptura'] },
    { id: 'dequervain', label: '1º compartimento (De Quervain)', kind: 'select', options: ['normal', 'tenossinovite (De Quervain)'], hint: 'APL e ECP — septo intercompartimental muda a resposta à infiltração' },
  ]),
  compartimento('volar', 'Compartimento Volar (Flexores e Nervos)', 'tendões flexores íntegros; túnel do carpo e de Guyon sem sinais compressivos; fáscia palmar e polias preservadas', [
    { id: 'flex_achado', label: 'Tendões flexores', kind: 'select', options: ['íntegros', 'tenossinovite', 'tendinose', 'ruptura'], alwaysShow: true },
    { id: 'csa_mediano', label: 'Nervo mediano — CSA (pisiforme)', kind: 'measure', unit: 'mm²', alwaysShow: true, normal: '≤ 9 mm²', hint: '≥ 10 mm² = STC' },
    { id: 'guyon', label: 'Túnel de Guyon', kind: 'select', options: ['normal', 'compressão do nervo ulnar', 'cisto/gânglio'] },
    { id: 'fascia_palmar', label: 'Fáscia palmar', kind: 'select', options: ['normal', 'espessamento (Dupuytren)', 'nódulo'] },
    { id: 'polias', label: 'Sistema de polias', kind: 'select', options: ['normal', 'espessamento da polia A1 (dedo em gatilho)', 'ruptura de polia'] },
  ]),
  achados('dedos', 'Dedos (Articulações e Aparelho Osteoligamentar)', 'Dedo', [
    { id: 'dedo', label: 'Dedo / articulação', kind: 'select', options: ['1º MCF', '2º MCF', '3º MCF', '4º MCF', '5º MCF', '1º IF', '2º IFP', '3º IFP', '4º IFP', '5º IFP', '2º IFD', '3º IFD', '4º IFD', '5º IFD'] },
    { id: 'dedo_achado', label: 'Achado', kind: 'multiselect', options: ['derrame', 'sinovite', 'erosão', 'tenossinovite', 'lesão ligamentar', 'dedo em gatilho', 'tofo gotoso'] },
    { id: 'dedo_gsus', label: 'GSUS (0–3)', kind: 'select', options: SEMIQ },
    { id: 'dedo_pdus', label: 'PDUS (0–3)', kind: 'select', options: SEMIQ },
  ], { normalText: 'articulações metacarpofalângicas e interfalângicas sem derrame, sinovite ou erosões', addLabel: 'Adicionar dedo' }),
  compartimento('articular-mao', 'Avaliação Articular, Ligamentar e Óssea', 'articulações sem derrame ou sinovite; superfícies ósseas de contornos regulares', [
    { id: 'erosao_mao', label: 'Erosões', kind: 'select', options: ['ausentes', 'presentes'] },
    { id: 'osso_mao', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'osteófitos', 'erosão', 'entesófito', 'depósito de duplo contorno (gota)'] },
  ]),
  compartimento('doppler-mao', 'Estudo Doppler', 'sem hiperemia ao estudo Doppler', [
    { id: 'pd_mao', label: 'Power Doppler', kind: 'select', options: SEMIQ, alwaysShow: true },
  ]),
];

// ─────────────────────────────────── JOELHO ───────────────────────────────────

const JOELHO = (): StructuredSection[] => [
  compartimento('anterior', 'Compartimento Anterior', 'tendões quadricipital e patelar íntegros; bursas sem derrame; recessos livres; coxim de Hoffa de aspecto habitual',
    tendao('quadricipital', 'Quadricipital', '5–7 mm', '> 8 mm = tendinose')
      .concat(tendao('patelar', 'Patelar', '3–5 mm', '> 6 mm = tendinose'))
      .concat([
        { id: 'hoffa', label: 'Coxim de Hoffa', kind: 'select', options: ['normal', 'edema/impacto', 'fibrose'] },
        { id: 'bursa_prepatelar', label: 'Bursas pré/infrapatelares', kind: 'select', options: ['sem derrame', 'bursite pré-patelar', 'bursite infrapatelar superficial', 'bursite infrapatelar profunda'] },
        { id: 'recesso_supra', label: 'Derrame no recesso suprapatelar', kind: 'measure', unit: 'mm', alwaysShow: true },
        { id: 'retinaculos', label: 'Retináculos patelares', kind: 'select', options: ['íntegros', 'lesão do retináculo medial', 'lesão do retináculo lateral'] },
      ])),
  compartimento('medial', 'Compartimento Medial', 'ligamento colateral medial íntegro; tendões da pata de ganso e bursa anserina sem alterações', [
    { id: 'lcm', label: 'Ligamento colateral medial', kind: 'select', options: ['íntegro', 'espessado', 'lesão grau I', 'lesão grau II', 'lesão grau III'], alwaysShow: true },
    { id: 'pata_ganso', label: 'Pata de ganso', kind: 'select', options: ['normal', 'tendinopatia'] },
    { id: 'bursa_anserina', label: 'Bursa anserina', kind: 'select', options: ['sem derrame', 'bursite'] },
  ]),
  compartimento('lateral', 'Compartimento Lateral', 'ligamento colateral lateral, banda iliotibial e tendões do bíceps femoral e poplíteo íntegros', [
    { id: 'lcl', label: 'Ligamento colateral lateral', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'], alwaysShow: true },
    { id: 'banda_iliotibial', label: 'Banda iliotibial', kind: 'select', options: ['normal', 'síndrome do atrito (espessamento/bursite)'] },
  ]),
  compartimento('posterior', 'Compartimento Posterior (Fossa Poplítea)', 'fossa poplítea sem cisto de Baker; tendões isquiotibiais e gastrocnêmios íntegros; feixe vasculonervoso preservado', [
    { id: 'baker', label: 'Cisto de Baker', kind: 'select', options: ['ausente', 'presente', 'roto'], alwaysShow: true, hint: 'roto simula TVP ("pseudoTVP") — avaliar sistema venoso' },
    { id: 'baker_dims', label: 'Dimensões do cisto', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', showIf: { field: 'baker', equals: 'presente' } },
  ]),
  compartimento('meniscos', 'Avaliação Meniscal Periférica', 'meniscos íntegros à avaliação periférica, sem extrusão', [
    { id: 'menisco_medial', label: 'Menisco medial', kind: 'select', options: ['íntegro', 'degeneração', 'extrusão', 'rotura periférica'], alwaysShow: true },
    { id: 'menisco_lateral', label: 'Menisco lateral', kind: 'select', options: ['íntegro', 'degeneração', 'extrusão', 'rotura periférica'], alwaysShow: true },
    { id: 'menisco_hint', label: 'Observação', kind: 'text', fullWidth: true, placeholder: 'o US só acessa a periferia — a RM é o padrão para roturas centrais' },
  ]),
  compartimento('osseas-joelho', 'Superfícies Ósseas e Sinais de Osteoartrose', 'superfícies ósseas de contornos regulares, sem osteófitos', [
    { id: 'osso_joelho', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'osteófitos', 'irregularidade cortical', 'erosão', 'condrocalcinose'] },
  ]),
  achados('moles-joelho', 'Musculatura e Tecidos Moles Adjacentes', 'Lesão', LESAO_MSK, {
    normalText: 'musculatura e tecidos moles adjacentes com trofismo e ecotextura preservados, sem coleções',
    addLabel: 'Adicionar lesão',
  }),
];

// ─────────────────────────────────── QUADRIL ───────────────────────────────────

const QUADRIL = (): StructuredSection[] => [
  compartimento('coxofemoral', 'Articulação Coxofemoral', 'articulação coxofemoral sem derrame ou proliferação sinovial', [
    { id: 'derrame_colo', label: 'Derrame (colo femoral anterior)', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 3 mm', hint: '> 5 mm = moderado · derrame + febre = artrite séptica (emergência)' },
    { id: 'gsus_quadril', label: 'Sinovite (GSUS 0–3)', kind: 'select', options: SEMIQ },
  ]),
  compartimento('anterior', 'Compartimento Anterior', 'tendão do iliopsoas e bursa sem alterações; reto femoral íntegro; feixe neurovascular femoral preservado',
    tendao('iliopsoas', 'Iliopsoas').concat([
      { id: 'bursa_iliopsoas', label: 'Bursa do iliopsoas', kind: 'select', options: ['sem derrame', 'bursite'] },
      { id: 'reto_femoral', label: 'Reto femoral', kind: 'select', options: ['íntegro', 'tendinopatia', 'lesão miotendínea'] },
      { id: 'snapping_ant', label: 'Ressalto anterior', kind: 'select', options: ['ausente', 'presente (iliopsoas)'] },
    ])),
  compartimento('lateral', 'Compartimento Lateral', 'tendões dos glúteos médio e mínimo íntegros; bursas trocantéricas sem derrame; trato iliotibial preservado',
    tendao('gluteos', 'Glúteos médio e mínimo', undefined, 'tendinopatia glútea = principal causa de dor trocantérica').concat([
      { id: 'bursa_trocanterica', label: 'Bursas trocantéricas', kind: 'select', options: ['sem derrame', 'bursite'], alwaysShow: true },
      { id: 'snapping_lat', label: 'Ressalto lateral', kind: 'select', options: ['ausente', 'presente (trato iliotibial)'] },
    ])),
  compartimento('medial', 'Compartimento Medial', 'origem comum dos adutores e grácil sem alterações',
    tendao('adutores', 'Adutores (origem comum)', undefined, 'pubalgia do atleta')),
  compartimento('posterior', 'Compartimento Posterior', 'origem comum dos isquiotibiais íntegra; bursa isquioglútea sem derrame; nervo ciático de aspecto habitual',
    tendao('isquiotibiais', 'Isquiotibiais (origem comum)').concat([
      { id: 'bursa_isquioglutea', label: 'Bursa isquioglútea', kind: 'select', options: ['sem derrame', 'bursite'] },
      { id: 'ciatico', label: 'Nervo ciático', kind: 'select', options: ['normal', 'espessado', 'aderido/comprimido'] },
      { id: 'quadrado_femoral', label: 'Músculo quadrado femoral', kind: 'select', options: ['normal', 'edema (impacto isquiofemoral)'] },
    ])),
  compartimento('osseas-quadril', 'Superfícies Ósseas', 'superfícies ósseas de contornos regulares', [
    { id: 'osso_quadril', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'osteófitos', 'irregularidade cortical', 'entesófito', 'calcificação (HADD)'] },
  ]),
  achados('moles-quadril', 'Tecidos Moles Adjacentes', 'Lesão', LESAO_MSK, {
    normalText: 'tecidos moles adjacentes sem coleções ou massas',
    addLabel: 'Adicionar lesão',
  }),
];

// ────────────────────────────────── TORNOZELO ──────────────────────────────────

const TORNOZELO = (): StructuredSection[] => [
  compartimento('anterior', 'Compartimento Anterior', 'tendões extensores íntegros; recesso articular anterior sem derrame', [
    { id: 'ext_tornozelo', label: 'Tendões extensores', kind: 'select', options: ['íntegros', 'tenossinovite', 'tendinose', 'ruptura'], alwaysShow: true },
    { id: 'recesso_tornozelo', label: 'Derrame no recesso anterior', kind: 'measure', unit: 'mm' },
  ]),
  compartimento('medial', 'Compartimento Medial', 'tendão tibial posterior e demais flexores íntegros; ligamento deltoide preservado; túnel do tarso sem sinais compressivos',
    tendao('tibial_posterior', 'Tibial posterior', '3–5 mm', '> 6 mm = tendinose · disfunção = pé plano adquirido').concat([
      { id: 'deltoide', label: 'Ligamento deltoide', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'] },
      { id: 'tunel_tarso', label: 'Túnel do tarso (nervo tibial)', kind: 'select', options: ['normal', 'compressão'] },
    ])),
  compartimento('lateral', 'Compartimento Lateral', 'tendões fibulares íntegros e tópicos; complexo ligamentar lateral preservado',
    tendao('fibulares', 'Fibulares').concat([
      { id: 'fibulares_luxacao', label: 'Posição dos fibulares', kind: 'select', options: ['tópicos', 'subluxação', 'luxação'], hint: 'avaliar com dorsiflexão-eversão' },
      { id: 'talofibular_ant', label: 'Talofibular anterior', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'], alwaysShow: true, hint: 'o mais lesado na entorse em inversão' },
      { id: 'calcaneofibular', label: 'Calcaneofibular', kind: 'select', options: ['íntegro', 'espessado', 'lesão parcial', 'lesão completa'] },
    ])),
  compartimento('posterior', 'Compartimento Posterior', 'tendão calcâneo (Aquiles) íntegro, de espessura normal; bursas sem derrame',
    tendao('aquiles', 'Aquiles', '4–6 mm', '> 6 mm = tendinose · gap = rotura (ortopedia urgente)').concat([
      { id: 'aquiles_gap', label: 'Gap da rotura', kind: 'measure', unit: 'mm', showIf: { field: 'aquiles_estado', equals: 'ruptura completa' } },
      { id: 'bursa_retrocalcanea', label: 'Bursa retrocalcânea', kind: 'select', options: ['sem derrame', 'bursite'] },
      { id: 'thompson', label: 'Teste de Thompson', kind: 'select', options: ['não realizado', 'negativo', 'positivo'] },
    ])),
];

// ───────────────────────────────────── PÉ ─────────────────────────────────────

const PE = (): StructuredSection[] => [
  compartimento('dorsal', 'Região Dorsal', 'tendões extensores íntegros; articulações tarsometatársicas e metatarsofalângicas sem derrame; nervo fibular profundo de aspecto habitual', [
    { id: 'ext_pe', label: 'Tendões extensores', kind: 'select', options: ['íntegros', 'tenossinovite', 'tendinose', 'ruptura'], alwaysShow: true },
    { id: 'artic_pe', label: 'Articulações TMT/MTF', kind: 'multiselect', options: ['sem alterações', 'derrame', 'sinovite', 'erosão', 'osteófitos', 'tofo gotoso'] },
  ]),
  compartimento('medial', 'Região Medial', 'tendões flexores íntegros; ligamento deltoide preservado; nervo tibial e ramos plantares de aspecto habitual',
    tendao('tibial_posterior', 'Tibial posterior', '3–5 mm', '> 6 mm = tendinose').concat([
      { id: 'nervo_tibial', label: 'Nervo tibial e ramos plantares', kind: 'select', options: ['normal', 'compressão (túnel do tarso)'] },
    ])),
  compartimento('lateral', 'Região Lateral', 'tendões fibulares íntegros; complexo ligamentar lateral preservado', [
    { id: 'fibulares_pe', label: 'Tendões fibulares', kind: 'select', options: ['íntegros', 'tenossinovite', 'tendinose', 'ruptura', 'subluxação'], alwaysShow: true },
    { id: 'ligamentos_pe', label: 'Complexo ligamentar lateral', kind: 'multiselect', options: ['íntegro', 'talofibular anterior lesado', 'calcaneofibular lesado', 'talofibular posterior lesado'] },
  ]),
  compartimento('plantar', 'Região Plantar', 'fáscia plantar de espessura normal; musculatura intrínseca preservada; espaços intermetatársicos sem neuromas; placas plantares íntegras', [
    { id: 'fascia_plantar', label: 'Fáscia plantar (inserção)', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 4 mm', hint: '> 4 mm = fascite plantar' },
    { id: 'fascia_achado', label: 'Fáscia plantar — achado', kind: 'multiselect', options: ['normal', 'espessamento', 'hipoecogenicidade', 'PD positivo', 'rotura', 'fibromatose (Ledderhose)'] },
    { id: 'neuroma', label: 'Neuroma de Morton (maior diâmetro)', kind: 'measure', unit: 'mm', alwaysShow: true, normal: 'ausente', hint: '> 5 mm = compatível com neuroma' },
    { id: 'neuroma_local', label: 'Espaço intermetatársico do neuroma', kind: 'select', options: ['1º', '2º', '3º', '4º'], hint: '2º e 3º são os mais acometidos' },
    { id: 'placas_plantares', label: 'Placas plantares', kind: 'select', options: ['íntegras', 'lesão'] },
  ]),
  compartimento('osseas-pe', 'Superfícies Ósseas', 'superfícies ósseas de contornos regulares', [
    { id: 'osso_pe', label: 'Achado ósseo', kind: 'multiselect', options: ['regulares', 'esporão calcâneo', 'osteófitos', 'erosão', 'irregularidade cortical'] },
  ]),
  achados('moles-pe', 'Tecidos Moles Adjacentes', 'Lesão', LESAO_MSK, {
    normalText: 'tecidos moles adjacentes sem coleções ou massas',
    addLabel: 'Adicionar lesão',
  }),
];

// ─────────────────────────────────── MUSCULAR ───────────────────────────────────

const MUSCULAR = (): StructuredSection[] => [
  compartimento('pele-tcs', 'Pele e Tecido Celular Subcutâneo', 'pele e tecido celular subcutâneo de espessura e ecotextura normais'),
  compartimento('fascias', 'Fáscias Musculares', 'fáscias musculares íntegras e de espessura normal', [
    { id: 'fascia_achado', label: 'Achado', kind: 'select', options: ['íntegras', 'espessamento', 'solução de continuidade (hérnia muscular)'] },
  ]),
  {
    id: 'musculos',
    label: 'Músculos Avaliados',
    normalable: true,
    normalText: 'músculos avaliados com trofismo, ecotextura e padrão fibrilar preservados, sem lesões',
    fields: [
      { id: 'musculos_lista', label: 'Músculos examinados', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'ex: gastrocnêmio medial, sóleo' },
      { id: 'trofismo_musc', label: 'Trofismo', kind: 'select', options: ['preservado', 'atrofia', 'hipertrofia', 'infiltração gordurosa'], alwaysShow: true },
    ],
    // a graduação da lesão muscular é o que define retorno ao esporte
    repeatGroup: {
      id: 'lesao',
      itemLabel: 'Lesão muscular',
      addLabel: 'Adicionar lesão',
      fields: [
        { id: 'musculo', label: 'Músculo', kind: 'text' },
        { id: 'grau', label: 'Grau (British Athletics)', kind: 'select', options: ['0 (DOMS — sem lesão estrutural)', '1 (pequena)', '2 (moderada)', '3 (extensa)', '4 (ruptura completa)'], hint: 'a graduação orienta o retorno ao esporte' },
        { id: 'sitio', label: 'Sítio', kind: 'select', options: ['miofascial (a)', 'miotendíneo (b)', 'intratendíneo (c)'] },
        { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
        { id: 'retracao', label: 'Retração / gap', kind: 'measure', unit: 'mm' },
        { id: 'hematoma', label: 'Hematoma', kind: 'select', options: ['ausente', 'intramuscular', 'intermuscular'] },
        { id: 'desc_lesao_musc', label: 'Descrição', kind: 'text', fullWidth: true },
      ],
    },
  },
  compartimento('tendoes-musc', 'Estruturas Tendíneas e Junções Miotendíneas', 'estruturas tendíneas e junções miotendíneas íntegras', [
    { id: 'tendoes_lista', label: 'Tendões examinados', kind: 'text', fullWidth: true },
    { id: 'tendoes_achado', label: 'Achado', kind: 'select', options: ['íntegros', 'tendinose', 'ruptura parcial', 'ruptura completa'] },
  ]),
  compartimento('bursas-musc', 'Bursas Adjacentes', 'bursas adjacentes sem derrame ou espessamento', [
    { id: 'bursas_lista', label: 'Bursas examinadas', kind: 'text', fullWidth: true },
  ]),
  nervo('nervos-musc', 'Estruturas Vasculonervosas Adjacentes',
    'estruturas vasculonervosas adjacentes de aspecto habitual, sem sinais compressivos',
    undefined, 'medir a CSA quando houver suspeita compressiva'),
  compartimento('manobras-musc', 'Manobras Dinâmicas', 'sem alterações às manobras dinâmicas', [
    { id: 'manobras_desc', label: 'Manobras realizadas', kind: 'text', fullWidth: true, placeholder: 'contração, Valsalva, ortostatismo (hérnia muscular)' },
  ]),
];

// ─────────────────────────────── Registro ───────────────────────────────

export const MUSCULOESQUELETICO_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence):
  // 'MÃO E PUNHO' antes de 'PUNHO', e 'TORNOZELO' antes de 'PÉ'
  { name: 'MÃO E PUNHO', match: /m[ãa]o e punho/, sections: MAO_E_PUNHO },
  { name: 'PUNHO', match: /punho/, sections: PUNHO },
  { name: 'OMBRO', match: /ombro/, sections: OMBRO },
  { name: 'COTOVELO', match: /cotovelo/, sections: COTOVELO },
  { name: 'JOELHO', match: /joelho/, sections: JOELHO },
  { name: 'QUADRIL', match: /quadril/, sections: QUADRIL },
  { name: 'TORNOZELO', match: /tornozelo/, sections: TORNOZELO },
  { name: 'PÉ', match: /^p[ée]\b|\bp[ée]$/, sections: PE },
  { name: 'MUSCULAR', match: /muscular/, sections: MUSCULAR },
];
