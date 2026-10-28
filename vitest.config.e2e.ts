import { defineConfig } from 'vitest/config';

// End-to-end tests run against a real PostgreSQL (DATABASE_URL). They share one database,
// so files run sequentially; each file resets the schema in beforeAll.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
