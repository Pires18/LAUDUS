import { createPortal } from 'react-dom';
import { getActivePacsUrl, getProxyEndpoint } from '../../store/db';
import { Patient, Clinic, AppSettings } from '../../types';
import { calculateAge, formatDate } from '../../utils/format';

interface Props {
  patient: Patient;
  clinic: Clinic | null;
  settings: AppSettings;
  examType: string;
  examDate: number;
  selectedInstances: Array<{ ID: string; MainDicomTags?: { InstanceNumber?: string } }>;
  gridType?: string;
}

export function PrintImagesLayout({ patient, clinic, settings, examType, examDate, selectedInstances, gridType = '2x4' }: Props) {
  // Determine grid dimensions based on gridType
  let cols = 2;
  let rows = 4;
  let chunkSize = 8;

  if (gridType === '1x2') {
    cols = 1;
    rows = 2;
    chunkSize = 2;
  } else if (gridType === '2x4') {
    cols = 2;
    rows = 4;
    chunkSize = 8;
  }

  // Chunk instances into arrays of maximum chunkSize items
  const pages: typeof selectedInstances[] = [];
  for (let i = 0; i < selectedInstances.length; i += chunkSize) {
    pages.push(selectedInstances.slice(i, i + chunkSize));
  }

  const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-images-area" className="hidden print:block w-full text-black bg-white text-[12px] leading-relaxed font-sans">
      {pages.map((pageInstances, pageIdx) => (
        <div key={pageIdx} className="print-images-page">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              {clinic?.logoUrl && (
                <img src={clinic.logoUrl} alt="Logo" className="h-16 object-contain shrink-0" />
              )}
              <div>
                {!clinic?.logoUrl ? (
                  <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">{clinic?.name || settings.clinicName || 'LAUD.US'}</h1>
                ) : (
                  <h2 className="text-sm font-bold uppercase text-slate-800 leading-tight">{clinic?.name || settings.clinicName}</h2>
                )}
                <p className="text-[10px] text-gray-500 mt-1 max-w-sm whitespace-pre-wrap leading-tight">
                  {clinic?.address 
                  ? (typeof clinic.address === 'string' ? clinic.address : [clinic.address.street, clinic.address.number, clinic.address.city, clinic.address.state].filter(Boolean).join(', ')) 
                  : settings.clinicAddress}
                  {clinic?.phone && <><br />Tel: {clinic.phone}</>}
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] space-y-0.5 leading-tight">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block mb-1">Documentação Fotográfica</span>
              <p><strong>Paciente:</strong> {patient.name} ({calculateAge(patient.birthDate)})</p>
              <p><strong>Exame:</strong> <span className="uppercase font-bold">{examType}</span></p>
              <p><strong>Data:</strong> {formatDate(examDate)}</p>
              <p className="text-slate-400 text-[10px] font-medium pt-0.5">Página {pageIdx + 1} de {pages.length}</p>
            </div>
          </div>

          {/* Grid Layout — classes definidas em index.css para impressão */}
          <div 
            className={gridType === '1x2' ? 'print-images-grid-1x2 flex-grow' : 'print-images-grid-2x4 flex-grow'}
          >
            {pageInstances.map((instance, instIdx) => {
              const globalIndex = pageIdx * chunkSize + instIdx + 1;
              const instanceNum = instance.MainDicomTags?.InstanceNumber || globalIndex;
              
              const isBackup = (instance as any).serverSource === 'backup';
              const currentBaseUrl = isBackup
                ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
                : (settings.dicomViewerUrl || 'http://localhost:8042');
              const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
              const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
              const proxyPath = getProxyEndpoint(settings, isBackup);
              const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
              
              return (
                <div key={instance.ID} className="print-image-card relative">
                  <img 
                    src={previewUrl} 
                    alt={`Imagem ${instanceNum}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-white/10">
                    FOTO {globalIndex}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-2 mt-4 text-left text-[9px] text-gray-400 flex justify-between leading-none">
            <span>Sincronização PACS Orthanc — LAUD.US</span>
            <span>Gerado automaticamente em {formatDate(Date.now())}</span>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
