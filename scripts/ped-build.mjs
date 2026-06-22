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

// ── Pediatria template IDs ────────────────────────────────────────────────
const IDS = {
  TRANSFONT:  'MtTMoVr6Vi11fFLGCjxe',             // TRANSFONTANELA           20451 (base)
  COLUNA:     '1Wd6YKr4yuFgJx4lgJJn',             // COLUNA LOMBOSSACRA       13622 (base — CURTO!)
  ABDOME:     'nRoALtsmbqfFWo47RUZm',             // ABDOME TOTAL PEDIÁTRICO  20200 (base)
  RINS:       '6vk0bFxtwwXn2cyLXLD7',             // RINS E VU PEDIÁTRICO     21222 (base)
  QUADRIL:    'pediatria-quadril-pediarico-ddq',  // QUADRIL DDQ              15818 (ph4)
  ESCROTO:    'pediatria-escroto-agudo',           // ESCROTO AGUDO            16497 (ph4)
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: COLUNA LOMBOSSACRA (13622 → 19k+) ────────────────────────
templates.COLUNA.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — COLUNA LOMBOSSACRA PEDIÁTRICA

### 6. PROTOCOLO DE AQUISIÇÃO DETALHADO
─────────────────────────────────────────────────────────────
INDICAÇÃO CLÍNICA MAIS COMUM:
  Rastreamento de disrafismo espinhal oculto em lactentes com:
  • Fosseta sacrococcígea atípica
  • Tufo de pelos sacral (fauno's tail)
  • Hemangioma sacral
  • Desvio da prega interglútea
  • Assimetria glútea
  • Síntomas de disfunção vesical/retal (incontinência/retenção)
  • Pé cavo ou deformidade de membro inferior sem causa aparente

TÉCNICA DETALHADA:
  Posição: decúbito ventral, abdome sobre coxim macio (10–15° de flexão lombar).
  Transdutor: linear 7–15 MHz para lactentes <3 meses; menor frequência em maiores.
  Corte longitudinal medial: coluna inteira L1 a S3.
  Corte longitudinal paramedial: medula + raízes saindo lateralmente.
  Corte transversal: nível por nível (L2–S3) identificando o cone e canal vertebral.
  Janela acústica ideal: antes dos 3 meses (ossificação progressiva a partir de 8–12 semanas).

MARCO DE OSSIFICAÇÃO:
  <3 meses: janela excelente, medula completamente visível.
  3–6 meses: janela degrada progressivamente; ainda possível.
  >6 meses: geralmente inadequada para avaliação do canal.
  RM espinhal: exame de confirmação para todos os achados positivos ou suspeitos.

### 7. MEDULA ESPINHAL — AVALIAÇÃO NORMAL DETALHADA
─────────────────────────────────────────────────────────────
CONE MEDULAR:
  Aspecto: estrutura ovóide/fusiforme hipoecoica com canal central hiperecóico.
  Mobilidade: o cone e a cauda equina oscilam com a respiração e com o choro
    (sinal de motilidade normal — ausência = ancoragem).
  Nível normal:
    RN a termo: até L2-L3 (pico de distribuição).
    3 meses: até L1-L2 (ascensão progressiva pelo crescimento vertebral).
    Após 3 meses: cone em L1-L2 = definitivo.
  CONE ABAIXO DE L2-L3 após 3 meses = anormal → suspeita SCA.

CAUDA EQUINA:
  Filamentos hipoecoicos oscilantes abaixo do cone.
  Padrão normal: movimento pendular livre e simétrico.

FILUM TERMINALE:
  Único filamento central, mais hiperecóico que as raízes nervosas, <2 mm.
  Localização: central, linha média, sem desvio.
  Hiperecogenicidade excessiva + espessamento = gordura intrínseca (filum lipomatoso).

CANAL VERTEBRAL (transversal):
  Seção elíptica com dois arcos hiperecoicos laterais (pedículos) e corpo anterior.
  Normal: espaço subdural anecoico ao redor da medula.
  Liquor normalmente anecoico com pontos finos oscilantes (pulsação).

### 8. DISRAFISMO ESPINHAL OCULTO — ACHADOS ESPECÍFICOS
─────────────────────────────────────────────────────────────
SÍNDROME DO CORDÃO ANCORADO (SCA) — PROTOCOLO DIAGNÓSTICO:
  CRITÉRIO PRIMÁRIO: cone medular abaixo de L2-L3 (após 3 meses).
  CRITÉRIOS SECUNDÁRIOS:
    a) Filum terminale espessado (>2 mm).
    b) Filum lipomatoso (filum hiperecóico espessado = gordura).
    c) Filum rígido (ausência de oscilação dinâmica).
    d) Cone baixo + filum desviado da linha média.
  DIAGNÓSTICO DEFINITIVO: cone baixo + critério secundário + clínica compatível.
  RM de coluna: confirma lipoma, extensão e relação com estruturas nervosas.
  → N3 → neurocirurgia pediátrica.
  Conduta cirúrgica: desancoramento eletivo antes dos sintomas neurológicos.

