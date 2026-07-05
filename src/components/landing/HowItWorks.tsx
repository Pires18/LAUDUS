import { CalendarDays, MonitorCheck, Sparkles, PenLine } from 'lucide-react';

const STEPS = [
  {
    icon: CalendarDays,
    title: 'Agende o exame',
    text: 'O agendamento já cria o exame na worklist e envia os dados ao aparelho (Worklist DICOM).',
  },
  {
    icon: MonitorCheck,
    title: 'Imagens entram sozinhas',
    text: 'Ao finalizar o exame no ultrassom, as imagens chegam automaticamente via PACS gerenciado.',
  },
  {
    icon: Sparkles,
    title: 'LAUD.IA sugere o texto',
    text: 'Com achados e medidas, a IA redige a sugestão do laudo na máscara da sua preferência.',
  },
  {
    icon: PenLine,
    title: 'Médico revisa e assina',
    text: 'Revisão obrigatória, assinatura e entrega em PDF — com trilha de auditoria de ponta a ponta.',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-ink-50/60 border-y border-ink-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-3xl font-black text-ink-900 tracking-tight mb-3">Como funciona</h2>
          <p className="text-ink-500 font-medium">Um fluxo único, do agendamento à entrega — sem pendrive, sem retrabalho, sem trocar de sistema.</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-5">
          {/* Linha conectora (desktop) */}
          <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-0.5 bg-brand-100" aria-hidden />

          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 md:text-center">
              <div className="relative z-10 w-14 h-14 rounded-2xl bg-white border-2 border-brand-200 shadow-sm flex items-center justify-center text-brand-600 shrink-0 md:mb-4">
                <step.icon size={22} />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                  {i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-ink-900 mb-1.5">{step.title}</h3>
                <p className="text-[13px] text-ink-500 leading-relaxed md:max-w-[220px] md:mx-auto">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
