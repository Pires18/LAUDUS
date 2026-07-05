import { useState } from 'react';
import {
  Sparkles, Database, Calculator, CalendarDays, Building2, CreditCard,
  ArrowRight, Menu, X, ShieldCheck,
} from 'lucide-react';
import { LogoIcon } from './LogoIcon';
import { PricingPlans } from './PricingPlans';
import { LegalModal } from './LegalModal';

const FEATURES = [
  { icon: Sparkles,     title: 'Laudos com IA',          desc: 'Geração assistida de texto com Google Gemini — sempre revisada e assinada pelo médico antes de qualquer uso clínico.' },
  { icon: Database,     title: 'PACS / DICOM',           desc: 'Integração com o ultrassom via PACS gerenciado, sem precisar montar infraestrutura própria.' },
  { icon: Calculator,   title: 'Calculadoras clínicas',  desc: 'Biometria fetal, Doppler, TI-RADS, BI-RADS, O-RADS e outras calculadoras validadas.' },
  { icon: CalendarDays, title: 'Agenda & Worklist',      desc: 'Agendamento que já gera o exame na fila de trabalho, sem retrabalho manual.' },
  { icon: Building2,    title: 'Múltiplas clínicas',     desc: 'Gerencie mais de uma unidade na mesma conta, com dados isolados por clínica.' },
  { icon: CreditCard,   title: 'Planos & assinatura',    desc: 'Planos mensal, semestral e anual, com add-ons por módulo conforme a necessidade.' },
];

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
    q: 'O sistema está em fase de testes — o que isso muda pra mim?',
    a: 'O acesso hoje é restrito/por convite, enquanto validamos a plataforma. Isso significa que pode haver ajustes e eventuais instabilidades nesta fase — recomendamos manter um registro alternativo de informações críticas enquanto isso.',
  },
];

interface Props {
  onEnter: (mode: 'login' | 'signup') => void;
}

