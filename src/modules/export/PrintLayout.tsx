import { createPortal } from 'react-dom';
import { Patient, Clinic, AppSettings } from '../../types';
import { calculateAge, formatDate } from '../../utils/format';

interface Props {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  reportContent: string;
  physicianName?: string;
  examDate: number;
}

function getFontFamilyFallback(family?: string) {
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

export function PrintLayout({ patient, clinic, settings, examType, reportContent, physicianName, examDate }: Props) {
  const drName = settings.physicianName || '';
  const drCRM = settings.physicianCRM || '';
  const drRQE = settings.physicianRQE || '';
  
  const showHeader = settings.pdfShowHeader !== false;
  const showFooter = settings.pdfShowFooter !== false;

  const footerText = (showFooter && clinic?.footerHtml) ? clinic.footerHtml.replace(/<[^>]*>?/gm, '').trim() : '';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-area" className="hidden print:block w-full text-slate-900 bg-white min-h-screen">
      <table className="w-full print-table" style={{ borderCollapse: 'collapse', width: '100%', margin: 0, padding: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <td style={{ height: `${settings.pdfMarginTop ?? 15}mm` }}></td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{
              paddingLeft: `${settings.pdfMarginLeft ?? 15}mm`,
              paddingRight: `${settings.pdfMarginRight ?? 15}mm`,
              verticalAlign: 'top',
              boxSizing: 'border-box',
              width: '100%'
            }}>
              {/* Header */}
              {showHeader && (
                clinic?.headerHtml ? (
                  <div 
                    className="clinic-header-html mb-6"
                    dangerouslySetInnerHTML={{ __html: clinic.headerHtml }}
                  />
                ) : clinic?.headerImageUrl ? (
                  <div className="clinic-header-image mb-6 w-full">
                    <img 
                      src={clinic.headerImageUrl} 
                      alt="Cabeçalho da Clínica" 
                      className="w-full h-auto object-contain max-h-[120px]" 
                    />
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
                        {clinic?.address ? (typeof clinic.address === 'string' ? clinic.address : [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state].filter(Boolean).join(', ')) : settings.clinicAddress}
                        {clinic?.phone && <><br />Tel: {clinic.phone}</>}
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* Patient Info Bar (Minimalist Clinical Grid - 3 Rows) */}
              <div className="border-y border-slate-350 py-3.5 mb-6 space-y-3.5 text-xs leading-none">
                {/* Row 1 */}
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
                
                {/* Row 2 */}
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

                {/* Row 3 */}
                <div className="grid grid-cols-4 gap-4 pt-3.5 border-t border-slate-100">
                  <div className="space-y-1 col-span-4">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">MÉDICO SOLICITANTE</span>
                    <span className="font-semibold text-slate-700 block uppercase truncate">{physicianName || 'NÃO INFORMADO'}</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div 
                className="prose prose-sm max-w-none print-prose"
                dangerouslySetInnerHTML={{ __html: reportContent }}
              />

              {/* Signature Block */}
              <div className="mt-16 pt-8 flex flex-col items-center text-center page-break-inside-avoid">
                {settings.signatureImageUrl ? (
                  <div className="h-16 flex items-center justify-center mb-2">
                    <img
                      src={settings.signatureImageUrl}
                      alt="Assinatura digital"
                      className="max-h-full object-contain"
                      style={{ maxWidth: '220px' }}
                    />
                  </div>
                ) : (
                  <div className="w-64 border-t border-dashed border-slate-350 mb-2 mt-4" />
                )}
                
                {drName && (
                  <p className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">{drName}</p>
                )}
                
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
                  <div 
                    className="mt-12 pt-4 border-t border-slate-200 text-[10px] text-slate-500 text-center clinic-footer-html leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: clinic.footerHtml }}
                  />
                ) : clinic?.footerImageUrl ? (
                  <div className="clinic-footer-image mt-12 pt-4 border-t border-slate-200 w-full text-center">
                    <img 
                      src={clinic.footerImageUrl} 
                      alt="Rodapé da Clínica" 
                      className="w-full h-auto object-contain max-h-[80px] mx-auto" 
                    />
                  </div>
                ) : null
              )}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ 
              height: `${settings.pdfMarginBottom ?? 15}mm`,
              paddingLeft: `${settings.pdfMarginLeft ?? 15}mm`,
              paddingRight: `${settings.pdfMarginRight ?? 15}mm`,
              verticalAlign: 'middle',
              boxSizing: 'border-box'
            }}>
              <div className="page-number-container">
                <span className="page-number-footer"></span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
      
      <style>{`
        @page {
          margin: 0;
        }
        #print-area {
          font-family: ${getFontFamilyFallback(settings.pdfFontFamily)};
          font-size: ${settings.pdfFontSize || '14px'};
          line-height: ${settings.pdfLineHeight || '1.5'};
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .page-number-container {
          width: 100%;
          text-align: right;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 600;
          font-family: inherit;
        }
        .page-number-footer::after {
          content: counter(page) " / " counter(pages);
        }
        .print-prose {
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
        }
        .print-prose h1 {
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
        .print-prose h2 { 
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
        .print-prose h3 { 
          font-size: 0.95em; 
          font-weight: 700; 
          color: #334155; 
          margin-top: 16px; 
          margin-bottom: 8px; 
          page-break-after: avoid;
          break-after: avoid;
        }
        .print-prose p { 
          margin-bottom: 8px; 
          text-align: ${settings.pdfTextAlign || 'justify'}; 
        }
        .print-prose strong {
          color: #0f172a;
          font-weight: 700;
        }
        .print-prose table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          margin-bottom: 16px;
          font-size: 0.9em;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .print-prose th {
          background-color: #f8fafc;
          color: #475569;
          font-weight: 700;
          text-align: left;
          padding: 6px 10px;
          border-bottom: 2px solid #e2e8f0;
        }
        .print-prose td {
          padding: 6px 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .print-prose ul { 
          margin-left: 20px; 
          margin-bottom: 12px; 
          list-style-type: disc;
        }
        .print-prose ol { 
          margin-left: 20px; 
          margin-bottom: 12px; 
          list-style-type: decimal;
        }
        .print-prose li {
          margin-bottom: 4px;
        }
        
        @media print {
          body {
            background-color: #fff;
            color: #000;
          }
          #print-area {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          .print-prose p, .print-prose li, .print-prose tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
