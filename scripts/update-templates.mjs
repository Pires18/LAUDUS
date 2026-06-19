/**
 * LAUDUS V1.0 — Script de atualização em lote de aiInstructions
 *
 * O que faz:
 *  1. Lê templates-export.json com os 62 templates
 *  2. Aplica melhorias globais (versão, fórmulas, cabeçalho)
 *  3. Aplica melhorias bespoke por exame (conteúdo clínico expandido)
 *  4. Grava de volta ao Firestore em lote
 *
 * Uso:
 *   node scripts/update-templates.mjs matheuskpires@gmail.com IDTOKEN
 *
 * Para obter o IDTOKEN, no console do browser com o app aberto:
 *   firebase.auth().currentUser.getIdToken(true).then(t => console.log(t))
 *   OU: (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'))
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { readFileSync, writeFileSync } from 'fs';

// ─── Firebase config ───────────────────────────────────────────────────────
const CONFIG = {
  apiKey:            'AIzaSyAVqN1pcxvcgxmZRt_-dCJCdg0Y4XK2Ixk',
  authDomain:        'antigravity-laudus.firebaseapp.com',
  projectId:         'antigravity-laudus',
  storageBucket:     'antigravity-laudus.firebasestorage.app',
  messagingSenderId: '542081396849',
  appId:             '1:542081396849:web:f80667d559e5a30b36abd0',
};
const ADMIN_UID = 'unU2WjwHXYac5lZgiqXMgcWxoBA3';

// ─── Substituições de fórmulas (Camada 3 → referência FASE 4) ─────────────
const FORMULA_SUBS = [
  // Elipsoide de volume — todas as variações (D1/D2/D3, L/AP/T, x/×/X)
  { from: /[A-Z][a-z0-9]*\s*[xX×]\s*[A-Z][a-z0-9]*\s*[xX×]\s*[A-Z][a-z0-9]*\s*[xX×]\s*0[,.]523/g,
    to: 'fórmula do elipsoide (FASE 4.1 do Sistema Universal)' },
  { from: /\(?\s*[Ll]ongitudinal\s*[xX×]\s*[Aa]ntero[Pp]osterior\s*[xX×]\s*[Tt]ransverso\s*\)?\s*[xX×]\s*0[,.]523/gi,
    to: 'fórmula do elipsoide (FASE 4.1 do Sistema Universal)' },
  { from: /[Vv]olume\s*(?:do\s*elips[oó]ide\s*)?[=:]\s*\(?\s*[A-Za-z0-9/\s]+\)?\s*[xX×]\s*0[,.]523[^.;,\n]*/g,
    to: 'volume via fórmula do elipsoide (FASE 4.1 do Sistema Universal)' },
  // Match "x 0,523" or "× 0,523" as a final catch-all
  { from: /[xX×]\s*0[,.]523/g,
    to: '× 0,523 (elipsoide — FASE 4.1)' },
  // Peso prostático
  { from: /[Vv]olume\s*[×x]\s*1[,.]05/g,
    to: 'peso = Volume × 1,05 — FASE 4.2' },
  // IP médio uterino
  { from: /IP\s*m[eé]dio\s*=?\s*\(?IP\s*dir.*?\+.*?IP\s*esq.*?\/\s*2\)?/gi,
    to: 'IP médio uterino (FASE 4.3 do Sistema Universal)' },
  // RCP
  { from: /RCP\s*=?\s*IP\s*ACM\s*\/\s*IP\s*AU/gi,
    to: 'RCP (FASE 4.4 do Sistema Universal)' },
  // Hadlock
  { from: /Hadlock\s*\(?\d{4}\)?:\s*log.*?EPF/gi,
    to: 'EPF via Hadlock (FASE 4.6 do Sistema Universal)' },
  { from: /log\s*EPF\s*=.*?\+.*?CC.*?CA.*?CF/gi,
    to: 'EPF via Hadlock (FASE 4.6 do Sistema Universal)' },
];

