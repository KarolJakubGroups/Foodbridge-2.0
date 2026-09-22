import { execSync } from 'node:child_process';

/**
 * Vitest global setup. Integration tests run against a separate PostgreSQL
 * schema ("foodbridge_test") of the configured database so production data is
 * never touched. Set TEST_DATABASE_URL to use a different database entirely.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return; // no database configured: integration tests skip themselves
  process.env.TEST_DATABASE_URL = url;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
