/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
  forbidden: [
    {
      name: 'site-no-internal-imports',
      comment: 'apps/site must not import adapters/infra/plugins/factory',
      severity: 'error',
      from: { path: '^apps/site' },
      to: { path: '^packages/(adapters|infra|plugins|factory)' }
    },
    {
      name: 'plugins-no-internal-imports',
      comment: 'plugins must not import adapters/factory/apps/infra',
      severity: 'error',
      from: { path: '^packages/plugins' },
      to: { path: '^packages/(adapters|factory|infra)|^apps/' }
    }
  ]
};

