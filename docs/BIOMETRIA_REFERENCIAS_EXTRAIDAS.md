# Referências de biometria fetal — coeficientes extraídos (jul/2026)

Mesmo rito de `FMF_COEFICIENTES_EXTRAIDOS.md`: **nenhum coeficiente é escrito de
memória**. Abaixo, a fonte de cada número, o que foi verificado e o que ainda
falta para liberar uso clínico.

Código: `src/modules/calculators/constants/biometryReferences.ts`
Testes: `src/test/biometryReferences.test.ts`

## Status

| Curva | Fonte | Estado |
|---|---|---|
| OMS (WHO) | coeficientes de quantil já em uso no sistema | `validated: true` — **padrão atual** |
| Hadlock 1991 | Radiology 1991;181(1):129-133 · PMID 1887021 | `validated: false` — **EM VALIDAÇÃO** |
| INTERGROWTH-21st | Stirnemann 2017, UOG 49(4):478-486 · PMC5516164 | `validated: false` — **EM VALIDAÇÃO** |

A referência **padrão do sistema** é computada (`DEFAULT_BIOMETRY_REFERENCE`):
a primeira da ordem de preferência clínica `[hadlock, intergrowth, who]` que
estiver **validada**. Hoje resolve para **OMS**; assim que Hadlock passar a
`validated: true`, **o padrão vira Hadlock automaticamente**, sem outra mudança
de código (decisão do usuário em 16/07/2026).

---

## Hadlock 1991 — PFE por IG

**Fonte:** abstract (PubMed 1887021) + fórmula de peso do texto.

Equação implementada (mediana):

```
PFE_p50(g) = e^(0,578 + 0,332·IG − 0,00354·IG²)     [IG em semanas]
SD = 12,7% da mediana (uniforme em toda a gestação)
z = (PFE − mediana) / (0,127 × mediana)
```

**Verificado contra os fatos do abstract** (travados em teste):
- 10 semanas → **35 g** (equação: 34,6 g)
- 40 semanas → **3.619 g** (equação: 3.617 g — 0,06%)
- "uniform variance of ±12.7% (1 standard deviation) throughout gestation" →
  `HADLOCK_CV = 0.127`; teste confirma z = 1 exatamente a 1 DP da mediana em
  12/20/28/34/40 semanas.

