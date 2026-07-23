// Só negrito, pulos de linha e alinhamento sobrevivem no HTML copiado — o
// resto (fonte, tamanho, cor, itálico/sublinhado, entrelinha, espaçamento
// entre letras e margens) é removido para colar limpo em qualquer lugar
// (WhatsApp, Word, e-mail) com a letra do destino e sem espaçamentos extras.
const FONT_STYLE_PROPS = [
  'font-family', 'font-size', 'color', 'background-color',
  'font-style', 'text-decoration', 'line-height', 'letter-spacing',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
];

function isBoldWeight(weight: string): boolean {
  if (!weight) return false;
  if (weight === 'bold' || weight === 'bolder') return true;
  const n = parseInt(weight, 10);
  return !isNaN(n) && n >= 600;
}

/**
 * Reduz o HTML do corpo do laudo ao básico pra copiar/colar: mantém só
 * negrito, alinhamento e os pulos de linha, remove fonte/tamanho/cor/
 * itálico/sublinhado/tachado e todo espaçamento (entrelinha, entre letras e
 * margens de parágrafo), e converte títulos (h1-h6) em parágrafo negrito —
 * sem isso o tamanho de título do navegador vazaria mesmo removendo o style.
 */
function buildPlainReportBody(reportHtml: string): string {
  const container = document.createElement('div');
  container.innerHTML = reportHtml.replace(/\(…\)/g, '( &nbsp;&nbsp;&nbsp;&nbsp; )');

  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.innerHTML = heading.innerHTML;
    p.appendChild(strong);
    const headingStyle = (heading as HTMLElement).style;
    if (headingStyle.textAlign) p.style.textAlign = headingStyle.textAlign;

    // Uma linha em branco antes de cada seção (Título, Técnica, Análise,
    // Conclusão, Recomendações, Observações Metodológicas) — exceto quando a
    // seção é o primeiro elemento do laudo, que não tem nada antes pra separar.
    if (heading.previousElementSibling) {
      const spacer = document.createElement('p');
      spacer.innerHTML = '<br>';
      heading.parentNode?.insertBefore(spacer, heading);
    }

    heading.replaceWith(p);
  });

  // Desfaz ênfases além de negrito — mantém só o texto de dentro.
  container.querySelectorAll('em, i, u, s, strike, mark').forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });

  container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const bold = isBoldWeight(el.style.fontWeight);
    FONT_STYLE_PROPS.forEach((prop) => el.style.removeProperty(prop));
    el.style.removeProperty('font-weight');
    if (bold) el.style.fontWeight = 'bold';
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });

  container.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));

  // Zera explicitamente as margens dos blocos: sem isso o destino (Word,
  // Google Docs, e-mail) aplica o "espaço depois do parágrafo" padrão dele e o
  // laudo cola com espaçamentos extras. Os pulos de linha reais (parágrafos e
  // linhas em branco) permanecem.
  container.querySelectorAll<HTMLElement>('p, div, ul, ol, li').forEach((el) => {
    el.style.margin = '0';
  });

  return container.innerHTML;
}

/** Copia só o corpo do laudo (sem dados do paciente, anamnese ou assinatura),
 * com formatação reduzida ao básico — negrito e alinhamento. */
export async function copyReportToClipboard(reportHtml: string): Promise<void> {
  const cleanedHtml = buildPlainReportBody(reportHtml);
  const plainText = (new DOMParser()).parseFromString(cleanedHtml, 'text/html').body.textContent || '';

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([cleanedHtml], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]);
}
