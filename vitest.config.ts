import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  test: {
    environment: 'node',
    globalSetup: ['test/setup/staleness.global.ts'],
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'test/data/unsupported/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/types/**', 'src/generated/build-info.ts', 'src/index.ts']
    }
  }
});
