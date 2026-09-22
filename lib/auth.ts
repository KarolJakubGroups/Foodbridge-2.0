import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/session';
import type { Profile, Role } from '@/lib/types';
import { ROLE_HOME } from '@/lib/format';

export function isVerified(profile: Profile): boolean {
  return profile.role !== 'DONOR' || profile.status === 'APPROVED';
}

/** Any signed-in user, verified or not (app shell, pending page). */
export async function requireSignedIn(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Signed-in and verified. Donors whose application is still open are sent to /pending. */
export async function requireProfile(): Promise<Profile> {
  const profile = await requireSignedIn();
  if (!isVerified(profile)) redirect('/pending');
  return profile;
}

/** Page guard: users of other roles are sent to their own dashboard. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
