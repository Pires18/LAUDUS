import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message: string | null;
  onRetry?: () => void;
}

export function CollectionError({ message, onRetry }: Props) {
  if (!message) return null;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
        <AlertTriangle size={24} className="text-rose-500" />
      </div>
      <div className="text-center max-w-sm">
        <p className="text-sm font-black text-ink-900 mb-1">Falha ao carregar dados</p>
        <p className="text-xs text-ink-500 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-ink-800 transition-all active:scale-95 shadow-sm"
      >
        <RefreshCw size={12} />
        Tentar novamente
      </button>
    </div>
  );
}
