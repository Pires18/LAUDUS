import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Stethoscope, FlaskConical, CheckCircle2, ChevronDown } from 'lucide-react';

interface Props {
  onEnter: (mode: 'login' | 'signup') => void;
  onShowPricing: () => void;
}

const STATS = [
  { value: '6', label: 'Áreas de exame cobertas' },
  { value: '20+', label: 'Calculadoras clínicas validadas' },
  { value: '2', label: 'Motores de IA — Lite e Pro' },
  { value: '100%', label: 'Laudos revisados por médico' },
];

/**
 * Mockup do produto construído em JSX (sem screenshots): frame de navegador
 * com uma worklist e o editor com sugestão da LAUD.IA. Sempre nítido em
 * qualquer resolução e imune a mudanças visuais do app real.
 */
function ProductMockup() {
  return (
    <div className="relative mx-auto max-w-3xl select-none pointer-events-none" aria-hidden>
      {/* Glow atrás do mockup */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-brand-400/25 via-sky-300/15 to-transparent rounded-[2.5rem] blur-2xl" />

      <div className="relative rounded-2xl border border-ink-200 bg-white shadow-[0_30px_80px_-20px_rgba(5,104,197,0.35)] overflow-hidden text-left">
        {/* Browser chrome */}
        <div className="h-9 bg-ink-50 border-b border-ink-100 flex items-center gap-1.5 px-4">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <div className="ml-4 flex-1 max-w-xs h-5 rounded-md bg-white border border-ink-100 flex items-center px-2.5">
            <span className="text-[9px] font-bold text-ink-300">laud.us/worklist</span>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar fake */}
          <div className="hidden sm:flex w-36 border-r border-ink-100 bg-ink-50/50 flex-col gap-1 p-3">
            {['Dashboard', 'Worklist', 'Agenda', 'Pacientes', 'Máscaras'].map((item, i) => (
              <div key={item} className={`h-7 rounded-lg px-2.5 flex items-center text-[9px] font-bold ${i === 1 ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-400'}`}>
                {item}
              </div>
            ))}
          </div>

          {/* Conteúdo fake: worklist + editor */}
          <div className="flex-1 p-4 space-y-3">
            {/* Linha de exame ativa */}
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
                <Stethoscope size={14} />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-2.5 w-36 rounded bg-ink-300/70" />
                <div className="h-2 w-24 rounded bg-ink-200" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 shrink-0">Em andamento</span>
            </div>

            {/* Editor com sugestão da IA */}
            <div className="rounded-xl border border-ink-100 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={11} className="text-brand-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-brand-600">LAUD.IA — sugestão de texto</span>
              </div>
              <div className="h-2 w-full rounded bg-ink-100" />
              <div className="h-2 w-[92%] rounded bg-ink-100" />
              <div className="h-2 w-[96%] rounded bg-ink-100" />
              <div className="h-2 w-[60%] rounded bg-ink-100" />
              <div className="h-2 w-[88%] rounded bg-brand-100" />
              <div className="h-2 w-[70%] rounded bg-brand-100" />
            </div>

            {/* Rodapé: revisão médica */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[9px] font-bold text-ink-400">Revisado pelo médico responsável</span>
              </div>
              <div className="h-7 px-3 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest flex items-center">
                Finalizar laudo
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({ onEnter, onShowPricing }: Props) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-white via-white to-ink-50/40">
      {/* Malha de fundo: pontos + faixas de luz */}
      <div className="absolute inset-0 opacity-[0.55] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#dbeafe 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[560px] bg-brand-400/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-[8%] w-[260px] h-[260px] bg-sky-300/25 rounded-full blur-[100px] pointer-events-none hidden lg:block" />
      <div className="absolute top-1/3 left-[6%] w-[220px] h-[220px] bg-indigo-300/20 rounded-full blur-[100px] pointer-events-none hidden lg:block" />

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-14 text-center">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-brand-200 shadow-sm mb-8">
            <Sparkles size={13} className="text-brand-500" />
            <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">LAUD.IA · Powered by Google Gemini</span>
          </div>
          <h1 className="text-[2.75rem] sm:text-6xl font-black tracking-tight leading-[1.05] text-ink-900 mb-6">
            Do agendamento ao<br className="hidden sm:block" /> laudo assinado — <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">em minutos</span>.
          </h1>
          <p className="text-ink-500 text-lg sm:text-xl leading-relaxed font-medium max-w-2xl mx-auto mb-10">
            Plataforma para o <strong className="text-ink-700">médico que faz o próprio laudo</strong> — IA, PACS/DICOM integrado e agenda, tudo em um só lugar. Foque no diagnóstico; a LAUD.IA cuida do resto.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-9">
            <button onClick={() => onEnter('signup')} className="h-13 px-8 py-3.5 rounded-2xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 shadow-xl shadow-brand-500/30 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 active:scale-95">
              Começar grátis agora <ArrowRight size={14} />
            </button>
            <button onClick={onShowPricing} className="h-13 px-8 py-3.5 rounded-2xl border-2 border-ink-200 bg-white/90 text-ink-900 text-xs font-black uppercase tracking-widest hover:bg-white hover:border-ink-300 transition-all active:scale-95">
              Ver planos e preços
            </button>
          </div>

          {/* Badges honestos — sem prova social inventada */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} className="text-brand-500" /> LGPD by design</span>
            <span className="inline-flex items-center gap-1.5"><Stethoscope size={12} className="text-brand-500" /> Revisão médica obrigatória</span>
            <span className="inline-flex items-center gap-1.5"><FlaskConical size={12} className="text-brand-500" /> Programa de testes restrito</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="relative max-w-5xl mx-auto px-6 pb-10"
      >
        <ProductMockup />
      </motion.div>

      {/* Faixa de estatísticas honestas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="relative border-t border-ink-100 bg-white/70 backdrop-blur"
      >
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center lg:text-left lg:border-l lg:first:border-l-0 lg:border-ink-100 lg:pl-6 lg:first:pl-0">
              <p className="text-3xl font-black text-ink-900 tracking-tight">{s.value}</p>
              <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wide mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center pb-3">
          <ChevronDown size={16} className="text-ink-300 animate-bounce" />
        </div>
      </motion.div>
    </header>
  );
}
