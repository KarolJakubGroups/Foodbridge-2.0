import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-env';

/**
 * Vitest global setup: applies all migrations to the isolated "foodbridge_test"
 * schema so application data in "public" is never touched. Without a
 * configured database the integration tests skip themselves.
 */
export default function setup() {
  const url = testDatabaseUrl();
  if (!url) return;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
