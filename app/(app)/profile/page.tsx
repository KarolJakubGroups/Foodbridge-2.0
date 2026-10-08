import { requireProfile } from '@/lib/auth';
import { getProfileDetails } from '@/lib/services';
import { ROLE_LABEL } from '@/lib/format';
import { Card, PageHeader } from '@/components/ui';
import { ProfileForm } from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await requireProfile();
  const details = await getProfileDetails(profile);
  const isFoodbank = profile.role === 'FOODBANK';

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Profil"
        subtitle={`${profile.organizationName} · ${ROLE_LABEL[profile.role]}. ${isFoodbank
          ? 'Spender sehen, wer ihre Spenden erhält und wen sie bei Fragen erreichen.'
          : 'Abgabestellen und Disposition sehen, wen sie bei Fragen zur Abholung erreichen.'}`}
      />
      <Card title="Kontakt">
        <ProfileForm initial={details} withDescription={isFoodbank} />
      </Card>
    </div>
  );
}
