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

// ── Reumatológico template IDs ────────────────────────────────────────────
const IDS = {
  PERIFERICAS: 'reumatologico-articulacoes-perifericas', // ARTICULAÇÕES PERIFÉRICAS 18127 (ph4)
  SACROILIAC:  'reumatologico-sacroiliacas',             // SACROILÍACAS             13381 (ph4 — CURTO!)
  PDUS28:      'reumatologico-pdus28',                   // PDUS-28                  15234 (ph4)
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: SACROILÍACAS (13381 → 19k+) ──────────────────────────────
templates.SACROILIAC.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — SACROILÍACAS AVANÇADO

### 6. TÉCNICA DE AQUISIÇÃO DETALHADA
─────────────────────────────────────────────────────────────
POSICIONAMENTO:
  Decúbito prono. Transdutor convexo 2–6 MHz (linear 5–9 MHz em pacientes magros).
  Profundidade: 8–12 cm. Foco na articulação sacroilíaca (ASI).
  PRF: 500–700 Hz (capturar fluxo lento sinovial). Ganho PD: mínimo para evitar artefatos.

CORTES OBRIGATÓRIOS:
  Longitudinal oblíquo: ao longo do maior eixo da ASI — permite avaliar sinovial posterior.
  Transversal oblíquo: corte perpendicular à ASI — avalia espessura da interlinha.
  Bilateral sistemático: sempre comparar ASI direita vs. esquerda.

ESTRUTURAS IDENTIFICADAS:
  Sacro (médio) e ilíaco (lateral): córtex ósseo hiperecóico bilateral.
  Interlinha articular: espaço entre os córtex, normal <4 mm.
  Cápsula articular posterior: fina linha hiperecóica periferia da ASI.
  Ligamentos sacroilíacos posteriores: espessas bandas hiperecóicas (não confundir com sinovial).

LIMITAÇÕES DO US:
  Apenas a porção POSTERIOR e INFERIOR da ASI é acessível ao US.
  Porção ANTERIOR e porção superior: não avaliáveis ao US.
  RM de pelve com gadolínio é o padrão-ouro para sacroiliíte ativa e crônica.
  US é exame COMPLEMENTAR — não substitui RM quando há suspeita de SpA.

### 7. ACHADOS NORMAIS vs. SACROILIÍTE
─────────────────────────────────────────────────────────────
ARTICULAÇÃO SACROILÍACA NORMAL:
  Interlinha regular, simétrica bilateralmente.
  Córtex ósseo liso, hiperecóico, contínuo.
  Ausência de espessamento sinovial ou derrame pericapsular.
  PD negativo (sem sinal intraarticular).
  Largura da interlinha <4 mm.

SACROILIÍTE ATIVA (achados US — EULAR/ASAS):
  Espessamento sinovial hipoecóico intraarticular (sinovite).
  POWER DOPPLER POSITIVO intraarticular: achado mais específico de sacroiliíte ativa ao US.
  Derrame articular (raro, pequena quantidade anecoica/hipoecóica pericapsular).
  Irregularidade do córtex ósseo ilíaco (erosão inicial).

SACROILIÍTE CRÔNICA / ESTRUTURAL:
  Esclerose subondral: córtex hiperecóico espessado e irregular.
  Erosões ósseas: descontinuidade do córtex em dois planos perpendiculares.
  Anquilose: fusão óssea — sem espaço articular identificável.
  PD NEGATIVO em fase crônica (inflamação resolvida, dano estrutural residual).

### 8. CLASSIFICAÇÃO ASAS E ESPONDILOARTROPATIAS
─────────────────────────────────────────────────────────────
CRITÉRIOS ASAS PARA SpA AXIAL (2009 — modificados):
  ENTRADA: lombalgia crônica ≥3 meses, início <45 anos.
  VIA IMAGEM: sacroiliíte na RM (edema ósseo) OU ao US (PD ativo + EULAR).
    + ≥1 característica de SpA.
  VIA CLÍNICA: HLA-B27 positivo + ≥2 características de SpA.

CARACTERÍSTICAS DE SpA (ASAS):
  Dor lombar inflamatória (melhora com exercício, piora repouso, dor noturna).
  Artrite periférica (oligoartrite assimétrica de MMII).
  Entesite (Aquiles, plantar).
  Uveíte anterior.
  Dactilite.
  Psoríase.
  Doença de Crohn / Colite ulcerativa.
  HLA-B27 positivo.
  PCR elevada.
  Resposta a AINE.
  Familiar com SpA.

ESPONDILITE ANQUILOSANTE (EA):
  Sacroiliíte BILATERAL e SIMÉTRICA (critério modificado de Nova York).
  US: PD ativo bilateral, erosões bilaterais, alargamento bilateral da interlinha.
  Progressão: sacroiliíte → sindesmófitos → coluna em "bambu" (RM/RX).

SpA INDIFERENCIADA:
  Sacroiliíte ASSIMÉTRICA ou UNILATERAL ao US.
  Entesite periférica proeminente.
  Artrite periférica sem padrão definitivo de EA.

ARTRITE PSORIÁSICA (APs — sacroilíacas):
  Sacroiliíte ASSIMÉTRICA ou unilateral.
  Associada a psoríase cutânea/ungueal confirmada.
  Diferencia EA (bilateral simétrica) de APs (assimétrica).

### 9. POWER DOPPLER NAS SACROILÍACAS — Protocolo
─────────────────────────────────────────────────────────────
CONFIGURAÇÃO DO PD PARA ASI:
  PRF: 500–700 Hz (fluxo sinovial muito lento).
  Ganho: mínimo para detectar fluxo real sem artefato.
  Escala de cor: ajustar para mínima sensibilidade ao movimento respiratório.

INTERPRETAÇÃO DO PD:
  PD 0: sem sinal intraarticular = inflamação ausente.
  PD 1: 1–3 focos puntiformes na sinovial = suspeito.
  PD 2: múltiplos focos confluentes <50% da sinovial = sacroiliíte ativa.
  PD 3: confluência >50% = sacroiliíte ativa grave.

PD ≥1 BILATERAL: muito sugestivo de EA ativa → N3 → RM pelve + reumatologista.
PD ≥1 UNILATERAL: sugere SpA ou infecção (ASI séptica excluir) → N3.

### 10. ARTRITE SÉPTICA DA SACROILÍACA
─────────────────────────────────────────────────────────────
CONTEXTO: rara, mas grave. Confunde com sacroiliíte inflamatória.
FATORES DE RISCO: imunossupressão, usuário de drogas IV, gravidez, pós-parto,
  procedimentos urológicos, septicemia.

ACHADOS US:
  Derrame volumoso (>4 mm) com debris e ecos internos espessos.
  PD periférico (capsular) — diferente do sinovial central da SpA.
  Coleção periarticular hipoecoica (abscesso).
  Bacteremia prévia conhecida + dor lombar aguda unilateral.

→ ATIVAR R6: "ALERTA: artrite séptica da sacroilíaca suspeita — avaliação
  ortopédica urgente, hemoculturas, ATB IV e drenagem cirúrgica se abscesso."

### 11. ENTESITE PÉLVICA E INSERCIONAL
─────────────────────────────────────────────────────────────
ENTESES DA REGIÃO PÉLVICA E ADJACENTES:
  Ilíaco (crista ilíaca): inserção de músculos abdominais.
  Espinha ilíaca ântero-superior (EIAS): inserção do sartório.
  Espinha ilíaca ântero-inferior (EIAI): inserção do reto femoral.
  Trocânter maior: inserção do glúteo médio e mínimo.
  Ísquio: inserção dos isquiotibiais.
  Ligamento sacroilíaco posterior: espessamento em sacroiliíte crônica.

ENTESITE PÉLVICA NA EA:
  Entesite do trocânter maior com PD: muito comum na EA ativa.
  Entesite dos isquiotibiais: dor glútea crônica — ExA periférica.
  → Incluir avaliação das enteses pélvicas no exame de sacroilíacas.

### 12. MONITORAMENTO TERAPÊUTICO
─────────────────────────────────────────────────────────────
AVALIAÇÃO PÓS-INÍCIO DE BIOLÓGICO (anti-TNF, IL-17, IL-23):
  Redução do PD sinovial nas ASI = resposta ao tratamento.
  PD de grau 2-3 para grau 0-1 em 12 semanas = remissão US (ASAS remissão).
  PD persistente após 6 meses = falha terapêutica → troca de biológico.
  Frequência de controle: basal → 3 meses → 6 meses → anual.

FRASEOLOGIA DE CONTROLE:
  Remissão: "PD negativo bilateralmente nas ASI — remissão por imagem ao US.
    Correlação com critérios ASAS de remissão clínica."
  Resposta parcial: "Redução do sinal de PD de grau [X] para grau [Y] — resposta parcial.
    Reumatologista para avaliação da necessidade de ajuste terapêutico."`;

// ── EXPANSÃO 2: PDUS-28 (15234 → 19k+) ───────────────────────────────────
templates.PDUS28.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — PDUS-28 AVANÇADO

### 6. PROTOCOLO DE 28 ARTICULAÇÕES — MAPA COMPLETO
─────────────────────────────────────────────────────────────
ARTICULAÇÕES DO PDUS-28 (bilateral — 14 pares = 28 articulações):
  OMBROS (2):       ombro D + ombro E.
  COTOVELOS (2):    cotovelo D + cotovelo E.
  PUNHOS (2):       punho D + punho E.
  MCF 2-5 (8):      MCF2-5 D + MCF2-5 E.
  IFP 2-5 (8):      IFP2-5 D + IFP2-5 E.
  JOELHOS (2):      joelho D + joelho E.
  Total: 28 articulações.

SCORES POR ARTICULAÇÃO:
  Cinza (Gray Scale — GS): 0-3 por articulação. Total máximo: 84 pontos.
  Power Doppler (PD): 0-3 por articulação. Total máximo: 84 pontos.
  Score composto (GS + PD): máximo 168 pontos.

RELATAR:
  GS total (soma das 28 articulações), GS por articulação (quando indicado).
  PD total (soma das 28 articulações), PD por articulação.
  Articulações com GS ≥2 e/ou PD ≥1 = articulações "ativas".

### 7. JANELAS DE AVALIAÇÃO POR ARTICULAÇÃO
─────────────────────────────────────────────────────────────
OMBRO:
  Janela anterior: recessão anterior subcoracoide (paciente sentado, braço em rotação neutra).
  Janela posterior: recessão posterior glenoumeral.
  Sinovite: espessamento sinovial entre o subescapular e o coracoide (anterior)
    ou entre o infraespinhoso e o lábio (posterior).
  PD no recesso glenoumeral = sinovite ativa.

COTOVELO:
  Janela posterior: recessão do olecrânio.
  Sinovite: derrame posterior olecraneano (paciente com cotovelo a 90°).
  Mensurar: espessura do líquido sinovial no recessso olecraneano.

PUNHO:
  Janela dorsal radiocarpal + intercarpal + radioulnar distal (RUD).
  Sinovite: espessamento sinovial no tendão extensor / recessos dorsais.
  PD na bainha tendinosa dos extensores = tenossinovite = sinovite EULAR.

MCF (2ª a 5ª — dorsal):
  Janela dorsal (padrão PDUS-28): transdutor no dorso, entre os tendões extensores.
  Sinovite: espessamento entre a cabeça do metacarpo e a base da falange proximal.
  PD na cápsula MCF = inflamação ativa.
  MCF 2ª é a mais frequentemente afetada na AR.

IFP (2ª a 5ª — dorsal):
  Janela dorsal: espessamento sinovial na recessão central dorsal da IFP.
  IFD EXCLUÍDA do PDUS-28 (IFD é avaliada nas artrites soronegativas/psoriásica).

JOELHO:
  Janela suprapatelar: transdutor longitudinal no recesso suprapatelar (joelho estendido).
  Sinovite: espessamento sinovial no recesso + derrame (altura >4 mm).
  PD no recesso suprapatelar = sinovite ativa do joelho.

### 8. REMISSÃO US E ATIVIDADE DA DOENÇA
─────────────────────────────────────────────────────────────
DEFINIÇÃO DE REMISSÃO US (EULAR/OMERACT):
  PD = 0 em TODAS as 28 articulações avaliadas.
  GS 0 ou 1 em TODAS as articulações (GS ≥2 = não está em remissão).
  Remissão US total: GS total ≤4 + PD total = 0.

ATIVIDADE RESIDUAL (achado importante):
  PD ≥1 em ≥1 articulação em paciente clinicamente em remissão clínica:
  = "remissão clínica com atividade subclínica" → risco de flare → ajuste terapêutico.
  PD ≥1 em ≥1 articulação prediz recaída após redução de biológico.

ESTRATÉGIA TREAT-TO-TARGET (T2T):
  Meta: remissão por imagem (PD = 0 em todos) OU baixa atividade.
  Falha T2T: PD ≥2 em ≥3 articulações após 3-6 meses = trocar/intensificar DMARD.

### 9. VARIAÇÕES DO PROTOCOLO PDUS
─────────────────────────────────────────────────────────────
PDUS-7 (versão simplificada — Backhaus et al.):
  Apenas 7 articulações: punho D, MCF2 D, MCF3 D, IFP2 D, joelho D,
    MTP2 D, MTP5 D.
  Vantagem: mais rápido; boa correlação com PDUS-28 em AR.
  Uso: triagem rápida, controles frequentes.

PDUS-12 (versão intermediária):
  12 articulações bilaterais simétricas.
  Equilíbrio entre abrangência e tempo de exame.

PROTOCOLO DE MÃOS E PUNHOS (US-7 Mãos):
  Punhos bilateral + MCF bilateral 2-5 + IFP bilateral 2-5.
  Uso: AR predominantemente de mãos.

PDUS ESPONDILOARTROPATIAS:
  Protocolo diferente da AR: enteses + ASI + articulações periféricas de MMII.
  Articulações de MMII (joelho, tornozelo, MTF) > MMSS na SpA periférica.

### 10. INTERPRETAÇÃO CLÍNICA E RESPOSTA TERAPÊUTICA
─────────────────────────────────────────────────────────────
CORRELAÇÃO COM ATIVIDADE CLÍNICA:
  DAS28 clínico alto + PDUS-28 alto = doença ativa confirmada → escalar tratamento.
  DAS28 baixo + PDUS-28 alto = atividade subclínica → não reduzir DMARD.
  DAS28 alto + PDUS-28 baixo = DAS elevado por outras causas (fibromialgia, osteoartrose).
    → NÃO escalar biológico baseado apenas no DAS28.
  DAS28 baixo + PDUS-28 baixo = remissão verdadeira → redução progressiva possível.

MONITORAMENTO EM BIOLÓGICOS:
  Controle basal (antes de iniciar biológico): GS total + PD total.
  Controle 3 meses: avaliar redução de PD (resposta precoce).
  Controle 6 meses: decisão terapêutica definitiva.
  Resposta: PD total cai ≥50% do basal = boa resposta.
  Falha: PD total mantém ou aumenta = troca de mecanismo de ação.

PROTOCOLO DE REDUÇÃO/SUSPENSÃO DE BIOLÓGICO:
  US pré-redução: PD = 0 obrigatório para tentar redução.
  US em 6 meses após redução: detectar reativação (PD ≥1).
  Reativação: retornar à dose plena.

### 11. FRASEOLOGIA COMPLETA — PDUS-28
─────────────────────────────────────────────────────────────
Remissão por imagem:
  "PDUS-28 realizado. Score de sinovite (escala de cinza): [X]/84 pontos.
  Score de Power Doppler: 0/84 pontos. Ausência de sinal PD em todas as
  articulações avaliadas. Achados compatíveis com remissão por imagem
  (EULAR/OMERACT). Correlação clínica com equipe de reumatologia."

Atividade moderada:
  "PDUS-28 realizado. Score GS total: [X]/84. Score PD total: [X]/84.
  Articulações com PD ≥1: [listar]. Articulações com GS ≥2: [listar].
  Achados compatíveis com atividade inflamatória [leve/moderada/acentuada].
  Correlação com reumatologista para ajuste terapêutico."

Atividade subclínica:
  "PDUS-28 realizado. Paciente em remissão clínica reportada. Identificada
  atividade subclínica: PD grau [X] em [articulação]. Score PD total: [X].
  Atividade residual que pode predizer recaída após redução de biológico.
  Reumatologista para decisão terapêutica."`;

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/reuma-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nReumatológico template sizes:');
const names = {
  PERIFERICAS: 'ARTICULAÇÕES PERIFÉRICAS     ',
  SACROILIAC:  'SACROILÍACAS                 ',
  PDUS28:      'PDUS-28                      ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
