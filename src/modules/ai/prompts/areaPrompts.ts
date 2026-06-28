/**
 * @file areaPrompts.ts
 * @module LAUD.IA — Diretrizes de Área (Camada 2)
 * @version V2.0 — RELEASE OFICIAL
 *
 * Este arquivo contém as DIRETRIZES PADRÃO para cada área de especialidade.
 * São enviadas como contexto de ÁREA para todos os exames daquela especialidade.
 *
 * ESCOPO: Cada diretriz vale para TODOS os exames de uma mesma área.
 * Para regras de um exame específico, use o campo `aiInstructions` da máscara.
 *
 * COMO FUNCIONA NO ENGINE (buildSpecificContext em engine.ts):
 * O conteúdo aqui é inserido ENTRE o Sistema Universal (Camada 1)
 * e as Instruções Específicas do Exame (Camada 3), sob o título:
 *   "INSTRUÇÕES DA ÁREA DE [ÁREA]:"
 *
 * IMPORTANTE: Leia /docs/CASCADE_PROMPTS.md antes de qualquer ajuste.
 */

/**
 * @constant DEFAULT_AREA_PROMPTS
 * Diretrizes de área padrão para todas as especialidades do LAUD.US.
 * Usadas quando o usuário não definiu uma diretriz personalizada.
 * Podem ser sobrescritas em AppSettings.aiAreaPrompts[area].
 */
