import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { fetchAvailableDonations, fetchImpactFor, fetchMyClaims } from '@/lib/queries';
import { weightKg } from '@/lib/domain';
import { fmtCount, fmtDateOfInstant, fmtDayTime, fmtKg, fmtNumber } from '@/lib/format';
import type { ClaimWithDonation } from '@/lib/types';
import { Card, EmptyState, PageHeader, Pill, linkCls, type Tone } from '@/components/ui';
import { PackageIcon } from '@/components/icons';
import { AvailableDonations } from '@/components/AvailableDonations';

export const dynamic = 'force-dynamic';

/** Where a reserved offer stands, from the institution's point of view. */
function reservationStatus(d: ClaimWithDonation['donation'], now: Date): { label: string; tone: Tone; note: string } {
  const order = d.transportOrder;
  if (d.status === 'COMPLETED') return { label: 'Geliefert', tone: 'gray', note: order ? `Am ${fmtDateOfInstant(order.pickupTime)}` : '' };
  if (d.status === 'BUNDLED' && order?.status === 'DISPATCHED') return { label: 'Unterwegs', tone: 'orange', note: 'Der Lastwagen ist unterwegs' };
  if (d.status === 'BUNDLED' && order) return { label: 'Transport geplant', tone: 'blue', note: `Abholung ${fmtDayTime(order.pickupTime, now)} Uhr` };
  return { label: 'Reserviert', tone: 'violet', note: 'Transport wird geplant' };
}

export default async function FoodbankPage() {
  const profile = await requireRole('FOODBANK');
  const [available, claims, impact] = await Promise.all([
    fetchAvailableDonations(), fetchMyClaims(profile.id), fetchImpactFor(profile.id, 'FOODBANK'),
  ]);
  const now = new Date();
  const recent = claims.slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Verfügbare Lebensmittel"
        subtitle={`${available.length === 0 ? 'Gerade keine Angebote' : `${fmtCount(available.length, 'Angebot', 'Angebote')} verfügbar`}. Angebote verschwinden nach 4 Tagen automatisch.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-7 items-start">
        <AvailableDonations donations={available} now={now.toISOString()} />

        <aside className="space-y-6">
          <Card title="Meine Reservierungen" actions={<span className="text-base text-muted">{claims.length}</span>}>
            {recent.length === 0 ? (
              <EmptyState icon={<PackageIcon className="size-6" />} title="Noch nichts reserviert">
                Reservieren Sie links ein Angebot. Den Transport organisiert die Disposition.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line-soft -my-3">
                {recent.map((c) => {
                  const s = reservationStatus(c.donation, now);
                  return (
                    <li key={c.id} className="py-4 flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-base font-semibold text-ink">{c.donation.productName}</span>
                        <span className="text-[15px] text-muted tabular-nums whitespace-nowrap">{fmtKg(weightKg(c.donation))}</span>
                      </div>
                      <span className="text-sm text-muted">{c.donation.donor.organizationName}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={s.tone}>{s.label}</Pill>
                        {s.note && <span className="text-sm text-muted">{s.note}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {claims.length > 0 && <Link href="/network" className={`${linkCls} inline-block mt-5`}>Alle Lieferungen ansehen</Link>}
          </Card>

          <section className="rounded-2xl bg-brand-700 text-white px-6 py-6 flex flex-col gap-1.5">
            <span className="text-[15px] text-[#d5ebdd]">Bisher erhalten</span>
            <span className="font-display text-4xl font-bold tabular-nums">{fmtKg(impact.totalWeightKg)}</span>
            <span className="text-base text-[#e9f5ee]">≈ {fmtNumber(impact.meals, 0)} Mahlzeiten für Ihre Gäste</span>
          </section>
        </aside>
      </div>
    </div>
  );
}
