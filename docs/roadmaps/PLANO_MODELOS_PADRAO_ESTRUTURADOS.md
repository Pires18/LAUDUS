# Plano de Refatoração — Modelos Padrão de Estruturado por Exame

**Objetivo:** cada uma das 71 máscaras do sistema ganha um MODELO PADRÃO curado de
formulário estruturado (aba "Estruturado" do Copiloto), desenhado a partir do
`analysisTemplate` + `aiInstructions` da própria máscara, com calculadoras do
sistema ligadas, escores inline e cálculos ao vivo. O rollout segue **por áreas**.

## Arquitetura (implementada)

Resolução do esquema em `deriveStructuredSchema` (`src/modules/editor/structured/deriveSchema.ts`):

1. **Personalizado** — `template.structuredSchema` salvo na máscara (aba Estruturado
   do editor de máscaras). Prioridade total; `sections: []` desativa o formulário.
2. **Modelo padrão** — `findStandardSchema(area, examName)` em
   `src/modules/editor/structured/standardSchemas/` (este plano). Casamento por
   regex sobre o nome normalizado; cópias pessoais ("X (Personalizada)") herdam.
3. **Fallback** — parser do `analysisTemplate` + enriquecimento da `fieldLibrary`
   (comportamento anterior, permanece para máscaras sem modelo).

O botão "Personalizar" do editor de máscaras semeia a partir do nível ativo
(modelo padrão quando existir), então ajustes finos por máscara partem do modelo.

### Motor do estruturado (aprimorado em 16/07/2026)

- **Grupo de lesões ANINHADO** (`StructuredSection.repeatGroup`): uma seção de
  órgão `normalable` guarda a lista de lesões/nódulos/cistos com suas
  calculadoras e escore. Fica escondida quando 'Normal'; aparece dentro do
  'Alterado'. Chaves via container virtual `<sectionId>#<groupId>` (não colide
  com os campos fixos). Abstração única `RepeatContainer` (`containers.ts`) para
  seção-lista pura E grupo aninhado — renderizador, compilação e cálculo ao vivo
  iteram do mesmo jeito.
- **Seção de ACHADOS** (helper `achados()`): Normal (ausente) por padrão; o
  'Alterado' revela a lista repetível. Usado para cistos, litíase, nódulos,
  hérnias, linfonodos suspeitos, lesões salivares/partes moles.
- **Valores de normalidade** (`StructuredFieldDef.normal`): chip verde de
  referência no campo (ex.: "normal: ≤ 6 mm") + preenchimento pelo botão Normal.
- **Biometria registrada na normalidade** (`StructuredFieldDef.alwaysShow`): o
  card 'Normal' mantém um bloco **"Medidas do exame"** com os campos que se
  registram mesmo sem alteração (dimensões, volume, índices Doppler) — com
  calculadora e cálculo ao vivo ativos, e compilados junto da frase de
  normalidade para a IA. Descritores de alteração continuam ocultos, e as
  lesões (grupo aninhado) só aparecem sob 'Alterado'. Marcar em: eixos/dimensões
  de órgãos, colédoco, aorta, volume testicular, diástase, índices Doppler.

### Datação e risco (aprimorado em 16/07/2026)

- **IG de referência multi-método** (`resolveReferenceGa` em `calculators/formulas.ts`):
  **DUM**, **USG anterior** (`usg_data` + `usg_ig`, extrapolada até a data do exame)
  ou **biometria do exame** — CCN (1ºT), DBP (2ºT) ou CC (3ºT), escolhida pelo
  trimestre (`pickBiometryDatingParam`). Fórmulas: Hadlock 1992 (CCN) e Hadlock
  1984 (DBP/CC — `gaFromBpd`/`gaFromHc`). Sem método declarado, a hierarquia é
  **USG > DUM > biometria** (ISUOG/ACOG). É a **fonte única** dos percentis
  (OMS, Doppler, MoM) e dos riscos — antes só a DUM produzia percentis.
  Derivações: `ig__ref` (IG + DPP + fonte) e `ig__biometrica` (concordância;
  alerta se divergência > 10%).
