import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-900 tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-ink-500 mt-0.5 sm:mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
