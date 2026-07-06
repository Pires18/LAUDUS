import { useEffect, useMemo } from 'react';
import { FileText, ShieldCheck, Printer, ArrowLeft, List } from 'lucide-react';
import { LogoIcon } from '../LogoIcon';
import { MarkdownView, slugify } from './MarkdownView';
import { classNames } from '../../utils/format';
import { scrollToSection } from '../../utils/scrollToSection';
// Fonte única dos textos legais: os .md oficiais do repositório (v3.0),
// importados como string em tempo de build (Vite ?raw). Sem cópia → sem drift.
import termsMd from '../../../docs/legal/TERMOS_DE_USO.md?raw';
import privacyMd from '../../../docs/legal/POLITICA_DE_PRIVACIDADE.md?raw';
import retentionMd from '../../../docs/LGPD_POLITICA_RETENCAO.md?raw';

/**
 * Página legal pública (/termos e /privacidade) — compartilhável e legível
 * sem login. Light-only por decisão: visitante anônimo não deve herdar o tema
 * escuro de outro usuário do dispositivo, e o documento deve imprimir limpo.
 */

interface Props {
  doc: 'terms' | 'privacy';
}

const META = {
  terms: {
    title: 'Termos de Uso',
    icon: FileText,
    md: termsMd,
  },
  privacy: {
    title: 'Política de Privacidade',
    icon: ShieldCheck,
    md: privacyMd,
  },
} as const;

function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Extrai os headings "## " do markdown para montar o índice lateral. */
function extractHeadings(md: string): { id: string; title: string }[] {
  return md
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => {
      const title = l.slice(3).trim();
      return { id: slugify(title), title };
    });
}

export function LegalPage({ doc }: Props) {
  const meta = META[doc];

  const toc = useMemo(() => {
    const main = extractHeadings(meta.md).map((h) => ({ ...h, group: meta.title }));
    if (doc === 'privacy') {
      const annex = extractHeadings(retentionMd).map((h) => ({ ...h, group: 'Anexo — Retenção de Dados' }));
      return [...main, ...annex];
    }
    return main;
  }, [doc, meta.md, meta.title]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${meta.title} — LAUD.US`;
    return () => { document.title = prev; };
  }, [meta.title]);

  // Página pública light-only: suspende o tema escuro (que pertence ao usuário
  // logado do dispositivo) enquanto o documento estiver aberto e restaura ao sair.
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

  return (
    <div className="h-full w-full overflow-y-auto bg-white font-sans text-ink-900 flex flex-col" style={{ colorScheme: 'light' }}>
      {/* ── Nav mínima ── */}
      <header className="legal-nav sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigateTo('/'); }}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-ink-200 shadow-sm flex items-center justify-center overflow-hidden">
              <LogoIcon size={30} />
            </div>
            <span className="text-lg font-black tracking-tighter">
              LAUD<span className="text-brand-600">.US</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="h-9 px-3 rounded-xl border border-ink-200 text-ink-500 hover:text-ink-800 hover:bg-ink-50 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
              title="Imprimir ou salvar em PDF"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigateTo('/login'); }}
              className="h-9 px-4 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-all flex items-center text-[10px] font-black uppercase tracking-widest shadow-sm"
            >
              Entrar
            </a>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-5 py-10 lg:grid lg:grid-cols-[1fr_220px] lg:gap-10 lg:items-start">
          <div className="max-w-3xl">
            {/* Cabeçalho do documento */}
            <div className="legal-doc-header space-y-4 mb-8">
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); navigateTo('/'); }}
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-ink-400 hover:text-ink-700 uppercase tracking-widest transition-colors"
              >
                <ArrowLeft size={12} /> Voltar ao início
              </a>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  <meta.icon size={20} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">{meta.title}</h1>
                  <p className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mt-1.5">
                    Versão 3.0 · vigente desde 06/07/2026
                  </p>
                </div>
              </div>

              {/* Switcher Termos ↔ Privacidade */}
              <div className="flex gap-1 p-1 bg-ink-100/70 rounded-2xl w-fit border border-ink-200/60">
                {(['terms', 'privacy'] as const).map((d) => (
                  <a
                    key={d}
                    href={d === 'terms' ? '/termos' : '/privacidade'}
                    onClick={(e) => { e.preventDefault(); navigateTo(d === 'terms' ? '/termos' : '/privacidade'); }}
                    className={classNames(
                      'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      doc === d ? 'bg-white text-brand-700 shadow-sm border border-brand-100' : 'text-ink-500 hover:text-ink-800'
                    )}
                  >
                    {d === 'terms' ? 'Termos de Uso' : 'Privacidade'}
                  </a>
                ))}
              </div>
            </div>

            {/* Documento */}
            <article className="legal-article">
              <MarkdownView markdown={meta.md} onNavigateInternal={navigateTo} />

              {/* Anexo: retenção de dados (inclui tabela de prazos e sub-operadores) */}
              {doc === 'privacy' && (
                <div className="mt-12 pt-8 border-t-2 border-ink-100">
                  <h1 id={slugify('Anexo — Política de Retenção e Expurgo de Dados')} className="text-xl font-black text-ink-900 mb-1 tracking-tight scroll-mt-24">Anexo — Política de Retenção e Expurgo de Dados</h1>
                  <p className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-4">Parte integrante desta Política de Privacidade</p>
                  <MarkdownView markdown={retentionMd} onNavigateInternal={navigateTo} />
                </div>
              )}
            </article>
          </div>

          {/* Índice lateral (desktop) */}
          <aside className="legal-toc hidden lg:block sticky top-24 self-start">
            <div className="flex items-center gap-1.5 text-ink-400 mb-3">
              <List size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Nesta página</span>
            </div>
            <nav className="space-y-1 border-l-2 border-ink-100 pl-3">
              {toc.map((h) => (
                <button
                  key={h.id}
                  onClick={() => scrollToSection(h.id, { updateHash: false })}
                  className="block w-full text-left text-[12px] font-semibold text-ink-500 hover:text-brand-600 leading-snug py-0.5 transition-colors"
                >
                  {h.title}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="legal-footer border-t border-ink-100 bg-ink-50/50">
        <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">
            © {new Date().getFullYear()} LAUD.US — Sistemas de Laudos Inteligentes
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
            <a href="/termos" onClick={(e) => { e.preventDefault(); navigateTo('/termos'); }} className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Termos</a>
            <a href="/privacidade" onClick={(e) => { e.preventDefault(); navigateTo('/privacidade'); }} className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Privacidade</a>
            <a href="mailto:contato.laudus@gmail.com" className="text-ink-400 hover:text-ink-700 underline underline-offset-2">Contato</a>
          </p>
        </div>
      </footer>

      {/* Impressão: só o documento, papel limpo */}
      <style>{`
        @media print {
          .legal-nav, .legal-footer, .legal-toc, .legal-doc-header a, .legal-doc-header .flex.gap-1 { display: none !important; }
          .legal-article { max-width: 100% !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
