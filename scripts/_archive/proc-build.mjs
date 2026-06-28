import { readFileSync, writeFileSync } from 'fs';

// ── Source priority: phase4 > phase3 > phase2 > phase1 > base ───────────
const base = JSON.parse(readFileSync('scripts/templates-improved.json', 'utf8'));
let ph1 = []; try { ph1 = JSON.parse(readFileSync('scripts/phase1-templates.json', 'utf8')); } catch {}
let ph2 = []; try { ph2 = JSON.parse(readFileSync('scripts/phase2-templates.json', 'utf8')); } catch {}
let ph3 = []; try { ph3 = JSON.parse(readFileSync('scripts/phase3-templates.json', 'utf8')); } catch {}
let ph4 = []; try { ph4 = JSON.parse(readFileSync('scripts/phase4-templates.json', 'utf8')); } catch {}

const ph1Map = Object.fromEntries(ph1.map(t => [t.id, t]));
const ph2Map = Object.fromEntries(ph2.map(t => [t.id, t]));
const ph3Map = Object.fromEntries(ph3.map(t => [t.id, t]));
const ph4Map = Object.fromEntries(ph4.map(t => [t.id, t]));

function getLatest(id) {
  if (ph4Map[id]?.aiInstructions) return ph4Map[id].aiInstructions;
  if (ph3Map[id]?.aiInstructions) return ph3Map[id].aiInstructions;
  if (ph2Map[id]?.aiInstructions) return ph2Map[id].aiInstructions;
  if (ph1Map[id]?.aiInstructions) return ph1Map[id].aiInstructions;
  return base.find(t => t.id === id)?.aiInstructions || '';
}

// ── Procedimentos template IDs ────────────────────────────────────────────
const IDS = {
  PAAF_TIR:   'UCLNaw0tHp8pnYTcvNbl',          // PAAF - TIREÓIDE           16046 (base)
  PAAF_MAMA:  'TE3KSrgQue5QiB9XoAuk',          // PAAF - MAMA               15675 (base)
  PAAF_LINF:  'rCz1726L55Ig3WZNA8GG',          // PAAF - LINFONODOS         17030 (base)
  PAAF_CIST:  'TieSCWDKqitCZrv3H1DP',          // PAAF - CISTOS             15787 (base)
  CORE:       'G83ufrwjCr50dLF2w1dI',          // CORE BIOPSY               14765 (base — mais curto!)
  BVC:        'lsPYxcH8F5xi3sswQGDY',          // BIÓPSIA DE VILO CORIÔNICO 15394 (base)
  AMNIO:      '633UqIfdutGURCBK1iO3',          // AMNIOCENTESE              17811 (base)
  DRENO:      '5RbkYF0LSfhzL2cPY5qU',          // DRENAGEM DE COLEÇÕES      19186 (base)
  ACESSO:     'YA17bYTMrhjSubZxKJ9F',          // ACESSO VASCULAR           16502 (base)
  ESCLERO:    'procedimentos-escleroterapia',   // ESCLEROTERAPIA            15751 (ph4)
};

const templates = {};
for (const [key, id] of Object.entries(IDS)) {
  templates[key] = { id, aiInstructions: getLatest(id) };
}

// ── EXPANSÃO 1: CORE BIOPSY (14765 → 19k+) ───────────────────────────────
templates.CORE.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — CORE BIOPSY AVANÇADO

### 6. BIÓPSIA DE MAMA — PROTOCOLO DETALHADO
─────────────────────────────────────────────────────────────
INDICAÇÃO POR CATEGORIA BI-RADS:
  BI-RADS 3: biópsia opcional (risco <2%); preferir controle em 6 meses.
    Biopsiar se paciente ansiosa, impossibilidade de seguimento, características
    preocupantes ao exame físico.
  BI-RADS 4A: risco 2–10% → core biopsy obrigatória.
  BI-RADS 4B: risco 10–50% → core biopsy obrigatória.
  BI-RADS 4C: risco 50–95% → core biopsy obrigatória.
  BI-RADS 5: risco >95% → core biopsy antes da cirurgia (confirmar histologia).
  BI-RADS 6: malignidade conhecida — biópsia para confirmar receptores/subtipo.

