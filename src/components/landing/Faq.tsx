import { ChevronDown } from 'lucide-react';

const FAQ = [
  {
    q: 'O laudo gerado pela IA tem validade sem revisão médica?',
    a: 'Não. O texto gerado pela IA é uma sugestão de redação, sempre sujeita à revisão, edição e assinatura do médico responsável antes de qualquer uso clínico.',
  },
  {
    q: 'Os dados dos meus pacientes são enviados para a IA?',
    a: 'Não com identificação. Nome, CPF, RG, telefone e e-mail do paciente são removidos automaticamente antes de qualquer chamada ao modelo de IA — apenas idade, sexo e medidas clínicas são utilizados.',
  },
  {
    q: 'Preciso de equipamento compatível para usar o PACS/DICOM?',
    a: 'A integração funciona com aparelhos de ultrassom com saída DICOM padrão. O suporte auxilia na configuração inicial.',
  },
  {
    q: 'Como funciona o período de teste gratuito?',
    a: 'Ao criar a conta você inicia um trial de 14 dias com acesso às funcionalidades principais, sem necessidade de cartão. Ao final, escolha o plano que fizer sentido — ou seus dados permanecem guardados caso decida assinar depois.',
  },
  {
    q: 'Posso cancelar a assinatura quando quiser?',
    a: 'Sim. Planos anuais deixam de renovar a partir do próximo ciclo; planos mensal e semestral são avulsos e não renovam automaticamente. O direito de arrependimento em até 7 dias (CDC art. 49) se aplica quando cabível.',
  },
  {
    q: 'O sistema está em fase de testes — o que isso muda pra mim?',
    a: 'O acesso hoje é restrito/por convite, enquanto validamos a plataforma. Isso significa que pode haver ajustes e eventuais instabilidades nesta fase — recomendamos manter um registro alternativo de informações críticas enquanto isso.',
  },
  {
    q: 'Como falo com o suporte?',
    a: 'Pelo Centro de Suporte dentro do próprio sistema (chat com a equipe) ou pelo e-mail contato.laudus@gmail.com.',
  },
  {
    q: 'Minha clínica tem vários médicos inscritos — dá pra usar o LAUD.US?',
    a: 'Os 3 planos acima são de autoatendimento para o médico individual. Para clínica com múltiplos profissionais, o LAUD.US Enterprise está em construção — deixe seu contato na seção "Para Clínicas" acima e avisamos quando abrir.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="max-w-2xl mx-auto px-6 py-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-ink-900 tracking-tight">Perguntas frequentes</h2>
      </div>
      <div className="space-y-3">
        {FAQ.map((item) => (
          <details key={item.q} className="group bg-white border border-ink-100 rounded-2xl open:border-brand-200 open:shadow-sm transition-all">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <h4 className="text-sm font-black text-ink-900">{item.q}</h4>
              <ChevronDown size={16} className="text-ink-400 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 text-sm text-ink-500 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
