/**
 * LAUD.IA — Phase 2 Template Expansion
 * Expands 6 short vascular templates with targeted clinical content.
 * Output: scripts/phase2-templates.json (import via Admin → Máscaras)
 */

import { readFileSync, writeFileSync } from 'fs';

const existing = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));

const expansions = {

// ─────────────────────────────────────────────────────────────────────────────
// C1 — DOPPLER AORTO-ILÍACO
// ─────────────────────────────────────────────────────────────────────────────
'aTkVQCrPNUgpq89dDcPS': `

4. PROTOCOLO DE VIGILÂNCIA DO ANEURISMA DE AORTA ABDOMINAL (AAA)
═══════════════════════════════════════════════════════════════════
CRITÉRIOS DE MEDIDA (obrigatórios para evitar erros):
  Medir o DIÂMETRO MÁXIMO perpendicular ao eixo axial da aorta (plano axial real,
  não oblíquo). A medição oblíqua superestima sistematicamente o diâmetro.
  Reportar: diâmetro total (adventícia a adventícia) + diâmetro luminal (dentro do trombo).
  Incluir: trombo mural (espessura máxima), calcificações, morfologia (fusiforme/sacular).
  Extensão: supra ou infrarrenal (relacionar com artérias renais e mesentérica inferior).

TABELA DE VIGILÂNCIA BASEADA EM DIÂMETRO (SVS/ESVS):
  < 3,0 cm: variante da normalidade superior — sem vigilância específica.
  3,0–3,9 cm: ectasia aórtica — US anual.
  4,0–4,9 cm: aneurisma pequeno — US semestral.
  5,0–5,4 cm: aneurisma intermediário — US trimestral + avaliação cirúrgica.
  ≥ 5,5 cm (homens) / ≥ 5,0 cm (mulheres): LIMIAR DE INTERVENÇÃO → R6 vascular urgente.
  Crescimento >0,5 cm/6 meses ou >1 cm/ano: crescimento rápido → R6 independente do diâmetro.

MORFOLOGIA DE RISCO:
  Aneurisma sacular (colo lateral): maior risco de ruptura que fusiforme de mesmo diâmetro.
  Trombo mural espesso: pode ocultar verdadeiro diâmetro → citar lúmen E diâmetro total.
  Calcificações espessas: interferem na medição — relatar como limitação técnica.

5. ENDOLEAKS — CLASSIFICAÇÃO COMPLETA E CONDUTA
═══════════════════════════════════════════════════════════════════
Endoleak = presença de fluxo ativo no saco aneurismático excluído após EVAR.
COMPARAR SEMPRE COM EXAME ANTERIOR: avaliação do saco (crescimento = endoleak ativo).

TIPO I — Vazamento na Zona de Fixação:
  Ia: proximal (colo da prótese → aorta).
  Ib: distal (colo ilíaco → ilíaca).
  Achados US: fluxo ao PD e espectral no saco, originando da zona de fixação.
  Conduta: REINTERVENÇÃO URGENTE (mais perigoso — pressuriza saco em nível sistêmico).
  → Ativar R6 se CRESCIMENTO DO SACO + Tipo I confirmado.

TIPO II — Enchimento Retrógrado:
  IIa: artéria lombar (múltiplos ramos retrograde fill).
  IIb: artéria mesentérica inferior (AMI) — mais comum.
  Achados US: fluxo no saco originando perifericamente (não na prótese); pode ser
  difícil distinguir do Tipo I ao US — CT com contraste confirma.
  Conduta: vigilância se saco estável; intervenção (embolização AMI/lombares) se crescimento.

TIPO III — Falha na Junção entre Módulos da Prótese:
  Fratura da prótese ou separação entre módulos.
  Achados US: fluxo pulsátil visível entre módulos da endoprótese.
  Conduta: REINTERVENÇÃO (similar ao Tipo I — pressurização sistêmica do saco).

TIPO IV — Porosidade da Tela da Prótese:
  Raro, ocorre precocemente pós-implante.
  Achados US: fluxo difuso através da tela; autolimitado em 30 dias.
  Conduta: observação (resolução espontânea).

TIPO V — Endotensão:
  Crescimento do saco sem endoleak detectável.
  Achados US: saco crescente ao longo das US de vigilância sem fluxo ao PD.
  Conduta: investigação com TC com contraste de alta resolução.

VIGILÂNCIA PÓS-EVAR (SVS):
  1 mês: primeira avaliação pós-implante (US ou TC).
  6 e 12 meses: US ± TC.
  Após 1 ano sem endoleak e saco estável: US anual.
  Saco crescente: TC com contraste urgente independente do intervalo.

6. SÍNDROME DE LERICHE
═══════════════════════════════════════════════════════════════════
Oclusão completa (crônica) da aorta terminal bilateral.
Tríade clássica: claudicação bilateral das nádegas/coxas + impotência eréctil + ausência
de pulsos femorais.

ACHADOS US:
  Aorta distal: sem fluxo ao color Doppler; material hiperecoico (trombo organizado).
  Artérias ilíacas: ausência de fluxo bilateral.
  Circulação colateral: fluxo monofásico compensatório nas ilíacas internas e epigástricos.
  Lombares pulsando bilateralmente (colateral visceral).
  ⚠️ ATIVAR R6: Oclusão aórtica aguda (isquemia crítica bilateral súbita) →
  "OCLUSÃO AGUDA DE AORTA ABDOMINAL: avaliação cirúrgica/endovascular emergencial."

7. ANEURISMA DE ARTÉRIAS ILÍACAS
═══════════════════════════════════════════════════════════════════
LIMIARES DE INTERVENÇÃO (SVS/ESVS):
  Artéria Ilíaca Comum (AIC): diâmetro ≥3,0 cm = aneurisma; ≥3,5 cm = avaliar intervenção.
  Artéria Ilíaca Interna (AII): diâmetro ≥2,5 cm = aneurisma; ≥3,0 cm = avaliar intervenção.
  Associação: 20–30% dos AAA têm aneurisma ilíaco concomitante → SEMPRE avaliar ilíacas.

MEDIDA OBRIGATÓRIA:
  AIC bilateralmente: diâmetro máximo perpendicular ao eixo do vaso.
  AII: avaliar quando AIC for ectásica ou aneurismática.
  Relatar: envolvimento bilateral, extensão (fusiforme vs. sacular), trombo mural.

8. ESTENOSE AORTO-ILÍACA — CLASSIFICAÇÃO TASC II (ILÍACA)
═══════════════════════════════════════════════════════════════════
TASC A (endovascular — 1ª escolha):
  Lesão estenótica unilateral ≤3 cm da AIC.
  Oclusão unilateral ≤3 cm AIC.

TASC B (endovascular — preferível):
  Estenose 3–10 cm AIC, sem envolver bifurcação.
  Oclusão unilateral AIC sem envolver bifurcação.
  Lesão única da AIE <3 cm.

TASC C (cirurgia ou endovascular por centro especializado):
  Oclusão AIC bilateral.
  Estenose bilateral AIC >10 cm.
  Estenose unilateral AIC >10 cm.

TASC D (cirurgia — 1ª escolha):
  Oclusão aorto-ilíaca bilateral.
  Oclusão ilíaca difusa + estenose aorto-ilíaca.
  Síndrome de Leriche.

RELATAR NO LAUDO: "[TASC X] — conduta endovascular / cirúrgica conforme avaliação vascular."

9. ARTÉRIAS VISCERAIS — AVALIAÇÃO COMPLEMENTAR
═══════════════════════════════════════════════════════════════════
Quando acessíveis (frequentemente avaliadas no mesmo exame):

TRONCO CELÍACO:
  Normal: VPS 100–200 cm/s. Estenose >70%: VPS >200 cm/s + turbulência.
  Síndrome de compressão do ligamento arqueado (SCLA): variação respiratória de VPS >20%
  (aumenta na expiração, diminui na inspiração) = compressão extrínseca.

ARTÉRIA MESENTÉRICA SUPERIOR (AMS):
  Normal (em jejum): VPS 100–200 cm/s; VDF baixo (alta resistência em jejum).
  Pós-prandial: VDF aumenta, IR cai (<0,80).
  Estenose >70%: VPS >275 cm/s (em jejum).
  Angina mesentérica: comprometimento de ≥2 de 3 vasos viscerais (celíaco, AMS, AIM).

10. DISSECÇÃO DE AORTA ABDOMINAL
═══════════════════════════════════════════════════════════════════
Extensão abdominal de dissecção torácica tipo B ou dissecção primária abdominal (rara).

ACHADOS US:
  Flap intimal: membrana linear hiperecoica oscilante no interior da aorta.
  Luz verdadeira: pulsação sincrónica ao ECG; fluxo de alta velocidade.
  Luz falsa: pulsação paradoxal ou ausente; fluxo lento (pode ser trombosado).

⚠️ ATIVAR R6: Dissecção aórtica abdominal aguda →
"ALERTA: Dissecção aórtica com extensão abdominal. Avaliação vascular/cardiovascular urgente."

OBSERVAÇÕES METODOLÓGICAS:
O exame ultrassonográfico do segmento aorto-ilíaco é limitado por interposição gasosa
intestinal (principal limitação, afeta 10–25% dos exames), obesidade e calcificações
extensas. A avaliação é DIAGNÓSTICA para aneurisma (sensibilidade >95%) mas SUBESPECÍFICA
para endoleaks — Tipo II de baixo fluxo pode ser invisível ao US sem contraste (CEUS).
A angiotomografia permanece o padrão-ouro para caracterização do endoleak, planejamento
pré-operatório e follow-up pós-EVAR. A medição do diâmetro deve ser PERPENDICULAR ao eixo
do vaso: medições oblíquas superestimam o diâmetro em até 15–20%, podendo levar a
intervenções desnecessárias. Em pacientes com EVAR, o uso de CEUS (contraste US) pode
detectar endoleaks não visíveis ao US convencional com sensibilidade similar à TC-contrastada.`,

// ─────────────────────────────────────────────────────────────────────────────
// C2 — DOPPLER ARTERIAL DE MEMBRO INFERIOR
// ─────────────────────────────────────────────────────────────────────────────
'vXAO9wOokphmh6xg6Eui': `

5. ÍNDICE TORNOZELO-BRAÇO (ITB / ABI)
═══════════════════════════════════════════════════════════════════
O ITB é o exame funcional mais relevante para DAP. Se valores pressóricos forem fornecidos,
calcular OBRIGATORIAMENTE.

CÁLCULO:
  ITB = PA sistólica no tornozelo (maleolar) ÷ PA sistólica braquial (maior dos dois braços).
  Usar a MAIOR pressão maleolar (tibial posterior OU dorsal do pé) para cada lado.

CLASSIFICAÇÃO ITB (AHA/ACC):
  ITB >1,40:  Valores não-compressíveis (calcificação arterial — DM, DRC, idosos).
              Calcular Índice Dedo-Braço (IDB) ou usar PPG. Não exclui DAP grave.
  ITB 1,00–1,40: Normal.
  ITB 0,91–0,99: Limítrofe — avaliar com teste ergométrico ou pressão pós-exercício.
  ITB 0,71–0,90: DAP leve.
  ITB 0,41–0,70: DAP moderada (claudicação de esforço).
  ITB 0,21–0,40: DAP grave (claudicação incapacitante / repouso).
  ITB ≤0,20:  Isquemia crítica dos membros (ICM) → R6 imediato.

ÍNDICE DEDO-BRAÇO (IDB / TBI):
  Usar quando ITB >1,40 (calcificado — medida impossível).
  Normal: IDB ≥0,70.
  DAP: IDB <0,70.

6. CLASSIFICAÇÃO DE FONTAINE / RUTHERFORD
═══════════════════════════════════════════════════════════════════
Relacionar os achados Doppler com a classificação funcional:

FONTAINE → RUTHERFORD:
  Fontaine I   → Rutherford 0: Sem sintoma. DAP subclínica.
  Fontaine IIa → Rutherford 1: Claudicação leve (>200 m).
  Fontaine IIb → Rutherford 2-3: Claudicação moderada-grave (<200 m).
  Fontaine III → Rutherford 4: Dor em repouso.
  Fontaine IV  → Rutherford 5: Perda tecidual menor (úlcera/gangrena distal).
  Fontaine IV  → Rutherford 6: Perda tecidual maior (gangrena extensa proximal).

ISQUEMIA CRÍTICA DOS MEMBROS (ICM / CLI):
  Rutherford 4–6: DAP com dor em repouso + PA tornozelo ≤50 mmHg OU ITB ≤0,40.
  → ATIVAR R6: "ISQUEMIA CRÍTICA DE MEMBRO [INFERIOR DIREITO/ESQUERDO]:
  avaliação vascular urgente para revascularização."

7. CLASSIFICAÇÃO TASC II — LESÕES FEMOROPOPLÍTEAS
═══════════════════════════════════════════════════════════════════
Para estenoses e oclusões do segmento femoropoplíteo:

TASC A (endovascular — 1ª escolha):
  Estenose única ≤10 cm na AFC/AFS.
  Oclusão única ≤5 cm.

TASC B (endovascular — boa opção):
  Estenoses múltiplas ≤5 cm cada.
  Oclusão ≤15 cm sem envolver poplítea.
  Oclusão única ≤5 cm com stent prévi.

TASC C (endovascular ou cirurgia — centro especializado):
  Estenoses múltiplas >15 cm total.
  Oclusão AFS >15 cm sem envolver poplítea.
  Oclusão ou estenose recorrente pós-intervenção.

TASC D (cirurgia 1ª escolha — bypass):
  Oclusão AFS total crônica.
  Oclusão poplítea + tibial superior envolvida.

RELATAR: "Padrão compatível com TASC [A/B/C/D] femoropoplíteo [direito/esquerdo]."

8. MONITORAMENTO PÓS-REVASCULARIZAÇÃO
═══════════════════════════════════════════════════════════════════
BYPASS (ENXERTO DE SAFENA OU DACRON):
  Critérios de patência normal:
    Fluxo trifásico ou bifásico de alta amplitude no corpo do enxerto.
    VPS no corpo do bypass: 40–150 cm/s.
    Sem gradiente de velocidade >2:1 em nenhum ponto.
  Critérios de estenose do bypass:
    VPS local >300 cm/s com gradiente >2:1 = suspeita de estenose ≥75%.
    Redução de VPS <45 cm/s no corpo = suspeita de oclusão iminente.
    → Avaliação vascular para angioplastia ou revisão cirúrgica.

STENT ARTERIAL:
  Normal: fluxo laminar no interior do stent; VPS uniforme.
  Reestenose intrastent:
    VPS >300 cm/s + gradiente pré/intra-stent >2,5:1 = estenose >75%.
    → Reavaliação cirúrgica/endovascular.

PROTOCOLO DE VIGILÂNCIA BYPASS (SBACV):
  1 semana: baseline pós-operatório.
  1, 3, 6 meses: US seriada.
  1 e 2 anos: US anual.
  Qualquer nova sintomatologia: US imediato.

9. TROMBOSE ARTERIAL AGUDA — DIAGNÓSTICO DIFERENCIAL
═══════════════════════════════════════════════════════════════════
TROMBOSE in situ (sobre placa aterosclerótica):
  Achados: placa aterosclerótica visível + material hipoecoico sobrejacente + ausência fluxo.
  Contexto: claudicação prévia, isquemia progressiva.

EMBOLIA ARTERIAL:
  Achados: oclusão abrupta sem aterosclerose local; material hipoecoico "flutuante";
  bifurcações mais afetadas (bifurcação aórtica, poplítea — "saddleembolus").
  Contexto: FA, valvulopatia mitral, IAM recente.
  Diferencial US: embolia não tem placa; trombose tem placa adjacente.
  ⚠️ R6: isquemia aguda (6Ps): Pâlor, Pain, Paresthesia, Paralysis, Pulselessness, Poiquilotermia.

TROMBOANGIITE OBLITERANTE (Doença de Buerger):
  Jovem, fumante, homem. Afeta artérias distais (tibiais, peroneais, palmares, plantares).
  US: oclusão de tibiais ± colaterais com aspecto em "cabeça de medusa" (circulação em
  saca-rolha ao color Doppler).
  Doença proximal (aorto-ilíaca) NÃO É típica de Buerger.
  → Correlação clínica obrigatória: suspender tabagismo é o único tratamento eficaz.

10. ARTÉRIA POPLÍTEA — ENTRAPMENT E ANEURISMA
═══════════════════════════════════════════════════════════════════
SÍNDROME DE APRISIONAMENTO DA ARTÉRIA POPLÍTEA (SAAP):
  Jovem, atleta, sem DAP. Claudicação plantar/gemelar ao exercício.
  Avaliação: US dinâmica com dorsiflexão ativa e plantar forçada (provocação).
  Positivo: oclusão ou redução >50% do fluxo poplíteo em dorsiflexão ativa.
  → RM para confirmação anatômica + avaliação cirúrgica.

ANEURISMA DE ARTÉRIA POPLÍTEA:
  Mais comum aneurisma periférico (70% dos aneurismas periféricos).
  Bilateral em 50–60% dos casos.
  Limiar de intervenção: >2,0 cm (risco de trombose/embolização distal).
  Complicação: trombo mural → embolização distal → isquemia aguda distal.
  → R6 se isquemia aguda secundária ao aneurisma poplíteo.

RECOMENDAÇÕES CONSOLIDADAS:
  DAP subclínica (N1): "Correlação com fatores de risco cardiovascular (HTA, DM, dislipidemia,
  tabagismo). Otimização de MAPA (antiplaquetário, estatina, controle glicêmico)."
  DAP moderada (N2): "Encaminhamento vascular eletivo. Programar angiografia/angiotomografia
  para estadiamento definitivo. ITB e teste ergométrico se não contraindicado."
  DAP grave (N3): "Encaminhamento vascular prioritário para angioplastia/bypass conforme
  TASC. Angiotomografia pré-operatória."
  Isquemia crítica (N4): ATIVAR R6 → "Isquemia crítica: avaliação vascular urgente para
  revascularização (endovascular ou cirúrgica). Iniciar heparina IV se diagnóstico
  confirmado de trombose/embolismo agudo."

OBSERVAÇÕES METODOLÓGICAS:
O Doppler arterial de membros inferiores é método sensível (85–90%) e específico (95%)
para detecção de estenoses ≥50%. Suas principais limitações são: calcificação arterial
extensa (mediasclerose de Mönckeberg — impede compressão e distorce velocidades), obesidade
(limita janela acústica), exame de artérias tibiais (<3 mm de calibre — difícil
visibilização com Doppler convencional). O ITB, quando disponível, é o parâmetro funcional
mais relevante e deve ser sempre citado no laudo quando fornecido. A angiotomografia
multidetector (Angio-TC) ou angiografia por RM são necessários antes de qualquer
revascularização. Em pacientes diabéticos, o ITB pode ser falsamente elevado por
mediasclerose (artéria não-compressível): usar IDB (dedo-braço) nesses casos.`,

// ─────────────────────────────────────────────────────────────────────────────
// C3 — DOPPLER ARTERIAL DE MEMBRO SUPERIOR
// ─────────────────────────────────────────────────────────────────────────────
'Ml3A5Jz8uR8L2DtUMEwQ': `

4. PARÂMETROS DE NORMALIDADE — MEMBROS SUPERIORES
═══════════════════════════════════════════════════════════════════
Artéria Subclávia (proximal): VPS 60–140 cm/s | padrão trifásico.
Artéria Axilar:              VPS 60–120 cm/s | trifásico.
Artéria Braquial:            VPS 50–100 cm/s | trifásico.
Artéria Radial:              VPS 40–80 cm/s  | trifásico.
Artéria Ulnar:               VPS 40–80 cm/s  | trifásico.
Arco Palmar Superficial:     Baixa amplitude; monofásico é aceitável.
Artérias Digitais:           VPS 15–40 cm/s  | monofásico ou bifásico.

Padrão trifásico = esperado em repouso.
Padrão monofásico = normal apenas distal ao carpo (digitais) OU patológico se em
braquial/axilar (indica obstrução proximal).

ÍNDICE PULSO-BRAÇO (WRIST-BRACHIAL INDEX — WBI):
  PA sistólica no punho ÷ PA sistólica braquial.
  Normal: >0,90.
  <0,90: obstrução subclávia/axilar/braquial significativa.

5. SÍNDROME DO DESFILADEIRO TORÁCICO ARTERIAL (SDTA)
═══════════════════════════════════════════════════════════════════
Compressão da artéria subclávia entre clavícula e primeira costela, ou pelo músculo
escaleno anterior (espaço interescalênico).

PROTOCOLO DINÂMICO (obrigatório se suspeita clínica):
  Posição 1 NEUTRA: braço ao lado — registrar VPS e padrão espectral.
  Posição 2 ABDUÇÃO 90° (ROTAÇÃO EXTERNA): registrar.
  Posição 3 HIPERABDUÇÃO 180° (ROOS): registrar.
  Positivo: redução >50% da VPS ou ausência de fluxo em qualquer posição dinâmica.

FORMAS CLÍNICAS DA SDTA:
  VASCULAR (arterial): compressão da artéria subclávia → trombose, aneurisma,
    embolização distal, isquemia digital.
  VENOSA: ver template DOPPLER VENOSO MMSS (síndrome de Paget-Schroetter).
  NEUROLÓGICA: compressão do plexo braquial (não avaliável por US vascular).

ACHADOS US NA SDTA ARTERIAL:
  Aneurisma pós-estenótico subclavicular (dilatação distal à compressão).
  Trombo mural no aneurisma → embolização digital.
  Dedos isquêmicos com fluxo digital ausente ou muito reduzido.
  Assimetria PA bilateral (>10 mmHg) = sinal indireto de obstrução subclávia.

6. SÍNDROME DE ROUBO DA SUBCLÁVIA (SUBCLAVIAN STEAL)
═══════════════════════════════════════════════════════════════════
Estenose da subclávia proximal à origem da vertebral → inversão do fluxo vertebral
ipsilateral (fluxo rouba da circulação posterior para suprir o membro).

DIAGNÓSTICO US:
  Fluxo vertebral INVERTIDO (sentido crânio-caudal) ao Color Doppler e Espectral.
  Padrão "pendular" em estenoses moderadas (partial steal): sistólica normal, diástole
  invertida — padrão em "gangorra" ou "zigzag" no espectro.
  VPS subclávia ipsilateral reduzida vs. contralateral (assimetria significativa).

CONFIRMAÇÃO: Teste de hiperperfusão do membro:
  Esfigmomanômetro no braço ipsilateral inflado >PA sistólica × 3 minutos.
  Após liberação: hiperemia → aumento do roubo → fluxo vertebral mais invertido.

IMPLICAÇÕES CLÍNICAS:
  Roubo vertebral isolado: geralmente bem tolerado (circulação colateral posterior eficiente).
  Roubo sintomático (síncope ao usar braço, vertigem, diplopia): encaminhar para angioplastia
  da subclávia proximal ou bypass.

7. FENÔMENO DE RAYNAUD — AVALIAÇÃO VASCULAR
═══════════════════════════════════════════════════════════════════
Vasoespasmo episódico das artérias digitais ao frio ou estresse emocional.
Classificação: primário (idiopático) x secundário (LES, Esclerodermia, DMTC, Buerger).

AVALIAÇÃO US:
  Temperatura basal: artérias digitais com fluxo; VPS digital.
  Desafio ao frio (se disponível): imersão em água fria 15°C × 2 min → verificar redução
  do fluxo digital.
  Espessamento da parede intimal: secundário a esclerodermia (esclerose sistêmica).

Achados sugestivos de Raynaud secundário:
  Obstrução fixa das digitais (vs. espasmo transitório no primário).
  Espessamento intimal digital grave.
  Ausência de arcadas palmares.
  → Encaminhar para reumatologista (capilaroscopia periungeal complementar).

8. ANEURISMA DE ARTÉRIA SUBCLÁVIA / AXILAR
═══════════════════════════════════════════════════════════════════
Causas: aterosclerose, SDTA, trauma, íntegra viral (micose sistêmica).
Limiar: ASubc >15 mm; AAx >12 mm = aneurisma.

ACHADOS US:
  Massa pulsátil com dilatação do calibre arterial.
  Swirling flow ao PD (fluxo turbulento intrassacular).
  Trombo mural: material hiperecoico aderido à parede.
  Embolização distal: fluxo monofásico ou ausente nas artérias braquiais/radiais distais.

PSEUDO-ANEURISMA:
  Ruptura da camada íntima com hematoma extravascular organizado.
  Causa frequente: iatrogênico (pós-cateterismo braquial ou axilar).
  US: massa puxante com pescoço fino comunicando com lúmen + swirling flow ao PD.
  Tratamento: compressão guiada por US (injeção de trombina ecoguiada em casos refratários).

9. AVALIAÇÃO ARTERIAL PRÉ E PÓS-FAV PARA HEMODIÁLISE
═══════════════════════════════════════════════════════════════════
PRÉ-FÍSTULA (mapeamento):
  Artéria radial: diâmetro ≥2,0 mm sem compressão (adequada); VPS e padrão.
  Artéria ulnar: alternativa se radial inadequada.
  Resposta vasodilatadora ao inflado do manguito (flow-mediated dilation): avaliar reatividade.
  Teste de Allen: não avaliável por US puro — usar PPG digital com compressão alternada.

FAV EXISTENTE — MATURAÇÃO:
  Veia eferente >4 mm (adequada para punção).
  Fluxo de volume (QB) >600 mL/min = fístula madura.
  VPS anastomótica 200–500 cm/s (normal); >500 cm/s com gradiente >3:1 = estenose.

FAV EXISTENTE — DISFUNÇÃO:
  QB <400 mL/min ao Doppler integrado = hipodébito.
  VPS >600 cm/s em segmento específico = estenose (hemostase reduzida 50–80%).
  Pseudo-aneurisma de veia de punção: lesão pulsátil com swirling flow ao PD.
  Trombose de veia eferente: incompressibilidade + ausência de fluxo.

10. CLASSIFICAÇÃO N0–N4 EXPANDIDA
═══════════════════════════════════════════════════════════════════
N0 — Artérias pérvias, padrão trifásico bilateral, sem placa. Simetria.
  Conclusão: "Estudo Doppler das artérias dos membros superiores sem alterações."

N1 — Placa aterosclerótica focal sem redução hemodinâmica. VPS limítrofe.
     SDTA positiva sem trombose. Assimetria de PA bilateral 10–20 mmHg.
  Conclusão: "[Placa sem repercussão hemodinâmica / SDTA funcional sem trombose]."
  Conduta: fatores de risco cardiovascular; reavaliar em 6 meses.

N2 — Estenose <50% com turbulência. Roubo vertebral incompleto assintomático.
  Conclusão: "Estenose de grau leve a moderado sem repercussão clínica significativa."
  Conduta: avaliação vascular eletiva; angiotomografia para planejamento.

N3 — Estenose ≥50% unilateral. Oclusão radial/ulnar. Roubo subclávia sintomático.
     Aneurisma subclávia/axilar com trombo. FAV com estenose significativa.
  Conclusão: "Estenose hemodinamicamente significativa / Aneurisma com trombo mural."
  Conduta: encaminhamento vascular prioritário; angiotomografia; intervenção programada.

N4 — Isquemia aguda de membro superior. Embolização distal aguda. Oclusão aguda.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA VASCULAR: Isquemia aguda de membro superior com ausência de
  fluxo distal. Avaliação cirúrgica vascular emergencial."

RECOMENDAÇÕES PADRÃO:
  Normal: "Sem obstrução arterial significativa. Seguimento cardiovascular habitual."
  Estenose subclávia: "Angioplastia da subclávia proximal — avaliação vascular programada."
  Roubo vertebral sintomático: "Angiotomografia + avaliação vascular para stent subclávia."
  Isquemia digital (Raynaud secundário): "Reumatologia (capilaroscopia, ANA, Anti-Scl70)."
  FAV disfuncionante: "Cirurgia vascular para revisão/correção da estenose da FAV."

OBSERVAÇÕES METODOLÓGICAS:
O Doppler arterial de membros superiores é tecnicamente mais acessível que os membros
inferiores pela superficialidade das artérias, mas a subclávia proximal e o segmento
retroclavicular podem ser difíceis de acessar. A avaliação dinâmica (SDTA, roubo de
subclávia) exige posicionamento preciso do paciente e experiência do examinador. Em
pacientes com FAV para hemodiálise, parâmetros de normalidade diferem do braço nativo:
fluxo de volume e VPS anastomótica devem ser reportados com referências específicas de
FAV. A angiotomografia confirma achados de SDTA e é mandatória antes de intervenção.`,

// ─────────────────────────────────────────────────────────────────────────────
// C4 — DOPPLER DE ARTÉRIAS OFTÁLMICAS
// ─────────────────────────────────────────────────────────────────────────────
'CieXNLc1BLzDUnEiIaoC': `

4. PROTOCOLO DETALHADO — VASOS ORBITÁRIOS
═══════════════════════════════════════════════════════════════════
SEQUÊNCIA DE AVALIAÇÃO:
  1. Artéria oftálmica (AO): primeiro vaso a avaliar. Localizar ao color Doppler como
     vaso hiperecoico adjacente ao nervo óptico, porção nasal. Ângulo <60°.
  2. Artéria central da retina (ACR): interior do nervo óptico, ponto hiperecoico central.
     Fluxo de baixa amplitude (VPS 10–20 cm/s) — requer alta sensibilidade.
  3. Artéria ciliar posterior (ACP): pares de pontos hiperecoicos nasal e temporal ao
     nervo óptico, posterior ao globo ocular.
  4. Veia oftálmica superior (VOS): adjacente ao AO, porção medial da órbita.
     Fluxo venoso anterógrado (da órbita para o seio cavernoso).

PARÂMETROS DE NORMALIDADE DETALHADOS:
                    VPS (cm/s)    VDF (cm/s)    IR          IP
  Artéria Oftálmica:  21–40        7–16        0,67–0,82   1,20–1,90
  ACR (retina):       10–20        3–7         0,67–0,75   1,10–1,60
  ACP (ciliar post.): 10–22        3–8         0,60–0,75   1,00–1,50
  VOS:                fluxo anterógrado contínuo; inversão = patológico.

5. OCLUSÃO DA ARTÉRIA CENTRAL DA RETINA (OACR)
═══════════════════════════════════════════════════════════════════
EMERGÊNCIA OFTALMOLÓGICA → R6 AUTOMÁTICO (janela terapêutica: <4,5 horas).

ACHADOS US:
  ACR: ausência de fluxo ao Color Doppler E espectral (oclusão completa).
  ACR com fluxo residual: oclusão parcial ou ramo.
  AO e ACP: geralmente preservadas (OACR isolada não acomete AO e ACP).
  Sinal de "hipervascularidade reativa": raramente, hiperemia compensatória.

CONTEXTO CLÍNICO:
  Perda visual monocular súbita, indolor.
  Causa: êmbolo (placa de Hollenhorst da ACI ipsilateral), trombose in situ, vasculite.
  ATENÇÃO: OACR é equivalente oftálmico do AVC — investigar ACI ipsilateral IMEDIATAMENTE.

CONDUTA R6:
"ALERTA: Ausência de fluxo na Artéria Central da Retina [direita/esquerda]. Quadro
compatível com Oclusão da Artéria Central da Retina — EMERGÊNCIA OFTALMOLÓGICA.
Encaminhamento imediato ao centro de oftalmologia terciária para possível trombolítico
intra-ocular ou massagem ocular. Investigar Doppler de carótidas ipsilateral."

6. OCLUSÃO DA VEIA CENTRAL DA RETINA (OVCR)
═══════════════════════════════════════════════════════════════════
ACHADOS US:
  VOS: fluxo anterógrado reduzido ou ausente.
  ACR: fluxo aumentado (hipertensão venosa reativa) ou padrão diastólico invertido.
  NOTA: OVCR é menos dramática que OACR — perda visual gradual ou com edema macular.

CONTEXTO:
  Fatores de risco: HTA, DM, glaucoma, estados de hipercoagulabilidade.
  Forma: não-isquêmica (moderada — visão preservada) vs. isquêmica (grave — NO).

CONDUTA: Oftalmologista urgente para anti-VEGF intravítreo e tratamento da causa base.

7. GLAUCOMA — AVALIAÇÃO HEMODINÂMICA
═══════════════════════════════════════════════════════════════════
O US-Doppler oftálmico é um dos poucos métodos que avalia a perfusão do nervo óptico,
correlacionando com a progressão do glaucoma de tensão normal (GTN).

ACHADOS NO GLAUCOMA:
  ACR: redução da VDF (0,67–0,75 normal → <0,65 no glaucoma progressivo).
  IR da ACR aumentado: >0,75 = redução da perfusão diastólica do nervo óptico.
  ACP: IR aumentado >0,75 ipsilateral ao hemicampo visual comprometido.

CORRELAÇÃO CLÍNICA:
  Glaucoma de pressão normal (GTN): PIO normal mas IR elevado → isquemia do nervo óptico.
  Relação PIO / perfusão: PA de perfusão ocular = PAM - 2/3 PIO.
  Uso de anti-glaucomatosos: beta-bloqueadores tópicos podem reduzir fluxo ocular.

LIMITAÇÃO: variabilidade intraobservador alta nos vasos orbitários pequenos (ACR, ACP).
Achados isolados devem ser correlacionados com perimetria e OCT do nervo óptico.

8. NEUROPATIA ÓPTICA ISQUÊMICA ANTERIOR (AION)
═══════════════════════════════════════════════════════════════════
AION ARTERÍTICA (AA-AION) — associada à Arterite de Células Gigantes (ACG):
  Forma mais grave — cegueira permanente em 15% dos casos não tratados.
  Achados US: redução grave de fluxo na AO, ACR e ACP ipsilateral.
  SINAL DO HALO: espessamento hipoecóico da parede da artéria temporal superficial
  (pesquisar: espessura >0,3 mm = suspeita de ACG).
  VHS >50 mm/h + PCR elevada + sinal do halo = ACG até prova em contrário.
  → ATIVAR R6: "Corticoterapia imediata (prednisona 1 mg/kg/dia) para prevenir cegueira."

AION NÃO-ARTERÍTICA (NA-AION):
  Mais frequente. Associada a HTA, DM, apneia do sono.
  US: redução moderada de VDF na ACR ipsilateral; IR aumentado.
  Conduta: controle dos fatores de risco; oftalmologista.

9. FÍSTULA CAROTÍDEO-CAVERNOSA (FCC)
═══════════════════════════════════════════════════════════════════
Comunicação anormal entre carótida interna e seio cavernoso.
Causa: trauma cranioencefálico (direta) ou ruptura espontânea de aneurisma.

ACHADOS US:
  VOS: INVERSÃO DO FLUXO (normalmente anterógrado → posterógrado para o seio cavernoso).
  VOS aumentada e dilatada (>3 mm).
  Pulsatilidade venosa: padrão pulsátil (venoso drenando fluxo arterial).
  Achados clínicos: proptose pulsátil, sopro ocular, quemose.

→ Angiografia cerebral para confirmação e embolização endovascular.

10. PRESSÃO INTRACRANIANA ELEVADA (PIC)
═══════════════════════════════════════════════════════════════════
O nervo óptico (bainha) conecta ao espaço subaracnóideo — o LCR se acumula na bainha
quando a PIC aumenta.

MEDIDA DO DIÂMETRO DA BAINHA DO NERVO ÓPTICO (DBNO):
  Técnica: transdutor linear 7,5–15 MHz, plano axial, ângulo nasal.
  Ponto de medida: 3 mm posterior à lâmina cribriforme (cápsula de Tenon).
  DBNO normal: ≤5,0 mm (adulto).
  DBNO >5,7 mm: suspeita de PIC elevada (sensibilidade 90%, especificidade 85%).
  DBNO >6,0 mm: altamente sugestivo de hipertensão intracraniana.

APLICAÇÃO CLÍNICA:
  Triagem de PIC em UTI (evitar punção lombar desnecessária).
  Paciente com cefaleia + papiledema clínico.
  Trauma cranioencefálico grave.
  ⚠️ R6 se DBNO >6,0 mm em paciente sintomático: "Suspeita de hipertensão intracraniana —
  avaliação neurológica urgente."

CLASSIFICAÇÃO N0–N4 EXPANDIDA:
N0 — VPS, VDF e IR de AO, ACR, ACP dentro dos limites normais. VOS anterógrada.
  DBNO ≤5,0 mm se avaliado.
  Conclusão: "Estudo Doppler das artérias oftálmicas sem alterações hemodinâmicas."

N1 — IR discretamente elevado em ACR ou ACP. VPS reduzida em AO unilateral.
  Correlação assimétrica leve.
  Conclusão: "Leve assimetria de perfusão orbital [direita/esquerda]. Sem critério
  diagnóstico definido isoladamente — correlação oftalmológica recomendada."

N2 — IR elevado bilateral (>0,80 na AO ou >0,75 na ACR). Redução de VDF significativa.
     Sinal do halo positivo isolado (sem perda visual).
  Conclusão: "Hipoperfusão orbitária bilateral com IR elevado. Suspeita de arterite de
  células gigantes / glaucoma de tensão normal. Correlação clínica urgente."
  Conduta: VHS, PCR, biópsia temporal se ACG suspeita.

N3 — Fluxo ACR reduzido sem ausência total. DBNO >5,7 mm.
     Roubo oftálmico ipsilateral por estenose grave de ACI.
  Conclusão: "Hipoperfusão significativa [ACR / AO] com suspeita de [causa]."
  Conduta: encaminhamento urgente (oftalmologia / neurologia).

N4 — Ausência de fluxo em ACR (OACR) / Inversão de VOS (FCC).
     DBNO >6,0 mm com sintomas de PIC elevada. AION arterítica suspeita.
  ⚠️ ATIVAR R6.

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia oftálmica requer técnica de alta frequência com probe linear e pressão
mínima sobre o globo ocular (evitar compressão que altera o fluxo). A ACR e ACP têm
calibres pequenos (0,5–1 mm) e VPS baixas (10–20 cm/s): requerem PRF baixo e ganho
máximo de cor. Variabilidade intraobservador é significativa nos vasos menores. A ausência
de fluxo na ACR é diagnóstico presuntivo de OACR, mas deve ser confirmada com FFA/OCT
oftalmológico. O Doppler oftálmico NÃO avalia o parênquima retiniano — é um método
hemodinâmico funcional, não morfológico. Em glaucoma, achados isolados de IR/VDF não
são diagnósticos sem correlação com tonometria, perimetria e OCT. A medida da bainha
do nervo óptico tem curva de aprendizado e deve ser realizada com o paciente em repouso,
em decúbito dorsal, sem compressão sobre o globo.`,

// ─────────────────────────────────────────────────────────────────────────────
// C5 — DOPPLER DE CARÓTIDAS E VERTEBRAIS
// ─────────────────────────────────────────────────────────────────────────────
'8sbK1BuPuPy8xzAm9DNz': `

6. CARACTERIZAÇÃO DE PLACAS ATEROSCLERÓTICAS
═══════════════════════════════════════════════════════════════════
A caracterização da placa é tão importante quanto a estenose para risco de AVC.

COMPOSIÇÃO DA PLACA (B-mode):
  Placa Homogênea Ecogênica (tipo I): calcificada, dura — baixo risco de embolização.
  Placa Homogênea Hipoecoica (tipo II): fibrosa — risco intermediário.
  Placa Heterogênea com componente hipoecoico (tipo III): lipídica/necrótica — ALTO RISCO.
  Placa Heterogênea com calcificação + componente mole (tipo IV): complexa — alto risco.
  CRITÉRIO DE PLACA VULNERÁVEL: componente hipoecoico >40% da área transversal da placa.

MORFOLOGIA DE SUPERFÍCIE:
  Regular: superfície lisa — placa estável.
  Irregular: superfície irregular — maior risco de embolização.
  Ulcerada: nicho ou crater na superfície da placa — ALTO RISCO.
  Capa fibrosa delgada: <1 mm com núcleo lipídico vísivel — síndrome coronariana aguda/AVC.

ECOLUCÊNCIA:
  Placa ecolucente (hipoecoica): 3× maior risco de AVC vs. placa ecogênica mesmo com mesmo
  grau de estenose.
  Critério GSM (Grey Scale Median): GSM <25 = placa vulnerável.

HEMORRAGIA INTRAPLACA:
  Sinal US: focos hiperecoicos espessos dentro de placa heterogênea.
  RM é mais sensível para hemorragia intraplaca.

RELATO OBRIGATÓRIO DA PLACA:
  "Placa [localização: ACI proximal/bifurcação/ACC] [lado], [espessura máxima] mm,
  [composição: ecogênica/hipoecoica/heterogênea], superfície [regular/irregular/ulcerada],
  [presença/ausência de capa fibrosa delgada visível]."

7. ESTRATIFICAÇÃO DE RISCO AVC POR PLACA
═══════════════════════════════════════════════════════════════════
Risco de AVC ipsilateral ao longo de 5 anos correlaciona com:
  Grau de estenose (NASCET): >70% = 26% risco AVC em 2 anos sem endarterectomia.
  Morfologia da placa: placa vulnerável aumenta risco independentemente da estenose.
  Sintomático vs. assintomático: AIT ou AVC ipsilateral prévio = alto risco.

ESTENOSE NASCET 50–69% SINTOMÁTICA:
  Benefício marginal de endarterectomia (NNT 15 para prevenir AVC em 5 anos).
  Placa vulnerável + sintomático → considerar endarterectomia.

ESTENOSE NASCET ≥70% SINTOMÁTICA:
  Benefício claro de endarterectomia (NNT 6) → encaminhar urgente para cirurgia vascular.

ESTENOSE ASSINTOMÁTICA ≥60%:
  Benefício menor mas presente (NNT 20 em 5 anos).
  Decisão individualizada: placa vulnerável, progressão rápida, contralateral ocluída.

8. ARTÉRIAS VERTEBRAIS — PROTOCOLO EXPANDIDO
═══════════════════════════════════════════════════════════════════
AVALIAÇÃO OBRIGATÓRIA BILATERAL:
  V1 (pré-foraminal): origem na subclávia até entrada no forame C6.
  V2 (foraminal/transversária): segmento mais fácil — entre C6 e C2.
  V3 (atlantoaxial): raramente visível; entre C2 e forame magno.

PARÂMETROS NORMAIS:
  VPS: 20–60 cm/s (variável entre lados — assimetria até 30% é normal).
  IR: 0,50–0,75.
  Fluxo: anterógrado bilateral (crânio-cefálico).
  Dominância vertebral: 75% têm uma vertebral dominante (frequentemente esquerda).
  Hipoplasia vertebral: diâmetro <2 mm + VPS <20 cm/s = hipoplasia (pode ser normal).

DOENÇA DAS VERTEBRAIS:
  Estenose V1 (ostial): VPS >120 cm/s na origem (da subclávia) + turbulência.
    Causa: aterosclerose, mais comum na origem.
  Oclusão V1: ausência de fluxo ipsilateral + circulação colateral via V2/V3 retrógrada.
  Dissecção vertebral: padrão espectral alternante, íntima irregular, fluxo turbulento.
    Clínica: dor cervical aguda + síndrome de Wallenberg (vertigem, diplopia, ataxia).
    → ATIVAR R6: "Suspeita de dissecção de artéria vertebral."

SÍNDROME DE ROUBO DA SUBCLÁVIA (revisão):
  Vertebral ipsilateral à subclávia estenótica: fluxo INVERTIDO (retrograde flow).
  Graus de roubo:
    Parcial: fluxo sistólico anterógrado + diastólico invertido (gangorra).
    Completo: inversão total do fluxo vertebral.

9. DISSECÇÃO DE CARÓTIDA INTERNA
═══════════════════════════════════════════════════════════════════
Causa de AVC em jovens (20–50 anos). Espontânea ou pós-trauma cervical.

ACHADOS US:
  Lúmen duplo: flap intimal visível como membrana hipoecoica no lúmen.
  Hematoma de parede: espessamento excêntrico hipoecoico da parede.
  Oclusão: ausência de fluxo + espessamento de parede.
  Dilatação aneurismática distal: dissecção com ponto de entrada e saída = pseudo-aneurisma.
  Fluxo residual de alta resistência: IR >0,80 na ACI ocluída.

DIAGNÓSTICO DEFINITIVO: angio-RM (método de escolha) com fat-sat T1 (hematoma de parede).

→ ATIVAR R6 em dissecção sintomática: "Suspeita de dissecção de ACI com isquemia cerebral
ipsilateral — avaliação vascular/neurológica urgente. Anticoagulação ou antiplaquetário."

10. TUMOR DO CORPO CAROTÍDEO (PARAGANGLIOMA CAROTÍDEO)
═══════════════════════════════════════════════════════════════════
Massa sólida hipervascular na bifurcação carotídea (entre ACI e ACC).
Achados US:
  Massa hipoecoica ou heterogênea "alargando" a bifurcação.
  Hipervascularização intensa ao Color Doppler e PD.
  Ausência de infiltração arterial (tumor encaminha mas não invade).
  Bilateral em 10% dos casos (síndrome familial — mutação SDH).

Não biopsar sem estudo angiográfico: risco de sangramento catastrófico.
Encaminhar para cirurgia vascular / endocrinologia / bioquímica (catecolaminas urinárias).

11. FIBRODISPLASIA MUSCULAR (FMD) DAS CARÓTIDAS
═══════════════════════════════════════════════════════════════════
FMD = doença não-inflamatória, não-aterosclerótica da parede arterial.
Afeta ACI porção média e distal (acima da bifurcação — diferente da aterosclerose).
Mais comum em mulheres jovens.

Achados US:
  Padrão "colar de pérolas": alternância de dilatações e estenoses.
  Localização na ACI porção alta (difícil acesso ao US — Doppler indireto).
  VPS elevada nos segmentos estenóticos.

Limitação: porção distal da ACI é inacessível ao US → Angio-RM ou Angio-TC diagnóstica.

RECOMENDAÇÕES EXPANDIDAS:
  Placa com estenose <50% assintomática: "Fatores de risco cardiovascular (estatina,
  antiagregante se indicado). Repetir em 6–12 meses para avaliação de progressão."
  Placa estenótica 50–69% assintomática: "Avaliação com especialista (neurologia/vascular)
  para individualização (risco cirúrgico vs. benefício da endarterectomia). Angiotomografia."
  Estenose ≥70% assintomática: "Encaminhamento para cirurgia vascular/neurocirurgia para
  avaliação de endarterectomia ou stent carotídeo."
  Estenose ≥50% sintomática (AIT/AVC recente): ATIVAR R6 → "Avaliação neurológica/vascular
  urgente. Endarterectomia ou stent em <2 semanas do evento (máximo benefício)."

OBSERVAÇÕES METODOLÓGICAS:
O Doppler de carótidas e vertebrais é exame altamente operador-dependente, com ICC de
0,70–0,90 para mensuração de velocidades. A tabela ELSA-Brasil para EMI é o padrão de
referência nacional para classificação de risco cardiovascular pela espessura íntima-média.
A janela acústica pode ser limitada em pacientes com pescoço curto, calcificação de placa
extensa ou obesidade. A avaliação da porção distal da ACI (C2) e as artérias vertebrais
V3-V4 são frequentemente inacessíveis. Estenoses de grau intermediário (50–69%) com
calcificação que impossibilite mensuração de velocidades devem ser classificadas por
critérios morfológicos com nota de limitação técnica. A angiotomografia ou angiografia
por RM são mandatórias antes de endarterectomia para confirmação do grau de estenose
e avaliação da anatomia cirúrgica.`,

// ─────────────────────────────────────────────────────────────────────────────
// C6 — DOPPLER VENOSO DE MEMBRO INFERIOR
// ─────────────────────────────────────────────────────────────────────────────
'ajAFJHKswvhrbEvDDM1y': `

5. CLASSIFICAÇÃO CEAP — DETALHADA
═══════════════════════════════════════════════════════════════════
A classificação CEAP (Clínica, Etiologia, Anatomia, Patofisiologia) é obrigatória quando
há suspeita de doença venosa crônica (DVC) e deve ser reportada no laudo.

COMPONENTE C — CLÍNICO (0 a 6):
  C0: Sem sinais visíveis ou palpáveis de DVC.
  C1: Telangiectasias ou veias reticulares (<3 mm). Varizes "aranhas".
  C2: Varizes calibrosas (≥3 mm). Varizes tronculares.
  C2r: Varizes residuais ou recorrentes pós-tratamento.
  C3: Edema de origem venosa (sem alteração cutânea).
  C4a: Pigmentação e/ou eczema venoso.
  C4b: Lipodermatosclerose e/ou atrofia branca.
  C4c: Corona flebectásica paraplantaris.
  C5: Úlcera cicatrizada (fechada).
  C6: Úlcera ativa.
  C6r: Úlcera ativa e recorrente.

MODIFICADORES:
  s (sintomático): dor, peso, prurido.
  a (assintomático): sem queixas apesar dos sinais.

COMPONENTE E — ETIOLOGIA:
  Ec: Congênita.
  Ep: Primária (válvula incompetente sem causa identificada).
  Es: Secundária (pós-trombótica, pós-traumática).
  En: Etiologia não-identificada.

COMPONENTE A — ANATÔMICO (vasos afetados):
  As: Superficial (safenas, tributárias).
  Ap: Perfurante (perfurantes incompetentes).
  Ad: Profundo (femoral, poplítea, ilíaca).
  An: Não-identificado.

COMPONENTE P — PATOFISIOLOGIA:
  Pr: Refluxo.
  Po: Obstrução.
  Pr,o: Refluxo + Obstrução.
  Pn: Não-identificado.

RELATAR NO LAUDO: "CEAP: C[X][s/a], E[p/s/c], A[s/p/d], P[r/o]"
Exemplo: "Insuficiência venosa crônica com CEAP C4a,s, Ep, As, Pr."

6. REFLUXO VENOSO — METODOLOGIA E GRADAÇÃO
═══════════════════════════════════════════════════════════════════
DEFINIÇÃO DE REFLUXO SIGNIFICATIVO:
  Veias superficiais (GSV, SSV): refluxo ≥0,5 s (0,5 s = 500 ms ao espectral).
  Veias profundas (femoral, poplítea): refluxo ≥1,0 s.
  Perfurantes: refluxo ≥0,35 s com diâmetro ≥3,5 mm.

MANOBRAS DE PROVOCAÇÃO:
  Compressão/descompressão: compressão manual da panturrilha + liberação brusca.
    → Refluxo = fluxo retrógrado após liberação (medido em segundos).
  Manobra de Valsalva: aplicada na junção safeno-femoral (JSF).
    → Refluxo = fluxo retrógrado durante o esforço (>0,5 s = insuficiência da JSF).

JUNÇÃO SAFENO-FEMORAL (JSF):
  Normal: sem refluxo ou refluxo <0,5 s.
  JSF incompetente: refluxo ≥0,5 s → insuficiência do ostium da grande safena.
  Calibre da GSV na coxa: medir diâmetro em supino e ortostatismo (aumenta ~30% em pé).
  GSV ≥4 mm (ortostatismo) = boa candidata para ablação (EVLA/RF) ou flebectomia.

JUNÇÃO SAFENO-POPLÍTEA (JSP):
  Local: prega poplítea; localização variável (pode ser alta, na coxa).
  JSP incompetente: refluxo ≥0,5 s → insuficiência do ostium da pequena safena.
  Medir altura da JSP: cm abaixo da prega poplítea (importante para planejamento cirúrgico).

SISTEMA PROFUNDO:
  Veia femoral comum: refluxo >1,0 s = insuficiência do sistema profundo.
  Veia poplítea: refluxo >1,0 s ao Valsalva ou compressão de panturrilha.
  Insuficiência venosa profunda primária: rara; frequentemente pós-trombótica.

7. MAPEAMENTO PRÉ-ABLAÇÃO (EVLA / TERMOABLAÇÃO / ESCLEROTERAPIA)
═══════════════════════════════════════════════════════════════════
Para candidatos a ablação da grande ou pequena safena (laser, radiofrequência, foam):

GRANDE SAFENA (GSV — Ablação por EVLA/RF):
  Trajetória: mapear do maléolo medial até a JSF.
  Medidas obrigatórias:
    Diâmetro da GSV na coxa (3, 10, 20 cm abaixo da JSF).
    Distância JSF → pele (profundidade de trabalho do laser).
    Profundidade da GSV sob a pele (deve ser >1 cm para evitar lesão térmica cutânea).
  Varizes tributárias: localizar e dimensionar as maiores (para flebectomia concomitante).

PEQUENA SAFENA (SSV — Ablação):
  Trajetória: maléolo lateral até JSP.
  Medidas: diâmetro da SSV (5, 10 cm abaixo da JSP).
  Localização da JSP: coordenadas anatômicas precisas (fundamental para cirurgia).

PERFURANTES INCOMPETENTES:
  Medir diâmetro (≥3,5 mm = significativo).
  Profundidade abaixo da pele.
  Localização: cm acima do maléolo (numeração convencional: Cockett 1, 2, 3; perfurantes
  de Boyd, Hunterian, Dodd).

8. SÍNDROME DE MAY-THURNER (COMPRESSÃO ILÍACA)
═══════════════════════════════════════════════════════════════════
Compressão da veia ilíaca esquerda pela artéria ilíaca direita contra o promontório
da 5ª vértebra lombar.
Prevalência: presente em 20–30% da população; sintomática em 2–5%.
Causa: TVP ilíaca esquerda em jovens sem fator de risco convencional; edema unilateral.

ACHADOS US:
  Redução de calibre da veia ilíaca comum esquerda na junção com a VCI (compressão externa).
  Ausência de preenchimento ao Color Doppler no ponto de compressão.
  Fluxo venoso aumentado lateralmente (colateral).
  Continuidade normal distal e proximal.
  Assimetria de calibre iliofemoral esquerda vs. direita.

LIMITAÇÃO DA US:
  Segmento ilíaco profundo frequentemente INACESSÍVEL ao US convencional.
  Diagnóstico definitivo: venografia ou angiotomografia venosa.
  → "Suspeita de síndrome de May-Thurner. Complementar com angiotomografia venosa de
  bacia para avaliação do segmento ilíaco."

CONDUTA: stent ilíaco venoso (alta eficácia em sintomáticos com obstrução >50%).

9. TVP — GRADUAÇÃO E EVOLUÇÃO
═══════════════════════════════════════════════════════════════════
TVP AGUDA (0–14 dias):
  Trombo anecóico ou hipoecóico (recente = anecóico).
  Veia distendida, não-compressível.
  Sem colateral venosa desenvolvida.
  Ausência de fluxo ao Color Doppler.

TVP SUBAGUDA (2–4 semanas):
  Trombo com ecogenicidade heterogênea (organização fibrosa parcial).
  Veia ainda distendida mas parcialmente compressível às margens.
  Início de recanalização (fluxo residual ao redor do trombo).

TVP CRÔNICA / SEQUELA PÓS-TROMBÓTICA:
  Trombo organizado (hiperecoico), aderido à parede.
  Redução do calibre venoso (fibrose e retração).
  Colaterais venosas desenvolvidas.
  Válvulas fixas (espessadas, refluxo bilateral por destruição valvar).
  Síndrome Pós-Trombótica (SPT): sequela em 30–50% dos pacientes com TVP proximal.

PHLEGMASIA CERULEA DOLENS:
  Trombose venosa maciça de todo o sistema venoso profundo do membro → isquemia venosa.
  Clínica: edema violáceo maciço + dor intensa + cianose.
  US: ausência completa de fluxo venoso profundo bilateral (a partir do tornozelo).
  ⚠️ R6: "Phlegmasia cerulea dolens. Avaliação vascular urgente para trombólise ou
  trombectomia cirúrgica. Risco de gangrena venosa."

10. TROMBOSE DE VEIAS MUSCULARES DA PANTURRILHA
═══════════════════════════════════════════════════════════════════
Veias musculares (sóleas e gastrocnêmias) — distais ao nível da veia poplítea.
TVP distal = trombose isolada de veias da panturrilha.
Prevalência: 15–30% de todas as TVP.

AVALIAÇÃO:
  Veia sólea: par de veias intramusculares no músculo sóleo — avaliação com transdutor linear.
  Veia gastrocnêmica: medial e lateral — posterior da panturrilha.

CONDUTA EM TVPP DISTAL ISOLADA:
  Sem fator de risco de extensão proximal: controle US em 7–10 dias (10–15% propagam proximalmente).
  Com extensão ≥poplítea: anticoagulação formal.
  Bilateral ou extensão ao nível poplíteo: anticoagulação obrigatória.

RECOMENDAÇÕES CONSOLIDADAS:
  TVP proximal (femoral, poplítea, ilíaca): ATIVAR R6 quando nova → "Anticoagulação sistêmica
  urgente (NOAC ou HBPM). Avaliação para filtro de VCI se contraindicação."
  Phlegmasia: R6 emergencial.
  May-Thurner: "Complementar com angiotomografia venosa. Cirurgia vascular para stent ilíaco."
  Insuficiência venosa CEAP C4–C6: "Encaminhamento para cirurgia vascular para ablação
  (EVLA/RF) ou flebectomia. Tratamento de ferida/úlcera venosa com bota de Unna."
  TVP distal isolada: "Controle US em 7–10 dias para avaliação de extensão proximal."

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia venosa com compressão é o método padrão para diagnóstico de TVP com
sensibilidade >95% e especificidade >98% para TVP proximal (femoral e poplítea). A
sensibilidade é menor para TVP distal isolada (70–75% para veias sóleas e gastrocnêmias)
e para TVP ilíaca (acesso limitado pelo retroperitônio). A compressão deve ser aplicada
a cada 2–3 cm ao longo do trajeto venoso para não perder trombos segmentares. Trombos
recentes podem ser anecóicos e INVISÍVEIS em B-mode — a incompressibilidade é o critério
diagnóstico primário, não a visualização direta do trombo. O refluxo venoso em manobras
de compressão/Valsalva deve ser avaliado em ortostatismo (posição ereta) para maximizar
a detecção de insuficiência valvar — em decúbito a sensibilidade cai significativamente.
Pacientes anticoagulados: a US pode mostrar recanalização progressiva ao longo de semanas
sem necessidade de interromper anticoagulação.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PHASE 2 OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

const phase2 = [];
for (const [id, expansion] of Object.entries(expansions)) {
  const tmpl = existing.find(t => t.id === id);
  if (!tmpl) { console.error('NOT FOUND:', id); continue; }
  phase2.push({ id, aiInstructions: tmpl.aiInstructions + expansion });
}

writeFileSync('scripts/phase2-templates.json', JSON.stringify(phase2, null, 2), 'utf8');

console.log('Phase 2 templates generated:');
for (const t of phase2) {
  const ai = t.aiInstructions || '';
  console.log(`  [${t.id}]  ${ai.length} chars`);
}
console.log('\nOutput: scripts/phase2-templates.json');
console.log('Total:', phase2.length, 'templates');