TÉCNICA:
  Agulha automática 14G: standard para nódulos sólidos ≥1 cm.
  VAB 11G ou 8G (Mammotome/EnCor): microcalcificações, lesão <1 cm, lesão difícil.
  Posicionamento: agulha paralela ao plano do transdutor (abordagem coplanar).
  Confirmar agulha pré-disparo: ponta 1 cm além da lesão → disparo → 2 cm de fragmento.
  Coletar: mínimo 4 fragmentos 14G / mínimo 6–10 fragmentos 11G.
  Clip metálico: colocar SEMPRE após biópsia (mesmo BI-RADS 4A) → guia cirurgia futura.
  Hematoma pós-procedimento: comprimir 5–10 min com curativo compressivo.

FRAGMENTOS ADEQUADOS:
  Cilíndricos, brancos-acinzentados, coesos, ≥10 mm.
  Fragmentos hemáticos/amolecidos: relatar; podem comprometer análise imunohistoquímica.

BIÓPSIA DE MICROCALCIFICAÇÕES:
  Guia por US se visíveis; TC estereotáxica se não visíveis ao US.
  VAB 11G com US: mínimo 12 fragmentos; radiografar fragmentos pós-coleta para confirmar calc.
  Se sem calcificação nos fragmentos: repetir passagem.

### 7. BIÓPSIA HEPÁTICA — CONSIDERAÇÕES ESPECÍFICAS
─────────────────────────────────────────────────────────────
VIAS DE ACESSO:
  Intercostal: mais comum para lóbulo direito (evitar pulmão: risco pneumotórax).
  Subcostal: acesso direto ao lobo esquerdo ou fígado grande.
  Transhepático: atravessar parênquima normal antes de atingir alvo (reduz sangramento).
  EVITAR: via transpleural (risco pneumotórax), via transcolecística.

PREPARO:
  INR <1,5 e plaquetas >50.000 obrigatórios.
  Suspender aspirina 5 dias antes.
  Hospitalização de curta duração (4–6h de observação pós-biópsia recomendada).

COMPLICAÇÕES:
  Hemorragia intraperitoneal (<1%): dor abdominal + hipotensão → US imediato → R6.
  Hemobilia (<0,1%): sangue nas fezes + icterícia + cólica biliar (tríade de Quincke).
  Pneumotórax (<1%): abordagem intercostal alta.
  Bacteremia: profilaxia ATB para biópsias de abscesso.

### 8. BIÓPSIA RENAL — CONSIDERAÇÕES ESPECÍFICAS
─────────────────────────────────────────────────────────────
INDICAÇÕES PRINCIPAIS:
  Doença glomerular (síndrome nefrótica, nefrítica, proteinúria isolada).
  Lesão renal aguda de causa indeterminada.
  Avaliação pós-transplante renal (rejeição, toxicidade por calcineurina).
  Massa renal indeterminada (<3 cm, SRM — Small Renal Mass).

TÉCNICA:
  Polo inferior do rim: menor risco de atingir vasos hiliares ou pelve.
  16G agulha automática: mínimo 2 fragmentos; ideal 2 córtex + 1 medular.
  Fragmento adequado: ≥10 glomérulos para diagnóstico glomerular.

PÓS-BIÓPSIA RENAL:
  Repouso no leito por 4–6h. Pressão arterial monitorada.
  Hematúria macroscópica transitória: comum (<24h); alertar paciente.
  Hematoma perirrenal: US após 4h ou se dor intensa.
  Sangramento significativo: intervenção endovascular (embolização) → R6.