- **Dados maternos e exame físico** (seção `dados-maternos` no 1ºT e no Doppler
  obstétrico): idade, peso, altura, PA sistólica/diastólica, origem racial,
  concepção, paridade (+ IG da PE prévia), diabetes, comorbidades/hábitos.
  Derivam **PAM** (`(2·PAD + PAS)/3`, alerta ≥ 100) e **IMC** (alerta ≥ 30).
  Seção `bioquimica`: analisador, PAPP-A, β-hCG livre, PlGF (MoM).
- **Semente das calculadoras** (`structured/calcSeed.ts` + `ExamEditor`): ao abrir
  uma calculadora por um campo do Estruturado, ela já vem preenchida com o
  formulário (datação, biometria, dados maternos, exame físico, marcadores,
  P2/P1 → `psvRatioRaw`, PA → `mapMmHg`). O que o médico salvou na calculadora
  prevalece sobre a semente (`{ ...seed, ...saved }`).

### Convenções obrigatórias por modelo

- **Fidelidade à máscara**: seções espelham os compartimentos do laudo, na ordem.
- **Ids canônicos** onde o `liveCompute` deriva cálculo ao vivo (não renomear):
  `baco_eixo`, `vrpm`, `prostata_dims`+`psa`, `vps_renal_d/e`+`vps_aorta`,
  `ir_d/ir_e`, `rim_d_dims/rim_e_dims`, `lobo_d_dims/lobo_e_dims`, `itb_d/e`,
  `vps_aci_d/e`+`vdf_aci_d/e`, `alfa_d/e`+`beta_d/e`, `dum/ccn/dmsg`, `dbp/cc/ca/cf`,
  `ip_au/ip_acm/psv_acm/ip_uta/ip_dv`, `ila/mbv/colo/nt`, `endometrio_esp`+`menopausa`,
  `ovd_dims/ovd_afc/ove_dims/ove_afc`, `pfe1/pfe2`, `piloro_musculo/piloro_canal`,
  `apendice_diam`, `porta_cal/porta_fluxo`.
- **Regras clínicas dos prompts viram `hint`** (limiares, referências).
- **Escopo de ids**: seções não-repetíveis compartilham o mapa plano (id único no
  esquema todo); repetíveis escopam por instância. `__` e `@` proibidos.
- **Achados múltiplos** → seções `repeatable` (lesões, nódulos, cistos, cálculos).
- **Compartimentos habitualmente normais** → `normalable` + `normalText` fiel à máscara.
- **Validação**: todo modelo passa em `validateStructuredSchema` (testado).
- **Testes por área**: resolver, validação, ids canônicos, seções de destino dos
  cálculos ao vivo (`src/test/structuredStandardSchemas.test.ts`).

## Rollout por áreas

### ✅ Fase 1 — Medicina Interna (7 máscaras) — CONCLUÍDA
`standardSchemas/medicinaInterna.ts`

| Máscara | Destaques do modelo |
|---|---|
| ABDOME SUPERIOR | Fígado (esteatose I–III) + lesões focais repetíveis (Couinaud + volume), vias biliares (colédoco ≤6/8/10), vesícula (multiselect de achados), pâncreas (Wirsung), baço (`baco_eixo` → esplenomegalia auto), rins resumo, aorta/VCI (`ivc-index`), retroperitônio |
| ABDOME SUPERIOR COM DOPPLER | + Doppler hepático/portal (porta ≤13 mm, velocidade, IR hepática 0,55–0,80, padrão trifásico, colaterais) |
| ABDOME TOTAL | Rins dedicados D/E (`rim_*_dims` → volume auto, SFU), cistos renais DESCRITIVOS (Bosniak proibido no US), bexiga, cavidade |
| ABDOME TOTAL COM DOPPLER | + Doppler hepático + Doppler renal (RAR/IR automáticos) |
| PRÓSTATA VIA ABDOMINAL | `prostata_dims` → `prostate-weight` (volume/peso/classificação auto) + PSA (densidade auto >0,15), lobo mediano (IPP I–III), bexiga pré-miccional (trabeculação), `vrpm` auto |
| RINS E VIAS URINÁRIAS | Rins D/E completos, cistos descritivos, LITÍASE repetível (13 localizações, sombra, repercussão), ureteres, bexiga c/ capacidade, `vrpm` |
| RINS E VIAS COM DOPPLER | + cistos com sugestão **Bosniak** US-adaptado (regra do próprio prompt), Doppler renal canônico (RAR ≥3,5, IR >0,7), jatos ureterais |

