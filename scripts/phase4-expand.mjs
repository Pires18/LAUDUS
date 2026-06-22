/**
 * Phase 4 — Expand E1–E4 aiInstructions to 14k+ chars each
 */
import { readFileSync, writeFileSync } from 'fs';

const templates = JSON.parse(readFileSync('scripts/phase4-templates.json', 'utf8'));

// ─── E1 — LINFONODOS AXILARES expand ───────────────────────────────────────
const e1 = templates.find(t => t.id === 'mastologia-linfonodos-axilares');
e1.aiInstructions += `

10. TÉCNICA DE PAAF US-GUIADA DO LINFONODO AXILAR
───────────────────────────────────────────────────────────────
INDICAÇÕES:
  Linfonodo BN4–BN5 em contexto de nódulo mamário BI-RADS 4–5.
  Estadiamento pré-operatório em câncer de mama confirmado.
  Suspeita de linfoma em linfonodo com padrão pseudo-renal.
  Recidiva axilar após tratamento.

TÉCNICA:
  Agulha 22–25G (citologia) ou 18G (core biopsy para histologia).
  Abordagem: lateral (eixo curto) ou "freehand" paralela.
  Anestesia: lidocaína 1% SC + IM no trajeto.
  Alvo: região cortical espessada (maior rendimento diagnóstico).
  Aspirar: 3–4 passes, movimento de "vaivém" dentro do córtex.
  Sempre documentar posição da agulha na imagem armazenada.
  Pós-PAAF: compressão manual 2 min + gelo 15 min.

RENDIMENTO:
  PAAF: sensibilidade 85–90%, especificidade 98–100%, VPP 99%.
  Core biopsy: preferível para linfoma (requer arquitetura tecidual para imunofenotipagem).
  Celularidade insuficiente: repetir com core biopsy ou referenciar para biopsia cirúrgica.

CONTRAINDICAÇÕES:
  Anticoagulação não suspensa (relativa).
  Acesso inadequado por posição anatômica.
  Discrasias plaquetárias (<50.000/mm³).

11. AVALIAÇÃO PÓS-QUIMIOTERAPIA E PÓS-RADIOTERAPIA
───────────────────────────────────────────────────────────────
ALTERAÇÕES ESPERADAS PÓS-QUIMIO:
  Redução do tamanho e espessura cortical dos linfonodos previamente suspeitos.
  Retorno do hilo gorduroso central.
  Redução ou normalização do PD.
  Resposta completa: linfonodo <1 cm, córtex <3 mm, hilo preservado.

ALTERAÇÕES PÓS-RADIOTERAPIA (AXILA IRRADIADA):
  Fibrose: linfonodo com hiperecogenicidade e bordas irregulares.
  Linfedema: edema dérmico difuso, espessamento cutâneo >2 mm.
  Linfocele: coleção anecóica encapsulada na axila — tratar por aspiração se volumosa.

CONTROLE APÓS NEOADJUVÂNCIA:
  Comparar sistematicamente com exame pré-tratamento.
  Documentar: número de linfonodos suspeitos antes vs. após, calibre do córtex, PD.
  Linfonodo com clip metálico: localizar o clip e avaliar resposta desse linfonodo específico.

12. VARIANTES NORMAIS E DIAGNÓSTICOS DIFERENCIAIS ESPECIAIS
───────────────────────────────────────────────────────────────
LINFONODO INTRAMÁRICO (INTRA-MAMÁRIO):
  Localização: parênquima mamário, usualmente quadrante superolateral.
  Normal: oval, <10 mm, córtex fino, hilo central preservado.
  Frequentemente diagnosticado como "nódulo mamário" pelo examinador inexperiente.
  Diferencial com nódulo fibroadenomatoso: hilo gorduroso e forma oval identificam o linfonodo.
  Em contexto oncológico: biopsia se atípico (perda do hilo, espessamento cortical).

LINFONODO MAMÁRIO BILATERAL — CAUSAS DE ESPESSAMENTO CORTICAL REATIVO:
  Vacina contra COVID-19 (mRNA): espessamento bilateral, mais intenso no lado vacinado.
  Herpes zoster torácico: linfadenopatia ipsilateral intensa e dolorosa.
  Lúpus eritematoso sistêmico: adenopatia difusa bilateral.
  Sarcoidose: bilateral, simétrica, com espessamento ≤1 cm sem aspecto substituído.
  Doença de Castleman: rara; linfonodo grande, bilateral, hipervascular.
    → Diagnóstico diferencial com linfoma — biópsia cirúrgica.

SILICONE E PRÓTESES MAMÁRIAS:
  Implante intacto: sinal "snowstorm" no implante.
  Rotura extracapsular: silicone nos linfonodos axilares!
    → Sialoma de silicone: linfonodo com depósito hiperecoico de silicone.
    Diagnóstico diferencial com metástase em linfonodo hiperecóico.
  → RM mamária confirma rotura; biópsia do linfonodo não necessária se contexto típico.

13. INTEGRAÇÃO CLÍNICA — WHEN TO BIOPSY DECISION GUIDE
───────────────────────────────────────────────────────────────
BIOPSIA IMEDIATA (PAAF/CORE):
  Qualquer linfonodo BN4–BN5 ipsilateral a nódulo BI-RADS ≥4b.
  Córtex >10 mm focal em qualquer contexto.
  Hilo ausente unilateral sem contexto explicativo.
  Suspeita de linfoma (bilateral, pseudo-renal, hipovascular).

CONTROLE EM 6 SEMANAS (WATCHFUL WAITING):
  Espessamento cortical 3–5 mm bilateral simétrico pós-vacinação mRNA (<6 semanas).
  Adenite reativa em contexto de infecção ativa ipsilateral (mastite, herpes).
  Linfonodo BN2 sem nódulo mamário ipsilateral suspeito.

CONTROLE ANUAL (SEGUIMENTO HABITUAL):
  BN1 em qualquer contexto.
  BN2 sem contexto oncológico.
  Linfonodo intramárico com morfologia benigna.`;

