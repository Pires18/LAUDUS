import { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/Modal';
import { AppSettings, ExamRequest } from '../../../types';
import { Loader2, Camera, Printer, CheckSquare, Square, AlertTriangle, RefreshCw } from 'lucide-react';
import { getActivePacsUrl, getProxyEndpoint } from '../../../store/db';
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
  onPrint: (instances: any[], gridType: string) => void;
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
  onPrint 
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridType, setGridType] = useState<string>('2x4');

  const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';

  const initializedRef = useRef(false);
  const prevInstanceIdsRef = useRef<string[]>([]);

  // Keep selection in sync: select all initially, and auto-select new instances as they arrive,
  // without overriding any manual deselection of existing instances.
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
    } else {
      initializedRef.current = false;
      prevInstanceIdsRef.current = [];
    }
  }, [open, instances]);

  const handleToggleSelect = (id: string) => {
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
    onPrint(selectedInstances, gridType);
  };

  return (
    <Modal open={open} onClose={onClose} title="Imagens do Exame (Orthanc PACS)" size="lg">
      <div className="space-y-5">
        {/* Info Header */}
        <div className="flex items-start justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-start gap-3">
            <Camera className="text-slate-500 shrink-0 mt-0.5" size={18} />
            <div className="text-xs leading-normal font-semibold text-slate-600">
              Busca direta de imagens no servidor Orthanc local em <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">{baseUrl}</code>.
              Selecione as fotos do PACS que deseja incluir na documentação fotográfica impressa.
            </div>
          </div>
          {settings.dicomSyncEnabled !== false && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-wider text-emerald-700 shrink-0 select-none shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronismo Ativo
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-brand-600" />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Buscando imagens do exame no PACS...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="text-amber-500" size={32} />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Falha de Conexão ou Estudo Não Encontrado</h4>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed max-w-md">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw size={12} />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Gallery Content */}
        {!loading && !error && instances.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {instances.length} imagens carregadas • {selectedIds.size} selecionadas
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="text-[9px] font-black text-brand-700 hover:text-brand-850 uppercase tracking-wider flex items-center gap-1"
                >
                  <CheckSquare size={12} />
                  Selecionar Tudo
                </button>
                <div className="h-3 w-px bg-slate-200" />
                <button
                  onClick={handleClearSelection}
                  className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider flex items-center gap-1"
                >
                  <Square size={12} />
                  Limpar
                </button>
              </div>
            </div>

            {/* Images Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[260px] overflow-y-auto pr-1.5 custom-scrollbar">
              {instances.map((instance, idx) => {
                const isSelected = selectedIds.has(instance.ID);
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
                  <button
                    key={instance.ID}
                    onClick={() => handleToggleSelect(instance.ID)}
                    className={classNames(
                      "group relative aspect-square rounded-xl border overflow-hidden flex flex-col justify-between bg-black transition-all",
                      isSelected 
                        ? "border-brand-500 ring-2 ring-brand-500/20 scale-[0.98] shadow-sm" 
                        : "border-slate-200 hover:border-slate-400"
                    )}
                  >
                    {/* Checkbox Overlay */}
                    <div className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/20 text-white transition-all">
                      {isSelected ? (
                        <div className="w-3.5 h-3.5 bg-brand-500 rounded flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded border border-white/60" />
                      )}
                    </div>

                    {/* Dicom Image Preview */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
                      <DicomThumbnail
                        src={previewUrl}
                        alt={`Instance ${instNum}`}
                        className="group-hover:scale-105"
                      />
                    </div>

                    {/* Metadata Footer */}
                    <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 text-left w-full text-[9px] font-bold text-slate-300 border-t border-white/5 z-10">
                      Foto {idx + 1} {instance.MainDicomTags?.InstanceNumber ? `(Inst. ${instance.MainDicomTags.InstanceNumber})` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col gap-4 pt-3 border-t border-slate-100">
          {/* Grid Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Layout de Impressão:</span>
            <select
              value={gridType}
              onChange={(e) => setGridType(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer shadow-sm"
            >
              <option value="1x2">1 Coluna x 2 Linhas (2 fotos/pág)</option>
              <option value="2x4">2 Colunas x 4 Linhas (8 fotos/pág)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary h-11 px-5 rounded-2xl">
              Cancelar
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || loading || !!error}
              onClick={handleGeneratePdf}
              className="btn-primary h-11 px-6 rounded-2xl shadow-brand flex items-center gap-2"
            >
              <Printer size={16} />
              <span className="font-bold text-xs uppercase tracking-widest">
                {selectedIds.size > 0 ? `Imprimir PDF (${selectedIds.size})` : 'Imprimir PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
