import { describe, it, expect } from 'vitest';
import { ageRelatedRisk } from '../modules/calculators/fmf/trisomyData';

/**
 * VALIDAÇÃO DO RISCO A PRIORI (idade, ~12 sem) CONTRA A CALCULADORA OFICIAL DA FMF.
 *
 * A calc oficial (fetalmedicine.org) roda o modelo R real em WebAssembly. Em
 * jul/2026 o usuário rodou o "Risk from History" (mesmo caso, 12+5) em 6 idades
 * e colou as saídas — abaixo, os valores EXATOS. Nosso `ageRelatedRisk` agora lê
 * a curva de 12 sem calibrada nesses pontos, então bate quase que exatamente nas
 * idades ancoradas. Este teste falha se alguém mexer na curva de idade.
 *
 * (A conferência do risco COMBINADO/ajustado — que depende também das LRs de TN,
 * bioquímica e FHR — segue pendente; ver `project_fmf_calculators`. Gate
 * `validated:false` mantido.)
 */
const FMF_T21_12WK: ReadonlyArray<readonly [number, number]> = [
  [20, 980], [25, 860], [30, 570], [35, 230], [40, 67], [45, 17],
];
// Combinado T13/18 oficial ("Risk from History") nas mesmas idades.
const FMF_T1318_12WK: ReadonlyArray<readonly [number, number]> = [
  [20, 1800], [25, 1500], [30, 1000], [35, 430], [40, 124], [45, 31],
];

describe('A priori T21 (12 sem) vs calculadora OFICIAL da FMF', () => {
  it.each(FMF_T21_12WK)('idade %i: bate o valor oficial 1:%i (±4%)', (age, fmfN) => {
    const oursN = 1 / ageRelatedRisk(age).t21;
    const ratio = oursN / fmfN;
    expect(ratio).toBeGreaterThan(0.96);
    expect(ratio).toBeLessThan(1.04);
  });

  it('monotonicidade: risco cresce com a idade (35 > 30 > 25)', () => {
    expect(ageRelatedRisk(35).t21).toBeGreaterThan(ageRelatedRisk(30).t21);
    expect(ageRelatedRisk(30).t21).toBeGreaterThan(ageRelatedRisk(25).t21);
  });
});

/**
 * A priori de T13/18 combinado vs OFICIAL. É modelado como fração de 12 sem do
 * T21 (T18=0,42, T13=0,14 → 0,56×), calibrado porque a razão T13/18:T21 do
 * "Risk from History" é constante ≈0,54–0,57 em toda a faixa (antes usávamos
 * razões A TERMO 1/10,1/30 → ~0,13×, que subestimavam T13/18 em ~5×).
 */
describe('A priori T13/18 combinado vs calculadora OFICIAL da FMF', () => {
  const combinedN = (age: number) => {
    const r = ageRelatedRisk(age);
    return 1 / (r.t18 + r.t13);
  };
  it.each(FMF_T1318_12WK)('idade %i: bate o combinado oficial 1:%i (±8%)', (age, fmfN) => {
    const ratio = combinedN(age) / fmfN;
    expect(ratio).toBeGreaterThan(0.92);
    expect(ratio).toBeLessThan(1.08);
  });

  it('razão T13/18:T21 constante em 0,50–0,62 (como na oficial)', () => {
    for (const age of [20, 25, 30, 35, 40, 45]) {
      const r = ageRelatedRisk(age);
      const ratio = (r.t18 + r.t13) / r.t21;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(0.62);
    }
  });

  it('T18 é mais comum que T13 (split clínico ~3:1)', () => {
    const r = ageRelatedRisk(30);
    expect(r.t18).toBeGreaterThan(r.t13);
    expect(r.t18 / r.t13).toBeCloseTo(3, 0);
  });
});
