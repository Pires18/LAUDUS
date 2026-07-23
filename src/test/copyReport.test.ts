// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyReportToClipboard } from '../modules/export/docxExport';

// Captura o que seria escrito no clipboard (jsdom não implementa a API)
let writtenItems: Record<string, Blob>[] = [];

class FakeClipboardItem {
  data: Record<string, Blob>;
  constructor(data: Record<string, Blob>) {
    this.data = data;
    writtenItems.push(data);
  }
}

beforeEach(() => {
  writtenItems = [];
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  Object.defineProperty(navigator, 'clipboard', {
    value: { write: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

const OFFICIAL_REPORT = [
  '<h1 style="text-align: center">ULTRASSONOGRAFIA DE ABDOME TOTAL</h1>',
  '<h2>TÉCNICA</h2>',
  '<p style="line-height: 1.8; letter-spacing: 0.05em; font-family: Arial; color: red">Exame realizado com transdutor convexo.</p>',
  '<h2>ANÁLISE</h2>',
  '<p><strong>Fígado:</strong> dimensões normais, com <em>ecotextura</em> homogênea.</p>',
  '<p style="text-align: center">Linha centralizada.</p>',
].join('\n');

async function copyAndGetHtml(input: string): Promise<string> {
  await copyReportToClipboard(input);
  return writtenItems[0]['text/html'].text();
}

describe('copyReportToClipboard — cópia sem espaçamentos', () => {
  it('remove entrelinha, espaçamento entre letras, fonte e cor', async () => {
    const html = await copyAndGetHtml(OFFICIAL_REPORT);
    expect(html).not.toContain('line-height');
    expect(html).not.toContain('letter-spacing');
    expect(html).not.toContain('font-family');
    expect(html).not.toContain('color');
  });

  it('zera as margens dos parágrafos para colar sem espaçamentos extras', async () => {
    const html = await copyAndGetHtml(OFFICIAL_REPORT);
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('p').forEach((p) => {
      expect(p.style.margin).toBe('0px');
    });
  });

  it('mantém negrito e converte títulos em parágrafo negrito', async () => {
    const html = await copyAndGetHtml(OFFICIAL_REPORT);
    expect(html).not.toMatch(/<h[1-6]/i);
    expect(html).toContain('<strong>ULTRASSONOGRAFIA DE ABDOME TOTAL</strong>');
    expect(html).toContain('<strong>TÉCNICA</strong>');
    expect(html).toContain('<strong>Fígado:</strong>');
    // Itálico é descartado, só o texto permanece
    expect(html).not.toContain('<em>');
    expect(html).toContain('ecotextura');
  });

  it('mantém o alinhamento (título centralizado e parágrafo centralizado)', async () => {
    const html = await copyAndGetHtml(OFFICIAL_REPORT);
    const container = document.createElement('div');
    container.innerHTML = html;
    const centered = Array.from(container.querySelectorAll<HTMLElement>('p'))
      .filter((p) => p.style.textAlign === 'center');
    const texts = centered.map((p) => p.textContent);
    expect(texts).toContain('ULTRASSONOGRAFIA DE ABDOME TOTAL');
    expect(texts).toContain('Linha centralizada.');
  });

  it('mantém o pulo de linha entre seções (linha em branco antes de cada h2)', async () => {
    const html = await copyAndGetHtml(OFFICIAL_REPORT);
    const container = document.createElement('div');
    container.innerHTML = html;
    const paragraphs = Array.from(container.querySelectorAll('p'));
    // Título (1) + [espaço + TÉCNICA] (2) + parágrafo (1) + [espaço + ANÁLISE] (2) + 2 parágrafos
    const spacers = paragraphs.filter((p) => p.innerHTML === '<br>');
    expect(spacers).toHaveLength(2);
    // Nenhum espaçador antes do primeiro elemento
    expect(container.firstElementChild?.textContent).toBe('ULTRASSONOGRAFIA DE ABDOME TOTAL');
  });

  it('gera versão texto puro com o conteúdo do laudo', async () => {
    await copyReportToClipboard(OFFICIAL_REPORT);
    const plain = await writtenItems[0]['text/plain'].text();
    expect(plain).toContain('ULTRASSONOGRAFIA DE ABDOME TOTAL');
    expect(plain).toContain('Fígado: dimensões normais');
  });
});
