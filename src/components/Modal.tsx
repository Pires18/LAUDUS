import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  theme?: 'light' | 'dark';
}

export function Modal({ open, onClose, title, children, footer, size = 'md', theme = 'light' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  }[size];

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className={`w-full ${sizeClass} modal-mobile-sheet max-h-[90dvh] md:max-h-[90vh] flex flex-col relative z-10 overflow-hidden rounded-3xl border shadow-premium ${
              isDark ? 'bg-[#0c0c0e] border-zinc-800' : 'bg-white border-ink-150'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
              isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-ink-100 bg-white'
            }`}>
              <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-zinc-100' : 'text-ink-900'}`}>{title}</h2>
              <button
                onClick={onClose}
                className={`transition-colors p-1.5 rounded-xl ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-ink-400 hover:text-brand-600 hover:bg-brand-50'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className={`flex-1 overflow-auto px-6 py-5 ${isDark ? 'bg-[#0c0c0e]' : 'bg-white'}`}>{children}</div>

            {/* Footer */}
            {footer && (
              <div className={`px-6 py-4 border-t flex justify-end gap-3 shrink-0 ${
                isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-ink-100 bg-ink-50/50'
              }`}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
