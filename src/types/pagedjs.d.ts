/**
 * Declaração mínima de tipos para o Paged.js (o pacote não publica tipos).
 * Cobre apenas a API usada em src/modules/export/printReport.ts.
 */
declare module 'pagedjs' {
  /** Cada folha de estilo pode ser uma URL ou um objeto { href: cssText }. */
  export type PagedStylesheet = string | Record<string, string>;

  export interface PagedFlow {
    total: number;
    pages: unknown[];
    performance: number;
  }

  export class Previewer {
    constructor(options?: unknown);
    preview(
      content?: Node | DocumentFragment | string,
      stylesheets?: PagedStylesheet[],
      renderTo?: HTMLElement
    ): Promise<PagedFlow>;
    on(event: string, cb: (...args: unknown[]) => void): void;
  }

  export class Chunker {}
  export class Polisher {}
  export class Handler {}
}
