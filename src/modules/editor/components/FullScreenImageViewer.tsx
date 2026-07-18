import type { ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface FullScreenImageViewerProps {
  instances: any[];
  activeImageIndex: number;
  preloadedUrls: Record<string, string>;
  failedIds: string[];
  instancesReady: boolean;
  preloadProgress: { done: number; total: number };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRetry: (instanceId: string) => void;
  /** Mostra o FAB para reabrir o Copiloto (oculto quando já está aberto/finalizado). */
  showCopilotFab: boolean;
  onOpenCopilot: () => void;
  /** Painel do Copiloto renderizado lado a lado (mesmo do editor). */
  copilotSidebar: ReactNode;
}

/**
 * Visor de imagem DICOM em tela cheia — com navegação (setas/scroll), estados de
 * carregando/falha/retry e o Copiloto lado a lado. Extraído de ExamEditor.
 */
export function FullScreenImageViewer({
  instances,
  activeImageIndex,
  preloadedUrls,
  failedIds,
  instancesReady,
  preloadProgress,
  onClose,
  onPrev,
  onNext,
  onRetry,
  showCopilotFab,
  onOpenCopilot,
  copilotSidebar,
}: FullScreenImageViewerProps) {
  const activeInstance = instances[activeImageIndex];
  if (!activeInstance) return null;

  const instanceNum = activeInstance.MainDicomTags?.InstanceNumber || (activeImageIndex + 1);
  const activeUrl = preloadedUrls[activeInstance.ID];
  const activeFailed = failedIds.includes(activeInstance.ID);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex animate-fade-in">
      {/* Área da imagem — encolhe quando o Copiloto está aberto ao lado. */}
      <div
        className="relative flex-1 min-w-0 flex flex-col items-center justify-center p-4 cursor-zoom-out"
        onClick={onClose}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10 z-[210]"
          title="Fechar Tela Cheia"
        >
          <X size={24} />
        </button>

        {/* FAB Copiloto — reabre o painel na imagem ampliada. */}
        {showCopilotFab && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenCopilot(); }}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl z-[210] transition-all transform hover:scale-105 active:scale-95 border-2 bg-brand-600 text-white border-brand-500 shadow-brand-500/30"
            title="Abrir Copiloto"
          >
            <Sparkles size={24} />
          </button>
        )}

        {/* Navegação */}
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-2xl z-[210] cursor-pointer"
          title="Anterior (Seta Esquerda)"
        >
          <ChevronLeft size={32} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all active:scale-95 shadow-2xl z-[210] cursor-pointer"
          title="Próxima (Seta Direita)"
        >
          <ChevronRight size={32} />
        </button>

        <div
          className="relative max-w-full max-h-full flex flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => { if (e.deltaY < 0) onPrev(); else if (e.deltaY > 0) onNext(); }}
        >
          {!activeUrl && !activeFailed ? (
            <div className="w-[60vw] max-w-lg aspect-video flex flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Carregando imagem{!instancesReady ? ` (${preloadProgress.done}/${preloadProgress.total})` : ''}...
              </span>
            </div>
          ) : activeFailed ? (
            <div className="w-[60vw] max-w-lg aspect-video flex flex-col items-center justify-center gap-3 text-white/70 border border-white/10 rounded-lg bg-white/5">
              <AlertCircle size={28} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Imagem indisponível</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(activeInstance.ID); }}
                className="h-8 px-3 rounded-lg bg-amber-700 hover:bg-amber-600 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <img
              src={activeUrl}
              alt={`Instance ${instanceNum}`}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/5"
            />
          )}
          <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-black tracking-widest text-white uppercase select-none z-10">
            FOTO {activeImageIndex + 1} DE {instances.length} (INSTÂNCIA {instanceNum})
          </div>
        </div>
      </div>

      {/* Copiloto lado a lado — mesmo painel do editor, sem sobrepor a imagem */}
      <AnimatePresence>{copilotSidebar}</AnimatePresence>
    </div>
  );
}
