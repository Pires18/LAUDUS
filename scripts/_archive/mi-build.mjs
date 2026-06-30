/**
 * LAUD.IA — Medicina Interna — FINAL BUILD
 * 7 exames: ABDOME SUPERIOR, ABDOME SUP COM DOPPLER, ABDOME TOTAL,
 *           ABDOME TOTAL COM DOPPLER, PRÓSTATA VIA ABDOMINAL,
 *           RINS E VIAS URINÁRIAS, RINS E VIAS URINÁRIAS COM DOPPLER
 * Output: scripts/mi-templates.json
 */

import { readFileSync, writeFileSync } from 'fs';

const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
const p1   = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8'));
const p3   = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8'));

const getLatest = (id) => {
  return p3.find(x => x.id === id)
      || p1.find(x => x.id === id)
      || base.find(x => x.id === id);
};

// ────────────────────────────────────────────────────────────────────────────
// 1. ABDOME SUPERIOR
// ────────────────────────────────────────────────────────────────────────────
const abdomeSup = getLatest('AaHERv60sL5e2oKTGkjM');
abdomeSup.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — ABDOME SUPERIOR V2.0
═══════════════════════════════════════════════════════════════

A. SEGMENTAÇÃO HEPÁTICA DE COUINAUD — MAPA OBRIGATÓRIO
───────────────────────────────────────────────────────────────
A localização de lesões hepáticas DEVE ser reportada pelo segmento de Couinaud
(S1–S8) sempre que tecnicamente identificável:

  LOBO CAUDADO:
    S1: Lobo caudado (processo caudado + lobo de Spiegel). Posterior à VCI.
    Referência: entre veia hepática média e veia porta direita.

  LOBO ESQUERDO:
    S2: Superior lateral esquerdo (posterior à veia hepática esquerda).
    S3: Inferior lateral esquerdo (anterior à veia hepática esquerda).
    S4: Lobo quadrado — medial esquerdo.
      S4a: porção superior (segmento medial superior).
      S4b: porção inferior (segmento medial inferior).

  LOBO DIREITO:
    S5: Inferior anterior direito (abaixo da VH média, anterior ao PD direito).
    S6: Inferior posterior direito (abaixo da VH direita, posterior).
    S7: Superior posterior direito (acima da VH direita, posterior).
    S8: Superior anterior direito (acima da VH média, anterior ao PD direito).

  REFERÊNCIAS ANATÔMICAS US:
    Veia hepática direita: divide S5/S8 (anterior) de S6/S7 (posterior).
    Veia hepática média: divide lobo direito (S5/S8) de lobo medial esq (S4).
    Veia porta direita: divide segmentos superiores (S7/S8) de inferiores (S5/S6).
    Veia porta esquerda: divide S4 de S2/S3.

  FRASEOLOGIA OBRIGATÓRIA:
    "Nódulo hipoecoico de X mm no segmento [S5] do lobo direito..."
    "Cisto simples em S7, medindo X×X×X mm..."
    "Lesão focal heterogênea ocupando segmentos S6/S7 (X cm)..."

B. CLASSIFICAÇÃO DETALHADA DE LESÕES HEPÁTICAS FOCAIS
───────────────────────────────────────────────────────────────
CISTOS HEPÁTICOS SIMPLES:
  Critérios obrigatórios: anecoico, paredes imperceptíveis, reforço acústico posterior,
  ausência de septos, nódulos ou calcificações, sem fluxo ao Doppler.
  Conduta por tamanho: <4 cm = controle anual. 4–7 cm = controle 6 meses.
  >7 cm ou qualquer atipicidade = RM abdome para caracterização.

HEMANGIOMA HEPÁTICO:
  Típico (N1): hiperecogênico, homogêneo, bordas nítidas, <3 cm, sem halo hipoecoico.
  Atípico / grande (N2): >3 cm, heterogêneo, halo hipoecoico periférico, ou em cirrótico.
  Conduta: típico ≤3 cm = US 6–12 meses. Atípico ou >3 cm = RM dinâmica (Gd).

NÓDULO SÓLIDO INDETERMINADO (N3):
  Qualquer nódulo sólido hipoecoico com halo, heterogêneo, ou com fluxo interno ao PD.
  → RM abdome com contraste dinâmico (gadolínio) OBRIGATÓRIA.
  → Se cirrótico: classificar provisoriamente como LR-3 a LR-5 conforme morfologia.
  → Correlação: AFP, CEA, CA 19-9, CA-125 conforme clínica.

HEPATOCARCINOMA (CHC) — LI-RADS AO US:
  Indicação: paciente cirrótico OU portador de HBV crônico sem cirrose.
  Sem contraste, o US classifica como achado suspeito — não confirma CHC:
    LR-3 equiv.: nódulo novo/crescente <2 cm, sem característica diagnóstica.
    LR-4 equiv.: hipervascularizado OU washout suspeito ao CEUS.
    LR-5 equiv.: >2 cm em cirrótico + hipervascularizado ao Doppler PD.
    LR-M equiv.: lesão sugestiva de malignidade não-CHC (infiltrativo, heterogêneo).
  Relatar como: "Achado hepático focal em paciente cirrótico/HBV — classificação LI-RADS
  definitiva requer TC/RM com contraste (protocolo hepatobiliar). Sugerimos complementação
  com TC trifásica ou RM com hepatospecific contrast."
  → R6 se LR-5 equiv. em contexto de icterícia/hipertensão portal descompensada.

METÁSTASES HEPÁTICAS:
  Padrão em "alvo" (halo hipoecoico): metástases gastrointestinais, colorretais.
  Hiperecogênicas: cólon, carcinóide, HCC tratado.
  Hipoecoicas difusas: pâncreas, mama, pulmão.
  Calcificadas: cólon mucoso-secretor, ovário mucinoso.
  Cisticas: tumores mucinosos (ovário, cólon), carcinóide necrótico.
  → Se suspeita de metástase + neoplasia conhecida: N4 → R6.
  → Se suspeita sem primário identificado: N3 → TC tórax/abdome/pelve + PET-CT.

C. PROTOCOLO PANCREÁTICO AVANÇADO
───────────────────────────────────────────────────────────────
CLASSIFICAÇÃO DE LESÕES CÍSTICAS PANCREÁTICAS (ACR White Paper 2017):

PSEUDOCISTO:
  Cisto unilocular, paredes lisas, anecoico ou com debris, sem componente sólido.
  Contexto: pancreatite aguda ou crônica, trauma.
  Pode comunicar com ducto de Wirsung (verificar dilatação).
  Conduta: dreno espontâneo em 6 semanas se pós-pancreatite. Persistente: CPRM.

CISTOADENOMA SEROSO:
  Micro ou macrocístico. Múltiplos cistos pequenos (<2 cm) separados por finas septações.
  Aspecto em "favo de mel" ou "rosácea" central. Calcificação estrelada central (30%).
  Benigno na grande maioria. Cirurgia se sintomático ou >4 cm com crescimento.
  → Confirmar com TC/RM. Marcadores CEA líquido <5 ng/mL.

CISTO MUCOSO / CISTOADENOMA MUCINOSO (MCN):
  Mulher de meia-idade. Corpo/cauda pancreáticos. Macrocístico unilocular (>2 cm).
  Sem comunicação com Wirsung. Septos grosseiros. Nódulo mural = suspeita de malignidade.
  Pré-maligno — cirurgia se ≥4 cm ou crescimento ou nódulo mural ou sintomático.
  → CPRM + ecoendoscopia com aspiração de líquido (CEA >192 ng/mL = mucinoso).

IPMN (Intraductal Papillary Mucinous Neoplasm):
  Tipo ducto principal (MD-IPMN): Wirsung ≥5 mm difuso. ALTO RISCO de malignização.
    → Cirurgia independentemente de tamanho.
  Tipo ramos (BD-IPMN): cistos comunicando com Wirsung dilatado <5 mm.
    Estigmas preocupantes (AGA 2015): icterícia obstrutiva, nódulo mural intensificado,
    Wirsung ≥1 cm, atipia em citologia. → Cirurgia.
    Baixo risco (<3 cm, sem estigmas): CPRM a cada 6–12 meses.
  Tipo misto: combina MD e BD.

NEOPLASIA SÓLIDA PSEUDO-PAPÍLAR (Tumor de Frantz):
  Mulher jovem. Massa grande (>3 cm) mista sólido-cística, encapsulada.
  Periférica ao pâncreas. Sem calcificações grosseiras. PD interno.
  Benigna/borderline — cirurgia.

