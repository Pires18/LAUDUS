// ESLint 9 (flat config) — padronização do LAUD.US.
// Report-only por padrão: roda via `npm run lint`, separado do build
// (`tsc && vite build`), então não trava a publicação. Usa a config
// "recommended" SEM checagem de tipos (rápida; o `tsc` já cobre tipos).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    // Não lintar artefatos, dependências e scripts de infra.
    ignores: [
      'dist/**',
      'dev-dist/**',
      '.vercel/**',
      '.firebase/**',
      'node_modules/**',
      'public/**',
      'scripts/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Bugs reais em React — mantidos firmes.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Higiene — avisos, não erros (não travam o fluxo).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],

      // Dívida conhecida (rastreada no BACKLOG R7) — desligado por ora para
      // evitar ~300 avisos de casts de doc.data() do Firestore. Reativar ao
      // tipar os shapes de documento por coleção.
      '@typescript-eslint/no-explicit-any': 'off',

      // Padrões idiomáticos do projeto que não são defeito:
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
    },
  },
  {
    // Testes: um pouco mais frouxo.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
