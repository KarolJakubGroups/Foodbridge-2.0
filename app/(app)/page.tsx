import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { ROLE_HOME } from '@/lib/format';

export default async function HomePage() {
  const profile = await requireProfile();
  redirect(ROLE_HOME[profile.role]);
}
