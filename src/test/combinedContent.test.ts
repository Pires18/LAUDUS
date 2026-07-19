import { describe, it, expect } from 'vitest';
import {
  examTemplateIds,
  isCombinedExam,
  combinedExamType,
  getCombinedTitle,
  getCombinedInitialReportContent,
  getInitialReportContent,
} from '../modules/templates/utils';
import { ReportTemplate } from '../types';

function mask(over: Partial<ReportTemplate>): ReportTemplate {
  return {
    id: 'id-' + (over.name || 'x'),
    area: 'medicina-interna',
    name: 'EXAME',
    title: 'ULTRASSONOGRAFIA DE EXAME',
    technique: '<p>Exame realizado com transdutor convexo.</p>',
    analysisTemplate: '<p><strong>ÓRGÃO:</strong> [__].</p>',
    conclusionTemplate: '<p>Exame dentro dos limites da normalidade.</p>',
    recommendationsTemplate: '<p>Correlacionar com dados clínicos.</p>',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as ReportTemplate;
}

// Títulos reais das máscaras do deploy unificado (combos-alvo)
const ABDOME = mask({ name: 'ABDOME TOTAL', title: 'ULTRASSONOGRAFIA DE ABDOME TOTAL' });
const PELVICA = mask({
  name: 'PÉLVICA ABDOMINAL',
  title: 'ULTRASSONOGRAFIA PÉLVICA POR VIA ABDOMINAL',
  area: 'ginecologia' as ReportTemplate['area'],
});
const PROSTATA = mask({ name: 'PRÓSTATA VIA ABDOMINAL', title: 'ULTRASSONOGRAFIA DE PRÓSTATA (VIA ABDOMINAL)' });
const RINS = mask({ name: 'RINS E VIAS URINÁRIAS', title: 'ULTRASSONOGRAFIA DE RINS E VIAS URINÁRIAS' });

describe('examTemplateIds / isCombinedExam', () => {
  it('exame antigo (só templateId) → 1 id, não combinado', () => {
    expect(examTemplateIds({ templateId: 'a' })).toEqual(['a']);
    expect(isCombinedExam({ templateId: 'a' })).toBe(false);
  });

  it('templateIds tem precedência e define combinação', () => {
    expect(examTemplateIds({ templateId: 'a', templateIds: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(isCombinedExam({ templateId: 'a', templateIds: ['a', 'b'] })).toBe(true);
  });

  it('templateIds com 1 item = exame simples; vazio cai no templateId', () => {
    expect(isCombinedExam({ templateId: 'a', templateIds: ['a'] })).toBe(false);
    expect(examTemplateIds({ templateId: 'a', templateIds: [] })).toEqual(['a']);
    expect(examTemplateIds({})).toEqual([]);
  });
});

describe('getCombinedTitle — regra determinística', () => {
  it('Abdome Total + Pélvica Abdominal', () => {
    expect(getCombinedTitle([ABDOME, PELVICA])).toBe(
      'ULTRASSONOGRAFIA DE ABDOME TOTAL E PÉLVICA POR VIA ABDOMINAL'
    );
  });

  it('Abdome Total + Próstata', () => {
    expect(getCombinedTitle([ABDOME, PROSTATA])).toBe(
      'ULTRASSONOGRAFIA DE ABDOME TOTAL E DE PRÓSTATA (VIA ABDOMINAL)'
    );
  });

  it('Rins e Vias + Pélvica Abdominal', () => {
    expect(getCombinedTitle([RINS, PELVICA])).toBe(
      'ULTRASSONOGRAFIA DE RINS E VIAS URINÁRIAS E PÉLVICA POR VIA ABDOMINAL'
    );
  });

  it('Rins e Vias + Próstata', () => {
    expect(getCombinedTitle([RINS, PROSTATA])).toBe(
      'ULTRASSONOGRAFIA DE RINS E VIAS URINÁRIAS E DE PRÓSTATA (VIA ABDOMINAL)'
    );
  });

  it('título sem o prefixo ULTRASSONOGRAFIA é unido integralmente', () => {
    const cerv = mask({ name: 'CERVICOMETRIA', title: 'CERVICOMETRIA' });
    expect(getCombinedTitle([ABDOME, cerv])).toBe('ULTRASSONOGRAFIA DE ABDOME TOTAL E CERVICOMETRIA');
  });

  it('3 máscaras', () => {
    expect(getCombinedTitle([ABDOME, RINS, PROSTATA])).toBe(
      'ULTRASSONOGRAFIA DE ABDOME TOTAL E DE RINS E VIAS URINÁRIAS E DE PRÓSTATA (VIA ABDOMINAL)'
    );
  });
});

describe('combinedExamType', () => {
  it('nomes unidos por " + "', () => {
    expect(combinedExamType([ABDOME, PELVICA])).toBe('ABDOME TOTAL + PÉLVICA ABDOMINAL');
  });
});

describe('getCombinedInitialReportContent', () => {
  const A = mask({
    name: 'ABDOME TOTAL',
    title: 'ULTRASSONOGRAFIA DE ABDOME TOTAL',
    technique: '<p>Exame realizado com transdutor convexo.</p>',
    analysisTemplate: '<p><strong>FÍGADO:</strong> [__].</p><p><strong>BEXIGA:</strong> [__].</p>',
    conclusionTemplate: '<p>Fígado normal.</p>',
    recommendationsTemplate: '<p>Correlacionar com dados clínicos.</p>',
    observationsTemplate: '<p>Nota metodológica comum.</p>',
  });
  const B = mask({
    name: 'PÉLVICA ABDOMINAL',
    title: 'ULTRASSONOGRAFIA PÉLVICA POR VIA ABDOMINAL',
    area: 'ginecologia' as ReportTemplate['area'],
    technique: '<p>Exame realizado com repleção vesical.</p>',
    analysisTemplate: '<p><strong>ÚTERO:</strong> [__].</p><p><strong>BEXIGA:</strong> repleta [__].</p>',
    conclusionTemplate: '<p>Útero normal.</p>',
    recommendationsTemplate: '<p>Correlacionar com dados clínicos.</p>',
    observationsTemplate: '<p>Nota metodológica comum.</p>',
  });

  it('com 1 máscara é byte a byte idêntico ao builder single', () => {
    expect(getCombinedInitialReportContent([A])).toBe(getInitialReportContent(A));
    const toggles = { recommendations: false, observations: false, classification: false };
    expect(getCombinedInitialReportContent([A], toggles)).toBe(getInitialReportContent(A, toggles));
  });

  it('exatamente um <h1> (título combinado) e um <h2> por seção', () => {
    const html = getCombinedInitialReportContent([A, B]);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('ULTRASSONOGRAFIA DE ABDOME TOTAL E PÉLVICA POR VIA ABDOMINAL');
    for (const sec of ['TÉCNICA', 'ANÁLISE', 'CONCLUSÃO', 'RECOMENDAÇÕES', 'OBSERVAÇÕES METODOLÓGICAS']) {
      expect(html.match(new RegExp(`<h2>${sec}</h2>`, 'g'))).toHaveLength(1);
    }
  });

  it('ordem clínica padrão preservada', () => {
    const html = getCombinedInitialReportContent([A, B]);
    const order = ['TÉCNICA', 'ANÁLISE', 'CONCLUSÃO', 'RECOMENDAÇÕES', 'OBSERVAÇÕES METODOLÓGICAS'].map((s) =>
      html.indexOf(`<h2>${s}</h2>`)
    );
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(order.every((i) => i > -1)).toBe(true);
  });

  it('conteúdo das duas máscaras presente na ANÁLISE e CONCLUSÃO', () => {
    const html = getCombinedInitialReportContent([A, B]);
    expect(html).toContain('FÍGADO');
    expect(html).toContain('ÚTERO');
    expect(html).toContain('Fígado normal.');
    expect(html).toContain('Útero normal.');
    // Técnicas diferentes: ambas presentes
    expect(html).toContain('transdutor convexo');
    expect(html).toContain('repleção vesical');
  });

  it('dedupe: parágrafo exato repetido (recomendações/observações) aparece 1 vez', () => {
    const html = getCombinedInitialReportContent([A, B]);
    expect(html.match(/Correlacionar com dados clínicos/g)).toHaveLength(1);
    expect(html.match(/Nota metodológica comum/g)).toHaveLength(1);
  });

  it('dedupe por rótulo na ANÁLISE: BEXIGA aparece 1 vez (mantém a 1ª máscara)', () => {
    const html = getCombinedInitialReportContent([A, B]);
    expect(html.match(/<strong>BEXIGA:<\/strong>/g)).toHaveLength(1);
    expect(html).not.toContain('repleta');
  });

  it('toggles omitem seções como no builder single', () => {
    const html = getCombinedInitialReportContent([A, B], {
      recommendations: false,
      observations: false,
      classification: false,
    });
    expect(html).not.toContain('RECOMENDAÇÕES');
    expect(html).not.toContain('OBSERVAÇÕES METODOLÓGICAS');
    expect(html).not.toContain('CLASSIFICAÇÕES');
    expect(html).toContain('<h2>ANÁLISE</h2>');
  });

  it('3 máscaras concatenam na ordem', () => {
    const C = mask({
      name: 'RINS E VIAS URINÁRIAS',
      title: 'ULTRASSONOGRAFIA DE RINS E VIAS URINÁRIAS',
      analysisTemplate: '<p><strong>RINS:</strong> [__].</p>',
    });
    const html = getCombinedInitialReportContent([A, B, C]);
    expect(html.indexOf('<strong>FÍGADO:')).toBeLessThan(html.indexOf('<strong>ÚTERO:'));
    expect(html.indexOf('<strong>ÚTERO:')).toBeLessThan(html.indexOf('<strong>RINS:'));
  });

  it('máscaras nulas são ignoradas (degradação graciosa)', () => {
    expect(getCombinedInitialReportContent([A, null])).toBe(getInitialReportContent(A));
    expect(getCombinedInitialReportContent([null, undefined])).toBe('');
  });
});

describe('unificação de prosa — TÉCNICA e OBSERVAÇÕES METODOLÓGICAS', () => {
  // Boilerplates reais das máscaras de produção (deploy unificado)
  const OBS_RINS =
    '<p>Exame operador-dependente realizado segundo protocolo padronizado e em conformidade com as diretrizes de CBR e a classificação de Bosniak (2019). A avaliação pode ser limitada por interposição gasosa intestinal e pelo biotipo do paciente. Os achados devem ser correlacionados com o quadro clínico, laboratorial e estudos prévios.</p>';
  const OBS_PELVICA =
    '<p>Exame operador-dependente realizado segundo protocolo padronizado e em conformidade com as diretrizes de CBR e o sistema O-RADS US (v2022). Os achados devem ser correlacionados com o quadro clínico, laboratorial e estudos prévios.</p>';
  const OBS_PROSTATA_LIMITE =
    '<p>A avaliação pode ser limitada por interposição gasosa intestinal e pelo biotipo do paciente; a via abdominal oferece menor resolução que a via transretal para a próstata.</p>';

  const withObs = (name: string, obs: string, technique = '<p>Exame realizado.</p>') =>
    mask({ name, title: `ULTRASSONOGRAFIA DE ${name}`, observationsTemplate: obs, technique });

  const section = (html: string, title: string): string => {
    const m = html.match(new RegExp(`<h2>${title}</h2>\\n([\\s\\S]*?)(?=<h2|$)`));
    return m ? m[1] : '';
  };

  it('TÉCNICA vira UM único parágrafo com as sentenças dos dois exames', () => {
    const a = mask({ name: 'A', technique: '<p>Exame realizado com transdutores de banda larga, multifrequenciais. Análise em modo B e com Doppler colorido, quando indicado.</p>' });
    const b = mask({ name: 'B', technique: '<p>Exame realizado por via suprapúbica com transdutor convexo e repleção vesical adequada.</p>' });
    const tec = section(getCombinedInitialReportContent([a, b]), 'TÉCNICA');
    expect(tec.match(/<p>/g)).toHaveLength(1);
    expect(tec).toContain('banda larga');
    expect(tec).toContain('repleção vesical adequada');
    expect(tec).toContain('Doppler colorido');
  });

  it('OBSERVAÇÕES: frase-tronco das diretrizes é FUNDIDA citando as duas classificações', () => {
    const html = getCombinedInitialReportContent([withObs('RINS', OBS_RINS), withObs('PÉLVICA', OBS_PELVICA)]);
    const obs = section(html, 'OBSERVAÇÕES METODOLÓGICAS');
    expect(obs.match(/<p>/g)).toHaveLength(1);
    // Uma única menção ao texto operador-dependente, com AS DUAS diretrizes
    expect(obs.match(/Exame operador-dependente/g)).toHaveLength(1);
    expect(obs).toContain('classificação de Bosniak (2019) e o sistema O-RADS US (v2022)');
    // Frase idêntica de correlação clínica aparece uma vez
    expect(obs.match(/Os achados devem ser correlacionados/g)).toHaveLength(1);
    // Frase exclusiva de um exame é preservada
    expect(obs).toContain('interposição gasosa');
  });

  it('OBSERVAÇÕES: sentença que é prefixo de outra é absorvida pela mais completa', () => {
    const shorter = withObs('A', '<p>A avaliação pode ser limitada por interposição gasosa intestinal e pelo biotipo do paciente.</p>');
    const longer = withObs('B', OBS_PROSTATA_LIMITE);
    const obs = section(getCombinedInitialReportContent([shorter, longer]), 'OBSERVAÇÕES METODOLÓGICAS');
    expect(obs.match(/A avaliação pode ser limitada/g)).toHaveLength(1);
    expect(obs).toContain('via transretal para a próstata');
  });

  it('sentenças idênticas aparecem uma única vez; diferentes são mantidas em sequência', () => {
    const a = withObs('A', '<p>Frase comum idêntica nos dois exames aqui presente. Só do exame A.</p>');
    const b = withObs('B', '<p>Frase comum idêntica nos dois exames aqui presente. Só do exame B.</p>');
    const obs = section(getCombinedInitialReportContent([a, b]), 'OBSERVAÇÕES METODOLÓGICAS');
    expect(obs.match(/Frase comum idêntica/g)).toHaveLength(1);
    expect(obs).toContain('Só do exame A.');
    expect(obs).toContain('Só do exame B.');
  });
});
