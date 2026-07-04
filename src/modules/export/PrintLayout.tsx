import { createPortal } from 'react-dom';
import { Patient, Clinic, AppSettings } from '../../types';
import { formatDate } from '../../utils/format';
import { ReportDocumentBody, reportDocumentStyles } from './ReportDocument';

interface Props {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  reportContent: string;
  physicianName?: string;
  examDate: number;
}

/**
 * Invólucro de impressão do laudo. Usa uma tabela com `thead`/`tfoot` para que o
 * navegador repita as bandas de margem superior e o RODAPÉ DE EXECUÇÃO em TODAS
 * as páginas de laudos com mais de uma página:
 *  - `thead` reserva a margem superior em cada página.
 *  - `tfoot` reserva a margem inferior e renderiza, em cada página, a
 *    identificação do paciente + a numeração `Página X de Y` (respaldo
 *    médico-legal e navegação em documentos longos).
 */
export function PrintLayout(props: Props) {
  const { settings, patient, examDate } = props;

  if (typeof document === 'undefined') return null;

  const marginTop = settings.pdfMarginTop ?? 15;
  const marginBottom = settings.pdfMarginBottom ?? 15;
  const marginLeft = settings.pdfMarginLeft ?? 15;
  const marginRight = settings.pdfMarginRight ?? 15;

  return createPortal(
    <div id="print-area" className="report-doc hidden print:block w-full bg-white min-h-screen">
      <table className="w-full print-table" style={{ borderCollapse: 'collapse', width: '100%', margin: 0, padding: 0, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <td style={{ height: `${marginTop}mm` }}></td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{
              paddingLeft: `${marginLeft}mm`,
              paddingRight: `${marginRight}mm`,
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
              height: `${marginBottom}mm`,
              paddingLeft: `${marginLeft}mm`,
              paddingRight: `${marginRight}mm`,
              verticalAlign: 'middle',
              boxSizing: 'border-box'
            }}>
              <div className="report-running-footer">
                <span className="rf-id">{patient?.name || '—'} · {formatDate(examDate)}</span>
                <span className="rf-page">Página <span className="rf-page-num" /> de <span className="rf-page-total" /></span>
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
        /* Rodapé de execução — repetido em cada página via <tfoot> */
        .report-running-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          font-family: inherit;
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #9ca3af;
        }
        .report-running-footer .rf-id {
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .report-running-footer .rf-page { white-space: nowrap; flex-shrink: 0; }
        .rf-page-num::after { content: counter(page); }
        .rf-page-total::after { content: counter(pages); }

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
          /* Não fatiar parágrafos, itens de lista, linhas de tabela nem a barra
             de dados do paciente entre páginas. */
          .print-prose p, .print-prose li, .print-prose tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-prose p { orphans: 3; widows: 3; }
          .report-patient, .report-signature { break-inside: avoid; page-break-inside: avoid; }
          /* Título de seção nunca isolado no fim da página. */
          .print-prose h2, .print-prose h3 { break-after: avoid; page-break-after: avoid; }
        }
      `}</style>
    </div>,
    document.body
  );
}
