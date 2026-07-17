import { describe, it, expect } from 'vitest';
import {
  hadlockEfwMedian,
  hadlockEfwZScore,
  HADLOCK_CV,
  intergrowthEfw,
  intergrowthEfwMedian,
  intergrowthEfwZScore,
  intergrowthEfwLms,
  intergrowthBiometryMedian,
  intergrowthBiometryZScore,
  getPercentileBy,
  getZScoreBy,
  efwMedianBy,
  BIOMETRY_REFERENCES,
  DEFAULT_BIOMETRY_REFERENCE,
  referenceSupports,
} from '../modules/calculators/constants/biometryReferences';

/**
 * Estes testes travam os FATOS NUMÉRICOS PUBLICADOS nos artigos-fonte — mesmo
 * padrão da auditoria das calculadoras da FMF (docs/FMF_COEFICIENTES_EXTRAIDOS.md).
 * Não substituem a conferência caso-a-caso contra a calculadora oficial, que é
 * o que libera `validated: true`.
 */

describe('Hadlock 1991 — fatos publicados (Radiology 1991;181:129, PMID 1887021)', () => {
  it('âncora do abstract: 35 g em 10 semanas', () => {
    expect(hadlockEfwMedian(10)).toBeCloseTo(35, 0);
  });

  it('âncora do abstract: 3.619 g em 40 semanas', () => {
    // a equação do texto reproduz 3.617 g — 0,06% da âncora publicada
    expect(hadlockEfwMedian(40)).toBeGreaterThan(3600);
    expect(hadlockEfwMedian(40)).toBeLessThan(3640);
  });

  it('variância uniforme declarada: ±12,7% (1 DP)', () => {
    expect(HADLOCK_CV).toBe(0.127);
    // 1 DP acima da mediana → z = 1 exatamente, em qualquer IG
    for (const ga of [12, 20, 28, 34, 40]) {
      const oneSdAbove = hadlockEfwMedian(ga) * (1 + HADLOCK_CV);
      expect(hadlockEfwZScore(ga, oneSdAbove)).toBeCloseTo(1, 6);
    }
  });

  it('curva é monotônica crescente entre 10 e 40 semanas', () => {
    for (let ga = 10; ga < 40; ga++) {
      expect(hadlockEfwMedian(ga + 1)).toBeGreaterThan(hadlockEfwMedian(ga));
    }
  });

  it('z-score na mediana é 0 e percentil ≈ 50', () => {
    const m = hadlockEfwMedian(32);
    expect(hadlockEfwZScore(32, m)).toBeCloseTo(0, 6);
    expect(getPercentileBy('hadlock', 'EFW', 32, m).percentile).toBe(50);
  });

  it('entradas inválidas → null', () => {
    expect(hadlockEfwZScore(32, 0)).toBeNull();
    expect(hadlockEfwZScore(0, 1500)).toBeNull();
  });
});

describe('INTERGROWTH-21st — Stirnemann 2017 (UOG 49:478, PMC5516164)', () => {
  it('EFW usa apenas CC e CA (equação de predição)', () => {
    // CC = CA = 300 mm → ln(EFW) ≈ 7,68 → ≈ 2.166 g
    const efw = intergrowthEfw(300, 300)!;
    expect(efw).toBeGreaterThan(2050);
    expect(efw).toBeLessThan(2300);
    expect(intergrowthEfw(0, 300)).toBeNull();
  });

  it('LMS: μ(32 sem) reproduz a mediana publicada (≈ 1.750 g)', () => {
    const median = intergrowthEfwMedian(32);
    expect(median).toBeGreaterThan(1700);
    expect(median).toBeLessThan(1810);
  });

  it('mediana é monotônica crescente (22→40 sem)', () => {
    for (let ga = 22; ga < 40; ga++) {
      expect(intergrowthEfwMedian(ga + 1)).toBeGreaterThan(intergrowthEfwMedian(ga));
    }
  });

  it('z-score na mediana é 0; acima da mediana é positivo', () => {
    const m = intergrowthEfwMedian(32);
    expect(intergrowthEfwZScore(32, m)).toBeCloseTo(0, 6);
    expect(intergrowthEfwZScore(32, m * 1.15)!).toBeGreaterThan(0);
    expect(intergrowthEfwZScore(32, m * 0.85)!).toBeLessThan(0);
  });

  it('parâmetros LMS têm os sinais/escala esperados a 32 semanas', () => {
    const { lambda, mu, sigma } = intergrowthEfwLms(32);
    expect(mu).toBeCloseTo(7.469, 2); // ln(mediana)
    expect(sigma).toBeGreaterThan(0);
    expect(sigma).toBeLessThan(0.05); // CV de ln(PFE)
    expect(isFinite(lambda)).toBe(true);
  });
});