D. HEPATOMEGALIA — ABORDAGEM CLÍNICA INTEGRADA
───────────────────────────────────────────────────────────────
Definição: lobo direito >15 cm (♂) / >14 cm (♀) na linha médio-clavicular.

CAUSAS POR PADRÃO ECOGRÁFICO:
  Hiperecogênica difusa: esteatose (Grau II–III), depósito de glicogênio (Von Gierke).
  Hipoecoica difusa: linfoma, leucemia, hepatite aguda fulminante.
  Heterogênea nodular: cirrose avançada, metástases difusas, hepatite granulomatosa.
  Congestiva: fígado em "noz-moscada" — IC direita, pericardite constritiva.
    Padrão US: dilatação VCI + veias hepáticas + IVC sem colapso.
  Normal ao US mas hepatomegalia: doença de armazenamento, amiloidose.
    → RM ou biópsia.

Ação recomendada para hepatomegalia:
  Hepatomegalia + esteatose: correlação metabólica + enzimas hepáticas + glicemia.
  Hepatomegalia + lesão focal: TC/RM dinâmica.
  Hepatomegalia + HP: endoscopia + hepatologia.
  Hepatomegalia + IC suspeita: ecocardiograma + BNP.

E. GRANDES VASOS ABDOMINAIS — PROTOCOLO AMPLIADO
───────────────────────────────────────────────────────────────
AORTA ABDOMINAL:
  Medir: diâmetro AP e transversal no segmento infrarrenal (máximo).
  Normal: <3,0 cm. Ectasia: 2,5–2,9 cm. Aneurisma: ≥3,0 cm.
  Limiares de urgência: ≥5,5 cm ♂ (≥5,0 cm ♀) → R6.
  Crescimento >5 mm/6 meses → R6.
  Trombo mural: descrever extensão (circunferencial/excêntrico), luz verdadeira.
  Calcificações parietais: documentar.
  Bifurcação aorto-ilíaca: calibre das ilíacas primitivas (normal <1,5 cm).

VEIA CAVA INFERIOR (VCI):
  Calibre normal <2,1 cm em expiração. Colapso inspiratório >50%.
  VCI >2,1 cm sem colapso: suspeita de hipertensão venosa central (IC direita,
  tamponamento, pericardite constritiva, síndrome de Budd-Chiari).
  Trombo VCI: material ecogênico intraluminal → TC para estadiamento.

F. OBSERVAÇÕES METODOLÓGICAS EXPANDIDAS
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia de abdome superior é um método dinâmico e operador-dependente com
resolução espacial de 1–3 mm para lesões focais hepáticas com transdutor de alta frequência
(curvo 3,5–5 MHz). A avaliação pancreática é frequentemente limitada por interposição gasosa
intestinal em 20–40% dos pacientes — em casos de não visualização do corpo/cauda pancreática,
recomendar CPRM ou TC abdominal para avaliação completa. O fígado gorduroso (esteatose Grau II–III)
reduz a penetração do feixe ultrassonográfico, limitando a detecção de lesões focais em
parênquima profundo — a sensibilidade cai de 94% (fígado normal) para 65–75% em esteatose
acentuada. A classificação LI-RADS definitiva requer TC ou RM com contraste (protocolo
hepatobiliar); ao US, classificar apenas como "achado suspeito" e recomendar complementação
seccional. O diagnóstico histológico definitivo de qualquer lesão sólida ou cisto complexo
exige biópsia ou análise de conteúdo por ecoendoscopia — a US fornece informação morfológica,
não histológica. Pacientes com cirrose devem ser monitorados a cada 6 meses com US para
rastreio de CHC (sensibilidade 60–80%); em cirróticos Child B/C, sensibilidade da US cai
para ~50% — considerar TC ou RM semestral em alto risco. Os valores de referência de tamanho
de órgãos variam com sexo, biótipo e etnia — valores limítrofes devem ser sempre contextualizados
clinicamente.`;

// ────────────────────────────────────────────────────────────────────────────
// 2. ABDOME SUPERIOR COM DOPPLER
// ────────────────────────────────────────────────────────────────────────────
const abdomeSupDoppler = getLatest('gBDCKQfrk1vi8YBdzd3J');
abdomeSupDoppler.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — ABDOME SUPERIOR COM DOPPLER V2.0
═══════════════════════════════════════════════════════════════

A. HIPERTENSÃO PORTAL — PROTOCOLO DIAGNÓSTICO COMPLETO
───────────────────────────────────────────────────────────────
CRITÉRIOS PRIMÁRIOS (qualquer 1 = suspeita; ≥2 = diagnóstico provável):
  1. Veia porta principal >13 mm (hilo hepático, paciente em jejum ≥4h).
  2. Velocidade portal <12 cm/s ao Doppler espectral.
  3. Fluxo hepatofugal (reverso) na VP ou ramos segmentares.
  4. Esplenomegalia (>12 cm em adulto).
  5. Ascite (qualquer quantidade no exame).

COLATERAIS PORTOSSISTÊMICAS — IDENTIFICAR E REGISTRAR:
  Veia para-umbilical (ligamento falciforme): repermeabilizada e pulsátil — mais específica.
    Diâmetro >3 mm = significativa.
  Varizes gastroesofágicas: não visualizáveis ao US transabdominal; sugere endoscopia.
  Veia coronária (gástrica esquerda): dilatada >5 mm ao hilo gástrico.
  Esplenorrenal: comunicante entre veia esplênica e veia renal esquerda.
  Retroperitoneais: coletor perirrenal ou mesentéricas colaterais.

GRADUAÇÃO DE HIPERTENSÃO PORTAL (US Doppler):
  Leve: VP 10–13 mm, velocidade 10–15 cm/s, sem ascite, sem colateral significativa.
  Moderada: VP >13 mm, velocidade <10 cm/s, colateral presente, esplenomegalia.
  Grave: fluxo hepatofugal, ascite, colaterais múltiplas, veia para-umbilical repermeabilizada.

CONGESTÃO INDEX (CI) — opcional mas informativo:
  CI = (Área transversal VP em cm²) / (Velocidade média portal em cm/s).
  Normal: CI <0,070. HP grave: CI >0,100.

B. CLASSIFICAÇÃO DE PADRÃO ESPECTRAL DAS VEIAS HEPÁTICAS
───────────────────────────────────────────────────────────────
NORMAL — PADRÃO TRIFÁSICO/TETRAFÁSICO:
  Onda S (sistólica): fluxo hepatófugo pré-dominante (em direção à VCI).
  Onda v: pequena deflexão pré-sistólica reversa (fechamento valva tricúspide).
  Onda D (diastólica): segundo pico hepatófugo (enchimento ventricular direito passivo).
  Onda a: reversa atrial (contração atrial direita).

CLASSIFICAÇÃO DE PADRÃO ALTERADO (BERLIN 2020):
  Monofásico (flat): perda de toda pulsatilidade. Causas: cirrose avançada, compressão.
  Bifásico: perda da onda "a" reversa. Fibrose moderada ou pós-prandial normal.
  Reverso de onda S: IC direita grave, tamponamento, pericardite constritiva.
  Ausência total de fluxo: oclusão/trombose (Budd-Chiari).

CORRELAÇÃO CLÍNICA DO PADRÃO:
  Monofásico sem contexto de IC: sugestivo de cirrose Ishak ≥4 ou compressão tumoral.
  Trifásico normal: não exclui hepatopatia se B-mode alterado.
  Dilatação de VH >10 mm + padrão reverso S: IC direita severa / Budd-Chiari agudo.

C. TROMBOSE PORTAL — ESTADIAMENTO E CONDUTA
───────────────────────────────────────────────────────────────
TROMBOSE PORTAL AGUDA (N4 → R6):
  Material ecogênico expansivo na veia porta (lúmen aumentado).
  Ausência de fluxo ao Color Doppler no segmento acometido.
  Colaterais ainda ausentes (recente).
  Causa: cirrose (espontânea), pancreatite, apendicite, neoplasia, sepse portal.
  → R6: "Trombose portal aguda. Anticoagulação emergencial (HBPM). Avaliação hepatológica urgente."

TROMBOSE PORTAL CRÔNICA / CAVERNOMA PORTAL:
  Substituição da VP por rede vascular tortuosa (cavernoma).
  Ausência da VP normal ao B-mode. Colaterais perihilares bem desenvolvidas.
  Fluxo presente nas colaterais ao PD (diferencial: ausência total = trombose aguda).
  N3: hepatologia + endoscopia + anticoagulação crônica.

TROMBOSE MALIGNA (INVASÃO TUMORAL):
  Material intraluminal com PD interno (vascularização = trombo neoplásico).
  Trombo "quente" ao Doppler — diferencial do trombo benigno (sem fluxo).
  Contexto: CHC avançado, adenocarcinoma pancreático.
  → N4 → R6: oncologia + angiotomografia para estadiamento.

D. SÍNDROME DE BUDD-CHIARI — PROTOCOLO DIAGNÓSTICO
───────────────────────────────────────────────────────────────
DEFINIÇÃO: Obstrução do fluxo de saída hepático por trombose das veias hepáticas
(VH) e/ou VCI, causando congestão hepatoesplênica progressiva.

ACHADOS US — AGUDO:
  Fígado aumentado (congestão aguda), hipoecoico difuso.
  Ausência de fluxo nas VH ao Doppler (ou fluxo reverso).
  VCI dilatada >2,5 cm sem colapso inspiratório.
  Ascite precoce (mesmo sem cirrose).

ACHADOS US — CRÔNICO:
  Fígado com atrofia dos segmentos posteriores (S6/S7) + hipertrofia do lobo caudado (S1).
    (Lobo caudado tem drenagem direta para VCI — preservado na SBC).
  Colaterais intra-hepáticas: comunicantes entre VH entre si ou com VCI.
  Esplenomegalia e varizes esplenorrenais (HP secundária).

ACHADOS DOPPLER NA SBC:
  Fluxo reverso ou ausente em ≥1 VH + lobo caudado hipertrofiado = Budd-Chiari.
  "Whirlpool pattern" ao Color: colaterais intra-hepáticas em espiral.

⚠️ R6 BUDD-CHIARI AGUDO:
"ALERTA HEPÁTICO: Ausência de fluxo nas veias hepáticas [D/M/E] com VCI dilatada e
ascite. Achado compatível com Síndrome de Budd-Chiari. Avaliação hepatológica urgente.
Angio-TC / Angio-RM para confirmação e planejamento (anticoagulação ou TIPS/transplante)."

E. AVALIAÇÃO PÓS-TRANSPLANTE HEPÁTICO
───────────────────────────────────────────────────────────────
PROTOCOLO DOPPLER PÓS-TRANSPLANTE:
  Protocolo de seguimento: imediato (24–48h), semanal (1ª semana), mensal.

ARTÉRIA HEPÁTICA (AH) — MAIS CRÍTICA:
  VPS normal pós-transplante: 40–200 cm/s.
  IR normal: 0,5–0,8.
  Padrão tardus-parvus (TA >80 ms, IR <0,5): trombose/estenose da anastomose.
  → R6 se: ausência de fluxo na AH (trombose = indicação de retransplante).
  → Estenose AH (VPS >300 cm/s + gradiente >3:1): angioplastia urgente.

VEIA PORTA TRANSPLANTADA:
  Velocidade portal normal: 20–40 cm/s (maior que pré-transplante).
  Velocidade <10 cm/s ou ausência de fluxo: trombose/estenose anastomótica.
  → R6 se trombose precoce (<30 dias) — retransplante urgente.

VEIAS HEPÁTICAS:
  Padrão trifásico deve retornar em 48–72h pós-transplante.
  Estenose de VH (síndrome de Budd-Chiari pós-transplante): fluxo turbulento + aceleração.
  → Angioplastia percutânea.

BILE LEAK / COLEÇÃO PERI-HEPÁTICA:
  Coleção anecoica ou com debris pós-transplante → bioma/bilioma → drenagem percutânea.

F. PROTOCOLO DE AVALIAÇÃO — TIPS (Shunt Porto-Sistêmico Trans-Jugular)
───────────────────────────────────────────────────────────────
AVALIAÇÃO DE PERVIEDADE DO TIPS (stent metálico expandível no parênquima hepático):

B-MODE:
  Stent hiperecogênico linear no parênquima entre VP e VH direita.
  Ausência do stent ao B-mode: investigar migração.

DOPPLER COLORIDO:
  Fluxo presente no shunt: aliasing ao Color = fluxo de alta velocidade normal.
  Ausência de fluxo: disfunção / trombose do TIPS.

CRITÉRIOS DE PERVIEDADE:
  Velocidade intrastent: 90–190 cm/s (normal). <50 cm/s = disfunção/estenose.
  Aumento da VP pós-TIPS: fluxo de alta velocidade hepatopetal no TIPS.
  Portal pré-TIPS: VP deve ter fluxo hepatopetal reduzido após colocação.

DISFUNÇÃO DE TIPS:
  VP com retorno ao padrão pré-TIPS (hepatofugal) = TIPS não funcionante.
  → Revisão/restrição ou substituição por expertise em radiologia intervencionista.

G. OBSERVAÇÕES METODOLÓGICAS ABDOME SUPERIOR COM DOPPLER
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
O Doppler hepático é tecnicamente exigente e fortemente operador-dependente.
A avaliação deve ser realizada em jejum de ≥4 horas para minimizar variação pós-prandial
da velocidade portal (aumento fisiológico de 50% após refeição calórica). A velocidade
portal e o índice de resistência da AH variam com frequência cardíaca, pressão arterial,
fase respiratória e posição do paciente — registrar sempre valores em apneia voluntária.
O padrão monofásico das VH é sensível a fatores técnicos (ângulo de insonação, PRF, compressão
excessiva do probe) e pode ser observado fisiologicamente em região perihilar sem doença
hepática. A síndrome de Budd-Chiari e trombose portal requerem confirmação por angio-TC ou
angio-RM para planejamento terapêutico definitivo — o US Doppler é triagem, não confirmatório.
A avaliação da artéria hepática pode ser tecnicamente limitada em cirróticos por tortuosidade
e calcificações ateroscleróticas. Em pós-transplante hepático, a artéria hepática sem fluxo ao
Doppler é emergência técnica e clínica — excluir artefato (ajustar PRF, ganho) antes de declarar
trombose, mas acionar equipe imediatamente enquanto investiga.`;

