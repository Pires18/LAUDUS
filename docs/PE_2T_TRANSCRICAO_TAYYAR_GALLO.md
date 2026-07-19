# Transcrição & Validação — PE de 2º Trimestre (Tayyar 2015 / Gallo 2016)

Checklist para destravar `src/modules/calculators/fmf/preeclampsia2t.ts`
(hoje `SECOND_TRIMESTER_PE_VALIDATED = false`, coeficientes placeholder `NaN`/`null`).

> **Regra de ouro (igual ao 1º T):** transcrever **dígito-a-dígito** das tabelas
> primárias e validar **caso-a-caso** contra a calculadora OFICIAL da FMF
> (2ª visita) antes de ligar `validated: true`. Nada de valor aproximado ou
> "de memória" — é cálculo de risco clínico.

## Fontes primárias
- **Tayyar A, Guerra L, Wright A, Wright D, Nicolaides KH.** *Competing risks model in screening for preeclampsia by mean arterial pressure and uterine artery pulsatility index at 19–24 weeks' gestation.* Ultrasound Obstet Gynecol. 2015;45:689–697.
- **Gallo DM, Wright D, Casanova C, Campanero M, Nicolaides KH.** *Competing risks model in screening for preeclampsia by maternal factors and biomarkers at 19–24 weeks' gestation.* Am J Obstet Gynecol. 2016;214:619.e1–619.e17. (acrescenta **PlGF**)
- **Prior materno:** Wright D et al., AJOG 2015;213:62 — **já implementado** e reusado como está (`PE_COEFFICIENTS_2T` faz spread de `PROVISIONAL_PE_COEFFICIENTS`). Confirmar apenas que a FMF usa o MESMO prior na 2ª visita (esperado no arcabouço de competing-risks).

## O que preencher (mapa símbolo → fonte)

### 1. Modelo de biomarcadores — `PE_BIOMARKER_MODEL_2T` (Gallo 2016) ✅ CONCLUÍDO
Transcrito das Supplemental Tables 2 (regressão) e 3 (SD/correlações "Pooled") do Gallo 2016 e verificado. **Atenção à centragem:** a Tabela 2 centra a IG de parto em **24 sem**; o motor usa forma não-centrada, então o intercepto armazenado é `a_unc = a₂₄ − 24·slope` (conversão documentada no módulo e travada por teste). Marcadores: MAP, IP uterino, PlGF (sFlt-1 e PAPP-A ficam fora — o mask não os coleta / é de 1º T).

### 2. Medianas (MoM) a 19–24 sem — `mapMedian2T` / `utaPiMedian2T` / `plgfMedian2T` ✅ CONCLUÍDO
Transcritas do ramo do **2º trimestre** das Tabelas 2 dos modelos "nos três trimestres":
- IP uterino → **Tayyar A et al., UOG 2015;45:689-97** (Tabela 2)
- MAP → **Wright A et al., UOG 2015;45:698-706** (Tabela 2)
- PlGF → **Tsiakkas A et al., UOG 2015;45:591-8** (Tabela 2; DELFIA ref, Roche/Cobas +0,1864; Kryptor não modelado → null)

Regra de combinação: `log10-mediana = intercepto + termos do 2º trimestre + termos independentes de trimestre`, centragem GA(dias)−77 / peso−69 / altura−164 / idade−35. Conferido por sanity-check da gestante de referência a 21 sem: **UtA-PI 1,051 · MAP 85,5 mmHg · PlGF 163,9 (DELFIA) / 251,8 (Cobas)**. Termos que exigem dados não coletados (Z-score de peso ao nascer, IG do parto anterior, intervalo interpartal fracionário) omitidos — mesma fidelidade do 1º T.
Regressão log10-mediana em função das covariáveis maternas (peso, altura, idade, etnia, tabagismo, HAC, DM, FIV, paridade), **centrada no 2º T** (usar `G0_DAYS_2T = 147` ≈ 21 sem como âncora do termo gestacional — confirmar o centro exato usado nas tabelas).
- MAP e IP uterino: equações de 2ª visita (Tayyar 2015).
- PlGF: por analisador (Cobas/Delfia/Kryptor) — confirmar se Gallo 2016 fornece interceptos por analisador ou se herdam do protocolo Tan.

### 3. Ativação
1. Preencher itens 1 e 2 (dígito-a-dígito).
2. Rodar os **casos-ouro** (abaixo) e conferir contra a calc OFICIAL FMF (2ª visita).
3. `SECOND_TRIMESTER_PE_VALIDATED = true`; `PE_COEFFICIENTS_2T.validated = true`.
4. Ligar `peRisk2tFromForm` ao `liveCompute` (seção Doppler do morfológico 2T) e/ou registrar no `registry` — espelhar a trava de janela (19–24+6 sem), análoga à trava de 1º T já existente.