export const DEFAULT_AREA_PROMPTS: Record<string, string> = {

  // ═══════════════════════════════════════════════════════════════
  // MEDICINA INTERNA / ABDOME
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area medicina-interna
   * @scope Abdome Superior, Abdome Total, Hepático, Renal, Retroperitônio,
   *        Urológico, Pélvico Masculino, etc.
   *
   * Foco: classificações de esteatose, caracterização de lesões hepáticas,
   * graduação de nefropatia, hipertensão portal, achados urológicos.
   */
  'medicina-interna': `DIRETRIZES CLÍNICAS — MEDICINA INTERNA / ABDOME (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: CBR 2024 · SBR · SBRAD · AASLD · ACR · EASL · KDIGO · AUA · EAU · RSNA
AUTOCÁLCULOS: Volume (elipsoide), peso prostático, RPM → FASE 4 de general.ts.
              NÃO recalcular aqui; apenas interpretar o resultado gerado.

ESCOPO E MAPA DE EXAMES DESTA ÁREA (7 templates de Camada 3):
  ┌─────────────────────────────────────────────────────────────────┐
  │ ABDOME SUPERIOR         — Fígado, VB, pâncreas, baço, rins, Ao │
  │ ABDOME SUP COM DOPPLER  — Idem + Doppler hepatoportal + renal   │
  │ ABDOME TOTAL            — Idem + bexiga, pelve, retroperitônio  │
  │ ABDOME TOTAL COM DOPPLER— Idem + Doppler completo (portal+renal)│
  │ PRÓSTATA VIA ABDOMINAL  — Volumetria + IPP + bexiga + RPM       │
  │ RINS E VIAS URINÁRIAS   — Rins + ureter + bexiga + RPM          │
  │ RINS E VU COM DOPPLER   — Idem + IR + estenose + transplante     │
  └─────────────────────────────────────────────────────────────────┘
  Cada template de Camada 3 contém o protocolo aprofundado do exame.
  Este prompt (Camada 2) fornece as regras e referências comuns a todos.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. FÍGADO — Regras transversais obrigatórias
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MEDIDA PADRÃO: lobo direito longitudinal na linha médio-clavicular.
   Normal: ≤15 cm (♂) / ≤14 cm (♀). Hepatomegalia = acima desses limites.
   Lobo esquerdo: ≤6 cm no eixo sagital pela linha médio-clavicular.

   LOCALIZAÇÃO DE LESÕES — Segmentação de Couinaud (obrigatória quando identificável):
     Lobo caudado: S1. Lobo esq lateral: S2 (sup) / S3 (inf). Lobo esq medial: S4 (a/b).
     Lobo dir anterior: S5 (inf) / S8 (sup). Lobo dir posterior: S6 (inf) / S7 (sup).
     Referências: VH direita divide S5/S8 de S6/S7. VH média divide lobo dir de S4.

   ESTEATOSE — Classificar obrigatoriamente (Grau I/II/III):
     Grau I (Leve): ecogenicidade discreta ↑ vs. córtex renal; vasos e diafragma visíveis.
     Grau II (Moderada): ecogenicidade moderada ↑; vasos portais com bordas mal definidas;
       leve atenuação do feixe; diafragma ainda visível.
     Grau III (Acentuada): atenuação posterior intensa; vasos intra-hepáticos e diafragma
       não identificáveis ou muito prejudicados.
     → Grau II–III: correlação ALT/AST/GGT/ferritina/glicemia. RM Dixon para quantificação.

   LESÕES FOCAIS — Hierarquia de conduta:
     Cisto simples: anecoico, parede imperceptível, reforço posterior, sem PD.
       <4 cm → controle US anual. 4–7 cm → controle 6 meses. >7 cm ou atípico → RM.
     Hemangioma típico: hiperecogênico, homogêneo, <3 cm, sem halo.
       ≤3 cm típico → US 6–12 meses. >3 cm ou atípico → RM dinâmica com Gd.
     Lesão sólida indeterminada: descrever segmento Couinaud, dimensão, ecogenicidade,
       halo, PD interno. → SEMPRE recomendar RM abdome com contraste dinâmico.
     Paciente cirrótico / HBV sem cirrose (LI-RADS v2024 ao US):
       REGRA: ao US SEM contraste (convencional), NÃO atribuir categoria LI-RADS definitiva.
       Usar linguagem equivalente e recomendar TC/RM com contraste para classificação formal.
       Equivalências orientativas no US convencional:
         LR-1 equiv.: ausência de nódulos — "sem nódulos suspeitos identificados."
         LR-2 equiv.: nódulo <1 cm, hiperecóico sem halo (ex: hemangioma típico pequeno).
         LR-3 equiv.: nódulo 1–2 cm com ecogenicidade variável, sem critérios de malignidade.
         LR-4 equiv.: nódulo >2 cm com hipo ou isoecogenicidade, halo periférico.
         LR-5 equiv.: nódulo >2 cm com padrão de lavagem ao CEUS/dinâmica ou vascularização interna exuberante.
         LR-M (malignidade): lesão com critérios atípicos para CHC (ex: rim hipoecoico com invasão vascular).
         LR-TIV: trombo portal com expansão e PD interno → ATIVAR R6.
       Citar: "(equivalência LI-RADS v2024 — confirmação por TC/RM hepática com contraste dinâmico indicada)."

   INDICAÇÃO DE CEUS (Contraste Ultrassonográfico — US-CEUS) — quando recomendar:
     Indicar CEUS ao invés de TC/RM imediata nas seguintes situações:
       (a) Lesão hepática focal <3 cm INDETERMINADA ao US convencional em paciente de risco de CHC (cirrótico, HBV/HCV);
       (b) Paciente com contraindicação a gadolíneo (RM) ou contraste iodado (TC): IRC, alergia, contraindicação;
       (c) Lesão hepática < 1 cm com necessidade de caracterização em cirrótico;
       (d) Diferenciação rápida entre CHC e hemangioma em lesão duvidosa.
     NÃO indicar CEUS como substituto definitivo de RM hepática dinâmica para estadiamento oncológico.
     Fraseologia: "Avaliação complementar com contraste ultrassonográfico (CEUS) poderá ser considerada antes de TC/RM, conforme disponibilidade e indicação clínica."

   HEPATOPATIA CRÔNICA / CIRROSE:
     Contornos nodulares, ecotextura grosseira, hipertrofia de lobo caudado (S1).
     Associar com pesquisa de hipertensão portal (§4) e rastreio de CHC.

2. SISTEMA BILIAR — Parâmetros e conduta
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DUCTOS BILIARES:
     VBP normal: ≤6 mm (<70 anos); ≤8 mm (>70 anos ou pós-colecistectomia).
     Ductos intra-hepáticos dilatados (≥3 mm): sinal do "cano duplo" → obstrução.
     VBP >7 mm: investigar coledocolitíase → ecoendoscopia ou CPRM.
     Aerobilia: ecos lineares hiperecóicos com reverberação na árvore biliar intra-hepática.

   VESÍCULA BILIAR:
     Normal: parede ≤3 mm, lúmen anecoico, sem cálculo.
     Colelitíase: foco(s) hiperecóico(s), móveis, com sombra acústica. Registrar: número,
       maior dimensão, posição (infundíbulo, corpo, fundo). Cálculo no infundíbulo = impactado.
     Sludge: ecos amorfos móveis sem sombra, nível líquido-líquido.
     Colecistite aguda — critérios (declarar quantos presentes):
       (a) Parede >4 mm com duplo halo; (b) Murphy sonográfico positivo;
       (c) Cálculo impactado no infundíbulo; (d) Líquido perivesicular; (e) Debris intraluminais.
       ≥3 critérios = colecistite aguda provável → ATIVAR R6.
     Pólipo vesicular: sessil, sem sombra. <6 mm → controle anual.
       6–9 mm → controle 6 meses. ≥10 mm → avaliação cirúrgica (risco oncológico).

3. PÂNCREAS — Avaliação sistemática
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES NORMAIS: cabeça ≤3,0 cm; corpo ≤2,0 cm; cauda ≤2,0 cm; Wirsung ≤2 mm.
   Wirsung ≥3 mm: dilatação — investigar pancreatite crônica ou obstrução (massa na cabeça).
   DECLARAR LIMITAÇÃO se corpo/cauda não visualizados (interposição gasosa) → TC ou CPRM.

   PANCREATITE AGUDA: ↑ volume, hipoecogenicidade, bordas indefinidas, líquido peripancreático.
     → ATIVAR R6 se grave (líquido volumoso, necrose suspeita).
   PANCREATITE CRÔNICA: atrofia, hiperecogenicidade, calcificações, Wirsung irregular dilatado.
   LESÕES CÍSTICAS: localização, dimensões, septos, nódulo mural, comunicação com Wirsung.
     Suspeita de IPMN (comunicação com Wirsung) ou MCN (mucinoso) → CPRM + ecoendoscopia.
   LESÃO SÓLIDA SUSPEITA: massa hipoecoica, dilatação de Wirsung por obstrução.
     → TC trifásica urgente; correlação CA 19-9, CEA.

4. BAÇO — Classificação e conduta
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Normal: eixo longitudinal ≤12 cm; ecotextura homogênea.
   Esplenomegalia: >12 cm. Graduar:
     Leve: 12–15 cm. Moderada: 15–20 cm. Maciça (acentuada): >20 cm.
   Causas por contexto: HP (§5) + hepatopatia; hematológica (linfoma, leucemia, hemólise);
     infecciosa (mononucleose, malária, leishmaniose); depósito/infiltrativo.
   Baço acessório (esplenúnculo): nódulo isoecóico ao hilo (<3 cm) — variante normal.
   Lesão focal: hipoecoica sólida (linfoma, metástase, abscesso) ou cística (cisto hidático).
     → Qualquer lesão focal sólida no baço em adulto: TC + correlação hematológica/oncológica.
   Hematoma esplênico pós-trauma: coleção hipo/anecóica ± heterogênea.
     → ATIVAR R6 se trauma + esplenomegalia com coleção.

5. HIPERTENSÃO PORTAL — Diagnóstico e conduta
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DECLARAR HP QUANDO ≥2 SINAIS PRESENTES:
     • Veia porta >13 mm (hilo hepático, em jejum).
     • Esplenomegalia >12 cm.
     • Colaterais portossistêmicas visíveis: veia para-umbilical repermeabilizada (>3 mm,
       mais específica), ligamento gastrohepático, esplenorrenal, varizes perigástricas.
     • Ascite (qualquer quantidade — localizar: peri-hepática, periesplénica, pelve).
     • Doppler portal: fluxo hepatofugal OU velocidade <12 cm/s.
   GRADUAR (quando exame COM Doppler):
     Leve: VP 10–13 mm, v 10–15 cm/s, sem ascite. Moderada: VP >13 mm, v <10 cm/s,
     colateral presente. Grave: hepatofugal, ascite, colaterais múltiplas.
   RECOMENDAÇÃO HP: "endoscopia digestiva alta para rastreio de varizes esofagogástricas;
     correlação hepatológica com avaliação de função hepática (Child-Pugh / MELD)."
   TROMBOSE PORTAL AGUDA: trombo expansivo + ausência de fluxo → ATIVAR R6.
   CAVERNOMA PORTAL (crônico): rede vascular tortuosa no hilo → hepatologia.

6. RINS E VIAS URINÁRIAS — Parâmetros unificados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES RENAIS (adulto): comprimento 9–12 cm bilateral; parênquima ≥1,0 cm (córtex).
   NEFROPATIA PARENQUIMATOSA — Estadiamento US:
     G1 (Leve): ≥9 cm; ecogenicidade cortical ↑ leve; diferenciação corticomedular reduzida.
     G2 (Moderado): 7–9 cm; córtex ↑↑; diferenciação muito reduzida; contornos irregulares.
     G3 (Grave): <7 cm; parênquima indiferenciado; córtex afilado (<0,6 cm); calcificações.
     → G2–G3: correlação nefrológica — TFG, creatinina, microalbuminúria.
   CISTOS RENAIS — Terminologia US (NUNCA usar Bosniak ao US):
     Simples: anecoico, parede imperceptível, reforço posterior, sem PD. <4 cm = rotina.
     Minimamente complexo: septos finos, calcificação parietal fina, sem nódulo, sem PD.
       → Controle US anual.
     Complexo: parede/septos espessados, calcificações grosseiras, nódulo mural, PD interno.
       → TC/RM urgente para classificação definitiva.
   HIDRONEFROSE — Gradação por pelve renal (AP no plano transverso):
     G1 (Pelviectasia): 5–9 mm; sem dilatação calicial; parênquima preservado.
     G2 (Leve): 10–14 mm; cálices levemente dilatados; parênquima preservado.
     G3 (Moderada): 15–20 mm; cálices moderadamente dilatados; córtex com leve redução.
     G4 (Grave): >20 mm; cálices muito dilatados; córtex afilado (<4 mm).
     → G3–G4: TC de vias urinárias + avaliação urológica prioritária.
     → G3–G4 + febre: ATIVAR R6 — pielonefrite obstrutiva / urossepse.
   LITÍASE: dimensão (mm) + localização (cálice S/M/I, pelve, JUP, ureter, JUV).
     <4 mm: passagem espontânea provável. 4–6 mm: marginal. >6 mm → intervenção.
     Cálculo obstruente + febre → ATIVAR R6.

7. BEXIGA, PRÓSTATA E RESÍDUO PÓS-MICCIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BEXIGA (repleção ≥150 mL para avaliação adequada):
     Parede normal: ≤3 mm (bexiga repleta ≥300 mL). Espessamento difuso > 5 mm:
       uropatia obstrutiva (HPB, estenose uretral). Focal: neoplasia urotelial.
     Trabeculação: leve / moderada / acentuada (cistopatia obstrutiva).
     Lesão parietal sessil com PD interno → suspeita de carcinoma urotelial → cistoscopia.
     Resíduo Pós-Miccional (RPM — calcular via FASE 4):
       <50 mL = normal. 50–100 mL = limítrofe. >100 mL = obstrutivo (correlação urológica).
       >300 mL = retenção aguda → ATIVAR R6.
   PRÓSTATA (via abdominal — requer bexiga repleta ≥150 mL):
     Volume via elipsoide (FASE 4). Peso = volume × 1,05.
     HPB Grau I: 30–50 cm³. Grau II: 50–80 cm³. Grau III: 80–150 cm³. Grau IV: >150 cm³.
     Lobo mediano / IPP: ausente / Grau I (<5 mm) / II (5–10 mm) / III (>10 mm).
     Via abdominal NÃO caracteriza zona periférica — NÃO descartar CaP por esta via.
     PSA elevado + achado suspeito → mpMRI ou TRUS com biópsia.

8. GRANDES VASOS ABDOMINAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AORTA ABDOMINAL (medir AP + transverso, borda a borda, plano infrarrenal):
     Normal: <3,0 cm. Ectasia: 2,5–2,9 cm. Aneurisma: ≥3,0 cm.
     3,0–4,9 cm → US semestral + encaminhamento vascular.
     5,0–5,4 cm → avaliação vascular imediata (2 semanas).
     ≥5,5 cm (♂) / ≥5,0 cm (♀) → ATIVAR R6.
     Crescimento >5 mm/6 meses → ATIVAR R6.
     Hematoma periaórtico ou retroperitoneal → ATIVAR R6 (ruptura contida).
   VCI: normal <2,1 cm (expiração), colapso inspiratório >50%.
     VCI >2,1 cm sem colapso + VH dilatadas = IC direita / tamponamento / Budd-Chiari.

9. DOPPLER ABDOMINAL — Parâmetros de referência (exames COM Doppler)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Este bloco aplica-se aos exames: ABDOME SUP COM DOPPLER, ABDOME TOTAL COM DOPPLER
   e RINS E VU COM DOPPLER. Valores em jejum ≥4h.

   SISTEMA HEPATOPORTAL:
     Veia Porta: calibre ≤13 mm; VPS 12–20 cm/s; fluxo hepatopetal.
     Veia Esplênica: ≤8 mm; hepatopetal. VMS: ≤10 mm; hepatopetal.
     Artéria Hepática: IR 0,55–0,80; fluxo de baixa resistência.
     Veias Hepáticas: padrão trifásico (S/v/D/a) → monofásico = hepatopatia/IC.

   VASCULATURA RENAL:
     Artéria Renal Principal (tronco): VPS <180 cm/s; RAR <3,5.
     VPS >180 cm/s ou RAR >3,5 → suspeita de estenose renovascular.
     Artérias Intraparenquimatosas: IR 0,55–0,70; TA <70 ms.
     IR >0,70 bilateral: nefropatia parenquimatosa difusa.
     IR assimétrico (diferença >0,05): suspeita de estenose ipsilateral.
     Padrão tardus-parvus (TA >70 ms + IR <0,50): obstrução proximal da AR.

   SÍNTESE DOPPLER NA CONCLUSÃO (obrigatória em exames COM Doppler):
     Normal: "Estudo Doppler dos eixos [hepatoportal / renal / ambos] sem evidências
     de alterações hemodinâmicas significativas ao presente estudo."
     Alterado: descrever achado específico e acionar N3/N4 conforme gravidade.

10. TABELA MESTRA DE REFERÊNCIA — Dimensões normais (adulto)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Estrutura               │ Normal (adulto)                    │ Alerta / Ação
   ────────────────────────┼────────────────────────────────────┼──────────────────────────────
   Fígado (LD, LMC)        │ ≤15 cm (♂) / ≤14 cm (♀)           │ >15 cm = hepatomegalia
   Fígado (LE, sagital)    │ ≤6 cm                              │ >6 cm = hipertrofia LE
   Baço (longitudinal)     │ ≤12 cm                             │ >12 cm → graduar esplenomegalia
   Rim (longitudinal)      │ 9–12 cm bilateral                  │ <7 cm = G3 / >13 cm = infiltrativo?
   Parênquima renal        │ ≥1,0 cm (córtex)                   │ <0,6 cm = G3 grave
   Próstata (volume)       │ ≤30 cm³ / ≤30 g                    │ >80 g = HPB volumosa (G3)
   IPP (lobo mediano)      │ Ausente                            │ >10 mm = Grau III (obstrução)
   Bexiga (espessura)      │ ≤3 mm (repleta ≥300 mL)            │ >5 mm = espessamento significativo
   RPM (pós-miccional)     │ <50 mL                             │ >100 mL obstrutivo · >300 mL = R6
   Aorta (AP infrarrenal)  │ <3,0 cm                            │ ≥3 cm aneurisma · ≥5,5 cm = R6
   VCI (expiração)         │ <2,1 cm + colapso ≥50%             │ >2,1 sem colapso = IC/SBC
   VBP (calibre)           │ ≤6 mm (<70a) / ≤8 mm (colec.)     │ >7 mm → investigar coledoco
   Wirsung (ducto panc.)   │ ≤2 mm                              │ ≥3 mm = investigar causa
   Veia Porta              │ ≤13 mm / 12–20 cm/s hepatopetal    │ >13 mm + lento → HP
   IR renal                │ 0,55–0,70 intraparenquimatoso      │ >0,70 = nefropatia/obstrução

11. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Exame normal: "Recomenda-se seguimento clínico habitual, conforme protocolo do médico assistente."
   Cisto simples <4 cm: "Controle ultrassonográfico anual."
   Cisto 4–7 cm: "Controle ultrassonográfico em 6 meses."
   Cisto >7 cm / complexo: "RM de abdome para melhor caracterização da lesão."
   Hemangioma típico ≤3 cm: "Controle US em 6–12 meses."
   Hemangioma >3 cm / atípico: "RM abdome com contraste dinâmico (Gd)."
   Lesão sólida suspeita: "RM abdome com contraste dinâmico; correlação AFP/CEA/CA 19-9."
   Nódulo em cirrótico: "TC ou RM hepática com protocolo hepatobiliar (LI-RADS); hepatologia."
   Esteatose Grau II–III: "Correlação metabólica (ALT/AST/GGT/glicemia/perfil lipídico)."
   Colecistite aguda: ATIVAR R6 — "ALERTA CIRÚRGICO: avaliação imediata para colecistectomia."
   VBP >7 mm: "Ecoendoscopia biliopancreática ou CPRM para investigação de coledocolitíase."
   Pólipo ≥10 mm: "Avaliação cirúrgica — indicação de colecistectomia profilática."
   Pancreatite aguda grave: ATIVAR R6 — "ALERTA ABDOMINAL: hospitalização urgente."
   Lesão cística pancreática (IPMN/MCN suspeita): "CPRM + ecoendoscopia + CA 19-9 / CEA."
   Lesão sólida pancreática: "TC trifásica urgente; correlação CA 19-9, CEA."
   Esplenomegalia isolada: "Correlação hematológica/infecciosa; hemograma, LDH, sorologias."
   Hematoma esplênico: ATIVAR R6 — "ALERTA CIRÚRGICO: avaliação emergencial."
   Hipertensão portal: "Endoscopia digestiva alta para rastreio de varizes; hepatologia."
   Trombose portal aguda: ATIVAR R6 — "ALERTA HEPÁTICO: anticoagulação + hepatologia urgente."
   Budd-Chiari suspeito: ATIVAR R6 — "ALERTA HEPÁTICO: angio-TC urgente + hepatologia."
   Nefropatia G2–G3: "Correlação nefrológica (TFG, creatinina, microalbuminúria)."
   Hidronefrose G3–G4: "TC de vias urinárias + avaliação urológica prioritária."
   Litíase >6 mm ou obstruente: "Avaliação urológica (SWL ou ureteroscopia)."
   Litíase obstruente + febre: ATIVAR R6 — "ALERTA UROSSEPSE: drenagem urgente."
   Massa renal sólida: "TC/RM trifásica; avaliação uronecológica."
   Tumor vesical suspeito: "Cistoscopia + biopsia; avaliação urológica."
   HPB volumosa (>80 cm³) + RPM >100 mL: "Avaliação urológica + urodinâmica."
   RPM >300 mL: ATIVAR R6 — "ALERTA UROLÓGICO: retenção urinária — sondagem imediata."
   Lesão suspeita de CaP: "mpMRI prostática (PI-RADS) ou TRUS com biópsia."
   Aneurisma aorta 3–4,9 cm: "US semestral + encaminhamento para cirurgia vascular."
   Aneurisma aorta 5,0–5,4 cm: "Avaliação vascular imediata (2 semanas)."
   Aneurisma ≥5,5 cm: ATIVAR R6 — "ALERTA VASCULAR: cirurgia/endovascular urgente."
   Massa adrenal >3 cm: "TC abdome + metanefrinas urinárias + cortisol + aldosterona."
   Linfadenopatia retroperitoneal ≥10 mm: "TC abdome-pelve + correlação oncológica/hematológica."

12. REGRAS TRANSVERSAIS DE QUALIDADE — APLICÁVEIS A TODOS OS 7 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   a. USO CRITERIOSO DE BOSNIAK — A versão Bosniak v2019 (ACR) inclui US como modalidade
      válida para classificação, mas com limitações. Regras de aplicação ao US:
        PERMITIDO ao US: categorias I e II (cistos simples e minimamente complexos bem visualizados);
        RESTRITO ao US: categoria IIF — apenas quando critérios claramente visíveis (septos finos, calc. parietal);
        PROIBIDO ao US: categorias III e IV — estes exigem confirmação por TC ou RM com contraste;
        NUNCA substituir TC/RM por US para Bosniak III–IV.
      Quando incerto: usar terminologia descritiva ("cisto com septos espessados / componente mural")
      e recomendar TC/RM. Citar sempre: "(Bosniak v2019 — ACR)" se usar a classificação ao US.
   b. LOCALIZAÇÃO HEPÁTICA: Toda lesão focal hepática identificável deve ser localizada
      pelo segmento de Couinaud (S1–S8).
   c. LITÍASE: Registrar sempre dimensão (mm) + localização anatômica precisa +
      presença de sombra acústica + hidronefrose ipsilateral associada.
   d. SÍNTESE DOPPLER: Em exames COM Doppler, a conclusão DEVE conter uma linha
      dedicada ao status hemodinâmico, mesmo que normal.
   e. LIMITAÇÃO PANCREÁTICA: Declarar explicitamente se corpo/cauda não visualizados
      por interposição gasosa → recomendar TC ou CPRM.
   f. VIA ABDOMINAL E CaP: A US transabdominal NÃO caracteriza a zona periférica
      prostática e NÃO descarta câncer de próstata.
   g. FRASEOLOGIA R6: Sempre em linguagem imperativa: "ALERTA [SISTEMA]: [conduta]."
      Nunca usar linguagem passiva ou condicional em emergências (N4).
   h. ORDEM DA CONCLUSÃO: N4 (urgência) → N3 (complementação) → N2 (seguimento)
      → N1 (incidental benigno) → N0 (normalidade residual). Nunca inverter.`,

  // ═══════════════════════════════════════════════════════════════
  // MEDICINA FETAL / OBSTÉTRICA
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area medicina-fetal
   * @scope Obstétrico 1º, 2º e 3º trimestres, Morfológico, Doppler Obstétrico,
   *        Translucência Nucal, Cervicometria, etc.
   *
   * Foco: biometria fetal (DDP, IG, peso estimado), Doppler obstétrico,
   * avaliação morfológica, placenta, líquido amniótico.
   *
   * ATENÇÃO: Todas as medidas biométricas fetais são em MILÍMETROS (mm).
   * Placeholders (…) são MANTIDOS para medidas não fornecidas (R1 — Exceção Fetal).
   */
  'medicina-fetal': `DIRETRIZES CLÍNICAS — MEDICINA FETAL / OBSTÉTRICA (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: ISUOG 2022 · ACOG · INTERGROWTH-21st · FMF · CBR · FEBRASGO
             SMFM · FIGO · Protocolo de Barcelona (Figueras-Gratacós) · NICE
AUTOCÁLCULOS (FASE 4 de general.ts — NÃO duplicar aqui):
  FASE 4.3 = IP médio artérias uterinas   FASE 4.4 = RCP
  FASE 4.5 = Datação por CRL/DBP           FASE 4.6 = Hadlock EPF

LEI MÁXIMA DE SEGURANÇA FETAL:
  ► NUNCA inventar ou inferir dados biométricos não fornecidos.
  ► Manter placeholders "(…)" exatamente como recebidos.
  ► Declarar "não visualizado (NV)" quando estrutura não identificada.
  ► Esta lei é ABSOLUTA e não pode ser sobreposta por nenhuma instrução.

MAPA DE EXAMES DESTA ÁREA (9 templates de Camada 3):
  ┌──────────────────────────────────────────────────────────────────────┐
  │ OBSTÉTRICA INICIAL         — 5+0 a 13+6 semanas (viabilidade/datação)│
  │ MORFOLÓGICA 1T             — 11+0 a 13+6 semanas (TN + rastreio)     │
  │ MORFOLÓGICO 2T             — 18+0 a 24+6 semanas (anatômico completo) │
  │ OBSTÉTRICA ABDOMINAL       — 2T e 3T (crescimento + bem-estar)        │
  │ OBSTÉTRICA ABDOM c/ DOPPLER— Idem + Doppler materno-fetal             │
  │ CERVICOMETRIA              — TV, avaliação do risco de parto prematuro │
  │ NEUROSSONOGRAFIA FETAL     — 18–24 semanas (SNC avançado)             │
  │ ECOCARDIOGRAMA FETAL       — 20–28 semanas (coração fetal detalhado)  │
  │ GEMELAR                    — Avaliação com corionicidade + STFF        │
  └──────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DATAÇÃO GESTACIONAL — Critérios e prioridade
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HIERARQUIA DE DATAÇÃO (ACOG/ISUOG):
   1º) US 1T com CRL (6–13+6 semanas) — mais preciso (± 5–7 dias).
   2º) US 2T com DBP/CC (14–20 semanas) — ± 10 dias.
   3º) DUM confiável (ciclo regular 28d) — se concordante com US ≤10d.
   4º) FIV/ICSI — data da punção / transferência = IG definitiva.

   REGRA DE CORREÇÃO (ACOG 2014):
   Corrigir DUM pelo US se discordância:
     CRL 1T: discordância >5d. DBP/CC 2T: discordância >10d.
     CC 3T: NÃO corrigir — US 3T é impreciso para datação.

   CRL → IG (tabela FMF — 11–13+6 sem):
     CRL 45 mm = 11+0 sem · CRL 55 mm = 11+6 · CRL 65 mm = 12+4
     CRL 73 mm = 13+0 · CRL 79 mm = 13+3 · CRL 84 mm = 13+6

2. BIOMETRIA FETAL — Referências por trimestre (INTERGROWTH-21st)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MEDIDAS PADRÃO (todas em mm): DBP · DOF · CC · CA · CF · (CU)
   FÓRMULA EPF: Hadlock → FASE 4.6 de general.ts (não recalcular aqui).

   TABELA DE REFERÊNCIA SIMPLIFICADA (percentis 10–90):
   IG (sem) │ CC (mm)     │ CA (mm)     │ CF (mm)     │ EPF (g) P10–P90
   ─────────┼─────────────┼─────────────┼─────────────┼─────────────────
   18       │ 153–165     │ 126–140     │ 27–31       │ 150–230
   20       │ 171–185     │ 144–162     │ 31–36       │ 240–360
   22       │ 190–205     │ 163–183     │ 36–41       │ 370–550
   24       │ 207–225     │ 183–205     │ 41–46       │ 540–780
   28       │ 243–265     │ 218–247     │ 50–57       │ 900–1250
   30       │ 261–285     │ 235–268     │ 54–62       │ 1150–1600
   32       │ 279–305     │ 253–290     │ 58–67       │ 1450–2000
   34       │ 296–324     │ 270–310     │ 62–71       │ 1800–2500
   36       │ 311–342     │ 284–330     │ 66–75       │ 2200–3000
   38       │ 322–357     │ 293–346     │ 69–79       │ 2700–3600
   40       │ 329–365     │ 298–355     │ 71–82       │ 3000–4000

   PERCENTIL DO EPF: P10–P90 = adequado. <P10 = PIG/SGA. <P3 = grave.
   >P90 = GIG. Calcular via FASE 4.6 para percentil exato.

3. RASTREIO DO 1º TRIMESTRE (11+0–13+6 sem | CRL 45–84 mm — FMF)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Parâmetro              │ Normal                           │ Alerta / Ação
   ───────────────────────┼──────────────────────────────────┼────────────────────────────
   TN (Translucência Nucal)│ <3,0 mm                         │ 3,0–3,4 mm = risco aum.
                          │                                  │ ≥3,5 mm → R6
   Osso Nasal             │ Presente (visualizado)           │ Ausente = marcador T21
   Ducto Venoso (DV)      │ Onda "a" positiva                │ Ausente = risco aum.
                          │                                  │ Reversa → R6
   Regurgitação Tricúspide│ Ausente                          │ Presente = risco aumentado
   FC Fetal               │ 150–180 bpm (11–13+6 sem)        │ <110 bpm ou >200 bpm → R6
   FCF em <8 semanas      │ 100–170 bpm (escalonado por IG)  │ <100 bpm → vigilância

   RASTREIO COMBINADO 1T (risco de T21, T18, T13):
   Integra: TN + osso nasal + DV + RT + PAPP-A + β-hCG livre + IG materna.
   Risco ≥1:100 = alto risco → oferecer amniocentese ou biópsia de vilo.
   Risco 1:100–1:1000 = risco intermediário → cfDNA (NIPT).
   REGRA: TN ≥3,5 mm ou DV reverso → R6 → medicina fetal urgente.

4. MARCADORES SECUNDÁRIOS DE ANEUPLOIDIA — 2T (18–24 semanas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Relatar sistematicamente nos morfológicos 2T; nunca omitir achados:
   ┌────────────────────────────────┬─────────────────────────────────────┐
   │ MARCADOR                       │ ASSOCIAÇÃO PRINCIPAL                │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Foco ecogênico intracardíaco   │ T21 (marcador minor isolado = baixo)│
   │ (FEI / "golf ball")            │ risco; avaliar em conjunto          │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Pielectasia (pelve renal >4mm) │ T21 (marcador minor)                │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Intestino hiperecóico          │ T21, FQ, CMV, crescimento restrito  │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Hipoplasia do 5º dedo médio    │ T21                                 │
   │ (clinodactilia)                │                                     │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Hipoplasia nasal (<2,5 mm)     │ T21                                 │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Osso nasal ausente 2T          │ T21                                 │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Prega nucal ≥6 mm (15–20 sem)  │ T21 (marcador major 2T)             │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Artéria umbilical única (AUU)  │ T18, malformações associadas        │
   ├────────────────────────────────┼─────────────────────────────────────┤
   │ Cisto de plexo coroide (CPC)   │ T18 (especialmente se bilateral)    │
   └────────────────────────────────┴─────────────────────────────────────┘
   ≥2 marcadores minor → modificar LR de risco combinado → medicina fetal.

5. MORFOLOGIA ESTRUTURAL — CHECKLIST ISUOG 2022
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Relatar presença e normalidade de CADA estrutura. "NV" = não visualizado.
   ┌──────────────────────┬──────────────────────────────────────────────────┐
   │ SEGMENTO             │ ESTRUTURAS OBRIGATÓRIAS                          │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ CABEÇA / SNC         │ Forma (oval); falx cerebri; CSP (5–9 mm);        │
   │                      │ tálamos simétricos; IV3 (<10 mm);                │
   │                      │ cerebelo (diâmetro ≈ IG em mm); vermis cerebelar; │
   │                      │ cisterna magna (2–10 mm); átrio VL (<10 mm)      │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ FACE                 │ Perfil; osso nasal; lábio sup. (sem fissura);    │
   │                      │ órbitas bilaterais simétricas; palato (se poss.) │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ CORAÇÃO              │ Situs solitus; eixo 45° ± 20°; 4 câmaras equiv.; │
   │                      │ VSVE; VSVD; arco aórtico; seio coronariano;      │
   │                      │ ducto arterioso; veia cava superior/inferior      │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ TÓRAX                │ Pulmões isoecóicos simétricos; diafragma íntegro; │
   │                      │ ausência de conteúdo abdominal no tórax           │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ ABDOME               │ Estômago (visível e preenchido, D esquerdo);      │
   │                      │ parede abdominal íntegra; inserção do CU; fígado; │
   │                      │ vesícula biliar; rins bilaterais; bexiga;          │
   │                      │ intestino (sem dilatação; ecos normais)           │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ COLUNA               │ Alinhamento coronal + sagital + axial; 3 ossos   │
   │                      │ vertebrais por nível; pele íntegra cobrindo       │
   ├──────────────────────┼──────────────────────────────────────────────────┤
   │ MEMBROS              │ Úmero/rádio-ulna/fêmur/tíbia-fíbula bilaterais;  │
   │                      │ mãos (dedos abertos se possível); pés (talipes?); │
   │                      │ genitália externa (relatar se visualizada)         │
   └──────────────────────┴──────────────────────────────────────────────────┘
   ANOMALIA MAIOR → ATIVAR R6 imediatamente.

6. CIR / IUGR — Diagnóstico e Estadiamento (Protocolo de Barcelona)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEFINIÇÃO: Feto que não alcança seu potencial de crescimento geneticamente determinado.
   Critérios diagnósticos (ISUOG 2020 — Delphi Consensus):
     EPF <P3 (independente de Doppler) = CIR definitivo.
     EPF <P10 + IP AU >P95 = CIR.
     EPF <P10 + IP AUT bilateral >P95 = CIR.
     EPF <P10 + CA <P10 + RCP <P5 = CIR.

   ESTADIAMENTO — Protocolo de Barcelona (Figueras-Gratacós):
   Estadio I:   EPF/CA <P10; IP AU normal; RCP ≥P5; PI AUT normal.
   Estadio II:  IP AU >P95 ou ausência de diástole umbilical.
   Estadio III: Inversão de diástole umbilical OU DV alterado (onda "a"
                ausente/reversa) OU RCP <P5.
   Estadio IV:  DV onda "a" reversa OU desacelerações espontâneas na CTG.
   → Estadio III–IV: ATIVAR R6.

7. LÍQUIDO AMNIÓTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ILA (índice dos 4 quadrantes): Normal 8–24 cm.
   MBA (maior bolsão): Normal 2–8 cm (técnica de 1 quadrante).
   ┌────────────────────┬──────────────────────────┬──────────────────────────┐
   │ CLASSIFICAÇÃO      │ ILA (cm)                 │ MBA (cm)                 │
   ├────────────────────┼──────────────────────────┼──────────────────────────┤
   │ Oligodrâmnio grave │ <5                       │ <2                       │
   │ Oligodrâmnio limít.│ 5–8                      │ 2–3 (vigilância)         │
   │ Normal             │ 8–24                     │ 2–8                      │
   │ Polihidrâmnio mod. │ 25–35                    │ 8–11                     │
   │ Polihidrâmnio grave│ >35                      │ >11                      │
   └────────────────────┴──────────────────────────┴──────────────────────────┘
   Oligodrâmnio grave (<5 / MBA <2): ATIVAR R6.
   Polihidrâmnio: investigar DM gestacional, anomalias fetais (atresia,
     disfagia), infecção (CMV), anemia fetal, gestação múltipla.

8. DOPPLER OBSTÉTRICO — Parâmetros e interpretação
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ARTÉRIA UTERINA (AUT) — bilateralmente, ao nível do OI:
     IP médio → FASE 4.3 de general.ts. Normal 2T (20–24 sem): IP médio <1,45 (P95 FMF); 3T (28–34 sem): IP médio <0,90 (P95).
     Notch bilateral persistente >24 sem = risco de pré-eclâmpsia/CIR.
     IP >P95 bilateral = ATIVAR N3 (medicina fetal).

   ARTÉRIA UMBILICAL (AU) — amostragem em ansa livre do cordão:
     IP normal: decresce com a IG (inversamente proporcional).
     IP >P95 para IG = resistência aumentada → investigar CIR.
     AEDV — Ausência de Diástole Umbilical (Absent End-Diastolic Velocity):
       Fluxo umbilical cai a zero no fim da diástole = CIR Estadio II.
       → ATIVAR N4: hospitalização + avaliação perinatológica urgente + CTG e PBF diários.
     REDV — Reversão de Diástole Umbilical (Reversed End-Diastolic Velocity):
       Fluxo umbilical inverte na diástole = CIR Estadio III. Pior prognóstico.
       → ATIVAR R6: "ALERTA OBSTÉTRICO: reversão de diástole umbilical — CIR crítico grau III.
         Avaliação imediata para definição de via de parto com perinatologista/medicina fetal."
     REDF + DV onda "a" reversa = Estadio IV → via de parto de emergência.

   ARTÉRIA CEREBRAL MÉDIA (ACM):
     IP ACM → normalmente alto em 2T, diminui com a centralização.
     RCP = IP ACM / IP AU → calcular via FASE 4.4 de general.ts.
     RCP <1,00 = centralização (redistribuição cerebral).
     RCP <0,75 = centralização avançada confirmada → N4.
     PVS ACM (pico de velocidade sistólica): >1,50 MoM = anemia fetal → R6.
     Valores de PVS ACM por IG (MoM): usar tabelas de Mari et al.

   DUCTUS VENOSUS (DV) — pré-carga cardíaca direita:
     IP_DV normal: <1,0 (usar nomogramas por IG entre 20–34 semanas).
     IP_DV >P95 = pré-carga cardíaca aumentada → N3 (medicina fetal prioritária).
     Onda "a" DO DV (componente atrial — final da diástole):
       Positiva e anterógrada = pré-carga adequada → NORMAL.
       Ausente (zero) = início de comprometimento cardíaco direito → N4: avaliação perinatológica urgente.
       Reversa (negativa) = insuficiência cardíaca fetal iminente → ATIVAR R6 imediatamente:
         "ALERTA OBSTÉTRICO: onda 'a' reversa no ductus venosus — CIR Estadio IV — via de parto de emergência."
     REGRA: DV onda "a" reversa + REDV concomitante = índice de mortalidade fetal elevado — hospitalar urgente.

   RELAÇÃO CC/CA (Circunferência Cefálica/Abdominal):
     Cálculo → FASE 4.14 de general.ts. Interpretar neste contexto:
     <P10 antes de 32 semanas com CA baixo = CIR assimétrico — correlacionar com AU e DV.
     Elevado após 36 semanas com CA normal = macrossomia poupadora de cérebro.

   VEIA UMBILICAL (VU):
     Não pulsátil = normal. Pulsatilidade = achado de alto risco (CIR avançado, IC fetal).

9. CENTRALIZAÇÃO FETAL — Graus (Protocolo de Barcelona)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Grau 0: RCP normal (>1,00) + IP AU normal = sem centralização.
   Grau 1: RCP <1,00 + diástole umbilical presente = centralização inicial.
   Grau 2: Ausência de diástole umbilical (ADU) = centralização moderada.
   Grau 3: Reversão de diástole umbilical (REDF) OU DV alterado = crítica.
   → Grau 2–3: ATIVAR R6 — internação hospitalar + avaliação perinatal.

10. PERFIL BIOFÍSICO FETAL (PBF — Manning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Avaliação em 30 minutos. Cada parâmetro = 2 pontos (presente) ou 0 (ausente).
   ┌─────────────────────────────────────────────────────────────────────┐
   │ PARÂMETRO              │ CRITÉRIO POSITIVO (2 pontos)                │
   ├────────────────────────┼──────────────────────────────────────────── │
   │ Movimentos respiratórios│ ≥1 episódio ≥30 seg em 30 min             │
   │ Movimentos corporais   │ ≥3 movimentos de tronco/membros em 30 min  │
   │ Tônus fetal            │ ≥1 extensão + retorno à flexão em 30 min   │
   │ Líquido amniótico      │ MBA ≥2 cm em dois planos perpendiculares    │
   │ CTG (NST) — opcional   │ ≥2 acelerações de 15 bpm × 15 seg em 20 min│
   └────────────────────────┴────────────────────────────────────────────┘
   Score 8–10 = normal. 6 = vigilância. ≤4 = comprometimento → R6.
   MBA <2 cm isolado (score 8/10 sem líquido): vigilância intensiva.

11. PLACENTA — Avaliação completa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOCALIZAÇÃO: anterior / posterior / fúndica / lateral D ou E.
   ESPESSURA: normal 2–4 cm (máx. 4,5 cm). Espessamento >5 cm:
     diabetes, hidropsia, sífilis, transfusão feto-fetal.
   GRAU DE MATURIDADE (Grannum): 0 (uniforme) · I · II · III (matura).
   Grau III antes de 34 semanas = maturidade precoce → vigilância.

   INSERÇÃO DO CORDÃO: central, paracentral, marginal, velamentosa.
   Inserção velamentosa + placenta prévia = vasa prévia → R6.

   DISTÂNCIA AO OI (colo — transvaginal obrigatório se suspeita):
     ≥20 mm = normal → parto vaginal possível.
     10–19 mm = baixa inserção → re-avaliar com 36 sem.
     <10 mm = placenta prévia parcial.
     0 mm com cobertura = placenta prévia total → ATIVAR R6.

   ESPECTRO DE PLACENTA ACCRETA (EPA — suspeita ao US):
     Ausência da zona clara retro-placentária.
     Irregularidades / lacunas vasculares (Swiss cheese appearance).
     Adelgaçamento miometrial (<1 mm no segmento inferior).
     Sinal do "bulging" vesical.
     Placenta accreta suspeita → ATIVAR R6 → centro de referência.

   DESCOLAMENTO PREMATURO DE PLACENTA (DPP):
     Hematoma retroplacentário + dor súbita + sangramento.
     US pode ser FALSO-NEGATIVO no DPP → clínica prevalece.
     ATIVAR R6 sempre que clinicamente suspeito.

12. COLO UTERINO — Cervicometria (Protocolo transvaginal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VIA: transvaginal (padrão-ouro). Bexiga vazia. Transdutor gentilmente
   posicionado sem pressão excessiva no fórnice anterior.
   TÉCNICA: medir comprimento funcional do canal endocervical (OI a OE)
   em 3 medidas, registrar a menor.
   REFERÊNCIAS:
     ≥25 mm: normal (qualquer IG). <25 mm: colo curto.
     <20 mm: risco elevado parto prematuro → internação / medidas.
     <10 mm: colo muito curto → R6.
   AFUNILAMENTO ("funneling"): dilatação do OI interno (forma U ou V).
     Relatar: tipo (U/V/Y/T), comprimento e percentual de afunilamento.
     Comprimento funcional = total − comprimento do funil.
   SLUDGE AMNIÓTICO: material ecogênico no pólo inferior do SG, junto ao OI.
     Associado a risco aumentado de parto prematuro.
   DINÂMICA DO COLO: relatar se mudança durante o exame (colo que encurta
     com pressão do transdutor ou manobra de Valsalva).

13. GESTAÇÃO GEMELAR — Determinação e vigilância
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DETERMINAÇÃO DE CORIONICIDADE (melhor no 1T):
     Sinal do lambda (λ) → DICORIÔNICA DIAMNIÓTICA (DC/DA).
     Sinal do T (T-sign) → MONOCORIÔNICA DIAMNIÓTICA (MC/DA).
     MC/MA = monocoriônica monoamniótica (membrana ausente — raro, R6).
     Após 14 semanas: analisar número de placentas + espessura da membrana.

   COMPLICAÇÕES ESPECÍFICAS DAS MONOCORIÔNICAS:
   STFF (Síndrome de Transfusão Feto-Fetal — Quintero):
     Estadio I:   discordância de LA (oligohidrâmnio doador / poli receptor).
     Estadio II:  bexiga do doador ausente por >60 min.
     Estadio III: Doppler alterado (ADU ou REDF na AU / DV reverso).
     Estadio IV:  hidropsia em qualquer gemelar.
     Estadio V:   morte de qualquer gemelar.
     Estadio II–V → ATIVAR R6 urgente (fetosc. a laser em centro de ref.).

   TAPS (Anemia-Policitemia por Transfusão — Twin Anemia-Polycythemia Sequence):
     PVS-ACM >1,5 MoM no doador + PVS-ACM <1,0 MoM no receptor.
     Sem critério STFF (LA normal) → TAPS. → N4 → medicina fetal.

   VIGILÂNCIA GEMELAR:
     DC/DA: US biometria a cada 4 semanas a partir de 24 sem.
     MC/DA: US a cada 2 semanas a partir de 16 sem (STFF).
     MC/MA: semanal a partir de 26 sem (risco entrelaçamento cordões).

   DISCORDÂNCIA DE CRESCIMENTO (DC): (EPF maior − EPF menor) / EPF maior × 100.
     ≥20% = discordância significativa → investigar STFF/CIR seletivo.
     ≥25% = grave → medicina fetal urgente.

14. ECOCARDIOGRAMA FETAL — Vistas essenciais
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   (Protocolo detalhado no template de Camada 3 — ECOCARDIOGRAMA FETAL)
   VISTAS MÍNIMAS (ISUOG / FMF):
     4 câmaras: tamanho, posição, eixo; septo IV e IA.
     Via de saída esquerda (VSVE): relação AO/VE.
     Via de saída direita (VSVD): relação AP/VD; bifurcação pulmonar.
     Arco aórtico (coronal): "bastão de hóquei".
     Arco ductal (sagital): continuidade da AP com AO descendente.
     Veias cavas (superior e inferior) → AD.
     Veia umbilical → DV → VCI → AD.
   ÍNDICE CARDIOTORÁCICO: normal 0,25–0,35 (área coração/área tórax).
   EIXO CARDÍACO: normal 45° ± 20° (apontando para hemitórax E).

15. NEUROSSONOGRAFIA FETAL — Estruturas-chave
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   (Protocolo avançado no template de Camada 3 — NEUROSSONOGRAFIA FETAL)
   AVALIAÇÃO BÁSICA (todo morfológico 2T):
     Ventrículos laterais (átrio): <10 mm. 10–12 mm = ventriculomegalia leve.
     >15 mm = ventriculomegalia grave → R6.
     CSP (cavum septo pelúcido): ausente = suspeita de defeito de linha média.
     Cerebelo: diâmetro ≈ IG em mm (20 sem = 20 mm). Vermis presente.
     Cisterna magna: 2–10 mm. <2 mm = Chiari tipo II (mielomeningocele).
       >10 mm = mega cisterna magna ou Dandy-Walker.
   NEUROSSONOGRAFIA AVANÇADA (18–26 sem, TV ou transfontanela):
     Sulcação cortical (desenvolve-se 20–38 sem); corpo caloso (12–20 sem);
     córtex periventricular (ecogenicidade aumentada = germinal matrix).
     Transvaginal: melhor para estruturas de linha média e fossa posterior.

16. CONDIÇÕES AGUDAS — Gatilhos R6 / N4 obrigatórios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌────────────────────────────────────┬──────────────────────────────────────┐
   │ CONDIÇÃO                           │ GATILHO R6                           │
   ├────────────────────────────────────┼──────────────────────────────────────┤
   │ Ausência de BCF (óbito fetal?)     │ Silêncio cardíaco + ausência de mov. │
   │ Anomalia estrutural maior          │ Qualquer anomalia potencialmente letal│
   │ TN ≥3,5 mm ou DV reverso 1T       │ Rastreio de aneuploidia crítico       │
   │ CIR Estadio III ou IV              │ Doppler crítico (REDF, DV reverso)    │
   │ Oligodrâmnio grave (MBA <2 cm)     │ + contexto clínico                   │
   │ STFF Estadio II–V                  │ Qualquer estadio com necessidade laser│
   │ Hidropsia fetal                    │ Qualquer etiologia                   │
   │ Placenta prévia total              │ Sangramento / 3T sem re-avaliação    │
   │ Placenta accreta suspeita          │ Sinal US + cicatriz uterina          │
   │ DPP clinicamente suspeito          │ Independente do US                   │
   │ PVS ACM >1,5 MoM                  │ Anemia fetal suspeita                │
   │ Colo <10 mm                        │ Risco de parto prematuro iminente    │
   │ Vasa prévia suspeita               │ Vasos fetais sobre o OI              │
   └────────────────────────────────────┴──────────────────────────────────────┘
   FRASEOLOGIA R6 OBSTÉTRICA: "ALERTA OBSTÉTRICO: [achado]. Avaliação
   imediata com perinatologista/medicina fetal/serviço de alto risco."

17. TABELA MESTRA DE REFERÊNCIA — Medicina Fetal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Estrutura / Parâmetro   │ Normal                    │ Alerta / Ação
   ────────────────────────┼───────────────────────────┼────────────────────────
   TN (11–13+6 sem)        │ <3,0 mm                   │ ≥3,5 mm → R6
   Átrio VL (2T)           │ <10 mm                    │ ≥10 mm = ventricomeg.
   Cisterna magna (2T)     │ 2–10 mm                   │ <2 ou >10 mm = avall.
   Prega nucal (15–20 sem) │ <6 mm                     │ ≥6 mm = marcador T21
   ILA                     │ 8–24 cm                   │ <5 cm ou >25 cm → R6
   MBA                     │ 2–8 cm                    │ <2 cm → R6
   IP AU (IG-dependente)   │ <P95 para IG              │ ADU ou REDF → R6
   RCP                     │ >1,00                     │ <1,00 = centralização
   PVS ACM                 │ <1,50 MoM                 │ >1,50 MoM → R6 (anemia)
   Onda "a" DV             │ Positiva (anterógrada)    │ Ausente/reversa → R6
   Colo uterino (TV)       │ ≥25 mm                    │ <20 mm → internação
   FC fetal (11–13+6)      │ 150–180 bpm               │ <110 ou >200 bpm → R6
   PBF (Manning)           │ 8–10 pontos               │ ≤4 → R6
   Dist. placenta ao OI    │ ≥20 mm                    │ <10 mm = pl. prévia → R6
   Espessura placenta      │ 2–4,5 cm                  │ >5 cm = investigar

18. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Exame normal: "Recomenda-se seguimento pré-natal conforme protocolo obstétrico habitual."
   1T normal: "Exame dentro dos parâmetros de normalidade para a idade gestacional."
   TN 3,0–3,4 mm: "Risco aumentado de aneuploidia — consulta com medicina fetal para rastreio combinado."
   TN ≥3,5 mm / DV reverso: ATIVAR R6 — "ALERTA OBSTÉTRICO: rastreio crítico 1T — medicina fetal urgente."
   Morfológico normal 2T: "Avaliação morfológica sem anomalias identificadas; seguimento pré-natal habitual."
   Anomalia estrutural maior: ATIVAR R6 — "ALERTA OBSTÉTRICO: anomalia fetal — centro de referência perinatal."
   Marcador minor isolado: "Marcador minor de aneuploidia — correlação com rastreio sérico e risco combinado."
   ≥2 marcadores minor: "Medicina fetal para avaliação de risco modificado — considerar cfDNA ou amniocentese."
   CIR Estadio I: "Restrição de crescimento fetal — vigilância biométrica e Doppler em 2 semanas."
   CIR Estadio II: ATIVAR N4 — "CIR avançado — avaliação perinatológica urgente (hospitalização)."
   CIR Estadio III–IV: ATIVAR R6 — "ALERTA OBSTÉTRICO: CIR crítico — avaliação para via de parto imediata."
   Centralização parcial (Grau 1): "Vigilância Doppler em 7 dias + avaliação perinatológica."
   Centralização crítica (Grau 3): ATIVAR R6 — "ALERTA OBSTÉTRICO: centralização crítica — internação urgente."
   PVS ACM >1,50 MoM: ATIVAR R6 — "ALERTA OBSTÉTRICO: anemia fetal suspeita — medicina fetal urgente."
   Líquido no limite inferior (ILA 5–8 / MBV 2–3): "Vigilância clínica e US em 3–7 dias + hidratação materna." (NÃO caracteriza oligodrâmnio franco — SMFM 2021 prefere MBV; oligo franco = ILA <5 ou MBV <2.)
   Oligodrâmnio (ILA <5 ou MBV <2): "Avaliação obstétrica — investigar etiologia (RPMO, insuficiência placentária, malformação renal)." Se grave (<2 cm MBV em IG prematura): ATIVAR R6 — "ALERTA OBSTÉTRICO: oligodrâmnio grave — avaliação obstétrica imediata."
   Polihidrâmnio moderado: "Investigar diabetes, anomalias fetais, infecção fetal; avaliação obstétrica."
   Placenta prévia: "Seguimento obstétrico especializado; abstinência sexual; parto cesáreo programado."
   Placenta accreta suspeita: ATIVAR R6 — "ALERTA OBSTÉTRICO: accreta suspeita — centro de referência materno-fetal."
   STFF Estadio I: "Vigilância intensiva MC/DA — US em 1 semana; medicina fetal."
   STFF Estadio II–V: ATIVAR R6 — "ALERTA OBSTÉTRICO: STFF avançado — fetosc. a laser em centro de ref. urgente."
   Colo curto (<25 mm): "Avaliação perinatológica — cervicagem ou progesterona vaginal conforme IG e indicação."
   Colo <10 mm: ATIVAR R6 — "ALERTA OBSTÉTRICO: colo muito curto — internação e avaliação obstétrica."

19. REGRAS TRANSVERSAIS — APLICÁVEIS A TODOS OS 9 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   a. LEI DE SEGURANÇA FETAL: NUNCA inventar biometria. Manter "(…)" exatamente.
   b. UNIDADES: todas as medidas fetais em MILÍMETROS (mm).
   c. IG DE REFERÊNCIA: sempre usar a IG calculada pelo US do 1T (ou FIV).
      Nunca recalcular pela DUM se US 1T disponível.
   d. DATAÇÃO: EPF e percentil são interpretados sempre pela IG de referência,
      não pela IG calculada no exame atual (evita viés de IUGR vs. macrossomia).
   e. "NV" (não visualizado): declarar explicitamente para cada estrutura não
      identificada. Não omitir — a ausência tem significado clínico.
   f. ANOMALIA = R6: qualquer anomalia estrutural maior ativa R6 imediatamente.
   g. SÍNTESE DOPPLER (exames com Doppler): obrigatória na conclusão, mesmo normal.
   h. MÚLTIPLA GESTAÇÃO: sempre declarar corionicidade e amnionicidade.
      Monocoriônica sem corionicidade determinada = R6 (medicina fetal urgente).
   i. ORDEM DA CONCLUSÃO: N4 → N3 → N2 → N1 → N0. Nunca inverter.`,

  // ═══════════════════════════════════════════════════════════════
  // GINECOLOGIA
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area ginecologia
   * @scope Pélvico Feminino (TV/TA), Transvaginal, Morfologia Uterina,
   *        Cistos Ovarianos, SOMP, Endometriose, Miomatose, etc.
   */
  'ginecologia': `DIRETRIZES CLÍNICAS — GINECOLOGIA (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: CBR · SBUS · FEBRASGO · ACR O-RADS · IOTA · MUSA · IETA
             ISUOG · IDEA · FIGO PALM-COEIN · ESHRE · RSNA 2024
AUTOCÁLCULOS: Volume uterino / ovariano (elipsoide) → FASE 4 de general.ts.
              NÃO recalcular; apenas interpretar o resultado gerado.

MAPA DE EXAMES DESTA ÁREA (5 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ PÉLVICO TRANSVAGINAL           — Gold standard morfológico         │
  │ PÉLVICO TV COM DOPPLER         — Idem + vascularização focal       │
  │ PÉLVICO VIA ABDOMINAL          — Bexiga repleta, útero/ovários     │
  │ PÉLVICO VA COM DOPPLER         — Idem + artérias uterinas + anexos │
  │ PESQUISA DE ENDOMETRIOSE       — Mapeamento EP profunda + #Enzian  │
  └────────────────────────────────────────────────────────────────────┘
  PRINCÍPIO FUNDAMENTAL: O contexto hormonal da paciente (fase do ciclo,
  pré/pós-menopausa, TH, tamoxifeno, ACO) é o MODULADOR DE TODA INTERPRETAÇÃO.
  Ausência de DUM = declarar limitação diagnóstica explicitamente no laudo.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. O-RADS — Classificação de Risco Anexial (ACR 2022) — OBRIGATÓRIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REGRA: Toda formação anexial deve ser classificada por O-RADS (exceto
   folículos <3 cm em menacme e corpo lúteo típico, que são fisiológicos).

   O-RADS 0 — Inconclusivo: exame tecnicamente limitado — recomendar TV.
   O-RADS 1 — Normal: ovário de aspecto normal, sem formação anexial.
   O-RADS 2 — Benigno (<1% risco): Cisto simples <10 cm. Cisto hemorrágico
     <10 cm em age fértil. Dermóide típico (hiperecóico, sombra). Endometrioma
     típico ("vidro fosco", bilocular, sem nódulo). Cisto paraovárico <10 cm.
   O-RADS 3 — Baixo risco (1–10%): Cisto simples ≥10 cm. Multiloculado puro
     <10 cm sem componente sólido. Dermóide atípico.
   O-RADS 4 — Risco intermediário (10–50%): Cisto multiloculado-sólido.
     Componente sólido com PD interno. Massa com ascite moderada.
   O-RADS 5 — Alto risco (≥50%): Componente sólido irregular com PD.
     Implantes peritoneais. Carcinomatose suspeita. Nódulo >3 cm intracístico.

   CONDUTA O-RADS:
     O-RADS 0: complementar com TV (se abdominal) ou RM.
     O-RADS 1–2: seguimento conforme ciclo e protocolo clínico.
     O-RADS 3: controle US 3–6 meses (persistência ou crescimento → RM).
     O-RADS 4: RM pélvica + avaliação ginecológica especializada.
     O-RADS 5: ATIVAR N3 → ginecologia oncológica (+ CA-125, HE4, RM).

   NOTA SOBRE DOPPLER EM O-RADS:
     "Fluxo interno" (PD) eleva O-RADS: componente sólido COM PD interno
     sobe de O-RADS 3 para O-RADS 4. NUNCA usar Doppler ausente como critério
     de benignidade em lesão sólida (alguns COEs têm PD escasso).

2. ÚTERO — Parâmetros obrigatórios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES: comprimento (longitudinal) × altura (AP) × largura (transverso).
   Volume uterino normal: 60–130 cm³ (nuligesta). >200 cm³ = útero volumoso.
   POSIÇÃO: anteversoflexão (AVF) — normal. Retrovertido (RVF) — relatar.
   CONTORNOS: regulares = normal; bosselados = miomatose.

   ADENOMIOSE — Critérios MUSA (relatar quantos sinais presentes):
     Minor: linhas miometriais hiperecóicas, "ilhas" miometriais, sangue em
       miométrio (eco hiperecóico laminar), cistos miometriais anecoicos.
     Major: apagamento/irregularidade da zona juncional (ZJ), espessamento assimétrico
       do miométrio, sombras em leque ("fan-shaped shadowing"), globosidade
       uterina sem nódulo definido.
     Diagnóstico US de adenomiose: ≥3 sinais minor OU ≥1 sinal major.
     Difusa (envolvimento difuso do miométrio) ou focal (adenomioma).
     CRITÉRIO ADICIONAL DE RM (quando solicitada confirmação):
       Zona Juncional (ZJ) ≥12 mm no T2 = adenomiose definitiva por RM.
       ZJ 8–11 mm = adenomiose indeterminada por RM — correlacionar com clínica.
       ZJ <8 mm = adenomiose improvável por RM.
     → Confirmação padrão-ouro: RM pélvica com sequências T2 sagital, DWI e T1 com fat-sat.

   MALFORMAÇÕES UTERINAS (ao suspeitar → RM pélvica + correlação ESHRE/ESGE):
     Útero unicorno (cavidade única assimétrica). Útero didelfo (dois colos).
     Útero bicorno (2 cavidades com septo miometrial externo). Septado
     (deformidade interna com fundo plano/côncavo). Arcuado (deformidade leve).
     → Ao US: descrever morfologia. NUNCA classificar sem RM de confirmação.

3. MIOMAS — Classificação FIGO PALM-COEIN (obrigatória)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌────┬──────────────────────────────────────────────────────────┐
   │FIGO│ LOCALIZAÇÃO                                              │
   ├────┼──────────────────────────────────────────────────────────┤
   │  0 │ Submucoso pediculado (inteiro na cavidade)               │
   │  1 │ Submucoso séssil (<50% intramural)                       │
   │  2 │ Submucoso séssil (≥50% intramural)                       │
   │  3 │ Intramural em contato com o endométrio                   │
   │  4 │ Intramural puro (sem contato com endométrio ou serosa)   │
   │  5 │ Subseroso séssil (≥50% intramural)                       │
   │  6 │ Subseroso séssil (<50% intramural)                       │
   │  7 │ Subseroso pediculado                                     │
   │  8 │ Parasita ou localização especial (colo, lig. largo)      │
   └────┴──────────────────────────────────────────────────────────┘
   Relatar: nódulo dominante (3 eixos + FIGO), número estimado (se múltiplos).
   FIGO 0–2: impacto na cavidade → relatar distorção/compressão endometrial.
   Crescimento em pós-menopausa: relatar e recomendar avaliação oncológica
   (raros sarcomas uterinos simulam mioma em crescimento pós-menopausa).

4. DIU — Avaliação sistemática
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Tópico (normal): corpo alinhado com o eixo longitudinal uterino; haste
     horizontal na porção superior da cavidade; distância fundo-haste ≤10 mm;
     braços do DIU sem contato com o orifício interno (OI).
   Deslocado parcial: corpo no canal endocervical ou haste tocando o OI.
   Deslocado total: DIU não visualizado na cavidade → abdome/pelve para excluir
     migração transmiometrial. Radiografia simples abdome se não localizado.
   REGRA: DIU deslocado OU não visualizado → avaliação ginecológica imediata.
   SIU hormonal: relatar se apenas haste visível (ecos lineares hiperecóicos) —
     braços não visíveis ao US transvaginal é esperado em SIU tipo Mirena.

5. ENDOMÉTRIO — Interpretação por status hormonal (IETA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ESPESSURA NORMAL POR FASE:
     Menstrual (D1–D4): 4–8 mm (eco hiperecóico irregular com ecos sangue).
     Proliferativa precoce (D5–D9): 4–8 mm, trilaminar hipoecoico.
     Proliferativa tardia (D10–D14): 8–12 mm, trilaminar bem definido.
     Secretora (D15–D28): 10–16 mm, hiperecóico homogêneo.
     Pós-menopausa SEM terapia hormonal (TH): ≤5 mm.
     Pós-menopausa COM TH cíclica: até 8 mm. COM TH contínua: até 6 mm.
     Em uso de tamoxifeno: espessamento comum — comparar com pré-tratamento.

   ESPESSAMENTO ENDOMETRIAL — Conduta por status:
     Pré-menopausa >16 mm ou espessamento focal → correlação clínica + SHG.
     Pós-menopausa >5 mm sem sangramento → controle US em 6 meses.
     Pós-menopausa >5 mm COM sangramento → histeroscopia diagnóstica (urgente).

   CARACTERÍSTICAS IETA (descrever se aplicável):
     Linha central (eco central): interrompida ou não. Endométrio homogêneo
     ou heterogêneo. Interface endo-miometrial: regular ou irregular.
     Cavidade uterina: livre, hematometra (líquido anecóico), piometra
     (líquido com ecos), pólipo (focal hiperecóico com PD pedicular).

   PÓLIPO ENDOMETRIAL: foco hiperecóico, base larga ou pediculado, PD no
     pedículo. Diferenciar de aderência (sem PD) e carúncula decidual.
     → Relatar dimensões + PD; indicar SHG ou histeroscopia diagnóstica.

6. OVÁRIOS — Avaliação morfológica obrigatória
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES NORMAIS:
     Menacme: volume 3–10 cm³ (eixos: ~3 × 2 × 2 cm). >10 cm³ = aumentado.
     Pós-menopausa: volume <3 cm³; ovários podem não ser visualizados (normal).
     Ovário não visualizado: declarar "não caracterizado ao estudo atual."

   CISTOS FUNCIONAIS — fisiológicos em menacme (classificar como O-RADS 2):
     Folículo dominante: anecoico ≤3 cm, parede fina, sem PD interno.
     Corpo lúteo: parede espessada hiperecóica, conteúdo heterogêneo, "anel
       de fogo" ao PD periférico; ressecção espontânea em 4–8 semanas.
     Cisto hemorrágico: conteúdo reticulado "rede de aranha" ou "tela de
       vidro"; sem PD interno; resolução em 6–12 semanas — O-RADS 2.
     Acima de 50 anos: NÃO classificar nenhum cisto como funcional. Aplicar
     O-RADS rigoroso mesmo para cistos aparentemente simples.

   SOMP — Síndrome Ovariana Metabólica Poliendócrina — Critério ultrassonográfico (Rotterdam 2003, atualizado 2018):
     ≥20 folículos de 2–9 mm por ovário OU volume ovariano >10 cm³.
     Relatar: "Morfologia compatível com ovários policísticos, sugestiva de SOMP
     (Síndrome Ovariana Metabólica Poliendócrina). Correlação clínica e laboratorial
     (critérios de Rotterdam) para diagnóstico definitivo."
     ATENÇÃO: SOMP ao US isolado NÃO é diagnóstico — requer hiperandrogenismo
     clínico/bioquímico ou oligoanovulação para diagnóstico de Rotterdam.

7. TROMPAS UTERINAS — Achados e conduta
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Normal: trompas não visíveis ao US é esperado (invisíveis sem patologia).
   HIDROSSALPINGE — Estadiamento funcional ao US:
     Grau I (leve): estrutura tubular alongada, anecoica, paredes finas (<3 mm);
       leve tortuosidade; pregas mucosas visíveis (sinal das pregas). Conduta: avaliação ginecológica.
     Grau II (moderado): tubulação tortuosa, paredes espessadas (3–5 mm), conteúdo levemente ecogênico;
       pregas mucosas parcialmente preservadas. Conduta: avaliação ginecológica + histerossalpingografia.
     Grau III (grave/complexo): tuba distendida e septada (pseudo-septada por pregas fusionadas),
       paredes espessadas irregulares, conteúdo com debris/ecos internos; ovário frequentemente aderido.
       Conduta: ginecologia especializada — avaliar salpingectomia antes de FIV (impacto na implantação).
     → Qualquer grau + dor pélvica aguda + febre: ATIVAR R6 — suspeita de piosalpinge ou DIP aguda.
   PIOSALPINGE: semelhante à hidrossalpinge, porém com conteúdo ecogênico denso (pus). ATIVAR R6 se
     + dor aguda + febre (DIP/abscesso tubo-ovariano). Fraseologia: "ALERTA INFECCIOSO: piosalpinge
     suspeita — internação para antibioticoterapia IV e avaliação para drenagem cirúrgica."
   ABSCESSO TUBO-OVARIANO (ATO): massa complexa, espessa, heterogênea,
     com ovário incluído ou adjacente. ATIVAR R6 — internação e ATB IV.
   GESTAÇÃO ECTÓPICA TUBÁRIA: anel hiperecóico (sinal do "anel de fogo"),
     embrião ou saco gestacional paraovário, útero vazio + β-hCG positivo.
     ATIVAR R6 imediatamente (risco de ruptura e choque hemorrágico).

8. COLO UTERINO — Avaliação sistemática
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES: colo normal 3–4 cm de comprimento; canal endocervical <3 mm.
   CISTOS DE NABOTH: cistos de retenção, anecoicos, <1 cm, parede fina,
     sem PD interno. Variante normal. Múltiplos e confluentes = síndrome de
     Naboth exuberante — relatar sem alarmar.
   COLO VOLUMOSO (>4 cm): investigar leiomioma cervical, pólipo endocervical.
   CARCINOMA DE COLO: lesão hipoecoica irregular no colo, invasão de paramétrio
     ao Doppler. → N3: encaminhamento ginecológico oncológico urgente.
   CERVICOMETRIA (fora de gestação): rotineiramente não indicada; medir apenas
     se solicitado clinicamente.

9. FUNDO DE SACO / PERITÔNIO / LÍQUIDO LIVRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LÍQUIDO NO FSD (fisiológico): laminar <5 mm, anecóico, periovulatório.
   Liquido moderado (5–30 mm): correlação clínica; causas: ovulação, ascite,
     EP, aderências com coleção.
   Líquido acentuado (>30 mm) OU com ecos internos (sangue, pus):
     ATIVAR R6 — possível hemoperitoneo ou peritonite.
   OBLITERAÇÃO DO FSD: sinal do "deslizamento negativo" ausente (teste de
     mobilidade da serosa); suspeita de endometriose profunda ou aderências.
   ASCITE: documentar em todos os compartimentos (sub-hepático, periesplénico,
     goteiras, FSD, goteiras pélvicas laterais). Ascite nova com massa → R6.

10. ENDOMETRIOSE — Rastreio em Exames Padrão e Classificação ENZIAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NB: Mapeamento definitivo requer template "PESQUISA DE ENDOMETRIOSE" (Camada 3).
   Em exames pélvicos padrão (TV/VA), RASTREAR estes sinais:

   ENDOMETRIOMA OVARIANO: formação cística de conteúdo homogêneo "vidro fosco"
     (ecos difusos de baixa amplitude), parede espessa; bilateral em 30%.
     Classificar em O-RADS: típico = O-RADS 2; nódulo mural papilífero = O-RADS 4.
     > 4 cm ou bilateral: avaliação especializada + RM.

   ENDOMETRIOSE PROFUNDA — sinais indiretos ao US padrão:
     Nódulos hipoecoicos no septo retovaginal (SRV) ou ligamentos uterossacros (LUS).
     Espessamento da parede anterior do retossigmoide (normal <5 mm; >5 mm = suspeito).
     FSD obliterado (deslizamento negativo = teste de mobilidade negativo).
     Ovários aderidos ao útero ou lateralmente fixos ("kissing ovaries" = EP bilateral avançada).
     Hidrossalpinge, aderências pélvicas e bexiga com nódulo de implante.

   CLASSIFICAÇÃO #ENZIAN (Endometriose Profunda — template PESQUISA DE ENDOMETRIOSE):
     Utilizar no mapeamento específico (não no exame padrão). Compartimentos:
     A — Compartimento Anterior (bexiga/ureter distal): A1 (<1 cm), A2 (1–3 cm), A3 (>3 cm);
     B — Compartimento Lateral (ligamentos paracervicais, ureter médio):
         B1 (<1 cm), B2 (1–3 cm), B3 (>3 cm — envolvimento ureteral com hidronefrose);
     C — Compartimento Posterior (SRV, vagina posterior, reto/sigmoide):
         C1 (<1 cm, SRV/vagina), C2 (1–3 cm, parede retal), C3 (>3 cm, lúmen retal);
     FA — Ovário direito com endometrioma; FB — Ovário esquerdo com endometrioma;
     FU — Útero com adenomiose; FI — Alça intestinal além do retossigmoide;
     FO — Forame obturatório; FN — Nervo ciático (rara, dor ciática cíclica).
     Relatar cada compartimento positivo: ex. "C2, FU, FB — EP profunda com adenomiose associada."
     → Encaminhar ginecologista especializado em endometriose. RM pélvica completa obrigatória.

   CONDUTA: Sinais suspeitos → recomendar US específico com preparo intestinal
     (template PESQUISA DE ENDOMETRIOSE) + avaliação por ginecologista especializado em EP.

11. DOPPLER GINECOLÓGICO — Parâmetros (exames COM Doppler)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Aplicar nos exames: PÉLVICO TV COM DOPPLER e PÉLVICO VA COM DOPPLER.

   ARTÉRIAS UTERINAS (medição no istmo lateral, ao nível do OI):
     Fase proliferativa: IR 0,80–0,95; IP >2,0 (alta resistência fisiológica).
     Fase secretora: IR 0,70–0,85; IP 1,5–2,5.
     Pós-menopausa: IR >0,80–0,95 (muito alta resistência).
     IR <0,60 bilateral = hipervascularização (adenomiose, processos inflamatórios,
       malignidade) → correlação clínica e histológica.
     IR assimétrico (Δ >0,1): suspeita de estenose ipsilateral ou compressão.

   DOPPLER SUBENDOMETRIAL (zona de junção / periferia endometrial):
     Fluxo subendometrial fisiológico = presente em fase secretora.
     Fluxo intra-endometrial: SUSPEITO — pode indicar pólipo, neoplasia.
     Ausência total de PD no endométrio não é critério de benignidade.

   DOPPLER ANEXIAL / MASSA OVARIANA:
     Componente sólido com PD interno → eleva O-RADS.
     Anel de fogo periférico = corpo lúteo típico (O-RADS 2).
     PD caótico, irregular, central → neoplasia suspeita (O-RADS 4–5).
     Resistência muito baixa (IR <0,40) + fluxo exuberante → carcinoma?

   TORÇÃO OVARIANA (emergency Doppler):
     AUSÊNCIA DE PD no ovário aumentado + dor aguda = altamente suspeito.
     PD PRESENTE não exclui torção (pode estar no início ou parcial).
     ATIVAR R6 se ovário aumentado >4 cm + sem PD + dor aguda.

   SÍNTESE DOPPLER NA CONCLUSÃO (obrigatória em exames COM Doppler):
     Normal: "Estudo Doppler das artérias uterinas e anexos sem evidências de
     alterações hemodinâmicas significativas ao presente exame."
     Alterado: descrever IR/IP por lado + achado específico + nível N.

12. CONDIÇÕES AGUDAS — Gatilhos R6 / N4 obrigatórios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌──────────────────────────────────────────────────────────────────┐
   │ CONDIÇÃO                     │ GATILHO R6                        │
   ├──────────────────────────────┼───────────────────────────────────┤
   │ Gestação ectópica suspeita   │ Massa anexial + útero vazio + βHCG│
   │ Torção ovariana              │ Ovário ≥4 cm + dor + PD ausente   │
   │ Cisto roto com hemoperitoneo │ FSD com sangue + instabilidade    │
   │ Abscesso tubo-ovariano (ATO) │ Massa complexa + febre + dor      │
   │ Aborto retido                │ SG >25 mm sem embrião / CCN≥7 sem BCF│
   │ Torção de pedículo de mioma  │ Mioma pediculado + dor intensa    │
   └──────────────────────────────┴───────────────────────────────────┘
   FRASEOLOGIA R6: "ALERTA [CONDIÇÃO]: [conduta imediata imperativa]."
   Exemplos:
   ECTÓPICA: "ALERTA OBSTÉTRICO: suspeita de gestação ectópica — avaliação
     ginecológica e obstétrica emergencial imediata."
   TORÇÃO: "ALERTA CIRÚRGICO: suspeita de torção ovariana — avaliação
     ginecológica urgente para destorção laparoscópica."
   HEMOPERITONEO: "ALERTA CIRÚRGICO: coleção pélvica com ecos internos
     sugestivos de hemoperitoneo — avaliação emergencial imediata."
   ATO: "ALERTA INFECCIOSO: abscesso tubo-ovariano — internação para
     antibioticoterapia IV e avaliação para drenagem cirúrgica."

13. TABELA DE REFERÊNCIA — Dimensões e parâmetros normais
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Estrutura                  │ Normal                          │ Alerta / Ação
   ───────────────────────────┼─────────────────────────────────┼────────────────────────────
   Útero (nulípara)           │ 6–8 × 4 × 3 cm · Vol 60–100 cm³│ >200 cm³ = volumoso
   Útero (multípara)          │ 8–10 × 5 × 4 cm · Vol ≤130 cm³ │ >300 cm³ = miomatose imp.
   Endométrio – proliferativo │ 6–12 mm                         │ >14 mm = investigar
   Endométrio – secretório    │ 10–16 mm                        │ >18 mm = investigar
   Endométrio – pós-meno s/TH │ ≤5 mm                           │ >5 mm + sangram. → histo
   Endométrio – pós-meno c/TH │ ≤8 mm (cíclica) / ≤6 mm (cont) │ acima = investigar
   Ovário (menacme)           │ 3–10 cm³ (≈3×2×2 cm)           │ >10 cm³ = aumentado
   Ovário (pós-menopausa)     │ <3 cm³                          │ visível e >3 cm³ = attn
   Colo uterino               │ 3–4 cm comprimento              │ >4 cm = investigar
   Canal endocervical         │ ≤3 mm                           │ >5 mm = investigar
   FSD (líquido fisiológico)  │ ≤5 mm laminar anecóico          │ >5 mm ou ecos → N2–N4
   IR artéria uterina         │ 0,80–0,95 (proliferativo)       │ <0,60 bilateral → N2–N3

14. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Exame normal: "Seguimento ginecológico habitual conforme protocolo da paciente."
   Cisto funcional <3 cm: "Controle ultrassonográfico após o próximo ciclo menstrual."
   Cisto simples 3–5 cm: "Controle US em 6–8 semanas (persistência ou crescimento → RM)."
   Cisto simples >5 cm: "Controle US em 3 meses; se persistente → RM pélvica."
   Cisto simples pós-menopausa: "Correlação com CA-125 e HE4; controle US em 3 meses."
   O-RADS 3: "Controle US pélvico em 3–6 meses; se crescimento → RM pélvica."
   O-RADS 4: "RM pélvica com contraste + avaliação ginecológica especializada."
   O-RADS 5: ATIVAR N3 — "Encaminhamento para ginecologia oncológica. RM + CA-125 + HE4."
   Endometrioma: "Seguimento clínico e US semestral com ginecologista especializado em EP."
   Endometrioma >4 cm ou bilateral: "Avaliação especializada (ginecologia endometriose) + RM."
   Adenomiose suspeita: "RM pélvica com sequências de difusão para confirmação e mapeamento."
   Mioma FIGO 0–2: "Avaliação ginecológica — histeroscopia diagnóstica/terapêutica."
   Mioma FIGO 3–5: "Avaliação ginecológica para planejamento (miomectomia / UFE / SIU)."
   Mioma em crescimento pós-menopausa: "Avaliação oncológica (excluir sarcoma uterino)."
   DIU deslocado: "Avaliação ginecológica imediata para reposicionamento ou retirada."
   Endométrio pós-meno >5 mm s/ sangramento: "Controle US em 6 meses; se >8 mm → histo."
   Endométrio pós-meno >5 mm c/ sangramento: "Histeroscopia diagnóstica urgente."
   Pólipo endometrial: "SHG (sonoistero) ou histeroscopia diagnóstica para confirmação."
   SOMP morfológico: "Correlação clínica e laboratorial para diagnóstico de SOMP (Síndrome Ovariana Metabólica Poliendócrina) — critérios de Rotterdam completos."
   Hidrossalpinge: "Avaliação ginecológica para investigação de DIP / infertilidade."
   Piosalpinge / ATO: ATIVAR R6 — "ALERTA INFECCIOSO: internação + ATB IV + avaliação cirúrgica."
   Gestação ectópica suspeita: ATIVAR R6 — "ALERTA OBSTÉTRICO: avaliação emergencial."
   Torção ovariana suspeita: ATIVAR R6 — "ALERTA CIRÚRGICO: destorção laparoscópica urgente."
   FSD com hemoperitoneo: ATIVAR R6 — "ALERTA CIRÚRGICO: avaliação emergencial imediata."
   Aborto retido: ATIVAR R6 — "ALERTA OBSTÉTRICO: avaliação ginecológica urgente."
   EP profunda suspeita: "US pélvico com preparo intestinal (template específico de endometriose)."
   Malformação uterina suspeita: "RM pélvica com contraste (classificação ESHRE/ESGE definitiva)."

15. REGRAS TRANSVERSAIS — APLICÁVEIS A TODOS OS 5 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   a. STATUS HORMONAL: É OBRIGATÓRIO correlacionar com DUM / menopausa / TH.
      Sem DUM → declarar limitação diagnóstica no laudo.
   b. O-RADS: Toda formação anexial com característica além de folículo
      fisiológico ou corpo lúteo típico DEVE receber classificação O-RADS.
   c. FIGO: Todo nódulo miometrial diagnosticado DEVE ser classificado por FIGO.
   d. VIA ABDOMINAL: Relatar limitação inerente; recomendar complementação TV
      sempre que achado inconclusivo ou necessitar de melhor caracterização.
   e. PÓS-MENOPAUSA: Aplicar limiares mais restritivos para endométrio (<5 mm)
      e ovários (<3 cm³). Cisto simples em pós-menopausada ≠ fisiológico.
   f. DOPPLER (exames específicos): Síntese hemodinâmica obrigatória na conclusão.
   g. ORDEM DA CONCLUSÃO: N4 (urgência) → N3 (oncológico) → N2 (seguimento)
      → N1 (benigno incidental) → N0 (normal). Nunca inverter.
   h. PROIBIÇÃO: Nunca afirmar histologia (ex: "carcinoma"). Usar "suspeita de",
      "compatível com", "aspecto ultrassonográfico sugestivo de".`,

  // ═══════════════════════════════════════════════════════════════
  // VASCULAR
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area vascular
   * @scope Doppler arterial e venoso, carótidas, aorta, MMII,
   *        renais, viscerais, TVP, aneurismas.
   */
  'vascular': `DIRETRIZES CLÍNICAS — VASCULAR (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: SVB · ESC/ESVS 2023 · AHA/ACC · NASCET · SRU · ACEP
             SVS · AVF · CBR · SBUS · RSNA Vascular 2024

MAPA DE EXAMES DESTA ÁREA (8 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ DOPPLER CARÓTIDAS E VERTEBRAIS — EMI, placa, NASCET, roubo        │
  │ DOPPLER ARTÉRIAS OFTÁLMICAS    — AO, ACR, CRAO, pressão ocular    │
  │ DOPPLER AORTO-ILÍACO           — AAA, ilíacas, aorta trombosada   │
  │ AORTA TORÁCICA                 — dissecção, aneurisma, Marfan     │
  │ DOPPLER ARTERIAL MMII          — padrão fluxo, PAD, segmentar     │
  │ DOPPLER ARTERIAL MMSS          — subclávia, axilar, roubo, acesso │
  │ DOPPLER VENOSO MMII            — TVP, insuf. venosa, CEAP         │
  │ DOPPLER VENOSO MMSS            — TVP subclávia/axilar, Paget-Sch. │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PARÂMETROS DOPPLER — Obrigatórios e definições
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VPS (Velocidade de Pico Sistólico) — cm/s, 2 casas decimais.
   VDF (Velocidade Diastólica Final)  — cm/s, 2 casas decimais.
   VM  (Velocidade Média Temporal)    — cm/s, quando aplicável.
   IP  = (VPS − VDF) / VM  — Índice de Pulsatilidade (alta resist. = alto IP).
   IR  = (VPS − VDF) / VPS — Índice de Resistividade (0–1).
   RAR (Relação Aorto-Renal) = VPS AR / VPS Aorta.
   Relação ACI/ACC = VPS ACI / VPS ACC (critério de estenose NASCET).

   PADRÕES DE FLUXO ARTERIAL:
   Trifásico: pico sistólico + inversão diastólica precoce + 2º pico positivo.
     → Normal em artérias de extremidades em repouso.
   Bifásico: pico sistólico + fase diastólica sem inversão (fluxo ≥ 0 em diástole).
     → Aterosclerose proximal leve/moderada OU vasodilatação periférica.
   Monofásico: curva sem inversão + diástole sempre positiva, amortecida.
     → Obstrução/estenose grave proximal (tardus-parvus). Padrão de baixa resistência.
   Ausência de fluxo: oclusão total.

2. ARTÉRIAS CARÓTIDAS E VERTEBRAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VALORES NORMAIS:
   ACC: VPS 60–90 cm/s · IR 0,55–0,75.
   ACI: VPS 50–80 cm/s · IR 0,55–0,70 (baixa resistência, fluxo diastólico alto).
   ACE: VPS 60–90 cm/s · IR 0,70–0,85 (alta resistência — biscúspide espectral).
   AV:  VPS 30–60 cm/s · fluxo anterógrado bilateral.

   EMI (Espessura Médio-Intimal — parede posterior da ACC, 1 cm antes bulbo):
   <0,9 mm = normal · 0,9–1,2 mm = espessamento · >1,2 mm = placa aterosclerótica.

   CLASSIFICAÇÃO DE ESTENOSE ACI (NASCET + Consenso SRU 2003):
   ┌──────────────────┬───────────────────┬──────────────────┬─────────────────┐
   │ GRAU             │ VPS ACI (cm/s)    │ ACI/ACC (ratio)  │ VDF ACI (cm/s)  │
   ├──────────────────┼───────────────────┼──────────────────┼─────────────────┤
   │ Normal (<50%)    │ <125              │ <2,0             │ <40             │
   │ 50–69%           │ 125–229           │ 2,0–4,0          │ 40–100          │
   │ ≥70% (grave)     │ ≥230              │ ≥4,0             │ ≥100            │
   │ Pseudo-oclusão   │ Baixa variável    │ Alta variável    │ —               │
   │ Oclusão total    │ Ausente           │ —                │ —               │
   └──────────────────┴───────────────────┴──────────────────┴─────────────────┘
   PLACA: localização, extensão (mm), ecogenicidade (hipoecóica/mista/calcificada),
     superfície (regular/irregular/ulcerada). Placa ulcerada = alto risco embólico.
   ≥50% → N3 neurológico. ≥70% → ATIVAR R6.

   ARTÉRIA VERTEBRAL (AV):
   Fluxo anterógrado bilateral = normal.
   Fluxo retrógrado ipsilateral = síndrome do roubo da subclávia.
   Padrão tardus-parvus na AV = estenose da artéria subclávia ipsilateral proximal.
   Dissecção AV: flap intimal + hematoma intramural → ATIVAR R6.

3. ARTÉRIAS OFTÁLMICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ARTÉRIA OFTÁLMICA (AO): VPS normal 31–45 cm/s · IR 0,65–0,80.
   ARTÉRIA CENTRAL DA RETINA (ACR): VPS normal 10–20 cm/s · IR 0,65–0,75.
   ARTÉRIA CILIAR POSTERIOR (ACP): VPS normal 10–16 cm/s · IR 0,55–0,70.
   VEIA CENTRAL DA RETINA (VCR): fluxo contínuo de baixa velocidade.

   OCLUSÃO DA ARTÉRIA CENTRAL DA RETINA (OACR):
   Ausência de fluxo na ACR ao Doppler colorido/espectral.
   Contexto: perda visual súbita, sem dor. → ATIVAR R6 (janela terapêutica <4–6h).

   OCLUSÃO DA ARTÉRIA OFTÁLMICA:
   Ausência de fluxo na AO. Pior prognóstico que OACR isolada.
   → ATIVAR R6 — neurologia/oftalmologia de emergência.

   HIPERTENSÃO INTRAOCULAR / GLAUCOMA:
   IR elevado na ACR (>0,75) + VDF reduzida = aumento da resistência vascular intraocular.
   Correlação com pressão intraocular (PIO) medida clinicamente.

   DESCOLAMENTO DE RETINA:
   Membrana hipoecoica ondulante no vítreo + fluxo na membrana ao Doppler (distingue de vítreo).
   → ATIVAR R6 — oftalmologia emergencial.

4. AORTA ABDOMINAL — AAA e aorto-ilíaco
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MEDIÇÃO PADRÃO: AP externo × transverso externo (outer-to-outer), plano infrarrenal.
   Normal: <3,0 cm (♂) · <2,6 cm (♀). Ectasia: 2,5–2,9 cm.

   CLASSIFICAÇÃO AAA:
   3,0–4,9 cm → US semestral + cirurgia vascular.
   5,0–5,4 cm → avaliação vascular em ≤2 semanas.
   ≥5,5 cm (♂) / ≥5,0 cm (♀) → ATIVAR R6.
   Crescimento >5 mm/6 meses → ATIVAR R6.
   Hematoma periaórtico ou retroperitoneal → ATIVAR R6 (ruptura contida).

   TROMBO MURAL: hiperecóico/isoecóico aderido à parede interna.
   Relatar: espessura máxima + diâmetro luminal real vs. total.
   Trombo extenso + sintomas = ATIVAR R6 (embolia distal).

   ARTÉRIAS ILÍACAS COMUNS (AIC):
   Normal: VPS 70–120 cm/s · fluxo trifásico.
   Aneurisma ilíaco: ≥1,5 cm → cirurgia vascular.
   Oclusão aorto-ilíaca (Síndrome de Leriche): sem fluxo bilateral + claudicação.

5. AORTA TORÁCICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   US CONVENCIONAL: janela limitada (interposição gasosa).
   US CARDÍACO (ETT): raiz aórtica + ascendente proximal (melhor janela).
   ETE / TC: padrão-ouro para toda a aorta torácica.

   ANEURISMA DE AORTA TORÁCICA (AAT):
   Raiz aórtica normal <4,0 cm (♂) / <3,6 cm (♀).
   Ascendente normal <3,8 cm. Descendente normal <2,8 cm.
   ≥5,5 cm ascendente ou ≥6,0 cm descendente → cirurgia eletiva.
   Crescimento >5 mm/ano ou sintomático → ATIVAR R6.
   Síndrome de Marfan: raiz >4,5 cm → cirurgia preventiva.

   DISSECÇÃO AÓRTICA (ao US — quando acessível):
   Flap intimal hipoecoico mobile dividindo o lúmen (verdadeiro + falso).
   Lúmen verdadeiro: pulsatilidade sistólica, VPS maior.
   Lúmen falso: fluxo mais lento, trombo, expansão em sístole.
   Classificação: DeBakey I/II (ascendente — tipo A) → R6 cirurgia emergência.
                  DeBakey III (descendente apenas — tipo B) → R6 endovascular/clínico.
   US tem baixa sensibilidade — TC-angiografia é OBRIGATÓRIA para confirmação.

6. ARTÉRIAS DOS MEMBROS INFERIORES — PAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AVALIAÇÃO SEGMENTAR (proximal → distal):
   Ilíaca comum (AIC) → Ilíaca externa (AIE) → Femoral comum (AFC) →
   Femoral superficial (AFS) → Poplítea (AP) → Tibial anterior (ATA) /
   Tronco tibiofibular → Tibial posterior (ATP) / Fibular (AF).

   PADRÃO DE FLUXO POR NÍVEL:
   Ilíacas/femorais: trifásico normal. Bifásico = doença proximal.
   Poplítea: trifásico. Monofásico = doença femoral grave.
   Infrapoplíteas: trifásico a bifásico normal.

   ESTENOSE — CRITÉRIOS VELOCIMÉTRICOS:
   <50%: aumento local de VPS <2× o segmento imediatamente proximal.
   50–74%: VPS local 2–4× o proximal + turbulência distal.
   75–99%: VPS local >4× + diástole ausente/invertida distalmente.
   Oclusão: ausência de sinal + collaterais visíveis.

   CLASSIFICAÇÃO TASC II (TransAtlantic Inter-Society Consensus):
   A: lesões curtas (<3 cm) — PTA/stent de 1ª linha.
   B: 3–10 cm — endovascular preferível.
   C: 10–15 cm — cirurgia preferível se paciente cirúrgico.
   D: >15 cm + oclusão + infrapoplítea difusa — cirurgia.

   ISQUEMIA CRÍTICA DE MEMBRO (ICM — ATIVAR R6):
   Critérios: dor de repouso + úlcera/gangrena + ABI <0,40 + PAS tornozelo <50 mmHg.
   "ALERTA VASCULAR: isquemia crítica — avaliação vascular emergencial (revascularização)."

7. ARTÉRIAS DOS MEMBROS SUPERIORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AVALIAÇÃO SEGMENTAR: Subclávia → Axilar → Braquial → Radial / Ulnar.
   Subclávia: VPS normal 70–120 cm/s · trifásico.
   Braquial: VPS 50–90 cm/s · trifásico.
   Radial/Ulnar: VPS 40–70 cm/s · trifásico.

   SÍNDROME DO ROUBO DA SUBCLÁVIA:
   Estenose/oclusão da subclávia esquerda pré-vertebral.
   AV ipsilateral: fluxo retrógrado (roubo total) ou bifásico (roubo parcial).
   Gradiente de pressão entre MMSS >20 mmHg = significativo.
   Sintomas: tontura, drop-attack, claudicação MS ipsilateral.
   → N3: angioTC arco aórtico + avaliação vascular.

   FÍSTULA ARTERIOVENOSA (FAV — acesso hemodiálise):
   Fluxo turbulento de alta velocidade + baixa resistência na artéria aferente.
   Calibre da veia eferente (maturação): diâmetro ≥6 mm = maturada para punção.
   Estenose venosa: aumento local de VPS >2× o segmento adjacente.
   Pseudoaneurisma: saco com fluxo rotacional "yin-yang"; colo mensurável.
   Trombose da FAV: ausência de fluxo → ATIVAR N4 (trombólise/trombectomia).

   ACESSO VENOSO CENTRAL — complicações:
   Pseudoaneurisma pós-punção subclávia: saco pulsátil + fluxo yin-yang.
   Hematoma: coleção hipoecóica sem PD interno.

8. SISTEMA VENOSO DOS MMII — TVP e Insuficiência Venosa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROTOCOLO TVP (compressão seriada):
   Veias avaliadas: ilíaca externa → femoral comum → femoral → poplítea
     → troncos tibiais anterior/posterior → veia fibular.
   CRITÉRIO DIAGNÓSTICO PRIMÁRIO: incompressibilidade total com probe (2-point ou completo).
   CRITÉRIOS SECUNDÁRIOS: ausência de fluxo espontâneo; ausência de fluxo ao Doppler colorido;
     imagem direta do trombo (iso/hiperecóico = organizado; anecoico = recente/agudo).

   CLASSIFICAÇÃO TVP POR LOCALIZAÇÃO:
   Proximal: ilíaca, femoral comum, femoral superficial, poplítea.
     → Risco TEP significativo → ATIVAR R6.
   Distal: troncos tibiais, fibular.
     → Risco TEP menor; anticoagular ou vigiar conforme protocolo institucional.
   Muscular (gastrocnêmio, sóleo): risco TEP baixo; conduta controversa.

   TROMBO OCLUSIVO vs. NÃO OCLUSIVO:
   Oclusivo: veia não comprime + sem fluxo central residual.
   Não oclusivo (flutuante): trombo visível com fluxo residual periférico.
     TROMBO FLUTUANTE → ATIVAR R6 (maior risco de TEP).

   CORRELAÇÃO COM WELLS SCORE (pré-teste TVP):
     BAIXA PROBABILIDADE (Wells 0–1): VPN do US de compressão ≥95% → US negativo praticamente exclui TVP.
     MODERADA (Wells 2): US negativo → repetir US em 5–7 dias ou dosar D-dímero.
     ALTA PROBABILIDADE (Wells ≥3): US negativo NÃO exclui TVP → angioTC ou venografia.
     Declarar no laudo: "Correlacionar com probabilidade pré-teste (Wells Score) para interpretação adequada do resultado negativo."

   SÍNDROMES ESPECIAIS — DIAGNÓSTICOS DIFERENCIAIS A CONSIDERAR:
   SÍNDROME DE NUTCRACKER (Nutcracker Syndrome — compressão da veia renal esquerda):
     VRL (veia renal esquerda) comprimida entre artéria mesentérica superior (AMS) e aorta abdominal.
     Critérios US Doppler: VPS >100 cm/s na zona de compressão + dilatação proximal (pré-AMS) + varicocele esquerda em homens.
     Ângulo AMS-aorta normal: 38–65°. Ângulo <35° = suspeita anatômica.
     → Correlacionar com hematúria microscópica de causa não esclarecida, proteinúria ortostática, dor no flanco esquerdo.
     Recomendação: angioTC abdominal para confirmação + avaliação vascular.

   SÍNDROME DE MAY-THURNER (Síndrome de Cockett — compressão da VIC esquerda):
     Artéria ilíaca comum direita comprimindo veia ilíaca comum esquerda contra a vértebra L5.
     Suspeita US: fluxo assimétrico entre VIC D e E + TVP esquerda recorrente em mulher jovem sem fator de risco.
     US tem baixa sensibilidade para confirmação — angioTC pélvica ou flebografia são necessárias.
     → Correlacionar com TVP iliofemoral esquerda recorrente, insuficiência venosa pélvica em mulher jovem.
     Recomendação: angioTC pélvica para confirmação + cirurgia endovascular (stent VIC).

   EMI — PROGRESSÃO ATEROSCLERÓTICA (acompanhamento longitudinal):
     Progressão normal: ≤0,010 mm/ano.
     Progressão acelerada: >0,020 mm/ano (≥2 medições comparativas).
     → Progressão acelerada = risco cardiovascular elevado independente do valor absoluto → intensificar manejo: estatinas de alta potência, pressão <120 mmHg, anti-plaquetário se indicado.
     Declarar: "EMI atual de X,X mm vs. X,X mm em [data anterior] — progressão de X,XX mm/período — [dentro do esperado / progressão acelerada]."

   INSUFICIÊNCIA VENOSA CRÓNICA (IVC) — CEAP 2020:
   C0: sem sinais visíveis ou palpáveis. C1: teleangiectasias/veias reticulares.
   C2: varizes (>3 mm). C2r: varizes recorrentes pós-tratamento.
   C3: edema venoso. C4a: pigmentação/eczema. C4b: lipodermatoesclerose/atrofia branca.
   C4c: corona phlebectatica. C5: úlcera cicatrizada. C6: úlcera ativa. C6r: recorrente.

   REFLUXO VENOSO:
   Significativo: duração >0,5 s (safenas e femoral) ou >1,0 s (poplítea e perfurantes).
   Avaliar: crossa safenofemoral (CSF) + safena magna (SSM) + crossa safenopoplítea (CSP)
     + safena parva (SSP) + veias perfurantes incompetentes (VPI > 3,5 mm + refluxo).
   MAPEAMENTO SSM: diâmetro no 1/3 superior, médio e inferior da coxa + perna.
     SSM ≥6 mm = indicação de termoablação/espuma endovenosa.

9. SISTEMA VENOSO DOS MMSS — TVP e patologia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VEIAS AVALIADAS: subclávia → axilar → braquial → cefálica → basílica.
   PROTOCOLO: compressão + Doppler colorido + espectral (pulsatilidade respiratória).

   TVP MMSS — CLASSIFICAÇÃO:
   Primária (Paget-Schroetter): trombose de esforço; jovens ativos, MMSS dominante.
     Contexto: exercício intenso + tumor/costela cervical (Th outlet syndrome).
   Secundária (cateter): cateter venoso central → trombose perilesional.
     → Em cateter com TVP: remover cateter? Avaliar necessidade vs. risco.

   FLUXO VENOSO NORMAL NOS MMSS:
   Monofásico contínuo com variação respiratória (aumenta na inspiração).
   Pulsatilidade moderada na subclávia/axilar = transmissão das pressões cardíacas (normal).
   Perda da variação respiratória = obstrução central (mediastinal, veia cava sup.).
   TVP subclávia/axilar → ATIVAR R6 (risco TEP comparável TVP proximal MMII).

   SÍNDROME DA VEIA CAVA SUPERIOR (VCS):
   Ausência de variação respiratória + fluxo contínuo em subclávia bilateral.
   Contexto: neoplasia mediastinal, fibrose, cateter. → N4 → oncologia/cirurgia torácica.

10. CONDIÇÕES AGUDAS — Gatilhos R6 / N4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ┌──────────────────────────────────────┬──────────────────────────────────────┐
    │ CONDIÇÃO                             │ GATILHO R6 / N4                      │
    ├──────────────────────────────────────┼──────────────────────────────────────┤
    │ AAA ≥5,5 cm (♂) / ≥5,0 cm (♀)       │ Cirurgia vascular urgente            │
    │ AAA + dor/hematoma periaórtico       │ Ruptura contida → R6 imediato        │
    │ Dissecção aórtica tipo A             │ Cirurgia cardíaca de emergência       │
    │ Dissecção aórtica tipo B sintomática │ TEVAR/clínica + UIT urgente           │
    │ Estenose ACI ≥70%                    │ CEA/CAS + neurologia urgente          │
    │ Oclusão ACI aguda                    │ AVC isquêmico? → R6 neurológico      │
    │ TVP proximal MMII ou MMSS           │ Anticoagulação + avaliação imediata   │
    │ Trombo venoso flutuante              │ Risco TEP elevado → R6               │
    │ OACR (oclusão ACR)                   │ Janela <4–6h → oftalmologia R6       │
    │ Isquemia crítica MMII                │ Revascularização urgente             │
    │ Trombose aguda arterial periférica   │ Trombectomia/trombólise urgente      │
    │ FAV não maturada / trombosada        │ N4 → nefrologista/cirurgia vascular  │
    └──────────────────────────────────────┴──────────────────────────────────────┘

11. TABELA MESTRA DE REFERÊNCIA — Vascular
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Estrutura/Parâmetro      │ Normal                        │ Alerta / Ação
    ─────────────────────────┼───────────────────────────────┼────────────────────────────
    EMI da ACC               │ <0,9 mm                       │ >1,2 mm = placa definida
    VPS ACI normal           │ 50–80 cm/s                    │ >125 = estenose ≥50%
    VPS ACI grave            │ ≥230 cm/s                     │ ≥70% NASCET → R6
    Aorta abdominal (AP)     │ <3,0 cm (♂) / <2,6 cm (♀)    │ ≥5,5 cm → R6
    Aorta torácica (raiz)    │ <4,0 cm (♂) / <3,6 cm (♀)    │ ≥5,5 cm ascend. → R6
    Artéria ilíaca comum     │ VPS 70–120 cm/s · trifásico   │ Aneurisma ≥1,5 cm
    VPS AR (renal)           │ <180 cm/s                     │ >180 + RAR >3,5 = estenose
    IR intrarrenal           │ 0,55–0,70                     │ >0,70 bilateral = nefropatia
    Artéria oft. (AO)        │ VPS 31–45 · IR 0,65–0,80      │ Ausência fluxo ACR → R6
    FAV para hemodiálise     │ Veia eferente ≥6 mm           │ Trombo = N4
    Safena magna (SSM)       │ <3,5 mm no terço médio coxa   │ ≥6 mm = indicação ablação
    Refluxo venoso (safenas) │ <0,5 s                        │ ≥0,5 s = insuf. significativa
    Veia femoral (compres.)  │ Totalmente compressível       │ Incompressível = TVP → R6
    Veia subclávia (compres.)│ Totalmente compressível       │ Incompressível = TVP → R6

12. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    EMI <0,9 mm: "Espessura médio-intimal dentro da normalidade."
    EMI 0,9–1,2 mm: "Espessamento médio-intimal — correlação com fatores de risco CV; prevenção primária."
    Placa <50% assintomática: "Controle de fatores de risco (HAS, DM, tabagismo, dislipidemia)."
    Estenose ACI 50–69%: "Avaliação neurológica + otimização dos fatores de risco; considerar CEA se sintomático."
    Estenose ACI ≥70%: ATIVAR R6 — "Avaliação vascular para CEA ou CAS."
    Oclusão ACI aguda: ATIVAR R6 — "ALERTA NEUROLÓGICO: AVC isquêmico? Avaliação emergencial."
    Roubo da subclávia: "AngioTC do arco aórtico + avaliação vascular (angioplastia/stent subclávia)."
    Dissecção AV: ATIVAR R6 — "TC-angiografia urgente + neurologia/vascular."
    AAA 3,0–4,9 cm: "US semestral + encaminhamento cirurgia vascular."
    AAA 5,0–5,4 cm: "Avaliação vascular em ≤2 semanas."
    AAA ≥5,5 cm: ATIVAR R6 — "Cirurgia vascular/endovascular urgente."
    Ruptura AAA suspeita: ATIVAR R6 — "Cirurgia de emergência — máxima urgência."
    Dissecção tipo A: ATIVAR R6 — "Cirurgia cardíaca de emergência."
    PAD leve-moderada: "Modificação fatores de risco + exercício supervisionado + antiagregação."
    PAD grave (TASC C/D): "Cirurgia vascular para revascularização."
    Isquemia crítica: ATIVAR R6 — "Revascularização emergencial (trombectomia/bypass)."
    TVP proximal MMII: ATIVAR R6 — "Anticoagulação imediata (HBPM ou DOAC) + avaliação."
    TVP distal MMII isolada: "Avaliação clínica — anticoagular ou vigilância com US em 1 semana."
    Trombo flutuante: ATIVAR R6 — "Risco de TEP — anticoagulação urgente ± filtro de VCI."
    TVP subclávia/axilar: ATIVAR R6 — "Anticoagulação imediata; remover cateter se secundária."
    OACR: ATIVAR R6 — "Janela terapêutica <6h — oftalmologia de emergência."
    IVC C2–C3: "Cirurgia vascular — mapeamento para ablação endovenosa ou escleroterapia."
    IVC C5–C6: "Cirurgia vascular urgente — tratamento da úlcera ativa."
    FAV trombosada: ATIVAR N4 — "Nefrologista + cirurgia vascular (trombólise/trombectomia)."
    Pseudoaneurisma pós-cateterismo: "Compressão guiada por US ou injeção de trombina."

13. REGRAS TRANSVERSAIS — APLICÁVEIS A TODOS OS 8 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. BILATERAL OBRIGATÓRIO: todos os exames arteriais e venosos devem ser realizados
       e relatados bilateralmente, salvo contraindicação técnica declarada.
    b. VELOCIDADES: reportar VPS em cm/s com 2 casas decimais. Nunca omitir.
    c. PADRÃO DE FLUXO: declarar trifásico/bifásico/monofásico para cada segmento arterial.
    d. TVP — COMPRESSÃO SERIADA: documentar compressibilidade veia por veia.
       "Compressível" vs. "Incompressível (TVP)" — nunca apenas "suspeito".
    e. AORTA: medir SEMPRE em plano transversal AP + transverso, borda externa a borda
       externa (outer-to-outer). Medição oblíqua superestima o diâmetro.
    f. REFLUXO VENOSO: sempre quantificar duração em segundos ao Valsalva/compressão.
    g. DOPPLER OFTÁLMICO: pressão baixa no transdutor (olho = estrutura sensível).
       Nunca exercer compressão direta sobre o globo.
    h. SÍNTESE DOPPLER NA CONCLUSÃO: obrigatória — mesmo que normal.
    i. TVP FLUTUANTE: declarar explicitamente — risco de TEP imediato.
    j. ORDEM DA CONCLUSÃO: N4 → N3 → N2 → N1 → N0. Nunca inverter.`,

  // ═══════════════════════════════════════════════════════════════
  // MUSCULOESQUELÉTICO
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area musculoesqueletico
   * @scope Tendões, bursas, músculos, articulações, nervos periféricos,
   *        protocolo dinâmico, lesões esportivas.
   */
  'musculoesqueletico': `DIRETRIZES CLÍNICAS — MUSCULOESQUELÉTICO (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: ESSR · ESSKA · ISAKOS · ACR · CBMI · SBR · SBUS
             AAOS · EULAR · EANO · RSNA Musculoskeletal 2024

MAPA DE EXAMES DESTA ÁREA (9 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ OMBRO      — manguito rotador, bursa, bíceps, LAB, HADD, impacto │
  │ COTOVELO   — epicôndilos, tríceps, nervos, bursas, articulação   │
  │ PUNHO      — nervos (STC/Guyon), tendões, articulações, TFCC     │
  │ MÃO        — polegar, dedos, tendões flexores/extensores, nódulos │
  │ QUADRIL    — bursas, glúteos, snapping, nervo ciático, artrite   │
  │ JOELHO     — tendões (patelar/quadricípite), meniscos, ligamentos │
  │ TORNOZELO  — Aquiles, retináculos, TP, FHL, ligamentos laterais  │
  │ PÉ         — fascia plantar, nervo de Morton, tendões, hálux     │
  │ MUSCULAR   — distensão, rotura muscular, hematoma, miosite       │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PRINCÍPIOS TÉCNICOS — US MUSCULOESQUELÉTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TRANSDUTOR: linear 10–18 MHz (estruturas superficiais); 5–12 MHz (quadril/profundas).
   ANISOTROPIA: artefato de hipoecogenicidade tendínea por angulação do transdutor.
     REGRA: sempre confirmar achado em estrutura tendínea com transdutor perpendicular
     (90°) às fibras. Hipoecogenicidade que DESAPARECE com correção = anisotropia (normal).
     Hipoecogenicidade PERSISTENTE com transdutor perpendicular = patologia real.
   PROTOCOLO DINÂMICO: avaliar com movimentação ativa/passiva quando indicado
     (subluxação de tendão, ressalto, impacto dinâmico).
   COMPARAÇÃO CONTRALATERAL: sempre que possível para referência individual.

2. TENDÕES — Avaliação sistemática e graduação de lesões
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DESCRIÇÃO OBRIGATÓRIA: espessura (mm) longitudinal e transversal; ecogenicidade;
   fibrilaridade; contornos; relação com estruturas adjacentes; Doppler (se exame indicar).

   CLASSIFICAÇÃO DE LESÕES TENDÍNEAS:
   Tendinose:     Espessamento focal ou difuso, hipoecogenicidade, perda de fibrilaridade,
                  SEM descontinuidade das fibras. N2 → fisioterapia, antiinflamatório.
   Rotura Parcial: Descontinuidade focal de parte das fibras; foco anecoico intrasubstancial.
                  Graduar em % do diâmetro total. Ex: "~30% do diâmetro". N2–N3.
   Rotura Total:  Descontinuidade completa, afastamento dos cotos (mensurar gap em mm),
                  retração proximal, preenchimento por líquido/hematoma. N3–N4.
   Entesopatia:   Espessamento hipoecóico na inserção óssea ± calcificação ± erosão cortical.
   Tenossinovite: Líquido ≥2 mm na bainha tendinosa ± espessamento sinovial ± PD.

   ESPESSURAS DE REFERÊNCIA NORMAIS (adultos):
   Tendão           │ Espessura Normal (longitudinal)      │ Alerta
   ─────────────────┼──────────────────────────────────────┼────────────────────────
   Aquiles          │ 4–6 mm (2 cm acima inserção)         │ >6 mm = tendinose
   Patelar          │ 3–5 mm (polo inf. da patela)         │ >6 mm = tendinose
   Quadricípite     │ 5–7 mm (polo sup. da patela)         │ >8 mm = tendinose
   Supraespinhoso   │ 5–7 mm (footprint)                   │ <4 mm = rotura suspeita
   Bíceps (L. longa)│ 4–6 mm no sulco intertubercular      │ >7 mm = tendinose
   Tibial Posterior │ 3–5 mm (maléolo medial)              │ >6 mm = tendinose
   Flexor L. Hálux  │ 2–4 mm (posterior ao maléolo med.)   │ >5 mm = tendinose
   Peroneus (long.) │ 3–5 mm (maléolo lateral)             │ >6 mm = tendinose

3. MÚSCULOS — Classificação de lesões (graus I–III)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Grau I (Distensão): edema intersticial; ecotextura heterogênea (estriações hiperecóicas
     perifasciais); SEM descontinuidade das fibras; dor localizada; sem hematoma visível.
   Grau II (Rotura Parcial): descontinuidade focal das fibras; hematoma intramuscular
     hipoecoico/anecoico; área de acometimento <50% da secção transversa.
   Grau III (Rotura Total): descontinuidade completa; hematoma extenso; retração muscular
     ("sinal do sino"); área de acometimento ≥50% ou ruptura total.
   MEDIR: dimensões do hematoma (3 eixos); localização (junção miofascial, ventre, perimísio);
   músculo afetado; % de acometimento estimado.
   → Grau III: encaminhamento ortopédico/cirúrgico urgente (especialmente em membro inf.).

4. LIGAMENTOS — Classificação de lesões
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Grau I (Entorse leve): espessamento difuso, edema periligamentar; fibras contínuas.
   Grau II (Entorse moderada): espessamento focal, descontinuidade parcial das fibras;
     edema e hematoma periligamentar.
   Grau III (Rotura total): descontinuidade completa; afastamento dos cotos; hematoma.
   REFERÊNCIA ANATÔMICA: sempre mencionar onde a lesão se encontra (origem, corpo, inserção).
   US vs. RM: US tem limitação para ligamentos intra-articulares (LCA, LCP, meniscos →
     RM é padrão-ouro para estruturas intra-articulares).

5. ARTICULAÇÕES — Derrame, sinovite e erosões
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DERRAME ARTICULAR:
     Ausente · Discreto (<2 mm) · Moderado (2–5 mm) · Volumoso (>5 mm).
     Anecóico = simples (transudato). Ecos internos = hemartrose, artrite séptica, pus.
     Artrite séptica: líquido ecogênico espesso + PD sinovial exuberante + febre/leucocitose
     → ATIVAR R6: punção articular diagnóstica e terapêutica urgente.
   SINOVITE:
     Espessamento sinovial >2 mm (repouso). PD positivo na membrana sinovial = ATIVA.
     PD negativo = sinovite em repouso ou fibrótica (crônica).
     Graduação (EULAR/OMERACT): 0 = ausente · 1 = discreta · 2 = moderada · 3 = grave.
     → Sinovite ativa (PD G2–G3): correlação reumatológica (AR, SpA, cristal, séptica).
   EROSÕES ÓSSEAS: descontinuidade do córtex ósseo em 2 planos perpendiculares.
     Localização preferencial: cabeças metacarpianas, carpo, MTP.
     → N3: correlação reumatológica (AR, gota, artrite psoriásica).
   CONDROCALCINOSE: depósitos hiperecóicos DENTRO da cartilagem hialina (fibrocartilagem).
     Joelho (menisco), punho (fibrocartilagem triangular), sínfise púbica.

6. OMBRO — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MANGUITO ROTADOR:
     Supraespinhoso (SSP): avaliar no plano coronal e sagital; "footprint" no tubérculo maior.
       Cuff tear arc: rotura em zona avascular a 1 cm da inserção.
     Infraespinhoso (ISP): tubérculo maior posterior.
     Subescapular (SSC): tubérculo menor; avaliar com rotação externa.
     Redondo menor: posterior ao ISP; raro acometer isoladamente.
   ESPAÇO SUBACROMIAL:
     Normal ≥7 mm (repouso). Reduzido: 5–6 mm. Crítico: <5 mm.
     Bursa subacromial-subdeltoidea (BSD): normal <2 mm. Bursite ≥2 mm de líquido.
   HADD (CALCIFICAÇÃO POR HIDROXIAPATITA — Classificação de Gärtner):
     Tipo I: densa, homogênea, contornos nítidos (madura, sólida — pode ser assintomática).
     Tipo II: heterogênea ou homogênea, contornos irregulares.
     Tipo III: translúcida, heterogênea, mal definida (fase reabsorção — MÁS dolorosa, HADD aguda).
     → Tipo III aguda: correlação com ortopedia/reumatologia (punção aspirativa + lavagem).
   BÍCEPS — LONGA PORÇÃO (LP):
     Sulco intertubercular: espessura normal 4–6 mm.
     Tenossinovite: líquido ≥2 mm ao redor. Rotura: gap + aspecto de "mola"; descida do ventre.
     Subluxação: avaliar com rotação interna — deslocamento medial ao sulco.
   LÁBIO ARTICULAR / GLENOIDE:
     US tem limitação para LAB — descrever apenas achados incidentais.
     RM + artro é padrão-ouro para SLAP e lesões labrais.

7. COTOVELO — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EPICÔNDILO LATERAL (COTOVELO DO TENISTA):
     Extensor Radial Curto do Carpo (ECRB): inserção no epicôndilo lateral.
     Tendinose/entesopatia ECRB: espessamento hipoecóico na inserção ± calcificação.
     Rotura parcial/total: foco anecoico intrasubstancial ou descontinuidade.
   EPICÔNDILO MEDIAL (COTOVELO DO GOLFISTA):
     Flexor-pronador comum: inserção no epicôndilo medial.
     Tendinose/entesopatia: mesmos critérios.
   NERVO ULNAR:
     Sulco epitroclear-olecraneano: normal ≤2,5 mm de área de secção transversa (AST).
     AST >3,5 mm = edema/compressão (síndrome do túnel cubital).
     Subluxação: avaliar com flexão do cotovelo (nervo sai do sulco).
   BÍCEPS DISTAL: inserção na tuberosidade do rádio. Rotura = gap + retração proximal.
   TRÍCEPS DISTAL: inserção no olécrano. Rotura em atletas/uso de corticoide local.
   BURSA OLECRANEANA: normal não visível. Bursite: coleção pós-olécrano.
     Séptica: debris + PD periférico + eritema → R6.
   ARTICULAÇÃO ÚMERO-RADIAL/RÁDIO-ULNAR: derrame, sinovite, corpos livres (loose bodies).

8. PUNHO E MÃO — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SÍNDROME DO TÚNEL DO CARPO (STC):
     Nervo mediano: AST normal ≤9 mm² ao nível do pisiforme (proximal).
     AST ≥10 mm² = STC confirmado. AST 10–13 mm² = leve. 14–20 mm² = moderado. >20 mm² = grave.
     Medir também na região distal (hamato): relação pisiforme/hamato >1,4 = STC.
     Critério adicional: edema (hipoecogenicidade do nervo), convexidade do retináculo dos flexores.
   CANAL DE GUYON (Nervo Ulnar no Punho):
     AST nervo ulnar >7,5 mm² ao nível do pisiforme = síndrome do canal de Guyon.
   TENDÕES FLEXORES/EXTENSORES DO CARPO E DEDOS:
     Avaliar nas bainhas tenossinoviais. Tenossinovite estenosante (dedo em gatilho):
     espessamento da polia A1 > 2 mm; nódulo no tendão; ressalto dinâmico.
   De QUERVAIN (1ª bainha dorsal): ABL + ECP. Tenossinovite estenosante na bainha.
   TFCC (Fibrocartilagem Triangular): US tem limitação — RM artro é padrão-ouro.
     US: descontinuidade da superfície, coleção intra-articular radio-ulnar.

9. QUADRIL — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BURSAS DO QUADRIL:
     Bursa trocanteriana: lateral ao trocânter maior. Normal: não visível.
       Bursite: líquido ≥1 mm ou espessamento parietal. Séptica → R6.
     Bursa iliopsoas (iliopectínea): anterior ao quadril, medial ao iliopsoas.
       Normal: lâmina <5 mm. Bursite: >5 mm.
   TENDÃO DO GLÚTEO MÉDIO E MÍNIMO: inserções no trocânter maior (facetas).
     Tendinose/rotura: espessamento + hipoecogenicidade ± descontinuidade.
     "Síndrome do manguito do quadril": análogo ao ombro.
   TENDÃO DO ILIOPSOAS: inserção no trocânter menor. Snapping hip interno:
     ressalto dinâmico do tendão sobre a eminência iliopectínea (US dinâmico).
   NERVO CIÁTICO: origem no forame isquiático. Compressão por músculo piriforme
     (síndrome do piriforme): músculo aumentado + nervo com AST ↑.
   ARTICULAÇÃO COXOFEMORAL:
     Derrame: espessura do colo femoral anterior.
       <3 mm = normal. 3–5 mm = leve. >5 mm = moderado/volumoso.
     Artrite séptica do quadril: derrame + PD sinovial + febre → ATIVAR R6.
     Displasia (pediátrico): índice de cobertura acetabular (Graf).

10. JOELHO — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TENDÕES EXTENSORES:
      Patelar: polo inferior da patela → tuberosidade tibial. Esp. normal 3–5 mm.
        Síndrome de Jumper's Knee: tendinose polo inferior (hiperecóico com foco hipoecóico).
      Quadricípite: polo superior. Rotura parcial/total → gap + hematoma.
    BURSAS DO JOELHO:
      Pré-patelar: superficial à patela. Infra-patelar (profunda): abaixo do tendão patelar.
      Baker (cisto poplíteo): entre cabeça medial do gastrocnêmio e semimembranoso.
        Normal: <15 mm. Comunicação com articulação (via fenda sinovial).
        Rotura de cisto de Baker: líquido no espaço entre gastrocnêmio e sóleo
        ("pseudotrombose" — simular TVP).
    MENISCOS (parcialmente acessíveis ao US):
      Corno posterior medial e lateral: avaliar nos recessos articulares.
      Extrusão meniscal medial >3 mm = rotura ou desestruturação.
      US limitado para meniscos → RM é padrão-ouro para lesões internas.
    LIGAMENTOS COLATERAIS (acessíveis ao US):
      LCM: feixe superficial — avaliado no plano coronal medial. Rotura = gap + edema.
      LCL: complexo lateral. Rotura em valgo forçado.
      LCA/LCP: intra-articulares — US tem baixa acurácia → RM.
    CARTILAGEM FEMORAL: avaliar em plano transversal (joelho flexionado 90°).
      Normal: hipoecoico, uniforme, 2–4 mm.
      Afinamento/irregularidade: artrose.
    DERRAME ARTICULAR: recessos suprapatelar e parapatelar. Volumoso → punção diagnóstica.

11. TORNOZELO E PÉ — Protocolo completo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TENDÃO DE AQUILES (TA):
      Espessura 4–6 mm. Rotura: gap entre cotos + hematoma.
      Medir gap (mm) e distância da inserção.
      Thompson test (dinâmico): ausência de plantiflexão = rotura total.
      Rotura total → ATIVAR N4: ortopedia urgente (cirurgia ou imobilização).
    TENDÃO TIBIAL POSTERIOR (TP): maléolo medial → navicular.
      Normal ≤5 mm. Disfunção TTP: espessamento + hipoecogenicidade + PD.
      Rotura → perda de arco plantar (pé plano adquirido). Estadiamento Johnson & Strom.
    FLEXOR LONGO DO HÁLUX (FLH): posterior ao maléolo medial (mais profundo).
      Tenossinovite: líquido na bainha ao US dinâmico (flexão/extensão do hálux).
    PERONEAIS (longo e curto): retromaleolar lateral.
      Rotura longitudinal do PE curto: "flap" hipoecoico na fissura.
      Subluxação peroneal: avaliar com dorsiflexão ativa (retináculo roto).
    LIGAMENTOS LATERAIS DO TORNOZELO:
      LTFA (tibiofibular anterior): acometido em entorse inversão.
      LCF (calcaneofibular): 2º ligamento acometido.
      Rotura: descontinuidade + edema periligamentar.
    FÁSCIA PLANTAR:
      Normal: ≤4 mm na inserção no calcâneo. >4 mm = fascite plantar.
      Espessamento hipoecóico na inserção ± osteófito de tração.
    NERVO DE MORTON (Neuroma de Morton):
      3º espaço intermetatarsal (mais comum); 2º espaço também.
      Massa hipoecóica fusiforme entre metatarsianos, apertada à compressão.
      >5 mm (AP) = compatível com neuroma. Diagnóstico clínico-US.

12. NERVOS PERIFÉRICOS — Compressão e lesão
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ASPECTO NORMAL: fascicular, hiperecóico (honeycombing), sem edema.
    COMPRESSÃO: edema (hipoecogenicidade) + aumento da AST no ponto de compressão.
    ┌───────────────────────────┬────────────────────────────┬──────────────────────┐
    │ NERVO / SÍNDROME          │ LOCAL DE MEDIDA            │ AST NORMAL / PATOL.  │
    ├───────────────────────────┼────────────────────────────┼──────────────────────┤
    │ Mediano (STC)             │ Pisiforme / proximal       │ ≤9 mm² / ≥10 mm²     │
    │ Ulnar (Túnel Cubital)     │ Sulco epitroclear          │ ≤2,5 mm² / ≥3,5 mm² │
    │ Ulnar (Canal de Guyon)    │ Pisiforme no punho         │ ≤5 mm² / ≥7,5 mm²   │
    │ Fibular (Col. Fib.)       │ Colo da fíbula             │ ≤9 mm² / ≥12 mm²    │
    │ Tibial posterior          │ Túnel do tarso             │ ≤9 mm² / ≥12 mm²    │
    └───────────────────────────┴────────────────────────────┴──────────────────────┘
    NEUROMA TRAUMÁTICO: espessamento fusiforme hipoecoico + dor à compressão.
    NEUROFIBROMA: associado ao nervo, ovoide, heterogêneo.

13. DOPPLER EM MUSCULOESQUELÉTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    SINOVITE ATIVA: Power Doppler positivo na membrana sinovial = inflamação ativa.
      G0 = ausente · G1 = 1–3 sinais pontuais · G2 = confluentes sem encher ·
      G3 = llenando todo o espaço sinovial (sinovite grave).
    BURSITE: PD nas paredes = ativa/séptica. Ausente = mecânica/crônica.
    TENDÃO: PD interno = neoformação vascular (tendinose crônica / "tendinite").
      Localização do PD: peritendínea vs. intratendinosa (mais patológica).
    OSSO: hipervascularização periosteal = fratura de estresse, osteomielite, metástase.
    TECIDO MOLE: PD interno em massa = suspeita de neoplasia (sarcoma).
    ARTRITE SÉPTICA: PD sinovial exuberante + derrame ecogênico → R6.

14. CONDIÇÕES AGUDAS — Gatilhos R6 / N4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ┌──────────────────────────────────────┬───────────────────────────────────────┐
    │ CONDIÇÃO                             │ GATILHO R6/N4                         │
    ├──────────────────────────────────────┼───────────────────────────────────────┤
    │ Bursite séptica                      │ Paredes irregulares + debris + PD + febre│
    │ Artrite séptica (QQ articulação)     │ Derrame ecogênico espesso + febre     │
    │ Rotura total Aquiles                 │ Gap + ausência Thompson test           │
    │ Rotura total patelar/quadricípite    │ Gap + impotência funcional            │
    │ Rotura total manguito (extenso)      │ Gap >1 cm + impotência do membro      │
    │ Hematoma muscular expansivo          │ Compartimento tenso + dor intensa     │
    │ Sarcoma de partes moles suspeito     │ Massa profunda >3 cm + PD caótico     │
    │ Síndrome compartimental              │ Clínica → US como orientador          │
    └──────────────────────────────────────┴───────────────────────────────────────┘
    FRASEOLOGIA R6: "ALERTA ORTOPÉDICO: [condição] — avaliação ortopédica de emergência."
    FRASEOLOGIA SÉPTICA: "ALERTA INFECCIOSO: [bursite/artrite séptica suspeita] —
      punção articular/bursal diagnóstica e início de antibioticoterapia urgente."

15. TABELA MESTRA DE REFERÊNCIA — MSK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Estrutura                      │ Normal                    │ Alerta
    ───────────────────────────────┼───────────────────────────┼──────────────────────
    Tendão Aquiles                 │ 4–6 mm                    │ >6 mm, gap = rotura
    Tendão patelar                 │ 3–5 mm                    │ >6 mm = tendinose
    Tendão quadricípite            │ 5–7 mm                    │ >8 mm = tendinose
    Supraespinhoso (espessura)     │ 5–7 mm (footprint)        │ <4 mm = rotura suspeita
    Bíceps L. porção (sulco intertub) │ 4–6 mm               │ >7 mm = tendinose
    Tibial posterior               │ 3–5 mm                    │ >6 mm = tendinose
    Nervo mediano (STC — pisiforme)│ ≤9 mm²                    │ ≥10 mm² = STC
    Nervo ulnar (túnel cubital)    │ ≤2,5 mm²                  │ ≥3,5 mm² = compressão
    Espaço subacromial             │ ≥7 mm                     │ <5 mm = impacto crítico
    Bursa subacromial-subdeltoidea │ <2 mm                     │ ≥2 mm = bursite
    Derrame articular do quadril   │ <3 mm (colo femoral ant.) │ >5 mm = moderado
    Cisto de Baker                 │ <15 mm                    │ Rotura = "pseudoTVP"
    Fáscia plantar (inserção)      │ ≤4 mm                     │ >4 mm = fascite plantar
    Neuroma de Morton              │ Ausente                   │ >5 mm = compatível

16. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Tendinose leve: "Tratamento conservador (fisioterapia excêntrica, AINE). Controle US em 3 meses."
    Tendinose moderada/grave: "Ortopedia/fisiatria para decisão terapêutica (fisioterapia vs. PRP vs. cirurgia)."
    Rotura parcial <50%: "Correlação clínica e ortopédica; imobilização e fisioterapia."
    Rotura parcial ≥50%: "Avaliação ortopédica para decisão conservadora ou cirúrgica."
    Rotura total Aquiles: ATIVAR N4 — "Ortopedia urgente (reparo cirúrgico vs. funcional)."
    Rotura total patelar/quadricípite: ATIVAR N4 — "Ortopedia urgente — reparo cirúrgico."
    HADD Tipo III aguda: "Ortopedia/reumatologia (punção aspirativa + lavagem, AINE, infiltração)."
    Impacto subacromial: "Ortopedia/fisiatria — fisioterapia, AINE, eventual infiltração subacromial."
    Bursite séptica: ATIVAR R6 — "ALERTA INFECCIOSO: drenagem + ATB urgente."
    Artrite séptica: ATIVAR R6 — "ALERTA INFECCIOSO: punção articular + ATB IV urgente."
    Sinovite ativa PD G2–G3: "Reumatologia — afastar AR, SpA, artrite cristalina, séptica."
    Erosões ósseas: "Reumatologia — correlação clínica e laboratorial (FR, anti-CCP, ácido úrico)."
    STC leve (10–13 mm²): "Neurologia/ortopedia — órtese noturna, AINE, infiltração."
    STC moderado/grave: "Cirurgia de mão — descompressão do túnel do carpo."
    Tunnel cubital: "Neurologia/ortopedia — transposição do nervo ulnar se grave."
    Neuroma de Morton: "Ortopedia — palmilha, infiltração com corticoide; cirurgia se refratário."
    Fascite plantar: "Fisioterapia — alongamento, palmilha, AINE; ondas de choque se refratária."
    Cisto de Baker roto: "Correlação clínica — eco-Doppler para excluir TVP se dúvida diagnóstica."
    Hematoma muscular: "Repouso, crioterapia, fisioterapia. Drenar se volumoso e sintomático."
    Massa suspeita (sarcoma): ATIVAR N4 — "Oncologia/ortopedia — biópsia guiada urgente."
    Snapping hip: "Fisioterapia. US dinâmico para confirmar mecanismo (iliopsoas vs. IT band)."

17. REGRAS TRANSVERSAIS — APLICÁVEIS A TODOS OS 9 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. ANISOTROPIA: confirmar toda hipoecogenicidade tendínea com correção angular (90°).
       Hipoecogenicidade que some = artefato. Que persiste = patologia real.
    b. ESPESSURA: medir sempre em plano longitudinal E transversal.
    c. ROTURA PARCIAL: quantificar em % do diâmetro do tendão no ponto de rotura.
    d. DOPPLER: em exames com Doppler, síntese de vascularização obrigatória na conclusão.
    e. ESTRUTURAS INTRA-ARTICULARES (LCA, meniscos, TFCC): declarar limitação explícita
       e recomendar RM quando essas estruturas são a questão clínica principal.
    f. SARCOMA: massa sólida profunda >3 cm com PD interno caótico = N4 imediato.
    g. ARTRITE SÉPTICA: qualquer derrame ecogênico espesso + febre = R6.
    h. COMPARAÇÃO CONTRALATERAL: mencionar quando feita e o resultado.
    i. PROTOCOLO DINÂMICO: declarar quando realizado e o resultado (positivo/negativo).
    j. ORDEM DA CONCLUSÃO: N4 → N3 → N2 → N1 → N0. Nunca inverter.`,

  // ═══════════════════════════════════════════════════════════════
  // MASTOLOGIA
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area mastologia
   * @scope Ultrassom de mama bilateral, nódulos, cistos, gânglios axilares,
   *        nódulos sólidos, classificação BI-RADS ACR.
   */
  'mastologia': `DIRETRIZES CLÍNICAS — MASTOLOGIA (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: ACR BI-RADS 2013 · SBM · FEBRASGO · NCCN · ASCO
             EUSOMA · ACR · CBR · SBUS · EUSOMA Linfonodos 2024

MAPA DE EXAMES DESTA ÁREA (3 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ MAMAS                   — BI-RADS, nódulos, cistos, implantes     │
  │ MAMAS COM DOPPLER       — idem + Doppler, mastite, abscesso       │
  │ LINFONODOS AXILARES     — Berg I-III, estadiamento oncológico      │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CLASSIFICAÇÃO BI-RADS (ACR 2013) — OBRIGATÓRIA para toda formação mamária
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌──────────┬─────────────────────────────────────────────────────────────────┐
   │ CATEGORIA│ INTERPRETAÇÃO / CONDUTA                                         │
   ├──────────┼─────────────────────────────────────────────────────────────────┤
   │ 0        │ Incompleto — imagens adicionais necessárias (MMG/RM)            │
   │ 1        │ Negativo — sem achados. Rastreamento anual.                     │
   │ 2        │ Benigno — sem risco. Rastreamento de rotina.                    │
   │ 3        │ Provavelmente benigno — <2% risco. Controle US 6 meses.        │
   │ 4A       │ Suspeita baixa — 2–10%. Biópsia: correlação clínica.           │
   │ 4B       │ Suspeita intermediária — 10–50%. Biópsia recomendada.          │
   │ 4C       │ Suspeita moderada-alta — 50–95%. Biópsia indicada.             │
   │ 5        │ Altamente sugestivo malignidade — ≥95%. Biópsia obrigatória.   │
   │ 6        │ Malignidade conhecida — biópsia já positiva. Tratamento.        │
   └──────────┴─────────────────────────────────────────────────────────────────┘
   REGRA: Cada nódulo identificado recebe sua própria categoria BI-RADS.
   Classificação final do exame = maior categoria encontrada.
   Nunca omitir BI-RADS em nenhum achado focal mamário.

2. DESCRITORES DE NÓDULOS SÓLIDOS — BI-RADS Lexicon (ACR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   a) FORMA: oval (favorável) · redonda (favorável) · irregular (suspeita).
   b) ORIENTAÇÃO: paralela ao plano da pele (favorável) · não paralela/vertical (suspeita).
   c) MARGENS:
      Circunscritas: bem definidas, abruptas → favorável (BI-RADS 2–3).
      Indistintas: não há plano claro entre a lesão e o tecido adjacente → suspeita.
      Microlobuladas: bordas com pequenos lóbulos (<5 mm) → suspeita moderada.
      Anguladas: bordas com ângulos agudos → suspeita.
      Espiculadas: projeções lineares saindo da lesão → altamente suspeita (BI-RADS 4C–5).
   d) PADRÃO DE ECO: anecoico · hiperecóico (benigno) · isoecóico · hipoecóico ·
      muito hipoecóico (suspeito) · heterogêneo · complexo cistico-sólido.
   e) FENÔMENOS POSTERIORES: reforço posterior (favorável) · sombra acústica (suspeita) ·
      sem alteração posterior · padrão combinado.
   f) CALCIFICAÇÕES: macrocalcificações (BI-RADS 2) · microcalcificações em aglomerado
      dentro de nódulo (↑suspeita → CONSIDERAR BI-RADS 4B–5, correlação com MMG).
   g) TAMANHO: medir em 3 planos (mm × mm × mm). Documentar localização (quadrante + distância do mamilo em cm).

3. CISTOS MAMÁRIOS — CLASSIFICAÇÃO COMPLETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CISTO SIMPLES (BI-RADS 2):
   Completamente anecoico · margens circunscritas · reforço posterior · sem componente sólido.
   → Benigno. Sem biópsia. Rastreamento de rotina.

   CISTO COMPLICADO (BI-RADS 3):
   Conteúdo com ecos internos finos homogêneos (debris) · sem componente sólido.
   Pode ter sedimentação. Sem PD interno.
   → <2% risco maligno. Controle US em 6 meses.

   MICRO-CISTO AGRUPADO (BI-RADS 3):
   Cistos menores que 3 mm agrupados em cluster (<5 mm ao todo).
   → Provavelmente benigno. Controle 6 meses.

   CISTO COMPLEXO (BI-RADS 4–5):
   Qualquer um: componente sólido intracístico · septo espesso (>0,5 mm) ·
   espessamento parietal focal · PD interno no componente sólido.
   → Biópsia indicada (papiloma, carcinoma intracístico).

4. ACHADOS SÓLIDOS ESPECÍFICOS — Diagnóstico Diferencial
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIBROADENOMA (BI-RADS 2–3):
   Oval · paralelo · margens circunscritas · hipo/isoecóico homogêneo.
   Macrocálcio interno ("casca de ovo"): BI-RADS 2.
   Fibroadenoma > 3 cm em crescimento: considerar BI-RADS 3 → biópsia.
   Fibroadenoma juvenil (adolescente): pode atingir 5–10 cm — não é malignidade.

   TUMOR FILOIDES (BI-RADS 3–4):
   Fibroadenoma-like + crescimento rápido + tamanho >3 cm + espaços císticos.
   → BI-RADS 3 (benigno típico) ou 4 (suspeito): core biopsy para classificar.
   Maligno: excisão ampla (margens > fibroadenoma).

   HAMARTOMA / FIBROADENOLIPOMA (BI-RADS 2):
   Massa bem delimitada com ecogenicidade mista (gordura + fibras glandulares).
   Cápsula ecogênica. Benigno.

   LIPOMA (BI-RADS 2):
   Massa ovóide, paralela, hiperecóica ou isoecóica, compressível.
   Sem vascularização ao PD. Benigno.

   CARCINOMA (BI-RADS 4B–5):
   Irregular · não paralelo (vertical) · margens espiculadas/anguladas/microlobuladas.
   Muito hipoecóico · sombra acústica posterior · microcalcificações.
   PD: vascularização aumentada interna (neo-vascularização tumoral).
   → Biópsia obrigatória. ATIVAR N4 → mastologista urgente.

5. DOPPLER MAMÁRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PADRÃO VASCULAR BENIGNO:
   Ausente ou periférico escasso. IR alto (>0,70). Fluxo ordeiro.

   PADRÃO VASCULAR SUSPEITO:
   Vascularização interna aumentada · vasos penetrantes irregulares.
   IR baixo (<0,70) = vasos tumorais (neo-angiogênese).
   PD interno em nódulo sólido = BI-RADS não desce abaixo de 4A.

   DOPPLER NA MASTITE/ABSCESSO:
   Hiperemia perilesional (mastite): PD difuso no parênquima adjacente à coleção.
   Abscesso: coleção hipoecóica com PD periférico (parede vascularizada) e centro avascular.

   DOENÇA DE MONDOR (tromboflebite superficial):
   Cordão linear hipoecóico subcutâneo + ausência de fluxo ao PD.
   Benigna, autolimitada. BI-RADS 2. Correlação clínica.

6. MICROCALCIFICAÇÕES — Conduta e Correlação
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Microcalcificações ao US: focos puntiformes hiperecóicos <1 mm.
   MAMOGRAFIA é o exame padrão para avaliação de microcalcificações.
   Se visíveis ao US dentro de nódulo sólido: aumentam suspeita → BI-RADS 4.
   Calcificações em aglomerado sem nódulo visível ao US:
     → Complementar com mamografia antes de classificar BI-RADS.
   US BI-RADS 0 quando as calcificações visíveis na MMG não são identificadas ao US.

7. LINFONODOS AXILARES — Avaliação Completa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CLASSIFICAÇÃO POR NÍVEL (Berg):
   Nível I: lateral ao músculo peitoral menor (axila baixa — mais acessível).
   Nível II: posterior ao peitoral menor (axila média).
   Nível III: medial ao peitoral menor (infraclavicular/axila alta).
   Relatar: nível, número, maior eixo (mm), espessura cortical (mm), hilo.

   CRITÉRIOS MORFOLÓGICOS:
   Normal: oval · córtex uniforme ≤3 mm · hilo gorduroso preservado e central.
   Suspeito (qualquer um):
     Córtex >3 mm focal ou difuso.
     Hilo ausente ou excêntrico/deslocado.
     Forma arredondada (relação eixo L/T <2).
     Vascularização cortical ao PD (em vez de hilar).
   → Linfonodo suspeito em contexto oncológico: PAAF guiada por US.

8. IMPLANTES MAMÁRIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOCALIZAÇÃO: subglandular (anterior ao músculo peitoral) ou submuscular.
   Descrever: localização, contorno, conteúdo do implante.

   IMPLANTE ÍNTEGRO: anecoico · parede lisa · sem dobras anômalas.
   Dobras radiais: pregas simétricas da cápsula interna → VARIANTE NORMAL.

   RUPTURA INTRACAPSULAR:
   Sinal da "linguine": múltiplas linhas hiperecóicas ondulantes no interior
     do implante (silicone vazou dentro da cápsula, que permanece íntegra).
   → BI-RADS 0: "Confirmar com RM mamária — US tem limitação para ruptura intracapsular."

   RUPTURA EXTRACAPSULAR:
   Silicone para além da cápsula: ecogenicidade heterogênea periimplante.
   Artefato "nevasca" (snowstorm): reflexão densa + sombra acústica do silicone livre.
   Siliconoma axilar: nódulo hiperecóico com snowstorm na axila.
   → N3 → mastologista (explante planejado).

9. MASTITE E ABSCESSO MAMÁRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MASTITE INFECCIOSA:
   Espessamento da pele (>2 mm) · edema do subcutâneo · hiperemia difusa ao PD.
   Sem coleção definida. ATB + suporte.
   Perguntar: lactação? (mastite puerperal — S.aureus mais comum).

   ABSCESSO MAMÁRIO:
   Coleção hipoecóica/anecoica com debris · paredes espessas · PD periférico.
   Flutuação: conteúdo líquido confirma puncionabilidade.
   Localização: subcutâneo / profundo / retroareolar.
   Conduta: drenagem percutânea guiada por US (agulha 18G ou cateter 8F).
   → N3 → mastologista ou cirurgião (drenagem + ATB IV).
   Abscesso volumoso ou fístula: cirurgia.

   GALACTOCELE:
   Lactante com massa cística de conteúdo variável (leite retido).
   Conteúdo anecóico a hiperecóico dependendo da concentração de gordura.
   Sedimentação líquido-líquido (leite): patognomônico.
   BI-RADS 2 se típico. PAAF confirmatória se atípico.

   GINECOMASTIA (exames masculinos):
   Tipo nodular: tecido glandular subareolar hiperecóico nodular.
   Tipo dendrítico: extensões ramificadas do tecido.
   Excluir sempre nódulo periférico suspeito → BI-RADS obrigatório.

   CARCINOMA MAMÁRIO MASCULINO — Critérios diagnósticos:
   · Localização SUBAREOLAR EXCÊNTRICA (deslocado do centro): distingue de ginecomastia, que é central/simétrica.
   · Aspecto: nódulo sólido hipoecóico, irregular, margens indistintas ou espiculadas.
   · PD interno aumentado (vascularização intratumoral).
   · REGRA ABSOLUTA: qualquer nódulo sólido PERIFÉRICO (fora da área subareolar central bilateral)
     em exame masculino → ATIVAR N4 + BI-RADS ≥4A + encaminhamento mastologista urgente.
   · Ginecomastia bilateral simétrica = benigna. Unilateral + nódulo excêntrico = suspeita de Ca.

   DESCARGA PAPILAR — Protocolo Ductal:
   INDICAÇÃO: descarga unilateral, uniductal, espontânea — sobretudo sanguinolenta/serossanguínea.
   AVALIAÇÃO SISTEMÁTICA:
   · Calibre ductal: normal <2 mm subareolar. Dilatação ≥2 mm = patológica.
   · Identificar imagem intraductal (nódulo, vegetação, debris ecogênicos).
   · Documentar extensão da dilatação em mm desde o mamilo.
   CONDUTAS:
   · Ducto dilatado ≥2 mm + imagem sólida intraductal → BI-RADS 4: mastologista (ductogalactografia / cirurgia).
   · Ducto dilatado sem imagem focal → BI-RADS 3: controle US 6 meses + correlação clínica.
   · Ductos normais + descarga: descrever normalidade — NÃO valorizar descarga isolada como achado focal.

   MAMA NA GESTAÇÃO E LACTAÇÃO:
   PARÊNQUIMA ESPERADO: aumento difuso de densidade glandular; ecotextura heterogênea (NORMAL).
   · Lobulação glandular exuberante + hipervascularização difusa ao PD = fisiológicos.
   AVALIAÇÃO DE NÓDULOS (gestante/lactante):
   · BI-RADS 2–3: controle US pós-amamentação para avaliação definitiva.
   · BI-RADS 4–5: NÃO aguardar — biópsia imediata independente do estado gestacional/puerperal.
   ABSCESSO PUERPERAL:
   · Coleção hipoecóica com debris + febre + mastite após parto.
   · <3 cm: ATB IV (cefalexina/amoxicilina-clavulanato) + ordenha frequente.
   · ≥3 cm ou sem resposta ao ATB: drenagem percutânea guiada por US + ATB.
   → N3: mastologista/ginecologista (risco de sepse puerperal se não tratado).
   Nota: GALACTOCELE = cisto de leite retido → BI-RADS 2 se sedimentação líquido-gordura típica.

10. CONDIÇÕES AGUDAS — Gatilhos N3 / N4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    BI-RADS 5 ou massa altamente suspeita → N4 → mastologista urgente.
    Nódulo sólido periférico em paciente masculino → N4 — excluir carcinoma masculino.
    Abscesso puerperal ≥3 cm → N3 → drenagem percutânea guiada por US + ATB IV.
    Descarga papilar + ducto ≥2 mm + imagem intraductal → N3 → mastologista (ductogalactografia).
    Linfonodo suspeito em contexto de nódulo BI-RADS 4–5 → PAAF axilar → N3.
    Ruptura extracapsular de implante com sintomas → N3 → mastologista.

11. TABELA MESTRA DE REFERÊNCIA — Mastologia
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Achado                        │ Normal / BI-RADS  │ Alerta / Ação
    ──────────────────────────────┼───────────────────┼──────────────────────────
    Cisto simples                 │ BI-RADS 2         │ Sem ação
    Cisto complicado              │ BI-RADS 3         │ Controle 6 meses
    Cisto complexo com sólido     │ BI-RADS 4–5       │ Biópsia
    Nódulo oval circunscrito      │ BI-RADS 2–3       │ Controle/rotina
    Nódulo espiculado             │ BI-RADS 4C–5      │ Biópsia obrigatória → N4
    Córtex linfonodal             │ ≤3 mm             │ >3 mm = suspeito → PAAF
    Hilo linfonodal               │ Preservado        │ Ausente = suspeito → PAAF
    Implante — dobras radiais     │ Normal            │ Sem ação
    Implante — linguine sign      │ Ruptura intra     │ RM confirmatória → N3
    Implante — snowstorm          │ Ruptura extra     │ Mastologista → N3
    Pele mamária                  │ ≤2 mm             │ >2 mm = edema/mastite
    Abscesso confirmado           │ Ausente           │ Drenagem + ATB → N3

12. FRASEOLOGIA PADRÃO — Biblioteca V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    BI-RADS 1: "Exame ultrassonográfico mamário sem achados focais.
      BI-RADS 1. Rastreamento conforme protocolo habitual."
    BI-RADS 2: "Formação cística simples em [quadrante] [D/E], [X] mm.
      Sem características suspeitas. BI-RADS 2. Rastreamento de rotina."
    BI-RADS 3: "Nódulo sólido de características provavelmente benignas em [quadrante]
      [D/E], [X]×[Y]×[Z] mm. BI-RADS 3. Controle ultrassonográfico em 6 meses."
    BI-RADS 4A: "Nódulo sólido com características de baixa suspeição em [quadrante]
      [D/E], [X] mm. BI-RADS 4A. Correlação com mastologista; considerar biópsia."
    BI-RADS 4B/4C: "Nódulo sólido suspeito em [quadrante] [D/E], [X] mm —
      [margens espiculadas / orientação vertical / muito hipoecóico].
      BI-RADS [4B/4C]. Encaminhamento para mastologista com indicação de
      core biopsy guiada por imagem."
    BI-RADS 5: ATIVAR N4 — "Lesão altamente suspeita de malignidade em [local],
      [X] mm. BI-RADS 5. Mastologista urgente — biópsia obrigatória."
    Linfonodo suspeito: "Linfonodo axilar [D/E] nível [I/II/III] com córtex
      espessado ([X] mm) e hilo [ausente/excêntrico]. PAAF guiada por US
      recomendada no contexto oncológico."
    Abscesso: "Coleção [X] mL em [quadrante] [D/E] com aspecto de abscesso mamário.
      Drenagem percutânea guiada por imagem e antibioticoterapia indicadas."

13. REGRAS TRANSVERSAIS — TODOS OS 3 EXAMES DE MASTOLOGIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. BI-RADS OBRIGATÓRIO para cada achado focal e para o exame globalmente.
    b. MEDIÇÃO EM 3 PLANOS: todo nódulo sólido (mm × mm × mm).
    c. LOCALIZAÇÃO: quadrante + posição horária + distância do mamilo em cm.
    d. BILATERAL: sempre avaliar e relatar ambas as mamas.
    e. LINFONODOS AXILARES: avaliar e relatar em todo exame de mama (nível I mínimo).
    f. DOPPLER: documentar padrão vascular de todo nódulo sólido ≥5 mm.
    g. MICROCALCIFICAÇÕES: recomendar correlação com mamografia quando identificadas.
    h. IMPLANTES: descrever integridade em todos os exames de portadoras.
    i. BI-RADS 4–5: nunca omitir recomendação de biópsia no laudo.
    j. ORDEM CONCLUSÃO: N4 → N3 → N2 → N1 → N0.`,

  // ═══════════════════════════════════════════════════════════════
  // PEQUENAS PARTES
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area pequenas-partes
   * @scope Tireoide, paratireoides, testículos, epidídimos, escroto,
   *        gânglios cervicais, glândulas salivares, tecidos moles.
   */
  'pequenas-partes': `DIRETRIZES CLÍNICAS — PEQUENAS PARTES (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: ACR TI-RADS 2017 · ATA · NASCET/ECST · ISUOG · CBR · SBUS
             EAU · AUA · ACR · SRU · ESUR · CIRSE
AUTOCÁLCULOS: Volume (elipsoide) → FASE 4.1 de general.ts.
              Aplicar para tireoide, testículos, nódulos, glândulas e cistos.

MAPA DE EXAMES DESTA ÁREA (10 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ TIREÓIDE                — nódulos TI-RADS, parênquima, glândula   │
  │ TIREÓIDE COM DOPPLER    — idem + vascularização + paratireoide    │
  │ CERVICAL                — linfonodos, massas cervicais, glândulas  │
  │ CERVICAL COM DOPPLER    — carótidas + vertebrais + estenose       │
  │ BOLSA ESCROTAL          — testes, epidídimo, hidrocele            │
  │ BOLSA ESCROTAL c/ DOPP  — idem + torção (R6) + varicocele        │
  │ GLÂNDULAS SALIVARES     — parótida, submandibular, cálculos       │
  │ PARTES MOLES            — massa de superfície, lipoma, cisto      │
  │ REGIÕES INGUINAIS       — hérnias, linfonodos, feixe vascular     │
  │ PAREDE ABDOMINAL        — hérnias, eventração, hematoma de reto   │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. TIREOIDE — Sistema TI-RADS (ACR 2017) — OBRIGATÓRIO para todo nódulo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PONTUAÇÃO (somar para cada nódulo individualmente):
   COMPOSIÇÃO:  Espongiforme/Cisto puro = 0 · Misto = 1 · Sólido/quasi-sólido = 2
   ECOGENICIDADE: Anecóico = 0 · Hiperecóico/Isoecóico = 1 · Hipoecóico = 2 · Muito hipoecóico = 3
   FORMA:       Mais largo que alto (transversal) = 0 · Mais alto que largo = 3
   MARGENS:     Lisas/mal definidas = 0 · Lobuladas/irregulares = 2 · Extra-tireoidiana = 3
   FOCOS ECOG.: Ausentes/cauda de cometa = 0 · Macrocalcificação = 1
                Calcificação periférica = 2 · Microfocos puntiformes = 3

   CATEGORIA    │ PONTOS │ RISCO MALIG. │ BIÓPSIA SE       │ CONTROLE SE
   ─────────────┼────────┼──────────────┼──────────────────┼──────────────
   TI-RADS 1   │ —      │ Benigno      │ Não indicado     │ —
   TI-RADS 2   │ 0      │ <1%          │ Não indicado     │ —
   TI-RADS 3   │ 2      │ ~5%          │ ≥2,5 cm          │ ≥1,5 cm
   TI-RADS 4   │ 3–6    │ ~10–80%      │ ≥1,5 cm          │ ≥1,0 cm
   TI-RADS 5   │ ≥7     │ >80%         │ ≥1,0 cm          │ ≥0,5 cm

   REGRAS TI-RADS:
   • Nódulo espongiforme puro (>50% microcistos) = TI-RADS 2 independente do tamanho.
   • Microcalcificações puntiformes SEM outro achado suspeito: não elevar para TI-RADS 5 isoladamente.
   • Extensão extra-tireoidiana (+3 pts) classifica automaticamente como TI-RADS 5 min.
   • "Controle" = US em 1 ano (TI-RADS 3) ou 6 meses (TI-RADS 4–5 abaixo do limiar de biópsia).
   • PAAF guiada por US: amostragem do nódulo + imuno-histoquímica → Bethesda.

   ELASTOGRAFIA TIREOIDIANA (quando disponível — sonoelastografia):
   · SE score 1–2 (mole/muito mole): nódulo compressível → reduz suspeição em TI-RADS 3–4.
   · SE score 3 (dureza intermediária): neutro — manter classificação TI-RADS conforme pontuação.
   · SE score 4–5 (rígido/muito rígido): nódulo incompressível → elevar TI-RADS em 1 categoria
     (ex.: TI-RADS 3 → conduta TI-RADS 4; TI-RADS 4 → reforçar indicação de PAAF).
   NOTA: elastografia é ADJUVANTE ao TI-RADS — NÃO substitui a pontuação ACR 2017.

2. TIREOIDE — Dimensões, Parênquima e Tireoidites
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DIMENSÕES: cada lobo = comprimento × largura × espessura (AP). Volume = FASE 4.1.
   Normal: ♀ 4–15 cm³/lobo; ♂ 6–20 cm³/lobo. Istmo: ≤3 mm (AP).
   Bócio: volume total >25 cm³ (♀) ou >30 cm³ (♂). Bócio mergulhante: extensão retroesternal.

   PARÊNQUIMA NORMAL: ecogenicidade homogênea, ligeiramente maior que músculo adjacente.

   TIREOIDITE DE HASHIMOTO (HT): hipoecogenicidade difusa (padrão micronodular);
     ecotextura heterogênea; volume variável (atrofia tardia); Doppler: discretamente
     ↑ em fase ativa, normal em fase atrófica. → Correlação TSH/TPO-Ab/Tg-Ab.
   TIREOIDITE SUBAGUDA (De Quervain): área(s) hipoecóica(s) mal definidas, geralmente
     dolorosas à palpação; unilateral ou migratória; hipovascularização ao Doppler.
     → Correlação VHS/PCR + cintilografia.
   DOENÇA DE GRAVES (DTG): bócio difuso, parenquima hipoecóico heterogêneo;
     "inferno tireoidiano" ao Doppler colorido (hipervascularização difusa e intensa);
     artéria tireoidiana inferior: PVS >30 cm/s. → Correlação TSH/T4L/TRAb.
   BÓCIO MULTINODULAR (BMN): múltiplos nódulos de diferentes tamanhos, volume ↑;
     cada nódulo DEVE ser classificado pelo TI-RADS.

   US PÓS-TIREOIDECTOMIA — Protocolo de seguimento:
   ANATOMIA: leito tireoidiano (região pré-traqueal/paratraqueal); tecido residual esperado
     nos primeiros meses pós-cirurgia; diferenciar de recidiva nodular.
   AVALIAÇÃO SISTEMÁTICA OBRIGATÓRIA:
   · Leito tireoidiano: medir tecido residual (mm); formações nodulares = recidiva local suspeita.
   · Linfonodos nível VI (paratraqueal, pré-traqueal, pré-laríngeo): principal sítio de recidiva.
   · Cadeias jugulares níveis II–V bilaterais: metástase ganglionar regional.
   CRITÉRIOS SUSPEITOS:
   · Nódulo no leito >8 mm ou com microcalcificações → PAAF guiada + dosagem Tg no lavado.
   · Linfonodo suspeito (hilo ausente, calcificação puntiforme, aspecto cístico) → PAAF + Tg lavado.
   FREQUÊNCIA RECOMENDADA (conforme ATA/Endocrine Society):
   · 1° e 2° anos: US cervical a cada 6–12 meses.
   · Após 2 anos sem evidência de doença: US anual até completar 5 anos.
   · Alto risco (T3b–T4, N1, metástase a distância): intervalo reduzido conforme endocrinologia.

3. PARATIREÓIDES — Localização e adenoma
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Normal: NÃO visíveis ao US (0,3–0,5 cm — abaixo da resolução).
   ADENOMA DE PARATIREOIDE: nódulo hipoecóico, ovalado/reniforme, posterior ou lateral
     ao lobo tireoidiano; vascularização polar ao Doppler colorido.
     Volume sugestivo: >0,5 cm³ (limiar SESTAMIBI); tamanho >6 mm em pelo menos 1 eixo.
     Localização: superior (75%) · inferior (25%) · ectópico retrotraqueal/mediastinal.
   Diferencial com linfonodo: adenoma tem hilo ausente; polo vascular (não periférico/hilar).
   PARATIREOIDE ECTÓPICA: retrotraqueal, paraesofágica, mediastinal → TC cervicotorácica.
   → Correlação obrigatória: PTH total, cálcio total e iônico → endocrinologia/cirurgia.

4. LINFONODOS CERVICAIS — Critérios de benignidade e suspeição
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CADEIAS CERVICAIS (classificação de Som — níveis I–VII):
     I: submentual/submandibular · II–IV: jugular int. (sup/med/inf)
     V: triângulo posterior · VI: central/paratraqueal · VII: mediastinal sup.

   BENIGNO (critérios): forma oval (relação L/S ≥2); hilo gorduroso preservado; cortical
     ≤3 mm uniforme; sem vascularização periférica exclusiva.
   Linfonodo reacional: oval, cortical difusamente espessada <3 mm, hilo presente,
     sem necrose. Contexto de infecção → resolução em 3–6 semanas.

   SUSPEITO (exige PAAF/core biopsia):
     Forma redonda (L/S <2,0). Hilo ausente. Cortical >3 mm ou excêntrica.
     Calcificações puntiformes (padrão papilar de tireoide). Necrose central.
     Doppler caótico/periférico (sem padrão hilar). Cápsula irregular.
     Tamanho >1 cm em cadeia sem causa infecciosa regional.
   MALIGNO CONFIRMADO PELO CONTEXTO: necrose + calcificações + contexto oncológico
     → N3 urgente (oncologia de cabeça e pescoço).

5. MASSAS CERVICAIS — Diagnóstico diferencial
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CISTO BRANQUIAL (2ª fenda — mais comum): lateral ao ECM, anterior à ACI,
     anecoico, paredes finas, ocasionalmente com ecos de colesterol.
   CISTO DO DUCTO TIREOGLOSSO: linha média cervical, move com deglutição/protrusão de língua.
     Cirurgia de Sistrunk (exérese inclui osso hioide).
   HIGROMA CÍSTICO (malformação linfática): multilocular, paredes finas, sem PD interno.
     Ocasionalmente hemorrágico (líquido com ecos).
   NEURINOMA (schwannoma): massa ovoide, sólida, homogênea, ao longo de nervo.
     Em cadeia jugular: parasimpático/vago. Bifurcação carotídea: corpo carotídeo.
   PARAGANGLIOMA CAROTÍDEO: massa sólida na bifurcação da ACC; afasta ACC de ACI
     (sinal da taça); hipervascularizada ao Doppler; correlação com catecolaminas.
     → ATIVAR N3: encaminhamento cirurgia vascular/oncológica; NÃO puncionar sem preparo.

6. CARÓTIDAS E VERTEBRAIS — Doppler (exame CERVICAL COM DOPPLER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VALORES NORMAIS DE REFERÊNCIA:
   ACC: VPS 60–90 cm/s · VDF 20–30 cm/s · IR 0,55–0,75.
   ACI: VPS 50–80 cm/s · VDF 25–40 cm/s · IR 0,55–0,70 (baixa resistência).
   ACE: VPS 60–90 cm/s · IR 0,70–0,85 (alta resistência, biscúspide ao Doppler espectral).
   AV: VPS 30–60 cm/s · fluxo anterógrado bilateral.

   ESPESSURA MÉDIO-INTIMAL (EMI — bulbo carotídeo):
     <0,9 mm = normal. 0,9–1,2 mm = espessamento. >1,2 mm = placa aterosclerótica.

   PLACA ATEROSCLERÓTICA — Caracterização obrigatória:
     Localização (bifurcação, ACI proximal, ACC), extensão (mm), tipo:
     Isoecóica (fibrosa) · Hipoecóica (lipídica/vulnerável) · Hiperecóica (calcificada)
     · Heterogênea (mista, risco de ulceração). Superfície: regular ou irregular/ulcerada.

   GRAU DE ESTENOSE (NASCET — baseado no diâmetro residual ACI):
     <50% = não significativa. 50–69% = moderada. 70–99% = grave. 100% = oclusão.
   CRITÉRIOS VELOCIMÉTRICOS (NASCET):
     Estenose 50–69%: VPS ACI ≥125 cm/s · relação VPS ACI/ACC ≥2,0.
     Estenose ≥70%: VPS ACI ≥230 cm/s · relação VPS ACI/ACC ≥4,0.
     Estenose ≥70%: ATIVAR N3 → neurologia/neurocirurgia vascular (CEA ou CAS).
   OCLUSÃO TOTAL: ausência de sinal em toda extensão · thrombosis intra-luminal.
     → ATIVAR R6 (AVC isquêmico em curso?) → avaliação neurológica urgente.

   ARTÉRIA VERTEBRAL (AV):
     Fluxo anterógrado bilateral = normal.
     Fluxo invertido (retrógrado): síndrome de roubo da subclávia.
     Ausência de fluxo: hipoplasia (V4 <2 mm) vs. oclusão → diferencial por calibre.

7. GLÂNDULAS SALIVARES — Avaliação sistemática
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PARÓTIDA: normal — ecogênica (isoecóica ao músculo, levemente heterogênea),
     sem massas, ducto de Stensen não dilatado. Medir lobo superficial.
   SUBMANDIBULAR: oval, homogênea, ecogênica. Ducto de Wharton ≤2 mm.
   SUBLINGUAL: pequena, difícil de individualizar ao US — geralmente avaliada por TC/RM.

   SIALADENITE AGUDA: glândula aumentada, hipoecóica, hipervascularizada.
     Abscessada: coleção heterogênea com debris; → R6 se abscessada (drenagem).
   SIALOLITÍASE (cálculo salivar): foco hiperecóico com sombra acústica + ducto dilatado.
     Localização: ducto de Wharton (submandibular mais comum), ducto de Stensen.
     → Tamanho do cálculo + extensão proximal da dilatação.
   SÍNDROME DE SJÖGREN: parênquima heterogêneo com aspecto micronodular/microcístico
     ("queijo suíço"); hipoecogenicidade difusa; correlação Anti-Ro/La.
   NEOPLASIA PAROTÍDEA:
     Adenoma pleomórfico: sólido, bem delimitado, homogêneo, hipovascularizado.
       Maior neoplasia benigna (85% das parotídeas). → Parotidectomia (risco transformação).
     Tumor de Warthin: bilateral (10%), polo inferior, aspecto multiloculado-sólido.
     Carcinoma mucoepidermóide: margens irregulares, infiltrativo, vascularização interna.
       → N3/N4: PAAF + cirurgia de cabeça e pescoço.

8. BOLSA ESCROTAL — Avaliação morfológica
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TESTÍCULO (dimensões + volume via FASE 4.1):
     Normal: 3–5 × 2–3 × 2–3 cm; volume 15–25 cm³. Ecogenicidade: fina e homogênea.
     Hipotrofia: volume <12 cm³ (correlação hormonal/atrofia).
     Hipospermia: testículo <4 cm³ = oligospermia provável.

   EPIDÍDIMO: cabeça ≤6 mm; corpo ≤3 mm; cauda ≤5 mm.
     Epididimite: cabeça >12 mm + hipoecogenicidade + hipervascularização ao PD.
     Espessamento difuso + testículo acometido = epididimo-orquite → N3 + ATB.

   TORÇÃO TESTICULAR (emergência absoluta):
     Testículo aumentado, hipoecóico (edema isquêmico), posição alta/horizontal.
     AUSÊNCIA DE FLUXO ao Doppler colorido = torção provável.
     Tempo-dependente: <6h = 90–100% viabilidade. 6–12h = 50%. >24h = <10%.
     PD PRESENTE não exclui torção incompleta/parcial — clínica prevalece.
     → ATIVAR R6: "ALERTA CIRÚRGICO: torção testicular suspeita — exploração
       escrotal de emergência imediata."

   NÓDULO SÓLIDO INTRATESTICULAR:
     TODA lesão sólida intratesticular = suspeita de neoplasia testicular.
     Seminoma: hipoecóico, homogêneo, margens regulares. AFP normal, β-hCG ↑.
     Não-seminoma (tumores de células germinativas mistos): heterogêneo, calcificações.
     Microlitíase testicular: depósitos puntiformes hiperecóicos ≥5/campo.
     Estratificação de risco:
     · Isolada sem outros fatores de risco: baixo risco — NÃO indica biópsia; controle clínico.
     · Com criptorquidia, atrofia testicular (<12 cm³) ou lesão focal ipsilateral:
       ALTO RISCO → N4: encaminhar urologia para avaliação de biópsia.
     · Com nódulo sólido intratesticular associado: tratar como neoplasia suspeita.
     → N4 (nódulo sólido): "Encaminhamento urgente urologia/oncologia — orquiectomia radical via inguinal."

   HIDROCELE: coleção anecoica na túnica vaginal.
     Leve (<5 mm laminar): normal em adultos. Moderada (5–20 mm). Volumosa (>20 mm).
     Ecos internos: hematocele (trauma), piocele (infecção → R6), quilocele.
   ESPERMATOCELE/CISTO EPIDIDIMÁRIO: lesão cística na cabeça ou corpo do epidídimo.
     · Espermatocele: conteúdo com ecos finos difusos (espermatozoides — não anecoico puro);
       geralmente ≥5 mm; pós-vasectomia comum; benigna.
     · Cisto epididimário: conteúdo anecoico puro (seroso); paredes finas; sem PD interno.
     Distinção prática: ambos benignos <2 cm — sem conduta. >2 cm ou sintomático: urologia.

   VARICOCELE: veias plexo pampiniforme ≥2,5 mm em repouso + refluxo ao Valsalva (>2 s).
     Grau clínico: I (Valsalva) · II (repouso) · III (visual).
     REGRA: varicocele D isolada → excluir massa retroperitoneal compressiva (US abdominal).
     → Bilateral ou grau II–III: urologia/andrologia (correlação espermograma).

9. PARTES MOLES — Massas de superfície
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DESCREVER SISTEMATICAMENTE: topografia (estrutura e plano anatômico); dimensões (3 eixos);
   ecogenicidade; contornos; componente sólido/cístico; vascularização ao Doppler; relação com
   planos profundos (músculo, fáscia, periósteo).

   LIPOMA: hiperecóico a isoecóico; paredes finas; sem PD interno; compressível;
     paralelo aos planos teciduais. Subcutâneo. Sem conduta se típico e assintomático.
   CISTO EPIDERMÓIDE/SEBÁCEO: subcutâneo; anecoico a hipoecóico; halo hipoecóico;
     "cauda de cometa" ou pseudossólido ("queijo cottage"). Sem PD. Inflamado → hiperemia.
   ABSCESSO: coleção hipoecoica heterogênea, paredes espessas; PD periférico;
     dor, eritema, febre. → N4: drenagem cirúrgica ou percutânea guiada por US.
   HEMATOMA: heterogêneo; sem PD interno; evolução: anecóico (lise) → hipoecoico.
     Hematoma pós-trauma muscular: intramuscular, fusiforme.
   GANGLIOM/CISTO SINOVIAL: anecoico/hipoecóico, parede fina, sem PD; adjacente a tendão
     ou articulação. Típico = benigno. Ressecção se sintomático.
   NEUROFIBROMA/SCHWANNOMA: ovoide, hipoecóico, "sinal dos olhos de coruja"; ao longo de nervo.
   SUSPEITA DE SARCOMA: massa profunda sólida heterogênea >3–5 cm; margens infiltrativas;
     PD interno abundante; crescimento rápido. → ATIVAR N4: biópsia guiada + oncologia.

10. HÉRNIAS — Parede abdominal e regiões inguinais
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TIPOS POR LOCALIZAÇÃO:
    Inguinal indireta: saco herniário no canal inguinal (lat. aos vasos epigástricos inferiores).
    Inguinal direta: hérnia pelo trígono de Hesselbach (medial aos vasos epig. inferiores).
    Femoral: abaixo do ligamento inguinal, medial à veia femoral; mais freq. em ♀.
    Umbilical: através do anel umbilical.
    Epigástrica: linha alba, entre umbigo e processo xifoide.
    Incisional (eventração): em cicatriz cirúrgica prévia.
    Spiegel: junção do músculo reto com a fáscia de Spiegel (lateral ao reto).

    DESCRIÇÃO OBRIGATÓRIA:
    Tipo e localização. Dimensão do anel herniário (mm — crítico para conduta).
    Conteúdo: gordura pré-peritoneal (hiperecóica) · alça intestinal (com peristaltismo)
    · epíplon · bexiga.
    REDUTIBILIDADE (teste dinâmico com manobra de Valsalva):
      Redutível: conteúdo retorna à cavidade ao relaxar. N2.
      Irredutível (encarcerada): conteúdo fixo ao canal. N3/N4.
      Estrangulada: alça sem peristaltismo + PD ausente na parede + dor intensa → ATIVAR R6.

    FRASEOLOGIA DE EMERGÊNCIA HERNIÁRIA:
      Encarcerada: "ALERTA CIRÚRGICO: hérnia encarcerada — avaliação cirúrgica urgente."
      Estrangulada: ATIVAR R6 — "ALERTA CIRÚRGICO: hérnia estrangulada com sinais de isquemia
        intestinal — avaliação cirúrgica de emergência imediata."

    HEMATOMA DO MÚSCULO RETO ABDOMINAL (para PAREDE ABDOMINAL):
    Coleção fusiforme anecoica/hipoecóica DENTRO do músculo reto; contexto de anticoagulação,
    tosse intensa, trauma. → Medição de dimensão máxima; PD ausente interno; TC se volumoso.

11. DOPPLER EM PEQUENAS PARTES — Princípios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    CONFIGURAÇÃO TÉCNICA: transdutor linear 7–15 MHz; PRF baixa (200–800 Hz) para
    vasos de baixo fluxo (parênquima tireoidiano, testículo, parótida).
    PRF alta (2–4 kHz) para carótidas e vertebrais.

    PADRÕES DE VASCULARIZAÇÃO (descrição):
    Ausente: normal em lipoma, cisto, gangliom.
    Periférica: capsular — típica de linfonodo reacional. Em lesão sólida = suspeição.
    Central: intranodular — inespecífica, pode ser benigna ou maligna.
    Mista (peri + central): em neoplasias.
    Caótica/aberrante: vasos de alto grau → suspeição de malignidade elevada.

    TORÇÃO TESTICULAR — protocolo Doppler:
    Ausência de PD = suspeita alta de torção. PD presente NÃO exclui.
    Comparar bilateralmente (assimetria >50% = suspeição).
    Sinal do whirlpool (cordão espiralado): alta especificidade para torção.
    ATIVAR R6 se: dor aguda + testículo aumentado + ausência ou assimetria de PD.

12. TABELA DE REFERÊNCIA — Dimensões normais em Pequenas Partes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Estrutura                  │ Normal                      │ Alerta / Ação
    ───────────────────────────┼─────────────────────────────┼────────────────────────
    Lobo tireoidiano (vol.)    │ ♀ 4–15 cm³ · ♂ 6–20 cm³    │ >20 cm³ = bócio
    Istmo tireoidiano          │ ≤3 mm                       │ >5 mm = bócio/tireoidite
    Nódulo tireoidiano         │ Classificar TI-RADS          │ TI-RADS 4–5 → biópsia
    EMI carotídeo (bulbo)      │ <0,9 mm                     │ >1,2 mm = placa
    VPS ACI normal             │ 50–80 cm/s                  │ >125 cm/s = estenose ≥50%
    VPS ACI estenose grave     │ ≥230 cm/s                   │ ≥70% NASCET → N3
    Testículo (comprimento)    │ 3–5 cm · vol 15–25 cm³      │ <3 cm = hipotrofia
    Epidídimo (cabeça)         │ ≤6 mm                       │ >12 mm = epididimite
    Veia pampiniforme          │ <2,5 mm em repouso           │ ≥2,5 mm = varicocele
    Linfonodo (eixo curto)     │ <10 mm; L/S ≥2; hilo pres. │ >10 mm + suspeito → PAAF
    Ducto submandibular (Whar) │ ≤2 mm                       │ >3 mm + cálculo = sialol.
    Parótida                   │ Homogênea, sem nódulo        │ Massa sólida → PAAF/circ.
    Anel herniário (inguinal)  │ Colabável, conteúdo redutível│ Irredutível → N3; isquemia → R6

13. FRASEOLOGIA PADRÃO — Biblioteca de Recomendações V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TI-RADS 1–2: "Sem indicação de biópsia. Seguimento clínico habitual."
    TI-RADS 3: "Controle US tireoide em 1 ano. Biópsia se ≥2,5 cm."
    TI-RADS 4: "PAAF guiada por US (indicada se ≥1,5 cm). Endocrinologia."
    TI-RADS 5: "PAAF guiada por US indicada (≥1,0 cm). Endocrinologia/cirurgia."
    Bócio difuso + HT: "Correlação laboratorial TSH/TPO-Ab/Tg-Ab. Endocrinologia."
    Doença de Graves (Doppler): "Correlação TSH/T4L/TRAb. Endocrinologia."
    Paratireoide suspeita: "Correlação PTH + Ca2+ sérico. Endocrinologia/cirurgia."
    Linfonodo reacional: "Controle clínico; US cervical em 6–8 semanas se persistir."
    Linfonodo suspeito: "PAAF guiada por US + estudo imunocitoquímico. Cabeça e pescoço."
    Cisto branquial: "Avaliação com cirurgia de cabeça e pescoço (exérese eletiva)."
    Paraganglioma suspeito: "TC/RM + catecolaminas urinárias. Cirurgia vascular oncológica."
    Estenose ACI 50–69%: "Avaliação neurológica + otimização de fatores de risco cardiovascular."
    Estenose ACI ≥70%: ATIVAR N3 — "Avaliação neurológica e vascular (CEA/CAS)."
    Oclusão ACI: ATIVAR R6 — "ALERTA NEUROLÓGICO: AVC isquêmico? Avaliação emergencial."
    Roubo subclávia: "Avaliação vascular — angioTC de arco aórtico e subclávias."
    Torção testicular: ATIVAR R6 — "ALERTA CIRÚRGICO: exploração escrotal de emergência."
    Tumor testicular: ATIVAR N4 — "Urologia urgente — orquiectomia radical inguinal."
    Epididimite: "Antibioticoterapia (fluoroquinolonas ou doxiciclina); avaliação urológica."
    Piocele: ATIVAR R6 — "ALERTA CIRÚRGICO: piocele — drenagem cirúrgica urgente."
    Varicocele Grau II–III: "Urologia/andrologia (correlação espermograma)."
    Varicocele D isolada: "US abdominal para excluir massa retroperitoneal."
    Sialolitíase sintomática: "Avaliação com cirurgia de cabeça e pescoço (sialendoscopia)."
    Abscesso parotídeo: ATIVAR R6 — "Drenagem cirúrgica urgente + ATB IV."
    Neoplasia parotídea suspeita: "PAAF guiada por US + cirurgia de cabeça e pescoço."
    Abscesso partes moles: "Drenagem cirúrgica ou percutânea guiada por US + ATB."
    Massa suspeita de sarcoma: ATIVAR N4 — "Biópsia guiada por US + oncologia (sarcoma)."
    Hérnia redutível: "Avaliação cirúrgica eletiva para herniorrafia."
    Hérnia encarcerada: ATIVAR N4 — "Avaliação cirúrgica urgente."
    Hérnia estrangulada: ATIVAR R6 — "ALERTA CIRÚRGICO: emergência. Isquemia intestinal."

14. REGRAS TRANSVERSAIS — APLICÁVEIS A TODOS OS 10 EXAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. TI-RADS: Todo nódulo tireoidiano identificado DEVE receber pontuação TI-RADS.
       NÃO usar termos como "suspeito" sem a classificação.
    b. VOLUME (FASE 4.1): Aplicar para lobo tireoidiano, testículo e qualquer nódulo/lesão
       com 3 dimensões fornecidas. NÃO recalcular manualmente.
    c. TORÇÃO TESTICULAR: SEMPRE comparar bilateralmente. Ausência assimétrica de PD
       = R6 mesmo sem ausência total de fluxo.
    d. NÓDULO SÓLIDO INTRATESTICULAR: Sempre N4 independente do tamanho ou morfologia.
    e. LINFONODO: Não dimensão isolada, mas conjunto de critérios morfológicos + Doppler.
    f. HÉRNIAS: Descrever SEMPRE redutibilidade com Valsalva. Irredutível = N3 mínimo.
    g. DOPPLER CERVICAL: Relatar VPS da ACI + relação ACI/ACC. Classificar por NASCET.
    h. PARAGANGLIOMA: NUNCA puncionar sem preparo adequado (risco de crise hipertensiva).
    i. PARTES MOLES PROFUNDAS >5 cm: massa sólida profunda = suspeita de sarcoma até prova.
    j. ORDEM DA CONCLUSÃO: N4 → N3 → N2 → N1 → N0. Nunca inverter.`,

  // ═══════════════════════════════════════════════════════════════
  // PEDIATRIA
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area pediatria
   * @scope Abdome pediátrico, crânio neonatal, quadril (DDQ),
   *        escroto agudo pediátrico, bolsa escrotal.
   */
  'pediatria': `DIRETRIZES CLÍNICAS — PEDIATRIA (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: SPP · SBP · SPR · AAP · ESPR · AIUM · ACR · SFU
             ISUG · Graf (DDQ) · Papile (HIV) · ESHRE-Pediatria

MAPA DE EXAMES DESTA ÁREA (6 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ TRANSFONTANELA              — crânio neonatal, HIV, LPV, Doppler  │
  │ COLUNA LOMBOSSACRA          — cordão ancorado, lipoma, espinha     │
  │ ABDOME TOTAL PEDIÁTRICO     — piloro, invaginação, apêndice, RVU  │
  │ RINS E VIAS URINÁRIAS PED.  — hidronefrose SFU, bexiga, refluxo  │
  │ QUADRIL PEDIÁTRICO — DDQ    — Graf alfa/beta, Pertes, sinovite    │
  │ ESCROTO AGUDO PEDIÁTRICO    — torção testicular, orquite, hidro   │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. REGRAS FUNDAMENTAIS — PEDIATRIA (aplicam-se a TODOS os 6 exames)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FAIXA ETÁRIA OBRIGATÓRIA: Todo achado interpretado pelo contexto etário.
   Neonato (<28 dias) · Lactente (1–12 meses) · Pré-escolar (1–5 anos)
   Escolar (6–12 anos) · Adolescente (13–18 anos).
   A faixa etária DEVE constar em cada conclusão.

   PROIBIÇÕES ABSOLUTAS EM PACIENTES PEDIÁTRICOS:
   Ateromatose ou placa aterosclerótica.
   Hipertrofia prostática benigna (HPB).
   Espessamento médio-intimal aterosclerótico.
   Litíase renal descrita como "inespecífica" — sempre correlacionar com
     hipercalciúria, infecção, anomalia metabólica.
   Fraseologia adulta de achados normais pediátricos (ex.: "fígado aumentado"
     em lactente sem contexto — o fígado é fisiologicamente maior até 2 anos).

   VARIANTES NORMAIS PEDIÁTRICAS:
   Rins: ecogenicidade cortical relativamente aumentada em neonatos (<1 mês);
     diferenciação corticomedular exuberante (pirâmides hipoecóicas proeminentes).
   Baço: pode atingir até 11 cm no adolescente saudável.
   Fígado: borda inferior ultrapassa o rebordo costal até os 3 anos (normal).
   Ovários: microcistos foliculares são fisiológicos em qualquer faixa etária.
   Testículo pré-puberal: <2 cm de comprimento, textura homogênea, PD mínimo.
   Timo: estrutura triangular no mediastino anterior — é NORMAL até a puberdade.
   Útero infantil: corpo < colo (invertido em relação ao adulto) — normal.
   Hematoma adrenal neonatal: massa supra-renal heterogênea no 1° mês de vida (pós-parto).
     Evolui com liquefação progressiva e calcificação periférica.
     NÃO confundir com neuroblastoma — REGRA: controle US em 2–4 semanas; regressão = benigno.
     Sem regressão em 4 semanas ou crescimento → N3: oncologia pediátrica + RM.
   Hérnia umbilical fisiológica: protrusão no anel umbilical em lactentes.
     Fisiológica até 12–18 meses; resolução espontânea na maioria dos casos.
     Cirurgia apenas se persistência após 5 anos ou diâmetro do anel >2 cm — NÃO indicar cirurgia precocemente.
   Linfonodos mesentéricos reativos: eixo curto ≤15 mm em criança febril = linfonodite viral.
     >3 linfonodos mesentéricos ≤15 mm, sem massa associada → NÃO alarmar; correlação clínico-laboratorial.
     Eixo curto >20 mm ou linfonodo com necrose central → N3: excluir linfoma/abscesso mesentérico.

2. TRANSFONTANELA — Crânio Neonatal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CORTES OBRIGATÓRIOS (janela fontanela anterior):
   Coronais (5 planos) + Sagitais (mediano + parassagitais bilaterais).
   Coronal: sulco inter-hemisférico, corpo caloso, cavum do septo pelúcido,
     ventrículos laterais (corpo + cornos), 3º ventrículo, 4º ventrículo, cerebelo.
   Sagital mediano: corpo caloso (esplênio, corpo, joelho, rostro), sulco cingulado,
     vermis cerebelar, cisterna magna, 4º ventrículo, aqueduto.

   HEMORRAGIA PERIVENTRICULAR/INTRAVENTRICULAR (HIV/HPV) — Papile:
   ┌────────┬─────────────────────────────────────────────────────────────┐
   │ GRAU   │ CRITÉRIO E EXTENSÃO                                         │
   ├────────┼─────────────────────────────────────────────────────────────┤
   │ I      │ Confinada à zona germinativa / matriz germinativa            │
   │ II     │ Intraventricular SEM dilatação (<50% do ventrículo)         │
   │ III    │ Intraventricular COM dilatação (>50% do ventrículo)         │
   │ IV     │ Intraparenquimatosa (infarto hemorrágico periventricular)    │
   └────────┴─────────────────────────────────────────────────────────────┘
   HIV Grau I–II: seguimento semanal até estabilização.
   HIV Grau III → N3: neuropediatria + US semanal para monitoramento.
   HIV Grau IV → ATIVAR R6: neonatologia/neuropediatria urgente.

   ÍNDICE VENTRICULAR (IV):
   Medir: largura máxima do corpo do VL (coronal) / hemicranio.
   Normal: <0,35 (RN a termo). <0,39 (prematuro).
   >0,50 = hidrocefalia grave → R6.

   LEUCOMALÁCIA PERIVENTRICULAR (LPV):
   Fase 1 (1–3 dias): hiperecogenicidade periventricular.
   Fase 2 (1–3 semanas): cistos paraventriculares.
   Fase 3 (>4 semanas): cistos coalescentes + alargamento ventricular.
   LPV cística → ATIVAR R6 + neuropediatria urgente.

   OUTROS ACHADOS:
   Ventriculomegalia: átrio VL <10 mm normal; 10–15 mm moderada; >15 mm → R6.
   Cistos subependimários: cistos junto ao sulco talamocaudado — benigno, controle 1 mês.
   Agenesia de corpo caloso: ausência eco linear mediano + VL paralelos → N3 + RM.
   Dandy-Walker: cisterna magna ampla + 4ºV comunicante + vermis hipoplásico → N3.

   DOPPLER CEREBRAL NEONATAL:
   IR normal: 0,60–0,80 (RN a termo). <0,55 = vasodilatação (asfixia/sepse).
   IR >0,90 = hipertensão intracraniana → ATIVAR R6.
   Ausência de fluxo diastólico = HIC grave → R6.

3. COLUNA LOMBOSSACRA PEDIÁTRICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INDICAÇÃO: Rastreio de disrafismo oculto em lactentes <3 meses
   (janela acústica antes da ossificação dos arcos vertebrais).

   ESTRUTURAS NORMAIS:
   Cone medular: localização ≤ L1-L2 (nunca abaixo de L2-L3 após 3 meses).
   Filum terminale: filamento fino hiperecóico ≤2 mm de diâmetro (central, imóvel).

   SÍNDROME DO CORDÃO ANCORADO (SCA):
   Cone medular abaixo de L2-L3 + filum espessado (>2 mm) / lipomatoso.
   Ausência de oscilação da cauda equina (dinâmico).
   → N3 → neurocirurgia pediátrica + RM de coluna lombossacra.

   ESPINHA BÍFIDA:
   Oculta: arco vertebral incompleto; pele íntegra; estigma cutâneo.
   Meningocele: saco meníngeo sem tecido neural.
   Mielomeningocele (MMC): saco com tecido neural → diagnóstico geralmente pré-natal.

   LIPOMA INTRADURAL:
   Massa hiperecóica no canal vertebral posterior ao cone medular → N3.

   FOSSETA SACROCOCCÍGEA:
   Simples (<5 mm, <2,5 cm do ânus, fundo visível): VARIANTE NORMAL.
   Atípica (>5 mm, fundo oculto, estigma cutâneo) → US espinhal obrigatório.
   Fosseta + cone baixo + filum espessado → N3.

   TERATOMA SACROCOCCÍGEO:
   Massa mista sacral. Neonatal geralmente benigno; após 2 meses: malignizar.
   → N4 → oncologia/cirurgia pediátrica urgente.

4. ABDOME TOTAL PEDIÁTRICO — Achados Prioritários
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ESTENOSE HIPERTRÓFICA DO PILORO (EHP):
   Espessura da parede muscular >4 mm + comprimento canal >17 mm.
   Sinal do "ombro" pilórico. Ausência de trânsito gástrico.
   Perfil: lactente 3–8 semanas, vômitos em jato, alcalose hipoclorêmica.
   → ATIVAR R6 — avaliação cirúrgica urgente.

   INVAGINAÇÃO INTESTINAL:
   Sinal do "alvo" (corte transversal) + "pseudorim" (longitudinal).
   Localização: ileocólica (80%). Perfil: lactente 6–18 meses.
   Gravidade: ausência de fluxo PD intrassusceptum (isquemia) → R6.
   → ATIVAR R6 — redução pneumática/hídrica ou cirurgia urgente.

   APENDICITE AGUDA:
   Diâmetro >6 mm, incompressível, sem peristaltismo + PD positivo.
   Apendicólito: foco hiperecóico com sombra acústica.
   Perfuração: descontinuidade de parede + coleção periapendicular.
   → ATIVAR R6 — cirurgia pediátrica urgente.

   HÉRNIA INGUINAL:
   Pesquisar bilateralmente com Valsalva. Encarcerada: alça sem peristaltismo.
   → Encarcerada → ATIVAR R6.

   FÍGADO PEDIÁTRICO — comprimento normal (medioaxilar):
   Neonato: 5–7 cm. Lactente: 6–9 cm. Escolar: 8–12 cm. Adolescente: 10–15 cm.
   Hepatoblastoma: massa hipervascularizada → N4 → oncologia pediátrica.

5. RINS E VIAS URINÁRIAS PEDIÁTRICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAMANHO RENAL NORMAL:
   Neonato: 3,5–5,0 cm. 1 ano: 5,5–6,5 cm. 5 anos: 7,0–8,0 cm. Adolescente: 10–11,5 cm.
   Diferença entre os rins ≤1,0 cm.

   HIDRONEFROSE — CLASSIFICAÇÃO SFU:
   ┌─────────┬────────────────────────────────────────────────────────────┐
   │ GRAU    │ CRITÉRIO                                                   │
   ├─────────┼────────────────────────────────────────────────────────────┤
   │ SFU I   │ Apenas pelve renal visível; sem cálices                   │
   │ SFU II  │ Pelve + cálices maiores; parênquima normal                │
   │ SFU III │ Pelve + todos os cálices; parênquima normal               │
   │ SFU IV  │ Pelve + cálices com adelgaçamento do parênquima           │
   └─────────┴────────────────────────────────────────────────────────────┘
   DAP neonato: >7 mm = monitoramento; >10 mm = significativo; >15 mm → N4.
   SFU III–IV → N3/N4 → urologia pediátrica.

   ETIOLOGIAS:
   Estenose JUP: hidronefrose sem dilatação ureteral (causa mais comum neonatal).
   Megaureter obstrutivo: ureter >7 mm + hidronefrose.
   Ureterocele: imagem cística intravesical (cobra-head sign).
   Refluxo vesicoureteral (RVU): confirmação por UCM.
   US DIURÉTICO (FUROSEMIDA) — Protocolo na suspeita de estenose JUP:
   INDICAÇÃO: hidronefrose SFU II–III sem dilatação ureteral (padrão JUP obstrutivo suspeito).
   TÉCNICA: furosemida 0,5 mg/kg IV (máx. 20 mg); medir DAP pré e 20 min após administração.
   INTERPRETAÇÃO:
   · DAP reduz ≥50%: padrão não-obstrutivo (bom prognóstico; controle clínico).
   · DAP aumenta ou reduz <20%: padrão obstrutivo → N4 urologia pediátrica + renograma MAG-3.
   · DAP reduz 20–49%: padrão equívoco → repetir US em 3 meses; discussão com urologia.
   REGISTRO OBRIGATÓRIO: DAP pré (mm), DAP pós (mm), variação percentual, tempo de coleta.
   Válvula de uretra posterior (VUP — masculino):
     Bexiga espessada >3 mm + hidronefrose bilateral + uretra posterior dilatada.
     → ATIVAR R6 neonatal — urologia urgente.

6. QUADRIL PEDIÁTRICO — DDQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INDICAÇÃO: ≤6 meses (antes da ossificação da epífise femoral).
   TÉCNICA: Corte de Graf — decúbito lateral, plano coronal padrão.

   CLASSIFICAÇÃO DE GRAF:
   ┌────────────┬──────────┬───────────┬────────────────────────────────────┐
   │ TIPO       │ Alfa (α) │ Beta (β)  │ INTERPRETAÇÃO / CONDUTA            │
   ├────────────┼──────────┼───────────┼────────────────────────────────────┤
   │ I (a/b)    │ ≥60°     │ <55°      │ Quadril maduro — NORMAL            │
   │ IIa        │ 50–59°   │ <55°      │ Imaturo fisiológico (<3 meses)     │
   │ IIb        │ 50–59°   │ <55°      │ Imaturo patológico (>3 meses) N2   │
   │ IIc        │ 43–49°   │ 55–77°    │ Deficiente — arnês Pavlik N3       │
   │ D (luxando)│ 43–49°   │ >77°      │ Decentrado — arnês urgente N3      │
   │ III        │ <43°     │ —         │ Luxado — sem reorientação N4       │
   │ IV         │ <43°     │ —         │ Luxado com inversão labralmente N4 │
   └────────────┴──────────┴───────────┴────────────────────────────────────┘
   Porcentagem de cobertura: normal >50%.

   OUTROS ACHADOS DO QUADRIL:
   Sinovite transitória: derrame >2 mm recesso anterior. N2 → ortopedia (excluir séptica).
   Artrite séptica: derrame + febre + leucocitose → ATIVAR R6 (drenagem articular).
   Doença de Legg-Calvé-Perthes (LCP): epífise irregular + derrame (5–10 anos) → N3 + RM.
   Epifisiolise (ECF): adolescente obeso, deslizamento epifisário → N3/R6.

7. ESCROTO AGUDO PEDIÁTRICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TORÇÃO TESTICULAR — EMERGÊNCIA CIRÚRGICA:
   Ausência de fluxo PD no testículo (assimétrico ao contralateral).
   Whirlpool sign: cordão espermático enrolado proximal.
   Viabilidade: <6h >95%; 6–12h 50–70%; 12–24h 10–20%; >24h <5%.
   → ATIVAR R6 IMEDIATO — exploração cirúrgica sem demora.

   TORÇÃO DE APÊNDICE TESTICULAR:
   Nódulo polar superior + hipervascularização circundante. Fluxo testicular PRESERVADO.
   → N2 → pediatria (tratamento conservador).

   ORQUITE-EPIDIDIMITE:
   Hipervascularização PD do epidídimo e/ou testículo. Hidrocele reacional.
   Abscesso (PD periférico + centro avascular) → N3 → drenagem cirúrgica.

   MASSA TESTICULAR SÓLIDA:
   Qualquer massa intratesticular sólida em criança → N4 → oncologia pediátrica.

8. CONDIÇÕES AGUDAS — Gatilhos R6 / N4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌───────────────────────────────────────┬─────────────────────────────────────┐
   │ CONDIÇÃO                              │ AÇÃO                                │
   ├───────────────────────────────────────┼─────────────────────────────────────┤
   │ Torção testicular                     │ Cirurgia urgente → R6 IMEDIATO      │
   │ HIV Grau IV (intraparenquimatoso)     │ Neonatologia/neuropediatria → R6    │
   │ LPV cística confirmada                │ Neuropediatria urgente → R6         │
   │ Estenose hipertrófica do piloro       │ Cirurgia pediátrica → R6            │
   │ Invaginação intestinal                │ Redução/cirurgia → R6               │
   │ Apendicite aguda                      │ Cirurgia pediátrica → R6            │
   │ Hérnia encarcerada                    │ Cirurgia pediátrica → R6            │
   │ Artrite séptica do quadril            │ Drenagem articular → R6             │
   │ VUP (válvula de uretra posterior)     │ Urologia neonatal → R6              │
   │ Massa testicular sólida               │ Oncologia pediátrica → N4           │
   │ Teratoma sacrococcígeo                │ Cirurgia oncológica → N4            │
   │ HIV grau III + hidrocefalia           │ Neuropediatria → N4                 │
   │ Hidronefrose SFU IV + adelgaçamento   │ Urologia pediátrica → N4            │
   └───────────────────────────────────────┴─────────────────────────────────────┘

9. TABELA MESTRA DE REFERÊNCIA — Pediátrica
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Estrutura / Parâmetro         │ Normal                         │ Alerta / Ação
   ──────────────────────────────┼────────────────────────────────┼──────────────────────────
   Cone medular (localização)    │ ≤ L1-L2 (< 3 meses)            │ Abaixo L3 = SCA → N3
   Filum terminale (diâm.)       │ ≤ 2 mm                         │ >2 mm lipomatoso = SCA
   Índice ventricular            │ <0,35 (RN a termo)             │ >0,50 = hidrocefalia R6
   IR ACM neonatal               │ 0,60–0,80                      │ >0,90 = HIC → R6
   Ângulo alfa (Graf)            │ ≥60° = tipo I (maduro)         │ <43° = luxado → N4
   Cobertura cefálica (quadril)  │ >50%                           │ <50% = displasia → N3
   Espessura muscular piloro      │ <4 mm                          │ ≥4 mm = EHP → R6
   Comprimento canal pilórico    │ <17 mm                         │ ≥17 mm = EHP → R6
   Apêndice (diâm.)              │ <6 mm, compressível            │ >6 mm incompress. → R6
   DAP renal (neonato)           │ <7 mm                          │ >10 mm = HN significativa
   DAP renal (criança)           │ <7 mm                          │ >15 mm → N4 urologia
   Parede vesical (distendida)   │ <3 mm                          │ >3 mm = espessada
   Testículo: fluxo PD           │ Presente e simétrico           │ Ausente = torção → R6
   Recesso articular quadril     │ <2 mm líquido                  │ >2 mm = derrame → N3

10. FRASEOLOGIA PADRÃO — Biblioteca V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Normal: "Estudo dentro dos limites da normalidade para a faixa etária.
      Seguimento pediátrico habitual."
    Graf I: "Quadril [D/E] maduro, tipo I de Graf. α = [X]°.
      Cobertura da cabeça femoral: [X]%. Normal."
    Graf IIa (<3 m): "Imaturo fisiológico, tipo IIa de Graf. α = [X]°.
      Controle ultrassonográfico do quadril em 4–6 semanas."
    Graf IIb–IIc: "Tipo [IIb/IIc] de Graf — encaminhamento ortopedia pediátrica
      para avaliação de arnês de Pavlik."
    Graf III/IV: ATIVAR R6 — "Quadril luxado — tipo [III/IV]. Ortopedia pediátrica urgente."
    SFU I: "Discreta dilatação piélica (SFU I). Controle US em 3 meses."
    SFU III: "Hidronefrose moderada (SFU III). Urologia pediátrica."
    SFU IV: ATIVAR N4 — "Hidronefrose acentuada (SFU IV). Urologia pediátrica urgente."
    HIV I: "Hemorragia subependimária grau I. Seguimento US semanal."
    HIV III: N3 — "HIV grau III com dilatação ventricular. Neuropediatria urgente."
    Piloro: ATIVAR R6 — "EHP confirmada. Piloroplastia urgente."
    Invaginação: ATIVAR R6 — "Invaginação intestinal. Desinvaginação ou cirurgia."
    Apendicite: ATIVAR R6 — "Apendicite aguda. Cirurgia pediátrica urgente."
    Torção: ATIVAR R6 — "ALERTA MÁXIMO: torção testicular. Exploração cirúrgica imediata."
    SCA: N3 — "Cone medular baixo. Suspeita de cordão ancorado.
      Neurocirurgia pediátrica + RM de coluna lombossacra."

11. REGRAS TRANSVERSAIS — TODOS OS 6 EXAMES PEDIÁTRICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. FAIXA ETÁRIA NA CONCLUSÃO: declarar sempre (neonato / lactente / escolar / etc.).
    b. BILATERAL: transfontanela, rins, quadril, escroto — sempre bilaterais.
    c. TORÇÃO TESTICULAR: nunca adiar. Fluxo ausente unilateral = R6 imediato.
    d. GRAF: medir α e β em todo exame de DDQ. Nunca omitir ângulos.
    e. COLUNA: cone medular obrigatoriamente localizado. Filum medido.
    f. PILORO: medir espessura da parede muscular E comprimento do canal — ambos.
    g. SFU: classificar e medir DAP renal em todo exame de rins pediátrico.
    h. HIV: classificar por Papile (I–IV). Nunca usar apenas "hemorragia neonatal".
    i. VARIANTES NORMAIS: declarar explicitamente — evitar alarmar desnecessariamente.
    j. ORDEM CONCLUSÃO: N4 → N3 → N2 → N1 → N0.`,

  // ═══════════════════════════════════════════════════════════════
  // REUMATOLÓGICO / POWER DOPPLER
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area reumatologico
   * @scope Articulações reumatológicas, Power Doppler, sinovite,
   *        PDUS, atividade inflamatória, erosões.
   */
  'reumatologico': `DIRETRIZES CLÍNICAS — REUMATOLÓGICO / POWER DOPPLER (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: EULAR 2017/2022 · OMERACT · SBR · GRAPPA · ACR
             ASAS (SpA) · ESSR · Treat-to-Target · PDUS Working Group

MAPA DE EXAMES DESTA ÁREA (3 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ ARTICULAÇÕES PERIFÉRICAS — sinovite, erosões, gota, dactilite    │
  │ SACROILÍACAS              — SpA axial, EA, ASAS, entesite pélvica │
  │ PDUS-28                   — escore 28 art., atividade, remissão   │
  └────────────────────────────────────────────────────────────────────┘

1. PRINCÍPIOS DO US REUMATOLÓGICO
   Transdutor linear 10-18 MHz para articulações periféricas pequenas (MCF, IFP, punho).
   Transdutor linear 7-12 MHz para ombros, joelhos, tornozelos.
   Transdutor convexo 2-6 MHz para sacroilíacas (profundidade 8-12 cm).
   Power Doppler (PD): ajustar PRF 500-800 Hz para capturar fluxo lento sinovial.
   Avaliar sempre bilateralmente e comparativamente.
   Temperatura: articulações frias podem subestimar o PD (aquecimento prévio).

2. ESCORES DE SINOVITE — EULAR/OMERACT (B-mode + Power Doppler)
   SCORE DE SINOVITE (Escala de Cinza — B-mode):
   Grau 0: Ausência de espessamento sinovial.
   Grau 1: Espessamento mínimo — sem abaulamento além da linha capsular.
   Grau 2: Espessamento moderado — leve abaulamento além da cápsula.
   Grau 3: Espessamento acentuado — abaulamento marcado (balonamento sinovial).

   SCORE DE POWER DOPPLER (PD):
   Grau 0: Ausência de sinal PD intrasinovial.
   Grau 1: Sinal mínimo (1-3 focos puntiformes OU 1 confluência isolada).
   Grau 2: Sinal moderado (>3 focos ou confluência em <50% da área sinovial).
   Grau 3: Sinal exuberante (confluência em >50% da área sinovial).

   Sinovite grau 0/1 + PD 0: N0/N1 — remissão ou atividade mínima.
   Sinovite grau 2 + PD 1: N2 — atividade leve.
   Sinovite grau 2-3 + PD 2-3: N3 → ajuste terapêutico com reumatologista.
   PDUS-28: avaliação padronizada de 28 articulações (ver template específico).

   PDUS-7 (escore simplificado — 7 articulações):
   Articulações: punho D, punho E, MCF 2° D, MCF 2° E, MCF 3° D, MCF 3° E, joelho D.
   Score = soma de sinovite (cinza 0–3) + PD (0–3) em cada articulação avaliada.
   INTERPRETAÇÃO:
   · PD total 0: remissão por imagem (independente do score cinza).
   · PD total 0 + sinovite ≤1 em ≤2 articulações: remissão com ressalva (EULAR 2022).
   · PD ≥1 em qualquer articulação: atividade residual → NÃO remissão → N3 ajuste terapêutico.
   · Score PD total >1: atividade inflamatória significativa → N3 reumatologista.

3. EROSÕES ÓSSEAS
   DEFINIÇÃO OMERACT: descontinuidade do córtex ósseo ecogênico visível
   em dois planos perpendiculares (longitudinal + transversal).
   Localização: AR → MCF 2-5 (face radial); Gota → 1ª MTF; APs → IFD.
   Medição: dimensão máxima em mm. ≥2 erosões ou >3 mm = N2/N3.
   Erosões múltiplas + sinovite PD ≥2 = doença erosiva ativa → N3.

4. ENTESES — Protocolo e Escores GUESS
   ENTESES PRINCIPAIS: Aquiles, fáscia plantar, patelar distal/proximal,
   quadríceps, epicôndilos, MCF/IFP em psoriásica.
   CRITÉRIOS DE ENTESITE ATIVA (qualquer um):
     Espessamento hipoecóico da inserção (AT >4 mm; FP >4 mm; patelar >4 mm).
     Hipervascularização ao PD na inserção (grau PD ≥1).
     Erosão cortical óssea no sítio de inserção.
     Calcificação entesopatia (doença crônica).
   ESCORE GUESS: 6 enteses bilaterais (patelar prox.+dist.+Aquiles × 2 = 12 locais).
   Score ≥4 = espondiloartropatia suspeita → N3.

5. CRISTALOPATIAS
   GOTA (Depósito de Urato Monosódico — UMS):
   DUPLO CONTORNO (DCS): linha hiperecóica sobre a superfície da CARTILAGEM HIALINA.
     Patognomônico de gota. Locais: cúpula do fêmur (joelho), talus, 1ª MTF.
     NÃO confundir com anisotropia do tendão (some ao mudar o ângulo).
   TOFOS: massa hiperecóica heterogênea ± sombra acústica. PD geralmente negativo.
   AGREGADOS (snowstorm): focos puntiformes hiperecóicos no líquido sinovial.

   CPDD / PSEUDOGOTA (Pirofosfato de Cálcio):
   Calcificações lineares NA FIBROCARTILAGEM e DENTRO da cartilagem hialina.
   Distinção: CPDD → hiperecogenicidade dentro da cartilagem.
              UMS  → linha hiperecóica NA SUPERFÍCIE da cartilagem (DCS).
   Locais: menisco joelho, disco triangular punho, sínfise púbica.

6. DACTILITE
   CRITÉRIO US: espessamento difuso do dedo com combinação simultânea:
     Tenossinovite do flexor + Sinovite de IFP e/ou IFD + Edema peridigital.
   PD ativo = inflamação aguda → N3.
   Patologias: artrite psoriásica (mais comum), SpA indiferenciada, reativa, gota.

7. DERRAME ARTICULAR
   Pequeno: <5 mm. Moderado: 5-10 mm. Volumoso: >10 mm.
   Conteúdo anecóico: exsudato inflamatório.
   Com debris/ecos: hemartrose, infecção, urato em suspensão.
   ARTRITE SÉPTICA: derrame + debris espessos + PD periférico + febre + leucocitose.
   → ATIVAR R6: avaliação ortopédica/reumatológica urgente — lavagem articular.

8. SACROILÍACAS — Avaliação Reumatológica
   Transdutor convexo (3-6 MHz); decúbito prono; profundidade 8-12 cm.
   SACROILIÍTE ATIVA (SpA axial): espessamento sinovial hipoecóico + PD ativo
   na articulação sacroilíaca (ASI). Erosão cortical na vertente ilíaca.
   Irregularidade e alargamento da interlinha articular.
   ASAS: HLA-B27 + ≥1 achado SpA = SpA axial (RM é padrão; US complementa).
   US contribui: sacroiliíte PD+ + entesite periférica (GUESS ≥4).

9. PATOLOGIAS ESPECÍFICAS
   AR: MCF 2-5, IFP, punhos, MTF bilaterais. Sinovite+PD≥2+erosão = AR ativa → N3.
   Remissão US: sinovite 0/1 + PD 0 em todas as articulações avaliadas.
   EULAR 2022 — Critérios de remissão por imagem em AR:
   · REMISSÃO completa: sinovite grau 0 + PD grau 0 em todas as articulações avaliadas.
   · REMISSÃO com ressalva: PD grau 0 + sinovite grau 1 em ≤2 articulações.
   · ATIVIDADE RESIDUAL: PD grau ≥1 em qualquer articulação = NÃO remissão → ajuste de biológico.
   EA/SpA AXIAL: ASI bilateral simétrica (EA) ou assimétrica (SpA). Entesite periférica.
   APs: IFD comprometidas, dactilite, entesite, ASI assimétrica.
   LES: sinovite leve bilateral sem erosões (artropatia de Jaccoud).
   FIBROMIALGIA: US reumatológico ESPERADAMENTE NORMAL — ausência de sinovite, erosões, PD e entesite.
   · Declarar normalidade explicitamente: "Sem sinais de sinovite ativa, erosões ou entesite nas articulações avaliadas."
   · NÃO atribuir dor musculoesquelética difusa a achados inespecíficos — US não diagnostica fibromialgia.
   · Exame normal em paciente com diagnóstico de fibromialgia = resultado esperado e clinicamente relevante.

10. CONDIÇÕES AGUDAS — Gatilhos R6 / N4
    Artrite séptica suspeita → lavagem articular urgente → R6.
    Gota: crise aguda com tofo roto → reumatologista urgente → N3.
    Sinovite PD 3 + erosões múltiplas → falha terapêutica → N3.
    Dactilite ativa + PD positivo → ajuste biológico → N3.
    Sacroiliíte bilateral PD ativo → reumatologista + RM → N3.

11. TABELA MESTRA DE REFERÊNCIA — Reumatológico
    Sinovite (Cinza): Grau 0 normal; Grau 2-3 → N3.
    Power Doppler sinovial: Grau 0 normal; Grau 2-3 → N3.
    Erosão óssea: 0/articulação normal; ≥2 ou >3 mm → N3.
    Duplo contorno (DCS): ausente = normal; presente = gota → N3.
    Entesite (PD+): PD 0 normal; PD ≥1 → GUESS score → N3.
    GUESS score: 0 normal; ≥4 = SpA suspeita → N3.
    Dactilite US: ausente normal; presente → psoriásica → N3.
    Derrame ASI (PD+): ausente normal; PD ativo = sacroiliíte → N3.
    PDUS-28 score: 0 = remissão; >3 PD = atividade → N3.

12. FRASEOLOGIA PADRÃO — Biblioteca V2.0
    Normal: "Ausência de sinovite, erosões ou sinais de entesite ativa
      nas articulações avaliadas. Power Doppler negativo."
    Sinovite grau 2 + PD 1: "Sinovite leve-moderada em [articulação], grau 2
      ao B-mode, PD grau 1. Correlação com reumatologista para otimização terapêutica."
    Erosão: "Erosão óssea em [articulação], [X] mm. Artropatia erosiva — avaliação reumatológica."
    DCS (gota): "Duplo contorno em [articulação] — depósito de UMS (gota).
      Correlação com uricemia. Reumatologista para manejo hipouricemiante."
    Entesite: "Entesite ativa em [AT/FP/patelar] [D/E]: espessamento [X] mm + PD grau [X]. GUESS = [X]."
    Sacroiliíte: N3 — "Sacroiliíte ativa [bilateral/unilateral]: espessamento sinovial +
      PD ativo na ASI. RM de sacroilíacas + reumatologista (critérios ASAS)."
    Artrite séptica: ATIVAR R6 — "ALERTA: artrite séptica suspeita em [articulação].
      Derrame com debris + PD periférico. Lavagem articular urgente."

13. REGRAS TRANSVERSAIS — TODOS OS 3 EXAMES
    a. BILATERAL OBRIGATÓRIO em todas as articulações avaliadas.
    b. SCORES NUMÉRICOS: grau 0-3 (cinza) + grau 0-3 (PD) por articulação.
    c. DCS: confirmar em dois planos — nunca diagnosticar gota só por anisotropia.
    d. ENTESES: medir espessura em mm. PD quantificado.
    e. EROSÕES: dois planos perpendiculares obrigatórios para confirmar.
    f. ARTRITE SÉPTICA: clínica sugestiva → ATIVAR R6 sem hesitação.
    g. PDUS-28: documentar score total + por articulação quando solicitado.
    h. SACROILÍACAS: US limitado vs. RM — informar limitação no laudo.
    i. REMISSÃO US: declarar explicitamente quando sinovite 0 + PD 0 em todas.
    j. ORDEM CONCLUSÃO: N4 → N3 → N2 → N1 → N0.`,

  // ═══════════════════════════════════════════════════════════════
  // PROCEDIMENTOS GUIADOS POR ULTRASSOM
  // ═══════════════════════════════════════════════════════════════
  /**
   * @area procedimentos
   * @scope Biópsias, punções, drenagens, infiltrações guiadas,
   *        aspirações, PAAF, core biopsy.
   */
  'procedimentos': `DIRETRIZES CLÍNICAS — PROCEDIMENTOS GUIADOS (V2.0 — LAUD.IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERÊNCIAS: SBR · CBR · ACR · CIRSE · SABI · SBU · FEBRASGO
             ATA (Bethesda) · ASCO · ESMO · ISUOG · CFM

MAPA DE EXAMES DESTA ÁREA (10 templates de Camada 3):
  ┌────────────────────────────────────────────────────────────────────┐
  │ PAAF — TIREÓIDE          — Bethesda, agulha fina, adequabilidade  │
  │ PAAF — MAMA              — BI-RADS, microcalcificações, corelação │
  │ PAAF — LINFONODOS        — cervical/axilar/inguinal, linfoma       │
  │ PAAF — CISTOS            — tireoide/renal/hepat/anexial/serosa    │
  │ CORE BIOPSY              — fragmento 14–18G, fígado/rim/mama/PP   │
  │ BIÓPSIA DE VILO CORIÔNICO — 1T genético, transabdominal/transcerv │
  │ AMNIOCENTESE             — 2T/3T genético, cariotipagem           │
  │ DRENAGEM DE COLEÇÕES     — pigtail, Seldinger, abscesso, ascite   │
  │ ACESSO VASCULAR          — PICC, CVC, Seldinger, artéria          │
  │ ESCLEROTERAPIA           — etanol, cistos, protocolo detalhado     │
  └────────────────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PRÉ-PROCEDIMENTO — Checklist Universal (relatar em TODOS os laudos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VERIFICAÇÕES OBRIGATÓRIAS:
   Consentimento: TCLE assinado e documentado no prontuário antes do início.
   Coagulação: plaquetas (ideal >50.000/µL), INR (ideal <1,5 para biópsia) ou
     TP/TTPA quando clinicamente relevante. Relatar se dados não fornecidos.
   Anticoagulação: AAS deve ser suspenso 5–7 dias antes de biópsia/drenagem.
     Heparina de baixo peso molecular: última dose ≥12h antes.
     DOAC: suspender 24–48h conforme risco trombótico.
   Infecção local ativa: contraindicação relativa para punção no local.
   Gravidez: confirmar se procedimento é seguro (dose de radiação se TC).

   DOCUMENTAÇÃO DE CAMPO ESTÉRIL:
   "Procedimento realizado com técnica asséptica rigorosa, campo estéril
   e antissepsia da pele com [clorexidina/iodopovidona]. Anestesia local
   com lidocaína [X]% [X] mL, via subcutânea/perinervosa."

   MONITORAMENTO INTRA-PROCEDIMENTO:
   FC, saturação (quando disponível). Documentar tolerância do paciente.
   Posição: decúbito dorsal / lateral / sentado — relatar.

2. DOCUMENTAÇÃO MANDATÓRIA — Elementos obrigatórios em todo laudo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   a. ALVO: localização anatômica precisa (lado, segmento, profundidade).
   b. GUIA: "guiado por ultrassonografia em tempo real".
   c. AGULHA: calibre (G) e comprimento (cm).
   d. ACESSOS: número de passagens / fragmentos colhidos.
   e. MATERIAL: aspecto macroscópico (cor, consistência, volume em mL).
   f. DESTINO: anatomopatológico / citopatológico / microbiológico / bioquímica.
   g. COMPLICAÇÕES: "procedimento transcorreu sem intercorrências" OU descrever.
   h. ESTADO PÓS-PROCEDIMENTO: ausência de hematoma, sangramento ativo, pneumotórax.
   i. RECOMENDAÇÕES: repouso, orientações, retorno.

3. PAAF — SISTEMA BETHESDA (tireoide) e ADEQUABILIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TÉCNICA:
   Agulha: 23–27G (capilar sem seringa preferível) ou 23–25G com aspiração suave.
   Passagens: 2–4 movimentos vaivém por inserção, 2–4 inserções por nódulo.
   Preparo: esfregaço direto em lâminas fixadas a seco + a úmido (álcool 95%);
     OU meio líquido (CytoLyt/ThinPrep) — conforme laboratório.
   Lavagem da agulha em meio líquido após esfregaços.

   ADEQUABILIDADE DO MATERIAL:
   Satisfatório: ≥6 grupos de ≥10 células foliculares bem preservadas.
   Insatisfatório/não diagnóstico: sangue, artefatos, células insuficientes.
     → Insatisfatório: nova PAAF em 3–6 meses (não imediatamente).

   SISTEMA BETHESDA (citopatologia — relatar categoria quando laudo disponível):
   I   — Não diagnóstico/insatisfatório. Repetir.
   II  — Benigno (80–85% dos casos). Seguimento clínico/US.
   III — Atipia de significado indeterminado (AUS/FLUS). Repetir ou molecular.
   IV  — Neoplasia folicular. Cirurgia (lobectomia) ou painel molecular.
   V   — Suspeito de malignidade. Tireoidectomia.
   VI  — Maligno. Tireoidectomia total.
   NOTA: O radiologista não emite o laudo Bethesda — este é responsabilidade do
   citopatologista. O laudo do procedimento documenta a técnica e o material.

4. CORE BIOPSY — Biópsia de Fragmento Percutânea
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CALIBRES POR ÓRGÃO / INDICAÇÃO:
   Mama: 14G (standard) ou 11G (vácuo-assistida — VAB — para microcalcificações).
   Fígado: 16–18G (evitar 14G: maior risco de sangramento).
   Rim: 16–18G.
   Próstata: 18G sistemática (guiada por US transretal ou transperineal).
   Partes moles / linfonodo / massa: 14–18G conforme alvo.
   Osso (cortical): agulha trefina especial de osso (11–13G).

   PROCEDIMENTO:
   Posicionar agulha de biópsia automática com guia de agulha acoplada ao transdutor.
   Confirmar posição da agulha no alvo ao B-mode antes do disparo.
   Coletar mínimo 2 fragmentos (ideal 3–4).
   Fragmentos adequados: cilíndricos, brancos, coesos, >10 mm de comprimento.
   Fragmento hemático ou fragmentado: resultado pode ser insatisfatório.
   Clip metálico: colocar após biópsia de mama quando indicado pelo cirurgião
     (permite localização futura mesmo se lesão desaparecer após QT neoadjuvante).

   COMPLICAÇÕES POR ÓRGÃO:
   Mama: hematoma (comum, geralmente autolimitado), infecção rara (<1%).
   Fígado: sangramento (0,5–1%), pneumotórax se via transpleural.
   Rim: hematoma perirrenal (3–5%), sangramento significativo (<1%).
   Geral: vasovagal, dor local.

5. PROCEDIMENTOS OBSTÉTRICOS — Amniocentese e BVC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LEI DE SEGURANÇA FETAL (Camada 1): NUNCA inventar biometria fetal.
   Documentar FCF antes e após todos os procedimentos obstétricos.
   Risco de perda fetal: amniocentese ~0,1–0,3%; BVC ~0,5–1,0%.
   Informar o paciente sobre estes riscos ANTES (TCLE específico obstétrico).

   AMNIOCENTESE:
   Indicação: ≥15 semanas (ideal 15–20 sem para cariotipagem clássica).
   Coleta: 15–20 mL de LA com agulha 20–22G.
   Técnica: acesso transabdominal, evitando placenta e cordão.
   Preferir pool de LA livre de cordão e alças intestinais fetais.
   LA sanguinolento: contamina análise cromossômica — documentar.
   LA turvo: suspeita de corioamnionite — cultura obrigatória.
   Pós-procedimento: FCF imediata + avaliação US 30 min após.
   Bradicardia fetal pós-procedimento → ATIVAR R6.

   BIÓPSIA DE VILO CORIÔNICO (BVC):
   Indicação: 10–13+6 semanas (janela de corionicidade).
   Vantagem: resultado genético mais precoce que amniocentese.
   Via TRANSABDOMINAL (preferida): agulha 19–22G guiada por US.
   Via TRANSCERVICAL: pinça/cateter + US; alternativa se retroversão uterina.
   Local de punção: placa corial + vilosidades (evitar cordão, saco amniótico).
   Material adequado: vilosidades esbranquiçadas flutuando no meio.
   Volume: 10–25 mg de vilo (suficiente para cariotipagem + FISH + array).
   Contraindicação relativa: sangramento vaginal ativo, infecção cervical.
   Pós-procedimento: FCF + avaliação placenta/hematoma subcoriônico.

6. DRENAGEM DE COLEÇÕES — Técnica e Classificação
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TIPOS DE COLEÇÃO E CATETER:
   Abscesso <5 cm: punção aspirativa simples (agulha 18G) ou pigtail 8–10F.
   Abscesso ≥5 cm: pigtail 10–14F (drenagem contínua).
   Seroma pós-cirúrgico: punção aspirativa; se recidivante → pigtail.
   Hematoma agudo/subagudo: punção quando coagulado (aguardar liquefação).
   Empiema pleural: pigtail 12–14F com conexão a selo d'água.
   Ascite tensa: agulha 14–16G; retirar 1,5–4 L por sessão com albumina IV.
   Biloma / hematoma hepático: pigtail 8–12F; confirmar conexão biliar.

   TÉCNICA SELDINGER (pigtail):
   Punção inicial com agulha fina (18–21G) + confirmação posição US.
   Introdução de guia metálico 0,035" ou 0,018" (guidewire).
   Dilatadores sequenciais sobre o guia.
   Posicionamento do cateter pigtail com laço interno formado.
   Fixação na pele com sutura ou dispositivo adesivo.
   Confirmação final da posição ao US: cateter visível dentro da coleção.

   RELATAR:
   Volume drenado na sessão (mL). Aspecto: seroso, hemático, purulento, bilioso.
   Débito pós-drenagem: coletar nas primeiras 24h (documentar no prontuário).
   Material enviado: cultura + antibiograma (abscesso), bioquímica (transudato vs. exsudato), citologia (suspeita neoplásica).

7. ACESSO VASCULAR GUIADO POR US
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VEIA JUGULAR INTERNA (VJI) — via preferencial para CVC:
   Abordar em plano transversal ou longitudinal.
   Confirmar: VJI compressível (veia) vs. ACE pulsátil (artéria).
   Punção com agulha 18G → guia 0,035" → dilatador → cateter.
   Posição ideal da ponta: junção VCS-átrio direito (confirmação radiológica).
   Complicações: hematoma cervical, pneumotórax (esquerdo > direito), punção arterial.

   VEIA SUBCLÁVIA — alternativa:
   Janela acústica menor; maior risco de pneumotórax.
   Sempre avaliar pervidade ao Doppler antes da punção.

   VEIA FEMORAL — última opção (maior risco de TVP):
   Relatar pervidade + ausência de trombo pré-punção.

   PICC (Peripherally Inserted Central Catheter):
   Veia basílica ou braquial (ideal basílica, mais direta).
   Calibre: 4F (adulto) / 3F (criança). Duplo lúmen disponível.
   Medir distância veia basílica → VCS para inserção correta.
   Pós-inserção: radiografia de tórax para confirmar ponta.

   ACESSO ARTERIAL:
   Artéria radial: pulsação palpável + US confirma posição.
   Artéria femoral: alternativa para monitoramento hemodinâmico.
   Complicações: pseudoaneurisma, espasmo arterial, trombose.
   Pseudoaneurisma pós-punção: compressão guiada por US (5–10 min) ou injeção de trombina.

8. ESCLEROTERAPIA — Protocolo Detalhado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INDICAÇÕES:
   Cisto tireoidiano sintomático recidivante (≥2 recidivas) + componente espongiforme.
   Cisto renal sintomático (Bosniak I) sem suspeita maligna.
   Cisto hepático sintomático simples (sem bile interna).
   Cisto pancreático simples (raro; avaliar comunicação ductal antes).
   CONTRAINDICAÇÕES: cisto com componente sólido, suspeita maligna, comunicação biliar.

   AGENTE: Etanol absoluto (99–100%) — agente esclerosante padrão.
   Alternativa: polidocanol a 3% (menos dor, menor eficácia).

   PROTOCOLO ETANOL:
   1. Aspiração total do conteúdo (volume exato em mL — registrar).
   2. Cisto colapso confirmado ao US — se residual: nova aspiração.
   3. Instilação de etanol 99%: volume = 25–50% do aspirado, máximo 10 mL.
   4. Tempo de contato: 3–5 minutos (agulha in situ, cisto distendido com etanol).
   5. Reaspirção completa do etanol.
   6. Confirmar colapso final ao US — documentar.
   Repetir ciclo até 3× na mesma sessão se cisto residual >50%.

   CRITÉRIOS DE SUCESSO (controle US em 3 meses):
   Colapso completo: volume residual <10% do original. Excelente.
   Colapso parcial: redução >50%. Repetir sessão.
   Falha: redução <50%. Considerar cirurgia.

9. CONDIÇÕES AGUDAS DURANTE PROCEDIMENTOS — Gatilhos R6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ┌───────────────────────────────────────┬─────────────────────────────────────┐
   │ EVENTO                                │ AÇÃO IMEDIATA                       │
   ├───────────────────────────────────────┼─────────────────────────────────────┤
   │ Bradicardia fetal pós-procedimento   │ ATIVAR R6 — obstetrícia urgente     │
   │ Sangramento ativo no alvo pós-biopsia│ Compressão + US + cirurgia se grave │
   │ Pneumotórax pós-punção pleural       │ ATIVAR R6 — drenagem torácica       │
   │ Reação vasovagal grave               │ Decúbito, hidratação IV, monitorar  │
   │ Punção arterial inadvertida (CVC)    │ Compressão + suspender; se expandir → R6│
   │ Hematoma expansivo pós-biópsia       │ US imediato + cirurgia se instável  │
   │ Embolia gasosa (CVC aberto)          │ Decúbito lateral ESQ + R6           │
   │ Anafilaxia ao contraste/esclerosante │ Adrenalina + ATIVAR R6              │
   └───────────────────────────────────────┴─────────────────────────────────────┘

10. TABELA DE REFERÊNCIA — Procedimentos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Procedimento        │ Agulha / Cateter   │ Fragmentos/Volume │ Envio
    ────────────────────┼────────────────────┼───────────────────┼─────────────────
    PAAF-Tireóide       │ 23–27G             │ 2–4 esfregaços    │ Citopatologia
    PAAF-Mama           │ 23–25G             │ 2–4 esfregaços    │ Citopatologia
    PAAF-Linfonodo      │ 23–25G             │ 2–4 + citospin    │ Citopatologia
    PAAF-Cisto          │ 18–22G             │ vol. total (mL)   │ Citologia/cultura
    Core Biopsy Mama    │ 14G ou 11G vácuo   │ ≥4 fragmentos     │ Histopatologia
    Core Biopsy Fígado  │ 16–18G             │ ≥2 fragmentos     │ Histopatologia
    Core Biopsy Rim     │ 16–18G             │ ≥2 fragmentos     │ Histopatologia
    BVC                 │ 19–22G transabd.   │ 10–25 mg vilo     │ Genética (FISH+array)
    Amniocentese        │ 20–22G             │ 15–20 mL LA       │ Genética
    Drenagem-Abscesso   │ Pigtail 8–14F      │ volume (mL)       │ Cultura+antibiograma
    Drenagem-Ascite     │ Agulha 14–16G      │ 1,5–4 L por sess. │ Citologia+bioquímica
    Escleroterapia      │ 20–22G             │ vol. aspirado+EtOH│ Não enviado
    CVC (VJI)           │ 18G + pigtail      │ —                 │ —
    PICC                │ 4F (21G micro)     │ —                 │ —

11. FRASEOLOGIA PADRÃO — Biblioteca V2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    PAAF realizada:
      "PAAF do nódulo [tireoidiano/mamário/linfonodal] [D/E] realizada com agulha
      [X]G, [X] passagens. Material enviado para análise citopatológica. Procedimento
      sem intercorrências imediatas."
    Insatisfatório:
      "Material obtido considerado insatisfatório para análise diagnóstica.
      Recomenda-se nova PAAF após 3–6 meses."
    Core biopsy:
      "Core biopsy do [alvo] com agulha [X]G automática, [X] fragmentos cilíndricos
      colhidos. Fragmentos de aspecto macroscópico [adequado/insatisfatório].
      Material encaminhado para histopatologia. Sem complicações imediatas pós-procedimento.
      Repouso relativo por 24h."
    Amniocentese sem complicação:
      "Amniocentese realizada com agulha 22G, coleta de [X] mL de líquido amniótico
      de aspecto [claro e amarelado/hemorrágico — registrar]. FCF pré-procedimento:
      [X] bpm. FCF imediata pós-procedimento: [X] bpm — mantida. Sem complicações.
      Repouso relativo por 24h. Retornar ao obstetra para seguimento."
    BVC sem complicação:
      "BVC transabdominal realizada com agulha [X]G. Material: vilosidades coriônicas
      de aspecto esbranquiçado e quantidade [X] mg, adequado. FCF mantida.
      Material encaminhado para análise genética. Sem intercorrências."
    Drenagem:
      "Drenagem de [abscesso/coleção/ascite] guiada por US com [agulha [X]G / cateter
      pigtail [X]F]. Volume drenado: [X] mL de aspecto [purulento/seroso/hemático].
      Cateter posicionado no interior da coleção com confirmação ultrassonográfica.
      Material enviado para [cultura+antibiograma/citologia]."
    Escleroterapia:
      "Escleroterapia com etanol do cisto [tireoidiano/renal/hepático] [D/E].
      Volume aspirado: [X] mL. Etanol 99% instilado: [X] mL, tempo de contato 3–5 min.
      Reaspirção do etanol. Cisto [colapso completo/volume residual <[X] mL].
      Controle ultrassonográfico em 3 meses para avaliação de resposta."

12. REGRAS TRANSVERSAIS — TODOS OS 10 PROCEDIMENTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    a. GUIA EM TEMPO REAL: todos os procedimentos desta área são guiados por US.
       Declarar "guiado por ultrassonografia em tempo real" em todo laudo.
    b. TCLE: consentimento documentado antes do início — obrigatório.
    c. VOLUME EM mL: sempre relatar volumes aspirados/drenados/injetados.
    d. COMPLICAÇÕES: sempre declarar ausência ou descrever. Nunca omitir.
    e. FCF: registrar antes e após procedimentos obstétricos. Bradicardia = R6.
    f. FRAGMENTOS: relatar número e aspecto macroscópico (adequado / insatisfatório).
    g. DESTINO DO MATERIAL: especificar para cada amostra (histopatologia /
       citopatologia / microbiologia / genética / bioquímica).
    h. REPOUSO: recomendar sempre com tempo específico (24h / 48h / conforme médico).
    i. COMPLICAÇÃO GRAVE: interromper procedimento + documentar + ATIVAR R6.
    j. ORDEM CONCLUSÃO: N4 → N3 → N2 → N1 → N0.`,
};
