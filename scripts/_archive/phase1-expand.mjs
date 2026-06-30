/**
 * Expansão dos templates Phase 1 que ficaram abaixo de 12k chars.
 * Adiciona conteúdo clínico complementar a A2, A3, A4, A5.
 */

import { readFileSync, writeFileSync } from 'fs';

const templates = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8'));

const expansions = {

// ─────────────────────────────────────────────────────────────────────────────
'reumatologico-sacroiliacas': `

6. CRITÉRIOS ASAS PARA ESPONDILOARTROPATIA AXIAL (correlação obrigatória)
───────────────────────────────────────────────────────────────
O diagnóstico de SpA axial exige Critério de Entrada (dor lombar crônica ≥3 meses,
início <45 anos) + ≥1 dos seguintes braços:

BRAÇO DE IMAGEM:
  Sacroiliíte na RM OU radiografia + ≥1 achado de SpA:
  Achados de SpA: dor lombar inflamatória, artrite periférica, dactilite, entesite,
  uveíte, doença de Crohn/retocolite, resposta a AINE, história familiar SpA, HLA-B27+,
  PCR elevado.

BRAÇO LABORATORIAL:
  HLA-B27+ + ≥2 achados de SpA.

NOTA SOBRE A US NOS CRITÉRIOS ASAS:
  A US NÃO faz parte dos critérios ASAS de imagem (apenas RM e Rx contam formalmente).
  A US é usada como método de triagem e para monitoramento de atividade inflamatória,
  complementando a RM. PD positivo na US = fortemente sugestivo → indicação de RM.

PARÂMETROS DE RM QUE DEFINEM SACROILIÍTE (ASAS):
  Sacroiliíte ativa: edema de medula óssea (BME) em STIR nos ângulos sacroilíacos
  (≥2 lesões em 1 corte ou ≥1 lesão em ≥2 cortes consecutivos).
  Sacroiliíte estrutural: erosão, esclerose, anquilose no T1 SE.

7. DIAGNÓSTICO DIFERENCIAL EXPANDIDO
───────────────────────────────────────────────────────────────
SACROILIÍTE DEGENERATIVA (OSTEOARTRITE):
  Distribuição: bilateral simétrica, >50 anos, sexo masculino.
  US: esclerose hiperecoica bilateral + osteófitos; SEM PD ativo; SEM erosão ativa.
  Chave diagnóstica: sem critérios inflamatórios (VHS/PCR normais, sem febre, sem dor noturna).

SACROILIÍTE INFECCIOSA (SÉPTICA):
  Distribuição: unilateral (90% dos casos).
  US: derrame articular (raro) + PD intenso + partes moles adjacentes edemaciadas.
  Contexto: febre >38°C, VHS/PCR muito elevados, leucocitose.
  Agente: S. aureus (adultos), E. coli (imunossuprimidos), Brucella (endêmica).
  → ATIVAR R6: punção aspirativa + hemoculturas + antibioticoterapia.

OSTEÍTE CONDENSANTE DO ILÍACO:
  Perfil: mulheres jovens multíparas ou grávidas.
  US: esclerose triangular hiperecoica do ilíaco BILATERAL, simétrica, SEM erosão, SEM PD.
  RM: sinal baixo em T1 e T2 no ilíaco (sem edema ativo = sem inflamação).
  Benigna: resolução espontânea pós-parto; sem tratamento específico.

DOENÇA DE PAGET SACRAL:
  US: espessamento cortical hiperecoico da placa sacral com aumento de sombra acústica.
  PD: pode estar presente em fase ativa. Diferenciação: esclerose difusa do sacro.
  Contexto: >50 anos, fosfatase alcalina muito elevada.

METÁSTASE SACRAL:
  US: massa hipoecoica com erosão cortical difusa + PD intratumoral.
  Contexto: neoplasia primária conhecida.
  → Encaminhar urgente para oncologia.

8. ARTRITE ENTEROPÁTICA — SACROILIÍTE
───────────────────────────────────────────────────────────────
Ocorre em 15–25% dos pacientes com Doença de Crohn ou Retocolite Ulcerativa.

TIPOS:
  Tipo 1 (periférica): Poliartrite periférica aguda — atividade paralela à DII; <5 articulações.
  Tipo 2 (axial): Sacroiliíte ± espondilite — atividade independente da DII; HLA-B27+.

US: sacroiliíte indistinguível da SpA idiopática — bilateral, simétrica ou assimétrica.
Chave: história de DII, endoscopia, calprotectina fecal.

9. ARTRITE REATIVA (SÍNDROME DE REITER)
───────────────────────────────────────────────────────────────
Sacroiliíte em 30–50% dos casos, geralmente ASSIMÉTRICA.
Pós-infecção urogenital (Chlamydia) ou entérica (Salmonella, Shigella, Campylobacter).
Tríade clássica: artrite + uretrite + conjuntivite (incompleta em muitos casos).
US: sacroiliíte com PD + entesites periféricas simultâneas.
Evolução: maioria resolve em 3–12 meses; 20% cronificam (similar à SpA).

10. PROTOCOLO DE MONITORAMENTO COM US
───────────────────────────────────────────────────────────────
Baseline: avaliar score OMERACT bilateral antes de iniciar DMARD ou biológico.
Follow-up:
  Após 3 meses de AINE: repetir US para avaliar supressão do PD.
  Após início de anti-TNF ou anti-IL-17: repetir em 3–6 meses.
Resposta adequada: redução do PD-score sacroilíaco ≥2 graus.
Falha terapêutica: PD mantido ou aumentado → troca de biológico.
Remissão estrutural (anquilose): fusão progressiva da interlinha = doença controlada mas
não-reversível.

11. RECOMENDAÇÕES POR CENÁRIO CLÍNICO
───────────────────────────────────────────────────────────────
  N0 (normal): "RM de sacroilíacas com STIR recomendada se suspeita clínica forte de
  SpA axial, pois US normal não exclui sacroiliíte precoce."
  N1–N2 (sacroiliíte leve-moderada): "Encaminhamento reumatológico + RM de sacroilíacas.
  Iniciar AINE dose plena (naproxeno, diclofenaco, indometacina) e reavaliar em 3 meses."
  N3 (sacroiliíte moderada-grave): "Encaminhamento reumatológico urgente. RM para
  estadiamento. Considerar anti-TNF (adalimumabe, etanercepte) ou anti-IL-17 (secucinumabe)."
  N4 (sacroiliíte séptica): ATIVAR R6.

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia das sacroilíacas avalia principalmente a porção sinovial anterior
(inferior) da articulação. A porção posterior é ligamentosa e não acessível ao US.
A detecção de PD pela abordagem posterior paramediana é tecnicamente desafiadora em
pacientes obesos (IMC >30) pela profundidade da articulação. O edema de medula óssea
subcondral — a lesão mais precoce e específica da sacroiliíte ativa por ASAS — NÃO é
detectável pela US: requer sequências STIR na RM. A sensibilidade da US para sacroiliíte
ativa confirmada por RM varia de 55–72% nos estudos disponíveis. Portanto, US negativa
em paciente com forte suspeita clínica DEVE ser complementada com RM. O papel da US
na sacroiliíte está em monitoramento de atividade (resposta a biológico), não no
diagnóstico inicial isolado.`,

// ─────────────────────────────────────────────────────────────────────────────
'reumatologico-pdus28': `

9. EXTENSÃO DO PROTOCOLO — TENOSSINOVITE E BURSAS
───────────────────────────────────────────────────────────────
O PDUS-28 padrão avalia apenas a sinovite articular. Contudo, extensões clínicas
frequentemente incluídas no mesmo exame (como componente adicional ao laudo):

TENOSSINOVITE DOS EXTENSORES DO PUNHO:
  Avaliar bainhas dos compartimentos extensores (I–VI) bilateralmente.
  Achados: espessamento hipoecóico da bainha + PD peritendinoso.
  Score: graduação 0–3 por compartimento (similar à sinovite articular).
  Relevância: tenossinovite do punho é sensível marcador de atividade em AR.

BURSAS:
  Bursa subdeltóidea (ombro): avaliação em plano coronal anterior/superior.
    Normal: <2 mm de espessura. Bursite: >2 mm com PD.
  Bursa de Baker (cisto poplíteo — joelho): avaliação poplítea bilateral.
    Cisto de Baker: comunicação com recesso articular posterior; pode ser volumoso
    em AR com sinovite ativa do joelho.
    Atenção: ruptura do cisto de Baker pode simular TVP de panturrilha.

SCORE GLOBAL:
  Quando tenossinovite e bursas são avaliadas, relatar em bloco adicional após o
  PDUS-28 padrão. Não incluir no escore PDUS-28 oficial (mantém comparabilidade).

10. ESCORE FAT-12 (ALTERNATIVE PROTOCOL)
───────────────────────────────────────────────────────────────
O escore FAT-12 (Focused Articular Tendon) é uma alternativa ao PDUS-28 para avaliação
de AR em tempo reduzido, usando apenas 12 articulações:

Articulações FAT-12: MCF 2ª–3ª (bilateral), punho (bilateral), MTF 2ª–3ª (bilateral).
Total: 12 articulações × máx 3 (PD) = máx 36 pontos.
Correlação: FAT-12 correlaciona-se com PDUS-28 (r=0,85) e é adequado para triagem rápida.
Usar quando: tempo limitado de exame, paciente com mobilidade reduzida.
Limitação: não captura joelhos, ombros, cotovelos.

Relatar no laudo quando usado: "Protocolo FAT-12 aplicado (12 articulações)" e listar pontos.

11. ULTRASSOM NA REMISSÃO — SINOVITE SUBCLÍNICA
───────────────────────────────────────────────────────────────
CONCEITO DE SINOVITE SUBCLÍNICA:
  PD >0 em paciente clinicamente em remissão (DAS28 <2,6 + SDAI <3,3 + CDAI <2,8).
  Prevalência: 30–50% dos pacientes com AR em remissão clínica têm PD >0 ao US.
  Importância: PD residual >0 associa-se a:
    • 2× maior risco de flare em 1 ano
    • Progressão radiográfica mesmo sem sintomas clínicos
    • Menor durabilidade da remissão

OBJETIVO TERAPÊUTICO ATUAL (EULAR 2022):
  Remissão US (PDUS-PD28 = 0) é a meta superior à remissão clínica isolada.
  Quando clínica remissão mas PD >0: discutir com reumatologista sobre manutenção vs.
  ajuste de biológico.

DESCALONAMENTO TERAPÊUTICO:
  PDUS-PD28 = 0 × ≥6 meses: candidato a redução de dose de biológico (tapering).
  PDUS-PD28 >0: NÃO descalonar — risco aumentado de flare.

12. CRITÉRIOS DE RESPOSTA TERAPÊUTICA (PDUS-28)
───────────────────────────────────────────────────────────────
RESPOSTA MÍNIMA: redução ≥1 ponto no PDUS-PD28 (qualquer melhora).
RESPOSTA BOA: redução ≥20% do PDUS-PD28 (equivale à resposta ACR20).
RESPOSTA MODERADA: redução ≥50% do PDUS-PD28 (equivale à ACR50).
RESPOSTA EXCELENTE: redução ≥70% do PDUS-PD28 (equivale à ACR70).
REMISSÃO US: PDUS-PD28 = 0.

ATIVAÇÃO DE DOENÇA (FLARE US):
  Aumento ≥1 ponto no PDUS-PD28 vs. último exame em remissão.
  Aumento de ≥1 grau de PD em qualquer articulação previamente negativa.

MONITORAMENTO RECOMENDADO:
  AR ativa sob DMARD: PDUS-28 a cada 3–6 meses.
  AR em remissão: PDUS-28 semestral ou anual.
  Pré-descalonamento de biológico: confirmar PDUS-PD28 = 0.
  Suspeita de flare: PDUS-28 imediato.

13. DIAGNÓSTICO DIFERENCIAL — SINOVITE AO PDUS
───────────────────────────────────────────────────────────────
  Artrite Reumatoide (AR): simétrica, MCF/IFP/punho, PD variável por atividade.
  Artrite Psoriásica: assimétrica, envolvimento IFD + dactilite; PD enteseal.
  Lúpus (LES): sinovite migratória, PD geralmente <2 nas fases iniciais.
  Síndrome de Sjögren: artrite periférica leve, PD 0–1.
  Osteoartrite inflamatória erosiva: IFD e IFP, PD Grau 1–2, erosão "em gull wing".
  Artrite Reativa: MCF e MTF assimétricas, pós-infecção; PD agudo.
  Gota: MTF (1ª), joelho, tornozelo; DCS específico; PD nos tofos.
  Fibromialgia: cinza Grau 0–1, PD = 0 (sem sinovite = não é artrite inflamatória ativa).

RECOMENDAÇÕES PADRÃO EXPANDIDAS:
  "PDUS-PD28 = 0 (remissão US): Manutenção do tratamento atual. Seguimento semestral.
  Em remissão ≥6 meses: discutir com reumatologista sobre tapering do biológico."
  "PDUS-PD28 1–5 (baixa atividade): Otimizar DMARD. Considerar redução de
  corticóide se em uso. Repetir PDUS-28 em 3 meses."
  "PDUS-PD28 6–15 (atividade moderada): Ajuste terapêutico (troca ou adição de
  DMARD/biológico). Repetir em 3 meses pós-ajuste."
  "PDUS-PD28 ≥16 (alta atividade): Encaminhamento reumatológico urgente para
  intensificação imediata (biológico, JAKi ou combinação)."

OBSERVAÇÕES METODOLÓGICAS:
O PDUS-28 é uma ferramenta de avaliação quantitativa da sinovite pela US para monitoramento
da artrite reumatoide e outras artropatias inflamatórias. A confiabilidade interobservador
do PDUS-28 (ICC 0,70–0,85) é adequada quando os examinadores são treinados e usam o mesmo
protocolo. O principal fator de variação é a configuração do Power Doppler (PRF, ganho,
filtro) — o mesmo paciente examinado em equipamentos diferentes pode ter escores distintos.
O PD é suprimido por compressão excessiva do probe: usar gel generoso sem pressão para
maximizar a sensibilidade. O PDUS-28 sozinho não substitui a avaliação clínica global:
DAS28, SDAI, exame articular completo, PCR, VHS, hemograma e radiografia anual fazem parte
do seguimento completo da AR. Achados do PDUS-28 devem ser sempre interpretados pelo
reumatologista em conjunto com a resposta clínica e laboratorial.`,

// ─────────────────────────────────────────────────────────────────────────────
'vascular-doppler-renal': `

8. HIPERTENSÃO RENOVASCULAR — PROTOCOLO ESPECÍFICO
───────────────────────────────────────────────────────────────
INDICAÇÃO DE RASTREIO POR US-DOPPLER:
  HTA resistente (PA >140/90 mmHg com 3 anti-hipertensivos incluindo diurético).
  HTA de início súbito em jovem (<30 anos — suspeita de FMD).
  HTA de difícil controle em idoso com doença aterosclerótica difusa.
  Função renal deteriorando após início de IECA/BRA (sugere estenose bilateral ou rim único).
  Rim assimétrico (diferença >1,5 cm) ao US convencional.
  Sopro abdominal periumbelical à ausculta.

SEQUÊNCIA DIAGNÓSTICA RECOMENDADA:
  1. US-Doppler de artérias renais: triagem inicial (não-invasiva).
  2. Angiotomografia (Angio-TC 64-slices): padrão-ouro para anatomia e planejamento.
  3. Angio-RM: alternativa sem radiação/contraste iodado (menor resolução espacial).
  4. Arteriografia renal: gold standard para confirmação e intervenção simultânea.

9. DISPLASIA FIBROMUSCULAR (FMD) — DOENÇA ESPECÍFICA
───────────────────────────────────────────────────────────────
Causa mais comum de HTA renovascular em mulheres jovens (<40 anos).
Ocorre na porção média ou distal do tronco renal (diferente da aterosclerose que afeta ostial).

ACHADOS US TÍPICOS (limitados pela profundidade):
  Padrão "contas de rosário": alternância de estenoses e dilatações ao longo do tronco.
  VPS elevadas no segmento médio-distal (pode ser difícil de atingir com US).
  Padrão tardus-parvus se estenose distal significativa.
  Artéria renal: pode ser tortuosa / redundante (redundância = sinal indireto de FMD).

LIMITAÇÃO DA US NA FMD:
  FMD tipo médio-distal: porções distais do tronco renal geralmente INACESSÍVEIS ao US.
  Sensibilidade da US para FMD: ~60% (vs. >95% para estenose ostial aterosclerótica).
  → SEMPRE complementar com Angio-TC ou Angio-RM quando FMD suspeita.

Conduta: angioplastia transluminal percutânea (ATP) — taxa de sucesso >90% em FMD.
Resultado cirúrgico: cura ou melhora em 80–90% dos casos vs. apenas controle em HTA por aterosclerose.

10. ANEURISMA DE ARTÉRIA RENAL
───────────────────────────────────────────────────────────────
Prevalência: 0,01–0,09% na população geral. Mais comum em FMD e aterosclerose.

ACHADOS US:
  Dilatação sacular ou fusiforme do tronco renal.
  Calcificação parietal (aneurisma crônico aterosclerótico).
  Swirling flow ao PD no interior do saco.
  Trombo mural: material hiperecoico aderido à parede.

LIMIAR DE INTERVENÇÃO:
  Aneurisma >2 cm: indicação relativa de correção cirúrgica ou endovascular.
  Aneurisma em gestante ou candidata a gravidez: operar independente do tamanho.
  Aneurisma dissecante: intervir independente do tamanho → avaliar com Angio-TC urgente.

11. AVALIAÇÃO PRÉ-DOADOR DE RIM (LIVING DONOR)
───────────────────────────────────────────────────────────────
A US-Doppler integra o protocolo pré-doador ao lado da Angio-TC:

Avaliação obrigatória:
  Dimensões renais: simetria, volume (volume renal estimado: π/6 × L × A × E).
  IRs bilaterais: confirmar <0,70 (função preservada).
  Troncos renais: número (artérias acessórias em 25–30% dos casos), VPS.
  Veias renais: perviedade, variações anatômicas (veia renal esquerda retroaórtica em 3%).
  Cálculo em parênquima: excluir litíase significativa.
  Pesquisa de cistos: critério de Bosniak (cistos complexos contraindicam doação).

CRITÉRIOS DE EXCLUSÃO POR US-DOPPLER:
  IR >0,75 bilateral (sugere doença parenquimatosa difusa).
  Estenose de artéria renal detectada.
  Trombose venosa renal.
  Cisto Bosniak III ou IV.

12. NEFROPATIA PARENQUIMATOSA — IRs ELEVADOS
───────────────────────────────────────────────────────────────
IR bilateral elevado (>0,70) sem estenose de artéria renal = causa parenquimatosa.

Causas frequentes:
  Nefroesclerose hipertensiva: IR 0,70–0,85, ecogenicidade aumentada do parênquima.
  Nefropatia diabética: IR progressivamente elevado + dim. renal inicial N, depois reduzido.
  Glomerulonefrite aguda: IR elevado + rins aumentados + ecogenicidade aumentada.
  Nefrite intersticial aguda: IR >0,80 + rins aumentados + relato de uso de AINE/antibiótico.

GRADAÇÃO DE COMPROMETIMENTO (baseada no IR):
  IR 0,70–0,75: leve comprometimento microvascular.
  IR 0,75–0,80: moderado — correlacionar com TFG e proteinúria.
  IR >0,80: grave — risco de progressão para DRC.
  IR >0,85: padrão de alta resistência — biópsia renal a considerar.
  IR >0,90: padrão de obstrução aguda ou evento catastrófico (TVR, isquemia) → R6.

13. PROTOCOLO DE SEGUIMENTO PÓS-INTERVENÇÃO
───────────────────────────────────────────────────────────────
Pós-angioplastia ± stent:
  1 mês: primeira US-Doppler — avaliar patência e IR.
  3–6 meses: confirmar ausência de reestenose.
  Anual: seguimento de longo prazo.
  Critérios de reestenose: VPS >300 cm/s no segmento do stent + RAR >3,5.

Pós-transplante:
  1 semana: avaliar anastomose + IR parenquimatoso (IR >0,80 = rejeição possível).
  1 mês: linha de base pós-adaptação.
  3 e 6 meses: seguimento rotineiro.
  Qualquer elevação de creatinina: US imediato para excluir complicações.

RECOMENDAÇÕES EXPANDIDAS:
  Normal (N0): "Sem evidências de estenose renovascular. Seguimento conforme médico
  assistente. Em pacientes hipertensos: reconsiderar US-Doppler se HTA resistir a 3
  anti-hipertensivos."
  IR elevado bilateral >0,75 (N1–N2): "Correlação nefrológica completa: creatinina
  sérica, TFG estimada (CKD-EPI), urinálise com proteinúria, microalbuminúria. Avaliar
  ajuste de anti-hipertensivo (IECA/BRA)."
  Suspeita de estenose (N2–N3): "Complementar com Angiotomografia multidetector de
  artérias renais (protocolo bifásico: arterial + nefrogênica) para planejamento
  de intervenção (angioplastia ± stent)."
  Suspeita de FMD: "Angiotomografia das artérias renais com reformatações MIP. Encaminhamento
  para nefrologia/cirurgia vascular para avaliação de angioplastia transluminal percutânea."

OBSERVAÇÕES METODOLÓGICAS:
A US-Doppler de artérias renais é um método de triagem não-invasivo com sensibilidade
de 75–90% e especificidade de 70–85% para estenose >60% em centros experientes. A
avaliação direta dos troncos renais é tecnicamente limitada em 20–30% dos casos por
interposição de gás intestinal ou biotipo obesidade — nesses casos, a avaliação indireta
pelos IRs intraparenquimatosos é o único dado disponível. O padrão tardus-parvus é
altamente específico para estenose proximal, mas pode ser ausente em estenoses bilaterais
(sem assimetria de IR). A angiotomografia (Angio-TC) ou angiografia por RM são os métodos
de referência para confirmação diagnóstica e planejamento de intervenção. A angiotomografia
é preferida pela resolução espacial superior; a angio-RM é alternativa em pacientes com
alergia a contraste iodado ou DRC sem diálise. Todos os valores Doppler são
angulo-dependentes: ângulo de insonação deve ser mantido <60° — preferencial <45°.`,

// ─────────────────────────────────────────────────────────────────────────────
'pediatria-quadril-pediarico-ddq': `

8. DIAGNÓSTICO DIFERENCIAL — OUTRAS PATOLOGIAS DO QUADRIL PEDIÁTRICO
───────────────────────────────────────────────────────────────
8.1 SINOVITE TRANSITÓRIA (COXITE FUGAZ):
  Causa mais comum de coxalgia aguda em crianças (2–12 anos, pico 5–7 anos).
  US: derrame articular moderado (3–12 mm no recesso anterior — plano longitudinal
  anterior), sem espessamento sinovial real.
  PD: ausente ou mínimo (grau 0–1).
  Cabeça femoral: centrada, esferoidal.
  Chave diagnóstica: derrame simples, compressível, sem PD, afebril ou subfebril.
  Diferencial crítico: ARTRITE SÉPTICA (ver 8.2).
  Conduta: repouso + AINE; resolução em 2–4 semanas; controle US se não melhorar.

8.2 ARTRITE SÉPTICA DO QUADRIL:
  EMERGÊNCIA ORTOPÉDICA — R6 automático.
  US: derrame volumoso com debris/ecos internos + espessamento sinovial + PD Grau 2–3.
  Achados sugestivos: febre alta + leucocitose + VHS/PCR elevados + recusa de
  deambulação + dor à mobilização passiva.
  ESCORE DE KOCHER (diagnóstico diferencial sinovite transitória vs. artrite séptica):
    1. Febre >38,5°C
    2. VHS >40 mm/h
    3. Leucócitos >12.000/mm³
    4. Não-deambulação
    Probabilidade de artrite séptica: 0 critérios = <0,2%; 1 = 3%; 2 = 40%; 3 = 93%; 4 = 99,6%.
  Agente: S. aureus (mais comum); Streptococcus; Salmonella (anemia falciforme).
  Conduta: punção articular + lavagem cirúrgica + antibioticoterapia IV.
  ⚠️ ATIVAR R6 SE SUSPEITA → "Derrame articular com características suspeitas de
  artrite séptica: avaliação ortopédica urgente."

8.3 DOENÇA DE LEGG-CALVÉ-PERTHES (NECROSE AVASCULAR DA CABEÇA FEMORAL):
  Faixa etária: 4–10 anos, meninos (4:1 masculino:feminino).
  Fisiopatologia: isquemia avascular da cabeça femoral → fragmentação e remodelação.
  US: cabeça femoral irregular, heterogênea; espessamento subcondral; pode ter
  derrame articular associado.
  Avaliação adicional obrigatória: radiografia e/ou RM (US tem papel limitado no
  estadiamento da doença de LCP — apenas detecta derrame e irregularidade superficial).
  Estadiamento (Herring classificação lateral): A, B, C conforme percentual de
  envolvimento da coluna lateral (RM superior à US).
  Conduta: ortopedia pediátrica — contenção da cabeça, órtese, cirurgia conforme estágio.

8.4 EPIFISIOLISE FEMORAL SUPERIOR (EFS — SLIPPED CAPITAL FEMORAL EPIPHYSIS):
  Faixa etária: 10–16 anos, meninos pré-púberes com sobrepeso/obesidade.
  US: pode demonstrar a epífise femoral deslocada posteriormente no plano sagital.
  Melhor visualização: plano lateral do quadril.
  Chave diagnóstica: sinal de Klein (linha tangencial ao pescoço femoral não intersecta
  a epífise no Rx AP — US é auxiliar apenas).
  URGÊNCIA: EFS aguda (dor abrupta + impotência funcional) → ATIVAR R6.
  Conduta: parafuso in situ imediato; imobilização até cirurgia.

8.5 ARTRITE REUMATOIDE JUVENIL (ARJ — JIA):
  Pode acometer o quadril nas formas poliarticular e sistêmica (Doença de Still).
  US: sinovite com espessamento + PD Grau 1–3 + derrame moderado.
  Diferenciar de sinovite transitória: PD ativo + cronificação + articulações múltiplas.

9. TÉCNICA DE PUNÇÃO ARTICULAR DO QUADRIL GUIADA POR US
───────────────────────────────────────────────────────────────
A US pode ser usada para guiar punção articular diagnóstica/terapêutica quando há
derrame significativo (>3 mm no recesso anterior):

INDICAÇÃO: suspeita de artrite séptica (escore de Kocher ≥2) ou coleção pós-traumática.

TÉCNICA:
  Plano longitudinal anterior (vascular): visualizar a cabeça femoral e recesso anterior.
  Abordagem: antero-lateral, sob anestesia local (EMLA ou sedação em crianças <5 anos).
  Agulha: 20G para aspiração de líquido sinovial.
  Fluido coletado: enviar para: citologia, cultura, Gram, glicose, proteínas.
  Critérios de artrite séptica no líquido: leucocitose >50.000/mm³ + PMN >90%.

10. FOLLOW-UP DE DDQ EM TRATAMENTO
───────────────────────────────────────────────────────────────
CONTROLE US NO ARNÊS DE PAVLIK:
  Exame inicial: confirmar o diagnóstico antes da aplicação do arnês.
  1ª semana de uso: confirmar centramento da cabeça no acetábulo (coreference da cabeça
  com o teto ósseo — relação de cobertura esperada: >50% da cabeça coberta).
  2–4 semanas: controle de maturação (α deve aumentar progressivamente).
  6–8 semanas: objetivo α ≥55° com arnês.
  3 meses: objetivo Graf Tipo I (α ≥60°).
  Falha do arnês: Graf sem melhora após 4–6 semanas = reconsiderar imobilização gessada ou cirurgia.

LUXAÇÃO IRREDUTÍVEL (contraindicação ao arnês de Pavlik):
  Graf Tipo IV: lábio invertido caudalmente — o arnês pode piorar (empurrar o lábio
  mais caudalmente e bloquear a centração).
  → Nesses casos: imobilização em posição de abiptor sob controle de imagem ou cirurgia.

AVALIAÇÃO APÓS CIRURGIA DE CONTENÇÃO:
  Posição de imobilização gessada: US pode confirmar centramento da cabeça.
  Após remoção do gesso: retomar protocolo de Graf para confirmar maturação.

11. MEDIDA DO DERRAME ARTICULAR
───────────────────────────────────────────────────────────────
Medir no plano longitudinal anterior do quadril:
  Posicionar o probe paralelo ao eixo do colo femoral.
  Medir distância máxima entre a cortical do colo e a cápsula articular.

VALORES DE REFERÊNCIA:
  Normal: ≤2 mm (distância anterior colo-cápsula).
  Derrame mínimo: 2–3 mm.
  Derrame moderado: 3–6 mm (sinovite transitória típica: 3–6 mm).
  Derrame volumoso: >6 mm (suspeita de artrite séptica).
  Assimetria de >2 mm entre os lados = significativa (mesmo que absoluto seja <3 mm).

RELATO: "[X] mm de distância anterior colo-cápsula [direito/esquerdo] | Assimetria
de [X] mm em relação ao lado contralateral [X mm]."

RECOMENDAÇÕES FINAIS CONSOLIDADAS:
  Graf Tipo I: "Ecografia do quadril com maturação acetabular adequada para a faixa
  etária. Seguimento pediátrico rotineiro."
  Graf IIa <3m: "Imaturidade fisiológica esperada nesta faixa etária. Controle
  ultrassonográfico do quadril recomendado em 4–6 semanas."
  Graf IIa ≥3m / IIb: "Imaturidade acetabular — encaminhar para ortopedia pediátrica
  para avaliação de contenção com arnês de Pavlik."
  Graf IIc/IId: "Displasia acentuada — encaminhar urgente para ortopedia pediátrica
  para contenção imediata (arnês ou gesso)."
  Graf III/IV: ATIVAR R6 — "Luxação congênita franca. Encaminhamento ortopédico urgente."
  Derrame articular >4 mm + febre: ATIVAR R6 — "Suspeita de artrite séptica."

OBSERVAÇÕES METODOLÓGICAS:
A US do quadril pediátrico pelo método de Graf é operador-dependente e exige treinamento
específico. A obtenção do plano coronal padrão de Graf é crítica — planos oblíquos
resultam em α falsamente reduzido (superestimando a displasia) ou falsamente elevado
(subestimando). O osso ilíaco deve estar completamente plano no plano de imagem: se
houver curvatura, o corte é inadequado. A identificação do lábio cartilaginoso pode ser
difícil em neonatos prematuros (<35 semanas), que têm cartilagem imaura de menor
ecogenicidade. Após 4–6 meses, a ossificação crescente da cabeça femoral limita
progressivamente a visibilidade, e o raio-X da pelve passa a ser o método de escolha.
No contexto de urgência (suspeita de artrite séptica), a ausência de derrame na US tem
alto valor preditivo negativo — mas derrame simples não exclui infecção. Escore de Kocher
deve sempre ser calculado independentemente dos achados de US.`,
};

let modified = 0;
for (const t of templates) {
  if (expansions[t.id]) {
    t.aiInstructions += expansions[t.id];
    modified++;
  }
}

writeFileSync('scripts/phase1-templates.json', JSON.stringify(templates, null, 2), 'utf8');
console.log(`Expanded ${modified} templates.`);
for (const t of templates) {
  const ai = t.aiInstructions || '';
  console.log(`  [${(t.name || t.id).padEnd(45)}] ${ai.length} chars`);
}