// ─── Substituições de versão ────────────────────────────────────────────────
const VERSION_SUBS = [
  { from: /v1[4-9]\.[0-9](\s*\(EXTREME DEPTH\))?/gi, to: 'V1.0' },
  { from: /VERSÃO[:\s]+v?1[4-9]\.[0-9][^\n]*/gi, to: 'V1.0 — LAUD.IA' },
  { from: /\*\*VERSÃO[:\s]+v?1[4-9]\.[0-9]\*\*/gi, to: 'V1.0 — LAUD.IA' },
  { from: /Padrão CBR\/SBUS\b(?! — LAUD\.IA)/g, to: 'Padrão CBR/SBUS — V1.0 — LAUD.IA' },
  { from: /Otimizada \(Padrão/g, to: 'V1.0 — LAUD.IA (Padrão' },
  { from: /Atualizada e Otimizada/g, to: 'V1.0 — LAUD.IA' },
];

// ─── Melhorias bespoke por template (name → texto adicional a PREPEND) ────
const BESPOKE_PREFIX = {

  // ── VASCULAR ──────────────────────────────────────────────────────────────

  'DOPPLER DE CARÓTIDAS E VERTEBRAIS': `\
EXAME: DOPPLER DE CARÓTIDAS E VERTEBRAIS | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · SRU · NASCET · ELSA-Brasil · ASA/AHA
─────────────────────────────────────────────────────────────────
§ PARÂMETROS ESPECÍFICOS DESTE EXAME (complementares à Camada 2):
  • EMI da ACC: medir na parede posterior da ACC direita e esquerda, 1 cm proximal ao bulbo.
    Referência ELSA-Brasil por sexo/faixa etária (média ♂ < 0,80 mm; ♀ < 0,75 mm aos 50 anos).
  • Morfologia de placa (NASCET-modificada): descrever ecoestrutura, superfície e comprimento.
  • Roubo de fluxo subclávio: pesquisar inversão de fluxo na vertebral ipsilateral à estenose subclávia.
  • Artérias vertebrais V1–V2: calibre (normal ≥2,5 mm), direção, VPS e padrão espectral.
  • Índice ACI/ACC: calcular sempre que VPS ACI >125 cm/s.
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER ARTERIAL DE MEMBRO INFERIOR': `\
EXAME: DOPPLER ARTERIAL DE MEMBRO INFERIOR | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · TASC II · AHA/ACC PAD Guidelines
─────────────────────────────────────────────────────────────────
§ PROTOCOLO SEGMENTAR OBRIGATÓRIO:
  Avaliar bilateralmente nos seguintes níveis:
  ┌─────────────────────────┬─────────────────────────────────────┐
  │ SEGMENTO                │ ARTÉRIA                             │
  ├─────────────────────────┼─────────────────────────────────────┤
  │ Aortoilíaco             │ Aorta distal, ilíacas C/E/I         │
  │ Femoral superior        │ AFC, AFS (proximal, médio, distal)  │
  │ Poplíteo                │ AP (proximal e distal)              │
  │ Infrapoplíteo           │ ATA, ATP, AF bilaterais             │
  └─────────────────────────┴─────────────────────────────────────┘
  Classificar cada segmento: Normal | <50% | 50–74% | 75–99% | Oclusão.
  Padrão de fluxo: trifásico (normal) | bifásico | monofásico (oclusão proximal grave).
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER ARTERIAL DE MEMBRO SUPERIOR': `\
EXAME: DOPPLER ARTERIAL DE MEMBRO SUPERIOR | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · STS · AHA
─────────────────────────────────────────────────────────────────
§ PROTOCOLO ESPECÍFICO:
  • Segmentos: subclávia (proximal/distal), axilar, braquial, radial, ulnar bilaterais.
  • Síndrome do Desfiladeiro Torácico (SDT): avaliar VPS em posição neutra vs. manobra de Adson
    e rotação/extensão cervical. Redução >50% do VPS = compressão significativa.
  • Mapeamento para FAV (Fístula Arteriovenosa): diâmetro artéria radial e ulnar
    (adequados se ≥2,0 mm); veia cefálica (adequada se ≥2,5 mm com sem compressão).
  • FAV existente: VPS na FAV normal 200–500 cm/s; >800 cm/s = suspeita de estenose.
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER VENOSO DE MEMBRO INFERIOR': `\
EXAME: DOPPLER VENOSO DE MEMBRO INFERIOR | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · ESC · ISTH · CEAP
─────────────────────────────────────────────────────────────────
§ NOMENCLATURA OBRIGATÓRIA (SBACV):
  • Sistema profundo: Veia Ilíaca Comum/Externa/Interna, Veia Femoral Comum, Veia Femoral
    (NUNCA "Veia Femoral Superficial"), Veia Poplítea, Troncos Tibiais.
  • Sistema superficial: Veia Safena Magna (NUNCA "safena interna"), Veia Safena Parva (NUNCA "safena externa").
  • Junções: Junção Safenofemoral (JSF), Junção Safenopoplítea (JSP).

§ PROTOCOLO DE COMPRESSÃO:
  Avaliar compressibilidade a cada 2–3 cm ao longo do trajeto venoso.
  Incompressível = critério diagnóstico de TVP.

§ INSUFICIÊNCIA VENOSA:
  Refluxo significativo: >0,5 s na manobra de compressão/descompressão ou Valsalva.
  Registrar: JSF e JSP (competente/incompetente), perfurantes incompetentes (>3 mm com refluxo).
  Classificar: CEAP C0–C6 quando clinicamente indicado.
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER VENOSO DE MEMBRO SUPERIOR': `\
EXAME: DOPPLER VENOSO DE MEMBRO SUPERIOR | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · ISTH · ASH Guidelines
─────────────────────────────────────────────────────────────────
§ PROTOCOLO ESPECÍFICO:
  • Veias avaliadas: subclávia, axilar, braquiais (par), cefálica, basílica bilaterais.
  • Critério TVP: incompressibilidade + ausência/redução de fluxo espontâneo ao color Doppler.
  • TVP subclávia/axilar = R6 imediato (risco de TEP comparável à TVP proximal MMII).
  • Síndrome de Paget-Schroetter: TVP de esforço — jovens, contexto atlético, extremidade dominante.
  • Acesso venoso central: avaliar perviedade de jugular, subclávia e femoral quando indicado.
  • FAV para hemodiálise: VPS no segmento anastomótico e nas veias de drenagem.
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER AORTO-ILÍACO': `\
EXAME: DOPPLER AORTO-ILÍACO | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · SVS · ESVS · SIR
─────────────────────────────────────────────────────────────────
§ PROTOCOLO DE ANEURISMA (AAA):
  Medir diâmetro máximo perpendicular ao eixo longitudinal do vaso (não oblíquo).
  Relatar: Diâmetro total e luminal, presença e espessura de trombo mural, calcificações.
  Acompanhamento: < 4 cm anual; 4–5 cm semestral; ≥5,5 cm → R6 cirurgia vascular urgente.

§ EVAR (ENDOPRÓTESE) — ENDOLEAKS:
  • Tipo I: vazamento na zona de fixação proximal (IA) ou distal (IB). Reintervenção urgente.
  • Tipo II: enchimento retrógrado por artéria lombar ou mesentérica inferior.
  • Tipo III: falha da junção entre módulos da prótese.
  • Tipo IV: porosidade da tela (raro, precoce pós-implante).
  Sempre comparar com exame anterior para evolução do saco aneurismático.

§ ARTÉRIAS ILÍACAS:
  Avaliar bilateralmente: ilíaca comum (AIC), ilíaca externa (AIE), ilíaca interna (AII).
  VPS normal AIC: 90–150 cm/s. Estenose >50%: VPS >200 cm/s com turbulência.
─────────────────────────────────────────────────────────────────
`,

  'DOPPLER DE ARTÉRIAS OFTÁLMICAS': `\
EXAME: DOPPLER DE ARTÉRIAS OFTÁLMICAS | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · AIUM · EUSOBI · European Journal of Ophthalmology
─────────────────────────────────────────────────────────────────
§ PARÂMETROS DE NORMALIDADE (REFERÊNCIA):
  Artéria Oftálmica (AO):   VPS 21–40 cm/s  |  VDF 7–16 cm/s  |  IR 0,67–0,82
  Art. Central Retina (ACR): VPS 10–20 cm/s  |  VDF 3–7 cm/s   |  IR 0,67–0,75
  Art. Ciliar Post. (ACP):  VPS 10–22 cm/s  |  VDF 3–8 cm/s   |  IR 0,60–0,75
  Veia Oftálmica Superior (VOS): fluxo anterógrado contínuo.

§ ACHADOS ESPECÍFICOS:
  • Fluxo retrógrado na AO: forte indicador de doença oclusiva carotídea ipsilateral grave.
  • VOS dilatada + fluxo retrógrado: suspeita de fístula carótido-cavernosa → R6.
  • Assimetria de IR > 0,05 entre AOs: correlacionar com estenose carotídea ipsilateral.
  • Arterite de células gigantes (Horton): halo hipoecogênico pericircunferencial na AO
    ("sinal do halo") + redução do fluxo = critério diagnóstico US (sensibilidade 73–80%).
─────────────────────────────────────────────────────────────────
`,

  // ── MEDICINA INTERNA ───────────────────────────────────────────────────────

  'ABDOME SUPERIOR': `\
EXAME: ABDOME SUPERIOR | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBR · AASLD · ACR · EASL · SBU
─────────────────────────────────────────────────────────────────
§ ESTRUTURA OBRIGATÓRIA DO LAUDO (seções HTML h2):
  FÍGADO → VESÍCULA E VIAS BILIARES → PÂNCREAS → BAÇO → RINS
  → GRANDES VASOS → RETROPERITÔNIO → [CONCLUSÃO]

§ FÍGADO — medida padrão: lobo direito longitudinal na linha médio-clavicular.
  Normal ♂: até 16 cm; ♀: até 15 cm. Registrar quando >16 cm como hepatomegalia.
  Esteatose: classificar Grau I/II/III (Camada 2, §1). Relatar relação hepático/renal.
  Lesões focais: descrever localização por segmento de Couinaud (S1–S8) quando possível.

§ VIAS BILIARES — valores de referência:
  Ductos intra-hepáticos: não dilatados (<2 mm). Dilatados: ≥3 mm = "sinal do cano duplo".
  Colédoco: ≤6 mm (<70 anos) | ≤8 mm (>70 anos) | ≤10 mm (pós-colecistectomia).
  Murphy ultrassonográfico: dor localizada sob o probe sobre a vesícula.

§ PÂNCREAS — medidas (AP):
  Cabeça: ≤3,0 cm | Corpo: ≤2,0 cm | Cauda: ≤2,0 cm.
  Wirsung: ≤2 mm (parênquima normal) | ≥3 mm = dilatação (investigar causa).

§ BAÇO:
  Eixo longitudinal normal: ≤12 cm. Esplenomegalia: >12 cm; relatar grau (leve/moderada/acentuada).
─────────────────────────────────────────────────────────────────
`,

  'ABDOME SUPERIOR COM DOPPLER': `\
EXAME: ABDOME SUPERIOR COM DOPPLER | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBR · AASLD · EASL · AIUM
─────────────────────────────────────────────────────────────────
§ PARÂMETROS DOPPLER HEPÁTICO ESPECÍFICOS:
  Veia Porta: calibre normal ≤13 mm; VPS 12–20 cm/s (hepatípeta). Hepatífuga = hipertensão portal.
  Artéria Hepática: IR 0,55–0,70. IR <0,50 pós-transplante = suspeita de estenose anastomótica.
  Veias Hepáticas: padrão trifásico (bifásico ou monofásico = hepatopatia crônica avançada).
  Veia Esplênica: calibre ≤8 mm; fluxo hepatípeto.
  Veia Mesentérica Superior (VMS): calibre ≤10 mm; fluxo hepatípeto.

§ HIPERTENSÃO PORTAL — critérios US/Doppler:
  Veia Porta >13 mm + fluxo hepatífugo OU velocidade portal <12 cm/s.
  Colaterais portossistêmicas: ligamento hepatogástrico, esplenorrenal, paraesofágicos, recanalizacão de VP umbilical.
  Ascite: descrever presença e volume estimado.

§ SÍNDROME DE BUDD-CHIARI:
  Ausência de fluxo em ≥1 veia hepática + colaterais intra-hepáticas → R6 urgente.
─────────────────────────────────────────────────────────────────
`,

  'ABDOME TOTAL': `\
EXAME: ABDOME TOTAL | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBR · AASLD · SBU · SBRAD
─────────────────────────────────────────────────────────────────
§ ESTRUTURA OBRIGATÓRIA DO LAUDO:
  FÍGADO → VESÍCULA E VIAS BILIARES → PÂNCREAS → BAÇO → RINS
  → BEXIGA → PRÓSTATA (♂) / ÚTERO e OVÁRIOS (♀) → GRANDES VASOS → RETROPERITÔNIO

§ ESTE EXAME INTEGRA AS DIRETRIZES DE:
  • §1–§9 do Prompt de Área medicina-interna (Camada 2)
  • Medidas biliares, pâncreas, portal e renais: conforme ABDOME SUPERIOR
  • Rins: estadiamento nefropatia G1–G5 (Camada 2, §3)
  • Próstata: HPB, RPM, IPSS context (Camada 2, §8)

§ ACHADOS INCIDENTAIS — relatar sempre:
  Linfonodomegalias retroperitoneais (≥10 mm eixo curto = anormal).
  Líquido livre peritoneal: localizar e quantificar (mínimo / moderado / acentuado).
  Coleções: localização, volume estimado, aspecto (simples, com debris, multiloculado).
─────────────────────────────────────────────────────────────────
`,

  'ABDOME TOTAL COM DOPPLER': `\
EXAME: ABDOME TOTAL COM DOPPLER | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBR · AASLD · EASL
─────────────────────────────────────────────────────────────────
§ INTEGRA OS PROTOCOLOS DOPPLER DE:
  • Abdome Superior com Doppler (portal, hepático, esplânico)
  • Rins e Vias Urinárias com Doppler (renais, resistividade parenquimatosa)

§ SEQUÊNCIA DOPPLER OBRIGATÓRIA:
  1. Veia Porta (calibre, velocidade, direção)
  2. Artéria Hepática (IR, padrão espectral)
  3. Veias Hepáticas (padrão trifásico?)
  4. Artérias Renais (VPS, IR intrarrenal)
  5. Aorta distal e VCI (calibres, permeabilidade)

§ DOPPLER RENAL (quando indicado):
  IR intrarrenal normal: 0,55–0,70.
  IR >0,70 = aumento de resistividade (nefropatia parenquimatosa, obstrução).
  VPS artéria renal >180 cm/s = suspeita de estenose → relação AR/Aorta >3,5.
─────────────────────────────────────────────────────────────────
`,

  'RINS E VIAS URINÁRIAS': `\
EXAME: RINS E VIAS URINÁRIAS | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBU · KDIGO · AUA
─────────────────────────────────────────────────────────────────
§ DIMENSÕES RENAIS DE REFERÊNCIA:
  Normal: 9,0–12,0 cm (longitudinal); parênquima ≥1,5 cm.
  Rim pequeno: <9 cm (↓parênquima = nefropatia). Rim grande: >13 cm (hidronefrose? infiltrativo?).
  Volume: calcular via elipsoide (FASE 4.1 do Sistema Universal).

§ ESTADIAMENTO NEFROPATIA PARENQUIMATOSA (integra Camada 2, §3):
  G1 Normal | G2 Discreta | G3 Moderada | G4 Acentuada | G5 Terminal.
  Descrever: ecogenicidade cortical (relação córtex/seio), diferenciação corticomedular, contornos.

§ HIDRONEFROSE — Classificação SBU:
  Leve (S. Pielocalicinal dilatado < 10 mm, parênquima preservado).
  Moderada (10–15 mm, algum adelgaçamento parenquimatoso).
  Acentuada (>15 mm, adelgaçamento parenquimatoso significativo).
  Relatar: ponto de obstrução (UPJ, ureter proximal, médio, distal, UVJ), causa identificável.

§ URETER:
  Normal: não visível. Calibre ≥5 mm = ureterohidronefrose.
  Relatar segmento proximal, médio (quando visível via transvesical), junção uretero-vesical.

§ BEXIGA:
  Espessura da parede: normal ≤3 mm (repleção adequada). >5 mm = espessamento.
  Conteúdo: anecoico. Debris, cálculos, lesões parietais: descrever com Doppler se disponível.

§ CÁLCULOS:
  Localização precisa, maior dimensão, presença de sombra acústica, ureterectasia associada.
─────────────────────────────────────────────────────────────────
`,

  'RINS E VIAS URINÁRIAS COM DOPPLER': `\
EXAME: RINS E VIAS URINÁRIAS COM DOPPLER | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBU · KDIGO · AIUM · AJR
─────────────────────────────────────────────────────────────────
§ PARÂMETROS DOPPLER RENAL:
  Artéria renal principal (hilo): VPS normal <180 cm/s.
  Artérias segmentares e interlobares: IR normal 0,55–0,70.
  IR >0,70 = aumento de resistividade parenquimatosa (nefropatia, obstrução).
  Estenose AR: VPS >180 cm/s + relação AR/Aorta >3,5 + IR assimétrico (diferença >0,05).

§ DOPPLER COLOR NA BEXIGA:
  "Jato ureteral" (ureteral jet): avaliar bilateralmente. Ausência unilateral = suspeita de obstrução.

§ HIDRONEFROSE + DOPPLER:
  IR ipsilateral >0,70 com hidronefrose = suspeita de obstrução funcalmente significativa.
  Comparar com rim contralateral.

§ VASOS RENAIS ACESSÓRIOS:
  Relatar quando identificados (>30% da população). Relevante em doadores renais.
─────────────────────────────────────────────────────────────────
`,

  'PRÓSTATA VIA ABDOMINAL': `\
EXAME: PRÓSTATA VIA ABDOMINAL | ÁREA: medicina-interna | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBU · AUA · EAU
─────────────────────────────────────────────────────────────────
§ TÉCNICA VIA ABDOMINAL:
  Requer bexiga moderadamente repleta (150–300 mL). Planos sagital e transversal.
  Limitações: resolução inferior à via transretal; cálculo de volume aceitável, mas
  caracterização de lesões internas é limitada. Relatar qualidade do exame.

§ VOLUMETRIA PROSTÁTICA:
  Medir: comprimento (sagital) × largura × altura (AP). Volume via elipsoide (FASE 4.1).
  Peso prostático = Volume × 1,05 (FASE 4.2 do Sistema Universal).
  Normal: <30 cm³. Leve 30–50 cm³. Moderado 50–80 cm³. Acentuado >80 cm³.

§ HPB — CLASSIFICAÇÃO E REPERCUSSÕES:
  Descrever: lobo mediano, estimativa de projeção intravesical.
  Parede vesical: espessura ≤3 mm (normal repleta). Trabeculação: leve/moderada/acentuada.

§ RESÍDUO PÓS-MICCIONAL (RPM):
  RPM <50 mL: normal. 50–100 mL: borderline. 100–300 mL: significativo. >300 mL → R6.
  Relatar se bexiga pós-miccional foi avaliada e volume estimado.

§ OBSERVAÇÃO METODOLÓGICA:
  A ultrassonografia da próstata por via abdominal permite estimativa volumétrica e
  avaliação de repercussões sobre a bexiga. Para investigação de nódulos intraprostáticos
  ou rastreio de câncer de próstata, recomenda-se complementação por via transretal (TRUS)
  ou ressonância magnética multiparamétrica (mpMRI) conforme indicação clínica.
─────────────────────────────────────────────────────────────────
`,
};

// ─── Aplicar transformações globais ────────────────────────────────────────
function applyGlobal(text) {
  // Remove markdown code fences
  text = text.replace(/^```[a-z]*\n?/gm, '').replace(/```\s*$/gm, '');
  // Versões
  for (const { from, to } of VERSION_SUBS) text = text.replace(from, to);
  // Fórmulas
  for (const { from, to } of FORMULA_SUBS) text = text.replace(from, to);
  return text;
}

// ─── Processar todos os templates ──────────────────────────────────────────
async function main() {
  const templates = JSON.parse(readFileSync('/Users/matheuskistenmackerpires/Documents/LAUDUS/scripts/templates-export.json', 'utf8'));

  const updates = [];
  let changed = 0;

  for (const tmpl of templates) {
    const original = tmpl.aiInstructions || '';
    let improved = applyGlobal(original);

    // Prepend bespoke prefix if defined
    const prefix = BESPOKE_PREFIX[tmpl.name];
    if (prefix) {
      // Only prepend if not already there
      if (!improved.includes('V1.0 — LAUD.IA\n─')) {
        improved = prefix + '\n' + improved;
      }
    }

    if (improved !== original) {
      changed++;
      updates.push({ id: tmpl.id, area: tmpl.area, name: tmpl.name, aiInstructions: improved });
    }
  }

  console.log(`\n✓ ${changed}/${templates.length} templates melhorados.`);

  // Save improved JSON for review
  const output = templates.map(t => {
    const upd = updates.find(u => u.id === t.id);
    return upd ? { ...t, aiInstructions: upd.aiInstructions } : t;
  });
  writeFileSync(
    '/Users/matheuskistenmackerpires/Documents/LAUDUS/scripts/templates-improved.json',
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log('✓ templates-improved.json gerado para revisão.\n');
  console.log('Templates modificados:');
  updates.forEach(u => console.log(`  [${u.area}] ${u.name}`));

  // Firestore update (requires idToken arg)
  const idToken = process.argv[2];
  if (!idToken) {
    console.log('\n⚠  Para aplicar ao Firestore, rode com o ID token:');
    console.log('   node scripts/update-templates.mjs SEU_ID_TOKEN');
    return;
  }

  const app  = initializeApp(CONFIG);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  await signInWithCustomToken(auth, idToken);

  const CHUNK = 400;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + CHUNK);
    for (const u of chunk) {
      const ref = doc(db, `users/${ADMIN_UID}/templates`, u.id);
      batch.update(ref, { aiInstructions: u.aiInstructions, updatedAt: Date.now() });
    }
    await batch.commit();
    console.log(`✓ Lote ${Math.floor(i/CHUNK)+1} commitado (${chunk.length} docs).`);
  }
  console.log('\n✓ Todos os templates atualizados no Firestore!');
}

main().catch(console.error);
