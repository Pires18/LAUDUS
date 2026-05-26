import { Patient, Clinic, AppSettings } from '../../types';
import { calculateAge, formatDate } from '../../utils/format';

interface Props {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  examDate: number;
  selectedInstances: Array<{ ID: string; MainDicomTags?: { InstanceNumber?: string } }>;
}

export function PrintImagesLayout({ patient, clinic, settings, examType, examDate, selectedInstances }: Props) {
  // Chunk instances into arrays of maximum 6 items
  const chunkSize = 6;
  const pages: typeof selectedInstances[] = [];
  for (let i = 0; i < selectedInstances.length; i += chunkSize) {
    pages.push(selectedInstances.slice(i, i + chunkSize));
  }

  const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';

  return (
    <div id="print-images-area" className="hidden print:block w-full text-black bg-white min-h-screen text-[12px] leading-relaxed font-sans relative">
      {pages.map((pageInstances, pageIdx) => (
        <div key={pageIdx} className="print-images-page">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-300 pb-2 mb-3">
            <div>
              {clinic?.logoUrl ? (
                <img src={clinic.logoUrl} alt="Logo" className="h-10 object-contain" />
              ) : (
                <h1 className="text-lg font-bold uppercase tracking-tight text-slate-800">{clinic?.name || settings.clinicName || 'LAUD.US'}</h1>
              )}
              <p className="text-[9px] text-gray-500 mt-0.5">
                {clinic?.address 
                  ? (typeof clinic.address === 'string' ? clinic.address : [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state].filter(Boolean).join(', ')) 
                  : settings.clinicAddress}
              </p>
            </div>
            <div className="text-right text-[10px] space-y-0.5 leading-tight">
              <span className="text-[9px] font-black text-brand-650 uppercase tracking-widest block mb-0.5">Documentação Fotográfica</span>
              <p><strong>Paciente:</strong> {patient.name} ({calculateAge(patient.birthDate)})</p>
              <p><strong>Exame:</strong> <span className="uppercase font-bold">{examType}</span></p>
              <p><strong>Data:</strong> {formatDate(examDate)}</p>
              <p className="text-gray-400 text-[9px] font-medium">Página {pageIdx + 1} de {pages.length}</p>
            </div>
          </div>

          {/* Grid Layout (2 cols, 3 rows) */}
          <div className="print-images-grid flex-grow">
            {pageInstances.map((instance, instIdx) => {
              const globalIndex = pageIdx * chunkSize + instIdx + 1;
              const instanceNum = instance.MainDicomTags?.InstanceNumber || globalIndex;
              const previewUrl = `/api/orthanc-proxy?url=${encodeURIComponent(`${baseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
              
              return (
                <div key={instance.ID} className="print-image-card">
                  <div className="flex-grow flex items-center justify-center overflow-hidden w-full h-[180px] bg-black rounded">
                    <img 
                      src={previewUrl} 
                      alt={`Imagem ${instanceNum}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="print-image-caption">
                    Imagem {globalIndex} {instance.MainDicomTags?.InstanceNumber ? `(Instância ${instance.MainDicomTags.InstanceNumber})` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-250 pt-1.5 mt-3 text-center text-[8px] text-gray-400 flex justify-between leading-none">
            <span>Sincronização PACS Orthanc — Laud.us</span>
            <span>Gerado automaticamente em {formatDate(Date.now())}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
