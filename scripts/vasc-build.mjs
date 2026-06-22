import { readFileSync, writeFileSync } from 'fs';

// ── Source priority: phase4 > phase3 > phase2 > phase1 > base ───────────
const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
let ph1 = []; try { ph1 = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8')); } catch {}
let ph2 = []; try { ph2 = JSON.parse(readFileSync('scripts/phase2-templates.json', 'utf8')); } catch {}
let ph3 = []; try { ph3 = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}
let ph4 = []; try { ph4 = JSON.parse(readFileSync('scripts/phase4-templates.json', 'utf8')); } catch {}

const ph1Map = Object.fromEntries(ph1.map(t => [t.id, t]));
const ph2Map = Object.fromEntries(ph2.map(t => [t.id, t]));
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));
const ph4Map = Object.fromEntries(ph4.map(t => [t.id, t]));

function getLatest(id) {
  if (ph4Map[id]?.aiInstructions) return ph4Map[id].aiInstructions;
  if (ph3Map[id]?.aiInstructions) return ph3Map[id].aiInstructions;
  if (ph2Map[id]?.aiInstructions) return ph2Map[id].aiInstructions;
  if (ph1Map[id]?.aiInstructions) return ph1Map[id].aiInstructions;
  return base.find(t => t.id === id)?.aiInstructions || '';
}

