/**
 * LAUD.IA — Phase 1 Template Builder
 * Generates phase1-templates.json with:
 *   - 5 new templates (Group A: reumatologico x3, vascular/doppler-renal, pediatria/quadril-ddq)
 *   - 2 fixes on existing templates (B2 add OBSERVAÇÕES, B14 expand)
 */

import { readFileSync, writeFileSync } from 'fs';

const existing = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// GROUP A — NEW TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const A1_articulacoes = {
  id: 'reumatologico-articulacoes-perifericas',
  area: 'reumatologico',
  name: 'ARTICULAÇÕES PERIFÉRICAS',
  title: 'ULTRASSONOGRAFIA DAS ARTICULAÇÕES PERIFÉRICAS',
  technique: `<p>Exame realizado com transdutor linear de alta frequência (10–18 MHz), em modo B-mode (escala de cinza) e Power Doppler (PD), com avaliação dinâmica nas posições de repouso e mobilização passiva/ativa. As articulações foram avaliadas nos planos longitudinal e transversal, com compressão moderada para avaliação de compressibilidade do tecido sinovial. A avaliação de Power Doppler foi realizada com otimização de parâmetros (frequência de repetição de pulso baixa, ganho de cor ajustado para eliminar artefato de movimento, sem compressão excessiva do probe) para máxima sensibilidade à baixas velocidades de fluxo.</p>`,
  analysisTemplate: `<p><strong>ARTICULAÇÕES AVALIADAS:</strong></p>
<p>Foram avaliadas as seguintes articulações: [listar articulações examinadas].</p>
<p><strong>TECIDO SINOVIAL (B-MODE):</strong> [Descrever espessamento sinovial, grau 0-3 por articulação].</p>
<p><strong>POWER DOPPLER:</strong> [Descrever sinal de PD, grau 0-3 por articulação].</p>
<p><strong>ESTRUTURAS PERIARTICULARES:</strong> [Tendões, bainhas, bursas adjacentes].</p>
<p><strong>SUPERFÍCIES ÓSSEAS:</strong> [Regularidade cortical, presença de erosões em dois planos].</p>`,
  conclusionTemplate: `<p>Exame ultrassonográfico das articulações periféricas avaliadas dentro dos limites da normalidade (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Recomenda-se seguimento clínico com reumatologista conforme evolução dos sintomas.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A ultrassonografia reumatológica é operador-dependente e examinador-sensível. A detecção de sinovite subclínica por Power Doppler pode variar conforme equipamento, configuração e pressão do probe. Resultados devem ser sempre correlacionados com dados clínicos, laboratoriais (PCR, VHS, FR, anti-CCP, ácido úrico) e história clínica. A ultrassonografia não substitui a ressonância magnética para avaliação de erosões profundas ou lesões de partes moles extensas. Classificação diagnóstica definitiva (AR, SpA, gota) requer critérios ACR/EULAR completos.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DAS ARTICULAÇÕES PERIFÉRICAS
REUMATOLÓGICO — V1.0 — LAUD.IA
REFERÊNCIAS: EULAR/OMERACT · SBR · GRAPPA · ACR · EFSUMB
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação musculoesquelética periarticular para diagnóstico e monitoramento de
doenças inflamatórias articulares (Artrite Reumatoide, Artrite Psoriásica, Gota,
CPDD, Espondiloartropatias periféricas) e detecção de sinovite ativa, erosões ósseas,
dactilite, entesite e derrame articular.
NOTA: Protocolos de PDUS-28 completo, sacroilíacas e avaliação de enteses
específicas são cobertos em templates dedicados.
═══════════════════════════════════════════════════════════════

1. PROTOCOLO DE AVALIAÇÃO SISTEMÁTICA
───────────────────────────────────────────────────────────────
Articulações a avaliar (bilateral, planos longitudinal e transversal):

MÃOS E PUNHOS:
  • MCF (Metacarpofalângica) 2ª–5ª: dorsal e palmar; plano longitudinal e transversal.
  • IFP (Interfalângica Proximal) 2ª–5ª: dorsal.
  • IFD (Interfalângica Distal) 2ª–5ª: avaliar especificamente em suspeita de artrite psoriásica.
  • Punho (rádio-cárpico, mediocárpico): plano dorsal e volar; avaliar tendões extensores
    e flexores; bainha do nervo mediano.

MEMBROS SUPERIORES:
  • Cotovelo: recesso posterior (olécrano), lateral (côndilos) e medial (epitróclea).
  • Ombro: recesso subdeltóideo anterior, coracoumeral.

MEMBROS INFERIORES:
  • Joelho: recesso suprapatelar (suprapatelar + parapatelar medial/lateral), posterior
    (cisto poplíteo — cistos de Baker).
  • MTF (Metatarsofalângica) 1ª–5ª: dorsal e plantar.
  • Tornozelo: recesso tibiotalar anterior e posterior.

SEQUÊNCIA DE AVALIAÇÃO:
  1. B-Mode primeiro: identificar espessamento sinovial e derrame.
  2. Power Doppler: com parâmetros otimizados (PRF 600–800 Hz, ganho máximo sem artefato).
  3. Cortical óssea: avaliar regularidade em dois planos perpendiculares.
  4. Estruturas periarticulares: tendões, bainhas, bursas.

2. ESCORES OMERACT — SINOVITE (B-MODE) E POWER DOPPLER
───────────────────────────────────────────────────────────────
SCORE DE SINOVITE (Escala de Cinza — B-mode):
  Grau 0: Sem espessamento sinovial detectável. Superfície óssea ecogênica visível
           sem interposição de tecido mole.
  Grau 1: Espessamento sinovial mínimo (lâmina hipoecóica delgada ≤ 2 mm). Sem
           abaulamento além da linha capsular. Pode ser fisiológico em pequenas articulações.
  Grau 2: Espessamento sinovial moderado (2–4 mm). Abaulamento além da linha capsular
           sem deformidade osteoarticular. Clinicamente palpável.
  Grau 3: Espessamento sinovial acentuado (>4 mm). Abaulamento marcado com distensão
           da cápsula. Em MCF: tecido sinovial visível entre os metacarpos adjacentes.

SCORE DE POWER DOPPLER (Sinovite Ativa):
  Grau 0: Ausência de sinal de PD no interior do tecido sinovial.
  Grau 1: Sinal mínimo (1–3 focos puntiformes isolados OU 1 confluência linear isolada).
           Atividade inflamatória leve.
  Grau 2: Sinal moderado (>3 focos confluentes OU até 50% da área sinovial com PD).
           Atividade inflamatória moderada.
  Grau 3: Sinal acentuado (>50% da área sinovial com PD). Alta atividade inflamatória.
           Urgente correlação com reumatologista para ajuste de DMARD/biológico.

NOTA: O score combinado (sinovite cinza + PD) é a métrica mais relevante.
Sinovite cinza ≥2 + PD ≥2 = sinovite ativa significativa.
Sinovite cinza ≥1 + PD = 0 = sinovite subclínica (pode ser fisiológica).

3. EROSÕES ÓSSEAS — CRITÉRIO OMERACT
───────────────────────────────────────────────────────────────
Definição OMERACT (obrigatória): descontinuidade da cortical óssea hiperecoica
visível em DOIS planos perpendiculares, com presença de tecido hipoecóico intraósseo
no interior do defeito cortical.

Características a relatar:
  • Localização anatômica exata (ex: MCF 2ª direita, cortical radial).
  • Dimensão: eixo maior em mm (medir no plano de maior extensão).
  • Número de erosões por articulação.
  • Vascularização intraóssea ao PD (indica atividade erosiva ativa).

Gradação para relatório:
  Erosão ausente: cortical óssea contínua e hiperecoica em dois planos.
  Erosão leve (1–2 mm): descontinuidade focal pequena, sem perda estrutural.
  Erosão moderada (3–5 mm): deformidade cortical moderada.
  Erosão grave (>5 mm): deformidade significativa, perda de substância óssea.

CRITÉRIO DE ATIVIDADE EROSIVA: erosão >1 por articulação OU erosões em
múltiplas articulações = sugestivo de artrite inflamatória crônica ativa.
→ Recomendar avaliação reumatológica e consideração de RM para melhor quantificação.

4. DERRAME ARTICULAR
───────────────────────────────────────────────────────────────
Caracterização obrigatória quando presente:
  • Volume estimado: pequeno (<5 mm no recesso), moderado (5–10 mm), volumoso (>10 mm).
  • Conteúdo: simples (anecóico) / com debris (ecos finos = suspeita inflamatória ou hemorrágica)
    / heterogêneo (suspeita infecciosa ou cristalino).
  • Compressibilidade: derrame simples é completamente compressível.
  • Power Doppler no derrame: ausente (normal); fluxo = sinovite villonodular ou neoplasia.

5. DIAGNÓSTICO DIFERENCIAL — PADRÕES POR PATOLOGIA
───────────────────────────────────────────────────────────────

5.1 ARTRITE REUMATOIDE (AR):
  Distribuição: MCF 2ª–5ª bilateral e simétrica (mais sensível), IFP, punhos, MTF.
  Achados: sinovite cinza ≥2 + PD ≥2 nas MCF = atividade significativa; erosões nas faces
    radial e medial das MCF (vulnerabilidade à nutrição vascular); tenossinovite extensores.
  Referência: critérios ACR/EULAR 2010 (score ≥6 = AR definida).
  Monitoramento: redução do PD-score nas MCF = resposta a DMARD/biológico.

5.2 ARTRITE PSORIÁSICA (APs):
  Distribuição: IFD (diferencial chave da AR), assimétrica, axial associada.
  Achados específicos: sinovite IFD com espessamento periarticular dos tecidos moles
    ("dactilite difusa"), entesite (inserção dos tendões extensores nas falanges distais),
    onicólise ao exame clínico, erosão "em lápis na xícara" tardia.
  Padrão: envolvimento do dedo completo (bainha flexora + IFP + IFD = dactilite).

5.3 GOTA — DEPOSIÇÃO DE URATO MONOSSÓDICO (UMS):
  Sinais ultrassonográficos patognomônicos:
  (a) Sinal do "Duplo Contorno" (Double Contour Sign — DCS): linha hiperecoica sobre
       a superfície da cartilagem hialina (separada do córtex ósseo), patognomônica de
       deposição de UMS. Local mais sensível: 1ª MTF e côndilo femoral.
  (b) Tofos: massa hiperecoica heterogênea com ou sem sombra acústica posterior.
       Localização: subcutânea, intratecal, bursal ou intraóssea.
  (c) Agregados puntiformes: microêmbolos hiperecoicos ("tempestade de neve") em
       suspensão no líquido sinovial.
  Localização mais comum: 1ª MTF, tornozelo, joelho, punho.
  DCS confirmado = indicação de tratamento hipouricemiante (alopurinol/febuxostat).

5.4 PSEUDOGOTA — PIROFOSFATO DE CÁLCIO DIIDRATADO (CPDD):
  Calcificações lineares hiperecoicas no interior da fibrocartilagem (meniscos, fibrocartilagem
  triangular do punho) e cartilagem hialina (côndilo femoral).
  Diferencial com gota: localização no interior da cartilagem (não na superfície).
  CPDD agudo: derrame volumoso com calcificações → correlação clínica urgente.

5.5 DACTILITE:
  Definição US: espessamento difuso de todo o dedo (tendão flexor + sinovite IFP/IFD
  simultâneos no MESMO dedo).
  Achado US: bainha flexora distendida + sinovite IFP + sinovite IFD no mesmo dígito.
  Significância: específico de artrite psoriásica ou espondiloartropatia associada.
  Relatar: dígito envolvido, sinal de PD na bainha.

5.6 ENTESITE:
  Definição: inflamação na inserção de tendão, ligamento ou cápsula articular no osso.
  Locais mais avaliados: inserção do tendão de Aquiles no calcâneo, inserção plantar
    (fáscia plantar), inserção patelar, inserção do quadríceps, epicôndilos.
  Achados US: espessamento hipoecoico da inserção (>4 mm Aquiles, >4 mm plantar),
    hipervascularização ao PD na zona de inserção, erosão do córtex ósseo na entese.
  Score MASEI ou mSEI: podem ser relatados quando protocolo completo é solicitado.

6. CLASSIFICAÇÃO N0–N4 POR ARTICULAÇÃO
───────────────────────────────────────────────────────────────
N0 — Sem sinovite, sem derrame, sem erosão, PD negativo.
  Conclusão: "Articulações avaliadas dentro dos limites da normalidade ecográfica."
  Conduta: seguimento clínico habitual.

N1 — Sinovite cinza Grau 1 isolada, PD Grau 0. Pequeno derrame simples.
  Conclusão: "Discreta sinovite sem vascularização ativa ao Power Doppler — pode
  representar achado subclínico ou fisiológico."
  Conduta: correlação clínica; repetir exame em 3–6 meses se sintomático.

N2 — Sinovite cinza Grau 1–2 + PD Grau 1. Erosão isolada <2 mm. Derrame moderado.
  Conclusão: "Sinovite com atividade inflamatória leve ao Power Doppler."
  Conduta: avaliação reumatológica eletiva; considerar DMARD convencional se diagnóstico
  de AR/APs confirmado laboratorialmente.

N3 — Sinovite cinza Grau 2–3 + PD Grau 2. Erosões múltiplas. Dactilite ativa.
     Gota com DCS ou tofos volumosos.
  Conclusão: "Sinovite ativa de grau moderado com atividade inflamatória ao PD.
  Erosões ósseas em [articulação]. Padrão consistente com [diagnóstico provável]."
  Conduta: encaminhamento reumatológico prioritário; ajuste de DMARD ou biológico;
  considerar RM para quantificação de erosões. Uricemia se suspeita de gota.

N4 — Sinovite cinza Grau 3 + PD Grau 3 com derrame volumoso com debris OU trofismo
     articular suspeito de artrite séptica.
  ⚠️ GATILHO R6: Derrame com debris + PD Grau 3 + contexto de febre ou imunossupressão
  → ARTRITE SÉPTICA ATÉ PROVA EM CONTRÁRIO.
  Conclusão: "ALERTA: Derrame articular com características suspeitas de artrite séptica
  em [articulação]. Quadro exige avaliação imediata."
  Conduta: R6 — avaliação ortopédica/reumatológica urgente; artrocentese diagnóstica e
  terapêutica; culturas do líquido sinovial; antibioticoterapia empírica após coleta.

7. ESTRUTURA DO LAUDO
───────────────────────────────────────────────────────────────
Relatar por articulação avaliada, com formato:
[Nome da articulação] [Lado]: Sinovite cinza Grau X | PD Grau X | Erosão: [ausente/presente
com caracterização] | Derrame: [ausente/presente com volume e caráter] | Estruturas
periarticulares: [descrição].

Na CONCLUSÃO: hierarquizar achados N4 → N0, agrupar por diagnóstico provável.
Nas RECOMENDAÇÕES: proporcional ao grau de atividade; mencionar exames laboratoriais
complementares específicos (FR, anti-CCP, ácido úrico, fator reumatoide, HLA-B27, PCR, VHS).

8. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Sinovite PD Grau ≥2: "Correlação clínica com reumatologista para ajuste terapêutico
  (DMARD/biológico). Considerar RM para estadiamento erosivo."
  Erosões identificadas: "Avaliação reumatológica especializada; considerar RM 3T para
  melhor quantificação e planejamento terapêutico."
  Sinal do duplo contorno / tofos: "Correlação clínica para manejo da gota: uricemia,
  alopurinol/febuxostat, colchicina para fase aguda."
  Dactilite ativa: "Encaminhamento para reumatologista — padrão associado a artrite
  psoriásica ou espondiloartropatia. Considerar biológico anti-TNF ou anti-IL-17."
  Artrite séptica: ATIVAR R6 — "Avaliação ortopédica/reumatológica urgente para lavagem
  articular e antibioticoterapia."

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia reumatológica é operador-dependente e requer experiência específica
em imagiologia reumatológica. A detecção de sinovite subclínica por Power Doppler
varia conforme equipamento (frequência de emissor, filtro de parede, PRF) e pressão do
probe (compressão excessiva suprime o sinal de PD). O diagnóstico definitivo de gota
por DCS tem sensibilidade de 55–80% e especificidade >90%, sendo complementado por
punção aspirativa e análise de cristais sob luz polarizada. A ausência de erosões ao
US não exclui erosões profundas — a RM com gadolínio é superior para detecção precoce.
Achados ultrassonográficos devem sempre ser correlacionados com clínica, história natural
da doença e exames laboratoriais (FR, anti-CCP, ácido úrico, PCR, VHS, HLA-B27).`,
  customForm: '',
  clinicId: null,
};

