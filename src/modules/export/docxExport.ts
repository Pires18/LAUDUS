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
