import { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
}: Props) {
  const iconColors = {
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
    info: 'bg-brand-50 text-brand-600',
  };

  const confirmColors = {
    danger: 'btn-danger',
    warning: 'btn-primary',
    info: 'btn-primary',
  };

  const IconComponent = variant === 'info' ? Info : AlertTriangle;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
          />

          {/* Dialog Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className="bg-white rounded-2xl shadow-premium border border-ink-100 max-w-sm w-full relative z-10 overflow-hidden modal-mobile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconColors[variant]}`}>
                  <IconComponent size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-ink-900 mb-1">{title}</h3>
                  <div className="text-sm text-ink-600 leading-relaxed">{message}</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/50">
              <button onClick={onCancel} className="btn-secondary">
                {cancelLabel}
              </button>
              <button onClick={onConfirm} className={confirmColors[variant]}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