const A2_sacroiliacas = {
  id: 'reumatologico-sacroiliacas',
  area: 'reumatologico',
  name: 'SACROILÍACAS',
  title: 'ULTRASSONOGRAFIA DAS ARTICULAÇÕES SACROILÍACAS',
  technique: `<p>Exame realizado com transdutor curvilíneo de frequência mista (3,5–7,5 MHz) pela abordagem posterior, com o paciente em decúbito ventral. As articulações sacroilíacas foram avaliadas bilateralmente nos planos paraaxial oblíquo e transversal, com ênfase na interlinha articular anterior (ventral — porção sinovial). Avaliação complementar com transdutor linear de alta frequência (10–15 MHz) para a porção superficial. Modo B-mode e Power Doppler foram aplicados com parâmetros otimizados para detecção de sinais inflamatórios de baixa velocidade (PRF 600 Hz, filtro de parede mínimo).</p>`,
  analysisTemplate: `<p><strong>ARTICULAÇÃO SACROILÍACA DIREITA:</strong> [Descrever espessamento sinovial, grau PD, erosões].</p>
<p><strong>ARTICULAÇÃO SACROILÍACA ESQUERDA:</strong> [Descrever espessamento sinovial, grau PD, erosões].</p>
<p><strong>PARTES MOLES ADJACENTES:</strong> [Enteses, ligamentos sacroilíacos posteriores, músculo glúteo médio].</p>`,
  conclusionTemplate: `<p>Articulações sacroilíacas avaliadas dentro dos limites da normalidade ecográfica (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Recomenda-se seguimento clínico com reumatologista conforme critérios ASAS para espondiloartropatia.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A ultrassonografia das sacroilíacas avalia principalmente a porção anterior (sinovial) e é limitada para a porção posterior (ligamentosa/fibrocartilaginosa). A ressonância magnética (RM) é o método padrão-ouro para diagnóstico de sacroiliíte ativa precoce (edema de medula óssea em STIR). A US complementa a RM na detecção de sinovite ativa e erosões superficiais, com sensibilidade de 60–75% vs. RM. Diagnóstico de espondilite anquilosante requer critérios ASAS completos.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DAS ARTICULAÇÕES SACROILÍACAS
REUMATOLÓGICO — V1.0 — LAUD.IA
REFERÊNCIAS: ASAS/EULAR 2022 · OMERACT · GRAPPA · SBR · EFSUMB
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação das articulações sacroilíacas (SI) para detecção de sacroiliíte
ativa (inflamatória) e crônica (esclerose, erosões, anquilose), no contexto de
espondiloartropatias axiais (espondilite anquilosante, SpA axial não-radiográfica,
artrite psoriásica axial, SpA reativa).
POSIÇÃO: Diagnóstico de espondilite anquilosante requer critérios ASAS modificados:
sacroiliíte por imagem (RM ou Rx) + ≥1 achado de SpA OU HLA-B27 positivo + ≥2 achados.
A US tem papel auxiliar à RM, que é o método de escolha para sacroiliíte precoce.
═══════════════════════════════════════════════════════════════

1. ANATOMIA E ABORDAGEM
───────────────────────────────────────────────────────────────
As articulações sacroilíacas são articulações sinoviais na sua porção anterior/inferior
(2/3 inferiores) e sindesmoses na porção posterior/superior (1/3 superior — ligamentosa).

A US avalia a PORÇÃO ANTERIOR (sinovial) pela abordagem posterior ao paciente:
  • Plano paraaxial oblíquo: alinha o transdutor sobre o ilíaco, inclinando medialmente
    para visualizar a interlinha articular anterior (gap hipoecóico entre ilíaco e sacro).
  • Plano transversal: corte perpendicular à articulação.

Estruturas avaliadas:
  (a) Interlinha anterior: gap hipoecóico normal ≤2 mm (espaço sinovial).
  (b) Superfície cortical do ilíaco: deve ser hiperecoica e contínua.
  (c) Superfície cortical do sacro: hiperecoica e contínua.
  (d) Tecido sinovial: tecido hipoecóico entre as corticais (espessamento = patológico).
  (e) Ligamentos sacroilíacos posteriores: hiperecoicos, fibrilares.

2. CRITÉRIOS DE NORMALIDADE
───────────────────────────────────────────────────────────────
  Interlinha anterior normal: 1–3 mm (variável por superfície).
  Cortical ilíaca e sacral: contínua, hiperecoica, regular.
  Tecido sinovial: não visualizável ou mínima lâmina hipoecóica <1 mm.
  Power Doppler: ausente na interlinha articular anterior.
  Sem erosões (corticais íntegras em dois planos).

3. ACHADOS DE SACROILIÍTE ATIVA (INFLAMATÓRIA)
───────────────────────────────────────────────────────────────
Score OMERACT para sacroilíacas (0–3 por articulação):

ESPESSAMENTO SINOVIAL (B-Mode):
  Grau 0: Sem tecido sinovial visível além da lâmina fisiológica.
  Grau 1: Espessamento sinovial mínimo (1–2 mm), sem abaulamento cortical.
  Grau 2: Espessamento sinovial moderado (2–4 mm), com leve distensão da interlinha.
  Grau 3: Espessamento sinovial acentuado (>4 mm), com distensão importante da interlinha
           e possível derrame visível.

POWER DOPPLER NA INTERLINHA ANTERIOR:
  Grau 0: Ausente.
  Grau 1: Sinal mínimo (1–2 focos puntiformes).
  Grau 2: Sinal moderado (>2 focos ou linha confluente).
  Grau 3: Sinal acentuado (vascularização difusa na interlinha).

CRITÉRIO DE SACROILIÍTE ATIVA (OMERACT):
  Espessamento sinovial ≥2 + PD ≥1 = sacroiliíte ativa provável.
  PD Grau ≥2 isolado na interlinha anterior = forte indicador de atividade inflamatória.

4. ACHADOS DE SACROILIÍTE CRÔNICA (ESTRUTURAL)
───────────────────────────────────────────────────────────────
EROSÕES:
  Definição: descontinuidade da cortical hiperecoica do ilíaco ou sacro em DOIS planos.
  Localização preferencial: polo anterior-inferior da articulação (ilíaco > sacro).
  Dimensão: medir em mm. Erosões >5 mm = destruição estrutural significativa.
  PD intraósseo = erosão ativa (sinovite erosiva com hipervascularização intraóssea).

ESCLEROSE:
  Hiperecogenicidade aumentada da região periarticular (subcondrais ilíaco e sacral).
  Pode indicar processo de reparo/cronicidade.

ANQUILOSE (Estadio tardio — espondilite avançada):
  Perda da visualização da interlinha articular. Fusão óssea hiperecoica contínua.

5. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Articulações sacroilíacas sem alterações ao US.
  Conclusão: "Articulações sacroilíacas bilateralmente sem alterações ao estudo US."
  Conduta: seguimento clínico; RM se suspeita clínica de SpA axial (US normal não exclui).

N1 — Espessamento sinovial Grau 1 unilateral, PD Grau 0.
  Conclusão: "Discreta irregularidade da interlinha anterior sem vascularização ativa."
  Conduta: correlação clínica; repetir em 3–6 meses ou realizar RM para estadiamento.

N2 — Espessamento sinovial Grau 1–2 + PD Grau 1 unilateral ou bilateral.
     Erosão isolada ≤2 mm.
  Conclusão: "Sinais de sacroiliíte leve com atividade inflamatória discreta ao PD."
  Conduta: avaliação reumatológica; solicitar HLA-B27 e RM de sacroilíacas para estadiamento.

N3 — Espessamento sinovial Grau 2–3 + PD Grau 2 unilateral ou bilateral.
     Erosões múltiplas. Fusão parcial.
  Conclusão: "Sacroiliíte ativa de grau moderado com padrão erosivo. Achado consistente
  com espondiloartropatia axial ativa."
  Conduta: reumatologista urgente; RM de sacroilíacas para estadiamento definitivo;
  avaliação de AINE e eventual biológico (anti-TNF, anti-IL-17).

N4 — Espessamento sinovial Grau 3 + PD Grau 3 + derrame + contexto febril.
  ⚠️ GATILHO R6: Sacroiliíte séptica (rara mas grave): febre + PD intenso + derrame.
  Conclusão: "ALERTA: Achados suspeitos de sacroiliíte séptica. Avaliação urgente."
  Conduta: R6 — avaliação reumatológica/ortopédica urgente; hemoculturas; punção aspirativa
  diagnóstica guiada por US ou TC se accessível.

6. DIAGNÓSTICO DIFERENCIAL
───────────────────────────────────────────────────────────────
  SpA AXIAL (espondilite anquilosante / SpA nr-axial): espessamento sinovial bilateral
    simétrico + PD + HLA-B27 + dor lombar inflamatória (pior em repouso, melhora com atividade).
  ARTRITE PSORIÁSICA AXIAL: envolvimento sacroilíaco assimétrico, envolvimento periférico
    simultâneo (IFD, dactilite, entesite).
  SpA REATIVA (Síndrome de Reiter): pós-infecção (geniturinária ou gastrointestinal),
    assimétrica, transitória; tríade uretrite/artrite/conjuntivite.
  SACROILIÍTE DEGENERATIVA: esclerose subcondral bilateral, sem PD, sem erosão ativa,
    sem critérios inflamatórios; ocorre em >60 anos, bilateral e simétrica.
  SACROILIÍTE SÉPTICA: unilateral, febre alta, VHS/PCR muito elevados, derrame.
    → R6 imediato.
  OSTEITE CONDENSANTE DO ILÍACO: mulheres jovens multíparas; esclerose triangular do ilíaco
    sem erosão ou PD — variante benigna, não-inflamatória.

7. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Normal: "RM de sacroilíacas (STIR e T1) se suspeita clínica de SpA axial, pois US
  normal não exclui sacroiliíte precoce (edema medular não detectável pelo US)."
  Sacroiliíte ativa (N2–N3): "Encaminhamento reumatológico prioritário. RM de sacroilíacas
  para estadiamento. Considerar critérios ASAS para SpA axial."
  Sacroiliíte séptica (N4): ATIVAR R6 — "Avaliação urgente (reumatologia/ortopedia).
  Punção aspirativa, hemoculturas e antibioticoterapia."

OBSERVAÇÕES METODOLÓGICAS:
A US das sacroilíacas avalia principalmente a porção sinovial anterior da articulação,
sendo limitada para a porção ligamentosa posterior e para a detecção de edema de medula
óssea (característico da sacroiliíte precoce). A sensibilidade da US para sacroiliíte ativa
varia de 50–70% em comparação à RM (padrão-ouro). A avaliação do PD pela abordagem
posterior pode ser tecnicamente limitada em pacientes obesos ou com tecido subcutâneo
espesso. Resultados devem ser correlacionados com RM de sacroilíacas com sequências
STIR, critérios ASAS, HLA-B27 e dados clínicos. A ausência de alterações ao US não
exclui sacroiliíte e não deve substituir a RM em casos com forte suspeita clínica.`,
  customForm: '',
  clinicId: null,
};