Calculadoras usadas: `volume-elipsoide`, `prostate-weight`, `ivc-index` (+ `organ-refs`
e `pleural-effusion` disponíveis nos seletores da área).

### ✅ Fase 2 — Pequenas Partes (10 máscaras) — CONCLUÍDA
`standardSchemas/pequenasPartes.ts`

| Máscara | Destaques do modelo |
|---|---|
| TIREOIDE (±Doppler) | Glândula (normal/alterado), lobos canônicos `lobo_d_dims`/`lobo_e_dims` → volume por lobo + **volume total auto**, istmo, nódulos repetíveis **TI-RADS** (5 descritores scoreKey + conduta por tamanho, calc `volume-elipsoide`), cadeias linfonodais + linfonodos suspeitos repetíveis, estruturas adjacentes. Doppler acrescenta vascularização glandular |
| CERVICAL (±Doppler) | Pele/TCS, salivares, tireoide rastreio, linfonodos cervicais repetíveis (níveis I–VII, índice L:T, hilo, córtex, vascularização), vasos (modo B), planos musculares; Doppler acrescenta padrão vascular linfonodal |
| BOLSA ESCROTAL (±Doppler) | Parede, testículos canônicos `test_d_dims`/`test_e_dims` + volume, epidídimos, túnicas/hidrocele, funículos/varicocele (≥3 mm); Doppler acrescenta refluxo à Valsalva + dopplerfluxometria (fluxo/IR/whirlpool-torção) |
| GLÂNDULAS SALIVARES | Parótidas/submandibulares/sublinguais (normal/alterado + lado/achado), ductos (sialólito), nódulos repetíveis + volume, linfonodos |
| PARTES MOLES | Pele/TCS, lesões repetíveis (plano, ecogenicidade, forma, Doppler) + volume, planos musculares, estruturas vasculares, linfonodos |
| REGIÕES INGUINAIS | Bilateral (D/E): hérnia + comportamento à Valsalva, conteúdo/colo, linfonodos |
| PAREDE ABDOMINAL | Pele/tela, planos aponeuróticos, **diástase dos retos** (inter-retos supra/infra > 20 mm), hérnias repetíveis (tipo/colo/redutibilidade), avaliação dinâmica |

Calculadoras usadas: `volume-elipsoide` (+ `organ-refs` disponível). Descritores TI-RADS
reusados de `scoring.ts` (`TIRADS_OPTIONS`). Concluída em 15/07/2026 (533 testes verdes).

### ✅ Fase 3 — Ginecologia (5 máscaras) — CONCLUÍDA
`standardSchemas/ginecologia.ts` — IOTA/O-RADS (ACR 2022), MUSA, IETA, FIGO, IDEA.

