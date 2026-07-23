import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — MASTOLOGIA (3 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions de cada máscara, no léxico
 * ACR BI-RADS® v2025 (extensão da 5ª ed.) aplicado ao ULTRASSOM:
 * - forma inclui "lobulada" (v2025, contorno ondulado entre oval e irregular);
 * - **"microlobulada" PERMANECE margem distinta no US** — a fusão em
 *   "indistinta" é mudança MAMOGRÁFICA e não se aplica aqui;
 * - os valores dos descritores casam exatamente com `biradsSuggest`
 *   (scoring.ts), que deriva a categoria sugerida ao vivo por lesão.
 *
 * Lesões e linfonodos suspeitos ficam em grupos aninhados, revelados sob
 * 'Alterado'; composição do parênquima e córtex linfonodal são registrados
 * mesmo na normalidade (`alwaysShow`).
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

const BIRADS_CAT = ['BI-RADS 1', 'BI-RADS 2', 'BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 4C', 'BI-RADS 5', 'BI-RADS 6'];

/**
 * Lesão mamária no léxico BI-RADS US. Os ids `forma`/`orientacao`/`margem`/
 * `eco`/`acusticas` e seus valores alimentam a sugestão automática.
 */
const LESAO_BIRADS = (comLado: boolean): StructuredFieldDef[] => [
  ...(comLado
    ? [{ id: 'mama', label: 'Mama', kind: 'select' as const, options: ['direita', 'esquerda'] }]
    : []),
  { id: 'quadrante', label: 'Quadrante', kind: 'select', options: ['QSL', 'QSM', 'QIL', 'QIM', 'união dos quadrantes', 'retroareolar', 'prolongamento axilar'] },
  { id: 'loc', label: 'Localização (hora / distância da papila)', kind: 'text', placeholder: 'ex: 10h, a 3 cm da papila' },
  { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
  { id: 'forma', label: 'Forma', kind: 'select', options: ['oval', 'redonda', 'lobulada', 'irregular'], hint: 'lobulada: descritor do v2025' },
  { id: 'orientacao', label: 'Orientação', kind: 'select', options: ['paralela', 'não paralela (mais alta que larga)'] },
  { id: 'margem', label: 'Margem', kind: 'select', options: ['circunscrita', 'indistinta', 'angular', 'microlobulada', 'espiculada'], hint: 'no US a microlobulada permanece distinta' },
  { id: 'eco', label: 'Padrão ecogênico', kind: 'select', options: ['anecoico', 'hipoecoico', 'isoecoico', 'hiperecoico', 'heterogêneo', 'complexo cístico-sólido'] },
  { id: 'acusticas', label: 'Características acústicas posteriores', kind: 'select', options: ['nenhuma', 'reforço acústico posterior', 'sombra acústica', 'padrão combinado'] },
  { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['não avaliada', 'ausente', 'interna', 'periférica / em anel', 'mista'] },
  { id: 'elasto_mama_strain', label: 'Elastografia — strain (Tsukuba/Ueno)', kind: 'select', options: ['1 — mole', '2 — predominantemente mole', '3 — misto', '4 — predominantemente duro', '5 — duro'], hint: 'adjunto ao BI-RADS · 4–5 = suspeito (rígido) — auto' },
  { id: 'elasto_mama_swe', label: 'Elastografia — SWE (Emáx)', kind: 'measure', unit: 'kPa', hint: 'adjunto quantitativo · benigno < 80 · suspeito ≥ 80–100 kPa (auto)' },
  { id: 'associados', label: 'Achados associados', kind: 'multiselect', options: ['dilatação ductal', 'calcificações em massa', 'calcificações fora de massa', 'distorção arquitetural', 'espessamento cutâneo', 'retração cutânea', 'edema'] },
  { id: 'birads', label: 'Categoria BI-RADS', kind: 'select', calcId: 'birads-us-2013', options: BIRADS_CAT, hint: 'a sugestão automática não substitui o julgamento' },
];

/** Linfonodo axilar — níveis de Berg + critérios de suspeição. */
const LINFONODO_AXILAR: StructuredFieldDef[] = [
  { id: 'nivel', label: 'Nível (Berg)', kind: 'select', options: ['I — axila baixa', 'II — axila média', 'III — axila alta / infraclavicular', 'intramamário', 'cadeia mamária interna'] },
  { id: 'eixos', label: 'Maior × menor eixo', kind: 'text', placeholder: 'ex: 1,8 × 0,9 cm' },
  { id: 'cortex', label: 'Espessura cortical', kind: 'measure', unit: 'mm', normal: '≤ 3 mm', hint: 'focal > 3 mm = critério mais sensível de suspeição' },
  { id: 'forma', label: 'Forma (índice L:T)', kind: 'select', options: ['oval (L:T ≥ 2) — habitual', 'arredondado (L:T < 2) — suspeito'] },
  { id: 'hilo', label: 'Hilo gorduroso', kind: 'select', options: ['preservado/central', 'deslocado', 'ausente'] },
  { id: 'vasc', label: 'Vascularização (Doppler)', kind: 'select', options: ['hilar (habitual)', 'periférica/capsular', 'caótica', 'ausente'] },
];

// ─── Seções compartilhadas ───

const COMPOSICAO = (): StructuredSection => ({
  id: 'composicao',
  label: 'Composição do Parênquima',
  fields: [
    { id: 'composicao', label: 'Composição (léxico US)', kind: 'select', options: ['fibroglandular homogênea', 'adiposa homogênea', 'heterogênea'], alwaysShow: true, hint: 'reportada em todo exame' },
  ],
});

const PELE_CAP = (): StructuredSection => ({
  id: 'pele-cap',
  label: 'Pele, Complexo Areolopapilar e Subcutâneo',
  normalable: true,
  normalText: 'espessura e ecotextura preservadas, sem espessamento ou retração',
  fields: [
    { id: 'pele_achado', label: 'Achado', kind: 'multiselect', options: ['espessamento cutâneo', 'retração', 'edema/trabeculação', 'coleção', 'lesão dérmica'] },
    { id: 'pele_desc', label: 'Detalhe', kind: 'text', fullWidth: true },
  ],
});

/** Parênquima com as lesões BI-RADS aninhadas (revelação sob 'Alterado'). */
const PARENQUIMA = (id: string, label: string, comLado: boolean, normalText: string): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [
    { id: `${id}_eco`, label: 'Ecotextura', kind: 'select', options: ['homogênea', 'heterogênea'] },
    { id: `${id}_desc`, label: 'Outros achados', kind: 'text', fullWidth: true, placeholder: 'distorção arquitetural, coleção, área de sombra sem massa…' },
  ],
  repeatGroup: {
    id: 'lesoes',
    itemLabel: 'Lesão',
    addLabel: 'Adicionar lesão',
    score: 'birads',
    fields: LESAO_BIRADS(comLado),
  },
});

