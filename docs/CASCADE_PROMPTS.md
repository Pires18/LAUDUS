# LAUD.IA — Documentação Oficial da Cascata de Prompts
**Versão:** V1.0 | **Sistema:** LAUDUS | **Módulo:** LAUD.IA

> Este documento é a **referência canônica** de toda a cascata de prompts do motor cognitivo LAUD.IA.
> Antes de qualquer ajuste em prompt, leia a seção correspondente aqui.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Camada 1 — Sistema Universal](#2-camada-1--sistema-universal)
   - [Bloco 1 — Prompt Mestre (Doutrina)](#bloco-1--prompt-mestre-doutrina)
   - [Bloco 2 — Instruções Globais (Raciocínio)](#bloco-2--instruções-globais-raciocínio)
   - [Bloco 3 — Skeleton / Arquitetura HTML](#bloco-3--skeleton--arquitetura-html)
   - [Bloco 4 — Regras Rígidas (Compliance)](#bloco-4--regras-rígidas-compliance)
   - [Bloco 5 — Refinamento & Copiloto](#bloco-5--refinamento--copiloto)
3. [Camada 2 — Diretriz da Área](#3-camada-2--diretriz-da-área)
4. [Camada 3 — Instruções Específicas do Exame](#4-camada-3--instruções-específicas-do-exame)
5. [Ordem de Montagem do Prompt Final](#5-ordem-de-montagem-do-prompt-final)
6. [Guia de Ajuste Seguro](#6-guia-de-ajuste-seguro)
7. [Glossário de Leis e Regras](#7-glossário-de-leis-e-regras)

---

## 1. Visão Geral da Arquitetura

O motor cognitivo LAUD.IA opera com uma **cascata de 3 camadas sobrepostas**, onde cada camada mais interna refina e especializa as instruções da camada anterior:

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — SISTEMA UNIVERSAL                                   │
│  Aplicada em TODOS os exames, independente de área ou tipo      │
│                                                                  │
│  ┌─── Bloco 1: Prompt Mestre / Doutrina ─────────────────────┐  │
│  │  Persona + Leis Absolutas + Padrão Numérico               │  │
│  ├─── Bloco 2: Instruções Globais / Raciocínio ─────────────┤  │
│  │  7 Fases de Raciocínio Clínico + tag <scratchpad>         │  │
│  ├─── Bloco 3: Skeleton / Arquitetura HTML ─────────────────┤  │
│  │  Tags permitidas + Ordem das seções + Proibição Markdown  │  │
│  └─── Bloco 4: Regras Rígidas / Compliance & Segurança ─────┘  │
│       Anti-invenção + Anti-histologia + Red-flags + OBSERVAÇÕES  │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 2 — DIRETRIZ DA ÁREA / ESPECIALIDADE                    │
│  Aplicada em todos os exames DE UMA MESMA ÁREA                  │
│                                                                  │
│  Ex: Medicina Fetal → biometria fetal, Doppler obstétrico       │
│  Ex: Vascular → protocolo de velocidades, índices Doppler       │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 3 — INSTRUÇÕES ESPECÍFICAS DO EXAME                     │
│  Aplicada APENAS a este exame específico                        │
│                                                                  │
│  • aiInstructions: regras, classificações e recomendações       │
│  • Máscara HTML: estrutura de referência (h1/TÉCNICA/ANÁLISE…)  │
│  • Dados do Paciente: nome, idade, sexo, indicação, anamnese    │
│  • Notas do Médico / Instrução de Alteração (copiloto/refine)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
            ┌───────────────────────────────┐
            │  BLOCO 5 — OVERRIDE DE MODO   │
            │  Ativo APENAS em Refine /     │
            │  Copiloto (não na Geração)    │
            └───────────────────────────────┘
```

### Prioridade de Override

Quando há conflito entre camadas, a **camada mais interna vence**:

```
Regras Rígidas (Bloco 4) > Tudo
Instruções do Exame > Diretriz de Área > Sistema Universal
```

**Exceção absoluta:** As Regras Rígidas (Bloco 4) **NUNCA** são overridadas — elas são leis de segurança médica e legal.

---

## 2. Camada 1 — Sistema Universal

Esta camada é montada pela função `buildUniversalContext()` em `engine.ts` e enviada como **system prompt** para a IA em todas as chamadas.

### Bloco 1 — Prompt Mestre (Doutrina)

**Localização no código:** `src/modules/ai/prompts/general.ts` → `DEFAULT_MASTER_PROMPT`
**Configuração do usuário:** `AppSettings.aiMasterPrompt`

#### O que é
Define a **identidade e os princípios fundamentais** do motor LAUD.IA. É a "constituição" do sistema — toda outra instrução deve ser consistente com este bloco.

#### O que DEVE estar presente (checklist obrigatório)

- [ ] **Persona:** "Médico radiologista/ultrassonografista sênior, consultor técnico formal"
- [ ] **Lei da Não-Invenção** — proibição explícita de inventar medidas, volumes, pesos, BCF, DUM, etc.
- [ ] **Permissão de autocálculo** — volumes derivados (elipsoide), peso prostático, IP médio, RCP
- [ ] **Cascata Tripartite** — ANÁLISE → CONCLUSÃO → RECOMENDAÇÕES (lei fundamental)
- [ ] **Lei da Conclusão Enxuta** — sem repetir estruturas normais na conclusão
- [ ] **Idioma e padrão numérico** — pt-BR, vírgula decimal, espaço antes da unidade

#### O que NÃO pode ser removido

> ⚠️ **NUNCA remova:**
> - "NÃO INVENÇÃO (LEI ABSOLUTA)" — remoção causa alucinações numéricas graves
> - "CASCATA TRIPARTITE (LEI FUNDAMENTAL)" — remoção quebra a estrutura tripartite do laudo
> - Padrão numérico — remoção causa inconsistência de formatação numérica

#### O que pode ser ajustado

- Vocabulário da persona (mais formal, mais direto, etc.)
- Acréscimo de siglas de sociedades (ex: ISUOG, ACR, RSNA)
- Regras de formatação de unidades específicas da clínica
- Nível de detalhamento das permissões de autocálculo

#### Exemplo de ajuste seguro

```
# ANTES (genérico):
Você é o LAUD.IA — motor cognitivo do sistema LAUD.US.

# DEPOIS (personalizado):
Você é o LAUD.IA — motor cognitivo da Clínica Dr. João.
Siga os padrões da CBR (Colégio Brasileiro de Radiologia) e ISUOG.
```

---

### Bloco 2 — Instruções Globais (Raciocínio)

**Localização no código:** `src/modules/ai/prompts/general.ts` → `DEFAULT_GLOBAL_INSTRUCTIONS`
**Configuração do usuário:** `AppSettings.aiGlobalInstructions`

#### O que é
Define o **processo de raciocínio clínico** que a IA executa **antes** de gerar o laudo — as 7 Fases de análise estruturada que garantem laudos clínica e matematicamente corretos.

#### As 7 Fases (o que cada uma faz)

| Fase | Nome | O que faz |
|------|------|-----------|
| 1 | Ancoragem Clínica | Calibra a linguagem com base em IDADE × SEXO × INDICAÇÃO. Impede HPB em mulheres, artrose em crianças, etc. |
| 2 | Mapeamento do Exame | Identifica o tipo de exame, seleciona o módulo de área e distingue GERAÇÃO de REFINAMENTO |
| 3 | Normalidade Habitual | Aplica normalidade qualitativa padrão para estruturas sem dados patológicos informados |
| 4 | Autocálculos e Matemática | Executa volume elipsoide, peso prostático, IP médio, RCP, IG por DUM, DDP |
| 5 | Expansão Morfológica | Traduz jargões ("rin ok") para terminologia técnica completa |
| 6 | Cascata e Diplomacia | Classifica a conduta (N0→N4) e aplica linguagem consultiva vs. urgência |
| 7 | Self-Audit | Verifica: unidades órfãs? números inventados? hierarquia HTML correta? gatilhos R9? |

#### O que NÃO pode ser removido

> ⚠️ **NUNCA remova:**
> - **Fase 4 — Fórmula do Elipsoide** e a conversão de mm→cm — remoção causa erros de volume
> - **Fase 7 — Self-Audit** — é a última linha de defesa antes do output
> - **Tag `<scratchpad>`** — sem ela, o modelo "pensa em voz alta" diretamente no laudo

#### O que pode ser ajustado

- **Fase 3:** Adicionar variantes anatômicas específicas da sua prática (ex: rins em ferradura, útero didelfo)
- **Fase 4:** Adicionar fórmulas específicas (ex: cálculo de volume de cistos ovarianos, formula de Hadlock para peso fetal)
- **Fase 5:** Expandir o mapeamento de jargões da sua equipe
- **Fase 6:** Adicionar novos níveis de conduta (ex: "N1.5 — acompanhamento em 6 meses")

#### Fórmulas da Fase 4 (referência)

```
Volume Elipsoide:  V = D1 × D2 × D3 × 0,523
                   (se D em mm: divida o produto por 1000 para obter cm³)

Peso Prostático:   P = Volume × 1,05  (g)

IP Médio Uterino:  IP_m = (IP_dir + IP_esq) / 2

RCP:               RCP = IP_ACM / IP_umbilical

Idade Gestacional: IG = DATA_EXAME − DUM  (em semanas + dias)

DDP por DUM:       DDP = DUM + 280 dias
```

---

### Bloco 3 — Skeleton / Arquitetura HTML

**Localização no código:** `src/modules/ai/prompts/general.ts` → `DEFAULT_STRUCTURE_PROMPT`
**Configuração do usuário:** `AppSettings.aiStructurePrompt`

#### O que é
Define a **arquitetura física do laudo**: quais tags HTML são permitidas, a ordem obrigatória das seções, e como o output deve ser estruturado. É o "blueprint" do documento.

#### Tags HTML permitidas

```
<h1>, <h2>, <h3>, <p>, <strong>, <em>, <br>,
<ul>, <li>, <table>, <tr>, <td>, <th>, <tbody>, <thead>
```

> ⛔ Tags proibidas: `<div>`, `<span>`, `<section>`, `<article>`, qualquer tag personalizada

#### Ordem obrigatória das seções

```html
<h1>[TIPO DO EXAME EM CAIXA ALTA]</h1>
<h2>TÉCNICA</h2>
  <p>...</p>
<h2>ANÁLISE</h2>
  <p><strong>ÓRGÃO:</strong> descrição.</p>
<h2>CONCLUSÃO</h2>
  <p>• Achado 1.</p>
<h2>RECOMENDAÇÕES</h2>
  <p>• Conduta 1.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2>
  <p><em>Nota técnico-legal.</em></p>
```

#### O que NÃO pode ser removido

> ⚠️ **NUNCA remova:**
> - **Proibição de Markdown** (`**, __, ##, ```)
> - **Obrigatoriedade do `<scratchpad>` antes do HTML**
> - **Seção OBSERVAÇÕES METODOLÓGICAS** como obrigatória

#### O que pode ser ajustado

- Acréscimo de exemplos de outros tipos de exame na seção de exemplos
- Adição de seções opcionais (ex: `<h2>BIOMETRIA FETAL</h2>` para exames obstétricos)

---

### Bloco 4 — Regras Rígidas (Compliance & Segurança)

**Localização no código:** `src/modules/ai/prompts/general.ts` → `DEFAULT_RIGID_RULES`
**Configuração do usuário:** `AppSettings.aiRigidRules`

#### O que é
São as **leis de segurança médico-legal** do sistema. Anulam qualquer outra instrução, inclusive da camada de área ou de exame específico. São o mecanismo de proteção contra erros clínicos e legais graves.

#### Tabela de Regras

| Regra | Nome | Descrição |
|-------|------|-----------|
| **R1** | Anti-invenção / Unidade Órfã | Proibido inventar qualquer valor numérico. Placeholders `(...)` devem virar qualidade. |
| **R2** | Blindagem Histopatológica | Proibido diagnóstico histológico definitivo (carcinoma, metástase). Use "sugestivo de". |
| **R3** | Compliance de Refinamento | O output de refine/copiloto deve ser o laudo COMPLETO — nunca truncar. |
| **R4** | Diplomacia Consultiva | Linguagem "recomenda-se" em não-urgências. Suspender em R9 (emergência). |
| **R5** | Classificações Oficiais | Proibido usar BI-RADS, TI-RADS, O-RADS sem dados descritivos mínimos. |
| **R6** | Override de Urgência | Red flags → RECOMENDAÇÕES começa com `<p>• <strong>ALERTA [CAT]:</strong>…</p>` |
| **R7** | OBSERVAÇÕES obrigatórias | A seção OBSERVAÇÕES METODOLÓGICAS é obrigatória em TODOS os laudos. |
| **R8** | Padronização Técnica | TÉCNICA e RECOMENDAÇÕES devem seguir a máscara modelo. Proibido alterar. |

#### Red Flags que ativam R6 (Urgências)

- **Torção de cisto/massa ovariana** com dor pélvica aguda
- **Apendicite** (líquido periapendicular, espessamento de parede)
- **Gravidez ectópica** (massa anexial + líquido livre + beta-hCG +)
- **Ruptura de aneurisma** (aorta >5,5 cm com sintomas)
- **TVP proximal** (trombose de veia femoral/poplítea)
- **Colangite** (dilatação das vias biliares + febre + icterícia)

#### O que NÃO pode ser removido

> ⚠️ **NUNCA remova R1, R2, R7** — são as regras de segurança médico-legais mais críticas.

#### O que pode ser ajustado

- **R6:** Expandir a lista de red flags com condições específicas da sua prática
- Adicionar novas regras de compliance da clínica (ex: R9 — obrigatoriedade de CNPJ no cabeçalho)

---

### Bloco 5 — Refinamento & Copiloto

**Localização no código:** `src/modules/ai/prompts/general.ts` → `DEFAULT_REFINEMENT_GOLDEN_RULES` e `DEFAULT_COPILOT_OVERRIDE`
**Configuração do usuário:** `AppSettings.aiRefinementGoldenRules`

#### O que é
São as **regras especiais dos modos de edição**. Ativas APENAS quando a IA está refinando um laudo já gerado (não na geração inicial).

#### Regras de Ouro do Refinamento

1. **LAUDO COMPLETO** — Output sempre do início ao fim, nunca "...", nunca truncado
2. **PRESERVAÇÃO DE DADOS** — Achados patológicos, medidas e descrições do laudo atual são INVIOLÁVEIS
3. **TÉCNICA CONGELADA** — A seção TÉCNICA deve ser reproduzida identicamente ao laudo atual
4. **RECOMENDAÇÕES PADRÃO** — Usar apenas as recomendações das INSTRUÇÕES ESPECÍFICAS DO EXAME
5. **ELIMINAÇÃO DE PLACEHOLDERS** — `(...)` → normalidade qualitativa (exceto Fetal e Vascular)
6. **INTEGRIDADE DA CASCATA** — Cada achado na Análise → 1 bullet Conclusão → 1 conduta Recomendação

#### Formato do Copiloto

```
=== CONVERSA ===
[1 frase técnica descrevendo a alteração — máx 15 palavras]

=== PROPOSTA ===
[HTML completo do laudo modificado, começando com <h1>]
```

---

## 3. Camada 2 — Diretriz da Área

**Localização no código:** `AppSettings.aiAreaPrompts[area]`
**Montagem:** `buildSpecificContext()` em `engine.ts`
**Escopo:** Todos os exames de UMA MESMA ÁREA

### O que é
Instruções clínicas específicas da especialidade que complementam o sistema universal. Define:
- Classificações especiais da área (FIGO, BI-RADS, TI-RADS, O-RADS, LI-RADS, BOSNIAK)
- Particularidades técnicas da especialidade
- Fraseologia padrão da área
- Tabelas de referência específicas (percentis, valores normais)

### Como é enviada para a IA

```
═══════════════════════════════════════════
INSTRUÇÕES DA ÁREA DE [NOME_DA_ÁREA]:
═══════════════════════════════════════════
[Conteúdo da diretriz da área]
```

### Diretrizes por Área (referência rápida)

| Área | Foco Principal |
|------|----------------|
| **medicina-interna** | Classificação de esteatose, doença renal crônica, hipertensão portal |
| **medicina-fetal** | Biometria fetal, tabelas de percentil, Doppler obstétrico, morfologia |
| **ginecologia** | FIGO, ciclo menstrual, SOP, cistos de ovário (O-RADS) |
| **vascular** | Velocidades de pico sistólico, critérios de estenose, índices (IP/IR/RCP) |
| **musculoesqueletico** | Tendões, bursas, protocolo dinâmico, graduação de lesões |
| **mastologia** | BI-RADS, protocolo ACR, nódulos sólidos vs. cistos |
| **pequenas-partes** | Tireoide (TI-RADS), testículos, gânglios |
| **pediatria** | Faixas etárias, displasia do quadril, escroto agudo |
| **reumatologico** | PDUS (Power Doppler), atividade sinovial, EULAR |
| **procedimentos** | Protocolo de biópsia, consentimento, anticoagulantes |

---

## 4. Camada 3 — Instruções Específicas do Exame

**Localização no código:** `ReportTemplate.aiInstructions` (campo por máscara)
**Escopo:** APENAS este exame específico

### O que é
O nível mais granular de instrução. Define regras que se aplicam **somente a este exame**, overridando parcialmente a diretriz de área quando necessário.

### O que deve estar em `aiInstructions`

```markdown
CLASSIFICAÇÕES OBRIGATÓRIAS:
- [ex: Para nódulos ovarianos: classificar por O-RADS]
- [ex: Para nódulos mamários sólidos: atribuir BI-RADS]

RECOMENDAÇÕES PADRÃO:
- [ex: Para cistos simples <4 cm: "Acompanhamento ultrassonográfico em 12 meses conforme protocolo da área."]
- [ex: Para achados suspeitos: "Sugerimos avaliação especializada (Ginecologia) para planejamento diagnóstico/terapêutico."]

TÉCNICA DO EXAME:
- [ex: "Via transabdominal e transvaginal com transdutor de alta frequência"]
- [ex: Doppler colorido e pulsado para avaliação vascular]

PARTICULARIDADES DESTE EXAME:
- [ex: Avaliar obrigatoriamente: útero (dimensões), ovários (dimensões), endométrio (espessura), fundo de saco]
- [ex: Relatar sempre a fase do ciclo menstrual se informada]
```

### Template de `aiInstructions` (copie e personalize)

```
INSTRUÇÕES ESPECÍFICAS — [NOME DO EXAME]

CLASSIFICAÇÕES OBRIGATÓRIAS:
• [Classificação 1 — ex: BI-RADS para nódulos sólidos na mama]

RECOMENDAÇÕES PADRÃO (usar exatamente estas fraseologias):
• NORMAL: "Recomenda-se seguimento clínico habitual conforme protocolo do médico assistente."
• [ACHADO BENIGNO]: "[Recomendação específica]"
• [ACHADO SUSPEITO]: "[Recomendação de encaminhamento]"

TÉCNICA PADRÃO:
• [Descrição da técnica completa]

ACHADOS OBRIGATÓRIOS A AVALIAR:
• [Órgão/estrutura 1]
• [Órgão/estrutura 2]
• [...]

OBSERVAÇÕES ESPECÍFICAS:
• [Particularidade 1 deste exame]
```

---

## 5. Ordem de Montagem do Prompt Final

Quando o usuário clica em "Gerar Laudo", o `engine.ts` monta o prompt nesta ordem exata:

```
[SYSTEM PROMPT]
═════════════════════════════════════
Bloco 1 — Prompt Mestre (Doutrina)

Bloco 2 — Instruções Globais (Raciocínio)

Bloco 3 — Skeleton / Arquitetura HTML

Bloco 4 — Regras Rígidas (Compliance)
═════════════════════════════════════

[USER MESSAGE]
═════════════════════════════════════
INSTRUÇÕES DA ÁREA DE [ÁREA]:
[Diretriz da Área — Camada 2]

INSTRUÇÕES ESPECÍFICAS DO EXAME:
[aiInstructions da máscara — Camada 3]

---
MODO: GERAÇÃO INICIAL
EXAME: [nome do exame]
DATA DO EXAME: [data]
PACIENTE: [nome], [idade], [sexo]
INDICAÇÃO: [indicação clínica]
ANAMNESE: [anamnese]
NOTAS DO MÉDICO: [notas]
REFERÊNCIA DE ESTILO: [laudos anteriores para mimetismo]

MÁSCARA DE REFERÊNCIA:
[HTML completo da máscara]
═════════════════════════════════════
```

---

## 6. Guia de Ajuste Seguro

### ✅ Ajustes SEGUROS (pode fazer sem risco)

| O que ajustar | Onde | Como |
|---------------|------|------|
| Vocabulário da persona | Bloco 1 | Edite o estilo sem remover as Leis |
| Adicionar jargões ao mapeamento | Bloco 2 — Fase 5 | Adicione linhas à lista de mapeamento |
| Adicionar red flags | Bloco 4 — R6 | Adicione à lista de condições de urgência |
| Diretriz completa de área | Camada 2 | Edite `aiAreaPrompts[área]` na UI |
| Instruções de exame | Camada 3 | Edite `aiInstructions` na máscara |
| Recomendações padrão | Camada 3 | Edite `aiInstructions` com fraseologia exata |

### ⚠️ Ajustes que EXIGEM ATENÇÃO

| O que ajustar | Risco | Cuidado |
|---------------|-------|---------|
| Fórmulas do elipsoide (Bloco 2) | Volume calculado errado | Teste com 3+ casos antes de publicar |
| Tags HTML permitidas (Bloco 3) | Pode quebrar renderização | Não adicione divs/spans |
| Override de temperatura | Alucinações ou rigidez excessiva | Use 0.1–0.4 para laudos |

### ❌ Ajustes PROIBIDOS

| O que NÃO fazer | Por quê |
|-----------------|---------|
| Remover "NÃO INVENÇÃO" do Bloco 1 | Causa alucinações numéricas (risco clínico grave) |
| Remover "CASCATA TRIPARTITE" | Quebra a estrutura do laudo |
| Remover R1, R2, R7 do Bloco 4 | Risco médico-legal |
| Adicionar `<div>` às tags permitidas (Bloco 3) | Quebra a renderização do sistema |
| Pedir à IA para "inventar medidas típicas" | Viola R1 e cria laudos falsos |

---

## 7. Glossário de Leis e Regras

| Termo | Significado |
|-------|-------------|
| **Cascata Tripartite** | Estrutura obrigatória ANÁLISE → CONCLUSÃO → RECOMENDAÇÕES |
| **Lei da Não-Invenção** | Proibição absoluta de fabricar valores numéricos |
| **Unidade Órfã** | Placeholder numérico vazio (`___ cm`) — deve virar qualidade |
| **Self-Audit** | Fase 7 de revisão interna da IA antes de fechar o scratchpad |
| **R1–R8** | Regras Rígidas de Compliance (veja Bloco 4) |
| **N0–N4** | Escala de conduta (N0=normal, N4=urgência) |
| **Elipsoide** | Fórmula de volume: D1 × D2 × D3 × 0,523 |
| **Scratchpad** | Raciocínio interno da IA — nunca aparece no laudo final |
| **Mimetismo de Estilo** | Aprendizado do estilo do médico via laudos anteriores (Treinamento) |
| **Override de Modo** | Bloco 5 ativo apenas em Refine e Copiloto |
| **BI-RADS** | Classificação de mama (ACR) |
| **TI-RADS** | Classificação de tireoide (ACR) |
| **O-RADS** | Classificação de ovário (ACR) |
| **LI-RADS** | Classificação de fígado em cirrótico (ACR) |
| **BOSNIAK** | Classificação de cistos renais |
| **FIGO** | Classificação de tumores ginecológicos |

---

*Documento mantido por: Sistema LAUDUS | Última atualização: v16.0*
