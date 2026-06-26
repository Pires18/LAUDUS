import { describe, it, expect } from 'vitest';
import { anonymizeReport, detectResidualPII } from '../modules/ai/training/anonymize';
import { GOLDEN_DATASET, goldenCasesByArea } from '../modules/ai/training/goldenDataset';
import { DIMENSION_WEIGHTS, HardAssertion } from '../modules/ai/training/types';
import { checkAssertions } from '../modules/ai/training/harness';
import { Patient } from '../types';

// ═══════════════════════════════════════════════════════════════
// Testes da camada DETERMINÍSTICA do harness (sem IA).
// O juiz LLM e a geração não são testados aqui (exigem rede).
// ═══════════════════════════════════════════════════════════════

const mockPatient: Patient = {
  id: 'p1',
  name: 'João Carlos da Silva',
  cpf: '123.456.789-00',
  phone: '(11) 98765-4321',
  email: 'joao.silva@email.com',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('anonymizeReport', () => {
  it('substitui o nome completo do paciente', () => {
    const html = '<p>Paciente João Carlos da Silva compareceu ao exame.</p>';
    const { text } = anonymizeReport(html, mockPatient);
    expect(text).not.toContain('João');
    expect(text).not.toContain('Silva');
    expect(text).toContain('[PACIENTE]');
  });

  it('substitui partes isoladas do nome', () => {
    const html = '<p>Silva apresentou achados normais.</p>';
    const { text } = anonymizeReport(html, mockPatient);
    expect(text).not.toContain('Silva');
  });

  it('redige CPF, telefone e e-mail por regex mesmo sem objeto Patient', () => {
    const html = '<p>CPF 987.654.321-00, tel (21) 91234-5678, contato a@b.com</p>';
    const { text } = anonymizeReport(html);
    expect(text).toContain('[CPF]');
    expect(text).toContain('[EMAIL]');
    expect(text).not.toContain('987.654.321-00');
    expect(text).not.toContain('a@b.com');
  });

  it('redige datas no formato brasileiro', () => {
    const html = '<p>Exame realizado em 25/06/2026.</p>';
    const { text } = anonymizeReport(html);
    expect(text).toContain('[DATA]');
    expect(text).not.toContain('25/06/2026');
  });

  it('preserva o conteúdo clínico e as medidas', () => {
    const html = '<p>Aorta medindo 5,8 cm. Fígado homogêneo.</p>';
    const { text } = anonymizeReport(html, mockPatient);
    expect(text).toContain('5,8 cm');
    expect(text).toContain('Fígado homogêneo');
  });

  it('reporta contagem de redações por categoria', () => {
    const html = '<p>João Carlos da Silva, CPF 123.456.789-00</p>';
    const { redactions } = anonymizeReport(html, mockPatient);
    expect(redactions.nome).toBeGreaterThan(0);
    expect(redactions.cpf).toBeGreaterThan(0);
  });

  it('lida com entrada vazia sem erro', () => {
    const { text, redactions } = anonymizeReport('');
    expect(text).toBe('');
    expect(Object.keys(redactions)).toHaveLength(0);
  });
});

describe('detectResidualPII', () => {
  it('detecta PII residual após anonimização incompleta', () => {
    const problems = detectResidualPII('Contato: 111.222.333-44');
    expect(problems).toContain('cpf');
  });

  it('retorna vazio para texto limpo', () => {
    const problems = detectResidualPII('Fígado de dimensões normais, ecotextura homogênea.');
    expect(problems).toHaveLength(0);
  });
});

describe('DIMENSION_WEIGHTS', () => {
  it('soma exatamente 1.0', () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('prioriza fidelidade e segurança (juntas ≥ 50%)', () => {
    expect(DIMENSION_WEIGHTS.fidelity + DIMENSION_WEIGHTS.safety).toBeGreaterThanOrEqual(0.5);
  });
});

describe('checkAssertions', () => {
  const a = (kind: HardAssertion['kind'], value: string): HardAssertion => ({
    kind, value, dimension: 'safety', description: 't',
  });

  it('casa "biopsia" mesmo quando o laudo escreve "biópsia" (sem acento)', () => {
    const report = '<p>Recomenda-se biópsia guiada por imagem.</p>';
    expect(checkAssertions(report, [a('mustContain', 'biopsia')])).toHaveLength(0);
  });

  it('ignora tags HTML no casamento', () => {
    const report = '<p>BI-RADS <strong>5</strong></p>';
    expect(checkAssertions(report, [a('mustMatch', 'bi-?rads\\s*5')])).toHaveLength(0);
  });

  it('mustNotContain falha quando o termo (com acento) está presente', () => {
    const report = '<p>ALERTA VASCULAR.</p>';
    expect(checkAssertions(report, [a('mustNotContain', 'alerta')])).toHaveLength(1);
  });

  it('reporta asserção mustContain não satisfeita', () => {
    const report = '<p>Exame normal.</p>';
    expect(checkAssertions(report, [a('mustContain', 'aneurisma')])).toHaveLength(1);
  });
});

describe('GOLDEN_DATASET', () => {
  it('possui casos com ids únicos', () => {
    const ids = GOLDEN_DATASET.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo caso tem laudo de referência não-trivial', () => {
    for (const c of GOLDEN_DATASET) {
      expect(c.referenceReport.length).toBeGreaterThan(100);
    }
  });

  it('inclui ao menos um caso-armadilha de segurança com asserção ALERTA', () => {
    const hasSafetyTrap = GOLDEN_DATASET.some((c) =>
      c.hardAssertions?.some((a) => a.dimension === 'safety' && a.kind === 'mustContain' && a.value === 'ALERTA')
    );
    expect(hasSafetyTrap).toBe(true);
  });

  it('filtra casos por área corretamente', () => {
    const vascular = goldenCasesByArea('vascular');
    expect(vascular.length).toBeGreaterThan(0);
    expect(vascular.every((c) => c.area === 'vascular')).toBe(true);
  });
});
