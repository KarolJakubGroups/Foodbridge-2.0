import { requireRole } from '@/lib/auth';
import { fetchImpactFor, fetchMyDonations } from '@/lib/queries';
import { freshnessCutoff } from '@/lib/domain';
import { Card, ImpactChip } from '@/components/ui';
import { DonationFormLoader } from '@/components/DonationFormLoader';
import { DonationTable } from '@/components/DonationTable';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function DonorPage() {
  const profile = await requireRole('DONOR');
  const [donations, impact] = await Promise.all([fetchMyDonations(profile.id), fetchImpactFor(profile.id, 'DONOR')]);
  const active = donations.filter((d) => d.status !== 'COMPLETED').length;
  // Offers the donor could still add pallets to (own, unreserved and within the 4-day window).
  const cutoff = freshnessCutoff();
  const openDonations = donations
    .filter((d) => d.status === 'AVAILABLE' && d.createdAt > cutoff)
    .map((d) => ({
      id: d.id, productName: d.productName, category: d.category, temperatureRange: d.temperatureRange,
      numberOfPallets: d.numberOfPallets, weightPerPallet: d.weightPerPallet, bestBeforeDate: d.bestBeforeDate,
      overlapStart: d.overlapStart, overlapEnd: d.overlapEnd, createdAt: d.createdAt,
    }));

  return (
    <div className="space-y-3 md:space-y-4">
      <Card
        title={`Spender: ${profile.organizationName}`}
        subtitle={profile.address}
        actions={<><ImpactChip impact={impact} /><span className="hidden md:inline"><PrintButton label="Compliance-Nachweis (PDF / Druck)" /></span></>}
      >
        <p className="text-xs text-slate-500">{active} aktive Angebote · {donations.length} insgesamt</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="lg:col-span-2 no-print" title="Neues Angebot registrieren" subtitle="Überschuss in unter einer Minute erfassen">
          <DonationFormLoader defaultAddress={profile.address} openDonations={openDonations} />
        </Card>
        <Card className="lg:col-span-3" title="Registrierte Bestandsangebote">
          <DonationTable donations={donations} />
        </Card>
      </div>
    </div>
  );
}
