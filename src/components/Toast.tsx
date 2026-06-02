import { useApp } from '../store/app';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Toast() {
  const { toast, clearToast } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [toast]);

  if (!toast) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      borderColor: 'border-l-emerald-500',
      bgColor: 'bg-emerald-50/50',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-500',
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-50/50',
    },
    info: {
      icon: Info,
      iconColor: 'text-brand-500',
      borderColor: 'border-l-brand-500',
      bgColor: 'bg-brand-50/50',
    },
  }[toast.type];

  const Icon = config.icon;

  function handleDismiss() {
    setVisible(false);
    setTimeout(clearToast, 150);
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${visible ? 'animate-slide-up' : 'animate-fade-out'}`}
    >
      <div
        className={`
          ${config.bgColor} border border-ink-100 ${config.borderColor} border-l-4
          shadow-medium rounded-xl px-4 py-3
          flex items-center gap-3 min-w-[300px] max-w-md
          backdrop-blur-sm
        `}
      >
        <div className={`shrink-0 ${config.iconColor}`}>
          <Icon size={18} />
        </div>
        <p className="text-sm text-ink-800 flex-1 leading-snug">{toast.message}</p>
        <button
          onClick={handleDismiss}
          className="text-ink-400 hover:text-ink-600 transition-colors shrink-0 p-0.5 rounded hover:bg-ink-100"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
