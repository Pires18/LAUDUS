import { readFileSync, writeFileSync } from 'fs';

const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
let ph3 = []; try { ph3 = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));
function getLatest(id) {
  return ph3Map[id]?.aiInstructions || base.find(t => t.id === id)?.aiInstructions || '';
}

const IDS = {
  OMBRO:      'F2TVThjVXGXlyXAL7YUn',  // 17396
  PE:         'wxMCzIXAkxlOrof7vzlF',  // 16028
  COTOVELO:   'BK0BJr6BTbqIgCtsKa7Y',  // 20048
  JOELHO:     'R6MQZMerxKEydLZ8kdMz',  // 20820
  MAO:        'XGza8OaqygJeXzBq2xjx',  // 19551
  MUSCULAR:   'BTKHuY7jgnZIFfl8yfgO',  // 23892
  PUNHO:      'oJY7jg9CmiGzcdoEsJee',  // 22178
  QUADRIL:    'scNlMgOK1Pr5xIwSCw9a',  // 20264
  TORNOZELO:  'Vj1Jkm5MF0rXBg0A8pRM',  // 19522
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: OMBRO (17396 → 21k+) ────────────────────────────────
templates.OMBRO.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — OMBRO AVANÇADO

### 8. CLASSIFICAÇÃO DE ROTURAS DO MANGUITO ROTADOR
─────────────────────────────────────────────────────────────
EXTENSÃO DA ROTURA (SSP — dimensão anteroposterior × mediolateral):
  Pequena: <1 cm. Média: 1–3 cm. Grande: 3–5 cm. Maciça: >5 cm.

ROTURA PARCIAL — Localização:
  Articular (PASTA — bursal lateral): face profunda (articular) do tendão.
  Bursal: face superficial (bursal) do tendão.
  Intratendinosa (intrassubstancial): não atinge nenhuma superfície.
  Classificação de Ellman (profundidade):
    Grau 1: <25% da espessura. Grau 2: 25–50%. Grau 3: >50% da espessura.
  → Grau 3 (>50%): equivalente funcional a rotura total em alguns protocolos → N3/N4.

ROTURA TOTAL — Descrição obrigatória:
  Localização: supraespinhoso (SE, mais comum), infraespinhoso (ISP), subescapular (SSC).
  Extensão AP e ML em mm. Gap entre os cotos. Retração do tendão (em cm desde inserção).
  Sinal da "dupla linha": remanescente cartilagem articular exposta (rotura total SSP).
  Degeneração/atrofia muscular: músculo hipoecoico, pequeno = mau prognóstico cirúrgico.

ROTURA DO SUBESCAPULAR (SSC) — Específico:
  Técnica: transdutor anterior, com rotação externa passiva do ombro.
  Rotura proximal (faceta superior): mais comum. Fratura de Gerber = avulsão do tendão.
  Sinal da cunha: gordura entre o SSC e o coracoide em roturas antigas.

### 9. INSTABILIDADE E LÁBIO ARTICULAR
─────────────────────────────────────────────────────────────
GLENOIDE / LÁBIO (via US — limitações conhecidas):
  US tem resolução limitada para o lábio. Achados quando visíveis:
  Cisto periglenoidal: cisto anecoico junto ao lábio posterior = rotura labraléster.
  Coleção articular posterior: sinovite glenoumeral.
  Erosão do tubérculo maior: Hill-Sachs (posterossuperior) — mal visível ao US.
  RECOMENDAÇÃO: RM de ombro (ou artro-RM) é padrão-ouro para lábio e LIG.

INSTABILIDADE GLENOUMERAL:
  Relatar qualquer efusão glenoumeral: acesso posterior (entre infraespinhoso e lábio).
  Derrame >3 mm na bursa bicipital OU recesso axilar = artrite/sinovite.

### 10. BÍCEPS — PATOLOGIAS COMPLETAS
─────────────────────────────────────────────────────────────
LONGA PORÇÃO DO BÍCEPS (LPB) no sulco intertubercular:
  Tenossinovite isolada: líquido >2 mm + PD peritendinoso.
  Contexto: impacto subacromial, rotura SSC.
  Ruptura LPB proximal: tendão ausente no sulco → "sinal de Popeye" (ventre no terço médio do braço).
  Subluxação medial da LPB: sai do sulco com rotação interna do ombro (dinâmico).
  Causa principal: rotura da polia medial (SSC + transverse humeral ligament).

### 11. AVALIAÇÃO PÓS-CIRÚRGICA DO OMBRO
─────────────────────────────────────────────────────────────
PÓS-ARTROSCOPIA:
  Período pós-op imediato: coleção hemática na bursa subacromial (normal <4 semanas).
  Reancoragens: âncoras metálicas/biodegradáveis hiperecóicas no tubérculo maior.
  Falha da reparação: novo gap nas fibras, persistência do defeito.
  Bioabsorvível solto: âncora migrada para o espaço articular.

PÓS-PRÓTESE DE OMBRO (artroplastia):
  Haste umeral: artefato hiperecóico com sombra acústica.
  Avaliar: coleção periprotética, sinovite, integridade do manguito residual.
  Afrouxamento: halo hipoecoico ao redor da haste (>2 mm = suspeito).

### 12. NERVO AXILAR E SUPRAESCAPULAR
─────────────────────────────────────────────────────────────
NERVO SUPRAESCAPULAR:
  Trajeto: incisura supraescapular → incisura espinoglenoidal.
  Compressão na incisura: dor posterior do ombro + fraqueza ISP.
  US: avaliar AST na incisura. Cisto paralabraldo comprimindo = rotura labral posterior.
  → Cisto paralabraldo comprimindo nervo: N3 → artroscopia.

NERVO AXILAR:
  Espaço quadrilateral (QS): entre redondo menor, tríceps e úmero.
  Compressão: dor lateral do ombro + fraqueza deltóide.
  Cisto na axila ou fibrose pós-trauma = N3.`;

// ── EXPANSÃO 2: PÉ (16028 → 20k+) ───────────────────────────────────
templates.PE.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — PÉ AVANÇADO

### 7. FÁSCIA PLANTAR — PROTOCOLO DETALHADO
─────────────────────────────────────────────────────────────
TÉCNICA: transdutor linear 12–18 MHz; paciente em pronação; tornozelo neutro.
  Plano sagital: medir espessura na inserção calcânea + 1 cm distal.
  Plano transversal: largura e simetria.

FASCITE PLANTAR (entesopatia insercional):
  Espessura >4 mm na inserção = critério diagnóstico principal.
  Hipoecogenicidade focal → fase aguda/subaguda.
  PD positivo na inserção = fase inflamatória ativa (tratamento mais agressivo indicado).
  Calcificação insercional (esporão de calcâneo): focos hiperecóicos ± sombra acústica.
  Espessura 4–6 mm: fascite leve/moderada. >6 mm: grave.
  Rotura da fáscia: descontinuidade das fibras + hematoma → N3 (imobilização urgente).

BURSAS CALCÂNEAS:
  Bursa retrocalcânea (entre TA e calcâneo): normal <2 mm; >2 mm = bursíte.
  Bursa subcutânea posterior (superficial ao TA): normal ausente; se presente = doença de Haglund.
  Doença de Haglund: proeminência póstero-superior do calcâneo + bursíte + inserção do TA.

### 8. TENDÕES DO PÉ — AVALIAÇÃO COMPLETA
─────────────────────────────────────────────────────────────
EXTENSOR LONGO DOS DEDOS (ELD) e EXTENSOR LONGO DO HÁLUX (ELH):
  Dorso do pé. Tenossinovite: líquido na bainha, PD peritendinoso.
  Tendinose/rotura: espessamento + hipoecogenicidade ± descontinuidade.

TIBIAL ANTERIOR (TA): pré-tibial → cuneiforme medial.
  Rotura: rara; hematoma anterior ao tornozelo. Queda do pé = lesão do nervo fibular > rotura.

PERONEUS LONGUS (PL) E PERONEUS BREVIS (PB):
  Maléolo lateral → cubóide (PL) / 5ª base (PB).
  Rotura longitudinal do PB: "flap" hipoecoico na fissura do PB no sulco fibular.
  Luxação tendão peroneal: deslocamento anterior ao maléolo com dorsiflexão + eversão.
  Retináculo peroneal inferior avulsionado = causa principal da luxação.

### 9. HÁLUX E ARTICULAÇÃO METATARSOFALANGEANA (MTF)
─────────────────────────────────────────────────────────────
HÁLUX VALGO: desvio do hálux em valgo; ângulo não medido ao US (radiografia).
  US: bursa medial da MTF1 (joanete): coleção anecoica + paredes espessadas.
  Bursite inflamatória vs. séptica: PD + contexto.

TURF TOE: entorse da MTF1 (lesão da placa volar/cápsula plantar).
  US: laceração da placa plantar (descontinuidade das fibras capsulares).
  Sesamóides: fratura → irregularidade do córtex ± hematoma periosteal.

ARTRITE DA MTF (gota, AR, artrose):
  Derrame MTF1–5: acesso dorsal; quantificar.
  Gota: depósitos de UMS (cristais) = hiperecogenicidade da superfície cartilaginosa
    ("sinal do duplo contorno") + tofos hipoecoicos periarticulares.
  Erosões na MTF: artrose vs. AR (localização e distribuição).

### 10. NERVO DE MORTON E ESPAÇOS INTERMETATARSAIS
─────────────────────────────────────────────────────────────
TÉCNICA: transdutor plantar + compressão lateral para provocar sinal de Mulder.
  Sinal de Mulder: "clunk" palpável com compressão lateral do antepé = Morton.

CLASSIFICAÇÃO POR TAMANHO:
  <5 mm (AP): indeterminado — pode ser apenas fibrose interdigital.
  5–7 mm: compatível com neuroma de Morton leve a moderado.
  >7 mm: neuroma confirmado — correlação clínica alta.
  Multinível (2º e 3º espaços): comum — relatar ambos.

DIAGNÓSTICO DIFERENCIAL:
  Bursa intermetatarsal: cística, anecoica; localizada entre as cabeças metatarsais
  (mais dorsal ao nervo). Pode coexistir com Morton.
  Fibroma plantar (fibromatose plantar): nódulo hipoecoico na fáscia plantar central,
    sem relação com nervo → diferente do Morton.

### 11. ARTICULAÇÕES TARSAIS E SUBTALAR
─────────────────────────────────────────────────────────────
ARTICULAÇÃO SUBTALAR (talocalcânea):
  Acessível via lateral e posterior. Derrame: coleção ao redor do processo lateral do tálus.
  Artrose subtalara: irregularidade cortical + osteófitos + redução do espaço.
  Coalizão tarsal: fusão entre calcâneo e navicular ou calcâneo e tálus.
    Coalizão calcâneo-navicular: massa hipoecoica no seio do tarso — confirmação por TC.

ARTICULAÇÕES DE LISFRANC (tarso-metatarsal):
  Lesão de Lisfranc: trauma com diástase TMT1–2. US limitado — TC/RM para avaliação.
  US: hematoma dorsal + edema periarticular.

### 12. AVALIAÇÃO PÓS-CIRÚRGICA E PÓS-INFILTRAÇÃO NO PÉ
─────────────────────────────────────────────────────────────
PÓS-FASCIECTOMIA PLANTAR:
  Descontinuidade planificada das fibras na inserção.
  Avaliar: resolução dos ecos inflamatórios, espessura residual.

PÓS-TENOTOMIA DE PERONEUS OU TIBIAL:
  Tendão seccionado: coto proximal e distal.
  Controle: cicatriz tendinosa hipoecoica no sítio da cirurgia.

PÓS-INFILTRAÇÃO (corticoide, PRP, ácido hialurônico):
  Controle de fascite plantar: comparar espessura pré e pós.
  Infiltração na bursa retrocalcânea: desaparecimento do líquido = resposta.
  Atenção: rotura espontânea pós-corticoide é complicação descrita no Aquiles e fáscia plantar.`;

// ── OUTPUT ─────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/msk-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nMSK template sizes:');
const names = {
  OMBRO:     'OMBRO      ',
  PE:        'PÉ         ',
  COTOVELO:  'COTOVELO   ',
  JOELHO:    'JOELHO     ',
  MAO:       'MÃO        ',
  MUSCULAR:  'MUSCULAR   ',
  PUNHO:     'PUNHO      ',
  QUADRIL:   'QUADRIL    ',
  TORNOZELO: 'TORNOZELO  ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 18000 ? '[OK]' : n >= 15000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
