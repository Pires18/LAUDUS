import { Loader2 } from 'lucide-react';

/** Spinner de carregamento compartilhado pelas abas do Financeiro. */
export function Spinner() {
  return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-500" /></div>;
}
