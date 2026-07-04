import { Lock } from 'lucide-react';
import { useApp } from '../store/app';

interface Props {
  /** Nome do módulo (ex.: "Módulo de Clínicas"). */
  title: string;
  /** Nome do add-on necessário (ex.: "Clínicas"). */
  addonLabel: string;
  /** Descrição do valor do recurso. */
  description: string;
  /** Texto do botão (default: "Ativar {addonLabel}"). */
  ctaLabel?: string;
}

/**
 * Tela de bloqueio (paywall) reutilizável para recursos que exigem um add-on/plano.
 * Padroniza o gating em todo o app — antes cada módulo tinha (ou não) seu próprio
 * bloqueio. Leva o usuário direto para a aba de assinatura.
 */
export function FeatureLocked({ title, addonLabel, description, ctaLabel }: Props) {
  const { setView } = useApp();
  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
            <Lock size={36} />
          </div>
          <h2 className="text-xl font-black text-ink-900 mb-2">{title}</h2>
          <p className="text-sm text-ink-500 max-w-sm mb-8 leading-relaxed">
            Este módulo requer o add-on <strong className="text-ink-700">{addonLabel}</strong>. {description}
          </p>
          <button
            onClick={() => setView({ name: 'settings', activeTab: 'assinatura' })}
            className="h-11 px-8 rounded-xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
          >
            {ctaLabel || `Ativar Add-on ${addonLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
