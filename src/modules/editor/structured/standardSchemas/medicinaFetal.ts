import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — MEDICINA FETAL (9 máscaras do sistema).
 *
 * Área mais rica em cálculo ao vivo. Ids CANÔNICOS que o liveCompute consome
 * (NÃO renomear):
 * - `dum` → IG + DPP e a base de TODOS os percentis (weeksGA);
 * - `ccn` / `dmsg` → IG do 1º trimestre;
 * - `dbp`/`cc`/`ca`/`cf` (+ `sexo_fetal`) → PFE Hadlock IV + percentil OMS;
 * - `ip_au`/`ip_acm`/`ip_uta`/`ip_dv` → percentis Doppler (20–40 sem);
 *   `ip_acm`+`ip_au` → RCP automática; `psv_acm` → MoM (anemia, 18–40 sem);
 * - `oft_p1`/`oft_p2` → razão P2/P1 (risco de PE ≥ 0,65);
 * - `nt` → TN (> 3,5 mm); `colo` → cervicometria (< 25 mm);
 * - `ila`/`mbv` → líquido amniótico; `pfe1`/`pfe2` → discordância gemelar.
 *
 * Curados de analysisTemplate + aiInstructions (ISUOG, FMF, FEBRASGO, CBR,
 * Barcelona/Figueras-Gratacós, Delphi 2016).
 */

/** Seção de ACHADOS: Normal (ausente) por padrão; 'Alterado' revela a lista. */
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

/** Compartimento anatômico normal/alterado com achados livres + medidas opcionais. */
function sistema(id: string, label: string, normalText: string, extra: StructuredFieldDef[] = []): StructuredSection {
  return {
    id,
    label,
    normalable: true,
    normalText,
    fields: [...extra, { id: `${id}_desc`, label: 'Achados', kind: 'text', fullWidth: true }],
  };
}

// ─── Blocos compartilhados ───

/**
 * Datação — define a IG DE REFERÊNCIA do exame, base de todos os percentis
 * (biometria/OMS, Doppler, MoM) e dos cálculos de risco. Três métodos, com os
 * campos revelados conforme a escolha (`showIf`):
 * - DUM (`dum`);
 * - USG anterior (`usg_data` + `usg_ig`) — padrão-ouro quando do 1º trimestre;
 * - Biometria do exame atual: CCN (1ºT), DBP (2ºT) ou CC (3ºT), escolhida
 *   automaticamente pelo trimestre.
 * Sem método declarado, a hierarquia é USG > DUM > biometria (ISUOG/ACOG).
 */
const DATACAO = (): StructuredSection => ({
  id: 'datacao',
  label: 'Idade Gestacional de Referência',
  fields: [
    { id: 'ig_metodo', label: 'Método de datação', kind: 'select', calcId: 'gestational-age', options: ['USG anterior (1º trimestre)', 'DUM', 'Biometria do exame atual'], hint: 'rege os percentis e os riscos do exame · biometria usa CCN (1ºT), DBP (2ºT) ou CC (3ºT) conforme o trimestre' },
    { id: 'dum', label: 'DUM', kind: 'text', placeholder: 'dd/mm/aaaa', showIf: { field: 'ig_metodo', equals: 'DUM' }, hint: 'IG e DPP automáticas' },
    { id: 'usg_data', label: 'Data da USG de referência', kind: 'text', placeholder: 'dd/mm/aaaa', showIf: { field: 'ig_metodo', equals: 'USG anterior (1º trimestre)' } },
    { id: 'usg_ig', label: 'IG naquela USG', kind: 'text', placeholder: 'ex: 12s3d', showIf: { field: 'ig_metodo', equals: 'USG anterior (1º trimestre)' }, hint: 'IG extrapolada até a data deste exame (automática)' },
    { id: 'datacao_obs', label: 'Observação', kind: 'text', fullWidth: true, placeholder: 'ciclos regulares/irregulares, FIV (data da transferência), divergência entre métodos' },
  ],
});

/**
 * Dados maternos e exame físico — alimentam as calculadoras de risco da FMF
 * (rastreio combinado de trissomias e de pré-eclâmpsia). Os ids abaixo são
 * lidos por `calcSeed.ts` para pré-preencher a calculadora com o que já foi
 * digitado aqui, e o liveCompute deriva PAM e IMC.
 */
