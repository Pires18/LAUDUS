import { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../../../components/Modal';
import { AppSettings, ExamRequest } from '../../../types';
import { 
  Loader2, Camera, Printer, CheckSquare, Square, 
  AlertTriangle, RefreshCw, RotateCw, Contrast, Check
} from 'lucide-react';
import { getProxyEndpoint } from '../../../store/db';
import { classNames } from '../../../utils/format';
import { DicomThumbnail } from './DicomThumbnail';

interface Props {
  open: boolean;
  onClose: () => void;
  exam: ExamRequest;
  settings: AppSettings;
  instances: any[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPrint: (
    instances: any[], 
    gridType: string, 
    adjustments: Record<string, { rotation: number; inverted: boolean }>
  ) => void;
  activePacsServer: 'primary' | 'backup' | 'both';
}

export function DicomImagesModal({ 
  open, 
  onClose, 
  exam, 
  settings, 
  instances, 
  loading, 
  error, 
  onRefresh, 
  onPrint,
  activePacsServer
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridType, setGridType] = useState<string>('2x4');
  
  // Viewport Active Image
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);

  const baseUrl = activePacsServer === 'backup'
    ? (settings.dicomBackupViewerUrl || 'http://localhost:8043')
    : (settings.dicomViewerUrl || 'http://localhost:8042');

  const initializedRef = useRef(false);
  const prevInstanceIdsRef = useRef<string[]>([]);

  // Reset active image and adjustments on close/open
  useEffect(() => {
    if (open) {
      const currentIds = instances.map((inst: any) => inst.ID);
      if (!initializedRef.current) {
        setSelectedIds(new Set(currentIds));
        initializedRef.current = true;
      } else {
        const prevIds = prevInstanceIdsRef.current;
        const newIds = currentIds.filter(id => !prevIds.includes(id));
        if (newIds.length > 0) {
          setSelectedIds(prev => {
            const next = new Set(prev);
            newIds.forEach(id => next.add(id));
            return next;
          });
        }
      }
      prevInstanceIdsRef.current = currentIds;

      // Set default active image to first instance
      if (instances.length > 0 && !activeInstanceId) {
        setActiveInstanceId(instances[0].ID);
      }
    } else {
      initializedRef.current = false;
      prevInstanceIdsRef.current = [];
      setSelectedIds(new Set());
      setActiveInstanceId(null);
    }
  }, [open, instances]);

  // Sync activeInstanceId if it becomes empty
  useEffect(() => {
    if (instances.length > 0 && !activeInstanceId) {
      setActiveInstanceId(instances[0].ID);
    }
  }, [instances, activeInstanceId]);

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(instances.map(inst => inst.ID)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleGeneratePdf = () => {
    if (selectedIds.size === 0) return;
    const selectedInstances = instances.filter(inst => selectedIds.has(inst.ID));
    onPrint(selectedInstances, gridType, {});
  };

  // Active Instance helper variables
  const activeInstance = useMemo(() => {
    return instances.find(inst => inst.ID === activeInstanceId) || null;
  }, [instances, activeInstanceId]);

  const activeImageUrl = useMemo(() => {
    if (!activeInstance) return null;
    const isBackup = activeInstance.serverSource === 'backup';
    const currentBaseUrl = isBackup
      ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
      : (settings.dicomViewerUrl || 'http://localhost:8042');
    const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
    const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
    const proxyPath = getProxyEndpoint(settings, isBackup);
    
    return `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${activeInstance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  }, [activeInstance, settings]);



  // Visual layout config selector cards
  const gridOptions = [
    { value: '1x1', label: 'Cheio (1x1)', desc: '1 foto por página', rows: 1, cols: 1 },
    { value: '1x2', label: 'Duplo (1x2)', desc: '2 fotos por página', rows: 2, cols: 1 },
    { value: '2x3', label: 'Compacto (2x3)', desc: '6 fotos por página', rows: 3, cols: 2 },
    { value: '2x4', label: 'Padrão (2x4)', desc: '8 fotos por página', rows: 4, cols: 2 },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Console PACS Orthanc — Diagnóstico e Impressão" size="xl" theme="dark">
      <div className="space-y-5 text-zinc-100 font-sans select-none">
        
        {/* Connection status bar */}
        <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800/80 p-3.5 rounded-2xl">
          <div className="flex items-center gap-3">
            <Camera className="text-zinc-500 shrink-0" size={16} />
            <span className="text-[11px] font-semibold text-zinc-400">
              Servidor PACS Ativo: <code className="bg-zinc-800 text-brand-400 px-1.5 py-0.5 rounded font-mono text-[10px]">{baseUrl}</code>
            </span>
          </div>
          {settings.dicomSyncEnabled !== false && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Conexão PACS Ok
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 bg-zinc-900/50 border border-zinc-800/55 rounded-3xl">
            <Loader2 size={36} className="animate-spin text-brand-500" />
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Carregando Estudos PACS...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="text-amber-500" size={36} />
            <div className="space-y-1.5">
              <h4 className="text-sm font-black text-zinc-200 uppercase tracking-wider">Falha na Sincronização PACS</h4>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-md font-medium">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 h-10 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-zinc-700 shadow-sm transition-all"
            >
              <RefreshCw size={12} />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Diagnostic Workspace Grid (Split view layout) */}
        {!loading && !error && instances.length > 0 && (
          <div className="grid grid-cols-12 gap-5 min-h-[450px]">
            
            {/* LEFT AREA (40% width): Thumbnails Selection Panel */}
            <div className="col-span-12 md:col-span-5 flex flex-col bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 overflow-hidden max-h-[500px]">
              
              {/* Header Toggles */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3 shrink-0">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Estudo: {instances.length} Fotos · {selectedIds.size} no PDF
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-[9px] font-bold text-zinc-300 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <CheckSquare size={11} className="text-brand-500" />
                    Tudo
                  </button>
                  <div className="h-3 w-px bg-zinc-800" />
                  <button
                    onClick={handleClearSelection}
                    className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    <Square size={11} />
                    Limpar
                  </button>
                </div>
              </div>

              {/* Scrollable Thumbnails Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2.5">
                  {instances.map((instance, idx) => {
                    const isSelected = selectedIds.has(instance.ID);
                    const isActive = activeInstanceId === instance.ID;
                    const isBackup = instance.serverSource === 'backup';
                    const currentBaseUrl = isBackup
                      ? (settings.dicomBackupViewerUrl || 'http://localhost:8042')
                      : (settings.dicomViewerUrl || 'http://localhost:8042');
                    const username = isBackup ? (settings.dicomBackupUsername || '') : (settings.dicomUsername || '');
                    const password = isBackup ? (settings.dicomBackupPassword || '') : (settings.dicomPassword || '');
                    const proxyPath = getProxyEndpoint(settings, isBackup);
                    const previewUrl = `${proxyPath}?url=${encodeURIComponent(`${currentBaseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
                    const instNum = instance.MainDicomTags?.InstanceNumber || (idx + 1);

                    return (
                      <div
                        key={instance.ID}
                        onClick={() => setActiveInstanceId(instance.ID)}
                        className={classNames(
                          "relative aspect-[4/3] rounded-xl border overflow-hidden flex flex-col justify-between bg-black transition-all duration-300 cursor-pointer group",
                          isActive 
                            ? "border-brand-500 ring-2 ring-brand-500/25" 
                            : "border-zinc-800/80 hover:border-zinc-700"
                        )}
                      >
                        {/* Selected Indicator Checkbox - Click to select/deselect */}
                        <div 
                          onClick={(e) => handleToggleSelect(instance.ID, e)}
                          className="absolute top-2 right-2 z-20 p-1 rounded-md bg-black/60 backdrop-blur-sm border border-zinc-800 text-white transition-all hover:bg-black"
                        >
                          {isSelected ? (
                            <div className="w-3.5 h-3.5 bg-brand-500 rounded flex items-center justify-center shadow-inner">
                              <Check size={10} strokeWidth={3} className="text-white" />
                            </div>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded border border-zinc-600" />
                          )}
                        </div>

                        {/* Thumbnail View */}
                        <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full relative">
                          <DicomThumbnail
                            src={previewUrl}
                            alt={`Instance ${instNum}`}
                            className={classNames(
                              "transition-transform duration-500 group-hover:scale-105",
                              isActive ? "scale-97" : ""
                            )}
                          />
                          {/* Selected overlay shadow */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-brand-500/5 pointer-events-none" />
                          )}
                        </div>

                        {/* Caption bar */}
                        <div className={classNames(
                          "px-2 py-1 text-left w-full text-[9px] font-black border-t z-10 transition-colors uppercase tracking-wider flex justify-between",
                          isActive 
                            ? "bg-brand-950/80 text-brand-400 border-brand-800" 
                            : "bg-zinc-950/80 text-zinc-500 border-zinc-800"
                        )}>
                          <span>Foto {idx + 1}</span>
                          {instance.MainDicomTags?.InstanceNumber && <span>Inst. {instance.MainDicomTags.InstanceNumber}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT AREA (60% width): Diagnostic Viewport Pane */}
            <div className="col-span-12 md:col-span-7 flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden max-h-[500px]">
              
              {/* Toolbar */}
              <div className="bg-[#09090b] border-b border-zinc-800/80 px-4 py-2 flex items-center justify-between shrink-0 font-sans">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Visualizador de Imagem
                </span>
              </div>

              {/* High-res viewport canvas */}
              <div className="flex-1 bg-black relative flex items-center justify-center p-6 overflow-hidden">
                {activeImageUrl ? (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <img
                      src={activeImageUrl}
                      alt="Viewport"
                      style={{
                        maxHeight: '100%',
                        maxWidth: '100%',
                        objectFit: 'contain'
                      }}
                      className="rounded-lg shadow-2xl"
                    />
                    
                    {/* Status marker */}
                    <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur-sm border border-zinc-800 text-[9px] font-mono text-zinc-400 select-none">
                      {activeInstance?.MainDicomTags?.InstanceNumber ? `ID: ${activeInstanceId?.slice(0, 8)} · Inst: ${activeInstance.MainDicomTags.InstanceNumber}` : `ID: ${activeInstanceId?.slice(0, 8)}`}
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-500 italic text-xs">Selecione uma imagem para visualização.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions (redesigned with grid cards) */}
        <div className="flex flex-col gap-5 pt-4 border-t border-zinc-800/80">
          
          {/* Visual Grid Layout Cards */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Layout do PDF Final:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {gridOptions.map((opt) => {
                const isActive = gridType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGridType(opt.value)}
                    className={classNames(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-200 gap-2 relative shadow-sm cursor-pointer",
                      isActive
                        ? "bg-brand-500/10 border-brand-500 text-white font-bold"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                    )}
                  >
                    {/* Tiny representation of the grid */}
                    <div className="grid gap-0.5 border border-zinc-800 p-1 bg-black rounded" 
                      style={{
                        gridTemplateColumns: `repeat(${opt.cols}, minmax(0, 1fr))`,
                        width: '32px',
                        height: '24px'
                      }}
                    >
                      {Array.from({ length: opt.rows * opt.cols }).map((_, i) => (
                        <div key={i} className={classNames(
                          "rounded-[1px]",
                          isActive ? "bg-brand-500/80" : "bg-zinc-700"
                        )} />
                      ))}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider block">{opt.label}</span>
                      <span className="text-[8px] font-bold text-zinc-500">{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end pt-1">
            <button 
              type="button" 
              onClick={onClose} 
              className="h-11 px-6 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white transition-all font-bold text-xs uppercase tracking-widest cursor-pointer active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || loading || !!error}
              onClick={handleGeneratePdf}
              className="h-11 px-7 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:bg-zinc-800 text-white shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-widest cursor-pointer"
            >
              <Printer size={16} />
              <span>
                {selectedIds.size > 0 ? `Imprimir PDF (${selectedIds.size})` : 'Imprimir PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
