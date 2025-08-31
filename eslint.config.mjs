import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['**/dist/**', '**/.next/**', 'node_modules', 'data'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 'latest' }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs['recommended'].rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
      ,
      'no-empty': 'off'
    }
  },
  {
    files: ['apps/site/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [
          { group: ['@factory/adapters/*', '@factory/infra/*', '@factory/plugins/*', '@factory/factory/*'], message: 'Site must not import adapters/infra/plugins/factory' }
        ] }
      ]
    }
  },
  {
    files: ['packages/plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [
          { group: ['@factory/adapters/*', '@factory/factory/*', 'apps/*', '@factory/infra/*'], message: 'Plugins must not import adapters/factory/apps/infra' }
        ] }
      ]
    }
  }
];