### 9. BIÓPSIA TRANSPARIETAL — MASSAS DE PARTES MOLES / LINFONODO
─────────────────────────────────────────────────────────────
SUSPEITA DE LINFOMA:
  Preferir core biopsy a PAAF: arquitetura tecidual necessária para subtipagem.
  Mínimo 2–3 cilindros para imunohistoquímica + FISH + material para fluxocitometria.
  Linfonodo ≥1 cm com hilo ausente + ecogenicidade hipoecoica = suspeita alta.
  Punção guiada por US: abordagem direta ao nódulo suspeito.
  Enviar amostra em soro fisiológico para fluxocitometria (não formalina).

SUSPEITA DE METÁSTASE:
  Core biopsy 18G; 2–3 fragmentos em formalina tamponada.
  Imunohistoquímica direcionará o sítio primário (CK7/CK20, TTF-1, PSA, etc.).

BIÓPSIA DE MASSA MUSCULOESQUELÉTICA:
  Planejamento conjunto com ortopedista oncológico.
  Via de acesso deve estar no trajeto da futura ressecção cirúrgica.
  NUNCA contaminar compartimentos não acometidos.
  Evitar hematoma extenso: via mais direta possível.

### 10. DOCUMENTAÇÃO PÓS-BIÓPSIA — CHECKLIST
─────────────────────────────────────────────────────────────
  [ ] Data/hora do procedimento.
  [ ] Médico responsável + auxiliares.
  [ ] Tipo de biópsia (core 14G / VAB 11G / agulha fina 23G).
  [ ] Número de fragmentos colhidos + aspecto macroscópico.
  [ ] Clip metálico inserido (mama): sim/não + posição US.
  [ ] Complicações peri-procedimento.
  [ ] US imediato pós-biópsia: hematoma presente/ausente, tamanho.
  [ ] Material enviado para: histopatologia / fluxocitometria / genética.
  [ ] Orientações ao paciente: repouso [X]h, compressa fria, retorno com resultado.`;

// ── EXPANSÃO 2: BIÓPSIA DE VILO CORIÔNICO (15394 → 19k+) ─────────────────
templates.BVC.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — BIÓPSIA DE VILO CORIÔNICO AVANÇADO

### 6. TIMING E ACURÁCIA DIAGNÓSTICA
─────────────────────────────────────────────────────────────
JANELA IDEAL: 10+0 a 13+6 semanas.
  Antes de 10 semanas: risco aumentado de defeitos de redução de membros (não realizar).
  Após 14 semanas: amniocentese geralmente preferível.

ACURÁCIA DIAGNÓSTICA:
  Sensibilidade/especificidade para aneuploidias (T21, T18, T13, monossomia X): >99%.
  FISH rápida (2 dias): detecta T21/T18/T13/sex chromosomes.
  Array CGH (7–14 dias): variações de número de cópias (CNV) de alta resolução.
  Cariotipagem clássica (14–21 dias): visão completa do cariótipo.
  Exoma fetal (semanas): indicado em anomalias estruturais sem causa cromossômica.

RISCO DE PERDA FETAL:
  BVC adicional acima do risco de base: ~0,5–1,0% (higher than amniocentesis).
  Discussão com a paciente obrigatória (TCLE específico de procedimento obstétrico).

### 7. TÉCNICA TRANSABDOMINAL DETALHADA
─────────────────────────────────────────────────────────────
PREPARAÇÃO:
  Bexiga vazia (não necessária para via transabdominal — diferente da transcervical).
  Assepsia abdominal com clorexidina. Campo estéril.
  Anestesia local com lidocaína 1% na pele e subcutâneo.

GUIA DE AGULHA:
  Guia acoplado ao transdutor: permite visualização contínua da agulha.
  Técnica de mão livre: operador experiente, melhor angulação.

PROCEDIMENTO PASSO A PASSO:
  1. US pré-procedimento: confirmar BCF + IG + localização placentária.
  2. Identificar placa corial (borda fetal da placenta) — alvo principal.
  3. Alinhar janela acústica: evitar intestino, bexiga, grandes vasos.
  4. Inserir agulha 19–22G na placa corial (angulação paralela à placenta).
  5. Avançar dentro do tecido corial com movimentos de vaivém.
  6. Aspirar com seringa de 20 mL contendo 5 mL de meio de transporte.
  7. Retirar agulha e observar material aspirado.
  8. Material adequado: vilosidades brancas flutuando no meio (estrutura arbórea visível).
  9. FCF imediata pós-procedimento: documentar.

### 8. VIA TRANSCERVICAL
─────────────────────────────────────────────────────────────
INDICAÇÕES: útero em retroversão grave, placenta posterior inacessível transabdominalmente.
TÉCNICA:
  Bexiga cheia (melhora visualização). Espéculo. Colo asséptico.
  Cateter flexível 16–18G introduzido pelo OCI guiado por US transabdominal.
  Aspirar vilosidades com seringa de 20 mL.

CONTRAINDICAÇÕES DA VIA TRANSCERVICAL:
  Sangramento vaginal ativo. Infecção cervical (herpes ativo, vaginose bacteriana grave).
  Cerclagem de colo. DIU in situ.

### 9. COMPLICAÇÕES E CONDUTA
─────────────────────────────────────────────────────────────
Hematoma subcoriônico pós-BVC: coleção anecoica entre o vilo e a parede → pequeno é frequente.
  >25% da área placentária: maior risco de aborto → N3 → obstetrícia.
Bradicardia fetal transitória: comum durante o procedimento, geralmente autolimitada.
  Bradicardia persistente >30 seg → ATIVAR R6 — obstetrícia urgente.
Perda gestacional: risco real; documentar FCF pré e pós-procedimento.
Sangramento materno pós-BVC: compressão + repouso; se abundante → R6.

MOSAICISMO PLACENTÁRIO CONFINADO (MPC):
  Mosaicismo cromossômico encontrado na BVC mas não no feto.
  Pode gerar falso positivo.
  Resultado discordante BVC vs. cariótipo fetal → aminocentese de confirmação.

### 10. INDICAÇÕES CLÍNICAS DA BVC
─────────────────────────────────────────────────────────────
  • Rastreio combinado 1T com risco elevado (PAPP-A + hCG + TN + idade).
  • Translucência nucal (TN) ≥3,5 mm.
  • Rastreio cfDNA (NIPT) positivo para aneuploidia.
  • Filho anterior com cromossomopatia.
  • Translocação cromossômica parental.
  • Doença monogênica conhecida (teste molecular específico).
  • Malformação fetal detectada ao US de 1T.`;

