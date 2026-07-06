import { CheckCircle2, Sparkles } from 'lucide-react';

/**
 * Checklist factual do que já vem pronto ao criar a conta — reforça a
 * proposta de valor sem inventar números de clientes/depoimentos.
 */
const ITEMS = [
  'Worklist e agenda prontas para o primeiro exame',
  'Máscaras padrão do sistema já ativadas na sua biblioteca',
  'LAUD.IA ativa desde o primeiro laudo (motor Lite incluído)',
  '14 dias de trial completo, sem cartão de crédito',
];

export function FirstDay() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-14">
      <div className="rounded-3xl border border-brand-100 bg-brand-50/40 p-7 sm:p-9">
        <div className="flex items-center gap-2.5 mb-6">
          <Sparkles size={16} className="text-brand-500" />
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">O que você já recebe no primeiro dia</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
          {ITEMS.map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-sm font-semibold text-ink-700 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
