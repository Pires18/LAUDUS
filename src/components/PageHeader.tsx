import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}

export function PageHeader({ title, subtitle, actions, icon: Icon }: Props) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 border border-brand-100">
            <Icon size={22} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
