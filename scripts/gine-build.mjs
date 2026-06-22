import { readFileSync, writeFileSync } from 'fs';

// ── Source priority: phase3 > phase1 > base ──────────────────────────
const base   = JSON.parse(readFileSync('scripts/templates-improved.json',  'utf8'));
let   ph1    = []; try { ph1  = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8')); } catch {}
let   ph3    = []; try { ph3  = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}

const ph1Map = Object.fromEntries(ph1.map(t => [t.id, t]));
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));

function getLatest(id) {
  if (ph3Map[id]?.aiInstructions) return ph3Map[id].aiInstructions;
  if (ph1Map[id]?.aiInstructions) return ph1Map[id].aiInstructions;
  return base.find(t => t.id === id)?.aiInstructions || '';
}

// ── Ginecologia template IDs ──────────────────────────────────────────
const IDS = {
  TV:       'j1fIt6ICfaEsWrRwCnjB',  // PELVICO TRANSVAGINAL
  TV_DOP:   'rR4NfNgfrOnFiWiEhfa2',  // PELVICO TV COM DOPPLER
  VA:       'qzT7cw77f4OPP0xQgdwm',  // PELVICO VIA ABDOMINAL
  VA_DOP:   'EH2UVqi3koehkuu9dH3Z',  // PELVICO VA COM DOPPLER
  ENDO:     'OqKamU7OfwG9KCDNtiGF',  // PESQUISA DE ENDOMETRIOSE
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSION 1: PELVICO TRANSVAGINAL ────────────────────────────────
templates.TV.aiInstructions += `

═══════════════════════════════════════════════════════════════

### 7. COLO UTERINO — AVALIAÇÃO SISTEMÁTICA
**PROTOCOLO DE AVALIAÇÃO:**
*   **Dimensões:** Comprimento normal 3–4 cm (corte sagital). Colo curto (<2,5 cm fora da gestação) = anomalia.
*   **Canal endocervical:** Normal ≤3 mm. Espessamento ou conteúdo ≠ anecóico = investigar.
*   **Cistos de Naboth:** Formações anecoicas pequenas (<1 cm), múltiplas, na zona transformação. VARIANTE NORMAL (N1). Não alarmar. Se confluentes e volumosos: relatar descritivamente.
*   **Pólipo endocervical:** Formação ecogênica no canal endocervical, geralmente pediculada. Ao Doppler: pedículo vascular. N2 → avaliação ginecológica para polipectomia.
*   **Massa cervical suspeita:** Lesão hipoecoica irregular, perda da ecotextura normal, extensão ao paramétrio ao Doppler. N3 → encaminhamento oncológico urgente.
*   **Estenose cervical:** Canal não permeável ao instrumento → pode causar hematometra (conteúdo líquido na cavidade uterina com colo fechado).

═══════════════════════════════════════════════════════════════

### 8. GESTAÇÃO INICIAL E CONDIÇÕES AGUDAS OBSTÉTRICAS
*   **Escopo:** Este template cobre avaliação de gestação muito inicial (definição de localização e vitalidade) e condições de urgência ginecológica. Para acompanhamento obstétrico estabelecido, utilizar template específico.

**▸ CRITÉRIOS DE ABORTO RETIDO (relatar + ATIVAR R6):**
*   Saco gestacional (SG) ≥25 mm sem embrião visível (anel ovular vazio).
*   Comprimento céfalo-nádega (CCN) ≥7 mm sem batimentos cardíacos fetais (BCF).
*   Ausência de crescimento do SG em 11 dias (≥2 exames).
*   Achado suspeito: SG 16–24 mm sem embrião OU CCN 5–6 mm sem BCF em 1ª avaliação → CONTROLE em 7–11 dias antes de confirmar diagnóstico.
*   FRASEOLOGIA: "ALERTA OBSTÉTRICO: achados compatíveis com aborto retido. Avaliação ginecológica e obstétrica urgente."

**▸ GESTAÇÃO ECTÓPICA TUBÁRIA:**
*   Massa anexial com "anel de fogo" (saco gestacional hiperecóico paratubário).
*   Embrião extrauterino com ou sem BCF.
*   Útero vazio + endométrio secretório + β-hCG positivo.
*   FSD com coleção hemorrágica (anel rompido).
*   ATIVAR R6 — "ALERTA OBSTÉTRICO: suspeita de gestação ectópica — avaliação cirúrgica/ginecológica emergencial. Salpingostomia ou salpingectomia laparoscópica."
*   ATENÇÃO: β-hCG >1.500–2.000 mUI/mL com útero vazio ao TV = ectópica até prova em contrário.

**▸ GRAVIDEZ DE LOCALIZAÇÃO DESCONHECIDA (GLD):**
*   β-hCG positivo + útero vazio + sem massa tubária identificável.
*   Não excluir ectópica — controle β-hCG em 48h + retorno US.

═══════════════════════════════════════════════════════════════

### 9. DOENÇA INFLAMATÓRIA PÉLVICA (DIP) E PATOLOGIA TUBÁRIA
**▸ SALPINGITE / DIP INICIAL:**
*   Espessamento da parede tubária (>5 mm), conteúdo ecogênico intratubal.
*   Líquido no FSD com ecos (exsudato).
*   Doppler: hipervascularização periférica das tubas (sinal inflamatório).
*   N3 → avaliação ginecológica para antibioticoterapia.

**▸ PIOSALPINGE:**
*   Estrutura tubular alongada com conteúdo ecogênico espesso (pus).
*   Parede espessada e hipervascularizada ao Doppler.
*   Contexto de febre + dor pélvica + leucocitose.
*   ATIVAR R6 — "ALERTA INFECCIOSO: piosalpinge — avaliação ginecológica urgente; internação e antibioticoterapia IV."

**▸ ABSCESSO TUBO-OVARIANO (ATO):**
*   Massa complexa heterogênea envolvendo ovário e tuba, paredes espessas.
*   Conteúdo com debris ecogênicos (pus), septos internos.
*   Doppler: hipervascularização da periferia.
*   Ovário não identificável como estrutura separada da massa.
*   ATIVAR R6 — "ALERTA INFECCIOSO: abscesso tubo-ovariano — internação urgente para ATB IV e avaliação para drenagem cirúrgica/percutânea."

**▸ HIDROSSALPINGE:**
*   Estrutura tubular alongada, serpiginosa, anecoica, com pregas mucosas internas (sinal de "cogumelo" ou "roda de carro").
*   Sem PD interno, parede fina. Contexto: infertilidade, DIP prévia.
*   N3 → avaliação ginecológica (impacto em FIV: salpingectomia antes de FIV).

═══════════════════════════════════════════════════════════════

### 10. AVALIAÇÃO PARA INFERTILIDADE
**PROTOCOLO AO US TRANSVAGINAL:**
*   **Reserva ovariana:** Contagem de folículos antrais (CFA): medir todos os folículos 2–9 mm por ovário no D2–D4 do ciclo. CFA total ≥7 = boa reserva. 4–6 = reserva reduzida. <4 = baixa reserva (POSEIDON/ESHRE).
*   **Volume ovariano para CFA:** ≥10 cm³ por ovário = aumentado (SOP). <3 cm³ = reduzido (reserva diminuída).
*   **Endométrio para transfer:** Espessura ideal ≥7 mm; padrão trilaminar ou secretório homogêneo. <7 mm = fator uterino (receptividade reduzida).
*   **Cavidade uterina:** Livre de pólipos, miomas submucosos, aderências — indispensável para FIV.
*   **Espessura da zona juncional (ZJ):** ZJ >12 mm = sugestivo de adenomiose → impacto negativo em FIV.
*   **DIU:** Deve ser retirado antes de qualquer técnica de reprodução assistida.
*   **Reserva folicular baixa:** "Contagem de folículos antrais reduzida — correlação com AMH sérico e FSH D3 para avaliação da reserva ovariana."

═══════════════════════════════════════════════════════════════

### 11. AVALIAÇÃO PÓS-CIRÚRGICA
**▸ PÓS-HISTERECTOMIA:**
*   Identificar o cuff vaginal (coto): estrutura linear ecogênica no fundo de saco anterior, sem conteúdo suspeito.
*   Coleção no coto: hematoma (anecóico) ou abscesso (ecogênico com debris).
*   Ovários remanescentes: localizar e avaliar bilateralmente se preservados.
*   Massa no coto: prolapso, granuloma ou recidiva → avaliação ginecológica.

**▸ PÓS-MIOMECTOMIA:**
*   Cicatriz miometrial: área hipoecoica linear/focal no sítio da cirurgia.
*   Avaliar parede uterina: espessura residual (risco de ruptura uterina em gestação futura se <8 mm no istmo).
*   Recidiva de mioma: novo nódulo no miométrio — classificar por FIGO.

**▸ PÓS-ABLAÇÃO ENDOMETRIAL:**
*   Endométrio atrófico/ausente = sucesso técnico.
*   Cavidade irregular com sinéquias: Síndrome de Asherman pós-ablação.
*   Coleção intrauterina (hematometra): ATIVAR R6 se volumosa e sintomática.`;

// ── OUTPUT ─────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/gine-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nGinecologia template sizes:');
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 14000 ? '[OK]' : n >= 12000 ? '[~] ' : '[!!]';
  const names = {
    TV: 'PELVICO TRANSVAGINAL     ',
    TV_DOP: 'PELVICO TV COM DOPPLER   ',
    VA: 'PELVICO VIA ABDOMINAL    ',
    VA_DOP: 'PELVICO VA COM DOPPLER   ',
    ENDO: 'PESQUISA DE ENDOMETRIOSE ',
  };
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
