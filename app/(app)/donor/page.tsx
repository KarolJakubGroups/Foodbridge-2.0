import { requireRole } from '@/lib/auth';
import { fetchImpactFor, fetchMyDonations } from '@/lib/queries';
import { Card, ImpactChip } from '@/components/ui';
import { DonationForm } from '@/components/DonationForm';
import { DonationTable } from '@/components/DonationTable';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function DonorPage() {
  const profile = await requireRole('DONOR');
  const [donations, impact] = await Promise.all([fetchMyDonations(profile.id), fetchImpactFor(profile.id, 'DONOR')]);

  return (
    <div className="space-y-4">
      <Card
        title={`Spender-Verwaltung: ${profile.username.toUpperCase()}`}
        subtitle="Erfassung überschüssiger Artikel und Freigabe der Abholzeitfenster."
        actions={<><ImpactChip impact={impact} /><PrintButton label="Compliance-Nachweis (PDF / Druck)" /></>}
      >
        <p className="text-xs text-slate-500">{profile.organizationName} · {profile.address}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 no-print" title="Neues Angebot registrieren" subtitle="7 Pflichtfelder gemäss Schweizer Tafel">
          <DonationForm defaultAddress={profile.address} />
        </Card>
        <Card className="lg:col-span-3" title="Registrierte Bestandsangebote">
          <DonationTable donations={donations} />
        </Card>
      </div>
    </div>
  );
}
