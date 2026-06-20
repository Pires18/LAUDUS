import { ExamRequest, Patient, AppSettings } from '../../types';
import { formatDate, calculateAge } from '../../utils/format';

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
