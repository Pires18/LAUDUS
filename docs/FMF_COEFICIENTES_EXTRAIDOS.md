# Coeficientes FMF extraídos dos papers (jul/2026)

Fontes fornecidas pelo usuário: Kagan 2008 uog.5331, uog.5332, uog.6123;
Kagan Hum Reprod 2008 (T13); Wright 2008 uog.5299 (mistura TN); Tan 2018
Appendix S1 (uog.19112); Wright 2015 AJOG 213:62 (fatores maternos PE);
O'Gorman 2016 AJOG 214:103 (biomarcadores PE). Todos em **log10**.

## ✅ Status da validação interna (jul/2026)

Todo o código (`fmf/trisomy.ts`, `fmf/trisomyData.ts`, `fmf/preeclampsia.ts`,
`fmf/preeclampsiaData.ts`) foi **auditado dígito a dígito** contra os textos
extraídos destes 8 papers — **zero divergências de transcrição encontradas**.

Além da auditoria, `src/test/fmfTrisomy.test.ts` reproduz como testes
automatizados os **fatos numéricos declarados explicitamente** nos
abstracts/textos dos papers (não são "casos" individuais, mas resumos
estatísticos publicados da população estudada):
- Mediana da TN (componente CRL-independente): euploide 2,0mm / T21 3,4mm /
  T18 5,5mm / T13 4,0mm — Wright 2008, abstract.
- Mediana de MoM bioquímico: T21 β-hCG 2,0 / PAPP-A 0,5 — Kagan uog.5331;
  T18 β-hCG 0,2 / PAPP-A 0,2 — Kagan uog.6123.

Todos batem dentro de tolerância clínica a partir dos coeficientes de
tabela armazenados — confirma que a lógica do modelo (mistura da TN,
bivariada da bioquímica, LRs de marcadores, Bayes de riscos competitivos da
PE com truncamento e covariância comum) está implementada corretamente.

**O que isso NÃO substitui:** comparação caso-a-caso contra a calculadora
oficial da FMF (bloqueada nesta sessão por indisponibilidade da extensão do
navegador). `validated: false` permanece como gate de **uso clínico**, não
de correção de transcrição — que está verificada.

## 4. Correção de IG do risco a priori (Nicolaides 2011, citando Snijders 1999)
Fonte: Nicolaides KH, "Screening for fetal aneuploidies at 11 to 13 weeks",
Prenat Diagn 2011;31:7-15. Citação: "the rate of fetal death between 12 weeks
and term is about 30% for trisomy 21. The rate of fetal death in euploid
fetuses is only 1 to 2%." Exemplo verificado: mulher de 20 anos tem risco
≈1:1000 às 12 semanas vs ≈1:1500 ao termo.

Fator derivado: `(1 − 0.015) / (1 − 0.30) ≈ 1.407`, aplicado ao risco de T21
ao termo para obter o risco basal (a priori) da janela de rastreamento.
Verificado contra o exemplo citado: nossa tabela dá 1/1450 ao termo para
20 anos; ×1,407 = 1/1031 ≈ "1:1000" declarado. **IMPLEMENTADO** em
`ageRelatedRisk()` (`trisomyData.ts`).

⚠️ Fator fixo em ~12 semanas (não varia semana a semana dentro de 11–13+6
por falta de curva granular em fonte aberta); aplicado só ao T21 (T18/T13
herdam o mesmo fator, mas sua perda fetal real é conhecidamente maior).

**Lacunas conhecidas, deixadas em aberto por não termos fonte primária exata**
(não inventamos números para fechá-las):
- T18/T13: fator de correção de IG específico (herdam o do T21, tendendo a
  subestimar levemente essas duas).
- Sub-modelo "parosa sem PE prévia" da pré-eclâmpsia (polinômio de intervalo).
- LRs de marcadores ecográficos "cruas" (prevalência/prevalência) em vez das
  ajustadas por correlação com a TN que o FMF usa internamente.

---

## 1. TN — modelo de mistura (Wright 2008, Tabela 2)
NT em mm; x = log10(NT). CRL em mm.

**Componente CRL-dependente** (euploide majoritário; minoria das aneuploidias):
- μ0(CRL) = −0.8951 + 0.02940·CRL − 0.0001812·CRL²
- σ0 = 0.07900

**Componente CRL-independente — NORMAL (euploide):**
- proporção p = 1/(1+exp(−(α0 + α1·CRL))), α0 = −0.3319, α1 = −0.03790
- μ1 = 0.3019, σ1 = 0.1945

**Componente CRL-independente por aneuploidia:**
| | proporção p | μ | σ |
|---|---|---|---|
| T21 | 0.9406 | 0.5330 | 0.2093 |
| T18 | 0.7096 | 0.7439 | 0.1658 |
| T13 | 0.8376 | 0.6018 | 0.2032 |
| Turner | 0.8090 | 0.9629 | 0.1316 |

LR_t(NT,CRL) = f_t(x)/f_norm(x), com
f_norm = (1−p)·N(x;μ0,σ0) + p·N(x;μ1,σ1)  [p = logística acima]
f_t    = (1−p_t)·N(x;μ0,σ0) + p_t·N(x;μ_t,σ_t)

---

## 2. Bioquímica T21 — Gaussiana bivariada (Kagan uog.5332, Tab.3 + regressões)
log10(MoM); gestação em dias.

**Médias (T21), dependentes da IG:**
- β-hCG: 0.2468 + 0.004267·(gest − 77)
- PAPP-A: −0.4668 + 0.01642·(gest − 77)
- Não-afetada: média 0 (ambos).

