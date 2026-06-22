import { readFileSync, writeFileSync } from 'fs';

const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
let ph1 = []; try { ph1 = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8')); } catch {}
let ph3 = []; try { ph3 = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}

const ph1Map = Object.fromEntries(ph1.map(t => [t.id, t]));
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));

function getLatest(id) {
  if (ph3Map[id]?.aiInstructions) return ph3Map[id].aiInstructions;
  if (ph1Map[id]?.aiInstructions) return ph1Map[id].aiInstructions;
  return base.find(t => t.id === id)?.aiInstructions || '';
}

const IDS = {
  INICIAL:   '3r76O3uzRFLSWQsLdwVX',  // OBSTÉTRICA INICIAL        13750
  OBS_DOP:   'Me4D9W0YCPNm4IL8aNR0',  // OBSTÉTRICA ABDOM c/ DOPPLER 13648
  CERVICO:   'B1ehwbQDCk6MUyQjA5aO',  // CERVICOMETRIA             16233
  ECO_FET:   'lMU67VSedtQajpH5t6M7',  // ECOCARDIOGRAMA FETAL      17033
  GEMELAR:   'Dn2dltlyR0EfkCR6ajuE',  // GEMELAR                   17348
  MORF_1T:   'd8KNSSbuGgc3NpLqMmXn',  // MORFOLÓGICA 1T            16672
  MORF_2T:   'FxSIs2Deay4aYyH5KiOi',  // MORFOLÓGICO 2T            17620
  NEURO:     'fuLw5Rs3ui4is8PtCZVu',  // NEUROSSONOGRAFIA FETAL    18308
  OBS_ABD:   '3wGk3zoYVVefVkkRhBXK',  // OBSTÉTRICA ABDOMINAL      18088
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: OBSTÉTRICA INICIAL ──────────────────────────────────
templates.INICIAL.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — ULTRASSONOGRAFIA OBSTÉTRICA INICIAL

### 7. AVALIAÇÃO DOPPLER NO 1T (opcional / quando indicado)
─────────────────────────────────────────────────────────────
ARTÉRIAS UTERINAS (11–13+6 semanas):
  Medida no istmo lateral, ao nível do OI.
  IP médio AUT: normal <2,35 (P95) em 11–13+6 sem.
  IP AUT elevado: preditor de pré-eclâmpsia precoce e CIR.
  Associar com PAPP-A, MAP e UtA-PI para cálculo de risco de PE
  (FMF Risk Calculator): risco ≥1:100 = profilaxia com AAS 150 mg/d até 36 sem.

DUCTO VENOSO (rastreio 1T):
  Onda "a" positiva: normal.
  Onda "a" ausente: risco aumentado cardiopatia/aneuploidia → ecocardiofetal.
  Onda "a" reversa: ATIVAR R6 → medicina fetal imediata.

FREQUÊNCIA CARDÍACA FETAL (ritmo):
  Normal 6+0 a 7+0: 90–110 bpm (ainda lento). Normal 9+0 a 13+6: 150–180 bpm.
  Bradicardia persistente <110 bpm ou taquicardia >200 bpm em QQ IG = R6.

═══════════════════════════════════════════════════════════════
### 8. AVALIAÇÃO DE MALFORMAÇÕES UTERINAS E PATOLOGIAS MATERNAS
─────────────────────────────────────────────────────────────
HEMATOMA SUBCORIÔNICO:
  Coleção anecoica/hipoecóica entre o córion frondoso e a parede uterina.
  Pequeno (<25% área do SG): prognóstico favorável; seguimento US em 2 semanas.
  Grande (≥25%): maior risco de aborto; N3/N4 → avaliação obstétrica.
  Com sangramento ativo: ATIVAR R6.

MIOMAS EM GESTAÇÃO:
  Registrar localização (FIGO), dimensões e relação com o polo inferior do SG.
  Mioma retroplacentário ou prévio (obstruindo saída): N3 → obstetrícia.
  Crescimento e amolecimento do mioma (degeneração) = dor pélvica esperada.

PATOLOGIAS OVÁRIO-ANEXIAIS:
  Cisto funcional <6 cm em 1T: ressecção esperada até 14–16 sem.
  Cisto persistente >6 cm ou com componente sólido: avaliar no 2T após 14 sem.
  Torção suspeita: R6 → cirurgia laparoscópica (segura até ~20 sem).
  Corpo lúteo: identif. ovário ipsilateral ao hematoma intrauterino normal.

═══════════════════════════════════════════════════════════════
### 9. DETERMINAÇÃO DE CORIONICIDADE E AMNIONICIDADE (GESTAÇÃO MÚLTIPLA)
─────────────────────────────────────────────────────────────
MELHOR JANELA: 10+0 a 13+6 semanas (alta acurácia).

GEMELAR DICORIÔNICA DIAMNIÓTICA (DC/DA):
  Dois sacos gestacionais separados OU sinal do Lambda (λ / delta sign):
  projeção em cunha de tecido placentário entre as membranas na placenta.
  Membrana espessa (≥2 mm). Duas placentas (quando identificáveis).

GEMELAR MONOCORIÔNICA DIAMNIÓTICA (MC/DA):
  Sinal do T (T-sign): membranas finas inserindo em ângulo reto na placenta.
  Membrana fina (<2 mm). Placenta única.
  ALERTA: MC/DA exige US quinzenal a partir de 16 sem (rastreio STFF).

GEMELAR MONOCORIÔNICA MONOAMNIÓTICA (MC/MA):
  Ausência de membrana divisória. Cordões entrelaçados. Placenta única.
  ATIVAR R6 → medicina fetal especializada imediatamente.

REGRA DE OURO: "A corionicidade definida no 1T é a definitiva.
  Se não determinada no 1T, registrar como indeterminada e referenciar para
  medicina fetal — NÃO estimar sem evidência direta."

═══════════════════════════════════════════════════════════════
### 10. CONDIÇÕES DE URGÊNCIA NO 1T E GESTAÇÃO INICIAL
─────────────────────────────────────────────────────────────
GESTAÇÃO NÃO VIÁVEL — CRITÉRIOS (Doubilet-SRU 2013):
  SG ≥25 mm + ausência de embrião (anel vazio) → aborto retido definitivo.
  CCN ≥7 mm + ausência de BCF → aborto retido definitivo.
  Crescimento zero em 2 sem (2 exames) → aborto retido definitivo.
  DIAGNÓSTICO PRECOCE (evitar falso positivo):
  SG 16–24 mm sem embrião → CONTROLE em 7–11 dias antes de confirmar.
  CCN 5–6 mm sem BCF → CONTROLE em 7 dias.
  FRASEOLOGIA: "ALERTA OBSTÉTRICO: achados compatíveis com aborto retido —
    avaliação ginecológica e obstétrica urgente para definição de conduta."

GESTAÇÃO ECTÓPICA:
  Útero vazio + saco gestacional extrauterino + β-hCG >1500 mUI/mL.
  Anel hiperecóico ("anel de fogo") com ou sem embrião tubário.
  FSD com líquido ecogênico (sangue = ruptura).
  ATIVAR R6 — "ALERTA OBSTÉTRICO: gestação ectópica suspeita — avaliação
    cirúrgica emergencial. Risco de ruptura e hemorragia."

DOENÇA TROFOBLÁSTICA GESTACIONAL (DTG):
  Mola hidatiforme completa: SG aumentado com conteúdo heterogêneo "tempestade
    de neve"; ausência de embrião; cistos tecaluteínicos ovarianos bilaterais.
  Mola parcial: embrião anormal + vesículas placentárias.
  β-hCG muito elevado para IG.
  → ATIVAR N4 → ginecologia/oncologia (esvaziamento uterino imediato + seguimento).`;

// ── EXPANSÃO 2: OBSTÉTRICA ABDOMINAL COM DOPPLER ─────────────────────
templates.OBS_DOP.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — DOPPLERFLUXOMETRIA OBSTÉTRICA AVANÇADA

### 8. PROTOCOLO DE ESTADIAMENTO CIR — BARCELONA (Figueras-Gratacós)
─────────────────────────────────────────────────────────────
ESTADIAMENTO COMPLETO COM INTERPRETAÇÃO CLÍNICA:

ESTADIO I — CIR INICIAL:
  EPF e/ou CA <P10; IP AU <P95; RCP ≥P5; AUT normal.
  Conduta: vigilância biométrica + Doppler em 2 semanas.
  Fraseologia: "Restrição de crescimento Estadio I (Barcelona). Vigilância
  biométrica e hemodinâmica intensificada. Seguimento perinatológico."

ESTADIO II — CIR COM COMPROMETIMENTO UMBILICAL:
  IP AU >P95 (resistência umbilical aumentada).
  Conduta: internação ou vigilância diária; corticoide se <34 sem; CTG.
  Fraseologia: "CIR Estadio II (Barcelona) — resistência umbilical aumentada.
  Avaliação perinatológica urgente para planejamento de via de parto."
  ATIVAR N4.

ESTADIO III — CIR CRÍTICO:
  Inversão de diástole umbilical (REDF) OU DV com onda "a" ausente/reversa
  OU RCP <P5.
  Conduta: internação imediata; consideração de parto.
  ATIVAR R6: "ALERTA OBSTÉTRICO: CIR Estadio III — internação urgente."

ESTADIO IV — CIR IMINENTE:
  DV onda "a" reversa + desacelerações espontâneas (CTG).
  Parto praticamente inevitável.
  ATIVAR R6: "ALERTA OBSTÉTRICO: CIR Estadio IV — parto imediato."

═══════════════════════════════════════════════════════════════
### 9. DOPPLER AVANÇADO — PARÂMETROS E REFERÊNCIAS NUMÉRICAS
─────────────────────────────────────────────────────────────
ARTÉRIA UMBILICAL (AU) — IP por IG (P50 / P95):
  24 sem: IP P50 = 0,98 / P95 = 1,22
  28 sem: IP P50 = 0,90 / P95 = 1,12
  32 sem: IP P50 = 0,82 / P95 = 1,02
  36 sem: IP P50 = 0,74 / P95 = 0,92
  40 sem: IP P50 = 0,66 / P95 = 0,84

ARTÉRIA CEREBRAL MÉDIA (ACM) — IP por IG:
  24 sem: IP P50 = 1,86 / P5 = 1,36
  28 sem: IP P50 = 1,96 / P5 = 1,42
  32 sem: IP P50 = 1,88 / P5 = 1,30
  36 sem: IP P50 = 1,72 / P5 = 1,14
  40 sem: IP P50 = 1,52 / P5 = 0,95
  IP ACM < P5 = vasodilatação cerebral = centralização.

PVS-ACM — Pico de Velocidade Sistólica (anemia fetal — Mari et al.):
  24 sem: 1,00 MoM = 25,5 cm/s. >1,50 MoM = >38,2 cm/s → R6.
  28 sem: 1,00 MoM = 30,7 cm/s. >1,50 MoM = >46,0 cm/s → R6.
  32 sem: 1,00 MoM = 36,9 cm/s. >1,50 MoM = >55,4 cm/s → R6.
  36 sem: 1,00 MoM = 43,8 cm/s. >1,50 MoM = >65,7 cm/s → R6.

DUCTO VENOSO (DV) — IP por IG:
  20–24 sem: IP P95 = 0,72. 28–34 sem: P95 = 0,60. >34 sem: P95 = 0,52.
  Onda "a" negativa (reversa) = insuficiência cardíaca direita fetal = R6.

ARTÉRIA UTERINA (AUT) — IP por IG:
  18–22 sem (rastreio PE): IP médio P95 = 1,44.
  24–26 sem: P95 = 1,25. 30–32 sem: P95 = 1,00. 36–38 sem: P95 = 0,85.

═══════════════════════════════════════════════════════════════
### 10. ANEMIA FETAL — PROTOCOLO DE PVS-ACM
─────────────────────────────────────────────────────────────
INDICAÇÕES DE AVALIAÇÃO PVS-ACM:
  Incompatibilidade Rh (anti-D, anti-c, anti-Kell).
  Parvovírus B19 (hidropsia + anemia grave).
  Hemorragia feto-materna suspeita.
  TAPS em gemelar monocoriônica.
  Hemoglobinopatia materna grave.

INTERPRETAÇÃO:
  PVS-ACM <1,50 MoM: anemia improvável — controle conforme indicação.
  PVS-ACM 1,50–1,80 MoM: suspeita moderada → transfusão intrauterina (TIU)?
  PVS-ACM >1,80 MoM: anemia grave provável → ATIVAR R6 + medicina fetal.
  Hidrops fetal + PVS-ACM >1,50 MoM: anemia grave + insuficiência cardíaca → R6.

═══════════════════════════════════════════════════════════════
### 11. PRÉ-ECLÂMPSIA — RASTREIO E VIGILÂNCIA DOPPLER
─────────────────────────────────────────────────────────────
RASTREIO 1T (FMF — 11–13+6 sem): IP AUT + PAPP-A + MAP + PlGF.
  Risco ≥1:100 para PE precoce (<34 sem): AAS 150 mg até 36 sem (previne).

VIGILÂNCIA 2T/3T EM PACIENTES DE RISCO:
  IP AUT >P95 persistente após 24 sem: risco PE/CIR ainda elevado.
  Notch unilateral isolado após 24 sem: risco moderado.
  Notch bilateral após 24 sem: risco elevado (PE/CIR).
  IP AUT + IP AU elevados: "dupla alteração" = alto risco → N4.

DOPPLER NA PE INSTALADA:
  Avaliar AU + ACM + DV a cada 24–48h conforme gravidade.
  REDF umbilical em PE grave = parto urgente → R6.`;

// ── OUTPUT ─────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/mf-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nMedicina-Fetal template sizes:');
const names = {
  INICIAL: 'OBSTÉTRICA INICIAL          ',
  OBS_DOP: 'OBS. ABDOM COM DOPPLER      ',
  CERVICO: 'CERVICOMETRIA               ',
  ECO_FET: 'ECOCARDIOGRAMA FETAL        ',
  GEMELAR: 'GEMELAR                     ',
  MORF_1T: 'MORFOLÓGICA 1T              ',
  MORF_2T: 'MORFOLÓGICO 2T              ',
  NEURO:   'NEUROSSONOGRAFIA FETAL      ',
  OBS_ABD: 'OBSTÉTRICA ABDOMINAL        ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 14000 ? '[OK]' : n >= 12000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