// ────────────────────────────────────────────────────────────────────────────
// 3. ABDOME TOTAL
// ────────────────────────────────────────────────────────────────────────────
const abdomeTotal = getLatest('dTZ2W4qCGs2TDuax2Jod');
abdomeTotal.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — ABDOME TOTAL V2.0
═══════════════════════════════════════════════════════════════

A. AVALIAÇÃO PÉLVICA TRANSABDOMINAL — GINECOLÓGICA
───────────────────────────────────────────────────────────────
ÚTERO (avaliação panorâmica — exame dedicado = transvaginal):
  Posição: anteroverso/retroverso/retroflexo.
  Dimensões: comprimento × largura × espessura (AP) em mm.
    Normal pré-menopausa: 7×4×4 cm. Pós-menopausa: 3–5 cm comprimento.
  Mioma (N2/N3): nódulo hipoecoico ou isoecóico, com calcificações ou sombra acústica.
    Localização: subseroso, intramural, submucoso, cervical.
    Tamanho: relatar maior e local de maior impacto funcional.
  Endométrio: espessura normal pré-menopausa (proliferativa: 4–8 mm; secretora: 8–14 mm).
    Pós-menopausa: >5 mm = espessamento, encaminhar para TV-US + biópsia.
    NOTA: medida do endométrio ao US transabdominal é menos precisa que via transvaginal.
  Coleção uterina: hemato/piométrio — líquido no interior da cavidade uterina.
    → R6 se associado a febre: piométrio = emergência ginecológica.

OVÁRIOS (avaliação panorâmica):
  Dimensões: normais <3 cm em pré-menopausa; <2 cm em pós-menopausa.
  Cisto functional (<5 cm, paredes finas, anecoico): controle em 6 semanas.
  Cisto suspeito (>5 cm, septado, nódulo mural, PD interno): TV-US + RM.
    → Classificar por O-RADS: O-RADS 4–5 → R6.
  Cisto dermóide (teratoma): material hiperecóico heterogêneo com sombra acústica (sebáceo).
    "Bola de neve" ou "iceberg": componente hiperecoico periférico com sombra.
    Benigno mas requer cirurgia se >5 cm por risco de torção.
  Síndrome dos ovários policísticos (SOP) ao US:
    ≥12 folículos por ovário de 2–9 mm cada + volume ovariano >10 cm³.
    Não é diagnóstico sozinho — correlação clínica + lab (ROTTERDAM criteria).

LÍQUIDO LIVRE PÉLVICO:
  Fisiológico: pequena quantidade no fundo de saco de Douglas em pré-menopausa pós-ovulação.
  Ascite: avaliar se pélvica ou extensão de ascite abdominal superior.
  Líquido espesso/com debris: exsudato, hemoperitônio, pus.
    → R6 se associado a dor aguda + febre (doença inflamatória pélvica, abscesso tubo-ovariano).

