import { ShieldCheck } from 'lucide-react';
import { scrollToSection } from '../../utils/scrollToSection';

interface Props {
  onShowPricing: () => void;
  onNavigateLegal: (path: '/termos' | '/privacidade') => void;
}

export function Footer({ onShowPricing, onNavigateLegal }: Props) {
  return (
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
              <a href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollToSection('como-funciona'); }} className="text-ink-400 hover:text-white transition-colors">Como funciona</a>
              <a href="#funcionalidades" onClick={(e) => { e.preventDefault(); scrollToSection('funcionalidades'); }} className="text-ink-400 hover:text-white transition-colors">Funcionalidades</a>
              <a href="#seguranca" onClick={(e) => { e.preventDefault(); scrollToSection('seguranca'); }} className="text-ink-400 hover:text-white transition-colors">Segurança</a>
              <button onClick={onShowPricing} className="text-ink-400 hover:text-white transition-colors text-left">Planos</button>
              <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }} className="text-ink-400 hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
          <div>
            <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-3">Legal</h5>
            <div className="flex flex-col gap-2 text-xs font-semibold">
              <a
                href="/termos"
                onClick={(e) => { e.preventDefault(); onNavigateLegal('/termos'); }}
                className="text-ink-400 hover:text-white transition-colors"
              >
                Termos de Uso
              </a>
              <a
                href="/privacidade"
                onClick={(e) => { e.preventDefault(); onNavigateLegal('/privacidade'); }}
                className="text-ink-400 hover:text-white transition-colors"
              >
                Política de Privacidade
              </a>
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
  );
}