const A3_pdus28 = {
  id: 'reumatologico-pdus28',
  area: 'reumatologico',
  name: 'PDUS-28',
  title: 'ULTRASSONOGRAFIA COM POWER DOPPLER — ESCORE PDUS-28',
  technique: `<p>Exame realizado com transdutor linear de alta frequência (12–18 MHz), em modo B-mode (escala de cinza) e Power Doppler (PRF 600–800 Hz, ganho máximo sem artefato, filtro de parede mínimo). Foram avaliadas 28 articulações bilateralmente de acordo com o protocolo PDUS-28 (EULAR/OMERACT). O exame seguiu sequência padronizada de articulações: ombros, cotovelos, punhos, MCF 2ª–5ª e IFP 2ª–5ª bilaterais, joelhos. Cada articulação foi avaliada no plano que melhor visualiza a sinovite (dorsal para MCF/IFP, anterior para ombros e joelhos, volar para punhos).</p>`,
  analysisTemplate: `<p><strong>RESULTADO DO PDUS-28:</strong></p>
<p>Score de Sinovite (B-mode): [total]/168 pontos</p>
<p>Score de Power Doppler: [total]/84 pontos</p>
<p>Score Total Composto: [total]/252 pontos</p>
<p>[Listar articulações com achados positivos e seus respectivos scores]</p>`,
  conclusionTemplate: `<p>PDUS-28: Score PD = [X]/84 | Score Cinza = [X]/168. Atividade inflamatória [ausente/leve/moderada/intensa].</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Correlação reumatológica para interpretação do PDUS-28 no contexto clínico e definição de conduta terapêutica.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: O PDUS-28 é um escore semicompartilhado sujeito a variabilidade interobservador. A confiabilidade aumenta com treinamento específico e padronização de equipamento/parâmetros. O PD é influenciado pela posição, compressão do probe e configurações do aparelho. Comparações seriadas (baseline vs. follow-up) devem ser realizadas no mesmo aparelho, com os mesmos parâmetros, preferencialmente pelo mesmo examinador. O PDUS-28 correlaciona-se com DAS28 e atividade histológica, mas não substitui dados laboratoriais e clínicos.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ESCORE PDUS-28 (POWER DOPPLER ULTRASSONOGRAPHY)
REUMATOLÓGICO — V1.0 — LAUD.IA
REFERÊNCIAS: EULAR/OMERACT · Naredo E. et al. (2011) · SBR · ACR · EFSUMB
═══════════════════════════════════════════════════════════════
ESCOPO: Protocolo de avaliação padronizada de 28 articulações pelo escore PDUS-28
(Power Doppler Ultrassonography Score 28 articulações), para quantificação de
sinovite ativa e monitoramento de resposta ao tratamento em artrite reumatoide (AR)
e outras artropatias inflamatórias.
USO CLÍNICO: Monitoramento de AR sob DMARD convencional (metotrexato, leflunomida)
ou biológico (anti-TNF, anti-IL-6, anti-CD20, anti-CTLA4); avaliação de remissão ou
baixa atividade ultrassonográfica; comparação pré/pós-tratamento.
═══════════════════════════════════════════════════════════════

1. 28 ARTICULAÇÕES DO PROTOCOLO PDUS-28 (BILATERAL)
───────────────────────────────────────────────────────────────
O PDUS-28 avalia exatamente as mesmas 28 articulações do DAS28 clínico:

MEMBROS SUPERIORES (20 articulações):
  Ombros direito e esquerdo                      → 2 articulações
  Cotovelos direito e esquerdo                   → 2 articulações
  Punhos direito e esquerdo                      → 2 articulações
  MCF 2ª–5ª direita (4 articulações)            → 4 articulações
  MCF 2ª–5ª esquerda (4 articulações)           → 4 articulações
  IFP 2ª–5ª direita (4 articulações)            → 4 articulações
  IFP 2ª–5ª esquerda (4 articulações)           → 4 articulações

MEMBROS INFERIORES (8 articulações):
  Joelhos direito e esquerdo                     → 2 articulações

TOTAL: 28 articulações bilaterais

2. ESCORES POR ARTICULAÇÃO
───────────────────────────────────────────────────────────────
Cada articulação recebe DOIS escores independentes:

SCORE DE SINOVITE (CINZA — B-mode): 0 a 3 por articulação
  Grau 0: Sem espessamento sinovial.
  Grau 1: Espessamento mínimo, sem abaulamento capsular.
  Grau 2: Espessamento moderado com leve abaulamento.
  Grau 3: Espessamento acentuado com abaulamento marcado.
  MÁXIMO cinza: 28 articulações × 3 = 84 pontos (MCF/IFP) +
                8 grandes articulações × 3 = 24 pontos
  TOTAL MÁXIMO CINZA: 168 pontos

SCORE DE POWER DOPPLER: 0 a 3 por articulação
  Grau 0: Sem sinal de PD.
  Grau 1: Sinal mínimo (1–3 focos ou 1 confluência isolada).
  Grau 2: Sinal moderado (>3 focos ou <50% da sinovial com PD).
  Grau 3: Sinal acentuado (>50% da sinovial com PD).
  TOTAL MÁXIMO PD: 28 × 3 = 84 pontos

ESCORE COMPOSTO (PDUS-28 Total):
  Cinza + PD = máximo 252 pontos.
  Para fins práticos, o score de PD isolado é o mais utilizado na literatura
  para monitoramento de atividade (PDUS-PD28).

3. LIMIARES DE ATIVIDADE (PDUS-PD28 — SCORE DE POWER DOPPLER ISOLADO)
───────────────────────────────────────────────────────────────
Com base nos estudos de Naredo et al. (2011) e Nguyen et al. (2014),
os seguintes limiares são referência para artrite reumatoide:

  PDUS-PD28 = 0         → Remissão ultrassonográfica (sem sinovite ativa)
  PDUS-PD28 = 1–5       → Baixa atividade ultrassonográfica
  PDUS-PD28 = 6–15      → Atividade moderada ultrassonográfica
  PDUS-PD28 ≥ 16        → Alta atividade ultrassonográfica

CORRELAÇÃO COM DAS28:
  DAS28-PCR <2,6 = remissão clínica | mas: 20–40% dos pacientes com DAS28 <2,6
  têm PDUS-PD28 >0 (sinovite subclínica residual = risco de progressão radiográfica).
  PDUS-PD28 ≤3 com DAS28 <2,6 = remissão robusta (menor risco de flare).

4. METODOLOGIA DE APLICAÇÃO DO PDUS-28
───────────────────────────────────────────────────────────────
SEQUÊNCIA PADRÃO DE AVALIAÇÃO:

Membros superiores — ombros:
  Plano de avaliação: coronal anterior (supra-espinhoso) + sagital (recesso
  anterior do recesso glenoumeral). Sinovite visível no recesso articular anterior.

Membros superiores — cotovelos:
  Plano: longitudinal posterior (recesso olécrano). Sinovite no recesso posterior.

Membros superiores — punhos:
  Plano: longitudinal dorsal (tenossinovite extensores + sinovite rádiocarpal).
  Plano complementar: volar (nervo mediano + tendões flexores — tenossinovite).

MCF 2ª–5ª (bilateral):
  Plano: longitudinal dorsal. A sinovite é avaliada no recesso dorsal das MCFs.
  Posição: leve flexão passiva do dígito para distender o recesso.

IFP 2ª–5ª (bilateral):
  Plano: longitudinal dorsal. Sinovite no recesso articular dorsal das IFPs.

Joelhos (bilateral):
  Plano: longitudinal anterior (quadríceps + recesso suprapatelar).
  Cisto de Baker: plano longitudinal posterior (entre gastrocnêmio medial e semimembranoso).

5. PLANILHA DE REGISTRO
───────────────────────────────────────────────────────────────
Apresentar resultado no laudo conforme tabela:

ARTICULAÇÃO       | LADO | CINZA (0-3) | PD (0-3)
Ombro             | D    |             |
Ombro             | E    |             |
Cotovelo          | D    |             |
Cotovelo          | E    |             |
Punho             | D    |             |
Punho             | E    |             |
MCF 2ª            | D    |             |
MCF 3ª            | D    |             |
MCF 4ª            | D    |             |
MCF 5ª            | D    |             |
MCF 2ª            | E    |             |
MCF 3ª            | E    |             |
MCF 4ª            | E    |             |
MCF 5ª            | E    |             |
IFP 2ª            | D    |             |
IFP 3ª            | D    |             |
IFP 4ª            | D    |             |
IFP 5ª            | D    |             |
IFP 2ª            | E    |             |
IFP 3ª            | E    |             |
IFP 4ª            | E    |             |
IFP 5ª            | E    |             |
Joelho            | D    |             |
Joelho            | E    |             |

TOTAL CINZA: ___/168    TOTAL PD: ___/84    TOTAL COMPOSTO: ___/252

6. INTERPRETAÇÃO CLÍNICA
───────────────────────────────────────────────────────────────
REMISSÃO ULTRASSONOGRÁFICA:
  PDUS-PD28 = 0: Sem sinovite ativa. Remissão ultrassonográfica atingida.
  Relevância: Score PD = 0 associa-se a menor progressão radiográfica em 1 ano vs. DAS28
  em remissão com PD residual.

SINOVITE SUBCLÍNICA RESIDUAL:
  PD > 0 com DAS28 <2,6: Sinovite ativa não detectada clinicamente.
  Implicação: risco aumentado de flare, progressão de erosões.
  Recomendação: discutir com reumatologista sobre ajuste de terapia ou watchful waiting.

COMPARAÇÃO EVOLUTIVA (baseline vs. follow-up):
  Redução >50% do PDUS-PD28: resposta ao tratamento (equivale a resposta ACR50).
  Aumento ≥20% do PDUS-PD28: ativação de doença (flare ultrassonográfico).
  Score estável: manutenção de atividade — reconsiderar régime terapêutico.

7. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — PDUS-PD28 = 0; Cinza ≤4 (sinais fisiológicos mínimos).
  Conclusão: "Remissão ultrassonográfica do PDUS-28. Sem sinovite ativa detectável."
  Conduta: manutenção do tratamento atual.

N1 — PDUS-PD28 = 1–5; Sinovite cinza leve nas MCF/IFP.
  Conclusão: "Baixa atividade ultrassonográfica (PDUS-PD28 = [X])."
  Conduta: correlação com DAS28 e PCR; considerar manutenção ou redução cautelosa de DMARD.

N2 — PDUS-PD28 = 6–15; Sinovite cinza moderada em múltiplas articulações.
  Conclusão: "Atividade inflamatória moderada ao PDUS-28 (PD = [X]/84)."
  Conduta: avaliação reumatológica para ajuste de DMARD ou introdução de biológico.

N3 — PDUS-PD28 ≥16; Sinovite cinza intensa, erosões novas ou progressivas.
  Conclusão: "Alta atividade inflamatória ao PDUS-28 (PD = [X]/84). [Erosões
  identificadas em...]."
  Conduta: encaminhamento reumatológico prioritário; ajuste terapêutico urgente;
  considerar troca de biológico ou adição de terapia combinada.

N4 — PDUS-PD28 muito elevado (PD >30) com artrite séptica suspeita em articulação específica.
  ⚠️ GATILHO R6: Derrame com ecos densos + PD Grau 3 + contexto febril → artrite séptica.
  Conclusão: "ALERTA: Articulação [X] com aspecto sugestivo de artrite séptica no
  contexto de PDUS-28 com alta atividade global."
  Conduta: R6 — avaliação emergencial; artrocentese; culturas do líquido sinovial.

8. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  PDUS-PD28 = 0: "Remissão ultrassonográfica atingida. Recomenda-se manutenção do
  tratamento atual e controle clínico semestral com reumatologista."
  PDUS-PD28 1–5: "Baixa atividade residual. Correlação com DAS28-PCR. Considerar
  manutenção ou descalonamento cauteloso da terapia."
  PDUS-PD28 ≥6: "Atividade inflamatória moderada-intensa. Encaminhamento reumatológico
  para ajuste de DMARD convencional ou biológico."
  Sinovite subclínica (PD>0 com DAS28<2,6): "Sinovite ativa subclínica identificada.
  Discussão com reumatologista sobre risco de flare e progressão erosiva."

OBSERVAÇÕES METODOLÓGICAS:
O PDUS-28 é um escore semicompartilhado sujeito a variabilidade inter e intraobservador
(ICC 0,70–0,85 reportado na literatura). A detecção de PD é altamente dependente de
equipamento (sensibilidade do Doppler) e parâmetros (PRF, filtro, ganho). Pressão
excessiva do probe suprime o sinal de PD — usar técnica de gel abundante sem compressão.
Para validade das comparações seriadas: mesmo aparelho, mesmos parâmetros, idealmente
mesmo examinador. O PDUS-28 NÃO substitui a avaliação clínica completa (DAS28, exame
físico), laboratorial (PCR, VHS, hemograma) e radiográfica anual na monitorização de AR.
Recomenda-se que resultados sejam interpretados sempre em conjunto com o reumatologista.`,
  customForm: '',
  clinicId: null,
};

