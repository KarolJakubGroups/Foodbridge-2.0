import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/session';
import type { Profile, Role } from '@/lib/types';
import { ROLE_HOME } from '@/lib/format';

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Page guard: users of other roles are sent to their own dashboard. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
