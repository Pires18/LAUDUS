import { describe, it, expect } from 'vitest';
import { ageRelatedRisk } from '../modules/calculators/fmf/trisomyData';

/**
 * VALIDAÇÃO DO RISCO A PRIORI (idade + IG) CONTRA A REFERÊNCIA DA FMF.
 *
 * A calculadora OFICIAL da FMF (fetalmedicine.org) roda o modelo R real em
 * WebAssembly (webR + mvtnorm/cubature). Na sessão de validação (jul/2026) o
 * formulário completo foi preenchido com casos-ouro, mas a saída NUMÉRICA do
 * risco combinado não é renderizada fora de sessão autenticada/ambiente
 * apropriado — portanto a conferência caso-a-caso do risco COMBINADO
 * permanece pendente (gate `validated:false` mantido em trisomyData.ts).
 *
 * O componente que É publicamente ancorável — o risco de fundo ("background
 * risk") de T21 às ~12 semanas por idade materna (Snijders/Nicolaides, a mesma
 * tabela que a FMF usa) — é travado aqui. Nosso a priori bate com os valores
 * publicados dentro de ~12% em toda a faixa etária (≤8% dos 25–36 anos; exato
 * aos 35 = 1:249). Este teste falha se alguém alterar a tabela/curva de idade
 * ou o fator de correção de IG de um jeito que afaste o a priori da referência.
 */
const FMF_BACKGROUND_T21_12WK: ReadonlyArray<readonly [number, number]> = [
  [20, 1068], [25, 946], [30, 626], [31, 543], [32, 461], [33, 383],
  [34, 312], [35, 249], [36, 196], [37, 152], [38, 117], [39, 89],
  [40, 68], [42, 39], [45, 19],
];

describe('Risco a priori T21 (12 sem) vs background risk publicado da FMF', () => {
  it.each(FMF_BACKGROUND_T21_12WK)('idade %i: dentro de 15%% do valor FMF (1:%i)', (age, fmfN) => {
    const oursN = 1 / ageRelatedRisk(age).t21;
    const ratio = oursN / fmfN;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('aos 35 anos reproduz o valor canônico 1:249 (±3%)', () => {
    const oursN = 1 / ageRelatedRisk(35).t21;
    expect(oursN).toBeGreaterThan(242);
    expect(oursN).toBeLessThan(257);
  });

  it('monotonicidade: risco cresce com a idade (35 > 30 > 25)', () => {
    expect(ageRelatedRisk(35).t21).toBeGreaterThan(ageRelatedRisk(30).t21);
    expect(ageRelatedRisk(30).t21).toBeGreaterThan(ageRelatedRisk(25).t21);
  });
});
