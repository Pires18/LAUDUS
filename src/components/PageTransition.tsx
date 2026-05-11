import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  id: string;
}

export function PageTransition({ children }: Props) {
  return (
    <div className="h-full">
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-ink-100 rounded-md ${className}`} />
  );
}