// ─── E2 — AORTA TORÁCICA expand ─────────────────────────────────────────────
const e2 = templates.find(t => t.id === 'vascular-aorta-toracica');
e2.aiInstructions += `

9. SÍNDROMES GENÉTICAS ASSOCIADAS A DOENÇAS DA AORTA TORÁCICA
───────────────────────────────────────────────────────────────
SÍNDROME DE MARFAN (FBN1):
  Dilatação da raiz aórtica (seios de Valsalva): >4 cm em adulto = intervenção eletiva.
  Índice aórtico: raiz/BSA >2,1 cm/m² = dilatação significativa.
  Aorta "em tulipa" (raiz > ascendente): padrão característico.
  Dissecção ocorre em raizes <5 cm (limiar inferior ao comparado com bicúspide/aterosclerose).
  Rastreio: TC/RM anual. Betabloqueador + losartana para retardar progressão.
  Contraindicação: esporte competitivo, levantamento de peso.

VALVA AÓRTICA BICÚSPIDE (VAB — 1–2% da população):
  Principal causa de aneurisma da aorta ascendente em jovens.
  Dilatação da aorta ascendente em 50% dos portadores de VAB.
  Limiar de intervenção mais baixo: ≥5,0 cm (ou ≥4,5 cm com FR adicional).
  Rastreio familiar: 1° grau de portador de VAB → ecocardiograma.
  US limitado para raiz e porção proximal ascendente — TC/RM preferível para medida seriada.

SÍNDROME DE LOEYS-DIETZ (TGFBR1/2):
  Dilatação da raiz aórtica + artérias tortuosas + úvula bífida + hipertelorismo.
  Dissecção ocorre com diâmetros menores que em Marfan.
  Limiar cirúrgico mais precoce: ≥4,0–4,2 cm (conforme fenótipo).
  → TC/RM semestral; referência a centro especializado em aortopatias genéticas.

SÍNDROME DE TURNER (45,X):
  Coarctação em 10–15% + VAB em 30–40% + dilatação aórtica.
  Risco de rotura mesmo com diâmetros "normais" — monitoramento rigoroso toda a vida.

10. PLANEJAMENTO DE INTERVENÇÃO — TEVAR vs. CIRURGIA ABERTA
───────────────────────────────────────────────────────────────
TEVAR (Endovascular Thoracic Aortic Repair):
  Indicado para: aneurisma ou pseudo-aneurisma da aorta descendente ≥5,5 cm.
  Contraindicação relativa: zona de ancoragem inadequada (<20 mm), angulação do colo >60°.
  Angio-TC com reconstrução 3D é mandatória para planejamento pré-TEVAR.
  US: orienta vigilância mas não substitui a Angio-TC.

CIRURGIA ABERTA (Bentall, David, Tirone):
  Indicado para: aneurisma da raiz aórtica, aorta ascendente, arco aórtico.
  Procedimento de Bentall: substituição da raiz + valva + implantação dos coronários.
  Procedimento de David (poupadora de valva): reimplantação da valva nativa.
  Pós-operatório: monitoramento anual por TC da aorta residual.

11. PROTOCOLO DE RASTREIO POR POPULAÇÃO
───────────────────────────────────────────────────────────────
RASTREIO POPULACIONAL (AORTA ABDOMINAL):
  AAA: US único para homens fumantes 65–74 anos (USPSTF Grade B).
  Extensão torácica: apenas se aorta abdominal dilatada ou doença bicúspide conhecida.

RASTREIO EM POPULAÇÕES DE RISCO:
  VAB conhecida: TC/RM inicial; seguimento semestral se aorta ascendente 4–5 cm.
  Marfan / Loeys-Dietz: TC/RM ao diagnóstico + semestral.
  Familiar 1° grau de aneurisma torácico: TC/RM once (rastreio único, ao diagnóstico).
  Dissecção prévia tipo B: TC/RM semestral (controle da falsa luz residual).

12. RELATÓRIO — CHECKLIST PARA AORTA TORÁCICA
───────────────────────────────────────────────────────────────
Todo laudo de aorta torácica deve incluir:
  □ Segmentos avaliados e janelas utilizadas.
  □ Diâmetro de cada segmento (raiz, ascendente, arco, descendente) — mm.
  □ Trombo mural: ausente / presente (extensão em cm).
  □ Calcificações: ausentes / presentes (localização).
  □ Achados ao Doppler (velocidade pico, padrão espectral).
  □ Comparação com exame prévio (se disponível).
  □ Classificação N0–N4 com recomendação explícita.
  □ Limitações técnicas (janela, segmentos não avaliados).

13. ANGIOMA DE PAREDE E PSEUDO-ANEURISMA
───────────────────────────────────────────────────────────────
PSEUDO-ANEURISMA (FALSO ANEURISMA):
  Saculação aórtica sem camadas da parede verdadeira (contida por trombo e adventícia).
  Causas: trauma torácico (desaceleração), cirurgia prévia, infecção (aneurisma micótico).
  Ruptura iminente: qualquer tamanho.
  → ATIVAR R6 se pseudo-aneurisma identificado.

ANEURISMA MICÓTICO:
  Saculação focal excêntrica em aorta ateromatosa.
  Contexto: sepse, endocardite, infecção por Salmonella.
  Paredes irregulares, tecido peri-aórtico aumentado, gás (raro).
  → R6: avaliação cirúrgica de urgência + hemoculturas.`;

