import { Patient, Clinic, AppSettings } from '../../types';
import { calculateAge, formatDate } from '../../utils/format';

/**
 * Fonte única de renderização do laudo (WYSIWYG): o mesmo corpo + CSS são usados
 * na impressão (PrintLayout, dentro do portal #print-area) e nas prévias
 * (Centro de PDF nas Configurações e modal de pré-visualização no editor).
 * Assim, o que o médico vê na prévia é idêntico ao PDF final.
 */

export function getFontFamilyFallback(family?: string) {
  if (!family) return 'Arial, sans-serif';
  switch (family) {
    case 'Times New Roman': return '"Times New Roman", Times, serif';
    case 'Courier New': return '"Courier New", Courier, monospace';
    case 'Inter': return '"Inter", sans-serif';
    case 'Calibri': return 'Calibri, Candara, Segoe, "Segoe UI", sans-serif';
    case 'Georgia': return 'Georgia, serif';
    case 'Lora': return '"Lora", Georgia, serif';
    default: return `${family}, sans-serif`;
  }
}

export interface ReportDocumentProps {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  reportContent: string;
  physicianName?: string;
  examDate: number;
  /**
   * Nota de Observações Metodológicas (HTML) renderizada de forma reduzida ao
   * final do laudo, para documentação/respaldo. Vazio = não exibe.
   */
  observationsNote?: string;
}

/**
 * CSS compartilhado do documento do laudo. Reescopado sob `.report-doc` para
 * valer tanto na impressão quanto na prévia sem vazar para o resto do app.
 */
export function reportDocumentStyles(settings: AppSettings): string {
  return `
    .report-doc {
      font-family: ${getFontFamilyFallback(settings.pdfFontFamily)};
      font-size: ${settings.pdfFontSize || '14px'};
      line-height: ${settings.pdfLineHeight || '1.5'};
      color: #0f172a;
      background: #fff;
    }
    .report-doc .print-prose {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }
    .report-doc .print-prose h1 {
      font-size: 1.25em;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      margin-top: 8px;
      margin-bottom: 20px;
      color: #0f172a;
      border: none;
      padding: 0;
    }
    .report-doc .print-prose h2 {
      font-size: 1.05em;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-left: 3px solid #4f46e5;
      padding-left: 8px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .report-doc .print-prose h3 {
      font-size: 0.95em;
      font-weight: 700;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .report-doc .print-prose p {
      margin-bottom: 8px;
      text-align: ${settings.pdfTextAlign || 'justify'};
    }
    .report-doc .print-prose strong { color: #0f172a; font-weight: 700; }
    .report-doc .print-prose table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 16px;
      font-size: 0.9em;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .report-doc .print-prose th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 6px 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .report-doc .print-prose td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .report-doc .print-prose ul { margin-left: 20px; margin-bottom: 12px; list-style-type: disc; }
    .report-doc .print-prose ol { margin-left: 20px; margin-bottom: 12px; list-style-type: decimal; }
    .report-doc .print-prose li { margin-bottom: 4px; }
    /* Nota de Observações Metodológicas — rodapé reduzido, itálico e discreto */
    .report-doc .report-obs {
      margin-top: 20px;
      padding: 8px 0 0 10px;
      border-top: 1px solid #e2e8f0;
      border-left: 2px solid #cbd5e1;
      font-size: 0.78em;
      font-style: italic;
      line-height: 1.45;
      color: #64748b;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .report-doc .report-obs .report-obs-label {
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      margin-right: 4px;
    }
    .report-doc .report-obs p { margin: 0 0 4px; text-align: left; }
  `;
}

function resolveClinicAddress(clinic: Clinic | null, settings: AppSettings): string {
  if (!clinic?.address) return settings.clinicAddress || '';
  if (typeof clinic.address === 'string') return clinic.address;
  return [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state]
    .filter(Boolean)
    .join(', ');
}

/**
 * Corpo do laudo (cabeçalho, dados do paciente, conteúdo, nota metodológica,
 * assinatura e rodapé). Sem margens de página — quem controla margens é o
 * invólucro (PrintLayout para impressão, ReportPreview para prévia).
 */
