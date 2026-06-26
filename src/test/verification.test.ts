import { describe, it, expect } from 'vitest';
import { verifyReport } from '../modules/ai/verification';

// ═══════════════════════════════════════════════════════════════
// Testes da camada anti-alucinação (determinística).
// ═══════════════════════════════════════════════════════════════

const NORMAL_ABDOME = `<h1>USG ABDOME</h1>
<h2>TÉCNICA</h2><p>Transdutor convexo.</p>
<h2>ANÁLISE</h2><p><strong>FÍGADO:</strong> homogêneo, sem lesões.</p>
<h2>CONCLUSÃO</h2><p>• Exame dentro da normalidade.</p>
<h2>RECOMENDAÇÕES</h2><p>• Rotina.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Limitado por gases.</p>`;

describe('verifyReport — unidades', () => {
  it('reprova medida em cm em medicina-fetal', () => {
    const html = `<h1>MORFOLÓGICO</h1>
<h2>ANÁLISE</h2><p>DBP medindo 5,2 cm.</p>
<h2>CONCLUSÃO</h2><p>• Normal.</p>`;
    const r = verifyReport(html, { area: 'medicina-fetal' });
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.type === 'unit' && i.severity === 'error')).toBe(true);
  });

  it('aceita cm em medicina-interna', () => {
    const r = verifyReport(NORMAL_ABDOME.replace('homogêneo', 'medindo 12,0 cm'), { area: 'medicina-interna' });
    expect(r.issues.some((i) => i.type === 'unit')).toBe(false);
  });

  it('ignora cm na seção de observações metodológicas em fetal', () => {
    const html = `<h1>MORFOLÓGICO</h1>
<h2>ANÁLISE</h2><p>DBP medindo 52,0 mm.</p>
<h2>CONCLUSÃO</h2><p>• Normal.</p>
<h2>OBSERVAÇÕES METODOLÓGICAS</h2><p>Distância da pele de 3 cm.</p>`;
    const r = verifyReport(html, { area: 'medicina-fetal' });
    expect(r.issues.some((i) => i.type === 'unit')).toBe(false);
  });
});

describe('verifyReport — classificações obrigatórias', () => {
  it('reprova nódulo mamário sem BI-RADS', () => {
    const html = `<h1>USG MAMAS</h1>
<h2>ANÁLISE</h2><p>Nódulo sólido na mama direita.</p>
<h2>CONCLUSÃO</h2><p>• Nódulo a esclarecer.</p>`;
    const r = verifyReport(html, { area: 'mastologia' });
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.type === 'missing_classification')).toBe(true);
  });

  it('aceita nódulo mamário com BI-RADS', () => {
    const html = `<h1>USG MAMAS</h1>
<h2>ANÁLISE</h2><p>Nódulo sólido na mama direita, BI-RADS 3.</p>
<h2>CONCLUSÃO</h2><p>• Nódulo BI-RADS 3.</p>`;
    const r = verifyReport(html, { area: 'mastologia' });
    expect(r.issues.some((i) => i.type === 'missing_classification' && i.severity === 'error')).toBe(false);
  });

  it('reprova nódulo tireoidiano sem TI-RADS', () => {
    const html = `<h1>USG TIREOIDE</h1>
<h2>ANÁLISE</h2><p>Tireoide com nódulo sólido no lobo direito.</p>
<h2>CONCLUSÃO</h2><p>• Nódulo tireoidiano.</p>`;
    const r = verifyReport(html, { area: 'pequenas-partes' });
    expect(r.issues.some((i) => i.type === 'missing_classification')).toBe(true);
  });
});

describe('verifyReport — coerência', () => {
  it('sinaliza classificação na conclusão ausente na análise', () => {
    const html = `<h1>USG MAMAS</h1>
<h2>ANÁLISE</h2><p>Nódulo sólido sem maiores detalhes, BI-RADS 4.</p>
<h2>CONCLUSÃO</h2><p>• Achado TI-RADS 4.</p>`;
    const r = verifyReport(html, { area: 'mastologia' });
    expect(r.issues.some((i) => i.type === 'coherence')).toBe(true);
  });

  it('sinaliza ALERTA na conclusão sem base na análise', () => {
    const html = `<h1>USG</h1>
<h2>ANÁLISE</h2><p>Estruturas de aspecto habitual.</p>
<h2>CONCLUSÃO</h2><p>• ALERTA: avaliação urgente.</p>`;
    const r = verifyReport(html, { area: 'vascular' });
    expect(r.issues.some((i) => i.type === 'coherence')).toBe(true);
  });

  it('aceita ALERTA com base de urgência na análise', () => {
    const html = `<h1>USG AORTA</h1>
<h2>ANÁLISE</h2><p>Aneurisma de aorta de 5,8 cm, acima do limiar cirúrgico.</p>
<h2>CONCLUSÃO</h2><p>• ALERTA VASCULAR: avaliação cirúrgica urgente.</p>`;
    const r = verifyReport(html, { area: 'vascular' });
    expect(r.issues.some((i) => i.type === 'coherence')).toBe(false);
  });
});

describe('verifyReport — rastreabilidade de medidas', () => {
  it('marca medida ausente da entrada como info (não bloqueia)', () => {
    const html = `<h1>USG</h1>
<h2>ANÁLISE</h2><p>Lesão medindo 47 mm.</p>
<h2>CONCLUSÃO</h2><p>• Achado.</p>`;
    const r = verifyReport(html, { area: 'medicina-interna', anamnesis: 'Paciente assintomático.' });
    const info = r.issues.find((i) => i.type === 'ungrounded_measurement');
    expect(info?.severity).toBe('info');
    expect(r.passed).toBe(true); // info nunca reprova
  });

  it('não verifica rastreabilidade sem entrada clínica', () => {
    const html = `<h1>USG</h1><h2>ANÁLISE</h2><p>Lesão de 47 mm.</p><h2>CONCLUSÃO</h2><p>• Achado.</p>`;
    const r = verifyReport(html, { area: 'medicina-interna' });
    expect(r.issues.some((i) => i.type === 'ungrounded_measurement')).toBe(false);
  });
});

describe('verifyReport — geral', () => {
  it('aprova laudo normal sem problemas', () => {
    const r = verifyReport(NORMAL_ABDOME, { area: 'medicina-interna' });
    expect(r.passed).toBe(true);
  });

  it('reprova laudo vazio', () => {
    const r = verifyReport('', {});
    expect(r.passed).toBe(false);
  });
});
