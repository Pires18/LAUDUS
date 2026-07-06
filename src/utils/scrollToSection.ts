/**
 * Rola até uma seção da própria página (âncoras da landing/legal).
 *
 * O app usa um container de rolagem próprio (não o viewport do navegador —
 * ver src/styles/index.css, #root tem overflow:hidden), então a navegação
 * nativa de `<a href="#id">` não tem efeito nenhum: o hash muda na URL, mas
 * nada rola. Precisa de scrollIntoView explícito. `behavior: 'instant'` é o
 * único valor com suporte confiável entre engines — 'smooth'/'auto' podem
 * não animar em alguns ambientes.
 */
export function scrollToSection(id: string, opts?: { updateHash?: boolean }) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  if (opts?.updateHash !== false) {
    window.history.replaceState({}, '', `#${id}`);
  }
}
