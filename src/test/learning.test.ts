import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../modules/ai/training/embeddings';
import { rankBySimilarity, selectExamples, buildFewShotBlock } from '../modules/ai/training/retrieval';
import { classifyCorrection, aggregatePatterns, buildCalibrationBlock, buildPersonalCalibration } from '../modules/ai/training/feedback';
import { aggregateHumanFeedback, HumanFeedback } from '../modules/ai/training/feedbackStore';
import { ExcellenceEntry } from '../modules/ai/training/excellenceCorpus';

// ═══════════════════════════════════════════════════════════════
// Testes das peças PURAS da Fase 3 (sem rede/Firestore).
// ═══════════════════════════════════════════════════════════════

describe('cosineSimilarity', () => {
  it('vetores idênticos → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
  it('vetores ortogonais → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it('vetores opostos → -1', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 5);
  });
  it('dimensões incompatíveis ou vazias → 0', () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

function entry(partial: Partial<ExcellenceEntry>): ExcellenceEntry {
  return {
    id: Math.random().toString(36).slice(2),
    area: 'medicina-interna',
    examType: 'Abdome Total',
    motor: 'lite',
    anonymizedContent: '<p>Laudo modelo.</p>',
    contextText: 'contexto',
    embedding: [],
    qualityTags: [],
    approvedAt: Date.now(),
    ...partial,
  };
}

describe('rankBySimilarity', () => {
  it('ordena por similaridade de embedding', () => {
    const query = { examType: 'X', motor: 'lite' as const, embedding: [1, 0, 0] };
    const candidates = [
      entry({ examType: 'A', embedding: [0, 1, 0] }), // ortogonal
      entry({ examType: 'B', embedding: [1, 0, 0] }), // idêntico
    ];
    const ranked = rankBySimilarity(query, candidates);
    expect(ranked[0].entry.examType).toBe('B');
  });

  it('aplica bônus de mesmo tipo de exame e motor', () => {
    const query = { examType: 'Tireoide', motor: 'pro' as const, embedding: [] };
    const candidates = [
      entry({ examType: 'Outro', motor: 'lite' }),
      entry({ examType: 'Tireoide', motor: 'pro' }),
    ];
    const ranked = rankBySimilarity(query, candidates);
    expect(ranked[0].entry.examType).toBe('Tireoide');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe('selectExamples', () => {
  it('filtra por piso de similaridade quando há embedding', () => {
    const query = { examType: 'X', motor: 'lite' as const, embedding: [1, 0, 0] };
    const candidates = [
      entry({ embedding: [1, 0, 0] }),    // sim 1.0
      entry({ embedding: [0.1, 1, 0] }),  // sim baixa
    ];
    const selected = selectExamples(query, candidates, 2);
    expect(selected.length).toBe(1);
  });

  it('fallback por tipo de exame quando não há embedding', () => {
    const query = { examType: 'Abdome Total', motor: 'lite' as const, embedding: [] };
    const candidates = [
      entry({ examType: 'Abdome Total' }),
      entry({ examType: 'Tireoide' }),
    ];
    const selected = selectExamples(query, candidates, 2);
    expect(selected.length).toBe(1);
    expect(selected[0].examType).toBe('Abdome Total');
  });
});

describe('buildFewShotBlock', () => {
  it('retorna vazio sem exemplos', () => {
    expect(buildFewShotBlock([])).toBe('');
  });
  it('inclui o conteúdo dos exemplos', () => {
    const block = buildFewShotBlock([entry({ anonymizedContent: '<p>FÍGADO normal.</p>' })]);
    expect(block).toContain('EXEMPLO 1');
    expect(block).toContain('FÍGADO normal');
  });
});

describe('classifyCorrection', () => {
  const meta = { area: 'vascular', examType: 'Aorta', motor: 'pro' as const };

  it('detecta urgência perdida como crítico', () => {
    const generated = '<p>Aorta de aspecto habitual.</p>';
    const final = '<p>Aorta de aspecto habitual.</p><p>ALERTA VASCULAR: aneurisma, avaliação urgente.</p>';
    const sig = classifyCorrection(generated, final, meta);
    expect(sig.categories).toContain('urgencia-perdida');
    expect(sig.critical).toBe(true);
    expect(sig.significant).toBe(true);
  });

  it('detecta classificação adicionada', () => {
    const generated = '<p>Nódulo sólido na mama.</p>';
    const final = '<p>Nódulo sólido na mama, BI-RADS 4.</p>';
    const sig = classifyCorrection(generated, final, { area: 'mastologia', examType: 'Mamas' });
    expect(sig.categories).toContain('classificacao');
  });

  it('detecta alteração de cálculo', () => {
    const generated = '<p>Lesão medindo 12 mm de diâmetro maior observada.</p>';
    const final = '<p>Lesão medindo 18 mm de diâmetro maior observada.</p>';
    const sig = classifyCorrection(generated, final, meta);
    expect(sig.categories).toContain('calculo');
  });

  it('laudo idêntico → magnitude 0, não significante', () => {
    const html = '<p>Fígado de dimensões normais e ecotextura homogênea.</p>';
    const sig = classifyCorrection(html, html, meta);
    expect(sig.magnitude).toBe(0);
    expect(sig.significant).toBe(false);
  });
});

describe('aggregatePatterns', () => {
  it('só retorna padrões frequentes, mas críticos sempre passam', () => {
    const base = { area: 'vascular', examType: 'Aorta', magnitude: 0.3, significant: true };
    const signals = [
      { ...base, categories: ['urgencia-perdida' as const], critical: true },
      { ...base, categories: ['fraseologia' as const], critical: false },
      { ...base, categories: ['fraseologia' as const], critical: false },
    ];
    const patterns = aggregatePatterns(signals, 5);
    // fraseologia (2x) abaixo do limiar 5 → fora; urgência crítica → dentro
    expect(patterns.length).toBe(1);
    expect(patterns[0].category).toBe('urgencia-perdida');
    expect(patterns[0].critical).toBe(true);
  });

  it('ignora sinais não significantes', () => {
    const signals = [
      { area: 'a', examType: 'b', categories: ['fraseologia' as const], magnitude: 0.01, significant: false, critical: false },
    ];
    expect(aggregatePatterns(signals, 1)).toHaveLength(0);
  });

  it('coloca padrões críticos primeiro', () => {
    const mk = (cat: any, crit: boolean, count: number) =>
      Array.from({ length: count }, () => ({
        area: 'x', examType: 'y', categories: [cat], magnitude: 0.3, significant: true, critical: crit,
      }));
    const signals = [...mk('fraseologia', false, 6), ...mk('urgencia-perdida', true, 1)];
    const patterns = aggregatePatterns(signals, 5);
    expect(patterns[0].critical).toBe(true);
  });
});

describe('buildCalibrationBlock', () => {
  it('retorna vazio sem padrões', () => {
    expect(buildCalibrationBlock([])).toBe('');
  });
  it('marca padrões críticos e cita frequência', () => {
    const block = buildCalibrationBlock([
      { area: 'vascular', examType: 'Aorta', category: 'urgencia-perdida', count: 3, critical: true },
    ]);
    expect(block).toContain('CRÍTICO');
    expect(block).toContain('vascular');
    expect(block).toContain('3x');
  });
});

describe('aggregateHumanFeedback', () => {
  const fb = (rating: 'positive' | 'negative', area = 'vascular'): HumanFeedback => ({
    area, examType: 'Aorta', rating, context: 'report-quality', createdAt: Date.now(),
  });

  it('calcula taxa de satisfação', () => {
    const a = aggregateHumanFeedback([fb('positive'), fb('positive'), fb('negative'), fb('positive')]);
    expect(a.total).toBe(4);
    expect(a.positive).toBe(3);
    expect(a.negative).toBe(1);
    expect(a.satisfactionRate).toBe(75);
  });

  it('lista áreas com feedback negativo, mais negativas primeiro', () => {
    const a = aggregateHumanFeedback([
      fb('negative', 'vascular'), fb('negative', 'vascular'),
      fb('negative', 'mastologia'), fb('positive', 'ginecologia'),
    ]);
    expect(a.worstAreas[0].area).toBe('vascular');
    expect(a.worstAreas[0].negative).toBe(2);
  });

  it('retorna zeros para lista vazia', () => {
    const a = aggregateHumanFeedback([]);
    expect(a.total).toBe(0);
    expect(a.satisfactionRate).toBe(0);
    expect(a.worstAreas).toHaveLength(0);
  });
});

describe('buildPersonalCalibration', () => {
  it('combina padrões de correção e feedback negativo', () => {
    const block = buildPersonalCalibration(
      [{ area: 'mastologia', examType: 'Mamas', category: 'classificacao', count: 4, critical: false }],
      [{ area: 'vascular', negative: 3, total: 5 }]
    );
    expect(block).toContain('CALIBRAÇÃO PESSOAL');
    expect(block).toContain('mastologia');
    expect(block).toContain('vascular');
    expect(block).toContain('insatisfat');
  });

  it('ignora áreas com menos de 2 negativos', () => {
    const block = buildPersonalCalibration([], [{ area: 'x', negative: 1, total: 10 }]);
    expect(block).toBe('');
  });

  it('retorna vazio sem dados', () => {
    expect(buildPersonalCalibration([], [])).toBe('');
  });
});