// ── Vascular template IDs ─────────────────────────────────────────────────
const IDS = {
  CAROTIDAS:  '8sbK1BuPuPy8xzAm9DNz',  // DOPPLER CARÓTIDAS E VERTEBRAIS  18558 (ph2)
  OFTALMICAS: 'CieXNLc1BLzDUnEiIaoC',  // DOPPLER ARTÉRIAS OFTÁLMICAS     16647 (ph2)
  AORTO_IL:   'aTkVQCrPNUgpq89dDcPS',  // DOPPLER AORTO-ILÍACO            16007 (ph2)
  AO_TORACICA:'vascular-aorta-toracica',// AORTA TORÁCICA                  14842 (ph4)
  ART_MMII:   'vXAO9wOokphmh6xg6Eui',  // DOPPLER ARTERIAL MMII           16444 (ph2)
  ART_MMSS:   'Ml3A5Jz8uR8L2DtUMEwQ',  // DOPPLER ARTERIAL MMSS           17225 (ph2)
  VEN_MMII:   'ajAFJHKswvhrbEvDDM1y',  // DOPPLER VENOSO MMII             17202 (ph2)
  VEN_MMSS:   'nEOVai6ao1O7OMUp2MqF',  // DOPPLER VENOSO MMSS              7309 (base — sem ph2!)
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: DOPPLER VENOSO MMSS (7309 → 18k+) ────────────────────────
// Este template foi ignorado nas fases 1-3. Expansão completa aqui.
templates.VEN_MMSS.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — DOPPLER VENOSO DE MEMBRO SUPERIOR

### 5. PROTOCOLO SISTEMÁTICO DE AVALIAÇÃO
─────────────────────────────────────────────────────────────
POSICIONAMENTO:
  Decúbito dorsal; braço em abdução 45–90°; cabeça levemente rodada
  para o lado oposto. Avaliar em posição sentada quando necessário
  (permite melhor visualização da subclávia).

SEQUÊNCIA DE AVALIAÇÃO (proximal → distal):
  Veia subclávia (VS)  → Veia axilar (VAx) → Veia braquial (VBr)
  → Veias radial (VR) e ulnar (VU) → Veia basílica (VBase)
  → Veia cefálica (VCef).

TÉCNICA DE COMPRESSÃO:
  Comprimir perpendicularmente veia por veia (sondas 7–15 MHz).
  COMPRESSÍVEL → normal. INCOMPRESSÍVEL → TVP.
  A subclávia não é diretamente compressível (sob a clavícula):
  avaliar por Doppler colorido + espectral + augmentation distal.

CRITÉRIOS DIAGNÓSTICOS DIRETOS E INDIRETOS:
  DIRETO: incompressibilidade + trombo ecogênico na luz.
  INDIRETO subclávia: ausência de fluxo espontâneo; ausência de
    variação respiratória; augmentation ausente ao apertar o braço.
  Trombo recente: anecoico/hipoecóico. Organizado: hiperecóico.

### 6. VEIA SUBCLÁVIA — AVALIAÇÃO DETALHADA
─────────────────────────────────────────────────────────────
JANELAS DE ACESSO:
  Infraclavicular: transdutor na fossa infraclavicular, apontando
    superiormente — melhor janela para segmento medial.
  Supraclavicular: abordagem pela fossa supraclavicular para
    confluência subclávia-jugular (ângulo venoso de Pirogov).

FLUXO NORMAL:
  Contínuo (não pulsátil) com variação respiratória bifásica:
  aumenta na expiração, reduz na inspiração (diferente dos MMII).
  Pulsatilidade moderada = transmissão das câmaras direitas (normal).
  Ausência de variação respiratória = obstrução central (VCS, mediastino).

TROMBO SUBCLÁVIA:
  Não compressível ao Doppler (acesso limitado pela clavícula).
  Trombo visível: hipo/anecoico no segmento acessível.
  Ausência de sinal colorido no segmento afetado.
  Circulação colateral: veias peitoral e escapular hipervascularizadas.

TVP SUBCLÁVIA → ATIVAR R6:
  "ALERTA TVP: trombose de veia subclávia [D/E]. Risco de tromboembolia
  pulmonar equiparável à TVP proximal de MMII. Anticoagulação imediata
  + avaliação hematologista/vascular."

### 7. TROMBOSE VENOSA PROFUNDA DOS MMSS — CLASSIFICAÇÃO
─────────────────────────────────────────────────────────────
PRIMÁRIA (Síndrome de Paget-Schroetter):
  Trombose de esforço — esforço intenso do MMSS dominante.
  Mecanismo: compressão extrínsecan na saída torácica (1ª costela +
    músculo subclávio + costela cervical acessória).
  Perfil: jovem, atleta (natação, arremessadores, levantamento de peso).
  US: trombo na subclávia/axilar + ausência de causa central identificável.
  Conduta: anticoagulação + descompressão cirúrgica da saída torácica
    (ressecção da 1ª costela). → N3 → vascular.

SECUNDÁRIA (mais comum):
  Cateter venoso central (CVC), PICC, marca-passo, quimioterapia.
  Trombo perilesional ao redor do cateter (trombo de manga = sleeve thrombus).
  Sleeve thrombus ao redor de PICC/CVC: trombo tubular aderido ao cateter.
  Conduta: manter ou retirar cateter? Avaliar: cateter ainda necessário,
    risco-benefício de retirada (fragmentação do trombo).
  → Sempre anticoagular se TVP subclávia/axilar secundária.

SÍNDROME DA COMPRESSÃO DA SAÍDA TORÁCICA (TOS):
  Compressão vascular (artéria ou veia subclávia) ou nervosa (plexo braquial).
  US: comprimir subclávia durante elevação do braço (posição ROOS/AER test).
  Diminuição/ausência do fluxo ao elevar braço = TOS vascular positivo.
  → N3 → vascular (radiografia de tórax + RM/angio-TC para confirmar).

### 8. SÍNDROME DA VEIA CAVA SUPERIOR (VCS)
─────────────────────────────────────────────────────────────
CONTEXTO: neoplasia mediastinal (carcinoma de pulmão pequenas células,
  linfoma), fibrose mediastinal, trombose de VCS por cateter.

ACHADOS AO DOPPLER MMSS:
  Ausência de variação respiratória BILATERAL nas veias subclávias.
  Fluxo contínuo, não pulsátil, sem modulação respiratória.
  Dilatação das veias braquiocefálicas e jugulares.
  Circulação colateral torácica (veias subcutâneas alargadas).

→ ATIVAR N4: "Achados compatíveis com obstrução de veia cava superior.
  Avaliação oncológica/cirúrgica torácica urgente + TC de tórax."

### 9. PATOLOGIAS DA FÍSTULA ARTERIOVENOSA (FAV) — HEMODIÁLISE
─────────────────────────────────────────────────────────────
AVALIAÇÃO PRÉ-OPERATÓRIA (mapeamento para criação de FAV):
  Artéria radial: VPS >20 cm/s, calibre ≥2,0 mm (ideal ≥2,5 mm).
  Veia cefálica no punho: calibre ≥2,5 mm (ideal ≥3,0 mm) + distensão
    com torniquete. Profundidade <6 mm (ideal <4 mm para punção).
  Documentar bilateralmente: dominância + história de punção venosa prévia.

AVALIAÇÃO PÓS-OPERATÓRIA — MATURAÇÃO:
  Fluxo ideal para maturação: >500–600 mL/min na FAV.
  Veia eferente: diâmetro ≥6 mm + profundidade <6 mm = maturada.
  Artéria radial: VPS aumentada + baixa resistência (IR <0,6) = boa.
  PD na veia eferente ao longo do trajeto: confirma pervidade.

COMPLICAÇÕES DA FAV:
  Estenose juxta-anastomótica: local mais frequente.
    Critério: aumento de VPS >3× em relação ao segmento proximal.
  Estenose da veia eferente: aumento local de VPS ± trombo mural.
  Trombose da FAV: ausência de fluxo na anastomose + veia sem Doppler.
    → ATIVAR N4 — nefrologista + vascular (trombectomia/trombólise <24h).
  Pseudoaneurisma pós-punção: saco com fluxo yin-yang ao PD; colo medido.
    Conduta: compressão guiada por US ou injeção de trombina ecoguiada.
    Complicação: rotura ou infecção do pseudoaneurisma → R6.
  Síndrome do roubo (steal): isquemia digital ipsilateral.
    US: fluxo retrógrado na artéria radial distal à anastomose.
    → N4 → cirurgia vascular (DRIL ou banding).
  Hipertensão venosa: edema de MMSS + circulação colateral.
    Causa: estenose venosa central (subclávia/cefálica proximal).
    → Venografia/angioplastia transluminal percutânea (ATP).

### 10. VEIAS SUPERFICIAIS DOS MMSS — AVALIAÇÃO COMPLEMENTAR
─────────────────────────────────────────────────────────────
VEIA CEFÁLICA:
  Trajeto: antebraço lateral → braço lateral → triângulo deltopeitoral.
  Relevante para: FAV rádio-cefálica, PICC cefálico, stripping.

VEIA BASÍLICA:
  Trajeto: face medial do antebraço → braço medial → perfura fáscia na
    altura do sulco bicipital → veia braquial.
  FAV de transposição basílica: mapear calibre e profundidade.
  Ideal: ≥3,5 mm + profundidade >6 mm (candidata a transposição).

PICC (Peripherally Inserted Central Catheter):
  Inserção habitual na basílica ou braquial.
  Ponta no terço distal da VCS / junção cavo-atrial (ideal).
  Complicação: trombose do vaso de acesso ao redor do PICC.
  Relatar: pervidade do vaso, presença de manga trombótica, calibre.

### 11. CONDIÇÕES AGUDAS NOS MMSS — Gatilhos R6
─────────────────────────────────────────────────────────────
  ┌───────────────────────────────────┬─────────────────────────────────────┐
  │ CONDIÇÃO                          │ AÇÃO                                │
  ├───────────────────────────────────┼─────────────────────────────────────┤
  │ TVP subclávia/axilar              │ Anticoag. imediata → R6             │
  │ TVP braquial sintomática          │ Anticoagulação → R6                 │
  │ Trombose da FAV                   │ Trombectomia urgente → N4           │
  │ Síndrome da VCS                   │ TC tórax + oncologia → N4           │
  │ Pseudoaneurisma roto da FAV       │ Cirurgia vascular → R6              │
  │ Isquemia de mão (steal grave)     │ Cirurgia vascular → R6              │
  │ TOS vascular sintomático          │ Vascular → N3                       │
  └───────────────────────────────────┴─────────────────────────────────────┘

### 12. FRASEOLOGIA PADRÃO — MMSS VENOSO
─────────────────────────────────────────────────────────────
Estudo normal:
  "Veias subclávia, axilar e braquial [D/E] pérvias, compressíveis e
  com fluxo espontâneo de padrão normal ao estudo Doppler. Veias
  basílica e cefálica sem alterações."

TVP subclávia confirmada:
  "ALERTA TVP: veia subclávia [D/E] incompressível, com trombo [oclusivo/
  não oclusivo] de ecogenicidade [anecóica/hipoecóica/hiperecóica].
  Extensão estimada: [X] cm. Avaliação médica imediata e anticoagulação."

