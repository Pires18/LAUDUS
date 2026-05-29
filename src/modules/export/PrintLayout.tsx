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

export function PrintLayout({ patient, clinic, settings, examType, reportContent, physicianName, examDate }: Props) {
  const defaultSignature = settings.defaultSignature || (settings.physicianName ? `${settings.physicianName}\nCRM: ${settings.physicianCRM || ''}` : '');
  const signature = (clinic?.footerHtml?.replace(/<[^>]*>?/gm, '') || '') || defaultSignature;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-area" className="hidden print:block w-full text-black bg-white min-h-screen text-[14px] leading-relaxed font-sans relative pb-32">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-4">
          {clinic?.logoUrl && (
            <img src={clinic.logoUrl} alt="Logo" className="h-20 object-contain shrink-0" />
          )}
          <div>
            {!clinic?.logoUrl ? (
              <h1 className="text-2xl font-bold uppercase">{clinic?.name || settings.clinicName || 'LAUD.US'}</h1>
            ) : (
              <h2 className="text-lg font-bold uppercase text-slate-800 leading-tight">{clinic?.name || settings.clinicName}</h2>
            )}
            <p className="text-xs text-gray-600 mt-1.5 max-w-sm whitespace-pre-wrap">
              {clinic?.address ? (typeof clinic.address === 'string' ? clinic.address : [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state].filter(Boolean).join(', ')) : settings.clinicAddress}
              {clinic?.phone && <><br />Tel: {clinic.phone}</>}
            </p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p><strong>Data:</strong> {formatDate(examDate)}</p>
          {physicianName && <p><strong>Solicitante:</strong> {physicianName}</p>}
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-8 text-sm grid grid-cols-2 gap-y-2">
        <div><strong>Paciente:</strong> {patient.name}</div>
        <div><strong>Nascimento:</strong> {patient.birthDate ? formatDate(patient.birthDate) : ''} ({calculateAge(patient.birthDate)})</div>
        <div><strong>Convênio:</strong> {patient.insurance || 'Particular'}</div>
        <div><strong>Exame:</strong> <span className="uppercase font-bold">{examType}</span></div>
      </div>

      {/* Content */}
      <div 
        className="prose prose-sm max-w-none print-prose"
        dangerouslySetInnerHTML={{ __html: reportContent }}
      />

      {/* Footer / Signature */}
      <div className="absolute bottom-8 left-0 right-0 text-center flex flex-col items-center page-break-inside-avoid">
        {settings.signatureImageUrl ? (
          <img src={settings.signatureImageUrl} alt="Assinatura" className="h-16 object-contain mb-1" />
        ) : (
          <div className="w-64 border-t border-black pt-2 mb-1"></div>
        )}
        <div className="text-sm font-bold whitespace-pre-wrap">{signature}</div>
      </div>
      
      <style>{`
        .print-prose h2 { font-size: 1.1em; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; margin-bottom: 12px; }
        .print-prose h3 { font-size: 1em; font-weight: bold; margin-top: 16px; margin-bottom: 8px; }
        .print-prose p { margin-bottom: 8px; text-align: justify; }
        .print-prose ul { margin-left: 20px; margin-bottom: 12px; }
      `}</style>
    </div>,
    document.body
  );
}
