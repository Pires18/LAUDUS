import { useEffect, useState } from 'react';
import { onBroadcastChange } from '../store/db';
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { classNames } from '../utils/format';
import { AnimatePresence, motion } from 'framer-motion';

export function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<{ message: string; type: 'info' | 'warning' | 'error'; active: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return onBroadcastChange((data) => {
      setBroadcast(data as any);
      setDismissed(false);
    });
  }, []);

  if (!broadcast?.active || dismissed) return null;

  const Icon = broadcast.type === 'error' ? AlertCircle : broadcast.type === 'warning' ? AlertTriangle : Info;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={classNames(
          "w-full overflow-hidden relative z-[60] border-b border-white/10 shadow-lg",
          broadcast.type === 'error' ? "bg-red-600" :
          broadcast.type === 'warning' ? "bg-amber-600" :
          "bg-brand-700"
        )}
      >
        {/* Decorative Mesh */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -left-20 top-0 w-64 h-full bg-white rounded-full blur-3xl animate-pulse" />
          <div className="absolute -right-20 top-0 w-64 h-full bg-black/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-6 relative">
          <div className="flex items-center gap-4 text-white">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner backdrop-blur-md border border-white/10">
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-0.5">Comunicado Global</p>
              <p className="text-sm font-black uppercase tracking-widest text-white leading-tight">
                {broadcast.message}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setDismissed(true)}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-2xl transition-all text-white/80 active:scale-95"
          >
            <X size={20} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
