// ═══════════════════════════════════════════════════════════════════════
// Versões exibidas na UI — FONTE ÚNICA DE VERDADE.
// ═══════════════════════════════════════════════════════════════════════
// LAUD.US (a plataforma) vem do package.json, injetado em build/teste via o
// `define` do Vite (`__APP_VERSION__`). NUNCA hardcodar a versão da plataforma
// em componentes — foi o que travou a UI em "v2.0" enquanto o package.json já
// estava em 2.2.0.
//
// LAUD.IA (o motor de IA/prompts) versiona no seu PRÓPRIO ritmo, independente da
// plataforma. Ao evoluir a geração de prompts (Camadas 1/2, diretrizes), suba
// `LAUDIA_VERSION` aqui — e só aqui.
declare const __APP_VERSION__: string;

/** Versão da plataforma (LAUD.US) — igual ao package.json. */
export const LAUDUS_VERSION = __APP_VERSION__;

/** Versão do motor de IA (LAUD.IA) — linha de versão própria. */
export const LAUDIA_VERSION = '2.1';

/** Badge combinado exibido no rodapé da navegação (Sidebar/BottomNav). */
export const VERSION_BADGE = `LAUD.US v${LAUDUS_VERSION} · LAUD.IA v${LAUDIA_VERSION}`;
