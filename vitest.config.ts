import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } }
  },
  resolve: {
    alias: {
      '@factory/core': path.resolve(__dirname, 'packages/core'),
      '@factory/infra': path.resolve(__dirname, 'packages/infra'),
      '@factory/adapters': path.resolve(__dirname, 'packages/adapters'),
      '@factory/factory': path.resolve(__dirname, 'packages/factory'),
      '@factory/plugins': path.resolve(__dirname, 'packages/plugins'),
      '@factory/lib': path.resolve(__dirname, 'packages/lib'),
      '@factory/integrations': path.resolve(__dirname, 'packages/integrations')
    }
  }
});
