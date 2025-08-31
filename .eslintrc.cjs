/* Monorepo ESLint config enforcing separation of concerns */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', '.next', 'node_modules', 'data'],
  rules: {},
  overrides: [
    {
      files: ['apps/site/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['@factory/adapters/*', '@factory/infra/*', '@factory/plugins/*', '@factory/factory/*'], message: 'Site must not import adapters/infra/plugins/factory' }
            ]
          }
        ]
      }
    },
    {
      files: ['packages/plugins/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['@factory/adapters/*', '@factory/factory/*', 'apps/*', '@factory/infra/*'], message: 'Plugins must not import adapters/factory/apps/infra' }
            ]
          }
        ]
      }
    }
  ]
};