// ── EXPANSÃO 3: PAAF - MAMA (15675 → 19k+) ───────────────────────────────
templates.PAAF_MAMA.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — PAAF DE MAMA AVANÇADO

### 6. INDICAÇÕES E CORRELAÇÃO BI-RADS
─────────────────────────────────────────────────────────────
PAAF MAMÁRIA — QUANDO INDICADA:
  BI-RADS 3 com características preocupantes ou paciente ansiosa.
  BI-RADS 4A: PAAF é aceitável; core biopsy é preferível por maior acurácia.
  BI-RADS 4B/4C/5: CORE BIOPSY (14G) é padrão — PAAF subestima a lesão.
  Linfonodo axilar suspeito (BI-RADS 4–5 + linfonodo axilar anormal): PAAF linfonodo.
  Cisto complicado sintomático: PAAF para aspiração terapêutica + citologia.
  Massa palpável (classificação clínica P3-P5 pela escala BIRADS palpação): core biopsy.

CORRELAÇÃO OBRIGATÓRIA (Triple Test):
  Clínica + Imagem (US/MMG) + Citologia (PAAF).
  Resultado benigno em 3 elementos: sensibilidade >99,9%.
  Discordância em qualquer elemento → core biopsy ou cirurgia.

### 7. TÉCNICA DE PAAF MAMÁRIA
─────────────────────────────────────────────────────────────
POSICIONAMENTO: decúbito dorsal com braço ipsilateral elevado.
  Lâminas etiquetadas e prontas antes do início.
  Agulha 23–25G, seringa 10 mL.

