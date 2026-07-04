import { Patient, Clinic, AppSettings } from '../../types';
import { ReportDocumentBody } from './ReportDocument';

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
 * Fonte OCULTA do laudo para impressão. Renderiza o mesmo <ReportDocumentBody>
 * usado na prévia (garantindo PDF idêntico à pré-visualização) dentro de um
 * container `#report-print-source` que fica sempre `display:none`.
 *
 * A impressão/PDF é feita por `printLaudo` (src/modules/export/printReport.ts),
 * que lê o HTML deste elemento e o pagina com Paged.js — obtendo páginas A4
 * reais, rodapé fixo e numeração `Página X de Y` em todas as páginas.
 */
export function PrintLayout(props: Props) {
  return (
    <div id="report-print-source" style={{ display: 'none' }} aria-hidden="true">
      <ReportDocumentBody {...props} />
    </div>
  );
}
