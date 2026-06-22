import { readFileSync, writeFileSync } from 'fs';
const t = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8'));
const a1 = t.find(x => x.id === 'reumatologico-articulacoes-perifericas');
a1.aiInstructions += `

9. TENOSSINOVITE E BURSAS PERIARTICULARES
───────────────────────────────────────────────────────────────
TENOSSINOVITE: inflamação da bainha tendinosa com exsudato peritendinoso.

OMBRO:
  Tendão do supraespinhoso: espessamento focal hipoecoico ≤7 mm (normal); >7 mm
  ou perda da fibrilaridade = tendinose. Calcificação: depósito hiperecoico com sombra.
  Bursa subdeltóidea: espessura ≤2 mm (normal); >2 mm + PD = bursite ativa.
  Ruptura do supraespinhoso: solução de continuidade, sinal do hematócrito.

PUNHO — COMPARTIMENTOS EXTENSORES:
  I: APL + EPB (DeQuervain) → mais propenso à tenossinovite estenosante.
  II: ECRB + ECRL
  III: EPL
  IV: EDC + EIP
  V: EDM
  VI: ECU
  Score: medir espessura da bainha em mm; PD perissinoval = tenossinovite ativa.

TENDÃO DE AQUILES (se avaliado):
  Normal: <6 mm de espessura, ecotextura paralela homogênea.
  Tendinose: >6 mm, hipoecoico, perda da fibrilaridade, PD intratendíneo.
  Entesopatia insercional: espessamento hipoecoico inserção + erosão calcânea + PD.

BURSAS:
  Bursa pré-patelar: normalidade ≤2 mm; >2 mm + PD = bursite (housemaid's knee).
  Bursa anserina (pes anserinus): face medial do joelho proximal; bursite frequente
  em AR e OA do joelho.
  Bursa olecraniana: posterior ao cotovelo; bursite reumatoide ou por cristais.
  Bursa trocantérica maior: face lateral do quadril; bursite = coxalgia lateral.

10. VELOCIDADE DE SEDIMENTAÇÃO E PARÂMETROS LABORATORIAIS — CORRELAÇÃO
───────────────────────────────────────────────────────────────
Relatar no laudo, quando disponíveis, os seguintes dados fornecidos pelo solicitante:

  PCR (Proteína C Reativa): <0,5 mg/dL normal; elevação proporcional à atividade.
  VHS (Velocidade de Hemossedimentação): <20 mm/h (homens); <30 mm/h (mulheres).
  FR (Fator Reumatoide): positivo em 80% da AR; também em Sjögren, crioglobulinemia.
  Anti-CCP: ≥95% específico para AR; preditor de erosão e doença grave.
  Ácido Úrico: >6,8 mg/dL = hiperuricemia (gota); mas gota PODE ocorrer com UA normal.
  HLA-B27: positivo em 85–90% da espondilite anquilosante; <8% na população geral.
  ANA: rastreio para LES, DMTC; baixo preditivo se <1:160.
  Complemento (C3/C4): consumo em LES com vasculite.

11. PROTOCOLO DE MONITORAMENTO LONGITUDINAL
───────────────────────────────────────────────────────────────
ARTRITE REUMATOIDE:
  Baseline: PDUS-28 (ou avaliação foculada em MCF/punho) antes de iniciar tratamento.
  3 meses: reavaliação após DMARD convencional (metotrexato ± hidroxicloroquina).
  6 meses: se sem remissão → biológico; PDUS para definir candidato.
  Remissão US: PD = 0 em todas as articulações → manutenção do tratamento.
  Anual: controle em remissão sustentada.

GOTA:
  Baseline: contagem de tofos, DCS, articulações afetadas.
  6–12 meses de tratamento hipouricemiante: reavaliar tamanho dos tofos (devem reduzir).
  Objetivo: desaparecimento do DCS (confirma dissolução dos cristais — uricemia <5,0 mg/dL).

ARTRITE PSORIÁSICA:
  Monitorar dactilite (bainha flexora + sinovite IFP + IFD no mesmo dígito).
  PD em entese insercional: resolução com anti-TNF ou anti-IL-17.

12. ACHADOS ESPECÍFICOS — LESÕES FOCAIS
───────────────────────────────────────────────────────────────
CISTO SINOVIAL PERIARTICULAR:
  Massa anecóica periarticular comunicando com o espaço articular.
  Punho: cisto ganglionar dorsal (mais comum — entre tendões extensores) ou volar
  (entre FCR e APL). Conteúdo: gelatinoso (não compressível em excesso).
  Joelho: cisto de Baker (recesso posterior comunicante com a articulação).
  Conduta: aspiração guiada ou excisão cirúrgica se sintomático.

CORPO LIVRE ARTICULAR:
  Fragmento hiperecoico livre no espaço articular + sombra acústica se calcificado.
  Causas: OA grave, osteocondrite dissecante, sinovite villonodular pigmentada.
  → Encaminhar para ortopedia se sintomático.

SINOVITE VILLONODULAR PIGMENTADA (SVNP):
  Rara. Sinovite hipervascular com material hipoecoico heterogêneo no recesso.
  PD Grau 3 + derrame homogeneamente hipoecoico ("chocolate sinovite").
  Frequente no joelho de adultos jovens.
  → RM para estadiamento; sinovectomia cirúrgica.

RECOMENDAÇÕES CONSOLIDADAS:
  N0: "Sem sinovite, sem erosão, PD negativo. Seguimento clínico habitual."
  N1: "Sinovite subclínica sem atividade ao PD. Correlação laboratorial (FR, anti-CCP,
  PCR, VHS). Repetir em 3–6 meses se sintomático."
  N2: "Sinovite ativa leve. Avaliação reumatológica eletiva. Considerar DMARD convencional
  (metotrexato 10–25 mg/semana ± ácido fólico) se diagnóstico de AR confirmado."
  N3: "Sinovite ativa moderada-intensa com erosões. Encaminhamento reumatológico prioritário.
  Considerar biológico (anti-TNF, anti-IL-6R, anti-CD20, abatacepte) ou JAK-inibidor
  se falha de DMARD convencional."
  N4: ATIVAR R6 — "Artrite séptica: avaliação ortopédica/reumatológica urgente. Artrocentese
  diagnóstica e terapêutica. Culturas do líquido sinovial. Antibioticoterapia empírica."

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia reumatológica das articulações periféricas é método de alta
sensibilidade para detecção de sinovite ativa, superior ao exame clínico para articulações
pequenas como MCF e IFP. A detecção de sinovite subclínica por PD tem impacto clínico
direto na decisão terapêutica: sinovite PD positiva = atividade inflamatória mesmo em
ausência de sinais clínicos. A técnica de PD requer cuidado com compressão excessiva
(suprime o sinal) e com artefatos de movimento do paciente. O diagnóstico definitivo
de AR exige critérios ACR/EULAR 2010 completos; de gota exige análise de cristais;
de APs exige critérios CASPAR. A US complementa mas não substitui a RM para estadiamento
de erosões (RM com gadolínio detecta erosões menores e edema de medula óssea não
visíveis ao US). O resultado desta US deve ser sempre integrado com dados clínicos,
laboratoriais (FR, anti-CCP, ácido úrico, PCR, VHS) e história natural da doença pelo
reumatologista assistente.`;
writeFileSync('scripts/phase1-templates.json', JSON.stringify(t, null, 2), 'utf8');
const a1f = t.find(x => x.id === 'reumatologico-articulacoes-perifericas');
console.log('A1 chars:', a1f.aiInstructions.length);
console.log('All chars:');
for (const tmpl of t) console.log(' ', (tmpl.name || tmpl.id).padEnd(45), tmpl.aiInstructions.length);