B. RETROPERITÔNIO — PROTOCOLO DE AVALIAÇÃO
───────────────────────────────────────────────────────────────
LINFONODOS RETROPERITONEAIS:
  Normal: eixo curto <10 mm, com hilo gorduroso preservado.
  Anormal: eixo curto ≥10 mm OU perda do hilo gorduroso.
    Localização: para-aórticos, para-cava, mesentéricos, ilíacos comuns.
  Causas: linfoma, metástases (testículo, melanoma, tumor GI), tuberculose, sarcoidose.
  → N3 se linfonodo isolado ≥10 mm. N4 se conglomerado ou compressão vascular.

MASSAS RETROPERITONEAIS:
  Sem associação com órgão identificado (rim, suprarrenal, pâncreas).
  Heterogêneas com PD: sarcoma retroperitoneal, teratoma, paraganglioma.
  Calcificadas: teratoma maduro, ganglioneuroma, paraganglioma antigo.
  → N3/N4: TC ou RM para estadiamento.

SUPRARRENAIS:
  Visíveis ao US em ~50% (direita) e ~30% (esquerda) dos adultos.
  Normal: <3 cm, ecotextura homogênea.
  Adenoma: oval, <3 cm, baixa atenuação à TC. Incidentaloma — correlação com TC.
  Feocromocitoma: >3 cm, heterogêneo, hipervascular ao PD.
    → Se suspeita: não puncionar antes de bloquear alfa-adrenérgico.
  Metástase: hipoecoica, bilateral, >3 cm — neoplasia primária conhecida.
  → Qualquer massa adrenal >3 cm ou com PD: TC + dosagem hormonal.

C. HÉRNIAS DA PAREDE ABDOMINAL
───────────────────────────────────────────────────────────────
PROTOCOLO DE AVALIAÇÃO DE HÉRNIA:
  Localização: umbilical, epigástrica, inguinal (D/E), incisional, obturatriz, femoral.
  Conteúdo: epiplon (hiperecóico) / alça intestinal (peristaltismo ao tempo real).
  Anel herniário: medir diâmetro (mm) — prediz risco de encarceramento.
  Redutibilidade: verificar com manobra de Valsalva + compressão manual.

CLASSIFICAÇÃO DE URGÊNCIA:
  Hérnia redutível (N2): encaminhar eletivamente para cirurgia geral.
  Hérnia irredutível (N3): urgência relativa — avaliação em 24h.
  Hérnia estrangulada (N4) → R6:
    Critérios: irredutível + alça sem peristaltismo + edema do anel + líquido no saco.
    → "ALERTA CIRÚRGICO: hérnia com conteúdo intestinal sem peristaltismo, sugestiva de
    estrangulamento. Avaliação cirúrgica imediata."

DIAGNÓSTICO DIFERENCIAL:
  Linfonodo inguinal: oval, hilar, compressível, sem continuidade peritoneal.
  Lipoma: hiperecóico compressível, sem conteúdo intestinal.
  Hidrocele comunicante (criança): líquido anecoico descendo ao escroto com Valsalva.

D. PROTOCOLO DE RASTREIO DE AAA (AORTA ABDOMINAL)
───────────────────────────────────────────────────────────────
INDICAÇÕES DE RASTREIO (USPSTF Grade B):
  Homens fumantes (≥100 cigarros/vida) com 65–74 anos: US único de rastreio.
  Extender: mulheres fumantes ≥65 anos (menor benefício — avaliar individualmente).
  Familiar 1° grau de portador de AAA: rastreio a partir dos 60 anos.

TÉCNICA DE MEDIDA DO DIÂMETRO AÓRTICO:
  Medir em plano transversal, perpendicular ao eixo longo da aorta.
  Método borda externa a borda externa (outer-to-outer) — padrão AIUM.
  Registrar diâmetro máximo (AP ou transversal, o maior).
  Medir no segmento infrarrenal (entre artérias renais e bifurcação).

LIMIARES E CONDUTA:
  <3,0 cm: normal — sem seguimento.
  3,0–3,9 cm: aneurisma pequeno — US anual.
  4,0–4,9 cm: aneurisma médio — US semestral + referência vascular.
  5,0–5,4 cm: aneurisma significativo — US trimestral + avaliação vascular imediata.
  ≥5,5 cm ♂ / ≥5,0 cm ♀: ⚠️ R6 → cirurgia/endovascular.
  Crescimento >5 mm/6 meses: ⚠️ R6 independentemente do diâmetro.
  Sinais de ruptura (líquido periaórtico, hematoma retroperitoneal): ⚠️ R6 ABSOLUTO.