const DADOS_MATERNOS = (): StructuredSection => ({
  id: 'dados-maternos',
  label: 'Dados Maternos e Exame Físico',
  fields: [
    { id: 'mae_idade', label: 'Idade materna', kind: 'measure', unit: 'anos', hint: 'compõe o risco a priori por idade' },
    { id: 'mae_peso', label: 'Peso', kind: 'measure', unit: 'kg' },
    { id: 'mae_altura', label: 'Altura', kind: 'measure', unit: 'cm', hint: 'IMC automático' },
    { id: 'pa_sistolica', label: 'PA sistólica', kind: 'measure', unit: 'mmHg', normal: '< 140 mmHg', hint: 'média dos dois braços (protocolo FMF)' },
    { id: 'pa_diastolica', label: 'PA diastólica', kind: 'measure', unit: 'mmHg', normal: '< 90 mmHg', hint: 'PAM automática' },
    { id: 'mae_etnia', label: 'Origem racial', kind: 'select', options: ['branca', 'afro-caribenha', 'sul-asiática', 'leste-asiática', 'mista'] },
    { id: 'mae_concepcao', label: 'Concepção', kind: 'select', options: ['espontânea', 'indução da ovulação', 'FIV/ICSI'] },
    { id: 'mae_paridade', label: 'Paridade', kind: 'select', options: ['nulípara', 'multípara sem PE prévia', 'multípara com PE prévia'] },
    { id: 'mae_pe_ig', label: 'IG do parto na PE prévia', kind: 'measure', unit: 'sem', showIf: { field: 'mae_paridade', equals: 'multípara com PE prévia' } },
    { id: 'mae_diabetes', label: 'Diabetes', kind: 'select', options: ['ausente', 'tipo 1', 'tipo 2 em insulina', 'tipo 2 sem insulina'] },
    { id: 'mae_comorbidades', label: 'Comorbidades e hábitos', kind: 'multiselect', options: ['hipertensão crônica', 'LES / SAF', 'história familiar de PE (mãe)', 'tabagismo'], fullWidth: true },
  ],
});

/** Biomarcadores do rastreio combinado (1º trimestre). */
const BIOQUIMICA = (): StructuredSection => ({
  id: 'bioquimica',
  label: 'Bioquímica / Biomarcadores',
  normalable: true,
  normalText: 'não realizada / não fornecida',
  fields: [
    { id: 'bio_analisador', label: 'Analisador', kind: 'select', options: ['Cobas', 'Delfia', 'Kryptor'], hint: 'define as medianas usadas na conversão em MoM' },
    { id: 'pappa_mom', label: 'PAPP-A', kind: 'measure', unit: 'MoM', normal: '≈ 1,0 MoM' },
    { id: 'bhcg_mom', label: 'β-hCG livre', kind: 'measure', unit: 'MoM', normal: '≈ 1,0 MoM' },
    { id: 'plgf_mom', label: 'PlGF', kind: 'measure', unit: 'pg/mL', hint: 'valor BRUTO (pg/mL) — o MoM é calculado pela mediana do analisador · rastreio de pré-eclâmpsia' },
  ],
});

const VITALIDADE = (): StructuredSection => ({
  id: 'vitalidade',
  label: 'Estática e Vitalidade Fetal',
  normalable: true,
  normalText: 'feto único e vivo, movimentação ativa e batimentos cardíacos rítmicos',
  fields: [
    { id: 'apresentacao', label: 'Apresentação', kind: 'select', options: ['cefálica', 'pélvica', 'córmica / transversa'], alwaysShow: true },
    { id: 'dorso', label: 'Dorso', kind: 'select', options: ['à esquerda', 'à direita', 'anterior', 'posterior'], alwaysShow: true },
    { id: 'bcf', label: 'BCF', kind: 'measure', unit: 'bpm', normal: '110–160 bpm', alwaysShow: true },
    { id: 'movimentos', label: 'Movimentos fetais', kind: 'select', options: ['presentes e adequados', 'reduzidos', 'ausentes'], normalOption: 'presentes e adequados' },
  ],
});

/** Biometria canônica (2º/3º trimestres) — PFE Hadlock + percentil OMS ao vivo. */
const BIOMETRIA = (comDof = true): StructuredSection => ({
  id: 'biometria',
  label: 'Biometria Fetal',
  fields: [
    { id: 'dbp', label: 'DBP', kind: 'measure', unit: 'mm', hint: 'percentil automático pela curva de referência (padrão Hadlock)' },
    ...(comDof ? [{ id: 'dof', label: 'DOF', kind: 'measure' as const, unit: 'mm' }] : []),
    { id: 'cc', label: 'CC', kind: 'measure', unit: 'mm' },
    { id: 'ca', label: 'CA', kind: 'measure', unit: 'mm' },
    { id: 'cf', label: 'CF', kind: 'measure', unit: 'mm' },
    { id: 'umero', label: 'Úmero', kind: 'measure', unit: 'mm' },
    { id: 'sexo_fetal', label: 'Sexo fetal', kind: 'select', options: ['indeterminado', 'masculino', 'feminino'], hint: 'só a curva OMS diferencia o PFE por sexo' },
    { id: 'pfe', label: 'PFE / percentil (calculadora)', kind: 'calc', calcId: 'who-fetal-biometry', fullWidth: true, hint: 'PFE + percentil automáticos de DBP/CC/CA/CF · curva selecionável (Hadlock / INTERGROWTH / OMS)' },
  ],
});

