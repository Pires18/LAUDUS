import { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

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
  if (!open) return null;

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
    <div className="overlay-backdrop flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-medium border border-ink-100 max-w-sm w-full overlay-content"
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
        <div className="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmColors[variant]}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
