import { Patient, Clinic, AppSettings } from '../../types';
import { calculateAge, formatDate } from '../../utils/format';

/**
 * Fonte única de renderização do laudo (WYSIWYG): o mesmo corpo + CSS são usados
 * na impressão (PrintLayout, dentro do portal #print-area) e nas prévias
 * (Centro de PDF nas Configurações e modal de pré-visualização no editor).
 * Assim, o que o médico vê na prévia é idêntico ao PDF final.
 *
 * Todo o visual do documento vive em `reportDocumentStyles` (folha escopada sob
 * `.report-doc`). O JSX do corpo usa apenas classes semânticas — nada de classes
 * utilitárias Tailwind — para que a impressão seja 100% previsível e sóbria.
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
}

/**
 * CSS compartilhado do documento do laudo. Reescopado sob `.report-doc` para
 * valer tanto na impressão quanto na prévia sem vazar para o resto do app.
 * Paleta monocromática (preto/cinzas) — documento padronizado e direto.
 */
export function reportDocumentStyles(settings: AppSettings): string {
  return `
    .report-doc {
      font-family: ${getFontFamilyFallback(settings.pdfFontFamily)};
      font-size: ${settings.pdfFontSize || '14px'};
      line-height: ${settings.pdfLineHeight || '1.5'};
      color: #1a1a1a;
      background: #fff;
    }

    /* ── Cabeçalho ── */
    .report-doc .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1.5px solid #1a1a1a;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .report-doc .report-header-logo {
      height: 72px;
      width: auto;
      object-fit: contain;
      flex-shrink: 0;
    }
    .report-doc .report-header-text {
      flex: 1;
      min-width: 0;
      text-align: right;
    }
    .report-doc .report-header .clinic-name {
      font-size: 1.2em;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #1a1a1a;
      margin: 0;
    }
    .report-doc .report-header .clinic-address {
      font-size: 0.68em;
      line-height: 1.5;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 4px;
      white-space: pre-wrap;
    }
    .report-doc .clinic-header-image img,
    .report-doc .clinic-header-html { margin-bottom: 20px; }
    .report-doc .clinic-header-image img { width: 100%; height: auto; object-fit: contain; max-height: 120px; }

    /* ── Barra de dados do paciente ── */
    .report-doc .report-patient {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px 20px;
      border-top: 1px solid #d1d5db;
      border-bottom: 1px solid #d1d5db;
      padding: 12px 0;
      margin-bottom: 22px;
    }
    .report-doc .report-patient .field { min-width: 0; }
    .report-doc .report-patient .field.wide { grid-column: span 2; }
    .report-doc .report-patient .field.full { grid-column: 1 / -1; }
    .report-doc .report-patient .field-label {
      display: block;
      font-size: 0.6em;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 3px;
    }
    .report-doc .report-patient .field-value {
      display: block;
      font-size: 0.82em;
      font-weight: 700;
      text-transform: uppercase;
      color: #1a1a1a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Corpo do laudo (conteúdo clínico) ── */
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
      letter-spacing: 0.02em;
      margin-top: 8px;
      margin-bottom: 20px;
      color: #1a1a1a;
      border: none;
      padding: 0;
    }
    .report-doc .print-prose h2 {
      font-size: 1.02em;
      font-weight: 800;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .report-doc .print-prose h3 {
      font-size: 0.95em;
      font-weight: 700;
      color: #374151;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .report-doc .print-prose p {
      margin-bottom: 8px;
      text-align: ${settings.pdfTextAlign || 'justify'};
    }
    .report-doc .print-prose strong { color: #1a1a1a; font-weight: 700; }
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
      background-color: #f3f4f6;
      color: #374151;
      font-weight: 700;
      text-align: left;
      padding: 6px 10px;
      border-bottom: 1.5px solid #9ca3af;
    }
    .report-doc .print-prose td {
      padding: 6px 10px;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
    }
    .report-doc .print-prose ul { margin-left: 20px; margin-bottom: 12px; list-style-type: disc; }
    .report-doc .print-prose ol { margin-left: 20px; margin-bottom: 12px; list-style-type: decimal; }
    .report-doc .print-prose li { margin-bottom: 4px; }

    /* ── Bloco de assinatura ── */
    .report-doc .report-signature {
      margin-top: 56px;
      padding-top: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .report-doc .report-signature .sig-image {
      max-height: 64px;
      max-width: 220px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .report-doc .report-signature .sig-line {
      width: 260px;
      border-top: 1px solid #6b7280;
      margin: 16px 0 6px;
    }
    .report-doc .report-signature .dr-name {
      font-size: 0.86em;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #1a1a1a;
    }
    .report-doc .report-signature .dr-ids {
      font-size: 0.72em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-top: 2px;
    }
    .report-doc .report-signature .dr-ids .sep { color: #d1d5db; margin: 0 6px; }
    .report-doc .report-signature .sig-note {
      font-size: 0.72em;
      color: #6b7280;
      white-space: pre-wrap;
      line-height: 1.5;
      margin-top: 6px;
      max-width: 360px;
    }

    /* ── Rodapé da clínica ── */
    .report-doc .report-footer {
      margin-top: 44px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.7em;
      line-height: 1.5;
      color: #6b7280;
      text-align: center;
    }
    .report-doc .report-footer img { width: 100%; height: auto; object-fit: contain; max-height: 80px; margin: 0 auto; }
  `;
}

