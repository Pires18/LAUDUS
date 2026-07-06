import { useState, useEffect } from 'react';
import { PricingPlans } from './PricingPlans';
import { scrollToSection } from '../utils/scrollToSection';
import { Nav } from './landing/Nav';
import { Hero } from './landing/Hero';
import { HowItWorks } from './landing/HowItWorks';
import { Features } from './landing/Features';
import { TrustSecurity } from './landing/TrustSecurity';
import { PricingTeaser } from './landing/PricingTeaser';
import { Faq } from './landing/Faq';
import { Footer } from './landing/Footer';

interface Props {
  onEnter: (mode: 'login' | 'signup') => void;
}

/** Navegação SPA para as páginas legais (rotas públicas reais). */
function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Landing institucional (pré-auth). Light-only por decisão: um visitante
 * anônimo não deve herdar o tema escuro configurado por outro usuário do
 * dispositivo — o efeito abaixo suspende a classe `dark` enquanto a landing
 * estiver montada e restaura ao sair.
 */
export function LandingScreen({ onEnter }: Props) {
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    return () => {
      if (wasDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      }
    };
  }, []);

  // Se a página abrir com um hash (ex.: /#faq vindo de um link externo),
  // rola até a seção depois do primeiro paint.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) scrollToSection(hash, { updateHash: false });
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto bg-white font-sans">
      <Nav onEnter={onEnter} onShowPricing={() => setShowPricing(true)} />
      <Hero onEnter={onEnter} onShowPricing={() => setShowPricing(true)} />
      <HowItWorks />
      <Features />
      <TrustSecurity onOpenPrivacy={() => navigateTo('/privacidade')} />
      <PricingTeaser onShowPricing={() => setShowPricing(true)} onEnter={onEnter} />
      <Faq />
      <Footer
        onShowPricing={() => setShowPricing(true)}
        onNavigateLegal={(path) => navigateTo(path)}
      />

      <PricingPlans
        open={showPricing}
        onClose={() => setShowPricing(false)}
        onChoose={() => { setShowPricing(false); onEnter('signup'); }}
      />
    </div>
  );
}
