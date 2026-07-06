import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LogoIcon } from '../LogoIcon';
import { scrollToSection } from '../../utils/scrollToSection';

interface Props {
  onEnter: (mode: 'login' | 'signup') => void;
  onShowPricing: () => void;
}

export function Nav({ onEnter, onShowPricing }: Props) {
  const [mobileMenu, setMobileMenu] = useState(false);

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToSection(id);
    setMobileMenu(false);
  };

  const links = (
    <>
      <a href="#como-funciona" onClick={goTo('como-funciona')} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Como funciona</a>
      <a href="#funcionalidades" onClick={goTo('funcionalidades')} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Funcionalidades</a>
      <a href="#seguranca" onClick={goTo('seguranca')} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">Segurança</a>
      <button onClick={() => { onShowPricing(); setMobileMenu(false); }} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors text-left">Planos</button>
      <a href="#faq" onClick={goTo('faq')} className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">FAQ</a>
    </>
  );

  return (
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

        <div className="hidden md:flex items-center gap-7">{links}</div>

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
          {links}
          <div className="flex gap-2 pt-2">
            <button onClick={() => onEnter('login')} className="flex-1 h-10 rounded-xl border-2 border-ink-200 text-ink-900 text-xs font-black uppercase tracking-widest">Entrar</button>
            <button onClick={() => onEnter('signup')} className="flex-1 h-10 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest">Começar</button>
          </div>
        </div>
      )}
    </nav>
  );
}
