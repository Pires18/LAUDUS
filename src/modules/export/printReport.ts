import type { AppSettings } from '../../types';
import { reportDocumentStyles, getFontFamilyFallback } from './ReportDocument';
import { logger } from '../../utils/logger';

/**
 * Impressão/PDF do laudo com paginação real via Paged.js.
 *
 * Motivação: o mecanismo anterior (tabela com <tfoot> repetido + `counter(page)`
 * no conteúdo) não funciona no Chrome — o contador retorna 0 ("Página 0 de 0") e
 * o rodapé só gruda no fim de páginas cheias, flutuando no meio da última página.
 *
 * Paged.js pagina o HTML do laudo em páginas A4 reais e usa as caixas de margem
 * `@page { @bottom-left/@bottom-right }` para renderizar, FIXO no rodapé de TODA
 * página: à esquerda a identificação (paciente · data) e à direita a numeração
 * `Página X de Y` (com `counter(page)`/`counter(pages)` que o Paged.js resolve
 * corretamente).
 *
 * A fonte do conteúdo é o elemento oculto `#report-print-source` (renderizado por
 * <PrintLayout> com o mesmo <ReportDocumentBody> da prévia), garantindo que o PDF
 * final seja idêntico ao que o médico vê na pré-visualização.
 */

const SOURCE_ID = 'report-print-source';
const OUTPUT_ID = 'report-print-output';
const ISOLATION_STYLE_ID = 'report-print-isolation';
const PRINTING_CLASS = 'printing-laudo';

/** Escapa uma string para uso seguro dentro de `content: "..."` no CSS. */
function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Injeta (uma vez) as regras que isolam a saída paginada na impressão: em tela a
 * saída fica oculta; ao imprimir com a classe `printing-laudo` no <body>, só a
 * saída paginada aparece — sem afetar a impressão de imagens (que não usa a
 * classe). `data-pagedjs-ignore` evita que o Paged.js processe esta folha.
 */
function ensureIsolationStyle(): void {
  if (document.getElementById(ISOLATION_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ISOLATION_STYLE_ID;
  style.setAttribute('data-pagedjs-ignore', 'true');
  style.textContent = `
    @media screen { #${OUTPUT_ID} { display: none !important; } }
    @media print {
      body.${PRINTING_CLASS} > *:not(#${OUTPUT_ID}) { display: none !important; }
      body.${PRINTING_CLASS} > #${OUTPUT_ID} { display: block !important; }
      body.${PRINTING_CLASS} { background: #fff !important; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Pagina o laudo e dispara a impressão/geração de PDF.
 * @param settings Configurações de layout (fonte, margens…).
 * @param footerId Texto de identificação exibido à esquerda no rodapé de cada
 *   página (ex.: "MARIA DA SILVA · 04/07/2026").
 */
export async function printLaudo(settings: AppSettings, footerId: string): Promise<void> {
  const source = document.getElementById(SOURCE_ID);
  if (!source) {
    logger.warn('[printLaudo] fonte do laudo não encontrada; usando window.print()');
    window.print();
    return;
  }

  ensureIsolationStyle();

  // Container de saída novo a cada impressão, como filho direto de <body>.
  document.getElementById(OUTPUT_ID)?.remove();
  const out = document.createElement('div');
  out.id = OUTPUT_ID;
  out.className = 'report-doc';
  document.body.appendChild(out);

  const marginTop = settings.pdfMarginTop ?? 15;
  const marginBottom = Math.max(settings.pdfMarginBottom ?? 15, 14); // reserva p/ rodapé
  const marginLeft = settings.pdfMarginLeft ?? 15;
  const marginRight = settings.pdfMarginRight ?? 15;
  const font = getFontFamilyFallback(settings.pdfFontFamily);
  const id = escapeCssString(footerId);

  const marginBoxStyle = `font-family: ${font}; font-size: 8.5px; font-weight: 700; letter-spacing: 0.02em; color: #9ca3af;`;
  const css = `
    ${reportDocumentStyles(settings)}
    @page {
      size: A4;
      margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
      @bottom-left {
        content: "${id}";
        ${marginBoxStyle}
        text-transform: uppercase;
      }
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        ${marginBoxStyle}
      }
    }
  `;

  // Fragmento clonado — mantém a fonte (#report-print-source) intacta e em sync.
  const template = document.createElement('template');
  template.innerHTML = source.innerHTML;

  const cleanup = () => {
    document.body.classList.remove(PRINTING_CLASS);
    document.getElementById(OUTPUT_ID)?.remove();
  };

  try {
    const { Previewer } = await import('pagedjs');
    const previewer = new Previewer();
    await previewer.preview(template.content, [{ 'laudo-print.css': css }], out);

    document.body.classList.add(PRINTING_CLASS);
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback: alguns navegadores (Safari) não disparam afterprint de forma confiável.
    window.setTimeout(() => {
      if (document.body.classList.contains(PRINTING_CLASS)) cleanup();
    }, 60000);

    window.print();
  } catch (err) {
    logger.error('[printLaudo] falha na paginação; usando window.print()', err);
    cleanup();
    window.print();
  }
}
