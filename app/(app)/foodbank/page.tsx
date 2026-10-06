import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { fetchAvailableDonations, fetchImpactFor, fetchMyClaims } from '@/lib/queries';
import { fmtCount, fmtDateOfInstant, fmtKg, fmtNumber, fmtPallets, fmtWindow } from '@/lib/format';
import type { ClaimWithDonation } from '@/lib/types';
import { Card, EmptyState, FoodPhoto, PageHeader, Pill, TempPill, linkCls, type Tone } from '@/components/ui';
import { PackageIcon } from '@/components/icons';
import { AvailableDonations } from '@/components/AvailableDonations';

export const dynamic = 'force-dynamic';

/** Where a reservation stands, from the institution's point of view. */
function reservationStatus(c: ClaimWithDonation, now: Date): { label: string; tone: Tone; note: string } {
  const order = c.transportOrder;
  if (c.status === 'COMPLETED') return { label: 'Geliefert', tone: 'gray', note: order ? `Am ${fmtDateOfInstant(order.pickupEnd)}` : '' };
  if (order?.status === 'DISPATCHED') return { label: 'Unterwegs', tone: 'orange', note: 'Der Lastwagen ist unterwegs' };
  if (c.status === 'BUNDLED' && order) return { label: 'Transport geplant', tone: 'blue', note: `Abholung ${fmtWindow(order.pickupStart, order.pickupEnd, now)}` };
  return { label: 'Reserviert', tone: 'brand', note: 'Transport wird geplant' };
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
        subtitle={`${available.length === 0 ? 'Gerade keine Angebote' : `${fmtCount(available.length, 'Angebot', 'Angebote')} verfügbar`}. Sie können ganze Angebote oder einzelne Paletten reservieren, solange das Abholfenster offen ist und das Angebot jünger als 4 Tage ist.`}
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
                  const s = reservationStatus(c, now);
                  const partOfOffer = c.pallets < c.donation.numberOfPallets;
                  return (
                    <li key={c.id} className="py-4 flex gap-3.5">
                      <FoodPhoto item={c.donation} className="size-14 rounded-2xl shrink-0" />
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-base font-semibold text-ink">{c.donation.productName}</span>
                        <span className="text-[15px] text-muted tabular-nums whitespace-nowrap">{fmtKg(c.weightKg)}</span>
                      </div>
                      <span className="text-sm text-muted">
                        {c.donation.donor.organizationName} · {fmtPallets(c.pallets)}{partOfOffer ? ` von ${c.donation.numberOfPallets}` : ''}
                      </span>
                      <div><TempPill value={c.donation.temperatureRange} /></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={s.tone}>{s.label}</Pill>
                        {s.note && <span className="text-sm text-muted">{s.note}</span>}
                      </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {claims.length > 0 && <Link href="/network" className={`${linkCls} inline-block mt-5`}>Alle Lieferungen ansehen</Link>}
          </Card>

          <section className="relative overflow-hidden rounded-3xl bg-brand-700 text-white px-6 py-6 flex flex-col gap-1.5 shadow-card">
            <span aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
            <span className="text-[15px] text-brand-100">Bisher erhalten</span>
            <span className="font-display text-4xl font-bold tabular-nums">{fmtKg(impact.totalWeightKg)}</span>
            <span className="text-base text-brand-100">≈ {fmtNumber(impact.meals, 0)} Mahlzeiten für Ihre Gäste</span>
          </section>
        </aside>
      </div>
    </div>
  );
}
