import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
  test: {
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/setup-test-db.ts'],
    env: { DATABASE_URL: 'file:./prisma/test.db' },
    fileParallelism: false,
  },
});
