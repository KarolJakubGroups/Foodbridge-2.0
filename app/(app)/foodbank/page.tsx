import { requireRole } from '@/lib/auth';
import { fetchAvailableDonations, fetchImpactFor, fetchMyClaims } from '@/lib/queries';
import { weightKg } from '@/lib/domain';
import { Badge, Card, ImpactChip, TableShell, tdCls, trCls } from '@/components/ui';
import { AvailableDonations } from '@/components/AvailableDonations';

export const dynamic = 'force-dynamic';

export default async function FoodbankPage() {
  const profile = await requireRole('FOODBANK');
  const [available, claims, impact] = await Promise.all([
    fetchAvailableDonations(), fetchMyClaims(profile.id), fetchImpactFor(profile.id, 'FOODBANK'),
  ]);

  return (
    <div className="space-y-4">
      <Card title={`Abgabestelle Allokation: ${profile.username.toUpperCase()}`}
        subtitle="Übersicht verfügbarer Lebensmitteleinheiten gemäss 4-Tage-Sicherheitskriterium."
        actions={<ImpactChip impact={impact} />}>
        <p className="text-xs text-slate-500">{profile.organizationName} · {profile.address}</p>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3" title="Verfügbare Bestände (Nationale Übersicht)" subtitle="Angebote älter als 4 Tage werden automatisch ausgeblendet.">
          <AvailableDonations donations={available} />
        </Card>
        <Card className="lg:col-span-2" title="Ihre reservierten Allokationen" subtitle="Geplant für Galliker-Logistikkonsolidierung.">
          <TableShell isEmpty={claims.length === 0} headers={[{ label: 'Spender' }, { label: 'Artikel' }, { label: 'Menge' }, { label: 'Status' }]}>
            {claims.map((c) => (
              <tr key={c.id} className={trCls}>
                <td className={tdCls}><b>{c.donation.donor.username}</b></td>
                <td className={tdCls}>{c.donation.productName}</td>
                <td className={`${tdCls} font-mono`}>{weightKg(c.donation)} kg ({c.donation.numberOfPallets} Pal)</td>
                <td className={tdCls}><Badge status={c.donation.status} /></td>
              </tr>
            ))}
          </TableShell>
        </Card>
      </div>
    </div>
  );
}
