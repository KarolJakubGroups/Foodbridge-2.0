import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/** Vitest global setup: fresh SQLite database with all migrations applied. */
export default function setup() {
  const url = 'file:./prisma/test.db';
  for (const f of ['prisma/test.db', 'prisma/test.db-journal']) rmSync(f, { force: true });
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