const DOPPLER_FETAL = (opts: { oftalmicas?: boolean; ducto?: boolean; barcelona?: boolean } = {}): StructuredSection => ({
  id: 'doppler',
  label: 'Dopplerfluxometria',
  normalable: true,
  normalText: 'índices dentro dos limites da normalidade para a idade gestacional',
  fields: [
    { id: 'ip_au', label: 'IP Artéria Umbilical', kind: 'measure', calcId: 'doppler-fetal', alwaysShow: true, hint: 'percentil automático (20–40 sem) · alterado se > p95' },
    { id: 'au_diastole', label: 'Diástole final (AU)', kind: 'select', options: ['positiva', 'ausente', 'reversa'], normalOption: 'positiva', alwaysShow: true, hint: 'ausente/reversa = estadiamento de Barcelona' },
    { id: 'ip_acm', label: 'IP Artéria Cerebral Média', kind: 'measure', alwaysShow: true, hint: 'redistribuição se < p5 · RCP (ACM/AU) automática' },
    { id: 'psv_acm', label: 'PSV ACM', kind: 'measure', unit: 'cm/s', hint: 'MoM automático (18–40 sem) · anemia se > 1,5 MoM' },
    { id: 'ip_uta', label: 'IP Artérias Uterinas (média)', kind: 'measure', alwaysShow: true, hint: 'percentil automático · risco se > p95' },
    { id: 'uta_incisura', label: 'Incisura protodiastólica', kind: 'select', options: ['ausente bilateral', 'presente unilateral', 'presente bilateral'], normalOption: 'ausente bilateral' },
    ...(opts.ducto
      ? [
          { id: 'dv', label: 'Ducto venoso — onda A', kind: 'select' as const, options: ['positiva', 'ausente', 'reversa'], normalOption: 'positiva' },
          { id: 'ip_dv', label: 'IP Ducto Venoso', kind: 'measure' as const, hint: 'percentil automático · > p95 = pré-carga aumentada' },
        ]
      : []),
    ...(opts.oftalmicas
      ? [
          { id: 'oft_p1', label: 'PSV 1º pico (P1) — oftálmica', kind: 'measure' as const, unit: 'cm/s', hint: 'média dos dois olhos' },
          { id: 'oft_p2', label: 'PSV 2º pico (P2) — oftálmica', kind: 'measure' as const, unit: 'cm/s', hint: 'razão P2/P1 automática · risco de PE se ≥ 0,65' },
        ]
      : []),
    ...(opts.barcelona
      ? [
          { id: 'crescimento_vel', label: 'Velocidade de crescimento', kind: 'calc' as const, calcId: 'growth-velocity', fullWidth: true, hint: 'Δ ponderal e Δz/semana vs. exame anterior (não avaliável em exame único)' },
          // o estadiamento de Barcelona consome biometria + Doppler juntos —
          // é o que separa RCIU de PIG e define a conduta/periodicidade
          { id: 'estadiamento_barcelona', label: 'Estadiamento de crescimento (Barcelona)', kind: 'calc' as const, calcId: 'barcelona-fetal-growth', fullWidth: true, hint: 'percentil do PFE + AU/ACM/RCP/UtA → estádio I–IV e conduta' },
        ]
      : []),
  ],
});