FAV maturada:
  "Fístula arteriovenosa [rádio-cefálica/braquio-basílica] [D/E] pérvia,
  com boa maturação. Veia eferente: [X] mm de diâmetro a [X] mm de
  profundidade. Padrão de fluxo arterializado adequado."

FAV com estenose:
  "Estenose venosa [juxta-anastomótica/segmentar] com aumento de VPS >3×
  no ponto de estenose. Indicação de avaliação angiográfica para ATP."`;

// ── EXPANSÃO 2: AORTA TORÁCICA (14842 → 18k+) ────────────────────────────
templates.AO_TORACICA.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — AORTA TORÁCICA AVANÇADO

### 8. DISSECÇÃO AÓRTICA — PROTOCOLO DETALHADO
─────────────────────────────────────────────────────────────
CLASSIFICAÇÃO STANFORD:
  Tipo A: envolve aorta ascendente (± descendente).
    → Cirurgia cardíaca de emergência. ATIVAR R6 MÁXIMO.
  Tipo B: apenas aorta descendente.
    → Tratamento endovascular (TEVAR) ou clínico conforme complicação.

CLASSIFICAÇÃO DEBAKEY:
  Tipo I: ascendente + arco + descendente.
  Tipo II: ascendente isolada (≡ Stanford A).
  Tipo III: descendente torácica (IIIa) ou toraco-abdominal (IIIb) (≡ Stanford B).

