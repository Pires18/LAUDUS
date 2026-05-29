import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import { ExamRequest, Patient, AppSettings, Clinic } from '../../types';
import { formatDate, calculateAge } from '../../utils/format';

interface ExportParams {
  exam: ExamRequest;
  patient: Patient;
  settings: AppSettings;
  reportHtml: string;
  clinic?: Clinic;
}

/**
 * Conversão simples de HTML do TipTap em parágrafos do docx.
 * Suporta: h2, h3, p, ul, ol, strong, em.
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild as HTMLElement;
  const paragraphs: Paragraph[] = [];

  function processInline(node: Node): TextRun[] {
    const runs: TextRun[] = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text) runs.push(new TextRun({ text }));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const text = el.textContent || '';
        if (!text) return;
        if (tag === 'strong' || tag === 'b') runs.push(new TextRun({ text, bold: true }));
        else if (tag === 'em' || tag === 'i') runs.push(new TextRun({ text, italics: true }));
        else if (tag === 'u') runs.push(new TextRun({ text, underline: {} }));
        else if (tag === 'br') runs.push(new TextRun({ text: '', break: 1 }));
        else runs.push(...processInline(el));
      }
    });
    return runs;
  }

  function processBlock(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();
    const runs = processInline(el);

    if (tag === 'h1' || tag === 'h2') {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 120 },
        children: runs.length ? runs.map(r => new TextRun({ ...(r as any).options, bold: true, size: 24 })) : [new TextRun({ text: el.textContent || '', bold: true, size: 24 })],
      }));
    } else if (tag === 'h3') {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: el.textContent || '', bold: true, size: 22 })],
      }));
    } else if (tag === 'p') {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 300, after: 120 },
        children: runs.length ? runs : [new TextRun({ text: el.textContent || '' })],
      }));
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li, idx) => {
        const liEl = li as HTMLElement;
        const itemRuns = processInline(liEl);
        paragraphs.push(new Paragraph({
          numbering: tag === 'ol' ? { reference: 'numbered-list', level: 0 } : undefined,
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          spacing: { line: 280, after: 80 },
          children: itemRuns.length ? itemRuns : [new TextRun({ text: liEl.textContent || '' })],
        }));
      });
    } else if (tag === 'div') {
      Array.from(el.children).forEach(child => processBlock(child as HTMLElement));
    } else {
      // fallback
      if (el.textContent) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: el.textContent })],
          spacing: { line: 300, after: 120 },
        }));
      }
    }
  }

  Array.from(root.children).forEach(child => processBlock(child as HTMLElement));

  return paragraphs;
}

export async function exportToDocx({ exam, patient, settings, reportHtml }: ExportParams): Promise<void> {
  const headerParagraphs: Paragraph[] = [];

  // Cabeçalho da clínica
  if (settings.clinicName) {
    headerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: settings.clinicName, bold: true, size: 28 })],
    }));
  }
  if (settings.clinicAddress) {
    headerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: settings.clinicAddress, size: 18, color: '555555' })],
    }));
  }
  if (settings.clinicPhone) {
    headerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: settings.clinicPhone, size: 18, color: '555555' })],
    }));
  }

  // Linha separadora
  headerParagraphs.push(new Paragraph({
    border: { bottom: { color: '0568c5', space: 4, style: 'single', size: 12 } },
    spacing: { after: 200 },
    children: [],
  }));

  // Bloco de identificação
  const idChildren: Paragraph[] = [];
  idChildren.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: 'Paciente: ', bold: true, size: 20 }),
      new TextRun({ text: patient.name, size: 20 }),
    ],
  }));
  if (patient.birthDate) {
    idChildren.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Data de Nascimento: ', bold: true, size: 20 }),
        new TextRun({ text: `${formatDate(patient.birthDate)} (${calculateAge(patient.birthDate)})`, size: 20 }),
      ],
    }));
  }
  idChildren.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: 'Data do exame: ', bold: true, size: 20 }),
      new TextRun({ text: formatDate(exam.createdAt), size: 20 }),
    ],
  }));
  if (exam.requestingPhysician) {
    idChildren.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Médico solicitante: ', bold: true, size: 20 }),
        new TextRun({ text: exam.requestingPhysician, size: 20 }),
      ],
    }));
  }
  if (exam.clinicalIndication) {
    idChildren.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'Indicação clínica: ', bold: true, size: 20 }),
        new TextRun({ text: exam.clinicalIndication, size: 20 }),
      ],
    }));
  }

  // Linha separadora
  idChildren.push(new Paragraph({
    border: { bottom: { color: 'cccccc', space: 4, style: 'single', size: 6 } },
    spacing: { after: 200 },
    children: [],
  }));

  // Conteúdo do laudo
  const processedHtml = reportHtml.replace(/\(…\)/g, '( \u00A0\u00A0\u00A0\u00A0 )');
  const reportParagraphs = htmlToDocxParagraphs(processedHtml);

  // Assinatura
  const signature: Paragraph[] = [];
  signature.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  if (settings.physicianName) {
    signature.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { color: '000000', space: 6, style: 'single', size: 6 } },
      children: [new TextRun({ text: settings.physicianName, bold: true, size: 22 })],
    }));
    if (settings.physicianCRM) {
      signature.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `CRM ${settings.physicianCRM}${settings.physicianRQE ? ` · RQE ${settings.physicianRQE}` : ''}`, size: 18, color: '555555' })],
      }));
    }
  }

  const doc = new Document({
    creator: settings.physicianName || 'Sistema de Laudos',
    title: `Laudo - ${patient.name}`,
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
        },
      },
      children: [...headerParagraphs, ...idChildren, ...reportParagraphs, ...signature],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Laudo_${patient.name.replace(/\s+/g, '_')}_${formatDate(exam.createdAt).replace(/\//g, '-')}.docx`;
  saveAs(blob, filename);
}

/**
 * Copia o laudo (HTML formatado) para o clipboard, pronto para colar no Google Docs.
 */
