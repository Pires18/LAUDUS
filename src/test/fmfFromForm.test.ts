import { describe, it, expect } from 'vitest';
import { trisomyRiskFromForm, trisomyHasEvidence, peRiskFromForm } from '../modules/calculators/fmf/fromForm';
import { computeTrisomyRisk } from '../modules/calculators/fmf/trisomy';
import { ageRelatedRisk, PROVISIONAL_TRISOMY_PARAMS as TP } from '../modules/calculators/fmf/trisomyData';
import { mapMedianMmHg } from '../modules/calculators/fmf/medians';

/**
 * FONTE ÚNICA form→risco — a MESMA função alimenta o modal e o cálculo ao vivo
 * da aba Estruturado. Estes testes travam: (a) que ela reproduz os gold-cases
 * já validados vs a FMF oficial; (b) consistência com o motor puro.
 */

describe('trisomyRiskFromForm', () => {
  it('idade inválida ⇒ null; só idade (sem evidência) não conta como rastreio', () => {
    expect(trisomyRiskFromForm({ ageYears: 10 })).toBeNull();
    expect(trisomyHasEvidence({ ageYears: 35 })).toBe(false);
    expect(trisomyHasEvidence({ ageYears: 35, ntMm: 2, crlMm: 65 })).toBe(true);
    expect(trisomyHasEvidence({ ageYears: 35, nasalBone: 'abnormal' })).toBe(true);
  });

  it('perfil clássico de T21 (38a, TN 3,5, β-hCG 2,5, PAPP-A 0,4, ON ausente) fica rastreio-positivo', () => {
    const r = trisomyRiskFromForm({
      ageYears: 38, crlMm: 65, ntMm: 3.5, gestDays: 89,
      freeBhcgMoM: 2.5, pappaMoM: 0.4, nasalBone: 'abnormal',
    })!;
    expect(r.oneInN.t21).toBeLessThan(100);
  });

  it('é IDÊNTICA ao motor puro (mesmos inputs)', () => {
    const inp = { ageYears: 40, crlMm: 65, ntMm: 2.0, gestDays: 89, freeBhcgMoM: 1.0, pappaMoM: 1.0, fhrBpm: 160 };
    const viaForm = trisomyRiskFromForm(inp)!;
    const viaEngine = computeTrisomyRisk({
      priorRisk: ageRelatedRisk(40), ntMm: 2.0, crlMm: 65, gestDays: 89,
      freeBhcgMoM: 1.0, pappaMoM: 1.0, fhrBpm: 160,
    }, TP);
    expect(viaForm.oneInN.t21).toBe(viaEngine.oneInN.t21);
    expect(viaForm.oneInN.t18).toBe(viaEngine.oneInN.t18);
  });
});

describe('peRiskFromForm', () => {
  // referência PE-1 (validada vs FMF oficial = 1:270): 30a/65kg/165cm, branca,
  // nulípara, espontânea. MAP bruta = mediana esperada ⇒ MoM 1,0 (neutro).
  const refInput = {
    ageYears: 30, weightKg: 65, heightCm: 165, gaWeeks: 12.71,
    racialOrigin: 'white' as const, conception: 'spontaneous' as const, parity: 'nulliparous' as const,
    diabetes: 'none' as const, chronicHypertension: false, sleOrAps: false,
    familyHistoryPE: false, smoker: false, analyzer: 'cobas' as const,
  };

  it('sem idade/peso/altura ⇒ null', () => {
    expect(peRiskFromForm({ ...refInput, ageYears: null })).toBeNull();
  });

  it('MAP bruta = mediana ⇒ MoM ~1,0 e risco pré-termo ~ gold FMF (1:270 ±12%)', () => {
    const cov = {
      gaDays: Math.round(12.71 * 7), weightKg: 65, heightCm: 165, ageYears: 30,
      racialOrigin: 'white' as const, smoker: false, chronicHypertension: false,
      diabetes: 'none' as const, ivf: false, parity: 'nulliparous' as const,
    };
    const mapMedian = mapMedianMmHg(cov)!;
    const out = peRiskFromForm({ ...refInput, mapMmHg: mapMedian })!;
    expect(out.mapMoM).toBeCloseTo(1.0, 1);
    expect(out.risk.pretermPE.oneInN).toBeGreaterThan(238);
    expect(out.risk.pretermPE.oneInN).toBeLessThan(302);
    expect(out.risk.aspirinRecommended).toBe(false);
  });

  it('PlGF entra BRUTO (pg/mL) → MoM pela mediana (não é passado como MoM)', () => {
    const out = peRiskFromForm({ ...refInput, plgfRaw: 30 })!; // ~30 pg/mL
    // mediana de referência ~48–51 → MoM ~0,6 (não 30!)
    expect(out.plgfMoM).toBeGreaterThan(0.3);
    expect(out.plgfMoM).toBeLessThan(1.0);
  });
});
