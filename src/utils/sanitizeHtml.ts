const ALLOWED_TAGS = new Set([
  'p', 'strong', 'em', 'b', 'i', 'u', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'blockquote', 'pre', 'code',
  'sup', 'sub', 'mark', 'del', 'ins', 'colgroup', 'col',
]);

const ALLOWED_ATTRS = new Set(['class', 'style', 'colspan', 'rowspan', 'data-type', 'align']);

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = doc.createDocumentFragment();
    el.childNodes.forEach(child => {
      const cleaned = cleanNode(child, doc);
      if (cleaned) fragment.appendChild(cleaned);
    });
    return fragment;
  }

  const clean = doc.createElement(tagName);
  for (const attr of Array.from(el.attributes)) {
    if (ALLOWED_ATTRS.has(attr.name)) {
      const val = attr.value;
      if (!/javascript:/i.test(val) && !/^on/i.test(attr.name)) {
        clean.setAttribute(attr.name, val);
      }
    }
  }

  el.childNodes.forEach(child => {
    const cleaned = cleanNode(child, doc);
    if (cleaned) clean.appendChild(cleaned);
  });

  return clean;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const wrapper = doc.createElement('div');
  doc.body.childNodes.forEach(child => {
    const cleaned = cleanNode(child, doc);
    if (cleaned) wrapper.appendChild(cleaned);
  });

  return wrapper.innerHTML;
}
