import { ReactNode } from 'react';

/**
 * Renderizador de Markdown minimalista para os documentos legais (docs/legal).
 *
 * Cobre exatamente o que os documentos usam — headings, negrito, itálico,
 * código inline, links, listas, blockquotes e tabelas pipe — emitindo
 * elementos React (sem dangerouslySetInnerHTML, CSP-safe, zero dependências).
 *
 * Saneamento aplicado antes do render:
 *  - remove o H1 inicial e a linha "**Versão:** ..." (a página exibe título e
 *    versão no próprio cabeçalho);
 *  - remove blockquotes que aparecem antes do primeiro "##" (notas internas
 *    de rascunho que não devem ser publicadas).
 */

interface Props {
  markdown: string;
  /** Navegação SPA para links internos (.md → rota pública). */
  onNavigateInternal?: (path: string) => void;
}

/** Slug estável a partir do texto do heading — usado para âncoras do índice. */
export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Links relativos entre documentos .md → rotas públicas do app. */
const INTERNAL_LINKS: Record<string, string> = {
  'TERMOS_DE_USO.md': '/termos',
  'POLITICA_DE_PRIVACIDADE.md': '/privacidade',
  '../LGPD_POLITICA_RETENCAO.md': '/privacidade',
  'LGPD_POLITICA_RETENCAO.md': '/privacidade',
};

function sanitize(markdown: string): string[] {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let seenSection = false;
  for (const line of lines) {
    if (line.startsWith('## ')) seenSection = true;
    if (!seenSection) {
      // Antes do primeiro "##": pula H1, linha de versão e notas internas (>).
      if (line.startsWith('# ')) continue;
      if (line.startsWith('**Versão:**')) continue;
      if (line.startsWith('>')) continue;
    }
    out.push(line);
  }
  return out;
}

/** Formata trechos inline: **negrito**, *itálico*, `código`, [link](url). */
function renderInline(text: string, key: number, onNavigateInternal?: (p: string) => void): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`b${key}-${i}`} className="font-bold text-ink-900">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      nodes.push(<code key={`c${key}-${i}`} className="text-[0.85em] font-mono bg-ink-100 text-ink-800 px-1.5 py-0.5 rounded-md">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        const [, label, href] = lm;
        const internal = INTERNAL_LINKS[href];
        if (internal) {
          nodes.push(
            <a
              key={`l${key}-${i}`}
              href={internal}
              onClick={(e) => {
                if (onNavigateInternal) { e.preventDefault(); onNavigateInternal(internal); }
              }}
              className="text-brand-600 font-semibold underline underline-offset-2 hover:text-brand-700"
            >
              {label}
            </a>
          );
        } else {
          nodes.push(
            <a key={`l${key}-${i}`} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 font-semibold underline underline-offset-2 hover:text-brand-700">
              {label}
            </a>
          );
        }
      }
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={`i${key}-${i}`} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownView({ markdown, onNavigateInternal }: Props) {
  const lines = sanitize(markdown);
  const blocks: ReactNode[] = [];
  let k = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) continue;

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={k++} className="text-sm font-black text-ink-900 mt-6 mb-2">{renderInline(line.slice(4), k, onNavigateInternal)}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      const text = line.slice(3);
      blocks.push(
        <h2 key={k++} id={slugify(text)} className="text-lg font-black text-ink-900 mt-10 mb-3 pb-2 border-b border-ink-100 tracking-tight scroll-mt-24">
          {renderInline(text, k, onNavigateInternal)}
        </h2>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={k++} className="text-2xl font-black text-ink-900 mt-2 mb-4 tracking-tight">{renderInline(line.slice(2), k, onNavigateInternal)}</h1>);
      continue;
    }

    // Blockquote (agrupa linhas consecutivas iniciadas por ">")
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      i--;
      blocks.push(
        <blockquote key={k++} className="border-l-4 border-amber-300 bg-amber-50/60 rounded-r-xl px-4 py-3 my-4 space-y-2">
          {quote.filter(q => q.trim()).map((q, qi) => (
            <p key={qi} className="text-[13px] text-amber-900/90 leading-relaxed">{renderInline(q, k * 100 + qi, onNavigateInternal)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Tabela pipe
    if (line.startsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tbl.push(lines[i]);
        i++;
      }
      i--;
      const rows = tbl
        .filter(r => !/^\|[\s:|-]+\|$/.test(r)) // remove linha separadora |---|---|
        .map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="my-5 overflow-x-auto rounded-2xl border border-ink-200">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-ink-50">
                {head.map((c, ci) => (
                  <th key={ci} className="text-left font-black text-ink-700 uppercase tracking-wider text-[10px] px-4 py-3 border-b border-ink-200">{renderInline(c, k * 100 + ci, onNavigateInternal)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? 'bg-ink-50/40' : ''}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-4 py-3 text-ink-600 leading-relaxed align-top border-b border-ink-100 last:border-b-0">{renderInline(c, k * 1000 + ri * 10 + ci, onNavigateInternal)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Lista com marcadores
    if (/^\s*-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s/, ''));
        i++;
      }
      i--;
      blocks.push(
        <ul key={k++} className="list-disc pl-6 my-3 space-y-2">
          {items.map((it, ii) => (
            <li key={ii} className="text-sm text-ink-600 leading-relaxed">{renderInline(it, k * 100 + ii, onNavigateInternal)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Parágrafo comum
    blocks.push(<p key={k++} className="text-sm text-ink-600 leading-relaxed my-3">{renderInline(line, k, onNavigateInternal)}</p>);
  }

  return <div>{blocks}</div>;
}
