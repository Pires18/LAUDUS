// ═══════════════════════════════════════════════════════════════════════
// Detecção de nova versão no ar (independente do Service Worker).
// ═══════════════════════════════════════════════════════════════════════
// O __BUILD_ID__ é embutido no bundle no build (vite.config.ts) e muda a CADA
// deploy. O mesmo id é publicado em /version.json. Comparar o id embutido com o
// do servidor detecta um deploy novo mesmo que o SW esteja travado/lento — é o
// gatilho mais confiável para "empurrar" uma atualização.

/** Build embutido neste bundle (muda a cada deploy). 'dev' fora do build. */
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

/**
 * Busca o buildId publicado pelo servidor (/version.json, sempre no-store).
 * Retorna null se indisponível (ex.: dev sem build, offline) — nesse caso o
 * chamador não deve concluir que há atualização.
 */
export async function fetchServerBuildId(): Promise<string | null> {
  try {
    const resp = await fetch('/version.json', { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { buildId?: string };
    return typeof data.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  }
}

/**
 * True se o servidor está numa versão diferente da embutida neste cliente.
 * Só afirma divergência quando consegue ler um id válido do servidor (nunca a
 * partir de falha de rede) e o cliente não está em 'dev'.
 */
export async function isNewVersionAvailable(): Promise<boolean> {
  if (BUILD_ID === 'dev') return false;
  const serverBuildId = await fetchServerBuildId();
  return serverBuildId != null && serverBuildId !== BUILD_ID;
}
