import { useState, useEffect } from 'react';
import { Modal } from '../../../components/Modal';
import { AppSettings, ExamRequest } from '../../../types';
import { Loader2, Camera, Printer, CheckSquare, Square, AlertTriangle, RefreshCw } from 'lucide-react';
import { classNames } from '../../../utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  exam: ExamRequest;
  settings: AppSettings;
  onPrint: (instances: any[], gridType: string) => void;
}

export function DicomImagesModal({ open, onClose, exam, settings, onPrint }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridType, setGridType] = useState<string>('2x3');

  const baseUrl = settings.dicomViewerUrl || 'http://localhost:8042';
  const studyUid = `1.2.276.0.7230010.3.1.2.${exam.id}`;

  useEffect(() => {
    if (open) {
      fetchImages();
    }
  }, [open, exam.id, baseUrl]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const authParams = `&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
      const findUrl = `${baseUrl.replace(/\/$/, '')}/tools/find`;
      
      // 1. Localiza o estudo no Orthanc usando o StudyInstanceUID via POST /tools/find
      const lookupRes = await fetch(
        `/api/orthanc-proxy?url=${encodeURIComponent(findUrl)}${authParams}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Level: 'Study',
            Query: {
              StudyInstanceUID: studyUid
            }
          })
        }
      );
      
      if (!lookupRes.ok) {
        throw new Error(`Não foi possível conectar ao Orthanc (${lookupRes.status}).`);
      }
      
      const studies = await lookupRes.json();
      if (!studies || studies.length === 0) {
        setError(`Estudo não localizado no Orthanc. Certifique-se de que o exame foi realizado na máquina de ultrassom com o ID ${exam.id} e enviado ao PACS.`);
        setInstances([]);
        return;
      }
      
      const studyId = studies[0];
      
      // 2. Busca todas as instâncias (imagens/fatias) daquele estudo
      const instancesUrl = `${baseUrl.replace(/\/$/, '')}/studies/${studyId}/instances`;
      const instancesRes = await fetch(`/api/orthanc-proxy?url=${encodeURIComponent(instancesUrl)}${authParams}`);
      
      if (!instancesRes.ok) {
        throw new Error(`Erro ao obter imagens do estudo do Orthanc.`);
      }
      
      const data = await instancesRes.json();
      
      // Ordena por InstanceNumber
      const sorted = data.sort((a: any, b: any) => {
        const numA = parseInt(a.MainDicomTags?.InstanceNumber || '0', 10);
        const numB = parseInt(b.MainDicomTags?.InstanceNumber || '0', 10);
        return numA - numB;
      });
      
      setInstances(sorted);
      // Seleciona todas por padrão
      setSelectedIds(new Set(sorted.map((inst: any) => inst.ID)));
    } catch (err: any) {
      console.error('[Orthanc Fetch Error]', err);
      setError(err.message || 'Erro de conexão com o servidor local Orthanc.');
    } finally {
      setLoading(false);
    }
  };

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
    <Modal open={open} onClose={onClose} title="Imagens do Exame (Orthanc PACS)">
      <div className="space-y-5">
        {/* Info Header */}
        <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <Camera className="text-slate-500 shrink-0 mt-0.5" size={18} />
          <div className="text-xs leading-normal font-semibold text-slate-600">
            Busca direta de imagens no servidor Orthanc local em <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">{baseUrl}</code>.
            Selecione as fotos do PACS que deseja incluir na documentação fotográfica impressa.
          </div>
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
              onClick={fetchImages}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
              {instances.map((instance, idx) => {
                const isSelected = selectedIds.has(instance.ID);
                const previewUrl = `/api/orthanc-proxy?url=${encodeURIComponent(`${baseUrl.replace(/\/$/, '')}/instances/${instance.ID}/preview`)}&username=${encodeURIComponent(settings.dicomUsername || '')}&password=${encodeURIComponent(settings.dicomPassword || '')}`;
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
                    <div className="flex-1 flex items-center justify-center overflow-hidden">
                      <img
                        src={previewUrl}
                        alt={`Instance ${instNum}`}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Metadata Footer */}
                    <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 text-left w-full text-[9px] font-bold text-slate-300 border-t border-white/5">
                      Foto {idx + 1} {instance.MainDicomTags?.InstanceNumber ? `(Inst. ${instance.MainDicomTags.InstanceNumber})` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
          {/* Grid Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Layout de Impressão:</span>
            <select
              value={gridType}
              onChange={(e) => setGridType(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer shadow-sm"
            >
              <option value="1x2">1 Coluna x 2 Linhas (2 fotos/pág)</option>
              <option value="2x2">2 Colunas x 2 Linhas (4 fotos/pág)</option>
              <option value="2x3">2 Colunas x 3 Linhas (6 fotos/pág)</option>
              <option value="2x4">2 Colunas x 4 Linhas (8 fotos/pág)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