E. OBSERVAÇÕES METODOLÓGICAS ABDOME TOTAL
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia de abdome total é método de rastreio de alta sensibilidade para
alterações macroscópicas mas tem limitações técnicas importantes que devem ser declaradas
no laudo. A avaliação pélvica transabdominal é fortemente dependente da repleção vesical
(necessária ≥300 mL para adequada janela acústica) — bexiga vazia invalida a avaliação
pélvica e deve ser documentada. Para lesões focais <1 cm em órgãos sólidos, a sensibilidade
cai para 50–60%. A avaliação do retroperitônio profundo (linfodenopatia para-aórtica, corpo/
cauda pancreáticas) pode ser limitada por meteorismo, IMC elevado ou habitus corporal. O exame
transabdominal não substitui o transvaginal para caracterização das estruturas uterinas e
ovarianas — qualquer achado pélvico deve ser confirmado por US transvaginal em mulheres
sem contraindicação. A avaliação do apêndice ao US transabdominal tem sensibilidade de
apenas 75–86% para apendicite aguda (inferior à TC) e depende da identificação direta do
apêndice (não visível em muitos pacientes). Achados abdominais incidentais devem sempre ser
contextualizados com a indicação clínica — em exames de rastreio, a taxa de achado incidental
relevante é de 15–20%.`;

// ────────────────────────────────────────────────────────────────────────────
// 4. ABDOME TOTAL COM DOPPLER
// ────────────────────────────────────────────────────────────────────────────
const abdomeTotalDoppler = getLatest('5FcflzxSDd8fCD7yPStV');
abdomeTotalDoppler.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — ABDOME TOTAL COM DOPPLER V2.0
═══════════════════════════════════════════════════════════════

A. PROTOCOLO DOPPLER SISTÊMICO — SEQUÊNCIA OBRIGATÓRIA
───────────────────────────────────────────────────────────────
Este exame integra o Doppler completo de abdome superior E renal. Sequência obrigatória:

SISTEMA HEPATO-PORTAL:
  1. Veia Porta Principal: calibre (mm), velocidade (cm/s), direção (hepatopetal/hepatofugal).
     Normal: ≤13 mm, 12–20 cm/s, hepatopetal.
  2. Veia Esplênica: calibre (mm), fluxo hepatopetal. Normal: ≤8 mm.
  3. Veia Mesentérica Superior: permeabilidade, fluxo. Normal: ≤10 mm.
  4. Artéria Hepática: IR (0,55–0,80), padrão espectral, permeabilidade.
  5. Veias Hepáticas D/M/E: padrão (trifásico/bifásico/monofásico/reverso), calibre.
  6. VCI sub-hepática: calibre, colapsabilidade.

VASCULATURA RENAL:
  7. Artérias Renais Principais (troncos): VPS bilateral (normal <180 cm/s).
     RAR = VPS renal / VPS aorta (normal <3,5).
  8. Artérias Interlobares/Arqueadas: IR intraparenquimatoso bilateral (normal 0,55–0,70).
     TA (tempo de aceleração): normal <70 ms.
  9. Veias Renais: permeabilidade bilateral, ausência de trombo.

AORTA ABDOMINAL E VCI:
  10. Aorta: calibre, fluxo bifásico/trifásico normal, aneurisma, placas.
  11. VCI: calibre, colapso inspiratório (>50% = normal).

B. PADRÕES DE ALTERAÇÃO DOPPLER — DIAGNÓSTICO DIFERENCIAL
───────────────────────────────────────────────────────────────
VP LENTA (<12 cm/s) + CALIBRE NORMAL:
  Desidratação / pós-prandial tardio. Fibrose hepática leve. HP inicial.
  → Repetir em jejum e após hidratação antes de declarar patológico.

VP DILATADA + VELOCIDADE NORMAL:
  Fisiológico após refeição calórica (VP pode chegar a 20 mm pós-prandial).
  Insuficiência cardíaca direita (dilatação sem HP portal verdadeiro).
  → Correlacionar com VCI e VH.

VP HEPATOFUGAL:
  Hipertensão portal grave — cirrose Child B/C.
  VP hepatofugal = alta resistência intra-hepática → shunt portossistêmico.
  → N4 → hepatologia urgente → endoscopia.

ARTÉRIA HEPÁTICA COM PADRÃO TARDUS-PARVUS:
  TA >80 ms + IR <0,5 = obstrução proximal (estenose anastomótica pós-Tx,
  celíaco/SMA stenosis, MALS — síndrome de Dunbar).
  → N3/N4: angio-TC + avaliação vascular/hepatológica.

IR RENAL BILATERALMENTE ELEVADO (>0,70):
  Nefropatia parenquimatosa difusa (DRC, nefroesclerose hipertensiva, DM).
  Obstrução ureteral bilateral aguda (hidronefrose bilateral).
  Hipovolemia grave (pre-renal).
  → Correlação com creatinina, TFG, urina.

IR RENAL ASSIMÉTRICO (diferença >0,05):
  Suspeita de estenose da artéria renal ipsilateral.
  → Avaliar VPS do tronco renal ipsilateral. Se >180 cm/s: estenose.
  → Angio-TC / Angio-RM + avaliação vascular.

FLUXO RENAL AUSENTE UNILATERAL:
  Trombose de artéria renal → R6.
  Oclusão de veia renal (trombose de veia renal — associada a carcinoma de células renais).
  → R6: avaliação vascular/urológica urgente.

C. CLASSIFICAÇÃO N0–N4 EXPANDIDA — DOPPLER INTEGRADO
───────────────────────────────────────────────────────────────
N0 — NORMALIDADE COMPLETA:
  Todos os eixos vasculares com parâmetros normais. Órgãos normais ao B-mode.
  Conclusão modelo: "Órgãos parenquimatosos abdominais de aspecto ecográfico conservado.
  Estudo Doppler dos eixos hepatoportal e renal sem evidências de alterações hemodinâmicas
  significativas ao presente estudo."

N1 — ACHADO INCIDENTAL COM DOPPLER NORMAL:
  Ex: esteatose leve + Doppler normal. Cisto renal + IR normal.
  Conclusão: "[Achado] de aspecto benigno. Parâmetros hemodinâmicos preservados."

N2 — ALTERAÇÃO DOPPLER LEVE OU ACHADO B-MODE COM IMPLICAÇÃO CLÍNICA:
  Ex: IR bilateral 0,70–0,75 (nefropatia incipiente). VP 11–13 mm com fluxo lento.
  Esteatose moderada + IR renal normal.
  Conclusão: "[Achado] — correlação com [dado clínico/laboratorial]."

N3 — ALTERAÇÃO DOPPLER SIGNIFICATIVA OU ACHADO SÓLIDO SUSPEITO:
  Ex: IR >0,80 bilateral. Estenose renal suspeita (VPS >180 cm/s). HP moderada.
  VH monofásica em cirrótico. Massa sólida hepática + Doppler angiogênico.
  Conclusão: "[Achado] — avaliação [especialista] e complementação por [TC/RM]."

N4 — EMERGÊNCIA VASCULAR / TROMBOSE / ISQUEMIA:
  Trombose portal aguda. VP hepatofugal grave. Ausência de fluxo renal. Budd-Chiari agudo.
  AAA ≥5,5 cm. Colecistite aguda + HP.
  ⚠️ ATIVAR R6.

D. SÍNTESE HEMODINÂMICA OBRIGATÓRIA NA CONCLUSÃO
───────────────────────────────────────────────────────────────
Regra: NUNCA omitir o status hemodinâmico em abdome total COM Doppler.
A conclusão deve SEMPRE ter uma linha dedicada ao estudo Doppler, mesmo se normal:

  Normal: "Estudo Doppler dos eixos hepatoportal (VP, AH, VH) e renal (artérias e IR)
  sem evidências de alterações hemodinâmicas significativas ao presente estudo."

  Alteração portal: "Hipertensão portal ao Doppler: [achado específico]."

  Alteração renal: "Aumento bilateral do índice de resistência intraparenquimatoso
  (IR médio [X]), compatível com nefropatia parenquimatosa difusa."

E. OBSERVAÇÕES METODOLÓGICAS — ABDOME TOTAL COM DOPPLER
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia de abdome total com Doppler é o exame mais completo da modalidade
ultrassonográfica abdominal, combinando morfologia e hemodinâmica em um único exame.
A qualidade dos parâmetros Doppler depende criticamente do ângulo de insonação (<60° para
Doppler espectral), da PRF adequada para o vaso avaliado, do estado de jejum do paciente
(mínimo 4 horas para avaliação portal) e das condições hemodinâmicas sistêmicas (PA, FC,
volemia). Variações de até 20% nos índices de resistência e velocidades são esperadas entre
examinadores e entre sessões no mesmo paciente — valores limítrofes devem ser confirmados por
repetição ou por método complementar (angio-TC, angio-RM). A avaliação direta dos troncos
das artérias renais é tecnicamente limitada em 20–40% dos pacientes por interposição gasosa
intestinal — nesses casos, os critérios indiretos intraparenquimatosos (padrão tardus-parvus,
IR assimétrico) são utilizados como substitutos. Achados Doppler devem sempre ser correlacionados
com B-mode, dados laboratoriais e contexto clínico para evitar falsos positivos e negativos.`;

// ────────────────────────────────────────────────────────────────────────────
// 5. PRÓSTATA VIA ABDOMINAL
// ────────────────────────────────────────────────────────────────────────────
const prostata = getLatest('9gYSqG5C6qEIYg1JqSxw');
prostata.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — PRÓSTATA VIA ABDOMINAL V2.0
═══════════════════════════════════════════════════════════════

A. PSA E CORRELAÇÃO COM ACHADOS US
───────────────────────────────────────────────────────────────
DENSIDADE DO PSA (PSAD):
  PSAD = PSA sérico (ng/mL) / Volume prostático (cm³).
  Normal: PSAD <0,15.
  PSAD ≥0,15: aumento do risco de CaP mesmo com PSA total na faixa cinza (4–10 ng/mL).
  → Se PSAD ≥0,15 + achado focal suspeito ao US: RM multiparamétrica ou biópsia.
  → RELATAR no laudo quando dados de PSA forem fornecidos pelo solicitante.

PSA TOTAL E CONTEXTO UROLÓGICO:
  PSA <2,5 ng/mL (<50 anos): normal. PSA <3,5 ng/mL (50–59 anos): normal.
  PSA 4–10 ng/mL: "zona cinzenta" — avaliar PSAD, fração livre, mpMRI.
  PSA >10 ng/mL: alto risco de CaP — mpMRI + biópsia.
  PSA >50 ng/mL: metástases prováveis — TC/RM + cintilografia óssea.

FRASEOLOGIA INTEGRANDO PSA (quando fornecido no pedido):
  "Com base no PSA fornecido ([X] ng/mL) e no volume prostático de [X] cm³,
  a densidade do PSA estimada é de [X] ng/mL/cm³ ([normal / aumentada]),
  sugerindo [baixo / moderado / alto] risco oncológico. Correlação mpMRI recomendada."

B. CORRELAÇÃO COM mpMRI — PI-RADS LITE
───────────────────────────────────────────────────────────────
QUANDO SOLICITAR mpMRI:
  PSA elevado (>4 ng/mL ou PSAD >0,15) + US indeterminado.
  Área focal hipoecoica suspeita ao TRUS ou transabdominal.
  Biópsia prévia negativa + PSA crescente.
  Estadiamento pré-operatório de CaP confirmado.

CONCORDÂNCIA US/MRI:
  Via transabdominal: resolução insuficiente para identificar zonas de transição/periférica
  de forma confiável. A US identifica nódulos hiperplásicos na ZT (benigno) mas não
  consegue diferenciar carcinoma na ZP (<5 mm ao US transabdominal).
  → Qualquer área focal suspeita ao US transabdominal = mpMRI ou TRUS+biópsia.

RELATAR NO LAUDO QUANDO SUSPEITA:
  "Área focal hipoecoica de [X mm] na [topografia limitada pela via transabdominal].
  A via abdominal não permite caracterização tisular adequada. Sugere-se complementação
  com RM multiparamétrica (mpMRI — protocolo PI-RADS) para avaliação zonal da próstata,
  ou ultrassonografia transretal com biópsia dirigida, a critério clínico e oncourológico."