## Casos-ouro de validação (rodar na calc OFICIAL FMF — 2ª visita)
Inputs concretos abaixo. Rodar cada um na calculadora oficial (analisador **Roche Cobas**, IG na semana indicada) e comparar o "1 em N" de PE pré-termo (<37 sem). Alvo: fechar dentro de ~5%. A coluna "nosso módulo" é a saída do pipeline atual.

| # | Idade | Peso | Alt. | IG | Etnia | Paridade | HAC | Hist. fam. PE | MAP | IP UtA (méd.) | PlGF | → MoM (MAP/UtA/PlGF) | PE pré-termo — nosso módulo | Oficial FMF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 · referência | 35 | 69 | 164 | 21+0 | branca | nulípara | não | não | 85,5 | 1,05 | 251,8 | 1,00 / 1,00 / 1,00 | basal 1:171 → **1:754** | _(preencher)_ |
| 2 · alto risco | 40 | 88 | 160 | 22+0 | afro-caribenha | PE prévia 30 sem | sim | sim | 102 | 1,70 | 90 | 1,03 / 1,58 / 0,20 | basal 1:2 → **1:1** (AAS) | _(preencher)_ |
| 3 · baixo risco | 27 | 62 | 168 | 20+0 | branca | nulípara | não | não | 78 | 0,75 | 400 | 0,93 / 0,69 / 1,85 | basal 1:208 → **1:15141** | _(preencher)_ |

Observações: (a) o prior materno é o mesmo do 1º T (Wright 2015); (b) no 2º T, MoM=1,0 dos biomarcadores empurra o risco para baixo — esperado; (c) AAS mais eficaz <16 sem — no 2º T, positivo orienta mais **vigilância** que início de AAS.

## ⛔ RESULTADO DA VALIDAÇÃO (19/Jul/2026) — FALHOU · módulo mantido travado
Rodados na calc OFICIAL da FMF (2ª visita, Roche). A oficial reporta a **<28 / <32 / <36 sem** e usou **MAP + artéria OFTÁLMICA (razão) + PlGF** (não a uterina). Recalculei o nosso modelo nos mesmos limiares:

| Caso | Endpoint | Oficial FMF | Nosso (MAP+UtA+PlGF) | Nosso (MAP+PlGF só) |
|---|---|---|---|---|
| 1 · referência | <28 / <32 / <36 | <1:10000 / <1:10000 / **1:1400** | <1:10000 / <1:10000 / **1:2031** | … / … / 1:1097 |
| 2 · alto risco | <28 / <32 / <36 | **1:104** / 1:5 / 1:2 | **1:9** / 1:1 / 1:1 | 1:7 / 1:1 / 1:1 |
| 3 · baixo risco | <28 / <32 / <36 | <1:10000 / <1:10000 / **1:5800** | <1:10000 / <1:10000 / **<1:10000** | … / … / <1:10000 |

MoM (nosso × oficial): UtA-PI 1,00/1,58/0,69 × **1,04/1,63/0,74**; PlGF 1,00/0,20/1,85 × **0,94/0,21/1,46** — próximos (calibração ~4–6%; caso 3 PlGF diverge mais).

**Veredito:** referência/baixo risco ficam próximos; o **alto risco DIVERGE muito no início** (<28 sem: oficial 1:104 × nosso ~1:9 — superestimamos PE precoce). Remover a UtA-PI (deixar só MAP+PlGF) **não corrige** → a diferença é de **VERSÃO de modelo**: a calc oficial vigente usa a **artéria oftálmica** e limiares **<28/32/36**, um modelo **mais novo** que o Gallo 2016. A transcrição está fiel ao paper, mas **não reproduz a oficial**. **NÃO ativar** (`SECOND_TRIMESTER_PE_VALIDATED` permanece `false`). Para bater com a oficial: obter o modelo atual da FMF de 2ª visita (competing-risks com artéria oftálmica + limiares <28/32/36) — publicação mais recente, não fornecida.

## Estado atual
- Motor (`computePreeclampsiaRisk`) e prior (Wright 2015) — **prontos e reusados**.
- Estrutura do módulo, entrada de formulário, janela de IG e trava de segurança — **prontos**.
- Falta **apenas** transcrever os números dos itens 1 e 2 e validar. `tsc --noEmit` já passa.
