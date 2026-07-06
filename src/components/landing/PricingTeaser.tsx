import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Plan } from '../../types';
import { logger } from '../../utils/logger';
import { classNames } from '../../utils/format';
import { planPriceBrl, planPrices } from '../../../api/_pricing';
import { Check, Star, Sparkles } from 'lucide-react';

interface Props {
  onShowPricing: () => void;
  onEnter: (mode: 'login' | 'signup') => void;
}

/**
 * Teaser de preços com cards reais (mesmo catálogo `saas_plans` do modal
 * PricingPlans) — nunca duplica valores hardcoded. Mostra o preço mensal de
 * cada plano; "Ver todos os planos" abre o modal completo com o seletor de
 * intervalo (mensal/semestral/anual) e todos os add-ons.
 */
export function PricingTeaser({ onShowPricing, onEnter }: Props) {
  const [plans, setPlans] = useState<(Plan & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(firestore, 'saas_plans'), where('active', '==', true)));
        if (!active) return;
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as Plan & { id: string }))
          .filter(p => !p.id.startsWith('LICENSE_') && p.category !== 'pacs')
          .sort((a, b) => planPrices(a).month - planPrices(b).month)
          .slice(0, 3);
        setPlans(list);
      } catch (err) {
        logger.error('[PricingTeaser] Falha ao carregar planos:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-gradient-to-b from-ink-50 to-white border-y border-ink-100">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-ink-200 shadow-sm mb-5">
            <Sparkles size={13} className="text-brand-500" />
            <span className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Planos para médicos individuais</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight mb-3">Assine no seu ritmo, sem burocracia</h2>
          <p className="text-ink-500 font-medium">Comece grátis e assine só quando fizer sentido para a sua rotina. Cancele quando quiser.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white border border-ink-100 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center">
            <button onClick={() => onEnter('signup')} className="h-12 px-8 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95">
              Criar conta grátis
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
            {plans.map((p) => {
              const featured = !!p.featured;
              const price = planPriceBrl(p, 'month');
              const reports = p.reportsQuota === 0 ? 'Laudos ilimitados' : `${p.reportsQuota} laudos/mês`;
              return (
                <div
                  key={p.id}
                  className={classNames(
                    'relative rounded-2xl border p-6 flex flex-col bg-white transition-all',
                    featured ? 'border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/20 md:-translate-y-2' : 'border-ink-200 shadow-sm'
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
                      <Star size={10} /> Mais popular
                    </span>
                  )}
                  <h3 className="text-base font-black text-ink-900">{p.name}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-2xl font-black text-ink-900">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[11px] font-bold text-ink-400 mb-1">/mês</span>
                  </div>
                  {p.trialDays > 0 && (
                    <span className="mt-2 inline-flex w-fit items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {p.trialDays} dias grátis
                    </span>
                  )}
                  <div className="mt-4 space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                      <Check size={13} className="text-emerald-500 shrink-0" /> {reports}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                      <Sparkles size={12} className="text-brand-400 shrink-0" /> {p.motorProDefault ? 'Motor Lite + Pro' : 'Motor Lite'}
                    </div>
                    {p.includesPacs && (
                      <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                        <Check size={13} className="text-emerald-500 shrink-0" /> PACS / DICOM incluído
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onShowPricing}
                    className={classNames(
                      'mt-5 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95',
                      featured ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20' : 'bg-ink-900 hover:bg-ink-800 text-white'
                    )}
                  >
                    Ver detalhes
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => onEnter('signup')} className="h-12 px-8 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95">
            Começar o trial grátis
          </button>
          <button onClick={onShowPricing} className="h-12 px-8 rounded-2xl border-2 border-ink-200 bg-white text-ink-900 text-xs font-black uppercase tracking-widest hover:bg-ink-100/60 transition-all active:scale-95">
            Comparar todos os planos
          </button>
        </div>
      </div>
    </section>
  );
}