LIPOMIELOMENINGOCELE / LIPOMA INTRADURAL:
  Massa hiperecóica (gordurosa) no canal vertebral posterior ao cone medular.
  Pode ter extensão subcutânea (lipoma subcutâneo conectado por defeito fascial).
  Associa cone medular baixo por ancoragem.
  Classificar por extensão: intradural isolado vs. lipomielomeningocele.
  → N3/N4 → neurocirurgia pediátrica (ressecção eletiva).

ESPINHA BÍFIDA OCULTA — TIPOS:
  Defeito do arco posterior: falha de fusão dos processos espinhosos visível
    como interrupção hipoecoica no arco posterior. Pele íntegra.
  Seio dérmico (dermoid sinus): trajeto hipoecoico tubular da pele até o canal.
    Risco de infecção intradural → N3 → neurocirurgia (excisão preventiva).
  Diastematomielía: medula dividida em dois hemicordões por esporão ósseo/fibroso.
    Dois cordões medulares em plano transversal. RM confirmatório. → N3.

MENINGOCELE / MIELOMENINGOCELE (raras ao US pediátrico pós-natal):
  Meningocele: saco meníngeo posterior sem medula. Raiz de saída visível.
  MMC: saco com placa medular exposta. Diagnóstico pré-natal usual.
  US pós-natal: avalia hidrocefalia associada (Chiari II) e medula residual.

TERATOMA SACROCOCCÍGEO (TSC):
  Massa mista (sólida + cística) na região sacral/presacral.
  Classificação Altman:
    I: predominantemente externo (>50%).
    II: externo + pequeno componente pélvico.
    III: pequeno externo + grande componente pélvico.
    IV: completamente presacral (intrapélvico) — não visível externamente.
  Neonatal: 95% benignos (imaturos/maduros). Após 2 meses: risco de malignização.
  Doppler: hipervascularização (TSC maligno) vs. pouco vascularizado (maduro).
  → ATIVAR N4 → cirurgia pediátrica + oncologia urgente.

### 9. FOSSETA SACROCOCCÍGEA — PROTOCOLO DIAGNÓSTICO
─────────────────────────────────────────────────────────────
CLASSIFICAÇÃO (decisão de solicitar US espinhal):

FOSSETA SIMPLES (baixo risco — NÃO necessita US):
  Localização: ≤2,5 cm do ânus (coccígea).
  Diâmetro: ≤5 mm.
  Fundo visível ao exame físico.
  Sem outros estigmas cutâneos.
  → Variante da normalidade. Informar ao médico solicitante.

FOSSETA ATÍPICA (alto risco — US INDICADO):
  Qualquer um dos seguintes:
  • Localização >2,5 cm do ânus (sacral verdadeira).
  • Diâmetro >5 mm.
  • Fundo não visível ao exame físico.
  • Outros estigmas cutâneos concomitantes (tufo, hemangioma, assimetria).
  • Fosseta dupla.
  → US espinhal obrigatório.