C. LINFONODOS PÉLVICOS — AVALIAÇÃO INCIDENTAL
───────────────────────────────────────────────────────────────
LINFONODOS ILÍACOS (visíveis ao US transabdominal):
  Avaliar cadeias ilíacas externas, ilíacas internas e obturatórias.
  Normal: eixo curto <8 mm; hilo gorduroso presente.
  Suspeito: eixo curto ≥10 mm OU hilo ausente.
  Contexto CaP: metástases nodais pélvicas alteram estadiamento (N1) e conduta.
  → N3 se linfonodo pélvico ≥10 mm em paciente com CaP conhecido.
  → TC de pelve para confirmação de estadiamento.

D. VESÍCULAS SEMINAIS — PROTOCOLO AVANÇADO
───────────────────────────────────────────────────────────────
ANATOMIA E NORMALIDADE:
  Estruturas tubulocísticas simétricas posteriores à bexiga e acima da próstata.
  Dimensão: comprimento 3–6 cm; largura 1–2 cm (visíveis via suprapúbica).
  Normal: simétricas, com parede fina, conteúdo levemente hipoecoico.

ALTERAÇÕES:
  Assimetria >20%: investigar obstrução do ducto ejaculatório ou invasão neoplásica.
  Cistoprostatite: espessamento parietal das VS + debris intraluminais.
  Calcificações: pós-inflamatórias (frequentes em homens >50 anos — benignas).
  Invasão neoplásica (CaP avançado): VS hipoecoica obliterada + continuidade com massa
  prostática → estadiamento T3b.
  → Qualquer achado em VS suspeito: mpMRI para definição.

E. PROTOCOLO DE AVALIAÇÃO PÓS-CIRÚRGICA / PÓS-RADIOTERAPIA
───────────────────────────────────────────────────────────────
PÓS-PROSTATECTOMIA RADICAL:
  Ausência da próstata: confirmar e relatar ("loja prostática sem evidência de recidiva").
  Anastomose vesicouretral: avaliar integridade (não visível ao transabdominal).
  Espessamento ou nódulo na loja prostática: suspeita de recidiva local → mpMRI.
  Seroma/coleção pós-operatória: coleção anecoica na loja → drenagem se volumosa.

PÓS-RADIOTERAPIA:
  Próstata fibrosada: menor volume, ecotextura heterogênea, calcificações.
  Bexiga pós-RT: espessamento difuso parietal (cistite actínica).
  RPM elevado pós-RT: medir sempre — estenose uretral ou fibrose esfincteriana.

F. CLASSIFICAÇÃO N0–N4 EXPANDIDA — PRÓSTATA
───────────────────────────────────────────────────────────────
N0 — Próstata <30 cm³, homogênea, sem IPP, RPM <50 mL, bexiga normal.
  Conclusão: "Próstata com volume estimado em [X] cm³ ([X] g), dentro dos limites
  normais. Ausência de protrusão intravesical. Esvaziamento vesical preservado."

N1 — HPB Grau I (30–50 cm³), IPP Grau I (<5 mm), RPM <50 mL, sem cistopatia.
  Conclusão: "Hiperplasia prostática benigna inicial (Grau I, [X] cm³). Ausência de
  repercussão obstrutiva vesical significativa."
  Conduta: PSA, IPSS, seguimento ambulatorial urológico.

N2 — HPB Grau II (50–80 cm³), IPP Grau II (5–10 mm), RPM 50–100 mL.
  Conclusão: "Hiperplasia prostática benigna moderada (Grau II, [X] cm³), com
  protrusão intravesical de [X] mm. RPM de [X] mL — componente obstrutivo moderado."
  Conduta: avaliação urológica; inibidores 5-alfa redutase + alfa-bloqueadores.

N3 — HPB Grau III/IV (>80 cm³), IPP Grau III (>10 mm), RPM >100 mL, cistopatia.
     Lesão focal suspeita ao transabdominal.
  Conclusão: "HPB volumosa (Grau [III/IV], [X] cm³) com protrusão intravesical grave
  (IPP [X] mm) e cistopatia obstrutiva [com trabeculação/divertículo]. RPM de [X] mL."
  Conduta: urologia prioritária; avaliar RTUP ou HoLEP; mpMRI se suspeita de CaP.

N4 — RPM >300 mL agudo, dilatação ureteral bilateral (uropatia obstrutiva baixa).
  ⚠️ R6.
  Conclusão: "ALERTA UROLÓGICO: Retenção urinária acentuada ([X] mL) com sinais de
  descompensação vesical. Avaliação urológica imediata para sondagem vesical e manejo."

