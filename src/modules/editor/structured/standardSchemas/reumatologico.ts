import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — REUMATOLÓGICO (3 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions, no léxico OMERACT:
 * - sinovite em escala de cinza (GSUS 0–3) e power Doppler (PDUS 0–3);
 * - GLOESS = escore combinado global;
 * - PD ≥ 1 define atividade inflamatória.
 *
 * ⚠️ O id de campo simples é GLOBAL no formulário. As articulações do PDUS-28
 * são um grupo REPETÍVEL (ids escopados por instância), não campos fixos.
 */

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

/** As 28 articulações do protocolo (ombros → joelhos). */
const ARTICULACOES_28 = [
  'ombro D', 'ombro E', 'cotovelo D', 'cotovelo E', 'punho D', 'punho E',
  'MCF 1 D', 'MCF 2 D', 'MCF 3 D', 'MCF 4 D', 'MCF 5 D',
  'MCF 1 E', 'MCF 2 E', 'MCF 3 E', 'MCF 4 E', 'MCF 5 E',
  'IFP 1 D', 'IFP 2 D', 'IFP 3 D', 'IFP 4 D', 'IFP 5 D',
  'IFP 1 E', 'IFP 2 E', 'IFP 3 E', 'IFP 4 E', 'IFP 5 E',
  'joelho D', 'joelho E',
];

/** Articulação avaliada — a unidade semiquantitativa do OMERACT. */
const ARTICULACAO: StructuredFieldDef[] = [
  { id: 'articulacao', label: 'Articulação', kind: 'select', options: ARTICULACOES_28 },
  { id: 'gsus', label: 'Sinovite — GSUS (0–3)', kind: 'select', options: SEMIQ, hint: 'hipertrofia sinovial em escala de cinza' },
  { id: 'pdus', label: 'Power Doppler — PDUS (0–3)', kind: 'select', options: SEMIQ, hint: 'PD ≥ 1 = atividade inflamatória' },
  { id: 'derrame', label: 'Derrame articular', kind: 'select', options: ['ausente', 'pequeno', 'moderado', 'volumoso'] },
  { id: 'erosao', label: 'Erosão', kind: 'select', options: ['ausente', 'presente'], hint: 'solução de continuidade cortical em 2 planos ortogonais' },
  { id: 'desc_art', label: 'Achados', kind: 'text', fullWidth: true },
];

/** Compartimento simples normal/alterado com campo descritivo. */
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

// ───────────────────────── ARTICULAÇÕES PERIFÉRICAS ─────────────────────────

const ARTICULACOES_PERIFERICAS = (): StructuredSection[] => [
  {
    id: 'articulacoes-avaliadas',
    label: 'Articulações Avaliadas',
    fields: [
      { id: 'art_lista', label: 'Articulações examinadas', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'ex: punhos, MCF 2–5 bilaterais, joelhos' },
      { id: 'art_indicacao', label: 'Indicação', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'artrite reumatoide, artrite psoriásica, monoartrite a esclarecer' },
    ],
  },
  achados('sinovite', 'Hipertrofia Sinovial e Power Doppler', 'Articulação', ARTICULACAO, {
    normalText: 'ausência de hipertrofia sinovial (GSUS 0) e de sinal ao power Doppler (PDUS 0) nas articulações avaliadas',
    addLabel: 'Adicionar articulação',
  }),
  compartimento('derrame', 'Derrame Articular', 'ausência de derrame articular nas articulações avaliadas'),
  achados('erosoes', 'Superfícies Ósseas / Erosões', 'Erosão', [
    { id: 'local_erosao', label: 'Articulação / sítio', kind: 'select', options: ARTICULACOES_28 },
    { id: 'tamanho', label: 'Maior diâmetro', kind: 'measure', unit: 'mm' },
    { id: 'pd_erosao', label: 'PD na erosão', kind: 'select', options: ['ausente', 'presente'] },
  ], { normalText: 'superfícies ósseas de contornos regulares, sem erosões', addLabel: 'Adicionar erosão' }),
  achados('enteses', 'Ênteses e Tendões Periarticulares', 'Ênteses', [
    { id: 'entese_local', label: 'Ênteses', kind: 'text', placeholder: 'ex: inserção do quadricipital, aquileu, fáscia plantar' },
    { id: 'entese_achado', label: 'Achado', kind: 'multiselect', options: ['espessamento', 'hipoecogenicidade', 'perda da fibrilaridade', 'erosão', 'entesófito', 'calcificação', 'PD positivo', 'bursite adjacente'], hint: 'PD na ênteses = entesite ativa (OMERACT)' },
    { id: 'entese_esp', label: 'Espessura', kind: 'measure', unit: 'mm' },
  ], { normalText: 'ênteses e tendões periarticulares de espessura e ecotextura normais, sem entesófitos, erosões ou sinal ao Doppler', addLabel: 'Adicionar ênteses' }),
];

// ─────────────────────────────── SACROILÍACAS ───────────────────────────────

const SACROILIACA = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `sacroiliaca-${side}`,
  label,
  normalable: true,
  normalText: 'articulação sacroilíaca com interlinha de aspecto habitual, sem sinal ao power Doppler',
  fields: [
    { id: `si_pd_${side}`, label: 'Power Doppler', kind: 'select', options: SEMIQ, alwaysShow: true, hint: 'PD ≥ 1 sugere sacroileíte ativa — o US tem acesso limitado; a RM é o padrão' },
    { id: `si_desc_${side}`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'irregularidade cortical, erosão, entesófito' },
  ],
});