// ─── E3 — ESCLEROTERAPIA expand ─────────────────────────────────────────────
const e3 = templates.find(t => t.id === 'procedimentos-escleroterapia');
e3.aiInstructions += `

7. MAPEAMENTO PRÉ-PROCEDIMENTO — VARIZES (DUPLEX MAPPING)
───────────────────────────────────────────────────────────────
PROTOCOLO DE MAPEAMENTO COMPLETO (PRÉ-ESCLEROTERAPIA):
  Paciente em ortostatismo (posição OBRIGATÓRIA para avaliação de refluxo).
  Probe linear 7–15 MHz, Color Doppler + compressão manual.

A. SISTEMA SAFENO MAGNO (GSV):
  1. Avaliar junção safenofemoral (JSF): competente / incompetente.
     Incompetente = refluxo >0,5 s ao Valsalva ou descompressão da panturrilha.
  2. Calibre GSV ao longo do trajeto: segmentar em terços (proximal/médio/distal).
  3. Tributárias: identificar nome, posição e calibre.
  4. Veia de Giacomini (comunicante GVM-GSV): avaliar se presente.

B. SISTEMA SAFENO PARVO (SSV):
  1. Junção safenopoplítea (JSP): competente / incompetente.
  2. Calibre SSV e extensão.
  3. Extensão cranial (veia de Giacomini ou extensão de Krissof): identificar.

C. VEIAS PERFURANTES INCOMPETENTES:
  Critério: calibre >3,5 mm ao ortostatismo + refluxo >0,5 s ao Valsalva.
  Localização: face medial da perna (perfurante de Cockett I, II, III) / coxa.
  Mapear número, posição e calibre.
  Tratamento: escleroterapia ecoguiada de perfurante (USEP) ou TIPP.

D. SISTEMA VENOSO PROFUNDO:
  Confirmar PERMEABILIDADE antes da escleroterapia.
  Compressibilidade total das veias femoral, poplítea e tibiais.
  Ausência de sinais de TVP prévia (paredes espessadas, valvas destruídas).
  TVP prévia com sequela = contraindicação relativa (avaliar circulação de retorno residual).

E. MAPA GRÁFICO:
  Desenhar (ou descrever) o mapa venoso em formulário padrão.
  Indicar segmentos a tratar e pontos de injeção previstos.
  Documentar segmentos comunicantes com sistema profundo (risco de escape da espuma).

8. PROTOCOLOS POR PATOLOGIA
───────────────────────────────────────────────────────────────
8.1 VARIZES DE TRONCO GSV/SSV (>5 mm):
  Preferência: ablação térmica (EVLA 1470 nm ou RF) + escleroterapia de tributárias.
  Escleroterapia como monoterapia: se paciente recusa cirurgia, ou tronco <8 mm.
  Sessão única: múltiplos pontos ao longo do tronco (cada 10–15 cm).
  Compressão: meia elástica classe 2 por 2–3 semanas contínuas.

8.2 TRIBUTÁRIAS E VARIZES RESIDUAIS (2–5 mm):
  Escleroterapia ecoguiada com espuma 0,5–1% polidocanol.
  Volume por segmento: 0,5–2 mL; máximo 6 mL por sessão.
  Protocolo: 2–4 sessões com intervalo de 4–6 semanas.

8.3 TELANGIECTASIAS E VEIAS RETICULARES (<2 mm):
  Escleroterapia líquida (não-espuma): polidocanol 0,25–0,5%.
  Agulha 30G; seringa 2 mL.
  Volume: 0,1–0,3 mL por ponto.
  Complemento com laser cutâneo (Nd:YAG 1064 nm) para telangiectasias <0,5 mm.

8.4 MALFORMAÇÃO VENOSA (MV) — ESCLEROTERAPIA PERCUTÂNEA:
  Agente: polidocanol 3% espuma ou etanol absoluto (apenas centro especializado).
  Confirmar extensão ao US/RM previamente.
  Injeção direta na MV + colocação de tourniquet proximal se em extremidade.
  Monitoramento com PD durante injeção (espuma hiperecoica).
  Sessões: 2–5 (para MV volumosas).
  Risco de necrose: etanol + extravascular. Usar polidocanol se sem treinamento especializado.

9. CONTROLE PÓS-PROCEDIMENTO — PROTOCOLO DE SEGUIMENTO
───────────────────────────────────────────────────────────────
1ª SEMANA:
  Meia de compressão classe II contínua.
  Deambulação imediata (30 min/dia, evitar ortostatismo prolongado).
  Evitar: banho quente, sauna, exercício intenso, exposição solar.
  Retornar se: dor intensa, edema crescente, febre, bolhas ou necrose.

4–6 SEMANAS (CONTROLE):
  US duplex para verificar:
    Oclusão do vaso tratado (ausência de fluxo ao PD — sucesso técnico).
    Ausência de TVP (comprimir todo o trajeto do sistema profundo).
    Flebite química residual (câncela palpável = trombo organizado).
  Drenagem de trombo residual se câncela dolorosa: puntuar com agulha 18G + espremer.

3 MESES (RESULTADO ESTÉTICO/FUNCIONAL):
  Avaliar resolução das varizes clinicamente + CEAP pós-tratamento.
  Se vaso persistente: nova sessão de escleroterapia.
  Hiperpigmentação: persistente em 10–30% dos casos; pode demorar 1 ano para clarear.

1 ANO (RECORRÊNCIA):
  Mapear sistema venoso novamente.
  Recorrência por neovascularização na JSF (reparo da safenofemoral sem ligadura alta):
  → Tratar tributárias recorrentes com nova sessão de escleroterapia.

10. DOCUMENTAÇÃO DO PROCEDIMENTO
───────────────────────────────────────────────────────────────
O laudo de escleroterapia ecoguiada deve conter:
  □ Data e horário do procedimento.
  □ Indicação clínica + diagnóstico pré-procedimento.
  □ Agente esclerosante: nome, concentração, volume total utilizado.
  □ Técnica: espuma (Tessari / DSS) ou líquido; proporção esclerosante:ar.
  □ Número e localização dos pontos de injeção.
  □ Distribuição do agente ao US (completa / parcial / com extravasamento).
  □ Intercorrências imediatas (nenhuma / descrever).
  □ Plano de seguimento.
  □ Profissional responsável (nome + CRM).
  □ Imagens US armazenadas do procedimento (posição da agulha + distribuição do agente).`;

