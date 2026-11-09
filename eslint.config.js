import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config(
  {
    ignores: [
      '**/dist/**',
      // Byte-identical public bundles retained only for pre-migration open tabs.
      'apps/website/public/assets/**',
      // Built from the separately checked React 18 Framer product workspace.
      'apps/website/public/framer/**',
      '.wrangler/**',
      '**/.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results*/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
