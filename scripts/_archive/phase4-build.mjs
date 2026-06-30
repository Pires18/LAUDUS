/**
 * LAUD.IA — Phase 4: 4 New Templates + Camada 2 patch
 * E1: mastologia/LINFONODOS AXILARES
 * E2: vascular/AORTA TORÁCICA (US limitado mas clinicamente relevante)
 * E3: procedimentos/ESCLEROTERAPIA
 * E4: pediatria/ESCROTO AGUDO
 * Camada 2: areaPrompts.ts patch (reumatologico + vascular references)
 */

import { readFileSync, writeFileSync } from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// E1 — LINFONODOS AXILARES (mastologia)
// ─────────────────────────────────────────────────────────────────────────────
const E1 = {
  id: 'mastologia-linfonodos-axilares',
  area: 'mastologia',
  name: 'LINFONODOS AXILARES',
  title: 'ULTRASSONOGRAFIA DOS LINFONODOS AXILARES',
  technique: `<p>Exame realizado com transdutor linear de alta frequência (10–18 MHz). As cadeias linfonodais axilares foram avaliadas sistematicamente nos níveis I (lateral ao músculo peitoral menor), II (posterior ao músculo peitoral menor) e III (medial ao músculo peitoral menor / infraclavicular), bilateralmente. Avaliação complementar da cadeia mamária interna acessível e gânglios intramáricos quando presentes. Modo B-mode e Power Doppler foram aplicados com parâmetros ajustados para avaliação de perfusão linfonodal.</p>`,
  analysisTemplate: `<p><strong>CADEIA AXILAR DIREITA:</strong></p>
<p>Nível I: [descrever linfonodos identificados — dimensões, córtex, hilo].</p>
<p>Nível II: [descrever].</p>
<p>Nível III / Infraclavicular: [descrever].</p>
<p><strong>CADEIA AXILAR ESQUERDA:</strong></p>
<p>Nível I: [descrever].</p>
<p>Nível II: [descrever].</p>
<p>Nível III / Infraclavicular: [descrever].</p>`,
  conclusionTemplate: `<p>Linfonodos axilares bilateralmente de aspecto benigno ao estudo ultrassonográfico (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Seguimento mamário habitual conforme protocolo de rastreamento.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A avaliação US dos linfonodos axilares tem sensibilidade de 50–80% para metástases e é operador-dependente. O estadiamento axilar definitivo em câncer de mama requer biópsia do linfonodo sentinela (BLS) — a US não substitui o procedimento cirúrgico. Linfonodos com córtex >3 mm focalmente ou hilo ausente em contexto oncológico devem ser biopsiados para confirmação histológica antes de decisões terapêuticas. A ecogenicidade e morfologia do linfonodo são afetadas por status imunológico, infecções locais e tratamentos prévios.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DOS LINFONODOS AXILARES
MASTOLOGIA — V1.0 — LAUD.IA
REFERÊNCIAS: ACR BI-RADS · SBM · ACOSOG Z0011 · CBR · ASCO · NCCN
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação ultrassonográfica dos linfonodos axilares para rastreio, estadiamento
e seguimento de patologias mamárias (câncer de mama, linfoma, doenças inflamatórias).
Complementa e integra o laudo de MAMAS ao exame axilar dedicado.
═══════════════════════════════════════════════════════════════

1. ANATOMIA — CLASSIFICAÇÃO DE BERG (NÍVEIS AXILARES)
───────────────────────────────────────────────────────────────
Nível I — Axila Baixa (Lateral ao peitoral menor):
  Linfonodos peitoral anterior (de Rotter), escapular, central inferior.
  Mais acessíveis ao US e mais frequentemente envolvidos em metástases N1.

Nível II — Axila Média (Posterior ao peitoral menor):
  Linfonodos centrais. Envolvimento = N2 (AJCC 7th).
  Parcialmente obscurecidos pelo peitoral menor.

Nível III — Axila Alta / Infraclavicular (Medial ao peitoral menor):
  Linfonodos subclaviculares e infraclaviculares.
  Envolvimento = N3 (AJCC). Pior prognóstico.
  Difícil acesso ao US — avaliação complementar com TC ou PET-CT.

Cadeia Mamária Interna:
  Linfonodos paraesternais (entre as costelas, lateral ao esterno).
  Raramente visualizados ao US. Envolvimento = N3b.
  → TC ou PET-CT para estadiamento dessa cadeia.

Linfonodo Intramárico:
  No interior do parênquima mamário. Pode ser normal (oval, <1 cm, hilo gorduroso).
  Achado ocasional — usualmente benigno se morfologia preservada.
  Em contexto oncológico: biopsiar se suspeito.

2. CRITÉRIOS MORFOLÓGICOS — BENIGNO vs. SUSPEITO
───────────────────────────────────────────────────────────────
LINFONODO BENIGNO / REATIVO:
  Forma: oval ou elipsoide (índice L:T ≥2).
  Córtex: uniforme, <3 mm de espessura.
  Hilo: preservado, hiperecogênico, central.
  Vascularização: hilar (PD no hilo apenas — padrão normal).
  Tamanho: até 20 mm em nível I (fisiológico em axila).

LINFONODO SUSPEITO (qualquer um dos seguintes):
  Córtex focal espessado: >3 mm em qualquer setor (critério mais sensível).
  Córtex globalmente espessado: >3 mm difuso (espessamento concêntrico).
  Hilo ausente ou deslocado para a periferia pelo espessamento cortical.
  Forma arredondada: índice L:T <2 (nodal redondo = alta suspeição).
  Vascularização periférica: PD na periferia (cortical) — padrão suspeito para metástase.
  Vascularização interna caótica: padrão em "caos vascular" — suspeita de linfoma ou metástase.
  Ecogenicidade cortical: heterogênea com áreas hipoecoicas focais.
  Tamanho >20 mm em qualquer nível — especialmente oval mas com alterações corticais.

3. MEDIDAS OBRIGATÓRIAS — CADA LINFONODO SUSPEITO
───────────────────────────────────────────────────────────────
  Eixo maior (L): mm. Eixo menor (T): mm. Relação L:T.
  Espessura máxima do córtex (mm) — localizar no polo de maior espessamento.
  Localização: Nível [I/II/III] [D/E] + posição (superior/médio/inferior do nível).
  Hilo: presente/ausente.
  Padrão PD: hilar / periférico / misto / ausente.

4. CLASSIFICAÇÃO MORFOLÓGICA AXILAR (BI-RADS LINFONODO)
───────────────────────────────────────────────────────────────
Adaptado do BI-RADS para uso clínico em axila oncológica:

  BN1 (Benigno) — Linfonodo normal: oval, córtex <3 mm, hilo preservado.
  BN2 (Provavelmente Benigno) — Espessamento cortical uniforme 3–5 mm; hilo presente.
    Conduta: controle em 6 meses em contexto oncológico.
  BN3 (Indeterminado) — Córtex 5–10 mm difuso; hilo presente mas comprimido.
    Conduta: PAAF US-guiada antes de decisão terapêutica.
  BN4 (Suspeito) — Córtex focal >10 mm; hilo ausente; forma arredondada; PD periférico.
    Conduta: PAAF ou core biopsy US-guiada.
  BN5 (Altamente Suspeito) — Linfonodo substituído (sem hilo, aspecto sólido heterogêneo).
    Conduta: PAAF/biópsia imediata → confirmação histológica.

5. DIAGNÓSTICO DIFERENCIAL — PADRÕES POR PATOLOGIA
───────────────────────────────────────────────────────────────
METÁSTASE DE CÂNCER DE MAMA:
  Cortex focal espessado → global → substituição total do hilo.
  Progressão típica: córtex focal → arredondamento → coalescência.
  PD periférico + perda do hilo = MUITO suspeito.
  Padrão metastático unilateral (ipsilateral à mama com nódulo BI-RADS 4–5).

LINFOMA (Hodgkin ou Não-Hodgkin):
  Forma pseudo-renal (arredondada) com hilo muito comprimido.
  Ecogenicidade homogênea, muito hipoecoica.
  Bilateral e multilateral (cervical + axilar + inguinal).
  PD difuso interno.
  Sugere linfoma: múltiplos linfonodos homogêneos arredondados bilaterais.
  → TC de estadiamento + biópsia para imunofenotipagem.

ADENITE REATIVA (pós-vacina, infecção local):
  Espessamento cortical difuso, simétrico, preservando hilo.
  PD aumentado mas hilar preservado.
  Bilateral geralmente. Transitória. Comum após vacina na mama/braço ipsilateral.
  Contexto vacinação: BNT162b2 (Pfizer), mRNA-1273 (Moderna) — adenopatia axilar em 11%
  (lado da vacinação). Resolução em 4–6 semanas.
  → Não biopsar em contexto de vacinação recente (<6 semanas). Controle US em 6 semanas.

METÁSTASE MELANOMA:
  Linfonodo arredondado com sinal de fusão cortical hiperecoica (foco hiperecoico = depósito
  de melanina). Diferencial importante: pode ser confundido com hilo gorduroso.

SARCOIDOSE AXILAR:
  Múltiplos linfonodos hipoecoicos bilaterais com padrão "em cunha". Contexto: tosse crônica,
  hilar adenopathy, eritema nodoso. → TC tórax + biopsia para granuloma não-caseoso.

6. ESTADIAMENTO AXILAR — INTEGRAÇÃO COM CÂNCER DE MAMA
───────────────────────────────────────────────────────────────
PRÉ-OPERATÓRIO:
  US normal: candidata a biópsia do linfonodo sentinela (BLS).
  US suspeito (BN3–BN5) + PAAF positiva: linfadenectomia axilar (LA).
  US suspeito + PAAF negativa: repetir com core biopsy; considerar BLS se negativa.

ACOSOG Z0011 IMPLICATIONS:
  Câncer invasivo T1-T2, 1–2 linfonodos sentinelas positivos, sem doença residual
  macroscópica: LA pode ser omitida + radioterapia adjuvante (reduz morbimortalidade
  sem comprometer sobrevida).
  US axilar confirma N0 clínico → ALVO para BLS.
  US com suspeição BN4–BN5 → avança para LA diretamente se PAAF+ ou biópsia+.

PÓS-QUIMIOTERAPIA NEOADJUVANTE (resposta axilar):
  Linfonodos suspeitos pré-tratamento: avaliar regressão pós-quimio.
  Resposta patológica completa (pCR) axilar correlaciona com melhora de sobrevida.
  Clip metálico em linfonodo biopsiado antes da quimio: orientar biópsia dirigida pós-tratamento
  (SLNB com clipe — técnica de LN sentinela marcado).

7. PROTOCOLO DE SEGUIMENTO PÓS-MASTECTOMIA / QUADRANTECTOMIA
───────────────────────────────────────────────────────────────
INDICAÇÃO: rastreio de recidiva axilar pós-cirurgia de mama oncológica.
PERIODICIDADE: semestral (anos 1–3) → anual (anos 4–5+).

Achados de recidiva:
  Linfonodo novo ou progressivamente suspeito na axila operada.
  Massa de tecido mole axilar com PD.
  Fistulização ou coleção peri-axilar com debris → suspeita de seroma infectado ou fístula.

SEROMA PÓS-OPERATÓRIO:
  Coleção anecóica/levemente hipoecoica na axila/mama pós-mastectomia.
  Compressível. Sem fluxo ao PD.
  Conduta: aspiração guiada por US se volumoso ou doloroso.

8. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Linfonodos axilares bilateralmente de aspecto benigno.
  Todos: oval, córtex ≤3 mm, hilo preservado, PD hilar.
  Conclusão: "Linfonodos axilares bilateralmente dentro dos padrões morfológicos de
  normalidade ao estudo ultrassonográfico."

N1 — Espessamento cortical difuso 3–5 mm, bilateral, simétrico, hilo preservado.
  Contexto vacinação recente ou infecção local.
  Conclusão: "Linfonodos axilares com espessamento cortical reativo bilateral, compatível
  com adenite reativa / resposta pós-vacinal."
  Conduta: controle em 6 semanas; evitar biópsia se contexto vacinal.

N2 — Espessamento cortical 5–10 mm unilateral. Hilo presente mas comprimido.
  Contexto oncológico sem BI-RADS 4–5 ipsilateral.
  Conclusão: "Linfonodos axilares [direitos/esquerdos] com espessamento cortical moderado —
  avaliação oncológica/linfológica recomendada."
  Conduta: correlação com exame mamário; PAAF US-guiada se suspeita.

N3 — Córtex focal >10 mm / forma arredondada / hilo ausente em 1–2 linfonodos.
  Em contexto de nódulo mamário BI-RADS 4–5 ipsilateral.
  Conclusão: "Linfonodo axilar [nível X] [D/E] com características morfológicas suspeitas
  de comprometimento neoplásico. Biópsia indicada."
  Conduta: PAAF ou core biopsy US-guiada; estadiamento completo se confirmado.

N4 — Múltiplos linfonodos coalescentes / substituição total / massa axilar.
  ⚠️ ATIVAR R6 em contexto de câncer de mama não-tratado + conglomerado axilar volumoso.
  Conclusão: "ALERTA: Conglomerado linfonodal axilar [D/E] com aspecto sugestivo de
  maciço comprometimento neoplásico. Avaliação oncológica urgente."
  Conduta: R6 — estadiamento completo (PET-CT, TC tórax/abdome); biópsia e imunofenotipagem.

9. RECOMENDAÇÕES PADRÃO
───────────────────────────────────────────────────────────────
  Normal (N0): "Linfonodos sem alterações. Seguimento oncológico/mamário habitual."
  Adenite vacinal (N1): "Espessamento cortical reativo pós-vacinal — controle US axilar
  em 6 semanas para confirmação de resolução."
  Suspeito não-oncológico (N2): "Correlação clínica com hematologista/oncologista.
  Avaliação de PAAF se persistência após 6 semanas."
  Suspeito oncológico (N3): "PAAF US-guiada para citologia e imunohistoquímica. Encaminhamento
  mastológico/oncológico para estadiamento e planejamento cirúrgico."
  Conglomerado axilar (N4): ATIVAR R6.

OBSERVAÇÕES METODOLÓGICAS:
A US axilar tem sensibilidade de 50–80% e especificidade de 85–92% para detecção de
metástases axilares em câncer de mama, sendo superior à palpação clínica mas inferior
ao PET-CT. Linfonodos com espessamento cortical focal >3 mm em contexto oncológico têm
VPP de 62–88% para metástase, mas o diagnóstico definitivo exige confirmação histológica.
A vacinação contra COVID-19 (vacinas mRNA) causa adenopatia axilar ipsilateral temporária
em 11–20% das pacientes, que pode persistir até 6–10 semanas — contexto vacinal deve ser
investigado para evitar falsos positivos. A avaliação do Nível III (infraclavicular) e da
cadeia mamária interna é frequentemente limitada pela profundidade e sombra da clavícula
e costelas — TC ou PET-CT é necessária para estadiamento completo. O esvaziamento axilar
(LA) e BLS são procedimentos cirúrgicos não substituíveis pela US — a US orienta a indicação
e planejamento, mas não substitui a avaliação anatomopatológica definitiva.`,
  customForm: '',
  clinicId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// E2 — AORTA TORÁCICA (vascular)
// ─────────────────────────────────────────────────────────────────────────────
const E2 = {
  id: 'vascular-aorta-toracica',
  area: 'vascular',
  name: 'AORTA TORÁCICA',
  title: 'ULTRASSONOGRAFIA DA AORTA TORÁCICA',
  technique: `<p>Exame realizado com transdutor convexo multifrequencial (2–5 MHz). A aorta torácica descendente foi avaliada pela abordagem subcostal/paravertebral esquerda e intercostal posterior (espaços intercostais 8–10 esquerdos), com o paciente em decúbito lateral direito. A aorta ascendente e o arco aórtico foram avaliados pela abordagem supraesternal e paraesternal. Modo B-mode e Doppler colorido e espectral foram aplicados para avaliação morfológica e hemodinâmica.</p>`,
  analysisTemplate: `<p><strong>AORTA ASCENDENTE (abordagem paraesternal):</strong> Diâmetro [X] mm. Parede [regular/irregular]. [Normal/Ectasia/Aneurisma].</p>
<p><strong>AORTA DESCENDENTE TORÁCICA (abordagem subcostal/intercostal):</strong> Diâmetro máximo [X] mm. Trombo mural: [ausente/presente]. Calcificações: [ausentes/presentes].</p>
<p><strong>DOPPLER:</strong> Fluxo [laminar/turbulento]. VPS [X] cm/s. Padrão espectral [normal/alterado].</p>`,
  conclusionTemplate: `<p>Aorta torácica avaliada com diâmetro dentro dos limites normais e sem alterações hemodinâmicas significativas ao estudo ultrassonográfico (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Seguimento cardiovascular habitual conforme avaliação do médico assistente.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A avaliação ultrassonográfica da aorta torácica é tecnicamente limitada pela janela acústica (pulmão aerado, costelas, sombra acústica do arco aórtico). A angiotomografia de aorta torácica (Angio-TC) é o método de referência para diagnóstico definitivo, medida precisa do diâmetro e planejamento cirúrgico/endovascular. A US pode ser usada para rastreio inicial e monitoramento de aneurismas em seguimento. Dissecção de aorta torácica aguda exige Angio-TC de urgência — a US não exclui dissecção.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DA AORTA TORÁCICA
VASCULAR — V1.0 — LAUD.IA
REFERÊNCIAS: SVS/STS · ESC 2014 · AHA/ACC · CBR · SBACV
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação ultrassonográfica da aorta torácica (ascendente, arco e descendente)
para rastreio e monitoramento de aneurisma, dissecção, aterosclerose e dilatação
aórtica em contexto de marfanoides, bicúspide, hipertensão não controlada ou extensão
de aneurisma abdominal. Exame complementar — Angio-TC é o padrão-ouro.
═══════════════════════════════════════════════════════════════

1. JANELAS DE AVALIAÇÃO E LIMITAÇÕES TÉCNICAS
───────────────────────────────────────────────────────────────
AORTA ASCENDENTE:
  Janela paraesternal (probe 2,5–3,5 MHz): avaliação limitada aos primeiros 4–5 cm
  acima da valva aórtica. Janela supraesternal: arco aórtico e porção proximal.
  Limitação: corpo da aorta ascendente parcialmente obscurecido pelo esterno.

ARCO AÓRTICO:
  Janela supraesternal: probe na fossa supraesternal, com inclinação caudal.
  Avaliação dos ramos: tronco braquiocefálico, carótida esquerda, subclávia esquerda.
  Limitação: sombra acústica da tráqueia e arcabouço costal.

AORTA DESCENDENTE TORÁCICA:
  Abordagem posterior: probe na linha paravertebral esquerda, espaços intercostais 8–10.
  Paciente em decúbito lateral direito (afasta o pulmão).
  Melhor segmento acessível: crus diafragmático até o istmo aórtico.
  Abordagem subcostal: prolonga avaliação da aorta abdominal para o tórax.

2. MEDIDAS E NORMALIDADE
───────────────────────────────────────────────────────────────
DIÂMETROS DE REFERÊNCIA (adulto, borda externa a borda externa):
  Raiz aórtica (anel valvar): 22–30 mm (homem); 20–27 mm (mulher).
  Aorta ascendente: 22–36 mm.
  Arco aórtico: 22–36 mm.
  Aorta descendente torácica: 18–28 mm.
  Junção toracoabdominal: 18–26 mm.
  NOTA: Diâmetros aumentam naturalmente com a idade (~1 mm/década após os 40 anos).
  Indexar pelo BSA (área de superfície corporal) em pacientes com biótipo anormal:
  Normal indexado: aorta ascendente <2,1 cm/m²; descendente <1,6 cm/m².

3. ANEURISMA AÓRTICO TORÁCICO — CRITÉRIOS E LIMIARES
───────────────────────────────────────────────────────────────
DEFINIÇÃO:
  Dilatação aórtica >50% do diâmetro esperado para sexo/idade/BSA.
  Limiar prático: >4,0 cm na descendente torácica = aneurisma.

LIMIARES DE INTERVENÇÃO CIRÚRGICA/ENDOVASCULAR (ESC 2014 / SVS):
  Aorta ascendente (sem doença bicúspide): ≥5,5 cm → cirurgia eletiva.
  Aorta ascendente (bicúspide + Marfan): ≥5,0 cm → cirurgia eletiva.
  Aorta ascendente em risco (bicúspide + HF positiva ou coarctação): ≥4,5 cm.
  Aorta descendente torácica: ≥5,5–6,0 cm → TEVAR (endovascular).
  Crescimento ≥0,5 cm/ano: intervenção independente do diâmetro.

VIGILÂNCIA POR TAMANHO (DESCENDENTE):
  <4,0 cm: US ou TC anual.
  4,0–4,9 cm: TC semestral.
  ≥5,0 cm: avaliação cardiovascular urgente; TC trimestral.
  ≥5,5 cm: ⚠️ ATIVAR R6 — "Aneurisma de aorta torácica com indicação cirúrgica."

4. DISSEÇÃO DE AORTA TORÁCICA
───────────────────────────────────────────────────────────────
⚠️ EMERGÊNCIA CARDIOVASCULAR — qualquer suspeita → R6 IMEDIATO.

CLASSIFICAÇÃO DE STANFORD:
  Tipo A: envolve a aorta ascendente → cirurgia de emergência.
  Tipo B: limitada à descendente → tratamento clínico vs. TEVAR.

ACHADOS US NA DISSECÇÃO:
  Flap intimal: membrana hiperecóica linear oscilante dentro do lúmen aórtico.
  Luz verdadeira: maior pulsação sistólica; fluxo de alta velocidade ao Doppler.
  Luz falsa: menor pulsação; fluxo lento ou ausente (pode estar trombosada).
  Alargamento do diâmetro aórtico (hematoma de parede = dissecção).

LIMITAÇÕES DA US NA DISSECÇÃO:
  Aorta ascendente: janela ruim; sensitivity ~60–70% (ecocardiograma TEE = padrão-ouro).
  Descendente torácica: melhor janela pela abordagem posterior; sensibilidade ~80%.
  US NÃO EXCLUI DISSECÇÃO → ANGIO-TC de urgência obrigatória.

⚠️ R6 DISSECÇÃO: "ALERTA CARDIOVASCULAR: Dissecção de aorta torácica [tipo A/B] suspeita.
Avaliação cardiovascular/vascular urgente. Angiotomografia de aorta emergencial indicada.
Controle estrito da PA (alvo <120/80 mmHg; betabloqueador IV se disponível)."

5. SÍNDROME AÓRTICA AGUDA — DIFERENCIAIS
───────────────────────────────────────────────────────────────
HEMATOMA INTRAMURAL (HIM):
  Espessamento hipoecoico concêntrico da parede >7 mm sem flap visível.
  Sem comunicação com a luz verdadeira.
  Mesma urgência clínica da dissecção tipo A.
  Diagnóstico definitivo: TC/RM (US tem sensibilidade limitada).

ÚLCERA ATEROSCLERÓTICA PENETRANTE (UAP):
  Cratera hiperecoica na íntima espessada aterosclerótica.
  Pode coexistir com HIM.
  Risco de ruptura focal.
  → TC contrastada para caracterização.

6. COARCTAÇÃO DE AORTA
───────────────────────────────────────────────────────────────
Estenose focal da aorta, usualmente no istmo (justaductal).
Mais comum em bicúspide e síndrome de Turner.

ACHADOS US:
  Redução do calibre no istmo ao B-mode (supraesternal).
  Aceleração do fluxo ao Doppler: VPS >3 m/s com gradiente diastólico.
  Padrão "dente de serra" na descendente: fluxo contínuo alta velocidade.
  Colaterais intercostais: pulsação intercostal visível ao PD.

Diagnóstico definitivo: Angio-TC ou cateterismo cardíaco.

7. ATEROSCLEROSE AÓRTICA
───────────────────────────────────────────────────────────────
Placas ateroscleróticas na aorta descendente torácica:
  Protruso aterosclerótico (>4 mm): fonte de embolia sistêmica.
  Placa ulcerada: focos hipoecoicos na superfície intimal.
  Placa calcificada: sombra acústica.

Relevância: aorta torácica aterosclerótica = alto risco cardiovascular + fonte de AVCe.
→ Otimizar fatores de risco (estatina, anti-hipertensivo, antiagregante).

8. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Aorta sem dilatação, sem placa significativa, sem flap. Fluxo laminar.
  Conclusão: "Aorta torácica avaliada nos segmentos acessíveis sem alterações
  morfológicas ou hemodinâmicas significativas."

N1 — Aterosclerose leve, placa focal <4 mm, sem aneurisma. Diâmetro normal.
  Conclusão: "Placa aterosclerótica sem repercussão hemodinâmica."
  Conduta: fatores de risco cardiovascular.

N2 — Ectasia aórtica (dilatação <limiar aneurismático). Placa protrusa >4 mm.
     Descendente 3,5–4,0 cm.
  Conclusão: "Ectasia aórtica torácica / Placa protrusa de alto risco embólico."
  Conduta: angiotomografia; cardiologista/vascular.

N3 — Aneurisma 4,0–5,4 cm (descendente). Aneurisma 4,0–5,0 cm (ascendente).
  Conclusão: "Aneurisma de aorta torácica [segmento] — monitoramento com TC semestral."
  Conduta: cardiovascular; TC seriada; controle rigoroso de PA.

N4 — Aneurisma ≥5,5 cm / crescimento rápido / dissecção / ruptura.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA CARDIOVASCULAR: [Aneurisma ≥5,5 cm / Dissecção aórtica]."
  Conduta: R6 — cirurgia cardiovascular de urgência.

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia da aorta torácica é tecnicamente limitada pela janela acústica aérea
(pulmão, sombra costal, esterno). A avaliação é mais confiável para a aorta descendente
torácica pela abordagem posterior e para a porção imediatamente acima da raiz aórtica
pela abordagem paraesternal. A Angiotomografia de aorta torácica (Angio-TC — protocolo
bifásico sem e com contraste) é o método de referência para diagnóstico definitivo,
medida precisa do diâmetro (perpendicular ao eixo do vaso) e planejamento de intervenção.
O ecocardiograma transesofágico (ETE) é o padrão-ouro para dissecção e valva aórtica.
A US NÃO EXCLUI DISSECÇÃO — em qualquer suspeita clínica, solicitar Angio-TC de urgência.
Medidas de diâmetro ao US devem ser tomadas perpendicularmente ao eixo longo do vaso
(borda externa a borda externa) — medidas oblíquas superestimam o diâmetro.`,
  customForm: '',
  clinicId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// E3 — ESCLEROTERAPIA (procedimentos)
// ─────────────────────────────────────────────────────────────────────────────
const E3 = {
  id: 'procedimentos-escleroterapia',
  area: 'procedimentos',
  name: 'ESCLEROTERAPIA',
  title: 'ESCLEROTERAPIA GUIADA POR ULTRASSONOGRAFIA',
  technique: `<p>Procedimento realizado sob orientação ultrassonográfica com transdutor linear de alta frequência (7,5–15 MHz), com técnica asséptica, antissepsia local e anestesia tópica/local quando necessário. O agente esclerosante foi preparado conforme técnica de Tessari (espuma) ou solução líquida, e injetado sob visão ecográfica em tempo real. A posição do paciente, o volume injetado e a distribuição do agente foram monitorados durante e após a injeção.</p>`,
  analysisTemplate: `<p><strong>ESTRUTURA-ALVO:</strong> [Descrever vaso/cisto/coleção — localização, dimensões, características ao US].</p>
<p><strong>PROCEDIMENTO:</strong> Injetado [volume] mL de [agente] sob orientação US em [X] pontos de acesso.</p>
<p><strong>DISTRIBUIÇÃO DO AGENTE:</strong> [Observada ao US — homogênea/parcial/com refluxo].</p>
<p><strong>COMPLICAÇÕES IMEDIATAS:</strong> [Nenhuma / descrever se presente].</p>`,
  conclusionTemplate: `<p>Escleroterapia US-guiada realizada com sucesso técnico. Sem complicações imediatas.</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Seguimento clínico e controle de imagem conforme protocolo do médico assistente.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: A escleroterapia US-guiada é procedimento minimamente invasivo com taxa de sucesso variável conforme alvo, agente e técnica. Múltiplas sessões podem ser necessárias. Complicações incluem: dor local, hiperpigmentação, flebite química, matting (neoangiogênese), reação alérgica (rara com polidocanol), trombose venosa profunda (rara — maior risco com volumes >3 mL ou injeção inadvertida em comunicação profunda). Escleroterapia não deve ser realizada em gestantes, pacientes com trombofilia grave não controlada ou com hipersensibilidade conhecida ao esclerosante.</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ESCLEROTERAPIA GUIADA POR ULTRASSONOGRAFIA
PROCEDIMENTOS — V1.0 — LAUD.IA
REFERÊNCIAS: CIRSE · AVF · SBF · CBR · ISAVLT · Consensus Document (2012)
═══════════════════════════════════════════════════════════════
ESCOPO: Laudo de escleroterapia guiada por US para tratamento de varizes (superficiais
e tributárias), malformações vasculares (venosas e linfáticas), cistos (tireoidiano,
anexial, renal, ganglionar) e coleções. Protocolo de descrição técnica do procedimento.
═══════════════════════════════════════════════════════════════

1. TIPOS DE ESCLEROTERAPIA — INDICAÇÕES E AGENTES
───────────────────────────────────────────────────────────────

1.1 ESCLEROTERAPIA DE VARIZES VENOSAS (EEV):
  Indicações:
    Varizes tronculares (GSV, SSV) como alternativa ou complemento à ablação térmica.
    Tributárias e varizes residuais pós-cirurgia ou pós-ablação.
    Varizes recorrentes pós-stripping.
    Veias reticulares e telangiectasias (escleroterapia líquida).

  Agentes esclerosantes aprovados:
    Polidocanol 0,5–3%: preferido por menor dor e menor reação tecidual.
    Tetradecil sulfato de sódio (STS) 0,25–3%: alternativa.
    Glicose 75%: agente hiperosmolar, menor risco de necrose. Para telangiectasias.

  Preparação de espuma (Método de Tessari):
    Mistura esclerosante : ar = 1:3 a 1:4 (proporção).
    Seringa de 5 mL + seringa de 5 mL com torneira de 3 vias.
    25 passes entre seringas = espuma homogênea de microbolhas.
    Volume máximo por sessão: ≤10 mL de espuma (consenso europeu) ou ≤6 mL
    por vaso para reduzir risco de migração cardíaca ou cerebral.

  Concentração por segmento:
    Veia tronco (GSV, SSV): 1–3% (ajustar conforme calibre).
    Tributárias: 0,5–1%.
    Telangiectasias/reticulares: 0,25–0,5% (líquido, não espuma).

1.2 ESCLEROTERAPIA DE MALFORMAÇÕES VASCULARES:
  Malformações venosas (MV):
    Agente: polidocanol 1–3% espuma ou etanol absoluto (especialista experiente).
    Volume: 1–5 mL por sessão (múltiplas sessões para lesões grandes).
    Controle: US durante injeção + FBR pós-sessão para verificar trombose.

  Malformações linfáticas (ML — linfangioma):
    Agente: bleomicina (1 U/mL) ou OK-432 (Picibanil) ou doxiciclina.
    Indicação: macrocísticas (cistos >2 cm) — melhor resposta.
    Microcísticas: menor eficácia, múltiplas sessões.

1.3 ESCLEROTERAPIA DE CISTOS:
  Cisto tireoidiano simples / misto (predom. cístico >80%):
    Aspiração + injeção de etanol absoluto (50% do volume aspirado, max 10 mL).
    Retração do cisto esperada: 80–95% em 6 meses.
    Complicações: dor local, febre leve transitória.

  Cisto anexial funcional persistente:
    Aspiração guiada por US transvaginal + etanol 95% (2–5 mL × 3 min → aspirar).
    Alternativa ao cisto funcional persistente >3 cm em pré-menopausa.
    NUNCA escleroterapia sem certeza de benignidade (Bosniak / O-RADS ≤2).

  Cisto renal simples Bosniak I–II sintomático:
    Aspiração + etanol 95% (instilação por 20–30 min → aspirar).
    Taxa de recorrência: 10–20% em 2 anos.

2. TÉCNICA — PROTOCOLO US-GUIADO
───────────────────────────────────────────────────────────────
PRÉ-PROCEDIMENTO (verificar e documentar):
  Consentimento informado (TCLE) — especificar riscos e limitações.
  Mapeamento US detalhado: identificar alvo, calibre, comunicações venosas.
  Posição do paciente: decúbito dorsal/lateral conforme localização.
  Desinfecção: clorexidina aquosa 0,5% ou álcool 70%; campo cirúrgico.
  Anestesia local: lidocaína 2% SC para vias venosas profundas.

INJEÇÃO:
  Acesso: agulha 21–25G dependendo do alvo.
  Posição da agulha: confirmar intravascular/intracístico ANTES da injeção
    (aspira sangue venoso / líquido cístico).
  Injeção US-guiada em tempo real: monitorar distribuição do agente.
  Espuma: aspecto hiperecoico com "tempestade de neve" ao Color Doppler.
  Líquido hipertônico/etanol: aspecto hiperecóico difuso na lesão.
  PARAR se: dor intensa, migração para veia profunda, reação vasovagal.

PÓS-PROCEDIMENTO:
  Compressão local por 2–5 minutos.
  Meia de compressão (classe II) por 1–2 semanas em varizes.
  Restrição de: atividade física intensa, banho quente e sol direto por 48h.
  Controle US em 4–6 semanas para avaliação de resultado.

3. AVALIAÇÃO PRÉ-PROCEDIMENTO (MAPEAMENTO)
───────────────────────────────────────────────────────────────
VARIZES:
  Identificar: diâmetro do vaso-alvo (cm), comprimento do segmento a tratar.
  Detectar comunicações: com sistema profundo (contraindicação relativa).
  JSF/JSP: competente ou incompetente (incompetente = ablação térmica preferível).
  Calibre: GSV >3 mm em posição ortostática = candidata a espuma 1–3%.
  Veia perfurante incompetente associada: tratar antes ou simultaneamente.

4. COMPLICAÇÕES — RECONHECIMENTO E CONDUTA
───────────────────────────────────────────────────────────────
IMEDIATAS:
  Reação alérgica: urticária, broncoespasmo → adrenalina 0,3 mg IM.
  Migração cerebral de microbolhas: distúrbios visuais, cefaleia → repouso + O2.
    (espuma: evitar injeção >6 mL; aguardar 30 min antes de deambular).
  Vasovagal: bradicardia + síncope → decúbito + atropina 0,5 mg IV.
  Dor intensa: extravasamento perivenoso → gelo local.

TARDIAS:
  Hiperpigmentação pós-esclerose: drenagem de trombo em 2–4 semanas; laser se persistir.
  Matting (telangiectasia neo-formada): refratária; laser dye.
  Flebite química: calor + anti-inflamatório; sem anticoagulação rotineiramente.
  TVP pós-escleroterapia: raro; anticoagulação se poplítea ou proximal.
    → R6 se TVP confirmada.
  Necrose cutânea (etanol, alta concentração): curativo especializado.

5. CLASSIFICAÇÃO N0–N4 (RESULTADO TÉCNICO)
───────────────────────────────────────────────────────────────
N0 — Procedimento com sucesso técnico completo. Distribuição ideal do agente.
     Sem complicações imediatas.
  Conclusão: "Escleroterapia US-guiada realizada com sucesso técnico. Agente distribuído
  no segmento-alvo sem extravasamento ou complicações imediatas observadas."

N1 — Distribuição parcial do agente. Preenchimento incompleto do vaso.
  Conclusão: "Preenchimento parcial — nova sessão recomendada em 4–6 semanas."

N2 — Vaso não acessível. Paciente intolerante. Técnica modificada.
  Conclusão: "Procedimento tecnicamente limitado por [causa]. Abordagem alternativa sugerida."

N3 — Complicação minor: dor intensa, flebite química, hiperpigmentação precoce.
  Conclusão: "Procedimento realizado com intercorrência menor [descrever]. Conduta aplicada."

N4 — Complicação major: migração cerebral sintomática, TVP, reação anafilática.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA: Complicação grave durante escleroterapia [descrever]. Manejo
  de emergência iniciado / avaliação médica urgente necessária."

OBSERVAÇÕES METODOLÓGICAS:
A escleroterapia US-guiada é procedimento minimamente invasivo com alto perfil de
eficácia para varizes superficiais e cistos benignos, mas requer treinamento específico
e conhecimento anatômico do sistema venoso. O volume máximo de espuma por sessão deve
ser respeitado (<6–10 mL conforme target) para minimizar o risco de migração de
microbolhas para a circulação sistêmica/cerebral (risco real em pacientes com forame
oval patente — FOP). Contraindicações absolutas: trombofilia grave não controlada,
alergia ao esclerosante, gravidez, trombose venosa profunda ativa ipsilateral. A taxa de
recorrência de varizes após escleroterapia é de 15–30% em 3 anos — a ablação térmica
(EVLA/RF) tem menor taxa de recorrência em varizes tronculares (GSV/SSV) calibrosas.`,
  customForm: '',
  clinicId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// E4 — ESCROTO AGUDO (pediatria)
// ─────────────────────────────────────────────────────────────────────────────
const E4 = {
  id: 'pediatria-escroto-agudo',
  area: 'pediatria',
  name: 'ESCROTO AGUDO PEDIÁTRICO',
  title: 'ULTRASSONOGRAFIA DO ESCROTO AGUDO PEDIÁTRICO',
  technique: `<p>Exame realizado com transdutor linear de alta frequência (10–18 MHz), com o paciente em decúbito dorsal e escroto sustentado por compressas. Modo B-mode e Power Doppler/Color Doppler aplicados com parâmetros otimizados para detecção de fluxo em baixas velocidades (PRF 600–800 Hz, ganho máximo sem artefato). Avaliação bilateral comparativa com medidas simétricas. Avaliação em tempo real com atenção especial à perfusão testicular e estruturas periférica.</p>`,
  analysisTemplate: `<p><strong>TESTÍCULO DIREITO:</strong> Volume [X] mL ([X]×[X]×[X] mm). Ecogenicidade [normal/alterada]. Perfusão ao Color/PD: [presente/ausente/assimétrica].</p>
<p><strong>EPIDÍDIMO DIREITO:</strong> Cabeça [X] mm. Ecogenicidade [normal/alterada]. Vascularização [normal/aumentada].</p>
<p><strong>TESTÍCULO ESQUERDO:</strong> Volume [X] mL. Perfusão: [presente/ausente].</p>
<p><strong>EPIDÍDIMO ESQUERDO:</strong> [Descrever].</p>
<p><strong>LÍQUIDO ESCROTAL:</strong> [Ausente/Hidrocele discreta/moderada/volumosa].</p>`,
  conclusionTemplate: `<p>Estudo ultrassonográfico do escroto sem alterações — perfusão testicular bilateral preservada (N0).</p>`,
  classificationTemplate: '',
  recommendationsTemplate: `<p>Seguimento pediátrico habitual.</p>`,
  observationsTemplate: `<p><em>OBSERVAÇÕES METODOLÓGICAS: No escroto agudo com suspeita de torção testicular, a AUSÊNCIA de fluxo ao Color/Power Doppler é altamente sugestiva de torção (sensibilidade >95%), mas a PRESENÇA de fluxo NÃO EXCLUI torção parcial (torção incompleta). Nas primeiras horas (2–4h do início da dor), o testículo pode ainda ter algum fluxo residual. A indicação cirúrgica é CLÍNICA — dor aguda + escroto doloroso em jovem = exploração cirúrgica imediata independentemente do US. O US não deve retardar a cirurgia quando a suspeita clínica é alta. Quanto menor a criança, menor a sensibilidade do Doppler para detecção de fluxo testicular normal (artérias muito pequenas).</em></p>`,
  aiInstructions: `PROMPT ESPECÍFICO — ULTRASSONOGRAFIA DO ESCROTO AGUDO PEDIÁTRICO
PEDIATRIA — V1.0 — LAUD.IA
REFERÊNCIAS: SBU · WFUMB · ESUR · EAU Paediatric Urology Guidelines · CBR
═══════════════════════════════════════════════════════════════
ESCOPO: Avaliação ultrassonográfica de urgência do escroto em crianças e adolescentes
com dor escrotal aguda. Objetivo primário: excluir ou confirmar torção testicular
(EMERGÊNCIA CIRÚRGICA) e diferenciar de outras causas de escroto agudo.

AVISO CRÍTICO: A torção testicular é EMERGÊNCIA CIRÚRGICA. A taxa de salvamento
testicular cai dramaticamente após 6 horas (>90% até 6h, ~50% em 6–12h, <10% após 24h).
O US NUNCA deve atrasar a cirurgia quando há suspeita clínica alta.
═══════════════════════════════════════════════════════════════

1. PROTOCOLO DE AVALIAÇÃO — ESCROTO AGUDO
───────────────────────────────────────────────────────────────
PARÂMETROS A REGISTRAR (bilateral — sempre comparar os dois lados):

TESTÍCULOS:
  Dimensões: comprimento × largura × espessura (mm); volume pelo elipsoide.
  Ecogenicidade: normal (homogênea isoecóica) / hipoecóica / heterogênea.
  Contornos: regulares / irregulares.
  Textura: homogênea / heterogênea (heterogeneidade = sofrimento isquêmico).

PERFUSÃO — COLOR DOPPLER E POWER DOPPLER (MANDATÓRIO):
  Registrar: presente / ausente / assimétrica.
  Comparar os dois lados no mesmo frame (side-by-side) se possível.
  Parâmetros: PRF 600–800 Hz (sensível a baixas velocidades) + ganho máximo.
  ATENÇÃO: Doppler pulsado confirmar com artéria testicular intratesticular (VPS e VDF).
  Assimetria de perfusão (reduzida ipsilateral) = achado suspeito de torção parcial.

EPIDÍDIMOS:
  Dimensões: cabeça, corpo, cauda (mm).
  Ecogenicidade: normal / aumentada / heterogênea.
  Vascularização: normal (mínima) / aumentada (epididimite ativa).

APÊNDICES TESTICULAR E EPIDIDIMÁRIO:
  Localizar: polo superior do testículo (apêndice testicular) / cabeça do epidídimo.
  Normal: estrutura ovalada <5 mm, isoecóica.
  Torcido: nódulo hiperecoico ou heterogêneo >5 mm com hipervascularização ao redor.
  "Sinal do ponto azul": visualizado clinicamente na pele — útil para orientação.

LÍQUIDO ESCROTAL:
  Hidrocele: simples (anecóica) / com debris (inflamatória/hemorrágica).
  Piocele: líquido com debris densos → contexto de orquite + líquido = suspeita de abscesso.

TECIDOS MOLES ESCROTAIS:
  Espessamento de pele e subcutâneo: edema inflamatório.
  Gangrena de Fournier: gás em tecidos moles (hiperecoico + artefato de reverberação).
  → R6 IMEDIATO: Gangrena de Fournier = necrose fasciante perineal.

2. TORÇÃO TESTICULAR — DIAGNÓSTICO E PROTOCOLO
───────────────────────────────────────────────────────────────
FISIOPATOLOGIA:
  Torção do pedículo vascular espermático → isquemia testicular progressiva.
  Faixa etária pico: neonatos (torção extravaginal) + púberes 12–18 anos (intravaginal).
  Causa: deformidade "sino" (bell-clapper deformity) — testículo livre na túnica vaginal.

ACHADOS US:
  Color/Power Doppler: AUSÊNCIA de fluxo intratesticular ipsilateral.
    Comparar SEMPRE com lado contralateral no mesmo frame.
    Nódulo hiperecoico no polo superior = "whirlpool sign" (espiralaamento do pedículo).
  B-mode (precoce — primeiras horas): testículo normal ou discretamente aumentado.
  B-mode (tardio — >12h): heterogeneidade difusa (necrose), hipoecogenicidade.
  Epidídimo: geralmente hipoecóico e aumentado ipsilateral.
  Hidrocele reatia: presente em ~50% dos casos.
  "Whirlpool sign": doppler colorido mostra espiralaamento do pedículo vascular no
  funículo espermático = patognomônico de torção. Sensibilidade 95–99%.

CLASSIFICAÇÃO DE GRAU PELO DOPPLER:
  Fluxo normal bilateral: torção improvável (sensibilidade 95%).
  Fluxo assimétrico (reduzido ipsilateral): torção parcial ou precoce. CIRURGIA.
  Ausência completa de fluxo ipsilateral: torção completa. CIRURGIA DE URGÊNCIA.

⚠️ R6 TORÇÃO TESTICULAR:
"ALERTA CIRÚRGICO: Ausência de fluxo testicular ao Doppler [direito/esquerdo] em
contexto de dor escrotal aguda — TORÇÃO TESTICULAR até prova em contrário.
Exploração cirúrgica de urgência indicada. Risco de perda testicular em progressão."

NOTA CRÍTICA: Presença de fluxo NÃO EXCLUI torção incompleta. A decisão cirúrgica
é CLÍNICA. US com fluxo presente + alta suspeição clínica = cirurgia.

3. TORÇÃO DO APÊNDICE TESTICULAR / EPIDIDIMÁRIO
───────────────────────────────────────────────────────────────
Vesígio mülleriano/wolffiano — pequena estrutura pedunculada no polo testicular.
Causa mais comum de escroto agudo em crianças pré-púberes (7–12 anos).
AUTOLIMITADA — não requer cirurgia na maioria dos casos.

ACHADOS US:
  Nódulo oval hiperecoico ou heterogêneo >5 mm no polo superior testicular.
  Hipervascularização ao PD AO REDOR do nódulo (não dentro — necrose avascular).
  Hidrocele ipsilateral associada.
  Fluxo testicular PRESERVADO bilateralmente (diferencial chave com torção testicular).
  "Sinal do ponto azul" clinicamente (transluminação do nódulo na pele escrotal fina).

CONDUTA:
  Fluxo testicular preservado + nódulo apendicular compatível:
  Tratamento conservador: AINE + gelo + repouso + controle em 48–72h.
  Cirurgia apenas se dor intratável ou dúvida diagnóstica.

4. EPIDIDIMO-ORQUITE (EO)
───────────────────────────────────────────────────────────────
Inflamação do epidídimo e/ou testículo, geralmente infecciosa.
Faixa etária: qualquer; pico em adultos jovens sexualmente ativos (IST).
Em crianças pré-púberes: geralmente infecção bacteriana (E. coli, refluxo vesical).

ACHADOS US:
  Epidídimo aumentado e hipoecóico (edema): cabeça >12 mm = aumentada.
  Hipervascularização epididimária ao PD (principal sinal).
  Envolvimento testicular (orquite associada): heterogeneidade focal ou difusa + PD aumentado.
  Fluxo testicular PRESERVADO ou AUMENTADO (hiperafluxo) — diferencial com torção.
  Hidrocele reatia.
  Piocele: debris densos no líquido = abscesso → R6.

CLASSIFICAÇÃO DOPPLER:
  EO leve: PD aumentado no epidídimo, testículo normal.
  EO moderada: PD aumentado no epidídimo + hiperafluxo testicular (orquite).
  Abscesso: área focal hipoecoica sem PD intraluminal + debris.
    → R6: drenagem cirúrgica ou percutânea.

CONDUTA:
  EO sem abscesso: antibioticoterapia (adulto — quinolona ou doxiciclina conforme IST;
  criança — sulfametoxazol-trimetropim ou amoxicilina conforme antibiograma).
  Abscesso: → R6 — drenagem.

5. HIDROCELE
───────────────────────────────────────────────────────────────
HIDROCELE SIMPLES:
  Coleção anecóica circundante ao testículo.
  Congênita (patência do processo vaginal): comum no neonato, frequentemente resolve.
  Reativa: pós-orquite, pós-torção, pós-trauma.
  Grau: discreta (<10 mL estimado) / moderada (10–50 mL) / volumosa (>50 mL).
  Conduta: conservadora se assintomática. Cirurgia (hidrocelectomia) se volumosa e sintomática.

HEMATOCELE:
  Líquido com ecos internos / sangue no espaço vaginal.
  Contexto: trauma escrotal.
  Ruptura testicular associada: perda de contorno testicular + heterogeneidade.
    → R6: "Suspeita de ruptura testicular — cirurgia de urgência."

PIOCELE:
  Líquido com debris densos + hipervascularização parietal.
  Contexto: epididimo-orquite complicada.
  → R6 se abscesso confirmado.

6. VARICOCELE
───────────────────────────────────────────────────────────────
Dilatação das veias do plexo pampiniforme.
Prevalência: 15% da população masculina. 35% em homens inférteis.
ESQUERDA em 90% dos casos (drenagem em ângulo reto na veia renal).
Bilateral em 10%. DIREITA isolada: investigar causa secundária (massa retroperitoneal).

ACHADOS US:
  Veias do plexo pampiniforme >2 mm de diâmetro (supino) / >3 mm (Valsalva ou ortostatismo).
  Critério prático mais usado: >3 mm ao ortostatismo com Valsalva.
  Ao Color Doppler em Valsalva: fluxo retrógrado nas veias dilatadas.
  Grau I: Valsalva apenas. Grau II: supino. Grau III: palpável.

IMPACTO NA FERTILIDADE:
  Varicocele clinicamente significativa (grau II–III) + infertilidade + parâmetro seminal
  alterado = candidato a varicocelectomia microsurgical.
  Resolução após cirurgia: melhora de parâmetros seminais em 50–70% dos casos.

7. TRAUMAS TESTICULARES
───────────────────────────────────────────────────────────────
Avaliar após traumatismo escrotal direto (esporte, acidente).

CONTUSÃO SEM RUPTURA:
  Testículo de forma preservada. Área focal hipoecoica intratesticular.
  Fluxo ao PD: presente (pode estar localmente reduzido).
  Hematocele: líquido com ecos internos.

RUPTURA TESTICULAR (EMERGÊNCIA):
  Perda da continuidade da túnica albugínea.
  Contorno testicular irregular.
  Heterogeneidade grave do parênquima.
  Extrusão do parênquima testicular para além da albugínea.
  → ⚠️ R6: "Ruptura testicular — orquiorrafia cirúrgica de urgência para preservação."

8. CLASSIFICAÇÃO N0–N4
───────────────────────────────────────────────────────────────
N0 — Testículos com morfologia e perfusão normais bilateralmente.
  Epidídimos normais. Sem hidrocele significativa.
  Conclusão: "Escroto sem alterações ao estudo ultrassonográfico com Doppler."

N1 — Hidrocele isolada simples. Varicocele grau I-II assintomática.
     Apêndice testicular levemente aumentado sem PD ao redor.
  Conclusão: "[Achado benigno]. Perfusão testicular preservada."
  Conduta: conservador; seguimento pediátrico/urológico eletivo.

N2 — Epididimite sem orquite. Torção de apêndice com PD circundante + fluxo testicular
     normal. Hematocele sem ruptura. Varicocele grau III sintomática.
  Conclusão: "[EO leve / Torção de apêndice / Hematocele]. Perfusão testicular preservada."
  Conduta: antibiótico / AINE; urologia pediátrica; seguimento.

N3 — Orquite moderada. Abscesso epididimário pequeno. Hematocele volumosa.
     Fluxo testicular assimétrico (reduzido ipsilateral).
  Conclusão: "Orquite moderada / [achado]. Fluxo testicular assimétrico — atenção clínica."
  Conduta: urgência urológica para avaliação. Antibioticoterapia IV.

N4 — AUSÊNCIA de fluxo testicular ao Doppler (torção testicular).
     Ruptura testicular. Gangrena de Fournier. Abscesso volumoso.
  ⚠️ ATIVAR R6.
  Conclusão: "ALERTA CIRÚRGICO: [Ausência de fluxo testicular / Ruptura testicular /
  Gangrena de Fournier]. Cirurgia de urgência indicada."
  Conduta: R6 — exploração/orquiorrafia/orquiectomia conforme achado intraoperatório.

OBSERVAÇÕES METODOLÓGICAS:
A ultrassonografia escrotal com Doppler tem sensibilidade de 95–99% e especificidade
de 95–99% para torção testicular quando realizada com técnica otimizada (PRF baixo,
comparação bilateral, Whirlpool sign). Entretanto, torção incompleta e torção com
desfibrinação precoce podem apresentar algum fluxo residual — o US não exclui
100% a torção em contexto clínico compatível. Em crianças muito pequenas (<1 ano),
o fluxo testicular normal pode ser difícil de detectar pelo pequeno calibre das artérias
testiculares — Doppler normal em neonato com dor pode ser falso-negativo. A indicação
cirúrgica de urgência é CLÍNICA — dor escrotal aguda em adolescente sem diagnóstico
alternativo seguro = exploração cirúrgica, independentemente do US. O US orienta o
diagnóstico mas NÃO substitui a decisão cirúrgica baseada na clínica. O retardo da
cirurgia para obter US em suspeita forte de torção é contraindicado.`,
  customForm: '',
  clinicId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD phase4-templates.json
// ─────────────────────────────────────────────────────────────────────────────

const phase4 = [E1, E2, E3, E4];
writeFileSync('scripts/phase4-templates.json', JSON.stringify(phase4, null, 2), 'utf8');

console.log('Phase 4 new templates:');
for (const t of phase4) {
  const ai = (t.aiInstructions || '').length;
  console.log(`  [${t.area.padEnd(16)}] ${t.name.padEnd(35)} ${ai} chars`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA 2 PATCH — areaPrompts.ts
// ─────────────────────────────────────────────────────────────────────────────
const areaPromptsPath = 'src/modules/ai/prompts/areaPrompts.ts';
let src = readFileSync(areaPromptsPath, 'utf8');

// Patch 1: Add DOPPLER RENAL reference to vascular area
const vascularPatch = `
   → Para avaliação específica de artérias renais com Doppler, use o template dedicado
   "DOPPLER RENAL" (Camada 3): inclui IR intraparenquimatoso, critérios de estenose,
   padrão tardus-parvus, protocolo de transplante renal e avaliação pós-intervenção.`;

src = src.replace(
  '4. DOPPLER DE MEMBROS — Critérios gerais',
  `3b. DOPPLER RENAL — REFERÊNCIA À CAMADA 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${vascularPatch}

4. DOPPLER DE MEMBROS — Critérios gerais`
);

// Patch 2: Add Camada 3 references to reumatologico area
src = src.replace(
  '6. RECOMENDAÇÕES PADRÃO:\n   • Sinovite ativa',
  `5b. REFERÊNCIA AOS TEMPLATES DE CAMADA 3 (REUMATOLÓGICO):
   Os seguintes templates específicos expandem cada protocolo com escores completos,
   classificações N0–N4 detalhadas e condutas por patologia:
   • ARTICULAÇÕES PERIFÉRICAS: OMERACT, erosões, gota DCS, dactilite, entesite.
   • SACROILÍACAS: critérios ASAS, SpA axial, May-Thurner axial, séptica.
   • PDUS-28: escore 28 articulações, remissão US, resposta a biológico.
   Use o prompt de área (Camada 2) para contextualização geral; a Camada 3 domina
   nas especificidades protocolares de cada exame.

6. RECOMENDAÇÕES PADRÃO:\n   • Sinovite ativa`
);

writeFileSync(areaPromptsPath, src, 'utf8');
console.log('\nCamada 2 patch applied to areaPrompts.ts');
console.log('Done. Output: scripts/phase4-templates.json');
