/**
 * LAUD.IA — Phase 3 Template Fixes
 * 1. Add OBSERVAÇÕES METODOLÓGICAS to 9 medicina-fetal + CERVICAL + PELVICO TV
 * 2. Add N0-N4 mapping to TIREÓIDE + OBSTÉTRICA COM DOPPLER
 * 3. Expand RINS E VIAS URINÁRIAS COM DOPPLER (10.5k → 16k+)
 */

import { readFileSync, writeFileSync } from 'fs';
const existing = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
const find = id => existing.find(t => t.id === id);

const obs = {

// ─── MEDICINA-FETAL ──────────────────────────────────────────────────────────

'B1ehwbQDCk6MUyQjA5aO': `

OBSERVAÇÕES METODOLÓGICAS:
A cervicometria transvaginal é o método de referência para avaliação do colo uterino na
gestação, com alta reprodutibilidade quando realizada por examinadores treinados. A
variabilidade intraobservador do comprimento cervical é de 2–4 mm; portanto, medidas
próximas aos limiares de conduta (25 mm, 15 mm) devem ser repetidas 3 vezes e registrar
a menor medida obtida. A técnica exige bexiga vazia, probe transvaginal inserido com
pressão mínima (deformação excessiva do canal falsamente alonga o colo), e imagem ampliada
para visualização de criptas endocervicais. Funil cervical (afunilamento do óstio interno)
pode ser dinâmico (visível apenas à manobra de Valsalva) — relatar presença e percentagem
de envolvimento. A ausência de colo curto em um único exame não exclui cervicometria
evolutivamente dinâmica: exames seriados são superiores para rastreio de prematuridade.
Achados devem ser correlacionados com história obstétrica (perdas pregressas, cerclagem,
cirurgias cervicais), sintomas clínicos e protocolo do serviço assistencial.`,

'lMU67VSedtQajpH5t6M7': `

OBSERVAÇÕES METODOLÓGICAS:
O ecocardiograma fetal é um exame de alta especialização, com sensibilidade para cardiopatias
congênitas maiores de 85–95% em centros de referência, mas com variabilidade importante
conforme indicação, idade gestacional, posição fetal, janela acústica e experiência do
examinador. A sensibilidade é máxima entre 20–24 semanas, mas exames de primeiro trimestre
(12–14 semanas) são possíveis com alta resolução. Cardiopatias menores e leves podem
escapar ao exame pré-natal mesmo quando realizado com técnica ideal. A posição fetal,
janela acústica limitada por biotipo materno e líquido amniótico, calcificação placentária
e movimentação fetal podem limitar a avaliação de planos específicos. A classificação
funcional (N-Score) e a decisão de conduta são multidisciplinares (cardiologia pediátrica,
neonatologia, obstetrícia). O diagnóstico definitivo de cardiopatia complexa requer
confirmação ecocardiográfica neonatal. Achados limítrofes devem ser avaliados em centro
de medicina fetal com cardiologia fetal especializada.`,

'Dn2dltlyR0EfkCR6ajuE': `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia de gestação gemelar requer conhecimento detalhado das síndromes
específicas de cada tipo de corionicidade. A determinação precoce da corionicidade
(sinal lambda ou T) é obrigatória no 1º trimestre — após 14 semanas a acurácia cai
significativamente. Gestações monocoriônicas monoamnióticas exigem vigilância em centro
terciário com capacidade de intervenção in utero (procedimentos fetoscópicos). A síndrome
de transfusão fêto-fetal (STFF) requer estadiamento de Quintero com Doppler da artéria
umbilical e ducto venoso — diagnóstico US sem Doppler é incompleto. Variabilidade de
crescimento (DDC) entre co-gêmeos exige curvas de referência específicas para gemelares
(Hadlock gemelar ou INTERGROWTH-21st Twins). O exame deve ser correlacionado com
protocolo assistencial do serviço (frequência de US conforme corionicidade: MZ/bico
quinzenal a partir de 16 semanas; DZ a cada 4 semanas). Conduta intervencionista
(ablação a laser por fetoscopia) é decisão exclusiva do centro de medicina fetal.`,

'd8KNSSbuGgc3NpLqMmXn': `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia morfológica do primeiro trimestre (11–13+6 semanas) é exame de alta
especialização com sensibilidade para malformações maiores de 30–60% dependendo do
centro. A translucência nucal (TN) deve ser medida com técnica rigorosa (sinal de
Cicero+, cabeça neutra, pele do dorso visível) por profissional com credenciamento ativo
da FMF (Fetal Medicine Foundation). Valores de TN entre 2,5–3,4 mm são considerados
aumentados — risco de aneuploidia e cardiopatia mesmo com cariotipo normal. O risco
combinado de primeiro trimestre integra TN, PAPP-A, free β-hCG e biometria em algoritmo
FMF, não devendo ser calculado de forma independente. A presença de osso nasal ausente
ou osso nasal hipoplásico modifica o risco. O exame morfológico de primeiro trimestre
detecta 50–70% das cardiopatias maiores — eco fetal de segundo trimestre é complementar.
Achados de marcadores menores (retroflexão maxilar, ângulo facial frontal) modificam o
risco mas NÃO são diagnósticos isolados. Resultados devem ser integrados em laboratório
de medicina fetal com acesso a NIPT e aconselhamento genético.`,

'FxSIs2Deay4aYyH5KiOi': `

OBSERVAÇÕES METODOLÓGICAS:
O exame morfológico de segundo trimestre (18–24 semanas) é o principal método de rastreio
de malformações fetais com sensibilidade global de 30–75% para anomalias maiores (variável
conforme sistema e centro). Limitações intrínsecas incluem: posição fetal desfavorável
(40% dos casos exigem reposicionamento materno ou reagendamento), biotipo materno
(IMC >30 kg/m² reduz significativamente a sensibilidade), quantidade de líquido amniótico
(oligodramnia limita janela acústica), calcificação placentária avançada. A sensibilidade
é INFERIOR para: anomalias de face (50%), mão (40–60%), coração (55–75% em centros
especializados). A ausência de anomalias detectáveis ao exame NÃO garante feto normal
— malformações menores, síndromes com fenótipo tardio e anomalias cromossômicas não
estruturais (trissomia 21 sem malformação maior) podem não ser detectadas. Achados
limítrofes ou marcadores de aneuploidia exigem correlação com risco combinado de 1º
trimestre e avaliação em medicina fetal. Biometria deve usar curvas INTERGROWTH-21st
(padrão OMS) ou FIGO. A definição de conduta é multidisciplinar.`,

'fuLw5Rs3ui4is8PtCZVu': `

OBSERVAÇÕES METODOLÓGICAS:
A neurossonografia fetal avançada é exame de alta especialização realizado com técnicas
específicas (transvaginal, translabial ou transabdominal) complementares à morfologia
de segundo trimestre. Limitações incluem: posição fetal (crânio em apresentação cefálica
com nuca anterior limita avaliação das estruturas posteriores), janela acústica (ossos
parietais ossificados a partir de 24 semanas limitam janelas laterais), biotipo materno.
A sensibilidade para displasias corticais, polimicrogiria e neuronal migration disorders
é limitada antes de 28 semanas (quando a girificação ainda não está completa — sulcos
são esperados abertos). A ressonância magnética (RM) fetal (3T) é complementar à US para
lesões de partes moles, caracterização de displasias corticais, avaliação de estruturas
da fossa posterior (vermis, tronco) e quando há sombra acústica de osso. RM fetal é
recomendada a partir de 20–22 semanas em qualquer achado neurológico suspeito. Prognóstico
neurológico definitivo exige RM fetal, avaliação neurológica pediátrica e aconselhamento
genético com cariótipo/array CGH. Achados devem ser correlacionados com infecções
congênitas (CMV, toxoplasmose, zika) e história familiar.`,

'3wGk3zoYVVefVkkRhBXK': `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia obstétrica de segundo e terceiro trimestres é o principal método de
monitoramento fetal, com sensibilidade e especificidade variáveis conforme o parâmetro
avaliado. A biometria fetal (BPD, CC, CA, CF) tem erro de estimativa de peso de ±15–20%
nos percentis extremos (fórmula de Hadlock). A estimativa de peso por ultrassom é menos
precisa em fetos com restrição de crescimento (RCF) severa e em macrossomia extrema.
O índice de líquido amniótico (ILA) tem variabilidade interobservador de 10–20% — valores
limítrofes devem ser repetidos pelo mesmo examinador. O perfil biofísico fetal (PBF) é
operador-dependente e requer treinamento em avaliação de movimentos respiratórios e
tônus. Curvas de crescimento fetal devem ser específicas para a população (INTERGROWTH-21st
ou curvas brasileiras); uso de curvas inadequadas altera a classificação de crescimento.
O exame NÃO avalia placenta em totalidade nem os 3 funículos umbilicais com certeza
absoluta. Doppler não integra a avaliação obstétrica padrão — template específico com
Doppler deve ser utilizado quando indicado. Resultados devem ser correlacionados com
a história obstétrica, dados laboratoriais e protocolo do serviço assistencial.`,

'Me4D9W0YCPNm4IL8aNR0': `

OBSERVAÇÕES METODOLÓGICAS:
A dopplerfluxometria obstétrica é técnica avaliação hemodinâmica complementar à biometria
na vigilância de fetos com suspeita de comprometimento placentário (RCF, hipertensão
materna, pós-datismo). A qualidade técnica é crítica: ângulo de insonação deve ser <60°
para artéria umbilical e >0° para ducto venoso (insonação mais oblíqua); ausência de
movimentos respiratórios fetais durante a amostragem do ducto venoso é obrigatória
(movimentos respiratórios invertem a onda a do DV). O protocolo de Barcelona (estadios
0–IV) é o padrão para RCF baseado na sequência de deterioração hemodinâmica fetal —
exige medidas simultâneas de AU, ACM e DV em momentos específicos da progressão.
Variabilidade intraobservador da pulsatilidade do IP de ACM é de 10–15% — valores
limítrofes devem ser repetidos. A RCP (Razão Cérebro-Placentária) calculada automaticamente
na FASE 4 (ip_médio_uterino e rcp) não deve ser recalculada no laudo. Em gestações
monocoriônicas: Doppler de AU assimétrico é sinal de STFF — não interpretar como RCF
sem avaliação completa da corionicidade. Conduta obstétrica (tempo de resolução, via
de parto) é decisão exclusiva da equipe obstétrica correlacionando dados clínicos
e vitalidade fetal completa.`,

'3r76O3uzRFLSWQsLdwVX': `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia obstétrica inicial (primeiro trimestre) avalia parâmetros que variam
rapidamente ao longo de dias. A datação gestacional é MAIS PRECISA quando realizada no
primeiro trimestre (erro ±5–7 dias vs. ±2–3 semanas no terceiro trimestre) — a data do
exame deve ser sempre citada no laudo pois modifica o risco combinado. A correlação com
o beta-hCG sérico é obrigatória para interpretação de achados precoces (saco gestacional
<5 mm sem vesícula vitelínica e sem embrião é normal se beta-hCG <1000 mIU/mL; saco
>25 mm sem embrião = ovo anembrionado se beta-hCG correlato). A definição de abortamento
do início deve seguir critérios rigorosos (CRL ≥7 mm sem BCF em exame transvaginal, ou
saco >25 mm sem embrião) para evitar falsa-positivo com impacto emocional e iatrogênico.
Diagnóstico de gravidez ectópica requer visualização direta da gestação extrauterina ou
critérios indiretos (saco tubário + pseudossaco intrauterino + anel tubário com fluxo
periférico "anel de fogo" ao PD). Em casos duvidosos, repetir exame em 7–10 dias com
correlação de beta-hCG seriado. NUNCA presumir diagnóstico de ectópica ou abortamento
sem critérios estabelecidos.`,
};

