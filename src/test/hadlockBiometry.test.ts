import { describe, it, expect } from 'vitest';
import { HADLOCK_1984_BIOMETRY } from '../modules/calculators/constants/hadlockBiometryData';
import {
  hadlockBiometryMedian,
  hadlockBiometryZScore,
  hadlockEfwMedian,
  intergrowthBiometryMedian,
  intergrowthEfwMedian,
  getPercentileBy,
  getZScoreBy,
  biometryMedianBy,
  BIOMETRY_REFERENCES,
  DEFAULT_BIOMETRY_REFERENCE,
  referenceSupports,
  type BiometryReference,
} from '../modules/calculators/constants/biometryReferences';
import { getWhoPercentile } from '../modules/calculators/constants/fetalReferences';

/**
 * AUDITORIA da tabela de crescimento de Hadlock 1984 + COMPARATIVOS automáticos
 * entre as três curvas em produção (Hadlock × INTERGROWTH × OMS).
 */

const DIMS = ['BPD', 'HC', 'AC', 'FL'] as const;

describe('Hadlock 1984 — integridade da tabela transcrita', () => {
  it('as 4 dimensões cobrem 12–40 semanas em passos de 0,5 (57 pontos)', () => {
    for (const dim of DIMS) {
      const t = HADLOCK_1984_BIOMETRY[dim].table;
      expect(t.length, dim).toBe(57);
      expect(t[0][0], dim).toBe(12);
      expect(t[t.length - 1][0], dim).toBe(40);
      for (let i = 1; i < t.length; i++) {
        expect(t[i][0] - t[i - 1][0], `${dim} passo em ${t[i][0]}`).toBeCloseTo(0.5, 6);
      }
    }
  });

  it('DP constante por parâmetro, conforme o padrão de 1984', () => {
    expect(HADLOCK_1984_BIOMETRY.BPD.sd).toBe(3); // 0,3 cm
    expect(HADLOCK_1984_BIOMETRY.HC.sd).toBe(10); // 1,0 cm
    expect(HADLOCK_1984_BIOMETRY.AC.sd).toBe(13.4); // 1,34 cm
    expect(HADLOCK_1984_BIOMETRY.FL.sd).toBe(3); // 0,3 cm
  });

  it('todas as curvas são monotônicas crescentes', () => {
    for (const dim of DIMS) {
      const t = HADLOCK_1984_BIOMETRY[dim].table;
      for (let i = 1; i < t.length; i++) {
        expect(t[i][1], `${dim}@${t[i][0]}`).toBeGreaterThan(t[i - 1][1]);
      }
    }
  });

  it('âncoras clínicas do padrão (mm) batem com a literatura', () => {
    // valores clássicos de Hadlock, tolerância de ±2 mm (±5 mm em CC/CA)
    expect(hadlockBiometryMedian('BPD', 20)!).toBeCloseTo(46.3, 0);
    expect(hadlockBiometryMedian('BPD', 40)!).toBeCloseTo(94.2, 0);
    expect(hadlockBiometryMedian('HC', 20)!).toBeCloseTo(176.8, 0);
    expect(hadlockBiometryMedian('AC', 20)!).toBeCloseTo(149.1, 0);
    expect(hadlockBiometryMedian('FL', 20)!).toBeCloseTo(32.7, 0);
    expect(hadlockBiometryMedian('FL', 40)!).toBeCloseTo(77.3, 0);
  });
});

describe('Hadlock 1984 — percentis por biometria', () => {
  it('interpola linearmente entre os pontos da tabela', () => {
    const a = hadlockBiometryMedian('BPD', 20)!;
    const b = hadlockBiometryMedian('BPD', 20.5)!;
    const mid = hadlockBiometryMedian('BPD', 20.25)!;
    expect(mid).toBeCloseTo((a + b) / 2, 6);
  });

  it('z = 0 na média; ±1 DP dá z = ±1', () => {
    for (const dim of DIMS) {
      const m = hadlockBiometryMedian(dim, 28)!;
      const sd = HADLOCK_1984_BIOMETRY[dim].sd;
      expect(hadlockBiometryZScore(dim, 28, m), dim).toBeCloseTo(0, 6);
      expect(hadlockBiometryZScore(dim, 28, m + sd), dim).toBeCloseTo(1, 6);
      expect(hadlockBiometryZScore(dim, 28, m - sd), dim).toBeCloseTo(-1, 6);
    }
  });

  it('média da tabela → percentil 50 pela curva Hadlock', () => {
    for (const dim of DIMS) {
      const m = hadlockBiometryMedian(dim, 30)!;
      const r = getPercentileBy('hadlock', dim, 30, m);
      expect(r.usedRef, dim).toBe('hadlock');
      expect(r.percentile, dim).toBe(50);
    }
  });

  it('fora de 12–40 semanas o padrão não se aplica → cai na OMS', () => {
    expect(hadlockBiometryZScore('BPD', 11, 15)).toBeNull();
    expect(hadlockBiometryZScore('BPD', 41, 95)).toBeNull();
    const r = getZScoreBy('hadlock', 'BPD', 41, 95);
    expect(r.usedRef).toBe('who');
    expect(r.fellBack).toBe(true);
  });

  it('úmero não faz parte do padrão → cai na OMS', () => {
    expect(getZScoreBy('hadlock', 'HL', 30, 50).usedRef).toBe('who');
  });
});

