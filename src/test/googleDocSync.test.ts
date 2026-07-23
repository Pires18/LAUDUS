// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncGoogleDoc } from '../modules/editor/utils/googleDocSync';
import { replaceRichTextInDoc } from '../lib/googleDocs';
import type { Patient, ExamRequest, Clinic, AppSettings } from '../types';

vi.mock('../lib/googleDrive', () => ({
  copyFile: vi.fn().mockResolvedValue('doc-123'),
  deleteFile: vi.fn(),
}));

vi.mock('../lib/googleDocs', () => ({
  replaceRichTextInDoc: vi.fn().mockResolvedValue(undefined),
  replaceTextInDoc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('../store/db', () => ({
  updateItem: vi.fn().mockResolvedValue(undefined),
}));

const patient = { id: 'p1', name: 'Maria Silva', birthDate: '1980-01-01' } as Patient;
const exam = {
  id: 'e1',
  examType: 'Ultrassonografia de Abdome Total',
  examDate: 1750000000000,
} as ExamRequest;
const clinic = {
  id: 'c1',
  name: 'Clínica Teste',
  googleDocsTemplateId: 'template-1',
} as Clinic;

const REPORT = [
  '<h1 style="text-align: center">Ultrassonografia de Abdome Total</h1>',
  '<h2>TÉCNICA</h2>',
  '<p>Exame realizado com transdutor convexo.</p>',
  '<h2>ANÁLISE</h2>',
  '<p><strong>Fígado:</strong> dimensões normais.</p>',
  '<h2>CONCLUSÃO</h2>',
  '<p>Exame dentro dos limites da normalidade.</p>',
].join('\n');

beforeEach(() => {
  vi.mocked(replaceRichTextInDoc).mockClear();
});

describe('syncGoogleDoc — padronização oficial do laudo no Google Docs', () => {
  it('envia título centralizado/negrito/caixa alta e corpo justificado por padrão', async () => {
    await syncGoogleDoc('e1', REPORT, patient, exam, clinic, {} as AppSettings);

    expect(replaceRichTextInDoc).toHaveBeenCalledTimes(1);
    const [docId, , sectionRuns, paragraphStyles] = vi.mocked(replaceRichTextInDoc).mock.calls[0];

    expect(docId).toBe('doc-123');

    // Título em caixa alta e negrito
    expect(sectionRuns.titulo_laudo).toEqual([
      { text: 'ULTRASSONOGRAFIA DE ABDOME TOTAL', bold: true },
    ]);

    // Alinhamentos da padronização oficial
    expect(paragraphStyles?.titulo_laudo).toEqual({ alignment: 'CENTER' });
    expect(paragraphStyles?.tecnica_laudo).toEqual({ alignment: 'JUSTIFIED' });
    expect(paragraphStyles?.analise_laudo).toEqual({ alignment: 'JUSTIFIED' });
    expect(paragraphStyles?.conclusao_laudo).toEqual({ alignment: 'JUSTIFIED' });
  });

  it('respeita a configuração de alinhamento à esquerda (pdfTextAlign: left)', async () => {
    await syncGoogleDoc('e1', REPORT, patient, exam, clinic, { pdfTextAlign: 'left' } as AppSettings);

    const [, , , paragraphStyles] = vi.mocked(replaceRichTextInDoc).mock.calls[0];
    expect(paragraphStyles?.titulo_laudo).toEqual({ alignment: 'CENTER' });
    expect(paragraphStyles?.tecnica_laudo).toEqual({ alignment: 'START' });
  });

  it('mantém negrito do conteúdo e distribui as seções nos placeholders', async () => {
    await syncGoogleDoc('e1', REPORT, patient, exam, clinic, {} as AppSettings);

    const [, , sectionRuns] = vi.mocked(replaceRichTextInDoc).mock.calls[0];
    expect(sectionRuns.tecnica_laudo.map((r) => r.text).join('')).toContain('transdutor convexo');
    const boldRun = sectionRuns.analise_laudo.find((r) => r.bold);
    expect(boldRun?.text).toBe('Fígado:');
    expect(sectionRuns.conclusao_laudo.map((r) => r.text).join('')).toContain('limites da normalidade');
  });

  it('usa o tipo do exame em negrito como título quando o laudo não tem <h1>', async () => {
    await syncGoogleDoc('e1', '<h2>ANÁLISE</h2><p>Texto.</p>', patient, exam, clinic, {} as AppSettings);

    const [, , sectionRuns] = vi.mocked(replaceRichTextInDoc).mock.calls[0];
    expect(sectionRuns.titulo_laudo).toEqual([
      { text: 'ULTRASSONOGRAFIA DE ABDOME TOTAL', bold: true },
    ]);
  });
});
