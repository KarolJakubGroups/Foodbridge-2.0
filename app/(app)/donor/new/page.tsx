import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { fetchMyDonations } from '@/lib/queries';
import { freshnessCutoff } from '@/lib/domain';
import type { DonationPrefill } from '@/lib/types';
import { PageHeader, linkCls } from '@/components/ui';
import { ChevronLeftIcon } from '@/components/icons';
import { DonationFormLoader } from '@/components/DonationFormLoader';

export const dynamic = 'force-dynamic';

export default async function NewDonationPage({ searchParams }: PageProps<'/donor/new'>) {
  const profile = await requireRole('DONOR');
  const { from } = await searchParams;
  const donations = await fetchMyDonations(profile.id);

  const cutoff = freshnessCutoff();
  const openDonations = donations
    .filter((d) => d.status === 'AVAILABLE' && d.createdAt > cutoff)
    .map((d) => ({
      id: d.id, productName: d.productName, category: d.category, temperatureRange: d.temperatureRange,
      numberOfPallets: d.numberOfPallets, weightPerPallet: d.weightPerPallet, bestBeforeDate: d.bestBeforeDate,
      overlapStart: d.overlapStart, overlapEnd: d.overlapEnd, createdAt: d.createdAt,
    }));

  // "Neu erfassen" on an offer nobody picked up starts from a copy of it.
  const source = typeof from === 'string' ? donations.find((d) => d.id === Number(from)) : undefined;
  const prefill: DonationPrefill | undefined = source && {
    productName: source.productName, category: source.category, temperatureRange: source.temperatureRange,
    numberOfPallets: source.numberOfPallets, weightPerPallet: source.weightPerPallet,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        back={<Link href="/donor" className={`${linkCls} inline-flex items-center gap-1.5 text-base`}><ChevronLeftIcon className="size-5" />Zurück zur Übersicht</Link>}
        title="Überschuss melden"
        subtitle="Dauert etwa eine Minute. Abgabestellen sehen das Angebot sofort."
      />
      <DonationFormLoader
        defaultAddress={profile.address}
        organizationName={profile.organizationName}
        openDonations={openDonations}
        prefill={prefill}
      />
    </div>
  );
}