const DUCTOS = (): StructuredSection => ({
  id: 'ductos',
  label: 'Ductos Mamários',
  normalable: true,
  normalText: 'calibre preservado, sem ectasia ou conteúdo intraductal',
  fields: [
    { id: 'ducto_calibre', label: 'Maior calibre ductal', kind: 'measure', unit: 'mm', normal: '≤ 2 mm' },
    { id: 'ducto_desc', label: 'Conteúdo / achados', kind: 'text', fullWidth: true, placeholder: 'ectasia (localização), conteúdo intraductal, lesão papilífera' },
  ],
});

const PLANOS_PROFUNDOS = (): StructuredSection => ({
  id: 'planos-profundos',
  label: 'Planos Profundos',
  normalable: true,
  normalText: 'músculos peitorais e arcos costais de aspecto habitual',
  fields: [
    { id: 'profundos_desc', label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

const DOPPLER_MAMA = (): StructuredSection => ({
  id: 'estudo-doppler',
  label: 'Estudo Doppler',
  normalable: true,
  normalText: 'ausência de vascularização anômala nas estruturas avaliadas',
  fields: [
    { id: 'doppler_padrao', label: 'Vascularização', kind: 'select', options: ['habitual/ausente', 'aumentada difusa', 'anômala em lesão focal'], alwaysShow: true },
    { id: 'doppler_desc', label: 'Achados', kind: 'text', fullWidth: true },
  ],
});

/** Axila com linfonodos suspeitos aninhados. */
const AXILA = (id: string, label: string, normalText: string): StructuredSection =>
  achados(id, label, 'Linfonodo', LINFONODO_AXILAR, { normalText, addLabel: 'Adicionar linfonodo' });

// ─── Modelos por exame ───

const MAMAS_E_AXILAS = (): StructuredSection[] => [
  COMPOSICAO(),
  PELE_CAP(),
  PARENQUIMA('parenquima', 'Parênquima Mamário', true, 'ecotextura habitual, sem nódulos, cistos, distorção arquitetural ou coleções'),
  DUCTOS(),
  PLANOS_PROFUNDOS(),
  AXILA('axilas', 'Regiões Axilares', 'linfonodos com morfologia habitual, hilo ecogênico preservado e córtex fino (≤ 3 mm)'),
];

const MAMAS_COM_DOPPLER = (): StructuredSection[] => [
  COMPOSICAO(),
  PARENQUIMA('mama-direita', 'Mama Direita', false, 'pele e complexo areolopapilar normais; parênquima homogêneo, sem nódulos, cistos, distorção ou coleções'),
  PARENQUIMA('mama-esquerda', 'Mama Esquerda', false, 'pele e complexo areolopapilar normais; parênquima homogêneo, sem nódulos, cistos, distorção ou coleções'),
  DUCTOS(),
  DOPPLER_MAMA(),
  AXILA('axilas', 'Regiões Axilares', 'linfonodos com morfologia habitual bilateralmente, hilo adiposo preservado e córtex fino (≤ 3 mm)'),
];

const LINFONODOS_AXILARES = (): StructuredSection[] => [
  AXILA('axila-direita', 'Axila Direita', 'linfonodos de aspecto habitual nos níveis I–III (Berg) — ovais (L:T ≥ 2), hilo gorduroso preservado, córtex ≤ 3 mm, vascularização hilar'),
  AXILA('axila-esquerda', 'Axila Esquerda', 'linfonodos de aspecto habitual nos níveis I–III (Berg) — ovais (L:T ≥ 2), hilo gorduroso preservado, córtex ≤ 3 mm, vascularização hilar'),
  {
    id: 'outros-achados',
    label: 'Outros Achados',
    normalable: true,
    normalText: 'ausência de coleções, massas ou linfonodos intramamários suspeitos',
    fields: [
      { id: 'outros_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'coleção, massa, linfonodo intramamário' },
    ],
  },
];

export const MASTOLOGIA_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'LINFONODOS AXILARES', match: /linfonodos axilares/, sections: LINFONODOS_AXILARES },
  { name: 'MAMAS COM DOPPLER', match: /mamas? com doppler/, sections: MAMAS_COM_DOPPLER },
  { name: 'MAMAS E AXILAS', match: /mamas?/, sections: MAMAS_E_AXILAS },
];