export function ReportDocumentBody({
  patient,
  clinic,
  settings,
  reportContent,
  physicianName,
  examDate,
  observationsNote,
}: ReportDocumentProps) {
  const drName = settings.physicianName || '';
  const drCRM = settings.physicianCRM || '';
  const drRQE = settings.physicianRQE || '';

  const showHeader = settings.pdfShowHeader !== false;
  const showFooter = settings.pdfShowFooter !== false;
  const footerText = (showFooter && clinic?.footerHtml) ? clinic.footerHtml.replace(/<[^>]*>?/gm, '').trim() : '';

  return (
    <div className="report-doc-body">
      {/* Header */}
      {showHeader && (
        clinic?.headerHtml ? (
          <div className="clinic-header-html mb-6" dangerouslySetInnerHTML={{ __html: clinic.headerHtml }} />
        ) : clinic?.headerImageUrl ? (
          <div className="clinic-header-image mb-6 w-full">
            <img src={clinic.headerImageUrl} alt="Cabeçalho da Clínica" className="w-full h-auto object-contain max-h-[120px]" />
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-slate-350 pb-5 mb-6">
            {clinic?.logoUrl && (
              <img src={clinic.logoUrl} alt="Logo" className="h-24 w-auto object-contain shrink-0" />
            )}
            <div className="text-right flex-1 min-w-0 ml-6">
              <h1 className="text-xl font-bold uppercase tracking-tight text-slate-800">
                {clinic?.name || settings.clinicName || 'LAUD.US'}
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1.5 max-w-sm ml-auto whitespace-pre-wrap leading-relaxed">
                {resolveClinicAddress(clinic, settings)}
                {clinic?.phone && <><br />Tel: {clinic.phone}</>}
              </p>
            </div>
          </div>
        )
      )}

      {/* Patient Info Bar (grid clínico minimalista — 3 linhas) */}
      <div className="border-y border-slate-350 py-3.5 mb-6 space-y-3.5 text-xs leading-none">
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1 col-span-2">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">PACIENTE</span>
            <span className="font-bold text-slate-800 uppercase block truncate">{patient.name}</span>
          </div>
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">IDADE / NASC.</span>
            <span className="font-semibold text-slate-700 block uppercase whitespace-nowrap">
              {patient.birthDate ? `${calculateAge(patient.birthDate, examDate)} (${formatDate(patient.birthDate)})` : '---'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">GÊNERO</span>
            <span className="font-semibold text-slate-700 block uppercase">
              {patient.gender === 'M' ? 'MASCULINO' : patient.gender === 'F' ? 'FEMININO' : patient.gender || '---'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 pt-3.5 border-t border-slate-100">
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">CONVÊNIO</span>
            <span className="font-semibold text-slate-700 block uppercase truncate">{patient.insurance || 'PARTICULAR'}</span>
          </div>
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">CARTEIRINHA</span>
            <span className="font-semibold text-slate-700 block uppercase truncate">{patient.insuranceNumber || '---'}</span>
          </div>
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">CPF</span>
            <span className="font-semibold text-slate-700 block uppercase truncate">{patient.cpf || '---'}</span>
          </div>
          <div className="space-y-1">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">DATA DO EXAME</span>
            <span className="font-bold text-slate-800 block uppercase">{formatDate(examDate)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 pt-3.5 border-t border-slate-100">
          <div className="space-y-1 col-span-4">
            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">MÉDICO SOLICITANTE</span>
            <span className="font-semibold text-slate-700 block uppercase truncate">{physicianName || 'NÃO INFORMADO'}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none print-prose" dangerouslySetInnerHTML={{ __html: reportContent }} />

      {/* Nota de Observações Metodológicas (reduzida, documentação/respaldo) */}
      {observationsNote && observationsNote.replace(/<[^>]*>/g, '').trim() !== '' && (
        <div className="report-obs">
          <span className="report-obs-label">Observações metodológicas:</span>
          <span dangerouslySetInnerHTML={{ __html: observationsNote }} />
        </div>
      )}

      {/* Signature Block */}
      <div className="mt-16 pt-8 flex flex-col items-center text-center page-break-inside-avoid">
        {settings.signatureImageUrl ? (
          <div className="h-16 flex items-center justify-center mb-2">
            <img src={settings.signatureImageUrl} alt="Assinatura digital" className="max-h-full object-contain" style={{ maxWidth: '220px' }} />
          </div>
        ) : (
          <div className="w-64 border-t border-dashed border-slate-350 mb-2 mt-4" />
        )}

        {drName && <p className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">{drName}</p>}

        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider space-y-0.5 mt-0.5">
          {drCRM && <span>CRM: {drCRM}</span>}
          {drCRM && drRQE && <span className="mx-1.5 text-slate-300">|</span>}
          {drRQE && <span>RQE: {drRQE}</span>}
        </div>

        {settings.defaultSignature ? (
          <p className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap mt-1 leading-normal max-w-sm mx-auto">
            {settings.defaultSignature}
          </p>
        ) : (
          footerText && !drName && (
            <p className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap mt-1 leading-normal max-w-sm mx-auto">
              {footerText}
            </p>
          )
        )}
      </div>

      {/* Clinic Footer Rich HTML or Image */}
      {showFooter && (
        clinic?.footerHtml ? (
          <div className="mt-12 pt-4 border-t border-slate-200 text-[10px] text-slate-500 text-center clinic-footer-html leading-relaxed" dangerouslySetInnerHTML={{ __html: clinic.footerHtml }} />
        ) : clinic?.footerImageUrl ? (
          <div className="clinic-footer-image mt-12 pt-4 border-t border-slate-200 w-full text-center">
            <img src={clinic.footerImageUrl} alt="Rodapé da Clínica" className="w-full h-auto object-contain max-h-[80px] mx-auto" />
          </div>
        ) : null
      )}
    </div>
  );
}

/**
 * Prévia inline (não-portal) do laudo, numa "folha A4" com as margens
 * configuradas. Reflete fielmente o PDF final. Usada no Centro de PDF e no
 * modal de pré-visualização do editor.
 */
export function ReportPreview(props: ReportDocumentProps) {
  const { settings } = props;
  return (
    <div
      className="report-doc mx-auto bg-white shadow-lg border border-slate-200"
      style={{ width: '210mm', maxWidth: '100%' }}
    >
      <style>{reportDocumentStyles(settings)}</style>
      <div
        style={{
          paddingTop: `${settings.pdfMarginTop ?? 15}mm`,
          paddingBottom: `${settings.pdfMarginBottom ?? 15}mm`,
          paddingLeft: `${settings.pdfMarginLeft ?? 15}mm`,
          paddingRight: `${settings.pdfMarginRight ?? 15}mm`,
        }}
      >
        <ReportDocumentBody {...props} />
      </div>
    </div>
  );
}
