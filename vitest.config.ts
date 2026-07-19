import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Espelha o `define` do vite.config: `__APP_VERSION__` vem do package.json, para
// que módulos que leem a versão (src/version.ts) também funcionem sob o Vitest.
const appVersion = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
  },
});
