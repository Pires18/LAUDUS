# Avaliação da Lógica de Percentis (Biometria e Doppler)

Realizei uma análise profunda da arquitetura matemática das calculadoras fetais (Biometria e Barcelona/Doppler).

## O que já está Perfeito (Estado da Arte)
1. **Uso de Z-Score vs Percentis Empíricos:** A lógica atual usa Z-Score paramétrico, o que é **a forma mais correta e confiável**. A conversão do Z-Score para Percentil utiliza a aproximação da Função de Erro (erf) de *Abramowitz & Stegun*. Isso é o padrão-ouro na computação médica, permitindo calcular percentis extremos (ex: < 1%) com precisão astronômica, coisa que tabelas empíricas não fazem.
2. **Cálculo do Peso Fetal (Hadlock 1991):** O cálculo do percentil do peso já utiliza as fórmulas polinomiais exatas originais do estudo (`0.578 + 0.332*GA - 0.00354*GA^2`), o que garante a curva perfeita dia a dia.

## O que precisa ser Corrigido / Aprimorado (Plano de Ação)

### 1. Erro de Arredondamento no Doppler (Barcelona)
- **Problema:** A calculadora de Biometria interpola os dados de acordo com os dias exatos (ex: 20 semanas e 4 dias = 20.57 semanas). Porém, descobri que a calculadora de Doppler está usando um `Math.round(ga)` (arredondando para a semana mais próxima) antes de buscar a média e o desvio padrão. Isso cria "degraus" matemáticos onde o percentil sofre um salto brusco se o feto tiver 20s 4d versus 20s 3d.
- **Solução:** Remover o arredondamento (`gaRound`) e passar a idade exata decimal (`gaDecimal`) para a função de interpolação do Doppler. Isso fará as curvas de IP da Artéria Umbilical, Cerebral Média, Uterinas e Ducto Venoso fluírem continuamente dia-a-dia.

### 2. RCP / CPR (Relação Cérebro-Placentária)
- **Problema:** No estadiamento I de Barcelona, o sistema usa o limite fixo de `RCP < 1.0`. Embora prático, a fundação Barcelona (Fetal Medicine Barcelona) recomenda utilizar o *Percentil* da RCP (< p5) de acordo com a idade gestacional.
- **Solução:** Implementarei a curva referencial da RCP (Baschat 2003 ou semelhante aceita por Gratacós) para que a IA avalie a RCP pelo percentil, elevando o estadiamento de Barcelona ao rigor científico mais alto.

### 3. Fórmulas Polinomiais Exatas vs Interpolação Linear (Biometria)
- A biometria BPD, HC, AC e FL está atualmente fazendo interpolação linear (deslizando uma reta entre a semana 20 e 21 da tabela de Hadlock). Embora seja o que muitas máquinas de ultrassom façam, a adaptação mais refinada possível é substituir essa tabela de interpolação pelas **equações polinomiais exatas** publicadas por Hadlock. 
- *Decisão:* Vou implementar as fórmulas de regressão logarítmica originais para evitar os micro-erros (na casa decimal) gerados pela reta de interpolação.

## Aprovação
Se estiver de acordo com o plano, prosseguirei com as refatorações matemáticas nas calculadoras `FetalBiometryCalculator.tsx` e `BarcelonaFetalGrowthCalculator.tsx`.