| Máscara | Destaques do modelo |
|---|---|
| PÉLVICA TRANSVAGINAL (±Doppler) | Útero (`utero_dims` → volume no card Normal) + **miomas FIGO 0–8 aninhados** (calc `figo-myoma`); Endométrio (`endometrio_esp`+`menopausa` → **alerta pós-menopausa > 4 mm**, IETA, pólipos aninhados c/ pedículo vascular); Colo; Ovários (`ovd_*`/`ove_*` → volume + CFA → **SOP auto**); **Formações anexiais O-RADS** (descritores IOTA → sugestão automática, calc `orads-us-2022`); Douglas. Doppler acrescenta fluxo ovariano + IP uterinas |
| PÉLVICA ABDOMINAL (±Doppler) | Idem + nota de técnica/limitação da via suprapúbica e bexiga (janela acústica) |
| PÉLVICA — ENDOMETRIOSE | Útero/endométrio (adenomiose MUSA + zona juncional); Ovários (endometriomas aninhados, "kissing ovaries", mobilidade); Compartimento anterior (sliding sign, bexiga, ureteres); Compartimento posterior (sliding sign, **uterossacros ≤ 3 mm**, retossigmoide); Paramétrios; **Focos de DIE (mapa cirúrgico)** por sítio com distância da margem anal (condicional) e camada infiltrada |

Calculadoras: `volume-elipsoide`, `figo-myoma`, `orads-us-2022`. Concluída em
16/07/2026 (551 testes verdes).

### ✅ Fase 4 — Mastologia (3 máscaras) — CONCLUÍDA
`standardSchemas/mastologia.ts` — léxico **ACR BI-RADS® v2025** aplicado ao US.

| Máscara | Destaques do modelo |
|---|---|
| MAMAS E AXILAS | Composição (léxico US: fibroglandular/adiposa/heterogênea, `alwaysShow`); Pele/CAP; Parênquima + **lesões BI-RADS aninhadas** (score → sugestão ao vivo, calcs `volume-elipsoide` e `birads-us-2013`, achados associados); Ductos (calibre ≤ 2 mm); Planos profundos; Axilas + linfonodos aninhados |
| MAMAS COM DOPPLER | Mamas **separadas por lado** (lesão sem campo de lado redundante), Ductos, Estudo Doppler, Axilas |
| LINFONODOS AXILARES | Axila D/E com **níveis de Berg I–III** (+ intramamário e mamária interna), córtex ≤ 3 mm (critério mais sensível), índice L:T, hilo, vascularização; Outros achados |

**Decisão de léxico (v2025 no US)** — conforme [[reference_birads_v2025]]: forma inclui
**"lobulada"** (novo no v2025); **"microlobulada" PERMANECE margem distinta no US** — a
fusão em "indistinta" é mudança MAMOGRÁFICA e não se aplica. Os valores dos descritores
casam exatamente com `biradsSuggest` (scoring.ts). Concluída em 16/07/2026 (560 testes).

### ✅ Fase 5 — Medicina Fetal (9 máscaras) — CONCLUÍDA
`standardSchemas/medicinaFetal.ts` — ISUOG, FMF, FEBRASGO, CBR, Barcelona
(Figueras-Gratacós), Delphi 2016. A área com mais cálculo ao vivo do sistema.

| Máscara | Destaques do modelo |
|---|---|
| OBSTÉTRICA INICIAL | Datação; Saco gestacional (`dmsg` → IG auto, calc `msd-dmsg`); Vesícula vitelínica; Embrião (`ccn` → IG auto, calc `gestational-age`) + BCE; Douglas |
| OBSTÉTRICA ABDOMINAL (±Doppler) | Datação (`dum` → IG/DPP); Vitalidade; **Biometria canônica** (`dbp`/`cc`/`ca`/`cf` + `sexo_fetal` → PFE Hadlock IV + percentil auto pela **curva selecionável** — Hadlock (padrão), INTERGROWTH-21st ou OMS —, calc `who-fetal-biometry`); Placenta (Grannum); Cordão; Líquido (`ila`/`mbv`, calc `amniotic-fluid`). Doppler acrescenta AU/ACM/PSV/UtA + **oftálmicas (P2/P1)** e velocidade de crescimento (`growth-velocity`) |
| MORFOLÓGICA 1º TRIMESTRE | Colo (`colo`); Biometria 1T (`ccn`); **Marcadores** (`nt` > 3,5 auto, osso nasal, `ip_dv`, tricúspide) + **risco FMF de trissomias**; checklist anatômico ISUOG do 1T; Doppler (`ip_uta`, oftálmicas) + **risco FMF de PE** |
| MORFOLÓGICO 2º TRIMESTRE | Biometria completa (+DOF/úmero); **anatomia por sistema** com biometrias no card Normal (átrio ventricular < 10 mm, cerebelo, cisterna magna, prega nucal < 6 mm, osso nasal, DBO/DIO); Doppler; Cordão; Placenta; Líquido |
| NEUROSSONOGRAFIA | Calota; Parênquima; Sistema ventricular (`atrio_vent` → ventriculomegalia); Linha média (corpo caloso); Fossa posterior (cerebelo, cisterna magna, vermis); Espaços líquidos |
| ECOCARDIOGRAMA FETAL | Situs/eixo/relação cardiotorácica; Ritmo e FC; 4 câmaras; Vias de saída; 3VT; Arcos; Drenagem venosa; Doppler valvar; Função ventricular; Pericárdio |
| GEMELAR | **Corionicidade/amnionicidade obrigatórias** (sinal λ/T, septo); por feto: estática, biometria com `pfe1`/`pfe2` (→ **discordância > 20% auto**), Doppler + MBV do saco e bexiga (TTTS); Quintero |
| CERVICOMETRIA | `colo` → **colo curto < 25 mm auto**; OCI; canal; funilização (T/Y/V/U); sludge |