export async function copyReportToClipboard(reportHtml: string, patient: Patient, exam: ExamRequest, settings: AppSettings): Promise<void> {
  const header = `
    <div style="text-align:center;font-family:Arial,sans-serif;">
      ${settings.clinicName ? `<p style="font-weight:bold;font-size:14pt;margin:0;">${settings.clinicName}</p>` : ''}
      ${settings.clinicAddress ? `<p style="font-size:9pt;color:#555;margin:0;">${settings.clinicAddress}</p>` : ''}
    </div>
    <hr/>
    <p><strong>Paciente:</strong> ${patient.name}</p>
    ${patient.birthDate ? `<p><strong>Nascimento:</strong> ${formatDate(patient.birthDate)} (${calculateAge(patient.birthDate)})</p>` : ''}
    <p><strong>Data do exame:</strong> ${formatDate(exam.createdAt)}</p>
    ${exam.requestingPhysician ? `<p><strong>Médico solicitante:</strong> ${exam.requestingPhysician}</p>` : ''}
    ${exam.clinicalIndication ? `<p><strong>Indicação clínica:</strong> ${exam.clinicalIndication}</p>` : ''}
    <hr/>
  `;
  const signature = settings.physicianName ? `
    <br/><br/>
    ${settings.signatureImageUrl ? `<div style="text-align:center;margin-bottom:8px;"><img src="${settings.signatureImageUrl}" alt="Assinatura" style="height:64px;max-height:64px;object-fit:contain;"/></div>` : '<hr style="width:300px;margin:0 auto;"/>'}
    <p style="text-align:center;"><strong>${settings.physicianName}</strong><br/>
    <small>CRM ${settings.physicianCRM || ''}${settings.physicianRQE ? ` · RQE ${settings.physicianRQE}` : ''}</small></p>
  ` : '';

  const processedReportHtml = reportHtml.replace(/\(…\)/g, '( &nbsp;&nbsp;&nbsp;&nbsp; )');
  const fullHtml = `<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;">${header}${processedReportHtml}${signature}</div>`;
  const plainText = (new DOMParser()).parseFromString(fullHtml, 'text/html').body.textContent || '';

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([fullHtml], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]);
}