### 10. CONDIÇÕES NÃO NEUROLÓGICAS DA COLUNA
─────────────────────────────────────────────────────────────
COLUNA SACRAL EM AGENESIA SACRAL:
  Vértebras sacrais parcial ou totalmente ausentes.
  Medula termina abruptamente em nível variável.
  Associação com diabetes materno gestacional.
  → N3 → neuropediatria + neurocirurgia.

SACROCOCCÍGEO: SINUS PILONIDAL (adolescente):
  Seio infectado na região sacrococcígea posterior — coleção hipoecóica + PD periférico.
  Diferente de fosseta congênita: surge na adolescência (pelos corporais na fenda glútea).
  → N2 → cirurgia pediátrica/coloproctologia.

### 11. FRASEOLOGIA ESPECÍFICA — COLUNA PEDIÁTRICA
─────────────────────────────────────────────────────────────
Normal:
  "Medula espinhal tópica, com cone medular localizado em [nível], de aspecto e
  ecotextura normais. Filum terminale de calibre normal (≤2 mm), sem evidências
  de ancoragem. Cauda equina com mobilidade espontânea preservada."

SCA suspeito:
  "ATENÇÃO: cone medular localizado em [L3/L4], abaixo do nível esperado para
  a faixa etária, com filum terminale espessado ([X] mm) e [hiperecóico/rígido].
  Achados sugestivos de síndrome do cordão ancorado. Encaminhamento para
  neurocirurgia pediátrica + RM de coluna lombossacra para avaliação definitiva."

Fosseta simples:
  "Fosseta coccígea simples identificada, localizada a [X] mm do ânus, com
  fundo visível e calibre ≤5 mm. Medula e cone medular sem alterações.
  Variante da normalidade — acompanhamento pediátrico habitual."

Fosseta atípica com estudo normal:
  "Fosseta [sacral/coccígea atípica] identificada. Medula espinhal e cone
  medular sem alterações ao estudo ultrassonográfico atual. Filum terminale
  de calibre normal. Recomenda-se vigilância clínica e RM de coluna lombar
  se surgimento de sintomas neurológicos ou vesicais."`;

// ── EXPANSÃO 2: QUADRIL DDQ (15818 → 20k+) ───────────────────────────────
templates.QUADRIL.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — QUADRIL PEDIÁTRICO DDQ AVANÇADO

### 7. TÉCNICA DE AQUISIÇÃO DO CORTE DE GRAF — DETALHAMENTO
─────────────────────────────────────────────────────────────
POSICIONAMENTO CORRETO (crítico para reprodutibilidade):
  Criança: decúbito lateral com a pelve estável (não rotada).
  Anca em posição neutra (0° de rotação, leve flexão).
  Estabilização com cueiro ou auxiliar. Sem rotação da pelve.

CORTE PADRÃO DE GRAF (4 critérios de qualidade obrigatórios):
  1. Teto acetabular plano e horizontal (ilíaco aplanado).
  2. Lábio acetabular claramente visível (hiperecóico, triangular).
  3. Núcleo do acetábulo ósseo claramente delimitado.
  4. Ângulo do labrum (junção cartilagem/osso) nitidamente angulado.
  SE qualquer critério ausente → REPETIR — corte inaceitável para medição.

MEDIÇÃO DOS ÂNGULOS:
  Linha de base (L1): tangente ao ilíaco plano.
  Linha do teto ósseo (L2): do ponto angular ao lábio (borda do teto ósseo).
  Linha do teto cartilaginoso (L3): do ponto angular ao lábio fibrocartilagíneo.
  Ângulo ALFA (α): entre L1 e L2 (representa inclinação do teto ósseo).
  Ângulo BETA (β): entre L1 e L3 (representa cobertura cartilaginosa).

