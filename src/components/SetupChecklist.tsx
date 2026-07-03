import { useMemo, useState } from 'react';
import { useApp } from '../store/app';
import { useCollection } from '../hooks/useFirestore';
import { Clinic, ReportTemplate } from '../types';
import { CheckCircle2, Circle, ArrowRight, X, Rocket, UserCog, Building2, FileText, Database } from 'lucide-react';
import { classNames } from '../utils/format';

const DISMISS_KEY = 'laudus_setup_dismissed_v1';

/**
 * Checklist de primeiros passos — guia o novo usuário pela configuração inicial
 * (perfil/CRM → clínica → template → PACS opcional), com status e atalhos.
 * Some sozinho quando as etapas obrigatórias estão prontas, ou se dispensado.
 */
export function SetupChecklist() {
  const { settings, setView } = useApp();
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: templates } = useCollection<ReportTemplate>('templates');
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const steps = useMemo(() => [
    {
      key: 'profile',
      icon: UserCog,
      label: 'Complete seu perfil e CRM',
      desc: 'Nome, CRM/RQE e assinatura — usados no cabeçalho e rodapé do laudo.',
      done: !!(settings.physicianName && settings.physicianCRM),
      optional: false,
      action: () => setView({ name: 'settings', activeTab: 'perfil' }),
    },
    {
      key: 'clinic',
      icon: Building2,
      label: 'Cadastre sua primeira clínica',
      desc: 'Logo, cabeçalho e dados que aparecem nos laudos daquela unidade.',
      done: clinics.length > 0,
      optional: false,
      action: () => setView({ name: 'clinic-form' }),
    },
    {
      key: 'template',
      icon: FileText,
      label: 'Crie um template (máscara) de laudo',
      desc: 'A estrutura-base que a IA usa para gerar seus laudos.',
      done: templates.length > 0,
      optional: false,
      action: () => setView({ name: 'templates' }),
    },
    {
      key: 'pacs',
      icon: Database,
      label: 'Conectar PACS / DICOM (opcional)',
      desc: 'Worklist no aparelho e imagens no laudo. Veja o guia passo a passo.',
      done: !!(settings.dicomLocalAgentUrl || settings.dicomViewerUrl),
      optional: true,
      action: () => setView({ name: 'dicom' }),
    },
  ], [settings.physicianName, settings.physicianCRM, settings.dicomLocalAgentUrl, settings.dicomViewerUrl, clinics.length, templates.length, setView]);

  const required = steps.filter(s => !s.optional);
  const doneCount = required.filter(s => s.done).length;
  const allRequiredDone = doneCount === required.length;

  // Some quando tudo obrigatório está feito, ou se o usuário dispensou.
  if (dismissed || allRequiredDone) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const pct = Math.round((doneCount / required.length) * 100);

  return (
    <div className="bg-white border border-brand-200 rounded-2xl mb-5 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-ink-100 bg-brand-50/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <Rocket size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-ink-900 leading-tight">Configure o LAUD.US</h3>
            <p className="text-[11px] text-ink-500 font-medium">{doneCount} de {required.length} etapas concluídas — falta pouco.</p>
          </div>
        </div>
        <button onClick={dismiss} title="Dispensar" className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-ink-100">
        <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={s.action}
              className={classNames(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all group',
                s.done
                  ? 'border-emerald-100 bg-emerald-50/40'
                  : 'border-ink-150 bg-white hover:border-brand-200 hover:bg-brand-50/30'
              )}
            >
              <div className="shrink-0">
                {s.done
                  ? <CheckCircle2 size={20} className="text-emerald-500" />
                  : <Circle size={20} className="text-ink-300 group-hover:text-brand-400" />}
              </div>
              <div className="shrink-0 w-8 h-8 rounded-lg bg-ink-50 text-ink-500 flex items-center justify-center">
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={classNames('text-[13px] font-bold', s.done ? 'text-emerald-700' : 'text-ink-800')}>{s.label}</span>
                  {s.optional && <span className="text-[9px] font-black uppercase tracking-wider text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">Opcional</span>}
                </div>
                <p className="text-[11px] text-ink-500 leading-snug mt-0.5 truncate">{s.desc}</p>
              </div>
              {!s.done && <ArrowRight size={15} className="text-ink-300 group-hover:text-brand-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
