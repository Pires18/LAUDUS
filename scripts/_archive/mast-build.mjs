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

// ── Mastologia template IDs ───────────────────────────────────────────────
const IDS = {
  MAMAS:   'EB9infqCigaUYfmvfQic',            // MAMAS                 16499 (base)
  DOPPLER: 'pXpW775Kztag5WdHYyUQ',            // MAMAS COM DOPPLER     18194 (base)
  LINF:    'mastologia-linfonodos-axilares',   // LINFONODOS AXILARES   14964 (ph4)
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: MAMAS (16499 → 20k+) ─────────────────────────────────────
templates.MAMAS.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — MAMAS AVANÇADO

### 8. RASTREAMENTO MAMÁRIO — PROTOCOLO DE INDICAÇÃO
─────────────────────────────────────────────────────────────
INDICAÇÕES DO US MAMÁRIO:
  Complementação de mamografia (ACR C/D — tecido denso BIRADS c/d).
  Avaliação de achado palpável com mamografia negativa.
  Mulher <30 anos com achado clínico (US é 1ª escolha antes dos 30 anos).
  Gestante / Lactante (mamografia restrita).
  Avaliação de implantes mamários.
  Rastreamento de alto risco (BRCA1/2) em conjunto com RM.
  Guia de procedimentos (PAAF, core biopsy, drenagem).

US NÃO SUBSTITUI A MAMOGRAFIA:
  "Ultrassonografia mamária é método complementar à mamografia. Nódulos
  não identificados ao US não excluem patologia visível à mamografia,
  especialmente microcalcificações isoladas."

DENSIDADE MAMÁRIA (correlacionar com MMG):
  ACR a (predominantemente gordurosa): US menos sensível, MMG suficiente.
  ACR b (fibroglandular disperso): US moderadamente útil.
  ACR c (heterogeneamente denso): US complementar indicado.
  ACR d (extremamente denso): US obrigatório + considerar RM.

### 9. PROTOCOLO DE DESCRIÇÃO SISTEMÁTICA DO EXAME
─────────────────────────────────────────────────────────────
ESTRUTURA DO LAUDO (campos obrigatórios):
  1. Histórico clínico relevante: paridade, lactação, TH, cirurgias, queixa.
  2. Técnica: frequência do transdutor, lateralidade examinada, varredura sistemática.
  3. Composição mamária: parenquimatoso / fibroglandular / misto / gorduroso.
  4. Achados: descrever por mama, por quadrante, por posição horária.
  5. Linfonodos axilares: avaliar bilateralmente.
  6. Classificação BI-RADS por achado + BI-RADS global do exame.
  7. Conduta: específica por categoria BI-RADS.

LOCALIZAÇÃO PADRÃO DOS ACHADOS:
  Quadrante: QSE (quadrante superior externo) · QSI · QIE · QII · QC (central).
  Posição horária: 12h, 3h, 6h, 9h (em cada mama).
  Distância do mamilo: em cm.
  Profundidade: subcutâneo / parenquima anterior / médio / posterior / retroareolar.

### 10. TUMOR DE PHYLLODES — DISTINÇÃO DO FIBROADENOMA
─────────────────────────────────────────────────────────────
CARACTERÍSTICAS SUSPEITAS DE PHYLLODES (vs. fibroadenoma):
  Tamanho >3 cm (ou crescimento rápido além de 3 cm em meses).
  Espaços císticos internos irregulares (fissuras internas).
  Lobulações proeminentes.
  Heterogeneidade interna em nódulo previamente homogêneo.
  PD aumentado interno.
  → BI-RADS 3–4: core biopsy obrigatória (diferencia fibroadenoma de phyllodes).
  Phyllodes maligno: margens irregulares + crescimento muito rápido + metástase pulmonar.
  Excisão com margens amplas (≥1 cm) — diferente do fibroadenoma (enucleação).

### 11. CARCINOMA IN SITU (CDIS) — ACHADOS AO US
─────────────────────────────────────────────────────────────
CARCINOMA DUCTAL IN SITU (CDIS):
  US tem sensibilidade de 50–70% para CDIS (inferior à MMG).
  Achados quando visível:
  Calcificações em canal ductal dilatado.
  Canal ductal dilatado com conteúdo ecogênico ("sludge ductal").
  Espessamento periductal com PD interno.
  Massa hipoecóica irregular de limites imprecisos.
  CDIS de alto grau: associado a microcalcificações agrupadas — MMG obrigatória.

CARCINOMA LOBULAR IN SITU (CLIS):
  Frequentemente invisível ao US (lesão de densidade mamária sem massa).
  Achado incidental em biópsia por outra indicação.
  → US pouco útil para rastreamento de CLIS isolado.

### 12. LESÃO DE ALTO RISCO — CONDUTA
─────────────────────────────────────────────────────────────
LESÕES B3 (risco intermediário — biópsia cirúrgica ou VAB 11G recomendada):
  Hiperplasia ductal atípica (HDA): microcalcificações irregulares + células atípicas.
  Papiloma central: canal retroareolar dilatado + massa nodular intraluminal.
  Papiloma periférico: nódulo pequeno em ducto periférico.
  Cicatriz radiante / lesão esclerosante complexa.
  LCIS clássico: achado incidental.
  → BI-RADS não muda por B3 — a conduta cirúrgica é decisão do mastologista pós-biópsia.

PAPILOMA INTRADUCTAL (ao US):
  Canal ductal retroareolar dilatado (>2 mm) com nódulo sólido intraluminal.
  PD interno no nódulo: diferencia papiloma (PD+) de debris (PD-).
  BI-RADS 4A se único e pequeno. BI-RADS 4B se múltiplos ou periféricos.
  Descarga papilar hemática: sempre investigar com US ductal + ductoscopia.

### 13. AVALIAÇÃO PÓS-TRATAMENTO ONCOLÓGICO
─────────────────────────────────────────────────────────────
PÓS-CIRURGIA CONSERVADORA (segmentectomia/quadrantectomia):
  Área de ressecção: irregularidade cicatricial hipoecóica na loja cirúrgica.
  Seroma pós-op: coleção anecoica na loja — comum, autolimitado.
  Clip metálico: foco hiperecóico com sombra na loja (marco cirúrgico).
  Recidiva local: nova massa sólida suspeita na loja ou adjacente → BI-RADS 4–5.

PÓS-MASTECTOMIA:
  Retalho cutâneo: avaliar espessura e regularidade.
  Implante de reconstrução: avaliar conforme protocolo de implantes.
  Recidiva em parede torácica: nódulo sólido hipoecóico subcutâneo → BI-RADS 4–5.
  Linfonodo axilar pós-esvaziamento: ausência de linfonodos no nível I é esperada.

PÓS-QUIMIOTERAPIA NEOADJUVANTE:
  Resposta completa: área hipoecóica residual ou ausência de massa visível.
  Resposta parcial: redução do tamanho + redução do PD interno.
  Sem resposta: massa estável ou progressiva → mudança de esquema.
  Clip de localização: marcador hiperecóico no sítio da lesão original (mesmo se "desapareceu").`;

// ── EXPANSÃO 2: LINFONODOS AXILARES (14964 → 19k+) ───────────────────────
templates.LINF.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — LINFONODOS AXILARES AVANÇADO

### 6. PROTOCOLO SISTEMÁTICO DE AVALIAÇÃO AXILAR
─────────────────────────────────────────────────────────────
TÉCNICA:
  Posição: decúbito dorsal com braço abduzido a 90° e mão sob a cabeça.
  Transdutor: linear 7–15 MHz.
  Varredura: da clavícula ao músculo peitoral maior (nível I–III), inferior para o
    músculo grande dorsal (limite inferior da axila).
  Avaliar bilateralmente — sempre comparar.

IDENTIFICAÇÃO POR NÍVEL (Berg):
  Nível I (axila baixa): lateral ao músculo peitoral menor; mais facilmente acessível.
  Nível II (axila média): posterior ao peitoral menor; requer compressão medial.
  Nível III (axila alta / infraclavicular): medial ao peitoral menor;
    transdutor na fossa infraclavicular.
  Cadeia mamária interna: paraesternal (não avaliável ao US convencional — TC/RM).

DOCUMENTAÇÃO OBRIGATÓRIA:
  Nível de cada linfonodo descrito.
  Maior eixo longo (mm) e menor eixo curto (mm).
  Espessura cortical máxima (mm).
  Aspecto do hilo: preservado / ausente / excêntrico.
  Padrão de vascularização ao PD: hilar (normal) / cortical (suspeito) / misto.

### 7. CRITÉRIOS DE NORMALIDADE E SUSPEIÇÃO
─────────────────────────────────────────────────────────────
LINFONODO NORMAL (todos os critérios):
  Forma oval ou "feijão" (relação L/T ≥2).
  Córtex uniforme ≤3 mm em toda a circunferência.
  Hilo gorduroso central preservado (hiperecóico, central, contínuo).
  PD: padrão hilar (fluxo apenas no hilo, divergindo para o córtex de forma ordenada).

CRITÉRIOS DE SUSPEIÇÃO (qualquer um):
  a) Espessura cortical focal ou difusa >3 mm.
  b) Hilo ausente (linfonodo totalmente hipoecoico — "aspecto arredondado").
  c) Hilo excêntrico ou deslocado pelo espessamento cortical.
  d) Forma arredondada: relação L/T <2 (perda do formato de feijão).
  e) PD cortical: vascularização no córtex em vez do hilo (neo-angiogênese metastática).
  f) Coalescência de linfonodos (massa conglomerada).

LINFONODO REATIVAMENTE AUMENTADO (benigno):
  Tamanho >1 cm mas córtex ≤3 mm + hilo preservado + PD hilar.
  Contexto: infecção recente, vacinação axilar ipsilateral, mastite.
  → BI-RADS 2 axilar. Correlação clínica.

LINFONODO METASTÁTICO:
  Típico: córtex >3 mm focal (engrossamento polar) + hilo deslocado.
  Avançado: linfonodo totalmente hipoecoico + sem hilo + PD cortical.
  → PAAF guiada por US para confirmação citológica.

### 8. CONTEXTO ONCOLÓGICO — ESTADIAMENTO AXILAR
─────────────────────────────────────────────────────────────
MAMA BI-RADS 4–5 + LINFONODO SUSPEITO:
  PAAF do linfonodo suspeito (antes da cirurgia) para:
  a) Confirmar N+ (metástase axilar).
  b) Planejar esvaziamento axilar vs. biópsia do linfonodo sentinela (LS).
  PAAF positiva (N+): esvaziamento axilar cirúrgico direto.
  PAAF negativa ou não realizada: biópsia do LS no intraoperatório.

CLIP NO LINFONODO PUNCIONADO:
  Colocar clip metálico no linfonodo PAAF positivo pré-quimioterapia.
  Após QT neoadjuvante: localização do linfonodo clipado para ressecção dirigida.

AVALIAÇÃO PÓS-QT NEOADJUVANTE:
  Resposta linfonodal completa: linfonodo volta ao aspecto normal (BI-RADS N0 axilar).
  Resposta parcial: redução do espessamento cortical.
  Sem resposta: linfonodo mantém características suspeitas.

ESVAZIAMENTO AXILAR PRÉVIO:
  Linfocele: coleção anecoica na loja axilar (comum pós-op, autolimitada).
  Síndrome de Stewart-Treves: angiosarcoma em linfedema crônico (raro, massa sólida vascular).
  Seroma axilar: coleção anecoica pós-esvaziamento — punção se volumosa/sintomática.

### 9. LINFONODO SENTINELA — AVALIAÇÃO PRÉ-OPERATÓRIA
─────────────────────────────────────────────────────────────
MAPEAMENTO PRÉ-OPERATÓRIO:
  US identifica o linfonodo suspeito para PAAF dirigida.
  NÃO substitui o mapeamento com linfonodo sentinela marcado com radioisótopo + azul patente.
  Porém: linfonodo suspeito ao US → PAAF direta → se positivo, evita LS intraoperatório.

VACINAÇÃO AXILAR IPSILATERAL (COVID-19 e outras):
  Causa linfonodomegalia reativa benigna dentro de 4–6 semanas pós-vacinação.
  Critérios benignos: córtex espessado difusamente, hilo preservado.
  Conduta: repetir US em 4–6 semanas (após resolução esperada).
  → NÃO biopsiar sem aguardar resolução temporal se contexto vacinal compatível.

### 10. OUTROS LINFONODOS DA REGIÃO AXILAR E ADJACENTE
─────────────────────────────────────────────────────────────
LINFONODO INTRAMAMÁRIO:
  Linfonodo dentro do parênquima mamário — benigno (BI-RADS 2) quando normal.
  Localização típica: QSE, quadrante superior externo, nível I.
  Aspecto: hilo preservado, córtex fino.
  Suspeito se: córtex espessado ou hilo ausente em contexto oncológico.

LINFONODO INFRACLAVICULAR (Nível III):
  Transdutor na fossa infraclavicular.
  Suspeito em contexto de metástase axilar avançada (N3 AJCC).
  → Estadiamento N3b (infraclavicular ipsilateral) — impacto no estadiamento TNM.

LINFONODO MAMÁRIO INTERNO:
  Paraesternal — NÃO acessível ao US convencional.
  Avaliado por TC de tórax ou PET-CT no estadiamento de CA de mama.

### 11. ACHADOS ESPECIAIS NA AXILA
─────────────────────────────────────────────────────────────
HIDRADENITE SUPURATIVA AXILAR:
  Múltiplos trajetos fistulosos subcutâneos + abscessos + linfonodos reativos.
  Contexto: doença crônica inflamatória da pele com história de episódios recorrentes.
  → N2/N3: dermatologista/cirurgião.

LIPOMA AXILAR:
  Massa ovalóide hiperecóica compressível, sem PD. BI-RADS 2.

CISTO EPIDÉRMICO DE INCLUSÃO:
  Cisto hipoecoico subcutâneo, avascular, com poro cutâneo visível.
  BI-RADS 2. Diferencial: linfonodo arredondado suspeito.

ABSCESSO AXILAR:
  Coleção hipoecóica com PD periférico + clínica infecciosa.
  → N3 → drenagem cirúrgica + ATB.

PSEUDOANEURISMA DA ARTÉRIA AXILAR:
  Massa pulsátil + sinal yin-yang ao PD. Pós-traumática ou pós-punção.
  → Compressão guiada por US ou trombina ecoguiada.

### 12. FRASEOLOGIA COMPLETA — LINFONODOS AXILARES
─────────────────────────────────────────────────────────────
Normal bilateral:
  "Linfonodos axilares bilaterais de aspecto habitual — ovóides, com hilo
  gorduroso preservado e córtex uniforme ≤3 mm. Ausência de linfonodomegalia
  ou características suspeitas de envolvimento neoplásico."

Linfonodo reativo (benigno):
  "Linfonodo axilar [D/E] nível [I/II] aumentado ([X]×[Y] mm), com hilo
  gorduroso preservado e córtex uniformemente espessado ([X] mm) — aspecto
  reativo. Correlação com contexto clínico (infecção/vacinação recente)."

Linfonodo suspeito:
  "Linfonodo axilar [D/E] nível [I/II/III] com espessamento cortical focal/difuso
  ([X] mm), [hilo ausente / excêntrico]. PD [cortical / misto]. Morfologia
  suspeita de envolvimento neoplásico. PAAF guiada por US recomendada no
  contexto clínico-oncológico."

Linfocele pós-operatória:
  "Coleção anecoica na loja axilar [D/E] de [X] mL, de aspecto compatível com
  linfocele pós-operatória. Sem sinais de infecção ao estudo atual.
  Acompanhamento clínico; punção aspirativa se sintomática."`;

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/mast-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nMastologia template sizes:');
const names = {
  MAMAS:   'MAMAS                        ',
  DOPPLER: 'MAMAS COM DOPPLER            ',
  LINF:    'LINFONODOS AXILARES          ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 14000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
