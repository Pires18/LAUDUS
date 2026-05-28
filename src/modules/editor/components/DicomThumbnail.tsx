import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { classNames } from '../../../utils/format';

interface Props {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export function DicomThumbnail({ src, alt, className, containerClassName }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset states when the image source changes
  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [src, retryCount]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const finalSrc = retryCount > 0 
    ? `${src}&retry=${retryCount}` 
    : src;

  return (
    <div className={classNames(
      "relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none",
      containerClassName
    )}>
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-[1px] gap-2 z-10">
          <Loader2 className="animate-spin text-slate-400" size={16} />
        </div>
      )}
      
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 bg-slate-900/90 text-center z-10 border border-amber-500/20">
          <AlertTriangle className="text-amber-500 shrink-0" size={16} />
          <span className="text-[9px] text-slate-300 font-black uppercase tracking-wider leading-none">Falha ao carregar</span>
          <button 
            type="button"
            onClick={handleRetry}
            className="mt-1 h-6 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider transition-all shadow-sm border border-amber-500/25"
          >
            Repetir
          </button>
        </div>
      ) : null}

      <img
        src={finalSrc}
        alt={alt}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={classNames(
          "max-w-full max-h-full object-contain transition-all duration-300",
          loading ? "opacity-0 scale-95" : "opacity-100 scale-100",
          className
        )}
      />
    </div>
  );
}
