import { describe, it, expect } from 'vitest';
import { stripScratchpad, extractScratchpad, auditReportQuality } from '../modules/ai/engine';

describe('stripScratchpad', () => {
  it('removes complete <thinking> blocks', () => {
    const input = '<thinking>internal reasoning here</thinking><h1>LAUDO</h1>';
    expect(stripScratchpad(input)).toBe('<h1>LAUDO</h1>');
  });

  it('removes complete <scratchpad> blocks', () => {
    const input = '<scratchpad>private</scratchpad><h1>RESULTADO</h1>';
    expect(stripScratchpad(input)).toBe('<h1>RESULTADO</h1>');
  });

  it('strips markdown code fences around HTML', () => {
    const input = '```html\n<h1>LAUDO</h1>\n```';
    expect(stripScratchpad(input)).toBe('<h1>LAUDO</h1>');
  });

  it('strips leading markdown code fence', () => {
    const input = '```\n<h1>LAUDO</h1>';
    expect(stripScratchpad(input)).toBe('<h1>LAUDO</h1>');
  });

  it('returns empty string for empty input', () => {
    expect(stripScratchpad('')).toBe('');
  });

  it('returns text unchanged when no blocks present', () => {
    const html = '<h1>ULTRASSONOGRAFIA</h1><p>Exame normal.</p>';
    expect(stripScratchpad(html)).toBe(html);
  });

  it('removes <think> block (alternative tag)', () => {
    const input = '<think>reasoning</think><p>Conclusão</p>';
    expect(stripScratchpad(input)).toBe('<p>Conclusão</p>');
  });

  it('removes multiline thinking blocks', () => {
    const input = '<thinking>\nLinha 1\nLinha 2\n</thinking>\n<h1>LAUDO</h1>';
    expect(stripScratchpad(input)).toContain('<h1>LAUDO</h1>');
    expect(stripScratchpad(input)).not.toContain('thinking');
  });
});

describe('extractScratchpad', () => {
  it('extracts content from <thinking> block', () => {
    const input = '<thinking>raciocínio interno</thinking><h1>LAUDO</h1>';
    expect(extractScratchpad(input)).toBe('raciocínio interno');
  });

  it('returns undefined when no block present', () => {
    expect(extractScratchpad('<h1>LAUDO</h1>')).toBeUndefined();
  });
});

describe('auditReportQuality', () => {
  it('returns score 0 for empty report', () => {
    const result = auditReportQuality('');
    expect(result.score).toBe(0);
    expect(result.issues[0].type).toBe('empty');
  });

  it('returns score 0 for very short report', () => {
    const result = auditReportQuality('<p>Curto.</p>');
    expect(result.score).toBe(0);
  });

  it('penalizes missing <h1> start', () => {
    const report = '<p>TÉCNICA ANÁLISE CONCLUSÃO RECOMENDAÇÕES OBSERVAÇÕES METODOLÓGICAS</p>'.repeat(5);
    const result = auditReportQuality(report);
    const structureIssue = result.issues.find(i => i.type === 'structure');
    expect(structureIssue).toBeDefined();
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes missing required section', () => {
    const report = '<h1>ULTRASSONOGRAFIA</h1><h2>TÉCNICA</h2><p>...</p><h2>ANÁLISE</h2><p>...</p><h2>CONCLUSÃO</h2><p>Normal.</p>'.repeat(2);
    const result = auditReportQuality(report);
    const missingSections = result.issues.filter(i => i.type === 'missing_section');
    expect(missingSections.length).toBeGreaterThan(0);
  });

  it('returns high score for well-formed report', () => {
    const report = [
      '<h1>ULTRASSONOGRAFIA ABDOMINAL</h1>',
      '<h2>TÉCNICA</h2><p>Exame realizado com equipamento de alta resolução.</p>',
      '<h2>ANÁLISE</h2><p>Parênquima hepático com ecotextura homogênea.</p>',
      '<h2>CONCLUSÃO</h2><p>Exame dentro dos limites da normalidade.</p>',
      '<h2>RECOMENDAÇÕES</h2><p>Seguimento clínico habitual.</p>',
      '<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Laudo elaborado com auxílio de IA.</p>',
    ].join('');
    const result = auditReportQuality(report);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes [___] placeholder in non-fetal area', () => {
    const report = [
      '<h1>MAMA</h1>',
      '<h2>TÉCNICA</h2><p>.</p>',
      '<h2>ANÁLISE</h2><p>Nódulo de [___] cm.</p>',
      '<h2>CONCLUSÃO</h2><p>.</p>',
      '<h2>RECOMENDAÇÕES</h2><p>.</p>',
      '<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>.</p>',
    ].join('');
    const result = auditReportQuality(report, 'mama');
    const placeholder = result.issues.find(i => i.type === 'placeholder');
    expect(placeholder).toBeDefined();
  });
});