// ─── GINECOLOGIA / PELVICO TV ─────────────────────────────────────────────────
obs['j1fIt6ICfaEsWrRwCnjB'] = `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia pélvica transvaginal oferece resolução superior ao transabdominal para
avaliação dos órgãos pélvicos, especialmente ovários, endométrio e junção endomiometrial.
Limitações incluem: variabilidade do posicionamento do probe que pode alterar a visibilidade
de estruturas retrouterinas, artefatos de sombra acústica por calcificação ou cistite,
dificuldade em pacientes com anatomia pélvica distorcida (cirurgias prévias, retversão
uterina acentuada). A ecogenicidade endometrial varia com a fase do ciclo menstrual —
endométrio de aspecto proliferativo, secretor ou descamativo é esperado e deve ser
descrito conforme fase menstrual informada. Em pacientes na pós-menopausa sem reposição
hormonal, endométrio >4 mm exige avaliação adicional. A classificação O-RADS (Ovarian-
Adnexal Reporting and Data System, ACR/ISUOG) é aplicada a massas anexiais para
estratificação de risco de malignidade e deve ser sempre citada no laudo quando há
massa ovariana/adnexal. A ausência de achados à TV não exclui endometriose profunda —
a RM pélvica é superior para avaliação de endometriose retrocervical e infiltração
de estruturas profundas. Achados devem ser correlacionados com dados clínicos (DUM,
sintomas, uso de hormônios, cirurgias prévias) e CA-125 quando indicado.`;

