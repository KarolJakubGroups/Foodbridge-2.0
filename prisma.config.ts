import { defineConfig } from 'prisma/config';

// SQLite file for local runs. Point DATABASE_URL at PostgreSQL (and change the
// datasource provider in prisma/schema.prisma) for a hosted deployment.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' },
});