const PLACENTA = (): StructuredSection => ({
  id: 'placenta',
  label: 'Placenta',
  normalable: true,
  normalText: 'inserção normal, espessura e ecotextura preservadas, grau compatível com a idade gestacional',
  fields: [
    { id: 'placenta_loc', label: 'Inserção', kind: 'select', options: ['anterior', 'posterior', 'fúndica', 'lateral direita', 'lateral esquerda', 'prévia'], alwaysShow: true },
    { id: 'placenta_grau', label: 'Grau (Grannum)', kind: 'select', options: ['0', 'I', 'II', 'III'], alwaysShow: true },
    { id: 'placenta_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'espessura, lagos, sinais de acretismo, hematoma' },
  ],
});

/**
 * Líquido amniótico — a ESTRUTURA COMPLETA dos dois métodos no card:
 * - ILA pelos 4 quadrantes (Phelan): a soma e a classificação saem no motor;
 * - MBV (maior bolsão vertical / bolsão único).
 * A calculadora `amniotic-fluid` abre semeada com os quadrantes (o motor e a
 * calculadora usam o MESMO valor — o motor classifica em cm, a calculadora em
 * mm, com os mesmos cortes; a semente converte cm→mm).
 */
const LIQUIDO = (): StructuredSection => ({
  id: 'liquido-amniotico',
  label: 'Líquido Amniótico',
  fields: [
    { id: 'ila_q1', label: 'Quadrante superior direito', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'ila_q2', label: 'Quadrante superior esquerdo', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'ila_q3', label: 'Quadrante inferior direito', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'ila_q4', label: 'Quadrante inferior esquerdo', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'ila', label: 'ILA (total)', kind: 'measure', unit: 'cm', calcId: 'amniotic-fluid', normal: '8–24 cm', alwaysShow: true, hint: 'soma dos 4 quadrantes (auto) ou total manual · < 5 oligo · > 24 polidrâmnio · classificação automática' },
    { id: 'mbv', label: 'MBV (maior bolsão vertical)', kind: 'measure', unit: 'mm', normal: '20–80 mm', alwaysShow: true, hint: 'método do bolsão único · < 20 oligo · > 80 polidrâmnio (auto)' },
  ],
});

const CORDAO = (): StructuredSection => ({
  id: 'cordao',
  label: 'Cordão Umbilical',
  normalable: true,
  normalText: 'três vasos (duas artérias e uma veia), inserção habitual',
  fields: [
    { id: 'cordao_vasos', label: 'Vasos', kind: 'select', options: ['3 vasos (2 artérias + 1 veia)', '2 vasos (artéria umbilical única)'], normalOption: '3 vasos (2 artérias + 1 veia)', alwaysShow: true },
    { id: 'cordao_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'inserção velamentosa/marginal, circulares, cistos' },
  ],
});

const UTERO_ANEXOS = (): StructuredSection => ({
  id: 'utero-anexos',
  label: 'Útero e Anexos',
  normalable: true,
  normalText: 'útero gravídico de contornos regulares e ecotextura homogênea; anexos de aspecto habitual',
  fields: [
    { id: 'anexos_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'miomas, corpo lúteo, massa anexial, cicatriz de cesárea' },
  ],
});

/** Checklist anatômico do 1º trimestre (ISUOG) — sem as biometrias do 2º T. */
const ANATOMIA_1T = (): StructuredSection[] => [
  sistema('polo-cefalico', 'Polo Cefálico', 'calota íntegra, plexos coroides preenchendo os ventrículos laterais e linha média presente'),
  sistema('face', 'Face', 'perfil facial sem alterações evidentes'),
  sistema('pescoco', 'Pescoço', 'sem particularidades'),
  sistema('torax', 'Tórax e Coração', 'pulmões de ecogenicidade normal; coração com 4 câmaras visibilizadas e boa contratilidade'),
  sistema('abdome-fetal', 'Abdome', 'parede abdominal anterior íntegra, estômago e bexiga visibilizados, inserção normal do cordão'),
  sistema('membros', 'Membros', 'quatro membros de morfologia aparentemente normal, com mãos e pés visibilizados'),
  sistema('coluna', 'Coluna Vertebral', 'alinhamento normal dos corpos vertebrais'),
];

// ─── Anatomia fetal (2º trimestre / gemelar) ───

const ANATOMIA_2T = (): StructuredSection[] => [
  sistema('polo-cefalico', 'Polo Cefálico', 'calota íntegra, linha média e cavum do septo pelúcido presentes, morfologia habitual', [
    { id: 'atrio_vent', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', normal: '< 10 mm', alwaysShow: true, hint: 'ventriculomegalia se ≥ 10 mm' },
    { id: 'cerebelo', label: 'Diâmetro transverso do cerebelo', kind: 'measure', unit: 'mm', alwaysShow: true },
    { id: 'cisterna_magna', label: 'Cisterna magna', kind: 'measure', unit: 'mm', normal: '2–10 mm', alwaysShow: true },
    { id: 'prega_nucal', label: 'Prega nucal', kind: 'measure', unit: 'mm', normal: '< 6 mm', alwaysShow: true, hint: 'marcador se ≥ 6 mm (16–24 sem)' },
  ]),
  sistema('face', 'Face', 'órbitas e cristalinos presentes, perfil e lábio superior íntegros', [
    { id: 'osso_nasal_2t', label: 'Osso nasal', kind: 'measure', unit: 'mm', alwaysShow: true },
    { id: 'dbo', label: 'Diâmetro binocular (DBO)', kind: 'measure', unit: 'mm' },
    { id: 'dio', label: 'Diâmetro interocular (DIO)', kind: 'measure', unit: 'mm' },
  ]),
  sistema('pescoco', 'Pescoço', 'sem massas ou coleções anômalas'),
  sistema('torax', 'Tórax e Coração', 'pulmões homogêneos; situs solitus, eixo normal, 4 câmaras simétricas e vias de saída com cruzamento normal'),
  sistema('abdome-fetal', 'Abdome', 'estômago à esquerda, parede íntegra, rins tópicos e bexiga visualizada'),
  sistema('coluna', 'Coluna Vertebral', 'alinhamento normal e revestimento cutâneo íntegro'),
  sistema('membros', 'Membros', 'quatro membros presentes, três segmentos visualizados, mãos e pés normais'),
  sistema('genitalia', 'Genitália Externa', 'aspecto compatível com o sexo fetal'),
];

// ─── Modelos por exame ───

const OBSTETRICA_INICIAL = (): StructuredSection[] => [
  DATACAO(),
  UTERO_ANEXOS(),
  {
    id: 'saco-gestacional',
    label: 'Saco Gestacional',
    normalable: true,
    normalText: 'único, tópico (fúndico), contornos regulares e reação coriodecidual adequada',
    fields: [
      { id: 'dmsg', label: 'Diâmetro médio (DMSG)', kind: 'measure', unit: 'mm', calcId: 'msd-dmsg', alwaysShow: true, hint: 'IG automática pelo DMSG' },
      { id: 'sg_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'localização, contornos, hematoma subcoriônico' },
    ],
  },
  sistema('vesicula-vitelinica', 'Vesícula Vitelínica', 'presente, com morfologia e dimensões normais', [
    { id: 'vv_diam', label: 'Diâmetro', kind: 'measure', unit: 'mm', normal: '3–6 mm', alwaysShow: true },
  ]),
  {
    id: 'embriao',
    label: 'Embrião',
    normalable: true,
    normalText: 'visibilizado, com contornos regulares',
    fields: [
      { id: 'ccn', label: 'CCN (comprimento cabeça-nádega)', kind: 'measure', unit: 'mm', calcId: 'gestational-age', alwaysShow: true, hint: 'IG automática pelo CCN (Hadlock 1992) · datação do 1º trimestre' },
      { id: 'bcf', label: 'BCE / frequência', kind: 'measure', unit: 'bpm', normal: '110–160 bpm', alwaysShow: true },
      { id: 'embriao_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'douglas',
    label: 'Fundo de Saco de Douglas',
    normalable: true,
    normalText: 'livre',
    fields: [{ id: 'douglas_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'líquido livre, coleção' }],
  },
];

const OBSTETRICA_ABDOMINAL = (doppler: boolean): StructuredSection[] => [
  DATACAO(),
  ...(doppler ? [DADOS_MATERNOS()] : []),
  UTERO_ANEXOS(),
  VITALIDADE(),
  BIOMETRIA(false),
  ...(doppler ? [DOPPLER_FETAL({ oftalmicas: true, barcelona: true })] : []),
  PLACENTA(),
  CORDAO(),
  LIQUIDO(),
];

const MORFOLOGICA_1T = (): StructuredSection[] => [
  DATACAO(),
  DADOS_MATERNOS(),
  BIOQUIMICA(),
  UTERO_ANEXOS(),
  {
    id: 'colo-uterino',
    label: 'Colo Uterino',
    normalable: true,
    normalText: 'orifício interno fechado, comprimento normal (via transvaginal)',
    fields: [
      { id: 'colo', label: 'Comprimento do colo', kind: 'measure', unit: 'mm', normal: '≥ 25 mm', alwaysShow: true, hint: 'colo curto se < 25 mm (auto)' },
    ],
  },
  {
    id: 'vitalidade-1t',
    label: 'Gestação e Vitalidade',
    normalable: true,
    normalText: 'tópica, única e evolutiva; feto com movimentação ativa',
    fields: [
      { id: 'bcf', label: 'BCF (FCF)', kind: 'measure', unit: 'bpm', normal: '150–170 bpm', alwaysShow: true, hint: 'faixa do 1º T (11–13+6 sem); <110 ou >200 bpm → R6 · alimenta a FHR do rastreio combinado de trissomias' },
      { id: 'gestacao_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'biometria-1t',
    label: 'Biometria Fetal (1º trimestre)',
    fields: [
      { id: 'ccn', label: 'CCN', kind: 'measure', unit: 'mm', calcId: 'gestational-age', alwaysShow: true, hint: 'IG + DPP automáticas (Hadlock 1992) · janela 45–84 mm (11+0 a 13+6)' },
      { id: 'dbp', label: 'DBP', kind: 'measure', unit: 'mm' },
    ],
  },
  {
    id: 'marcadores',
    label: 'Marcadores de Cromossomopatias',
    normalable: true,
    normalText: 'TN dentro da normalidade, osso nasal presente, ducto venoso com onda A positiva e ausência de regurgitação tricúspide',
    fields: [
      { id: 'nt', label: 'Translucência nucal (TN)', kind: 'measure', unit: 'mm', normal: '≤ 3,5 mm', alwaysShow: true, hint: '3,0–3,4 mm já eleva o risco combinado (ver risco T21 ao lado); > 3,5 mm → conduta/R6 (o motor usa o delta-TN por CCN, não um corte fixo)' },
      { id: 'on', label: 'Osso nasal', kind: 'select', options: ['presente', 'ausente', 'hipoplásico'], normalOption: 'presente', alwaysShow: true },
      { id: 'dv', label: 'Ducto venoso — onda A', kind: 'select', options: ['positiva', 'ausente', 'reversa'], normalOption: 'positiva', alwaysShow: true },
      { id: 'ip_dv', label: 'IP do ducto venoso', kind: 'measure', hint: 'percentil automático · > p95 = pré-carga aumentada' },
      { id: 'tricuspide', label: 'Regurgitação tricúspide', kind: 'select', options: ['ausente', 'presente'], normalOption: 'ausente', alwaysShow: true },
      { id: 'risco_trissomias', label: 'Risco combinado de trissomias (FMF)', kind: 'calc', calcId: 'fmf-trisomy-risk', fullWidth: true, hint: 'CALCULA AUTOMÁTICO ao preencher idade + TN + bioquímica + FCF + marcadores (chip de risco T21 e T13/18 aparece sozinho) · abra para detalhar/ajustar · apoio à decisão (não é a calculadora oficial da FMF)' },
      { id: 'risco_trissomias_fmf', label: 'Risco oficial da FMF (opcional)', kind: 'text', fullWidth: true, hint: 'se você rodou a calculadora OFICIAL da FMF (fetalmedicine.org), cole aqui o "1 em N" de T21 e T13/18 — entra no laudo com prioridade sobre o cálculo interno' },
    ],
  },
  ...ANATOMIA_1T(),
  {
    id: 'doppler-1t',
    label: 'Dopplerfluxometria',
    normalable: true,
    normalText: 'artérias uterinas com índices normais, sem incisuras; artérias oftálmicas abaixo do limiar de risco',
    fields: [
      { id: 'ip_uta', label: 'IP Artérias Uterinas (média)', kind: 'measure', calcId: 'doppler-fetal', alwaysShow: true, hint: 'percentil automático · risco se > p95' },
      { id: 'uta_incisura', label: 'Incisuras protodiastólicas', kind: 'select', options: ['ausentes', 'presentes'], normalOption: 'ausentes' },
      { id: 'oft_p1', label: 'PSV 1º pico (P1)', kind: 'measure', unit: 'cm/s', hint: 'média dos dois olhos' },
      { id: 'oft_p2', label: 'PSV 2º pico (P2)', kind: 'measure', unit: 'cm/s', hint: 'razão P2/P1 automática · risco de PE se ≥ 0,65' },
      { id: 'risco_pe', label: 'Risco de pré-eclâmpsia (FMF)', kind: 'calc', calcId: 'fmf-preeclampsia-risk', fullWidth: true, hint: 'CALCULA AUTOMÁTICO ao preencher fatores maternos + PAM + IP uterinas + PlGF (chip de risco pré-termo e conduta AAS aparece sozinho) · abra para detalhar (4 PA / bilateral / oftálmicas) · apoio à decisão (não é a calculadora oficial da FMF)' },
      { id: 'risco_pe_fmf', label: 'Risco oficial de PE da FMF (opcional)', kind: 'text', fullWidth: true, hint: 'se você rodou a calculadora OFICIAL de pré-eclâmpsia da FMF, cole aqui o risco pré-termo (< 37 sem) e a conduta — entra no laudo com prioridade sobre o cálculo interno' },
    ],
  },
  PLACENTA(),
  LIQUIDO(),
  CORDAO(),
];

const MORFOLOGICO_2T = (): StructuredSection[] => [
  DATACAO(),
  UTERO_ANEXOS(),
  VITALIDADE(),
  BIOMETRIA(true),
  ...ANATOMIA_2T(),
  DOPPLER_FETAL(),
  CORDAO(),
  PLACENTA(),
  LIQUIDO(),
];

const NEUROSSONOGRAFIA = (): StructuredSection[] => [
  DATACAO(),
  sistema('calota', 'Calota Craniana e Estruturas Extracranianas', 'morfologia e contornos preservados, sem soluções de continuidade'),
  sistema('parenquima-cerebral', 'Parênquima Cerebral', 'simétrico, ecogenicidade habitual, sulcos e giros compatíveis com a idade gestacional'),
  sistema('sistema-ventricular', 'Sistema Ventricular', 'ventrículos laterais de morfologia e dimensões normais; 3º e 4º ventrículos centrados; plexos coroides habituais', [
    { id: 'atrio_vent', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', normal: '< 10 mm', alwaysShow: true, hint: 'ventriculomegalia leve 10–12 · moderada 13–15 · grave > 15 mm' },
  ]),
  sistema('linha-media', 'Estruturas da Linha Média', 'cavum do septo pelúcido visualizado; corpo caloso presente e biometria adequada; tálamos habituais', [
    { id: 'corpo_caloso', label: 'Comprimento do corpo caloso', kind: 'measure', unit: 'mm', alwaysShow: true },
  ]),
  sistema('fossa-posterior', 'Fossa Posterior', 'cerebelo e vermis íntegros, cisterna magna de dimensões normais, tronco habitual', [
    { id: 'cerebelo', label: 'Diâmetro transverso do cerebelo', kind: 'measure', unit: 'mm', alwaysShow: true },
    { id: 'cisterna_magna', label: 'Cisterna magna', kind: 'measure', unit: 'mm', normal: '2–10 mm', alwaysShow: true },
    { id: 'vermis', label: 'Vermis cerebelar', kind: 'select', options: ['íntegro', 'hipoplásico', 'ausente'], normalOption: 'íntegro', alwaysShow: true },
  ]),
  sistema('espacos-liquidos', 'Espaços Líquidos e Vascularização', 'espaço subaracnóideo e fissuras sem alterações; Doppler sem malformações vasculares grosseiras'),
];

const ECOCARDIOGRAMA = (): StructuredSection[] => [
  DATACAO(),
  sistema('situs', 'Situs e Posição', 'situs solitus, estômago e ápice à esquerda; levocardia; eixo cardíaco normal (~45°)', [
    { id: 'situs_tipo', label: 'Situs', kind: 'select', options: ['solitus', 'inversus', 'ambíguo'], normalOption: 'solitus', alwaysShow: true },
    { id: 'eixo', label: 'Eixo cardíaco', kind: 'measure', unit: '°', normal: '45° ± 20°', alwaysShow: true },
    { id: 'rct', label: 'Relação cardiotorácica', kind: 'measure', normal: '≈ 0,3', alwaysShow: true, hint: 'cardiomegalia se > 0,35' },
  ]),
  sistema('ritmo', 'Ritmo e Frequência', 'ritmo sinusal regular', [
    { id: 'bcf', label: 'Frequência cardíaca', kind: 'measure', unit: 'bpm', normal: '110–160 bpm', alwaysShow: true },
    { id: 'ritmo_tipo', label: 'Ritmo', kind: 'select', options: ['sinusal regular', 'extrassístoles', 'taquiarritmia', 'bradiarritmia / BAV'], normalOption: 'sinusal regular', alwaysShow: true },
  ]),
  sistema('quatro-camaras', 'Corte de 4 Câmaras', 'câmaras simétricas, septos íntegros, forame oval pérvio, valvas AV normais, veias pulmonares no átrio esquerdo'),
  sistema('vias-saida', 'Vias de Saída', 'concordância ventrículo-arterial com cruzamento normal dos grandes vasos; valvas semilunares normais'),
  sistema('tres-vasos', 'Corte dos 3 Vasos e Traqueia (3VT)', 'relação topográfica e diâmetros normais entre pulmonar, aorta e veia cava superior'),
  sistema('arcos', 'Arcos Aórtico e Ductal', 'morfologia normal, ambos à esquerda da traqueia, confluindo na aorta descendente'),
  sistema('drenagem-venosa', 'Drenagem Venosa Sistêmica', 'veias cavas superior e inferior drenando no átrio direito'),
  sistema('doppler-cardiaco', 'Dopplerfluxometria Cardíaca', 'fluxos normais nas valvas AV e semilunares; fluxo anterógrado no ducto arterioso; sem estenoses ou regurgitações significativas'),
  sistema('funcao-ventricular', 'Função Ventricular', 'contratilidade biventricular preservada (avaliação subjetiva)'),
  sistema('pericardio', 'Pericárdio', 'sem derrame pericárdico'),
];

/** Biometria de um feto na gestação gemelar (PFE via calculadora → discordância auto). */
const FETO_GEMELAR = (n: 1 | 2): StructuredSection[] => [
  {
    id: `feto-${n}`,
    label: `Feto ${n} — Estática e Vitalidade`,
    normalable: true,
    normalText: 'situação longitudinal, movimentação ativa e batimentos rítmicos',
    fields: [
      { id: `f${n}_apresentacao`, label: 'Apresentação', kind: 'select', options: ['cefálica', 'pélvica', 'córmica / transversa'], alwaysShow: true },
      { id: `f${n}_dorso`, label: 'Dorso', kind: 'select', options: ['à esquerda', 'à direita', 'anterior', 'posterior'] },
      { id: `f${n}_bcf`, label: 'BCF', kind: 'measure', unit: 'bpm', normal: '110–160 bpm', alwaysShow: true },
    ],
  },
  {
    id: `biometria-${n}`,
    label: `Feto ${n} — Biometria`,
    fields: [
      { id: `f${n}_dbp`, label: 'DBP', kind: 'measure', unit: 'mm' },
      { id: `f${n}_cc`, label: 'CC', kind: 'measure', unit: 'mm' },
      { id: `f${n}_ca`, label: 'CA', kind: 'measure', unit: 'mm' },
      { id: `f${n}_cf`, label: 'CF', kind: 'measure', unit: 'mm' },
      // ids canônicos pfe1/pfe2 → discordância automática entre os fetos
      { id: `pfe${n}`, label: `PFE Feto ${n}`, kind: 'measure', unit: 'g', calcId: 'who-fetal-biometry', hint: 'use a calculadora (PFE + percentil na curva escolhida) · discordância automática' },
    ],
  },
  {
    id: `doppler-${n}`,
    label: `Feto ${n} — Dopplerfluxometria`,
    normalable: true,
    normalText: 'índices dentro dos limites da normalidade',
    fields: [
      { id: `f${n}_ip_au`, label: 'IP Artéria Umbilical', kind: 'measure', calcId: 'doppler-fetal', alwaysShow: true },
      { id: `f${n}_diastole`, label: 'Diástole final (AU)', kind: 'select', options: ['positiva', 'ausente', 'reversa'], normalOption: 'positiva', alwaysShow: true },
      { id: `f${n}_ip_acm`, label: 'IP ACM', kind: 'measure' },
      { id: `f${n}_psv_acm`, label: 'PSV ACM', kind: 'measure', unit: 'cm/s', hint: 'anemia/TAPS: > 1,5 MoM' },
      { id: `f${n}_mbv`, label: 'MBV do saco', kind: 'measure', unit: 'mm', alwaysShow: true, hint: 'TTTS: < 20 mm (doador) / > 80 mm (receptor)' },
      { id: `f${n}_bexiga`, label: 'Bexiga', kind: 'select', options: ['visualizada', 'não visualizada (doador)', 'distendida (receptor)'] },
    ],
  },
];

const GEMELAR = (): StructuredSection[] => [
  DATACAO(),
  {
    id: 'corionicidade',
    label: 'Corionicidade e Amnionicidade',
    fields: [
      { id: 'corionicidade', label: 'Classificação', kind: 'select', options: ['dicoriônica diamniótica', 'monocoriônica diamniótica', 'monocoriônica monoamniótica'], hint: 'governa manejo, prognóstico e seguimento — registro obrigatório' },
      { id: 'sinal', label: 'Método (sinal)', kind: 'select', options: ['sinal do lambda (λ)', 'sinal do T', 'ausência de membrana interamniótica', 'documentado em exame prévio'] },
      { id: 'septo', label: 'Espessura do septo interamniótico', kind: 'measure', unit: 'mm' },
    ],
  },
  UTERO_ANEXOS(),
  ...FETO_GEMELAR(1),
  ...FETO_GEMELAR(2),
  {
    id: 'discordancia',
    label: 'Comparação entre os Fetos',
    fields: [
      { id: 'discordancia_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'discordância automática pelos PFE · estadiamento de Quintero (TTTS) se aplicável' },
      { id: 'quintero', label: 'Estádio de Quintero (TTTS)', kind: 'select', options: ['não aplicável', 'I', 'II', 'III', 'IV', 'V'] },
    ],
  },
  PLACENTA(),
];

const CERVICOMETRIA = (): StructuredSection[] => [
  DATACAO(),
  {
    id: 'colo-uterino',
    label: 'Colo Uterino',
    normalable: true,
    normalText: 'em topografia habitual, morfologia e ecotextura normais',
    fields: [
      { id: 'colo', label: 'Comprimento do canal fechado', kind: 'measure', unit: 'mm', normal: '≥ 25 mm', alwaysShow: true, hint: 'colo curto se < 25 mm (auto) · via transvaginal' },
      { id: 'colo_posicao', label: 'Posição', kind: 'select', options: ['posteriorizado', 'intermediário', 'centrado'] },
    ],
  },
  sistema('oci', 'Orifício Cervical Interno', 'fechado, sem sinais de insinuação das membranas'),
  sistema('canal', 'Canal Endocervical', 'anecoico, sem conteúdo'),
  {
    id: 'funilizacao',
    label: 'Funilização',
    normalable: true,
    normalText: 'ausente às manobras de compressão fúndica e de Valsalva',
    fields: [
      { id: 'funil_tipo', label: 'Tipo (T/Y/V/U)', kind: 'select', options: ['T (normal)', 'Y', 'V', 'U'], normalOption: 'T (normal)', alwaysShow: true },
      { id: 'funil_comp', label: 'Comprimento da funilização', kind: 'measure', unit: 'mm' },
      { id: 'funil_manobra', label: 'Manobras realizadas', kind: 'multiselect', options: ['compressão fúndica', 'Valsalva', 'ortostatismo'] },
    ],
  },
  {
    id: 'sludge',
    label: '"Sludge" Amniótico',
    normalable: true,
    normalText: 'ausente',
    fields: [{ id: 'sludge_desc', label: 'Achados', kind: 'text', fullWidth: true, hint: 'marcador de inflamação intra-amniótica' }],
  },
];

export const MEDICINA_FETAL_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'CERVICOMETRIA', match: /cervicometria/, sections: CERVICOMETRIA },
  { name: 'ECOCARDIOGRAMA FETAL', match: /ecocardiograma/, sections: ECOCARDIOGRAMA },
  { name: 'NEUROSSONOGRAFIA FETAL', match: /neurossonografia/, sections: NEUROSSONOGRAFIA },
  { name: 'GEMELAR', match: /gemelar/, sections: GEMELAR },
  { name: 'MORFOLÓGICA DO PRIMEIRO TRIMESTRE', match: /morfolog\w* (do |de )?(primeiro|1º|1)\s*trimestre/, sections: MORFOLOGICA_1T },
  { name: 'MORFOLÓGICO DE SEGUNDO TRIMESTRE', match: /morfolog\w* (do |de )?(segundo|2º|2)\s*trimestre/, sections: MORFOLOGICO_2T },
  { name: 'OBSTÉTRICA INICIAL', match: /obstetrica inicial/, sections: OBSTETRICA_INICIAL },
  { name: 'OBSTÉTRICA ABDOMINAL COM DOPPLER', match: /obstetrica abdominal com doppler/, sections: () => OBSTETRICA_ABDOMINAL(true) },
  { name: 'OBSTÉTRICA ABDOMINAL', match: /obstetrica abdominal/, sections: () => OBSTETRICA_ABDOMINAL(false) },
];
