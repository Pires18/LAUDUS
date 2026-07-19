import { describe, it, expect } from 'vitest';
import { buildPrompt, buildRefinePrompt, buildCopilotPrompt, auditReportQuality } from '../modules/ai/engine';
import { getCombinedTitle } from '../modules/templates/utils';
import { ReportTemplate, AppSettings } from '../types';

function mask(over: Partial<ReportTemplate>): ReportTemplate {
  return {
    id: 'id-' + (over.name || 'x'),
    area: 'medicina-interna',
    name: 'EXAME',
    title: 'ULTRASSONOGRAFIA DE EXAME',
    technique: '<p>Técnica padrão.</p>',
    analysisTemplate: '<p><strong>ÓRGÃO:</strong> [__].</p>',
    conclusionTemplate: '<p>Normal.</p>',
    recommendationsTemplate: '<p>Correlacionar.</p>',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as ReportTemplate;
}

const ABDOME = mask({
  name: 'ABDOME TOTAL',
  title: 'ULTRASSONOGRAFIA DE ABDOME TOTAL',
  aiInstructions: 'Regras do abdome total.',
});
const PELVICA = mask({
  name: 'PÉLVICA ABDOMINAL',
  title: 'ULTRASSONOGRAFIA PÉLVICA POR VIA ABDOMINAL',
  area: 'ginecologia' as ReportTemplate['area'],
  aiInstructions: 'Regras da pélvica.',
});
const PROSTATA = mask({
  name: 'PRÓSTATA VIA ABDOMINAL',
  title: 'ULTRASSONOGRAFIA DE PRÓSTATA (VIA ABDOMINAL)',
  aiInstructions: 'Regras da próstata.',
});

const SETTINGS = {} as AppSettings;

const base = (tpls: ReportTemplate[]) => ({
  template: tpls[0],
  templates: tpls.length > 1 ? tpls : undefined,
  patient: null,
  settings: SETTINGS,
});

describe('buildPrompt — laudo combinado', () => {
  it('áreas distintas ⇒ duas diretrizes de área, uma vez cada', () => {
    const built = buildPrompt(base([ABDOME, PELVICA]) as any);
    expect(built.areaContext.match(/INSTRUÇÕES DA ÁREA DE MEDICINA-INTERNA:/g)).toHaveLength(1);
    expect(built.areaContext.match(/INSTRUÇÕES DA ÁREA DE GINECOLOGIA:/g)).toHaveLength(1);
  });

  it('mesma área ⇒ uma única diretriz de área', () => {
    const built = buildPrompt(base([ABDOME, PROSTATA]) as any);
    expect(built.areaContext.match(/INSTRUÇÕES DA ÁREA DE MEDICINA-INTERNA:/g)).toHaveLength(1);
    expect(built.areaContext).not.toContain('GINECOLOGIA');
  });

  it('um bloco de Camada 3 por máscara, com cabeçalho identificando o exame', () => {
    const built = buildPrompt(base([ABDOME, PELVICA]) as any);
    expect(built.areaContext).toContain('INSTRUÇÕES ESPECÍFICAS DO EXAME — ABDOME TOTAL:');
    expect(built.areaContext).toContain('INSTRUÇÕES ESPECÍFICAS DO EXAME — PÉLVICA ABDOMINAL:');
    expect(built.areaContext).toContain('Regras do abdome total.');
    expect(built.areaContext).toContain('Regras da pélvica.');
  });

  it('userMessage contém diretriz LAUDO COMBINADO, título combinado e os dois exames', () => {
    const built = buildPrompt(base([ABDOME, PELVICA]) as any);
    expect(built.userMessage).toContain('LAUDO COMBINADO');
    expect(built.userMessage).toContain(getCombinedTitle([ABDOME, PELVICA]));
    expect(built.userMessage).toContain('═══ EXAME 1 — ABDOME TOTAL ═══');
    expect(built.userMessage).toContain('═══ EXAME 2 — PÉLVICA ABDOMINAL ═══');
    expect(built.userMessage).toContain('EXAME: ABDOME TOTAL + PÉLVICA ABDOMINAL');
  });

  it('exame simples: saída idêntica à de antes (sem sufixo no cabeçalho, sem diretriz combinada)', () => {
    const built = buildPrompt(base([ABDOME]) as any);
    expect(built.areaContext).toContain('INSTRUÇÕES ESPECÍFICAS DO EXAME:');
    expect(built.areaContext).not.toContain('INSTRUÇÕES ESPECÍFICAS DO EXAME —');
    expect(built.userMessage).not.toContain('LAUDO COMBINADO');
    expect(built.userMessage).not.toContain('═══ EXAME 1');
    expect(built.userMessage).toContain('EXAME: ABDOME TOTAL');
    // params.templates ausente e [template] são equivalentes
    const viaArray = buildPrompt({ ...base([ABDOME]), templates: [ABDOME] } as any);
    expect(viaArray.userMessage).toBe(built.userMessage);
    expect(viaArray.areaContext).toBe(built.areaContext);
  });
});

describe('buildRefinePrompt — âncora estrutural combinada', () => {
  it('originalMaskHtml é o laudo-base combinado (um <h1> com o título combinado)', () => {
    const built = buildRefinePrompt({
      ...base([ABDOME, PELVICA]),
      currentReport: '<h1>X</h1>',
    } as any);
    expect(built.userMessage).toContain(getCombinedTitle([ABDOME, PELVICA]));
    expect(built.userMessage).toContain('MÁSCARA MODELO ORIGINAL DO EXAME');
  });
});

describe('buildCopilotPrompt — contexto combinado', () => {
  it('injeta as duas áreas e a âncora combinada', () => {
    const built = buildCopilotPrompt({
      instruction: 'ajuste',
      currentReport: '<h1>X</h1>',
      patient: null,
      exam: { examType: 'ABDOME TOTAL + PÉLVICA ABDOMINAL', area: 'medicina-interna' },
      settings: SETTINGS,
      template: ABDOME,
      templates: [ABDOME, PELVICA],
    } as any);
    expect(built.areaContext).toContain('INSTRUÇÕES DA ÁREA DE MEDICINA-INTERNA:');
    expect(built.areaContext).toContain('INSTRUÇÕES DA ÁREA DE GINECOLOGIA:');
    expect(built.userMessage).toContain(getCombinedTitle([ABDOME, PELVICA]));
  });
});

describe('auditReportQuality — conjunto de áreas', () => {
  const htmlBase = (analise: string) => `<h1>LAUDO</h1>
<h2>TÉCNICA</h2><p>Técnica.</p>
<h2>ANÁLISE</h2>${analise}
<h2>CONCLUSÃO</h2><p>• Achados descritos acima.</p>
<h2>RECOMENDAÇÕES</h2><p>• Correlacionar com dados clínicos e seguimento.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Exame realizado conforme protocolo padrão da clínica.</p>`;

  it('regra de medicina-interna (Bosniak) dispara com array de áreas', () => {
    const html = htmlBase('<p>Cisto renal com septos espessos e calcificação grosseira.</p>');
    const r = auditReportQuality(html, ['medicina-interna', 'ginecologia']);
    expect(r.issues.some((i) => i.type === 'classification')).toBe(true);
  });

  it('regra de ginecologia (O-RADS) dispara com array de áreas', () => {
    const html = htmlBase('<p>Ovário direito com formação cística complexa, apresentando componente sólido.</p>');
    const r = auditReportQuality(html, ['medicina-interna', 'ginecologia']);
    expect(r.issues.some((i) => i.type === 'classification')).toBe(true);
  });

  it('string única mantém comportamento atual (não dispara regra de outra área)', () => {
    const html = htmlBase('<p>Ovário direito com formação cística complexa, apresentando componente sólido.</p>');
    const r = auditReportQuality(html, 'medicina-interna');
    expect(r.issues.some((i) => i.type === 'classification')).toBe(false);
  });
});
