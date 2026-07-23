import { StructuredSection, StructuredFieldDef } from '../../../../types';
import { StandardSchemaDef } from './types';

/**
 * MODELOS PADRÃO — PEDIATRIA (6 máscaras do sistema).
 *
 * Curados do analysisTemplate + aiInstructions de cada máscara (Graf, Papile,
 * SFU, critérios de estenose hipertrófica do piloro e de apendicite).
 *
 * IDS CANÔNICOS — `liveCompute` deriva ao vivo a partir destes ids:
 * - `alfa_{d,e}` / `beta_{d,e}`          → tipo de Graf (alerta se α < 60°);
 * - `piloro_musculo` + `piloro_canal`    → estenose hipertrófica;
 * - `apendice_diam`                      → apendicite (> 6 mm);
 * - `atrio_vent`                         → ventriculomegalia (> 10 mm).
 *
 * ⚠️ O id de campo simples é GLOBAL no formulário — dois campos com o mesmo id
 * em seções diferentes gravam no mesmo valor. Ids por lado/seção sempre.
 */

const SFU = ['ausente', 'SFU I', 'SFU II', 'SFU III', 'SFU IV'];
const PAPILE = ['ausente', 'grau I', 'grau II', 'grau III', 'grau IV'];

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

// ─────────────────────────────── TRANSFONTANELAR ───────────────────────────────