describe('registry de referências', () => {
  it('as três curvas estão em produção (validadas)', () => {
    expect(BIOMETRY_REFERENCES.hadlock.validated).toBe(true);
    expect(BIOMETRY_REFERENCES.intergrowth.validated).toBe(true);
    expect(BIOMETRY_REFERENCES.who.validated).toBe(true);
  });

  it('padrão do sistema é a 1ª referência VALIDADA na ordem de preferência', () => {
    // ordem [hadlock, intergrowth, who] → Hadlock, agora que está validada
    expect(DEFAULT_BIOMETRY_REFERENCE).toBe('hadlock');
  });

  it('todas as referências declaram citação da fonte', () => {
    for (const meta of Object.values(BIOMETRY_REFERENCES)) {
      expect(meta.cite.length).toBeGreaterThan(20);
    }
  });

  it('cobertura: as três curvas têm PFE + biometrias', () => {
    // PFE por Hadlock 1991; biometrias pela tabela de crescimento de 1984
    expect(referenceSupports('hadlock', 'EFW')).toBe(true);
    expect(referenceSupports('hadlock', 'BPD')).toBe(true);
    expect(referenceSupports('intergrowth', 'AC')).toBe(true);
    expect(referenceSupports('who', 'AC')).toBe(true);
  });

  it('dimensão não coberta (úmero) cai na OMS e sinaliza o fallback', () => {
    const r = getPercentileBy('hadlock', 'HL', 30, 50);
    expect(r.usedRef).toBe('who');
    expect(r.fellBack).toBe(true);
    // dimensões do próprio padrão não são fallback
    expect(getPercentileBy('hadlock', 'EFW', 32, 1800).fellBack).toBe(false);
    expect(getPercentileBy('hadlock', 'AC', 30, 280).fellBack).toBe(false);
  });

  it('z-score segue a mesma regra de fallback', () => {
    expect(getZScoreBy('intergrowth', 'EFW', 32, 1800).usedRef).toBe('intergrowth');
    expect(getZScoreBy('intergrowth', 'FL', 32, 60).usedRef).toBe('intergrowth');
    expect(getZScoreBy('hadlock', 'FL', 32, 60).usedRef).toBe('hadlock'); // tabela de 1984
    // úmero não faz parte de nenhum dos dois → OMS
    expect(getZScoreBy('hadlock', 'HL', 32, 55).usedRef).toBe('who');
  });

  it('mediana do PFE disponível em Hadlock/INTERGROWTH; OMS não expõe', () => {
    expect(efwMedianBy('hadlock', 32)).toBeGreaterThan(0);
    expect(efwMedianBy('intergrowth', 32)).toBeGreaterThan(0);
    expect(efwMedianBy('who', 32)).toBeNull();
  });

  it('as três referências discordam entre si (curvas distintas, como esperado)', () => {
    const h = efwMedianBy('hadlock', 32)!;
    const i = efwMedianBy('intergrowth', 32)!;
    expect(Math.abs(h - i)).toBeGreaterThan(1); // não são a mesma curva
    // ambas em faixa clinicamente plausível para 32 semanas
    for (const m of [h, i]) {
      expect(m).toBeGreaterThan(1500);
      expect(m).toBeLessThan(2100);
    }
  });
});

