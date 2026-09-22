import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example)');
  // DATABASE_SCHEMA lets tests work in an isolated PostgreSQL schema (see vitest.config.mts).
  const schema = process.env.DATABASE_SCHEMA || undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined) });
}

// Reuse one client (and its connection pool) across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
