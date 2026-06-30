import { Loader2, AlertCircle, AlertTriangle, Eye, X, Printer, RefreshCw, SlidersHorizontal, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { classNames } from '../../../utils/format';
import { DicomThumbnail } from './DicomThumbnail';
import { getProxyEndpoint, getActivePacsUrl } from '../../../store/db';
import type { AppSettings } from '../../../types';

interface DicomViewerSidebarProps {
  dicomInstances: any[];
  activeImageIndex: number;
  setActiveImageIndex: (idx: number) => void;
  handlePrevImage: () => void;
  handleNextImage: () => void;
  selectedStudyId: string | null;
  setSelectedStudyId: (id: string) => void;
  candidateStudies: any[];
  settings: AppSettings;
  dicomLoading: boolean;
  dicomError: string | null;
  setDicomRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setShowFullScreenImage: (v: boolean) => void;
  onClose: () => void;
  showStudySelector: boolean;
  setShowStudySelector: (v: boolean) => void;
  pacsConnected: string;
  pacsBackupConnected: string;
  activePacsServer: 'primary' | 'backup' | 'both';
  setActivePacsServer: (v: 'primary' | 'backup' | 'both') => void;
  externalViewerUrl: string | null;
  setShowDicomImages: (v: boolean) => void;
}

export function DicomViewerSidebar({
  dicomInstances,
  activeImageIndex,
  setActiveImageIndex,
  handlePrevImage,
  handleNextImage,
  selectedStudyId,
  setSelectedStudyId,
  candidateStudies,
  settings,
  dicomLoading,
  dicomError,
  setDicomRefreshKey,
  setShowFullScreenImage,
  onClose,
  showStudySelector,
  setShowStudySelector,
  pacsConnected,
  pacsBackupConnected,
  activePacsServer,
  setActivePacsServer,
  externalViewerUrl,
  setShowDicomImages,
}: DicomViewerSidebarProps) {
  return (
    <div className="absolute lg:relative z-30 lg:z-20 w-full lg:w-[460px] xl:w-[540px] border-r border-zinc-800/80 bg-[#0c0c0e] text-zinc-100 flex flex-col shrink-0 min-h-0 animate-fade-in inset-y-0 left-0 font-sans">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/80 bg-[#09090b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {dicomLoading && (
            <Loader2 size={12} className="animate-spin text-emerald-500" />
          )}
          <div className="flex items-center gap-3">
            {(settings.dicomBackupViewerUrl || settings.dicomBackupTailscalePublicUrl) ? (
              <div className="flex items-center gap-2">
                <select
                  value={activePacsServer}
                  onChange={(e) => {
                    const val = e.target.value as 'primary' | 'backup' | 'both';
                    setActivePacsServer(val);
                    localStorage.setItem('laudus_active_pacs_server', val);
                    setDicomRefreshKey(prev => prev + 1);
                  }}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-wider rounded-xl px-2 py-1.5 focus:outline-none cursor-pointer hover:border-zinc-700 transition-colors"
                >
                  <option value="both">Ambos PACS</option>
                  <option value="primary">PACS Principal</option>
                  <option value="backup">PACS Backup</option>
                </select>
                <div className="flex items-center gap-1.5 ml-1">
                  {activePacsServer !== 'backup' && (
                    <div
                      className={classNames(
                        "w-1.5 h-1.5 rounded-full",
                        pacsConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" : pacsConnected === 'disconnected' ? "bg-rose-500" : "bg-zinc-650 animate-pulse"
                      )}
                      title={`PACS Principal: ${pacsConnected}`}
                    />
                  )}
                  {activePacsServer !== 'primary' && (
                    <div
                      className={classNames(
                        "w-1.5 h-1.5 rounded-full",
                        pacsBackupConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" : pacsBackupConnected === 'disconnected' ? "bg-rose-500" : "bg-zinc-650 animate-pulse"
                      )}
                      title={`PACS Backup: ${pacsBackupConnected}`}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div
                  className={classNames(
                    "w-2 h-2 rounded-full",
                    pacsConnected === 'connected' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : pacsConnected === 'disconnected' ? "bg-rose-500" : "bg-zinc-650 animate-pulse"
                  )}
                  title={`PACS Principal: ${pacsConnected === 'connected' ? 'Online' : pacsConnected === 'disconnected' ? 'Offline' : 'Carregando'}`}
                />
                <span className="font-black text-[9px] uppercase tracking-widest text-zinc-400">
                  PACS Principal
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {candidateStudies.length > 1 && (
            <button
              onClick={() => setShowStudySelector(!showStudySelector)}
              className={classNames(
                "h-8 px-2.5 rounded-xl flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all border",
                showStudySelector
                  ? "bg-brand-600 text-white border-brand-500 shadow-sm"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white"
              )}
              title="Vários estudos localizados para este paciente"
            >
              <SlidersHorizontal size={12} />
              <span>Estudos ({candidateStudies.length})</span>
            </button>
          )}
          <button
            onClick={() => setDicomRefreshKey(prev => prev + 1)}
            disabled={dicomLoading}
            className={classNames(
              "p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all active:scale-95 border border-transparent hover:border-zinc-800",
              dicomLoading && "animate-spin"
            )}
            title="Atualizar Imagens"
          >
            <RefreshCw size={14} />
          </button>
          {externalViewerUrl && (
            <a
              href={externalViewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-350 hover:text-white flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all border border-zinc-800 active:scale-95 shadow-sm select-none"
              title="Abrir no Visualizador Orthanc Externo (Stone Viewer, etc.)"
            >
              <ExternalLink size={12} className="text-brand-400" />
              <span>Viewer</span>
            </a>
          )}
          <button
            onClick={() => setShowDicomImages(true)}
            className="h-8 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all shadow-md border border-brand-500/20"
            title="Gerar/Imprimir PDF das Imagens"
          >
            <Printer size={12} />
            <span>PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all active:scale-95 border border-transparent hover:border-zinc-800"
            title="Fechar Visualizador"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Candidate Studies Dropdown Selector Panel */}
      {showStudySelector && candidateStudies.length > 0 && (
        <div className="bg-[#09090b] border-b border-zinc-800/80 p-4 space-y-2 shrink-0 animate-slide-down">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Selecione o Estudo DICOM correspondente:</span>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar font-sans">
            {candidateStudies.map((study) => {
              const date = study.MainDicomTags?.StudyDate || '';
              const time = study.MainDicomTags?.StudyTime || '';
              const desc = study.MainDicomTags?.StudyDescription || study.RequestedProcedureDescription || 'Sem descrição';
              const formattedDate = date ? `${date.substring(6, 8)}/${date.substring(4, 6)}/${date.substring(0, 4)}` : 'Data ignorada';
              const formattedTime = time ? `${time.substring(0, 2)}:${time.substring(2, 4)}` : '';
              const isCurrent = study.ID === selectedStudyId;

              return (
                <button
                  key={study.ID}
                  onClick={() => {
                    setSelectedStudyId(study.ID);
                    setShowStudySelector(false);
                  }}
                  className={classNames(
                    "w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-3 cursor-pointer",
                    isCurrent
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                      : "bg-[#0c0c0e] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  )}
                >
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-[11px]">{desc}</p>
                      <p className="text-[9px] opacity-75 mt-0.5">{formattedDate} {formattedTime} • ID: {study.MainDicomTags?.PatientID || '—'}</p>
                    </div>
                    <span className={classNames(
                      "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 select-none",
                      study.serverSource === 'backup'
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    )}>
                      {study.serverSource === 'backup' ? 'Backup' : 'Principal'}
                    </span>
                  </div>
                  {isCurrent && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Preview Area */}
      <div className="p-5 flex flex-col items-center justify-center shrink-0 border-b border-zinc-800/80 bg-[#09090b]/40">
        {(() => {
          const activeInstance = dicomInstances[activeImageIndex];
          const activeStudy = candidateStudies.find(c => c.ID === selectedStudyId);
          const activeServerSource = activeStudy?.serverSource || 'primary';
          if (!activeInstance) {
            return (
              <div
                className="relative w-full max-w-6xl aspect-video bg-black rounded-3xl border border-zinc-850 overflow-hidden shadow-2xl flex flex-col items-center justify-center text-zinc-600 p-6 text-center"
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    handlePrevImage();
                  } else if (e.deltaY > 0) {
                    handleNextImage();
                  }
                }}
              >
                <Eye size={32} className="opacity-25 mb-2" />
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Sem Imagem Selecionada</span>
              </div>
            );
          }
          const isBackup = activeServerSource === 'backup';
          const currentBaseUrl = getActivePacsUrl(settings, isBackup);
          const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
          const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
          const proxyPath = getProxyEndpoint(settings, isBackup);
          const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
          const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);

          return (
            <div className="w-full flex flex-col gap-3 font-sans">
              <div
                onClick={() => setShowFullScreenImage(true)}
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    handlePrevImage();
                  } else if (e.deltaY > 0) {
                    handleNextImage();
                  }
                }}
                className="relative aspect-[4/3] w-full bg-black rounded-2xl border border-zinc-800 overflow-hidden flex items-center justify-center group shadow-2xl cursor-zoom-in transition-all duration-300 hover:border-zinc-700"
              >
                <DicomThumbnail
                  src={previewUrl}
                  alt={`Instance ${instanceNum}`}
                  className="hover:scale-[1.01] transition-transform duration-500 max-h-full max-w-full object-contain"
                  priority={true}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/75 hover:bg-black/90 text-white/80 hover:text-white border border-zinc-800 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg z-20 cursor-pointer"
                  title="Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/75 hover:bg-black/90 text-white/80 hover:text-white border border-zinc-800 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 active:scale-95 shadow-lg z-20 cursor-pointer"
                  title="Próxima"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 backdrop-blur-sm border border-zinc-800 text-[8px] font-black tracking-widest text-zinc-300 uppercase shadow-md animate-fade-in z-20">
                  FOTO {activeImageIndex + 1} / {dicomInstances.length}
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 px-1 mt-1">
                <span className="font-mono text-[9px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">Instância: {instanceNum}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Thumbnails Grid List or Error State */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0c0c0e]">
        {dicomLoading && dicomInstances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center font-sans">
            <Loader2 size={24} className="animate-spin text-brand-500 mb-3" />
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Buscando Exames no PACS...</span>
          </div>
        ) : dicomError && dicomInstances.length === 0 ? (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 flex flex-col items-center text-center gap-2.5 my-4 font-sans">
            <AlertTriangle className="text-amber-500" size={24} />
            <p className="text-[10px] text-amber-200/80 font-medium leading-relaxed">
              {dicomError}
            </p>
            <button
              type="button"
              onClick={() => setDicomRefreshKey(prev => prev + 1)}
              className="h-7 px-3 rounded-lg bg-amber-700 hover:bg-amber-600 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : dicomInstances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center px-4 font-sans">
            <AlertCircle className="text-zinc-500 mb-3" size={24} />
            <span className="text-[10px] font-black uppercase tracking-wider block text-zinc-300">Nenhum Estudo Selecionado</span>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight mt-1">Verifique o identificador do paciente ou clique em "Estudos" acima para selecionar manualmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 font-sans">
            {dicomInstances.map((instance, idx) => {
              const isActive = idx === activeImageIndex;
              const isBackup = instance.serverSource === 'backup';
              const currentBaseUrl = getActivePacsUrl(settings, isBackup);
              const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
              const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
              const proxyPath = getProxyEndpoint(settings, isBackup);
              const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

              return (
                <button
                  key={instance.ID}
                  onClick={() => setActiveImageIndex(idx)}
                  className={classNames(
                    "relative aspect-[4/3] bg-black border rounded-xl overflow-hidden flex items-center justify-center transition-all group active:scale-95 shadow-md cursor-pointer",
                    isActive
                      ? "border-brand-500 ring-2 ring-brand-500/25 scale-[0.98]"
                      : "border-zinc-800 hover:border-zinc-600 hover:scale-[1.02]"
                  )}
                >
                  <DicomThumbnail src={previewUrl} alt={`Instance ${idx + 1}`} />
                  <div className={classNames(
                    "absolute bottom-0 inset-x-0 py-0.5 text-center text-[7px] font-black tracking-widest uppercase border-t z-10 select-none",
                    isActive
                      ? "bg-brand-950/80 text-brand-400 border-brand-800"
                      : "bg-zinc-950/80 text-zinc-500 border-zinc-800"
                  )}>
                    Foto {idx + 1}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
