import { redirect } from 'next/navigation';
import { isVerified, requireSignedIn } from '@/lib/auth';
import { ROLE_HOME } from '@/lib/format';
import { TONE } from '@/components/ui';
import { ClockIcon, XIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const profile = await requireSignedIn();
  if (isVerified(profile)) redirect(ROLE_HOME[profile.role]);
  const rejected = profile.status === 'REJECTED';

  return (
    <div className="max-w-xl mx-auto md:mt-6 bg-white border border-line rounded-2xl p-6 md:p-10 flex flex-col items-center text-center gap-4">
      <span className={`flex size-14 items-center justify-center rounded-full ${rejected ? TONE.red : TONE.orange}`}>
        {rejected ? <XIcon className="size-7" /> : <ClockIcon className="size-7" />}
      </span>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-ink">{rejected ? 'Antrag abgelehnt' : 'Ihr Antrag wird geprüft'}</h1>
      <p className="text-base text-muted">{profile.organizationName}</p>
      <p className="text-lg leading-relaxed text-ink-2 max-w-md">
        {rejected
          ? 'Ihr Antrag als Spender wurde nicht freigegeben. Bei Fragen wenden Sie sich bitte an die Schweizer Tafel.'
          : 'Vielen Dank für Ihre Registrierung. Die Schweizer Tafel prüft Ihre Angaben. Danach können Sie hier Spenden melden. Melden Sie sich einfach später wieder an.'}
      </p>
    </div>
  );
}
