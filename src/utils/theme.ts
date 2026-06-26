/**
 * Gerenciamento de tema (claro/escuro) do LAUD.US.
 *
 * O tema é aplicado via classe `dark` no elemento <html>, ativando as variáveis
 * CSS definidas em src/styles/index.css. A preferência é persistida em
 * localStorage para evitar "flash" no carregamento (ver script inline em index.html).
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'laudus_theme';

/** Resolve a preferência ('system' → claro/escuro conforme o SO). */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

/** Aplica o tema ao documento e atualiza a meta theme-color. */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d0e11' : '#0568c5');
}

/** Lê a preferência salva (padrão: 'system'). */
export function getStoredTheme(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

/** Salva a preferência e aplica imediatamente. */
export function setTheme(pref: ThemePreference): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  }
  applyTheme(pref);
}

/**
 * Observa mudanças do tema do sistema operacional enquanto a preferência for
 * 'system'. Retorna uma função de limpeza.
 */
export function watchSystemTheme(getPref: () => ThemePreference): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getPref() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