G. OBSERVAÇÕES METODOLÓGICAS — PRÓSTATA VIA ABDOMINAL
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia prostática por via abdominal (suprapúbica) permite excelente estimativa
volumétrica global da próstata e avaliação das repercussões obstrutivas sobre a bexiga,
mas tem resolução espacial inferior à via transretal (TRUS) para avaliação da anatomia zonal
(zona periférica, central e de transição). A via abdominal NÃO permite rastreio, diagnóstico
ou exclusão de carcinoma de próstata — a zona periférica, sede de 70% dos cânceres, não é
adequadamente visualizada por essa via. A estimativa de volume prostático por essa via tem
margem de erro de ±20% em relação ao volume real — medidas em borderline (próximas a 30,
50 ou 80 cm³) devem ser interpretadas com cautela. A qualidade do exame depende criticamente
da repleção vesical (≥150–300 mL) — bexiga vazia ou pouco repleta invalida a volumetria
prostática e a avaliação da IPP. Em casos de suspeita de CaP, PSA elevado, ou achado focal
ao US, a RM multiparamétrica (mpMRI — protocolo PI-RADS v2.1) é o próximo passo diagnóstico,
com sensibilidade de 87–93% para câncer clinicamente significativo (≥Gleason 3+4).`;

// ────────────────────────────────────────────────────────────────────────────
// 6. RINS E VIAS URINÁRIAS
// ────────────────────────────────────────────────────────────────────────────
const rinsVU = getLatest('f9WSMwIYdYOvnLRGHZkQ');
rinsVU.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — RINS E VIAS URINÁRIAS V2.0
═══════════════════════════════════════════════════════════════

A. CLASSIFICAÇÃO MORFOLÓGICA DETALHADA DE CISTOS RENAIS (Alternativa ao Bosniak ao US)
───────────────────────────────────────────────────────────────
NOTA: O sistema Bosniak oficial (2019) é para TC/RM. Ao US, usar terminologia descritiva
morfológica com recomendação de complementação seccional quando indicado.

CISTO SIMPLES (equivale a Bosniak I ao US):
  Anecoico. Paredes imperceptíveis ou finíssimas. Reforço acústico posterior.
  Ausência de septos, nódulos ou calcificações.
  Sem fluxo ao Power Doppler.
  Conduta: <4 cm sem seguimento. 4–7 cm controle US 6 meses. >7 cm ou atípico: RM.

CISTO MINIMAMENTE COMPLEXO (equivale a Bosniak II):
  Paredes finas (<1 mm), 1–2 septos finos sem nódulo, calcificação fina parietal.
  Anecoico. Sem fluxo ao PD.
  Conduta: controle US em 12 meses. Se estável: controle anual por 5 anos.

CISTO MODERADAMENTE COMPLEXO (equivale a Bosniak IIF/III):
  Paredes ou septos espessados (>1 mm). ≥3 septos finos. Calcificações grosseiras.
  Debris hipoecoicos. Componente sólido mural pequeno sem fluxo ao PD.
  Conduta: TC/RM contrastada imediata para classificação definitiva (Bosniak 2019).
  → N3: "Cisto renal [D/E] com elementos complexos ao US. Complementação com
  TC/RM contrastada recomendada para adequada caracterização e estratificação de risco."

CISTO COMPLEXO SUSPEITO (equivale a Bosniak IV):
  Nódulo mural com fluxo ao PD. Septos espessados vascularizados. Componente sólido.
  → N4: "Formação cística renal com elementos sólidos vascularizados. Avaliação
  uronecológica urgente. TC/RM trifásica para estadiamento."

REGRAS OPERACIONAIS:
  NUNCA escrever "Bosniak X" no laudo ultrassonográfico.
  SEMPRE descrever morfologicamente e recomendar TC/RM se qualquer complexidade >mínima.

B. DIFERENCIAÇÃO AML vs. RCC (MASSA SÓLIDA RENAL)
───────────────────────────────────────────────────────────────
ANGIOMIOLIPOMA (AML):
  Massa hiperecóica homogênea, bordas nítidas, sem halo hipoecoico.
  Componente gorduroso: ecogenicidade = tecido adiposo periférico do paciente.
  Tamanho: qualquer. <4 cm = baixo risco de rotura espontânea.
  ≥4 cm: risco de hemorragia retroperitoneal → R6 se rotura (hematoma perirrenal).
  Confirmação: TC sem contraste (densidade <-20 UH = gordura = AML).
  AML pobre em gordura: indistinguível do RCC ao US → TC com contraste obrigatória.

CARCINOMA DE CÉLULAS RENAIS (RCC):
  Hipoecoico (60%), iso (25%), hiperecoico (15%).
  Halo hipoecoico periférico (mais específico que AML).
  PD interno = sinal suspeito (AML tipicamente avascular ao PD).
  Calcificação irregular: RCC (vs. calcificação regular = cisto benigno calcificado).
  Invasão venosa (VP, VCI): trombo tumoral "quente" ao PD.
    → R6: "Massa renal com trombo tumoral venoso. Estadiamento cirúrgico urgente."

ONCOCITOMA:
  Indistinguível do RCC ao US. Cicatriz central hipoecoica pode sugerir (inespecífico).
  → TC/RM para tentativa de diferenciação; frequentemente vai a cirurgia sem diagnóstico.

TUMOR DE WILMS (criança):
  Massa sólida heterogênea em criança <5 anos. Pode ser bilateral.
  → R6: "Massa renal sólida em criança — suspeita de tumor de Wilms. Avaliação
  pediátrica oncológica urgente. TC abdome e TC tórax para estadiamento."

C. NEFROLITÍASE — PROTOCOLO DE CLASSIFICAÇÃO POR TAMANHO E LOCALIZAÇÃO
───────────────────────────────────────────────────────────────
MEDIDAS E LOCALIZAÇÃO OBRIGATÓRIAS:
  Registrar: maior dimensão (mm), localização (cálice superior / médio / inferior /
  pelve / junção pielocalicinal / ureter proximal / médio / JUV).
  Registrar: presença de sombra acústica posterior (confirmação diagnóstica).
  Registrar: cintilação ("twinkling" ao Color Doppler) — auxilia diagnóstico de cálculos.
  Registrar: hidronefrose ipsilateral associada (grau).

CONDUTA POR TAMANHO (protocolo urológico AUA/EAU):
  <4 mm: expulsão espontânea em >90% em 4 semanas. Conduta conservadora.
  4–6 mm: expulsão espontânea em ~60%. Hidratação + alfa-bloqueador + analgesia.
  >6 mm: expulsão improvável — avaliação urológica para intervenção.
  >10 mm (ou 1 cm): litotripsia extracorpórea (SWL) ou ureteroscopia.

LOCAIS DE IMPACTAÇÃO:
  JUP (junção ureteropélvica): cólica renal intensa ipsilateral.
  Ureter médio: dor irradiando para flanco/fossa ilíaca.
  JUV (junção ureterovesical): dor irradiando para genitais externos + urgência urinária.

CRITÉRIOS DE URGÊNCIA (R6):
  Cálculo obstruente + febre: pielonefrite obstrutiva / urossepse → R6.
    "ALERTA UROLÓGICO: Cálculo obstruente com hidronefrose + febre. Urossepse possível.
    Avaliação urológica urgente para drenagem (nefrostomia/JJ stent)."
  Cálculo bilateral obstruindo os dois rins + anúria: R6 emergencial.
  Cálculo em rim único (anatômico ou funcional) com hidronefrose: R6.

D. BEXIGA — AVALIAÇÃO AVANÇADA
───────────────────────────────────────────────────────────────
ESPESSURA DA PAREDE VESICAL:
  Normal: ≤3 mm (bexiga com ≥300 mL). ≤5 mm (bexiga parcialmente repleta).
  Espessamento difuso: uropatia obstrutiva (HPB, estenose uretral), cistite crônica.
  Espessamento focal: neoplasia urotelial, endometriose, cisto de úraco.

LESÕES PARIETAIS VESICAIS:
  Pólipo/papiloma (sessil, sem sombra): suspeita de tumor urotelial.
  Tamanho >5 mm, base larga, PD interno: ALTA suspeição de carcinoma urotelial.
  → N3/N4: encaminhamento urológico + cistoscopia.
  Cálculo vesical: foco hiperecóico com sombra + mobilidade com mudança de decúbito.
    Associado a HPB/retenção crônica ou infecção urinária de repetição.
  Debris vesicais: ecos móveis na bexiga = piúria, hematúria, coágulos.
    Correlação clínica + EAS/urocultura.

DIVERTÍCULO VESICAL:
  Saculação da parede vesical (falsa pouch através do detrusor).
  Risco: retenção de urina no interior = infecção recorrente, cálculos, raramente CaV.
  Grande divertículo (>3 cm): avaliação urológica.

E. URETER — PROTOCOLO DE AVALIAÇÃO
───────────────────────────────────────────────────────────────
O ureter normal NÃO é visível ao US.
Visualização do ureter = sempre patológico (exceto JUV com bexiga repleta).

URETERECTASIA:
  Calibre ≥5 mm: ureterectasia (definitiva). Identificar:
  Causa: cálculo obstrutivo (hiperecoico com sombra), malformação, compressão extrínseca.
  Nível de obstrução: JUP (proximal), ureter médio, JUV (distal).
  Extensão: isolada proximal vs. com hidronefrose ipsilateral.

JATOS URETERAIS AO COLOR DOPPLER:
  Visualizáveis na bexiga repleta (jato "em pluma" de contraste espontâneo).
  Ausência unilateral: suspeita de obstrução ipsilateral (cálculo, compressão).
  Não é diagnóstico — sensibilidade ~65% para obstrução.

F. CLASSIFICAÇÃO N0–N4 — RINS E VIAS URINÁRIAS
───────────────────────────────────────────────────────────────
N0 — Rins bilateralmente tópicos, com dimensões, parênquima e vias normais.
  Bexiga de paredes finas, RPM <50 mL. Ausência de litíase ou coleção.
  Conclusão: "Estudo ultrassonográfico dos rins e vias urinárias sem alterações."

N1 — Cisto simples renal <4 cm. Microcálculo <4 mm não obstrutivo.
     Pelviectasia discreta isolada (<10 mm) sem dilatação calicinal.
  Conclusão: "[Achado benigno]. Sem repercussão obstrutiva ou funcional."
  Conduta: seguimento clínico; controle US anual para cisto ou litíase acompanhada.

N2 — Cisto simples 4–7 cm. Litíase 4–6 mm sem hidronefrose. Nefropatia G1–G2.
     Hidronefrose leve (<10 mm) sem causa obstrutiva evidente. RPM 50–100 mL.
     Bexiga com espessamento discreto (3–5 mm).
  Conclusão: "[Achado]. Correlação clínica + seguimento."
  Conduta: controle US, avaliação urológica eletiva.

N3 — Litíase >6 mm ou obstruente com hidronefrose. Nefropatia G3–G4. Cisto complexo.
     Massa sólida renal (qualquer tamanho). Tumor vesical suspeito. RPM >100 mL.
     Hidronefrose moderada–acentuada sem febre.
  Conclusão: "[Achado]. Complementação com TC/RM + avaliação urológica prioritária."
  Conduta: TC de vias urinárias, urologia.

N4 — Litíase com febre/sepse. Pionefrrose. Massa renal com trombo tumoral.
     RPM >300 mL agudo. Tumor vesical com invasão extravesical suspeita.
  ⚠️ R6.
  Conclusão: "ALERTA UROLÓGICO: [Achado urgente]. Avaliação imediata."

G. OBSERVAÇÕES METODOLÓGICAS — RINS E VIAS URINÁRIAS
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia dos rins e vias urinárias é o exame de primeira linha para avaliação
renal, com sensibilidade de 96–98% para hidronefrose e 94–98% para cistos renais simples.
A detecção de cálculos no ureter médio (retroperitoneal, entre cruzamento dos vasos ilíacos
e JUV) tem sensibilidade limitada de 20–50% — a TC de abdome sem contraste ("stone protocol")
é o padrão-ouro para localização de cálculos ureterais com sensibilidade de 96–98%. A avaliação
da bexiga requer repleção adequada (≥150–300 mL) para mensuração precisa da espessura parietal
e detecção de lesões de ≥5 mm — bexiga pouco repleta gera falsa impressão de espessamento.
A classificação de Bosniak para cistos renais requer TC ou RM com contraste intravenoso —
ao US, descrever apenas morfologicamente e recomendar complementação quando indicado. Massas
renais sólidas <2 cm têm diagnóstico definitivo melhorado pela RM multiparamétrica (sensibilidade
>90% para RCC vs. AML vs. oncocitoma) em comparação à US isolada. Lesões focais hiperecoicas
<3 cm em rim sem halo hipoecoico têm 90% de probabilidade de serem AMLs — confirmar com TC.`;

