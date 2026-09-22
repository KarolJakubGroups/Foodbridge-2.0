import { existsSync, readFileSync } from 'node:fs';

/** Name of the isolated PostgreSQL schema the integration tests run in. */
export const TEST_SCHEMA = 'foodbridge_test';

function loadDotEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync('.env')) return env;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/**
 * Connection URL for the test schema: the base DATABASE_URL (or TEST_DATABASE_URL)
 * with `?schema=foodbridge_test`, which the Prisma CLI honours for migrations.
 * The runtime client is pointed at the same schema via DATABASE_SCHEMA (lib/db.ts).
 */
export function testDatabaseUrl(): string | undefined {
  const file = loadDotEnv();
  const base = process.env.TEST_DATABASE_URL ?? file.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? file.DATABASE_URL;
  if (!base) return undefined;
  const stripped = base.replace(/([?&])schema=[^&]*&?/, '$1').replace(/[?&]$/, '');
  return stripped + (stripped.includes('?') ? '&' : '?') + `schema=${TEST_SCHEMA}`;
}
