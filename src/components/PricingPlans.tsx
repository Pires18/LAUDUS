import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { Plan } from '../types';
import { logger } from '../utils/logger';
import { classNames } from '../utils/format';
import { X, Check, Loader2, Sparkles, Calculator, Database, CalendarDays, Building2, Star } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Chamado quando o visitante escolhe um plano → leva ao cadastro. */
  onChoose: (planId: string) => void;
}

/**
 * Vitrine pública de planos (lida do catálogo `saas_plans`, regra de leitura
 * pública). Mostrada na tela de entrada, antes do login. O checkout de fato
 * acontece após o cadastro (no Centro de Assinatura).
 */
export function PricingPlans({ open, onClose, onChoose }: Props) {
  const [plans, setPlans] = useState<(Plan & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<'month' | 'semester' | 'year'>('month');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(query(collection(firestore, 'saas_plans'), where('active', '==', true)));
        if (!active) return;
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Plan & { id: string }))
          .filter(p => !p.id.startsWith('LICENSE_'))
          .sort((a, b) => (a.price || 0) - (b.price || 0));
        setPlans(list);
      } catch (err) {
        logger.error('[PricingPlans] Falha ao carregar planos:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink-900/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in">
      <div className="w-full max-w-6xl bg-ink-50 rounded-3xl border border-ink-200 shadow-2xl my-4 relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-ink-50/90 backdrop-blur border-b border-ink-200 rounded-t-3xl px-6 sm:px-10 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-ink-900 tracking-tight">Planos & Preços</h2>
            <p className="text-xs text-ink-500 font-medium">Escolha o plano ideal. Cancele quando quiser.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white border border-ink-200 hover:bg-ink-100 flex items-center justify-center text-ink-500 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 sm:px-10 py-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={26} className="animate-spin text-brand-500" />
              <span className="text-xs font-black uppercase tracking-wider text-ink-400">Carregando planos…</span>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm font-bold text-ink-700">Nenhum plano publicado no momento.</p>
              <p className="text-xs text-ink-400 mt-1">Crie sua conta gratuitamente e comece o período de testes.</p>
              <button onClick={() => onChoose('')} className="mt-6 h-11 px-8 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-widest transition-all">
                Criar conta grátis
              </button>
            </div>
          ) : (() => {
            const available = ['month', 'semester', 'year'].filter(iv => plans.some(p => (p.interval || 'month') === iv)) as ('month' | 'semester' | 'year')[];
            const activeIv = available.includes(interval) ? interval : (available[0] || 'month');
            const shown = plans.filter(p => (p.interval || 'month') === activeIv);
            const label: Record<string, string> = { month: 'Mensal', semester: 'Semestral', year: 'Anual' };
            return (
              <>
                {available.length > 1 && (
                  <div className="flex justify-center mb-7">
                    <div className="inline-flex items-center gap-1 bg-ink-100 p-1 rounded-2xl border border-ink-200">
                      {available.map(iv => (
                        <button
                          key={iv}
                          onClick={() => setInterval(iv)}
                          className={classNames(
                            'px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
                            activeIv === iv ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'
                          )}
                        >
                          {label[iv]}{iv === 'year' && <span className="ml-1 text-[8px] opacity-80">↻</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {shown.map((p) => (
                    <PlanCard key={p.id} plan={p} onChoose={() => onChoose(p.id)} />
                  ))}
                </div>
              </>
            );
          })()}

          <p className="text-center text-[11px] text-ink-400 font-medium mt-8 leading-relaxed">
            Add-ons (PACS/DICOM, Calculadoras, Agendamentos, Clínicas) podem ser incluídos no plano ou contratados à parte no Centro de Assinatura. O pagamento é processado com segurança pela AbacatePay.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, onChoose }: { plan: Plan & { id: string }; onChoose: () => void }) {
  const featured = !!plan.featured;
  const price = plan.price || 0;
  const recurring = plan.interval === 'year';
  const period = plan.interval === 'year' ? '/ano' : plan.interval === 'semester' ? '/semestre' : '/mês';
  const reports = plan.reportsQuota === 0 ? 'Laudos ilimitados' : `${plan.reportsQuota} laudos/mês`;
  const addons: { on: boolean | undefined; icon: any; label: string }[] = [
    { on: plan.includesCalculators, icon: Calculator, label: 'Calculadoras clínicas' },
    { on: plan.includesPacs, icon: Database, label: 'PACS / DICOM' },
    { on: plan.includesAppointments, icon: CalendarDays, label: 'Agendamentos' },
    { on: plan.includesClinics, icon: Building2, label: 'Múltiplas clínicas' },
  ];

  return (
    <div className={classNames(
      'relative rounded-2xl border p-6 flex flex-col bg-white transition-all',
      featured ? 'border-brand-500 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/20' : 'border-ink-200 shadow-sm'
    )}>
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
          <Star size={10} /> Mais popular
        </span>
      )}
      <h3 className="text-lg font-black text-ink-900">{plan.name}</h3>
      {plan.description && <p className="text-xs text-ink-500 font-medium mt-1 leading-relaxed">{plan.description}</p>}

      <div className="mt-4 flex items-end gap-1">
        <span className="text-3xl font-black text-ink-900">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        <span className="text-xs font-bold text-ink-400 mb-1">{period}</span>
      </div>
      <span className={classNames(
        'mt-1.5 inline-flex w-fit items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md',
        recurring ? 'bg-brand-50 text-brand-700 border border-brand-100' : 'bg-ink-100 text-ink-500'
      )}>
        {recurring ? '↻ Assinatura recorrente' : '• Pagamento único'}
      </span>
      {plan.trialDays > 0 && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
          {plan.trialDays} dias grátis
        </span>
      )}

      <div className="mt-5 space-y-2 flex-1">
        <Line ok label={reports} />
        <Line ok icon={Sparkles} label={plan.motorProDefault ? 'Motor Lite + Pro' : 'Motor Lite'} />
        {plan.clinicsQuota > 0 && <Line ok label={`Até ${plan.clinicsQuota} clínica(s)`} />}
        {addons.map(a => (
          <Line key={a.label} ok={!!a.on} icon={a.icon} label={a.label} muted={!a.on} />
        ))}
      </div>

      <button
        onClick={onChoose}
        className={classNames(
          'mt-6 h-11 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95',
          featured ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20'
                   : 'bg-ink-900 hover:bg-ink-800 text-white'
        )}
      >
        Começar
      </button>
    </div>
  );
}

function Line({ ok, icon: Icon, label, muted }: { ok: boolean; icon?: any; label: string; muted?: boolean }) {
  return (
    <div className={classNames('flex items-center gap-2 text-xs', muted ? 'text-ink-300' : 'text-ink-700 font-medium')}>
      {ok ? <Check size={14} className={muted ? 'text-ink-300' : 'text-emerald-500'} /> : <X size={14} className="text-ink-300" />}
      {Icon && <Icon size={13} className={muted ? 'text-ink-300' : 'text-ink-400'} />}
      <span>{label}</span>
    </div>
  );
}