// ────────────────────────────────────────────────────────────────────────────
// 7. RINS E VIAS URINÁRIAS COM DOPPLER
// ────────────────────────────────────────────────────────────────────────────
const rinsVUDoppler = getLatest('TODd9kUizva7uum2cf1D');
rinsVUDoppler.aiInstructions += `

═══════════════════════════════════════════════════════════════
APROFUNDAMENTO FINAL — RINS E VIAS URINÁRIAS COM DOPPLER V2.0
═══════════════════════════════════════════════════════════════

A. TRANSPLANTE RENAL — PROTOCOLO DOPPLER COMPLETO
───────────────────────────────────────────────────────────────
ANATOMIA TRANSPLANTE RENAL:
  Localização: fossa ilíaca direita (usualmente). Rim extra-peritoneal.
  Anastomose arterial: artéria ilíaca externa (usualmente end-to-side).
  Anastomose venosa: veia ilíaca externa.
  Ureter: anastomose ureterovesical nova (ureteroneocistostomia).

PROTOCOLO US/DOPPLER PÓS-TRANSPLANTE:
  Fase imediata (24–72h): avaliar perviedade vascular, hematoma, coleção.
  Semana 1–4: monitorar rejeição aguda (IR elevado) e complicações cirúrgicas.
  Após 3 meses: avaliação semestral por nefrologista.

PARÂMETROS NORMAIS — RIM TRANSPLANTADO:
  IR intraparenquimatoso: 0,55–0,70 (mesmos do rim nativo).
  VPS artéria anastomótica: variável por tipo de anastomose; compara com exames prévios.
  Corticomedular: preservada (medular hipoecoica, cortical isoecóica).
  Volume urinário: avaliar hidronefrose (precoce = edema ureteral; tardia = estenose).

COMPLICAÇÕES — DOPPLER:
  Rejeição aguda (N3/N4):
    IR bilateral >0,80 + edema cortical (hipoecoicidade) + piora da função renal.
    → Urgência nefrológica: biópsia do enxerto.

  Trombose da Artéria de Transplante (N4 → R6):
    Ausência completa de fluxo intraparenquimatoso + ausência na anastomose.
    Diagnóstico em minutos — perda do enxerto após 45–60 min sem fluxo.
    → R6 imediato: "Ausência de fluxo arterial no rim transplantado. Trombose arterial
    do enxerto provável. Avaliação cirúrgica de emergência."

  Trombose da Veia do Transplante (N4 → R6):
    Fluxo arterial presente mas com padrão diastólico reverso ("to-and-fro").
    IR >1,0 (fluxo diastólico retrógrado).
    Veia renal do enxerto sem fluxo ou com fluxo retrógrado.
    → R6: "Trombose venosa do enxerto renal provável. Urgência cirúrgica."

  Estenose da Artéria de Transplante (N3):
    VPS na anastomose >200 cm/s com gradiente pós-estenótico.
    Padrão tardus-parvus no parênquima (TA >70 ms, IR <0,50).
    Assimetria de IR entre pólos: >0,10 entre polo superior e inferior.
    → Angioplastia percutânea / revisão cirúrgica.

  Hidronefrose do Enxerto:
    Pelve >15 mm = hidronefrose significativa.
    Causas: edema do ureter neo-implantado (precoce, autolimitado), estenose ureteral,
    fistula urinária, compressão por linfocele.
    → Avaliação nefrológica + considerar nefrostomia percutânea de alívio se grave.

  Linfocele / Coleção Peri-Enxerto:
    Coleção anecoica adjacente ao rim transplantado, comprimindo ureter.
    Linfocele: anecoica simples, frequente (10–15% dos transplantes).
    Hematoma: ecos internos, pós-operatório imediato.
    Urinoma: suspeita por localização periureteral.
    → Drenagem percutânea US-guiada se volumosa ou obstrutiva.

B. NEFRECTOMIA — AVALIAÇÃO CONTRALATERAL
───────────────────────────────────────────────────────────────
RIM ÚNICO (nefrectomia prévia ou rim ectópico único):
  IR do rim remanescente: pode ser fisiologicamente elevado (hipertrofia compensatória).
  Dilatação do sistema coletor: mesmo mínima, merece atenção (maior risco obstrutivo).
  → Qualquer hidronefrose em rim único = N3/N4 — avaliação urológica imediata.

C. NEFROPATIA DIABÉTICA — PROTOCOLO DOPPLER
───────────────────────────────────────────────────────────────
ACHADOS DOPPLER NA NEFROPATIA DIABÉTICA:
  Fase inicial (hiperfiltração): rins aumentados (>12 cm), IR normal ou reduzido.
  Fase intermediária: IR crescente (0,70–0,80), hiperecogenicidade cortical.
  Fase avançada (DRC): rins menores, IR >0,80, ecogenicidade cortical = ou > hepática.
  Fase terminal: rins <7 cm, parênquima indiferenciado, IR >0,80 ou até >0,90.

CORRELAÇÃO CLÍNICA:
  IR >0,80 + DM tipo 2 + microalbuminúria: nefropatia diabética avançada.
  → Nefrologia + intensificação do controle glicêmico + IECA/BRA.

D. HIPERTENSÃO NEFROVASCULAR — PROTOCOLO COMPLETO
───────────────────────────────────────────────────────────────
INDICAÇÕES DE INVESTIGAÇÃO (Doppler renal indicado):
  HAS resistente (não controlada com ≥3 drogas incluindo diurético).
  HAS de início súbito <30 anos (fibrodisplasia muscular) ou >55 anos (aterosclerose).
  Deterioração da função renal após início de IECA/BRA.
  Rim assimétrico (diferença >1,5 cm).
  Sopro paraumbilical.

PROTOCOLO DE MEDIDAS:
  VPS artéria renal: medir ao hilo renal em ângulo <60°.
    Normal: <180 cm/s. Suspeito: >180 cm/s. Diagnóstico: >200 cm/s com turbilhonamento.
  RAR (relação reno-aórtica): VPS renal / VPS aorta.
    Normal: <3,5. Diagnóstico: >3,5.
  Critérios intraparenquimatosos indiretos:
    TA (tempo de aceleração) >70 ms = padrão tardus-parvus.
    IR assimétrico (diferença entre rins >0,05) = suspeita ipsilateral.

N3/N4 ESTENOSE DE ARTÉRIA RENAL:
  Conclusão modelo: "Achados ao Doppler sugestivos de estenose hemodinamicamente significativa
  da artéria renal [direita/esquerda] (VPS [X] cm/s, RAR [X], padrão tardus-parvus no parênquima
  ipsilateral). Confirmação recomendada por angiotomografia ou angio-RM renal."

E. OBSERVAÇÕES METODOLÓGICAS — RINS E VIAS URINÁRIAS COM DOPPLER
───────────────────────────────────────────────────────────────
OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia dos rins com Doppler espectral tem sensibilidade de 85–90% para estenose
da artéria renal hemodinamicamente significativa quando os troncos principais são adequadamente
insonados, mas a avaliação direta dos troncos é tecnicamente limitada em 20–40% dos pacientes
por interposição gasosa. Os critérios indiretos (TA >70 ms, IR assimétrico, padrão tardus-parvus)
têm sensibilidade de 75–80% para estenose proximal >60%. O índice de resistência intraparenquimatoso
varia com frequência cardíaca, pressão arterial e estado volêmico — medidas em bradicardia intensa
ou hipovolemia podem falsamente elevar o IR. No transplante renal, ausência de fluxo arterial ao
Doppler é emergência até prova em contrário — excluir artefato técnico antes de declarar trombose
(ajustar PRF, mudar abordagem), mas acionar cirurgia imediatamente. A angio-TC (padrão-ouro para
estenose renal) e a angio-RM (sem radiação — preferível em jovens e grávidas) são mandatórias para
confirmação diagnóstica antes de qualquer intervenção vascular renal.`;

// ────────────────────────────────────────────────────────────────────────────
// BUILD OUTPUT
// ────────────────────────────────────────────────────────────────────────────
const output = [
  abdomeSup,
  abdomeSupDoppler,
  abdomeTotal,
  abdomeTotalDoppler,
  prostata,
  rinsVU,
  rinsVUDoppler,
];

// Keep only id + aiInstructions for import (existing templates — update only)
const forImport = output.map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/mi-templates.json', JSON.stringify(forImport, null, 2), 'utf8');

console.log('Medicina Interna — FINAL BUILD:');
for (const t of output) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${(t.name || t.id).padEnd(40)} ${n} chars`);
}
console.log('\nOutput: scripts/mi-templates.json');
