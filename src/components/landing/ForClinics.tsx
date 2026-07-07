import { Building2, Users, Headset, Layers, Mail } from 'lucide-react';

/**
 * Seção separada dos 3 planos de autoatendimento (médico individual, que já
 * pode cadastrar seus próprios locais de atendimento dentro da cota do
 * plano). O Enterprise (clínica com múltiplos médicos inscritos) ainda não é
 * autoatendimento — hoje é captação de interesse por contato comercial, não
 * um produto pronto para ativação imediata. A copy é deliberadamente honesta
 * sobre isso ("em construção"), para não prometer algo que o sistema ainda
 * não entrega.
 */
const DIFFERENTIALS = [
  { icon: Building2, title: 'Múltiplos médicos, uma clínica', text: 'Vários profissionais inscritos sob a mesma unidade, com laudos e agenda organizados por médico.' },
  { icon: Users, title: 'Gestão de equipe', text: 'Permissões por papel (médico, recepção) dentro da clínica.' },
  { icon: Layers, title: 'Cota sob medida', text: 'Volume de laudos, PACS/DICOM e add-ons dimensionados pro movimento da clínica.' },
  { icon: Headset, title: 'Atendimento dedicado', text: 'Onboarding acompanhado e um contato direto durante a implantação.' },
];

const CONTACT_HREF = 'mailto:contato.laudus@gmail.com?subject=Interesse%20no%20plano%20Enterprise&body=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20Enterprise%20para%20cl%C3%ADnica%20com%20m%C3%BAltiplos%20m%C3%A9dicos.';

export function ForClinics() {
  return (
    <section id="clinicas" className="max-w-6xl mx-auto px-6 py-24">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-8 sm:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-200 shadow-sm mb-5">
              <Building2 size={13} className="text-indigo-500" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Plano Enterprise · Em construção</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-ink-900 tracking-tight mb-3">
              Sua clínica tem vários médicos inscritos?
            </h2>
            <p className="text-ink-500 font-medium max-w-xl mb-7">
              Estamos desenvolvendo o LAUD.US Enterprise para clínicas com múltiplos profissionais. Ainda não é autoatendimento — deixe seu contato e te avisamos assim que abrir, com condições especiais de early access.
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
              <Mail size={15} /> Quero ser avisado
            </a>
            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest text-center">contato.laudus@gmail.com</p>
          </div>
        </div>
      </div>
    </section>
  );
}