TÉCNICA ASPIRATIVA:
  Fixar a lesão com dedo indicador e médio (estabilizar).
  Inserir a agulha no centro da lesão sob visão US em tempo real.
  Aplicar vácuo (3–5 mL de retração do êmbolo) + movimentos de vaivém em leque.
  Manter vácuo enquanto a agulha estiver na lesão.
  Antes de retirar: aliviar o vácuo (prevenir contaminação com sangue subcutâneo).
  Esfregaços imediatos: material depositado na lâmina, fixado rapidamente.

TÉCNICA CAPILAR (sem seringa):
  Agulha apenas; movimentos de vaivém; material sobe por capilaridade.
  Menor sangramento; preferível para lesões muito pequenas (<5 mm).

QUANTIDADE POR LESÃO:
  Mínimo 2 inserções com 2–4 movimentos cada.
  Material claro/aquoso: sugestivo de cisto — aspirar tudo (terapêutico).
  Material hemático: pode ser fibrocístico hemorrágico ou necrose tumoral.
  Sem material: nódulo denso (fibroadenoma) ou agulha fora do alvo.

### 8. INTERPRETAÇÃO CITOLÓGICA — SISTEMA PADINI (Brasil) / C1-C5
─────────────────────────────────────────────────────────────
C1 — Não diagnóstico/Insatisfatório: material hemático ou acelular.
  → Repetir PAAF (aguardar 4–6 semanas).
C2 — Benigno: células ductais benignas, macrófagos, material amorfo.
  → Correlação com imagem; se BI-RADS 2–3 → seguimento.
C3 — Atipia benigna provavelmente: alterações celulares leves.
  → Core biopsy para confirmação.
C4 — Suspeito de malignidade: células atípicas expressivas sem critérios absolutos.
  → Core biopsy obrigatória.
C5 — Maligno: critérios definitivos de malignidade.
  → Planejamento oncológico.

NOTA: resultado C1 em BI-RADS 4B/4C/5 → core biopsy imediata (não aguardar).

### 9. PAAF DO LINFONODO AXILAR NA MAMA
─────────────────────────────────────────────────────────────
INDICAÇÃO: linfonodo axilar com hilo ausente ou cortical >3 mm em paciente com
  nódulo mamário suspeito (BI-RADS 4–5).
Resultado positivo para metástase: estadiamento axilar confirmado → axila cirúrgica.
Resultado negativo: não exclui micrometástase; linfonodo sentinela ainda necessário.

BIÓPSIA DO LINFONODO SENTINELA (não realizada ao US, mas requer mapeamento):
  Mapeamento US pré-operatório: identificar linfonodos axilares alterados.
  Documentar: número, localização (nível I/II axilar), tamanho do maior.
  Marcar com clip metálico se puncionado (permite localização cirúrgica).

### 10. ASPIRAÇÃO TERAPÊUTICA DE CISTO MAMÁRIO
─────────────────────────────────────────────────────────────
CISTO SIMPLES SINTOMÁTICO:
  Aspirar completamente. Enviar para citologia se: cisto recidivante, conteúdo
    hemático, espessamento de parede.
  Volume aspirado: registrar (mL).
  Colapso completo ao US pós-aspiração: confirmar e documentar.
  Recidiva em <6 semanas: reavaliar — BI-RADS pode mudar.
  Cisto recidivante ≥3 vezes: encaminhamento para ressecção cirúrgica.