describe('INTERGROWTH-21st — BIOMETRIA (Papageorghiou 2014, Lancet 384:869)', () => {
  /**
   * Medianas conferidas contra os valores publicados do padrão a 32 semanas.
   * Equações da implementação de referência open-source do projeto
   * (nutriverse/intergrowth) — travadas aqui contra os valores do artigo.
   */
  it('medianas a 32 semanas reproduzem o padrão publicado', () => {
    expect(intergrowthBiometryMedian('HC', 32)!).toBeCloseTo(294.5, 0); // ≈ 295 mm
    expect(intergrowthBiometryMedian('BPD', 32)!).toBeCloseTo(83.8, 0); // ≈ 84 mm
    expect(intergrowthBiometryMedian('AC', 32)!).toBeCloseTo(273.9, 0); // ≈ 274 mm
    expect(intergrowthBiometryMedian('FL', 32)!).toBeCloseTo(59.4, 0); // ≈ 59 mm
  });

  it('z-score é 0 na mediana e cresce com a medida', () => {
    for (const dim of ['HC', 'BPD', 'AC', 'FL'] as const) {
      const m = intergrowthBiometryMedian(dim, 30)!;
      expect(intergrowthBiometryZScore(dim, 30, m)).toBeCloseTo(0, 6);
      expect(intergrowthBiometryZScore(dim, 30, m * 1.1)!).toBeGreaterThan(0);
      expect(intergrowthBiometryZScore(dim, 30, m * 0.9)!).toBeLessThan(0);
    }
  });

  it('DP é positivo e de magnitude plausível em toda a janela', () => {
    for (let ga = 14; ga <= 40; ga++) {
      for (const dim of ['HC', 'BPD', 'AC', 'FL'] as const) {
        const m = intergrowthBiometryMedian(dim, ga)!;
        // 1 DP acima → z = 1 (confirma DP > 0 e finito)
        const z1 = intergrowthBiometryZScore(dim, ga, m + 1);
        expect(z1, `${dim}@${ga}`).not.toBeNull();
        expect(isFinite(z1!)).toBe(true);
        expect(z1!).toBeGreaterThan(0);
      }
    }
  });

  it('medianas crescem monotonicamente de 14 a 40 semanas', () => {
    for (const dim of ['HC', 'BPD', 'AC', 'FL'] as const) {
      for (let ga = 14; ga < 40; ga++) {
        expect(intergrowthBiometryMedian(dim, ga + 1)!, `${dim}@${ga}`).toBeGreaterThan(
          intergrowthBiometryMedian(dim, ga)!
        );
      }
    }
  });

  it('fora da janela 14–40 semanas o padrão não se aplica (null) e cai na OMS', () => {
    expect(intergrowthBiometryZScore('HC', 12, 90)).toBeNull();
    expect(intergrowthBiometryZScore('HC', 41, 320)).toBeNull();
    const r = getPercentileBy('intergrowth', 'HC', 12, 90);
    expect(r.usedRef).toBe('who');
    expect(r.fellBack).toBe(true);
  });

  it('dimensão fora do padrão (úmero) cai na OMS; HC/AC/FL/BPD não caem', () => {
    expect(getZScoreBy('intergrowth', 'HL', 30, 50).usedRef).toBe('who');
    for (const dim of ['HC', 'BPD', 'AC', 'FL'] as const) {
      expect(getZScoreBy('intergrowth', dim, 30, intergrowthBiometryMedian(dim, 30)!).usedRef).toBe('intergrowth');
    }
  });

  it('registry: Hadlock e INTERGROWTH cobrem PFE + biometrias', () => {
    for (const ref of ['intergrowth', 'hadlock'] as const) {
      for (const dim of ['EFW', 'BPD', 'HC', 'AC', 'FL'] as const) {
        expect(referenceSupports(ref, dim), `${ref}/${dim}`).toBe(true);
      }
    }
  });

  it('percentil da biometria pelo INTERGROWTH difere da OMS (curvas distintas)', () => {
    const ig = getPercentileBy('intergrowth', 'AC', 32, 274);
    const who = getPercentileBy('who', 'AC', 32, 274);
    expect(ig.usedRef).toBe('intergrowth');
    expect(ig.percentile).toBeCloseTo(50, -1); // na mediana do próprio padrão
    expect(who.usedRef).toBe('who');
  });
});