DOCUMENTAÇÃO FOTOGRÁFICA:
  Salvar imagem com linhas de medição sobrepostas para ambos os quadris.
  Medir bilateralmente mesmo que a suspeita seja unilateral.

### 8. CLASSIFICAÇÃO DE GRAF — VERSÃO COMPLETA COM CONDUTA
─────────────────────────────────────────────────────────────
TIPO Ia: α ≥60° + β <55° (lábio pontiagudo). Maduro. Normal. N0.
TIPO Ib: α ≥60° + β 55–77° (lábio mais plano). Maduro mas arredondado. N0.
  Nota: Ib não necessita controle; lábio mais plano é variante normal madura.

TIPO IIa: α 50–59° + β <55°. Imaturo FISIOLÓGICO (apenas <3 meses).
  Conduta: Controle US em 4–6 semanas (maturação espontânea esperada).
  Se α não melhorar em 6 semanas → reclassificar como IIb.

TIPO IIb: α 50–59° + β <55° (paciente >3 meses de idade óssea).
  Imaturo PATOLÓGICO — atraso de ossificação.
  Conduta: Ortopedia pediátrica → arnês de Pavlik. N2.

TIPO IIc: α 43–49° + β 55–77°. Deficiente — teto ósseo insuficiente.
  Lábio ainda centralizador (coveiro).
  Conduta: arnês de Pavlik imediato. N3.

TIPO D: α 43–49° + β >77°. Decentrado — cabeça começando a deslocar.
  Lábio empurrado lateralmente. Urgência.
  Conduta: arnês de Pavlik + ortopedia pediátrica urgente. N3.

TIPO III: α <43° + ausência de teto ósseo. Luxado sem reorientação.
  Subcategoria IIIa: sem deformidade estrutural do lábio.
  Subcategoria IIIb: lábio deformado por pressão crônica.
  Conduta: ortopedia pediátrica urgente → tração / cirurgia aberta. N4.

TIPO IV: α <43° + inversão do lábio labralmente (medialmente).
  Luxado grave com inversão. Pior prognóstico. N4.

### 9. PORCENTAGEM DE COBERTURA ACETABULAR
─────────────────────────────────────────────────────────────
TÉCNICA: medir a proporção da cabeça femoral coberta pelo acetábulo
  em corte padrão de Graf (corte coronal).
  PC = (diâmetro femoral medial ao lábio / diâmetro total femoral) × 100%.
Normal: ≥50% de cobertura.
50–60%: cobertura limítrofe — correlacionar com α e β.
<50%: subluxação — displasia ativa independente do α.
<25%: luxação evidente — N4 urgente.

### 10. CONTROLE DE TRATAMENTO COM ARNÊS DE PAVLIK
─────────────────────────────────────────────────────────────
AVALIAÇÃO DURANTE TRATAMENTO:
  Frequência: US quinzenal nos primeiros 2 meses → mensal até consolidação.
  Avaliar: posição da cabeça femoral + α + cobertura + profundidade do acetábulo.
  Melhora esperada: aumento progressivo de α (idealmente +3° por semana).
  Falha do arnês de Pavlik: sem melhora em 3–4 semanas → cirurgia.

MARCADORES DE SUCESSO:
  Cabeça femoral centralizada (>50% cobertura).
  Tipo IIa → Tipo I em 6–12 semanas.
  Nenhuma sinal de necrose avascular (NAV) — cabeça homogênea, sem colapso.

COMPLICAÇÃO — NECROSE AVASCULAR (NAV) DA CABEÇA FEMORAL:
  Cabeça femoral heterogênea, compressão ou aplanamento.
  Risco aumentado com hiperabdução forçada no arnês.
  → N4 → ortopedia pediátrica (suspender arnês imediatamente).