**⚠️ Equação vs. tabela.** A literatura recente
([AJOG 2025 — *Revisiting the Hadlock 1991 population reference*](https://pubmed.ncbi.nlm.nih.gov/40157521/))
mostra que a **tabela impressa** no artigo de 1991 **diverge da equação** do
próprio texto, e que usar a tabela **subdiagnostica RCIU em 5,1%** dos casos
(176.060 exames). Implementamos a **equação**, não a tabela — decisão
deliberada, a revisar se o usuário preferir reproduzir a tabela histórica.

**Escopo:** Hadlock 1991 é um padrão de **peso**. Não define percentis de DBP/CC/CA/CF
isolados — essas dimensões caem na curva OMS (a UI sinaliza o fallback).

## INTERGROWTH-21st — PFE

**Fonte:** Stirnemann 2017 (acesso aberto, PMC5516164), equação de predição +
Tabela 2 (LMS).

Predição de peso (só CC e CA):

```
ln(PFE) = 5,084820 − 54,06633·(CA/100)³ − 95,80076·(CA/100)³·ln(CA/100)
          + 3,136370·(CC/100)              [CA, CC em cm; PFE em g]
```

Percentis por IG — LMS de Cole sobre `ln(PFE)`:

```
λ(IG) = −4,257629 − 2162,234·IG⁻² + 0,0002301829·IG³
μ(IG) = 4,956737 + 0,0005019687·IG³ − 0,0001227065·IG³·ln(IG)
σ(IG) = 10⁻⁴·(−6,997171 + 0,057559·IG³ − 0,01493946·IG³·ln(IG))
z = ((ln(PFE)/μ)^λ − 1) / (λ·σ)
```

**Verificado** (testes): μ(32 sem) = 7,469 → mediana e^7,469 ≈ **1.755 g**,
coerente com o p50 publicado do INTERGROWTH a 32 semanas; z = 0 na mediana;
monotonicidade 22→40 sem; σ na escala esperada (CV de ln(PFE) < 5%).

## INTERGROWTH-21st — BIOMETRIA (HC, BPD, AC, FL)

**Fonte:** Papageorghiou AT et al., *International standards for fetal growth*,
Lancet 2014;384(9946):869-879. Equações transcritas da **implementação de
referência open-source do próprio projeto**
([nutriverse/intergrowth](https://github.com/nutriverse/intergrowth/blob/main/R/03-calculate_fetal_growth.R),
`R/03-calculate_fetal_growth.R`) — o site oficial publica tabelas/PDF e R scripts,
mas não as equações em texto.

IG em **semanas decimais**, medidas em **mm**, distribuição normal
(`z = (medida − mediana) / DP`):

```
HC   mediana = −28,2849 + 1,69267·g² − 0,397485·g²·ln(g)
     DP      = 1,98735 + 0,0136772·g³ − 0,00726264·g³·ln(g) + 0,000976253·g³·ln(g)²
BPD  mediana = 5,60878 + 0,158369·g² − 0,00256379·g³
     DP      = e^(0,101242 + 0,00150557·g³ − 0,000771535·g³·ln(g) + 0,0000999638·g³·ln(g)²)
AC   mediana = −81,3243 + 11,6772·g − 0,000561865·g³
     DP      = −4,36302 + 0,121445·g² − 0,0130256·g³ + 0,00282143·g³·ln(g)
FL   mediana = −39,9616 + 4,32298·g − 0,0380156·g²
     DP      = e^(0,605843 − 42,0014·g⁻² + 0,00000917972·g³)
OFD  mediana = −12,4097 + 0,626342·g² − 0,148075·g²·ln(g)
     DP      = e^(−0,880034 + 0,0631165·g² − 0,0317136·g²·ln(g) + 0,00408302·g²·ln(g)²)
```

**Verificado contra o padrão publicado a 32 semanas** (travado em teste):
HC **294,5** (pub. ≈295) · DBP **83,8** (≈84) · CA **273,9** (≈274) · CF **59,4** (≈59) mm.
Também travados: z = 0 na mediana, DP > 0 e finito em toda a janela, e
monotonicidade de 14 a 40 semanas para as quatro dimensões.

**Janela de validade:** 14–40 semanas (padrão prescritivo). Fora dela — e no
úmero, que não faz parte do padrão — o percentil cai na OMS, sinalizado na UI
(chip "p60% · OMS") e no resumo enviado à IA.

> OFD está implementado nas equações mas não é exposto na UI: o sistema ainda não
> tem a dimensão "diâmetro occipitofrontal" no formulário.

## Hadlock — biometria isolada: INCORPORADA (tabela de 1984)

> Correção de rumo: este documento afirmava que os coeficientes de biometria de
> Hadlock não existiam em fonte pública. **Estava errado** — o usuário apontou
> que "Hadlock 1984 detém as biometrias", e a tabela foi localizada.

Hadlock 1991 é um padrão de **peso**; quem traz as **curvas de crescimento das
biometrias** (média por IG de DBP/CC/CA/CF) é o artigo de 1984:

> Hadlock FP, Deter RL, Harrist RB, Park SK. **Fetal biparietal diameter, head
> circumference, abdominal circumference and femur length: a prospective study.**
> Radiology. 1984;152(2):497-501.

**Fonte da transcrição:** tabelas "Obstetrical References" da documentação técnica
SuperSonic MACH / Hologic (PM.LAB.175-A), que reproduz o padrão de 1984 citando o
artigo original. O PDF (164 páginas) não era legível por WebFetch (binário) — foi
extraído com `pypdf` e conferido dígito a dígito.

**Implementado em** `constants/hadlockBiometryData.ts` → `HADLOCK_1984_BIOMETRY`:
57 pontos por dimensão (12 → 40 semanas, passo de 0,5), com **DP constante por
parâmetro** (é assim que o padrão de 1984 é publicado):

| Dimensão | DP        |
|----------|-----------|
| DBP      | 3 mm      |
| CC       | 10 mm     |
| CA       | 13,4 mm   |
| CF       | 3 mm      |

`hadlockBiometryMedian` interpola linearmente entre os pontos; `hadlockBiometryZScore`
usa z = (valor − média) / DP.

**Janela de validade:** 12–40 semanas. Fora dela — e no **úmero**, que não faz
parte do padrão — o percentil cai na OMS, sinalizado (`fellBack`).

### Divergência conhecida e clinicamente relevante: o fêmur

A mediana do **CF de Hadlock cai perto do p90 do INTERGROWTH** no 3º trimestre
(ex.: a 32 semanas, o CF mediano de Hadlock marca ~p92 na curva INTERGROWTH; o
inverso marca ~p11 em Hadlock — reproduzido na UI e travado em teste). **Não é
erro de transcrição**: são padrões diferentes. Por isso a curva usada é sempre
exibida junto do percentil na UI, no resumo enviado à IA e no laudo.

### PFE por sexo

Só a **OMS** publica curva de PFE por sexo (`EFW_M`/`EFW_F`). Hadlock e
INTERGROWTH são padrões **únicos**: quando o sexo é conhecido, `getZScoreBy`
resolve a dimensão sexada na curva neutra do próprio padrão — e **não** na OMS,
o que anularia silenciosamente a curva escolhida pelo médico. Travado em teste.

**Nota de validação cruzada (útil):** as fórmulas de IG de Hadlock 1984 usadas em
`formulas.ts` (`gaFromBpd` = 9,54 + 1,482·b + 0,1676·b²; `gaFromHc` = 8,96 +
0,540·h + 0,0003·h³) foram **reconfirmadas por fonte independente**
([perinatology.com](https://perinatology.com/calculators/Estimation%20of%20Fetal%20Weight%20and%20Age.htm)),
assim como a Hadlock IV do PFE já em uso.

---

## Status: EM PRODUÇÃO (`validated: true` nas três curvas)

As três curvas — **Hadlock**, **INTERGROWTH-21st** e **OMS** — estão validadas e
em produção. `DEFAULT_BIOMETRY_REFERENCE` resolve para a primeira validada da
ordem de preferência (`['hadlock', 'intergrowth', 'who']`) → **Hadlock é o padrão
do sistema**, conforme pedido do usuário.

Decisões formalizadas:

1. **Equação vs. tabela em Hadlock 1991:** implementada a **EQUAÇÃO**. A tabela
   impressa no artigo diverge dela e **subdiagnostica RCIU em 5,1%** dos casos
   (AJOG 2025, PMID 40157521).
2. **Biometrias:** Hadlock pela tabela de 1984; INTERGROWTH por Papageorghiou 2014;
   OMS mantida como rede de segurança para dimensões/janelas não cobertas.

### Auditoria automática (`src/test/hadlockBiometry.test.ts`)

Comparativos que rodam a cada `vitest`:

- **Integridade da tabela:** 57 pontos/dimensão, passo de 0,5, 12→40 sem, DP por
  parâmetro, monotonicidade, âncoras clínicas contra a literatura.
- **Concordância entre curvas:** medianas de Hadlock × INTERGROWTH divergem < 10%
  (biometria) e < 15% (PFE) — discrepância maior denunciaria erro de unidade ou
  transcrição.
- **Faixa central:** a mediana de uma curva cai entre p5 e p95 da outra.
- **Divergência do fêmur:** documentada explicitamente como achado real.
- **Sanidade:** percentil monotônico, sempre em 0–100, e feto claramente pequeno
  (−2 DP) classificado < p25 pelas três curvas.
- **PFE por sexo:** dimensão sexada resolve na curva neutra do padrão escolhido.

### Rótulos e o que chega à IA

`HIDDEN_METRIC_KEYS` (`constants/fieldLabels.ts`) impede que enums crus vazem para
a grade de métricas **e para o prompt da IA** — as duas saem do mesmo filtro.
Ocultos: `reference`, `efwFormula`, `bioParam`, `referenceValidated`, `fellBack`,
`sourceLabel`. **Visível de propósito:** `referenceLabel` ("Curva de referência"),
porque o laudo precisa registrar qual curva produziu o percentil. O rótulo de
`percentile` é genérico ("Percentil (%)") — nunca cita uma curva, já que ela é
selecionável. Travado em `src/test/calculatorMetricLabels.test.ts`.