ACHADOS AO ECOCARDIOGRAMA TRANSTORÁCICO (ETT):
  Flap intimal: membrana linear hipoecoica móvel dividindo a aorta.
  Lúmen verdadeiro: menor, comprime em sístole, expansão sistólica.
  Lúmen falso: maior, trombo frequente, expansão diastólica (paradoxal).
  Hematoma periaórtico: coleção anecoica ao redor da aorta (ruptura contida).
  Derrame pericárdico: tamponamento = complicação de dissecção tipo A → cirurgia emergência.
  Insuficiência aórtica aguda: dissecção comprometendo raiz aórtica.

HEMATOMA INTRAMURAL (HIM):
  Espessamento circunferencial ou em crescente da parede aórtica (>5 mm),
  sem flap intimal visível, sem comunicação com a luz.
  Precursor de dissecção ou úlcera aterosclerótica penetrante.
  HIM na ascendente = Stanford A → cirurgia.
  HIM na descendente = Stanford B → TEVAR ou vigilância.

ÚLCERA ATEROSCLERÓTICA PENETRANTE (UAP):
  Ulceração da placa aterosclerótica penetrando a média/adventícia.
  Cráter com contornos irregulares na parede aórtica.
  Pode evoluir para HIM ou pseudoaneurisma → sempre N3/N4.

### 9. SÍNDROMES AÓRTICAS AGUDAS — Triagem de Urgência
─────────────────────────────────────────────────────────────
CRITÉRIOS DE ATIVAÇÃO R6 (qualquer um):
  • Dissecção aórtica tipo A (ascendente envolvida)
  • Dissecção tipo B complicada:
    isquemia de órgão, expansão rápida, dor refratária, ruptura
  • HIM na aorta ascendente
  • Aneurisma torácico com sinais de ruptura (hemopericárdio, hemotórax)
  • Aneurisma da raiz aórtica ≥5,5 cm com dor torácica aguda
  • UAP com sintomas (dor, hipotensão, síncope)

FRASEOLOGIA R6 — DISSECÇÃO TIPO A:
  "ALERTA URGÊNCIA MÁXIMA: achados compatíveis com dissecção aórtica
  tipo A (ascendente envolvida). Cirurgia cardíaca de emergência.
  Acionar cirurgia cardíaca + UTI imediatamente. TC-angiografia urgente."