Calculadoras: `gestational-age`, `msd-dmsg`, `who-fetal-biometry`,
`doppler-fetal`, `amniotic-fluid`, `growth-velocity`, `fmf-trisomy-risk`,
`fmf-preeclampsia-risk` (as FMF seguem **em validação** — hint avisa no campo).

> `crl-ccn` **não existe mais**: foi absorvida por `gestational-age`, que unifica
> DUM / USG anterior / biometria (CCN 1ºT · DBP 2ºT · CC 3ºT). Ver [[project_fetal_dating]].
Concluída em 16/07/2026 (574 testes verdes).

### Fase 6 — Vascular (9 máscaras) ✅

| Máscara | Destaques do modelo |
|---|---|
| CARÓTIDAS E VERTEBRAIS | EMI (`emi_d`/`emi_e` → calc `imt-elsa-br`) + idade no card Normal; por lado, `vps_acc`/`vps_aci`/`vdf_aci` **no card Normal** → **grau de estenose SRU/NASCET auto** + relação ACI/ACC; **placas aninhadas** (sítio, extensão, ecogenicidade, superfície — ulcerada = alto risco embólico); vertebrais (roubo) e subclávias |
| ARTÉRIAS OFTÁLMICAS | AO/ACR/ACP D+E e veias oftálmicas, cada vaso com VPS/VDF/IR/IP **em ids próprios** e valores de referência; seção de sinais de emergência (OACR, descolamento) |
| ARTÉRIAS RENAIS | Rim (comprimento/parênquima no Normal); `vps_renal_{d,e}` + **`vps_aorta` obrigatória** → **RAR auto** (≥ 3,5 = estenose ≥ 60%); `ir_{d,e}` → **IR intraparenq. auto** (> 0,7) + tempo de aceleração (tardus-parvus) |
| AORTO-ILÍACO | Aorta infrarrenal (`aorta`, outer-to-outer, ectasia/aneurisma) + trombo mural; ilíacas comuns (aneurisma ≥ 1,5 cm), externas e internas; endoprótese (endoleak I–V) |
| AORTA TORÁCICA | Ascendente/arco/descendente com calibres de referência; raiz + valva (Marfan); **dissecção** (flap → DeBakey condicional); pericárdio/pleura |
| ARTERIAL MEMBRO INFERIOR | Eixos aortoilíaco, femoropoplíteo e infrapatelar D/E (tri/bi/monofásico + estenose por VPS); **`itb_d`/`itb_e` no card Normal → classificação auto** + Rutherford |
| ARTERIAL MEMBRO SUPERIOR | Subclávio-axilar (roubo), braquial, radial/ulnar; arcos palmares (Allen); manobras dinâmicas; **FAV/acesso** (maturação ≥ 6 mm, estenose, pseudoaneurisma) |
| VENOSO MEMBRO INFERIOR | Profundo D/E: compressibilidade no Normal + **trombos aninhados** (segmento, **topografia proximal/distal**, oclusivo/flutuante, agudo/crônico); superficial: refluxo > 0,5 s, calibre das safenas no Normal, CEAP 2020; perfurantes repetíveis |
| VENOSO MEMBRO SUPERIOR | Profundo D/E + **braquiocefálica/cava por avaliação indireta** (fluxo contínuo = obstrução central); superficial (cefálica/basílica) |

