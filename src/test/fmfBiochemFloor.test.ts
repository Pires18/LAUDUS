import { describe, it, expect } from 'vitest';
import { biochemLR, computeTrisomyRisk } from '../modules/calculators/fmf/trisomy';
import { ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS as P } from '../modules/calculators/fmf/trisomyData';

/**
 * PISO DE SEGURANÇA DA LR BIOQUÍMICA — calibrado à calculadora OFICIAL da FMF
 * (jul/2026). A FMF trunca a LR de modo que uma bioquímica INCONSISTENTE com a
 * trissomia não reduza o risco abaixo do nível da bioquímica neutra (MoM 1/1),
 * evitando FALSA TRANQUILIZAÇÃO. Caso oficial conferido (42a, TN 2,0, FHR 160):
 *   β-hCG 0,5 / PAPP-A 2,0 → FMF mantém T21 em 1:740 (=neutro); a Gaussiana crua
 *   despencaria para ~1:8000. Com o piso, nosso motor dá 1:717 (~3%).
 */
describe('bioquímica — piso de segurança (anti-falsa-tranquilização, calibrado à FMF)', () => {
  const gd = 89;

  it('bioquímica anti-T21 (β-hCG 0,5 / PAPP-A 2,0) não reduz abaixo do neutro', () => {
    const neutro = biochemLR(1, 1, gd, P.biochem, 't21');
    const antiT21 = biochemLR(0.5, 2.0, gd, P.biochem, 't21');
    expect(antiT21).toBeGreaterThanOrEqual(neutro - 1e-9);       // pisou no neutro
    expect(antiT21).toBeCloseTo(0.218, 2);                        // ≈ oficial 0,217
  });

  it('sentido pró-T21 (β-hCG 2,0 / PAPP-A 0,5) NÃO é afetado pelo piso (segue conservador)', () => {
    const proT21 = biochemLR(2.0, 0.5, gd, P.biochem, 't21');
    expect(proT21).toBeGreaterThan(4);                            // sobe o risco (oficial 4,59)
  });

  it('caso oficial D: T21 ajustado ≈ 1:740 (±12%) — antes 1:8042 (falsa tranquilização)', () => {
    const r = computeTrisomyRisk(
      { priorRisk: ageRelatedRisk(42), ntMm: 2.0, crlMm: 65, gestDays: gd, freeBhcgMoM: 0.5, pappaMoM: 2.0, fhrBpm: 160 },
      P,
    );
    expect(r.oneInN.t21).toBeGreaterThan(650);
    expect(r.oneInN.t21).toBeLessThan(830);
  });

  it('piso aplicado às três trissomias (nunca reduz abaixo do neutro)', () => {
    for (const t of ['t21', 't18', 't13'] as const) {
      const neutro = biochemLR(1, 1, gd, P.biochem, t);
      // um ponto bem "anti-padrão" para cada
      const anti = biochemLR(0.3, 3.0, gd, P.biochem, t);
      expect(anti).toBeGreaterThanOrEqual(neutro - 1e-9);
    }
  });
});
