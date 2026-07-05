import { X } from 'lucide-react';

/** Versão vigente dos termos/política — subir ao alterar docs/legal/*.md, para forçar novo aceite. */
export const LEGAL_TERMS_VERSION = '3.0';

type LegalDoc = 'terms' | 'privacy';

interface Props {
  open: LegalDoc | null;
  onClose: () => void;
}

const TITLES: Record<LegalDoc, string> = {
  terms: 'Termos de Uso',
  privacy: 'Política de Privacidade',
};

function TermsContent() {
  return (
    <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
      <p>O LAUD.US — Sistemas de Laudos Inteligentes é uma plataforma SaaS de apoio à elaboração de laudos de exames de imagem, destinada a profissionais de saúde regularmente inscritos em seus conselhos de classe (CFM/CRM).</p>
      <p><strong className="text-ink-900">Fase de testes restrita:</strong> o sistema está em fase de testes com acesso por convite. Não há garantia de disponibilidade contínua nem de retenção indefinida de dados nesta fase — mantenha registro alternativo de informações críticas.</p>
      <p><strong className="text-ink-900">Não é prestação de serviço médico:</strong> a operadora fornece apenas a ferramenta de software. O exercício da medicina e a responsabilidade pelo laudo são exclusivos do profissional usuário.</p>
      <p><strong className="text-ink-900">Responsabilidade profissional:</strong> todo conteúdo gerado com auxílio de inteligência artificial é uma sugestão de texto, sujeita a revisão e assinatura do médico responsável antes de qualquer uso clínico. O LAUD.US não substitui o julgamento clínico do profissional.</p>
      <p><strong className="text-ink-900">Dados e privacidade:</strong> o tratamento de dados pessoais e de saúde segue a Política de Privacidade, parte integrante destes Termos.</p>
      <p><strong className="text-ink-900">Planos e cobrança:</strong> o acesso é fornecido mediante assinatura, com trial gratuito inicial (condições diferenciadas podem se aplicar durante a fase de testes). Planos anuais são recorrentes; planos mensal/semestral são avulsos e não renovam automaticamente.</p>
      <p><strong className="text-ink-900">Propriedade intelectual:</strong> o software e sua marca pertencem ao LAUD.US. Os dados de pacientes e laudos permanecem de titularidade do usuário/instituição responsável.</p>
      <p><strong className="text-ink-900">Legislação aplicável:</strong> Lei Geral de Proteção de Dados (Lei nº 13.709/2018), Marco Civil da Internet e normas do Conselho Federal de Medicina para laudos e prontuários eletrônicos.</p>
      <p className="text-ink-400 text-xs">Versão {LEGAL_TERMS_VERSION} · Texto completo em docs/legal/TERMOS_DE_USO.md do repositório.</p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-4 text-sm text-ink-600 leading-relaxed">
      <p>O profissional/clínica cadastrada é o <strong className="text-ink-900">controlador</strong> dos dados de pacientes inseridos na plataforma. O <strong className="text-ink-900">LAUD.US</strong> atua como <strong className="text-ink-900">operador</strong>, tratando os dados conforme as instruções do controlador.</p>
      <p><strong className="text-ink-900">Minimização para IA:</strong> antes de qualquer chamada ao modelo de linguagem (Google Gemini), nome, CPF, RG, telefone e e-mail do paciente são removidos automaticamente; idade, sexo e medidas clínicas são preservados.</p>
      <p><strong className="text-ink-900">Terceiros envolvidos:</strong> Google (Firebase — hospedagem/autenticação; Gemini — geração de texto anonimizado, infraestrutura global que pode incluir processamento fora do Brasil), AbacatePay (pagamento da assinatura), Sentry (monitoramento técnico, com redação automática de PII).</p>
      <p><strong className="text-ink-900">Segurança:</strong> regras de acesso por usuário/clínica, trilha de auditoria de acesso a prontuários, criptografia de credenciais DICOM, cabeçalhos de segurança HTTP.</p>
      <p><strong className="text-ink-900">Direitos do titular (LGPD art. 18):</strong> confirmação, acesso, correção, anonimização, portabilidade e eliminação de dados. Solicitações sobre dados de paciente devem ser direcionadas ao profissional/clínica responsável (controlador); sobre dados do próprio usuário profissional, ao Encarregado de Dados em contato.laudus@gmail.com.</p>
      <p className="text-ink-400 text-xs">Versão {LEGAL_TERMS_VERSION} · Texto completo em docs/legal/POLITICA_DE_PRIVACIDADE.md do repositório.</p>
    </div>
  );
}

export function LegalModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-ink-900/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-ink-200 my-8">
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h3 className="text-lg font-black text-ink-900">{TITLES[open]}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-ink-50 border border-ink-200 hover:bg-ink-100 flex items-center justify-center text-ink-500 transition-all">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {open === 'terms' ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  );
}