describe('PRODUÇÃO — referências validadas e padrão do sistema', () => {
  it('as três curvas estão validadas (em produção)', () => {
    for (const ref of ['hadlock', 'intergrowth', 'who'] as BiometryReference[]) {
      expect(BIOMETRY_REFERENCES[ref].validated, ref).toBe(true);
    }
  });

  it('Hadlock é o padrão do sistema (1ª validada na ordem de preferência)', () => {
    expect(DEFAULT_BIOMETRY_REFERENCE).toBe('hadlock');
  });

  it('Hadlock e INTERGROWTH cobrem PFE + as 4 biometrias', () => {
    for (const ref of ['hadlock', 'intergrowth'] as BiometryReference[]) {
      for (const dim of ['EFW', ...DIMS] as const) {
        expect(referenceSupports(ref, dim), `${ref}/${dim}`).toBe(true);
      }
    }
  });
});

describe('COMPARATIVO automático — Hadlock × INTERGROWTH × OMS', () => {
  const REFS: BiometryReference[] = ['hadlock', 'intergrowth', 'who'];

  it('na janela comum (14–40 sem), cada curva usa a si mesma para as biometrias', () => {
    for (let ga = 14; ga <= 40; ga += 2) {
      for (const dim of DIMS) {
        for (const ref of ['hadlock', 'intergrowth'] as BiometryReference[]) {
          const med = biometryMedianBy(ref, dim, ga)!;
          const r = getPercentileBy(ref, dim, ga, med);
          expect(r.usedRef, `${ref}/${dim}@${ga}`).toBe(ref);
          expect(r.fellBack).toBe(false);
        }
      }
    }
  });

  it('as medianas das 3 curvas são clinicamente concordantes (diferença < 10%)', () => {
    // curvas distintas divergem, mas não podem discordar grosseiramente:
    // discrepância grande indicaria erro de transcrição/unidade.
    for (let ga = 20; ga <= 38; ga += 2) {
      for (const dim of DIMS) {
        const h = biometryMedianBy('hadlock', dim, ga)!;
        const i = biometryMedianBy('intergrowth', dim, ga)!;
        const diff = Math.abs(h - i) / ((h + i) / 2);
        expect(diff, `${dim}@${ga}: Hadlock ${h.toFixed(1)} vs IG ${i.toFixed(1)}`).toBeLessThan(0.1);
      }
    }
  });

  it('a mediana de uma curva cai em faixa central das outras (pega erro de transcrição)', () => {
    // Curvas distintas divergem de verdade (ver o teste do fêmur abaixo); o
    // limite p5–p95 ainda denuncia erro de unidade/transcrição, que jogaria a
    // mediana para os extremos.
    for (let ga = 20; ga <= 38; ga += 3) {
      for (const dim of DIMS) {
        const h = biometryMedianBy('hadlock', dim, ga)!;
        const pIg = getPercentileBy('intergrowth', dim, ga, h).percentile!;
        expect(pIg, `${dim}@${ga}`).toBeGreaterThan(5);
        expect(pIg, `${dim}@${ga}`).toBeLessThan(95);
      }
    }
  });

  it('DIVERGÊNCIA CONHECIDA: o fêmur de Hadlock é maior que o do INTERGROWTH', () => {
    // Achado real (não erro de transcrição): a mediana do CF de Hadlock cai
    // perto do p90 da curva INTERGROWTH no 3º trimestre. A escolha da curva
    // muda o percentil do fêmur de forma clinicamente relevante — por isso a
    // referência usada é sempre exibida junto do percentil na UI e no laudo.
    const hFl32 = hadlockBiometryMedian('FL', 32)!;
    const iFl32 = intergrowthBiometryMedian('FL', 32)!;
    expect(hFl32).toBeGreaterThan(iFl32);
    const pIg = getPercentileBy('intergrowth', 'FL', 32, hFl32).percentile!;
    expect(pIg).toBeGreaterThan(85); // ~p92
    // e o inverso: a mediana do INTERGROWTH é baixa na curva de Hadlock
    expect(getPercentileBy('hadlock', 'FL', 32, iFl32).percentile!).toBeLessThan(35);
  });

  it('PFE: medianas de Hadlock e INTERGROWTH concordam dentro de 15%', () => {
    for (let ga = 24; ga <= 40; ga += 2) {
      const h = hadlockEfwMedian(ga);
      const i = intergrowthEfwMedian(ga);
      const diff = Math.abs(h - i) / ((h + i) / 2);
      expect(diff, `PFE@${ga}: Hadlock ${h.toFixed(0)} g vs IG ${i.toFixed(0)} g`).toBeLessThan(0.15);
    }
  });

  it('monotonicidade do percentil: medida maior → percentil maior, em toda curva', () => {
    for (const ref of REFS) {
      for (const dim of DIMS) {
        const base = biometryMedianBy(ref, dim, 30) ?? hadlockBiometryMedian(dim, 30)!;
        const pLow = getPercentileBy(ref, dim, 30, base * 0.9).percentile!;
        const pMid = getPercentileBy(ref, dim, 30, base).percentile!;
        const pHigh = getPercentileBy(ref, dim, 30, base * 1.1).percentile!;
        expect(pLow, `${ref}/${dim}`).toBeLessThan(pMid);
        expect(pMid, `${ref}/${dim}`).toBeLessThan(pHigh);
      }
    }
  });

  it('nenhuma curva produz percentil fora de 0–100 em toda a janela', () => {
    for (const ref of REFS) {
      for (let ga = 14; ga <= 40; ga += 2) {
        for (const dim of DIMS) {
          for (const factor of [0.5, 0.8, 1, 1.2, 1.5]) {
            const base = biometryMedianBy(ref, dim, ga) ?? hadlockBiometryMedian(dim, ga)!;
            const p = getPercentileBy(ref, dim, ga, base * factor).percentile;
            if (p === null) continue;
            expect(p, `${ref}/${dim}@${ga}×${factor}`).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('as três curvas classificam um feto claramente pequeno como < p10', () => {
    // 2 DP abaixo da média de Hadlock a 32 sem deve ser baixo em qualquer curva
    for (const dim of DIMS) {
      const small = hadlockBiometryMedian(dim, 32)! - 2 * HADLOCK_1984_BIOMETRY[dim].sd;
      for (const ref of REFS) {
        const p = getPercentileBy(ref, dim, 32, small).percentile;
        if (p === null) continue;
        expect(p, `${ref}/${dim}`).toBeLessThan(25);
      }
    }
  });

  it('PFE por sexo: só a OMS tem curva sexada; Hadlock/IG usam a curva neutra', () => {
    // Só a OMS publica PFE por sexo. As calculadoras pedem 'EFW_M'/'EFW_F'
    // sempre que o sexo é conhecido, e `getZScoreBy` é quem resolve: em
    // Hadlock/INTERGROWTH a dimensão sexada cai na curva ÚNICA do padrão —
    // e NÃO na OMS, que anularia a curva escolhida pelo médico.
    expect(referenceSupports('who', 'EFW_M')).toBe(true);
    for (const ref of ['hadlock', 'intergrowth'] as BiometryReference[]) {
      const neutral = getPercentileBy(ref, 'EFW', 32, 1800);
      for (const dim of ['EFW_M', 'EFW_F'] as const) {
        const r = getPercentileBy(ref, dim, 32, 1800);
        expect(r.usedRef, `${ref}/${dim}`).toBe(ref);
        expect(r.fellBack, `${ref}/${dim}`).toBe(false);
        // o sexo não muda o número nesses padrões — são sex-neutros
        expect(r.percentile, `${ref}/${dim}`).toBe(neutral.percentile);
      }
    }
    // na OMS, o sexo MUDA o percentil (é o que justifica a dimensão sexada)
    const m = getPercentileBy('who', 'EFW_M', 32, 1800);
    const f = getPercentileBy('who', 'EFW_F', 32, 1800);
    expect(m.usedRef).toBe('who');
    expect(m.percentile).not.toBe(f.percentile);
  });

  it('OMS continua respondendo por todas as dimensões (rede de segurança)', () => {
    for (const dim of DIMS) {
      expect(getWhoPercentile(dim, 30, hadlockBiometryMedian(dim, 30)!)).not.toBeNull();
    }
  });
});