// ─── PEQUENAS-PARTES / CERVICAL ───────────────────────────────────────────────
obs['629P0KzQrxWDgm7T9D4u'] = `

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia cervical avalia glândulas tireoide e paratireoide, glândulas salivares,
linfonodos, vasos cervicais e partes moles com alta resolução por transdutor linear de
alta frequência. Limitações incluem: janela acústica limitada pelo ângulo mandibular
(porção retroangular da glândula submandibular e espaço retrofaríngeo profundo), sombra
acústica de calcificações extensas, estruturas vasculares que podem simular linfonodos
isoecoicos (sempre confirmar ao Color Doppler). O mapeamento linfonodal cervical segue a
classificação em níveis (I–VI), mas a US tem sensibilidade de apenas 60–70% para
micrometástases <5 mm e não é adequada para avaliação do mediastino. Gânglios cervicais
até 8 mm em cadeias cervicais superiores são normais; até 15 mm nos jugulodigástricos
(nível IIa). A distinção entre adenite reativa e linfoma/metástase exige correlação
clínica e, quando indicado, biópsia. A US com elastografia pode complementar a avaliação
de nódulos tireoidianos e linfonodos em centros especializados. Achados cervicais agudos
com suspeita de abscesso profundo ou trombose jugular exigem avaliação clínica e tomográfica
de urgência — US sozinha não é suficiente para estadiamento de infecções cervicais profundas.`;