// ─── E4 — ESCROTO AGUDO expand ───────────────────────────────────────────────
const e4 = templates.find(t => t.id === 'pediatria-escroto-agudo');
e4.aiInstructions += `

9. NEONATO — TORÇÃO EXTRAVAGINAL E PARTICULARIDADES
───────────────────────────────────────────────────────────────
TORÇÃO EXTRAVAGINAL NEONATAL:
  Ocorre in utero ou perinatal: torção de toda a bolsa escrotal incluindo túnica vaginal.
  Apresentação: testículo não-doloroso, endurecido, escroto de coloração azul/escura.
  US: testículo hiperecoico (necrótico), sem fluxo ao PD, hidrocele reatia.
  Diferencial com torção pós-natal intra-vaginal: história + tempo de apresentação.
  Conduta: exploração cirúrgica para orchiopexia contralateral profilática (alta recorrência).
  Prognóstico: testículo ipsilateral frequentemente inviável (torção in utero = necrose total).

PARTICULARIDADES DO DOPPLER NO NEONATO:
  Artérias testiculares muito calibrosas diminutas (1–2 mm de diâmetro).
  Técnica: PRF mínimo (300–500 Hz), transdutor 15–18 MHz, Power Doppler > Color.
  Fluxo normal pode ser DIFÍCIL de detectar em neonatos saudáveis.
  Falso-negativo é possível mesmo com testículo viável.
  → Correlação clínica é fundamental: aspecto e histórico definem a conduta.

10. AVALIAÇÃO DO TESTÍCULO NÃO-DESCIDO (CRIPTORQUIDIA)
───────────────────────────────────────────────────────────────
INDICAÇÃO: localização do testículo não palpável pré-orquiopexia.
LOCAL: 80% no canal inguinal; 20% intra-abdominal (TC/RM para localização intra-abdominal).

ACHADOS US:
  Testículo ectópico inguinal: oval, menor que o contralateral, hipoecoico.
  Pode estar atrófico (volume <1 mL = hipoplasia grave).
  Fluxo ao PD: pode estar presente mas reduzido.

RISCO DE MALIGNIZAÇÃO:
  Criptorquidia = risco 4–10x maior de tumor germinativo.
  Orquiopexia até 12–18 meses reduz o risco.
  US é limitado para testículo intra-abdominal — RM ou laparoscopia diagnóstica.
  Seguimento: US anual após orquiopexia para monitorar atrofia ou lesão focal.

11. TUMORES TESTICULARES — ACHADOS INCIDENTAIS NO ESCROTO AGUDO
───────────────────────────────────────────────────────────────
ACHADO INCIDENTAL DURANTE INVESTIGAÇÃO DE ESCROTO AGUDO:
  Massa hipoecoica intratesticular com PD interno = suspeita de tumor.
  ⚠️ ATIVAR R6 — encaminhar urgente para urologia pediátrica/oncologia.

TUMORES TESTICULARES EM PEDIATRIA (DIFEREM DO ADULTO):
  Teratoma maduro (pré-púbere): benigno em crianças; massa heterogênea com calcificações.
  Tumor de yolk sac: mais comum em crianças <3 anos. Alfa-fetoproteína elevada.
  Tumor das células de Sertoli: lesão hipoecoica focal, frequentemente benigna, tratamento conservador.
  Hemangioma: raro; vascular ao PD.

MARCADORES TUMORAIS (solicitar sempre que tumor testicular):
  AFP (alfa-fetoproteína): normal varia com idade (elevada até 1 ano de vida).
  Beta-HCG: elevado em germinoma e carcinoma embrionário.
  LDH: marcador de agressividade tumoral.

12. PROTOCOLO DE DOCUMENTAÇÃO — ESCROTO AGUDO
───────────────────────────────────────────────────────────────
Todo laudo de escroto agudo deve conter:
  □ Hora de início dos sintomas (se fornecida pelo clínico).
  □ Dimensões de ambos os testículos (comparativo).
  □ Ecogenicidade de cada testículo (normal/alterada + descrição).
  □ Resultado do Color Doppler E Power Doppler — bilateral.
     → Registrar explicitamente: "fluxo presente" ou "fluxo ausente" em cada testículo.
  □ Epidídimos: dimensões e vascularização.
  □ Apêndices testiculares/epididimários: presentes/suspeitos.
  □ Líquido escrotal: tipo e volume estimado.
  □ Tecidos moles: espessamento ou gás.
  □ Conclusão explícita quanto à perfusão testicular.
  □ Classificação N0–N4 com recomendação de urgência se N3–N4.
  □ Nota metodológica sobre limitações do Doppler em pediatria.

LEGENDA DE URGÊNCIA NA CONCLUSÃO:
  🟢 N0/N1: Escroto agudo sem causa torsional. Seguimento clínico.
  🟡 N2: Causa alternativa provável (EO/torção de apêndice). Urgência relativa.
  🔴 N3/N4: SUSPEITA DE TORÇÃO TESTICULAR OU RUPTURA. R6 — cirurgia imediata.

13. COMUNICAÇÃO DE ACHADOS CRÍTICOS — R6 LANGUAGE
───────────────────────────────────────────────────────────────
⚠️ TORÇÃO TESTICULAR (texto padrão para R6):
"ALERTA CIRÚRGICO — ESCROTO AGUDO: Ausência de fluxo arterial intratesticular
ao Power Doppler no testículo [direito/esquerdo] com fluxo preservado no contralateral,
em contexto de dor escrotal aguda de início [X horas]. Achado altamente sugestivo de
TORÇÃO TESTICULAR. Viabilidade testicular comprometida progressivamente após 6 horas
do início dos sintomas. Exploração cirúrgica de urgência indicada sem demora. O exame
de imagem NÃO deve ser usado para postergar a intervenção cirúrgica quando a suspeita
clínica é elevada."

⚠️ RUPTURA TESTICULAR (texto padrão para R6):
"ALERTA CIRÚRGICO — TRAUMA ESCROTAL: Perda da continuidade da túnica albugínea
no testículo [direito/esquerdo] com heterogeneidade parenquimatosa e hematocele.
Achado sugestivo de RUPTURA TESTICULAR. Orquiorrafia cirúrgica de urgência indicada
— taxa de salvamento testicular >90% se operado em <72 horas."

⚠️ GANGRENA DE FOURNIER (texto padrão para R6):
"ALERTA CIRÚRGICO CRÍTICO — SÍNDROME DE FOURNIER: Gás em tecidos moles
periescrotais / perineais ao estudo ultrassonográfico. Achado compatível com
FASCIITE NECROTIZANTE PERINEAL (Síndrome de Fournier). Avaliação cirúrgica
de emergência imediata. Alta mortalidade sem desbridamento cirúrgico urgente."`;

// ─── Write output ────────────────────────────────────────────────────────────
writeFileSync('scripts/phase4-templates.json', JSON.stringify(templates, null, 2), 'utf8');

console.log('Phase 4 expanded templates:');
for (const t of templates) {
  const ai = (t.aiInstructions || '').length;
  const status = ai >= 14000 ? '✅' : ai >= 11000 ? '⚠️ ' : '❌';
  console.log(`  ${status} [${t.area.padEnd(16)}] ${t.name.padEnd(35)} ${ai} chars`);
}
