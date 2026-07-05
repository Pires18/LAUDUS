import { ShieldCheck, EyeOff, Users, FileSearch, KeyRound, Scale } from 'lucide-react';

/**
 * Seção de confiança construída com fatos reais da arquitetura — o produto
 * está em programa de testes restrito, então não usamos depoimentos ou logos
 * de clientes: a honestidade técnica É o sinal de confiança.
 */
const GUARANTEES = [
  {
    icon: EyeOff,
    title: 'Minimização antes da IA',
    text: 'Nome, CPF, RG, telefone e e-mail do paciente são removidos automaticamente antes de qualquer chamada ao modelo de IA.',
  },
  {
    icon: Users,
    title: 'Isolamento por usuário e clínica',
    text: 'Regras de acesso no banco de dados (Firestore Security Rules) garantem que cada clínica só enxerga os próprios dados.',
  },
  {
    icon: FileSearch,
    title: 'Trilha de auditoria',
    text: 'Todo acesso a prontuário e laudo é registrado: quem visualizou qual dado, e quando.',
  },
  {
    icon: KeyRound,
    title: 'Credenciais DICOM criptografadas',
    text: 'Senhas de integração com o PACS são armazenadas com criptografia AES-256.',
  },
  {
    icon: Scale,
    title: 'Direitos LGPD (art. 18)',
    text: 'Confirmação, acesso, correção, portabilidade e eliminação — com papéis de controlador e operador claramente definidos.',
  },
  {
    icon: ShieldCheck,
    title: 'Encarregado de Dados (DPO)',
    text: 'Canal direto para solicitações sobre dados pessoais: contato.laudus@gmail.com.',
  },
];

interface Props {
  onOpenPrivacy: () => void;
}

export function TrustSecurity({ onOpenPrivacy }: Props) {
  return (
    <section id="seguranca" className="bg-ink-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 mb-6">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Segurança & LGPD</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-3">Dado de saúde exige mais do que promessa</h2>
          <p className="text-ink-300 font-medium leading-relaxed">
            Sem depoimentos inventados: o que oferecemos é arquitetura verificável. Cada item abaixo descreve algo implementado no sistema, documentado na nossa Política de Privacidade.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.07] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300 mb-4">
                <g.icon size={17} />
              </div>
              <h3 className="text-sm font-black mb-1.5">{g.title}</h3>
              <p className="text-[13px] text-ink-300 leading-relaxed">{g.text}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={onOpenPrivacy}
            className="h-11 px-6 rounded-xl border border-white/15 text-white/90 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            Ler a Política de Privacidade completa →
          </button>
        </div>
      </div>
    </section>
  );
}
