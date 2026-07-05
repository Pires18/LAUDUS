import { Check } from 'lucide-react';

interface Props {
  onShowPricing: () => void;
  onEnter: (mode: 'login' | 'signup') => void;
}

/**
 * Teaser de preços sem valores hardcoded: os preços reais vivem no catálogo
 * do Firestore e são exibidos pelo modal PricingPlans (fonte única). Aqui só
 * comunicamos o modelo comercial e o trial.
 */
const INCLUDED = [
  'Trial gratuito de 14 dias, sem cartão',
  'Planos mensal, semestral e anual',
  'Add-ons por módulo (PACS, agenda, clínicas, calculadoras)',
  'Cancele quando quiser',
];

export function PricingTeaser({ onShowPricing, onEnter }: Props) {
  return (
    <section className="bg-ink-50 border-y border-ink-100">
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-black text-ink-900 tracking-tight mb-3">Planos para todo tamanho de clínica</h2>
        <p className="text-ink-500 font-medium mb-8">Comece grátis e assine só quando fizer sentido para a sua rotina.</p>

        <ul className="inline-flex flex-col items-start gap-2.5 mb-9 text-left">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-ink-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={12} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => onEnter('signup')} className="h-12 px-8 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95">
            Começar o trial grátis
          </button>
          <button onClick={onShowPricing} className="h-12 px-8 rounded-2xl border-2 border-ink-200 bg-white text-ink-900 text-xs font-black uppercase tracking-widest hover:bg-ink-100/60 transition-all active:scale-95">
            Ver planos e preços
          </button>
        </div>
      </div>
    </section>
  );
}