function resolveClinicAddress(clinic: Clinic | null, settings: AppSettings): string {
  if (!clinic?.address) return settings.clinicAddress || '';
  if (typeof clinic.address === 'string') return clinic.address;
  return [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state]
    .filter(Boolean)
    .join(', ');
}

function formatGender(gender?: string): string {
  if (gender === 'M') return 'MASCULINO';
  if (gender === 'F') return 'FEMININO';
  return gender || '---';
}

/**
 * Corpo do laudo (cabeçalho, dados do paciente, conteúdo, assinatura e rodapé).
 * Sem margens de página — quem controla margens é o invólucro (PrintLayout para
 * impressão, ReportPreview para prévia). Usa apenas classes semânticas
 * estilizadas em `reportDocumentStyles`.
 */
export function ReportDocumentBody({
  patient,
  clinic,
  settings,
  reportContent,
  physicianName,
  examDate,
}: ReportDocumentProps) {
  const drName = settings.physicianName || '';
  const drCRM = settings.physicianCRM || '';
  const drRQE = settings.physicianRQE || '';

  const showHeader = settings.pdfShowHeader !== false;
  const showFooter = settings.pdfShowFooter !== false;

  const birth = patient.birthDate
    ? `${calculateAge(patient.birthDate, examDate)} · ${formatDate(patient.birthDate)}`
    : '---';

  return (
    <div className="report-doc-body">
      {/* Cabeçalho */}
      {showHeader && (
        clinic?.headerHtml ? (
          <div className="clinic-header-html" dangerouslySetInnerHTML={{ __html: clinic.headerHtml }} />
        ) : clinic?.headerImageUrl ? (
          <div className="clinic-header-image">
            <img src={clinic.headerImageUrl} alt="Cabeçalho da Clínica" />
          </div>
        ) : (
          <div className="report-header">
            {clinic?.logoUrl && (
              <img src={clinic.logoUrl} alt="Logo" className="report-header-logo" />
            )}
            <div className="report-header-text">
              <p className="clinic-name">{clinic?.name || settings.clinicName || 'LAUD.US'}</p>
              <p className="clinic-address">
                {resolveClinicAddress(clinic, settings)}
                {clinic?.phone ? `${resolveClinicAddress(clinic, settings) ? '\n' : ''}Tel: ${clinic.phone}` : ''}
              </p>
            </div>
          </div>
        )
      )}

      {/* Dados do paciente */}
      <div className="report-patient">
        <div className="field wide">
          <span className="field-label">Paciente</span>
          <span className="field-value">{patient.name}</span>
        </div>
        <div className="field">
          <span className="field-label">Idade / Nasc.</span>
          <span className="field-value">{birth}</span>
        </div>
        <div className="field">
          <span className="field-label">Sexo</span>
          <span className="field-value">{formatGender(patient.gender)}</span>
        </div>
        <div className="field">
          <span className="field-label">Convênio</span>
          <span className="field-value">{patient.insurance || 'PARTICULAR'}</span>
        </div>
        <div className="field">
          <span className="field-label">Carteirinha</span>
          <span className="field-value">{patient.insuranceNumber || '---'}</span>
        </div>
        <div className="field">
          <span className="field-label">CPF</span>
          <span className="field-value">{patient.cpf || '---'}</span>
        </div>
        <div className="field">
          <span className="field-label">Data do Exame</span>
          <span className="field-value">{formatDate(examDate)}</span>
        </div>
        <div className="field full">
          <span className="field-label">Médico Solicitante</span>
          <span className="field-value">{physicianName || 'NÃO INFORMADO'}</span>
        </div>
      </div>

      {/* Conteúdo clínico */}
      <div className="prose prose-sm max-w-none print-prose" dangerouslySetInnerHTML={{ __html: reportContent }} />

      {/* Assinatura */}
      <div className="report-signature">
        {settings.signatureImageUrl ? (
          <img src={settings.signatureImageUrl} alt="Assinatura digital" className="sig-image" />
        ) : (
          <div className="sig-line" />
        )}

        {drName && <span className="dr-name">{drName}</span>}

        {(drCRM || drRQE) && (
          <span className="dr-ids">
            {drCRM && <span>CRM: {drCRM}</span>}
            {drCRM && drRQE && <span className="sep">|</span>}
            {drRQE && <span>RQE: {drRQE}</span>}
          </span>
        )}

        {settings.defaultSignature && (
          <span className="sig-note">{settings.defaultSignature}</span>
        )}
      </div>

      {/* Rodapé da clínica */}
      {showFooter && (
        clinic?.footerHtml ? (
          <div className="report-footer" dangerouslySetInnerHTML={{ __html: clinic.footerHtml }} />
        ) : clinic?.footerImageUrl ? (
          <div className="report-footer">
            <img src={clinic.footerImageUrl} alt="Rodapé da Clínica" />
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
