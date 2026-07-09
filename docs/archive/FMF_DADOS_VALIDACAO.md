> ⚠️ **ARQUIVADO — checklist majoritariamente concluído.** As Partes A, B, C, D, E
> foram transcritas e auditadas dígito-a-dígito contra o código em
> [`docs/FMF_COEFICIENTES_EXTRAIDOS.md`](../FMF_COEFICIENTES_EXTRAIDOS.md), que é a
> referência atual dos coeficientes. Só a **Parte G (casos-ouro)** segue aberta —
> ver [`docs/BACKLOG.md`](../BACKLOG.md). Mantido aqui como registro do processo de
> coleta original.

# Dados necessários para validar as calculadoras FMF (1º trimestre)

> Objetivo: sair de `validated: false` (EM VALIDAÇÃO) para uso clínico.
> Você preenche as colunas **[PREENCHER]**; eu transcrevo para os arquivos
> `src/modules/calculators/fmf/*Data.ts` e travo com casos-ouro nos testes.
> Nada aqui muda o motor ou a interface — só os coeficientes.

Distinção importante antes de começar:
- **MoM já funciona para a bioquímica**: β-hCG, PAPP-A e PlGF são digitados
  **em MoM direto do laudo laboratorial** (o software do laboratório já calcula).
  Então NÃO precisamos das medianas do Cobas para funcionar — só se você quiser
  que o app calcule o MoM a partir do valor bruto (opcional, Parte D).
- **O que de fato falta são os PARÂMETROS DE DISTRIBUIÇÃO** (dos papers) e os
  **CASOS-OURO** de validação. É isso que torna o risco correto.

---

## PARTE A — Trissomias: distribuições log10(MoM)  🔴 CRÍTICO
Fonte: Kagan KO et al., UOG 2008 (doi 10.1002/uog.5331 e 10.1002/uog.6123).
Preencha média e desvio-padrão (DP) do **log10 do MoM** em cada grupo.
(Já preenchi o que consegui em fontes abertas.)

| Grupo         | β-hCG média | β-hCG DP | PAPP-A média | PAPP-A DP | ρ (corr.) |
|---------------|-------------|----------|--------------|-----------|-----------|
| Não-afetada   | 0,000       | 0,2605   | 0,000        | 0,2336    | **[PREENCHER]** |
| Trissomia 21  | 0,301       | **[PREENCHER]** | −0,301 | **[PREENCHER]** | **[PREENCHER]** |
| Trissomia 18  | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** |
| Trissomia 13  | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** |

> Nota: alguns papers dão a mediana do MoM (ex.: T21 β-hCG 2,0 MoM → média log10 = 0,301).
> Média log10 = log10(mediana do MoM). O DP costuma vir como (p90−p10)/2,563.

## PARTE B — Trissomias: Translucência Nucal (modelo de mistura)  🔴 CRÍTICO
Fonte: Wright/Nicolaides (mixture model) + curva de mediana da TN por CCN.

1) **Curva de mediana da TN (mm) por CCN (mm)** — para calcular o MoM da TN:
   equação `mediana = a + b·CCN` (ou tabela CCN→mediana).
   a = **[PREENCHER]**  b = **[PREENCHER]**   (hoje uso provisório a=1,024 b=0,0128)

2) **Parâmetros da mistura** (por trissomia): proporção que segue a distribuição
   não-afetada vs. a de "TN aumentada", e média/DP de cada componente.

| Trissomia | proporção "não muda" | média TN aument. (mm) | DP (mm) |
|-----------|----------------------|-----------------------|---------|
| T21       | ~0,05 (5%)           | 3,4                   | 1,6     | ← Kagan (conferir)
| T18       | **[PREENCHER]**      | **[PREENCHER]**       | **[PREENCHER]** |
| T13       | **[PREENCHER]**      | **[PREENCHER]**       | **[PREENCHER]** |

## PARTE C — Trissomias: LRs dos marcadores ecográficos  🟠 IMPORTANTE
Fonte: LRs **ajustadas** da FMF (Kagan/Nicolaides). "Alterado" = ausente (osso
nasal) / onda-a reversa (DV) / regurgitação presente (tricúspide).

| Marcador            | LR alterado (T21) | LR normal (T21) | T18 alt/norm | T13 alt/norm |
|---------------------|-------------------|-----------------|--------------|--------------|
| Osso nasal          | **[PREENCHER]**   | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** |
| Ducto venoso        | **[PREENCHER]**   | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** |
| Regurgitação tric.  | **[PREENCHER]**   | **[PREENCHER]** | **[PREENCHER]** | **[PREENCHER]** |

## PARTE D — Trissomias: risco a priori por idade  🟠 IMPORTANTE
Fonte: Snijders & Nicolaides 1999.

1) **Tabela de risco por idade (ao termo)** para T21 (idade → 1:N). Confirmar
   os valores da tabela que já uso (20→1450 … 45→25).
2) **Fatores de correção de IG** (risco no 1º trimestre é maior que ao termo)
   para T21, T18, T13 — ou a tabela de risco por idade+IG.
3) **Risco por idade de T18 e T13** (ou razões em relação ao T21).

---

## PARTE E — Pré-eclâmpsia: biomarcadores  🔴 CRÍTICO
Fatores maternos já estão prontos (Wright 2015). Falta o modelo de biomarcadores.
Fonte: Tan MY et al., UOG 2018 (doi 10.1002/uog.19112); Wright.

Para **MAP, IP uterinas e PlGF** (log10 do MoM):