const A4_doppler_renal = {
  id: 'vascular-doppler-renal',
  area: 'vascular',
  name: 'DOPPLER RENAL',
  title: 'ULTRASSONOGRAFIA COM DOPPLER DAS ARTÉRIAS RENAIS',
  technique: `<p>Exame realizado com transdutor convexo multifrequencial (2–5 MHz) para avaliação dos vasos hilares e intraparenquimatosos, com transdutor linear complementar (5–10 MHz) para porções acessíveis dos troncos renais. Doppler colorido e espectral foram aplicados para avaliação direta dos troncos das artérias renais (porção hilar e trajeto retroperitoneal quando acessível) e indiretamente das artérias segmentares, interlobares e arqueadas no interior do parênquima. O ângulo de insonação foi mantido abaixo de 60° para todas as mensurações espectrais. Avaliação bilateral em decúbito supino, lateral direito e lateral esquerdo conforme necessário para adequada janela acústica.</p>`,
  analysisTemplate: `<p><strong>MORFOLOGIA RENAL:</strong></p>
<p>Rim direito: [dimensões], parênquima [normal/alterado], sistema coletor [normal/dilatado].</p>
<p>Rim esquerdo: [dimensões], parênquima [normal/alterado], sistema coletor [normal/dilatado].</p>
<p><strong>DOPPLER DAS ARTÉRIAS RENAIS:</strong></p>
<p>Artéria renal direita: VPS [X] cm/s | VDF [X] cm/s | IR hilar [X] | Padrão [normal/tardus-parvus].</p>
<p>Artéria renal esquerda: VPS [X] cm/s | VDF [X] cm/s | IR hilar [X] | Padrão [normal/tardus-parvus].</p>
<p>IR intraparenquimatoso direito: [X] (polo sup), [X] (polo med), [X] (polo inf).</p>
<p>IR intraparenquimatoso esquerdo: [X] (polo sup), [X] (polo med), [X] (polo inf).</p>`,
  conclusionTemplate: `<p>Estudo Doppler das artérias renais sem evidências de estenose hemodinamicamente significativa (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Recomenda-se seguimento clínico e laboratorial conforme protocolo do médico assistente.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A avaliação direta dos troncos das artérias renais pode ser tecnicamente limitada por interposição gasosa intestinal, obesidade e profundidade das estruturas. Nesses casos, a avaliação indireta dos IRs intraparenquimatosos complementa o diagnóstico (padrão tardus-parvus). A sensibilidade da US para estenose de artéria renal é de 75–90% para estenoses >60%, com especificidade de 70–85%. A angiotomografia ou RM angiografia é o método de escolha para confirmação diagnóstica antes de intervenção. Em transplante renal, os parâmetros diferem do rim nativo.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA COM DOPPLER DAS ARTÉRIAS RENAIS
VASCULAR — V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · AIUM · AHA/ACC · SBN · ACR
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação Doppler das artérias renais (rim nativo bilateral e rim transplantado)
para pesquisa de estenose hemodinamicamente significativa, trombose, perfusão
intraparenquimatosa e avaliação pós-transplante. Template de CAMADA 3 para o exame
específico DOPPLER RENAL — referenciado pela Camada 2 vascular §4.
═══════════════════════════════════════════════════════════════

1. PROTOCOLO DE AVALIAÇÃO — RIM NATIVO
───────────────────────────────────────────────────────────────
AVALIAÇÃO MORFOLÓGICA PRÉVIA (obrigatória antes do Doppler):
  • Dimensões renais bilaterais: comprimento × largura × espessura (cm).
  • Assimetria: diferença >1,5 cm entre rins = suspeita de causa vascular.
  • Parênquima: ecogenicidade, diferenciação corticomedular, espessura córtex.
  • Sistema coletor: dilatação (gradação SFU/UTD se presente).

DOPPLER DIRETO DOS TRONCOS RENAIS:
  • Origem na aorta: pesquisar turbulência e aceleração no óstio renal.
  • Tronco proximal (porção hilar): VPS, VDF, IP, IR.
  • Artéria renal principal completa quando acessível: todo o trajeto retroperitoneal.
  • Relação Artéria Renal/Aorta (RAR): calcular quando VPS aórtica disponível.

DOPPLER INDIRETO INTRAPARENQUIMATOSO:
  Medir IR e tempo de aceleração em 3 pontos por rim:
  • Polo superior (artéria segmentar/interlobar superior)
  • Polo médio (artéria segmentar/interlobar média)
  • Polo inferior (artéria segmentar/interlobar inferior)
  Registrar: VPS, VDF, IR (cada ponto) — calcular média intraparenquimatosa.

DOPPLER DAS VEIAS RENAIS:
  • Perviedade bilateral ao color Doppler.
  • Padrão espectral: contínuo e fásico com a respiração (normal).
  • Ausência de falhas de preenchimento (trombo).

2. PARÂMETROS DE NORMALIDADE — RIM NATIVO
───────────────────────────────────────────────────────────────
Artéria Renal Principal (Tronco Hilar):
  VPS: <180 cm/s (sensível) / <200 cm/s (específico para estenose >60%)
  IR hilar: 0,55–0,70
  IP: 0,70–1,20

Artérias Intraparenquimatosas (Interlobares/Arqueadas):
  IR: 0,55–0,70 (média dos 3 polos)
  Assimetria bilateral: diferença de IR >0,05 = significativa
  Padrão espectral: pico sistólico abrupto + boa diástole (índice de aceleração normal)
  Tempo de Aceleração (TA): <70 ms (normal)
  Índice de Aceleração (IA): >300 cm/s² (normal)

Veia Renal:
  Fluxo contínuo, fásico, hepatópeto (em direção à VCI)

3. CRITÉRIOS DE ESTENOSE DA ARTÉRIA RENAL (≥60%)
───────────────────────────────────────────────────────────────
CRITÉRIOS DIRETOS (avaliação do tronco renal):
  • VPS tronco >180 cm/s: sensibilidade 85–90%, especificidade 70%
  • VPS tronco >200 cm/s: especificidade 90%, sensibilidade 70%
  • Relação Artéria Renal/Aorta (RAR) >3,5: alta especificidade
  • Turbilhonamento pós-estenótico com alargamento espectral
  • Gradiente de velocidade proximal/distal >2,0
  NOTA: NUNCA calcular RAR sem VPS aórtica disponível — risco de resultado falso.

CRITÉRIOS INDIRETOS INTRAPARENQUIMATOSOS (padrão tardus-parvus):
  Indicam estenose proximal significativa ao tronco (perda do pico sistólico):
  • Tempo de Aceleração (TA) >70 ms: sensibilidade 70–80%
  • Índice de Aceleração (IA) <300 cm/s²: especificidade 90%
  • Perda do ESP (Early Systolic Peak — pico sistólico precoce): tardusy-parvus completo
  • IR assimétrico (>0,05 diferença bilateral): indica causa vascular unilateral
  NOTA: padrão tardus-parvus PODE estar ausente em estenose leve (<60%) ou
  quando há estenose bilateral (IR baixo bilateral sem assimetria).

CLASSIFICAÇÃO DE ESTENOSE:
  Sem estenose: VPS <180 cm/s + IR 0,55–0,70 + sem tardus-parvus
  Estenose <60%: VPS 180–200 cm/s, RAR 2,5–3,5, sem tardus-parvus
  Estenose ≥60%: VPS >200 cm/s + RAR >3,5 + tardus-parvus intraparenquimatoso
  Oclusão: Ausência de fluxo no tronco + tardus-parvus ipsilateral grave ou ausência

4. AVALIAÇÃO DO RIM TRANSPLANTADO
───────────────────────────────────────────────────────────────
PROTOCOLO ESPECÍFICO (diferente do rim nativo):
  O rim transplantado fica na fossa ilíaca (direita ou esquerda).
  Acesso: transdutor linear ou convexo diretamente sobre a fossa ilíaca.

Artéria de anastomose (artéria renal transplantada → artéria ilíaca externa/interna):
  • VPS na anastomose: 150–300 cm/s (variável conforme calibre e técnica)
  • Gradiente de velocidade anastomótico >3:1 = suspeita de estenose
  • Relação intra-hilar: calcular

IR intraparenquimatoso transplante:
  Normal: 0,55–0,75 (pode ser ligeiramente maior que o nativo)
  IR >0,80: suspeita de rejeição aguda (celular ou humoral)
  IR >0,85: indicador de disfunção grave (nefrotoxicidade por calcineurina, obstrução)
  IR <0,50 com pico sistólico abrupto: fístula arteriovenosa pós-biópsia (comum)

Veia renal transplante: avaliar perviedade. Trombose venosa = emergência → R6.
Pelve renal transplante: hidronefrosa (dilatação pielocalicinal) = suspeita de obstrução.
Linfocele peri-transplante: coleção anecóica peri-renal (complicação pós-cirúrgica frequente).

ACHADOS ESPECÍFICOS DO TRANSPLANTE:
  Fístula AV pós-biópsia: comunicação arteriovenosa intrarrenal; ao color = turbulência;
    ao espectral = onda arterial de baixa resistência + onda venosa pulsátil. Tratar se
    sintomático (queda de Hb, hematúria, HTA). Pequenas fístulas resolvem espontaneamente.
  Pseudo-aneurisma pós-biópsia: massa cística com swirling flow ao PD + turbulência espectral.

5. TROMBOSE VENOSA RENAL (TVR)
───────────────────────────────────────────────────────────────
Rara mas grave. Causas: síndrome nefrótica, neoplasia (CCC), trauma, transplante.

Achados US:
  • Veia renal sem fluxo ao color Doppler (ausência de preenchimento de cor).
  • Material hipoecoico/anecóico intraluminal (trombo recente).
  • Rim aumentado, hipoecóico, edemaciado.
  • Fluxo arterial intraparenquimatoso paradoxal: IR >0,90 com inversão diastólica
    (padrão de altíssima resistência = perfusão comprometida).
  • Ausência de fluxo venoso bilateral = emergência.

⚠️ GATILHO R6: TVR → "ALERTA VASCULAR: Trombose de veia renal. Avaliação nefrológica/
vascular urgente para anticoagulação e intervenção."

⚠️ GATILHO R6 ADICIONAL: IR bilateral >0,85 com oligúria/anúria = disfunção renal grave;
avaliação nefrológica de urgência.

6. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Sem estenose. VPS <180 cm/s. IR 0,55–0,70. Sem tardus-parvus. Simetria.
  Conclusão: "Artérias renais pérvias bilateralmente. Sem evidências de estenose
  hemodinamicamente significativa. IRs intraparenquimatosos dentro dos limites
  normais, sem assimetria significativa."

N1 — VPS 150–180 cm/s isolado, sem critérios adicionais. IR 0,70–0,74.
     Assimetria de IR 0,05–0,07.
  Conclusão: "Leve elevação da resistividade intraparenquimatosa [à direita/esquerda].
  Sem critérios para estenose hemodinamicamente significativa."
  Conduta: correlação laboratorial (creatinina, TFG). Repetir em 6–12 meses.

N2 — VPS 180–200 cm/s. RAR 2,5–3,5. IR 0,74–0,80. Leve tardus-parvus.
  Conclusão: "Padrão hemodinâmico sugestivo de estenose de artéria renal de grau
  intermediário [à direita/esquerda]. IR elevado com assimetria [X]."
  Conduta: correlação clínica (HTA refratária, insuficiência renal progressiva);
  complementar com Angiotomografia/RM para confirmação.

N3 — VPS >200 cm/s. RAR >3,5. Tardus-parvus intraparenquimatoso.
     Assimetria renal >1,5 cm + IR assimétrico.
  Conclusão: "Estenose de artéria renal hemodinamicamente significativa [à direita/esquerda].
  Padrão tardus-parvus intraparenquimatoso ipsilateral."
  Conduta: Angiotomografia/RM angiografia urgente; encaminhamento para cirurgia vascular
  ou radiologia intervencionista (angioplastia/stent).

N4 — Trombose venosa renal (ausência de fluxo venoso). IR bilateral >0,85 com oligúria.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA VASCULAR: [Trombose de veia renal / Disfunção renal crítica]."
  Conduta: R6 — avaliação nefrológica/vascular urgente.

7. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Sem estenose: "Seguimento clínico habitual conforme protocolo do médico assistente."
  IR elevado bilateral: "Correlação nefrológica (creatinina, TFG, microalbuminúria,
  exame de urina) para investigação de nefropatia parenquimatosa."
  Suspeita de estenose (N2-N3): "Complementar com Angiotomografia ou RM angiografia
  para confirmação diagnóstica e planejamento de intervenção (angioplastia/stent)."
  Transplante com IR >0,80: "Biópsia renal a critério nefroterapêutico para afastar
  rejeição celular/humoral. Correlação com proteinúria, função do enxerto e imunossupressão."
  TVR: ATIVAR R6.

OBSERVAÇÕES METODOLÓGICAS:
A avaliação direta dos troncos das artérias renais pode ser tecnicamente limitada por
interposição gasosa intestinal, obesidade e profundidade retroperitoneal. A sensibilidade
da US-Doppler para estenose de artéria renal >60% é de 70–90% conforme estudo e operador.
O padrão tardus-parvus pode estar ausente em estenoses bilaterais (sem assimetria de IR).
A angiotomografia de artérias renais (Angio-TC) é o método de referência para
confirmação de estenose e planejamento de intervenção. Em pacientes com rim único,
insuficiência renal avançada ou contraindicação a contraste, a RM angiografia é alternativa.
Todos os valores Doppler são angulo-dependentes — manter ângulo <60° é essencial para
acurácia diagnóstica. IRs muito baixos (<0,50) em rim nativo podem indicar fístula AV,
neoplasia hipervascular ou erro técnico.`,
  customForm: '',
  clinicId: null,
};