// ─── PEQUENAS-PARTES / TIREÓIDE — add N0 classification ─────────────────────
const tireoide = find('pFfqNwK8NQsW9XxLSs5r');
const tireoideFix = tireoide.aiInstructions.replace(
  /FIM DO PROMPT — ULTRASSONOGRAFIA DE TIREOIDE/,
  `CLASSIFICAÇÃO N0–N4 (CORRELAÇÃO COM TI-RADS):
═══════════════════════════════════════════════════════════════
A classificação N-Score é aplicada em paralelo ao TI-RADS e guia as recomendações:

N0 — Glândula sem nódulos. TI-RADS 1 (TR1) bilateral. Padrão ecotextural normal.
  Conclusão: "Glândula tireoide sem nódulos identificados ao estudo ultrassonográfico.
  TI-RADS 1 (TR1) — sem conduta adicional."

N1 — Nódulo(s) TR2. Bócio difuso/nodular sem critérios de malignidade.
  Conclusão: "Nódulo(s) benigno(s) — TI-RADS 2 (TR2). Seguimento habitual."
  Conduta: sem PAAF; retorno conforme avaliação clínica endocrinológica.

N2 — Nódulo(s) TR3 (risco baixo). Bócio multinodular com nódulo TR3 dominante.
  Conclusão: "Nódulo(s) de baixo risco — TI-RADS 3 (TR3)."
  Conduta: PAAF se ≥2,5 cm; controle US em 1–2 anos se <2,5 cm.

N3 — Nódulo(s) TR4 (risco intermediário) qualquer tamanho ≥1,5 cm, ou TR5 <1 cm.
  Conclusão: "Nódulo(s) de risco intermediário-alto — TI-RADS 4/5."
  Conduta: PAAF indicada; encaminhamento endocrinológico.

N4 — Nódulo TR5 ≥1 cm com critérios de alta suspeição. Invasão local suspeita.
     Linfonodomegalia ipsilateral com características metastáticas.
  ⚠️ GATILHO R6: nódulo com invasão extratiroidiana + linfonodo cervical metastático.
  Conclusão: "ALERTA: Nódulo de alta suspeição para malignidade. Avaliação oncológica urgente."
  Conduta: R6 — PAAF urgente; cirurgia oncológica (tireoidectomia total).

FIM DO PROMPT — ULTRASSONOGRAFIA DE TIREOIDE`
);