const TRANSFONTANELAR = (): StructuredSection[] => [
  {
    id: 'parenquima',
    label: 'Parênquima Supratentorial',
    normalable: true,
    normalText: 'parênquima cerebral de ecogenicidade e diferenciação córtico-subcortical normais para a idade, sem hemorragia, leucomalácia ou lesões focais',
    fields: [
      // Papile classifica a hemorragia da matriz germinativa do prematuro
      { id: 'hemorragia', label: 'Hemorragia (Papile)', kind: 'select', options: PAPILE, alwaysShow: true, hint: 'I: matriz germinativa · II: intraventricular sem dilatação · III: com dilatação · IV: infarto hemorrágico parenquimatoso' },
      { id: 'leucomalacia', label: 'Leucomalácia periventricular', kind: 'select', options: ['ausente', 'ecogenicidade aumentada (grau I)', 'cistos localizados (grau II)', 'cistos extensos (grau III)', 'cistos + perda de substância branca (grau IV)'] },
      { id: 'desc_parenquima', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  {
    id: 'sistema-ventricular',
    label: 'Sistema Ventricular e Espaços Líquidos',
    normalable: true,
    normalText: 'ventrículos laterais simétricos e não dilatados, com átrios de dimensões normais',
    fields: [
      { id: 'atrio_vent', label: 'Átrio ventricular', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 10 mm', hint: 'ventriculomegalia se > 10 mm (auto)' },
      { id: 'vent_indice', label: 'Índice ventricular (Levene)', kind: 'measure', normal: '< 0,35 (RN a termo)', hint: '> 0,50 = hidrocefalia' },
      { id: 'desc_ventriculos', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'dilatação, assimetria, coágulo intraventricular, ependimite' },
    ],
  },
  compartimento('linha-media', 'Estruturas da Linha Média', 'linha média centrada; cavum do septo pelúcido e corpo caloso de aspecto habitual', [
    { id: 'corpo_caloso', label: 'Corpo caloso', kind: 'select', options: ['presente e completo', 'hipoplásico', 'agenesia parcial', 'agenesia total'] },
    { id: 'cavum', label: 'Cavum do septo pelúcido', kind: 'select', options: ['presente', 'ausente'] },
  ]),
  compartimento('nucleos-base', 'Núcleos da Base e Tálamos', 'núcleos da base e tálamos de ecogenicidade e morfologia normais', [
    { id: 'vasculopatia', label: 'Vasculopatia lenticuloestriada', kind: 'select', options: ['ausente', 'presente'] },
  ]),
  compartimento('fossa-posterior', 'Fossa Posterior', 'cerebelo e vermis de morfologia e ecogenicidade normais; cisterna magna de dimensões habituais', [
    { id: 'cisterna_magna', label: 'Cisterna magna', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 10 mm' },
  ]),
  compartimento('espacos-extra-axiais', 'Espaços Extra-Axiais', 'espaços extra-axiais de amplitude normal para a idade, sem coleções', [
    { id: 'espaco_extra', label: 'Espaço subaracnóideo', kind: 'measure', unit: 'mm' },
  ]),
  {
    id: 'doppler',
    label: 'Dopplerfluxometria Vascular',
    normalable: true,
    normalText: 'índices de resistência dentro da normalidade para a idade, com fluxo de padrão habitual',
    fields: [
      // valores da tabela de referência do prompt da área (areaPrompts.ts)
      { id: 'ir_aca', label: 'IR artéria cerebral (ACM neonatal)', kind: 'measure', calcId: 'vascular-ratios', alwaysShow: true, normal: '0,60–0,80', hint: '> 0,90 = hipertensão intracraniana' },
      { id: 'desc_doppler_ped', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'trombose de seio venoso, hiperfluxo, IR alterado' },
    ],
  },
];

// ─────────────────────────────── COLUNA LOMBOSSACRA ───────────────────────────────

const COLUNA_LOMBOSSACRA = (): StructuredSection[] => [
  {
    id: 'cone-medular',
    label: 'Nível do Cone Medular',
    normalable: true,
    normalText: 'cone medular em topografia habitual, terminando ao nível de L1–L2',
    fields: [
      // tabela de referência do prompt da área: normal ≤ L1–L2 (< 3 meses);
      // abaixo de L3 = medula presa (síndrome da medula ancorada)
      { id: 'cone_nivel', label: 'Nível do cone', kind: 'select', options: ['T12', 'T12–L1', 'L1', 'L1–L2', 'L2', 'L2–L3', 'abaixo de L3'], alwaysShow: true, normal: '≤ L1–L2 (< 3 meses)', hint: 'abaixo de L3 = medula ancorada' },
      { id: 'desc_cone', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
  compartimento('filum', 'Filum Terminale e Raízes', 'filum terminale de espessura normal; raízes da cauda equina com mobilidade preservada', [
    { id: 'filum_esp', label: 'Espessura do filum', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 2 mm', hint: '> 2 mm: filum espessado (disrafismo oculto)' },
    { id: 'filum_lipoma', label: 'Lipoma do filum', kind: 'select', options: ['ausente', 'presente'] },
  ]),
  compartimento('canal-espinhal', 'Canal Espinhal e Arcos Posteriores', 'canal espinhal de amplitude normal; arcos posteriores íntegros', [
    { id: 'arcos', label: 'Arcos posteriores', kind: 'select', options: ['íntegros', 'disrafismo'] },
  ]),
  compartimento('partes-moles-coluna', 'Partes Moles e Pele', 'pele e partes moles sem estigmas cutâneos ou massas', [
    { id: 'estigma', label: 'Estigma cutâneo', kind: 'multiselect', options: ['ausente', 'fosseta sacral', 'tufo piloso', 'hemangioma', 'apêndice cutâneo', 'desvio da prega glútea'] },
  ]),
];

// ─────────────────────────── ABDOME TOTAL PEDIÁTRICO ───────────────────────────

/** Órgão com medida no card Normal (a dimensão se lauda mesmo sem alteração). */
const orgao = (
  id: string,
  label: string,
  normalText: string,
  medidas: StructuredFieldDef[]
): StructuredSection => ({
  id,
  label,
  normalable: true,
  normalText,
  fields: [...medidas, { id: `desc_${id}`, label: 'Achados', kind: 'text', fullWidth: true }],
});

const ABDOME_PEDIATRICO = (): StructuredSection[] => [
  orgao('figado', 'Fígado', 'fígado de dimensões normais para a idade, com ecotextura homogênea e contornos regulares', [
    { id: 'figado_lobo_d', label: 'Lobo direito (longitudinal)', kind: 'measure', unit: 'cm', alwaysShow: true, hint: 'o limite varia com a idade/altura' },
  ]),
  compartimento('vias-biliares', 'Vias Biliares', 'vias biliares intra e extra-hepáticas de calibre normal', [
    { id: 'coledoco', label: 'Colédoco', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 4 mm (criança)' },
  ]),
  compartimento('vesicula', 'Vesícula Biliar', 'vesícula biliar de paredes finas, sem cálculos ou lama biliar', [
    { id: 'vesicula_parede', label: 'Parede', kind: 'measure', unit: 'mm', normal: '≤ 3 mm' },
  ]),
  compartimento('pancreas', 'Pâncreas', 'pâncreas de dimensões e ecotextura normais, com ducto de Wirsung não dilatado'),
  orgao('baco', 'Baço', 'baço de dimensões normais para a idade e ecotextura homogênea', [
    { id: 'baco_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm', alwaysShow: true, hint: 'o limite varia com a idade' },
  ]),
  orgao('rim-direito', 'Rim Direito', 'rim direito de dimensões normais para a idade, com relação córtico-medular preservada e sem dilatação do sistema coletor', [
    { id: 'rim_d_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm', alwaysShow: true, hint: 'compare com a curva por idade/altura' },
    { id: 'sfu_d', label: 'Dilatação (SFU)', kind: 'select', options: SFU, alwaysShow: true },
  ]),
  orgao('rim-esquerdo', 'Rim Esquerdo', 'rim esquerdo de dimensões normais para a idade, com relação córtico-medular preservada e sem dilatação do sistema coletor', [
    { id: 'rim_e_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'sfu_e', label: 'Dilatação (SFU)', kind: 'select', options: SFU, alwaysShow: true },
  ]),
  compartimento('adrenais', 'Adrenais', 'adrenais sem massas ou hemorragia'),
  orgao('bexiga', 'Bexiga', 'bexiga de paredes finas e regulares, com conteúdo anecoico', [
    { id: 'bexiga_parede', label: 'Espessura da parede', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 3 mm (repleta)' },
  ]),
  compartimento('retroperitonio', 'Retroperitônio e Grandes Vasos', 'aorta e veia cava inferior de calibre normal; sem linfonodomegalias'),
  achados('cavidade', 'Cavidade Abdominal e Pélvica', 'Achado', [
    { id: 'tipo', label: 'Tipo', kind: 'select', options: ['líquido livre', 'coleção', 'linfonodomegalia', 'invaginação intestinal', 'espessamento de alça', 'massa'] },
    { id: 'local', label: 'Localização', kind: 'text' },
    { id: 'dims', label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide' },
    { id: 'desc_achado', label: 'Descrição', kind: 'text', fullWidth: true },
  ], { normalText: 'ausência de líquido livre, coleções, linfonodomegalias ou massas', addLabel: 'Adicionar achado' }),
  {
    id: 'piloro',
    label: 'Piloro',
    normalable: true,
    normalText: 'piloro de espessura muscular e canal normais, sem sinais de estenose hipertrófica',
    fields: [
      { id: 'piloro_musculo', label: 'Espessura muscular', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 4 mm', hint: 'EHP exige AMBOS: músculo ≥ 4 mm E canal ≥ 17 mm (auto)' },
      { id: 'piloro_canal', label: 'Comprimento do canal', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 17 mm' },
    ],
  },
  {
    id: 'apendice',
    label: 'Apêndice / Fossa Ilíaca Direita',
    normalable: true,
    normalText: 'apêndice não visualizado, sem líquido livre ou borramento da gordura na fossa ilíaca direita',
    fields: [
      { id: 'apendice_diam', label: 'Diâmetro transverso', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 6 mm', hint: '> 6 mm = sugestivo de apendicite (auto)' },
      { id: 'apendice_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'não compressível, apendicolito, borramento da gordura, coleção' },
    ],
  },
];

// ────────────────────── RINS E VIAS URINÁRIAS PEDIÁTRICO ──────────────────────

const RINS_PEDIATRICO = (): StructuredSection[] => [
  orgao('rim-direito', 'Rim Direito', 'rim direito tópico, de dimensões normais para a idade, com espessura parenquimatosa e diferenciação córtico-medular preservadas', [
    { id: 'rim_d_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm', alwaysShow: true, hint: 'comparar com a curva por idade/altura' },
    { id: 'rim_d_parenquima', label: 'Espessura parenquimatosa', kind: 'measure', unit: 'mm', alwaysShow: true },
  ]),
  orgao('rim-esquerdo', 'Rim Esquerdo', 'rim esquerdo tópico, de dimensões normais para a idade, com espessura parenquimatosa e diferenciação córtico-medular preservadas', [
    { id: 'rim_e_eixo', label: 'Maior eixo', kind: 'measure', unit: 'cm', alwaysShow: true },
    { id: 'rim_e_parenquima', label: 'Espessura parenquimatosa', kind: 'measure', unit: 'mm', alwaysShow: true },
  ]),
  {
    id: 'sistema-coletor',
    label: 'Sistema Coletor',
    normalable: true,
    normalText: 'sistemas coletores não dilatados bilateralmente',
    fields: [
      // o DAP da pelve renal é o que gradua a hidronefrose na classificação SFU
      { id: 'dap_d', label: 'DAP da pelve — direito', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 7 mm (pós-natal)', hint: 'diâmetro ântero-posterior da pelve renal' },
      { id: 'sfu_d', label: 'Grau (SFU) — direito', kind: 'select', options: SFU, alwaysShow: true },
      { id: 'dap_e', label: 'DAP da pelve — esquerdo', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '< 7 mm (pós-natal)' },
      { id: 'sfu_e', label: 'Grau (SFU) — esquerdo', kind: 'select', options: SFU, alwaysShow: true },
      { id: 'coletor_desc', label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'duplicidade, ureterocele, cálculo' },
    ],
  },
  compartimento('ureteres', 'Ureteres', 'ureteres não visualizados/não dilatados', [
    { id: 'ureter_calibre', label: 'Maior calibre', kind: 'measure', unit: 'mm', hint: 'megaureter se > 7 mm' },
  ]),
  orgao('bexiga', 'Bexiga Urinária', 'bexiga de paredes finas e regulares, com conteúdo anecoico e sem lesões', [
    { id: 'bexiga_parede', label: 'Espessura da parede', kind: 'measure', unit: 'mm', alwaysShow: true, normal: '≤ 3 mm (repleta)' },
    { id: 'vrpm', label: 'Resíduo pós-miccional', kind: 'measure', unit: 'ml', alwaysShow: true },
  ]),
  {
    id: 'doppler',
    label: 'Estudo Doppler',
    normalable: true,
    normalText: 'jatos ureterais presentes e simétricos; vascularização renal preservada bilateralmente',
    fields: [
      { id: 'jatos', label: 'Jatos ureterais', kind: 'select', options: ['presentes e simétricos', 'assimétricos', 'ausentes'], alwaysShow: true },
      { id: 'ir_d', label: 'IR intraparenquimatoso D', kind: 'measure', calcId: 'vascular-ratios', normal: '< 0,70' },
      { id: 'ir_e', label: 'IR intraparenquimatoso E', kind: 'measure', calcId: 'vascular-ratios', normal: '< 0,70' },
    ],
  },
];

// ────────────────────────── QUADRIL PEDIÁTRICO (DDQ) ──────────────────────────

/**
 * Quadril pelo método de Graf. `alfa_{d,e}`/`beta_{d,e}` são canônicos e
 * disparam o tipo de Graf automático (alerta se α < 60°).
 */
const QUADRIL_GRAF = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `quadril-${side}`,
  label,
  normalable: true,
  normalText: 'quadril tipo I de Graf (maduro), com cobertura acetabular adequada da cabeça femoral',
  fields: [
    { id: `alfa_${side}`, label: 'Ângulo α', kind: 'measure', unit: '°', alwaysShow: true, normal: '≥ 60°', hint: 'teto ósseo — I: ≥ 60° · IIa/b: 50–59° · IIc/D: 43–49° · III/IV: < 43°' },
    { id: `beta_${side}`, label: 'Ângulo β', kind: 'measure', unit: '°', alwaysShow: true, normal: '< 55°', hint: 'teto cartilaginoso' },
    { id: `cobertura_${side}`, label: 'Cobertura da cabeça femoral', kind: 'measure', unit: '%', alwaysShow: true, normal: '> 50%' },
    { id: `desc_quadril_${side}`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'labrum, teto ósseo, posição da cabeça femoral' },
  ],
});

const QUADRIL_PEDIATRICO = (): StructuredSection[] => [
  QUADRIL_GRAF('d', 'Quadril Direito (Método de Graf)'),
  QUADRIL_GRAF('e', 'Quadril Esquerdo (Método de Graf)'),
  {
    id: 'estabilidade',
    label: 'Estabilidade (Manobras Dinâmicas)',
    normalable: true,
    normalText: 'quadris estáveis às manobras dinâmicas (Barlow e Ortolani negativos) bilateralmente',
    fields: [
      { id: 'barlow', label: 'Manobra de Barlow', kind: 'select', options: ['negativa', 'positiva à direita', 'positiva à esquerda', 'positiva bilateral'], alwaysShow: true, hint: 'luxa um quadril redutível' },
      { id: 'ortolani', label: 'Manobra de Ortolani', kind: 'select', options: ['negativa', 'positiva à direita', 'positiva à esquerda', 'positiva bilateral'], alwaysShow: true, hint: 'reduz um quadril luxado' },
      { id: 'estab_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
];

// ────────────────────────── ESCROTO AGUDO PEDIÁTRICO ──────────────────────────

const TESTICULO = (side: 'd' | 'e', label: string): StructuredSection => ({
  id: `testiculo-${side}`,
  label,
  normalable: true,
  normalText: 'testículo tópico, de dimensões e ecotextura normais para a idade, com contornos regulares',
  fields: [
    { id: `test_${side}_dims`, label: 'Dimensões', kind: 'triplet', unit: 'cm', calcId: 'volume-elipsoide', alwaysShow: true },
    { id: `test_${side}_desc`, label: 'Achados', kind: 'text', fullWidth: true, placeholder: 'heterogeneidade (sofrimento isquêmico), aumento de volume, lesão focal' },
  ],
});

const ESCROTO_PEDIATRICO = (): StructuredSection[] => [
  TESTICULO('d', 'Testículo Direito'),
  TESTICULO('e', 'Testículo Esquerdo'),
  compartimento('epididimos', 'Epidídimos', 'epidídimos de dimensões e ecotextura normais bilateralmente', [
    { id: 'epididimo_cabeca', label: 'Cabeça do epidídimo (maior)', kind: 'measure', unit: 'mm', hint: 'epididimite: aumento + hiperemia' },
  ]),
  compartimento('apendices', 'Apêndices Testiculares/Epididimários', 'apêndices testiculares e epididimários sem sinais de torção', [
    { id: 'apendice_torcao', label: 'Torção de apêndice', kind: 'select', options: ['ausente', 'suspeita', 'presente'], hint: 'nódulo avascular no polo superior — principal diferencial da torção testicular' },
  ]),
  compartimento('tunicas', 'Túnicas e Parede Escrotal', 'túnicas sem coleções; parede escrotal de espessura normal', [
    { id: 'hidrocele', label: 'Hidrocele', kind: 'select', options: ['ausente', 'pequena', 'moderada', 'volumosa'] },
    { id: 'parede_escrotal', label: 'Espessamento da parede', kind: 'select', options: ['ausente', 'presente'] },
  ]),
  {
    id: 'doppler',
    label: 'Estudo Doppler',
    normalable: true,
    normalText: 'fluxo intratesticular presente e simétrico bilateralmente, sem sinais de torção',
    fields: [
      // a assimetria de fluxo é o achado que define a emergência
      { id: 'fluxo_test_d', label: 'Fluxo intratesticular D', kind: 'select', options: ['presente e simétrico', 'reduzido', 'ausente'], alwaysShow: true, hint: 'ausente = torção até prova em contrário (emergência cirúrgica)' },
      { id: 'fluxo_test_e', label: 'Fluxo intratesticular E', kind: 'select', options: ['presente e simétrico', 'reduzido', 'ausente'], alwaysShow: true },
      { id: 'whirlpool', label: 'Sinal do redemoinho (whirlpool)', kind: 'select', options: ['ausente', 'presente'], hint: 'torção do cordão espermático' },
      { id: 'doppler_escroto_desc', label: 'Achados', kind: 'text', fullWidth: true },
    ],
  },
];

// ─────────────────────────────── Registro ───────────────────────────────

export const PEDIATRIA_SCHEMAS: StandardSchemaDef[] = [
  // mais específicos primeiro (a 1ª regex que casar vence)
  { name: 'QUADRIL PEDIÁTRICO (DDQ)', match: /quadril/, sections: QUADRIL_PEDIATRICO },
  { name: 'TRANSFONTANELAR', match: /transfontanelar/, sections: TRANSFONTANELAR },
  { name: 'COLUNA LOMBOSSACRA', match: /coluna/, sections: COLUNA_LOMBOSSACRA },
  { name: 'ESCROTO AGUDO PEDIÁTRICO', match: /escroto/, sections: ESCROTO_PEDIATRICO },
  { name: 'RINS E VIAS URINÁRIAS PEDIÁTRICO', match: /rins e vias/, sections: RINS_PEDIATRICO },
  { name: 'ABDOME TOTAL PEDIÁTRICO', match: /abdome/, sections: ABDOME_PEDIATRICO },
];