**SD e correlação (Tabela 3):**
| | SD PAPP-A | SD β-hCG | correlação |
|---|---|---|---|
| Não-afetada | 0.2203 | 0.2544 | 0.2143 |
| T21 | 0.2359 | 0.2699 | 0.0821 |

LR = f_T21(x,y)/f_norm(x,y), bivariada normal em (log10 MoM β-hCG, log10 MoM PAPP-A).

**Medianas para MoM (Kryptor; não-fumante, parosa, caucasiana, espontânea):**
- log10 mediana β-hCG = 1.64931 − 0.0057856·(g−77) − 0.00023901·(g−77)² − 0.0045501·(w−69) + 0.000028909·(w−69)²
- log10 mediana PAPP-A = 0.18992 + 0.026102·(g−77) − 0.0074642·(w−69) + 0.000030669·(w−69)²
  (g=gestação dias, w=peso kg)

**Ajustes de covariável (Tabela 2, log10):**
- PAPP-A: Afro +0.195, S.Asiática +0.012, Mista +0.036, L.Asiática +0.039, Fumante −0.082, FIV −0.047, Nulípara +0.009, (Delfia Express −0.123)
- β-hCG: Afro +0.049, S.Asiática −0.043, Mista −0.025, L.Asiática ~+0.033, Fumante ~−0.018, FIV ~+0.037, Nulípara ~+0.009

> T18/T13 bioquímica: NÃO neste paper (ver Kagan uog.6123 p/ T18).

---

## 3. Pré-eclâmpsia — medianas dos biomarcadores (Tan 2018 Appendix S1)
log10(mediana). MoM = medido / 10^(log10 mediana). Referência = caucasiana,
não-fumante, nulípara, sem comorbidade, espontânea. g=IG dias, w=peso, h=altura, a=idade.

### 3.1 MAP (mmHg) — intercepto 1.936400
+0.000428017·(g−77) −0.000028811·(g−77)² +0.001205300·(w−69) −0.000009280·(w−69)²
−0.000181570·(h−164) −0.003930·Afro −0.008640·Fumante +0.053630·HAScrônica
−0.000239750·HAScrônica·(w−69) +0.004370·DM1 +0.004370·DM2ins +0.004370·DM2noins
+0.006240·HistFamPE −0.006630·ParosaSemPE +0.000826390·ParosaSemPE·(interv−2)
+0.008570·ParosaComPE

### 3.2 UtA-PI — intercepto 0.264570
−0.004838365·(g−77) −0.000874430·(w−69) +0.000007330·(w−69)² −0.000641750·(a−35)
+0.021620·Afro +0.007630·L.Asiática +0.011990·Mista −0.027490·DM1
−0.002950·ParosaSemPE +0.009650·ParosaComPE

### 3.3 PlGF — intercepto por analisador: DELFIA 1.332959, **Cobas e411 1.542536**, KRYPTOR 1.430615
+0.012263018·(g−77) +0.000149743·(g−77)² −0.001682761·(w−69) +0.000008780·(w−69)²
+0.002174191·(a−35) +0.193561·Afro +0.072679·S.Asiática +0.034550·L.Asiática +0.079011·Mista
+0.160836·Fumante −0.029631·DM1 −0.039984·DM2ins −0.022251·FIV +0.020750·ParosaSemPE

### 3.4 PAPP-A (PE) — intercepto: DELFIA 0.075861, **Cobas e411 0.221220**, KRYPTOR 0.194960
+0.0284402·(g−77) −0.000232421·(g−77)² +0.000012437·(g−77)³ −0.0073078·(w−69) +0.0000292·(w−69)²
+0.1633·Afro +0.003206·Afro·(g−77) +0.019868·S.Asiática +0.0187·L.Asiática
−0.07827·Fumante −0.001495·Fumante·(g−77) −0.00958·DM1 −0.09492·DM2ins −0.05282·DM2noins
−0.0943·FIV +0.002755·FIV·(g−77) −0.05658·ParosaComPE −0.02402·ParosaSemPE

### 3.5 Distribuição dos biomarcadores (Bayes) — O'Gorman 2016 (AJOG 214:103) — EXATO
Média log10(MoM) em PE = intercepto + inclinação × (IG do parto, semanas), truncada em 0 (Tab.2):
| Marcador | intercepto | inclinação |
|---|---|---|
| UtA-PI | 0.54453 | −0.013143 |
| MAP | 0.095640 | −0.0018240 |
| PAPP-A | −0.62165 | 0.014692 |
| PlGF | −0.93687 | 0.021930 |

SD do log10 MoM (pooled, Tab.3): UtA-PI 0.12894 · MAP 0.03724 · PAPP-A 0.23539 · PlGF 0.17723
Correlações (pooled): UtA×MAP −0.05133 · UtA×PAPP −0.15992 · UtA×PlGF −0.15084 · MAP×PAPP −0.00497 · MAP×PlGF −0.02791 · PAPP×PlGF 0.31983
σ da prior (Wright 2015) = 6.8833. Não-afetada: média 0.

> IMPLEMENTADO no motor (`preeclampsia.ts` v2, Bayes por integração numérica).

---

## 4. Ainda pendente
- T18/T13 bioquímica (Kagan uog.6123).
- LRs de marcadores (osso nasal, DV, TR).
- Correção de IG do risco a priori por idade (Snijders 1999).
- Distribuição de biomarcadores da PE (Bayes competing-risks).
- Casos-ouro (Parte G do intake) para validação numérica final.
