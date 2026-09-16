import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { Profile } from '@/lib/types';
import type { Role } from '@/lib/domain';

export const SESSION_COOKIE = 'fb_session';
const SESSION_HOURS = 8;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a DB-backed session and sets the cookie. Only the hash of the token is stored. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await prisma.session.create({ data: { id: hash(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hash(token) } });
  store.delete(SESSION_COOKIE);
}

/** Resolves the signed-in user for this request; memoised per render. */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const u = session.user;
  return { id: u.id, username: u.username, email: u.email, role: u.role as Role, organizationName: u.organizationName, address: u.address };
});
