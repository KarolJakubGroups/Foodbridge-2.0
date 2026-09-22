import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';

// Load .env so DATABASE_URL is available; tests use a dedicated "foodbridge_test" schema.
const env: Record<string, string> = {};
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? env.TEST_DATABASE_URL ?? env.DATABASE_URL;
const testUrl = base && !process.env.TEST_DATABASE_URL && !env.TEST_DATABASE_URL
  ? base + (base.includes('?') ? '&' : '?') + 'schema=foodbridge_test'
  : base;

export default defineConfig({
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
  test: {
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/setup-test-db.ts'],
    env: testUrl ? { DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl } : {},
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
