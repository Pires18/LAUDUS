import { readFileSync, writeFileSync } from 'fs';

const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
let ph3 = []; try { ph3 = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));
function getLatest(id) {
  return ph3Map[id]?.aiInstructions || base.find(t => t.id === id)?.aiInstructions || '';
}

const IDS = {
  TIREOID:    'pFfqNwK8NQsW9XxLSs5r',  // TIREÓIDE           14818
  TIREOID_D:  'bfgf28EuR3mI0KNclMXm',  // TIREÓIDE COM DOP   17521
  CERVICAL:   '629P0KzQrxWDgm7T9D4u',  // CERVICAL           15971
  CERVDOP:    'VWUxY7TQHHWsoSdgVyU9',  // CERVICAL COM DOP   16330
  BOLSA:      'PB8vYY180ovxx5TLWRD0',  // BOLSA ESCROTAL     17453
  BOLSA_D:    'VnSG0u9X35U4WedzLGUo',  // BOLSA ESCR c/ DOP  20557
  SALIVARES:  '1deRd6lTDDsSNZyAN3ID',  // GLÂNDULAS SALIV.   19607
  PARTES:     'w3qtOKVxT2KrAgNhDTyi',  // PARTES MOLES       18761
  INGUINAIS:  'gdCig7G4kmz9uclrs2oE',  // REGIÕES INGUINAIS  15540
  PAREDE:     'XRkeUcaKmWpfTLJyjqAi',  // PAREDE ABDOMINAL   20107
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: TIREÓIDE (14818 → 17k+) ────────────────────────────
templates.TIREOID.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — AVALIAÇÃO TIREOIDIANA APROFUNDADA

### 7. TIREOIDE PÓS-OPERATÓRIA E PÓS-ABLAÇÃO
─────────────────────────────────────────────────────────────
TIREOIDECTOMIA TOTAL: ausência de parênquima tireoidiano. Avaliar:
  Loja tireoidiana (topografia habitual): ausência de nódulos residuais ou recidiva.
  Linfonodos cervicais (cadeias II–VI): padrão morfológico benigno ou suspeito.
  Hematoma de loja: coleção hipoecóica pós-operatória imediata — seguimento.
  Seroma: coleção anecóica, sem PD interno; resolução espontânea esperada.

TIREOIDECTOMIA PARCIAL (hemitiroidectomia):
  Descrever o lobo remanescente (dimensões + volume + ecotextura).
  Nódulos no remanescente: aplicar TI-RADS rigoroso.
  Lobo remanescente atrófico (<4 cm³): normal após ressecção contralateral.

ABLAÇÃO POR RADIOFREQUÊNCIA (RFA) OU ETANOL (PEI):
  Área de ablação: zona hipoecoica/anecóica heterogênea no sítio tratado.
  Sem PD interno = sucesso técnico (necrose de coagulação).
  Nódulo viável residual: componente sólido com PD interno fora da zona de ablação.
  Seguimento: redução de ≥50% do volume em 6 meses = resposta adequada.

### 8. TIREOIDITE DE HASHIMOTO — CRITÉRIOS DETALHADOS E CONDUTA
─────────────────────────────────────────────────────────────
FASE INICIAL (hipertireoidismo de Hashimoto / hashitoxicose):
  Volume aumentado; parênquima hipoecóico; hipervascularização ao Doppler.
  Diferencial com Graves: TRAb positivo em Graves; TPO-Ab em Hashimoto.

FASE CRÔNICA ATIVA: parênquima difusamente heterogêneo com padrão micronodular;
  múltiplos nódulos hipoecoicos de 3–10 mm coalescentes (pseudonódulos).
  ATENÇÃO: pseudonódulo de Hashimoto vs. nódulo verdadeiro (TI-RADS).
  Pseudonódulo: sem cápsula, isoecoico ao parênquima circundante, sem PD focal.
  Nódulo verdadeiro: cápsula definida, ecotextura diferente do parênquima → TI-RADS.

FASE ATRÓFICA: volume reduzido (<4 cm³ total); parênquima hiperecóico e fibrótico;
  hipovascular ao Doppler. Hipotireoidismo clínico estabelecido.

RISCO DE NEOPLASIA em Hashimoto: ligeiramente aumentado para linfoma tireoidiano
  primário (MALT). Linfoma: massa hipoecoica expansiva em contexto de HT.
  → Toda massa sólida expansiva em Hashimoto crônico: PAAF urgente.

### 9. DIAGNÓSTICO DIFERENCIAL DO NÓDULO TIREOIDIANO
─────────────────────────────────────────────────────────────
NÓDULO COLÓIDE (TI-RADS 2):
  Aspecto espongiforme (>50% cistos) ou artefato "cauda de cometa" bilateral.
  Benigno — não necessita biópsia independente do tamanho.

NÓDULO FOLICULAR (TI-RADS 3–4):
  Sólido isoecóico ou hipoecóico com halo fino; margens regulares.
  NÃO diferenciar adenoma folicular de carcinoma folicular ao US (requer histologia).
  PAAF: geralmente Bethesda III–IV → necessita ressecção para diagnóstico definitivo.

CARCINOMA PAPILAR — US TÍPICO (TI-RADS 5):
  Muito hipoecóico (mais que músculos). Microfocos puntiformes (microcalcificações).
  Margens irregulares/lobuladas. Mais alto que largo. Extensão extra-tireoidiana.
  Linfonodos cervicais calcificados com necrose cística = metástase papilar.
  → PAAF + estadiamento cervical completo.

CARCINOMA ANAPLÁSICO: massa invasiva de crescimento rápido, heterogênea, calcificações
  grosseiras, extensão extra-tireoidiana agressiva, invasão de estruturas adjacentes.
  → ATIVAR N4 + N3 urgente: oncologia de cabeça e pescoço.

### 10. AVALIAÇÃO DA EXTENSÃO DO BÓCIO MULTINODULAR
─────────────────────────────────────────────────────────────
BÓCIO VOLUMINOSO: extensão retroesternal (mergulhante).
  US Cervical: descrever volume total, maior nódulo dominante (TI-RADS), relação
  com traqueia (compressão/desvio), veia jugular interna, carótida.
  Desvio traqueal: relatar em mm.
  Sinais de compressão: dispneia, disfagia → TC cervicotorácica + cirurgia.

NÓDULO DOMINANTE EM BMN: aplicar TI-RADS individual.
  Nódulo que cresceu em exame seriado: diferença ≥20% em 2 eixos = crescimento.
  → Reiniciar avaliação TI-RADS e considerar PAAF mesmo abaixo do limiar.`;

// ── EXPANSÃO 2: CERVICAL (15971 → 18k+) ─────────────────────────────
templates.CERVICAL.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — AVALIAÇÃO CERVICAL APROFUNDADA

### 7. MASSAS CERVICAIS — ALGORITMO DIAGNÓSTICO POR LOCALIZAÇÃO
─────────────────────────────────────────────────────────────
LINHA MÉDIA:
  Cisto do ducto tireoglosso: anecoico, move com deglutição/protrusão de língua;
    nível do osso hioide. Cirurgia de Sistrunk (hioide + cisto + trajeto).
  Bócio: avaliado no template específico de tireóide (Camada 3).
  Lipoma da linha média: hiperecóico, compressível, paralelo à pele.

REGIÃO LATERAL (triângulo anterior — entre ECM e linha média):
  Cisto branquial (2ª fenda — mais comum): anecoico, anteromedial ao ECM,
    lateral à ACI. Cisto de 1ª fenda: pré-auricular ou intraparotídeo.
    Cisto de 3ª fenda: pode fistulizar para seio piriforme.
  Adenomegalia: cadeia jugular interna (II–IV) — avaliar morfologia.
  Paraganglioma carotídeo (glomo): na bifurcação, afasta ACI de ACE,
    hipervascularizado, NÃO puncionar sem preparo (crise HAS).

REGIÃO LATERAL (triângulo posterior — posterior ao ECM):
  Higroma cístico (linfangioma): multilocular anecoico, paredes finas.
  Schwannoma / neurofibroma: ovoide, hipoecóico, ao longo de nervo.
  Adenomegalia: cadeia espinal acessória (V).
  Cisto de clivagem: pós-irradiação ou trauma.

REGIÃO SUBMANDIBULAR:
  Adenomegalia nível I: reacional (odontogênico) ou maligno.
  Ranula plungeante: lesão cística ao nível sublingual, extensão parafaríngea.
  Fibrose pós-irradiação: paredes cervicais espessadas, sem coleção.

### 8. DOPPLER EM MASSAS CERVICAIS (AVALIAÇÃO COMPLEMENTAR)
─────────────────────────────────────────────────────────────
LINFONODO BENIGNO: PD hilar (padrão central — de dentro para fora).
LINFONODO MALIGNO: PD periférico ou misto (caótico). Resistência variável.
ABSCESSO CERVICAL: PD periférico + conteúdo anecóico heterogêneo.
PARAGANGLIOMA: Doppler colorido exuberante (massa altamente vascular).
SCHWANNOMA: PD moderado interno regular ao longo do nervo.

### 9. AVALIAÇÃO DE ESTRUTURAS VASCULARES CERVICAIS (US B-MODE)
─────────────────────────────────────────────────────────────
VEIAS JUGULARES:
  VJI normal: calibre variável com respiração; colapsível.
  VJI trombosada (trombose de jugular): lúmen ecocogênico não compressível.
    Contexto: catéter venoso central, DIP cervical, neoplasia.
    → N4: anticoagulação + avaliação vascular.
  VJI dilatada (>15 mm): IC, obstrução mediastinal, SVC.
ARTÉRIA CARÓTIDA (B-mode): ateromatose, espessamento médio-intimal, placa.
  Para Doppler completo: template "CERVICAL COM DOPPLER" (Camada 3).

### 10. AVALIAÇÃO PÓS-OPERATÓRIA CERVICAL
─────────────────────────────────────────────────────────────
ESVAZIAMENTO CERVICAL (neck dissection):
  Avaliar sítios de dissecção: ausência de linfonodos residuais.
  Hematoma/seroma: coleção no leito cirúrgico (normal nas primeiras semanas).
  Recidiva tumoral: nódulo sólido com PD interno na cadeia dissecada.

PÓS-PAROTIDECTOMIA:
  Loja parotídea: ausência de parênquima (total) ou remanescente (parcial).
  Síndrome de Frey: sudorese auricular — diagnóstico clínico.
  Recidiva: nódulo na loja → PAAF urgente.

IMPLANTE DE PRÓTESE CERVICAL (cirurgia de coluna):
  Identificar material implantado (hiperecóico); avaliar tecido periprotético.`;

// ── EXPANSÃO 3: CERVICAL COM DOPPLER (16330 → 18.5k+) ───────────────
templates.CERVDOP.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — DOPPLER CAROTÍDEO AVANÇADO

### 7. PLACA ATEROSCLERÓTICA — CARACTERIZAÇÃO DETALHADA
─────────────────────────────────────────────────────────────
MORFOLOGIA DA PLACA (critérios AHA modificados):
  Tipo I: homogênea, predominantemente ecolucente (lipídica/hemorrágica — ALTO RISCO).
  Tipo II: predominantemente ecolucente com < 25% hiperecóico (RISCO ELEVADO).
  Tipo III: predominantemente hiperecóico com <25% ecolucente (fibroso/calcificado).
  Tipo IV: homogênea hiperecóica (calcificada — baixo risco de embolização).
  Mista (heterogênea): combinação — avaliar presença de ulceração.

ULCERAÇÃO DA PLACA: cratera ou irregularidade na superfície com fluxo no interior.
  Sinal Doppler: fluxo de recirculação dentro da escavação.
  Placa ulcerada + estenose moderada-alta = RISCO MUITO ELEVADO de AVC → N3 urgente.

CÁLCULO DE ESTENOSE (NASCET):
  Grau % = [(1 − diâmetro residual ACI / diâmetro ACI distal normal) × 100]
  VPS ACI >125 cm/s + relação ACI/ACC >2,0 = suspeita de ≥50%.
  VPS ACI >230 cm/s + relação ACI/ACC >4,0 = confirmação de ≥70%.

CRITÉRIOS VELOCIMÉTRICOS POR GRAU DE ESTENOSE (NASCET):
  <50%: VPS ACI <125 cm/s · ACI/ACC <2,0.
  50–69%: VPS ACI 125–229 cm/s · ACI/ACC 2,0–4,0.
  70–99%: VPS ACI ≥230 cm/s · ACI/ACC ≥4,0.
  Pseudo-oclusão (muito apertada): VPS pode ser baixo por baixo débito.
  Oclusão total: ausência de sinal em B-mode + Doppler.

### 8. ARTÉRIA VERTEBRAL — AVALIAÇÃO E PATOLOGIAS
─────────────────────────────────────────────────────────────
AVALIAÇÃO TÉCNICA: segmento V1 (subclávio→transversária C6), V2 (foraminal),
  V3 (atlas), V4 (intracraniano — não acessível ao US).
  Normal: fluxo anterógrado bilateral; diâmetro 2,5–4,5 mm.
  AV hipoplásica: diâmetro <2 mm com fluxo anterógrado — variante anatômica (30%).

SÍNDROME DE ROUBO DA SUBCLÁVIA:
  Estenose/oclusão pré-vertebral da subclávia esquerda (mais comum).
  Fluxo retrógrado na AV ipsilateral (roubo parcial: bifásico / total: invertido).
  Associado a: claudicação do membro superior ipsilateral, tontura, drop-attacks.
  Confirmar: VPS na subclávia bilateral (gradiente >20 mmHg → significativo).
  → N3: avaliação vascular para angioplastia/stent da subclávia.

DISSECÇÃO DE ARTÉRIA VERTEBRAL:
  Contexto: trauma cervical, manipulação quiropráxica, hiperextensão.
  US: irregular lúmen; flap intimal; hematoma intramural hipoecoico.
  ATIVAR R6 → TC-angiografia urgente + neurologia (AVC posterior).

### 9. PROTOCOLO DE VIGILÂNCIA PÓS-STENT E PÓS-CEA
─────────────────────────────────────────────────────────────
PÓS-CEA (endarterectomia carotídea):
  Controle 1 mês, 6 meses, 1 ano, anual.
  Limiar de restenose: VPS >200 cm/s → ≥50% (critério pós-CEA).
  Reestenose precoce (<2 anos): hiperplasia neointimal — recanalização.

PÓS-STENT CAROTÍDEO (CAS):
  Stent: artefato hiperecóico tubular no lúmen; Doppler: fluxo no interior.
  Critérios de estenose dentro do stent: VPS >300 cm/s → estenose >50%.
  Trombose de stent: ausência de sinal dentro do stent → R6.`;

// ── EXPANSÃO 4: REGIÕES INGUINAIS (15540 → 17.5k+) ──────────────────
templates.INGUINAIS.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — AVALIAÇÃO DE HÉRNIAS E REGIÃO INGUINAL

### 7. HÉRNIAS INGUINAIS — DIAGNÓSTICO DIFERENCIAL AVANÇADO
─────────────────────────────────────────────────────────────
HÉRNIA INGUINAL INDIRETA vs. DIRETA:
  Referência anatômica: vasos epigástricos inferiores (VEI) — identificados ao Doppler.
  INDIRETA: saco herniário LATERAL aos VEI → segue o canal inguinal.
    Trajeto: anel inguinal interno → canal → anel externo → bolsa escrotal (escrotal).
    Mais comum em homens jovens; congênita (persistência do processo vaginal).
  DIRETA: saco herniário MEDIAL aos VEI → pelo trígono de Hesselbach.
    Trajeto: direto pela fraqueza da fáscia transversalis.
    Mais comum em homens mais velhos; adquirida.
  DIFERENCIAÇÃO AO US: traçar trajeto em relação aos VEI ao Doppler colorido.

HÉRNIA FEMORAL:
  Canal femoral: medial à veia femoral, abaixo do ligamento inguinal.
  Mais frequente em mulheres. Risco elevado de encarceramento.
  Saco pequeno, profundo; pode ser difícil de visualizar.
  → QUALQUER hérnia femoral = avaliação cirúrgica (alto risco de estrangulamento).

HÉRNIA ESCROTAL (hérnia inguinoescrotal):
  Conteúdo intestinal ou epiplóico atingindo a bolsa escrotal.
  Diferenciar de hidrocele comunicante: Valsalva + mudança de decúbito.
  Alça intestinal: ecogênica, peristaltismo presente.

### 8. AVALIAÇÃO PÓS-HERNIORRAFIA
─────────────────────────────────────────────────────────────
TELA PROTÉTICA: estrutura linear/plana hiperecóica na região da reparação.
  Normal: plana, sem tensão, sem líquido ao redor.
  Seroma: coleção anecoica ao redor da tela (normal até 3 meses).
  Hematoma: coleção heterogênea. Infecção: coleção com debris + hipervascularização.
  Recidiva: saco herniário reaparecendo ao Valsalva no mesmo local.
  → Seroma volumoso sintomático: drenagem percutânea guiada por US.

NEURALGIA PÓS-HERNIORRAFIA:
  Nervos inguinais: ilio-inguinal, ilio-hipogástrico, genitofemoral.
  Neuroma ou encarceramento nervoso: nódulo hipoecóico no trajeto do nervo → N3.

### 9. LINFONODOS E OUTRAS MASSAS INGUINAIS
─────────────────────────────────────────────────────────────
LINFONODO INGUINAL (cadeia superficial):
  Normal: oval, <15 mm eixo longo, hilo preservado, cortical ≤3 mm.
  Reacional: bilateral, contexto infeccioso (MMII, genitália externa, períneo).
  Suspeito: >15 mm, arredondado, hilo ausente, PD periférico.
  → PAAF se suspeito sem causa evidente (linfoma inguinal, metástase).

CISTO DE NUCK (análogo feminino do processo vaginal):
  Mulheres: massa anecoica no canal inguinal (persistência do processo vaginal).
  Confundir com hérnia: teste de Valsalva (cisto não aumenta).
  Hérnia indistinguível: TC se dúvida.

ANEURISMA DE ARTÉRIA FEMORAL:
  Dilatação focal >1,5 cm da artéria femoral comum/superficial.
  PD: sinal de "yin-yang" em pseudoaneurisma. → N3/N4: cirurgia vascular.
  Pseudoaneurisma pós-cateterismo: colo + saco; compressão guiada por US
  (trombose do saco) ou injeção de trombina guiada por US.

### 10. CONDIÇÕES AGUDAS NA REGIÃO INGUINAL
─────────────────────────────────────────────────────────────
HÉRNIA ESTRANGULADA (protocolo de urgência):
  Alça sem peristaltismo (paralisia isquêmica).
  Ausência de PD na parede da alça (isquemia transmural).
  Líquido livre ao redor do saco (peritonite local).
  Edema progressivo da parede do saco.
  → ATIVAR R6: "ALERTA CIRÚRGICO: hérnia estrangulada com sinais de
    isquemia intestinal — cirurgia de emergência imediata."

LINFADENITE INFLAMATÓRIA AGUDA SUPURADA:
  Linfonodo aumentado, hipoecóico, com área central colecionada.
  Abscesso linfonodal: coleção com debris, PD periférico.
  → N4: drenagem cirúrgica + antibioticoterapia IV.`;

// ── OUTPUT ─────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/pp-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nPequenas-Partes template sizes:');
const names = {
  TIREOID:   'TIREÓIDE                   ',
  TIREOID_D: 'TIREÓIDE COM DOPPLER       ',
  CERVICAL:  'CERVICAL                   ',
  CERVDOP:   'CERVICAL COM DOPPLER       ',
  BOLSA:     'BOLSA ESCROTAL             ',
  BOLSA_D:   'BOLSA ESCROTAL COM DOPPLER ',
  SALIVARES: 'GLÂNDULAS SALIVARES        ',
  PARTES:    'PARTES MOLES               ',
  INGUINAIS: 'REGIÕES INGUINAIS          ',
  PAREDE:    'PAREDE ABDOMINAL           ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 16000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