// ─── OBSTÉTRICA COM DOPPLER — add N0 ────────────────────────────────────────
const obsDoppler = find('Me4D9W0YCPNm4IL8aNR0');
// Add N0 section before "FIM DO PROMPT"
const obsDopplerFix = obsDoppler.aiInstructions.replace(
  /FIM DO PROMPT — ULTRASSONOGRAFIA OBSTÉTRICA COM DOPPLERFLUXOMETRIA/,
  `CLASSIFICAÇÃO N-SCORE (GRAVIDADE HEMODINÂMICA — PROTOCOLO DE BARCELONA):
═══════════════════════════════════════════════════════════════
N0 — Doppler normal. AU: IP normal. ACM: IP normal. DV: onda a positiva.
  Conclusão: "Dopplerfluxometria sem evidências de comprometimento fetal hemodinâmico."
  Conduta: vigilância obstétrica habitual conforme protocolo gestacional.

N1 — IP de AU levemente elevado (≥P95) sem centralização. RCP levemente reduzida.
     Sem centralização hemodinâmica. Corresponde ao Estágio 0–I inicial de Barcelona.
  Conclusão: "Discreto aumento da resistência de circulação placentária sem centralização."
  Conduta: acompanhamento intensificado; repetir Doppler em 1–2 semanas.

N2 — Centralização (ACM <P5 ou RCP <1,0) com AU ainda pulsátil diastólico positivo.
     Estágio I–II de Barcelona. Ausência de IP de DV alterado.
  Conclusão: "Centralização hemodinâmica fetal — redistribuição cerebro-placentária presente."
  Conduta: vigilância intensiva com Doppler 2× semana; perfil biofísico; corticóide
  se <34 semanas; definir via de parto em centro terciário.

N3 — Diástole ausente ou invertida na AU (AEDF/REDF). IP de DV aumentado.
     Estágio III de Barcelona. Centralização marcada.
  Conclusão: "Comprometimento hemodinâmico fetal avançado — AEDF/REDF na AU. Estágio III."
  Conduta: internação; corticóide; MgSO4 se <34 semanas; resolução iminente em centro terciário.

N4 — Onda a ausente ou invertida no ducto venoso (DV). Pulsações venosas umbilicais.
  ⚠️ ATIVAR R6: ALERTA OBSTÉTRICO.
  "ALERTA: Comprometimento hemodinâmico fetal crítico — Estágio IV de Barcelona.
  Risco iminente de óbito fetal. Resolução obstétrica de urgência indicada."
  Conduta: R6 — cesariana de urgência em centro terciário com UTI neonatal.

FIM DO PROMPT — ULTRASSONOGRAFIA OBSTÉTRICA COM DOPPLERFLUXOMETRIA`
);