| Biomarcador | DP não-afetada | média afetada = f(IG parto) | corr. entre marcadores |
|-------------|----------------|-----------------------------|------------------------|
| MAP         | 0,035          | **[PREENCHER: coef. da regressão]** | **[PREENCHER]** |
| IP uterinas | 0,12           | **[PREENCHER]**             | **[PREENCHER]** |
| PlGF        | **[PREENCHER]**| **[PREENCHER]**             | **[PREENCHER]** |

> "média afetada = f(IG parto)" é a regressão que dá a média do log10(MoM) do
> marcador em função da idade gestacional do parto com PE (ex.: `mean = a + b·GA`).
> Precisamos dos coeficientes a e b de cada marcador, e a matriz de correlação.

## PARTE F — (Opcional) Medianas Roche Cobas para MoM automático da bioquímica
Só se quiser que o app calcule o MoM a partir do valor bruto (senão, digita-se
o MoM do laudo). Peça ao seu laboratório:
- Equação/tabela de **mediana por idade gestacional** de β-hCG, PAPP-A e PlGF,
  **nas unidades do analisador**, e os **fatores de correção** por peso materno,
  etnia, tabagismo, FIV e diabetes.

---

## PARTE G — Casos-ouro para validação  🔴 CRÍTICO (obrigatório antes de liberar)
5–10 casos reais/simulados com **todas as entradas** e o **risco que a
calculadora FMF oficial (ou o laudo do laboratório) devolveu**. Assim calibramos
com tolerância (ex.: risco dentro de ±5%).

### Trissomias — rode estes casos na calculadora FMF e preencha o resultado
| # | Idade | CCN(mm) | TN(mm) | β-hCG MoM | PAPP-A MoM | Osso nasal | DV | Tric. | **Risco T21 (1:N)** |
|---|-------|---------|--------|-----------|------------|-----------|----|-------|---------------------|
| 1 | 25    | 65      | 1.5    | 1.0       | 1.0        | normal    | —  | —     | **[da calc]**       |
| 2 | 40    | 65      | 1.8    | 1.0       | 1.0        | —         | —  | —     | **[da calc]**       |
| 3 | 35    | 65      | 3.5    | 2.2       | 0.4        | ausente   | —  | —     | **[da calc]**       |
| 4 | 38    | 60      | 2.2    | 1.5       | 0.7        | normal    | —  | —     | **[da calc]**       |
| 5 | 30    | 70      | 2.0    | 0.8       | 1.2        | —         | —  | —     | **[da calc]**       |
| _ | (adicione livres) | | | | | | | | |

### Pré-eclâmpsia — rode estes casos e preencha o resultado
| # | Idade | Peso | Altura | IG | Etnia | Paridade | Comorbid. | MAP MoM | UtA-PI MoM | PlGF MoM | **Risco PE pré-termo (1:N)** |
|---|-------|------|--------|----|-------|----------|-----------|---------|-----------|----------|------------------------------|
| 1 | 30 | 65 | 165 | 12+3 | branca | nulípara | nenhuma | — | — | — | **[da calc]** |
| 2 | 40 | 90 | 160 | 12+3 | afro-carib. | parosa c/ PE | HAS crônica | 1.15 | 1.6 | 0.5 | **[da calc]** |
| 3 | 35 | 78 | 163 | 12+0 | branca | nulípara | nenhuma | 1.1 | 1.3 | 0.8 | **[da calc]** |
| 4 | 28 | 60 | 170 | 13+0 | branca | parosa s/ PE | nenhuma | 0.95 | 0.9 | 1.2 | **[da calc]** |
| 5 | 33 | 85 | 158 | 12+4 | sul-asiática | nulípara | diabetes | 1.05 | 1.1 | 0.9 | **[da calc]** |
| _ | (adicione livres) | | | | | | | | | | |

---

---

## ATUALIZAÇÃO (após ler Kagan 2008 uog.5331 e Tan 2018)
Os dois PDFs confirmam a estrutura, mas **não trazem os coeficientes numéricos
de distribuição**. Onde eles realmente estão:
- **TN (mistura) — SD/proporções exatas:** Wright D et al., "A mixture model of
  nuchal translucency thickness", UOG 2008; 31:376-383.
- **β-hCG/PAPP-A (médias/SD/correlação, regressão por IG):** Kagan KO et al.,
  UOG 2008; 31:**493-502** (uog.**5332**) — é o paper irmão, NÃO o uog.5331.
- **PE — equações de mediana dos biomarcadores:** Tan 2018, **Appendix S1 online**
  (supporting information no site da revista).
- **PE — distribuição afetada/não-afetada (Bayes):** papers de metodologia de
  riscos competitivos do Wright (referências 8,10,11 do Tan).

### ⭐ Caminho mais rápido (recomendado): GOLDEN CASES
A **calculadora oficial da FMF é gratuita** em https://fetalmedicine.org.
Rode ~8–10 casos lá (trissomias e PE) e me envie entradas + risco retornado.
Com isso eu VALIDO e AJUSTO nossos coeficientes para bater na tolerância —
sem precisar transcrever as tabelas dos suplementos. Preencha a Parte G.

---

## Prioridade (se quiser mandar por partes)
1. **Partes A + E** (distribuições) — é o que mais muda a exatidão do risco.
2. **Parte G** (casos-ouro) — sem isso não viramos `validated: true`.
3. **Partes B, C, D** — refinam trissomias.
4. **Parte F** — opcional (conveniência).

Pode mandar como imagem/PDF das tabelas dos papers, planilha, ou preenchendo
este arquivo — eu transcrevo e valido.