const SACROILIACAS = (): StructuredSection[] => [
  SACROILIACA('d', 'Articulação Sacroilíaca Direita'),
  SACROILIACA('e', 'Articulação Sacroilíaca Esquerda'),
  achados('enteses-pelvicas', 'Ênteses Pélvicas e Inserções', 'Ênteses', [
    { id: 'entese_pelve_local', label: 'Sítio', kind: 'select', options: ['inserção isquiática (isquiotibiais)', 'crista ilíaca', 'espinha ilíaca ântero-superior', 'espinha ilíaca ântero-inferior', 'sínfise púbica', 'trocanter maior', 'outro'] },
    { id: 'entese_pelve_achado', label: 'Achado', kind: 'multiselect', options: ['espessamento', 'hipoecogenicidade', 'erosão', 'entesófito', 'calcificação', 'PD positivo', 'bursite adjacente'] },
  ], { normalText: 'ênteses pélvicas de aspecto habitual, sem entesófitos, erosões ou sinal ao Doppler', addLabel: 'Adicionar ênteses' }),
  compartimento('partes-moles-si', 'Partes Moles Periarticulares', 'partes moles periarticulares sem coleções ou alterações'),
];

// ─────────────────────────────── ESCORE PDUS-28 ───────────────────────────────

const PDUS_28 = (): StructuredSection[] => [
  {
    id: 'protocolo',
    label: 'Protocolo PDUS-28',
    fields: [
      { id: 'protocolo_desc', label: 'Protocolo', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'ombros, cotovelos, punhos, MCF 1–5, IFP 1–5 e joelhos, bilateralmente' },
      { id: 'equipamento', label: 'Ajuste do Doppler', kind: 'text', fullWidth: true, alwaysShow: true, placeholder: 'PRF, ganho no limiar do ruído, filtro de parede — declarar para reprodutibilidade' },
    ],
  },
  achados('articulacoes', 'Articulações Avaliadas (GSUS e PDUS por região)', 'Articulação', ARTICULACAO, {
    normalText: 'as 28 articulações do protocolo sem hipertrofia sinovial (GSUS 0) nem sinal ao power Doppler (PDUS 0)',
    addLabel: 'Adicionar articulação',
  }),
  {
    id: 'escore-combinado',
    label: 'Escore Combinado (GLOESS)',
    fields: [
      { id: 'gsus_total', label: 'Soma GSUS (0–84)', kind: 'measure', alwaysShow: true, hint: '28 art. × 0–3 · o chip "Soma GSUS" calcula automático quando as articulações são itemizadas acima' },
      { id: 'pdus_total', label: 'Soma PDUS (0–84)', kind: 'measure', alwaysShow: true, hint: 'idem — o chip "Soma PDUS" é a fonte quando itemizado' },
      { id: 'gloess', label: 'GLOESS', kind: 'measure', alwaysShow: true, hint: 'escore global OMERACT-EULAR de sinovite' },
      { id: 'n_ativas', label: 'Articulações com atividade (PD ≥ 1)', kind: 'measure', alwaysShow: true, hint: 'define atividade inflamatória' },
      { id: 'gloess_desc', label: 'Interpretação', kind: 'text', fullWidth: true, placeholder: 'comparar com exame anterior para resposta terapêutica' },
    ],
  },
  achados('erosoes', 'Erosões', 'Erosão', [
    { id: 'local_erosao', label: 'Articulação', kind: 'select', options: ARTICULACOES_28 },
    { id: 'tamanho', label: 'Maior diâmetro', kind: 'measure', unit: 'mm' },
    { id: 'pd_erosao', label: 'PD na erosão', kind: 'select', options: ['ausente', 'presente'] },
  ], { normalText: 'ausência de erosões nas articulações avaliadas', addLabel: 'Adicionar erosão' }),
];

// ─────────────────────────────── Registro ───────────────────────────────

export const REUMATOLOGICO_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'ESCORE PDUS-28', match: /pdus.?28|escore pdus/, sections: PDUS_28 },
  { name: 'SACROILÍACAS', match: /sacroil[íi]acas?/, sections: SACROILIACAS },
  { name: 'ARTICULAÇÕES PERIFÉRICAS', match: /articula[çc][õo]es perif[ée]ricas/, sections: ARTICULACOES_PERIFERICAS },
];