// ─── MEDICINA-INTERNA / RINS E VIAS URINÁRIAS COM DOPPLER — expand ──────────
const rinsId = 'TODd9kUizva7uum2cf1D';
const rins = find(rinsId);
const rinsExpanded = rins.aiInstructions + `

5. DOPPLER RENAL — ÍNDICE DE RESISTIVIDADE (IR) INTRAPARENQUIMATOSO
═══════════════════════════════════════════════════════════════════
Quando o Doppler renal é incluído neste exame:

PROTOCOLO:
  Medir IR nas artérias interlobares/arqueadas em 3 polos de cada rim (superior, médio, inferior).
  Ângulo de insonação <60°. Registrar VPS, VDF e IR de cada ponto.

PARÂMETROS:
  IR normal: 0,55–0,70.
  IR 0,70–0,75: leve comprometimento microvascular (correlacionar com função renal).
  IR >0,75: comprometimento moderado-grave.
  IR >0,80: padrão patológico — biópsia renal a considerar.
  IR >0,90: oclusão renal ou obstrução aguda → R6.
  Assimetria bilateral >0,05: suspeita de causa vascular unilateral.

PADRÃO TARDUS-PARVUS (suspeita de estenose de artéria renal proximal):
  Tempo de aceleração (TA) >70 ms + índice de aceleração (IA) <300 cm/s² ipsilateral.
  → Complementar com Doppler específico de artérias renais (template DOPPLER RENAL vascular).

CORRELAÇÃO FUNCIONAL:
  IR elevado bilateral + creatinina elevada: nefropatia parenquimatosa difusa.
  IR elevado unilateral + rim menor ipsilateral: doença renovascular crônica.
  IR bilateral elevado + rim normal: glomerulonefrite aguda, nefrite intersticial.
  IR pós-transplante: ver template DOPPLER RENAL para parâmetros específicos de transplante.

6. PROTOCOLO DETALHADO — AVALIAÇÃO RENAL COMPLETA
═══════════════════════════════════════════════════════════════════
PARÊNQUIMA RENAL:
  Espessura do parênquima (córtex + medula): medir no polo médio.
    Normal: ≥12 mm (adulto). Redução = perda parenquimatosa crônica.
  Ecogenicidade corticomedular:
    Normal: córtex isoecóico ou levemente hipoecoico em relação ao fígado/baço.
    Aumentada: nefropatia hipertensiva/diabética, glomerulonefrite.
  Diferenciação córtico-medular: piramides medulares hipoecóicas visíveis = normal.
    Perda da diferenciação = injúria renal aguda ou doença crônica avançada.
  Papilas renais: hipoecóicas, regulares. Necrose de papila: central hiperecoico.

DIMENSÕES RENAIS (adulto):
  Normal: comprimento 9–12 cm; largura 4–6 cm; espessura 3–5 cm.
  Assimerria >1,5 cm: suspeita de causa vascular (estenose renal) ou cicatriz pielonefrítica.
  Rim pequeno bilateral (<8 cm): DRC avançada.
  Rim aumentado bilateral (>13 cm): diabetes precoce, glomerulonefrite aguda.

CÁLICES E PELVE RENAL:
  SFU/UTD (Society for Fetal Urology / Urinary Tract Dilation):
    SFU Grau 0: sem dilatação.
    SFU Grau 1: dilatação apenas da pelve (≤10 mm).
    SFU Grau 2: pelve ≥10 mm + cálices menores.
    SFU Grau 3: pelve + cálices maiores com adelgaçamento parenquimatoso.
    SFU Grau 4: adelgaçamento parenquimatoso grave.
  Pelve renal adulto normal: <10 mm em decúbito dorsal / <15 mm em ortostatismo.
  Colo pielo-ureteral (UPJ): estenose congênita vs. obstrução extrínseca (gânglios).

CÁLCULOS RENAIS:
  Tamanho: medir no eixo máximo (mm).
  Sombra acústica posterior: presente >3 mm; mínima ou ausente em <3 mm.
  Twinkle artifact (artifact de cor): aumenta sensibilidade para cálculos pequenos.
  Localização: cálice superior/médio/inferior / junção UPJ / ureter proximal.
  Número: único vs. múltiplos (litíase em cora).

7. AVALIAÇÃO DA BEXIGA
═══════════════════════════════════════════════════════════════════
PAREDE VESICAL:
  Normal: ≤3 mm (bexiga distendida) / ≤5 mm (bexiga parcialmente cheia).
  Espessamento difuso (>5 mm replecionada): cistite, bexiga hipertônica, bexiga neurogênica.
  Espessamento focal: neoplasia? → angiotomografia ou uretrocistoscopia.
  Trabeculação: globosidades/colunas na parede = bexiga neurogênica ou obstrução crônica.

AVALIAÇÃO DE FLUXO URETERAL (sinal do jato ureteral):
  Color Doppler na entrada dos ureteres (meatos ureterais): sinal de jato ureteral.
  Normal: sinais de jatos bilaterais intermitentes (1–4 por minuto).
  Ausência de jato unilateral: suspeita de obstrução do ureter ipsilateral.
  Assimetria de frequência dos jatos: avaliação complementar com urografias.

RESÍDUO PÓS-MICCIONAL (RPM):
  Volume residual: π/6 × L × A × E (fórmula elipsoide).
  Normal: <50 mL (adulto). Aceitável: <100 mL.
  RPM 100–300 mL: disfunção vesical leve — correlacionar com sintomas.
  RPM >300 mL: retenção urinária significativa → avaliação urológica.

CÁLCULOS VESICAIS:
  Material hiperecoico com sombra acústica dentro da bexiga.
  Mobilidade: mudam de posição com mudança de decúbito (diferencia de tumor).
  Cálculo imóvel aderido à parede: suspeita de tumor com calcificação ou cálculo incluso.

8. GLÂNDULA SUPRARRENAL — AVALIAÇÃO BÁSICA
═══════════════════════════════════════════════════════════════════
Suprarrenal direita: entre polo superior do rim direito e VCI (plano longitudinal).
  Normal: 2–3 cm × 1 cm; V em sinal de "Y".
Suprarrenal esquerda: medial ao polo superior do rim esquerdo.
  Normal: formato de semi-lua ou triangular; <4 cm.

Quando identificar nódulo suprarrenal:
  <3 cm, homogêneo, hipoecóico: provavelmente adenoma → correlacionar com TC.
  >4 cm ou heterogêneo: carcinoma adrenal / metástase → TC/RM obrigatória.
  Achado incidental suprarrenal: "incidentaloma" → encaminhar para endocrinologia.

9. CLASSIFICAÇÃO N0–N4 EXPANDIDA
═══════════════════════════════════════════════════════════════════
N0 — Rins simétricos, parênquima normal, sem litíase, sem hidronefrose. IR 0,55–0,70.
     Bexiga normal. Bexiga sem RPM significativo.
  Conclusão: "Rins e vias urinárias sem alterações ao estudo com Doppler."

N1 — Cisto simples Bosniak I. Litíase assintomática <5 mm. SFU Grau 1. IR 0,70–0,74.
  Conclusão: "[Achado benigno]. Sem alteração hemodinâmica ao Doppler."
  Conduta: acompanhamento habitual.

N2 — Litíase ≥5 mm. SFU Grau 2 (pelve ≥10 mm). IR 0,74–0,79. Espessamento parenquimatoso
     leve. RPM 100–300 mL.
  Conclusão: "Litíase de [tamanho] mm [localização]. Leve dilatação piélica. IR renal
  leve-moderadamente elevado."
  Conduta: correlação urológica; hidratação; citrato de potássio. Complementar com
  urografia ou uro-TC se dor intensa.

N3 — Litíase ≥1 cm com hidronefrose SFU 2–3. IR >0,79. Massa renal >4 cm ou Bosniak III.
     RPM >300 mL com sintomas obstrutivos.
  Conclusão: "Litíase obstrutiva com hidronefrose moderada. / Massa renal com características
  complexas."
  Conduta: avaliação urológica para passagem de sonda duplo-J ou litotripsia. Uro-TC para
  planejamento.

N4 — Pielonefrite complicada + hidronefrose + febre. IR >0,85 bilateral. Massa renal com
     suspeita de CCR invasivo. Ausência de fluxo renal (oclusão).
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA: [Pielonefrite obstrutiva / Oclusão vascular renal / Massa renal
  infiltrativa]."
  Conduta: R6 — avaliação urológica/nefrológica urgente.

RECOMENDAÇÕES PADRÃO:
  Normal: "Exame sem alterações. Seguimento conforme médico assistente."
  Litíase pequena (<5 mm): "Litíase renal de pequeno volume — hidratação e tratamento
  sintomático. Controle com US em 3–6 meses."
  Litíase obstrutiva: "Avaliação urológica para tratamento (litotripsia extracorpórea,
  ureteroscopia ou sonda duplo-J)."
  IR bilateral elevado: "Correlação nefrológica completa: creatinina, TFG, urinálise,
  microalbuminúria."
  Massa renal complexa (Bosniak III/IV): "Angiotomografia ou RM de abdome com contraste
  para caracterização. Avaliação urológica oncológica."`;