Calculadoras: `imt-elsa-br`, `vascular-ratios`, `venous-cartography`, `ivc-index`.

> **Ids reservados:** `ir_d`/`ir_e` disparam o chip "IR intraparenq." (RENAL). Em
> carótidas/oftálmicas use ids próprios — **o id de campo simples é global** no
> formulário, então dois campos `ir` em seções diferentes gravam no mesmo valor
> (travado por teste).

### Fase 7 — Pediatria (6 máscaras) ✅
QUADRIL DDQ (`alfa_*`/`beta_*` no card Normal → **Graf auto**, α < 60° alerta;
Barlow/Ortolani), TRANSFONTANELAR (**Papile** e `atrio_vent` no Normal →
**ventriculomegalia auto**; leucomalácia, IR da ACA), ABDOME PED
(`piloro_musculo`/`piloro_canal` e `apendice_diam` → **autos**; achados
aninhados), RINS PED (**DAP da pelve + SFU por lado**, jatos ureterais),
COLUNA (nível do cone, filum ≤ 2 mm, estigmas cutâneos), ESCROTO AGUDO
(fluxo intratesticular por lado + whirlpool — a assimetria define a emergência).

### Fase 8 — MSK (9) + Reumatológico (3) ✅
**MSK**: OMBRO, COTOVELO, PUNHO, MÃO E PUNHO, JOELHO, QUADRIL, TORNOZELO, PÉ,
MUSCULAR. Tendões com **espessura no card Normal** e chip `normal:` copiado da
**Tabela Mestra de Referência do prompt da área** (§ 15) — Aquiles 4–6 mm,
patelar 3–5, quadricipital 5–7, supraespinal 5–7 (footprint), tibial posterior
3–5, mediano ≤ 9 mm², ulnar ≤ 2,5 mm², bursa SASD < 2 mm, espaço subacromial
≥ 7 mm, fáscia plantar ≤ 4 mm, Morton > 5 mm. MUSCULAR tem lesões aninhadas
graduadas (British Athletics 0–4 + sítio a/b/c). Lesões focais repetíveis com volume.
**Reumato**: ARTICULAÇÕES PERIFÉRICAS, SACROILÍACAS, ESCORE PDUS-28 — articulações
como **grupo repetível** (GSUS/PDUS 0–3 por item, as 28 do protocolo), ênteses e
erosões repetíveis, GLOESS e nº de articulações com PD ≥ 1.

### Fase 9 — Procedimentos (10 máscaras) ✅
Espinha comum: **indicação** (+ consentimento e antiagregação) → **alvo** →
**técnica** (assepsia, agulha, via, passagens) → **material** → **controle** →
**intercorrências**. PAAF TIREOIDE herda os descritores **ACR TI-RADS** de
`TIRADS_OPTIONS` (mesma fonte da máscara de tireoide) com escore ao vivo;
PAAF MAMA herda o léxico **BI-RADS v2025 do US**; BVC e AMNIOCENTESE herdam a
**datação canônica** (`dum` → IG/DPP auto) + ILA/MBV e vitalidade pré/pós.

## Critérios de aceite por fase

1. `findStandardSchema` resolve todas as máscaras da área (incl. variantes COM DOPPLER
   antes das genéricas e cópias "(Personalizada)").