const A5_quadril_ddq = {
  id: 'pediatria-quadril-pediarico-ddq',
  area: 'pediatria',
  name: 'QUADRIL PEDIÁTRICO — DDQ',
  title: 'ULTRASSONOGRAFIA DO QUADRIL PEDIÁTRICO — DISPLASIA DO DESENVOLVIMENTO DO QUADRIL (DDQ)',
  technique: `<p>Exame realizado com transdutor linear de alta frequência (7,5–15 MHz), com o lactente em decúbito lateral com quadril em posição neutra (leve flexão de 20°), membro inferior em extensão e rotação interna leve. O plano coronal padrão de Graf foi obtido com identificação do ponto de referência do ílio plano (fossa ilíaca), teto acetabular ósseo plano e labro acetabular. As medidas foram obtidas na imagem padrão de Graf (plano coronal estrito), com linha de base tangencial ao ílio plano, linha do teto ósseo e linha do lábio cartilaginoso. Avaliação bilateral.</p>`,
  analysisTemplate: `<p><strong>QUADRIL DIREITO:</strong></p>
<p>Ângulo alfa (α): [X]° | Ângulo beta (β): [X]°</p>
<p>Cobertura cefálica: [X]%</p>
<p>Classificação de Graf: Tipo [X]</p>
<p>Cabeça femoral: [centrada/descentralizada]. Núcleo de ossificação: [presente/ausente].</p>
<p><strong>QUADRIL ESQUERDO:</strong></p>
<p>Ângulo alfa (α): [X]° | Ângulo beta (β): [X]°</p>
<p>Cobertura cefálica: [X]%</p>
<p>Classificação de Graf: Tipo [X]</p>
<p>Cabeça femoral: [centrada/descentralizada]. Núcleo de ossificação: [presente/ausente].</p>`,
  conclusionTemplate: `<p>Quadris com classificação de Graf Tipo I bilateral — aspectos normais para a faixa etária (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Recomenda-se seguimento ortopédico pediátrico rotineiro conforme protocolo de rastreio de DDQ.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A ultrassonografia do quadril pediátrico pelo método de Graf é examinador-dependente e requer calibração precisa do plano coronal padrão. Planos oblíquos levam a medidas falsamente alteradas dos ângulos α e β. A US é o método de escolha até os 4–6 meses de idade (antes da ossificação da cabeça femoral). Após os 4–6 meses, o raio-X passa a ter maior valor diagnóstico. A confiabilidade do método depende de formação específica e experiência do examinador. A interpretação deve ser correlacionada com fatores de risco, exame físico (sinal de Ortolani/Barlow) e evolução clínica.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DO QUADRIL PEDIÁTRICO (DDQ)
PEDIATRIA — V1.0 — LAUD.IA
REFERÊNCIAS: Graf R. (método original 1984/2000) · CBR · SBP · SBOrP · AAP · ESPR
═══════════════════════════════════════════════════════════════
ESCOPO: Rastreio e diagnóstico de Displasia do Desenvolvimento do Quadril (DDQ)
em lactentes pelo método ultrassonográfico de Graf. Aplicável de 0 a 6 meses
(ou até 12 meses conforme indicação clínica, com limitações progressivas pela
ossificação femoral). Protocolo de avaliação bilateral padronizado.
═══════════════════════════════════════════════════════════════

1. TÉCNICA — PLANO PADRÃO DE GRAF (obrigatório)
───────────────────────────────────────────────────────────────
O plano coronal padrão de Graf é MANDATÓRIO para medidas válidas:

Critérios do plano padrão (todos devem estar presentes):
  (a) Fossa ilíaca completamente plana (ílio horizontal sem curvatura)
  (b) Teto acetabular ósseo vísivel no terço médio do teto (não polo)
  (c) Labro cartilaginoso (lábio) visível como estrutura hiperecoica triangular
  (d) Cabeça femoral circular e centrada no acetábulo (ou posição avaliada)
  (e) Transição ílio-acetabular tangencial ao probe

Se o plano não for adequado → refazer antes de medir.
Planos oblíquos geram α falsamente MENOR e β falsamente MAIOR (erro diagnóstico).

2. MEDIDAS OBRIGATÓRIAS
───────────────────────────────────────────────────────────────
ÂNGULO ALFA (α) — TETO ÓSSEO:
  Definição: ângulo entre a linha de base (ílio) e a linha do teto ósseo (acetabular).
  Mede a cobertura ÓSSEA da cabeça femoral.
  Quanto MAIOR o α, MELHOR a cobertura óssea.
  Normal: ≥60° (Graf Tipo I).

ÂNGULO BETA (β) — TETO CARTILAGINOSO:
  Definição: ângulo entre a linha de base (ílio) e a linha do lábio cartilaginoso.
  Mede a posição do lábio (deslocamento lateral/superior).
  Quanto MENOR o β, MELHOR a posição labial.
  Normal: <55° (Graf Tipo I e IIa/b).

PORCENTAGEM DE COBERTURA CEFÁLICA:
  Definição: proporção da cabeça femoral coberta pelo teto acetabular no plano coronal.
  Normal: >50% da cabeça coberta.
  Calcular: (diâmetro cefálica coberta / diâmetro total cabeça) × 100.

NÚCLEO DE OSSIFICAÇÃO FEMORAL:
  Presente: estrutura hiperecoica central com sombra acústica posterior (ossificação iniciada).
  Ausente: normal até 4–6 meses; ausência após 6 meses = avaliar displasia associada.
  NOTA: presença de núcleo ossificado limita a visibilidade da cabeça femoral e
  torna a US progressivamente menos informativa.

3. CLASSIFICAÇÃO DE GRAF — COMPLETA
───────────────────────────────────────────────────────────────
TIPO I — Quadril Maduro (Normal):
  α ≥60° | β <55°
  Subtipo Ia: β <55° (labro invertido para dentro — ideal)
  Subtipo Ib: β >55° (labro vertical — ainda normal se α ≥60°)
  Cobertura: >50%. Cabeça centrada.
  Conduta: NORMAL — seguimento pediátrico rotineiro.

TIPO IIa — Imaturo Fisiológico (normal até 3 meses):
  α 50–59° | β <55° | IDADE <3 meses
  Teto ósseo arredondado (menos pronunciado que Tipo I).
  Cabeça ainda centrada.
  Conduta: MATURAÇÃO ESPONTÂNEA ESPERADA. Controle US em 4–6 semanas.
  NOTA: α 50–59° em <3 meses = imaturo fisiológico → NÃO é displasia nesta faixa etária.

TIPO IIb — Imaturo Atrasado (patológico ≥3 meses):
  α 50–59° | β <55° | IDADE ≥3 meses
  Atraso na ossificação do teto — esperado ter Graf I por esta idade.
  Conduta: Encaminhamento ortopedia pediátrica — ARNÊS DE PAVLIK indicado.

TIPO IIc — Crítico / Deficiente:
  α 43–49° | β 55–77°
  Teto ósseo insuficiente. Labro em posição limítrofe.
  Cabeça ainda centrada mas com cobertura mínima.
  Conduta: Encaminhamento URGENTE para ortopedia — arnês de Pavlik imediato.

TIPO IId — Descentralizante / Limítrofe:
  α 43–49° | β >77°
  Labro deslocado cranialmente. Cabeça parcialmente descentralizada.
  Conduta: Encaminhamento URGENTE — arnês de Pavlik ou gesso conforme ortopedista.

TIPO III — Descentralizado / Luxado (lábio cranialmente deslocado):
  α <43° | Lábio cartilaginoso deslocado cranialmente e comprimido pelo fêmur.
  Subtipo IIIa: cartilagem labral mantida (sem degeneração)
  Subtipo IIIb: cartilagem labral degenerada (alteração estrutural)
  Cabeça fora do acetábulo.
  Conduta: ⚠️ ENCAMINHAMENTO ORTOPÉDICO URGENTE — R6.

TIPO IV — Luxado Invertido (lábio caudalmente deslocado):
  α <43° | Lábio cartilaginoso empurrado caudalmente (interposição entre cabeça e acetábulo).
  Forma mais grave de DDQ. Geralmente necessita cirurgia.
  Conduta: ⚠️ ENCAMINHAMENTO ORTOPÉDICO URGENTE — R6.

4. FATORES DE RISCO PARA DDQ
───────────────────────────────────────────────────────────────
Relatar no laudo quando presentes (aumentam a suspeita mesmo com US normal):
  • Apresentação pélvica (principal fator de risco — prevalência DDQ 2–4%)
  • Primogênita do sexo feminino
  • Oligodrâmnio (compressão intrauterina)
  • História familiar de DDQ em parentes de 1º grau
  • Pé torto equinovaro congênito concomitante
  • Gemelar (especialmente o segundo gemelar)
  • Tortícolis muscular congênita associada

5. CONDUTA POR TIPO DE GRAF
───────────────────────────────────────────────────────────────
TIPO I:             NORMAL — Seguimento rotineiro pediátrico.
TIPO IIa (<3m):     CONTROLE — US em 4–6 semanas (maturação esperada).
TIPO IIa (≥3m):     ENCAMINHAR — Ortopedia pediátrica; considerar arnês.
TIPO IIb:           ENCAMINHAR — Ortopedia; arnês de Pavlik indicado.
TIPO IIc/IId:       URGENTE — Ortopedia; arnês imediato.
TIPO III/IV:        R6 — Ortopedia urgente. Imobilização emergencial.

6. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Graf Tipo I bilateral. α ≥60° bilateral. Cobertura >50%.
  Conclusão: "Quadris com maturação adequada para a faixa etária (Graf Tipo I bilateral).
  Sem evidências de displasia do desenvolvimento do quadril."
  Conduta: seguimento pediátrico habitual.

N1 — Graf Tipo IIa unilateral ou bilateral em <3 meses.
  Conclusão: "Imaturidade fisiológica dos quadris [direito/esquerdo/bilateral],
  compatível com Graf Tipo IIa em lactente <3 meses."
  Conduta: controle ultrassonográfico em 4–6 semanas.

N2 — Graf Tipo IIa bilateral em >3 meses; Tipo IIb unilateral.
  Conclusão: "Atraso na maturação acetabular [unilateral/bilateral] — Graf Tipo IIa
  (>3 meses) / Tipo IIb. Displasia do desenvolvimento do quadril leve."
  Conduta: encaminhamento para ortopedia pediátrica; arnês de Pavlik.

N3 — Graf Tipo IIc ou IId unilateral ou bilateral.
  Conclusão: "Displasia acentuada do quadril [direito/esquerdo/bilateral] — Graf Tipo
  IIc/IId. Cobertura óssea insuficiente com posição labral crítica."
  Conduta: encaminhamento ortopédico urgente; arnês de Pavlik ou gesso.

N4 — Graf Tipo III ou IV (luxação franca).
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA: Luxação congênita do quadril [direito/esquerdo/bilateral] —
  Graf Tipo [III/IV]. Cabeça femoral descentralizada."
  Conduta: R6 — encaminhamento ortopédico pediátrico urgente para imobilização
  emergencial e planejamento cirúrgico se necessário.

7. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Graf Tipo I: "Aspectos ultrassonográficos normais para a faixa etária. Seguimento
  pediátrico habitual sem necessidade de controle de imagem adicional."
  Graf IIa (<3m): "Controle ultrassonográfico do quadril em 4–6 semanas para
  avaliação de maturação espontânea."
  Graf IIa (≥3m) / IIb: "Encaminhamento para ortopedia pediátrica para avaliação
  e provável uso de arnês de Pavlik."
  Graf IIc / IId: "Encaminhamento ortopédico urgente para planejamento de contenção."
  Graf III / IV: ATIVAR R6 — "Encaminhamento para ortopedia pediátrica com urgência
  para imobilização emergencial."

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia do quadril pelo método de Graf é o padrão ouro para rastreio de DDQ
em lactentes <4–6 meses. A qualidade do exame é criticamente dependente da obtenção
do plano coronal padrão de Graf — erros de posicionamento do probe geram medidas
falsamente alteradas. A US perde valor diagnóstico após 4–6 meses pela ossificação
progressiva da cabeça femoral, sendo o raio-X anteroposterior da pelve o método de
escolha após essa faixa etária. Achados limítrofes (Graf IIa) em lactentes muito jovens
devem ser interpretados com cautela, considerando a maturação fisiológica normal. A
presença de fatores de risco (apresentação pélvica, história familiar) indica rastreio
mesmo em exames com α 55–59°. A interpretação deve ser sempre correlacionada com
o exame físico ortopédico (sinais de Ortolani e Barlow).`,
  customForm: '',
  clinicId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUP B — FIXES ON EXISTING TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

// B2: ABDOME SUPERIOR COM DOPPLER — add OBSERVAÇÕES METODOLÓGICAS
const b2 = existing.find(t => t.id === 'gBDCKQfrk1vi8YBdzd3J');
const B2_fix = {
  id: b2.id,
  aiInstructions: b2.aiInstructions + `

4. ESTRUTURA DO LAUDO — SKELETON OBRIGATÓRIO
═══════════════════════════════════════════════════════════════
O laudo deve ser estruturado em HTML puro com as seguintes seções obrigatórias:

TÍTULO: ULTRASSONOGRAFIA DE ABDOME SUPERIOR COM DOPPLER

TÉCNICA:
Exame realizado com transdutor convexo multifrequencial por via transabdominal, com varreduras
nos planos longitudinal, transversal e oblíquo. A avaliação vascular foi realizada com Doppler
colorido e espectral pulsado dos eixos hepato-portal (veia porta, artéria hepática, veias
hepáticas, veia esplênica, veia mesentérica superior) e vasculatura renal (artérias renais
principais e intraparenquimatosas, veias renais bilateralmente).

ANÁLISE:
Estruturar por órgão/sistema com ênfase nos achados Doppler quando alterados:
  [FÍGADO] → [VIAS BILIARES] → [VESÍCULA] → [PÂNCREAS] → [BAÇO] →
  [RINS] → [GRANDES VASOS] → [AVALIAÇÃO HEMODINÂMICA DOPPLER]

Na seção AVALIAÇÃO HEMODINÂMICA DOPPLER: relatar status de cada eixo vascular
(veia porta, artéria hepática, veias hepáticas, artérias renais) mesmo que normal,
pois este é o diferencial deste exame em relação ao abdome superior sem Doppler.

CONCLUSÃO: hierarquizar N4 → N0. Incluir síntese hemodinâmica obrigatória.
RECOMENDAÇÕES: proporcional à gravidade dos achados.

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia de abdome superior com Doppler é um método operador-dependente e
dinâmico. A avaliação hemodinâmica dos eixos vasculares hepato-portais é tecnicamente
sensível a fatores como estado pós-prandial (velocidade portal aumentada após refeição),
frequência cardíaca (veias hepáticas com padrão modificado em taquicardia ou fibrilação
atrial), retenção respiratória e posicionamento do paciente. Os valores de velocidade
portal podem variar 15–20% entre diferentes momentos de avaliação. A avaliação direta
dos troncos das artérias renais pode ser limitada por interposição gasosa e biotipo do
paciente; nesses casos, os critérios indiretos intraparenquimatosos (padrão tardus-parvus,
IR assimétrico) complementam o diagnóstico. A síndrome de Budd-Chiari e a trombose
portal requerem confirmação por angiotomografia ou angio-RM para planejamento terapêutico.
Achados devem ser correlacionados com dados clínicos, laboratoriais (função hepática,
hemograma, coagulograma) e histórico de exames anteriores.`
};

// B14: DOPPLER VENOSO MEMBRO SUPERIOR — expand significantly
const b14 = existing.find(t => t.id === 'nEOVai6ao1O7OMUp2MqF');
const B14_expanded = {
  id: b14.id,
  aiInstructions: `EXAME: DOPPLER VENOSO DE MEMBRO SUPERIOR | ÁREA: vascular | V1.0 — LAUD.IA
REFERÊNCIAS: CBR · SBACV · ISTH · ASH Guidelines · Constans et al. · ESC
─────────────────────────────────────────────────────────────────
§ PROTOCOLO ESPECÍFICO:
  • Veias avaliadas: subclávia, axilar, braquiais (par), radiais, ulnares, cefálica, basílica bilaterais.
  • Critério TVP: incompressibilidade + ausência/redução de fluxo espontâneo ao color Doppler.
  • TVP subclávia/axilar = R6 imediato (risco de TEP comparável à TVP proximal MMII).
  • Síndrome de Paget-Schroetter: TVP de esforço — jovens, contexto atlético, extremidade dominante.
  • Acesso venoso central: avaliar perviedade de jugular, subclávia e femoral quando indicado.
  • FAV para hemodiálise: VPS no segmento anastomótico e nas veias de drenagem.
─────────────────────────────────────────────────────────────────

PROMPT ESPECÍFICO — DOPPLER VENOSO DE MEMBRO SUPERIOR
VASCULAR — V1.0 — LAUD.IA
CBR / SBACV / ISTH / ACR / AIUM
═══════════════════════════════════════════════════════════════

ESCOPO E OBJETIVO:
Avaliação ultrassonográfica com Doppler dos sistemas venosos profundo e superficial
dos membros superiores para pesquisa de Trombose Venosa Profunda (TVP), Tromboflebite
Superficial (TFS), perviedade de acessos vasculares (CVC, PICC) e fístulas arteriovenosas
(FAV) para hemodiálise. Avaliação bilateral quando clinicamente indicado.

1. ANATOMIA VENOSA — MEMBROS SUPERIORES
───────────────────────────────────────────────────────────────
SISTEMA VENOSO PROFUNDO (avaliação obrigatória em suspeita de TVP):
  Veia Subclávia (VSubC): porção retrocoracoidea (proximal ao primeiro arco costal).
  Veia Axilar (VAx): axila, medial ao músculo subescapular.
  Veia Braquial (VBraq): par — medial e lateral ao nervo mediano/braquial.
  Veia Ulnar: par — acompanha artéria ulnar.
  Veia Radial: par — acompanha artéria radial.
  Veia Interóssea: avaliação complementar.
  Veia Jugular Interna (VJI): avaliar se indicado (cateter central, síndrome de veia cava).

SISTEMA VENOSO SUPERFICIAL (avaliação em TFS e mapeamento pré-FAV):
  Veia Cefálica: face lateral do antebraço e braço, sulco deltopeitoral.
  Veia Basílica: face medial do braço, região cubital.
  Veia Mediana Cubital: anastomose entre cefálica e basílica (fossa antecubital).

COMUNICAÇÕES:
  Veia Axilar recebe: basílica + braquial + cefálica.
  Veia Subclávia: continuação da axilar a partir da costela.

2. PROTOCOLO DE AVALIAÇÃO (TÉCNICA)
───────────────────────────────────────────────────────────────
POSIÇÃO DO PACIENTE: decúbito dorsal, cabeça levemente rodada para o lado oposto
(acesso à subclávia e jugular). Membro superior em posição anatômica ou ligeiramente
abduzido para acesso axilar/braquial.

MÉTODO DE COMPRESSÃO:
  Compressibilidade é o critério PRIMÁRIO para diagnóstico de TVP nos segmentos acessíveis.
  Compressível = NORMAL (veia colabada completamente com pressão leve do probe).
  Incompressível = TVP (veia mantém seu lúmen mesmo com pressão moderada).
  ATENÇÃO: Veias subclávias e porção proximal da axilar são parcialmente inacessíveis
  à compressão direta (cobertura óssea) — nesses segmentos, usar critérios Doppler.

CRITÉRIOS DOPPLER PARA SEGMENTOS NÃO COMPRESSÍVEIS (subclávia):
  Normal: fluxo espontâneo fásico com respiração, aumenta com manobra de Valsalva.
  TVP: ausência ou redução de fluxo espontâneo; ausência de resposta ao Valsalva.
  Turbulência distal ao trombo: fluxo turbulento na veia axilar ipsilateral.

SEQUÊNCIA DE AVALIAÇÃO:
  1. Subclávia porção acessível (fossa infraclavicular)
  2. Junção subclávia-jugular (se indicado)
  3. Axilar (compressão progressiva)
  4. Braquial par (fossa antecubital → terço médio)
  5. Antebraço (ulnar e radial quando indicado)
  6. Cefálica e basílica (mapeamento ou TFS)

3. CRITÉRIOS DIAGNÓSTICOS DE TVP (MMSS)
───────────────────────────────────────────────────────────────
DIAGNÓSTICO DEFINITIVO:
  Trombo VISUALIZADO (material hipoecoico/isoecóico no lúmen) + incompressibilidade.
  OU: incompressibilidade isolada (trombo recente anecóico pode não ser visível em B-mode).
  OU: ausência de fluxo espontâneo + não preenchimento ao color Doppler nos segmentos
  proximais não compressíveis.

CRITÉRIOS DE EXTENSÃO DO TROMBO:
  Trombo oclusivo: lúmen completamente preenchido, sem fluxo ao Doppler colorido.
  Trombo não-oclusivo (flutuante/mural): fluxo residual ao lado do trombo.
  Extensão: relatar segmento proximal e distal envolvidos.
  Trombo recente: anecóico (primeiros dias) / isoecóico (1–2 semanas).
  Trombo organizado (crônico): hiperecoico, com redução do calibre venoso (fibrose).

4. PROBABILIDADE PRÉ-TESTE (ESCORE DE CONSTANS — TVP MMSS)
───────────────────────────────────────────────────────────────
Antes de emitir conclusão diagnóstica, correlacionar com o escore de Constans:

VARIÁVEIS                                          | PONTOS
Cateter venoso central ou PICC ipsilateral         | +1
Localização (brachial/axillar → subclavian/jugular)| +1
Dor localizada ipsilateral                         | +1
Edema de membro unilateral                         | +1
Diagnóstico alternativo ao menos tão provável      | -1

INTERPRETAÇÃO:
  ≤0: Baixa probabilidade (TVP improvável) — US negativa virtualmente exclui.
  1–2: Probabilidade moderada — US positiva confirma; US negativa pode necessitar repetição.
  ≥3: Alta probabilidade — US positiva confirma; US negativa → considerar venografia ou
      angiotomografia torácica.

5. TROMBOFLEBITE SUPERFICIAL (TFS) — MMSS
───────────────────────────────────────────────────────────────
Definição: trombose e inflamação do sistema venoso superficial (cefálica ou basílica).

Achados US:
  • Veia superficial com material hiperecoico intraluminal (trombo).
  • Incompressibilidade do segmento superficial.
  • Paredes venosas espessadas e hiperecoicas (inflamação).
  • Hipervascularização parietal ao Power Doppler.
  • Edema dos tecidos perivasculares.

CLASSIFICAÇÃO DE RISCO:
  TFS distante da junção (>5 cm da junção axilar): baixo risco de extensão profunda.
  TFS próxima à junção (<5 cm da junção axilar): RISCO ALTO de extensão para TVP axilar/
  subclávia → anticoagulação profilática recomendada; monitorização com US em 7–10 dias.

DOENÇA DE MONDOR (variante rara MMSS):
  TFS da veia torácica lateral (ramo da basílica ou cefálica acessória na parede torácica).
  Contexto: pós-cirurgia mamária, trauma, esforço intenso.
  Achados: cordão hiperecoico palpável na parede torácica; incompressível; sem fluxo.

6. SÍNDROME DO DESFILADEIRO TORÁCICO VENOSO (SDTV)
───────────────────────────────────────────────────────────────
Compressão da veia subclávia no espaço costoclavicular (entre primeira costela e clavícula)
e/ou na passagem pelo músculo peitoral menor.

PROTOCOLO DE AVALIAÇÃO DINÂMICA:
  Posição 1 — NEUTRA: membro em repouso ao lado do corpo.
    → Avaliar calibre da subclávia e fluxo.
  Posição 2 — ABDUÇÃO 90°: braço em abdução 90°, cúbito flexionado 90°.
    → Avaliar redução do calibre ou compressão.
  Posição 3 — HIPERABDUÇÃO (ROOS): braço em abdução 180° com rotação externa.
    → Manobra mais provocadora; compressão máxima.

CRITÉRIOS DE POSITIVIDADE:
  Redução >50% do calibre da subclávia em qualquer posição vs. neutro.
  Ausência de fluxo espontâneo em abdução (ocluso funcional).
  Redução >50% do fluxo ao Doppler espectral em manobra vs. neutro.

SÍNDROME DE PAGET-SCHROETTER (trombose de esforço):
  TVP de subclávia/axilar em jovem ativo (esporte, trabalho manual), extremidade dominante.
  Fisiopatologia: microtraumatismo repetitivo na compressão costoclavicular → trombose.
  Achados: TVP subclávia/axilar + contexto atlético + sem fator de risco convencional.
  Conduta: anticoagulação + fisioterapia + avaliação vascular cirúrgica (ressecção costela).

7. CATETER VENOSO CENTRAL (CVC) E PICC — AVALIAÇÃO DE PERVIEDADE
───────────────────────────────────────────────────────────────
Indicações: disfunção de CVC/PICC, suspeita de TVP relacionada ao cateter,
planejamento de retirada.

Achados esperados ao redor do cateter:
  Normal: fluxo ao redor do cateter hiperecoico; compressibilidade venosa preservada.
  Trombose peri-cateter (sleeve thrombus): material hipoecoico envolvendo o cateter,
    sem comprometer totalmente o lúmen.
  TVP oclusiva: incompressibilidade completa + ausência de fluxo.
  NOTA: TVP relacionada a cateter ocorre em 20–30% dos casos de CVC de longa permanência.

8. FÍSTULA ARTERIOVENOSA (FAV) PARA HEMODIÁLISE
───────────────────────────────────────────────────────────────
AVALIAÇÃO PRÉ-FÍSTULA (mapeamento):
  Artéria radial: diâmetro ≥2,0 mm (adequada); VPS e padrão espectral.
  Artéria ulnar: calibre como alternativa.
  Veia cefálica: diâmetro ≥2,5 mm sem compressão (adequada para FAV).
  Veia basílica: alternativa se cefálica inadequada (requer transposição cirúrgica).
  Compressibilidade venosa: confirmar ausência de trombo prévio.

AVALIAÇÃO DA FAV EXISTENTE:
  Anastomose arteriovenosa: VPS normal 200–500 cm/s; turbulência moderada esperada.
  FAV madura: fluxo de volume (QB) >500 mL/min ao Doppler espectral integrado.
  VPS >800 cm/s no segmento anastomótico = suspeita de estenose (critério relativo).
  VPS >600 cm/s com gradiente 3:1 em relação ao segmento pré-estenótico: estenose >50%.
  Aneurisma venoso pós-anastomótico: dilatação sacular com turbulência — monitorar.
  Pseudo-aneurisma anastomótico: swirling flow ao PD + parede irregular — avaliar correção.

9. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Veias pérvias, compressíveis, fluxo espontâneo presente e fásico. Sem TVP.
  Conclusão: "Estudo Doppler do sistema venoso dos membros superiores sem evidências
  de trombose venosa profunda ou superficial."

N1 — TFS distal (>5 cm da junção). Pequeno trombo mural parcial não-oclusivo em veia periférica.
  Conclusão: "Tromboflebite superficial da veia [cefálica/basílica], segmento [localização],
  distante da junção. Sem extensão profunda."
  Conduta: anti-inflamatório tópico; controle US em 2 semanas.

N2 — TFS próxima à junção (<5 cm). Trombo não-oclusivo em braquial. Estenose de FAV.
  Conclusão: "Tromboflebite superficial proximal [com risco de extensão profunda] / Trombo
  mural não-oclusivo em veia braquial / Estenose de FAV."
  Conduta: anticoagulação profilática em TFS proximal; avaliação vascular para FAV.

N3 — TVP braquial/axilar oclusiva. SDTV compressivo grave. TVP peri-cateter extensa.
  Conclusão: "TVP [segmento] com trombo oclusivo. / Síndrome do desfiladeiro torácico
  venoso com compressão hemodinamicamente significativa."
  Conduta: anticoagulação; avaliação vascular; remoção de cateter se indicada.

N4 — TVP subclávia/axilar oclusiva. TVP bilateral. Extensão para veia jugular.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA TVP: Trombose venosa profunda oclusiva da veia [subclávia/axilar],
  com risco de tromboembolismo pulmonar."
  Conduta: R6 — avaliação médica/vascular imediata; anticoagulação sistêmica urgente;
  considerar trombolítico em TVP axilar/subclávia proximal com menos de 14 dias.

10. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Sem TVP (N0): "Estudo sem evidências de TVP. Seguimento clínico conforme médico assistente."
  TFS (N1): "Tromboflebite superficial — anti-inflamatório local; controle US em 2 semanas."
  TFS próxima junção (N2): "Risco de extensão para TVP profunda — anticoagulação profilática
  recomendada (fondaparinux ou HBPM × 45 dias); avaliação vascular urgente."
  TVP (N3–N4): "Anticoagulação sistêmica imediata (NOAC ou HBPM/AVK). Avaliação vascular."
  Síndrome de Paget-Schroetter: "Anticoagulação + avaliação cirúrgica vascular para ressecção
  de primeira costela e resolução da compressão anatômica."
  SDTV: "Avaliação cirúrgica vascular para descompressão (ressecção de primeira costela
  ou secção do peitoral menor, conforme etiologia)."
  TVP sub/axilar: ATIVAR R6 — avaliação vascular urgente; anticoagulação.

OBSERVAÇÕES METODOLÓGICAS:
A avaliação US do sistema venoso dos membros superiores é tecnicamente mais desafiadora
que nos membros inferiores pela menor acessibilidade à compressão direta nos segmentos
proximais (subclávia retroclavicular). A veia subclávia proximal (retroclavicular) não é
compressível e requer critérios Doppler exclusivamente. A porção intraaxilar pode ser
parcialmente obscurecida pela sombra acústica da cabeça umeral. Falso-negativos ocorrem
em TVP de veias profundas do antebraço (radial, ulnar) por calibre pequeno. Em pacientes
com cateter venoso central, o espessamento peri-cateter é esperado e não representa
necessariamente TVP clinicamente significativa. A indicação de anticoagulação em TVP
relacionada a cateter deve considerar o risco/benefício individualizado pelo médico assistente.
Achados devem ser sempre correlacionados com escore de Constans e dados clínicos.`
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD OUTPUT JSON
// ─────────────────────────────────────────────────────────────────────────────

const phase1 = [
  A1_articulacoes,
  A2_sacroiliacas,
  A3_pdus28,
  A4_doppler_renal,
  A5_quadril_ddq,
  B2_fix,
  B14_expanded,
];

writeFileSync(
  'scripts/phase1-templates.json',
  JSON.stringify(phase1, null, 2),
  'utf8'
);

// Print summary
console.log('Phase 1 templates generated:');
for (const t of phase1) {
  const ai = t.aiInstructions || '';
  console.log(`  [${(t.name || t.id).padEnd(45)}] ${ai.length} chars`);
}
console.log('\nOutput: scripts/phase1-templates.json');
console.log('Total templates:', phase1.length);