FRASEOLOGIA R6 — DISSECÇÃO TIPO B:
  "Dissecção aórtica tipo B (descendente) — aguardando correlação clínica.
  Se sintomático: TEVAR emergencial; se estável: UTI + controle de PA
  + angioTC para planejamento endovascular."

### 10. SÍNDROMES GENÉTICAS E AORTOPATIAS
─────────────────────────────────────────────────────────────
SÍNDROME DE MARFAN:
  Raiz aórtica ectasiada (Zscore ≥2 ou diâmetro ≥4 cm em adulto).
  Raiz ≥4,5 cm ou crescimento >3 mm/ano → cirurgia preventiva.
  Relatar sempre o diâmetro no seio de Valsalva.

SÍNDROME DE LOEYS-DIETZ:
  Mais agressiva que Marfan. Limiar de cirurgia: raiz ≥4,5 cm
  (ou ≥4,0 cm em afetados com mutação TGFBR1/2).
  → Sempre referenciar para genética vascular.

VÁLVULA AÓRTICA BICÚSPIDE (VAB):
  Ectasia aórtica associada em 30–40% dos casos.
  Raiz ascendente >4,5 cm com VAB → cirurgia preventiva.
  Monitoramento anual com ETT/RM.

SÍNDROME DE TURNER:
  Aortopatia em 30%. Raiz ≥2,5 cm/m² de superfície corpórea = cirurgia.

### 11. AVALIAÇÃO PÓS-OPERATÓRIA E ENDOVASCULAR
─────────────────────────────────────────────────────────────
PÓS-CIRURGIA DE AORTA ASCENDENTE (Bentall, David, Yacoub):
  Tubo protético: artefato hiperecoico tubular. Anastomoses proximais
  e distais com pequenas coleções pericirúrgicas normais nos primeiros meses.
  Pseudoaneurisma anastomótico: saco pulsátil com fluxo ao PD → R6.
  Derrame pericárdico pós-op: pequeno é esperado. Tamponamento → R6.

PÓS-TEVAR (Endoprótese aorta torácica descendente):
  Endoprótese: estrutura hiperecoica tubular na descendente.
  Endoleak tipo I: fluxo periprotético proximal/distal (anastomose) → N4.
  Endoleak tipo II: fluxo por colaterais no saco aneurismático → vigilância.
  Endoleak tipo III: falha estrutural do dispositivo → N4.
  US tem limitação para TEVAR: TC-angiografia é padrão de controle.

### 12. TABELA DE DIÂMETROS NORMAIS — AORTA TORÁCICA
─────────────────────────────────────────────────────────────
  Segmento                    │ Normal (♂ adulto) │ Alerta       │ Cirurgia
  ────────────────────────────┼───────────────────┼──────────────┼───────────
  Anel aórtico                │ 2,0–2,6 cm        │ >2,6 cm      │ conforme contexto
  Seio de Valsalva (raiz)     │ 3,0–4,0 cm        │ >4,0 cm      │ ≥5,5 cm (≥4,5 cm Marfan)
  Aorta ascendente            │ 2,8–3,8 cm        │ >3,8 cm      │ ≥5,5 cm
  Arco aórtico                │ 2,5–3,5 cm        │ >3,5 cm      │ ≥6,0 cm
  Aorta descendente torácica  │ 2,0–2,8 cm        │ >2,8 cm      │ ≥6,0 cm
  Aorta descendente (♀)       │ 10% menor         │              │ Limiar 10% menor`;

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/vasc-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nVascular template sizes:');
const names = {
  CAROTIDAS:   'DOPPLER CARÓTIDAS E VERTEBRAIS   ',
  OFTALMICAS:  'DOPPLER ARTÉRIAS OFTÁLMICAS      ',
  AORTO_IL:    'DOPPLER AORTO-ILÍACO             ',
  AO_TORACICA: 'AORTA TORÁCICA                   ',
  ART_MMII:    'DOPPLER ARTERIAL MMII            ',
  ART_MMSS:    'DOPPLER ARTERIAL MMSS            ',
  VEN_MMII:    'DOPPLER VENOSO MMII              ',
  VEN_MMSS:    'DOPPLER VENOSO MMSS              ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
