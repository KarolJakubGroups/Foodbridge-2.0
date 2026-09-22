import { defineConfig } from 'vitest/config';
import { TEST_SCHEMA, testDatabaseUrl } from './tests/test-env';

const testUrl = testDatabaseUrl();

export default defineConfig({
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
  test: {
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/setup-test-db.ts'],
    // Integration tests always run in the isolated "foodbridge_test" schema.
    env: testUrl ? { DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl, DATABASE_SCHEMA: TEST_SCHEMA } : {},
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
