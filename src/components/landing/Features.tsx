import { Sparkles, Database, Calculator, CalendarDays, Building2, CreditCard } from 'lucide-react';
import { classNames } from '../../utils/format';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Laudos com IA',
    desc: 'Geração assistida de texto com Google Gemini — sempre revisada e assinada pelo médico antes de qualquer uso clínico. Máscaras por área (obstetrícia, tireoide, mama, vascular e mais) e refinamento por chat com o Copiloto.',
    featured: true,
  },
  {
    icon: Database,
    title: 'PACS / DICOM gerenciado',
    desc: 'Integração com o ultrassom via PACS na nuvem, sem montar infraestrutura própria: worklist DICOM, recepção automática de imagens e visualizador integrado ao editor de laudo.',
    featured: true,
  },
  { icon: Calculator,   title: 'Calculadoras clínicas',  desc: 'Biometria fetal, Doppler, TI-RADS, BI-RADS, O-RADS e outras calculadoras validadas — com resultado inserido direto no laudo.' },
  { icon: CalendarDays, title: 'Agenda & Worklist',      desc: 'Agendamento que já gera o exame na fila de trabalho, sem retrabalho manual.' },
  { icon: Building2,    title: 'Múltiplas clínicas',     desc: 'Gerencie mais de uma unidade na mesma conta, com dados isolados por clínica e permissões por equipe.' },
  { icon: CreditCard,   title: 'Planos & assinatura',    desc: 'Planos mensal, semestral e anual, com add-ons por módulo conforme a necessidade.' },
];

export function Features() {
  return (
    <section id="funcionalidades" className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center max-w-xl mx-auto mb-12">
        <h2 className="text-3xl font-black text-ink-900 tracking-tight mb-3">Tudo o que sua clínica precisa, em um só lugar</h2>
        <p className="text-ink-500 font-medium">Do primeiro agendamento à entrega do laudo assinado — sem trocar de sistema.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className={classNames(
              'bg-white border rounded-2xl p-6 transition-all hover:shadow-md',
              f.featured
                ? 'sm:col-span-2 border-brand-200 bg-gradient-to-br from-brand-50/60 to-white hover:border-brand-300'
                : 'border-ink-100 hover:border-brand-200'
            )}
          >
            <div className={classNames(
              'w-11 h-11 rounded-xl flex items-center justify-center mb-4',
              f.featured ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25' : 'bg-brand-50 text-brand-600'
            )}>
              <f.icon size={19} />
            </div>
            <h3 className="text-base font-black text-ink-900 mb-1.5">{f.title}</h3>
            <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
