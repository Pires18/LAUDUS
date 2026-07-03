import { createPortal } from 'react-dom';
import { Patient, Clinic, AppSettings } from '../../types';
import { ReportDocumentBody, reportDocumentStyles } from './ReportDocument';

interface Props {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  reportContent: string;
  physicianName?: string;
  examDate: number;
  /** Nota de Observações Metodológicas (HTML) — rodapé reduzido ao final. */
  observationsNote?: string;
}

export function PrintLayout(props: Props) {
  const { settings } = props;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-area" className="report-doc hidden print:block w-full bg-white min-h-screen">
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
              <ReportDocumentBody {...props} />
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
        ${reportDocumentStyles(settings)}
        #print-area {
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
