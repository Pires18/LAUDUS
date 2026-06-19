import { createPortal } from 'react-dom';
import { getProxyEndpoint } from '../../store/db';
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
  localUrls?: Record<string, string>;
  imageAdjustments?: Record<string, { rotation: number; inverted: boolean }>;
}

export function PrintImagesLayout({ 
  patient, 
  clinic, 
  settings, 
  examType, 
  examDate, 
  selectedInstances, 
  gridType = '2x4',
  localUrls = {},
  imageAdjustments = {}
}: Props) {
  // Determine grid dimensions based on gridType
  let cols = 2;
  let rows = 4;
  let chunkSize = 8;

  if (gridType === '1x1') {
    cols = 1;
    rows = 1;
    chunkSize = 1;
  } else if (gridType === '1x2') {
    cols = 1;
    rows = 2;
    chunkSize = 2;
  } else if (gridType === '2x3') {
    cols = 2;
    rows = 3;
    chunkSize = 6;
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

  const primaryBaseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
  const backupBaseUrl = settings.dicomBackupViewerUrl || primaryBaseUrl;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id="print-images-area" className="hidden print:block w-full text-black bg-white text-[12px] leading-relaxed font-sans">
      {pages.map((pageInstances, pageIdx) => (
        <div key={pageIdx} className="print-images-page">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center gap-3">
              {clinic?.logoUrl && (
                <img src={clinic.logoUrl} alt="Logo" className="h-16 object-contain shrink-0" />
              )}
              <div>
                {!clinic?.logoUrl ? (
                  <h1 className="text-xl font-bold uppercase tracking-tight text-ink-900">{clinic?.name || settings.clinicName || 'LAUD.US'}</h1>
                ) : (
                  <h2 className="text-sm font-bold uppercase text-ink-800 leading-tight">{clinic?.name || settings.clinicName}</h2>
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
              <span className="text-[10px] font-black text-ink-900 uppercase tracking-widest block mb-1">Documentação Fotográfica</span>
              <p><strong>Paciente:</strong> {patient.name} ({calculateAge(patient.birthDate)})</p>
              <p><strong>Exame:</strong> <span className="uppercase font-bold">{examType}</span></p>
              <p><strong>Data:</strong> {formatDate(examDate)}</p>
              <p className="text-ink-400 text-[10px] font-medium pt-0.5">Página {pageIdx + 1} de {pages.length}</p>
            </div>
          </div>

          {/* Grid Layout — classes defined in index.css for printing */}
          <div 
            className={
              gridType === '1x1' ? 'print-images-grid-1x1 flex-grow' :
              gridType === '1x2' ? 'print-images-grid-1x2 flex-grow' :
              gridType === '2x3' ? 'print-images-grid-2x3 flex-grow' :
              'print-images-grid-2x4 flex-grow'
            }
          >
            {pageInstances.map((instance, instIdx) => {
              const globalIndex = pageIdx * chunkSize + instIdx + 1;
              const instanceNum = instance.MainDicomTags?.InstanceNumber || globalIndex;
              
              const isBackup = (instance as any).serverSource === 'backup';
              const serverUrl = isBackup ? backupBaseUrl : primaryBaseUrl;
              const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
              const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
              const proxyPath = getProxyEndpoint(settings, isBackup);
              
              // Base fallback URL if local blob doesn't exist
              const fallbackUrl = `${proxyPath}?url=${encodeURIComponent(`${serverUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
              
              const previewUrl = localUrls[instance.ID] || fallbackUrl;

              const imgStyle = {
                width: '100%',
                height: '100%',
                objectFit: 'contain' as const,
                margin: 'auto'
              };

              return (
                <div key={instance.ID} className="print-image-card relative flex items-center justify-center bg-black overflow-hidden h-full w-full">
                  <img 
                    src={previewUrl} 
                    alt={`Imagem ${instanceNum}`}
                    style={imgStyle}
                  />
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-black pt-2 mt-4 text-left text-[9px] text-gray-400 flex justify-between leading-none">
            <span>Sincronização PACS Orthanc — LAUD.US</span>
            <span>Gerado automaticamente em {formatDate(Date.now())}</span>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