2. Todos os modelos passam em `validateStructuredSchema` (teste automatizado).
3. Ids canônicos preservados → chips de cálculo ao vivo nas seções do modelo (teste).
4. `tsc` limpo + suíte completa verde.
5. Verificação visual no editor de máscaras (badge "Modelo padrão", preview reativo).

**Status: ROLLOUT COMPLETO + AUDITORIA FINAL — 16–17/07/2026.**
Cobertura: **71 das 71 máscaras**, nas 10 áreas. **710 testes verdes, tsc 0.**

## Auditoria final (`src/test/structuredAudit.test.ts`)

26 verificações permanentes sobre TODAS as áreas. Auditam invariantes que, quando
quebrados, **não geram erro visível** — o médico só vê um botão que não abre, um
campo que nunca aparece, ou um alerta que o laudo contradiz.

**Achados corrigidos:**

| # | Achado | Efeito |
|---|---|---|
| 1 | `volume-elipsoide` não declarava **mastologia** (desde a Fase 4) | as lesões mamárias tinham o atalho, mas a calculadora sumia da lista da área |
| 2 | `vascular-ratios` não declarava pediatria; `birads-us-2013`, `amniotic-fluid`, `gestational-age` e `tirads-2017` não declaravam procedimentos | idem |
| 3 | **5 calculadoras nunca abertas por campo algum**: `tirads-2017`, `barcelona-fetal-growth`, `venous-cartography`, `pleural-effusion`, `organ-refs` | vinculadas as 3 com âncora natural (categoria TI-RADS, estadiamento de Barcelona no Doppler obstétrico, cartografia no venoso MMII). `pleural-effusion` e `organ-refs` são ferramentas de consulta avulsa — seguem acessíveis pelo menu da área (travado por teste) |
| 4 | **Piloro**: motor ≥3 mm/≥15 mm × prompt ≥4 mm/≥17 mm | alerta no formulário contradizendo o laudo da IA. **Alinhado ao prompt** (decisão do médico) |
| 5 | **Endométrio pós-menopausa**: motor > 4 mm × prompt ≤ 5 mm (e a tabela distingue TH) | idem. **Alinhado em > 5 mm + estado hormonal** (sem TH 5 · TH cíclica 8 · TH contínua 6 mm) |
| 6 | `ir_aca` (transfontanelar) e nível do cone medular com valores **fora da tabela do prompt** | corrigidos para 0,60–0,80 e ≤ L1–L2 |

> **O padrão de bug desta fase** (o mesmo do ITB): um limiar clínico vive em DOIS
> lugares — o motor (chip do formulário) e a tabela do prompt (o que a IA escreve).
> Divergem em silêncio. As fronteiras exatas agora estão travadas por teste do lado
> do motor, e a suíte compara os chips `normal:` com a tabela.

O teste `toda máscara do JSON de deploy resolve para um modelo padrão` varre
`scripts/laudia-deploy-unified.REFINED.json` (a fonte real das máscaras) e falha
apontando o nome exato de qualquer máscara nova/renomeada que fique sem modelo —
junto com `cada máscara resolve para o modelo do NOME dela`, que pega regex ampla
demais (casamento cruzado). O parser genérico continua como rede de segurança.

> ✅ **Divergência do ITB RESOLVIDA (16/07/2026)** — o chip ao vivo
> (`scoring.ts → itbClassification`) usava normal 0,9–1,3 / > 1,3 incompressível,
> enquanto o prompt da área ensinava os cortes **ESC/AHA** à IA: o formulário e o
> laudo gerado discordavam sobre o mesmo número (0,95 = "normal" no chip e
> "limítrofe" para a IA; 1,35 = "incompressível" no chip e "normal" para a IA).
> Por decisão do Dr. Matheus, `scoring.ts` foi **alinhado ao ESC/AHA**:
> > 1,40 incompressível · **1,00–1,40 normal** · **0,91–0,99 limítrofe** (nova
> faixa) · 0,41–0,90 DAP leve a moderada · ≤ 0,40 DAP grave (isquemia crítica).
> Fronteiras travadas em `structuredEngine.test.ts`.