### 11. DIAGNÓSTICOS DIFERENCIAIS NO QUADRIL PEDIÁTRICO
─────────────────────────────────────────────────────────────
SINOVITE TRANSITÓRIA (mais comum 3–10 anos):
  Derrame articular: líquido anecoico no recesso anterior (>2 mm).
  Causa: pós-viral. Sem febre alta/leucocitose.
  Conduta: repouso + AINE + controle em 2 semanas.
  CRIANÇA COM FEBRE + DERRAME → excluir artrite séptica (EMERGÊNCIA).
  Critérios de Kocher (artrite séptica vs. sinovite):
    • Febre >38,5°C • Não apoio o membro • VHS >40 mm/h • Leucócitos >12.000.
    3–4 critérios → artrite séptica (dreno cirúrgico urgente) → ATIVAR R6.

DOENÇA DE LEGG-CALVÉ-PERTHES (LCP — 4–10 anos, mais em meninos):
  Necrose avascular isquêmica idiopática da epífise femoral.
  US: epífise irregular, achatada, hipoecóica + derrame articular.
  Doppler: fluxo ausente ou muito diminuído na epífise (isquemia ativa).
  RM: padrão ouro para estadiamento (Herring/Catterall).
  → N3 → ortopedia pediátrica (reabilitação longa, 18–24 meses).

EPIFISIOLISE DA CABEÇA FEMORAL (ECF — 10–14 anos):
  Deslizamento da epífise femoral na fise (placa de crescimento) em posterior e medial.
  Perfil: adolescente com sobrepeso/obesidade + dor ou coxalgia.
  US: limitado — radiografia (frog-leg) é diagnóstica.
  RM: avaliação de deslizamento e necrose avascular.
  → N3 (estável) ou ATIVAR R6 (instável — fixação cirúrgica urgente).

ARTRITE IDIOPÁTICA JUVENIL (AIJ):
  Derrame articular recorrente + sinovite ao Doppler.
  Sinovial espessada + PD ativo.
  → N3 → reumatologia pediátrica.

### 12. FRASEOLOGIA COMPLETA — QUADRIL DDQ
─────────────────────────────────────────────────────────────
Quadril bilateral normal:
  "Quadril direito: tipo I de Graf, alfa = [X]°, beta = [X]°. Porcentagem de
  cobertura da cabeça femoral: [X]%. Quadril esquerdo: tipo I de Graf, alfa = [X]°,
  beta = [X]°. Cobertura: [X]%. Ambos os quadris apresentam maturidade acetabular
  adequada para a faixa etária."

Displasia unilateral:
  "Quadril [D/E]: tipo [IIb/IIc] de Graf — alfa = [X]°, beta = [X]°. Cobertura
  da cabeça femoral: [X]% — reduzida. Achados sugestivos de displasia do
  desenvolvimento do quadril. Encaminhamento para ortopedia pediátrica
  para avaliação de arnês de Pavlik. Quadril contralateral: tipo I, normal."

Luxação:
  "URGÊNCIA: quadril [D/E] tipo [III/IV] de Graf — alfa = [X]°. Cabeça femoral
  descentrada, cobertura <25%. Luxação confirmada. Encaminhamento urgente para
  ortopedia pediátrica. Quadril contralateral: [achado]."

Sinovite:
  "Derrame articular do quadril [D/E]: espessura [X] mm no recesso anterior.
  Sem sinais de artrite séptica ao estudo atual (ausência de espessamento sinovial
  hipervascularizado). Compatível com sinovite transitória. Correlação clínica
  com temperatura, hemograma e VHS/PCR recomendada."`;

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/ped-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nPediatria template sizes:');
const names = {
  TRANSFONT: 'TRANSFONTANELA               ',
  COLUNA:    'COLUNA LOMBOSSACRA           ',
  ABDOME:    'ABDOME TOTAL PEDIÁTRICO      ',
  RINS:      'RINS E VIAS URINÁRIAS PED.   ',
  QUADRIL:   'QUADRIL PEDIÁTRICO — DDQ     ',
  ESCROTO:   'ESCROTO AGUDO PEDIÁTRICO     ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