// ─────────────────────────────────────────────────────────────────────────────
// BUILD OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

const phase3 = [];

// 1. Templates needing only OBSERVAÇÕES appended
for (const [id, observacoes] of Object.entries(obs)) {
  const tmpl = existing.find(t => t.id === id);
  if (!tmpl) { console.error('NOT FOUND:', id); continue; }
  phase3.push({ id, aiInstructions: tmpl.aiInstructions + observacoes });
}

// 2. TIREÓIDE — N0 added (full replace with fix)
phase3.push({ id: 'pFfqNwK8NQsW9XxLSs5r', aiInstructions: tireoideFix });

// 3. OBSTÉTRICA COM DOPPLER — N0 added
phase3.push({ id: 'Me4D9W0YCPNm4IL8aNR0', aiInstructions: obsDopplerFix });

// 4. RINS E VIAS URINÁRIAS COM DOPPLER — expanded
phase3.push({ id: rinsId, aiInstructions: rinsExpanded });

writeFileSync('scripts/phase3-templates.json', JSON.stringify(phase3, null, 2), 'utf8');

console.log('Phase 3 templates:');
for (const t of phase3) {
  const ai = t.aiInstructions || '';
  const src = existing.find(x => x.id === t.id);
  const name = src ? src.name : t.id;
  console.log(`  [${name.padEnd(50)}] ${ai.length} chars`);
}
console.log('\nOutput: scripts/phase3-templates.json');
console.log('Total:', phase3.length);