CISTO COMPLICADO:
  Aspirar + enviar para citologia independente do aspecto.
  Material espesso achocolatado: sugestivo de endometrioma mamário (raro) ou galactocele.
  Material purulento: abscesso → cultura + ATB.`;

// ── EXPANSÃO 4: PAAF - CISTOS (15787 → 19k+) ─────────────────────────────
templates.PAAF_CIST.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — PAAF DE CISTOS (ÓRGÃOS VARIADOS)

### 6. PROTOCOLO POR LOCALIZAÇÃO DO CISTO
─────────────────────────────────────────────────────────────
CISTO TIREOIDIANO:
  Simples (completamente anecoico, TI-RADS 1): PAAF não indicada.
  Misto (cisto + componente sólido, TI-RADS 3–5):
    PAAF do componente sólido (não do componente cístico).
    Aspecto usual: coloide denso viscoso.
    Conteúdo hemorrágico: coloide hemorrágico — comum, geralmente benigno.
  Cisto sintomático volumoso: aspirar para alívio sintomático + escleroterapia.
  Recidiva após aspiração: escleroterapia com etanol (ver template específico).

CISTO RENAL SIMPLES (BOSNIAK I):
  PAAF indicada: cisto sintomático volumoso (dor lombar) OU para diagnóstico
    diferencial (infecção suspeita).
  Aspecto normal: seroso, amarelo-claro. Proteína baixa, sem células.
  Cisto hemorrágico (Bosniak II): PAAF + citologia para excluir neopl. cística.
  Bosniak IIF/III/IV: core biopsy da porção sólida ou cirurgia.

CISTO HEPÁTICO SIMPLES:
  PAAF apenas se: sintomático, suspeita de infecção (abscesso amebiano/hidático).
  Cisto hidático (Echinococcus): PAAF CONTRAINDICADA (risco de anafilaxia e semeadura).
  Diagnóstico: sorologia anti-Echinococcus.
  PAIR (punção-aspiração-injeção-reaspirção): técnica segura para hidatidose
    em centros especializados com preparo para anafilaxia.

CISTO OVARIANO (ANEXIAL):
  Simples (<5 cm, O-RADS 2): não puncionar rotineiramente; regressão espontânea.
  Endometrioma: aspecto achocolatado; PAAF apenas se sintomático.
    ATENÇÃO: PAAF de endometrioma pode aumentar risco de infecção e piorar reserva ovariana.
  Cisto complexo com suspeita maligna (O-RADS 4–5): core biopsy ou cirurgia.
    NÃO puncionar cisto anexial suspeito de neoplasia (disseminação peritoneal).
  Abscesso tubo-ovariano: drenagem guiada por US (via transvaginal ou transabdominal).

CISTO PANCREÁTICO:
  PAAF guiada por ecoendoscopia (EUS): padrão ouro.
  PAAF guiada por US percutâneo: apenas para cistos de corpo/cauda acessíveis.
  Análise do líquido pancreático: ACE (>200 ng/mL = IPMN mucinoso), amilase,
    citologia, CEA, DNA.
  Cistos suspeitos de IPMN ou MCN: avaliação multidisciplinar.

CISTO ESPLÉNICO:
  Cisto primário (epidermoide): PAAF apenas se diagnóstico incerto.
  Abscesso esplénico: PAAF + cultura → drenagem percutânea se ≥4 cm.

### 7. ANÁLISE DO LÍQUIDO ASPIRADO — GUIA
─────────────────────────────────────────────────────────────
  ASPECTO          │ SUGESTÃO               │ ENVIO
  ─────────────────┼────────────────────────┼───────────────────────────
  Claro/amarelado  │ Seroso (normal/benigno)│ Citologia se suspeita
  Achocolatado     │ Endometrioma/cisto ant.│ Citologia
  Purulento/turvo  │ Abscesso               │ Cultura + antibiograma
  Hemático         │ Cisto hemorrágico/neopl│ Citologia obrigatória
  Viscoso/coloide  │ Cisto tireoidiano      │ Citologia (Bethesda)
  Verde-escuro     │ Bilioso (biloma)       │ Bioquímica (bilirrubina)
  Amarelo-citrino  │ Transudato (ascite)    │ Bioquímica proteínas/LDH
  Leitoso          │ Quilo/linfa            │ Triglicerídeos

### 8. COMPLICAÇÕES DA PAAF DE CISTOS
─────────────────────────────────────────────────────────────
Reação vagal: posição supina após procedimento; hidratação VO.
Hematoma intracístico pós-PAAF: comum; autolimitado.
Dor local pós-PAAF: geralmente <48h; compressas frias + analgésicos.
Infecção do cisto pós-PAAF: rara (<0,1%); ATB + reaspirção se necessário.
Ruptura do cisto: líquido livre → observar; cirurgia se sintomático.
Anafilaxia (cisto hidático): → ATIVAR R6 — adrenalina imediata.

### 9. DOCUMENTAÇÃO PÓS-PAAF DE CISTO
─────────────────────────────────────────────────────────────
  "PAAF do cisto [localização] realizada com agulha [X]G.
  Volume aspirado: [X] mL. Aspecto do líquido: [claro/achocolatado/purulento].
  Colapso [completo/parcial] do cisto confirmado ao US pós-procedimento.
  Material enviado para [citologia/cultura/bioquímica].
  Procedimento sem intercorrências. Controle US em [X] meses."`;

