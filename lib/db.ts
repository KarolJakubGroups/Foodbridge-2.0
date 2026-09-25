import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DatabaseUnavailableError, isDatabaseUnavailable } from '@/lib/errors';

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example)');
  // DATABASE_SCHEMA lets tests work in an isolated PostgreSQL schema (see vitest.config.mts).
  const schema = process.env.DATABASE_SCHEMA || undefined;
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 8000 }, schema ? { schema } : undefined),
  });
  // Every query that fails because the database cannot be reached is rethrown as
  // DatabaseUnavailableError, so pages and actions can tell users what happened.
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (isDatabaseUnavailable(error)) throw new DatabaseUnavailableError(error);
          throw error;
        }
      },
    },
  });
}

type Client = ReturnType<typeof createPrismaClient>;

// Reuse one client (and its connection pool) across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: Client };
export const prisma: Client = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