export function LandingScreen({ onEnter }: Props) {
  const [showPricing, setShowPricing] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen w-full bg-white font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-ink-200 flex items-center justify-center overflow-hidden shrink-0">
              <LogoIcon size={22} />
            </div>
            <div className="flex items-center">
              <span className="text-lg font-black tracking-tighter text-ink-900">LAUD</span>
              <span className="text-lg font-black tracking-tighter text-brand-600">.US</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7">
            <a href="#funcionalidades" className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Funcionalidades</a>
            <button onClick={() => setShowPricing(true)} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Planos</button>
            <a href="#faq" className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Perguntas frequentes</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => onEnter('login')} className="h-10 px-4 rounded-xl border-2 border-ink-200 text-ink-900 text-xs font-black uppercase tracking-widest hover:bg-ink-50 transition-all">
              Entrar
            </button>
            <button onClick={() => onEnter('signup')} className="h-10 px-5 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all">
              Começar grátis
            </button>
          </div>

          <button onClick={() => setMobileMenu((v) => !v)} className="md:hidden w-9 h-9 flex items-center justify-center text-ink-700">
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden px-6 pb-4 flex flex-col gap-3 border-t border-ink-100 pt-4">
            <a href="#funcionalidades" onClick={() => setMobileMenu(false)} className="text-sm font-bold text-ink-700">Funcionalidades</a>
            <button onClick={() => { setShowPricing(true); setMobileMenu(false); }} className="text-sm font-bold text-ink-700 text-left">Planos</button>
            <a href="#faq" onClick={() => setMobileMenu(false)} className="text-sm font-bold text-ink-700">Perguntas frequentes</a>
            <div className="flex gap-2 pt-2">
              <button onClick={() => onEnter('login')} className="flex-1 h-10 rounded-xl border-2 border-ink-200 text-ink-900 text-xs font-black uppercase tracking-widest">Entrar</button>
              <button onClick={() => onEnter('signup')} className="flex-1 h-10 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest">Começar</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.5] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#e0eefe 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 mb-7">
            <Sparkles size={13} className="text-brand-500" />
            <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">LAUD.IA · Powered by Google Gemini</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] text-ink-900 mb-5">
            Do agendamento ao laudo assinado — em minutos.
          </h1>
          <p className="text-ink-500 text-lg leading-relaxed font-medium max-w-2xl mx-auto mb-9">
            Plataforma completa de laudos ultrassonográficos com IA, PACS/DICOM integrado e gestão de clínica. Foque no diagnóstico; a LAUD.IA cuida do resto.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => onEnter('signup')} className="h-12 px-7 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 active:scale-95">
              Começar grátis agora <ArrowRight size={14} />
            </button>
            <button onClick={() => setShowPricing(true)} className="h-12 px-7 rounded-2xl border-2 border-ink-200 text-ink-900 text-xs font-black uppercase tracking-widest hover:bg-ink-50 transition-all active:scale-95">
              Ver planos e preços
            </button>
          </div>
        </div>
      </header>

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl font-black text-ink-900 tracking-tight mb-3">Tudo o que sua clínica precisa, em um só lugar</h2>
          <p className="text-ink-500 font-medium">Do primeiro agendamento à entrega do laudo assinado — sem trocar de sistema.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-ink-100 rounded-2xl p-6 hover:border-brand-200 hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                <f.icon size={19} />
              </div>
              <h3 className="text-base font-black text-ink-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planos CTA ── */}
      <section className="bg-ink-50 border-y border-ink-100">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-black text-ink-900 tracking-tight mb-3">Planos para todo tamanho de clínica</h2>
          <p className="text-ink-500 font-medium mb-8">Assinatura mensal, semestral ou anual, com add-ons por módulo conforme a necessidade.</p>
          <button onClick={() => setShowPricing(true)} className="h-12 px-8 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95">
            Ver planos e preços
          </button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-ink-900 tracking-tight">Perguntas frequentes</h2>
        </div>
        <div className="divide-y divide-ink-100">
          {FAQ.map((item) => (
            <div key={item.q} className="py-6">
              <h4 className="text-sm font-black text-ink-900 mb-2">{item.q}</h4>
              <p className="text-sm text-ink-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink-900 text-ink-300">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-wrap justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center mb-3">
                <span className="text-lg font-black tracking-tighter text-white">LAUD</span>
                <span className="text-lg font-black tracking-tighter text-brand-400">.US</span>
              </div>
              <p className="text-xs text-ink-400 leading-relaxed">LAUD.US — Sistemas de Laudos Inteligentes. Plataforma de laudos ultrassonográficos com IA, PACS/DICOM gerenciado e gestão de clínica.</p>
            </div>
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-3">Produto</h5>
              <div className="flex flex-col gap-2 text-xs font-semibold">
                <a href="#funcionalidades" className="text-ink-400 hover:text-white transition-colors">Funcionalidades</a>
                <button onClick={() => setShowPricing(true)} className="text-ink-400 hover:text-white transition-colors text-left">Planos</button>
                <a href="#faq" className="text-ink-400 hover:text-white transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-3">Legal</h5>
              <div className="flex flex-col gap-2 text-xs font-semibold">
                <button onClick={() => setLegalDoc('terms')} className="text-ink-400 hover:text-white transition-colors text-left">Termos de Uso</button>
                <button onClick={() => setLegalDoc('privacy')} className="text-ink-400 hover:text-white transition-colors text-left">Política de Privacidade</button>
              </div>
            </div>
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-3">Contato</h5>
              <a href="mailto:contato.laudus@gmail.com" className="text-xs font-semibold text-ink-400 hover:text-white transition-colors">contato.laudus@gmail.com</a>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-500">
            <span>© {new Date().getFullYear()} LAUD.US — Sistemas de Laudos Inteligentes</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Programa de testes restrito</span>
          </div>
        </div>
      </footer>

      <PricingPlans open={showPricing} onClose={() => setShowPricing(false)} onChoose={() => { setShowPricing(false); onEnter('signup'); }} />
      <LegalModal open={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
