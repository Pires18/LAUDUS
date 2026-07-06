import { Building2, Users, Headset, Layers, Mail } from 'lucide-react';

/**
 * Seção separada dos 3 planos de autoatendimento (médico individual) — para
 * clínicas com múltiplas unidades/médicos, o caminho é contato comercial, não
 * checkout automático. `mailto:` reaproveita o e-mail já usado em todo o
 * resto do app (rodapé, termos, DPO), sem novo canal a manter.
 */
const DIFFERENTIALS = [
  { icon: Building2, title: 'Múltiplas unidades', text: 'Uma conta, várias clínicas — cabeçalhos, dados e laudos isolados por unidade.' },
  { icon: Users, title: 'Gestão de equipe', text: 'Convide médicos e recepção com permissões próprias por clínica.' },
  { icon: Layers, title: 'Cota sob medida', text: 'Volume de laudos, PACS/DICOM e add-ons dimensionados pro seu movimento real.' },
  { icon: Headset, title: 'Atendimento dedicado', text: 'Onboarding acompanhado e um contato direto para configuração e suporte.' },
];

const CONTACT_HREF = 'mailto:contato.laudus@gmail.com?subject=Plano%20exclusivo%20para%20cl%C3%ADnica&body=Ol%C3%A1%2C%20gostaria%20de%20falar%20sobre%20um%20plano%20para%20minha%20cl%C3%ADnica.';

export function ForClinics() {
  return (
    <section id="clinicas" className="max-w-6xl mx-auto px-6 py-24">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-8 sm:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-200 shadow-sm mb-5">
              <Building2 size={13} className="text-indigo-500" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Para clínicas</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-ink-900 tracking-tight mb-3">
              Sua clínica tem mais de uma unidade ou vários médicos?
            </h2>
            <p className="text-ink-500 font-medium max-w-xl mb-7">
              Nesse caso, um plano fechado não serve — montamos uma proposta sob medida para o seu volume e sua equipe. Fale com a gente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DIFFERENTIALS.map((d) => (
                <div key={d.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <d.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-ink-900 leading-tight">{d.title}</p>
                    <p className="text-[13px] text-ink-500 leading-relaxed mt-0.5">{d.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 lg:pl-6 lg:border-l lg:border-indigo-100">
            <a
              href={CONTACT_HREF}
              className="h-14 px-8 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/25 transition-all flex items-center gap-2.5 active:scale-95 whitespace-nowrap"
            >
              <Mail size={15} /> Fale Conosco
            </a>
            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest text-center">contato.laudus@gmail.com</p>
          </div>
        </div>
      </div>
    </section>
  );
}
