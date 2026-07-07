import { Sparkles, Database, Calculator, CalendarDays, Building2, CreditCard, ArrowUpRight, CheckCircle2, ScanSearch, FileCheck2 } from 'lucide-react';

const SPOTLIGHTS = [
  {
    icon: Sparkles,
    tone: 'brand' as const,
    title: 'Laudos com IA',
    desc: 'Geração assistida de texto com Google Gemini — sempre revisada e assinada pelo médico antes de qualquer uso clínico.',
    bullets: ['Máscaras por área (obstetrícia, tireoide, mama, vascular e mais)', 'Refinamento por chat com o Copiloto LAUD.IA', 'Motores Lite e Pro conforme a complexidade do caso'],
  },
  {
    icon: Database,
    tone: 'indigo' as const,
    title: 'PACS / DICOM gerenciado',
    desc: 'Integração com o ultrassom via PACS na nuvem, sem montar infraestrutura própria.',
    bullets: ['Worklist DICOM enviada direto ao aparelho', 'Recepção automática de imagens do exame', 'Visualizador integrado ao editor de laudo'],
  },
];

const GRID_FEATURES = [
  { icon: Calculator,   title: 'Calculadoras clínicas',  desc: 'Biometria fetal, Doppler, TI-RADS, BI-RADS, O-RADS e outras — resultado inserido direto no laudo.' },
  { icon: CalendarDays, title: 'Agenda & Worklist',      desc: 'Agendamento que já gera o exame na fila de trabalho, sem retrabalho manual.' },
  { icon: Building2,    title: 'Múltiplos locais',        desc: 'Gerencie mais de um local de atendimento na mesma conta, com dados isolados por local.' },
  { icon: CreditCard,   title: 'Planos & assinatura',    desc: 'Mensal, semestral e anual, com add-ons por módulo conforme a necessidade.' },
];

const toneClasses = {
  brand: { icon: 'bg-brand-600 text-white shadow-brand-500/30', bg: 'from-brand-50/80 to-white border-brand-200', bullet: 'text-brand-600' },
  indigo: { icon: 'bg-indigo-600 text-white shadow-indigo-500/30', bg: 'from-indigo-50/80 to-white border-indigo-200', bullet: 'text-indigo-600' },
};

export function Features() {
  return (
    <section id="funcionalidades" className="relative max-w-6xl mx-auto px-6 py-24">
      <div className="text-center max-w-xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ink-50 border border-ink-100 mb-5">
          <ScanSearch size={13} className="text-brand-500" />
          <span className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Funcionalidades</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight mb-3">Tudo o que o médico precisa, em um só lugar</h2>
        <p className="text-ink-500 font-medium">Do primeiro agendamento à entrega do laudo assinado — sem trocar de sistema.</p>
      </div>

      {/* Spotlights: os dois pilares do produto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {SPOTLIGHTS.map((f) => {
          const tone = toneClasses[f.tone];
          return (
            <div key={f.title} className={`relative rounded-3xl border bg-gradient-to-br p-8 overflow-hidden group hover:shadow-xl hover:shadow-ink-900/5 transition-all ${tone.bg}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${tone.icon}`}>
                <f.icon size={24} />
              </div>
              <h3 className="text-xl font-black text-ink-900 mb-2.5">{f.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed mb-5">{f.desc}</p>
              <ul className="space-y-2.5">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] font-semibold text-ink-700">
                    <CheckCircle2 size={15} className={`shrink-0 mt-0.5 ${tone.bullet}`} />
                    {b}
                  </li>
                ))}
              </ul>
              <ArrowUpRight size={18} className="absolute top-8 right-8 text-ink-300 group-hover:text-ink-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          );
        })}
      </div>

      {/* Grid secundário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {GRID_FEATURES.map((f) => (
          <div key={f.title} className="bg-white border border-ink-100 rounded-2xl p-6 hover:border-brand-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <f.icon size={19} />
            </div>
            <h3 className="text-base font-black text-ink-900 mb-1.5">{f.title}</h3>
            <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Rodapé da seção: selo de revisão */}
      <div className="mt-10 flex items-center justify-center gap-2.5 text-ink-400">
        <FileCheck2 size={14} />
        <p className="text-[11px] font-bold uppercase tracking-widest">Toda sugestão da IA passa por revisão e assinatura médica antes da entrega</p>
      </div>
    </section>
  );
}
