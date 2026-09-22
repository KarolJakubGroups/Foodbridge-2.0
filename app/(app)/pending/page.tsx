import { redirect } from 'next/navigation';
import { isVerified, requireSignedIn } from '@/lib/auth';
import { ROLE_HOME } from '@/lib/format';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const profile = await requireSignedIn();
  if (isVerified(profile)) redirect(ROLE_HOME[profile.role]);
  const rejected = profile.status === 'REJECTED';

  return (
    <div className="max-w-lg mx-auto mt-6 md:mt-12">
      <Card title={rejected ? 'Antrag abgelehnt' : 'Antrag wird geprüft'} subtitle={profile.organizationName}>
        {rejected ? (
          <p className="text-sm text-slate-700">
            Ihr Antrag als Spender wurde nicht freigegeben. Bitte wenden Sie sich an die Schweizer Tafel, wenn Sie Fragen dazu haben.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            Vielen Dank für Ihre Registrierung. Die Schweizer Tafel prüft Ihren Antrag. Sobald er freigegeben ist, können Sie
            hier Lebensmittelspenden erfassen. Melden Sie sich einfach später erneut an.
          </p>
        )}
      </Card>
    </div>
  );
}