// ── EXPANSÃO 5: ESCLEROTERAPIA (15751 → 19k+) ────────────────────────────
templates.ESCLERO.aiInstructions += `

═══════════════════════════════════════════════════════════════
### MÓDULO EXPANDIDO — ESCLEROTERAPIA AVANÇADO

### 5. PROTOCOLOS POR ÓRGÃO / TIPO DE CISTO
─────────────────────────────────────────────────────────────
CISTO TIREOIDIANO — Protocolo Detalhado:
  Indicação: cisto ≥2 cm sintomático (disfagia, globus, compressão) OU recidivante
    após ≥2 aspirações simples. Componente espongiforme ≥50% do volume.
  Exclusão: componente sólido >30%; suspeita de malignidade; PAAF não realizada.
  Agulha: 22G. Aspirar todo o conteúdo (volume exato em mL).
  Etanol 99% instilado: 25–50% do volume aspirado (máximo 10 mL).
  Tempo de contato: 3–5 minutos com agulha in situ.
  Reaspirção do etanol: remover o máximo possível.
  US pós-sessão: confirmar colapso. Volume residual < 30% = sucesso parcial.
  Sessões necessárias: cistos grandes (>20 mL) podem requerer 2–3 sessões.
  Controle: US em 1 mês + 3 meses + 6 meses.
  Resposta completa esperada: 80–90% dos casos (colapso ≥80% do volume original).

CISTO RENAL SIMPLES (Bosniak I/II) — Protocolo:
  Indicação: cisto sintomático ≥5 cm (dor lombar, hipertensão renovascular, obstrução).
  Exclusão: cistos multiloculados, Bosniak IIF ou superior.
  Aspiração inicial completa. Instilação etanol 99%:
    Cistos <100 mL: etanol = 25% do volume aspirado.
    Cistos 100–500 mL: etanol fixo = 50 mL máximo, dividido em 2 ciclos de 25 mL.
    Cistos >500 mL: drenagem com cateter pigtail 8F + infusão de 50 mL etanol/sessão.
  Tempo de contato: 5–10 minutos (cistosrenal com parede grossa precisam mais tempo).
  Eficácia: redução ≥50% em 80% dos casos a 1 ano.
  Complicação: dor transitória (etanol irrita a parede) — lidocaína 1% no cisto?
    Hematúria transitória pós-escleroterapia renal: esperada, autolimitada.

CISTO HEPÁTICO SIMPLES — Protocolo:
  Indicação: cisto >5 cm sintomático (dor, saciedade precoce, icterícia obstrutiva).
  Protocolo PAIR modificado:
    P: punção com agulha 18G ou cateter pigtail 8F.
    A: aspiração completa do conteúdo.
    I: instilação de etanol 99% (25% do volume, máx. 50 mL) por 5–10 min.
    R: reaspirção do etanol.
  Alternativa ao etanol: minociclina 300 mg em 10 mL SF (menos dor; boa eficácia).
  Contraindicação: comunicação biliar (LA biliosa no aspirado → PARAR, risco colangite).
  Cisto hidático: CONTRAINDICADO sem preparo específico anti-helmíntico.

VARIZ (escleroterapia venosa — partes moles):
  Agente: polidocanol 1–3% (espuma ou líquido) ou tetradecil sulfato.
  Injetar diretamente na malformação venosa / variz intramuscular guiado por US.
  Volume: 0,5–3 mL por sessão conforme tamanho.
  Avaliar: compressão pós-injeção para distribuir agente + evitar trombose não planejada.
  Controle Doppler imediato: confirmar oclusão do alvo.
  Complicações: trombose superficial, dor local, pigmentação cutânea.

### 6. AGENTES ESCLEROSANTES — COMPARATIVO
─────────────────────────────────────────────────────────────
  Agente             │ Concentração  │ Indicação Principal        │ Dor  │ Eficácia
  ───────────────────┼───────────────┼────────────────────────────┼──────┼──────────
  Etanol absoluto    │ 99–100%       │ Cisto tireoide/renal/hepat │ Alta │ Excelente
  Polidocanol        │ 1–3%          │ Varizes/malf. venosas      │ Baixa│ Boa
  Tetradecil sulfato │ 1–3%          │ Varizes/malformações       │ Média│ Boa
  Doxiciclina        │ 5 mg/mL       │ Higroma, quilotórax        │ Alta │ Boa
  Minociclina        │ 300 mg/10 mL  │ Cisto hepático (alternativa│ Média│ Boa

### 7. MONITORAMENTO E CRITÉRIOS DE RESPOSTA
─────────────────────────────────────────────────────────────
CONTROLE US — CRONOGRAMA:
  1 mês: avaliação precoce; volume residual.
  3 meses: resposta definitiva habitual.
  6 meses: confirmação de resposta sustentada.
  12 meses: verificação de recidiva tardia.

CRITÉRIOS DE RESPOSTA (% redução de volume):
  Completa (CR): redução ≥80%. Excelente resultado.
  Parcial (PR): redução 50–79%. Repetir sessão.
  Mínima (MR): redução 20–49%. Cirurgia a considerar.
  Falha: redução <20%. Cirurgia recomendada.

### 8. FRASEOLOGIA PÓS-ESCLEROTERAPIA
─────────────────────────────────────────────────────────────
"Sessão de escleroterapia com etanol do cisto [tireoidiano/renal/hepático] [localização].
  Volume aspirado total: [X] mL. Líquido de aspecto [claro/achocolatado].
  Etanol 99% instilado: [X] mL. Ciclos realizados: [X]. Tempo total de contato: [X] min.
  Reaspirção do etanol realizada. Volume residual ao US imediato pós-procedimento: [X] mL
  ([X]% do original). Procedimento tolerado sem intercorrências maiores.
  Recomenda-se controle ultrassonográfico em 1 e 3 meses para avaliação da resposta."`;

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = Object.values(templates).map(t => ({ id: t.id, aiInstructions: t.aiInstructions }));
writeFileSync('scripts/proc-templates.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\nProcedimentos template sizes:');
const names = {
  PAAF_TIR:  'PAAF — TIREÓIDE               ',
  PAAF_MAMA: 'PAAF — MAMA                   ',
  PAAF_LINF: 'PAAF — LINFONODOS             ',
  PAAF_CIST: 'PAAF — CISTOS                 ',
  CORE:      'CORE BIOPSY                   ',
  BVC:       'BIÓPSIA DE VILO CORIÔNICO     ',
  AMNIO:     'AMNIOCENTESE                  ',
  DRENO:     'DRENAGEM DE COLEÇÕES          ',
  ACESSO:    'ACESSO VASCULAR               ',
  ESCLERO:   'ESCLEROTERAPIA                ',
};
for (const [key, t] of Object.entries(templates)) {
  const n = (t.aiInstructions || '').length;
  const s = n >= 17000 ? '[OK]' : n >= 15000 ? '[~] ' : '[!!]';
  console.log(`  ${s} ${names[key]} ${n} chars`);
}
